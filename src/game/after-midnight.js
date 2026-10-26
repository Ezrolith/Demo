/* Optional human-scale stories and challenges. Their progress never enters either existing save. */
(function () {
  'use strict';
  const DM = window.DM,
    E = DM.Engine,
    G = DM.Gfx;
  const AM = (DM.AfterMidnight = DM.AfterMidnight || {});
  const KEY = 'dr-manhattan.after-midnight.v1';
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const fresh = () => ({
    version: 1,
    selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
    checkpoints: {},
    records: {},
    deaths: 0,
  });
  const number = (value, fallback = 0) =>
    Number.isFinite(value) && value >= 0 && value <= 1e9 ? value : fallback;
  Object.assign(AM, {
    cases: [],
    byId: {},
    data: null,
    run: null,
    available: true,
    readOnly: false,
    warned: false,
  });

  AM.hero = (id) => AM.heroes.find((hero) => hero.id === id) || AM.heroes[0];
  AM.config = (source = {}, def) => ({
    hero: AM.hero(source.hero).id,
    theme:
      def?.kind === 'story' && def.theme
        ? def.theme
        : ['rooftops', 'harbour', 'museum'].includes(source.theme)
          ? source.theme
          : def?.theme || 'rooftops',
    mode: def?.kind || 'story',
    upgrades: Object.fromEntries(
      ['vitality', 'capacitor', 'mobility'].map((id) => [
        id,
        Math.min(3, Math.floor(number(source.upgrades?.[id]))),
      ]),
    ),
  });
  AM.slot = (id, run) => [id.replace(/^am_/, ''), run.hero, run.theme].join(':');
  AM.cleanCarry = (value, ch) => {
    if (!object(value)) return null;
    const stats = {};
    for (const id of ['time', 'spared', 'disintegrated', 'memories'])
      stats[id] = number(value.stats?.[id]);
    const flags = {};
    for (const id of ch.persistFlags || []) {
      const v = value.flags?.[id];
      if (
        typeof v === 'boolean' ||
        (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9) ||
        (typeof v === 'string' && v.length <= 512)
      )
        flags[id] = v;
    }
    return { stats, flags, found: [] };
  };
  AM.sanitize = (raw) => {
    if (!object(raw) || raw.version !== 1)
      throw new Error('This is not a compatible After Midnight save.');
    const out = fresh();
    if (object(raw.selection)) {
      const s = raw.selection;
      out.selection.hero = AM.hero(s.hero).id;
      out.selection.mode = ['story', 'patrol', 'rescue_clock'].includes(s.mode) ? s.mode : 'story';
      out.selection.case = AM.byId[s.case]?.kind === 'story' ? s.case : 'dead_air';
      out.selection.theme = ['rooftops', 'harbour', 'museum'].includes(s.theme)
        ? s.theme
        : 'rooftops';
    }
    for (const group of ['checkpoints', 'records'])
      for (const [key, value] of Object.entries(object(raw[group]) ? raw[group] : {})) {
        if (!object(value)) continue;
        const ch = AM.byId[value.caseId];
        if (!ch || !AM.heroes.some((hero) => hero.id === value.run?.hero)) continue;
        const run = AM.config(value.run, ch);
        if (key !== AM.slot(ch.amId, run)) continue;
        if (group === 'checkpoints') {
          if (
            ch.kind !== 'story' ||
            !Number.isInteger(value.stage) ||
            value.stage < 0 ||
            value.stage >= ch.stages.length
          )
            continue;
          out.checkpoints[key] = {
            caseId: ch.amId,
            run,
            stage: value.stage,
            carry: AM.cleanCarry(value.carry, ch),
          };
        } else {
          out.records[key] = {
            caseId: ch.amId,
            run,
            score: number(value.score),
            bestScore: number(value.bestScore),
            time: number(value.time),
            bestTime: number(value.bestTime),
            bestWave: Math.floor(number(value.bestWave)),
            bestRescued: Math.floor(number(value.bestRescued)),
            attempts: Math.floor(number(value.attempts)),
            completed: !!value.completed,
            everCompleted: !!(value.everCompleted || value.completed),
            modeResult: typeof value.modeResult === 'string' ? value.modeResult.slice(0, 80) : '',
            stats: AM.cleanCarry({ stats: value.stats, flags: value.flags }, ch).stats,
            flags: AM.cleanCarry({ stats: value.stats, flags: value.flags }, ch).flags,
          };
        }
      }
    out.deaths = Math.floor(number(raw.deaths));
    return out;
  };
  AM.storageFailure = () => {
    AM.available = false;
    const play = E.top()?.chapter?.afterMidnight ? E.top() : null;
    if (play?.hud && !AM.warned) {
      play.hud.toast(
        'AFTER MIDNIGHT IS SESSION ONLY · EXPORT A BACKUP FROM THE CASE BOARD',
        '#edb77a',
      );
      AM.warned = true;
    }
  };
  AM.load = () => {
    if (AM.data) return AM.data;
    AM.data = fresh();
    try {
      const text = localStorage.getItem(KEY);
      if (text && text.length <= 256 * 1024) {
        const raw = JSON.parse(text);
        if (raw?.version > 1) {
          AM.readOnly = true;
          AM.available = false;
        } else AM.data = AM.sanitize(raw);
      }
    } catch (_) {
      AM.storageFailure();
    }
    return AM.data;
  };
  AM.write = () => {
    if (AM.readOnly) {
      AM.storageFailure();
      return false;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(AM.data));
      AM.available = true;
      AM.warned = false;
      return true;
    } catch (_) {
      AM.storageFailure();
      return false;
    }
  };
  AM.record = (play, completed) => {
    const ch = play.chapter,
      run = AM.config(AM.run, ch),
      flags = play.ctx.persistedFlags(),
      stats = copy(play.ctx.stats);
    const key = AM.slot(ch.amId, run),
      previous = AM.load().records[key];
    const clues = Math.floor(number(flags.clues)).toString(2).split('1').length - 1;
    const score = number(
      flags.score,
      stats.spared * 100 + number(flags.rescued) * 250 + clues * 100,
    );
    const record = {
      caseId: ch.amId,
      run,
      score,
      bestScore: Math.max(score, previous?.bestScore || 0),
      time: stats.time,
      bestTime: completed
        ? Math.min(
            stats.time,
            (previous?.everCompleted || previous?.completed) && previous.bestTime > 0
              ? previous.bestTime
              : Infinity,
          )
        : previous?.bestTime || 0,
      bestWave: Math.max(number(flags.wave), previous?.bestWave || 0),
      bestRescued: Math.max(number(flags.rescued), previous?.bestRescued || 0),
      attempts: (previous?.attempts || 0) + 1,
      completed: !!completed,
      everCompleted: !!(completed || previous?.everCompleted || previous?.completed),
      modeResult: flags.modeResult || (completed ? 'Case closed' : 'Defeated'),
      stats,
      flags,
    };
    AM.data.records[key] = record;
    AM.write();
    return record;
  };
  AM.progress = {
    checkpointAt(chapterId, stage, carry) {
      const ch = DM.Chapters.get(chapterId);
      if (ch.kind !== 'story') return; // Timed/survival challenges always begin a fresh live run.
      const run = AM.config(AM.run, ch);
      AM.load().checkpoints[AM.slot(ch.amId, run)] = {
        caseId: ch.amId,
        stage,
        carry: AM.cleanCarry(carry, ch),
        run,
      };
      AM.write();
    },
    death(play) {
      AM.load().deaths++;
      if (play.chapter.kind !== 'story') AM.record(play, false);
      else AM.write();
    },
    complete(play) {
      const f = play.ctx.flags,
        kind = play.chapter.kind;
      if (kind === 'story' && (play.failed || play.player.down)) return;
      const won =
        !play.failed &&
        !play.player.down &&
        (kind === 'story' ||
          (kind === 'patrol' && f.extracted && f.wave >= 1) ||
          (kind === 'rescue' && f.modeResult === 'rescued'));
      const record = AM.record(play, won);
      delete AM.data.checkpoints[AM.slot(play.chapter.amId, record.run)];
      AM.write();
      DM.Challenge.clear(play.chapter.id);
      E.push(new Results(play, record));
    },
  };
  AM.registerCase = (def) => {
    const id = def.id.replace(/^am_/, '');
    if (AM.byId[id]) throw new Error('Duplicate After Midnight case: ' + id);
    const ch = Object.assign({}, def, {
      id: 'am_' + id,
      amId: id,
      index: 0,
      afterMidnight: true,
      kind: def.kind || 'story',
      form: 'vigilante',
      startPowers: [],
      progress: AM.progress,
      createPlayer: () => {
        if (ch.kind !== 'story' && AM.run)
          AM.run.upgrades = { vitality: 0, capacitor: 0, mobility: 0 };
        return AM.createPlayer(AM.run?.hero || AM.load().selection.hero, AM.run?.upgrades || {});
      },
      numeral: def.numeral || 'AFTER MIDNIGHT',
      date: def.date || '1978',
      place: def.place || 'NEW YORK',
      clock: def.clock ?? 4,
    });
    AM.cases.push(ch);
    AM.byId[id] = ch;
    DM.Chapters.byId[ch.id] = ch;
    return ch;
  };
  AM.start = (id, options = {}) => {
    if (typeof options === 'boolean') options = { resume: options };
    const ch = AM.byId[id.replace(/^am_/, '')];
    if (!ch) throw new Error('Unknown case');
    const data = AM.load(),
      selected = data.selection;
    let run = AM.config(
      { hero: options.hero || selected.hero, theme: options.theme || ch.theme || selected.theme },
      ch,
    );
    const checkpoint = options.resume && data.checkpoints[AM.slot(ch.amId, run)];
    if (checkpoint) run = copy(checkpoint.run);
    AM.run = run;
    data.selection.hero = run.hero;
    data.selection.mode = ch.kind === 'story' ? 'story' : ch.amId;
    if (ch.kind === 'story') data.selection.case = ch.amId;
    else data.selection.theme = run.theme;
    AM.write();
    DM.Input.clearAll();
    const begin = () => {
      if (!checkpoint && !options.instant) E.set(new DM.Scenes.Interlude(ch.id));
      else
        E.set(new DM.Scenes.Play(), {
          chapter: ch.id,
          stage: checkpoint?.stage || 0,
          carry: checkpoint?.carry || null,
        });
    };
    if (options.instant) begin();
    else E.fadeTo(begin);
  };
  AM.encode = () =>
    JSON.stringify(
      {
        format: 'dr-manhattan-after-midnight',
        version: 1,
        savedAt: new Date().toISOString(),
        data: AM.sanitize(AM.load()),
      },
      null,
      2,
    );
  AM.restore = (text) => {
    if (typeof text !== 'string' || text.length > 256 * 1024)
      throw new Error('The backup is too large.');
    const packet = JSON.parse(text, (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('Unsafe backup field.');
      return value;
    });
    if (packet?.format !== 'dr-manhattan-after-midnight' || packet.version !== 1)
      throw new Error('Choose an After Midnight backup.');
    const next = AM.sanitize(packet.data);
    for (const group of ['checkpoints', 'records'])
      if (Object.keys(packet.data[group] || {}).length !== Object.keys(next[group]).length)
        throw new Error('The backup contains invalid or unavailable case records.');
    if (AM.readOnly) throw new Error('A newer save is protected. Use a compatible game copy.');
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (_) {
      AM.storageFailure();
      throw new Error('Saving is blocked. Keep your backup and enable browser storage.');
    }
    AM.data = next;
    AM.available = true;
    AM.warned = false;
    return Object.keys(next.records).length + Object.keys(next.checkpoints).length;
  };

  class Results {
    constructor(play, record) {
      this.play = play;
      this.record = record;
      this.opaque = false;
      this.t = 0;
      this.cursor = 'pointer';
    }
    enter() {
      DM.Audio.stopHums();
      DM.Audio.play('success');
      const story = this.play.chapter.kind === 'story';
      const cases = AM.cases.filter((ch) => ch.kind === 'story');
      const next = story && cases[cases.indexOf(this.play.chapter) + 1];
      const items = [];
      if (next)
        items.push({
          label: 'NEXT CASE · ' + next.title.toUpperCase(),
          action: () => AM.start(next.amId, { hero: this.record.run.hero, resume: true }),
        });
      items.push({
        label: 'RETURN TO THE CASE BOARD',
        action: () => E.set(new DM.Scenes.AfterMidnightMenu()),
      });
      items.push({
        label: story ? 'REPLAY WITH THIS HERO' : 'TRY ANOTHER RUN',
        action: () => AM.start(this.play.chapter.amId, this.record.run),
      });
      this.menu = new DM.UI.Menu(items, {
        x: 640,
        y: 500,
        w: 870,
        align: 'center',
        itemH: 44,
        size: 22,
      });
    }
    update(dt) {
      this.t += dt;
      if (this.t > 0.7) this.menu.update(dt);
    }
    render(g) {
      g.fillStyle = 'rgba(3,8,16,0.92)';
      g.fillRect(90, 55, 1100, 610);
      const r = this.record,
        ch = this.play.chapter,
        color = AM.hero(r.run.hero).color;
      G.text(g, 'AFTER MIDNIGHT · ' + AM.hero(r.run.hero).name.toUpperCase(), 640, 108, {
        size: 15,
        spacing: 4,
        align: 'center',
        color,
      });
      G.text(g, ch.title.toUpperCase(), 640, 174, {
        size: 44,
        weight: 700,
        spacing: 4,
        align: 'center',
        color: '#f3e7ce',
      });
      G.text(g, r.modeResult.toUpperCase().replace(/[_-]/g, ' '), 640, 219, {
        size: 22,
        align: 'center',
        color,
      });
      const rows = [
        ['FIELD TIME', DM.U.fmtTime(r.time)],
        ['PEOPLE SPARED / UNMADE', `${r.stats.spared} / ${r.stats.disintegrated}`],
        ['SCORE / PERSONAL BEST', `${Math.round(r.score)} / ${Math.round(r.bestScore)}`],
      ];
      if (r.flags.rescued != null)
        rows.push([
          'PEOPLE RESCUED',
          String(r.flags.rescued) +
            (r.flags.rescueTarget ? ' / ' + r.flags.rescueTarget : '') +
            (r.flags.lost ? ' · ' + r.flags.lost + ' LOST' : ''),
        ]);
      if (r.flags.wave != null) rows.push(['WAVE REACHED', String(r.flags.wave)]);
      if (r.flags.clockLeft != null)
        rows.push(['TIME REMAINING', Math.ceil(r.flags.clockLeft) + 's']);
      rows.forEach(([name, value], i) => {
        G.text(g, name, 619, 278 + i * 34, {
          size: 15,
          align: 'right',
          spacing: 2,
          color: '#b5bdc6',
        });
        G.text(g, value, 650, 278 + i * 34, { size: 22, color });
      });
      if (!AM.available)
        G.text(g, 'SESSION ONLY · EXPORT A BACKUP BEFORE CLOSING', 640, 458, {
          size: 14,
          align: 'center',
          color: '#efb47a',
        });
      this.menu.render(g);
    }
  }
  AM.Results = Results;
})();
