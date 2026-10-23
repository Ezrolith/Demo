/*
 * Ambience, as data: the sound of each place, what Jon's feet sound like on
 * it, and which music each story beat calls for. Read by the audio director
 * (src/game/audiodirector.js); the beds are built by Audio.ambience().
 *
 * maps[mapName]   { bed, surface, zones }
 *   bed      the bed id played on that map
 *   surface  footstep sound: 'concrete' | 'sand' | 'snow' | 'wood' | 'dust' (null = none)
 *   zones    [{ bed, rect: [x0, y0, x1, y1] }]: a different bed while Jon is
 *            inside the rect (first match wins; 40 px of hysteresis at the edge)
 *
 * beds[id].layers, each one of
 *   wind    filtered noise: { ftype, freq, q, gain, lfo: { rate, depth, fdepth }, lfo2 }
 *           (depth swings the gain and fdepth the filter, as fractions of their base)
 *   drone   oscillators into a lowpass: { oscs: [{ f, wave, g, detune }], cutoff, gain, lfo }
 *   events  a recipe from audio.js every [min, max] seconds: { sound, every, first, gain }
 *
 * cues['chapter.stage'] = track: music for a story beat. It plays when the stage
 * starts (or the chapter is retried there); when a later stage has no cue, the
 * chapter's own track returns, unless a script changed the music meanwhile.
 * events['event:name'] = track: music on a DM.Events event.
 */
