/*
 * HUD: objective, captions, banners, hints, power slots, meters, boss bar,
 * countdowns, objective markers, interaction prompts, flashes and fades.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Schema = DM.SettingsSchema;
  const F = DM.FONTS;

  // Soft dark backing so HUD text stays readable on bright maps (snow, desert).
  function backing(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(4,8,16,0.5)';
    Gfx.rr(ctx, x, y, w, h, 4);
    ctx.fill();
  }

  class HUD {
    constructor(scene) {
      this.scene = scene;
      this.objective = null;
      this.captions = [];
      this.banners = [];
      this.toasts = [];
      this.hintMsg = null;
      this.lastHint = null; // { text, essential, chapter, stage }: what H and the Pause screen recall
      this.flashA = 0;
      this.flashPeak = 1;
      this.flashColor = '#fff';
      this.flashDur = 0.6;
      this.cinematic = false;
      this.cineK = 0;
      this.countdownState = null;
      this.marker = null;
      this.t = 0;
    }

    // ---- API used by chapter scripts ----------------------------------------
    setObjective(text, progress) {
      if (!text) {
        this.objective = null;
        return;
      }
      this.objective = { text, progress: progress || null, t: 0, idleT: 0, nudged: false, done: false };
      DM.Audio.play('objective');
    }
    completeObjective() {
      if (this.objective && !this.objective.done) {
        const o = this.objective;
        if (o.progress) {
          const v = o.progress();
          o.progress = () => v;
        }
        this.objective.done = true;
        this.objective.doneT = 0;
        DM.Audio.play('success');
      }
    }
    // Narration. TEXT SPEED sets the typewriter rate; SLOW also leaves it up longer.
    caption(text, o = {}) {
      const dur = (o.dur || 2.6 + text.length * 0.05) * Schema.readTime();
      const c = { text, t: 0, dur, chars: 0, style: o.style || 'jon', gone: false, skippable: false };
      this.captions.push(c);
      return c;
    }
    banner(title, sub, o = {}) {
      const b = { title, sub, t: 0, dur: o.dur || 3.2, color: o.color || DM.C.blue, gone: false };
      this.banners.push(b);
      return b;
    }
    // Tips respect the HINTS setting; essential ones (ctx.tutorial) always show.
    // Either way the latest is kept, so H and the Pause screen can bring it back.
    // hint(null) clears both.
    hint(text, dur = 7, o = {}) {
      if (!text) {
        this.hintMsg = null;
        this.lastHint = null;
        return;
      }
      const sc = this.scene;
      this.lastHint = { text, essential: !!o.essential, chapter: sc && sc.chapter ? sc.chapter.id : null, stage: sc && sc.ctx ? sc.ctx.stageIndex : 0 };
      if (!o.essential && !Schema.hintsAll()) return;
      this.hintMsg = { text, t: 0, dur };
    }
    recallHint(dur = 6) {
      if (!this.lastHint) return false;
      this.hintMsg = { text: this.lastHint.text, t: 0, dur };
      return true;
    }
    toast(text, color) {
      this.toasts.push({ text, color: color || DM.C.yellow, t: 0 });
    }
    // Full-screen flash. With FLASHING LIGHTS on REDUCED it peaks at a quarter
    // strength and fades 1.5x slower, and strobes ({ strobe: true }) are dropped.
    flash(color, dur, o = {}) {
      const reduced = Schema.reducedFlashing();
      if (reduced && o.strobe) return;
      this.flashColor = color;
      this.flashDur = dur * (reduced ? 1.5 : 1);
      this.flashPeak = Schema.flashCap();
      this.flashA = 1;
    }
    get flashAlpha() {
      return this.flashA * this.flashPeak;
    }
    startCountdown(seconds, label) {
      this.countdownState = { left: seconds, total: seconds, label: label || '' };
      return this.countdownState;
    }
    clearTransient() {
      this.captions = [];
      this.banners = [];
      this.hintMsg = null;
      this.countdownState = null;
      this.cinematic = false;
    }

    // Objective, hints and power slots are hidden during dialogue and letterboxed cutscenes.
    gameHudVisible() {
      const d = this.scene.dialog;
      return this.cineK < 0.5 && !(d && d.active);
    }
    // Narration can be hurried along only while the player is held for a cutscene.
    captionSkippable() {
      const sc = this.scene;
      return !!(sc.ctx && sc.ctx.locked && !(sc.dialog && sc.dialog.active));
    }

    update(dt) {
      this.t += dt;
      const shown = this.gameHudVisible();
      const p = this.scene.player;
      const o = this.objective;
      if (o) {
        o.t += dt;
        if (o.done) {
          o.doneT += dt;
          if (o.doneT > 2.2) this.objective = null;
        } else if (shown && p && !p.locked) o.idleT += dt;
      }
      this.updateCaption(dt);
      if (this.banners.length) {
        const b = this.banners[0];
        b.t += dt;
        if (b.t >= b.dur) {
          b.gone = true;
          this.banners.shift();
        }
      }
      // A hint's clock only runs while it can be seen, so dialogue never eats it.
      if (this.hintMsg && shown) {
        this.hintMsg.t += dt;
        if (this.hintMsg.t > this.hintMsg.dur) this.hintMsg = null;
      }
      if (shown && Input.pressed('hint')) {
        Input.consume('hint');
        if (!this.recallHint()) this.toast('NO FIELD NOTES YET', '#bff1ff');
      }
      // Stuck: the same objective for 45 s of free play brings the last tip back, once.
      if (o && !o.done && !o.nudged && o.idleT >= 45 && !this.hintMsg) {
        const h = this.lastHint;
        const ch = this.scene.chapter;
        if (h && ch && h.chapter === ch.id && (h.essential || Schema.hintsAll())) {
          o.nudged = true;
          this.recallHint(8);
        }
      }
      for (const t of this.toasts) t.t += dt;
      this.toasts = this.toasts.filter((t) => t.t < 2.6);
      this.flashA = Math.max(0, this.flashA - dt / this.flashDur);
      this.cineK = U.damp(this.cineK, this.cinematic ? 1 : 0, 6, dt);
      if (this.countdownState && this.countdownState.left > 0) {
        const before = Math.ceil(this.countdownState.left);
        this.countdownState.left -= dt;
        const after = Math.ceil(this.countdownState.left);
        if (after !== before && after >= 0) DM.Audio.play('tick', { alt: after % 2 });
      }
    }

    updateCaption(dt) {
      const c = this.captions[0];
      if (!c) return;
      c.t += dt;
      c.chars += dt * Schema.textCPS();
      if (c.t > c.dur - 1) c.chars = Infinity; // always fully legible before it fades
      // In a cutscene the first press finishes the line and the second moves on.
      c.skippable = this.captionSkippable();
      if (c.skippable && c.t > 0.15 && Input.pressed('confirm')) {
        for (const a of ['confirm', 'interact', 'teleport', 'telekinesis']) Input.consume(a);
        if (c.chars < c.text.length) c.chars = Infinity;
        else c.t = Math.max(c.t, c.dur - 0.3);
      }
      if (c.t >= c.dur) {
        c.gone = true;
        this.captions.shift();
      }
    }

    // ---- rendering -------------------------------------------------------------
    render(ctx) {
      const scene = this.scene;
      const p = scene.player;
      const world = scene.world;
      const showGameHud = this.cineK < 0.5 && !(scene.dialog && scene.dialog.active);

      if (p && world) this.renderPrompt(ctx, p, world);
      if (this.marker && world) this.renderMarker(ctx, world);

      if (this.cineK > 0.01) {
        const bh = 70 * this.cineK;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, DM.W, bh);
        ctx.fillRect(0, DM.H - bh, DM.W, bh);
      }

      if (showGameHud) {
        this.renderTopLeft(ctx);
        if (p) {
          this.renderTopRight(ctx, p);
          this.renderPowers(ctx, p);
        }
        if (world && world.boss && !world.boss.dead) this.renderBoss(ctx, world.boss);
      }
      this.renderCountdown(ctx);
      this.renderCaption(ctx);
      this.renderBanner(ctx);
      this.renderHint(ctx, showGameHud);
      this.renderToasts(ctx);

      if (this.flashAlpha > 0) {
        ctx.globalAlpha = this.flashAlpha;
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, DM.W, DM.H);
        ctx.globalAlpha = 1;
      }
    }

    renderTopLeft(ctx) {
      const ch = this.scene.chapter;
      if (!ch) return;
      const label = `${ch.numeral}  ·  ${ch.date.toUpperCase()}  ·  ${ch.place.toUpperCase()}`;
      backing(ctx, 18, 18, Gfx.measure(ctx, label, { size: 13, spacing: 2 }) + 20, 26);
      Gfx.text(ctx, label, 28, 36, { size: 13, color: 'rgba(200,225,240,0.75)', spacing: 2, shadow: 'rgba(0,0,0,0.6)' });
      const o = this.objective;
      if (!o) return;
      const a = o.done ? Math.max(0, 1 - Math.max(0, o.doneT - 1.4) / 0.8) : Math.min(1, o.t * 4);
      ctx.save();
      ctx.globalAlpha = a;
      const prog = o.progress ? o.progress() : null;
      const text = o.text + (prog != null && prog !== '' ? `  ${prog}` : '');
      const w = Math.max(260, Gfx.measure(ctx, text, { size: 19, weight: 400 }) + 60);
      Gfx.panel(ctx, 20, 48, w, 52, { accent: o.done ? 'rgba(123,216,143,0.8)' : 'rgba(242,196,24,0.7)' });
      Gfx.text(ctx, o.done ? 'OBJECTIVE COMPLETE' : 'OBJECTIVE', 36, 66, { size: 11, color: o.done ? DM.C.green : DM.C.yellow, spacing: 3, weight: 600 });
      Gfx.text(ctx, text, 36, 89, { size: 19, color: o.done ? 'rgba(200,225,240,0.6)' : '#ffffff' });
      if (o.done) {
        ctx.strokeStyle = 'rgba(123,216,143,0.8)';
        ctx.lineWidth = 2;
        const tw = Gfx.measure(ctx, text, { size: 19 });
        Gfx.line(ctx, 36, 83, 36 + tw * Math.min(1, o.doneT * 3), 83);
      }
      ctx.restore();
    }

    renderTopRight(ctx, p) {
      const ch = this.scene.chapter;
      const x = DM.W - 28;
      if (p.form !== 'human') backing(ctx, x - 48 - 220 - 12, 16, 220 + 24, 42);
      if (ch) Gfx.clock(ctx, x - 18, 40, 18, ch.clock, { blood: true });
      if (p.form === 'manhattan') {
        const w = 220;
        const bx = x - 48 - w;
        Gfx.text(ctx, 'COHERENCE', bx, 33, { size: 11, color: 'rgba(200,225,240,0.75)', spacing: 3 });
        const frac = p.coherence / p.maxCoherence;
        const col = frac < 0.35 ? (Math.sin(this.t * 10) > 0 ? '#ff5a4a' : '#ff9a8a') : '#bff1ff';
        Gfx.bar(ctx, bx, 40, w, 9, frac, col, { segments: 10 });
      } else if (p.form === 'awareness') {
        const w = 220;
        const bx = x - 48 - w;
        Gfx.text(ctx, 'GATHERED ATOMS', bx, 33, { size: 11, color: 'rgba(200,225,240,0.75)', spacing: 3 });
        Gfx.text(ctx, `${p.carry} / ${p.carryMax}`, bx + w, 33, { size: 12, color: p.carry >= p.carryMax ? DM.C.yellow : '#bff1ff', align: 'right', spacing: 1 });
        Gfx.bar(ctx, bx, 40, w, 9, p.carry / p.carryMax, p.carry >= p.carryMax ? DM.C.yellow : '#7fe3ff', { segments: 5 });
      }
    }

    renderPowers(ctx, p) {
      const defs = DM.Powers.list.filter((d) => p.powers[d.id] && d.forms.includes(p.form));
      if (!defs.length) return;
      const size = 58, gap = 10;
      const total = defs.length * size + (defs.length - 1) * gap;
      const x0 = DM.W / 2 - total / 2;
      const y0 = DM.H - size - 26;
      const bw = Math.max(total, 300);
      const eLow = p.noEnergyT > 0;
      backing(ctx, DM.W / 2 - bw / 2 - 12, y0 - 34, bw + 24, size + 46);
      Gfx.text(ctx, 'INTRINSIC FIELD', DM.W / 2 - bw / 2, y0 - 16, { size: 10, color: eLow ? '#ff5a4a' : 'rgba(200,225,240,0.65)', spacing: 3 });
      Gfx.bar(ctx, DM.W / 2 - bw / 2, y0 - 11, bw, 5, p.energy / p.maxEnergy, eLow ? '#ff5a4a' : '#5fd4ff');
      defs.forEach((d, i) => {
        const st = p.powers[d.id];
        const x = x0 + i * (size + gap);
        const ready = st.cd <= 0 && p.energy >= d.cost && !(d.id === 'timesight' && p.jammed);
        const active = st.active || (d.id === 'telekinesis' && st.target) || (d.id === 'expand' && p.expandT > 0);
        ctx.fillStyle = active ? 'rgba(95,212,255,0.25)' : 'rgba(6,12,22,0.8)';
        ctx.fillRect(x, y0, size, size);
        ctx.strokeStyle = active ? d.color : ready ? 'rgba(160,210,240,0.35)' : 'rgba(160,210,240,0.12)';
        ctx.lineWidth = active ? 2 : 1;
        ctx.strokeRect(x + 0.5, y0 + 0.5, size - 1, size - 1);
        Gfx.icon(ctx, d.id, x + size / 2, y0 + size / 2 - 5, 30, ready || active ? d.color : 'rgba(150,170,190,0.4)', this.t);
        if (st.cd > 0 && d.cooldown > 0) {
          const k = st.cd / d.cooldown;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(x, y0 + size * (1 - k), size, size * k);
        }
        if (active) Gfx.glow(ctx, x + size / 2, y0 + size / 2, size * 0.9, d.color, 0.25);
        Gfx.text(ctx, Input.short[d.action] || '', x + size / 2, y0 + size - 6, { size: 11, color: 'rgba(230,245,255,0.85)', align: 'center', spacing: 1, weight: 600 });
      });
      if (p.jammed) Gfx.text(ctx, 'TACHYON INTERFERENCE', DM.W / 2 + bw / 2, y0 - 16, { size: 11, color: '#d9a6ff', align: 'right', spacing: 3 });
    }

    renderBoss(ctx, boss) {
      const w = 460;
      const x = DM.W / 2 - w / 2, y = 30;
      backing(ctx, x - 12, 8, w + 24, 38);
      Gfx.text(ctx, boss.name || 'TARGET', DM.W / 2, y - 6, { size: 13, color: '#ffd9a0', align: 'center', spacing: 4, weight: 600 });
      Gfx.bar(ctx, x, y, w, 8, Math.max(0, boss.hp) / boss.maxHp, '#ff9a3c', { segments: 20 });
    }

    renderCountdown(ctx) {
      const c = this.countdownState;
      if (!c || c.left <= -1) return;
      const s = Math.max(0, c.left);
      const str = `00:${String(Math.ceil(s)).padStart(2, '0')}`;
      const pulse = 1 + (1 - (s % 1)) * 0.06;
      ctx.save();
      ctx.translate(DM.W / 2, 92);
      ctx.scale(pulse, pulse);
      Gfx.text(ctx, str, 0, 0, { size: 56, color: s < 4 ? '#ff5a4a' : '#ffffff', align: 'center', weight: 700, spacing: 4, shadow: 'rgba(0,0,0,0.6)', font: F.display });
      ctx.restore();
      if (c.label) Gfx.text(ctx, c.label, DM.W / 2, 118, { size: 13, color: 'rgba(255,200,190,0.85)', align: 'center', spacing: 4 });
    }

    renderCaption(ctx) {
      const c = this.captions[0];
      if (!c) return;
      const a = Math.min(1, c.t * 3, (c.dur - c.t) * 2.5);
      if (a <= 0) return;
      const y = this.cineK > 0.5 ? 92 : 122;
      const style = c.style === 'paper' ? {} : { bg: '#dff2ff', border: '#0d2a44', color: '#0d2a44' };
      const h = Gfx.caption(ctx, c.text, DM.W / 2, y, 620, Object.assign({ alpha: a, chars: c.chars, size: 18 }, style));
      // ▸ in the corner: this caption can be hurried along.
      if (c.skippable && c.t > 0.8 && Math.sin(this.t * 5) > -0.3) {
        ctx.font = Gfx.font(18, F.type);
        let w = 0;
        for (const l of Gfx.wrap(ctx, c.text, 620 - 28)) w = Math.max(w, ctx.measureText(l).width);
        Gfx.text(ctx, '▸', DM.W / 2 + (w + 28) / 2 - 11, y + h - 5, { size: 15, color: style.border || DM.C.ink, alpha: a, align: 'center' });
      }
    }

    renderBanner(ctx) {
      const b = this.banners[0];
      if (!b) return;
      const a = Math.min(1, b.t * 2, (b.dur - b.t) * 2);
      ctx.save();
      ctx.globalAlpha = a;
      const y = DM.H / 2 - 30;
      const w = 520 + Math.min(1, b.t * 2) * 200;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(DM.W / 2 - w / 2, y - 62, w, b.sub ? 104 : 80);
      ctx.fillStyle = b.color;
      ctx.fillRect(DM.W / 2 - w / 2, y - 62, w, 2);
      ctx.fillRect(DM.W / 2 - w / 2, y + (b.sub ? 40 : 16), w, 2);
      Gfx.text(ctx, b.title, DM.W / 2, y, { size: 50, color: '#ffffff', align: 'center', weight: 700, spacing: 8 });
      if (b.sub) Gfx.text(ctx, b.sub, DM.W / 2, y + 28, { size: 16, color: b.color, align: 'center', spacing: 5 });
      ctx.restore();
    }

    renderHint(ctx, show) {
      const h = this.hintMsg;
      if (!h || !show) return;
      const a = Math.min(1, h.t * 3, (h.dur - h.t) * 2);
      const y = DM.H - 146;
      const w = Gfx.measure(ctx, h.text, { size: 17 }) + 40;
      ctx.save();
      ctx.globalAlpha = a;
      Gfx.panel(ctx, DM.W / 2 - w / 2, y - 22, w, 34, { accent: 'rgba(242,196,24,0.6)' });
      Gfx.text(ctx, h.text, DM.W / 2, y + 1, { size: 17, color: '#fff6d0', align: 'center' });
      ctx.restore();
    }

    renderToasts(ctx) {
      this.toasts.forEach((t, i) => {
        const a = Math.min(1, t.t * 4, (2.6 - t.t) * 2);
        Gfx.text(ctx, t.text, DM.W - 28, 96 + i * 26 - Math.min(10, t.t * 20), { size: 16, color: t.color, align: 'right', spacing: 2, alpha: a, shadow: 'rgba(0,0,0,0.6)' });
      });
    }

    renderPrompt(ctx, p, world) {
      const e = p.interactTarget;
      if (!e || (this.scene.dialog && this.scene.dialog.active)) return;
      const s = world.camera.toScreen(e.x, e.y - e.r - 30);
      const text = e.interact.label;
      const w = Gfx.measure(ctx, text, { size: 15 }) + 44;
      const y = s.y + Math.sin(this.t * 4) * 2;
      Gfx.panel(ctx, s.x - w / 2, y - 16, w, 28, { accent: 'rgba(242,196,24,0.8)' });
      ctx.fillStyle = DM.C.yellow;
      ctx.fillRect(s.x - w / 2 + 6, y - 11, 18, 18);
      Gfx.text(ctx, 'E', s.x - w / 2 + 15, y + 3, { size: 13, color: DM.C.ink, align: 'center', weight: 700 });
      Gfx.text(ctx, text, s.x - w / 2 + 32, y + 4, { size: 15, color: '#ffffff' });
    }

    renderMarker(ctx, world) {
      const m = this.marker;
      const s = world.camera.toScreen(m.x, m.y);
      const pad = 40;
      const on = s.x > pad && s.x < DM.W - pad && s.y > pad && s.y < DM.H - pad;
      if (on) {
        const y = s.y - 36 + Math.sin(this.t * 4) * 5;
        ctx.fillStyle = DM.C.yellow;
        ctx.beginPath();
        ctx.moveTo(s.x, y + 10);
        ctx.lineTo(s.x - 8, y);
        ctx.lineTo(s.x + 8, y);
        ctx.closePath();
        ctx.fill();
        if (m.label) Gfx.text(ctx, m.label, s.x, y - 8, { size: 12, color: DM.C.yellow, align: 'center', spacing: 2, shadow: 'rgba(0,0,0,0.7)' });
        return;
      }
      const cx = DM.W / 2, cy = DM.H / 2;
      const a = Math.atan2(s.y - cy, s.x - cx);
      const ex = U.clamp(cx + Math.cos(a) * 2000, pad, DM.W - pad), ey = U.clamp(cy + Math.sin(a) * 2000, pad + 50, DM.H - pad - 90);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = DM.C.yellow;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-6, -9);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  DM.HUD = HUD;
})();
