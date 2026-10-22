/*
 * Camera: smooth follow, trauma-based screen shake, directional kicks, zoom,
 * world bounds.
 *
 * Shake: shake(amount) adds trauma (0..1, decays 1.5/s); the offset is
 * trauma² × 30 px (capped at 22) along smooth noise, so it rumbles instead of
 * jittering. kick(dx, dy, px) shoves the view along a direction and springs
 * back. Both scale with Settings > shake (0 turns them off).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;

  class Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.zoom = 1;
      this.targetZoom = 1;
      this.trauma = 0;
      this.ox = 0; // total offset this frame (shake + kick), in world px
      this.oy = 0;
      this.kx = 0; // directional kick, decaying
      this.ky = 0;
      this.t = 0;
      this.seed = Math.random() * 100;
      this.bounds = null; // {w, h}
    }
    snap(x, y) {
      this.x = x;
      this.y = y;
      this.clamp();
    }
    follow(tx, ty, dt, speed = 6) {
      this.x = U.damp(this.x, tx, speed, dt);
      this.y = U.damp(this.y, ty, speed, dt);
      this.clamp();
    }
    shake(amount) {
      if (amount > 0) this.trauma = Math.min(1, this.trauma + amount);
    }
    // Shove the view px pixels along (dx, dy); it springs back in ~0.15 s.
    kick(dx, dy, px) {
      const l = Math.hypot(dx, dy);
      if (!(l > 0) || !(px > 0)) return;
      this.kx += (dx / l) * px;
      this.ky += (dy / l) * px;
      const m = Math.hypot(this.kx, this.ky);
      if (m > 16) {
        this.kx *= 16 / m;
        this.ky *= 16 / m;
      }
    }
    update(dt) {
      this.t += dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
      const k = Math.exp(-18 * dt);
      this.kx *= k;
      this.ky *= k;
      const set = DM.Save.settings.shake == null ? 1 : DM.Save.settings.shake;
      const s = Math.min(22, this.trauma * this.trauma * 30) * set;
      const t = this.t, q = this.seed;
      this.ox = s * Math.sin(t * 47 + q) * Math.sin(t * 31 + q * 1.7) + this.kx * set;
      this.oy = s * Math.sin(t * 41 + q * 2.3) * Math.sin(t * 29 + q * 0.6) + this.ky * set;
      this.zoom = U.damp(this.zoom, this.targetZoom, 3, dt);
      this.clamp();
    }
    clamp() {
      if (!this.bounds) return;
      const hw = DM.W / 2 / this.zoom, hh = DM.H / 2 / this.zoom;
      const b = this.bounds;
      this.x = b.w <= hw * 2 ? b.w / 2 : U.clamp(this.x, hw, b.w - hw);
      this.y = b.h <= hh * 2 ? b.h / 2 : U.clamp(this.y, hh, b.h - hh);
    }
    apply(ctx) {
      ctx.translate(DM.W / 2, DM.H / 2);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x + this.ox, -this.y + this.oy);
    }
    toWorld(sx, sy) {
      return { x: (sx - DM.W / 2) / this.zoom + this.x, y: (sy - DM.H / 2) / this.zoom + this.y };
    }
    toScreen(wx, wy) {
      return { x: (wx - this.x) * this.zoom + DM.W / 2, y: (wy - this.y) * this.zoom + DM.H / 2 };
    }
    view() {
      const hw = DM.W / 2 / this.zoom, hh = DM.H / 2 / this.zoom;
      return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh };
    }
  }

  DM.Camera = Camera;
})();
