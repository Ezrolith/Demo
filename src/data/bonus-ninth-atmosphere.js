/* Harrow Street: architecture, a shared nine-second clock and synthesized transit sounds. */
(function () {
  'use strict';
  const DM = window.DM;
  const G = DM.Gfx;
  const U = DM.U;
  const K = DM.BonusKit;
  const TEAL = '#93ddd2';
  const GOLD = '#e7bd77';
  const fullMotion = () => DM.Save.settings.fx !== 'off';
  const reduced = () => DM.SettingsSchema.reducedFlashing();

  DM.Audio.define('ninth_arrive', {
    gap: 0.1,
    fn(a) {
      a.tone({ freq: 74, freqEnd: 49, dur: 1.7, gain: 0.045, type: 'sine', attack: 0.25 });
      a.noise({ dur: 1.6, gain: 0.035, ftype: 'bandpass', freq: 420, freqEnd: 1900, q: 2, attack: 0.6 });
      a.noise({ dur: 0.6, gain: 0.023, ftype: 'highpass', freq: 2600, delay: 1.1, attack: 0.16 });
    },
  });
  DM.Audio.define('ninth_chime', {
    gap: 0.1,
    fn(a) {
      a.tone({ freq: 784, dur: 0.6, gain: 0.035, type: 'sine', attack: 0.015, echo: 0.17 });
      a.tone({ freq: 622, dur: 0.9, gain: 0.03, type: 'sine', delay: 0.23, echo: 0.17 });
      a.noise({ dur: 0.6, gain: 0.012, ftype: 'bandpass', freq: 1600, attack: 0.1 });
    },
  });
  DM.Audio.define('ninth_depart', {
    gap: 0.1,
    fn(a) {
      a.tone({ freq: 45, freqEnd: 92, dur: 1.9, gain: 0.04, type: 'sine', attack: 0.3 });
      a.noise({ dur: 1.8, gain: 0.027, ftype: 'lowpass', freq: 350, freqEnd: 1900, attack: 0.6 });
      for (let i = 0; i < 6; i++) {
        a.noise({ dur: 0.05, gain: 0.009, ftype: 'bandpass', freq: 400, delay: 0.2 + i * 0.22 });
      }
    },
  });
  DM.Audio.define('ninth_rewind', {
    gap: 0.1,
    fn(a) {
      a.noise({ dur: 0.36, gain: 0.019, ftype: 'bandpass', freq: 460, freqEnd: 1600, attack: 0.27 });
      a.tone({ freq: 440, freqEnd: 140, dur: 0.4, gain: 0.018, type: 'sine', attack: 0.14 });
    },
  });
  DM.Audio.define('ninth_announcement', {
    gap: 1,
    fn(a) {
      // Formant-like filtered noise, deliberately without intelligible words.
      const syllables = [1, 0.3, 0.7, 0, 0.8, 0.6, 0.2, 0, 1, 0.7, 0.4, 0.2];
      syllables.forEach((gain, i) => {
        if (!gain) return;
        a.noise({ dur: 0.12, gain: gain * 0.014, ftype: 'bandpass', freq: 640 + (i % 3) * 210,
          q: 4, delay: i * 0.17, attack: 0.025, echo: 0.12 });
      });
    },
  });
  DM.Audio.define('ninth_drip', {
    gap: 0.1,
    fn(a) {
      a.tone({ freq: 1360, freqEnd: 620, dur: 0.1, gain: 0.009, type: 'sine', echo: 0.22 });
    },
  });
  DM.Audio.define('ninth_tick', {
    gap: 0.1,
    fn(a) {
      a.noise({ dur: 0.02, gain: 0.011, ftype: 'bandpass', freq: 2200, q: 2 });
    },
  });
  DM.Ambience.beds.ninth_tunnel = {
    layers: [
      { kind: 'drone', oscs: [{ f: 49, wave: 'sine' }, { f: 57, wave: 'sine', g: 0.35 }],
        cutoff: 230, gain: 0.018, lfo: { rate: 0.065, depth: 0.25 } },
      { kind: 'wind', ftype: 'lowpass', freq: 560, q: 0.6, gain: 0.011,
        lfo: { rate: 0.13, depth: 0.4, fdepth: 0.15 } },
      { kind: 'events', sound: 'ninth_drip', every: [3, 7], first: [1, 3], gain: 0.7 },
      { kind: 'events', sound: 'ninth_tick', every: [6, 11], first: [3, 7], gain: 0.6 },
    ],
  };

  function rivetedColumn(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x + 7, y - 66, 38, 159);
    const metal = g.createLinearGradient(x - 20, 0, x + 20, 0);
    metal.addColorStop(0, '#233936');
    metal.addColorStop(0.45, '#56756b');
    metal.addColorStop(0.6, '#7c9180');
    metal.addColorStop(1, '#263f3b');
    g.fillStyle = metal;
    g.fillRect(x - 16, y - 67, 32, 134);
    for (const end of [-1, 1]) {
      g.fillStyle = '#87957d';
      g.fillRect(x - 29, y + end * 62 - 8, 58, 16);
      g.fillStyle = '#344e45';
      g.fillRect(x - 24, y + end * 49 - 6, 48, 11);
    }
    for (let j = -3; j <= 3; j++) {
      for (const dx of [-11, 11]) {
        g.fillStyle = '#172a28';
        G.circle(g, x + dx, y + j * 17, 2.5);
        g.fill();
        g.fillStyle = '#9aab92';
        G.circle(g, x + dx - 0.7, y + j * 17 - 0.8, 1);
        g.fill();
      }
    }
  }

  function bench(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    G.rr(g, x - 93, y - 12, 193, 53, 8);
    g.fill();
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? '#987449' : '#b09160';
      g.fillRect(x - 90, y - 16 + i * 8, 180, 6);
      g.strokeStyle = 'rgba(36,20,12,0.45)';
      g.lineWidth = 1;
      G.line(g, x - 83, y - 13 + i * 8, x + 75, y - 13 + i * 8);
    }
    for (const dx of [-71, 71]) {
      g.fillStyle = '#192e2b';
      g.fillRect(x + dx - 4, y - 27, 8, 63);
      G.rr(g, x + dx - 11, y - 28, 22, 10, 4);
      g.fill();
    }
  }

  function poster(g, x, y, title, subtitle, color) {
    g.fillStyle = '#142923';
    g.fillRect(x - 58, y - 78, 116, 156);
    g.fillStyle = color;
    g.fillRect(x - 53, y - 72, 106, 143);
    g.fillStyle = '#d0c19c';
    G.circle(g, x, y - 24, 29);
    g.fill();
    g.fillStyle = color;
    G.circle(g, x + 9, y - 28, 25);
    g.fill();
    G.text(g, title, x, y + 24, { size: 12, align: 'center', color: '#eee0b9', weight: 600, spacing: 1 });
    G.text(g, subtitle, x, y + 42, { size: 11, align: 'center', color: '#e3cfa3' });
    g.fillStyle = 'rgba(12,25,21,0.16)';
    g.fillRect(x - 50, y + 53, 100, 14);
    g.fillStyle = '#c4c0a0';
    g.beginPath();
    g.moveTo(x + 36, y + 70);
    g.lineTo(x + 53, y + 51);
    g.lineTo(x + 53, y + 70);
    g.fill();
  }

  function newsstand(g, x, y) {
    g.fillStyle = '#152723';
    G.rr(g, x - 112, y - 67, 224, 139, 7);
    g.fill();
    g.fillStyle = '#7f4c35';
    g.fillRect(x - 105, y - 63, 210, 126);
    g.fillStyle = '#1e302b';
    g.fillRect(x - 93, y - 38, 186, 68);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 7; col++) {
        g.fillStyle = ['#cbbb8e', '#b78662', '#829182'][col % 3];
        g.fillRect(x - 88 + col * 26, y - 30 + row * 31, 22, 26);
        g.fillStyle = '#4c5445';
        g.fillRect(x - 85 + col * 26, y - 26 + row * 31, 16, 3);
        g.fillRect(x - 85 + col * 26, y - 18 + row * 31, 8, 11);
      }
    }
    g.fillStyle = '#ba9a65';
    g.fillRect(x - 108, y + 32, 216, 14);
    G.text(g, 'EVENING PAPERS', x, y - 45, { size: 14, spacing: 2, align: 'center', color: '#ead2a1' });
  }

  function pipe(g, x, y, length, vertical = false) {
    g.save();
    g.translate(x, y);
    if (vertical) g.rotate(Math.PI / 2);
    g.strokeStyle = '#0e2024';
    g.lineWidth = 19;
    G.line(g, 0, 4, length, 4);
    g.strokeStyle = '#67796a';
    g.lineWidth = 12;
    G.line(g, 0, 0, length, 0);
    g.strokeStyle = '#a09b7e';
    g.lineWidth = 2;
    G.line(g, 0, -3, length, -3);
    for (let i = 20; i < length; i += 72) {
      g.fillStyle = '#263e3b';
      g.fillRect(i, -10, 9, 20);
    }
    g.restore();
  }

  function gear(g, x, y, radius, angle) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = '#796f50';
    for (let i = 0; i < 18; i++) {
      g.rotate(Math.PI / 9);
      g.fillRect(radius - 5, -8, 17, 16);
    }
    G.circle(g, 0, 0, radius);
    g.fill();
    K.ring(g, 0, 0, radius - 5, '#b3a276', 3);
    g.fillStyle = '#203a38';
    G.circle(g, 0, 0, radius * 0.66);
    g.fill();
    g.strokeStyle = '#8e8967';
    g.lineWidth = 9;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      G.line(g, 0, 0, Math.cos(a) * (radius - 10), Math.sin(a) * (radius - 10));
    }
    g.fillStyle = '#c7b382';
    G.circle(g, 0, 0, 12);
    g.fill();
    g.restore();
  }

  function trainCar(g, x, y, doorOpen, index) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    G.rr(g, 7, 10, 368, 168, 20);
    g.fill();
    const steel = g.createLinearGradient(0, 0, 0, 165);
    steel.addColorStop(0, '#8b9f96');
    steel.addColorStop(0.16, '#b4b9a6');
    steel.addColorStop(0.24, '#637b72');
    steel.addColorStop(0.78, '#405d57');
    steel.addColorStop(0.94, '#9fa789');
    steel.addColorStop(1, '#344b49');
    g.fillStyle = steel;
    G.rr(g, 0, 0, 364, 163, 19);
    g.fill();
    g.strokeStyle = '#182e2b';
    g.lineWidth = 4;
    G.rr(g, 0, 0, 364, 163, 19);
    g.stroke();
    for (let row = 0; row < 7; row++) {
      g.strokeStyle = row % 2 ? 'rgba(210,220,187,0.18)' : 'rgba(13,33,29,0.25)';
      g.lineWidth = 2;
      G.line(g, 18, 23 + row * 17, 347, 23 + row * 17);
    }
    g.fillStyle = '#182e2b';
    for (const wx of [33, 82, 242, 291]) {
      G.rr(g, wx - 3, 34, 40, 80, 6);
      g.fill();
      const glass = g.createLinearGradient(0, 35, 0, 113);
      glass.addColorStop(0, '#e2d399');
      glass.addColorStop(1, '#8e956e');
      g.fillStyle = glass;
      g.fillRect(wx, 38, 34, 70);
      g.fillStyle = 'rgba(29,48,43,0.75)';
      G.circle(g, wx + 18, 66, 7);
      g.fill();
      G.ellipse(g, wx + 18, 91, 13, 18);
      g.fill();
      g.fillStyle = '#182e2b';
    }
    // The black opening appears between two sliding leaves, not a text label.
    g.fillStyle = '#11221f';
    g.fillRect(137, 27, 83, 119);
    for (const side of [-1, 1]) {
      const offset = side * doorOpen * 30;
      g.fillStyle = '#839789';
      g.fillRect(178 + (side < 0 ? -39 : 0) + offset, 28, 39, 116);
      g.fillStyle = '#d3c999';
      g.fillRect(184 + (side < 0 ? -39 : 0) + offset, 39, 27, 62);
      g.fillStyle = '#263d37';
      g.fillRect(180 + offset + side * 3, 105, 3, 22);
    }
    g.fillStyle = '#384e42';
    G.circle(g, 335, 139, 13);
    g.fill();
    G.text(g, '9', 335, 145, { size: 17, align: 'center', color: '#d8cca0', weight: 600 });
    g.fillStyle = '#142626';
    g.fillRect(364, 65, 18, 34);
    g.fillStyle = '#cfc39a';
    g.fillRect(8, 129, 6, 10);
    if (index === 2) {
      g.fillStyle = '#e7dfb0';
      G.circle(g, 353, 31, 5);
      g.fill();
      G.circle(g, 353, 131, 5);
      g.fill();
    }
    g.restore();
  }

  class Cycle extends DM.Entity {
    constructor(ctx, mode) {
      const world = ctx.world;
      super({ x: world.w / 2, y: world.h / 2, r: world.w, static: true, body: false,
        solid: false, disintegratable: false, layer: -5 });
      this.ctx = ctx;
      this.mode = mode;
      this.started = false;
      this.resetAge = 1;
      this.crossings = { arrive: 0, chime: 0, depart: 0, rewind: 0 };
      world.cycleT = 0;
      world.cycleNumber = 0;
      world.stationCycle = this;
    }
    get trainX() {
      const t = this.world.cycleT;
      if (t < 2.2) return U.lerp(-1180, 390, 1 - Math.pow(1 - t / 2.2, 3));
      if (t < 6.4) return 390;
      return U.lerp(390, this.world.w + 200, Math.pow((t - 6.4) / 2.6, 2));
    }
    get doorOpen() {
      const t = this.world.cycleT;
      return U.clamp(Math.min((t - 2.4) / 0.45, (6.4 - t) / 0.5), 0, 1);
    }
    update(dt, world) {
      if (world.ceasefire) return;
      const audible = this.mode !== 'engine';
      if (!this.started) {
        this.started = true;
        this.crossings.arrive++;
        if (audible) DM.Audio.play('ninth_arrive');
      }
      const before = world.cycleT;
      const after = before + dt;
      if (before < 2.4 && after >= 2.4) {
        this.crossings.chime++;
        if (audible) DM.Audio.play('ninth_chime');
      }
      if (before < 6.4 && after >= 6.4) {
        this.crossings.depart++;
        if (audible) DM.Audio.play('ninth_depart');
      }
      world.cycleT = after;
      this.resetAge += dt;
      if (after >= 9) {
        world.cycleT = after % 9;
        this.resetAge = 0;
        this.started = false;
        this.crossings.rewind++;
        if (audible) DM.Audio.play('ninth_rewind');
        world.cycleNumber++;
        if (audible && world.cycleNumber % 3 === 2) DM.Audio.play('ninth_announcement');
      }
      if (this.mode === 'engine' && before < 4 && after >= 4 && fullMotion()) {
        for (const [x, y] of [[440, 420], [1460, 1120]]) {
          world.particles.burst(x, y, DM.Save.settings.fx === 'full' ? 14 : 5, {
            color: ['#c2d0c1'], speed: [10, 35], life: [0.7, 1.8], size: [7, 14],
            drag: 2, add: false, alpha: 0.08,
          });
        }
      }
    }
    light(world) {
      if (this.mode !== 'platform') return null;
      return { x: this.trainX + 1130, y: 592, r: 480, i: 0.8, color: '#e7e1b7', k: 0.13, cone: 0, spread: 0.24 };
    }
    render() {}
    overlay(g, world) {
      const t = world.cycleT;
      if (this.mode === 'platform') {
        g.save();
        g.beginPath();
        g.rect(100, 500, world.w - 200, 205);
        g.clip();
        for (let i = 0; i < 3; i++) trainCar(g, this.trainX + i * 382, 514, this.doorOpen, i);
        g.restore();
        if (fullMotion()) {
          for (let i = 0; i < 7; i++) {
            const route = i % 2 ? -1 : 1;
            const x = 500 + i * 145 + route * Math.min(t, 6.3) * 14;
            const y = 778 + (i % 3) * 43;
            g.save();
            g.globalAlpha = world.timesight ? 0.48 : 0.12;
            G.figure(g, Object.assign({}, DM.LOOKS.commuter, {
              x, y, angle: route > 0 ? 0 : Math.PI, walk: t * 6, moving: t < 6.3,
            }));
            g.restore();
          }
        }
      }
      if (this.mode === 'engine') {
        for (const [x, y, r, k] of [[380, 500, 74, 1], [497, 420, 54, -1.37],
          [1490, 470, 82, -0.9], [1590, 570, 49, 1.5], [400, 1090, 65, 1.1], [1515, 1060, 76, -1]]) {
          gear(g, x, y, r, t * k * 0.38);
        }
      }
      if (this.resetAge < 0.25 && !reduced() && fullMotion()) {
        g.save();
        g.globalCompositeOperation = 'saturation';
        g.globalAlpha = 0.17 * (1 - this.resetAge / 0.25);
        g.strokeStyle = '#888888';
        g.lineWidth = 90;
        G.circle(g, world.w / 2, world.h / 2, this.resetAge * 6500);
        g.stroke();
        g.restore();
      }
    }
  }

  function decorate(ctx, mode) {
    const world = ctx.world;
    const g = world.floorCanvas.getContext('2d');
    g.save();
    g.setTransform(world.floorScale, 0, 0, world.floorScale, 0, 0);
    const rnd = U.seeded(mode === 'platform' ? 1977 : mode === 'train' ? 908 : 9009);
    const width = world.w;
    // Cream tile, green dado and hairline grout retain the original muted palette.
    for (let y = 177; y < 286; y += 18) {
      for (let x = 98; x < width - 98; x += 30) {
        g.fillStyle = y > 243 ? '#406153' : (rnd() > 0.35 ? '#c4c0a4' : '#aaa991');
        g.fillRect(x + 1, y + 1, 28, 16);
        if (rnd() < 0.1) {
          g.strokeStyle = 'rgba(42,58,46,0.35)';
          g.lineWidth = 1;
          G.line(g, x + 4, y + 3, x + 16, y + 15);
        }
      }
    }
    g.fillStyle = '#304a3e';
    g.fillRect(width / 2 - 236, 196, 472, 52);
    for (let y = 197; y < 247; y += 5) {
      for (let x = width / 2 - 235; x < width / 2 + 235; x += 5) {
        g.fillStyle = rnd() > 0.6 ? '#3f5947' : '#28463b';
        g.fillRect(x, y, 4, 4);
      }
    }
    G.text(g, mode === 'engine' ? 'HARROW • CLOCK WORKS' : 'HARROW ST', width / 2, 233,
      { size: 26, align: 'center', spacing: 5, weight: 600, color: '#d8d1ae' });
    for (let i = 0; i < 38; i++) {
      g.fillStyle = 'rgba(14,35,29,0.12)';
      g.fillRect(100 + rnd() * (width - 200), 177, 6 + rnd() * 18, 35 + rnd() * 80);
    }
    if (mode !== 'engine') {
      for (const y of [492, 705]) {
        g.fillStyle = '#b19d4d';
        g.fillRect(103, y, width - 206, 8);
        for (let x = 110; x < width - 110; x += 11) {
          g.fillStyle = '#d3c58c';
          G.circle(g, x, y + 15, 1.8);
          g.fill();
          G.circle(g, x + 5, y + 23, 1.8);
          g.fill();
        }
      }
      bench(g, 650, mode === 'platform' ? 1090 : 1220);
      bench(g, width - 420, mode === 'platform' ? 1090 : 1220);
      newsstand(g, mode === 'platform' ? 1280 : 1180, 350);
      poster(g, 700, 350, 'TOMORROW', 'ON TIME', '#765441');
      poster(g, width - 350, 350, 'TAKE THE', 'LONG WAY HOME', '#3d6962');
      for (const x of [510, width - 600]) {
        g.fillStyle = '#253e36';
        G.ellipse(g, x, 1080, 25, 34);
        g.fill();
        K.ring(g, x, 1060, 22, '#879481', 3);
        for (let j = 0; j < 5; j++) {
          g.strokeStyle = '#637a68';
          g.lineWidth = 2;
          G.line(g, x - 17 + j * 8, 1069, x - 17 + j * 8, 1103);
        }
      }
      for (let i = 0; i < 17; i++) {
        const x = 200 + rnd() * (width - 400), y = 850 + rnd() * 270;
        g.save();
        g.translate(x, y);
        g.rotate(rnd() * 1.7);
        g.fillStyle = '#a8a48c';
        g.fillRect(-12, -8, 25, 17);
        g.fillStyle = '#526153';
        g.fillRect(-9, -5, 19, 2);
        for (let row = 0; row < 4; row++) g.fillRect(-9, -1 + row * 2.5, 8, 1);
        g.fillRect(2, -1, 8, 8);
        g.restore();
      }
      for (const x of [610, 1150, width - 300]) {
        const y = mode === 'platform' ? 968 : 350;
        rivetedColumn(g, x, y);
      }
    } else {
      pipe(g, 270, 330, 1350);
      pipe(g, 280, 340, 890, true);
      pipe(g, 1620, 330, 900, true);
      for (const [x, y] of [[430, 420], [1460, 420], [430, 1110], [1460, 1110]]) {
        g.fillStyle = '#102927';
        g.fillRect(x - 58, y - 36, 116, 72);
        for (let j = -4; j < 5; j++) {
          g.strokeStyle = '#8b8b65';
          g.lineWidth = 6;
          G.line(g, x - 45 + j * 10, y - 29, x - 10 + j * 10, y + 29);
        }
        g.fillStyle = '#324c46';
        g.fillRect(x - 40, y - 23, 80, 46);
        for (let j = -3; j < 4; j++) {
          g.strokeStyle = '#132f2c';
          g.lineWidth = 3;
          G.line(g, x - 31, y + j * 6, x + 31, y + j * 6);
        }
      }
      for (const dx of [-8, 0, 8]) {
        g.strokeStyle = dx ? '#676b4d' : '#34453b';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(360 + dx, 1200);
        g.bezierCurveTo(650 + dx, 1320, 750 + dx, 910, 950 + dx, 850);
        g.stroke();
      }
    }
    for (const [x, y] of [[550, 820], [1210, 1050], [width - 340, 810]]) {
      const wet = g.createRadialGradient(x, y, 0, x, y, 110);
      wet.addColorStop(0, 'rgba(143,175,151,0.17)');
      wet.addColorStop(1, 'rgba(15,38,35,0.03)');
      g.fillStyle = wet;
      G.ellipse(g, x, y, 115, 22);
      g.fill();
      g.strokeStyle = 'rgba(160,185,156,0.14)';
      g.lineWidth = 1;
      G.line(g, x - 60, y + 5, x + 84, y + 5);
    }
    g.restore();
    const cycle = ctx.add(new Cycle(ctx, mode));
    world.overlays.push((canvas, current) => cycle.overlay(canvas, current));
    if (mode === 'engine') {
      for (const [x, y] of [[260, 350], [1640, 350], [260, 1200], [1640, 1200]]) {
        ctx.add(new K.Lamp(x, y, { r: 230, i: 0.65, color: GOLD, k: 0.13 }));
      }
    }
    return cycle;
  }

  DM.NinthAtmosphere = { decorate, Cycle, trainCar };
})();