(function () {
  'use strict';

  // Shared layers.
  const DESERT_DAY = [
    { kind: 'wind', ftype: 'bandpass', freq: 350, q: 0.7, gain: 0.022, lfo: { rate: 0.1, depth: 0.5, fdepth: 0.3 } },
    { kind: 'wind', ftype: 'bandpass', freq: 1300, q: 1.2, gain: 0.004, lfo: { rate: 0.06, depth: 0.7, fdepth: 0.25 } },
  ];
  const MAINS = { kind: 'drone', oscs: [{ f: 60, wave: 'sawtooth' }, { f: 120, wave: 'sine', g: 0.8 }], cutoff: 420, gain: 0.006 };

  window.DM.Ambience = {
    maps: {
      gila: { bed: 'gila', surface: 'concrete', zones: [{ bed: 'gila_chamber', rect: [1116, 24, 1760, 1040] }] },
      void: { bed: 'void', surface: null },
      range: { bed: 'range', surface: 'sand' },
      pier: { bed: 'pier', surface: 'wood' },
      proving: { bed: 'proving', surface: 'sand' },
      studio: { bed: 'studio', surface: 'concrete' },
      mars: { bed: 'mars', surface: 'dust' },
      karnak: { bed: 'karnak', surface: 'snow', zones: [{ bed: 'sanctum', rect: [1960, 0, 99999, 99999] }] },
    },

    beds: {
      // Gila Flats, 1959: a desert night outside the walls, crickets, the lab's mains hum.
      gila: {
        layers: [
          { kind: 'wind', ftype: 'bandpass', freq: 450, q: 0.6, gain: 0.014, lfo: { rate: 0.07, depth: 0.5, fdepth: 0.4 } },
          MAINS,
          { kind: 'events', sound: 'amb_cricket', every: [0.8, 1.6], first: [0.3, 1] },
        ],
      },
      // The test chamber: the generator room hums louder, the desert recedes.
      gila_chamber: {
        layers: [
          { kind: 'wind', ftype: 'bandpass', freq: 380, q: 0.6, gain: 0.006, lfo: { rate: 0.07, depth: 0.5, fdepth: 0.3 } },
          { kind: 'drone', oscs: [{ f: 60, wave: 'sawtooth' }, { f: 120, wave: 'sine', g: 0.9 }, { f: 180, wave: 'sine', g: 0.3 }], cutoff: 520, gain: 0.011 },
          { kind: 'events', sound: 'amb_cricket', every: [2.5, 5], first: [1, 3] },
        ],
      },
      // Chapter I: a deep, slow drone, a faint hiss, and chimes drifting into the echo.
      void: {
        layers: [
          { kind: 'drone', oscs: [{ f: 41 }, { f: 61.5 }, { f: 123, g: 0.25 }], cutoff: 400, gain: 0.02, lfo: { rate: 0.05, depth: 0.3 } },
          { kind: 'wind', ftype: 'highpass', freq: 6000, q: 0.7, gain: 0.003 },
          { kind: 'events', sound: 'amb_chime', every: [4, 9], first: [2, 5] },
        ],
      },
      range: { layers: DESERT_DAY },
      proving: { layers: DESERT_DAY.concat([{ kind: 'events', sound: 'amb_artillery', every: [8, 16], first: [3, 8] }]) },
      // The pier at night: water at the pilings, distant traffic, a foghorn.
      pier: {
        layers: [
          { kind: 'wind', ftype: 'lowpass', freq: 260, q: 0.8, gain: 0.03, lfo: { rate: 0.18, depth: 0.7, fdepth: 0.3 } },
          { kind: 'wind', ftype: 'bandpass', freq: 180, q: 1, gain: 0.008, lfo: { rate: 0.05, depth: 0.3 } },
          { kind: 'wind', ftype: 'bandpass', freq: 900, q: 0.8, gain: 0.003, lfo: { rate: 0.09, depth: 0.6, fdepth: 0.2 } },
          { kind: 'events', sound: 'amb_foghorn', every: [40, 70], first: [6, 14] },
          { kind: 'events', sound: 'amb_horn', every: [18, 40], first: [10, 20] },
        ],
      },
      // The TV studio: an audience murmuring, camera shutters.
      studio: {
        layers: [
          { kind: 'wind', ftype: 'bandpass', freq: 450, q: 2, gain: 0.006, lfo: { rate: 0.3, depth: 0.6 } },
          { kind: 'wind', ftype: 'bandpass', freq: 800, q: 2, gain: 0.006, lfo: { rate: 0.5, depth: 0.6 } },
          { kind: 'wind', ftype: 'bandpass', freq: 1300, q: 2, gain: 0.006, lfo: { rate: 0.7, depth: 0.6 } },
          { kind: 'events', sound: 'amb_shutter', every: [1.5, 5], first: [0.5, 2] },
        ],
      },
      // Mars: thin, high wind sweeping slowly, and crystal pings.
      mars: {
        layers: [
          { kind: 'wind', ftype: 'bandpass', freq: 1550, q: 2.5, gain: 0.01, lfo: { rate: 0.04, depth: 0.4, fdepth: 0.42 } },
          { kind: 'wind', ftype: 'lowpass', freq: 220, q: 0.7, gain: 0.006, lfo: { rate: 0.03, depth: 0.5 } },
          { kind: 'events', sound: 'amb_crystal', every: [3, 7], first: [1, 3] },
        ],
      },
      // Karnak: an Antarctic gale with a whistle in it.
      karnak: {
        layers: [
          { kind: 'wind', ftype: 'lowpass', freq: 500, q: 0.7, gain: 0.035, lfo: { rate: 0.15, depth: 0.6, fdepth: 0.3 }, lfo2: { rate: 0.037, depth: 0.3 } },
          { kind: 'wind', ftype: 'bandpass', freq: 1800, q: 5, gain: 0.008, lfo: { rate: 0.07, depth: 0.5, fdepth: 0.33 } },
        ],
      },
      // Inside Karnak's sanctum: the gale muffled by walls, a machine hum.
      sanctum: {
        layers: [
          { kind: 'drone', oscs: [{ f: 50, wave: 'sawtooth' }, { f: 100, wave: 'sine', g: 0.9 }, { f: 150, wave: 'sine', g: 0.2 }], cutoff: 340, gain: 0.012 },
          { kind: 'wind', ftype: 'lowpass', freq: 250, q: 0.7, gain: 0.01, lfo: { rate: 0.15, depth: 0.5 } },
        ],
      },
    },

    cues: {
      'prologue.accident': 'tension', // the script asks for it too, but a retry would otherwise restart the calm track
      'superman.range': 'range',
      'superman.aftermath': 'reflect',
      'deterrent.outro': 'reflect',
      'mars.studio': 'tension',
    },
    events: {
      'veidt:yield': 'reflect',
    },
  };
})();
