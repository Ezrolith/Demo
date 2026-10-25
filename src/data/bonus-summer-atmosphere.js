/* August streets: baked masonry, smoke, firelight and an original synthetic soundscape. */
(function () {
  'use strict';
  const DM = window.DM;
  const S = DM.Summer;
  const G = DM.Gfx;
  const K = DM.BonusKit;
  const U = DM.U;

  function leatherMask(g, t) {
    // The existing local mask hook can also add a broader jaw and jacket.
    // It changes this portrait only; Dan keeps his slimmer original silhouette.
    g.fillStyle = '#171d20';
    G.ellipse(g, 50, 108, 57, 35);
    g.fill();
    g.fillStyle = '#ae8061';
    G.rr(g, 38, 62, 24, 28, 5);
    g.fill();
    g.fillStyle = '#c9a17d';
    g.beginPath();
    g.moveTo(28, 40);
    g.quadraticCurveTo(29, 22, 50, 23);
    g.quadraticCurveTo(75, 25, 74, 46);
    g.lineTo(72, 67);
    g.quadraticCurveTo(62, 81, 42, 78);
    g.lineTo(29, 68);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(87,64,50,0.24)';
    G.ellipse(g, 52, 67, 22, 12);
    g.fill();
    g.fillStyle = '#353335';
    g.beginPath();
    g.moveTo(27, 41);
    g.quadraticCurveTo(27, 16, 51, 20);
    g.quadraticCurveTo(74, 18, 75, 44);
    g.lineTo(67, 35);
    g.quadraticCurveTo(48, 28, 34, 36);
    g.fill();
    g.fillStyle = '#898278';
    g.fillRect(29, 36, 5, 17);
    g.fillRect(68, 36, 5, 17);
    g.fillStyle = '#151b1e';
    g.beginPath();
    g.moveTo(28, 40);
    g.lineTo(73, 40);
    g.lineTo(71, 54);
    g.lineTo(54, 50);
    g.lineTo(49, 53);
    g.lineTo(32, 54);
    g.closePath();
    g.fill();
    g.fillStyle = '#d8c19b';
    for (const x of [40, 62]) {
      G.ellipse(g, x, 46, 6, 2);
      g.fill();
      g.fillStyle = '#292523';
      G.circle(g, x, 46, 1.5);
      g.fill();
      g.fillStyle = '#d8c19b';
    }
    g.strokeStyle = '#85634e';
    g.lineWidth = 1;
    for (const x of [33, 64]) {
      G.line(g, x, 55, x + 6, 58);
      G.line(g, x + 1, 59, x + 5, 64);
    }
    G.line(g, 48, 53, 45, 61);
    G.line(g, 45, 61, 52, 62);
    G.line(g, 41, 68, 62, 66);
    G.line(g, 40, 73, 58, 74);
    // Worn leather lapels, shoulder seams, zipper and the yellow badge.
    g.fillStyle = '#333c3f';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(50 + side * 16, 77);
      g.lineTo(50 + side * 37, 85);
      g.lineTo(50 + side * 23, 99);
      g.lineTo(50 + side * 6, 90);
      g.fill();
    }
    g.strokeStyle = '#6e7777';
    g.lineWidth = 1.1;
    G.line(g, 20, 86, 5, 96);
    G.line(g, 80, 86, 95, 96);
    G.line(g, 58, 87, 48, 100);
    g.fillStyle = '#624230';
    G.rr(g, 56, 64, 33, 6, 2);
    g.fill();
    g.fillStyle = '#b6a092';
    g.fillRect(83, 64, 5, 6);
    g.fillStyle = '#dc9856';
    g.fillRect(88, 65, 2, 4);
    if (DM.Save.settings.fx !== 'off') {
      const time = DM.SettingsSchema.reducedFlashing() ? 0 : t;
      g.strokeStyle = 'rgba(202,198,176,0.4)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(88, 63);
      g.bezierCurveTo(94, 56, 82 + Math.sin(time) * 3, 51, 90, 43);
      g.stroke();
    }
    g.fillStyle = '#d6b644';
    G.circle(g, 75, 90, 7);
    g.fill();
    g.fillStyle = '#232726';
    G.circle(g, 73, 88, 1);
    g.fill();
    G.circle(g, 77, 88, 1);
    g.fill();
    g.strokeStyle = '#232726';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(75, 90, 3.5, 0.15, Math.PI - 0.15);
    g.stroke();
  }
  Object.assign(DM.LOOKS, {
    comedian: { name: 'The Comedian', skin: '#d4aa83', hair: '#363333', hairStyle: 'short',
      body: '#252b2e', sleeve: '#353b3d', size: 1.15, legs: '#21282a', collar: '#4c5050', trim: '#ae965e',
      moustache: true, bg: '#7f5944', color: S.AMBER, mask: leatherMask },
    summer_rioter: { name: 'A man from the avenue', skin: '#c49b79', hair: '#312d2b', hairStyle: 'short',
      body: '#a18b6e', sleeve: '#c49b79', legs: '#3b4e59', bg: '#6a6252', color: '#dbbd91' },
    summer_resident: { name: 'Mrs Alvarez', skin: '#c69b7b', hair: '#b6a995', hairStyle: 'long',
      body: '#977e72', sleeve: '#c69b7b', legs: '#605b58', bg: '#836e53', color: '#e4c694' },
    summer_resident_b: { name: 'A resident', skin: '#d2ac87', hair: '#463b32', hairStyle: 'short',
      body: '#799590', sleeve: '#d2ac87', legs: '#4c5654', bg: '#67776b', color: '#bad8ca' },
    summer_driver: { name: 'The Driver', skin: '#dfb591', hair: '#73533d', hairStyle: 'short',
      body: '#8a8e62', sleeve: '#b19a73', legs: '#4a5042', bg: '#76815c', color: '#d8d9a5' },
  });

  DM.Audio.define('summer_glass', { gap: 0.2, fn(a) {
    a.noise({ dur: 0.25, gain: 0.023, ftype: 'highpass', freq: 2400, attack: 0.003 });
    for (let i = 0; i < 4; i++) {
      a.tone({ freq: 1200 + i * 480, freqEnd: 730 + i * 260, dur: 0.16, gain: 0.006, delay: i * 0.04 });
    }
  } });
  DM.Audio.define('summer_siren', { gap: 1, fn(a) {
    a.tone({ freq: 460, freqEnd: 670, dur: 1.8, gain: 0.009, type: 'sine', attack: 0.6 });
    a.tone({ freq: 670, freqEnd: 440, dur: 1.8, gain: 0.008, type: 'sine', attack: 0.6, delay: 1.6 });
  } });
  DM.Audio.define('summer_crowd', { gap: 0.3, fn(a) {
    for (let i = 0; i < 5; i++) {
      a.noise({ dur: 0.21, gain: 0.012, ftype: 'bandpass', freq: 380 + i * 97, q: 3,
        attack: 0.07, delay: i * 0.19 });
    }
  } });
  DM.Audio.define('summer_water', { gap: 0.5, fn(a) {
    a.noise({ dur: 1.5, gain: 0.032, ftype: 'lowpass', freq: 1600, attack: 0.17 });
    a.tone({ freq: 70, freqEnd: 43, dur: 0.7, gain: 0.028, type: 'sine', attack: 0.06 });
  } });
  DM.Audio.define('summer_hiss', { gap: 0.15, fn(a) {
    a.noise({ dur: 0.6, gain: 0.022, ftype: 'highpass', freq: 1700, attack: 0.08 });
  } });
  DM.Audio.define('summer_vent', { gap: 0.5, fn(a) {
    a.noise({ dur: 1.8, gain: 0.027, ftype: 'lowpass', freq: 1200, freqEnd: 300, attack: 0.3 });
    a.tone({ freq: 85, freqEnd: 42, dur: 0.6, gain: 0.025, type: 'triangle' });
  } });
  DM.Audio.define('summer_aim', { gap: 0.4, fn(a) {
    a.tone({ freq: 330, freqEnd: 440, dur: 0.22, gain: 0.025, type: 'triangle', attack: 0.02 });
    a.tone({ freq: 440, dur: 0.3, gain: 0.018, type: 'triangle', delay: 0.24, attack: 0.02 });
    a.noise({ dur: 0.08, gain: 0.012, ftype: 'highpass', freq: 2100, delay: 0.05 });
  } });
  DM.Audio.define('summer_shot', { gap: 0.15, fn(a) {
    a.noise({ dur: 0.12, gain: 0.045, ftype: 'bandpass', freq: 1200, q: 0.6, echo: 0.12 });
    a.tone({ freq: 100, freqEnd: 40, dur: 0.1, gain: 0.03, type: 'triangle' });
  } });
  DM.Audio.define('summer_throw', { gap: 0.1, fn(a) {
    a.noise({ dur: 0.18, gain: 0.013, ftype: 'bandpass', freq: 700, freqEnd: 1600, attack: 0.04 });
  } });
  DM.Audio.define('summer_gas', { gap: 0.2, fn(a) {
    a.noise({ dur: 1.2, gain: 0.023, ftype: 'highpass', freq: 2100, attack: 0.12 });
  } });
  DM.Audio.define('summer_metal', { gap: 0.15, fn(a) {
    a.noise({ dur: 0.3, gain: 0.027, ftype: 'bandpass', freq: 1100, q: 2 });
    a.tone({ freq: 173, freqEnd: 91, dur: 0.45, gain: 0.02, type: 'triangle', echo: 0.15 });
  } });
  DM.Audio.define('summer_ram', { gap: 0.5, fn(a) {
    a.tone({ freq: 52, freqEnd: 95, dur: 1.3, gain: 0.025, type: 'sawtooth', cutoff: 180, attack: 0.3 });
    a.noise({ dur: 0.9, gain: 0.017, ftype: 'lowpass', freq: 280, attack: 0.2 });
  } });
  DM.Audio.define('summer_safe', { gap: 0.2, fn(a) {
    a.tone({ freq: 392, dur: 0.5, gain: 0.025, type: 'sine', echo: 0.2 });
    a.tone({ freq: 523, dur: 0.8, gain: 0.018, type: 'sine', delay: 0.15, echo: 0.2 });
  } });
  DM.Ambience.beds.summer_street = { layers: [
    { kind: 'drone', oscs: [{ f: 52, wave: 'sine' }, { f: 78, wave: 'sine', g: 0.3 }],
      cutoff: 180, gain: 0.014, lfo: { rate: 0.055, depth: 0.3 } },
    { kind: 'wind', ftype: 'bandpass', freq: 330, q: 0.5, gain: 0.008 },
    { kind: 'events', sound: 'summer_crowd', every: [5, 9], first: [1, 2], gain: 0.65 },
    { kind: 'events', sound: 'summer_siren', every: [17, 27], first: [4, 8], gain: 0.6 },
    { kind: 'events', sound: 'summer_glass', every: [12, 20], first: [9, 12], gain: 0.28 },
  ] };
  DM.Ambience.beds.summer_fire = { layers: [
    { kind: 'wind', ftype: 'lowpass', freq: 260, gain: 0.017, lfo: { rate: 0.17, depth: 0.3 } },
    { kind: 'drone', oscs: [{ f: 47, wave: 'sine' }], cutoff: 160, gain: 0.012 },
    { kind: 'events', sound: 'summer_metal', every: [9, 15], first: [5, 9], gain: 0.22 },
  ] };
  // Sparse, humid chords; the drum layer only arrives as the situation escalates.
  DM.MusicTracks.summer_street = {
    bpm: 68, level: -1, barsPerChord: 2, echo: 0.4,
    prog: [[48, 55, 58, 62], [46, 53, 57, 60], [45, 52, 55, 60], [43, 50, 55, 59]],
    layers: [
      { kind: 'pad', wave: 'sine', gain: 0.026, attack: 2.3 },
      { kind: 'bass', wave: 'sine', gain: 0.055, every: 8, oct: -12 },
      { kind: 'arp', wave: 'triangle', gain: 0.024, every: 3, pattern: [0, -1, 2, 3, -1, 1, 4, -1],
        oct: 12, cutoff: 1600, len: 2.8 },
      { kind: 'tick', gain: 0.028, every: 4 },
      { kind: 'kick', gain: 0.13, pattern: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0], min: 0.5 },
    ],
  };
  DM.MusicTracks.summer_truck = {
    bpm: 106, level: -2, barsPerChord: 1, echo: 0.24,
    prog: [[48, 55, 58, 62], [48, 55, 58, 63], [46, 53, 57, 60], [43, 50, 54, 59]],
    layers: [
      { kind: 'pad', wave: 'sine', gain: 0.022, attack: 0.8 },
      { kind: 'arp', wave: 'triangle', gain: 0.028, every: 1, pattern: [0, 2, 1, 3, 0, 2, 4, 2],
        oct: 12, cutoff: 2100, len: 1.4 },
      { kind: 'bass', wave: 'sawtooth', gain: 0.033, oct: -12, every: 4, cutoff: 350 },
      { kind: 'kick', gain: 0.16, pattern: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0], min: 0.2 },
      { kind: 'snare', gain: 0.04, pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], min: 0.6 },
    ],
  };

  function brick(g, x, y, w, h, warm = false) {
    g.fillStyle = warm ? '#59443b' : '#444743';
    g.fillRect(x, y, w, h);
    g.strokeStyle = warm ? '#342e2b' : '#2c3333';
    g.lineWidth = 2;
    for (let yy = y; yy < y + h; yy += 18) {
      G.line(g, x, yy, x + w, yy);
      for (let xx = x + ((yy - y) / 18 % 2) * 23; xx < x + w; xx += 46) {
        G.line(g, xx, yy, xx, Math.min(yy + 18, y + h));
      }
    }
    g.fillStyle = 'rgba(12,17,18,0.18)';
    g.fillRect(x, y + h - 12, w, 12);
  }
  function windowFrame(g, x, y, lit = false) {
    g.fillStyle = '#918374';
    g.fillRect(x - 27, y - 38, 54, 76);
    g.fillStyle = lit ? '#9f8350' : '#172729';
    g.fillRect(x - 22, y - 33, 44, 65);
    g.fillStyle = '#b4a18a';
    g.fillRect(x - 2, y - 34, 4, 67);
    g.fillRect(x - 23, y - 3, 46, 4);
    g.fillStyle = '#272e2c';
    g.fillRect(x - 31, y + 34, 62, 9);
  }
  function facade(g, x, y, w, name, warm) {
    brick(g, x, y, w, 230, warm);
    g.fillStyle = '#222c2a';
    g.fillRect(x - 9, y - 12, w + 18, 17);
    g.fillStyle = '#9b8771';
    g.fillRect(x - 6, y + 3, w + 12, 5);
    for (let xx = x + 55; xx < x + w - 20; xx += 90) windowFrame(g, xx, y + 63, false);
    g.fillStyle = '#23322f';
    g.fillRect(x + 18, y + 116, w - 36, 38);
    if (name) G.text(g, name, x + w / 2, y + 143, { size: 20, align: 'center', color: '#c9ba94', spacing: 2 });
    g.fillStyle = '#142324';
    g.fillRect(x + 20, y + 166, w - 40, 54);
    g.strokeStyle = '#9f9a7c';
    g.lineWidth = 4;
    for (let xx = x + 30; xx < x + w - 20; xx += 66) G.line(g, xx, y + 166, xx, y + 220);
    g.strokeStyle = '#867459';
    g.lineWidth = 11;
    G.line(g, x + 25, y + 175, x + w - 24, y + 208);
    G.line(g, x + 35, y + 213, x + w - 34, y + 177);
    g.strokeStyle = '#b19a75';
    g.lineWidth = 1;
    G.line(g, x + 25, y + 173, x + w - 24, y + 206);
  }
  function shopDetail(g, wall) {
    const x = wall.x;
    const y = wall.y;
    const width = wall.w;
    const shutter = x > 400 && x < 870;
    if (shutter) {
      g.fillStyle = '#5f665e';
      g.fillRect(x + 22, y + 165, width - 44, 56);
      g.strokeStyle = '#29332e';
      g.lineWidth = 2;
      for (let yy = y + 168; yy < y + 220; yy += 6) G.line(g, x + 23, yy, x + width - 23, yy);
      g.strokeStyle = '#b3ac8c';
      G.line(g, x + 30, y + 175, x + width - 39, y + 190);
    } else {
      g.strokeStyle = '#b0bda6';
      g.lineWidth = 1.4;
      for (let xx = x + 45; xx < x + width - 30; xx += 87) {
        G.line(g, xx, y + 168, xx + 19, y + 192);
        G.line(g, xx + 19, y + 192, xx + 4, y + 217);
        G.line(g, xx + 19, y + 192, xx + 38, y + 200);
      }
      g.fillStyle = '#8d6d49';
      for (let xx = x + 36; xx < x + width - 28; xx += 55) g.fillRect(xx, y + 207, 29, 8);
    }
    if (x < 400 || x > 1200) {
      g.fillStyle = '#68513e';
      g.fillRect(x + 12, y + 148, width - 24, 22);
      for (let xx = x + 16; xx < x + width - 20; xx += 30) {
        g.fillStyle = '#ad956a';
        g.fillRect(xx, y + 149, 14, 20);
      }
      g.strokeStyle = '#3e352b';
      g.lineWidth = 3;
      G.line(g, x + 12, y + 170, x + width - 12, y + 170);
    }
    escape(g, x + 40, y + 10, Math.min(130, width - 85));
  }
  function escape(g, x, y, w) {
    g.strokeStyle = '#8b8980';
    g.lineWidth = 3;
    g.strokeRect(x, y, w, 65);
    for (let xx = x; xx < x + w; xx += 14) G.line(g, xx, y, xx, y + 65);
    for (const xx of [x + 10, x + w - 10]) G.line(g, xx, y + 65, xx + 45, y + 180);
    for (let yy = 0; yy < 115; yy += 12) {
      G.line(g, x + 10 + yy * 0.4, y + 65 + yy, x + w - 10 + yy * 0.4, y + 65 + yy);
    }
  }
  function car(g, x, y, angle, burnt = false) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = '#151f23';
    G.rr(g, -78, -37, 160, 86, 16);
    g.fill();
    g.fillStyle = burnt ? '#584b3f' : '#5f716a';
    G.rr(g, -78, -42, 153, 76, 15);
    g.fill();
    g.fillStyle = '#a2a58f';
    g.fillRect(-43, -34, 65, 60);
    g.fillStyle = '#223a3c';
    g.fillRect(-32, -31, 40, 54);
    g.fillStyle = '#c5b69b';
    g.fillRect(-80, -29, 5, 51);
    g.fillRect(73, -29, 5, 51);
    g.strokeStyle = burnt ? '#2b2925' : '#83998c';
    g.lineWidth = 2;
    G.line(g, 30, -30, 30, 24);
    g.restore();
  }
  const STREET_PROPS = [
    { kind: 'car', x: 510, y: 510, angle: 0.22, burnt: true },
    { kind: 'car', x: 1620, y: 970, angle: -0.15, burnt: true },
    { kind: 'car', x: 240, y: 1080, angle: 0.04 },
    { kind: 'overturned', x: 1060, y: 750, angle: -0.25 },
    { kind: 'car', x: 1810, y: 480, angle: 0.18 },
    { kind: 'car', x: 1320, y: 415, angle: -0.05 },
    { kind: 'shelter', x: 765, y: 1100 },
    { kind: 'news', x: 390, y: 945 },
    { kind: 'news', x: 965, y: 450 },
    { kind: 'news', x: 1430, y: 1135 },
    { kind: 'bin', x: 375, y: 655, burning: true },
    { kind: 'bin', x: 1190, y: 550, burning: true },
    { kind: 'bin', x: 1770, y: 820, burning: true },
    { kind: 'lamp', x: 315, y: 390 },
    { kind: 'lamp', x: 910, y: 1070 },
    { kind: 'lamp', x: 1810, y: 1110 },
  ];
  const TRUCK_PROPS = [
    { kind: 'barricade', x: 290, y: 430 },
    { kind: 'barricade', x: 640, y: 365 },
    { kind: 'barricade', x: 1550, y: 375 },
    { kind: 'barricade', x: 1750, y: 1240 },
    { kind: 'car', x: 330, y: 610, angle: 1.3, burnt: true },
    { kind: 'car', x: 1810, y: 580, angle: -0.4, burnt: true },
    { kind: 'overturned', x: 1120, y: 1240, angle: -0.05 },
    { kind: 'sandbags', x: 265, y: 915 },
    { kind: 'sandbags', x: 1800, y: 975 },
    { kind: 'sandbags', x: 1450, y: 1230 },
    { kind: 'bin', x: 1630, y: 1135, burning: true },
    { kind: 'lamp', x: 1750, y: 405 },
  ];
  function prop(g, item) {
    const { x, y, kind } = item;
    if (kind === 'car') {
      car(g, x, y, item.angle || 0, item.burnt);
      return;
    }
    g.save();
    g.translate(x, y);
    if (kind === 'overturned') {
      g.rotate(item.angle || 0);
      g.fillStyle = '#172022';
      G.rr(g, -88, -40, 176, 83, 13);
      g.fill();
      g.fillStyle = '#59554a';
      g.fillRect(-75, -34, 150, 68);
      g.strokeStyle = '#978771';
      g.lineWidth = 3;
      G.line(g, -70, 0, 70, 0);
      for (const xx of [-53, 53]) {
        G.line(g, xx, -40, xx, 40);
        for (const yy of [-37, 37]) {
          g.fillStyle = '#171c1c';
          G.rr(g, xx - 16, yy - 11, 32, 22, 5);
          g.fill();
          g.fillStyle = '#726e62';
          g.fillRect(xx - 8, yy - 3, 16, 6);
        }
      }
    } else if (kind === 'shelter') {
      g.fillStyle = '#293435';
      g.fillRect(-88, -40, 176, 75);
      g.fillStyle = 'rgba(121,155,151,0.22)';
      g.fillRect(-79, -34, 158, 55);
      g.strokeStyle = '#a0a391';
      g.lineWidth = 4;
      g.strokeRect(-88, -40, 176, 75);
      G.line(g, -26, -40, -26, 35);
      G.line(g, 35, -40, 35, 35);
      g.fillStyle = '#75634f';
      g.fillRect(-65, 9, 115, 16);
      g.strokeStyle = '#c0b5a0';
      g.lineWidth = 1;
      G.line(g, 55, -32, 39, -7);
      G.line(g, 39, -7, 65, 12);
      G.line(g, 39, -7, 23, 2);
    } else if (kind === 'news') {
      g.fillStyle = '#7e5144';
      G.rr(g, -19, -30, 38, 61, 4);
      g.fill();
      g.fillStyle = '#cdc1a5';
      g.fillRect(-13, -21, 26, 29);
      g.fillStyle = '#514e43';
      for (let yy = -17; yy < 7; yy += 5) g.fillRect(-9, yy, yy === -17 ? 19 : 14, 2);
      g.fillStyle = '#292d2a';
      g.fillRect(-13, 17, 26, 6);
    } else if (kind === 'bin') {
      g.fillStyle = '#3d5146';
      G.ellipse(g, 0, 6, 25, 29);
      g.fill();
      g.strokeStyle = '#8a957a';
      g.lineWidth = 2;
      for (let xx = -17; xx <= 17; xx += 7) G.line(g, xx, -15, xx, 27);
      g.fillStyle = '#141b1b';
      G.ellipse(g, 0, -17, 25, 11);
      g.fill();
    } else if (kind === 'lamp') {
      g.fillStyle = '#525b52';
      G.ellipse(g, 0, 0, 14, 9);
      g.fill();
      g.strokeStyle = '#929684';
      g.lineWidth = 5;
      G.line(g, 0, 0, 0, -92);
      G.line(g, 0, -92, 35, -92);
      g.fillStyle = '#383f3a';
      G.rr(g, 27, -98, 26, 14, 4);
      g.fill();
    } else if (kind === 'barricade') {
      g.strokeStyle = '#796548';
      g.lineWidth = 7;
      for (const xx of [-55, 55]) {
        G.line(g, xx - 13, 28, xx + 8, -18);
        G.line(g, xx + 17, 28, xx - 8, -18);
      }
      g.fillStyle = '#b4a380';
      g.fillRect(-80, -18, 160, 23);
      g.save();
      g.beginPath();
      g.rect(-80, -18, 160, 23);
      g.clip();
      g.strokeStyle = '#433f32';
      g.lineWidth = 15;
      for (let xx = -85; xx < 100; xx += 34) G.line(g, xx, 8, xx + 26, -21);
      g.restore();
    } else if (kind === 'sandbags') {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          g.fillStyle = row ? '#8a8060' : '#a0946f';
          G.rr(g, -72 + col * 35 + row * 7, -14 + row * 22, 34, 23, 9);
          g.fill();
          g.strokeStyle = '#615d48';
          g.lineWidth = 1;
          g.stroke();
        }
      }
    }
    g.restore();
  }
  function streetDressing(g, arena) {
    const items = arena ? TRUCK_PROPS : STREET_PROPS;
    for (const item of items) prop(g, item);
    const anchors = items.map(item => ({ x: item.x, y: item.y, r: item.kind === 'car' ? 85 : 55 }));
    const random = U.seeded(arena ? 77113 : 77112);
    // Deliberate broken-glass/newspaper clusters fill street-sized dead zones,
    // not a uniform noise texture. They are flat so no rescue route is blocked.
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        const x = 145 + col * 245 + (row % 2) * 35 + (random() - 0.5) * 90;
        const y = 470 + row * 205 + (col % 3) * 21 + (random() - 0.5) * 80;
        anchors.push({ x, y, r: 44 });
        g.strokeStyle = 'rgba(12,17,18,0.6)';
        g.lineWidth = 4;
        G.line(g, x - 34, y + 13, x + 37, y - 9);
        for (let n = 0; n < 6 + (col + row) % 8; n++) {
          const xx = x + (random() - 0.5) * 85;
          const yy = y + (random() - 0.5) * 55;
          g.fillStyle = n % 3 ? '#727f77' : '#b3aa8b';
          g.beginPath();
          g.moveTo(xx, yy);
          g.lineTo(xx + 4 + random() * 7, yy - 3);
          g.lineTo(xx + 3, yy + 5 + random() * 4);
          g.fill();
        }
        if ((row + col) % 3 === 0) {
          g.fillStyle = '#424b44';
          G.ellipse(g, x + 20, y + 7, 34, 18);
          g.fill();
          g.strokeStyle = '#92927b';
          g.lineWidth = 1;
          for (let yy = -10; yy <= 10; yy += 5) G.line(g, x - 5, y + 7 + yy, x + 44, y + 7 + yy);
        }
        g.fillStyle = '#a2987d';
        g.save();
        g.translate(x + 23, y + 4);
        g.rotate(random());
        g.fillRect(-13, -7, 20 + (row % 2) * 6, 10 + (col % 2) * 4);
        g.fillStyle = '#4d5148';
        for (let line = -4; line < 6; line += 4) g.fillRect(-9, line, 16, 1);
        g.restore();
      }
    }
    return anchors;
  }
  S.streetProps = { avenue: STREET_PROPS, truck: TRUCK_PROPS };
  function street(g, width, height, arena = false) {
    const random = U.seeded(arena ? 7719 : 7708);
    g.fillStyle = '#232c2c';
    g.fillRect(0, 0, width, height);
    for (let i = 0; i < 5200; i++) {
      const x = random() * width;
      const y = random() * height;
      g.fillStyle = i % 2 ? 'rgba(190,172,130,0.07)' : 'rgba(8,15,19,0.16)';
      g.fillRect(x, y, 2 + random() * 5, 1 + random() * 2);
    }
    for (const y of [290, height - 230]) {
      g.fillStyle = '#68635a';
      g.fillRect(55, y, width - 110, 115);
      g.strokeStyle = '#373b36';
      g.lineWidth = 2;
      for (let x = 55; x < width - 55; x += 68) G.line(g, x, y, x, y + 115);
      g.fillStyle = '#9f9782';
      g.fillRect(55, y + (y === 290 ? 107 : 0), width - 110, 7);
    }
    g.fillStyle = '#aa9863';
    for (let x = 100; x < width - 120; x += 140) {
      g.fillRect(x, height / 2 - 5, 66, 5);
      g.fillRect(x, height / 2 + 9, 66, 5);
    }
    for (const x of [290, width - 370]) {
      for (let y = 450; y < height - 265; y += 48) {
        g.fillStyle = '#b0a584';
        g.fillRect(x, y, 78, 24);
      }
    }
    // The solid building surfaces use the map's summerBuilding wall style.
    escape(g, 1470, 310, 230);
    for (let i = 0; i < 60; i++) {
      const x = 100 + random() * (width - 200);
      const y = 400 + random() * (height - 470);
      g.save();
      g.translate(x, y);
      g.rotate(random() * 3);
      g.fillStyle = '#a99e80';
      g.fillRect(-8, -5, 16, 10);
      g.fillStyle = '#53584c';
      g.fillRect(-6, -2, 11, 1);
      g.fillRect(-6, 1, 9, 1);
      g.restore();
    }
    for (const [x, y] of [[580, 800], [1430, 910], [1150, 440]]) {
      g.fillStyle = '#1b2323';
      G.ellipse(g, x, y, 33, 22);
      g.fill();
      g.strokeStyle = '#68695c';
      g.lineWidth = 2;
      for (let dy = -14; dy <= 14; dy += 7) G.line(g, x - 24, y + dy, x + 24, y + dy);
    }
    return streetDressing(g, arena);
  }
  function tenement(g, width, height) {
    const random = U.seeded(776);
    g.fillStyle = '#172326';
    g.fillRect(0, 0, width, height);
    g.fillStyle = '#49453e';
    g.fillRect(200, 90, 1240, 1270);
    for (let floor = 0; floor < 5; floor++) {
      const y = 130 + floor * 235;
      for (const x of [240, 940]) {
        g.fillStyle = floor % 2 ? '#696253' : '#736650';
        g.fillRect(x, y, 440, 210);
        g.strokeStyle = 'rgba(32,30,25,0.34)';
        g.lineWidth = 1;
        for (let yy = y; yy < y + 210; yy += 14) G.line(g, x, yy, x + 440, yy);
        for (let i = 0; i < 42; i++) {
          const xx = x + random() * 430;
          const yy = y + random() * 205;
          g.fillStyle = 'rgba(14,23,22,0.08)';
          g.fillRect(xx, yy, 15 + random() * 26, 2);
        }
        g.fillStyle = ['#5a706b', '#745951', '#5d646b'][floor % 3];
        G.rr(g, x + 28, y + 30, 118, 142, 6);
        g.fill();
        g.fillStyle = '#cabd9b';
        G.rr(g, x + 38, y + 40, 96, 28, 5);
        g.fill();
        g.strokeStyle = '#9a9a7b';
        g.lineWidth = 2;
        for (let yy = y + 85; yy < y + 165; yy += 19) G.line(g, x + 32, yy, x + 140, yy);
        g.fillStyle = '#a18b61';
        g.fillRect(x + 260, y + 28, 110, 61);
        g.fillStyle = '#4c655b';
        G.circle(g, x + 313, y + 58, 16);
        g.fill();
        g.fillStyle = '#d8c29a';
        G.circle(g, x + 313, y + 58, 10);
        g.fill();
        g.fillStyle = '#2e3936';
        g.fillRect(x + 365, y + 155, 52, 35);
        g.fillStyle = '#617f76';
        g.fillRect(x + 371, y + 160, 40, 24);
        g.fillStyle = '#b69c70';
        g.fillRect(x + 185, y + 161, 38, 22);
        g.fillStyle = '#d0c4a8';
        g.fillRect(x + 190, y + 162, 29, 3);
      }
      g.fillStyle = '#7a7863';
      g.fillRect(710, y, 220, 210);
      g.strokeStyle = '#3a4d49';
      g.lineWidth = 3;
      for (let yy = y + 6; yy < y + 210; yy += 14) G.line(g, 735, yy, 905, yy);
      G.text(g, ['V', 'IV', 'III', 'II', 'I'][floor], 706, y + 35,
        { size: 20, align: 'right', color: '#d8c89e', weight: 600 });
      g.fillStyle = '#a99d80';
      g.fillRect(695, y - 7, 8, 220);
      g.fillRect(931, y - 7, 8, 220);
    }
    g.fillStyle = '#5e7160';
    g.fillRect(675, 1335, 290, 155);
    g.strokeStyle = '#a6c5ab';
    g.lineWidth = 3;
    g.strokeRect(680, 1340, 280, 145);
    G.text(g, 'TO THE STREET', 820, 1450, { size: 19, align: 'center', spacing: 3, color: '#cbd8ba' });
    for (const x of [570, 1065]) {
      g.fillStyle = '#917b59';
      G.rr(g, x, 1440, 110, 42, 8);
      g.fill();
      g.strokeStyle = '#403a2f';
      G.line(g, x + 10, 1461, x + 97, 1461);
    }
  }

  class Haze extends DM.Entity {
    constructor(state) {
      super({ x: 900, y: 700, r: 3000, body: false, solid: false, static: true, disintegratable: false, layer: 3 });
      this.state = state;
    }
    render(g, world) {
      if (DM.Save.settings.fx === 'off') return;
      const reduced = DM.SettingsSchema.reducedFlashing();
      const time = reduced ? 0 : world.time;
      g.fillStyle = 'rgba(187,149,98,0.035)';
      for (let i = 0; i < 9; i++) {
        const x = (i * 237 + time * 7) % world.w;
        const y = 380 + Math.sin(i * 2.1 + time * 0.08) * 100 + i * 70;
        G.ellipse(g, x, y, 190, 26);
        g.fill();
      }
    }
  }
  function lights(world, add) {
    for (const e of world.entities) {
      if (e.dead) continue;
      if (e instanceof S.FireGrid) {
        const keys = [...e.active].sort((a, b) => {
          const aa = e.point(a);
          const bb = e.point(b);
          return U.dist(aa.x, aa.y, world.player.x, world.player.y) - U.dist(bb.x, bb.y, world.player.x, world.player.y);
        }).slice(0, 16);
        for (const key of keys) {
          const p = e.point(key);
          const steady = DM.SettingsSchema.reducedFlashing() || DM.Save.settings.fx === 'off';
          const flicker = steady ? 1 : 0.94 + Math.sin(world.time * 3.7 + key * 1.6) * 0.045 +
            Math.sin(world.time * 6.1 + key) * 0.015;
          add(p.x, p.y, 270, { i: 0.88 * flicker, color: '#f5ad60', k: 0.36 });
        }
      }
      if (e.light) {
        const l = e.light(world);
        if (l) add(e.x, e.y, l.r, l);
      }
    }
  }
  for (const id of ['summer_avenue', 'summer_tenement', 'summer_truck']) {
    DM.Ambience.maps[id] = { bed: id === 'summer_tenement' ? 'summer_fire' : 'summer_street',
      surface: id === 'summer_tenement' ? 'wood' : 'concrete' };
    DM.Atmosphere.register(id, {
      shadow: 'rgba(9,16,22,0.55)',
      light: { ambient: 'rgba(8,14,22,0.59)', lights },
      weather: [{ type: 'haze', n: 20, alpha: 0.025 }],
    });
  }
  Object.assign(DM.Ambience.cues, {
    'long_summer.avenue': 'summer_street', 'long_summer.tenement': 'summer_street', 'long_summer.truck': 'summer_truck'
  });
  // Existing per-map wall drawing keeps the facade above its solid collision mass.
  S.addStreetFrontages = function (world, arena = false) {
    world.wallStyles.summerBuilding = {
      draw(g, wall) {
        facade(g, wall.x, wall.y, wall.w, wall.buildingName, wall.warm);
        shopDetail(g, wall);
      },
    };
    const names = arena ? ['EAST RIVER ARMOURY', '', '', 'NATIONAL GUARD'] : ['MERCER • GROCERY', '', 'ALVAREZ • ROOMS', ''];
    for (let i = 0; i < 4; i++) {
      const x = [90, 480, 875, 1270][i];
      world.wall(x, 60, i === 3 ? 690 : 360, 220, 'summerBuilding', { buildingName: names[i], warm: i % 2 === 0 });
    }
  };
  S.installArt = function (ctx, type) {
    const w = ctx.world;
    if (type === 'tenement') w.bake((g, width, height) => tenement(g, width, w.playableHeight || height));
    else w.bake((g, width, height) => {
      w.summerDressing = street(g, width, w.playableHeight || height, type === 'truck');
    });
    ctx.add(new Haze(ctx.flags.summer));
  };
  S.backdrop = function (g) {
    const sky = g.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, '#0c1c25');
    sky.addColorStop(0.65, '#664834');
    sky.addColorStop(1, '#ae7744');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1280, 720);
    for (let layer = 0; layer < 3; layer++) {
      const rnd = U.seeded(77 + layer);
      for (let x = -15; x < 1300; x += 65) {
        const y = 460 - rnd() * (160 - layer * 25) + layer * 50;
        g.fillStyle = ['#39413d', '#273337', '#13262c'][layer];
        g.fillRect(x, y, 59, 720 - y);
        if (layer < 2) continue;
        for (let yy = y + 17; yy < 710; yy += 23) {
          for (let xx = x + 9; xx < x + 52; xx += 13) {
            if (rnd() > 0.85) {
              g.fillStyle = '#9f895b';
              g.fillRect(xx, yy, 5, 8);
            }
          }
        }
      }
    }
    G.glow(g, 1010, 510, 220, '#ec9e51', 0.14);
  };
})();
