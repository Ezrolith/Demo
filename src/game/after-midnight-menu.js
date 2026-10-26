/* The case board, character selection and portable progress for After Midnight. */
(function () {
  'use strict';
  const DM = window.DM,
    AM = DM.AfterMidnight,
    G = DM.Gfx,
    E = DM.Engine,
    I = DM.Input;
  const MODE = [
    {
      id: 'story',
      name: 'CASE FILES',
      description: 'Three connected investigations. Checkpoints remember your hero.',
    },
    {
      id: 'patrol',
      name: 'NIGHT PATROL',
      description: 'Survive waves, improve your gear, and choose when to extract.',
    },
    {
      id: 'rescue_clock',
      name: 'RESCUE CLOCK',
      description: 'Guide civilians to safety before the deadline. Every rescue buys time.',
    },
  ];
  const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  function panel(g, r, selected, color) {
    G.panel(g, r.x, r.y, r.w, r.h, {
      fill: selected ? 'rgba(28,48,62,0.96)' : 'rgba(6,13,23,0.88)',
      accent: selected ? color : 'rgba(136,161,178,0.26)',
    });
  }
  function backdrop(g, t) {
    DM.Scenes.backdrop(g, t, { mars: false });
    if (DM.Bonus?.city) {
      g.save();
      g.globalAlpha = 0.32;
      DM.Bonus.city(g, t, 0, 210, DM.W, DM.H - 210);
      g.restore();
    }
    g.fillStyle = 'rgba(2,7,13,0.57)';
    g.fillRect(35, 25, 1210, 666);
  }
  const HERO_STYLE = {
    niteowl: 'Armour, ranged gear and careful plans.',
    silkspectre: 'Fast combinations and timed counters.',
    rorschach: 'Heavy strikes and investigative pressure.',
  };

  class CaseBoard {
    constructor(options = {}) {
      this.t = 0;
      this.cursor = 'pointer';
      this.step = options.step === 'cases' ? 'cases' : 'hero';
      this.focus = this.step === 'hero' ? 0 : 1;
      this.heroIndex = 0;
      this.caseIndex = 0;
    }

    enter() {
      this.syncSelection();
      this.buildMenu();
      DM.Audio.music.play('bonus_noir');
    }

    resume() {
      this.syncSelection();
      this.buildMenu();
    }

    syncSelection() {
      const saved = AM.load().selection;
      this.heroIndex = Math.max(
        0,
        AM.heroes.findIndex((hero) => hero.id === saved.hero),
      );
      this.modeIndex = Math.max(
        0,
        MODE.findIndex((mode) => mode.id === saved.mode),
      );
      const id = saved.mode === 'story' ? saved.case : saved.theme;
      this.caseIndex = Math.max(
        0,
        this.choices().findIndex((choice) => choice.id === id),
      );
    }

    choices() {
      if (this.modeIndex !== 0) {
        return AM.arenas.map((arena) => ({ ...arena, ch: AM.byId[MODE[this.modeIndex].id] }));
      }
      return AM.cases
        .filter((chapter) => chapter.kind === 'story')
        .map((chapter) => ({
          id: chapter.amId,
          title: chapter.title,
          description: chapter.summary || chapter.description || chapter.intro?.[0] || '',
          color: chapter.color,
          ch: chapter,
        }));
    }

    selected() {
      const choice = this.choices()[this.caseIndex] || this.choices()[0];
      const hero = AM.heroes[this.heroIndex];
      const chapter = choice.ch;
      const themes = { dead_air: 'rooftops', undertow: 'harbour', glass_archive: 'museum' };
      const theme = this.modeIndex === 0 ? chapter.theme || themes[chapter.amId] : choice.id;
      const run = AM.config({ hero: hero.id, theme }, chapter);
      const slot = AM.slot(chapter.amId, run);
      return {
        hero,
        choice,
        ch: chapter,
        run,
        slot,
        checkpoint: AM.data.checkpoints[slot],
        record: AM.data.records[slot],
      };
    }

    saveSelection() {
      const saved = AM.data.selection;
      const selected = this.selected();
      saved.hero = selected.hero.id;
      saved.mode = MODE[this.modeIndex].id;
      if (this.modeIndex === 0) saved.case = selected.ch.amId;
      else saved.theme = selected.choice.id;
      AM.write();
      this.buildMenu();
    }

    pick(row, index) {
      if (row === 0) this.heroIndex = (index + AM.heroes.length) % AM.heroes.length;
      if (row === 1) {
        this.modeIndex = (index + MODE.length) % MODE.length;
        this.caseIndex = 0;
      }
      if (row === 2) this.caseIndex = (index + this.choices().length) % this.choices().length;
      this.focus = row;
      DM.Audio.play('ui_move');
      this.saveSelection();
    }

    showStep(step) {
      this.step = step;
      this.focus = step === 'hero' ? 0 : 1;
      this.menu = null;
      this.buildMenu();
      I.clearAll();
    }

    back() {
      if (this.step === 'cases') this.showStep('hero');
      else E.set(new DM.Scenes.Title());
    }

    buildMenu() {
      const selected = this.selected();
      const items = [];
      if (this.step === 'hero') {
        items.push({ label: 'CHOOSE A CASE OR MODE', action: () => this.showStep('cases') });
      } else {
        if (selected.checkpoint) {
          const stage = selected.ch.stages[selected.checkpoint.stage];
          items.push({
            label: 'RESUME · ' + (stage.label || 'CHECKPOINT'),
            action: () => AM.start(selected.ch.amId, { ...selected.run, resume: true }),
          });
        }
        const label = selected.checkpoint
          ? 'RESTART CASE'
          : this.modeIndex === 0
            ? 'OPEN CASE FILE'
            : 'START THIS RUN';
        items.push({
          label,
          action: () => {
            const start = () => AM.start(selected.ch.amId, selected.run);
            if (selected.checkpoint) E.push(new ConfirmRestart(selected, start));
            else start();
          },
        });
      }
      items.push({
        label: 'HERO CONTROLS & TACTICS',
        action: () => E.push(new GearScreen(selected.hero)),
      });
      items.push({ label: 'BACK UP / RESTORE PROGRESS', action: () => E.push(new BackupScreen()) });
      if (this.step === 'cases') {
        items.push({ label: 'CHANGE HERO', action: () => this.showStep('hero') });
      }
      items.push({ label: 'BACK TO THE MAIN GAME', action: () => E.set(new DM.Scenes.Title()) });
      const previous = this.menu?.sel || 0;
      this.menu = new DM.UI.Menu(items, {
        x: 780,
        y: this.step === 'hero' ? 522 : 505,
        w: 435,
        itemH: this.step === 'hero' ? 35 : 29,
        size: 16,
        accent: selected.hero.color,
        onBack: () => this.back(),
      });
      this.menu.sel = Math.min(previous, items.length - 1);
    }

    heroRect(index) {
      return { x: 64 + index * 386, y: 122, w: 372, h: 370 };
    }

    modeRect(index) {
      return { x: 64 + index * 386, y: 228, w: 372, h: 52 };
    }

    caseRect(index) {
      return { x: 64 + index * 386, y: 306, w: 372, h: 178 };
    }

    update(dt) {
      this.t += dt;
      const mouse = I.mouse;
      if (I.clicked()) {
        const rows =
          this.step === 'hero'
            ? [[0, AM.heroes.length, (index) => this.heroRect(index)]]
            : [
                [1, MODE.length, (index) => this.modeRect(index)],
                [2, this.choices().length, (index) => this.caseRect(index)],
              ];
        for (const [row, count, rect] of rows) {
          for (let index = 0; index < count; index++) {
            if (!inside(mouse, rect(index))) continue;
            I.consume('confirm');
            this.pick(row, index);
            return;
          }
        }
        if (this.menu.hit(mouse.x, mouse.y) >= 0) this.focus = 3;
      }
      if (I.pressed('back')) {
        I.consume('back');
        this.back();
        return;
      }
      if (I.pressed('mute')) DM.Audio.toggleMute();
      if (this.focus === 3) {
        if (I.pressed('menuUp') && this.menu.sel === 0) {
          I.consume('menuUp');
          this.focus = this.step === 'hero' ? 0 : 2;
          return;
        }
        this.menu.update(dt);
        return;
      }
      if (I.pressed('menuLeft') || I.pressed('menuRight')) {
        const index = [this.heroIndex, this.modeIndex, this.caseIndex][this.focus];
        this.pick(this.focus, index + (I.pressed('menuRight') ? 1 : -1));
      }
      if (this.step === 'hero') {
        if (I.pressed('menuDown')) this.focus = 3;
        if (I.pressed('confirm')) {
          I.consume('confirm');
          this.showStep('cases');
        }
      } else {
        if (I.pressed('menuUp')) this.focus = Math.max(1, this.focus - 1);
        if (I.pressed('menuDown')) this.focus = Math.min(3, this.focus + 1);
        if (I.pressed('confirm')) {
          I.consume('confirm');
          this.focus = Math.min(3, this.focus + 1);
        }
      }
    }

    renderHeroChoice(g, selected) {
      AM.heroes.forEach((hero, index) => {
        const rect = this.heroRect(index);
        const chosen = index === this.heroIndex;
        panel(g, rect, chosen, hero.color);
        const look =
          typeof hero.look === 'string' ? DM.LOOKS[hero.look] : hero.look || DM.LOOKS[hero.id];
        G.portrait(g, rect.x + 58, rect.y + 22, 256, look, this.t);
        G.text(g, hero.name.toUpperCase(), rect.x + rect.w / 2, rect.y + 317, {
          size: 28,
          weight: 600,
          align: 'center',
          color: chosen ? '#f5ebd4' : '#b9cad0',
          spacing: 1,
        });
        G.text(g, HERO_STYLE[hero.id], rect.x + rect.w / 2, rect.y + 348, {
          size: 14,
          align: 'center',
          color: hero.color,
        });
      });
      G.panel(g, 64, 516, 690, 148, { accent: selected.hero.color });
      G.text(g, 'CHOOSE A MASK. THE CITY IS WAITING.', 84, 550, {
        size: 21,
        color: '#e6ddc9',
        spacing: 1,
      });
      G.text(g, 'Every hero can play every case and mode.', 84, 586, {
        size: 16,
        color: '#adc0cc',
      });
      G.text(g, 'Open the field manual for the six gear actions.', 84, 621, {
        size: 15,
        color: '#adc0cc',
      });
    }

    renderCases(g, selected) {
      G.panel(g, 64, 106, 1154, 96, { accent: selected.hero.color });
      const look =
        typeof selected.hero.look === 'string'
          ? DM.LOOKS[selected.hero.look]
          : selected.hero.look || DM.LOOKS[selected.hero.id];
      G.portrait(g, 82, 117, 72, look, this.t);
      G.text(g, selected.hero.name.toUpperCase(), 179, 147, {
        size: 28,
        weight: 600,
        color: '#efe4cf',
        spacing: 2,
      });
      G.text(g, HERO_STYLE[selected.hero.id], 179, 178, { size: 16, color: selected.hero.color });
      G.text(g, 'CHANGE HERO BELOW', 1195, 147, {
        size: 13,
        align: 'right',
        color: '#adc0cc',
        spacing: 1,
      });
      MODE.forEach((mode, index) => {
        const rect = this.modeRect(index);
        panel(g, rect, index === this.modeIndex, selected.hero.color);
        G.text(g, mode.name, rect.x + 18, rect.y + 33, {
          size: 20,
          spacing: 2,
          weight: 600,
          color: index === this.modeIndex ? '#efe4cf' : '#8fa5b4',
        });
        if (this.focus === 1 && index === this.modeIndex) {
          G.text(g, '‹  ›', rect.x + rect.w - 15, rect.y + 33, {
            size: 17,
            align: 'right',
            color: selected.hero.color,
          });
        }
      });
      this.choices().forEach((choice, index) => {
        const rect = this.caseRect(index);
        panel(g, rect, index === this.caseIndex, selected.hero.color);
        G.text(
          g,
          String(index + 1).padStart(2, '0') + '  ' + choice.title.toUpperCase(),
          rect.x + 17,
          rect.y + 34,
          {
            size: 22,
            weight: 600,
            color: '#e6ddc9',
          },
        );
        G.paragraph(g, choice.description, rect.x + 17, rect.y + 57, rect.w - 34, 23, {
          size: 15,
          font: DM.FONTS.type,
          color: '#adc0cc',
        });
        const run = AM.config(
          { hero: selected.hero.id, theme: this.modeIndex ? choice.id : choice.ch.theme },
          choice.ch,
        );
        const record = AM.data.records[AM.slot(choice.ch.amId, run)];
        let label = 'AVAILABLE FROM THE START';
        if (record) {
          if (this.modeIndex === 0) {
            label =
              (record.completed ? 'CASE CLOSED · BEST ' : 'PERSONAL BEST ') +
              Math.round(record.bestScore);
          } else if (this.modeIndex === 1) {
            label = 'BEST ' + Math.round(record.bestScore) + ' · WAVE ' + record.bestWave;
          } else {
            label =
              'BEST ' + Math.round(record.bestScore) + ' · ' + record.bestRescued + ' / 4 RESCUED';
          }
        } else if (this.focus === 2 && index === this.caseIndex)
          label = '‹  CHOOSE THIS LOCATION  ›';
        G.text(g, label, rect.x + 17, rect.y + 157, {
          size: 13,
          spacing: 1,
          color: selected.hero.color,
        });
      });
      G.panel(g, 64, 505, 690, 159, { accent: selected.hero.color });
      G.text(g, MODE[this.modeIndex].name, 84, 540, {
        size: 23,
        spacing: 2,
        color: selected.hero.color,
      });
      G.paragraph(g, MODE[this.modeIndex].description, 84, 558, 646, 25, {
        size: 17,
        font: DM.FONTS.type,
        color: '#b9ced8',
      });
      const hint =
        this.modeIndex === 0
          ? 'Checkpoints are separate for each hero and case.'
          : 'Each challenge starts a fresh wave or timer.';
      G.text(g, hint, 84, 638, { size: 14, color: '#adc0cc' });
    }

    render(g) {
      backdrop(g, this.t);
      const selected = this.selected();
      G.text(g, 'AFTER MIDNIGHT', 64, 77, {
        size: 40,
        weight: 700,
        spacing: 6,
        color: '#eee3cc',
      });
      const title =
        this.step === 'hero' ? '1 / 2 · CHOOSE YOUR HERO' : '2 / 2 · CHOOSE A CASE OR MODE';
      G.text(g, title, 1202, 76, {
        size: 14,
        align: 'right',
        spacing: 2,
        color: '#a9bdc5',
      });
      if (this.step === 'hero') this.renderHeroChoice(g, selected);
      else this.renderCases(g, selected);
      const selection = this.menu.sel;
      if (this.focus !== 3) this.menu.sel = -1;
      this.menu.render(g);
      this.menu.sel = selection;
      const hint =
        this.step === 'hero'
          ? '← → CHOOSE HERO · ENTER CONTINUES · ↓ ACTIONS · ESC MAIN GAME'
          : '↑ ↓ ROW · ← → CHOOSE · ENTER NEXT / START · ESC CHANGE HERO';
      G.text(g, AM.available ? hint : 'SESSION ONLY · EXPORT A BACKUP BEFORE CLOSING', 640, 694, {
        size: 13,
        align: 'center',
        spacing: 1,
        color: AM.available ? '#8ba1b0' : '#efb47a',
      });
    }
  }

  class ConfirmRestart {
    constructor(selected, start) {
      this.selected = selected;
      this.start = start;
      this.opaque = false;
      this.cursor = 'pointer';
    }
    enter() {
      this.menu = new DM.UI.Menu(
        [
          { label: 'KEEP MY CHECKPOINT', action: () => E.pop() },
          {
            label: 'RESTART THIS CASE',
            action: () => {
              E.pop();
              this.start();
            },
          },
        ],
        { x: 640, y: 377, w: 500, itemH: 48, align: 'center', onBack: () => E.pop() },
      );
    }
    update(dt) {
      this.menu.update(dt);
    }
    render(g) {
      g.fillStyle = 'rgba(2,6,12,0.91)';
      g.fillRect(0, 0, DM.W, DM.H);
      G.text(g, 'RESTART THIS CASE?', 640, 245, {
        size: 42,
        align: 'center',
        color: '#efdfbc',
        spacing: 5,
      });
      G.paragraph(
        g,
        'This replaces the checkpoint for ' +
          this.selected.hero.name +
          ' in ' +
          this.selected.ch.title +
          '. Other heroes and cases keep their progress.',
        640,
        286,
        720,
        25,
        { size: 18, align: 'center', font: DM.FONTS.type, color: '#b4c7d0' },
      );
      this.menu.render(g);
    }
  }
  class GearScreen {
    constructor(hero) {
      this.hero = hero;
      this.opaque = false;
      this.cursor = 'pointer';
    }
    update() {
      if (I.pressed('confirm') || I.pressed('back') || I.pressed('pause')) {
        I.clearAll();
        E.pop();
      }
    }
    render(g) {
      g.fillStyle = 'rgba(3,8,16,0.97)';
      g.fillRect(0, 0, DM.W, DM.H);
      G.text(g, this.hero.name.toUpperCase() + ' · FIELD MANUAL', 640, 85, {
        size: 39,
        align: 'center',
        spacing: 4,
        color: this.hero.color,
      });
      G.text(
        g,
        'WASD / ARROWS MOVE · MOUSE AIMS · E INTERACTS · ESC PAUSES · H RECALLS THE HINT',
        640,
        125,
        { size: 13, align: 'center', color: '#b5cbd4', spacing: 1 },
      );
      this.hero.abilities.forEach((ability, i) => {
        const x = 90 + (i % 2) * 570,
          y = 166 + Math.floor(i / 2) * 143;
        G.panel(g, x, y, 530, 126, { accent: this.hero.color });
        G.text(g, ability.key + ' · ' + ability.name.toUpperCase(), x + 18, y + 32, {
          size: 22,
          color: '#efe2ca',
        });
        G.paragraph(g, ability.desc, x + 18, y + 48, 493, 21, {
          size: 15,
          font: DM.FONTS.type,
          color: '#aec4cf',
        });
      });
      G.text(
        g,
        'These heroes are human. Use cover, mobility and nonlethal tools. ESC / ENTER RETURNS.',
        640,
        658,
        { size: 14, align: 'center', color: '#b5cbd4' },
      );
    }
  }
  class BackupScreen {
    constructor() {
      this.opaque = false;
      this.cursor = 'pointer';
    }
    enter() {
      I.clearAll();
      const root = document.createElement('div');
      this.root = root;
      root.id = 'after-midnight-backup';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'After Midnight progress backup');
      root.style.cssText =
        'position:fixed;inset:0;z-index:10;display:grid;place-items:center;background' +
        ':#030810ef;color:#e8dfca;font:16px/1.6 system-ui;overflow:auto';
      const card = document.createElement('section');
      card.style.cssText =
        'width:min(86vw,620px);padding:28px;background:#101f2c;border:1px solid #a38a5c';
      const title = document.createElement('h2');
      title.textContent = 'AFTER MIDNIGHT BACKUP';
      const note = document.createElement('p');
      note.textContent =
        'Export before restoring. Restore replaces After Midnight records only. Your ' +
        'original campaign, bonus adventures and settings are untouched.';
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.style.minHeight = '55px';
      const button = (text, action) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.type = 'button';
        b.style.cssText =
          'display:block;width:100%;padding:13px;margin:12px 0;background:#203d50;borde' +
          'r:1px solid #8196a2;color:#f1e4c8;font:600 15px system-ui;cursor:pointer';
        b.onclick = action;
        return b;
      };
      const exportButton = button('EXPORT PROGRESS', () => {
        try {
          const url = URL.createObjectURL(new Blob([AM.encode()], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = 'after-midnight-progress.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          status.textContent = 'Keep the downloaded JSON file with your game.';
        } catch (error) {
          status.textContent = error.message;
        }
      });
      const label = document.createElement('label');
      label.textContent = 'Choose an After Midnight backup to preview: ';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      label.append(input);
      let pending = null,
        selection = 0;
      const restore = button('RESTORE THIS PROGRESS', () => {
        if (!pending) return;
        try {
          const count = AM.restore(pending);
          status.textContent = 'Restored ' + count + ' case record(s).';
          pending = null;
          restore.disabled = true;
          back.focus();
        } catch (error) {
          status.textContent = error.message;
        }
      });
      restore.disabled = true;
      input.onchange = async () => {
        const request = ++selection;
        pending = null;
        restore.disabled = true;
        const file = input.files[0];
        if (!file) return;
        try {
          if (file.size > 256 * 1024) throw new Error('The backup is too large.');
          const text = await file.text();
          if (!root.isConnected || request !== selection) return;
          const packet = JSON.parse(text);
          if (packet.format !== 'dr-manhattan-after-midnight' || packet.version !== 1)
            throw new Error('Choose an After Midnight backup.');
          const data = AM.sanitize(packet.data);
          const count = Object.keys(data.records).length + Object.keys(data.checkpoints).length;
          if (!count) throw new Error('This backup has no progress records.');
          pending = text;
          restore.disabled = false;
          status.textContent =
            count + ' case record(s) ready. Press Restore to replace your After Midnight progress.';
        } catch (error) {
          if (root.isConnected && request === selection) status.textContent = error.message;
        }
      };
      const close = () => {
        I.clearAll();
        E.pop();
        E.canvas.focus({ preventScroll: true });
      };
      const back = button('BACK TO THE CASE BOARD', close);
      this.keydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else if (event.key === 'Tab') {
          const focus = [...card.querySelectorAll('button,input')].filter((node) => !node.disabled);
          const i = focus.indexOf(document.activeElement);
          if (event.shiftKey && i <= 0) {
            event.preventDefault();
            focus.at(-1).focus();
          } else if (!event.shiftKey && (i < 0 || i === focus.length - 1)) {
            event.preventDefault();
            focus[0].focus();
          }
          event.stopPropagation();
        } else event.stopPropagation();
      };
      // A disabled Restore button can send focus to the body. The modal still
      // owns Escape/Tab there, rather than forwarding them into the game.
      document.addEventListener('keydown', this.keydown, true);
      card.append(title, note, exportButton, label, restore, status, back);
      root.append(card);
      document.body.append(root);
      exportButton.focus();
    }
    exit() {
      document.removeEventListener('keydown', this.keydown, true);
      this.root?.remove();
    }
    update() {}
    render() {}
  }
  DM.Scenes.AfterMidnightMenu = CaseBoard;
  AM.GearScreen = GearScreen;
  AM.BackupScreen = BackupScreen;
})();
