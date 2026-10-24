/* August streets: baked masonry, smoke, firelight and an original synthetic soundscape. */
(function () {
  'use strict';
  const DM = window.DM;
  const S = DM.Summer;
  const G = DM.Gfx;
  const K = DM.BonusKit;
  const U = DM.U;

  function leatherMask(g) {
    g.fillStyle = '#252a2b';
    g.beginPath();
    g.moveTo(30, 40);
    g.lineTo(70, 40);
    g.lineTo(67, 51);
    g.lineTo(52, 48);
    g.lineTo(48, 48);
    g.lineTo(33, 51);
    g.fill();
    g.fillStyle = '#cfb899';
    for (const x of [40, 60]) {
      G.ellipse(g, x, 45, 6, 2.4);
      g.fill();
    }
    g.fillStyle = '#79533b';
    g.fillRect(55, 67, 24, 4);
    g.fillStyle = '#d68846';
    g.fillRect(77, 67, 3, 4);
    g.fillStyle = '#e0bd53';
    G.circle(g, 68, 88, 6);
    g.fill();
    g.fillStyle = '#272b2d';
    G.circle(g, 66, 86, 0.7);
    g.fill();
    G.circle(g, 70, 86, 0.7);
    g.fill();
    g.strokeStyle = '#272b2d';
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(68, 87, 3, 0, Math.PI);
    g.stroke();
  }
  Object.assign(DM.LOOKS, {
    comedian: { name: 'The Comedian', skin: '#d4aa83', hair: '#363333', hairStyle: 'short',
      body: '#252b2e', sleeve: '#353b3d', legs: '#21282a', collar: '#4c5050', trim: '#ae965e',
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
    car(g, 510, 510, 0.22, true);
    car(g, width - 430, height - 350, -0.15, true);
    car(g, 240, height - 230, 0.05);
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
    g.fillRect(675, 1390, 290, 155);
    g.strokeStyle = '#a6c5ab';
    g.lineWidth = 3;
    g.strokeRect(680, 1395, 280, 145);
    G.text(g, 'TO THE STREET', 820, 1534, { size: 19, align: 'center', spacing: 3, color: '#cbd8ba' });
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
          add(p.x, p.y, 155, { i: 0.63, color: '#ebaa63', k: 0.17 });
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
    if (type === 'tenement') w.bake((g, width, height) => tenement(g, width, height));
    else w.bake((g, width, height) => street(g, width, height, type === 'truck'));
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
