/*
 * Music tracks, as data. Notes are MIDI numbers (60 = middle C).
 *
 * A track is a chord progression plus layers that voice it:
 *   arp  — cycles through chord tones by `pattern` (indexes past the chord wrap up an octave; -1 = rest)
 *   pad  — sustains the whole chord each time it changes
 *   bass — chord root every `every` steps
 *   tick — clock tick (watchmaker motif)
 *   kick — soft drum on pattern steps
 * `from` delays a layer's entry by N bars so tracks can build.
 * Add a track here, then reference its id from a chapter's `music` field.
 */
(function () {
  'use strict';
  window.DM.MusicTracks = {
    title: {
      bpm: 66,
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
      barsPerChord: 4,
      echo: 0.6,
      prog: [[50, 57, 62, 64], [48, 55, 62, 64], [46, 53, 60, 62], [45, 52, 57, 64]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.03, attack: 2.5 },
        { kind: 'arp', wave: 'sine', gain: 0.022, every: 3, pattern: [3, -1, 2, -1, 1, -1, 0, -1, 5, -1], oct: 24, len: 4 },
      ],
    },
    action: {
      bpm: 112,
      barsPerChord: 1,
      echo: 0.25,
      prog: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59], [52, 56, 59]],
      layers: [
        { kind: 'arp', wave: 'triangle', gain: 0.028, every: 1, pattern: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 2, 1], oct: 12, cutoff: 2300, len: 1.3 },
        { kind: 'arp', wave: 'square', gain: 0.012, every: 2, pattern: [0, 2, 4, 2], oct: 0, cutoff: 900, len: 2, from: 2 },
        { kind: 'bass', wave: 'sawtooth', gain: 0.04, oct: -24, every: 4, cutoff: 420 },
        { kind: 'kick', gain: 0.2, pattern: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], from: 4 },
      ],
    },
    mars: {
      bpm: 70,
      barsPerChord: 2,
      echo: 0.55,
      prog: [[62, 66, 69, 73], [64, 68, 71, 74], [59, 62, 66, 69], [61, 64, 68, 71]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.028, attack: 2 },
        { kind: 'arp', wave: 'triangle', gain: 0.024, every: 2, pattern: [0, 1, 2, 3, 4, 3, 2, 1], oct: 12, cutoff: 3000, len: 3 },
        { kind: 'bass', wave: 'sine', gain: 0.05, oct: -24, every: 32 },
      ],
    },
    finale: {
      bpm: 124,
      barsPerChord: 1,
      echo: 0.25,
      prog: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
      layers: [
        { kind: 'arp', wave: 'sawtooth', gain: 0.016, every: 1, pattern: [0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 1], oct: 12, cutoff: 2000, len: 1.2 },
        { kind: 'pad', wave: 'triangle', gain: 0.02, attack: 0.4, oct: -12 },
        { kind: 'bass', wave: 'sawtooth', gain: 0.045, oct: -24, every: 2, cutoff: 380 },
        { kind: 'kick', gain: 0.24, pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1] },
      ],
    },
    ending: {
      bpm: 58,
      barsPerChord: 2,
      echo: 0.6,
      prog: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [60, 64, 67, 71]],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.03, attack: 2 },
        { kind: 'arp', wave: 'sine', gain: 0.026, every: 2, pattern: [0, 1, 2, 3, 4, 3, 2, 1], oct: 12, len: 3 },
      ],
    },
  };
})();
