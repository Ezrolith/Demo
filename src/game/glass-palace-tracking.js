/* Optional palace challenge notes. Untracked play keeps its original HUD methods. */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = DM.GlassPalace;
  const G = DM.Gfx;
  const I = DM.Input;
  const E = DM.Engine;
  const BLUE = '#b9ecff';
  const GOLD = '#e2c287';
  const GREEN = '#b3e4ca';
  const RED = '#e6b4a1';
  const hudOriginals = new WeakMap();
  const inside = (point, rect) => point.x >= rect.x && point.x <= rect.x + rect.w &&
    point.y >= rect.y && point.y <= rect.y + rect.h;
  const matching = (pin, momentId, challengeId) => pin?.momentId === momentId && pin.challengeId === challengeId;

  function actualMoment(play) {
    if (!play?.chapter || play.ctx?.scene !== play || play.ctx.chapter !== play.chapter) return false;
    return DM.Chapters.get(play.chapter.id) === play.chapter && GP.challengeDefs(play.chapter.id).length === 3;
  }

  class TrackingMenu extends DM.UI.Menu {
    rowRect(index) {
      if (index < 3) return { x: 940, y: 194 + index * 105, w: 220, h: 43 };
      const clear = this.items[index].clearTracking;
      return { x: 360, y: clear ? 511 : 565, w: 560, h: 42 };
    }
  }

  class TrackingPanel {
    constructor(value, options = {}) {
      this.play = value?.ctx ? value : null;
      this.moment = GP.find(this.play ? this.play.chapter.id : value?.id);
      this.result = options.result || null;
      this.returnLabel = options.returnLabel || 'RETURN TO PAUSE';
      this.opaque = false;
      this.cursor = 'pointer';
      this.t = 0;
    }
    enter() {
      I.clearAll();
      this.refresh();
    }
    refresh() {
      if (!this.moment) return;
      this.status = GP.status(this.moment.id);
      this.pin = GP.tracking();
      this.rows = this.status.challenges.map((definition) => ({
        ...definition,
        live: this.play && !this.result ? GP.liveChallenge(this.play, definition.id) : null,
        result: this.result?.breakdown?.find((row) => row.id === definition.id) || null,
      }));
      const items = this.rows.map((row) => ({
        challengeId: row.id,
        label: matching(this.pin, this.moment.id, row.id) ? 'STOP TRACKING' : 'TRACK THIS',
        action: () => {
          if (matching(GP.tracking(), this.moment.id, row.id)) GP.clearTracking();
          else GP.pinChallenge(this.moment.id, row.id);
          if (this.play && !this.result) GP.attachTracking(this.play);
          this.refresh();
          this.menu.sel = this.rows.findIndex((entry) => entry.id === row.id);
        },
      }));
      if (this.pin) items.push({
        label: 'CLEAR TRACKED CHALLENGE',
        clearTracking: true,
        action: () => {
          GP.clearTracking();
          if (this.play && !this.result) GP.attachTracking(this.play);
          this.refresh();
          this.menu.sel = this.menu.items.length - 1;
        },
      });
      items.push({ label: this.returnLabel, action: () => this.close() });
      this.menu = new TrackingMenu(items, { size: 17, align: 'center', onBack: () => this.close() });
    }
    close() {
      I.clearAll();
      E.pop();
    }
    update(dt) {
      this.t += dt;
      this.menu?.update(dt);
    }
    render(g) {
      if (!this.moment) return;
      g.fillStyle = 'rgba(2,7,14,0.98)';
      g.fillRect(72, 68, 1136, 584);
      g.strokeStyle = 'rgba(169,225,247,0.65)';
      g.strokeRect(72.5, 68.5, 1135, 583);
      G.text(g, this.result ? 'MOMENT RESULTS' : 'MOMENT CHALLENGES', 112, 126, {
        size: 34, color: BLUE, spacing: 3, weight: 700,
      });
      G.text(g, this.moment.title + ' · ' + this.status.earned + ' / 3 fragments recovered', 112, 161, {
        size: 15, color: '#b1c4ce',
      });
      this.rows.forEach((row, index) => {
        const y = 188 + index * 105;
        const tracked = matching(this.pin, this.moment.id, row.id);
        G.panel(g, 110, y, 1060, 97, { fill: '#0b1723', accent: tracked ? GOLD : row.complete ? GREEN : '#8d9ca6' });
        G.text(g, row.label.toUpperCase(), 132, y + 27, {
          size: 21, color: row.complete ? GREEN : '#e6d9bc',
        });
        G.paragraph(g, row.description, 132, y + 38, 780, 19, {
          size: 15, font: DM.FONTS.type, color: '#b7c9d1',
        });
        const result = row.result;
        let line;
        if (result) {
          const outcome = result.outcome === 'new' ? 'NEW FRAGMENT' : result.outcome === 'already'
            ? result.legacy ? 'LEGACY FRAGMENT RETAINED' : 'PREVIOUSLY RECOVERED' : 'MISSED THIS RUN';
          line = outcome + ' · ' + result.progress;
        } else if (row.live) line = (row.legacy ? 'LEGACY FRAGMENT RETAINED · ' : row.complete ? 'RECOVERED BEFORE · ' : '') +
          row.live.progress;
        else line = row.legacy ? 'Fragment retained from earlier rules.' : row.complete
          ? 'Recovered in an earlier run.' : 'Awarded only when this moment finishes.';
        G.paragraph(g, line, 132, y + 71, 1008, 18, {
          size: 13, font: DM.FONTS.type, color: result?.outcome === 'missed' ? RED : tracked ? GOLD : '#abc5cd',
        });
      });
      const selected = this.menu.items[this.menu.sel];
      const row = this.rows.find((entry) => entry.id === selected?.challengeId);
      const warning = GP.warning || (GP.available === false ? 'Palace progress is session only.' : '');
      const explanation = warning || row?.result?.reason || row?.live?.reason ||
        'Track one challenge. Live progress is provisional; fragments are awarded at completion.';
      G.paragraph(g, explanation, 640, 616, 1040, 17, {
        size: 13, font: DM.FONTS.type, color: warning ? GOLD : '#adc5cf', align: 'center',
      });
      this.menu.render(g);
    }
  }

  function renderTracking(g, play, controller) {
    const hud = play.hud;
    if (E.top() !== play || !hud.gameHudVisible() || play.failed || play.ctx.done || hud.flashAlpha > 0.05) return;
    if (hud.captions.length || hud.banners.length) return;
    const prompt = play.player.interactTarget;
    if (prompt) {
      const point = play.world.camera.toScreen(prompt.x, prompt.y - prompt.r - 30);
      const width = G.measure(g, prompt.interact.label, { size: 15 }) + 44;
      const y = point.y + Math.sin(hud.t * 4) * 2;
      if (point.x + width / 2 >= 20 && point.x - width / 2 <= 320 && y + 12 >= 148 && y - 16 <= 260) return;
    }
    const row = controller.snapshot;
    if (!row) return;
    const color = row.state === 'missed' ? RED : row.earned ? GREEN : GOLD;
    G.panel(g, 20, 148, 300, 112, { fill: 'rgba(3,10,19,0.94)', accent: color });
    G.text(g, row.legacy ? 'TRACKED · LEGACY FRAGMENT' : row.earned ? 'TRACKED · RECOVERED BEFORE'
      : 'TRACKED MOMENT CHALLENGE', 32, 168, {
      size: 13, color,
    });
    G.text(g, row.label.toUpperCase(), 32, 190, { size: 16, color: '#e6eef0' });
    G.paragraph(g, row.progress, 32, 202, 276, 18, {
      size: 13, font: DM.FONTS.type, color: '#c0d1d8',
    });
    const state = row.legacy ? 'LEGACY FRAGMENT RETAINED' : row.earned ? 'FRAGMENT ALREADY RECOVERED'
      : row.state === 'missed' ? 'MISSED THIS ATTEMPT' : row.state === 'ready'
      ? 'CONDITION MET · FINISH TO CLAIM' : 'IN PROGRESS · FINISH TO CLAIM';
    G.text(g, GP.available === false ? 'SESSION ONLY · BACK UP IN THE PALACE' : state, 32, 248, {
      size: 13, color,
    });
  }

  GP.attachTracking = (play) => {
    if (!play?.hud) return null;
    const hud = play.hud;
    const old = hudOriginals.get(hud);
    if (old) {
      hud.update = old.update;
      hud.render = old.render;
      hudOriginals.delete(hud);
    }
    play.glassPalaceTracking = null;
    const pin = GP.tracking();
    if (!pin || pin.momentId !== play.chapter?.id || !actualMoment(play)) return null;
    const controller = {
      ...pin, snapshot: GP.liveChallenge(play, pin.challengeId), updates: 1, timer: 0.25,
    };
    if (!controller.snapshot) return null;
    play.glassPalaceTracking = controller;
    const original = { update: hud.update, render: hud.render };
    hudOriginals.set(hud, original);
    hud.update = function (dt) {
      original.update.call(this, dt);
      controller.timer -= dt;
      if (controller.timer > 0) return;
      controller.timer = 0.25;
      controller.snapshot = GP.liveChallenge(play, controller.challengeId);
      controller.updates++;
    };
    hud.render = function (g) {
      renderTracking(g, play, controller);
      original.render.call(this, g);
    };
    return controller;
  };

  GP.addTrackingPauseAction = (pause) => {
    if (!actualMoment(pause.play)) return;
    const menu = pause.menu;
    const index = menu.items.length;
    menu.items.push({ label: 'MOMENT CHALLENGES', action: () => E.push(new TrackingPanel(pause.play)) });
    const rowRect = menu.rowRect;
    menu.rowRect = function (row) {
      return row === index ? { x: 430, y: 615, w: 420, h: 42 } : rowRect.call(this, row);
    };
  };

  GP.addCompletionDetails = (screen, play, result) => {
    if (!result?.breakdown || screen.glassPalaceDetailsRect) return;
    screen.glassPalaceDetailsRect = { x: 24, y: 58, w: 282, h: 36 };
    const update = screen.update;
    const render = screen.render;
    screen.update = function (dt) {
      if (I.pressed('hint') || I.clicked() && inside(I.mouse, this.glassPalaceDetailsRect)) {
        I.clearAll();
        E.push(new TrackingPanel(play, { result, returnLabel: 'RETURN TO RESULTS' }));
        return;
      }
      update.call(this, dt);
    };
    screen.render = function (g) {
      render.call(this, g);
      const rect = this.glassPalaceDetailsRect;
      G.panel(g, rect.x, rect.y, rect.w, rect.h, { fill: '#07141e', accent: BLUE });
      G.text(g, 'CHALLENGE DETAILS · H', rect.x + rect.w / 2, rect.y + 24, {
        size: 15, color: '#d5eef0', align: 'center',
      });
    };
  };

  GP.TrackingPanel = TrackingPanel;
  DM.Events.on('play:begin', ({ scene }) => GP.attachTracking(scene));
})();
