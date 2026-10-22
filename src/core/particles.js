/* Particle system: a flat array, swap-remove on death, two render passes (normal + additive). */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const TAU = Math.PI * 2;

  class Particles {
    constructor(max = 3500) {
      this.list = [];
      this.max = max;
    }

    // o: vx, vy, life, size, size1 (end size), color, alpha, drag, g (gravity),
    //    add (additive, default true), shape: 'dot' | 'glow' | 'spark' | 'ring' | 'shard' | 'smoke'
    emit(x, y, o = {}) {
      if (this.list.length >= this.max) return null;
      const p = {
        x, y,
        vx: o.vx || 0,
        vy: o.vy || 0,
        t: 0,
        life: o.life == null ? 1 : o.life,
        size: o.size == null ? 3 : o.size,
        size1: o.size1 == null ? 0 : o.size1,
        color: o.color || '#ffffff',
        alpha: o.alpha == null ? 1 : o.alpha,
        drag: o.drag == null ? 2 : o.drag,
        g: o.g || 0,
        add: o.add == null ? true : o.add,
        shape: o.shape || 'dot',
        rot: o.rot || Math.random() * TAU,
        vr: o.vr || 0,
      };
      this.list.push(p);
      return p;
    }

    // Radial burst. Ranges are [min, max]. `angle` + `spread` aim it.
    burst(x, y, n, o = {}) {
      const sp = o.speed || [40, 200];
      const lf = o.life || [0.4, 1];
      const sz = o.size || [2, 4];
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + U.rand(-(o.spread || TAU) / 2, (o.spread || TAU) / 2) : U.rand(0, TAU);
        const v = U.rand(sp[0], sp[1]);
        const r = o.radius ? U.rand(0, o.radius) : 0;
        this.emit(x + Math.cos(a) * r, y + Math.sin(a) * r, {
          vx: Math.cos(a) * v + (o.vx || 0),
          vy: Math.sin(a) * v + (o.vy || 0),
          life: U.rand(lf[0], lf[1]),
          size: U.rand(sz[0], sz[1]),
          size1: o.size1,
          color: Array.isArray(o.color) ? U.pick(o.color) : o.color,
          alpha: o.alpha,
          drag: o.drag,
          g: o.g,
          add: o.add,
          shape: o.shape,
          vr: o.vr ? U.rand(-o.vr, o.vr) : 0,
        });
      }
    }

    // Particles that start on a ring and rush inward (charging effects).
    implode(x, y, r, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, TAU);
        const life = o.life || 0.35;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        this.emit(px, py, { vx: (x - px) / life, vy: (y - py) / life, life, size: o.size || 2.5, size1: 0.5, color: o.color || '#bff1ff', drag: 0 });
      }
    }

    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.t += dt;
        if (p.t >= p.life) {
          L[i] = L[L.length - 1];
          L.pop();
          continue;
        }
        if (p.drag) {
          const f = Math.exp(-p.drag * dt);
          p.vx *= f;
          p.vy *= f;
        }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }

    render(ctx, view) {
      this._pass(ctx, view, false);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this._pass(ctx, view, true);
      ctx.restore();
    }

    _pass(ctx, view, additive) {
      const L = this.list;
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        if (p.add !== additive) continue;
        if (view && (p.x < view.x0 - 40 || p.x > view.x1 + 40 || p.y < view.y0 - 40 || p.y > view.y1 + 40)) continue;
        const k = p.t / p.life;
        const size = p.size + (p.size1 - p.size) * k;
        const a = p.alpha * (1 - k * k);
        if (a <= 0.01 || size <= 0.05) continue;
        ctx.globalAlpha = a;
        switch (p.shape) {
          case 'glow': {
            const spr = Gfx.glowSprite(p.color, size * 3);
            ctx.drawImage(spr, p.x - size * 3, p.y - size * 3, size * 6, size * 6);
            break;
          }
          case 'spark':
            ctx.strokeStyle = p.color;
            ctx.lineWidth = size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
            ctx.stroke();
            break;
          case 'ring':
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(1, 3 * (1 - k));
            Gfx.circle(ctx, p.x, p.y, size);
            ctx.stroke();
            break;
          case 'shard':
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(-size * 0.6, size * 0.5);
            ctx.lineTo(-size * 0.4, -size * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            break;
          case 'smoke':
            ctx.fillStyle = p.color;
            Gfx.circle(ctx, p.x, p.y, size);
            ctx.fill();
            break;
          default:
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
    }

    clear() {
      this.list.length = 0;
    }
  }

  DM.Particles = Particles;
})();
