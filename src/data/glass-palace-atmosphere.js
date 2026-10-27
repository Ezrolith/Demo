/* A separate Mars room and score. Original arrangements are not replaced. */
(function () {
  'use strict';
  const DM = window.DM;
  DM.Audio.define('gp_clock', {
    gap: 0.3,
    fn(audio) {
      audio.tone({ freq: 960, freqEnd: 680, dur: 0.065, gain: 0.004, type: 'sine' });
      audio.noise({ dur: 0.025, gain: 0.002, ftype: 'bandpass', freq: 2100, q: 6 });
    },
  });
  DM.MusicTracks.glass_palace = {
    bpm: 62,
    level: 2,
    echo: 0.48,
    barsPerChord: 2,
    prog: [
      [50, 57, 60, 64],
      [48, 55, 59, 62],
      [46, 53, 57, 60],
      [45, 52, 56, 59],
    ],
    layers: [
      { kind: 'pad', wave: 'sine', gain: 0.025, attack: 1.6 },
      { kind: 'tick', gain: 0.012, every: 8 },
      { kind: 'bass', wave: 'sine', gain: 0.06, oct: -12, every: 16, min: 0.2 },
      {
        kind: 'arp',
        wave: 'triangle',
        gain: 0.026,
        every: 3,
        pattern: [0, -1, 2, 1, -1, 3, -1, 2],
        oct: 12,
        cutoff: 1800,
        len: 2.5,
        min: 0.2,
      },
    ],
  };
  DM.Ambience.beds.gp_palace = {
    layers: [
      { kind: 'wind', ftype: 'lowpass', freq: 850, gain: 0.006, lfo: { rate: 0.07, depth: 0.25 } },
      {
        kind: 'drone',
        gain: 0.003,
        cutoff: 800,
        oscs: [
          { f: 220, g: 0.5 },
          { f: 330, g: 0.3 },
          { f: 441, g: 0.2 },
        ],
      },
      { kind: 'events', sound: 'gp_clock', every: [4, 8], first: [1, 3], gain: 0.4 },
    ],
  };
  DM.Ambience.maps.gp_palace = { bed: 'gp_palace', surface: 'glass' };
  DM.Ambience.cues['glass_palace.hall'] = 'glass_palace';
  DM.Atmosphere.register('gp_palace', {
    shadow: 'rgba(35,9,19,0.24)',
    light: { ambient: 'rgba(25,14,30,0.18)', player: 1, playerK: 0.15 },
    weather: [{ type: 'haze', n: 18, alpha: 0.02, color: '#dba19a' }],
    walls: { wall: { pattern: 'gold', height: 1.1 }, glass: { pattern: 'ice', height: 0.8 } },
  });
})();
