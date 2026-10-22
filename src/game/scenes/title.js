/* Title screen (with a click-to-begin gate that unlocks audio) and chapter select. */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Engine = DM.Engine;
  const Save = DM.Save;
  const Scenes = (DM.Scenes = DM.Scenes || {});

  const STARS = Gfx.makeStars(7, 220, DM.W, DM.H);

  // Shared cosmic backdrop for menus.
  function backdrop(ctx, t, o = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, DM.H);
    g.addColorStop(0, '#02040a');
    g.addColorStop(1, '#0b1a30');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, DM.W, DM.H);
    for (const s of STARS) {
      ctx.globalAlpha = s.a * (0.6 + Math.sin(t * 1.5 + s.tw) * 0.4);
      ctx.fillStyle = '#dfefff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    if (o.mars !== false) {
      const mx = 1060, my = 980, mr = 560;
      const mg = ctx.createRadialGradient(mx - 160, my - 260, 60, mx, my, mr);
      mg.addColorStop(0, '#e0784a');
      mg.addColorStop(0.55, '#a8401f');
      mg.addColorStop(1, '#3a120a');
      ctx.fillStyle = mg;
      Gfx.circle(ctx, mx, my, mr);
      ctx.fill();
      ctx.fillStyle = 'rgba(60,15,8,0.35)';
      for (const [cx, cy, r] of [[860, 560, 26], [1010, 520, 14], [1150, 600, 34], [930, 650, 18], [1240, 520, 20]]) {
        Gfx.ellipse(ctx, cx, cy, r, r * 0.6);
        ctx.fill();
      }
      Gfx.glow(ctx, mx, my - mr + 40, 380, '#ff7a4a', 0.12);
    }
  }
  Scenes.backdrop = backdrop;

  class Title {
    constructor() {
      this.t = 0;
      this.cursor = 'pointer';
      this.gate = !(DM.Audio.ctx && DM.Audio.ctx.state === 'running');
      this.motes = [];
      for (let i = 0; i < 90; i++) this.motes.push({ a: U.rand(0, Math.PI * 2), r: U.rand(150, 520), s: U.rand(0.2, 0.7), z: U.rand(0.4, 1) });
      this.touchOnly = window.matchMedia && !window.matchMedia('(pointer: fine)').matches;
    }
    enter() {
      this.buildMenu();
      if (!this.gate) DM.Audio.music.play('title');
    }
    resume() {
      this.buildMenu();
    }
    buildMenu() {
      const items = [];
      if (Save.hasProgress()) items.push({ label: 'CONTINUE', action: () => this.continueGame() });
      items.push({ label: 'NEW GAME', action: () => Engine.fadeTo(() => Engine.set(new Scenes.Interlude('prologue'))) });
      items.push({ label: 'CHAPTERS', action: () => Engine.push(new ChapterSelect()) });
      items.push({ label: 'SETTINGS', action: () => Engine.push(new Scenes.Settings()) });
      items.push({ label: 'CONTROLS', action: () => Engine.push(new Scenes.Controls()) });
      const keep = this.menu ? this.menu.sel : 0;
      this.menu = new DM.UI.Menu(items, { x: 84, y: 340, w: 360, itemH: 50, size: 25 });
      this.menu.sel = Math.min(keep, items.length - 1);
    }
    continueGame() {
      const cp = Save.data.checkpoint;
      const ch = cp && DM.Chapters.get(cp.chapter);
      if (!ch) return Engine.fadeTo(() => Engine.set(new Scenes.Interlude('prologue')));
      if (!cp.stage) Engine.fadeTo(() => Engine.set(new Scenes.Interlude(ch.id)));
      else Engine.fadeTo(() => Engine.set(new Scenes.Play(), { chapter: ch.id, stage: cp.stage }));
    }
    update(dt) {
      this.t += dt;
      if (this.gate) {
        if (Input.anyPressed()) {
          Input.clearAll();
          Input.endFrame();
          DM.Audio.unlock();
          DM.Audio.music.play('title');
          this.gate = false;
          DM.Audio.play('ui_select');
        }
        return;
      }
      if (Input.pressed('mute')) DM.Audio.toggleMute();
      this.menu.update(dt);
    }
    render(ctx) {
      const t = this.t;
      backdrop(ctx, t);
      const hx = 900, hy = 300;
      for (const m of this.motes) {
        m.a += 0.0025 * m.s * 60 * (1 / 60);
        const r = m.r * (0.85 + Math.sin(t * m.s + m.a) * 0.15);
        const x = hx + Math.cos(m.a + t * 0.05 * m.s) * r, y = hy + Math.sin(m.a + t * 0.05 * m.s) * r * 0.55;
        Gfx.glow(ctx, x, y, 7 * m.z, '#5fd4ff', 0.6 * m.z);
      }
      Gfx.glow(ctx, hx, hy, 300, '#1b7fd0', 0.35);
      Gfx.glow(ctx, hx, hy, 140, '#5fd4ff', 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      Gfx.hydrogen(ctx, hx, hy, 120, 'rgba(170,235,255,0.9)', t * 0.6, 5);
      ctx.restore();
      Gfx.glow(ctx, hx + Math.cos(t * 0.6) * 120, hy + Math.sin(t * 0.6) * 120, 40, '#bff1ff', 0.8);
      Gfx.glow(ctx, hx, hy, 60, '#eefbff', 0.7);

      Gfx.clock(ctx, DM.W - 70, 70, 34, 12, { blood: true });

      Gfx.text(ctx, 'DR. MANHATTAN', 80, 214, { size: 80, color: '#eefbff', weight: 700, spacing: 8, shadow: 'rgba(27,127,208,0.6)', shadowOff: 4 });
      Gfx.text(ctx, "THE WATCHMAKER'S SON", 84, 256, { size: 23, color: DM.C.blue, spacing: 10 });
      Gfx.text(ctx, 'A WATCHMEN FAN GAME', 86, 288, { size: 12, color: 'rgba(200,225,240,0.5)', spacing: 5 });

      if (this.gate) {
        const a = 0.55 + Math.sin(t * 3) * 0.45;
        Gfx.text(ctx, this.touchOnly ? 'TAP TO BEGIN' : 'CLICK OR PRESS ANY KEY', 86, 400, { size: 24, color: `rgba(238,251,255,${a})`, spacing: 6 });
        Gfx.text(ctx, 'Sound on, if you can. The music is part of it.', 86, 432, { size: 15, color: 'rgba(200,225,240,0.5)', font: DM.FONTS.type });
      } else this.menu.render(ctx);

      Gfx.text(ctx, `v${DM.VERSION}  ·  KEYBOARD & MOUSE  ·  PROGRESS SAVES AUTOMATICALLY${DM.DEV ? '  ·  DEV MODE' : ''}`, 86, DM.H - 30, { size: 11, color: 'rgba(200,225,240,0.4)', spacing: 2 });
      if (this.touchOnly) Gfx.text(ctx, 'This game needs a keyboard and mouse. Touch controls are on the roadmap.', 86, DM.H - 52, { size: 13, color: DM.C.yellow });
      Gfx.text(ctx, 'Quis custodiet ipsos custodes?', DM.W - 40, DM.H - 30, { size: 14, color: 'rgba(242,231,204,0.45)', align: 'right', font: DM.FONTS.type });
    }
  }

  class ChapterSelect {
    constructor() {
      this.t = 0;
      this.cursor = 'pointer';
      this.sel = 0;
    }
    enter() {
      const reached = DM.DEV ? 99 : Save.data.reached;
      this.cards = DM.Chapters.list.map((c, i) => ({ c, locked: i > reached }));
      this.sel = Math.min(reached, this.cards.length - 1);
    }
    rect(i) {
      const n = this.cards.length;
      const w = 182, gap = 14;
      const x0 = DM.W / 2 - (n * w + (n - 1) * gap) / 2;
      return { x: x0 + i * (w + gap), y: 190, w, h: 330 };
    }
    pick(i) {
      const card = this.cards[i];
      if (!card || card.locked) {
        DM.Audio.play('fail');
        return;
      }
      DM.Audio.play('ui_select');
      Engine.fadeTo(() => Engine.set(new Scenes.Interlude(card.c.id)));
    }
    update(dt) {
      this.t += dt;
      const m = Input.mouse;
      let hover = -1;
      this.cards.forEach((_, i) => {
        const r = this.rect(i);
        if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) hover = i;
      });
      if (m.moved && hover >= 0 && hover !== this.sel) {
        this.sel = hover;
        DM.Audio.play('ui_move');
      }
      if (Input.clicked()) {
        Input.consume('confirm');
        if (hover >= 0) this.pick(hover);
        else if (m.y > 560) this.back();
        return;
      }
      if (Input.pressed('menuRight') || Input.pressed('menuDown')) {
        this.sel = Math.min(this.cards.length - 1, this.sel + 1);
        DM.Audio.play('ui_move');
      }
      if (Input.pressed('menuLeft') || Input.pressed('menuUp')) {
        this.sel = Math.max(0, this.sel - 1);
        DM.Audio.play('ui_move');
      }
      if (Input.pressed('confirm')) this.pick(this.sel);
      else if (Input.pressed('back')) this.back();
    }
    back() {
      DM.Audio.play('ui_back');
      Engine.pop();
    }
    render(ctx) {
      backdrop(ctx, this.t, { mars: false });
      Gfx.text(ctx, 'CHAPTERS', DM.W / 2, 110, { size: 44, color: '#eefbff', align: 'center', weight: 700, spacing: 10 });
      Gfx.text(ctx, 'The clock moves closer to midnight with every chapter.', DM.W / 2, 146, { size: 16, color: 'rgba(200,225,240,0.6)', align: 'center', font: DM.FONTS.type });
      this.cards.forEach((card, i) => {
        const r = this.rect(i);
        const c = card.c;
        const sel = i === this.sel;
        const lift = sel ? -8 : 0;
        ctx.save();
        ctx.translate(0, lift);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(r.x + 6, r.y + 8, r.w, r.h);
        ctx.fillStyle = card.locked ? '#1a2230' : c.color;
        ctx.fillRect(r.x, r.y, r.w, 170);
        ctx.fillStyle = card.locked ? '#121822' : '#f1e7cc';
        ctx.fillRect(r.x, r.y + 170, r.w, r.h - 170);
        ctx.strokeStyle = sel ? '#eefbff' : DM.C.ink;
        ctx.lineWidth = sel ? 3 : 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        Gfx.clock(ctx, r.x + r.w / 2, r.y + 78, 46, c.clock, { blood: !card.locked, face: card.locked ? '#2a3240' : DM.C.paper });
        Gfx.text(ctx, c.numeral, r.x + r.w / 2, r.y + 156, { size: 14, color: card.locked ? '#55606e' : DM.C.ink, align: 'center', spacing: 3, weight: 600 });
        if (card.locked) {
          Gfx.text(ctx, 'LOCKED', r.x + r.w / 2, r.y + 230, { size: 18, color: '#55606e', align: 'center', spacing: 4 });
        } else {
          ctx.save();
          Gfx.paragraph(ctx, c.title.toUpperCase(), r.x + r.w / 2, r.y + 188, r.w - 24, 24, { size: 20, font: DM.FONTS.display, color: DM.C.ink, align: 'center', weight: 600 });
          ctx.restore();
          Gfx.text(ctx, c.date, r.x + r.w / 2, r.y + 270, { size: 13, color: '#5a4a3a', align: 'center', font: DM.FONTS.type });
          Gfx.text(ctx, c.place, r.x + r.w / 2, r.y + 289, { size: 12, color: '#5a4a3a', align: 'center', font: DM.FONTS.type });
          const done = Save.data.completed[c.id];
          if (done) Gfx.text(ctx, '✓ ' + U.fmtTime(done.time), r.x + r.w / 2, r.y + 316, { size: 13, color: '#2f6b3a', align: 'center', spacing: 2, weight: 600 });
        }
        ctx.restore();
      });
      Gfx.text(ctx, '←  →  CHOOSE     ENTER / CLICK  PLAY     ESC  BACK', DM.W / 2, 600, { size: 13, color: 'rgba(200,225,240,0.5)', align: 'center', spacing: 3 });
    }
  }

  Scenes.Title = Title;
  Scenes.ChapterSelect = ChapterSelect;
})();
