/*
 * Save data in localStorage, versioned so future updates can migrate old saves
 * instead of wiping them. Storage can be unavailable (private windows, blocked
 * site data) — every access is wrapped so the game still runs, just without
 * persistence. Whatever is stored is migrated, then sanitized, so a hand-edited,
 * stale or half-written save can never stop the game from booting.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const KEY = 'dr-manhattan.save';
  const CURRENT = 2;

  const defaults = () => ({
    version: CURRENT,
    reached: 0, // furthest chapter index the player may start
    completed: {}, // chapterId -> stats (+ persisted story flags) of the last completion
    checkpoint: null, // { chapter, stage, carry } — the furthest point reached; powers "Continue"
    checkpoints: {}, // chapterId -> { stage, carry } — latest mid-chapter checkpoint (Chapter Select "Resume")
    seen: { unlocks: {} }, // things shown once per save (power unlock cards)
    totals: { disintegrated: 0, spared: 0, decoherences: 0, memories: 0 },
    settings: { music: 0.6, sfx: 0.8, shake: 1, hints: true },
  });

  // migrations[n] upgrades a save object from version n to n + 1.
  const migrations = {
    // v2: per-chapter checkpoints, stats carried with checkpoints, seen unlock cards.
    1(d) {
      const cp = d.checkpoint;
      d.checkpoints = {};
      if (cp && typeof cp === 'object' && cp.chapter && cp.stage > 0) d.checkpoints[cp.chapter] = { stage: cp.stage, carry: null };
      // Powers granted in chapters already finished have had their cards shown.
      const unlocks = {};
      const Ch = DM.Chapters;
      const reached = Math.floor(Number(d.reached)) || 0;
      if (Ch) for (const c of Ch.list.slice(0, reached)) for (const st of c.stages) for (const g of st.grants || []) unlocks[g] = true;
      d.seen = { unlocks };
      d.version = 2;
      return d;
    },
  };

  function merge(base, over) {
    for (const k in over) {
      const v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') merge(base[k], v);
      else base[k] = v;
    }
    return base;
  }

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, def, lo = -Infinity, hi = Infinity) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  };
  const STAT_KEYS = ['time', 'disintegrated', 'spared', 'memories'];

  // { stats, found, flags } snapshot taken when a checkpoint is entered.
  function cleanCarry(c) {
    if (!isObj(c)) return null;
    const stats = {};
    for (const k of STAT_KEYS) stats[k] = num(isObj(c.stats) ? c.stats[k] : 0, 0, 0);
    const found = Array.isArray(c.found) ? c.found.filter((y) => Number.isFinite(y)) : [];
    return { stats, found, flags: cleanFlags(c.flags) };
  }
  function cleanFlags(f) {
    const out = {};
    if (isObj(f)) for (const k in f) if (['boolean', 'number', 'string'].includes(typeof f[k])) out[k] = f[k];
    return out;
  }
  // A checkpoint is only kept if its chapter still exists and the stage is in range
  // (content updates can remove stages; a stale save must not crash Continue).
  function cleanCheckpoint(chapter, stage, carry) {
    const ch = DM.Chapters && DM.Chapters.get(chapter);
    if (!ch) return null;
    const s = typeof stage === 'number' ? stage : NaN;
    if (!Number.isInteger(s) || s < 0 || s >= ch.stages.length) return null;
    return { chapter, stage: s, carry: cleanCarry(carry) };
  }

  // Settings: the schema (src/core/settings.js) owns the rules when it is loaded;
  // otherwise clamp the basics so a bad value can never break boot.
  function cleanSettings(s, def) {
    const out = Object.assign({}, def, isObj(s) ? s : {});
    if (DM.SettingsSchema && DM.SettingsSchema.sanitize) {
      try {
        const r = DM.SettingsSchema.sanitize(out);
        return isObj(r) ? r : out;
      } catch (e) {
        console.warn('Settings schema could not sanitize the saved settings', e);
      }
    }
    out.music = num(out.music, def.music, 0, 1);
    out.sfx = num(out.sfx, def.sfx, 0, 1);
    out.shake = num(out.shake, def.shake, 0, 1);
    out.hints = typeof out.hints === 'boolean' ? out.hints : def.hints !== false;
    if ('focusPause' in out && typeof out.focusPause !== 'boolean') out.focusPause = out.focusPause !== 'false' && !!out.focusPause;
    return out;
  }

  // Coerce a merged save into the shape the game expects. Never throws on bad data.
  function sanitize(d) {
    const def = defaults();
    if (!isObj(d)) return def;
    d.settings = cleanSettings(d.settings, def.settings);
    const nChapters = DM.Chapters ? DM.Chapters.list.length : 99;
    d.reached = Math.floor(num(d.reached, 0, 0, nChapters));

    const completed = {};
    if (isObj(d.completed)) {
      for (const id in d.completed) {
        const c = d.completed[id];
        if (!isObj(c)) continue;
        const rec = {};
        for (const k of STAT_KEYS) rec[k] = num(c[k], 0, 0);
        if (c.flags !== undefined) rec.flags = cleanFlags(c.flags);
        completed[id] = rec;
      }
    }
    d.completed = completed;

    const totals = {};
    for (const k in def.totals) totals[k] = num(isObj(d.totals) ? d.totals[k] : 0, 0, 0);
    d.totals = totals;

    const cp = d.checkpoint;
    d.checkpoint = isObj(cp) ? cleanCheckpoint(cp.chapter, cp.stage, cp.carry) : null;
    const cps = {};
    if (isObj(d.checkpoints)) {
      for (const id in d.checkpoints) {
        const c = d.checkpoints[id];
        const ok = isObj(c) && cleanCheckpoint(id, c.stage, c.carry);
        if (ok && ok.stage > 0) cps[id] = { stage: ok.stage, carry: ok.carry };
      }
    }
    d.checkpoints = cps;

    const unlocks = {};
    if (isObj(d.seen) && isObj(d.seen.unlocks)) for (const k in d.seen.unlocks) if (d.seen.unlocks[k]) unlocks[k] = true;
    d.seen = Object.assign(isObj(d.seen) ? d.seen : {}, { unlocks });
    return d;
  }

  const Save = {
    data: defaults(),
    available: true, // false when the browser refuses storage
    readOnly: false, // true when the stored save comes from a newer version of the game
    defaults,
    sanitize,
    get settings() {
      return this.data.settings;
    },
    load() {
      let raw = null;
      try {
        raw = localStorage.getItem(KEY);
      } catch (e) {
        this.available = false;
        this.data = defaults();
        return this.data;
      }
      if (!raw) {
        this.data = sanitize(defaults());
        return this.data;
      }
      let d;
      try {
        d = JSON.parse(raw);
      } catch (e) {
        d = undefined;
      }
      if (!isObj(d)) {
        // Unreadable: keep a copy for recovery, then start fresh. Storage still works.
        console.warn('Save data was unreadable; a copy was kept under ' + KEY + '.corrupt');
        try {
          localStorage.setItem(KEY + '.corrupt', raw);
        } catch (e) {
          /* best effort */
        }
        this.data = sanitize(defaults());
        return this.data;
      }
      try {
        let v = Math.floor(num(d.version, 1, 1));
        if (v > CURRENT) {
          // A newer build wrote this. Play with it, but never down-convert it on disk.
          this.readOnly = true;
          console.warn(`Save is from a newer version (v${v}); progress will not be written this session.`);
        }
        d.version = v;
        while (d.version < CURRENT && migrations[d.version]) d = migrations[d.version](d);
        const keep = d.version;
        this.data = sanitize(merge(defaults(), d));
        this.data.version = this.readOnly ? keep : CURRENT;
      } catch (e) {
        console.warn('Save data could not be migrated; starting fresh', e);
        try {
          localStorage.setItem(KEY + '.corrupt', raw);
        } catch (err) {
          /* best effort */
        }
        this.data = sanitize(defaults());
      }
      return this.data;
    },
    write() {
      if (this.readOnly) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {
        this.available = false;
      }
    },
    reset() {
      const s = this.data.settings;
      this.data = defaults();
      this.data.settings = s;
      this.write();
    },
    hasProgress() {
      return !!this.data.checkpoint || this.data.reached > 0;
    },

    // ---- checkpoints --------------------------------------------------------
    // Would (chapterId, stage) be at or beyond the current Continue point?
    isForward(chapterId, stage) {
      const cur = this.data.checkpoint;
      const b = cur && DM.Chapters.get(cur.chapter);
      if (!b) return true;
      const a = DM.Chapters.get(chapterId);
      if (!a) return false;
      return a.index > b.index || (a.index === b.index && stage >= cur.stage);
    },
    // A checkpoint stage was entered. The chapter's own slot always moves to it
    // (Chapter Select resumes there); Continue only ever moves forward, so
    // replaying an earlier chapter never loses the furthest point.
    checkpointAt(chapterId, stage, carry) {
      const c = carry || null;
      if (stage > 0) this.data.checkpoints[chapterId] = { stage, carry: c };
      if (this.isForward(chapterId, stage)) this.data.checkpoint = { chapter: chapterId, stage, carry: c };
      this.write();
    },
    // A chapter was finished: Continue moves to the start of the next one (or,
    // after the last chapter, clears), unless the player is further along.
    chapterDone(chapterId) {
      const ch = DM.Chapters.get(chapterId);
      const next = DM.Chapters.next(chapterId);
      delete this.data.checkpoints[chapterId];
      if (next) {
        if (this.isForward(next.id, 0)) this.data.checkpoint = { chapter: next.id, stage: 0, carry: null };
      } else if (ch) this.data.checkpoint = null; // the story is finished: nothing lies further
      this.write();
    },
    // New Game: the run starts over from the first chapter. Chapters stay unlocked.
    startOver() {
      const first = DM.Chapters.list[0];
      this.data.checkpoint = first ? { chapter: first.id, stage: 0, carry: null } : null;
      this.data.checkpoints = {};
      this.write();
    },
    // Where Continue leads: the saved checkpoint, or the start of the furthest
    // unlocked chapter if the checkpoint had to be dropped. null once the game is finished.
    continueTarget() {
      const cp = this.data.checkpoint;
      if (cp && DM.Chapters.get(cp.chapter)) return cp;
      const list = DM.Chapters.list;
      if (this.data.reached > 0 && this.data.reached < list.length) return { chapter: list[this.data.reached].id, stage: 0, carry: null };
      return null;
    },
    get finished() {
      return this.data.reached >= DM.Chapters.list.length;
    },
  };

  DM.Save = Save;
})();
