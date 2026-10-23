/*
 * Lighting: darkness and light for night and interior maps.
 *
 * A half-resolution canvas is filled with the map's ambient darkness, lights
 * are punched out of it with 'destination-out' (cached radial and cone falloff
 * sprites, in screen space), and the result is laid over the world. A second
 * half-resolution canvas collects each light's colour and is added on top with
 * 'lighter'. Two full-screen blits per frame, whatever the number of lights.
 * Maps without darkness (daylight) skip all of it and cost nothing.
 *
 * The look of each map comes from its profile in src/data/atmosphere.js
 * (keyed by world.mapId):
 *   light: {
 *     ambient: 'rgba(...)' | fn(world) -> colour or null (null = no darkness)
 *     zones: [{ x, y, w, h, ambient }]   world rects with their own darkness
 *     player: 1                           Jon's light radius multiplier (0 = none)
 *     lights(world, add, t)               the map's own lights (lamps, beacons...)
 *   }
 * add(x, y, r, o) takes world units; o: { i (strength 0..1), color, k (colour
 * strength), cone (angle), spread (half-angle), flicker }.
 *
 * Everything else lights itself from game state, so no entity needs to know
 * about lighting: Jon, his duplicates, projectiles, additive glow particles
 * (explosions light the yard), emitters, atoms in the void, and a flashlight
 * along the facing of every armed man still standing (which also shows where
 * he is aiming).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;

  const S = 0.5; // light layer resolution relative to the logical screen
  const MAX_LIGHTS = 160;
  const MAX_PARTICLE_LIGHTS = 48;
  const MAX_ATOM_LIGHTS = 64;
  const CONE_SPREAD = 0.5; // half-angle baked into the cone sprite

  let dark = null, tint = null, dg = null, tg = null;
  let radial = null, cone = null;
  const pool = [];
  let count = 0;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Alpha falloff used to punch lights out of the darkness.
  function radialSprite() {
    const c = canvas(128, 128);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.45, 'rgba(0,0,0,0.75)');
    gr.addColorStop(0.8, 'rgba(0,0,0,0.22)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  // A wedge pointing right from (0, 128), soft at its edges and its far end.
  function coneSprite() {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const sp = CONE_SPREAD * (1 - i * 0.11);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.moveTo(0, 128);
      g.arc(0, 128, 256, -sp, sp);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createRadialGradient(0, 128, 0, 0, 128, 256);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0.7)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return c;
  }

  function setup() {
    if (dark) return;
    const w = Math.round(DM.W * S), h = Math.round(DM.H * S);
    dark = canvas(w, h);
    tint = canvas(w, h);
    dg = dark.getContext('2d');
    tg = tint.getContext('2d');
    radial = radialSprite();
    cone = coneSprite();
  }

  // Lights are pooled objects so a frame of 100 lights allocates nothing.
  function add(x, y, r, o) {
    if (count >= MAX_LIGHTS || !(r > 0)) return null;
    let l = pool[count];
    if (!l) l = pool[count] = {};
    count++;
    l.x = x;
    l.y = y;
    l.r = r;
    l.i = o && o.i != null ? o.i : 1;
    l.color = (o && o.color) || null;
    l.k = (o && o.k) || 0;
    l.cone = o && o.cone != null ? o.cone : null;
    l.spread = (o && o.spread) || 0.4;
    l.flicker = !!(o && o.flicker);
    l.seed = (o && o.seed) || x * 0.013 + y * 0.007;
    return l;
  }

  const reducedFlashing = () => !!(DM.SettingsSchema && DM.SettingsSchema.reducedFlashing());

  const Lighting = {
    S,
    stats: { lights: 0, ms: 0 },
    // The half-resolution layers (for tests and debugging).
    layers: () => ({ dark, tint }),

    // Darkness colour for this frame, or null when the map is lit by day.
    ambient(world, profile) {
      const L = profile && profile.light;
      if (!L) return null;
      return typeof L.ambient === 'function' ? L.ambient(world) : L.ambient || null;
    },
    active(world, profile) {
      return !!Lighting.ambient(world, profile);
    },

    // Gather this frame's lights (world units) from the profile and the game state.
    collect(world, profile) {
      count = 0;
      const L = profile.light;
      const t = world.realTime || 0;
      const view = world.camera.view();
      const m = 320;
      const near = (x, y, r) => x > view.x0 - r - m && x < view.x1 + r + m && y > view.y0 - r - m && y < view.y1 + r + m;
      const p = world.player;
      const pm = L.player == null ? 1 : L.player;
      if (p && !p.hidden && pm > 0) {
        const fade = p.down ? 0.4 : 1;
        if (p.form === 'manhattan') add(p.x, p.y, 260 * (p.scale || 1) * pm, { i: fade, color: '#5fd4ff', k: 0.2 * fade });
        else if (p.form === 'awareness') add(p.x, p.y, 230 * pm, { i: fade, color: '#5fd4ff', k: 0.24 * fade });
      }
      if (L.lights) L.lights(world, add, t);
      const Proj = DM.Proj || {}, En = DM.Enemies || {}, Sp = DM.Special || {};
      let atoms = 0;
      for (const e of world.entities) {
        if (e.dead || e.hidden) continue;
        if (!near(e.x, e.y, 300)) continue;
        if (e.isDuplicate) add(e.x, e.y, 170, { i: 0.85, color: '#5fd4ff', k: 0.12 });
        else if (e.isProjectile) {
          if (Proj.Missile && e instanceof Proj.Missile) add(e.x, e.y, 90, { i: 0.8, color: '#ff9a3c', k: 0.2 });
          else if (Proj.TachyonDisc && e instanceof Proj.TachyonDisc) add(e.x, e.y, 70, { i: 0.7, color: '#c06bff', k: 0.22 });
          else if (Proj.Shell && e instanceof Proj.Shell) add(e.x, e.y, 60, { i: 0.6, color: '#ffd27a', k: 0.16 });
          else add(e.x, e.y, 54, { i: 0.65, color: e.color && e.color[0] === '#' ? e.color : '#ffd27a', k: 0.18 });
        } else if (En.Emitter && e instanceof En.Emitter) add(e.x, e.y, 210, { i: 0.75, color: '#c06bff', k: 0.2 });
        else if (Sp.Atom && e instanceof Sp.Atom) {
          if (atoms++ < MAX_ATOM_LIGHTS) add(e.x, e.y, 44, { i: 0.55, color: '#bff1ff', k: 0.12 });
        } else if (e.human && e.team === 'enemy' && !e.ko) {
          // An armed man carries a flashlight along his facing (it shows where he
          // aims); every hostile gets a little spill so he never vanishes.
          const a = e.facing || 0;
          if (e.gun && !e.heldBy) add(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, 330, { i: 0.78, cone: a, spread: 0.34, color: '#fff2c4', k: 0.05 });
          add(e.x, e.y, 80, { i: 0.55 });
        } else if (Sp.Memory && e instanceof Sp.Memory && world.timesight) add(e.x, e.y, 90, { i: 0.7, color: '#f2c418', k: 0.15 });
      }
      let parts = 0;
      const P = world.particles.list;
      for (let i = 0; i < P.length && parts < MAX_PARTICLE_LIGHTS; i++) {
        const q = P[i];
        if (!q.add || q.shape !== 'glow' || q.size < 2.5) continue;
        const f = 1 - q.t / q.life;
        const r = q.size * 14 * f;
        if (r < 12 || !near(q.x, q.y, r)) continue;
        parts++;
        add(q.x, q.y, r, { i: 0.85 * f, color: q.color && q.color[0] === '#' ? q.color : null, k: 0.06 * f });
      }
      return count;
    },

    // Draw the light layer over the world. ctx is in logical screen space.
    render(ctx, world, profile) {
      const ambient = Lighting.ambient(world, profile);
      if (!ambient) return false;
      const t0 = performance.now();
      setup();
      const cam = world.camera;
      const z = cam.zoom * S;
      // Same mapping as Camera.apply, shake included, scaled to the light layer.
      const ox = (DM.W / 2) * S - (cam.x - cam.ox) * z, oy = (DM.H / 2) * S - (cam.y - cam.oy) * z;
      const W = dark.width, H = dark.height;
      dg.globalCompositeOperation = 'source-over';
      dg.globalAlpha = 1;
      dg.clearRect(0, 0, W, H);
      dg.fillStyle = ambient;
      dg.fillRect(0, 0, W, H);
      for (const zn of profile.light.zones || []) {
        const a = typeof zn.ambient === 'function' ? zn.ambient(world) : zn.ambient;
        const x = zn.x * z + ox, y = zn.y * z + oy, w = zn.w * z, h = zn.h * z;
        if (x > W || y > H || x + w < 0 || y + h < 0) continue;
        dg.clearRect(x, y, w, h);
        if (a) {
          dg.fillStyle = a;
          dg.fillRect(x, y, w, h);
        }
      }
      const n = Lighting.collect(world, profile);
      const steady = reducedFlashing();
      const tm = world.realTime || 0;
      tg.globalCompositeOperation = 'source-over';
      tg.globalAlpha = 1;
      tg.clearRect(0, 0, W, H);
      tg.globalCompositeOperation = 'lighter';
      dg.globalCompositeOperation = 'destination-out';
      let drawn = 0;
      for (let i = 0; i < n; i++) {
        const l = pool[i];
        const sx = l.x * z + ox, sy = l.y * z + oy, r = l.r * z;
        if (sx + r < 0 || sy + r < 0 || sx - r > W || sy - r > H) continue;
        drawn++;
        // Lamps breathe a little; never with REDUCED flashing.
        const fl = l.flicker && !steady ? 0.9 + 0.1 * Math.sin(tm * 9 + l.seed) * Math.sin(tm * 5.3 + l.seed * 2) : 1;
        dg.globalAlpha = U.clamp(l.i * fl, 0, 1);
        if (l.cone != null) {
          const sy2 = Math.tan(l.spread) / Math.tan(CONE_SPREAD);
          dg.save();
          dg.translate(sx, sy);
          dg.rotate(l.cone);
          dg.scale(r / 256, (r / 256) * sy2);
          dg.drawImage(cone, 0, -128);
          dg.restore();
          dg.drawImage(radial, sx - r * 0.12, sy - r * 0.12, r * 0.24, r * 0.24);
        } else dg.drawImage(radial, sx - r, sy - r, r * 2, r * 2);
        if (l.color && l.k > 0) {
          tg.globalAlpha = U.clamp(l.k * fl, 0, 1);
          if (l.cone != null) {
            const cx = sx + Math.cos(l.cone) * r * 0.45, cy = sy + Math.sin(l.cone) * r * 0.45;
            tg.drawImage(Gfx.glowSprite(l.color, r), cx - r * 0.5, cy - r * 0.5, r, r);
          } else tg.drawImage(Gfx.glowSprite(l.color, r), sx - r * 0.8, sy - r * 0.8, r * 1.6, r * 1.6);
        }
      }
      dg.globalAlpha = 1;
      tg.globalAlpha = 1;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(dark, 0, 0, DM.W, DM.H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(tint, 0, 0, DM.W, DM.H);
      ctx.restore();
      Lighting.stats.lights = drawn;
      Lighting.stats.ms = performance.now() - t0;
      return true;
    },
  };

  DM.Lighting = Lighting;
})();
