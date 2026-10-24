/* Optional adventures. Separate registry and save slot: never advance the main story. */
(function() {
  'use strict';
  const DM = window.DM, G = DM.Gfx, U = DM.U, E = DM.Engine, I = DM.Input;
  const KEY = 'dr-manhattan.bonus.v1';
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const fresh = () => ({
    version: 1, checkpoints: {}, completed: {}, deaths: 0
  });
  const Bonus = {
    list: [], data: null, available: true,
    register(ch) {
      ch.bonus = true;
      ch.index = 0;
      ch.startPowers = [
        'telekinesis',
        'disintegrate',
        'teleport',
        'duplicate',
        'timesight',
        'expand'
      ];
      this.list.push(ch);
      DM.Chapters.byId[ch.id] = ch;
      return ch;
    },
    load() {
      if (this.data)
        return this.data;
      this.data = fresh();
      try {
        const d = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (d && d.version === 1) {
          for (const ch of this.list) {
            const cp = d.checkpoints && d.checkpoints[ch.id];
            if (cp && Number.isInteger(cp.stage) && cp.stage >= 0 && cp.stage < ch.stages.length) {
              const stats = {}, flags = {}, src = cp.carry || {};
              for (const k of ['time', 'spared', 'disintegrated', 'memories'])
                stats[k] = Number.isFinite(src.stats && src.stats[k]) ? Math.max(0, src.stats[k]) : 0;
              for (const k of ch.persistFlags || [])
                if (src.flags && ['number', 'boolean', 'string'].includes(typeof src.flags[k]))
                  flags[k] = src.flags[k];
              this.data.checkpoints[ch.id] = {
                stage: cp.stage, carry: {
                  stats, flags, found: []
                }
              };
            }
            const c = d.completed && d.completed[ch.id];
            if (c && typeof c === 'object')
              this.data.completed[ch.id] = c;
          }
          this.data.deaths = Number.isFinite(d.deaths) ? Math.max(0, d.deaths) : 0;
        }
      }
      catch (_) {
        /* A corrupt/blocked bonus slot cannot damage the campaign. */
      }
      return this.data;
    },
    write() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      }
      catch (_) {
        this.available = false;
      }
    },
    checkpointAt(id, stage, carry) {
      this.load().checkpoints[id] = {
        stage, carry: carry ? copy(carry) : null
      };
      this.write();
    },
    death() {
      this.load().deaths++;
      this.write();
    },
    start(id, resume) {
      this.selectedId = id;
      const cp = resume && this.load().checkpoints[id];
      I.clearAll();
      if (cp)
        E.fadeTo(() => E.set(new DM.Scenes.Play(), {
          chapter: id, stage: cp.stage, carry: cp.carry
        }));
      else
        E.fadeTo(() => E.set(new DM.Scenes.Interlude(id)));
    },
    complete(play) {
      const record = {
        stats: copy(play.ctx.stats), flags: play.ctx.persistedFlags()
      };
      this.load().completed[play.chapter.id] = record;
      delete this.data.checkpoints[play.chapter.id];
      this.write();
      DM.Challenge.clear(play.chapter.id);
      E.push(play.chapter.bonusComplete ? new play.chapter.bonusComplete(play, record) : new BonusComplete(play, record));
    },
  };
  function city(ctx, t, x = 0, y = 0, w = DM.W, h = DM.H) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#090e1b');
    sky.addColorStop(0.65, '#213044');
    sky.addColorStop(1, '#3f3831');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    const rnd = U.seeded(1976);
    for (let layer = 0; layer < 3; layer++) {
      for (let bx = x - 20; bx < x + w; bx += 58) {
        const bh = 55 + rnd() * (110 + layer * 55), by = y + h - bh + layer * 18;
        ctx.fillStyle = ['#25303a', '#17222e', '#0c1521'][layer];
        ctx.fillRect(bx, by, 54, bh);
        for (let wy = by + 12; wy < y + h; wy += 17)
          for (let wx = bx + 8; wx < bx + 48; wx += 12) {
            if (rnd() > 0.55) {
              ctx.fillStyle = rnd() > 0.8 ? '#698c9b' : '#a88c56';
              ctx.globalAlpha = 0.3 + rnd() * 0.35;
              ctx.fillRect(wx, wy, 4, 6);
            }
          }
        ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = 'rgba(166,199,221,0.19)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 85; i++) {
      const rx = x + ((i * 79.7 - t * 51) % w + w) % w, ry = y + ((i * 63.7 + t * 270) % h);
      G.line(ctx, rx, ry, rx - 8, ry + 18);
    }
    ctx.restore();
  }
  Bonus.city = city;
  // The selector uses the same canvas/menu widgets as the original game. Each
  // adventure owns its metadata and checkpoints; selecting one never starts it.
  class BonusMenu {
    constructor() {
      this.cursor = 'pointer';
      this.t = 0;
    }
    enter() {
      Bonus.load();
      this.selected = Math.max(0, Bonus.list.findIndex(c => c.id === Bonus.selectedId));
      if (!Bonus.selectedId)
        this.selected = Math.max(0, Bonus.list.length - 1);
      this.select(this.selected);
    }
    select(index) {
      this.selected = (index + Bonus.list.length) % Bonus.list.length;
      this.chapter = Bonus.list[this.selected];
      Bonus.selectedId = this.chapter.id;
      const ch = this.chapter, cp = Bonus.load().checkpoints[ch.id];
      const items = [];
      if (cp)
        items.push({
          label: 'RESUME ADVENTURE', action: () => Bonus.start(ch.id, true)
        });
      items.push({
        label: cp ? 'RESTART ADVENTURE' : 'PLAY ' + ch.title.toUpperCase(), action: () => Bonus.start(ch.id, false)
      });
      items.push({
        label: 'CONTROLS', action: () => E.push(new DM.Scenes.Controls())
      });
      items.push({
        label: 'BACK TO THE MAIN GAME', action: () => E.set(new DM.Scenes.Title())
      });
      this.menu = new DM.UI.Menu(items, {
        x: 85, y: 480, w: 620, itemH: 40, size: 21, accent: ch.menuAccent || '#e3ba68', onBack: () => E.set(new DM.Scenes.Title())
      });
      DM.Audio.music.play(ch.music || 'bonus_noir');
    }
    cardRect(i) {
      return {
        x: 67 + i * 582, y: 112, w: 564, h: 58
      };
    }
    update(dt) {
      this.t += dt;
      if (I.pressed('menuLeft')) {
        this.select(this.selected - 1);
        DM.Audio.play('ui_move');
      }
      if (I.pressed('menuRight')) {
        this.select(this.selected + 1);
        DM.Audio.play('ui_move');
      }
      if (I.clicked()) {
        const m = I.mouse;
        for (let j = 0; j < Bonus.list.length; j++) {
          const r = this.cardRect(j);
          if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
            I.consume('confirm');
            this.select(j);
            DM.Audio.play('ui_select');
            return;
          }
        }
      }
      this.menu.update(dt);
      if (I.pressed('mute'))
        DM.Audio.toggleMute();
    }
    render(ctx) {
      const ch = this.chapter, second = ch.id !== 'last_broadcast', accent = ch.menuAccent || '#e3ba68';
      if (ch.menuBackdrop)
        ch.menuBackdrop(ctx, this.t);
      else
        city(ctx, this.t);
      ctx.fillStyle = 'rgba(3,7,14,0.84)';
      ctx.fillRect(44, 36, 1192, 650);
      ctx.strokeStyle = 'rgba(180,197,195,0.28)';
      ctx.strokeRect(44, 36, 1192, 650);
      G.text(ctx, 'BONUS LEVELS', 82, 82, {
        size: 20, spacing: 6, color: accent, weight: 600
      });
      G.text(ctx, 'CLICK AN ADVENTURE  ·  OR USE LEFT / RIGHT', 1194, 80, {
        size: 12, spacing: 1, align: 'right', color: '#a7b7c5'
      });
      Bonus.list.forEach((c, i) => {
        const r = this.cardRect(i), chosen = i === this.selected;
        ctx.fillStyle = chosen ? 'rgba(118,183,197,0.14)' : 'rgba(125,144,162,0.05)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = chosen ? accent : 'rgba(151,167,181,0.28)';
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        G.text(ctx, ('0' + (i + 1)).slice(-2), r.x + 19, r.y + 36, {
          size: 18, color: chosen ? accent : '#758999'
        });
        G.text(ctx, c.title.toUpperCase(), r.x + 60, r.y + 36, {
          size: 22, spacing: 2, weight: chosen ? 600 : 400, color: chosen ? '#f0eadc' : '#97aebb'
        });
        if (Bonus.data.completed[c.id])
          G.text(ctx, '✓', r.x + r.w - 25, r.y + 36, {
            size: 20, align: 'center', color: accent
          });
      });
      const title = ch.menuTitle || ['THE LAST', 'BROADCAST'];
      G.text(ctx, title[0], 86, 244, {
        size: 53, color: '#eee4cb', weight: 700, spacing: 3
      });
      G.text(ctx, title[1], 86, 303, {
        size: 53, color: '#eee4cb', weight: 700, spacing: 3
      });
      G.text(ctx, (ch.menuLocation || 'NEW YORK · 1976') + ' · A STANDALONE SIDE STORY', 89, 337, {
        size: 12, spacing: 1.6, color: '#b9c9d8'
      });
      G.paragraph(ctx, ch.menuSummary || 'A stolen transmitter. Three missing engineers. One voice promising to turn the whole ' +
        'city against itself.', 89, 362, 618, 24, {
        size: 18, font: DM.FONTS.type, color: '#e0ded6'
      });
      G.paragraph(ctx, ch.menuBrief || 'Join Nite Owl and Rorschach. Find the hostages, break the signal, and decide what the ' +
        'city gets to hear.', 89, 427, 618, 23, {
        size: 16, font: DM.FONTS.type, color: '#b7c9d5'
      });
      this.menu.render(ctx);
      const cast = ch.menuCast || ['niteowl', 'rorschach'];
      cast.forEach((id, i) => {
        G.portrait(ctx, 810 + i * 185, 218, 144, DM.LOOKS[id], this.t);
        G.text(ctx, (DM.LOOKS[id].name || id).toUpperCase(), 882 + i * 185, 392, {
          size: 15, align: 'center', spacing: 1.5, color: accent
        });
      });
      if (ch.menuEmblem)
        ch.menuEmblem(ctx, 978, 515, this.t);
      else
        G.hydrogen(ctx, 978, 515, 65, '#79d9fa', this.t * 0.3, 3);
      G.text(ctx, ch.menuTagline || 'SOME NIGHTS NEVER MAKE THE PAPERS.', 977, 629, {
        size: 11, align: 'center', spacing: 1.4, color: '#dad4c3'
      });
      G.text(ctx, 'ALL POWERS AVAILABLE · EACH ADVENTURE SAVES SEPARATELY', 88, 660, {
        size: 11, spacing: 1.5, color: '#b5ad99'
      });
      G.postFx(ctx);
    }
  }
  class BonusComplete {
    constructor(play, record) {
      this.play = play;
      this.record = record;
      this.t = 0;
      this.cursor = 'pointer';
    }
    enter() {
      DM.Audio.stopHums();
      DM.Audio.play('success');
      DM.Audio.music.play('reflect');
      this.menu = new DM.UI.Menu([
        {
          label: 'RETURN TO BONUS LEVELS', action: () => E.fadeTo(() => E.set(new BonusMenu()))
        },
        {
          label: 'PLAY AGAIN · TRY THE OTHER CHOICE', action: () => Bonus.start(this.play.chapter.id, false)
        },
      ], {
        x: DM.W / 2, y: 550, w: 590, align: 'center', size: 21, itemH: 48
      });
    }
    update(dt) {
      this.t += dt;
      if (this.t > 1)
        this.menu.update(dt);
    }
    render(ctx) {
      city(ctx, this.t);
      ctx.fillStyle = 'rgba(4,8,16,0.9)';
      ctx.fillRect(100, 55, 1080, 610);
      const f = this.record.flags, s = this.record.stats;
      G.text(ctx, 'BONUS ADVENTURE COMPLETE', 640, 119, {
        size: 16, spacing: 6, align: 'center', color: '#e2bc70'
      });
      G.text(ctx, 'THE LAST BROADCAST', 640, 194, {
        size: 47, spacing: 3, align: 'center', weight: 700, color: '#edf2ed'
      });
      const line = f.choice === 'broadcast'
        ? (f.evidence === 7 ? 'By morning, every newsroom has the whole story. The city wakes to names, not rumours.' :
          'A fragment of the truth makes it onto the air. Enough to start questions. Not enough to finish them.')
        : 'The transmitter falls silent. Three people go home. The names behind the machine ' + 'disappear with its signal.';
      G.paragraph(ctx, line, 250, 238, 780, 29, {
        size: 22, font: DM.FONTS.type, color: '#dedacf'
      });
      G.text(ctx, 'ENGINEERS RESCUED', 620, 369, {
        size: 17, align: 'right', spacing: 2, color: '#afbdcb'
      });
      G.text(ctx, '3 / 3', 652, 369, {
        size: 21, color: '#7fdcff'
      });
      const count = [1, 2, 4].filter(b => (f.evidence || 0) & b).length;
      G.text(ctx, 'EVIDENCE RECOVERED', 620, 409, {
        size: 17, align: 'right', spacing: 2, color: '#afbdcb'
      });
      G.text(ctx, `${count} / 3`, 652, 409, {
        size: 21, color: '#e2bc70'
      });
      G.text(ctx, 'PEOPLE SPARED / UNMADE', 620, 449, {
        size: 17, align: 'right', spacing: 2, color: '#afbdcb'
      });
      G.text(ctx, `${s.spared} / ${s.disintegrated}`, 652, 449, {
        size: 21, color: '#f3e9d3'
      });
      G.text(ctx, 'Your main story and its ending have not been changed.', 640, 505, {
        size: 15, align: 'center', font: DM.FONTS.type, color: '#91a4b3'
      });
      this.menu.render(ctx);
      G.postFx(ctx);
    }
  }
  DM.Bonus = Bonus;
  DM.Scenes.BonusMenu = BonusMenu;
  DM.Scenes.BonusComplete = BonusComplete;
})();
