/*
 * Save data in localStorage, versioned so future updates can migrate old saves
 * instead of wiping them. Storage can be unavailable (private windows, blocked
 * site data) — every access is wrapped so the game still runs, just without
 * persistence.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const KEY = 'dr-manhattan.save';
  const CURRENT = 1;

  const defaults = () => ({
    version: CURRENT,
    reached: 0, // furthest chapter index the player may start
    completed: {}, // chapterId -> stats of best/last completion
    checkpoint: null, // { chapter, stage } — powers "Continue"
    totals: { disintegrated: 0, spared: 0, decoherences: 0, memories: 0 },
    settings: { music: 0.6, sfx: 0.8, shake: 1, hints: true },
  });

  // migrations[n] upgrades a save object from version n to n + 1.
  const migrations = {};

  function merge(base, over) {
    for (const k in over) {
      const v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') merge(base[k], v);
      else base[k] = v;
    }
    return base;
  }

  const Save = {
    data: defaults(),
    available: true,
    get settings() {
      return this.data.settings;
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          let d = JSON.parse(raw);
          while (d.version < CURRENT && migrations[d.version]) d = migrations[d.version](d);
          this.data = merge(defaults(), d);
          this.data.version = CURRENT;
        }
      } catch (e) {
        this.available = false;
        this.data = defaults();
      }
      return this.data;
    },
    write() {
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
  };

  DM.Save = Save;
})();
