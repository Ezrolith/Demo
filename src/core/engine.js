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
      window.addEventListener('resize', () => {
        this.governor.grace = Math.max(this.governor.grace, 1); // dragging a window edge is not slowness
        this.resize();
      });
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    },

    // `dpr` is the backing-store ratio actually used: the device pixel ratio
    // (capped at 2) times the QUALITY render scale, minus any tiers the frame
    // governor has dropped this session.
    resize() {
      const device = Math.min(window.devicePixelRatio || 1, 2);
      const dpr = device * this.renderScale();
      const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.dpr = dpr;
      this.deviceDpr = device;
      this.scale = Math.min(w / DM.W, h / DM.H);
      this.offX = (w - DM.W * this.scale) / 2;
      this.offY = (h - DM.H * this.scale) / 2;
    },

    // ---- quality & frame stats ----------------------------------------------
    QUALITY: ['high', 'balanced', 'low'],
    RENDER_SCALE: { high: 1, balanced: 0.75, low: 0.5 },
    stats: { updMs: 0, renderMs: 0, gapMs: 1000 / 60 },
    // Drops one QUALITY tier (for this session only; the saved setting is kept)
    // when the frame gap stays above 22 ms for 2 s while the game's own work is
    // a large share of it (a display or browser capped at 30 fps is not slow).
    governor: { enabled: true, limitMs: 22, holdS: 2, slow: 0, grace: 3, drop: 0 },
    notice: null, // { text, shown } for the Play HUD to toast once

    qualityTier() {
      const S = DM.Save && DM.Save.settings;
      const i = Math.max(0, this.QUALITY.indexOf(S && S.quality));
      return this.QUALITY[Math.min(this.QUALITY.length - 1, i + this.governor.drop)];
    },
    renderScale() {
      return this.RENDER_SCALE[this.qualityTier()] || 1;
    },

    // gapMs: the unclamped time since the previous animation frame.
    measure(gapMs) {
      if (!(gapMs > 0) || gapMs > 250 || document.hidden) return; // tab switches, hitches, background tabs
      const st = this.stats, g = this.governor;
      st.gapMs = U.lerp(st.gapMs, gapMs, 0.05);
      if (!g.enabled) return;
      if (g.grace > 0) {
        g.grace -= gapMs / 1000;
        g.slow = 0;
        return;
      }
      const busy = st.updMs + st.renderMs > 0.45 * st.gapMs;
      g.slow = st.gapMs > g.limitMs && busy ? g.slow + gapMs / 1000 : 0;
      if (g.slow < g.holdS || this.qualityTier() === 'low') return;
      g.drop++;
      g.slow = 0;
      g.grace = 3;
      this.resize();
      const tier = this.qualityTier();
      this.notice = { text: `QUALITY LOWERED TO ${tier.toUpperCase()} TO KEEP THE GAME SMOOTH`, shown: false };
      DM.Events.emit('engine:quality', { quality: tier, auto: true });
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
      this.measure(t - this.last);
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
      const t0 = performance.now();
      if (top && top.update) this.guard(() => top.update(dt));
      const t1 = performance.now();
      this.guard(() => this.render());
      const st = this.stats;
      st.updMs = U.lerp(st.updMs, t1 - t0, 0.1);
      st.renderMs = U.lerp(st.renderMs, performance.now() - t1, 0.1);
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

    // The game draws its own cursor inside the 1280x720 view; over the letterbox
    // bars (where nothing is drawn) the system cursor comes back.
    renderCursor(ctx) {
      const I = DM.Input;
      const { x, y } = I.mouse;
      const outside = x < 0 || y < 0 || x > DM.W || y > DM.H;
      const sys = outside && !I.touch ? 'default' : 'none';
      if (this.canvas.style.cursor !== sys) this.canvas.style.cursor = sys;
      if (I.touch || !I.mouse.inside || outside) return;
      const top = this.top();
      const mode = (top && top.cursor) || 'pointer';
      if (mode === 'none') return;
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
        // Power state at the point of aim: cooldown, low energy, grabs, failures.
        if (top.player && DM.Powers && DM.Powers.renderReticle) DM.Powers.renderReticle(ctx, x, y, top.player);
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
