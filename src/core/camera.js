/* Camera: smooth follow, trauma-based screen shake, zoom, world bounds. */
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
      this.ox = 0;
      this.oy = 0;
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
      const s = DM.Save.settings.shake == null ? 1 : DM.Save.settings.shake;
      this.trauma = Math.min(1, this.trauma + amount * s);
    }
    update(dt) {
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
      const s = this.trauma * this.trauma * 16;
      this.ox = (Math.random() * 2 - 1) * s;
      this.oy = (Math.random() * 2 - 1) * s;
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
