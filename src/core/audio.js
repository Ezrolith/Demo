/*
 * Audio: every sound is synthesised with the Web Audio API, so the game ships
 * with zero audio files. Two parts:
 *   - SFX: named recipes built from tones and filtered noise.
 *   - Music: a small step sequencer that plays minimalist, Philip Glass-style
 *     arpeggio tracks defined as data in src/data/music.js.
 *
 * Browsers only allow sound after a user gesture, so Audio.unlock() is called
 * from the first click/keypress. Every call is a safe no-op before that.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const Audio = {
    ctx: null,
    volumes: { music: 0.6, sfx: 0.8 },
    muted: false,
    last: {},
    hums: {},

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
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

      // Music bus: gain -> lowpass (Temporal Sight muffles it) -> master
      this.musicBus = c.createGain();
      this.musicFilter = c.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 18000;
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.master);

      // Feedback echo for space
      this.echoSend = c.createGain();
      const echo = c.createDelay(1.0);
      echo.delayTime.value = 0.36;
      const fb = c.createGain();
      fb.gain.value = 0.32;
      const ef = c.createBiquadFilter();
      ef.type = 'lowpass';
      ef.frequency.value = 2600;
      this.echoSend.connect(echo);
      echo.connect(ef);
      ef.connect(fb);
      fb.connect(echo);
      const echoOut = c.createGain();
      echoOut.gain.value = 0.55;
      ef.connect(echoOut);
      echoOut.connect(this.musicFilter);

      this.sfxBus = c.createGain();
      this.sfxBus.connect(this.master);

      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.applyVolumes();
      Music.attach(this);

      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend().catch(() => {});
        else this.ctx.resume().catch(() => {});
      });
    },

    setVolumes(v) {
      Object.assign(this.volumes, v);
      this.applyVolumes();
    },
    applyVolumes() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const m = this.muted ? 0 : 1;
      this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.6 * m, t, 0.05);
      this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * 0.9 * m, t, 0.05);
    },
    toggleMute() {
      this.muted = !this.muted;
      this.applyVolumes();
      return this.muted;
    },
    setMusicFilter(freq, time = 0.25) {
      if (!this.ctx) return;
      this.musicFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, time);
    },

    // ---- primitives -------------------------------------------------------
    tone(o) {
      const c = this.ctx;
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.2;
      const osc = c.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq || 440, t0);
      if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + dur);
      if (o.detune) osc.detune.value = o.detune;
      const g = c.createGain();
      const peak = o.gain == null ? 0.2 : o.gain;
      const a = o.attack == null ? 0.005 : o.attack;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, a + 0.01));
      let node = osc;
      if (o.filter) {
        const f = c.createBiquadFilter();
        f.type = o.filter.type || 'lowpass';
        f.frequency.setValueAtTime(o.filter.freq || 2000, t0);
        if (o.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(o.filter.freqEnd, t0 + dur);
        f.Q.value = o.filter.q || 0.7;
        osc.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(o.dest || this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },
    noise(o) {
      const c = this.ctx;
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.2;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = o.ftype || 'lowpass';
      f.frequency.setValueAtTime(o.freq || 3000, t0);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + dur);
      f.Q.value = o.q || 0.8;
      const g = c.createGain();
      const peak = o.gain == null ? 0.2 : o.gain;
      const a = o.attack == null ? 0.003 : o.attack;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, a + 0.01));
      src.connect(f);
      f.connect(g);
      g.connect(o.dest || this.sfxBus);
      src.start(t0, Math.random() * 0.5);
      src.stop(t0 + dur + 0.05);
    },

    play(name, opts) {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const def = SFX[name];
      if (!def) return;
      const now = this.ctx.currentTime;
      const gap = def.gap == null ? 0.02 : def.gap;
      if (this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      try {
        def.fn(this, opts || {});
      } catch (e) {
        /* sound must never break the game */
      }
    },

    // Sustained sounds (telekinesis hum, alarms). Call every frame with on=true.
    hum(id, on, o = {}) {
      if (!this.ctx) return;
      let h = this.hums[id];
      const c = this.ctx;
      if (on && !h) {
        const osc = c.createOscillator();
        osc.type = o.type || 'sawtooth';
        osc.frequency.value = o.freq || 80;
        const osc2 = c.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = (o.freq || 80) * 1.501;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.cutoff || 500;
        f.Q.value = 4;
        const g = c.createGain();
        g.gain.value = 0.0001;
        g.gain.setTargetAtTime(o.gain || 0.05, c.currentTime, 0.08);
        osc.connect(f);
        osc2.connect(f);
        f.connect(g);
        g.connect(this.sfxBus);
        osc.start();
        osc2.start();
        h = this.hums[id] = { osc, osc2, f, g, cutoff: o.cutoff || 500 };
      } else if (!on && h) {
        h.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.06);
        h.osc.stop(c.currentTime + 0.4);
        h.osc2.stop(c.currentTime + 0.4);
        delete this.hums[id];
      }
      if (on && h && o.mod != null) h.f.frequency.setTargetAtTime(h.cutoff * (1 + o.mod), c.currentTime, 0.05);
    },
    stopHums() {
      for (const id of Object.keys(this.hums)) this.hum(id, false);
    },
  };

  // ---- SFX recipes --------------------------------------------------------
  const SFX = {
    ui_move: { gap: 0.03, fn: (a) => a.tone({ freq: 880, dur: 0.06, gain: 0.05, type: 'triangle' }) },
    ui_select: {
      fn: (a) => {
        a.tone({ freq: 523, dur: 0.12, gain: 0.08, type: 'triangle' });
        a.tone({ freq: 784, dur: 0.2, gain: 0.07, type: 'triangle', delay: 0.06 });
      },
    },
    ui_back: { fn: (a) => a.tone({ freq: 520, freqEnd: 330, dur: 0.14, gain: 0.07, type: 'triangle' }) },
    type: { gap: 0.045, fn: (a) => a.noise({ dur: 0.025, gain: 0.03, ftype: 'highpass', freq: 3500 }) },
    tick: { gap: 0.1, fn: (a, o) => a.noise({ dur: 0.035, gain: 0.09, ftype: 'bandpass', freq: o.alt ? 3200 : 4300, q: 6 }) },
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
    throw: { gap: 0.08, fn: (a) => a.noise({ dur: 0.35, gain: 0.18, ftype: 'bandpass', freq: 400, freqEnd: 2400, q: 1.2 }) },
    dis_charge: { gap: 0.05, fn: (a) => a.tone({ freq: 300, freqEnd: 1800, dur: 0.16, gain: 0.06, type: 'sine' }) },
    disintegrate: {
      gap: 0.04,
      fn: (a) => {
        a.noise({ dur: 0.5, gain: 0.26, ftype: 'highpass', freq: 1500, freqEnd: 300 });
        a.tone({ freq: 1400, freqEnd: 60, dur: 0.45, gain: 0.1, type: 'sawtooth', filter: { freq: 3000, freqEnd: 200 } });
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
      fn: (a) => {
        a.tone({ freq: 420, freqEnd: 55, dur: 0.8, gain: 0.12, type: 'sine' });
        a.noise({ dur: 0.6, gain: 0.05, ftype: 'lowpass', freq: 2400, freqEnd: 200 });
      },
    },
    timesight_off: { fn: (a) => a.tone({ freq: 70, freqEnd: 380, dur: 0.35, gain: 0.08, type: 'sine' }) },
    expand: {
      fn: (a) => {
        a.tone({ freq: 90, freqEnd: 28, dur: 1.3, gain: 0.3, type: 'sine' });
        a.noise({ dur: 1.0, gain: 0.25, ftype: 'lowpass', freq: 600, freqEnd: 60 });
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
      },
    },
    explosion: {
      gap: 0.06,
      fn: (a) => {
        a.noise({ dur: 1.1, gain: 0.32, ftype: 'lowpass', freq: 1800, freqEnd: 70 });
        a.tone({ freq: 75, freqEnd: 25, dur: 0.8, gain: 0.22, type: 'sine' });
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
      },
    },
    success: {
      fn: (a) => [60, 64, 67, 72].forEach((n, i) => a.tone({ freq: mtof(n + 12), dur: 0.5, gain: 0.06, type: 'triangle', delay: i * 0.08 })),
    },
    objective: {
      fn: (a) => {
        a.tone({ freq: mtof(76), dur: 0.25, gain: 0.06, type: 'triangle' });
        a.tone({ freq: mtof(83), dur: 0.4, gain: 0.06, type: 'triangle', delay: 0.1 });
      },
    },
    fail: { gap: 0.3, fn: (a) => a.tone({ freq: 200, freqEnd: 130, dur: 0.2, gain: 0.06, type: 'square', filter: { freq: 900 } }) },
    unlock: {
      fn: (a) => {
        [45, 52, 57, 61, 64, 69].forEach((n, i) => a.tone({ freq: mtof(n), dur: 2.6, gain: 0.07, type: 'sine', attack: 0.25, delay: i * 0.07 }));
        a.noise({ dur: 2, gain: 0.04, ftype: 'highpass', freq: 6000, attack: 0.5 });
      },
    },
    flash: {
      fn: (a) => {
        a.noise({ dur: 3, gain: 0.35, ftype: 'lowpass', freq: 9000, freqEnd: 150, attack: 0.8 });
        a.tone({ freq: 50, freqEnd: 30, dur: 3, gain: 0.25, type: 'sine', attack: 0.6 });
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
    whoosh: { gap: 0.1, fn: (a) => a.noise({ dur: 0.5, gain: 0.1, ftype: 'bandpass', freq: 300, freqEnd: 1600, q: 0.8 }) },
  };

  // ---- music sequencer ----------------------------------------------------
  const Music = {
    audio: null,
    track: null,
    trackId: null,
    pending: null,
    attach(audio) {
      this.audio = audio;
      if (this.pending !== null) {
        const p = this.pending;
        this.pending = null;
        this.play(p);
      }
    },
    play(id) {
      if (!this.audio || !this.audio.ctx) {
        this.pending = id;
        return;
      }
      if (id === this.trackId) return;
      const c = this.audio.ctx;
      if (this.gain) {
        const old = this.gain;
        old.gain.setTargetAtTime(0.0001, c.currentTime, 0.5);
        setTimeout(() => old.disconnect(), 4000);
      }
      this.trackId = id;
      this.track = id ? DM.MusicTracks[id] : null;
      this.gain = null;
      if (!this.track) return;
      this.gain = c.createGain();
      this.gain.gain.value = 0.0001;
      this.gain.gain.setTargetAtTime(1, c.currentTime + 0.1, 0.7);
      this.gain.connect(this.audio.musicBus);
      const send = c.createGain();
      send.gain.value = this.track.echo == null ? 0.35 : this.track.echo;
      this.gain.connect(send);
      send.connect(this.audio.echoSend);
      this.step = 0;
      this.next = c.currentTime + 0.15;
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 30);
    },
    stop() {
      this.play(null);
    },
    schedule() {
      const c = this.audio && this.audio.ctx;
      if (!c || !this.track || c.state !== 'running') return;
      const tr = this.track;
      const spStep = 60 / tr.bpm / (tr.div || 4);
      if (this.next < c.currentTime - 0.3) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.2) {
        this.playStep(this.step, this.next, spStep);
        this.next += spStep;
        this.step++;
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
      for (const L of tr.layers) {
        if (L.from && bar < L.from) continue;
        if (L.kind === 'arp') {
          const every = L.every || 1;
          if (sib % every) continue;
          const idx = Math.floor(step / every);
          const pi = L.pattern[idx % L.pattern.length];
          if (pi == null || pi < 0) continue;
          const n = chord[pi % chord.length] + 12 * Math.floor(pi / chord.length) + (L.oct || 0);
          this.note(n, t, spStep * every * (L.len || 1.6), L);
        } else if (L.kind === 'pad') {
          if (!chordStart) continue;
          const dur = spStep * perBar * bpc;
          for (const n of chord) this.note(n + (L.oct || 0), t, dur, L);
        } else if (L.kind === 'bass') {
          const every = L.every || perBar;
          if (sib % every === 0) this.note(chord[0] + (L.oct == null ? -12 : L.oct), t, spStep * every * 0.95, L);
        } else if (L.kind === 'tick') {
          const every = L.every || tr.div || 4;
          if (sib % every === 0) this.click(t, L, (sib / every) % 2);
        } else if (L.kind === 'kick') {
          if (L.pattern[sib % L.pattern.length]) this.kick(t, L);
        }
      }
    },
    note(m, t, dur, L) {
      const c = this.audio.ctx;
      const osc = c.createOscillator();
      osc.type = L.wave || 'triangle';
      osc.frequency.value = mtof(m);
      if (L.detune) osc.detune.value = (Math.random() - 0.5) * L.detune;
      const g = c.createGain();
      const a = L.attack == null ? 0.01 : L.attack;
      const peak = L.gain == null ? 0.05 : L.gain;
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
      osc.stop(t + dur + 0.1);
    },
    click(t, L, alt) {
      const c = this.audio.ctx;
      const src = c.createBufferSource();
      src.buffer = this.audio.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = alt ? 3000 : 4200;
      f.Q.value = 7;
      const g = c.createGain();
      g.gain.setValueAtTime(L.gain || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      src.connect(f);
      f.connect(g);
      g.connect(this.gain);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.05);
    },
    kick(t, L) {
      const c = this.audio.ctx;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
      const g = c.createGain();
      g.gain.setValueAtTime(L.gain || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g);
      g.connect(this.gain);
      osc.start(t);
      osc.stop(t + 0.3);
    },
  };

  Audio.music = Music;
  DM.Audio = Audio;
})();
