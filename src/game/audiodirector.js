/*
 * Audio director: turns what is happening into sound without any scene or
 * entity calling it. It runs its own requestAnimationFrame loop, looks at the
 * scene stack (DM.Engine) and listens to game events:
 *   - the ambient bed for the current map (and zone), ducked under Temporal
 *     Sight and Pause, silent outside play;
 *   - music intensity from the threat around Jon, dialogue ducking, stage cues;
 *   - the spare/kill moment ('enemy:down'): 'ko' + 'spared', or 'unmade' and a
 *     dip in the music;
 *   - danger: heartbeat at low coherence, emitter hum, jamming static, a
 *     muffled world when Jon comes apart;
 *   - Temporal Sight: the effects slow and darken, a pocket watch ticks;
 *   - footsteps by surface.
 * Nothing here may throw into the game: each frame runs inside try/catch.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Audio = DM.Audio;
  const Input = DM.Input;

  const THREAT_RANGE = 900; // alerted enemies within this distance count
  const THREAT_FULL = 6; // this much weight is a full fight
  const BOSS_THREAT = 0.85;
  const TALK_THREAT = 0.35; // dialogue or a cutscene calms the score
  const HEART_LOW = 35; // coherence below which the heart is heard
  const HEART_CRITICAL = 15;
  const HEART_SLOW = 0.95; // seconds between beats
  const HEART_FAST = 0.6;
  const LOW_FILTER = 2500; // music caps while hurt, unmaking, decohered
  const DIP_FILTER = 900;
  const DIP_TIME = 0.6;
  const DOWN_FILTER = 400;
  const EMITTER_REACH = 1.6; // hum heard to jamR x this
  const ZONE_HYST = 40;
  const AMB_SIGHT = 0.4; // ambience level under Temporal Sight and Pause
  const AMB_PAUSE = 0.6;

  const Amb = () => DM.Ambience || { maps: {}, beds: {}, cues: {}, events: {} };

  // Threat weight per enemy: heavy machines count double, emitters not at all.
  function weightOf(e) {
    if (e.threatWeight != null) return e.threatWeight;
    const E = DM.Enemies || {};
    if (E.Emitter && e instanceof E.Emitter) return 0;
    if ((E.Tank && e instanceof E.Tank) || (E.Battery && e instanceof E.Battery) || (E.Behemoth && e instanceof E.Behemoth)) return 2;
    return 1;
  }

  const Director = {
    lastError: null,
    stageKey: null,
    cue: null, // track this director set for the current stage cue
    bed: null,
    stepSign: 0,
    stepCount: 0,
    beatT: 0,
    low: false,
    dipT: 0,
    sightHeld: false,
    caps: { low: null, dip: null, down: null },
    play: null,
    last: 0,

    // The first track of a chapter, so its interlude can start the music Play continues.
    trackFor(chapterId, stageIndex = 0) {
      const ch = DM.Chapters && DM.Chapters.get(chapterId);
      if (!ch) return 'title';
      const st = ch.stages && ch.stages[stageIndex];
      const cue = st && Amb().cues[`${ch.id}.${st.id}`];
      return cue || ch.introMusic || ch.music || 'title';
    },
    playScene() {
      const E = DM.Engine;
      const Play = DM.Scenes && DM.Scenes.Play;
      if (!E || !Play) return null;
      for (const s of E.stack) if (s instanceof Play) return s;
      return null;
    },
    stageKeyOf(play) {
      const ch = play.chapter;
      const st = ch && ch.stages && play.ctx && ch.stages[play.ctx.stageIndex];
      return ch && st ? `${ch.id}.${st.id}` : null;
    },
    // A stage with a cue plays its track; leaving it brings the chapter's track
    // back, unless a script has changed the music since.
    applyStage(play, force) {
      const key = this.stageKeyOf(play);
      if (key === this.stageKey && !force) return;
      this.stageKey = key;
      const M = Audio.music;
      const cue = key && Amb().cues[key];
      if (cue) {
        M.play(cue);
        this.cue = cue;
      } else if (this.cue) {
        if (M.wanted === this.cue && play.chapter.music) M.play(play.chapter.music);
        this.cue = null;
      }
    },

    // ---- per frame --------------------------------------------------------------
    frame(dt) {
      const E = DM.Engine;
      if (!E) return;
      const play = this.playScene();
      this.play = play;
      if (!play || !play.world || !play.player || !play.ctx) {
        this.idle();
        return;
      }
      const top = E.top();
      const live = top === play && !E.error;
      const w = play.world;
      const p = play.player;

      this.ambience(play, live);
      this.applyStage(play);

      if (live) {
        Audio.setTimeScale(w.timeScale == null ? 1 : w.timeScale);
        Audio.music.setIntensity(this.threat(play));
        Audio.duck((play.dialog && play.dialog.active) || (play.hud && play.hud.captions && play.hud.captions.length > 0));
        this.danger(play, dt);
        this.footsteps(play);
      } else {
        // Overlays (Pause, Game Over, the watch) stop the world: no live danger.
        Audio.setTimeScale(1);
        Audio.duck(false);
        this.stopDanger();
        this.low = false;
        this.caps.low = null;
      }

      if (this.dipT > 0) this.dipT -= dt;
      this.caps.dip = this.dipT > 0 ? DIP_FILTER : null;
      this.caps.down = p.down ? DOWN_FILTER : null;
      this.applyCaps();
    },
    idle() {
      Audio.ambience(null);
      Audio.setAmbienceDuck(1);
      Audio.setTimeScale(1);
      Audio.duck(false);
      this.stopDanger();
      this.caps.low = this.caps.dip = this.caps.down = null;
      this.dipT = 0;
      this.low = false;
      this.applyCaps();
      this.stageKey = null;
      this.cue = null;
      this.bed = null;
    },
    applyCaps() {
      let f = null;
      for (const k in this.caps) if (this.caps[k] && (f == null || this.caps[k] < f)) f = this.caps[k];
      Audio.setMusicCap(f, f === DOWN_FILTER ? 0.03 : 0.25);
    },

    // The bed for this map, or for the zone Jon is standing in.
    ambience(play, live) {
      const m = Amb().maps[play.ctx.mapName];
      const p = play.player;
      let bed = m ? m.bed : null;
      if (m && m.zones) {
        for (const z of m.zones) {
          const r = z.rect;
          const e = this.bed === z.bed ? ZONE_HYST : 0;
          if (r && p.x > r[0] - e && p.y > r[1] - e && p.x < r[2] + e && p.y < r[3] + e) {
            bed = z.bed;
            break;
          }
        }
      }
      this.bed = bed;
      Audio.ambience(bed);
      Audio.setAmbienceDuck(!live ? AMB_PAUSE : play.world.timesight ? AMB_SIGHT : 1);
    },

    // 0 calm .. 1 full fight.
    threat(play) {
      const w = play.world;
      const p = play.player;
      let sum = 0;
      for (const e of w.entities) {
        if (!e.alerted || e.dead || e.ko || e.yielded || e.team !== 'enemy') continue;
        if (U.dist(e.x, e.y, p.x, p.y) > THREAT_RANGE) continue;
        sum += weightOf(e);
      }
      let t = Math.min(1, sum / THREAT_FULL);
      if (w.boss && !w.boss.dead && !w.boss.yielded) t = Math.max(t, BOSS_THREAT);
      if ((play.dialog && play.dialog.active) || play.ctx.locked) t *= TALK_THREAT;
      return t;
    },

    danger(play, dt) {
      const w = play.world;
      const p = play.player;
      if (p.down || play.failed) {
        this.stopDanger();
        this.low = false;
        this.caps.low = null;
        return;
      }
      // Heartbeat.
      const low = p.form === 'manhattan' && p.coherence < HEART_LOW;
      if (low) {
        if (!this.low) this.beatT = 0;
        this.beatT -= dt;
        if (this.beatT <= 0) {
          Audio.play('beat');
          this.beatT = Math.max(0, this.beatT) + (p.coherence < HEART_CRITICAL ? HEART_FAST : HEART_SLOW);
        }
      }
      this.low = low;
      this.caps.low = low ? LOW_FILTER : null;

      // The nearest tachyon emitter hums, beating at 5.6 Hz, louder as Jon nears it.
      let best = null;
      let bd = Infinity;
      for (const e of w.entities) {
        if (!e.jamR || e.dead || e.ko) continue;
        const d = U.dist(e.x, e.y, p.x, p.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      const reach = best ? best.jamR * EMITTER_REACH : 0;
      if (best && bd < reach) {
        const k = 1 - bd / reach;
        Audio.hum('emitter', true, { type: 'sawtooth', freq: 98, type2: 'sawtooth', freq2: 103.6, cutoff: 900, gain: 0.05 * k * k });
      } else Audio.hum('emitter', false);
      Audio.hum('static', p.jammed, { kind: 'noise', freq: 3500, q: 1.2, gate: 25, gain: 0.02 });

      // Temporal Sight pressed while jammed: it fails audibly.
      const held = Input.down('timesight');
      if (held && !this.sightHeld && p.jammed && p.has && p.has('timesight') && p.canUsePowers) Audio.play('jammed');
      this.sightHeld = held;

      Audio.hum('sight', !!w.timesight, { kind: 'sight' });
    },
    stopDanger() {
      Audio.hum('emitter', false);
      Audio.hum('static', false);
      Audio.hum('sight', false);
    },

    // A footstep each time the walk cycle crosses zero.
    footsteps(play) {
      const p = play.player;
      const s = Math.sin(p.walk || 0) >= 0 ? 1 : -1;
      if (p.moving && !p.down && !p.hidden && this.stepSign && s !== this.stepSign) {
        const m = Amb().maps[play.ctx.mapName];
        const surface = m && m.surface;
        if (surface && p.form === 'human') Audio.play('step', { surface });
        else if (surface && p.form === 'manhattan' && ++this.stepCount % 2 === 0) Audio.play('step', { surface, form: 'manhattan' });
      }
      this.stepSign = s;
    },

    // ---- events -----------------------------------------------------------------
    onDown(ev) {
      if (!ev || !ev.human) return;
      if (ev.lethal) {
        Audio.play('unmade');
        this.dipT = DIP_TIME;
        this.caps.dip = DIP_FILTER;
        this.applyCaps();
      } else {
        Audio.play('ko');
        Audio.play('spared');
      }
    },
    onBegin(e) {
      this.stageKey = null;
      this.cue = null;
      this.low = false;
      this.dipT = 0;
      this.caps.low = this.caps.dip = this.caps.down = null;
      this.stepSign = 0;
      this.applyCaps();
      // Straight away, so a stage cue cancels Play.begin's chapter track before it lands.
      if (e && e.scene && e.scene.ctx) this.applyStage(e.scene, true);
    },
  };

  const guard = (fn) => (arg) => {
    try {
      fn(arg);
    } catch (e) {
      Director.lastError = String((e && e.stack) || e);
    }
  };
  DM.Events.on('enemy:down', guard((ev) => Director.onDown(ev)));
  DM.Events.on('play:begin', guard((e) => Director.onBegin(e)));
  DM.Events.on('player:down', guard(() => {
    Director.stopDanger();
    Director.caps.down = DOWN_FILTER;
    Director.applyCaps();
  }));
  // Story events with a track of their own (Veidt yielding -> 'reflect').
  for (const name of Object.keys(Amb().events || {})) {
    DM.Events.on(name, guard(() => {
      const id = Amb().events[name];
      Audio.music.play(id);
      Director.cue = id;
    }));
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Director.last ? Math.min(0.1, Math.max(0, (ts - Director.last) / 1000)) : 1 / 60;
    Director.last = ts;
    try {
      Director.frame(dt);
    } catch (e) {
      Director.lastError = String((e && e.stack) || e);
    }
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(loop);

  DM.AudioDirector = Director;
})();
