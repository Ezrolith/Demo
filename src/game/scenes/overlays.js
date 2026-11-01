/* Overlay scenes: pause, settings, controls, power unlock card, game over, chapter complete. */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Engine = DM.Engine;
  const Save = DM.Save;
  const Schema = DM.SettingsSchema;
  const F = DM.FONTS;
  const Scenes = (DM.Scenes = DM.Scenes || {});

  function dim(ctx, a = 0.7) {
    ctx.fillStyle = `rgba(2,4,9,${a})`;
    ctx.fillRect(0, 0, DM.W, DM.H);
  }

  function toTitle() {
    Engine.fadeTo(() => Engine.set(new Scenes.Title()));
  }

  // ---- Pause ------------------------------------------------------------------
  class Pause {
    constructor(play) {
      this.play = play;
      this.opaque = false;
      this.cursor = 'pointer';
      this.t = 0;
    }
    enter() {
      DM.Audio.stopHums();
      DM.Audio.setMusicFilter(1200);
      this.menu = new DM.UI.Menu([
        { label: 'RESUME', action: () => this.close() },
        { label: 'RESTART FROM CHECKPOINT', action: () => this.play.retry() },
        { label: 'SETTINGS', action: () => Engine.push(new Settings()) },
        { label: 'CONTROLS', action: () => Engine.push(new Controls()) },
        { label: 'QUIT TO TITLE', action: () => toTitle() },
      ], { x: DM.W / 2, y: 364, w: 420, align: 'center', itemH: 48, size: 24, onBack: () => this.close() });
      if (DM.GlassPalace?.addTrackingPauseAction) DM.GlassPalace.addTrackingPauseAction(this);
    }
    close() {
      DM.Audio.setMusicFilter(this.play.world.timesight ? 650 : 18000);
      Engine.pop();
    }
    // What the player is doing and the last tip they were given (shown even if hints are ESSENTIAL).
    notes() {
      const hud = this.play.hud;
      const o = hud && hud.objective && !hud.objective.done ? hud.objective : null;
      let objective = null;
      if (o) {
        const prog = o.progress ? o.progress() : null;
        objective = o.text + (prog != null && prog !== '' ? `  ${prog}` : '');
      }
      const h = hud && hud.lastHint;
      const note = h && h.chapter === this.play.chapter.id ? h.text : null;
      return { objective, note };
    }
    update(dt) {
      this.t += dt;
      if (Input.pressed('pause') && !Input.pressed('back')) return this.close();
      this.menu.update(dt);
    }
    render(ctx) {
      dim(ctx, 0.8);
      Gfx.text(ctx, 'PAUSED', DM.W / 2, 146, { size: 56, color: '#eefbff', align: 'center', weight: 700, spacing: 12 });
      const ch = this.play.chapter;
      Gfx.text(ctx, `${ch.numeral} · ${ch.title.toUpperCase()}`, DM.W / 2, 178, { size: 15, color: DM.C.blue, align: 'center', spacing: 4 });
      this.renderNotes(ctx);
      this.menu.render(ctx);
    }
    renderNotes(ctx) {
      const { objective, note } = this.notes();
      if (!objective && !note) return;
      const w = 700, x = DM.W / 2 - w / 2, y = 204, pad = 22;
      const lines = note ? Math.min(3, Math.round(Gfx.paragraphHeight(ctx, note, w - pad * 2, 23, { size: 18, font: F.display }) / 23)) : 0;
      const h = (objective ? 56 : 0) + (note ? 30 + lines * 23 : 0) + 18;
      Gfx.panel(ctx, x, y, w, h, { accent: 'rgba(242,196,24,0.7)' });
      let cy = y + 26;
      if (objective) {
        Gfx.text(ctx, 'OBJECTIVE', x + pad, cy, { size: 11, color: DM.C.yellow, spacing: 3, weight: 600 });
        Gfx.text(ctx, objective, x + pad, cy + 24, { size: 19, color: '#ffffff' });
        cy += 56;
      }
      if (note) {
        Gfx.text(ctx, 'FIELD NOTE', x + pad, cy, { size: 11, color: DM.C.yellow, spacing: 3, weight: 600 });
        Gfx.text(ctx, 'H  RECALLS IT IN PLAY', x + w - pad, cy, { size: 10, color: 'rgba(200,225,240,0.5)', spacing: 2, align: 'right' });
        Gfx.paragraph(ctx, note, x + pad, cy + 8, w - pad * 2, 23, { size: 18, font: F.display, color: '#fff6d0' });
      }
    }
  }

  // ---- Settings -------------------------------------------------------------------
  // Rows come from DM.SettingsSchema, one tab per section. Q / E (or clicking a
  // tab, or ↑ to the tab row then ← →) switch sections.
  const MENU_Y = 186;
  const FOOT_Y = 552; // top of the description footer; rows always end above it

  class Settings {
    constructor() {
      this.opaque = false;
      this.cursor = 'pointer';
      this.tab = 0;
      this.tabFocus = false;
      this.armed = null;
      this.done = null;
      this.tabRects = [];
      this.t = 0;
    }
    enter() {
      Schema.sanitize(Save.settings);
      this.build();
    }
    item(e) {
      const it = { id: e.id, label: e.label, desc: () => Schema.describe(e.id) };
      if (e.type === 'action') {
        if (e.confirm) it.value = () => (this.armed === e.id ? 'PRESS AGAIN' : '');
        it.action = () => {
          if (e.confirm && this.armed !== e.id) {
            this.armed = e.id;
            return;
          }
          this.armed = null;
          const msg = e.action(this);
          if (msg) this.done = msg;
        };
        return it;
      }
      it.value = () => Schema.format(e.id);
      it.adjust = (dir) => Schema.step(e.id, dir);
      if (e.type === 'slider') {
        it.frac = () => (Schema.value(e.id) - e.min) / (e.max - e.min);
        it.setFrac = (f) => Schema.set(e.id, e.min + Math.round((f * (e.max - e.min)) / e.step) * e.step);
      }
      return it;
    }
    build() {
      const items = Schema.inSection(Schema.sections[this.tab]).map((e) => this.item(e));
      items.push({ label: 'BACK', action: () => this.close(), desc: () => '' });
      // Rows shrink to fit if a section ever grows past the space above the footer.
      const itemH = Math.min(46, Math.floor((FOOT_Y - 8 - MENU_Y) / items.length));
      this.menu = new DM.UI.Menu(items, {
        x: DM.W / 2 - 330, y: MENU_Y, w: 660, itemH, size: Math.min(21, Math.round(itemH * 0.46)), valueW: 150,
        onBack: () => this.close(),
      });
    }
    switchTab(i) {
      const n = Schema.sections.length;
      const next = (i + n) % n;
      if (next === this.tab) return;
      this.tab = next;
      this.armed = null;
      this.build();
      DM.Audio.play('ui_move');
    }
    close() {
      Engine.pop();
    }
    tabAt(mx, my) {
      return this.tabRects.findIndex((r) => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
    }
    update(dt) {
      this.t += dt;
      const m = Input.mouse;
      if (Input.pressed('tabNext') || Input.pressed('tabPrev')) {
        const dir = Input.pressed('tabNext') ? 1 : -1;
        for (const a of ['tabNext', 'tabPrev', 'confirm', 'interact']) Input.consume(a);
        this.switchTab(this.tab + dir);
        return;
      }
      if (Input.clicked() && this.tabAt(m.x, m.y) >= 0) {
        Input.consume('confirm');
        this.switchTab(this.tabAt(m.x, m.y));
        return;
      }
      const first = this.menu.items.findIndex((i) => !i.disabled);
      if (this.tabFocus) {
        if (m.moved && this.menu.hit(m.x, m.y) >= 0) this.tabFocus = false;
        else {
          if (Input.pressed('menuLeft')) this.switchTab(this.tab - 1);
          if (Input.pressed('menuRight')) this.switchTab(this.tab + 1);
          if (Input.pressed('menuDown') || Input.pressed('confirm')) {
            Input.consume('confirm');
            this.tabFocus = false;
            this.menu.sel = first;
            DM.Audio.play('ui_move');
          } else if (Input.pressed('menuUp')) {
            this.tabFocus = false;
            this.menu.sel = this.menu.items.length - 1;
            DM.Audio.play('ui_move');
          } else if (Input.pressed('back')) {
            Input.consume('back');
            DM.Audio.play('ui_back');
            this.close();
          }
          return;
        }
      }
      if (Input.pressed('menuUp') && this.menu.sel === first) {
        Input.consume('menuUp');
        this.tabFocus = true;
        DM.Audio.play('ui_move');
        return;
      }
      this.menu.update(dt);
      const cur = this.menu.items[this.menu.sel];
      if (!cur || cur.id !== this.armed) this.armed = null;
    }
    render(ctx) {
      dim(ctx, 0.92);
      if (Engine.top() !== this) return; // the controls list is open on top
      Gfx.text(ctx, 'SETTINGS', DM.W / 2, 100, { size: 44, color: '#eefbff', align: 'center', weight: 700, spacing: 10 });
      this.renderTabs(ctx);
      if (!this.tabFocus) this.menu.render(ctx);
      else {
        const sel = this.menu.sel;
        this.menu.sel = -1;
        this.menu.render(ctx);
        this.menu.sel = sel;
      }
      ctx.fillStyle = 'rgba(140,200,240,0.16)';
      ctx.fillRect(DM.W / 2 - 330, FOOT_Y, 660, 1);
      const it = this.menu.items[this.menu.sel];
      const desc = this.tabFocus ? '← →  to choose a section.' : it && it.desc ? it.desc() : '';
      if (desc) Gfx.paragraph(ctx, desc, DM.W / 2, FOOT_Y + 18, 720, 24, { size: 17, font: F.type, color: 'rgba(220,238,255,0.82)', align: 'center' });
      const note = this.done || (!Save.available ? 'This browser is blocking storage, so progress will not be saved.'
        : Save.readOnly ? 'This save is from a newer version of the game, so nothing will be saved here.'
        : 'Settings and progress are saved in this browser.');
      Gfx.text(ctx, note, DM.W / 2, 652, { size: 14, color: 'rgba(200,225,240,0.5)', align: 'center', font: F.type });
      Gfx.text(ctx, 'Q / E  SECTION     ↑ ↓  CHOOSE     ← →  CHANGE     ESC  BACK', DM.W / 2, 686, { size: 12, color: 'rgba(200,225,240,0.45)', align: 'center', spacing: 3 });
    }
    renderTabs(ctx) {
      const names = Schema.sections;
      const o = { size: 15, spacing: 3, weight: 600 };
      const gap = 44;
      const widths = names.map((n) => Gfx.measure(ctx, n, o));
      let x = DM.W / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (names.length - 1)) / 2;
      const y = 148;
      this.tabRects = [];
      names.forEach((n, i) => {
        const w = widths[i];
        const on = i === this.tab;
        this.tabRects.push({ x: x - 10, y: y - 22, w: w + 20, h: 34 });
        if (on && this.tabFocus) {
          ctx.fillStyle = 'rgba(95,212,255,0.12)';
          ctx.fillRect(x - 10, y - 22, w + 20, 34);
        }
        Gfx.text(ctx, n, x, y, Object.assign({ color: on ? '#ffffff' : 'rgba(200,225,240,0.5)' }, o));
        if (on) {
          ctx.fillStyle = DM.C.blue;
          ctx.fillRect(x, y + 8, w, 2);
        }
        x += w + gap;
      });
    }
  }

  // ---- Controls -----------------------------------------------------------------
  function controlRows() {
    const actor = Engine.stack.find(scene => scene.player)?.player;
    if (actor?.controlRows) return actor.controlRows;
    const tk = Input.bindings.telekinesis || [];
    const orC = tk.includes('KeyC') ? ' OR C' : '';
    const toggle = Schema.value('tkMode') === 'toggle';
    return [
      ['MOVE', 'W A S D  /  ARROW KEYS'],
      ['AIM', 'MOUSE'],
      ['INTERACT / TALK', 'E'],
      ['TELEKINESIS', toggle ? `CLICK${orC} TO LIFT, AGAIN TO THROW` : `HOLD LEFT CLICK${orC}, MOVE, RELEASE TO THROW`],
      ['DISINTEGRATE', 'Q  /  RIGHT CLICK  (TWO-FINGER CLICK ON A MAC)'],
      ['TELEPORT', 'SPACE'],
      ['DUPLICATE', 'R'],
      ['TEMPORAL SIGHT', 'HOLD F  /  SHIFT'],
      ['EXPAND', 'G'],
      ['LAST HINT', 'H'],
      ['ADVANCE DIALOGUE', 'E / SPACE / CLICK  (HOLD TO FAST-FORWARD)'],
      ['SKIP NARRATION', 'E / SPACE / CLICK, TWICE'],
      ['PAUSE', 'ESC / P'],
      ['MUTE', 'M'],
    ];
  }

  class Controls {
    constructor() {
      this.opaque = false;
      this.cursor = 'pointer';
    }
    update() {
      if (Input.pressed('back') || Input.pressed('confirm') || Input.pressed('pause')) {
        Input.consume('confirm');
        Input.consume('back');
        DM.Audio.play('ui_back');
        Engine.pop();
      }
    }
    render(ctx) {
      dim(ctx, 0.88);
      Gfx.text(ctx, 'CONTROLS', DM.W / 2, 100, { size: 44, color: '#eefbff', align: 'center', weight: 700, spacing: 10 });
      const actor = Engine.stack.find(scene => scene.player)?.player;
      Gfx.text(ctx, actor?.profile ? actor.profile.name + ' · Human, vulnerable, resourceful.' : 'Powers unlock as Jon changes. You start as a man.', DM.W / 2, 134, { size: 15, color: 'rgba(200,225,240,0.6)', align: 'center', font: F.type });
      controlRows().forEach(([a, b], i) => {
        const y = 184 + i * 31;
        Gfx.text(ctx, a, DM.W / 2 - 20, y, { size: 17, color: DM.C.blue, align: 'right', spacing: 2 });
        Gfx.text(ctx, b, DM.W / 2 + 20, y, { size: 17, color: '#ffffff', spacing: 1 });
      });
      Gfx.text(ctx, 'ESC / CLICK TO GO BACK', DM.W / 2, 660, { size: 13, color: 'rgba(200,225,240,0.5)', align: 'center', spacing: 3 });
    }
  }

  // ---- Power unlock card ---------------------------------------------------------
  class PowerUnlock {
    constructor(id, onClose) {
      this.def = DM.Powers.get(id);
      this.onClose = onClose;
      this.opaque = false;
      this.cursor = 'pointer';
      this.t = 0;
    }
    enter() {
      DM.Audio.play('unlock');
      DM.Audio.stopHums();
    }
    update(dt) {
      this.t += dt;
      if (this.t > 0.9 && (Input.pressed('confirm') || Input.pressed('interact'))) {
        Input.consume('confirm');
        Input.consume('interact');
        Input.clearAll();
        DM.Audio.play('ui_select');
        Engine.pop();
        if (this.onClose) this.onClose();
      }
    }
    render(ctx) {
      const d = this.def;
      const k = U.ease.outCubic(Math.min(1, this.t * 2));
      dim(ctx, 0.78 * k);
      const cx = DM.W / 2, cy = 300;
      Gfx.glow(ctx, cx, cy - 40, 260 * k, d.color, 0.35);
      ctx.save();
      ctx.translate(cx, cy - 40);
      ctx.scale(0.6 + k * 0.4, 0.6 + k * 0.4);
      Gfx.icon(ctx, d.id, 0, 0, 120, d.color, this.t);
      ctx.restore();
      Gfx.text(ctx, 'NEW POWER', cx, cy + 66, { size: 14, color: DM.C.yellow, align: 'center', spacing: 8, alpha: k });
      Gfx.text(ctx, d.name.toUpperCase(), cx, cy + 122, { size: 58, color: '#ffffff', align: 'center', weight: 700, spacing: 10, alpha: k });
      ctx.save();
      ctx.globalAlpha = k;
      Gfx.paragraph(ctx, d.desc, cx, cy + 146, 620, 26, { size: 19, font: F.type, color: '#dceeff', align: 'center' });
      const tipY = cy + 214;
      const tw = 700;
      Gfx.panel(ctx, cx - tw / 2, tipY - 8, tw, 82, { accent: d.color });
      Gfx.paragraph(ctx, d.tip, cx, tipY + 6, tw - 50, 25, { size: 19, font: F.display, color: '#ffffff', align: 'center' });
      ctx.restore();
      if (this.t > 0.9 && Math.sin(this.t * 4) > -0.4) Gfx.text(ctx, 'PRESS E / SPACE / CLICK', cx, DM.H - 40, { size: 13, color: 'rgba(255,255,255,0.7)', align: 'center', spacing: 4 });
    }
  }

  // ---- Game over (decoherence) ------------------------------------------------------
  class GameOver {
    constructor(play) {
      this.play = play;
      this.opaque = false;
      this.cursor = 'pointer';
      this.t = 0;
    }
    enter() {
      DM.Audio.stopHums();
      DM.Audio.setMusicFilter(500);
      // Three decoherences at one checkpoint: offer the gentler challenge, without nagging.
      this.offer = DM.Challenge.deaths(this.play) >= 3 && Schema.value('challenge') !== 'story' && !Schema.value('invulnerable');
      const items = [{ label: this.play.chapter.afterMidnight ? 'GET BACK UP' : 'REASSEMBLE', action: () => this.play.retry() }];
      if (this.offer) {
        items.push({
          label: 'TRY STORY CHALLENGE',
          action: () => {
            Schema.set('challenge', 'story');
            this.play.retry();
          },
        });
      }
      items.push({ label: 'QUIT TO TITLE', action: () => toTitle() });
      this.menu = new DM.UI.Menu(items, { x: DM.W / 2, y: 400, w: 440, align: 'center', itemH: 52, size: 26 });
    }
    update(dt) {
      this.t += dt;
      if (this.t > 0.6) this.menu.update(dt);
    }
    render(ctx) {
      dim(ctx, Math.min(0.8, this.t));
      Gfx.text(ctx, this.play.chapter.afterMidnight ? 'DOWN, NOT OUT' : 'DECOHERENCE', DM.W / 2, 270, { size: 64, color: '#bff1ff', align: 'center', weight: 700, spacing: 14 });
      Gfx.text(ctx, this.play.chapter.afterMidnight ? 'You are only human. Take a breath and return to the checkpoint.' : 'Your intrinsic field came apart. You have put yourself back together before.', DM.W / 2, 316, { size: 18, color: 'rgba(220,238,255,0.75)', align: 'center', font: F.type });
      if (this.t <= 0.6) return;
      this.menu.render(ctx);
      if (this.offer) {
        const y = this.menu.y + this.menu.items.length * this.menu.itemH + 30;
        Gfx.text(ctx, 'Story challenge: attacks hurt less and you recover faster. Change it any time in Settings.', DM.W / 2, y, { size: 15, color: 'rgba(200,225,240,0.6)', align: 'center', font: F.type });
      }
    }
  }

  // ---- Chapter complete ------------------------------------------------------------------
  class ChapterComplete {
    constructor(play, stats, next) {
      this.play = play;
      this.stats = Object.assign({}, stats);
      this.next = next;
      this.opaque = false;
      this.cursor = 'pointer';
      this.t = 0;
      this.leaving = false;
    }
    enter() {
      DM.Audio.stopHums();
      DM.Audio.play('success');
      DM.Challenge.clear(this.play.chapter.id);
    }
    rows() {
      const s = this.stats;
      const rows = [['TIME', U.fmtTime(s.time)]];
      if (s.disintegrated || s.spared) {
        rows.push(['DISINTEGRATED', String(s.disintegrated)]);
        rows.push(['SPARED', String(s.spared)]);
      }
      if (this.play.chapter.id === 'mars') rows.push(['MEMORIES', `${s.memories} / 6`]);
      // A neutral record of how it was played, never a grade.
      rows.push(['CHALLENGE', Schema.format('challenge') + (Schema.value('invulnerable') ? '  ·  INVULNERABLE' : '')]);
      return rows;
    }
    update(dt) {
      this.t += dt;
      if (this.t > 1 && !this.leaving && (Input.pressed('confirm') || Input.pressed('interact'))) {
        this.leaving = true;
        DM.Audio.play('ui_select');
        const next = this.next;
        Engine.fadeTo(() => Engine.set(next ? new Scenes.Interlude(next.id) : new Scenes.Ending()), { out: 0.8, in: 0.6 });
      }
    }
    render(ctx) {
      const ch = this.play.chapter;
      const k = U.ease.outCubic(Math.min(1, this.t * 1.5));
      dim(ctx, 0.8 * k);
      ctx.save();
      ctx.globalAlpha = k;
      Gfx.clock(ctx, DM.W / 2, 190, 58, ch.clock, { blood: true });
      Gfx.text(ctx, `${ch.numeral} COMPLETE`, DM.W / 2, 300, { size: 16, color: DM.C.yellow, align: 'center', spacing: 8 });
      Gfx.text(ctx, ch.title.toUpperCase(), DM.W / 2, 352, { size: 48, color: '#ffffff', align: 'center', weight: 700, spacing: 6 });
      this.rows().forEach(([a, b], i) => {
        const y = 410 + i * 32;
        Gfx.text(ctx, a, DM.W / 2 - 16, y, { size: 16, color: 'rgba(200,225,240,0.7)', align: 'right', spacing: 3 });
        Gfx.text(ctx, b, DM.W / 2 + 16, y, { size: 18, color: '#ffffff', spacing: 1 });
      });
      ctx.restore();
      if (this.t > 1 && Math.sin(this.t * 4) > -0.4) Gfx.text(ctx, this.next ? 'PRESS SPACE / CLICK TO CONTINUE' : 'PRESS SPACE / CLICK', DM.W / 2, DM.H - 60, { size: 14, color: 'rgba(255,255,255,0.8)', align: 'center', spacing: 4 });
    }
  }

  Scenes.Pause = Pause;
  Settings.FOOT_Y = FOOT_Y;
  Scenes.Settings = Settings;
  Scenes.Controls = Controls;
  Scenes.PowerUnlock = PowerUnlock;
  Scenes.GameOver = GameOver;
  Scenes.ChapterComplete = ChapterComplete;
})();
