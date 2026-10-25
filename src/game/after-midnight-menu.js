/* The case board, character selection and portable progress for After Midnight. */
(function () {
  'use strict';
  const DM = window.DM, AM = DM.AfterMidnight, G = DM.Gfx, E = DM.Engine, I = DM.Input;
  const MODE = [
    { id: 'story', name: 'CASE FILES', description: 'Three connected investigations. Checkpoints remember your hero.' },
    { id: 'patrol', name: 'NIGHT PATROL', description: 'Survive waves, improve your gear, and choose when to extract.' },
    { id: 'rescue_clock', name: 'RESCUE CLOCK', description: 'Guide civilians to safety before the deadline. Every rescue buys time.' },
  ];
  const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  function panel(g, r, selected, color) {
    G.panel(g, r.x, r.y, r.w, r.h, { fill: selected ? 'rgba(28,48,62,0.96)' : 'rgba(6,13,23,0.88)', accent: selected ? color : 'rgba(136,161,178,0.26)' });
  }
  function backdrop(g, t) {
    DM.Scenes.backdrop(g, t, { mars: false });
    if (DM.Bonus?.city) { g.save(); g.globalAlpha = 0.32; DM.Bonus.city(g, t, 0, 210, DM.W, DM.H - 210); g.restore(); }
    g.fillStyle = 'rgba(2,7,13,0.57)'; g.fillRect(35, 25, 1210, 666);
  }
  class CaseBoard {
    constructor() { this.t = 0; this.cursor = 'pointer'; this.focus = 0; this.heroIndex = 0; this.caseIndex = 0; }
    enter() {
      const s = AM.load().selection;
      this.heroIndex = Math.max(0, AM.heroes.findIndex(h => h.id === s.hero));
      this.modeIndex = Math.max(0, MODE.findIndex(m => m.id === s.mode));
      this.caseIndex = Math.max(0, this.choices().findIndex(c => c.id === (s.mode === 'story' ? s.case : s.theme)));
      this.buildMenu(); DM.Audio.music.play('bonus_noir');
    }
    resume() { this.buildMenu(); }
    choices() {
      return this.modeIndex === 0 ? AM.cases.filter(ch => ch.kind === 'story').map(ch => ({ id: ch.amId, title: ch.title, description: ch.summary || ch.description || ch.intro?.[0] || '', color: ch.color, ch }))
        : AM.arenas.map(arena => ({ ...arena, ch: AM.byId[MODE[this.modeIndex].id] }));
    }
    selected() {
      const choice = this.choices()[this.caseIndex] || this.choices()[0];
      const hero = AM.heroes[this.heroIndex];
      const ch = choice.ch;
      const theme = this.modeIndex === 0 ? ch.theme || ({ dead_air: 'rooftops', undertow: 'harbour', glass_archive: 'museum' }[ch.amId]) : choice.id;
      const run = AM.config({ hero: hero.id, theme }, ch);
      const slot = AM.slot(ch.amId, run);
      return { hero, choice, ch, run, slot, checkpoint: AM.data.checkpoints[slot], record: AM.data.records[slot] };
    }
    saveSelection() {
      const s = AM.data.selection, selected = this.selected();
      s.hero = selected.hero.id; s.mode = MODE[this.modeIndex].id;
      if (this.modeIndex === 0) s.case = selected.ch.amId;
      else s.theme = selected.choice.id;
      AM.write(); this.buildMenu();
    }
    pick(row, index) {
      if (row === 0) this.heroIndex = (index + AM.heroes.length) % AM.heroes.length;
      if (row === 1) { this.modeIndex = (index + MODE.length) % MODE.length; this.caseIndex = 0; }
      if (row === 2) this.caseIndex = (index + this.choices().length) % this.choices().length;
      this.focus = row; DM.Audio.play('ui_move'); this.saveSelection();
    }
    buildMenu() {
      const s = this.selected(), items = [];
      if (s.checkpoint) items.push({ label: 'RESUME · ' + (s.ch.stages[s.checkpoint.stage].label || 'CHECKPOINT'), action: () => AM.start(s.ch.amId, { ...s.run, resume: true }) });
      items.push({ label: s.checkpoint ? 'RESTART CASE' : this.modeIndex === 0 ? 'OPEN CASE FILE' : 'START THIS RUN', action: () => {
        const start = () => AM.start(s.ch.amId, s.run);
        if (s.checkpoint) E.push(new ConfirmRestart(s, start)); else start();
      } });
      items.push({ label: 'HERO CONTROLS & TACTICS', action: () => E.push(new GearScreen(s.hero)) });
      items.push({ label: 'BACK UP / RESTORE PROGRESS', action: () => E.push(new BackupScreen()) });
      items.push({ label: 'BACK TO THE MAIN GAME', action: () => E.set(new DM.Scenes.Title()) });
      const previous = this.menu?.sel || 0;
      this.menu = new DM.UI.Menu(items, { x: 796, y: 497, w: 410, itemH: 34, size: 17, accent: s.hero.color,
        onBack: () => E.set(new DM.Scenes.Title()) });
      this.menu.sel = Math.min(previous, items.length - 1);
    }
    heroRect(i) { return { x: 64 + i * 386, y: 118, w: 372, h: 149 }; }
    modeRect(i) { return { x: 64 + i * 386, y: 285, w: 372, h: 43 }; }
    caseRect(i) { return { x: 64 + i * 386, y: 350, w: 372, h: 124 }; }
    update(dt) {
      this.t += dt;
      const m = I.mouse;
      if (I.clicked()) {
        for (const [row, count, rect] of [[0, AM.heroes.length, i => this.heroRect(i)], [1, MODE.length, i => this.modeRect(i)], [2, this.choices().length, i => this.caseRect(i)]]) {
          for (let i = 0; i < count; i++) if (inside(m, rect(i))) { I.consume('confirm'); this.pick(row, i); return; }
        }
        if (this.menu.hit(m.x, m.y) >= 0) this.focus = 3;
      }
      if (I.pressed('back')) { I.consume('back'); E.set(new DM.Scenes.Title()); return; }
      if (I.pressed('mute')) DM.Audio.toggleMute();
      if (this.focus < 3) {
        if (I.pressed('menuLeft') || I.pressed('menuRight')) {
          const index = [this.heroIndex, this.modeIndex, this.caseIndex][this.focus];
          this.pick(this.focus, index + (I.pressed('menuRight') ? 1 : -1));
        }
        if (I.pressed('menuUp')) this.focus = Math.max(0, this.focus - 1);
        if (I.pressed('menuDown')) this.focus++;
        if (I.pressed('confirm')) { I.consume('confirm'); this.focus = Math.min(3, this.focus + 1); }
      } else {
        if (I.pressed('menuUp') && this.menu.sel === 0) { I.consume('menuUp'); this.focus = 2; return; }
        this.menu.update(dt);
      }
    }
    render(g) {
      backdrop(g, this.t);
      const s = this.selected();
      G.text(g, 'AFTER MIDNIGHT', 64, 77, { size: 42, weight: 700, spacing: 6, color: '#eee3cc' });
      G.text(g, 'THREE MASKS. ONE CITY. A DIFFERENT KIND OF HERO.', 1202, 76, { size: 12, align: 'right', spacing: 2, color: '#a9bdc5' });
      AM.heroes.forEach((hero, i) => {
        const r = this.heroRect(i), selected = i === this.heroIndex;
        panel(g, r, selected, hero.color);
        const look = typeof hero.look === 'string' ? DM.LOOKS[hero.look] : hero.look || DM.LOOKS[hero.id];
        G.portrait(g, r.x + 15, r.y + 19, 87, look, this.t);
        G.text(g, hero.name.toUpperCase(), r.x + 115, r.y + 35, { size: 25, weight: 600, color: selected ? '#f5ebd4' : '#b9cad0', spacing: 1 });
        G.paragraph(g, hero.tagline || '', r.x + 115, r.y + 48, 236, 20, { size: 14, font: DM.FONTS.type, color: hero.color });
        G.paragraph(g, hero.description || '', r.x + 115, r.y + 91, 236, 19, { size: 13, font: DM.FONTS.type, color: '#b4c1ca' });
        if (this.focus === 0 && selected) G.text(g, '‹  CHOOSE YOUR HERO  ›', r.x + 15, r.y + 137, { size: 10, spacing: 1.5, color: hero.color });
      });
      MODE.forEach((mode, i) => {
        const r = this.modeRect(i); panel(g, r, i === this.modeIndex, s.hero.color);
        G.text(g, mode.name, r.x + 18, r.y + 28, { size: 20, spacing: 2, weight: 600, color: i === this.modeIndex ? '#efe4cf' : '#8fa5b4' });
        if (this.focus === 1 && i === this.modeIndex) G.text(g, '‹  ›', r.x + r.w - 15, r.y + 28, { size: 17, align: 'right', color: s.hero.color });
      });
      this.choices().forEach((choice, i) => {
        const r = this.caseRect(i); panel(g, r, i === this.caseIndex, s.hero.color);
        G.text(g, String(i + 1).padStart(2, '0') + '  ' + choice.title.toUpperCase(), r.x + 17, r.y + 31, { size: 23, weight: 600, color: '#e6ddc9' });
        G.paragraph(g, choice.description, r.x + 17, r.y + 46, r.w - 34, 19, { size: 13, font: DM.FONTS.type, color: '#adc0cc' });
        const run = AM.config({ hero: s.hero.id, theme: this.modeIndex ? choice.id : choice.ch.theme }, choice.ch);
        const record = AM.data.records[AM.slot(choice.ch.amId, run)];
        if (record) {
          const label = this.modeIndex === 0 ? (record.completed ? '✓ CASE CLOSED · BEST ' : 'PERSONAL BEST ') + Math.round(record.bestScore)
            : this.modeIndex === 1 ? 'BEST ' + Math.round(record.bestScore) + ' · WAVE ' + record.bestWave
              : 'BEST ' + Math.round(record.bestScore) + ' · ' + record.bestRescued + ' / 4 RESCUED';
          G.text(g, label, r.x + 17, r.y + 110, { size: 11, spacing: 1, color: s.hero.color });
        }
        else if (i === this.caseIndex) G.text(g, this.focus === 2 ? '‹  CHOOSE A LOCATION  ›' : 'AVAILABLE FROM THE START', r.x + 17, r.y + 110, { size: 10, spacing: 1.5, color: s.hero.color });
      });
      G.panel(g, 64, 494, 706, 170, { accent: s.hero.color });
      G.text(g, s.hero.name.toUpperCase() + ' · FIELD GEAR', 82, 517, { size: 13, spacing: 2, color: s.hero.color });
      (s.hero.abilities || []).forEach((ability, i) => {
        const x = 82 + (i >= 3 ? 350 : 0), y = 541 + i % 3 * 26;
        G.text(g, ability.key, x, y, { size: 13, color: '#f0dfb8' });
        G.text(g, ability.name, x + 68, y, { size: 16, color: '#b9ced8' });
      });
      G.paragraph(g, MODE[this.modeIndex].description, 82, 616, 665, 18, { size: 12, font: DM.FONTS.type, color: '#9cafbd' });
      const sel = this.menu.sel;
      if (this.focus !== 3) this.menu.sel = -1;
      this.menu.render(g); this.menu.sel = sel;
      G.text(g, AM.available ? '↑ ↓  ROW     ← →  CHOOSE     ENTER  NEXT / START     ESC  MAIN GAME'
        : 'SESSION ONLY · EXPORT A BACKUP BEFORE CLOSING', 640, 690, { size: 11, align: 'center', spacing: 2, color: AM.available ? '#8ba1b0' : '#efb47a' });
    }
  }
  class ConfirmRestart {
    constructor(selected, start) { this.selected = selected; this.start = start; this.opaque = false; this.cursor = 'pointer'; }
    enter() {
      this.menu = new DM.UI.Menu([{ label: 'KEEP MY CHECKPOINT', action: () => E.pop() }, { label: 'RESTART THIS CASE', action: () => { E.pop(); this.start(); } }],
        { x: 640, y: 377, w: 500, itemH: 48, align: 'center', onBack: () => E.pop() });
    }
    update(dt) { this.menu.update(dt); }
    render(g) {
      g.fillStyle = 'rgba(2,6,12,0.91)'; g.fillRect(0, 0, DM.W, DM.H);
      G.text(g, 'RESTART THIS CASE?', 640, 245, { size: 42, align: 'center', color: '#efdfbc', spacing: 5 });
      G.paragraph(g, 'This replaces the checkpoint for ' + this.selected.hero.name + ' in ' + this.selected.ch.title + '. Other heroes and cases keep their progress.', 640, 286, 720, 25, { size: 18, align: 'center', font: DM.FONTS.type, color: '#b4c7d0' });
      this.menu.render(g);
    }
  }
  class GearScreen {
    constructor(hero) { this.hero = hero; this.opaque = false; this.cursor = 'pointer'; }
    update() { if (I.pressed('confirm') || I.pressed('back') || I.pressed('pause')) { I.clearAll(); E.pop(); } }
    render(g) {
      g.fillStyle = 'rgba(3,8,16,0.97)'; g.fillRect(0, 0, DM.W, DM.H);
      G.text(g, this.hero.name.toUpperCase() + ' · FIELD MANUAL', 640, 85, { size: 39, align: 'center', spacing: 4, color: this.hero.color });
      G.text(g, 'WASD / ARROWS MOVE · MOUSE AIMS · E INTERACTS · ESC PAUSES · H RECALLS THE HINT', 640, 125, { size: 13, align: 'center', color: '#b5cbd4', spacing: 1 });
      this.hero.abilities.forEach((ability, i) => {
        const x = 90 + i % 2 * 570, y = 166 + Math.floor(i / 2) * 143;
        G.panel(g, x, y, 530, 126, { accent: this.hero.color });
        G.text(g, ability.key + ' · ' + ability.name.toUpperCase(), x + 18, y + 32, { size: 22, color: '#efe2ca' });
        G.paragraph(g, ability.desc, x + 18, y + 48, 493, 21, { size: 15, font: DM.FONTS.type, color: '#aec4cf' });
      });
      G.text(g, 'These heroes are human. Use cover, mobility and nonlethal tools. ESC / ENTER RETURNS.', 640, 658, { size: 14, align: 'center', color: '#b5cbd4' });
    }
  }
  class BackupScreen {
    constructor() { this.opaque = false; this.cursor = 'pointer'; }
    enter() {
      I.clearAll();
      const root = document.createElement('div'); this.root = root;
      root.id = 'after-midnight-backup'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'After Midnight progress backup');
      root.style.cssText = 'position:fixed;inset:0;z-index:10;display:grid;place-items:center;background:#030810ef;color:#e8dfca;font:16px/1.6 system-ui;overflow:auto';
      const card = document.createElement('section'); card.style.cssText = 'width:min(86vw,620px);padding:28px;background:#101f2c;border:1px solid #a38a5c';
      const title = document.createElement('h2'); title.textContent = 'AFTER MIDNIGHT BACKUP';
      const note = document.createElement('p'); note.textContent = 'Export before restoring. Restore replaces After Midnight records only. Your original campaign, bonus adventures and settings are untouched.';
      const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.style.minHeight = '55px';
      const button = (text, action) => { const b = document.createElement('button'); b.textContent = text; b.type = 'button'; b.style.cssText = 'display:block;width:100%;padding:13px;margin:12px 0;background:#203d50;border:1px solid #8196a2;color:#f1e4c8;font:600 15px system-ui;cursor:pointer'; b.onclick = action; return b; };
      const exportButton = button('EXPORT PROGRESS', () => {
        try { const url = URL.createObjectURL(new Blob([AM.encode()], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'after-midnight-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); status.textContent = 'Keep the downloaded JSON file with your game.'; }
        catch (error) { status.textContent = error.message; }
      });
      const label = document.createElement('label'); label.textContent = 'Choose an After Midnight backup to preview: ';
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; label.append(input);
      let pending = null, selection = 0;
      const restore = button('RESTORE THIS PROGRESS', () => {
        if (!pending) return;
        try { const count = AM.restore(pending); status.textContent = 'Restored ' + count + ' case record(s).'; pending = null; restore.disabled = true; back.focus(); }
        catch (error) { status.textContent = error.message; }
      });
      restore.disabled = true;
      input.onchange = async () => {
        const request = ++selection; pending = null; restore.disabled = true;
        const file = input.files[0]; if (!file) return;
        try {
          if (file.size > 256 * 1024) throw new Error('The backup is too large.');
          const text = await file.text(); if (!root.isConnected || request !== selection) return;
          const packet = JSON.parse(text);
          if (packet.format !== 'dr-manhattan-after-midnight' || packet.version !== 1) throw new Error('Choose an After Midnight backup.');
          const data = AM.sanitize(packet.data);
          const count = Object.keys(data.records).length + Object.keys(data.checkpoints).length;
          if (!count) throw new Error('This backup has no progress records.');
          pending = text; restore.disabled = false; status.textContent = count + ' case record(s) ready. Press Restore to replace your After Midnight progress.';
        } catch (error) { if (root.isConnected && request === selection) status.textContent = error.message; }
      };
      const close = () => { I.clearAll(); E.pop(); E.canvas.focus({ preventScroll: true }); };
      const back = button('BACK TO THE CASE BOARD', close);
      this.keydown = event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === 'Tab') {
          const focus = [...card.querySelectorAll('button,input')].filter(node => !node.disabled);
          const i = focus.indexOf(document.activeElement);
          if (event.shiftKey && i <= 0) { event.preventDefault(); focus.at(-1).focus(); }
          else if (!event.shiftKey && (i < 0 || i === focus.length - 1)) { event.preventDefault(); focus[0].focus(); }
          event.stopPropagation();
        } else event.stopPropagation();
      };
      // A disabled Restore button can send focus to the body. The modal still
      // owns Escape/Tab there, rather than forwarding them into the game.
      document.addEventListener('keydown', this.keydown, true);
      card.append(title, note, exportButton, label, restore, status, back); root.append(card); document.body.append(root); exportButton.focus();
    }
    exit() { document.removeEventListener('keydown', this.keydown, true); this.root?.remove(); }
    update() {}
    render() {}
  }
  DM.Scenes.AfterMidnightMenu = CaseBoard;
  AM.GearScreen = GearScreen; AM.BackupScreen = BackupScreen;
})();
