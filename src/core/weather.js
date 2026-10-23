/*
 * Weather: ambient motion over each map (snow, dust, drizzle, parallax stars,
 * haze) so no place is a still picture. Layers come from the map's profile in
 * src/data/atmosphere.js:
 *   weather: [{ type, n, color, wind, exclude: [rects], only: rect, ... }]
 * `exclude` / `only` are world rects (indoors, outdoors) the layer is clipped to.
 *
 * Particles live in screen space with a depth z. They wrap around the screen
 * and shift by the camera's movement times z, so near ones parallax more. Time
 * is world time: Temporal Sight slows the snow and the pause menu freezes it.
 * Drawn by Play after the world. Save.settings.fx: 'full', 'reduced' (half the
 * particles) or 'off'.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const TAU = Math.PI * 2;
  const PAD = 40;
  const SW = DM.W + PAD * 2, SH = DM.H + PAD * 2;

  const sprites = {};
  function sprite(key, size, paint) {
    if (sprites[key]) return sprites[key];
    const c = document.createElement('canvas');
    c.width = size[0];
    c.height = size[1];
    paint(c.getContext('2d'), size[0], size[1]);
    return (sprites[key] = c);
  }
  // A soft horizontal band (snow haze) and a soft diagonal shaft (light through dust).
  const bandSprite = () => sprite('band', [8, 128], (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const shaftSprite = () => sprite('shaft', [64, 256], (g, w, h) => {
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,240,210,0)');
    gx.addColorStop(0.5, 'rgba(255,240,210,1)');
    gx.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = gx;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(0.25, 'rgba(0,0,0,1)');
    gy.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gy;
    g.fillRect(0, 0, w, h);
  });
  // Soft dark blob for cloud shadows (drawn with 'multiply').
  const cloudSprite = (color) => sprite('cloud' + color, [128, 128], (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, U.rgba(color, 1));
    gr.addColorStop(0.6, U.rgba(color, 0.6));
    gr.addColorStop(1, U.rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });

  const fxLevel = () => {
    const S = DM.Save && DM.Save.settings;
    const v = S && S.fx;
    return v === 'off' || v === 'reduced' ? v : 'full';
  };

  // ---- layer types --------------------------------------------------------------
  // init(layer, n, rnd) builds the pool; step(layer, dt, t, dx, dy) moves it
  // (dx, dy: camera movement in screen px this frame); draw(ctx, layer, world, t).
  const wrap = (p) => {
    if (p.x < -PAD) p.x += SW;
    else if (p.x > DM.W + PAD) p.x -= SW;
    if (p.y < -PAD) p.y += SH;
    else if (p.y > DM.H + PAD) p.y -= SH;
  };
  const scatter = (n, rnd, zMin, zMax) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: rnd() * SW - PAD, y: rnd() * SH - PAD, z: zMin + rnd() * (zMax - zMin), s: rnd() });
    return out;
  };
  const drift = (L, dt, dx, dy, vx, vy) => {
    for (const p of L.ps) {
      p.x += vx * p.z * dt - dx * p.z;
      p.y += vy * p.z * dt - dy * p.z;
      wrap(p);
    }
  };

  const TYPES = {
    // Wind-blown streaks with gusts, plus soft haze bands rolling through.
    snow: {
      n: 260,
      init(L, n, rnd) {
        L.ps = scatter(n, rnd, 0.35, 1.5);
        L.bands = [0, 1, 2].map((i) => ({ y: rnd() * SH, z: 0.4 + i * 0.3, h: 90 + i * 50 }));
      },
      step(L, dt, t, dx, dy) {
        L.gust = 1 + Math.sin(t * 0.7) * 0.35 + Math.sin(t * 2.3 + 1) * 0.15;
        drift(L, dt, dx, dy, (L.wind || -260) * L.gust, L.fall || 95);
        for (const b of L.bands) {
          b.y += (25 + 30 * b.z) * dt * L.gust - dy * b.z;
          if (b.y > DM.H + b.h) b.y -= DM.H + b.h * 2;
          if (b.y < -b.h) b.y += DM.H + b.h * 2;
        }
      },
      draw(ctx, L) {
        const wind = (L.wind || -260) * L.gust, fall = L.fall || 95;
        ctx.lineCap = 'round';
        ctx.strokeStyle = L.color || '#ffffff';
        for (let b = 0; b < 3; b++) {
          const z0 = 0.35 + b * 0.39, z1 = z0 + 0.39;
          ctx.globalAlpha = 0.45 + b * 0.2;
          ctx.lineWidth = 1.3 + b * 0.75;
          ctx.beginPath();
          for (const p of L.ps) {
            if (p.z < z0 || p.z >= z1) continue;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - wind * p.z * 0.04, p.y - fall * p.z * 0.04);
          }
          ctx.stroke();
        }
        const spr = bandSprite();
        for (const b of L.bands) {
          ctx.globalAlpha = 0.07 + 0.05 * b.z;
          ctx.drawImage(spr, 0, b.y - b.h / 2, DM.W, b.h);
        }
      },
    },

    // Slow motes, and now and then a dust devil whirling across the ground.
    // `clouds` adds big soft cloud shadows sliding over the map.
    dust: {
      n: 150,
      init(L, n, rnd) {
        L.ps = scatter(n, rnd, 0.4, 1.4);
        L.gusts = scatter(Math.round(n / 6), rnd, 0.8, 1.6); // long faint streaks of blown sand
        L.devil = null;
        L.nextDevil = 2 + rnd() * 4;
        L.rnd = rnd;
        if (L.clouds) L.cl = [0, 1, 2, 3].map(() => ({ x: rnd() * 2600, y: rnd() * 2600, r: 280 + rnd() * 260 }));
      },
      step(L, dt, t, dx, dy, world) {
        const wind = L.wind || 60;
        drift(L, dt, dx, dy, wind, 8);
        for (const p of L.ps) p.y += Math.sin(t * 1.3 + p.s * 20) * 6 * dt;
        for (const p of L.gusts) {
          p.x += wind * 5 * p.z * dt - dx * p.z;
          p.y += 12 * p.z * dt - dy * p.z;
          wrap(p);
        }
        L.nextDevil -= dt;
        if (!L.devil && L.nextDevil <= 0) {
          const v = world.camera.view();
          const fromLeft = wind >= 0;
          L.devil = {
            x: fromLeft ? v.x0 - 80 : v.x1 + 80, y: U.lerp(v.y0, v.y1, 0.2 + L.rnd() * 0.6),
            vx: (fromLeft ? 1 : -1) * (110 + L.rnd() * 60), vy: (L.rnd() - 0.5) * 50, t: 0, life: (v.x1 - v.x0 + 160) / 120,
            ps: Array.from({ length: 30 }, (_, i) => ({ a: L.rnd() * TAU, r: 6 + (i / 30) * 46, h: L.rnd() })),
          };
        }
        const d = L.devil;
        if (d) {
          d.t += dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          for (const p of d.ps) p.a += dt * (7 - p.r * 0.07);
          if (d.t > d.life) {
            L.devil = null;
            L.nextDevil = 6 + L.rnd() * 4;
          }
        }
        if (L.cl) for (const c of L.cl) {
          c.x += 26 * dt;
          c.y += 9 * dt;
          if (c.x - c.r > world.w) c.x = -c.r;
          if (c.y - c.r > world.h) c.y = -c.r;
        }
      },
      draw(ctx, L, world) {
        const cam = world.camera;
        if (L.cl) {
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.5;
          const spr = cloudSprite(L.cloudColor || '#8a5a48');
          for (const c of L.cl) {
            const s = toScreen(cam, c.x, c.y), r = c.r * cam.zoom;
            if (s.x + r < 0 || s.y + r < 0 || s.x - r > DM.W || s.y - r > DM.H) continue;
            ctx.drawImage(spr, s.x - r, s.y - r * 0.7, r * 2, r * 1.4);
          }
          ctx.restore();
        }
        const col = L.color || '#e8c89a';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        const sx = (L.wind || 60) >= 0 ? -1 : 1;
        for (const p of L.gusts) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + sx * 46 * p.z, p.y - 3 * p.z);
        }
        ctx.stroke();
        ctx.fillStyle = col;
        for (const p of L.ps) {
          ctx.globalAlpha = 0.3 + p.z * 0.3;
          const s = 1.4 + p.z * 1.6;
          ctx.fillRect(p.x, p.y, s, s);
        }
        const d = L.devil;
        if (d) {
          const s = toScreen(cam, d.x, d.y);
          const k = Math.min(1, d.t * 1.5, (d.life - d.t) * 1.5);
          const z = cam.zoom;
          ctx.globalAlpha = 0.16 * k;
          ctx.drawImage(cloudSprite(L.devilColor || '#c8a070'), s.x - 60 * z, s.y - 46 * z, 120 * z, 92 * z);
          ctx.fillStyle = L.devilColor || '#c8a070';
          for (const p of d.ps) {
            ctx.globalAlpha = (0.25 + p.h * 0.35) * k;
            ctx.fillRect(s.x + Math.cos(p.a) * p.r * z, s.y + Math.sin(p.a) * p.r * 0.6 * z - p.h * 26 * z, 2.5, 2.5);
          }
        }
      },
    },

    // Fast thin diagonal rain, and ripples opening on the map's puddles.
    drizzle: {
      n: 220,
      init(L, n, rnd) {
        L.ps = scatter(n, rnd, 0.5, 1.4);
        L.rip = [];
        L.rnd = rnd;
      },
      step(L, dt, t, dx, dy, world) {
        drift(L, dt, dx, dy, L.wind || -140, 760);
        for (const r of L.rip) r.t += dt;
        L.rip = L.rip.filter((r) => r.t < 0.7);
        const pud = L.puddles;
        if (pud && pud.length && L.rip.length < 36) {
          const v = world.camera.view();
          for (let i = 0; i < 3; i++) {
            if (L.rnd() > dt * 16) continue;
            const p = pud[(L.rnd() * pud.length) | 0];
            if (p.x + p.rx < v.x0 || p.x - p.rx > v.x1 || p.y + p.rx < v.y0 || p.y - p.rx > v.y1) continue;
            const a = L.rnd() * TAU, d = Math.sqrt(L.rnd()) * 0.8;
            const x = p.x + Math.cos(a) * p.rx * d, y = p.y + Math.sin(a) * p.rx * 0.45 * d;
            if (world.walls.some((w) => !w.low && x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h)) continue; // not on a roof
            L.rip.push({ x, y, t: 0 });
          }
        }
      },
      draw(ctx, L, world) {
        const cam = world.camera;
        ctx.strokeStyle = L.ripple || '#a8c8f0';
        ctx.lineWidth = 1;
        for (const r of L.rip) {
          const k = r.t / 0.7;
          const s = toScreen(cam, r.x, r.y), R = (3 + k * 13) * cam.zoom;
          ctx.globalAlpha = 0.45 * (1 - k);
          Gfx.ellipse(ctx, s.x, s.y, R, R * 0.45);
          ctx.stroke();
        }
        const wind = L.wind || -140;
        ctx.strokeStyle = L.color || '#b4ccf0';
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        for (const p of L.ps) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - wind * p.z * 0.022, p.y - 760 * p.z * 0.022);
        }
        ctx.stroke();
      },
    },

    // Three star layers at depths 0.2 / 0.5 / 0.8 over the baked field.
    stars: {
      n: 150,
      init(L, n) {
        L.layers = [0.2, 0.5, 0.8].map((z, i) => ({ z, s: Gfx.makeStars(77 + i, Math.round(n * (0.45 - i * 0.12)), SW, SH) }));
      },
      step() {},
      draw(ctx, L, world, t) {
        const cam = world.camera;
        ctx.fillStyle = L.color || '#d8f0ff';
        for (const ly of L.layers) {
          const ox = -cam.x * cam.zoom * ly.z, oy = -cam.y * cam.zoom * ly.z;
          for (const s of ly.s) {
            let x = (s.x + ox) % SW, y = (s.y + oy) % SH;
            if (x < 0) x += SW;
            if (y < 0) y += SH;
            ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * 1.7 + s.tw)) * (0.5 + ly.z * 0.6);
            const r = s.r * (0.6 + ly.z);
            ctx.fillRect(x - PAD, y - PAD, r, r);
          }
        }
      },
    },

    // Slow light shafts and motes floating in them (interiors).
    haze: {
      n: 80,
      init(L, n, rnd) {
        L.ps = scatter(n, rnd, 0.3, 1.1);
        L.shafts = (L.shaftsAt || [0.2, 0.45, 0.7, 0.9]).map((f, i) => ({ f, w: 90 + rnd() * 70, ph: rnd() * TAU, z: 0.3 + (i % 2) * 0.25 }));
      },
      step(L, dt, t, dx, dy) {
        drift(L, dt, dx, dy, 10, -6);
        for (const p of L.ps) p.x += Math.sin(t * 0.8 + p.s * 30) * 8 * dt;
        L.cx = (L.cx || 0) - dx * 0.4;
      },
      draw(ctx, L, world, t) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const spr = shaftSprite();
        for (const s of L.shafts) {
          const x = ((s.f * DM.W + (L.cx || 0) * s.z) % (DM.W + 300) + DM.W + 300) % (DM.W + 300) - 150;
          ctx.globalAlpha = (L.alpha || 0.07) * (0.7 + 0.3 * Math.sin(t * 0.5 + s.ph));
          ctx.save();
          ctx.translate(x, -40);
          ctx.rotate(L.tilt == null ? 0.38 : L.tilt);
          ctx.drawImage(spr, -s.w / 2, 0, s.w, DM.H * 1.5);
          ctx.restore();
        }
        ctx.fillStyle = L.color || '#fff2d8';
        for (const p of L.ps) {
          ctx.globalAlpha = 0.12 + 0.3 * p.z * (0.6 + 0.4 * Math.sin(t * 2 + p.s * 40));
          ctx.fillRect(p.x, p.y, 1.6, 1.6);
        }
        ctx.restore();
      },
    },
  };

  function toScreen(cam, x, y) {
    return { x: (x - cam.x + cam.ox) * cam.zoom + DM.W / 2, y: (y - cam.y + cam.oy) * cam.zoom + DM.H / 2 };
  }
  function screenRect(cam, r) {
    const a = toScreen(cam, r.x, r.y);
    return { x: a.x, y: a.y, w: r.w * cam.zoom, h: r.h * cam.zoom };
  }
  const covers = (r) => r.x <= 0 && r.y <= 0 && r.x + r.w >= DM.W && r.y + r.h >= DM.H;
  const misses = (r) => r.x >= DM.W || r.y >= DM.H || r.x + r.w <= 0 || r.y + r.h <= 0;

  const Weather = {
    TYPES,
    stats: { particles: 0, ms: 0 },

    // The layers for this world, rebuilt when the map or the fx setting changes.
    state(world, profile) {
      const fx = fxLevel();
      let st = world.weatherState;
      if (st && st.fx === fx && st.profile === profile) return st;
      st = world.weatherState = { fx, profile, layers: [], camX: null, camY: null, time: world.time || 0 };
      if (fx === 'off' || !profile || !profile.weather) return st;
      const rnd = U.seeded(String(world.mapId || '').length * 131 + 7);
      for (const spec of profile.weather) {
        const T = TYPES[spec.type];
        if (!T) continue;
        const L = Object.assign({ T }, spec);
        const n = Math.round((spec.n || T.n) * (fx === 'reduced' ? 0.5 : 1));
        T.init(L, n, rnd, world);
        st.layers.push(L);
      }
      return st;
    },

    // Advance and draw. ctx is in logical screen space.
    render(ctx, world, profile) {
      const st = Weather.state(world, profile);
      if (!st.layers.length) return false;
      const t0 = performance.now();
      const cam = world.camera;
      const t = world.time || 0;
      const dt = U.clamp(t - st.time, 0, 0.1);
      st.time = t;
      const dx = st.camX == null ? 0 : (cam.x - st.camX) * cam.zoom;
      const dy = st.camY == null ? 0 : (cam.y - st.camY) * cam.zoom;
      st.camX = cam.x;
      st.camY = cam.y;
      let n = 0;
      for (const L of st.layers) {
        L.T.step(L, dt, t, dx, dy, world);
        // Clip to where the layer belongs: outdoors only, or one room only.
        let clip = null, skip = false;
        if (L.only) {
          const r = screenRect(cam, L.only);
          if (misses(r)) skip = true;
          else if (!covers(r)) clip = [r];
        }
        if (L.exclude && !skip) {
          const rs = L.exclude.map((e) => screenRect(cam, e)).filter((r) => !misses(r));
          if (rs.some(covers)) skip = true;
          else if (rs.length) clip = (clip || []).concat(rs.map((r) => Object.assign(r, { out: true })));
        }
        if (skip) continue;
        ctx.save();
        if (clip) {
          ctx.beginPath();
          const inside = clip.filter((r) => !r.out);
          if (inside.length) for (const r of inside) ctx.rect(r.x, r.y, r.w, r.h);
          else ctx.rect(0, 0, DM.W, DM.H);
          for (const r of clip) if (r.out) ctx.rect(r.x, r.y, r.w, r.h);
          ctx.clip('evenodd');
        }
        L.T.draw(ctx, L, world, t);
        ctx.restore();
        n += L.ps ? L.ps.length : 0;
      }
      Weather.stats.particles = n;
      Weather.stats.ms = performance.now() - t0;
      return true;
    },
  };

  DM.Weather = Weather;
})();
