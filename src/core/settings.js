/*
 * Settings schema: every player-facing option, declared once.
 *
 * save.js builds its default settings from this list and the Settings screen
 * generates its rows from it, so adding an option is one entry here.
 *
 * Entry fields:
 *   id, section, label, desc       desc may be a function of the current value
 *   type 'slider'                  number in min..max, moved in `step`s (bar + %)
 *   type 'choice'                  one of options: [[value, 'LABEL'], ...]
 *   type 'toggle'                  true / false, shown ON / OFF
 *   type 'action'                  a button: action(scene); `confirm` asks twice
 *   def                            default, or a function returning it
 *   apply(value)                   runs after the player changes it
 *   coerce(raw)                    maps a legacy saved value (undefined = use def)
 *   transient + get() / set(v)     live state that is never saved (fullscreen)
 *
 * Also here: the challenge levels (DM.CHALLENGE), applied to the player on
 * every 'play:begin', and the death count behind the Game Over offer.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;

  const SECTIONS = ['AUDIO', 'DISPLAY & ACCESSIBILITY', 'GAMEPLAY', 'CONTROLS'];

  // Damage taken, seconds before coherence recovers, and recovery per second.
  // Player.damage reads damageMul / regenDelayBase; Player.update reads coherenceRegen.
  const CHALLENGE = {
    story: { label: 'STORY', dmg: 0.45, regenDelay: 1.4, regen: 16 },
    normal: { label: 'NORMAL', dmg: 1, regenDelay: 2.6, regen: 9 },
    hard: { label: 'HARD', dmg: 1.35, regenDelay: 3.2, regen: 7 },
  };

  // Typewriter speeds (characters per second) and caption read-time multipliers.
  const TEXT_CPS = { slow: 30, normal: 55, fast: 110, instant: Infinity };
  const READ_TIME = { slow: 1.5, normal: 1, fast: 1, instant: 1 };

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

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

  function applyVolumes() {
    const s = DM.Save.settings;
    DM.Audio.setVolumes({ music: s.music, sfx: s.sfx, ambience: s.ambience });
  }

  function playScene() {
    const Play = DM.Scenes && DM.Scenes.Play;
    return (DM.Engine && Play && DM.Engine.stack.find((s) => s instanceof Play)) || null;
  }

  // ---- the schema ----------------------------------------------------------------
  const Schema = [
    // AUDIO
    {
      id: 'music', section: 'AUDIO', label: 'MUSIC', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.6,
      desc: 'The score.', apply: applyVolumes,
    },
    {
      id: 'sfx', section: 'AUDIO', label: 'SOUND EFFECTS', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.8,
      desc: 'Powers, impacts, voices and the interface.',
      apply() {
        applyVolumes();
        DM.Audio.play('ui_select');
      },
    },
    {
      id: 'ambience', section: 'AUDIO', label: 'AMBIENCE', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.7,
      desc: 'Wind, machines and crowds: the sound of each place.', apply: applyVolumes,
    },

    // DISPLAY & ACCESSIBILITY
    {
      id: 'flashing', section: 'DISPLAY & ACCESSIBILITY', label: 'FLASHING LIGHTS', type: 'choice',
      options: [['full', 'FULL'], ['reduced', 'REDUCED']],
      def: () => (prefersReducedMotion() ? 'reduced' : 'full'),
      desc: (v) => (v === 'reduced'
        ? 'Full-screen flashes become a soft, dim fade. Strobing camera flashes and blinking alarms are removed.'
        : 'Bright full-screen flashes, camera flashbulbs and blinking alarm lights, as designed.'),
    },
    {
      id: 'shake', section: 'DISPLAY & ACCESSIBILITY', label: 'SCREEN SHAKE', type: 'choice',
      options: [[0, 'OFF'], [0.5, '50%'], [1, '100%']],
      def: () => (prefersReducedMotion() ? 0.5 : 1),
      coerce: (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : undefined),
      desc: 'How hard the camera shakes on impacts and explosions.',
    },
    {
      id: 'grain', section: 'DISPLAY & ACCESSIBILITY', label: 'FILM GRAIN', type: 'toggle', def: true,
      desc: 'A fine grain over the picture, like old film stock.',
    },
    {
      id: 'quality', section: 'DISPLAY & ACCESSIBILITY', label: 'QUALITY', type: 'choice',
      options: [['high', 'HIGH'], ['balanced', 'BALANCED'], ['low', 'LOW']], def: 'high',
      desc: 'Render resolution. Lower it if the game stutters on this machine.',
      apply() {
        if (DM.Engine && DM.Engine.canvas) DM.Engine.resize();
      },
    },
    {
      id: 'fx', section: 'DISPLAY & ACCESSIBILITY', label: 'AMBIENT EFFECTS', type: 'choice',
      options: [['full', 'FULL'], ['reduced', 'REDUCED'], ['off', 'OFF']], def: 'full',
      desc: 'Snow, dust, drizzle and haze drifting through each place.',
    },
    {
      id: 'fullscreen', section: 'DISPLAY & ACCESSIBILITY', label: 'FULLSCREEN', type: 'toggle', transient: true,
      get: isFullscreen, set: toggleFullscreen,
      desc: 'Fill the whole screen. Esc leaves fullscreen.',
    },

    // GAMEPLAY
    {
      id: 'challenge', section: 'GAMEPLAY', label: 'CHALLENGE', type: 'choice',
      options: [['story', 'STORY'], ['normal', 'NORMAL'], ['hard', 'HARD']], def: 'normal',
      desc: (v) => ({
        story: 'STORY: attacks hurt less than half as much and you pull yourself together quickly.',
        normal: 'NORMAL: the fights as designed.',
        hard: 'HARD: attacks hurt more and you take longer to recover.',
      })[v],
      apply: () => Challenge.applyNow(),
    },
    {
      id: 'invulnerable', section: 'GAMEPLAY', label: 'INVULNERABILITY', type: 'toggle', def: false,
      desc: 'Assist: nothing can hurt you. Play the story at your own pace.',
      apply: () => Challenge.applyNow(),
    },
    {
      id: 'hints', section: 'GAMEPLAY', label: 'HINTS', type: 'choice',
      options: [['all', 'ALL'], ['essential', 'ESSENTIAL']], def: 'all',
      coerce: (v) => (v === true ? 'all' : v === false ? 'essential' : undefined),
      desc: (v) => (v === 'essential'
        ? 'Only instructions you need to progress. Press H in play to recall the last tip.'
        : 'Tips and tactics as you go. Press H in play to see the last one again.'),
    },
    {
      id: 'textSpeed', section: 'GAMEPLAY', label: 'TEXT SPEED', type: 'choice',
      options: [['slow', 'SLOW'], ['normal', 'NORMAL'], ['fast', 'FAST'], ['instant', 'INSTANT']], def: 'normal',
      desc: (v) => (v === 'slow'
        ? 'Dialogue types out slowly and narration stays on screen half as long again.'
        : 'How fast dialogue and narration type out. Hold E / SPACE / CLICK to fast-forward a conversation.'),
    },
    {
      id: 'focusPause', section: 'GAMEPLAY', label: 'PAUSE WHEN UNFOCUSED', type: 'toggle', def: true,
      desc: 'Pause automatically when you switch to another window or tab.',
    },
    {
      id: 'reset', section: 'GAMEPLAY', label: 'RESET PROGRESS', type: 'action', confirm: true,
      desc: 'Erase chapters, checkpoints and the tally of lives. Settings are kept.',
      action() {
        DM.Save.reset();
        return 'Progress reset.';
      },
    },

    // CONTROLS
    {
      id: 'tkMode', section: 'CONTROLS', label: 'TELEKINESIS', type: 'choice',
      options: [['hold', 'HOLD'], ['toggle', 'TOGGLE']], def: 'hold',
      desc: (v) => (v === 'toggle'
        ? 'TOGGLE: click to lift, click again to throw. Kinder on a trackpad.'
        : 'HOLD: keep the button down to carry, release to throw.'),
    },
    {
      id: 'controls', section: 'CONTROLS', label: 'CONTROLS LIST', type: 'action',
      desc: 'Every key and button, including the Mac trackpad equivalents.',
      action() {
        DM.Engine.push(new DM.Scenes.Controls());
      },
    },
  ];

  const byId = {};
  const index = () => {
    for (const k in byId) delete byId[k];
    for (const e of Schema) byId[e.id] = e;
  };
  index();

  const stored = (e) => e.type !== 'action' && !e.transient;
  const resolveDef = (e) => (typeof e.def === 'function' ? e.def() : e.def);

  // A valid value for entry e, from whatever was saved (old saves, hand edits, junk).
  function clean(e, raw) {
    if (raw === undefined || raw === null) return resolveDef(e);
    if (e.coerce) {
      const c = e.coerce(raw);
      if (c !== undefined) raw = c;
    }
    if (e.type === 'slider') {
      if (typeof raw !== 'number' || !isFinite(raw)) return resolveDef(e);
      const v = U.clamp(raw, e.min, e.max);
      return Math.round((v - e.min) / e.step) * e.step + e.min;
    }
    if (e.type === 'toggle') return typeof raw === 'boolean' ? raw : resolveDef(e);
    if (e.type === 'choice') {
      if (e.options.some((o) => o[0] === raw)) return raw;
      // Numeric choices snap to the nearest option (an old 0.8 shake becomes 100%).
      if (typeof raw === 'number' && isFinite(raw) && typeof e.options[0][0] === 'number') {
        let best = e.options[0][0];
        for (const [v] of e.options) if (Math.abs(v - raw) < Math.abs(best - raw)) best = v;
        return best;
      }
      return resolveDef(e);
    }
    return raw;
  }

  Object.assign(Schema, {
    sections: SECTIONS,

    get(id) {
      if (!byId[id]) index(); // picks up entries pushed after load
      return byId[id] || null;
    },
    inSection(name) {
      return Schema.filter((e) => e.section === name && !e.hidden);
    },

    // Fresh settings object: every stored entry at its default.
    defaults() {
      const s = {};
      for (const e of Schema) if (stored(e)) s[e.id] = resolveDef(e);
      return s;
    },
    // Repairs a settings object in place (and returns it): every entry valid,
    // legacy values mapped, unknown keys left alone for newer or older builds.
    sanitize(s) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return Schema.defaults();
      for (const e of Schema) if (stored(e)) s[e.id] = clean(e, s[e.id]);
      return s;
    },

    // Current, always-valid value of an option.
    value(id) {
      const e = Schema.get(id);
      if (!e) return DM.Save ? DM.Save.settings[id] : undefined;
      if (e.transient) return e.get();
      return clean(e, DM.Save ? DM.Save.settings[id] : undefined);
    },
    set(id, v) {
      const e = Schema.get(id);
      if (!e || e.type === 'action') return;
      if (e.transient) {
        if (v !== e.get()) e.set(v);
        return;
      }
      const s = DM.Save.settings;
      s[id] = clean(e, v);
      DM.Save.write();
      if (e.apply) e.apply(s[id]);
    },
    // Keyboard / arrow step: sliders move and stop at the ends, choices wrap, toggles flip.
    step(id, dir) {
      const e = Schema.get(id);
      if (!e) return;
      const v = Schema.value(id);
      if (e.type === 'slider') Schema.set(id, U.clamp(v + dir * e.step, e.min, e.max));
      else if (e.type === 'toggle') Schema.set(id, !v);
      else if (e.type === 'choice') {
        const n = e.options.length;
        const i = Math.max(0, e.options.findIndex((o) => o[0] === v));
        Schema.set(id, e.options[(i + dir + n) % n][0]);
      }
    },
    format(id) {
      const e = Schema.get(id);
      const v = Schema.value(id);
      if (e.type === 'slider') return `${Math.round(((v - e.min) / (e.max - e.min)) * 100)}%`;
      if (e.type === 'toggle') return v ? 'ON' : 'OFF';
      if (e.type === 'choice') {
        const o = e.options.find((o) => o[0] === v);
        return o ? o[1] : String(v);
      }
      return '';
    },
    describe(id) {
      const e = Schema.get(id);
      if (!e || !e.desc) return '';
      return typeof e.desc === 'function' ? e.desc(e.type === 'action' ? null : Schema.value(id)) || '' : e.desc;
    },

    // ---- helpers the rest of the game reads -------------------------------------
    reducedMotion: prefersReducedMotion,
    reducedFlashing() {
      return Schema.value('flashing') === 'reduced';
    },
    // Highest alpha a full-screen flash may reach.
    flashCap() {
      return Schema.reducedFlashing() ? 0.25 : 1;
    },
    textCPS() {
      return TEXT_CPS[Schema.value('textSpeed')] || TEXT_CPS.normal;
    },
    readTime() {
      return READ_TIME[Schema.value('textSpeed')] || 1;
    },
    hintsAll() {
      return Schema.value('hints') !== 'essential';
    },
  });

  // ---- challenge ------------------------------------------------------------------
  const deaths = {};
  const deathKey = (play) => `${play.chapter.id}:${(play.ctx && play.ctx.checkpoint) || 0}`;

  const Challenge = {
    levels: CHALLENGE,
    current() {
      return CHALLENGE[Schema.value('challenge')] || CHALLENGE.normal;
    },
    applyTo(player) {
      if (!player) return;
      const c = Challenge.current();
      player.damageMul = c.dmg;
      player.regenDelayBase = c.regenDelay;
      player.coherenceRegen = c.regen;
      player.godMode = !!Schema.value('invulnerable');
    },
    // Settings changed mid-chapter (from Pause): the running attempt follows at once.
    applyNow() {
      const play = playScene();
      if (play) Challenge.applyTo(play.player);
    },
    // Decoherences since this chapter's current checkpoint was reached (this session).
    deaths(play) {
      return (play && play.chapter && deaths[deathKey(play)]) || 0;
    },
    clear(chapterId) {
      for (const k in deaths) if (k.startsWith(chapterId + ':')) delete deaths[k];
    },
  };

  DM.Events.on('play:begin', (e) => Challenge.applyTo(e && e.scene && e.scene.player));
  DM.Events.on('player:down', (p) => {
    const play = playScene();
    if (!play || play.player !== p) return;
    const k = deathKey(play);
    deaths[k] = (deaths[k] || 0) + 1;
  });

  // Package F's Play.begin announces every attempt with 'play:begin'. A build
  // whose Play.begin does not gets the same event from this wrapper, so the
  // challenge always applies; once begin() emits it, the wrapper stays silent.
  function announceBegin() {
    const Play = DM.Scenes && DM.Scenes.Play;
    if (!Play || Play.prototype.begin.announced) return;
    const begin = Play.prototype.begin;
    Play.prototype.begin = function (chapterId, stage) {
      let heard = false;
      const off = DM.Events.on('play:begin', () => (heard = true));
      const retry = this.begunChapter === chapterId;
      try {
        begin.apply(this, arguments);
      } finally {
        off();
      }
      this.begunChapter = chapterId;
      if (!heard) DM.Events.emit('play:begin', { scene: this, chapter: this.chapter, stage: stage || 0, retry });
    };
    Play.prototype.begin.announced = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announceBegin);
  else setTimeout(announceBegin, 0);

  // Actions the Settings and HUD use, registered only if input.js does not already
  // bind them (package B adds 'hint' to BINDINGS).
  const B = DM.Input && DM.Input.bindings;
  if (B) {
    if (!B.hint) B.hint = ['KeyH'];
    if (!B.tabPrev) B.tabPrev = ['KeyQ', 'PageUp'];
    if (!B.tabNext) B.tabNext = ['KeyE', 'PageDown', 'Tab'];
  }

  DM.CHALLENGE = CHALLENGE;
  DM.TEXT_CPS = TEXT_CPS;
  DM.Challenge = Challenge;
  DM.SettingsSchema = Schema;
})();
