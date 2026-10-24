/*
 * Title screen (with a click-to-begin gate that unlocks audio), the New Game
 * confirmation and chapter select. Continue names where it leads; Chapter
 * Select can resume a chapter from its last checkpoint.
 */
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

  // 'waves2' -> 'Waves 2'. Stages may set a `label` to name themselves.
  function stageName(ch, stage) {
    const st = ch && ch.stages[stage];
    if (!st) return '';
    if (st.label) return st.label;
    const s = String(st.id).replace(/[_-]+/g, ' ').replace(/(\D)(\d)/g, '$1 $2');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // Where a saved point leads, for menus: 'Karnak · Veidt'.
  function whereText(cp) {
    const ch = cp && DM.Chapters.get(cp.chapter);
    if (!ch) return '';
    return `${ch.title}  ·  ${cp.stage ? stageName(ch, cp.stage) : 'from the beginning'}`;
  }
  const inRect = (m, r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;

  // The title menu: an item may carry a `sub` line, drawn small beneath its label.
  const SUB_H = 22;
  class TitleMenu extends DM.UI.Menu {
    rowRect(i) {
      const r = super.rowRect(i);
      for (let k = 0; k < i; k++) if (this.items[k].sub) r.y += SUB_H;
      return r;
    }
    render(ctx) {
      super.render(ctx);
      this.items.forEach((it, i) => {
        if (!it.sub) return;
        const r = this.rowRect(i);
        const sel = i === this.sel;
        Gfx.text(ctx, it.sub, r.x + 34, r.y + r.h + 10, { size: 14, color: sel ? 'rgba(191,241,255,0.85)' : 'rgba(200,225,240,0.5)', font: DM.FONTS.type });
      });
    }
  }

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
      const target = Save.continueTarget();
      const chapters = { label: 'CHAPTERS', action: () => Engine.push(new ChapterSelect()) };
      if (target) {
        const ch = DM.Chapters.get(target.chapter);
        items.push({ label: `CONTINUE  ·  ${ch.numeral}`, sub: whereText(target), action: () => this.continueGame() });
      } else if (Save.finished) {
        // The story is over: there is nothing to continue, so lead with replaying it.
        chapters.sub = 'The story is complete. Replay any chapter.';
        items.push(chapters);
      }
      items.push({ label: 'NEW GAME', action: () => this.newGame() });
      if (!items.includes(chapters)) items.push(chapters);
      if (DM.Bonus) items.push({ label: 'BONUS LEVELS', action: () => Engine.set(new Scenes.BonusMenu()) });
      items.push({ label: 'SETTINGS', action: () => Engine.push(new Scenes.Settings()) });
      items.push({ label: 'CONTROLS', action: () => Engine.push(new Scenes.Controls()) });
      const keep = this.menu ? this.menu.sel : 0;
      this.menu = new TitleMenu(items, { x: 84, y: 330, w: 400, itemH: 44, size: 24 });
      this.menu.sel = Math.min(keep, items.length - 1);
    }
    continueGame() {
      const cp = Save.continueTarget();
      const ch = cp && DM.Chapters.get(cp.chapter);
      if (!ch) return this.startNewGame();
      if (!cp.stage) Engine.fadeTo(() => Engine.set(new Scenes.Interlude(ch.id)));
      else Engine.fadeTo(() => Engine.set(new Scenes.Play(), { chapter: ch.id, stage: cp.stage, carry: cp.carry }));
    }
    // With progress saved, New Game asks first: it replaces the Continue point.
    newGame() {
      const t = Save.continueTarget();
      const ch = t && DM.Chapters.get(t.chapter);
      const progress = Save.data.reached > 0 || (ch && (t.stage > 0 || ch.index > 0));
      if (progress) Engine.push(new ConfirmNewGame(() => this.startNewGame()));
      else this.startNewGame();
    }
    startNewGame() {
      Save.startOver();
      Engine.fadeTo(() => Engine.set(new Scenes.Interlude(DM.Chapters.list[0].id)));
    }
    update(dt) {
      this.t += dt;
      for (const m of this.motes) m.a += 0.15 * m.s * dt;
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
        // Photosensitivity notice, before anything can flash.
        const reduced = DM.SettingsSchema.reducedFlashing();
        Gfx.text(ctx, reduced ? 'Contains flashing lights. Reduced flashing is on; change it in Settings.' : 'Contains flashing lights. Reduce them in Settings.', 86, 476, { size: 15, color: 'rgba(242,196,24,0.8)', font: DM.FONTS.type });
      } else this.menu.render(ctx);

      Gfx.text(ctx, `v${DM.VERSION}  ·  KEYBOARD & MOUSE  ·  PROGRESS SAVES AUTOMATICALLY${DM.DEV ? '  ·  DEV MODE' : ''}`, 86, DM.H - 30, { size: 11, color: 'rgba(200,225,240,0.4)', spacing: 2 });
      if (this.touchOnly) Gfx.text(ctx, 'This game needs a keyboard and mouse. Touch controls are on the roadmap.', 86, DM.H - 52, { size: 13, color: DM.C.yellow });
      Gfx.text(ctx, 'Quis custodiet ipsos custodes?', DM.W - 40, DM.H - 30, { size: 14, color: 'rgba(242,231,204,0.45)', align: 'right', font: DM.FONTS.type });
    }
  }

  // ---- New Game confirmation -------------------------------------------------
  class ConfirmNewGame {
    constructor(onConfirm) {
      this.onConfirm = onConfirm;
      this.opaque = false;
      this.cursor = 'pointer';
      this.t = 0;
    }
    enter() {
      this.where = whereText(Save.continueTarget());
      this.menu = new DM.UI.Menu([
        { label: 'START OVER', action: () => {
          Engine.pop();
          this.onConfirm();
        } },
        { label: 'CANCEL', action: () => Engine.pop() },
      ], { x: DM.W / 2, y: 374, w: 380, align: 'center', itemH: 52, size: 24, onBack: () => Engine.pop() });
      this.menu.sel = 1; // the safe choice is the default
    }
    update(dt) {
      this.t += dt;
      this.menu.update(dt);
    }
    render(ctx) {
      const k = U.ease.outCubic(Math.min(1, this.t * 4));
      ctx.fillStyle = `rgba(2,4,9,${0.82 * k})`;
      ctx.fillRect(0, 0, DM.W, DM.H);
      const w = 640, x = DM.W / 2 - w / 2;
      Gfx.panel(ctx, x, 200, w, 310, { accent: DM.C.yellow });
      Gfx.text(ctx, 'START A NEW GAME?', DM.W / 2, 262, { size: 38, color: '#eefbff', align: 'center', weight: 700, spacing: 8 });
      const lines = this.where
        ? [`Continue now leads to ${this.where}.`, 'Starting over replaces it. Chapters you reached stay unlocked.']
        : ['The story starts again from the Prologue.', 'Chapters you reached stay unlocked.'];
      lines.forEach((l, i) => Gfx.text(ctx, l, DM.W / 2, 304 + i * 24, { size: 15, color: 'rgba(220,238,255,0.75)', align: 'center', font: DM.FONTS.type }));
      this.menu.render(ctx);
    }
  }

  // ---- Chapter select --------------------------------------------------------------
  class ChapterSelect {
    constructor() {
      this.t = 0;
      this.cursor = 'pointer';
      this.sel = 0;
      this.sub = 0; // 0 = play from the start, 1 = resume from the chapter's checkpoint
      this.backRect = { x: 40, y: 36, w: 128, h: 40 };
    }
    enter() {
      const reached = DM.DEV ? 99 : Save.data.reached;
      const cps = Save.data.checkpoints || {};
      this.cards = DM.Chapters.list.map((c, i) => {
        const cp = cps[c.id];
        return { c, locked: i > reached, resume: i <= reached && cp && cp.stage > 0 ? cp : null };
      });
      this.sel = Math.min(reached, this.cards.length - 1);
      this.anyResume = this.cards.some((c) => c.resume);
    }
    rect(i) {
      const n = this.cards.length;
      const w = 182, gap = 14;
      const x0 = DM.W / 2 - (n * w + (n - 1) * gap) / 2;
      return { x: x0 + i * (w + gap), y: 190, w, h: 330 };
    }
    resumeRect(i) {
      const r = this.rect(i);
      return { x: r.x, y: r.y + r.h + 14, w: r.w, h: 46 };
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
    resume(i) {
      const card = this.cards[i];
      if (!card || card.locked || !card.resume) return this.pick(i);
      const cp = card.resume;
      DM.Audio.play('ui_select');
      Engine.fadeTo(() => Engine.set(new Scenes.Play(), { chapter: card.c.id, stage: cp.stage, carry: cp.carry }));
    }
    select(i, sub) {
      const card = this.cards[i];
      sub = card && card.resume ? sub : 0;
      if (i === this.sel && sub === this.sub) return;
      this.sel = i;
      this.sub = sub;
      DM.Audio.play('ui_move');
    }
    update(dt) {
      this.t += dt;
      const m = Input.mouse;
      let hover = -1, hoverSub = 0;
      this.cards.forEach((card, i) => {
        if (inRect(m, this.rect(i))) hover = i;
        else if (card.resume && inRect(m, this.resumeRect(i))) {
          hover = i;
          hoverSub = 1;
        }
      });
      this.hoverBack = inRect(m, this.backRect);
      if (m.moved && hover >= 0) this.select(hover, hoverSub);
      if (Input.clicked()) {
        Input.consume('confirm');
        if (hover >= 0) {
          if (hoverSub) this.resume(hover);
          else this.pick(hover);
        } else if (this.hoverBack) this.back();
        return;
      }
      const n = this.cards.length;
      const card = this.cards[this.sel];
      if (Input.pressed('menuRight')) this.select(Math.min(n - 1, this.sel + 1), 0);
      if (Input.pressed('menuLeft')) this.select(Math.max(0, this.sel - 1), 0);
      // Down/up walk the cards in reading order: a card, then its Resume button.
      if (Input.pressed('menuDown')) {
        if (card && card.resume && !this.sub) this.select(this.sel, 1);
        else this.select(Math.min(n - 1, this.sel + 1), 0);
      }
      if (Input.pressed('menuUp')) {
        if (this.sub) this.select(this.sel, 0);
        else this.select(Math.max(0, this.sel - 1), 0);
      }
      if (Input.pressed('confirm')) {
        if (this.sub) this.resume(this.sel);
        else this.pick(this.sel);
      } else if (Input.pressed('back')) this.back();
    }
    back() {
      DM.Audio.play('ui_back');
      Engine.pop();
    }
    render(ctx) {
      backdrop(ctx, this.t, { mars: false });
      Gfx.text(ctx, 'CHAPTERS', DM.W / 2, 110, { size: 44, color: '#eefbff', align: 'center', weight: 700, spacing: 10 });
      Gfx.text(ctx, 'The clock moves closer to midnight with every chapter.', DM.W / 2, 146, { size: 16, color: 'rgba(200,225,240,0.6)', align: 'center', font: DM.FONTS.type });
      const b = this.backRect;
      Gfx.panel(ctx, b.x, b.y, b.w, b.h, { fill: this.hoverBack ? 'rgba(95,212,255,0.16)' : DM.C.uiBg, accent: this.hoverBack ? '#eefbff' : DM.C.uiEdge });
      Gfx.text(ctx, '‹  BACK', b.x + b.w / 2, b.y + 26, { size: 17, color: this.hoverBack ? '#ffffff' : 'rgba(200,225,240,0.8)', align: 'center', spacing: 3, weight: 600 });
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
        ctx.strokeStyle = sel && !this.sub ? '#eefbff' : DM.C.ink;
        ctx.lineWidth = sel && !this.sub ? 3 : 2;
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
        if (card.resume) {
          const rr = this.resumeRect(i);
          const on = sel && this.sub === 1;
          Gfx.panel(ctx, rr.x, rr.y, rr.w, rr.h, { fill: on ? 'rgba(95,212,255,0.2)' : DM.C.uiBg, accent: on ? '#eefbff' : DM.C.uiEdge });
          Gfx.text(ctx, '▸ RESUME', rr.x + rr.w / 2, rr.y + 20, { size: 15, color: on ? '#ffffff' : 'rgba(200,225,240,0.85)', align: 'center', spacing: 3, weight: 600 });
          Gfx.text(ctx, stageName(c, card.resume.stage), rr.x + rr.w / 2, rr.y + 37, { size: 12, color: on ? DM.C.blue : 'rgba(200,225,240,0.55)', align: 'center', font: DM.FONTS.type });
        }
      });
      const hint = '←  →  CHOOSE' + (this.anyResume ? '     ↓  RESUME' : '') + '     ENTER / CLICK  PLAY     ESC  BACK';
      Gfx.text(ctx, hint, DM.W / 2, 636, { size: 13, color: 'rgba(200,225,240,0.5)', align: 'center', spacing: 3 });
    }
  }

  Scenes.Title = Title;
  Scenes.ChapterSelect = ChapterSelect;
  Scenes.ConfirmNewGame = ConfirmNewGame;
})();
