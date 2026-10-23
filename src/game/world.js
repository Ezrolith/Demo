/*
 * World: one playable map. Owns entities, walls, particles and the camera.
 *
 * Maps are built by chapter `maps` functions using the helpers here
 * (wall, room, bake, decal...). Walls are axis-aligned rects; their look comes
 * from WALL_STYLES (extendable per map via world.wallStyles).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;

  // low: blocks movement but not shots/sight. seeThrough: blocks shots, not sight.
  const WALL_STYLES = {
    wall: { top: '#3d4552', face: '#262c35', edge: '#11151b' },
    glass: { top: 'rgba(150,215,255,0.22)', face: 'rgba(120,190,240,0.3)', edge: 'rgba(190,235,255,0.75)', seeThrough: true },
    low: { top: '#7a6a4c', face: '#54472f', edge: '#2e2619', low: true },
    door: { draw: () => {} },
  };

  class World {
    constructor(o = {}) {
      this.w = o.w || 2000;
      this.h = o.h || 2000;
      this.bg = o.bg || '#05070b';
      this.entities = [];
      this.walls = [];
      this.decals = []; // fn(ctx, world, view) drawn above the floor
      this.overlays = []; // fn(ctx, world, view) drawn above entities
      this.barks = [];
      this.particles = new DM.Particles(4000);
      this.camera = new DM.Camera();
      this.camera.bounds = { w: this.w, h: this.h };
      this.baseZoom = o.zoom || 1; // per-map camera zoom; Expand zooms out relative to it
      this.camera.zoom = this.camera.targetZoom = this.baseZoom;
      this.wallStyles = Object.assign({}, WALL_STYLES, o.wallStyles || {});
      this.time = 0;
      this.timeScale = 1;
      this.slowmo = false; // set by Temporal Sight
      this.timesight = false;
      this.mouse = { x: 0, y: 0 };
      this.player = null;
      this.boss = null;
      this.floorCanvas = null;
      this.floorLive = null;
      this.tint = null; // screen tint colour (rgba string)
      this._bodies = [];
      this._deferred = [];
    }

    // Run fn after this frame's entity updates (chain reactions, spawns from callbacks).
    defer(fn) {
      this._deferred.push(fn);
    }

    // ---- building ---------------------------------------------------------
    add(e) {
      e.world = this;
      this.entities.push(e);
      if (e.onAdd) e.onAdd(this);
      return e;
    }

    wall(x, y, w, h, kind = 'wall', extra) {
      const st = this.wallStyles[kind] || this.wallStyles.wall;
      const wl = Object.assign({ x, y, w, h, kind, low: !!st.low, seeThrough: !!st.seeThrough, noCollide: false }, extra || {});
      this.walls.push(wl);
      return wl;
    }

    // A rectangular room outline with door gaps.
    // doors: [{ side: 'top'|'bottom'|'left'|'right', at: offset along side, w: width }]
    room(x, y, w, h, o = {}) {
      const t = o.t || 16;
      const kind = o.kind || 'wall';
      const doors = o.doors || [];
      const side = (name, len, seg) => {
        const gaps = doors.filter((d) => d.side === name).map((d) => [d.at, d.at + d.w]).sort((a, b) => a[0] - b[0]);
        let cur = 0;
        for (const [g0, g1] of gaps) {
          if (g0 > cur) seg(cur, g0);
          cur = Math.max(cur, g1);
        }
        if (cur < len) seg(cur, len);
      };
      side('top', w, (a, b) => this.wall(x + a, y, b - a, t, kind));
      side('bottom', w, (a, b) => this.wall(x + a, y + h - t, b - a, t, kind));
      side('left', h, (a, b) => this.wall(x, y + a, t, b - a, kind));
      side('right', h, (a, b) => this.wall(x + w - t, y + a, t, b - a, kind));
    }

    // Pre-render the static floor once into an offscreen canvas.
    bake(drawFn) {
      const maxPx = 5.5e6;
      const s = Math.min(1, Math.sqrt(maxPx / (this.w * this.h)));
      const c = document.createElement('canvas');
      c.width = Math.ceil(this.w * s);
      c.height = Math.ceil(this.h * s);
      const g = c.getContext('2d');
      g.scale(s, s);
      drawFn(g, this.w, this.h);
      this.floorCanvas = c;
      this.floorScale = s;
    }

    bark(e, text, dur = 1.8) {
      this.barks = this.barks.filter((b) => b.e !== e);
      this.barks.push({ e, text, t: dur, dur });
    }

    // ---- queries ----------------------------------------------------------
    query(x, y, r, filter) {
      const out = [];
      for (const e of this.entities) {
        if (e.dead) continue;
        if (U.dist2(x, y, e.x, e.y) > (r + e.r) * (r + e.r)) continue;
        if (filter && !filter(e)) continue;
        out.push(e);
      }
      return out;
    }

    // Can a circle of radius r stand at (x, y)?
    isFree(x, y, r) {
      if (x < r || y < r || x > this.w - r || y > this.h - r) return false;
      for (const w of this.walls) {
        if (w.noCollide) continue;
        if (U.circleRect(x, y, r, w)) return false;
      }
      return true;
    }

    // Line of sight (low walls and glass don't block sight).
    los(x1, y1, x2, y2) {
      for (const w of this.walls) {
        if (w.noCollide || w.low || w.seeThrough) continue;
        if (U.segRect(x1, y1, x2, y2, w) >= 0) return false;
      }
      return true;
    }

    // First wall hit by a shot along the segment, as t in [0,1] or -1.
    shotHit(x1, y1, x2, y2) {
      let best = -1;
      for (const w of this.walls) {
        if (w.noCollide || w.low) continue;
        const t = U.segRect(x1, y1, x2, y2, w);
        if (t >= 0 && (best < 0 || t < best)) best = t;
      }
      return best;
    }

    // Damage + knockback in a radius. o.team: entities on this team are spared.
    explode(x, y, r, dmg, o = {}) {
      for (const e of this.entities) {
        if (e.dead || e === o.source) continue;
        if (o.team && e.team === o.team) continue;
        const d = U.dist(x, y, e.x, e.y);
        if (d > r + e.r) continue;
        const k = 1 - U.clamp(d / (r + e.r), 0, 1) * 0.6;
        if (e.hp != null || e.isPlayer || e.takesExplosions) e.damage(dmg * k, o.source || null, 'explosion');
        if (!e.static) {
          const n = U.norm(e.x - x, e.y - y);
          const f = (o.force || 520) * k;
          e.vx += (n.x * f) / Math.sqrt(e.mass);
          e.vy += (n.y * f) / Math.sqrt(e.mass);
        }
        if (e.onBlast) e.onBlast(x, y, r, this);
      }
      const P = this.particles;
      const fire = o.colors || ['#ffd27a', '#ff9a3c', '#ff5a2a', '#fff2c4'];
      P.burst(x, y, 26, { color: fire, speed: [40, r * 3.4], life: [0.2, 0.6], size: [4, 9], shape: 'glow', drag: 4 });
      P.burst(x, y, 14, { color: ['#2a2522', '#3a332e', '#1d1a18'], speed: [20, 90], life: [0.7, 1.5], size: [8, 15], size1: 24, shape: 'smoke', add: false, drag: 2, alpha: 0.7 });
      P.emit(x, y, { shape: 'ring', size: r * 0.3, size1: r * 1.1, life: 0.35, color: '#ffe2a8', drag: 0 });
      DM.Audio.play('explosion');
      this.camera.shake(Math.min(0.7, 0.3 * (r / 70)));
    }

    // Broadcast that a disintegration is about to land (bosses may dodge).
    emitCast(c) {
      for (const e of this.entities) if (!e.dead && e.onDisintegrateCast) e.onDisintegrateCast(c, this);
    }

    // ---- simulation -------------------------------------------------------
    update(dt) {
      this.timeScale = U.damp(this.timeScale, this.slowmo ? 0.28 : 1, 9, dt);
      const wdt = dt * this.timeScale;
      const pdt = dt * (this.slowmo ? 0.8 : 1);
      this.time += wdt;
      this.realTime = (this.realTime || 0) + dt;

      const list = this.entities;
      const n = list.length;
      for (let i = 0; i < n; i++) {
        const e = list[i];
        if (e.dead) continue;
        const edt = e.timeless ? pdt : wdt;
        e.age += edt;
        if (e.hitFlash > 0) e.hitFlash -= edt;
        if (e.thrown > 0) e.thrown -= edt;
        e.update(edt, this);
      }
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead || e.static || e.selfMove) continue;
        this.integrate(e, e.timeless ? pdt : wdt);
      }
      this.collideBodies();

      if (this._deferred.length) {
        const q = this._deferred;
        this._deferred = [];
        for (const fn of q) fn(this);
      }

      let anyDead = false;
      for (const e of list) if (e.dead) anyDead = true;
      if (anyDead) {
        this.entities = list.filter((e) => {
          if (e.dead && e.onRemove) e.onRemove(this);
          return !e.dead;
        });
      }

      for (const b of this.barks) b.t -= dt;
      this.barks = this.barks.filter((b) => b.t > 0 && !b.e.dead);
      this.particles.update(wdt);
      this.camera.update(dt);
    }

    integrate(e, dt) {
      if (!e.heldBy) {
        // Thrown things fly: ground friction is mostly off while `thrown` lasts.
        const f = Math.exp(-(e.thrown > 0 ? e.friction * 0.22 : e.friction) * dt);
        e.vx *= f;
        e.vy *= f;
      }
      const travel = (Math.abs(e.vx) + Math.abs(e.vy)) * dt;
      const steps = e.solid ? Math.min(6, Math.max(1, Math.ceil(travel / Math.max(4, e.r * 0.8)))) : 1;
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        e.x += e.vx * sdt;
        e.y += e.vy * sdt;
        if (e.solid) this.collideWalls(e);
      }
      if (e.x < e.r) { e.x = e.r; if (e.vx < 0) e.vx *= -0.3; }
      if (e.y < e.r) { e.y = e.r; if (e.vy < 0) e.vy *= -0.3; }
      if (e.x > this.w - e.r) { e.x = this.w - e.r; if (e.vx > 0) e.vx *= -0.3; }
      if (e.y > this.h - e.r) { e.y = this.h - e.r; if (e.vy > 0) e.vy *= -0.3; }
    }

    collideWalls(e) {
      for (const w of this.walls) {
        if (w.noCollide) continue;
        if (e.flying && w.low) continue;
        if (e.x + e.r < w.x || e.x - e.r > w.x + w.w || e.y + e.r < w.y || e.y - e.r > w.y + w.h) continue;
        const hit = U.circleRect(e.x, e.y, e.r, w);
        if (!hit) continue;
        e.x += hit.nx * hit.depth;
        e.y += hit.ny * hit.depth;
        const vn = e.vx * hit.nx + e.vy * hit.ny;
        if (vn < 0) {
          if (e.onWall) e.onWall(-vn, w, this);
          if (e.thrown > 0 && -vn > 260) e.onImpact(-vn, null, this);
          const b = e.bounce;
          e.vx -= (1 + b) * vn * hit.nx;
          e.vy -= (1 + b) * vn * hit.ny;
        }
      }
    }

    collideBodies() {
      const B = this._bodies;
      B.length = 0;
      for (const e of this.entities) if (e.body && !e.dead) B.push(e);
      B.sort((a, b) => a.x - a.r - (b.x - b.r));
      for (let i = 0; i < B.length; i++) {
        const a = B[i];
        const ax1 = a.x + a.r;
        for (let j = i + 1; j < B.length; j++) {
          const b = B[j];
          if (b.x - b.r > ax1) break;
          if (a.flying !== b.flying) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2);
          const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
          const ima = a.static ? 0 : 1 / a.mass, imb = b.static ? 0 : 1 / b.mass;
          const sum = ima + imb;
          if (sum === 0) continue;
          const overlap = rr - d;
          a.x -= nx * overlap * (ima / sum);
          a.y -= ny * overlap * (ima / sum);
          b.x += nx * overlap * (imb / sum);
          b.y += ny * overlap * (imb / sum);
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            const sp = -rv;
            if ((a.thrown > 0 || b.thrown > 0) && sp > 240) {
              a.onImpact(sp, b, this);
              b.onImpact(sp, a, this);
            }
            const jn = (-1.2 * rv) / sum;
            a.vx -= jn * ima * nx;
            a.vy -= jn * ima * ny;
            b.vx += jn * imb * nx;
            b.vy += jn * imb * ny;
          }
        }
      }
    }

    // ---- rendering --------------------------------------------------------
    // The map's presentation (light, weather, wall surfaces) from src/data/atmosphere.js.
    get atmosphere() {
      return (DM.Atmosphere && DM.Atmosphere.get(this.mapId)) || null;
    }

    // Order: floor, decals, wall shadows, walls, entities, particles; then the
    // light layer (night and interior maps); then the emissive pass, which the
    // light never darkens: entities' renderEmissive (telegraphs), the player's
    // power effects and Temporal Sight's futures; then overlays and barks.
    //
    // world.lit is true while World draws that emissive pass itself (lighting
    // active, or Temporal Sight's colour pass): entities that define
    // renderEmissive call it from render() only while !world.lit.
    render(ctx) {
      const cam = this.camera;
      const view = cam.view();
      const atmo = this.atmosphere;
      const L = DM.Lighting;
      this.lighting = !!(atmo && L && L.active(this, atmo));
      const grade = this.updateSight() > 0.02; // Play.renderTimesight draws the colour pass
      this.lit = this.lighting || grade;
      ctx.save();
      cam.apply(ctx);

      ctx.fillStyle = this.bg;
      ctx.fillRect(view.x0 - 40, view.y0 - 40, view.x1 - view.x0 + 80, view.y1 - view.y0 + 80);
      if (this.floorCanvas) {
        const s = this.floorScale;
        const x0 = Math.max(0, view.x0), y0 = Math.max(0, view.y0);
        const x1 = Math.min(this.w, view.x1), y1 = Math.min(this.h, view.y1);
        if (x1 > x0 && y1 > y0) ctx.drawImage(this.floorCanvas, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s, x0, y0, x1 - x0, y1 - y0);
      }
      if (this.floorLive) this.floorLive(ctx, this, view);
      for (const d of this.decals) d(ctx, this, view);

      this.renderWalls(ctx, view, atmo);

      const vis = (this._vis = this._vis || []);
      const keep = (this._keep = this._keep || []);
      vis.length = keep.length = 0;
      for (const e of this.entities) {
        if (e.dead) continue;
        const m = e.r + 120;
        if (e.x < view.x0 - m || e.x > view.x1 + m || e.y < view.y0 - m || e.y > view.y1 + m) continue;
        vis.push(e);
      }
      vis.sort((a, b) => a.layer - b.layer || a.y - b.y);
      for (const e of vis) {
        if (grade && World.keepsColour(e)) keep.push(e);
        else e.render(ctx, this);
      }
      if (grade) this.trackGhosts(vis);
      this.particles.render(ctx, view);

      if (this.lighting) {
        ctx.restore();
        L.render(ctx, this, atmo);
        ctx.save();
        cam.apply(ctx);
      }
      if (!grade) this.renderEmissive(ctx, vis);
      for (const o of this.overlays) o(ctx, this, view);

      for (const b of this.barks) {
        const a = Math.min(1, b.t * 3, (b.dur - b.t) * 8);
        Gfx.bubble(ctx, b.text, b.e.x, b.e.y - b.e.r - 8, { alpha: a });
      }
      ctx.restore();
    }

    // Telegraphs, power effects and futures: drawn above the light layer (and
    // in full colour during Temporal Sight). ctx is in world space.
    renderEmissive(ctx, vis = this._vis || []) {
      if (this.lit) for (const e of vis) if (e.renderEmissive && !e.dead) e.renderEmissive(ctx, this);
      if (this.player && this.player.renderFx) this.player.renderFx(ctx, this);
      if (this.timesight) for (const e of vis) if (e.renderFuture && !e.dead) e.renderFuture(ctx, this);
    }

    // 0..1: how far Temporal Sight's colour grade has faded in. Follows
    // world.timesight over about 0.3 s, in real time, frozen while paused.
    updateSight() {
      const rt = this.realTime || 0;
      const dt = U.clamp(rt - (this._sightRT == null ? rt : this._sightRT), 0, 0.1);
      this._sightRT = rt;
      this.sightK = U.damp(this.sightK || 0, this.timesight ? 1 : 0, 11, dt);
      if (this.sightK < 0.005 && !this.timesight) this.sightK = 0;
      return this.sightK;
    }

    // Where visible enemies were over the last 0.6 s (world time), for the
    // fading amber ghosts Temporal Sight shows.
    trackGhosts(vis) {
      const G = (this.ghosts = this.ghosts || new Map());
      const t = this.time;
      if (t - (this._ghostT || -1) < 0.1) return;
      this._ghostT = t;
      for (const e of vis) {
        if (e.team !== 'enemy' || e.static || e.isProjectile || e.ko || e.hidden) continue;
        let h = G.get(e);
        if (!h) G.set(e, (h = []));
        h.push(e.x, e.y, t);
        while (h.length > 18 || (h.length && t - h[2] > 0.6)) h.splice(0, 3);
      }
      for (const [e, h] of G) if (e.dead || !h.length || t - h[h.length - 1] > 0.6) G.delete(e);
    }

    // ---- walls ------------------------------------------------------------
    // Two passes over the visible walls: every cast shadow first (one path,
    // 'multiply', away from DM.LIGHT_DIR and scaled by the wall's height),
    // then the bodies with their surface pattern and one ink line.
    renderWalls(ctx, view, atmo) {
      const look = atmo && atmo.walls;
      const LD = DM.LIGHT_DIR;
      const list = (this._wallVis = this._wallVis || []);
      list.length = 0;
      for (const w of this.walls) {
        if (w.x > view.x1 || w.x + w.w + 30 < view.x0 || w.y > view.y1 || w.y + w.h + 30 < view.y0) continue;
        list.push(w);
      }
      let any = false;
      const sp = new Path2D();
      for (const w of list) {
        const st = this.wallStyles[w.kind] || this.wallStyles.wall;
        const a = look && look[w.kind];
        if (w.noShadow || w.draw || st.flat || st.seeThrough || (st.draw && !a) || (a && a.height === 0)) continue;
        const h = a && a.height != null ? a.height : st.height != null ? st.height : st.low ? 0.5 : 1;
        const dx = LD.x * h, dy = LD.y * h;
        const surf = a && a.pattern && DM.WallSurfaces[a.pattern];
        const outline = surf && surf.outline && sp.addPath && surf.outline(w);
        if (outline) {
          // Irregular shapes (rock) cast their own outline, swept along the light.
          sp.addPath(outline, new DOMMatrix([1, 0, 0, 1, dx, dy]));
          sp.addPath(outline, new DOMMatrix([1, 0, 0, 1, dx / 2, dy / 2]));
        } else {
          sp.moveTo(w.x, w.y);
          sp.lineTo(w.x + w.w, w.y);
          sp.lineTo(w.x + w.w + dx, w.y + dy);
          sp.lineTo(w.x + w.w + dx, w.y + w.h + dy);
          sp.lineTo(w.x + dx, w.y + w.h + dy);
          sp.lineTo(w.x, w.y + w.h);
          sp.closePath();
        }
        any = true;
      }
      if (any) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = (atmo && atmo.shadow) || 'rgba(0,0,0,0.3)';
        ctx.fill(sp);
        ctx.restore();
      }
      for (const w of list) this.drawWall(ctx, w, look || null);
    }

    drawWall(ctx, w, look = (this.atmosphere || {}).walls) {
      const st = this.wallStyles[w.kind] || this.wallStyles.wall;
      if (w.draw) return w.draw(ctx, w, this);
      const a = look && look[w.kind];
      if (st.draw && !a) return st.draw(ctx, w, this);
      const surf = a && a.pattern && DM.WallSurfaces[a.pattern];
      if (surf && surf.body) {
        if (surf.body(ctx, w, st, a, this)) return; // drew its own outline
      } else {
        ctx.fillStyle = (a && a.top) || st.top;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        if (surf) surf.overlay(ctx, w, st, a, this);
        if (st.face && w.h > 10 && !st.flat) {
          ctx.fillStyle = (a && a.face) || st.face;
          ctx.fillRect(w.x, w.y + w.h - Math.min(8, w.h * 0.35), w.w, Math.min(8, w.h * 0.35));
        }
      }
      if (st.edge || a) {
        // One comic ink line on everything solid; glass and water keep their edge.
        const ink = !(st.seeThrough || st.flat);
        const lw = ink ? (st.low ? 2 : 2.5) : 1.5;
        ctx.strokeStyle = ink ? DM.C.ink : st.edge;
        ctx.lineWidth = lw;
        ctx.strokeRect(w.x + lw / 2, w.y + lw / 2, w.w - lw, w.h - lw);
      }
    }

    // Kept in full colour by Temporal Sight's grade: Jon and what is not of
    // this moment (duplicates, afterimages), danger (enemy fire, hazards such
    // as meteors and mines) and the memories Sight reveals.
    static keepsColour(e) {
      if (e.isPlayer || e.isDuplicate || e.timeless || e.hazard) return true;
      if (e.isProjectile && e.team !== 'player') return true;
      const Sp = DM.Special;
      return !!(Sp && Sp.Memory && e instanceof Sp.Memory);
    }
  }

  // Light falls from the top left; shadows fall this far for a wall of height 1.
  DM.LIGHT_DIR = { x: 10, y: 14 };

  // ---- wall surfaces ----------------------------------------------------------
  // Procedural surface looks, picked per map and wall kind in atmosphere.js
  // (walls: { kind: { pattern, height, top, ... } }). overlay() draws over the
  // wall's base fill; body() replaces the whole wall and returns true if it drew
  // its own outline. Tiles are cached CanvasPatterns painted at twice world
  // resolution; per-wall detail is seeded by the wall's rect and cached on it.
  const tiles = new Map();
  function tile(ctx, key, w, h, paint) {
    let p = tiles.get(key);
    if (p) return p;
    const c = document.createElement('canvas');
    c.width = w * 2;
    c.height = h * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    paint(g, w, h);
    p = ctx.createPattern(c, 'repeat');
    if (p.setTransform && typeof DOMMatrix === 'function') p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
    tiles.set(key, p);
    return p;
  }
  const seedOf = (w) => (Math.imul(w.x | 0, 73856093) ^ Math.imul(w.y | 0, 19349663) ^ Math.imul((w.w | 0) + 7, 83492791) ^ Math.imul((w.h | 0) + 3, 2654435761)) >>> 0;
  const deco = (w, key, make) => w['_' + key] || (w['_' + key] = make(U.seeded(seedOf(w))));
  const patternFill = (ctx, pat, w) => {
    ctx.fillStyle = pat;
    ctx.fillRect(w.x, w.y, w.w, w.h);
  };
  const along = (w) => w.w >= w.h; // long axis is horizontal

  // A faceted rock: the wall split into chunks along its long axis, each an
  // irregular polygon inset in the rect and fanned from an apex nudged towards
  // the light, its facets shaded by which way they face.
  function rockPaths(w, rnd) {
    const P = { lit: new Path2D(), mid: new Path2D(), dark: new Path2D(), ink: new Path2D() };
    const hz = along(w);
    const short = hz ? w.h : w.w, long = hz ? w.w : w.h;
    const n = Math.max(1, Math.round(long / Math.max(short * 2.2, 40)));
    const seg = long / n;
    for (let i = 0; i < n; i++) {
      const r = hz ? { x: w.x + i * seg - (i ? 3 : 0), y: w.y, w: seg + (i ? 3 : 0), h: w.h } : { x: w.x, y: w.y + i * seg - (i ? 3 : 0), w: w.w, h: seg + (i ? 3 : 0) };
      const ins = Math.min(r.w, r.h) * 0.16;
      const pts = [];
      const k = 3; // points per side
      const side = (x0, y0, x1, y1, nx, ny) => {
        for (let j = 0; j < k; j++) {
          const f = (j + rnd() * 0.6) / k, d = ins * (j === 0 ? 0.9 + rnd() * 0.6 : rnd());
          pts.push([x0 + (x1 - x0) * f + nx * d, y0 + (y1 - y0) * f + ny * d]);
        }
      };
      side(r.x, r.y, r.x + r.w, r.y, 0, 1);
      side(r.x + r.w, r.y, r.x + r.w, r.y + r.h, -1, 0);
      side(r.x + r.w, r.y + r.h, r.x, r.y + r.h, 0, -1);
      side(r.x, r.y + r.h, r.x, r.y, 1, 0);
      const ax = r.x + r.w * (0.42 + rnd() * 0.1), ay = r.y + r.h * (0.4 + rnd() * 0.1);
      P.ink.moveTo(pts[0][0], pts[0][1]);
      for (let j = 0; j < pts.length; j++) {
        const a = pts[j], b = pts[(j + 1) % pts.length];
        P.ink.lineTo(b[0], b[1]);
        // Facet normal (outward) against the light from the top left.
        const mx = (a[0] + b[0]) / 2 - ax, my = (a[1] + b[1]) / 2 - ay;
        const dot = (mx * -0.58 + my * -0.81) / (Math.hypot(mx, my) || 1);
        const path = dot > 0.2 ? P.lit : dot < -0.15 ? P.dark : P.mid;
        path.moveTo(ax, ay);
        path.lineTo(a[0], a[1]);
        path.lineTo(b[0], b[1]);
        path.closePath();
      }
      P.ink.closePath();
    }
    return P;
  }

  const Surfaces = {
    // Corrugated shipping containers: ribs across the long axis, a rust streak
    // or two, and the door end with its lock rods.
    ribbed: {
      overlay(ctx, w) {
        const hz = along(w);
        patternFill(ctx, tile(ctx, hz ? 'ribV' : 'ribH', 6, 6, (g) => {
          g.fillStyle = 'rgba(255,255,255,0.1)';
          if (hz) g.fillRect(0, 0, 1.5, 6);
          else g.fillRect(0, 0, 6, 1.5);
          g.fillStyle = 'rgba(0,0,0,0.26)';
          if (hz) g.fillRect(3, 0, 1.5, 6);
          else g.fillRect(0, 3, 6, 1.5);
        }), w);
        const d = deco(w, 'ribbed', (rnd) => ({
          end: rnd() < 0.5,
          rust: Array.from({ length: 2 + ((rnd() * 3) | 0) }, () => [rnd(), 0.05 + rnd() * 0.06, 0.3 + rnd() * 0.6]),
        }));
        const L = hz ? w.w : w.h, S = hz ? w.h : w.w;
        ctx.fillStyle = 'rgba(120,50,20,0.32)';
        for (const [f, wd, len] of d.rust) {
          if (hz) ctx.fillRect(w.x + f * (L - L * wd), w.y + 3, L * wd, S * len);
          else ctx.fillRect(w.x + 3, w.y + f * (L - L * wd), S * len, L * wd);
        }
        // door end: seam, frame and four lock rods
        const e = d.end ? 0 : L - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        if (hz) ctx.fillRect(w.x + e, w.y + 2, 14, w.h - 4);
        else ctx.fillRect(w.x + 2, w.y + e, w.w - 4, 14);
        ctx.strokeStyle = 'rgba(220,220,210,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const o = e + 2.5 + i * 3;
          if (hz) {
            ctx.moveTo(w.x + o, w.y + 4);
            ctx.lineTo(w.x + o, w.y + w.h - 4);
          } else {
            ctx.moveTo(w.x + 4, w.y + o);
            ctx.lineTo(w.x + w.w - 4, w.y + o);
          }
        }
        ctx.stroke();
      },
    },

    // Running-bond brickwork.
    brick: {
      overlay(ctx, w) {
        patternFill(ctx, tile(ctx, 'brick', 20, 10, (g) => {
          g.fillStyle = 'rgba(255,220,200,0.07)';
          g.fillRect(0, 0, 20, 1.2);
          g.fillRect(0, 5, 20, 1.2);
          g.fillStyle = 'rgba(0,0,0,0.32)';
          g.fillRect(0, 4, 20, 1);
          g.fillRect(0, 9, 20, 1);
          g.fillRect(9, 0, 1, 4);
          g.fillRect(19, 5, 1, 4);
        }), w);
      },
    },

    // Rows of rounded bags with seams.
    sandbag: {
      overlay(ctx, w) {
        patternFill(ctx, tile(ctx, along(w) ? 'bagH' : 'bagV', along(w) ? 18 : 11, along(w) ? 11 : 18, (g, tw, th) => {
          const bag = (x, y, bw, bh) => {
            g.fillStyle = 'rgba(255,245,220,0.16)';
            Gfx.rr(g, x + 1, y + 1, bw - 2, bh - 2, Math.min(bw, bh) * 0.45);
            g.fill();
            g.strokeStyle = 'rgba(40,30,15,0.38)';
            g.lineWidth = 0.8;
            g.stroke();
            g.fillStyle = 'rgba(0,0,0,0.12)';
            g.fillRect(x + bw * 0.25, y + bh - 3, bw * 0.5, 1.5);
          };
          if (tw > th) {
            bag(0, 0, 18, 5.5);
            bag(-9, 5.5, 18, 5.5);
            bag(9, 5.5, 18, 5.5);
          } else {
            bag(0, 0, 5.5, 18);
            bag(5.5, -9, 5.5, 18);
            bag(5.5, 9, 5.5, 18);
          }
        }), w);
      },
    },

    // Faceted rock: lit top left, dark bottom right.
    rock: {
      outline: (w) => deco(w, 'rock', (rnd) => rockPaths(w, rnd)).ink,
      body(ctx, w, st, a) {
        const P = deco(w, 'rock', (rnd) => rockPaths(w, rnd));
        const top = (a && a.top) || st.top || '#7a5a3a';
        ctx.fillStyle = top;
        ctx.fill(P.ink);
        ctx.fillStyle = (a && a.lit) || U.mix(top, '#fff4e0', 0.28);
        ctx.fill(P.lit);
        ctx.fillStyle = (a && a.dark) || U.mix(top, '#000000', 0.38);
        ctx.fill(P.dark);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke(P.lit);
        ctx.strokeStyle = DM.C.ink;
        ctx.lineWidth = 2.5;
        const join = ctx.lineJoin;
        ctx.lineJoin = 'round';
        ctx.stroke(P.ink);
        ctx.lineJoin = join;
        return true;
      },
    },

    // Ice: facet lines, a specular streak and cyan cracks.
    ice: {
      overlay(ctx, w) {
        const d = deco(w, 'ice', (rnd) => {
          const facets = new Path2D(), cracks = new Path2D();
          const hz = along(w), L = hz ? w.w : w.h, S = hz ? w.h : w.w;
          const pt = (u, v) => (hz ? [w.x + u, w.y + v] : [w.x + v, w.y + u]);
          for (let u = 10 + rnd() * 30; u < L - 6; u += 28 + rnd() * 40) {
            const a = pt(u, 0), b = pt(u + (rnd() - 0.5) * S * 1.4, S);
            facets.moveTo(a[0], a[1]);
            facets.lineTo(b[0], b[1]);
          }
          for (let c = 0; c < Math.max(1, L / 140); c++) {
            let u = rnd() * L, v = rnd() * S;
            let p = pt(u, v);
            cracks.moveTo(p[0], p[1]);
            for (let s = 0; s < 4; s++) {
              u = U.clamp(u + (rnd() - 0.3) * 22, 2, L - 2);
              v = U.clamp(v + (rnd() - 0.5) * S * 0.7, 2, S - 2);
              p = pt(u, v);
              cracks.lineTo(p[0], p[1]);
            }
          }
          return { facets, cracks, spec: rnd() };
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke(d.facets);
        ctx.strokeStyle = 'rgba(70,170,220,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke(d.cracks);
        // specular streak near the lit edge
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        if (along(w)) ctx.fillRect(w.x + 4, w.y + 3, w.w - 8, Math.min(3, w.h * 0.15));
        else ctx.fillRect(w.x + 3, w.y + 4, Math.min(3, w.w * 0.15), w.h - 8);
      },
    },

    // Warehouse racking: boxes, sacks and barrels on the shelves.
    shelf: {
      overlay(ctx, w) {
        const hz = along(w), L = hz ? w.w : w.h, S = hz ? w.h : w.w;
        const d = deco(w, 'shelf', (rnd) => {
          const items = [];
          for (let u = 3; u < L - 8;) {
            const len = 8 + rnd() * 14;
            if (rnd() < 0.82) items.push({ u, len: Math.min(len, L - 3 - u), barrel: rnd() < 0.25, c: ['#7a5a36', '#8a6a40', '#5a5a48', '#6b3a2a', '#9a8a68'][(rnd() * 5) | 0], v: rnd() });
            u += len + 2;
          }
          return items;
        });
        for (const it of d) {
          const iw = it.len, ih = S * (0.55 + it.v * 0.25);
          const x = hz ? w.x + it.u : w.x + (S - ih) / 2, y = hz ? w.y + (S - ih) / 2 : w.y + it.u;
          const bw = hz ? iw : ih, bh = hz ? ih : iw;
          ctx.fillStyle = it.c;
          if (it.barrel) {
            Gfx.circle(ctx, x + bw / 2, y + bh / 2, Math.min(bw, bh) / 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.fillRect(x, y, bw, bh);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(x, y, bw, 1.5);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            if (hz) ctx.fillRect(x + bw / 2 - 0.5, y, 1, bh);
            else ctx.fillRect(x, y + bh / 2 - 0.5, bw, 1);
          }
        }
      },
    },

    // Karnak gold: a band of inlaid glyphs along the wall and a stepped rim.
    gold: {
      overlay(ctx, w) {
        const hz = along(w), S = hz ? w.h : w.w;
        ctx.strokeStyle = 'rgba(255,240,190,0.45)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(w.x + 4, w.y + 4, w.w - 8, w.h - 8);
        ctx.strokeStyle = 'rgba(80,55,10,0.4)';
        ctx.strokeRect(w.x + 7, w.y + 7, w.w - 14, w.h - 14);
        if (S < 22 || w.w === w.h) return;
        const band = hz ? { x: w.x + 8, y: w.y + S / 2 - 5, w: w.w - 16, h: 10 } : { x: w.x + S / 2 - 5, y: w.y + 8, w: 10, h: w.h - 16 };
        patternFill(ctx, tile(ctx, hz ? 'glyphH' : 'glyphV', hz ? 16 : 10, hz ? 10 : 16, (g, tw, th) => {
          g.fillStyle = 'rgba(70,45,5,0.55)';
          if (tw > th) {
            g.fillRect(2, 2, 2, 6);
            g.fillRect(5, 2, 4, 2);
            g.fillRect(7, 4, 2, 4);
            g.fillRect(11, 3, 3, 3);
          } else {
            g.fillRect(2, 2, 6, 2);
            g.fillRect(2, 5, 2, 4);
            g.fillRect(4, 7, 4, 2);
            g.fillRect(3, 11, 3, 3);
          }
        }), band);
      },
    },

    // Poured concrete: panel seams and a fine speckle.
    concrete: {
      overlay(ctx, w) {
        patternFill(ctx, tile(ctx, 'concrete', 32, 32, (g) => {
          const rnd = U.seeded(9);
          for (let i = 0; i < 26; i++) {
            g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
            g.fillRect(rnd() * 32, rnd() * 32, 1.2, 1.2);
          }
        }), w);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        if (along(w)) for (let x = w.x + 40; x < w.x + w.w - 10; x += 40) ctx.fillRect(x, w.y, 1, w.h);
        else for (let y = w.y + 40; y < w.y + w.h - 10; y += 40) ctx.fillRect(w.x, y, w.w, 1);
      },
    },
  };

  DM.WallSurfaces = Surfaces;
  DM.World = World;
  DM.WALL_STYLES = WALL_STYLES;
})();
