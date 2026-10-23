/*
 * Music tracks, as data. Notes are MIDI numbers (60 = middle C).
 *
 * A track is a chord progression plus layers that voice it:
 *   arp  — cycles through chord tones by `pattern` (indexes past the chord wrap up an octave; -1 = rest)
 *   pad  — sustains the whole chord each time it changes
 *   bass — chord root every `every` steps
 *   tick  — clock tick (watchmaker motif)
 *   kick  — soft drum on pattern steps
 *   snare — brushed noise hit on pattern steps
 * `from` delays a layer's entry by N bars so tracks can build.
 * `min` / `max` gate a layer on Music.intensity (0 calm .. 1 full fight), set by
 * the audio director from the threat around Jon and re-read at each bar; the
 * layer fades in over the 0.15 below `min` (and out over the 0.15 above `max`).
 * `level` (dB) evens out loudness between tracks (loudest 50 ms near -24 dB).
 * Add a track here, then reference its id from a chapter's `music` field or a
 * stage cue in src/data/ambience.js.
 */
(function () {
  'use strict';
  window.DM.MusicTracks = {
    title: {
      bpm: 66,
      level: 2,
      barsPerChord: 2,
      echo: 0.45,
      prog: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.03, attack: 1.4 },
        { kind: 'bass', wave: 'sine', gain: 0.07, oct: -12, every: 16 },
        { kind: 'arp', wave: 'triangle', gain: 0.028, every: 2, pattern: [0, 1, 2, 3, 2, 1], oct: 12, cutoff: 2600, len: 2.6, from: 2 },
      ],
    },
    prologue: {
      bpm: 80,
      level: 5,
      barsPerChord: 2,
      echo: 0.3,
      prog: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.025, attack: 0.8 },
        { kind: 'arp', wave: 'sine', gain: 0.03, every: 2, pattern: [0, 2, 1, 2, 3, 2, 1, 2], oct: 24, len: 3 },
        { kind: 'tick', gain: 0.05, every: 4 },
        { kind: 'bass', wave: 'triangle', gain: 0.04, oct: -12, every: 8, cutoff: 700 },
      ],
    },
    tension: {
      bpm: 132,
      level: -3,
      barsPerChord: 1,
      echo: 0.2,
      prog: [[57, 60, 64], [57, 60, 65], [57, 60, 64], [56, 59, 64]],
      layers: [
        { kind: 'arp', wave: 'square', gain: 0.018, every: 1, pattern: [0, 1, 2, 1], oct: 12, cutoff: 1800, len: 1.2 },
        { kind: 'kick', gain: 0.22, pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0] },
        { kind: 'tick', gain: 0.07, every: 2 },
      ],
    },
    void: {
      bpm: 60,
      level: 3,
      barsPerChord: 4,
      echo: 0.6,
      prog: [[50, 57, 62, 64], [48, 55, 62, 64], [46, 53, 60, 62], [45, 52, 57, 64]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.03, attack: 2.5 },
        { kind: 'arp', wave: 'sine', gain: 0.022, every: 3, pattern: [3, -1, 2, -1, 1, -1, 0, -1, 5, -1], oct: 24, len: 4 },
      ],
    },
    // Calm: bass and the triangle arp. Enemies alerted: the square arp, then the
    // kick, then the snare at full threat.
    action: {
      bpm: 112,
      level: -2,
      barsPerChord: 1,
      echo: 0.25,
      prog: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59], [52, 56, 59]],
      layers: [
        { kind: 'arp', wave: 'triangle', gain: 0.028, every: 1, pattern: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 2, 1], oct: 12, cutoff: 2300, len: 1.3 },
        { kind: 'arp', wave: 'square', gain: 0.012, every: 2, pattern: [0, 2, 4, 2], oct: 0, cutoff: 900, len: 2, min: 0.25 },
        { kind: 'bass', wave: 'sawtooth', gain: 0.04, oct: -24, every: 4, cutoff: 420 },
        { kind: 'kick', gain: 0.2, pattern: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], min: 0.5 },
        { kind: 'snare', gain: 0.06, pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], min: 0.75 },
      ],
    },
    // Chapter II's test range: open, unhurried, no drums.
    range: {
      bpm: 92,
      level: 0,
      barsPerChord: 2,
      echo: 0.3,
      prog: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.022, attack: 0.6 },
        { kind: 'arp', wave: 'triangle', gain: 0.026, every: 2, pattern: [0, 1, 2, 1, 3, 2, 1, 2], oct: 12, cutoff: 2400, len: 1.8 },
        { kind: 'tick', gain: 0.045, every: 4 },
        { kind: 'bass', wave: 'triangle', gain: 0.045, oct: -12, every: 8, cutoff: 600 },
      ],
    },
    // Aftermaths: pads and a few high notes, after the fighting stops.
    reflect: {
      bpm: 54,
      level: 0,
      barsPerChord: 2,
      echo: 0.6,
      prog: [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.03, attack: 2.2 },
        { kind: 'arp', wave: 'sine', gain: 0.018, every: 4, pattern: [3, -1, -1, 2, -1, -1, 1, -1], oct: 12, len: 4 },
        { kind: 'bass', wave: 'sine', gain: 0.045, oct: -12, every: 32 },
      ],
    },
    mars: {
      bpm: 70,
      level: 3,
      barsPerChord: 2,
      echo: 0.55,
      prog: [[62, 66, 69, 73], [64, 68, 71, 74], [59, 62, 66, 69], [61, 64, 68, 71]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.028, attack: 2 },
        { kind: 'arp', wave: 'triangle', gain: 0.024, every: 2, pattern: [0, 1, 2, 3, 4, 3, 2, 1], oct: 12, cutoff: 3000, len: 3 },
        { kind: 'bass', wave: 'sine', gain: 0.05, oct: -24, every: 32 },
      ],
    },
    // Karnak. The kick joins once something is hunting Jon; the high saw arp
    // only for Veidt himself (any boss lifts intensity to 0.85).
    finale: {
      bpm: 124,
      level: -4,
      barsPerChord: 1,
      echo: 0.25,
      prog: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
      layers: [
        { kind: 'arp', wave: 'sawtooth', gain: 0.016, every: 1, pattern: [0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 1], oct: 12, cutoff: 2000, len: 1.2 },
        { kind: 'pad', wave: 'triangle', gain: 0.02, attack: 0.4, oct: -12 },
        { kind: 'bass', wave: 'sawtooth', gain: 0.045, oct: -24, every: 2, cutoff: 380 },
        { kind: 'kick', gain: 0.24, pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], min: 0.45 },
        { kind: 'arp', wave: 'sawtooth', gain: 0.012, every: 1, pattern: [2, 1, 0, 1, 2, 3, 4, 3], oct: 24, cutoff: 3200, len: 1, min: 0.85 },
      ],
    },
    ending: {
      bpm: 58,
      level: 3,
      barsPerChord: 2,
      echo: 0.6,
      prog: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [60, 64, 67, 71]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.03, attack: 2 },
        { kind: 'arp', wave: 'sine', gain: 0.026, every: 2, pattern: [0, 1, 2, 3, 4, 3, 2, 1], oct: 12, len: 3 },
      ],
    },
    // The ending for a Jon who unmade more people than he spared: the void's
    // chords, slower, with only a clock to keep them company.
    ending_cold: {
      bpm: 46,
      level: 0,
      barsPerChord: 2,
      echo: 0.6,
      prog: [[50, 57, 62, 64], [48, 55, 62, 64], [46, 53, 60, 62], [45, 52, 57, 64]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.025, attack: 2.5 },
        { kind: 'tick', gain: 0.035, every: 8 },
      ],
    },
  };
})();
