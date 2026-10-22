/* Overlay scenes: pause, settings, controls, power unlock card, game over, chapter complete. */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Engine = DM.Engine;
  const Save = DM.Save;
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
      ], { x: DM.W / 2, y: 300, w: 420, align: 'center', itemH: 50, size: 24, onBack: () => this.close() });
    }
    close() {
      DM.Audio.setMusicFilter(this.play.world.timesight ? 650 : 18000);
      Engine.pop();
    }
    update(dt) {
      this.t += dt;
      if (Input.pressed('pause') && !Input.pressed('back')) return this.close();
      this.menu.update(dt);
    }
    render(ctx) {
      dim(ctx, 0.72);
      Gfx.text(ctx, 'PAUSED', DM.W / 2, 230, { size: 56, color: '#eefbff', align: 'center', weight: 700, spacing: 12 });
      const ch = this.play.chapter;
      Gfx.text(ctx, `${ch.numeral} · ${ch.title.toUpperCase()}`, DM.W / 2, 262, { size: 15, color: DM.C.blue, align: 'center', spacing: 4 });
      this.menu.render(ctx);
    }
  }

  // ---- Settings -------------------------------------------------------------------
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function toggleFullscreen() {
    try {
      if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          const r = req.call(el);
          if (r && r.catch) r.catch(() => {});
        }
      }
    } catch (e) {
      /* fullscreen is optional */
    }
  }

  class Settings {
    constructor() {
      this.opaque = false;
      this.cursor = 'pointer';
      this.resetArmed = false;
    }
    enter() {
      const s = Save.settings;
      const pct = (v) => `${Math.round(v * 100)}%`;
      const vol = (key) => (dir) => {
        s[key] = U.clamp(Math.round((s[key] + dir * 0.1) * 10) / 10, 0, 1);
        DM.Audio.setVolumes({ music: s.music, sfx: s.sfx });
        Save.write();
        if (key === 'sfx') DM.Audio.play('ui_select');
      };
      this.menu = new DM.UI.Menu([
        { label: 'MUSIC', value: () => pct(s.music), adjust: vol('music') },
        { label: 'SOUND EFFECTS', value: () => pct(s.sfx), adjust: vol('sfx') },
        { label: 'SCREEN SHAKE', value: () => (s.shake ? 'ON' : 'OFF'), adjust: () => { s.shake = s.shake ? 0 : 1; Save.write(); } },
        { label: 'HINTS', value: () => (s.hints !== false ? 'ON' : 'OFF'), adjust: () => { s.hints = s.hints === false; Save.write(); } },
        { label: 'FULLSCREEN', value: () => (isFullscreen() ? 'ON' : 'OFF'), adjust: () => toggleFullscreen() },
        { label: 'RESET PROGRESS', value: () => (this.resetArmed ? 'PRESS AGAIN' : ''), action: () => this.reset() },
        { label: 'BACK', action: () => Engine.pop() },
      ], { x: DM.W / 2 - 280, y: 220, w: 560, itemH: 50, size: 22, onBack: () => Engine.pop() });
    }
    reset() {
      if (!this.resetArmed) {
        this.resetArmed = true;
        return;
      }
      Save.reset();
      this.resetArmed = false;
      this.done = 'Progress reset.';
    }
    update(dt) {
      if (this.menu.items[this.menu.sel].label !== 'RESET PROGRESS') this.resetArmed = false;
      this.menu.update(dt);
    }
    render(ctx) {
      dim(ctx, 0.85);
      Gfx.text(ctx, 'SETTINGS', DM.W / 2, 170, { size: 44, color: '#eefbff', align: 'center', weight: 700, spacing: 10 });
      this.menu.render(ctx);
      const note = this.done || (Save.available ? 'Settings and progress are saved in this browser.' : 'This browser is blocking storage, so progress will not be saved.');
      Gfx.text(ctx, note, DM.W / 2, 610, { size: 14, color: 'rgba(200,225,240,0.55)', align: 'center', font: F.type });
    }
  }

  // ---- Controls -----------------------------------------------------------------
  const CONTROL_ROWS = [
    ['MOVE', 'W A S D  /  ARROW KEYS'],
    ['AIM', 'MOUSE'],
    ['INTERACT / TALK', 'E'],
    ['TELEKINESIS', 'HOLD LEFT CLICK, MOVE, RELEASE TO THROW'],
    ['DISINTEGRATE', 'Q  /  RIGHT CLICK  (CTRL+CLICK ON MAC)'],
    ['TELEPORT', 'SPACE'],
    ['DUPLICATE', 'R'],
    ['TEMPORAL SIGHT', 'HOLD F  /  SHIFT'],
    ['EXPAND', 'G'],
    ['ADVANCE DIALOGUE', 'SPACE / CLICK / E'],
    ['PAUSE', 'ESC / P'],
    ['MUTE', 'M'],
  ];

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
      Gfx.text(ctx, 'CONTROLS', DM.W / 2, 110, { size: 44, color: '#eefbff', align: 'center', weight: 700, spacing: 10 });
      Gfx.text(ctx, 'Powers unlock as Jon changes. You start as a man.', DM.W / 2, 144, { size: 15, color: 'rgba(200,225,240,0.6)', align: 'center', font: F.type });
      CONTROL_ROWS.forEach(([a, b], i) => {
        const y = 196 + i * 34;
        Gfx.text(ctx, a, DM.W / 2 - 20, y, { size: 17, color: DM.C.blue, align: 'right', spacing: 2 });
        Gfx.text(ctx, b, DM.W / 2 + 20, y, { size: 17, color: '#ffffff', spacing: 1 });
      });
      Gfx.text(ctx, 'ESC / CLICK TO GO BACK', DM.W / 2, 640, { size: 13, color: 'rgba(200,225,240,0.5)', align: 'center', spacing: 3 });
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
      this.menu = new DM.UI.Menu([
        { label: 'REASSEMBLE', action: () => this.play.retry() },
        { label: 'QUIT TO TITLE', action: () => toTitle() },
      ], { x: DM.W / 2, y: 400, w: 380, align: 'center', itemH: 52, size: 26 });
    }
    update(dt) {
      this.t += dt;
      if (this.t > 0.6) this.menu.update(dt);
    }
    render(ctx) {
      dim(ctx, Math.min(0.8, this.t));
      Gfx.text(ctx, 'DECOHERENCE', DM.W / 2, 270, { size: 64, color: '#bff1ff', align: 'center', weight: 700, spacing: 14 });
      Gfx.text(ctx, 'Your intrinsic field came apart. You have put yourself back together before.', DM.W / 2, 316, { size: 18, color: 'rgba(220,238,255,0.75)', align: 'center', font: F.type });
      if (this.t > 0.6) this.menu.render(ctx);
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
      const s = this.stats;
      const rows = [['TIME', U.fmtTime(s.time)]];
      if (s.disintegrated || s.spared) {
        rows.push(['DISINTEGRATED', String(s.disintegrated)]);
        rows.push(['SPARED', String(s.spared)]);
      }
      if (ch.id === 'mars') rows.push(['MEMORIES', `${s.memories} / 6`]);
      rows.forEach(([a, b], i) => {
        const y = 410 + i * 32;
        Gfx.text(ctx, a, DM.W / 2 - 16, y, { size: 16, color: 'rgba(200,225,240,0.7)', align: 'right', spacing: 3 });
        Gfx.text(ctx, b, DM.W / 2 + 16, y, { size: 18, color: '#ffffff', spacing: 1 });
      });
      ctx.restore();
      if (this.t > 1 && Math.sin(this.t * 4) > -0.4) Gfx.text(ctx, this.next ? 'PRESS SPACE / CLICK TO CONTINUE' : 'PRESS SPACE / CLICK', DM.W / 2, DM.H - 60, { size: 14, color: 'rgba(255,255,255,0.8)', align: 'center', spacing: 4 });
    }
  }

  Scenes.Pause = Pause;
  Scenes.Settings = Settings;
  Scenes.Controls = Controls;
  Scenes.PowerUnlock = PowerUnlock;
  Scenes.GameOver = GameOver;
  Scenes.ChapterComplete = ChapterComplete;
})();
