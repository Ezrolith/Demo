/*
 * Audio: every sound is synthesised with the Web Audio API, so the game ships
 * with zero audio files. Four parts:
 *   - SFX: named recipes built from tones and filtered noise (Audio.play).
 *   - Hums: sustained voices kept alive while a condition holds (Audio.hum).
 *   - Ambience: a looping bed of wind, drones and random events per place
 *     (Audio.ambience; the beds are data in src/data/ambience.js).
 *   - Music: a small step sequencer that plays minimalist, Philip Glass-style
 *     arpeggio tracks defined as data in src/data/music.js. Layers fade in and
 *     out with Music.intensity, and track changes land on the beat.
 *
 * Routing:  sfxBus -> sfxFilter (Temporal Sight muffles it) -> master
 *           uiBus (menus, typing, cues that must stay clear) -> master
 *           ambBus (bed; ducked under Sight and Pause) -> master
 *           musicBus -> duckGain (dialogue) -> musicFilter -> master
 *           master -> compressor -> speakers
 * Each bus has its own echo, so volume and mute reach the echo tails too.
 *
 * Browsers only allow sound after a user gesture, so Audio.unlock() is called
 * from the first click/keypress. Every call is a safe no-op before that, and
 * nothing in here may throw into the game.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dbToGain = (db) => Math.pow(10, (db || 0) / 20);

  const MUSIC_OPEN = 18000; // the music lowpass when nothing muffles it
  const SFX_OPEN = 18000;
  const SFX_SIGHT_MIN = 1800; // the darkest Temporal Sight makes the effects
  const DUCK = 0.5; // music level under dialogue and captions

  // A short loop for the 'sight' hum: a pocket-watch tick and tock (3200 / 2600 Hz) at 1.25 Hz.
  function tickLoop(c) {
    const sr = c.sampleRate;
    const len = Math.round(sr * 1.6);
    const buf = c.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (const [at, f] of [[0, 3200], [0.8, 2600]]) {
      const i0 = Math.round(at * sr);
      const n = Math.round(0.03 * sr);
      for (let i = 0; i < n && i0 + i < len; i++) {
        const t = i / sr;
        d[i0 + i] = (Math.sin(2 * Math.PI * f * t) * 0.65 + (Math.random() * 2 - 1) * 0.35) * Math.exp(-t / 0.004);
      }
    }
    return buf;
  }

  // A feedback delay (0.36 s, filtered), returning its input node.
  function makeEcho(c, out, level) {
    const input = c.createGain();
    const delay = c.createDelay(1.0);
    delay.delayTime.value = 0.36;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    input.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    const wet = c.createGain();
    wet.gain.value = level;
    lp.connect(wet);
    wet.connect(out);
    return input;
  }

  const Audio = {
    ctx: null,
    volumes: { music: 0.6, sfx: 0.8, ambience: null }, // ambience null: read Save.settings.ambience
    muted: false,
    last: {},
    hums: {},
    timeScale: 1, // the world's time scale, copied in by the audio director
    bendK: 1, // time scale applied to the recipe being played (1 for UI sounds)
    route: null, // destination override while a recipe plays (UI bus, an ambience voice)
    echoRoute: null,
    musicBase: MUSIC_OPEN, // what setMusicFilter asked for
    musicCap: null, // a ceiling from the director (low coherence, decoherence, a death)
    ambDuck: 1,
    ducked: false,
    amb: { id: null, live: false, voices: [], events: [] },

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.build();
      } catch (e) {
        this.ctx = null; // no sound, but the game goes on
        return;
      }
      this.applyVolumes();
      Music.attach(this);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend().catch(() => {});
        else this.ctx.resume().catch(() => {});
      });
    },

    build() {
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.compressor = comp;

      // Music: track gains -> musicBus -> duck -> lowpass -> master.
      this.musicBus = c.createGain();
      this.duckGain = c.createGain();
      this.musicFilter = c.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = MUSIC_OPEN;
      this.musicBus.connect(this.duckGain);
      this.duckGain.connect(this.musicFilter);
      this.musicFilter.connect(this.master);
      // Tracks send to the echo before their volume, so it returns louder (x1.5)
      // into musicBus to match the old level at the default 60% music volume.
      this.echoSend = makeEcho(c, this.musicBus, 1.5);

      // Effects: sfxBus -> lowpass (Temporal Sight) -> master. UI skips the lowpass.
      this.sfxBus = c.createGain();
      this.sfxFilter = c.createBiquadFilter();
      this.sfxFilter.type = 'lowpass';
      this.sfxFilter.frequency.value = SFX_OPEN;
      this.sfxFilter.Q.value = 0.5;
      this.sfxF = SFX_OPEN;
      this.sfxBus.connect(this.sfxFilter);
      this.sfxFilter.connect(this.master);
      this.sfxEchoIn = makeEcho(c, this.sfxBus, 0.55);
      this.uiBus = c.createGain();
      this.uiBus.connect(this.master);

      // Ambience: ambBus -> master.
      this.ambBus = c.createGain();
      this.ambBus.gain.value = 0;
      this.ambBus.connect(this.master);
      this.ambEchoIn = makeEcho(c, this.ambBus, 0.55);

      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // A longer, odd-length noise for the ambience beds, so the 1 s loop never shows.
      const alen = Math.round(c.sampleRate * 4.73);
      this.ambNoise = c.createBuffer(1, alen, c.sampleRate);
      const ad = this.ambNoise.getChannelData(0);
      for (let i = 0; i < alen; i++) ad[i] = Math.random() * 2 - 1;
    },

    // A node is usable only inside this context (tests render recipes into an
    // OfflineAudioContext through an object that inherits from this one).
    own(n) {
      return n && this.ctx && n.context === this.ctx ? n : null;
    },

    setVolumes(v) {
      Object.assign(this.volumes, v);
      this.applyVolumes();
    },
    ambienceVolume() {
      const v = this.volumes.ambience;
      if (typeof v === 'number') return v;
      const s = DM.Save && DM.Save.settings;
      return s && typeof s.ambience === 'number' ? s.ambience : 0.7;
    },
    applyVolumes() {
      if (!this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const m = this.muted ? 0 : 1;
        this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.6 * m, t, 0.05);
        this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * 0.9 * m, t, 0.05);
        this.uiBus.gain.setTargetAtTime(this.volumes.sfx * 0.9 * m, t, 0.05);
        this.ambBus.gain.setTargetAtTime(this.ambienceVolume() * this.volumes.sfx * this.ambDuck * m, t, 0.3);
      } catch (e) {
        /* sound must never break the game */
      }
    },
    toggleMute() {
      this.muted = !this.muted;
      this.applyVolumes();
      return this.muted;
    },

    // The music lowpass is min(what setMusicFilter asked for, the director's cap):
    // Pause and Temporal Sight set the first, danger states the second, and
    // neither overwrites the other.
    setMusicFilter(freq, time = 0.25) {
      this.musicBase = freq;
      this.applyMusicFilter(time);
    },
    setMusicCap(freq, time = 0.25) {
      const f = freq || null;
      if (f === this.musicCap) return;
      this.musicCap = f;
      this.applyMusicFilter(time);
    },
    applyMusicFilter(time) {
      if (!this.ctx) return;
      const f = Math.min(this.musicBase, this.musicCap || MUSIC_OPEN);
      this.musicF = f;
      try {
        this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, time);
      } catch (e) {
        /* ignore */
      }
    },
    // Music sits back while someone is talking.
    duck(on) {
      on = !!on;
      if (on === this.ducked) return;
      this.ducked = on;
      if (!this.ctx) return;
      try {
        this.duckGain.gain.setTargetAtTime(on ? DUCK : 1, this.ctx.currentTime, 0.25);
      } catch (e) {
        /* ignore */
      }
    },
    // Temporal Sight bends the effects: recipes play lower and longer (see
    // tone/noise), and the sfx lowpass closes to 18 kHz x k^2 (at least 1.8 kHz).
    setTimeScale(k) {
      k = clamp(k == null || !isFinite(k) ? 1 : k, 0.05, 1);
      this.timeScale = k;
      if (!this.ctx) return;
      const f = k > 0.97 ? SFX_OPEN : Math.max(SFX_SIGHT_MIN, SFX_OPEN * k * k);
      if (Math.abs(f - this.sfxF) <= this.sfxF * 0.02) return;
      this.sfxF = f;
      try {
        this.sfxFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
      } catch (e) {
        /* ignore */
      }
    },
    setAmbienceDuck(k) {
      if (Math.abs(k - this.ambDuck) < 0.01) return;
      this.ambDuck = k;
      this.applyVolumes();
    },

    // ---- primitives -------------------------------------------------------
    // tone({ freq, freqEnd, dur, gain, type, attack, delay, detune, filter, echo, am, dest })
    tone(o) {
      const c = this.ctx;
      const k = this.bendK;
      const pm = k < 0.995 ? 0.55 + 0.45 * k : 1; // pitch under Temporal Sight
      const tm = k < 0.995 ? 1 / (0.5 + 0.5 * k) : 1; // and length
      const t0 = c.currentTime + (o.delay || 0) * tm;
      const dur = (o.dur || 0.2) * tm;
      const osc = c.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime((o.freq || 440) * pm, t0);
      if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd * pm), t0 + dur);
      if (o.detune) osc.detune.value = o.detune;
      const g = c.createGain();
      const peak = Math.max(0.0002, o.gain == null ? 0.2 : o.gain);
      const a = o.attack == null ? 0.005 : o.attack;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, a + 0.01));
      let node = osc;
      if (o.filter) {
        const f = c.createBiquadFilter();
        f.type = o.filter.type || 'lowpass';
        f.frequency.setValueAtTime(o.filter.freq || 2000, t0);
        if (o.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(10, o.filter.freqEnd), t0 + dur);
        f.Q.value = o.filter.q || 0.7;
        osc.connect(f);
        node = f;
      }
      if (o.am) {
        // Amplitude modulation (a cricket's trill): a square LFO gates the tone.
        const lfo = c.createOscillator();
        lfo.type = o.am.type || 'square';
        lfo.frequency.value = o.am.rate || 28;
        const depth = c.createGain();
        depth.gain.value = 0.5;
        const gate = c.createGain();
        gate.gain.value = 0.5;
        lfo.connect(depth);
        depth.connect(gate.gain);
        node.connect(gate);
        node = gate;
        lfo.start(t0);
        lfo.stop(t0 + dur + 0.05);
      }
      node.connect(g);
      g.connect(o.dest || this.route || this.sfxBus);
      this.sendEcho(g, o.echo);
      osc.start(t0);
      osc.stop(t0 + Math.max(dur, a + 0.01) + 0.05);
    },
    // noise({ dur, gain, ftype, freq, freqEnd, q, attack, delay, echo, dest })
    noise(o) {
      const c = this.ctx;
      const k = this.bendK;
      const fm = k < 0.995 ? 0.6 + 0.4 * k : 1;
      const tm = k < 0.995 ? 1 / (0.5 + 0.5 * k) : 1;
      const t0 = c.currentTime + (o.delay || 0) * tm;
      const dur = (o.dur || 0.2) * tm;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = o.ftype || 'lowpass';
      f.frequency.setValueAtTime((o.freq || 3000) * fm, t0);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(10, o.freqEnd * fm), t0 + dur);
      f.Q.value = o.q || 0.8;
      const g = c.createGain();
      const peak = Math.max(0.0002, o.gain == null ? 0.2 : o.gain);
      const a = o.attack == null ? 0.003 : o.attack;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, a + 0.01));
      src.connect(f);
      f.connect(g);
      g.connect(o.dest || this.route || this.sfxBus);
      this.sendEcho(g, o.echo);
      src.start(t0, Math.random() * 0.5);
      src.stop(t0 + Math.max(dur, a + 0.01) + 0.05);
    },
    sendEcho(g, amount) {
      if (!amount) return;
      const e = this.own(this.echoRoute || this.sfxEchoIn);
      if (!e) return;
      const s = this.ctx.createGain();
      s.gain.value = amount;
      g.connect(s);
      s.connect(e);
    },

    play(name, opts) {
      const c = this.ctx;
      if (!c || this.muted || c.state !== 'running') return;
      const def = SFX[name];
      if (!def) return;
      const now = c.currentTime;
      const gap = def.gap == null ? 0.02 : def.gap;
      const last = this.last[name];
      if (last != null && now - last < gap) return;
      this.last[name] = now;
      const o = opts || {};
      const ui = !!(def.ui || o.ui);
      this.bendK = ui ? 1 : clamp(this.timeScale || 1, 0.05, 1);
      this.route = ui ? this.own(this.uiBus) : null;
      try {
        def.fn(this, o);
      } catch (e) {
        /* sound must never break the game */
      } finally {
        this.bendK = 1;
        this.route = null;
      }
    },
    // New recipes from other modules: Audio.define('name', { gap, ui, fn(audio, opts) }).
    define(name, def) {
      if (typeof def === 'function') def = { fn: def };
      if (name && def && typeof def.fn === 'function') SFX[name] = def;
      return this;
    },
    has(name) {
      return !!SFX[name];
    },

    // ---- hums ---------------------------------------------------------------
    // Sustained sounds (telekinesis, danger, Temporal Sight). Call every frame
    // with on=true; repeated calls update freq / freq2 / gain / mod live.
    //   kind 'tone' (default): o.type osc at o.freq + o.type2 osc at o.freq2 -> lowpass o.cutoff
    //   kind 'noise': filtered noise (o.freq, o.q), gated by a square LFO at o.gate Hz
    //   kind 'sight': a 55 Hz sine with slow vibrato and a ticking pocket watch (on the UI bus)
    hum(id, on, o = {}) {
      if (!this.ctx) return;
      try {
        this.humNow(id, on, o);
      } catch (e) {
        /* sound must never break the game */
      }
    },
    humNow(id, on, o) {
      let h = this.hums[id];
      const c = this.ctx;
      const now = c.currentTime;
      if (on && !h) {
        h = this.hums[id] = this.buildHum(o);
        h.g.gain.setTargetAtTime(Math.max(0.0001, h.gain), now, 0.08);
      } else if (!on && h) {
        h.g.gain.setTargetAtTime(0.0001, now, 0.06);
        for (const s of h.srcs) s.stop(now + 0.4);
        delete this.hums[id];
        return;
      }
      if (!on || !h) return;
      if (o.freq != null && h.osc && Math.abs(o.freq - h.freq) > h.freq * 0.005) {
        h.freq = o.freq;
        h.osc.frequency.setTargetAtTime(o.freq, now, 0.05);
      }
      if (o.freq2 != null && h.osc2 && Math.abs(o.freq2 - h.freq2) > h.freq2 * 0.005) {
        h.freq2 = o.freq2;
        h.osc2.frequency.setTargetAtTime(o.freq2, now, 0.05);
      }
      if (o.gain != null && Math.abs(o.gain - h.gain) > Math.max(0.0004, h.gain * 0.03)) {
        h.gain = o.gain;
        h.g.gain.setTargetAtTime(Math.max(0.0001, o.gain), now, 0.08);
      }
      if (o.mod != null && h.f) {
        const f = h.cutoff * (1 + o.mod);
        if (Math.abs(f - h.fNow) > h.fNow * 0.01) {
          h.fNow = f;
          h.f.frequency.setTargetAtTime(f, now, 0.05);
        }
      }
    },
    buildHum(o) {
      const c = this.ctx;
      const g = c.createGain();
      g.gain.value = 0.0001;
      const h = { g, srcs: [], kind: o.kind || 'tone' };
      if (h.kind === 'sight') {
        h.gain = o.gain == null ? 1 : o.gain;
        const osc = c.createOscillator();
        osc.frequency.value = 55;
        const vib = c.createOscillator();
        vib.frequency.value = 0.3;
        const vd = c.createGain();
        vd.gain.value = 2.5;
        vib.connect(vd);
        vd.connect(osc.frequency);
        const dg = c.createGain();
        dg.gain.value = 0.03;
        osc.connect(dg);
        dg.connect(g);
        const tick = c.createBufferSource();
        tick.buffer = this.sightTicks || (this.sightTicks = tickLoop(c));
        tick.loop = true;
        const tg = c.createGain();
        tg.gain.value = 0.08;
        tick.connect(tg);
        tg.connect(g);
        g.connect(this.uiBus || this.sfxBus);
        h.srcs.push(osc, vib, tick);
      } else if (h.kind === 'noise') {
        h.gain = o.gain != null ? o.gain : 0.02;
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = c.createBiquadFilter();
        f.type = o.ftype || 'bandpass';
        f.frequency.value = o.freq || 3500;
        f.Q.value = o.q || 1.2;
        const gate = c.createGain();
        gate.gain.value = 0.5;
        const lfo = c.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = o.gate || 25;
        const depth = c.createGain();
        depth.gain.value = 0.5;
        lfo.connect(depth);
        depth.connect(gate.gain);
        src.connect(f);
        f.connect(gate);
        gate.connect(g);
        g.connect(this.sfxBus);
        h.srcs.push(src, lfo);
      } else {
        h.gain = o.gain != null ? o.gain : 0.05;
        h.freq = o.freq || 80;
        h.freq2 = o.freq2 || h.freq * 1.501;
        const osc = c.createOscillator();
        osc.type = o.type || 'sawtooth';
        osc.frequency.value = h.freq;
        const osc2 = c.createOscillator();
        osc2.type = o.type2 || 'sine';
        osc2.frequency.value = h.freq2;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.cutoff || 500;
        f.Q.value = 4;
        osc.connect(f);
        osc2.connect(f);
        f.connect(g);
        g.connect(this.sfxBus);
        Object.assign(h, { osc, osc2, f, cutoff: o.cutoff || 500, fNow: o.cutoff || 500 });
        h.srcs.push(osc, osc2);
      }
      for (const s of h.srcs) s.start();
      return h;
    },
    stopHums() {
      for (const id of Object.keys(this.hums)) this.hum(id, false);
    },

    // ---- ambience -----------------------------------------------------------
    // Crossfade to the bed `id` from DM.Ambience.beds (null = silence). Safe to
    // call every frame; before unlock it only records the wish.
    ambience(id, fade = 1.5) {
      id = id || null;
      const a = this.amb;
      if (a.id === id && (a.live || !id || !this.ctx)) return;
      const next = { id, live: false, voices: [], events: [] };
      try {
        if (a.live) this.ambRelease(a);
        this.amb = next;
        const bed = id && DM.Ambience && DM.Ambience.beds[id];
        if (!bed || !this.ctx) return;
        for (const L of bed.layers || []) this.ambLayer(next, L, fade);
        next.live = true;
        if (!this.ambTimer) this.ambTimer = setInterval(() => this.ambTick(), 250);
      } catch (e) {
        this.amb = next;
      }
    },
    ambRelease(a) {
      const now = this.ctx.currentTime;
      a.live = false;
      a.events.length = 0;
      for (const v of a.voices) {
        v.out.gain.setTargetAtTime(0.0001, now, 0.5);
        for (const s of v.srcs) s.stop(now + 3);
        setTimeout(() => v.out.disconnect(), 3500);
      }
    },
    ambLayer(a, L, fade) {
      const c = this.ctx;
      const now = c.currentTime;
      const out = c.createGain();
      out.gain.setValueAtTime(0.0001, now);
      out.gain.setTargetAtTime(1, now, Math.max(0.05, fade / 3));
      out.connect(this.ambBus);
      const v = { out, srcs: [] };
      a.voices.push(v);
      const lfoTo = (lfo, param, base) => {
        // A slow sine LFO on gain and/or filter frequency (+-depth of the base value).
        const osc = c.createOscillator();
        osc.frequency.value = lfo.rate * rand(0.85, 1.15);
        for (const [p, b, depth] of param) {
          if (!depth) continue;
          const dg = c.createGain();
          dg.gain.value = b * depth;
          osc.connect(dg);
          dg.connect(p);
        }
        osc.start(now);
        v.srcs.push(osc);
        return osc;
      };
      if (L.kind === 'wind') {
        const src = c.createBufferSource();
        src.buffer = this.ambNoise || this.noiseBuf;
        src.loop = true;
        src.playbackRate.value = rand(0.92, 1.08);
        const f = c.createBiquadFilter();
        f.type = L.ftype || 'bandpass';
        f.frequency.value = L.freq || 450;
        f.Q.value = L.q || 0.7;
        const g = c.createGain();
        g.gain.value = L.gain || 0.01;
        src.connect(f);
        f.connect(g);
        g.connect(out);
        src.start(now, rand(0, 4));
        v.srcs.push(src);
        if (L.lfo) lfoTo(L.lfo, [[g.gain, L.gain || 0.01, L.lfo.depth], [f.frequency, L.freq || 450, L.lfo.fdepth]]);
        if (L.lfo2) lfoTo(L.lfo2, [[g.gain, L.gain || 0.01, L.lfo2.depth], [f.frequency, L.freq || 450, L.lfo2.fdepth]]);
      } else if (L.kind === 'drone') {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = L.cutoff || 800;
        const g = c.createGain();
        g.gain.value = L.gain || 0.01;
        f.connect(g);
        g.connect(out);
        for (const O of L.oscs || []) {
          const osc = c.createOscillator();
          osc.type = O.wave || 'sine';
          osc.frequency.value = O.f;
          if (O.detune) osc.detune.value = O.detune;
          const og = c.createGain();
          og.gain.value = O.g == null ? 1 : O.g;
          osc.connect(og);
          og.connect(f);
          osc.start(now);
          v.srcs.push(osc);
        }
        if (L.lfo) lfoTo(L.lfo, [[g.gain, L.gain || 0.01, L.lfo.depth]]);
      } else if (L.kind === 'events') {
        const g = c.createGain();
        g.gain.value = L.gain == null ? 1 : L.gain;
        g.connect(out);
        const first = L.first || L.every || [2, 5];
        a.events.push({ L, dest: g, next: now + rand(first[0], first[1]) });
      }
    },
    // Random one-shots for the current bed, scheduled a little ahead.
    ambTick() {
      const c = this.ctx;
      const a = this.amb;
      if (!c || c.state !== 'running' || !a.live || this.muted) return;
      const now = c.currentTime;
      for (const ev of a.events) {
        if (ev.next > now + 0.3) continue;
        if (ev.next < now - 1) ev.next = now; // the tab slept: no backlog
        const def = SFX[ev.L.sound];
        if (def) {
          this.route = ev.dest;
          this.echoRoute = this.ambEchoIn;
          this.bendK = 1;
          try {
            def.fn(this, Object.assign({ delay: Math.max(0, ev.next - now) }, ev.L.opts));
          } catch (e) {
            /* ignore */
          } finally {
            this.route = null;
            this.echoRoute = null;
          }
        }
        ev.next += rand(ev.L.every[0], ev.L.every[1]);
      }
    },
  };

  // ---- SFX recipes --------------------------------------------------------
  // { gap: min seconds between plays, ui: true = never bent by Temporal Sight
  //   and routed past the sfx lowpass, fn(audio, opts) }
  const d0 = (o) => o.delay || 0; // ambience events pass their scheduled offset

  // Footsteps by surface; v scales gain, p scales pitch (both randomised per step).
  const STEPS = {
    concrete(a, v, p) {
      a.noise({ dur: 0.035, gain: 0.07 * v, ftype: 'bandpass', freq: 1400 * p, q: 1.5 });
      a.tone({ freq: 140 * p, freqEnd: 90 * p, dur: 0.04, gain: 0.05 * v, type: 'sine' });
    },
    sand(a, v, p) {
      a.noise({ dur: 0.07, gain: 0.07 * v, ftype: 'lowpass', freq: 900 * p, attack: 0.008 });
    },
    snow(a, v, p) {
      for (let i = 0; i < 3; i++) a.noise({ dur: 0.022, gain: 0.05 * v, ftype: 'bandpass', freq: 2500 * p * rand(0.9, 1.1), q: 1.6, delay: i * 0.028 + rand(0, 0.008) });
    },
    wood(a, v, p) {
      a.tone({ freq: 220 * p, dur: 0.03, gain: 0.04 * v, type: 'triangle' });
      a.noise({ dur: 0.04, gain: 0.06 * v, ftype: 'bandpass', freq: 700 * p, q: 1.4 });
    },
    dust(a, v, p) {
      a.noise({ dur: 0.06, gain: 0.05 * v, ftype: 'lowpass', freq: 600 * p, attack: 0.006 });
    },
  };

  const SFX = {
    ui_move: { gap: 0.03, ui: true, fn: (a) => a.tone({ freq: 880, dur: 0.06, gain: 0.05, type: 'triangle' }) },
    ui_select: {
      ui: true,
      fn: (a) => {
        a.tone({ freq: 523, dur: 0.12, gain: 0.08, type: 'triangle' });
        a.tone({ freq: 784, dur: 0.2, gain: 0.07, type: 'triangle', delay: 0.06 });
      },
    },
    ui_back: { ui: true, fn: (a) => a.tone({ freq: 520, freqEnd: 330, dur: 0.14, gain: 0.07, type: 'triangle' }) },
    type: { gap: 0.045, ui: true, fn: (a) => a.noise({ dur: 0.025, gain: 0.03, ftype: 'highpass', freq: 3500 }) },
    tick: { gap: 0.1, ui: true, fn: (a, o) => a.noise({ dur: 0.035, gain: 0.09, ftype: 'bandpass', freq: o.alt ? 3200 : 4300, q: 6 }) },
    atom: {
      gap: 0.03,
      fn: (a, o) => {
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
        const i = o.i || 0;
        a.tone({ freq: mtof(69 + scale[i % scale.length]), dur: 0.4, gain: 0.045, type: 'sine' });
      },
    },
    deposit: {
      gap: 0.05,
      fn: (a) => a.tone({ freq: 330, freqEnd: 660, dur: 0.18, gain: 0.05, type: 'triangle' }),
    },
    layer: {
      fn: (a) => {
        [57, 64, 69, 73, 76].forEach((n, i) => a.tone({ freq: mtof(n), dur: 2.2, gain: 0.06, type: 'sine', attack: 0.05, delay: i * 0.09 }));
      },
    },
    tk_grab: { gap: 0.08, fn: (a) => a.tone({ freq: 110, freqEnd: 260, dur: 0.25, gain: 0.12, type: 'sawtooth', filter: { freq: 700 } }) },
    // A heave and a rush of air, as loud as a disintegration at full speed (opts.speed from tkRelease).
    throw: {
      gap: 0.08,
      fn: (a, o) => {
        const s = clamp((o.speed || 700) / 700, 0.5, 1.2);
        a.noise({ dur: 0.35, gain: 0.5 * s, ftype: 'bandpass', freq: 300, freqEnd: 2600, q: 0.9, attack: 0.02 });
        a.tone({ freq: 160, freqEnd: 70, dur: 0.25, gain: 0.22 * s, type: 'sine', attack: 0.01 });
        a.tone({ freq: 320, freqEnd: 140, dur: 0.18, gain: 0.05 * s, type: 'triangle' });
      },
    },
    dis_charge: { gap: 0.05, fn: (a) => a.tone({ freq: 300, freqEnd: 1800, dur: 0.16, gain: 0.06, type: 'sine' }) },
    disintegrate: {
      gap: 0.04,
      fn: (a) => {
        a.noise({ dur: 0.5, gain: 0.26, ftype: 'highpass', freq: 1500, freqEnd: 300 });
        a.tone({ freq: 1400, freqEnd: 60, dur: 0.45, gain: 0.1, type: 'sawtooth', filter: { freq: 3000, freqEnd: 200 } });
      },
    },
    // A cast that unmade nothing: only the rush, so a real unmaking stands out.
    dis_miss: { gap: 0.04, fn: (a) => a.noise({ dur: 0.4, gain: 0.14, ftype: 'highpass', freq: 1500, freqEnd: 300 }) },
    // Telekinesis lost its grip for want of energy.
    fizzle: {
      gap: 0.15,
      fn: (a) => {
        a.noise({ dur: 0.3, gain: 0.09, ftype: 'bandpass', freq: 2500, freqEnd: 600, q: 2 });
        a.tone({ freq: 520, freqEnd: 180, dur: 0.25, gain: 0.05, type: 'triangle' });
        for (let i = 0; i < 4; i++) a.noise({ dur: 0.012, gain: 0.05, ftype: 'highpass', freq: 4000, delay: 0.04 + i * 0.05 + rand(0, 0.02) });
      },
    },
    teleport: {
      gap: 0.05,
      fn: (a) => {
        a.tone({ freq: 220, freqEnd: 1760, dur: 0.22, gain: 0.1, type: 'sine' });
        a.noise({ dur: 0.25, gain: 0.07, ftype: 'bandpass', freq: 3000, freqEnd: 7000, q: 3 });
      },
    },
    duplicate: {
      fn: (a) => {
        [0, 4, 7, 12].forEach((n, i) => a.tone({ freq: mtof(64 + n), dur: 0.9, gain: 0.05, type: 'triangle', delay: i * 0.05, detune: (i - 1.5) * 9 }));
      },
    },
    timesight_on: {
      ui: true,
      fn: (a) => {
        a.tone({ freq: 420, freqEnd: 55, dur: 0.8, gain: 0.12, type: 'sine' });
        a.noise({ dur: 0.6, gain: 0.05, ftype: 'lowpass', freq: 2400, freqEnd: 200 });
      },
    },
    timesight_off: { ui: true, fn: (a) => a.tone({ freq: 70, freqEnd: 380, dur: 0.35, gain: 0.08, type: 'sine' }) },
    expand: {
      fn: (a) => {
        a.tone({ freq: 90, freqEnd: 28, dur: 1.3, gain: 0.3, type: 'sine' });
        a.noise({ dur: 1.0, gain: 0.25, ftype: 'lowpass', freq: 600, freqEnd: 60 });
        // Body that survives small speakers.
        a.tone({ freq: 180, freqEnd: 55, dur: 1.1, gain: 0.16, type: 'sawtooth', filter: { freq: 900, freqEnd: 300 }, attack: 0.02 });
        a.noise({ dur: 0.7, gain: 0.12, ftype: 'bandpass', freq: 420, freqEnd: 160, q: 0.9 });
      },
    },
    shot: {
      gap: 0.035,
      fn: (a) => {
        a.noise({ dur: 0.12, gain: 0.15, ftype: 'lowpass', freq: 2600, freqEnd: 400 });
        a.tone({ freq: 170, freqEnd: 50, dur: 0.08, gain: 0.08, type: 'square' });
      },
    },
    pulse: { gap: 0.04, fn: (a) => a.tone({ freq: 900, freqEnd: 280, dur: 0.12, gain: 0.05, type: 'square', filter: { freq: 2200 } }) },
    bolt: { gap: 0.04, fn: (a) => a.tone({ freq: 1600, freqEnd: 500, dur: 0.12, gain: 0.04, type: 'triangle' }) },
    hit: {
      gap: 0.06,
      fn: (a) => {
        a.noise({ dur: 0.1, gain: 0.12, ftype: 'bandpass', freq: 1200, q: 2 });
        a.tone({ freq: 220, freqEnd: 110, dur: 0.12, gain: 0.07, type: 'square', filter: { freq: 1200 } });
      },
    },
    impact: {
      gap: 0.05,
      fn: (a) => {
        a.noise({ dur: 0.2, gain: 0.2, ftype: 'lowpass', freq: 900, freqEnd: 120 });
        a.tone({ freq: 95, freqEnd: 40, dur: 0.16, gain: 0.14, type: 'sine' });
        a.tone({ freq: 190, freqEnd: 90, dur: 0.12, gain: 0.08, type: 'triangle' });
      },
    },
    explosion: {
      gap: 0.06,
      fn: (a) => {
        a.noise({ dur: 1.1, gain: 0.32, ftype: 'lowpass', freq: 1800, freqEnd: 70 });
        a.tone({ freq: 75, freqEnd: 25, dur: 0.8, gain: 0.22, type: 'sine' });
        a.tone({ freq: 150, freqEnd: 60, dur: 0.5, gain: 0.2, type: 'triangle' });
        a.noise({ dur: 0.45, gain: 0.3, ftype: 'bandpass', freq: 400, freqEnd: 220, q: 1 });
      },
    },
    alarm: {
      gap: 0.85,
      fn: (a) => {
        a.tone({ freq: 660, dur: 0.38, gain: 0.06, type: 'square', filter: { freq: 1600 } });
        a.tone({ freq: 520, dur: 0.38, gain: 0.06, type: 'square', delay: 0.42, filter: { freq: 1600 } });
      },
    },
    door: {
      gap: 0.2,
      fn: (a) => {
        a.noise({ dur: 0.6, gain: 0.3, ftype: 'lowpass', freq: 400, freqEnd: 60 });
        a.tone({ freq: 70, freqEnd: 38, dur: 0.5, gain: 0.2, type: 'sine' });
        a.tone({ freq: 140, freqEnd: 70, dur: 0.45, gain: 0.16, type: 'triangle' });
        a.noise({ dur: 0.35, gain: 0.14, ftype: 'bandpass', freq: 520, freqEnd: 240, q: 1.2 });
      },
    },
    success: {
      ui: true,
      fn: (a) => [60, 64, 67, 72].forEach((n, i) => a.tone({ freq: mtof(n + 12), dur: 0.5, gain: 0.06, type: 'triangle', delay: i * 0.08 })),
    },
    objective: {
      ui: true,
      fn: (a) => {
        a.tone({ freq: mtof(76), dur: 0.25, gain: 0.06, type: 'triangle' });
        a.tone({ freq: mtof(83), dur: 0.4, gain: 0.06, type: 'triangle', delay: 0.1 });
      },
    },
    fail: { gap: 0.3, ui: true, fn: (a) => a.tone({ freq: 200, freqEnd: 130, dur: 0.2, gain: 0.06, type: 'square', filter: { freq: 900 } }) },
    unlock: {
      ui: true,
      fn: (a) => {
        [45, 52, 57, 61, 64, 69].forEach((n, i) => a.tone({ freq: mtof(n), dur: 2.6, gain: 0.07, type: 'sine', attack: 0.25, delay: i * 0.07 }));
        a.noise({ dur: 2, gain: 0.04, ftype: 'highpass', freq: 6000, attack: 0.5 });
      },
    },
    flash: {
      fn: (a) => {
        a.noise({ dur: 3, gain: 0.35, ftype: 'lowpass', freq: 9000, freqEnd: 150, attack: 0.8 });
        a.tone({ freq: 50, freqEnd: 30, dur: 3, gain: 0.25, type: 'sine', attack: 0.6 });
        a.noise({ dur: 2.4, gain: 0.1, ftype: 'bandpass', freq: 600, freqEnd: 250, q: 1, attack: 0.7 });
      },
    },
    meteor: { gap: 0.2, fn: (a) => a.tone({ freq: 2400, freqEnd: 260, dur: 0.9, gain: 0.04, type: 'sine' }) },
    shield: { gap: 0.08, fn: (a) => a.tone({ freq: 1300, freqEnd: 800, dur: 0.15, gain: 0.06, type: 'triangle' }) },
    gear: {
      gap: 0.03,
      fn: (a) => {
        a.noise({ dur: 0.04, gain: 0.12, ftype: 'bandpass', freq: 2600, q: 5 });
        a.tone({ freq: 1900, dur: 0.06, gain: 0.04, type: 'triangle' });
      },
    },
    miss: { gap: 0.15, fn: (a) => a.tone({ freq: 160, dur: 0.18, gain: 0.07, type: 'square', filter: { freq: 700 } }) },
    zap: {
      gap: 0.1,
      fn: (a) => {
        a.noise({ dur: 0.7, gain: 0.25, ftype: 'bandpass', freq: 2000, freqEnd: 300, q: 1.5 });
        a.tone({ freq: 900, freqEnd: 90, dur: 0.6, gain: 0.1, type: 'sawtooth', filter: { freq: 2500 } });
      },
    },
    snap: { gap: 0.05, fn: (a) => [79, 86].forEach((n, i) => a.tone({ freq: mtof(n), dur: 0.5, gain: 0.05, type: 'sine', delay: i * 0.06 })) },
    memory: { gap: 0.2, fn: (a) => [72, 76, 79, 84].forEach((n, i) => a.tone({ freq: mtof(n), dur: 1.1, gain: 0.045, type: 'sine', delay: i * 0.12 })) },
    // Missile launches and Veidt's discs: raised to about -20 dBFS so they read in a fight.
    whoosh: {
      gap: 0.1,
      fn: (a) => {
        a.noise({ dur: 0.45, gain: 0.5, ftype: 'bandpass', freq: 300, freqEnd: 1800, q: 0.9, attack: 0.05 });
        a.tone({ freq: 240, freqEnd: 120, dur: 0.3, gain: 0.04, type: 'triangle' });
      },
    },

    // ---- the spare/kill moment (played by the audio director on 'enemy:down') ----
    ko: {
      gap: 0.04,
      fn: (a) => {
        a.noise({ dur: 0.12, gain: 0.3, ftype: 'lowpass', freq: 320 });
        a.tone({ freq: 110, freqEnd: 60, dur: 0.1, gain: 0.2, type: 'sine' });
        a.tone({ freq: 210, freqEnd: 120, dur: 0.08, gain: 0.07, type: 'triangle' });
      },
    },
    spared: {
      gap: 0.25,
      fn: (a) => {
        a.tone({ freq: 659, dur: 0.18, gain: 0.04, type: 'triangle', delay: 0.12, attack: 0.01 });
        a.tone({ freq: 494, dur: 0.3, gain: 0.04, type: 'triangle', delay: 0.3, attack: 0.01 });
      },
    },
    unmade: {
      gap: 0.06,
      fn: (a) => {
        // A breath drawn in and cut off, then a minor second left hanging in the echo.
        a.noise({ dur: 0.2, gain: 0.5, ftype: 'bandpass', freq: 900, q: 8, attack: 0.18 });
        a.noise({ dur: 0.2, gain: 0.12, ftype: 'highpass', freq: 2500, attack: 0.18 });
        a.tone({ freq: 233, dur: 1.6, gain: 0.05, type: 'sine', delay: 0.2, attack: 0.04, echo: 0.6 });
        a.tone({ freq: 247, dur: 1.6, gain: 0.045, type: 'sine', delay: 0.2, attack: 0.04, echo: 0.6 });
      },
    },

    // ---- danger ------------------------------------------------------------------
    // Low coherence: a heartbeat in real time (never bent by Temporal Sight).
    beat: {
      gap: 0.3,
      ui: true,
      fn: (a) => {
        a.tone({ freq: 62, freqEnd: 45, dur: 0.09, gain: 0.25, type: 'sine' });
        a.tone({ freq: 124, freqEnd: 90, dur: 0.07, gain: 0.05, type: 'triangle' });
        a.tone({ freq: 62, freqEnd: 45, dur: 0.09, gain: 0.17, type: 'sine', delay: 0.22 });
        a.tone({ freq: 124, freqEnd: 90, dur: 0.07, gain: 0.035, type: 'triangle', delay: 0.22 });
      },
    },
    // Temporal Sight pressed while tachyons jam it: a choked burst of static.
    jammed: {
      gap: 0.3,
      fn: (a) => {
        let t = 0;
        for (let i = 0; i < 5; i++) {
          const d = rand(0.025, 0.05);
          a.noise({ dur: d, gain: 0.12, ftype: 'bandpass', freq: 2500 * rand(0.85, 1.15), q: 1.2, delay: t });
          t += d + rand(0.01, 0.03);
        }
        a.tone({ freq: 300, freqEnd: 180, dur: 0.2, gain: 0.04, type: 'square', filter: { freq: 1200 } });
      },
    },
    // A footfall; opts.surface 'concrete' | 'sand' | 'snow' | 'wood' | 'dust',
    // opts.form 'manhattan' for his faint shimmer over a light step.
    step: {
      gap: 0.1,
      fn: (a, o) => {
        const v = rand(0.8, 1.2);
        const p = rand(0.92, 1.08);
        const fn = STEPS[o.surface] || STEPS.concrete;
        if (o.form === 'manhattan') {
          a.tone({ freq: 2093 * p, dur: 0.05, gain: 0.008 * v, type: 'sine', attack: 0.004 });
          fn(a, v * 0.3, p);
        } else fn(a, v, p);
      },
    },

    // ---- enemy tells and set pieces (package C) ------------------------------------
    // Drone aiming: a rising whine.
    charge: {
      gap: 0.12,
      fn: (a) => {
        a.tone({ freq: 400, freqEnd: 1200, dur: 0.3, gain: 0.07, type: 'triangle', attack: 0.02 });
        a.tone({ freq: 800, freqEnd: 2400, dur: 0.3, gain: 0.018, type: 'sine', attack: 0.02 });
      },
    },
    // Battery about to launch: a double beep from the pods.
    pod_alarm: {
      gap: 0.3,
      fn: (a) => {
        for (const dl of [0, 0.13]) a.tone({ freq: 1320, dur: 0.07, gain: 0.06, type: 'square', delay: dl, filter: { freq: 3200 } });
      },
    },
    // Behemoth coax gun spinning up (0.6 s).
    mg_spin: {
      gap: 0.4,
      fn: (a) => {
        a.tone({ freq: 60, freqEnd: 340, dur: 0.6, gain: 0.08, type: 'sawtooth', filter: { freq: 1400 }, attack: 0.05 });
        a.noise({ dur: 0.6, gain: 0.07, ftype: 'bandpass', freq: 900, freqEnd: 2600, q: 2, attack: 0.1 });
      },
    },
    // Tank and Behemoth main gun.
    cannon: {
      gap: 0.06,
      fn: (a) => {
        a.noise({ dur: 0.35, gain: 0.3, ftype: 'lowpass', freq: 2200, freqEnd: 200 });
        a.tone({ freq: 120, freqEnd: 45, dur: 0.35, gain: 0.2, type: 'sine' });
        a.tone({ freq: 240, freqEnd: 90, dur: 0.3, gain: 0.08, type: 'triangle' });
        a.noise({ dur: 0.05, gain: 0.12, ftype: 'highpass', freq: 3000 });
      },
    },
    // Behemoth phase change: a low boom and shards of armour.
    phase: {
      gap: 0.5,
      fn: (a) => {
        a.tone({ freq: 70, freqEnd: 30, dur: 1.2, gain: 0.28, type: 'sine' });
        a.tone({ freq: 160, freqEnd: 60, dur: 0.8, gain: 0.14, type: 'triangle' });
        a.noise({ dur: 1.2, gain: 0.25, ftype: 'lowpass', freq: 900, freqEnd: 80 });
        [420, 1130, 1890, 2630].forEach((f, i) => a.tone({ freq: f * rand(0.97, 1.03), dur: 0.5 - i * 0.1, gain: 0.045, type: 'sine', delay: 0.05 + i * 0.03 }));
      },
    },
    // Veidt slips a disintegration: a quick bright sweep and a ping.
    veidt_dodge: {
      gap: 0.15,
      fn: (a) => {
        a.noise({ dur: 0.18, gain: 0.5, ftype: 'bandpass', freq: 600, freqEnd: 3000, q: 1.2, attack: 0.02 });
        a.tone({ freq: 880, freqEnd: 1320, dur: 0.18, gain: 0.06, type: 'triangle' });
      },
    },
    // Short warning beeps (a mine's fuse, a generic telegraph).
    beep: { gap: 0.08, fn: (a) => a.tone({ freq: 1760, dur: 0.06, gain: 0.06, type: 'square', filter: { freq: 3500 } }) },
    mine_beep: {
      gap: 0.08,
      fn: (a) => {
        a.tone({ freq: 1760, dur: 0.06, gain: 0.06, type: 'square', filter: { freq: 3500 } });
        a.tone({ freq: 2349, dur: 0.06, gain: 0.04, type: 'square', delay: 0.09, filter: { freq: 3500 } });
      },
    },
    // A 0.3 s wind-up (Veidt's disc, any charged attack).
    windup: {
      gap: 0.15,
      fn: (a) => {
        a.noise({ dur: 0.3, gain: 0.12, ftype: 'bandpass', freq: 500, freqEnd: 2000, q: 2, attack: 0.25 });
        a.tone({ freq: 660, freqEnd: 990, dur: 0.3, gain: 0.03, type: 'sine', attack: 0.25 });
      },
    },
    // Side hatches opening before a missile salvo.
    hatch: {
      gap: 0.2,
      fn: (a) => {
        a.noise({ dur: 0.12, gain: 0.12, ftype: 'bandpass', freq: 1200, q: 3 });
        a.tone({ freq: 180, freqEnd: 120, dur: 0.15, gain: 0.08, type: 'square', filter: { freq: 900 } });
      },
    },

    // ---- ambience one-shots (scheduled by the bed; o.delay places them) -------------
    amb_cricket: { gap: 0, fn: (a, o) => a.tone({ freq: 4200 * rand(0.97, 1.03), dur: rand(0.3, 0.6), gain: 0.006, type: 'sine', attack: 0.03, delay: d0(o), am: { rate: 28 } }) },
    amb_chime: {
      gap: 0,
      fn: (a, o) => {
        const f = pick([1046, 1175, 1318, 1568, 1760, 2093]);
        a.tone({ freq: f, dur: 2.5, gain: 0.008, type: 'sine', attack: 0.01, delay: d0(o), echo: 0.8 });
        a.tone({ freq: f * 2.76, dur: 0.9, gain: 0.002, type: 'sine', attack: 0.01, delay: d0(o) });
      },
    },
    amb_artillery: {
      gap: 0,
      fn: (a, o) => {
        a.noise({ dur: 1.4, gain: 0.06, ftype: 'lowpass', freq: 160, freqEnd: 60, attack: 0.02, delay: d0(o) });
        a.noise({ dur: 0.9, gain: 0.02, ftype: 'bandpass', freq: 300, q: 0.8, attack: 0.02, delay: d0(o) + 0.05 });
      },
    },
    amb_foghorn: {
      gap: 0,
      fn: (a, o) => {
        a.tone({ freq: 98, dur: 2.6, gain: 0.03, type: 'sine', attack: 0.4, delay: d0(o) });
        a.tone({ freq: 147, dur: 2.6, gain: 0.02, type: 'sine', attack: 0.4, delay: d0(o) });
        a.tone({ freq: 98, dur: 2.5, gain: 0.012, type: 'sawtooth', attack: 0.45, delay: d0(o), filter: { freq: 420 }, echo: 0.5 });
      },
    },
    amb_horn: {
      gap: 0,
      fn: (a, o) => {
        for (const f of [392, 466]) a.tone({ freq: f, dur: 0.35, gain: 0.004, type: 'sawtooth', attack: 0.02, delay: d0(o), filter: { freq: 900 } });
      },
    },
    amb_shutter: {
      gap: 0,
      fn: (a, o) => {
        a.noise({ dur: 0.02, gain: 0.03, ftype: 'bandpass', freq: 3000, q: 3, delay: d0(o) });
        a.noise({ dur: 0.03, gain: 0.025, ftype: 'bandpass', freq: 2400, q: 3, delay: d0(o) + 0.06 });
      },
    },
    amb_crystal: {
      gap: 0,
      fn: (a, o) => {
        const f = pick([1568, 1760, 2093, 2349, 2637, 3136]);
        a.tone({ freq: f, dur: 3, gain: 0.008, type: 'sine', attack: 0.005, delay: d0(o), echo: 0.7 });
        a.tone({ freq: f * 1.5, dur: 1.4, gain: 0.003, type: 'sine', attack: 0.005, delay: d0(o) });
      },
    },
  };

  // ---- music sequencer ----------------------------------------------------
  const FADE = 0.15; // intensity width over which a gated layer fades in
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  // How much of a layer plays at intensity I (layers with min / max fade in / out).
  function layerWeight(L, I) {
    let w = 1;
    if (L.min != null) w *= smooth((I - (L.min - FADE)) / FADE);
    if (L.max != null) w *= 1 - smooth((I - L.max) / FADE);
    return w;
  }

  const Music = {
    audio: null,
    track: null,
    trackId: null,
    queued: undefined, // requested before the audio unlocked
    switchTo: null, // { id, step } a change waiting for the old track's next beat
    intensity: 0, // smoothed (rate 1.5 up, 0.8 down); read at bar starts
    target: 0,
    barI: 0,
    attach(audio) {
      this.audio = audio;
      if (this.queued !== undefined) {
        const q = this.queued;
        this.queued = undefined;
        this.play(q, { at: 'now' });
      }
    },
    // The track that is playing or about to.
    get wanted() {
      return this.switchTo ? this.switchTo.id : this.trackId;
    },
    // play(id, { at: 'beat' | 'bar' | 'now', intensity }): changes land on the old
    // track's beat grid; asking again for the old track before then cancels it.
    play(id, o = {}) {
      id = id || null;
      if (o.intensity != null) this.setIntensity(o.intensity, true);
      const c = this.audio && this.audio.ctx;
      if (!c) {
        this.queued = id;
        return;
      }
      try {
        if (this.switchTo) {
          if (this.switchTo.id === id) return;
          if (id === this.trackId) {
            this.switchTo = null;
            return;
          }
        } else if (id === this.trackId) return;
        const at = o.at || 'beat';
        if (this.track && at !== 'now' && c.state === 'running' && this.next > c.currentTime - 0.3) {
          const tr = this.track;
          const unit = (tr.div || 4) * (at === 'bar' ? tr.beats || 4 : 1);
          this.switchTo = { id, step: this.step + ((unit - (this.step % unit)) % unit) };
          return;
        }
        this.start(id, c.currentTime + 0.15, o.fade);
      } catch (e) {
        /* music must never break the game */
      }
    },
    stop() {
      this.play(null);
    },
    setIntensity(v, snap) {
      this.target = clamp(+v || 0, 0, 1);
      if (snap) this.intensity = this.barI = this.target;
    },
    start(id, t, fade) {
      const c = this.audio.ctx;
      this.switchTo = null;
      if (this.gain) {
        const old = this.gain;
        old.gain.setTargetAtTime(0.0001, t, 0.3);
        setTimeout(() => old.disconnect(), 4000 + Math.max(0, t - c.currentTime) * 1000);
      }
      const hadTrack = !!this.track;
      this.trackId = id;
      this.track = id ? DM.MusicTracks[id] || null : null;
      this.gain = null;
      if (!this.track) return;
      this.gain = c.createGain();
      this.gain.gain.setValueAtTime(0.0001, c.currentTime);
      this.gain.gain.setTargetAtTime(dbToGain(this.track.level), t, fade || (hadTrack ? 0.2 : 0.7));
      this.gain.connect(this.audio.musicBus);
      const send = c.createGain();
      send.gain.value = this.track.echo == null ? 0.35 : this.track.echo;
      this.gain.connect(send);
      send.connect(this.audio.echoSend);
      this.step = 0;
      this.next = t;
      this.barI = this.intensity;
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 30);
    },
    schedule() {
      const c = this.audio && this.audio.ctx;
      if (!c || c.state !== 'running') return;
      try {
        const now = c.currentTime;
        const dt = Math.min(0.25, Math.max(0, now - (this.lastT == null ? now : this.lastT)));
        this.lastT = now;
        const rate = this.target > this.intensity ? 1.5 : 0.8;
        this.intensity += (this.target - this.intensity) * (1 - Math.exp(-rate * dt));
        if (!this.track) return;
        if (this.next < now - 0.3) this.next = now + 0.05;
        while (this.track && this.next < now + 0.2) {
          if (this.switchTo && this.step >= this.switchTo.step) {
            this.start(this.switchTo.id, this.next);
            continue;
          }
          const tr = this.track;
          const spStep = 60 / tr.bpm / (tr.div || 4);
          this.playStep(this.step, this.next, spStep);
          this.next += spStep;
          this.step++;
        }
      } catch (e) {
        /* ignore */
      }
    },
    playStep(step, t, spStep) {
      const tr = this.track;
      const perBar = (tr.div || 4) * (tr.beats || 4);
      const bpc = tr.barsPerChord || 1;
      const bar = Math.floor(step / perBar);
      const sib = step % perBar;
      const chord = tr.prog[Math.floor(bar / bpc) % tr.prog.length];
      const chordStart = sib === 0 && bar % bpc === 0;
      if (sib === 0) this.barI = this.intensity;
      for (const L of tr.layers) {
        if (L.from && bar < L.from) continue;
        const w = L.min != null || L.max != null ? layerWeight(L, this.barI) : 1;
        if (w < 0.02) continue;
        if (L.kind === 'arp') {
          const every = L.every || 1;
          if (sib % every) continue;
          const idx = Math.floor(step / every);
          const pi = L.pattern[idx % L.pattern.length];
          if (pi == null || pi < 0) continue;
          const n = chord[pi % chord.length] + 12 * Math.floor(pi / chord.length) + (L.oct || 0);
          this.note(n, t, spStep * every * (L.len || 1.6), L, w);
        } else if (L.kind === 'pad') {
          if (!chordStart) continue;
          const dur = spStep * perBar * bpc;
          for (const n of chord) this.note(n + (L.oct || 0), t, dur, L, w);
        } else if (L.kind === 'bass') {
          const every = L.every || perBar;
          if (sib % every === 0) this.note(chord[0] + (L.oct == null ? -12 : L.oct), t, spStep * every * 0.95, L, w);
        } else if (L.kind === 'tick') {
          const every = L.every || tr.div || 4;
          if (sib % every === 0) this.click(t, L, (sib / every) % 2, w);
        } else if (L.kind === 'kick') {
          if (L.pattern[sib % L.pattern.length]) this.kick(t, L, w);
        } else if (L.kind === 'snare') {
          if (L.pattern[sib % L.pattern.length]) this.snare(t, L, w);
        }
      }
    },
    note(m, t, dur, L, w = 1) {
      const c = this.audio.ctx;
      const osc = c.createOscillator();
      osc.type = L.wave || 'triangle';
      osc.frequency.value = mtof(m);
      if (L.detune) osc.detune.value = (Math.random() - 0.5) * L.detune;
      const g = c.createGain();
      const a = L.attack == null ? 0.01 : L.attack;
      const peak = Math.max(0.0002, (L.gain == null ? 0.05 : L.gain) * w);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.03, dur));
      let node = osc;
      if (L.cutoff) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = L.cutoff;
        osc.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(this.gain);
      osc.start(t);
      osc.stop(t + Math.max(a + 0.03, dur) + 0.1);
    },
    click(t, L, alt, w = 1) {
      const c = this.audio.ctx;
      const src = c.createBufferSource();
      src.buffer = this.audio.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = alt ? 3000 : 4200;
      f.Q.value = 7;
      const g = c.createGain();
      g.gain.setValueAtTime(Math.max(0.0002, (L.gain || 0.08) * w), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      src.connect(f);
      f.connect(g);
      g.connect(this.gain);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.05);
    },
    // A soft drum: a sine drop to 50 Hz (audible on small speakers) and a 2 ms click.
    kick(t, L, w = 1) {
      const c = this.audio.ctx;
      const lv = (L.gain || 0.2) * w;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
      const g = c.createGain();
      g.gain.setValueAtTime(Math.max(0.0002, lv), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g);
      g.connect(this.gain);
      osc.start(t);
      osc.stop(t + 0.3);
      const src = c.createBufferSource();
      src.buffer = this.audio.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2000;
      const cg = c.createGain();
      cg.gain.setValueAtTime(Math.max(0.0002, lv * 0.25), t);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.004);
      src.connect(f);
      f.connect(cg);
      cg.connect(this.gain);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.01);
    },
    snare(t, L, w = 1) {
      const c = this.audio.ctx;
      const src = c.createBufferSource();
      src.buffer = this.audio.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(Math.max(0.0002, (L.gain || 0.06) * w), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      src.connect(f);
      f.connect(g);
      g.connect(this.gain);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.14);
    },
  };

  Audio.music = Music;
  Audio.recipes = SFX;
  Audio.layerWeight = layerWeight;
  DM.Audio = Audio;
})();
