/* WBYN: wet rooftop machinery, working analogue equipment and original synthesized city sounds. */
(function() {
  'use strict';
  const DM = window.DM;
  const G = DM.Gfx;
  const U = DM.U;
  const GOLD = '#e5ba68';
  const BLUE = '#80dcff';
  const reduced = () => DM.SettingsSchema.reducedFlashing();
  const animated = () => DM.Save.settings.fx !== 'off';
  DM.Audio.define('broadcast_siren', {
    gap: 2,
    fn(a) {
      for (let i = 0; i < 3; i++) {
        a.tone({
          freq: 490, freqEnd: 690, dur: 0.8, gain: 0.009, type: 'sine', delay: i * 1.45, attack: 0.35
        });
        a.tone({
          freq: 690, freqEnd: 490, dur: 0.7, gain: 0.008, type: 'sine', delay: i * 1.45 + 0.7
        });
      }
    },
  });
  DM.Audio.define('broadcast_relay_click', {
    gap: 0.1,
    fn(a) {
      a.noise({
        dur: 0.035, gain: 0.012, ftype: 'bandpass', freq: 1900, q: 1.2
      });
      a.noise({
        dur: 0.028, gain: 0.008, ftype: 'bandpass', freq: 1350, delay: 0.07
      });
    },
  });
  DM.Audio.define('broadcast_switchman', {
    gap: 0.5,
    fn(a) {
      [
        1, 0.5, 0.8, 0, 0.4, 1, 0.7, 0.2
      ].forEach((gain, i) => {
        if (!gain)
          return;
        a.noise({
          dur: 0.16, gain: gain * 0.018, ftype: 'bandpass', freq: 520 + i % 3 * 260,
          q: 5, delay: i * 0.18, attack: 0.03, echo: 0.2
        });
        a.tone({
          freq: 88 + i % 2 * 17, dur: 0.09, gain: gain * 0.004, type: 'sawtooth', delay: i * 0.18
        });
      });
    },
  });
  DM.Audio.define('broadcast_neon', {
    gap: 1,
    fn(a) {
      a.tone({
        freq: 120, freqEnd: 116, dur: 0.24, gain: 0.006, type: 'sawtooth', attack: 0.08
      });
    },
  });
  DM.Audio.define('broadcast_beam', {
    gap: 0.15,
    fn(a) {
      a.tone({
        freq: 170, freqEnd: 85, dur: 1.5, gain: 0.022, type: 'triangle', attack: 0.1
      });
      a.noise({
        dur: 1.25, gain: 0.014, ftype: 'bandpass', freq: 1800, freqEnd: 600, attack: 0.2
      });
    },
  });
  DM.Ambience.beds.broadcast_rain = {
    layers: [
      {
        kind: 'wind', ftype: 'lowpass', freq: 2100, q: 0.5, gain: 0.018, lfo: { rate: 0.12, depth: 0.16 }
      },
      {
        kind: 'wind', ftype: 'bandpass', freq: 500, q: 0.7, gain: 0.008, lfo: { rate: 0.04, depth: 0.2 }
      },
      {
        kind: 'drone', oscs: [
          { f: 58, wave: 'sine' },
          { f: 87, wave: 'sine', g: 0.2 }
        ], cutoff: 180, gain: 0.007
      },
      {
        kind: 'events', sound: 'broadcast_siren', every: [17, 29], first: [8, 14], gain: 0.6
      },
    ],
  };
  DM.Ambience.beds.broadcast_hum = {
    layers: [
      {
        kind: 'drone', oscs: [
          { f: 60, wave: 'sine' },
          { f: 120, wave: 'triangle', g: 0.14 }
        ],
        cutoff: 280, gain: 0.014, lfo: { rate: 0.08, depth: 0.1 }
      },
      {
        kind: 'wind', ftype: 'bandpass', freq: 760, q: 2, gain: 0.007, lfo: { rate: 0.36, depth: 0.16 }
      },
      {
        kind: 'events', sound: 'broadcast_relay_click', every: [2.5, 5.5], first: [1, 2], gain: 0.7
      },
    ],
  };
  function puddle(g, x, y, r, color) {
    g.fillStyle = 'rgba(5,13,23,0.7)';
    G.ellipse(g, x, y, r, r * 0.3);
    g.fill();
    const shine = g.createLinearGradient(x - r, y, x + r, y);
    shine.addColorStop(0, 'rgba(80,112,135,0)');
    shine.addColorStop(0.55, color);
    shine.addColorStop(1, 'rgba(80,112,135,0)');
    g.fillStyle = shine;
    G.ellipse(g, x, y - 2, r * 0.86, r * 0.2);
    g.fill();
    g.strokeStyle = 'rgba(131,166,190,0.24)';
    g.lineWidth = 1;
    G.line(g, x - r * 0.7, y + 4, x + r * 0.6, y + 4);
  }
  function roofFloor(g, width, height, seed) {
    const rnd = U.seeded(seed);
    const sky = g.createLinearGradient(0, 0, 0, 240);
    sky.addColorStop(0, '#0c1327');
    sky.addColorStop(1, '#655461');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    DM.Bonus.city(g, 5, 0, 0, width, 215);
    g.fillStyle = '#242e3a';
    g.fillRect(65, 210, width - 130, height - 270);
    for (let y = 214; y < height - 70; y += 145) {
      for (let x = 71; x < width - 80; x += 245) {
        g.fillStyle = rnd() > 0.5 ? '#27313c' : '#222c37';
        g.fillRect(x, y, 240, 140);
        g.strokeStyle = '#101b27';
        g.lineWidth = 3;
        G.line(g, x, y, Math.min(width - 80, x + 240), y);
        G.line(g, x, y, x, Math.min(height - 70, y + 140));
        g.strokeStyle = 'rgba(150,157,168,0.08)';
        G.line(g, x + 2, y + 4, Math.min(width - 80, x + 240), y + 4);
      }
    }
    for (let i = 0; i < 2300; i++) {
      g.fillStyle = i % 2 ? 'rgba(160,170,180,0.06)' : 'rgba(0,0,0,0.12)';
      g.fillRect(75 + rnd() * (width - 150), 215 + rnd() * (height - 290), rnd() * 6 + 1, 1);
    }
    for (let i = 0; i < 18; i++) {
      puddle(g, 140 + rnd() * (width - 280), 280 + rnd() * (height - 370), 35 + rnd() * 80, i % 3 ? 'rgba(209,177,107,0.13)' :
        'rgba(174,94,145,0.18)');
    }
    // Coping stones read as a parapet, rather than an untextured perimeter line.
    for (let x = 65; x < width - 65; x += 42) {
      g.fillStyle = '#5b6270';
      g.fillRect(x, 206, 39, 15);
      g.fillRect(x, height - 72, 39, 15);
    }
  }
  function waterTower(g, x, y) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    G.ellipse(g, x + 32, y + 45, 82, 40);
    g.fill();
    g.strokeStyle = '#56616a';
    g.lineWidth = 7;
    for (const side of [-1, 1]) {
      G.line(g, x + side * 43, y + 10, x + side * 63, y + 75);
      G.line(g, x - 50, y + 25, x + 50, y + 73);
      G.line(g, x + 50, y + 25, x - 50, y + 73);
    }
    const wood = g.createLinearGradient(x - 60, y, x + 60, y);
    wood.addColorStop(0, '#443f37');
    wood.addColorStop(0.45, '#8b7760');
    wood.addColorStop(1, '#363739');
    g.fillStyle = wood;
    G.rr(g, x - 60, y - 60, 120, 100, 18);
    g.fill();
    g.strokeStyle = '#302e2b';
    g.lineWidth = 2;
    for (let dx = -47; dx < 55; dx += 12)
      G.line(g, x + dx, y - 54, x + dx, y + 32);
    g.strokeStyle = '#a6a89c';
    g.lineWidth = 4;
    for (const yy of [-38, 18]) {
      G.ellipse(g, x, y + yy, 61, 12);
      g.stroke();
    }
    g.fillStyle = '#606672';
    g.beginPath();
    g.moveTo(x - 65, y - 56);
    g.lineTo(x, y - 94);
    g.lineTo(x + 65, y - 56);
    g.closePath();
    g.fill();
    g.strokeStyle = '#b0afa0';
    g.lineWidth = 2;
    G.line(g, x - 65, y - 56, x, y - 94);
  }
  function airConditioner(g, x, y) {
    g.fillStyle = '#384854';
    g.fillRect(x, y, 155, 100);
    g.strokeStyle = '#8b9a9c';
    g.lineWidth = 2;
    g.strokeRect(x + 4, y + 4, 147, 92);
    for (const cx of [
      x + 44, x + 112
    ]) {
      g.fillStyle = '#152631';
      G.circle(g, cx, y + 44, 29);
      g.fill();
      g.strokeStyle = '#647783';
      for (let j = -3; j <= 3; j++)
        G.line(g, cx - 25, y + 44 + j * 7, cx + 25, y + 44 + j * 7);
      G.circle(g, cx, y + 44, 5);
      g.stroke();
    }
    g.fillStyle = '#15232f';
    g.fillRect(x + 16, y + 82, 122, 5);
  }
  function mast(g, x, y, height = 180) {
    g.strokeStyle = '#111b29';
    g.lineWidth = 7;
    G.line(g, x - 32, y + 45, x, y - height);
    G.line(g, x + 32, y + 45, x, y - height);
    g.strokeStyle = '#758391';
    g.lineWidth = 3;
    for (let yy = y + 28; yy > y - height; yy -= 28) {
      const width = Math.max(3, (yy - y + height) / (height + 45) * 30);
      G.line(g, x - width, yy, x + width * 0.8, yy - 26);
      G.line(g, x + width, yy, x - width * 0.8, yy - 26);
    }
    for (const side of [-1, 1]) {
      g.strokeStyle = '#9b9b94';
      g.lineWidth = 1;
      G.line(g, x, y - height + 20, x + side * 160, y + 70);
    }
    g.strokeStyle = '#afb0a2';
    g.lineWidth = 2;
    G.line(g, x - 35, y - height + 24, x + 35, y - height + 24);
  }
  function rack(g, x, y, time) {
    g.fillStyle = '#101e28';
    g.fillRect(x, y, 85, 200);
    g.fillStyle = '#6b7778';
    g.fillRect(x, y, 5, 200);
    g.fillRect(x + 80, y, 5, 200);
    for (let row = 0; row < 5; row++) {
      const yy = y + 7 + row * 38;
      g.fillStyle = '#34454b';
      g.fillRect(x + 8, yy, 69, 33);
      g.fillStyle = '#e2ce93';
      g.fillRect(x + 14, yy + 6, 31, 17);
      g.strokeStyle = '#443a35';
      g.lineWidth = 1.5;
      G.line(g, x + 29, yy + 22, x + 21 + Math.sin(time * 2 + row) * 11, yy + 8);
      g.fillStyle = '#203438';
      G.circle(g, x + 59, yy + 17, 7);
      g.fill();
      g.strokeStyle = '#a9b5a9';
      G.line(g, x + 59, yy + 17, x + 62, yy + 12);
    }
  }
  function tapeMachine(g, x, y, time) {
    g.fillStyle = '#5b686d';
    G.rr(g, x - 71, y - 56, 142, 112, 5);
    g.fill();
    for (const side of [-1, 1]) {
      g.save();
      g.translate(x + side * 36, y - 15);
      g.rotate(time * side * 0.6);
      g.fillStyle = '#a8aca2';
      G.circle(g, 0, 0, 29);
      g.fill();
      g.fillStyle = '#263740';
      G.circle(g, 0, 0, 23);
      g.fill();
      g.strokeStyle = '#adb1a6';
      g.lineWidth = 7;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        G.line(g, 0, 0, Math.cos(a) * 23, Math.sin(a) * 23);
      }
      g.restore();
    }
    g.strokeStyle = '#251f1d';
    g.lineWidth = 3;
    G.line(g, x - 38, y + 10, x - 15, y + 30);
    G.line(g, x - 15, y + 30, x + 15, y + 30);
    G.line(g, x + 15, y + 30, x + 38, y + 10);
    g.fillStyle = '#c19a68';
    g.fillRect(x - 44, y + 40, 88, 5);
  }
  class RooftopLight extends DM.Entity {
    constructor(x, y, kind) {
      super({
        x, y, r: 120, static: true, solid: false, body: false, disintegratable: false
      });
      this.kind = kind;
    }
    light(world) {
      if (this.kind === 'neon') {
        const intensity = reduced() || !animated() ? 0.75 : (Math.floor(world.time * 9) % 97 === 0 ? 0.45 : 0.75);
        return {
          r: 270, i: intensity, color: '#ce7d9f', k: 0.16
        };
      }
      return {
        r: 210, i: 0.65, color: GOLD, k: 0.15
      };
    }
    render(g, world) {
      if (this.kind === 'skylight') {
        g.fillStyle = '#171f29';
        g.fillRect(this.x - 65, this.y - 35, 130, 70);
        g.fillStyle = '#b2a06a';
        g.fillRect(this.x - 58, this.y - 29, 116, 58);
        g.strokeStyle = '#1d2932';
        g.lineWidth = 4;
        for (const dx of [-20, 20])
          G.line(g, this.x + dx, this.y - 29, this.x + dx, this.y + 29);
        G.line(g, this.x - 58, this.y, this.x + 58, this.y);
      }
      else {
        g.fillStyle = '#182332';
        g.fillRect(this.x - 152, this.y - 32, 304, 58);
        g.strokeStyle = '#75818a';
        g.lineWidth = 3;
        g.strokeRect(this.x - 152, this.y - 32, 304, 58);
        G.line(g, this.x - 136, this.y + 26, this.x - 136, this.y + 66);
        G.line(g, this.x + 136, this.y + 26, this.x + 136, this.y + 66);
      }
      if (!world.lit)
        this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.kind !== 'neon')
        return;
      g.save();
      g.globalAlpha = this.light(world).i + 0.2;
      G.text(g, 'WBYN 88.6', this.x, this.y + 10, {
        size: 34, font: DM.FONTS.display, color: '#e6a5c3', align: 'center', spacing: 4, weight: 700,
      });
      g.restore();
    }
  }
  class RadioScene extends DM.Entity {
    constructor(ctx, mode) {
      super({
        x: ctx.world.w / 2, y: ctx.world.h / 2, r: 1800, static: true, body: false,
        solid: false, disintegratable: false, layer: 0
      });
      this.ctx = ctx;
      this.mode = mode;
      this.line = null;
      this.neonTime = 11;
      ctx.on('play:begin', () => DM.Audio.hum('broadcast-carrier', false));
      ctx.on('player:down', () => DM.Audio.hum('broadcast-carrier', false));
    }
    update(dt, world) {
      const line = this.ctx.scene.dialog.active ? this.ctx.scene.dialog.line : null;
      if (line && line.who === 'switchman' && line !== this.line)
        DM.Audio.play('broadcast_switchman');
      this.line = line;
      this.neonTime -= dt;
      if (this.mode === 'roofs' && this.neonTime <= 0) {
        this.neonTime = 13;
        if (animated())
          DM.Audio.play('broadcast_neon');
      }
      const boss = this.ctx.flags.carrier;
      const on = this.mode === 'tower' && boss && !boss.dead && !world.ceasefire;
      const distance = on ? U.dist(world.player.x, world.player.y, boss.x, boss.y) : 1200;
      this.staticGain = on ? Math.pow(Math.max(0, 1 - distance / 1100), 2) * 0.014 : 0;
      DM.Audio.hum('broadcast-carrier', !!on, {
        kind: 'noise', freq: 1450, q: 2, gate: 14, gain: this.staticGain
      });
    }
    render(g, world) {
      const time = animated() ? world.time : 0;
      if (this.mode === 'roofs') {
        waterTower(g, 420, 335);
        waterTower(g, 1660, 890);
        for (const [x, y] of [
          [535, 400],
          [1090, 770],
          [1400, 540]
        ])
          airConditioner(g, x, y);
        mast(g, 1180, 315, 90);
        mast(g, 1750, 720, 150);
      }
      else if (this.mode === 'relay') {
        for (const x of [430, 710, 1160])
          rack(g, x, 380, time);
        tapeMachine(g, 450, 890, time);
        tapeMachine(g, 1110, 955, time);
        // Original engineer walls provide collision; mesh/padlocks describe their purpose.
        [
          [280, 280],
          [960, 300],
          [1490, 320]
        ].forEach(([x, y], i) => {
          if (this.ctx.flags.engineers & (1 << i))
            return;
          g.strokeStyle = 'rgba(153,173,174,0.55)';
          g.lineWidth = 1;
          for (let d = -60; d <= 60; d += 12) {
            G.line(g, x + d, y - 28, x + d, y + 54);
            G.line(g, x - 60, y + d * 0.55 + 13, x + 60, y + d * 0.55 + 13);
          }
          g.strokeStyle = '#83928b';
          g.lineWidth = 3;
          g.strokeRect(x - 63, y - 30, 126, 87);
          g.fillStyle = GOLD;
          g.fillRect(x - 6, y + 49, 12, 12);
        });
      }
      else {
        mast(g, 895, 335, 120);
        g.strokeStyle = 'rgba(145,151,159,0.5)';
        g.lineWidth = 2;
        for (const [x, y] of [
          [430, 300],
          [1370, 300],
          [420, 900],
          [1370, 930]
        ]) {
          G.line(g, 895, 245, x, y);
          g.fillStyle = '#606971';
          g.fillRect(x - 8, y - 5, 16, 10);
        }
      }
      if (!world.lit)
        this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.mode === 'relay') {
        for (const x of [430, 710, 1160]) {
          for (let i = 0; i < 5; i++) {
            const on = reduced() || !animated() || Math.floor(world.time * 2 + i + x) % 4 !== 0;
            g.fillStyle = on ? '#9acbaa' : '#34474a';
            g.fillRect(x + 66, 395 + i * 38, 4, 4);
          }
        }
      }
      else {
        const points = this.mode === 'roofs' ? [
          [1180, 225],
          [1750, 570]
        ] : [
          [895, 215]
        ];
        for (const [x, y] of points) {
          const alpha = reduced() || !animated() ? 0.55 : 0.35 + 0.3 * (0.5 + Math.sin(world.time * 2) * 0.5);
          G.glow(g, x, y, 15, '#df665c', alpha);
          g.fillStyle = '#e88b78';
          G.circle(g, x, y, 3);
          g.fill();
        }
      }
    }
  }
  function install(ctx, mode) {
    const world = ctx.world;
    if (mode !== 'relay') {
      world.bake((g, width, height) => roofFloor(g, width, height, mode === 'roofs' ? 1976 : 886));
    }
    else {
      world.bake((g, width, height) => {
        g.fillStyle = '#1b2b33';
        g.fillRect(0, 0, width, height);
        for (let y = 210; y < height - 60; y += 48) {
          for (let x = 65; x < width - 65; x += 48) {
            g.fillStyle = (x + y) % 96 ? '#3b4c4f' : '#414f50';
            g.fillRect(x, y, 46, 46);
          }
        }
        for (const x of [475, 752, 1203]) {
          g.strokeStyle = '#17292f';
          g.lineWidth = 22;
          G.line(g, x, 600, x, 1020);
          g.strokeStyle = '#9d8866';
          g.lineWidth = 2;
          for (const dx of [-7, -2, 3, 8])
            G.line(g, x + dx, 600, x + dx, 1020);
          g.strokeStyle = '#52676b';
          for (let y = 610; y < 1020; y += 23)
            G.line(g, x - 14, y, x + 14, y);
        }
        g.fillStyle = '#273b40';
        g.fillRect(1320, 450, 350, 260);
        g.strokeStyle = 'rgba(172,210,209,0.6)';
        g.lineWidth = 4;
        g.strokeRect(1320, 450, 350, 260);
        for (const x of [1400, 1490, 1580])
          G.line(g, x, 450, x, 710);
        g.fillStyle = 'rgba(151,195,194,0.07)';
        g.fillRect(1324, 454, 342, 252);
        g.fillStyle = '#8b826e';
        g.fillRect(1430, 510, 170, 70);
        g.fillStyle = '#142a30';
        g.fillRect(1480, 520, 65, 38);
      });
    }
    if (mode === 'roofs') {
      ctx.add(new RooftopLight(1490, 245, 'neon'));
      ctx.add(new RooftopLight(650, 880, 'skylight'));
      ctx.add(new RooftopLight(1320, 930, 'skylight'));
    }
    if (mode === 'relay') {
      for (const [x, y] of [
        [500, 250],
        [1090, 250],
        [600, 1020],
        [1300, 1020]
      ]) {
        ctx.add(new DM.BonusKit.Lamp(x, y, {
          r: 240, i: 0.7, color: '#bcded2', k: 0.08
        }));
        world.decals.push(g => {
          g.fillStyle = '#b5c7b8';
          g.fillRect(x - 67, y - 3, 134, 6);
          g.fillStyle = '#36494b';
          g.fillRect(x - 72, y - 6, 6, 12);
          g.fillRect(x + 66, y - 6, 6, 12);
        });
      }
    }
    return ctx.add(new RadioScene(ctx, mode));
  }
  DM.BroadcastAtmosphere = { install, RadioScene };
})();
