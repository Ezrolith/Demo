/*
 * Engine: canvas, letterboxing, the main loop and a scene stack.
 *
 * Scenes are plain objects/classes with optional hooks:
 *   enter(params), exit(), resume(), update(dt), render(ctx)
 * and flags:
 *   opaque (default true)  — if false, the scene below is rendered first (overlays)
 *   cursor ('pointer' | 'reticle' | 'none')
 * Only the top scene updates, so pushing an overlay pauses whatever is under it.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;

  const Engine = {
    stack: [],
    time: 0,
    fps: 60,
    scale: 1,
    offX: 0,
    offY: 0,
    dpr: 1,
    fade: { a: 0, dir: 0, speed: 2, color: '#000', cb: null, inSpeed: 2 },
    error: null,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.dpr = dpr;
      this.scale = Math.min(w / DM.W, h / DM.H);
      this.offX = (w - DM.W * this.scale) / 2;
      this.offY = (h - DM.H * this.scale) / 2;
    },

    toLogical(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (cx - r.left - this.offX) / this.scale, y: (cy - r.top - this.offY) / this.scale };
    },

    // ---- scenes -----------------------------------------------------------
    set(scene, params) {
      while (this.stack.length) {
        const s = this.stack.pop();
        s.exit && s.exit();
      }
      this.push(scene, params);
    },
    push(scene, params) {
      this.stack.push(scene);
      scene.enter && scene.enter(params || {});
    },
    pop() {
      const s = this.stack.pop();
      if (s && s.exit) s.exit();
      const top = this.top();
      if (top && top.resume) top.resume();
      return s;
    },
    remove(scene) {
      const i = this.stack.indexOf(scene);
      if (i < 0) return;
      if (i === this.stack.length - 1) this.pop();
      else {
        this.stack.splice(i, 1);
        scene.exit && scene.exit();
      }
    },
    top() {
      return this.stack[this.stack.length - 1];
    },

    // Fade to a colour, run cb (usually a scene change), fade back in.
    fadeTo(cb, o = {}) {
      const f = this.fade;
      f.color = o.color || '#000';
      f.speed = 1 / (o.out || 0.45);
      f.inSpeed = 1 / (o.in || 0.45);
      f.dir = 1;
      f.cb = cb;
    },
    get fading() {
      return this.fade.dir === 1;
    },

    // ---- loop -------------------------------------------------------------
    frame(t) {
      requestAnimationFrame((tt) => this.frame(tt));
      let dt = (t - this.last) / 1000;
      this.last = t;
      if (!(dt > 0)) dt = 1 / 60;
      if (dt > 0.05) dt = 0.05; // clamp after tab switches / hitches
      this.time += dt;
      this.fps = U.lerp(this.fps, 1 / dt, 0.05);

      if (this.error) {
        this.renderError();
        if (DM.Input.pressed('confirm')) location.reload();
        DM.Input.endFrame();
        return;
      }

      const f = this.fade;
      if (f.dir === 1) {
        DM.Input.clearAll();
        f.a = Math.min(1, f.a + dt * f.speed);
        if (f.a >= 1) {
          f.dir = -1;
          const cb = f.cb;
          f.cb = null;
          if (cb) this.guard(cb);
        }
      } else if (f.dir === -1) {
        f.a = Math.max(0, f.a - dt * f.inSpeed);
        if (f.a <= 0) f.dir = 0;
      }

      const top = this.top();
      if (top && top.update) this.guard(() => top.update(dt));
      this.guard(() => this.render());
      DM.Input.endFrame();
    },

    guard(fn) {
      try {
        fn();
      } catch (e) {
        console.error(e);
        this.error = e;
      }
    },

    render() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#020306';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const k = this.dpr * this.scale;
      ctx.setTransform(k, 0, 0, k, this.dpr * this.offX, this.dpr * this.offY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, DM.W, DM.H);
      ctx.clip();

      let i = this.stack.length - 1;
      while (i > 0 && this.stack[i].opaque === false) i--;
      for (; i < this.stack.length; i++) {
        ctx.save();
        this.stack[i].render(ctx);
        ctx.restore();
      }
      if (this.fade.a > 0) {
        ctx.globalAlpha = this.fade.a;
        ctx.fillStyle = this.fade.color;
        ctx.fillRect(0, 0, DM.W, DM.H);
        ctx.globalAlpha = 1;
      }
      this.renderCursor(ctx);
      ctx.restore();
    },

    renderCursor(ctx) {
      const I = DM.Input;
      if (I.touch || !I.mouse.inside) return;
      const top = this.top();
      const mode = (top && top.cursor) || 'pointer';
      if (mode === 'none') return;
      const { x, y } = I.mouse;
      ctx.save();
      if (mode === 'reticle') {
        ctx.strokeStyle = 'rgba(200,245,255,0.9)';
        ctx.lineWidth = 1.5;
        DM.Gfx.circle(ctx, x, y, 9);
        ctx.stroke();
        for (let a = 0; a < 4; a++) {
          const ang = (a * Math.PI) / 2;
          DM.Gfx.line(ctx, x + Math.cos(ang) * 12, y + Math.sin(ang) * 12, x + Math.cos(ang) * 17, y + Math.sin(ang) * 17);
        }
        ctx.fillStyle = '#ffffff';
        DM.Gfx.circle(ctx, x, y, 1.6);
        ctx.fill();
      } else {
        ctx.fillStyle = '#eefbff';
        ctx.strokeStyle = '#0b1420';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 13, y + 5);
        ctx.lineTo(x + 6, y + 7);
        ctx.lineTo(x + 4, y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    },

    renderError() {
      const ctx = this.ctx;
      const k = this.dpr * this.scale;
      ctx.setTransform(k, 0, 0, k, this.dpr * this.offX, this.dpr * this.offY);
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, DM.W, DM.H);
      const G = DM.Gfx;
      G.text(ctx, 'THE INTRINSIC FIELD COLLAPSED', DM.W / 2, 260, { size: 34, align: 'center', color: DM.C.blue, spacing: 3, weight: 600 });
      G.text(ctx, 'Something went wrong. Click or press Enter to reload.', DM.W / 2, 310, { size: 18, align: 'center', color: '#cfe0ee' });
      const msg = String((this.error && (this.error.stack || this.error.message)) || this.error).split('\n').slice(0, 6);
      msg.forEach((l, i) => G.text(ctx, l.slice(0, 140), DM.W / 2, 370 + i * 20, { size: 13, align: 'center', color: '#7f93a6', font: DM.FONTS.type }));
    },
  };

  DM.Engine = Engine;
})();
