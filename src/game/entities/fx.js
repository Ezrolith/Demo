/*
 * FX: the spare/kill moment, made visible.
 *
 *   FX.unbind(world, e, o)  lethal. e comes apart cell by cell, starting from
 *                           the side facing Jon: hot light and drifting ash,
 *                           with a brief blue ghost of the whole shape.
 *   FX.knockout(world, e)   non-lethal. The gun skids away, a white ring, and
 *                           a small 'spared' tag floats up.
 *
 * unbind() snapshots e.render (or o.draw) into one shared offscreen canvas and
 * samples it into coloured cells. Pass o.key to cache the cells (gangsters key
 * on their look), so repeat kills cost no snapshot at all.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Entity = DM.Entity;
  const TAU = Math.PI * 2;

  // ---- snapshots ------------------------------------------------------------
  let scratch = null;
  let sctx = null;
  const cache = new Map();

  function scratchFor(size) {
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratch.width = scratch.height = 64;
      sctx = scratch.getContext('2d', { willReadFrequently: true });
    }
    if (scratch.width < size) {
      scratch.width = scratch.height = Math.ceil(size / 32) * 32;
      sctx = scratch.getContext('2d', { willReadFrequently: true });
    }
    return sctx;
  }

  // Opaque pixels (alpha > 110 skips drop shadows and soft glows) at one
  // cell per `step` px, as offsets from the centre plus a colour group.
  function sample(data, size, half, step) {
    const xs = [], ys = [], gi = [];
    const groups = new Map();
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const i = (y * size + x) * 4;
        if (data[i + 3] <= 110) continue;
        const q = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
        let g = groups.get(q);
        if (g == null) {
          g = groups.size;
          groups.set(q, g);
        }
        xs.push(x - half + step / 2);
        ys.push(y - half + step / 2);
        gi.push(g);
      }
    }
    return { xs, ys, gi, groups };
  }

  function snapshot(e, world, o) {
    if (o.key && cache.has(o.key)) return cache.get(o.key);
    const half = Math.ceil(U.clamp(e.r * 1.6 + 14, 24, 160));
    const size = half * 2;
    const g = scratchFor(size);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, size, size);
    g.save();
    if (o.draw) {
      g.translate(half, half);
      o.draw(g);
    } else {
      g.translate(half - e.x, half - e.y);
      e.render(g, world);
    }
    g.restore();
    const data = g.getImageData(0, 0, size, size).data;
    const max = o.max || 600;
    let step = o.step || 2;
    let s = sample(data, size, half, step);
    while (s.xs.length > max && step < 10) s = sample(data, size, half, ++step);
    if (!s.xs.length) return null;
    const colors = [], ash = [];
    for (const [q] of s.groups) {
      const hex = '#' + [q >> 8, (q >> 4) & 15, q & 15].map((v) => ((v << 4) | 8).toString(16).padStart(2, '0')).join('');
      colors.push(hex);
      ash.push(U.mix(hex, '#17130f', 0.55));
    }
    // Cells sorted by colour, so each colour is one path (gStart[g]..gStart[g+1]).
    const n = s.xs.length;
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => s.gi[a] - s.gi[b]);
    const snap = { n, step, colors, ash, xs: new Float32Array(n), ys: new Float32Array(n), gi: new Uint16Array(n), gStart: new Uint16Array(colors.length + 1) };
    order.forEach((j, i) => {
      snap.xs[i] = s.xs[j];
      snap.ys[i] = s.ys[j];
      snap.gi[i] = s.gi[j];
    });
    for (let i = n - 1; i >= 0; i--) snap.gStart[snap.gi[i]] = i;
    snap.gStart[colors.length] = n;
    if (o.key) {
      if (cache.size > 96) cache.clear();
      cache.set(o.key, snap);
    }
    return snap;
  }

  // ---- the unbinding (lethal) -----------------------------------------------------
  class Unbinding extends Entity {
    constructor(e, snap, o) {
      super({ x: e.x, y: e.y, r: e.r, static: true, body: false, solid: false, disintegratable: false, layer: e.layer, team: 'neutral' });
      this.snap = snap;
      this.ang = o.angle || 0;
      this.ca = Math.cos(this.ang);
      this.sa = Math.sin(this.ang);
      // Sweep from the side facing the source (Jon) to the far side.
      let dir = o.source && (o.source.x !== e.x || o.source.y !== e.y) ? U.norm(o.source.x - e.x, o.source.y - e.y) : null;
      if (!dir) {
        const a = U.rand(0, TAU);
        dir = { x: Math.cos(a), y: Math.sin(a) };
      }
      this.away = { x: -dir.x, y: -dir.y };
      const n = snap.n;
      const proj = new Float32Array(n);
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) {
        const wx = snap.xs[i] * this.ca - snap.ys[i] * this.sa;
        const wy = snap.xs[i] * this.sa + snap.ys[i] * this.ca;
        const p = wx * dir.x + wy * dir.y;
        proj[i] = p;
        if (p < lo) lo = p;
        if (p > hi) hi = p;
      }
      const span = Math.max(1, hi - lo);
      this.delay = new Float32Array(n);
      for (let i = 0; i < n; i++) this.delay[i] = U.clamp(0.05 + ((hi - proj[i]) / span) * 0.5 + U.rand(-0.035, 0.035), 0.03, 0.6);
      this.gone = new Uint8Array(n);
      this.left = n;
      this.t = 0;
    }
    update(dt, world) {
      this.t += dt;
      const S = this.snap, P = world.particles;
      const st = S.step;
      for (let i = 0; i < S.n; i++) {
        if (this.gone[i] || this.delay[i] > this.t) continue;
        this.gone[i] = 1;
        this.left--;
        const x = this.x + S.xs[i] * this.ca - S.ys[i] * this.sa;
        const y = this.y + S.xs[i] * this.sa + S.ys[i] * this.ca;
        const ax = this.away.x, ay = this.away.y;
        if (Math.random() < 0.4) {
          const v = U.rand(40, 150);
          P.emit(x, y, { vx: ax * v + U.rand(-50, 50), vy: ay * v + U.rand(-50, 50), life: U.rand(0.25, 0.6), size: st * 1.1, size1: 0.3, color: Math.random() < 0.5 ? '#bff1ff' : '#ffffff', drag: 2.5 });
        } else {
          const v = U.rand(8, 40);
          P.emit(x, y, { vx: ax * v + U.rand(-14, 14), vy: ay * v - U.rand(18, 46), life: U.rand(0.7, 1.4), size: st, size1: st * 0.4, color: S.ash[S.gi[i]], add: false, alpha: 0.9, drag: 1.2, g: -22 });
        }
      }
      if (!this.left && this.t > 0.35) this.dead = true;
    }
    render(ctx) {
      const S = this.snap, st = S.step, h = st / 2;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.ang);
      // What is still bound, in its own colours, one path per colour.
      for (let g = 0; g < S.colors.length; g++) {
        ctx.beginPath();
        let any = false;
        for (let i = S.gStart[g]; i < S.gStart[g + 1]; i++) {
          if (this.gone[i]) continue;
          ctx.rect(S.xs[i] - h, S.ys[i] - h, st + 0.4, st + 0.4);
          any = true;
        }
        if (any) {
          ctx.fillStyle = S.colors[g];
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      // The edge about to let go burns white-blue.
      ctx.beginPath();
      for (let i = 0; i < S.n; i++) {
        if (this.gone[i] || this.delay[i] - this.t > 0.07) continue;
        ctx.rect(S.xs[i] - h, S.ys[i] - h, st, st);
      }
      ctx.fillStyle = 'rgba(191,241,255,0.85)';
      ctx.fill();
      // A blue ghost of the whole shape, swelling and fading over 0.3 s.
      if (this.t < 0.3) {
        const k = this.t / 0.3;
        ctx.scale(1 + k * 0.35, 1 + k * 0.35);
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.beginPath();
        for (let i = 0; i < S.n; i++) ctx.rect(S.xs[i] - h, S.ys[i] - h, st, st);
        ctx.fillStyle = '#5fd4ff';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- the knockout (spared) ---------------------------------------------------
  class DroppedGun extends Entity {
    constructor(x, y, o = {}) {
      super({ x, y, vx: o.vx, vy: o.vy, r: 4, mass: 0.4, friction: 6, bounce: 0.3, body: false, solid: true, disintegratable: false, layer: 0, team: 'neutral' });
      this.gun = o.gun || 'pistol';
      this.rot = o.rot || 0;
      this.spin = U.rand(-14, 14);
    }
    update(dt) {
      this.rot += this.spin * dt * Math.min(1, this.speed / 120);
    }
    render(ctx) {
      const L = this.gun === 'tommy' ? 17 : 10;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-L / 2 + 1.5, -1.8 + 2, L, 3.6);
      ctx.fillStyle = '#17171a';
      ctx.fillRect(-L / 2, -1.8, L, 3.6);
      ctx.fillRect(-L / 2 + 1, 0, 3, 5); // grip
      if (this.gun === 'tommy') {
        Gfx.circle(ctx, 1, 0, 3.6);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(190,200,215,0.55)'; // a glint so it reads on dark asphalt
      ctx.fillRect(-L / 2, -1.8, L, 1);
      ctx.restore();
    }
  }

  class FloatText extends Entity {
    constructor(x, y, text, o = {}) {
      super({ x, y, r: 1, static: true, body: false, solid: false, disintegratable: false, layer: 5, team: 'neutral' });
      this.text = text;
      this.dur = this.life = o.dur || 1.2;
      this.color = o.color || '#e6f6ff';
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    render(ctx) {
      const k = 1 - this.life / this.dur;
      const a = Math.min(1, k * 8) * (1 - k * k);
      if (a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha *= a;
      Gfx.text(ctx, this.text, this.x, this.y - k * 16, { size: 13, font: DM.FONTS.type, color: this.color, align: 'center', stroke: 'rgba(8,12,20,0.85)', strokeWidth: 3, spacing: 1 });
      ctx.restore();
    }
  }

  const FX = {
    Unbinding,
    DroppedGun,
    FloatText,
    snapshot,
    // Returns true if the unbinding was spawned (false: draw nothing new).
    unbind(world, e, o = {}) {
      try {
        const snap = snapshot(e, world, o);
        if (!snap) return false;
        world.add(new Unbinding(e, snap, o));
        if (typeof world.stamp === 'function') {
          // Iteration 2: a faint ash silhouette left on the floor.
          const a = o.angle || 0;
          world.stamp((g) => {
            g.save();
            g.translate(e.x, e.y);
            g.rotate(a);
            g.fillStyle = 'rgba(22,19,16,0.3)';
            g.beginPath();
            for (let i = 0; i < snap.n; i += 2) g.rect(snap.xs[i] - snap.step, snap.ys[i] - snap.step, snap.step * 2, snap.step * 2);
            g.fill();
            g.restore();
          });
        }
        return true;
      } catch (err) {
        return false;
      }
    },
    knockout(world, e, o = {}) {
      const P = world.particles;
      P.emit(e.x, e.y, { shape: 'ring', size: 8, size1: 34, life: 0.45, color: '#ffffff', drag: 0, alpha: 0.85 });
      if (o.gun) {
        const sp = Math.hypot(e.vx, e.vy);
        const base = sp > 40 ? Math.atan2(e.vy, e.vx) : (e.facing || 0);
        const a = base + U.rand(-0.9, 0.9);
        const v = U.rand(30, 60) * 6; // slides 30-60 px at friction 6
        const gx = e.x + Math.cos(e.facing || 0) * 12, gy = e.y + Math.sin(e.facing || 0) * 12;
        world.add(new DroppedGun(gx, gy, { gun: o.gun, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: e.facing || 0 }));
      }
      world.add(new FloatText(e.x, e.y - e.r - 14, o.text || 'spared'));
    },
  };

  DM.FX = FX;
})();
