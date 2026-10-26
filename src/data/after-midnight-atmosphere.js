/* After Midnight: three original places, drawn and scored with the existing tools. */
(function () {
  'use strict';
  const DM = window.DM,
    G = DM.Gfx,
    U = DM.U;
  const AM = (DM.AfterMidnight = DM.AfterMidnight || {});
  const INK = '#101a24',
    GOLD = '#e5bc73',
    TEAL = '#8bcec8';
  const quiet = () => DM.Save.settings.fx === 'off' || DM.SettingsSchema.reducedFlashing();

  DM.Audio.define('am_radio', {
    gap: 1,
    fn(a) {
      a.noise({ dur: 0.22, gain: 0.009, ftype: 'bandpass', freq: 1450, q: 4, attack: 0.04 });
      a.tone({ freq: 620, freqEnd: 470, dur: 0.12, gain: 0.006, type: 'sine' });
    },
  });
  DM.Audio.define('am_bell', {
    gap: 1,
    fn(a) {
      for (const [f, gain] of [
        [290, 0.012],
        [581, 0.005],
        [872, 0.002],
      ])
        a.tone({ freq: f, dur: 2.2, gain, type: 'sine', attack: 0.015, echo: 0.45 });
    },
  });
  DM.Audio.define('am_switch', {
    gap: 0.07,
    fn(a) {
      a.noise({ dur: 0.035, gain: 0.014, ftype: 'bandpass', freq: 2200, q: 1.6 });
      a.tone({ freq: 750, freqEnd: 1050, dur: 0.09, gain: 0.008, type: 'triangle' });
    },
  });
  DM.Audio.define('am_crane', {
    gap: 1,
    fn(a) {
      a.tone({ freq: 62, freqEnd: 84, dur: 1.6, gain: 0.013, type: 'sawtooth', attack: 0.2 });
      a.noise({ dur: 1.8, gain: 0.009, ftype: 'lowpass', freq: 370, attack: 0.3 });
    },
  });
  DM.Audio.define('am_alarm', {
    gap: 1,
    fn(a) {
      [0, 0.28, 0.56].forEach((delay) =>
        a.tone({
          freq: 660,
          freqEnd: 520,
          dur: 0.19,
          gain: 0.008,
          type: 'triangle',
          delay,
          attack: 0.02,
        }),
      );
    },
  });
  DM.Audio.define('am_camera', {
    gap: 0.4,
    fn(a) {
      a.noise({ dur: 0.065, gain: 0.009, ftype: 'highpass', freq: 2100 });
      a.tone({ freq: 180, freqEnd: 95, dur: 0.15, gain: 0.006, type: 'triangle' });
    },
  });

  const tracks = {
    am_noir: {
      bpm: 84,
      level: 4.6,
      echo: 0.42,
      barsPerChord: 2,
      prog: [
        [50, 57, 60, 65],
        [48, 55, 58, 62],
        [46, 53, 57, 60],
        [45, 52, 56, 59],
      ],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.022, attack: 1.3 },
        { kind: 'bass', wave: 'triangle', gain: 0.044, oct: -12, every: 8, cutoff: 570 },
        {
          kind: 'arp',
          wave: 'triangle',
          gain: 0.023,
          every: 3,
          pattern: [3, -1, 2, 1, -1, 0, 2, -1],
          oct: 12,
          len: 2.5,
        },
        { kind: 'tick', gain: 0.032, every: 4 },
        { kind: 'snare', gain: 0.028, pattern: [0, 0, 0, 0, 1, 0, 0, 0], min: 0.4 },
      ],
    },
    am_storm: {
      bpm: 104,
      level: 0,
      echo: 0.32,
      barsPerChord: 2,
      prog: [
        [48, 55, 60, 63],
        [46, 53, 58, 62],
        [43, 50, 55, 58],
        [45, 52, 57, 60],
      ],
      layers: [
        { kind: 'pad', wave: 'triangle', gain: 0.019, attack: 1.5 },
        { kind: 'bass', wave: 'sine', gain: 0.052, oct: -12, every: 8 },
        {
          kind: 'arp',
          wave: 'triangle',
          gain: 0.022,
          every: 2,
          pattern: [0, 1, 3, 2, -1, 3, 1, 2],
          oct: 12,
          len: 2.6,
        },
        { kind: 'kick', gain: 0.12, pattern: [1, 0, 0, 0, 0, 0, 1, 0], min: 0.3 },
        { kind: 'snare', gain: 0.035, pattern: [0, 0, 0, 0, 1, 0, 0, 0], min: 0.6 },
      ],
    },
    am_glass: {
      bpm: 92,
      level: 6,
      echo: 0.5,
      barsPerChord: 2,
      prog: [
        [53, 60, 64, 67],
        [50, 57, 60, 65],
        [46, 53, 57, 62],
        [52, 59, 62, 68],
      ],
      layers: [
        { kind: 'pad', wave: 'sine', gain: 0.021, attack: 1.6 },
        {
          kind: 'arp',
          wave: 'sine',
          gain: 0.026,
          every: 2,
          pattern: [3, -1, 1, 2, 0, -1, 2, 4],
          oct: 12,
          len: 2.9,
        },
        { kind: 'bass', wave: 'triangle', gain: 0.041, oct: -12, every: 8 },
        { kind: 'tick', gain: 0.03, every: 4 },
        {
          kind: 'arp',
          wave: 'square',
          gain: 0.008,
          every: 2,
          pattern: [0, 2, 1, 3],
          cutoff: 1200,
          min: 0.6,
        },
      ],
    },
  };
  Object.assign(DM.MusicTracks, tracks);
  DM.Ambience.beds.am_roofs = {
    layers: [
      { kind: 'wind', ftype: 'lowpass', freq: 1800, gain: 0.015, lfo: { rate: 0.12, depth: 0.25 } },
      { kind: 'drone', oscs: [{ f: 55 }, { f: 82.5, g: 0.3 }], cutoff: 200, gain: 0.006 },
      { kind: 'events', sound: 'am_radio', every: [15, 24], first: [9, 13], gain: 0.7 },
    ],
  };
  DM.Ambience.beds.am_harbour = {
    layers: [
      { kind: 'wind', ftype: 'lowpass', freq: 680, gain: 0.024, lfo: { rate: 0.16, depth: 0.55 } },
      {
        kind: 'wind',
        ftype: 'bandpass',
        freq: 1800,
        q: 0.7,
        gain: 0.008,
        lfo: { rate: 0.08, depth: 0.45 },
      },
      { kind: 'events', sound: 'am_bell', every: [18, 28], first: [6, 10], gain: 0.65 },
    ],
  };
  DM.Ambience.beds.am_museum = {
    layers: [
      { kind: 'drone', oscs: [{ f: 65 }, { f: 130, g: 0.16 }], cutoff: 300, gain: 0.009 },
      { kind: 'wind', ftype: 'bandpass', freq: 750, q: 1.4, gain: 0.004 },
      { kind: 'events', sound: 'am_camera', every: [11, 20], first: [6, 12], gain: 0.6 },
    ],
  };

  const lamps = {
    rooftops: [
      [300, 330, 250],
      [740, 650, 260],
      [1280, 310, 250],
      [1600, 1000, 260],
    ],
    harbour: [
      [250, 1030, 290],
      [630, 350, 290],
      [1450, 350, 290],
      [1470, 960, 280],
    ],
    museum: [
      [280, 1050, 270],
      [600, 350, 280],
      [1450, 350, 280],
      [960, 660, 350],
    ],
  };
  const storyCover = [
    { x: 430, y: 520, w: 140, h: 120 },
    { x: 1180, y: 510, w: 210, h: 100 },
    { x: 1070, y: 1020, w: 220, h: 90 },
  ];
  const modeLayouts = {
    patrol: [
      {
        id: 'service-shift',
        label: 'SERVICE SHIFT',
        cover: [
          { x: 390, y: 560 },
          { x: 1250, y: 460 },
        ],
        lighting: { id: 'service', color: '#bad9d1', intensity: 0.74, offsetX: -42, offsetY: 18 },
      },
      {
        id: 'after-hours',
        label: 'AFTER HOURS',
        cover: [
          { x: 490, y: 480 },
          { x: 1130, y: 510 },
        ],
        lighting: {
          id: 'after-hours',
          color: '#e6b16b',
          intensity: 0.9,
          offsetX: 46,
          offsetY: -26,
        },
      },
    ],
    rescue_clock: [
      {
        id: 'emergency-feed',
        label: 'EMERGENCY FEED',
        cover: [
          { x: 390, y: 540 },
          { x: 1240, y: 470 },
        ],
        lighting: { id: 'emergency', color: '#a8d6df', intensity: 0.8, offsetX: 32, offsetY: 28 },
      },
      {
        id: 'reserve-feed',
        label: 'RESERVE FEED',
        cover: [
          { x: 510, y: 490 },
          { x: 1110, y: 470 },
        ],
        lighting: { id: 'reserve', color: '#d7bbd6', intensity: 0.94, offsetX: -34, offsetY: -32 },
      },
    ],
  };
  function layout(mode, variant = 0) {
    const presets = modeLayouts[mode];
    const preset = presets && presets[Math.abs(Math.floor(variant)) % presets.length];
    return {
      id: preset ? mode + '-' + preset.id : 'story',
      label: preset?.label || '',
      index: preset ? Math.abs(Math.floor(variant)) % presets.length : 0,
      cover: storyCover.map((rect, index) => ({ ...rect, ...preset?.cover[index] })),
      lighting: preset ? { ...preset.lighting } : null,
    };
  }
  const mapNames = { rooftops: 'am_rooftops', harbour: 'am_harbour', museum: 'am_museum' };
  for (const theme of Object.keys(mapNames)) {
    const id = mapNames[theme];
    DM.Ambience.maps[id] = {
      bed: theme === 'rooftops' ? 'am_roofs' : 'am_' + theme,
      surface: theme === 'harbour' ? 'wood' : 'concrete',
    };
    DM.Atmosphere.register(id, {
      shadow: theme === 'museum' ? 'rgba(32,25,31,0.32)' : 'rgba(2,7,18,0.56)',
      light: {
        ambient: theme === 'museum' ? 'rgba(11,18,27,0.48)' : 'rgba(7,14,28,0.66)',
        player: 1,
        playerK: 0.24,
        lights(world, add) {
          const state = world.amLightingState;
          const baseColor =
            theme === 'museum' ? '#e1c88c' : theme === 'harbour' ? '#b3d7d4' : '#d8b68c';
          const color = state?.color || baseColor;
          for (const [x, y, r] of world.amLamps || lamps[theme]) {
            add(x, y, r, { color, i: state?.intensity || 0.72, k: 0.1 });
          }
          for (const point of world.amAccentLights || []) {
            add(point.x, point.y, point.r, { color: point.color, i: point.i, k: 0.12 });
          }
          const player = world.player;
          if (player && typeof player.light === 'function') {
            const light = player.light(world);
            if (light) add(player.x, player.y, light.r || 180, light);
            const cone = player.lightCone?.(world);
            if (cone) {
              const x = player.x + Math.cos(player.facing) * 9;
              const y = player.y + Math.sin(player.facing) * 9;
              add(x, y, cone.r, cone);
            }
          }
          for (const entity of world.entities) {
            if (entity.dead || !entity.amLight || typeof entity.light !== 'function') continue;
            const light = entity.light(world);
            if (light) add(entity.x, entity.y, light.r || 100, light);
          }
        },
      },
      weather:
        theme === 'museum'
          ? [{ type: 'haze', n: 20, alpha: 0.025, color: '#ebd9aa' }]
          : [
              { type: 'drizzle', n: theme === 'harbour' ? 200 : 110, color: '#a2bfce' },
              { type: 'haze', n: 20, alpha: 0.025, color: '#6a8e9b' },
            ],
      walls: {
        wall: { pattern: theme === 'museum' ? 'gold' : 'brick', height: 1.1 },
        low: { pattern: theme === 'museum' ? 'gold' : 'ribbed', height: 0.6 },
      },
    });
  }

  function line(g, x1, y1, x2, y2, color, width = 1) {
    g.strokeStyle = color;
    g.lineWidth = width;
    G.line(g, x1, y1, x2, y2);
  }
  function puddle(g, x, y, r, color) {
    g.fillStyle = '#172b38';
    G.ellipse(g, x, y, r, r * 0.22);
    g.fill();
    const sheen = g.createLinearGradient(x - r, y, x + r, y);
    sheen.addColorStop(0, 'rgba(115,155,175,0)');
    sheen.addColorStop(0.5, color);
    sheen.addColorStop(1, 'rgba(115,155,175,0)');
    g.fillStyle = sheen;
    G.ellipse(g, x, y - 2, r * 0.9, r * 0.14);
    g.fill();
  }
  function city(g, w, rnd) {
    const sky = g.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, '#111c32');
    sky.addColorStop(1, '#66505b');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, 205);
    for (let layer = 0; layer < 3; layer++) {
      for (let x = -30; x < w; x += 67) {
        const height = 28 + rnd() * 130;
        g.fillStyle = ['#475060', '#303a49', '#182333'][layer];
        g.fillRect(x, 205 - height + layer * 8, 62, height);
        for (let y = 208 - height; y < 200; y += 18)
          for (let xx = x + 10; xx < x + 55; xx += 16) {
            if (rnd() < 0.4) continue;
            g.fillStyle = rnd() < 0.3 ? '#c2a26f' : '#6f8f9a';
            g.fillRect(xx, y, 4, 6);
          }
      }
    }
  }
  function container(g, x, y, w, h, color) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 14, y + 17, w, h);
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
    for (let xx = x + 8; xx < x + w; xx += 17) {
      line(g, xx, y + 4, xx, y + h - 4, 'rgba(0,0,0,0.3)', 3);
      line(g, xx + 3, y + 4, xx + 3, y + h - 4, 'rgba(225,235,215,0.09)');
    }
    line(g, x + 5, y + 5, x + w - 5, y + 5, '#a6b1a2', 2);
    g.fillStyle = '#d4c6a4';
    g.fillRect(x + 20, y + 20, 40, 18);
    G.text(g, '09', x + 40, y + 34, { size: 13, align: 'center', color: '#3f4747' });
  }
  function display(g, x, y, w, h, item) {
    g.fillStyle = 'rgba(10,10,17,0.25)';
    G.ellipse(g, x + w / 2 + 10, y + h + 10, w * 0.56, 23);
    g.fill();
    g.fillStyle = '#403c3d';
    g.fillRect(x, y + h - 21, w, 30);
    g.fillStyle = '#c8b48a';
    g.fillRect(x + 5, y + h - 19, w - 10, 3);
    const glass = g.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, 'rgba(158,197,195,0.2)');
    glass.addColorStop(0.5, 'rgba(91,130,145,0.04)');
    glass.addColorStop(1, 'rgba(153,190,200,0.19)');
    g.fillStyle = glass;
    g.fillRect(x + 7, y, w - 14, h - 18);
    g.strokeStyle = '#9caa9f';
    g.lineWidth = 2;
    g.strokeRect(x + 7, y, w - 14, h - 18);
    if (item === 'clock') G.clock(g, x + w / 2, y + h / 2 - 10, Math.min(w, h) * 0.25, 2);
    else {
      g.fillStyle = item === 'vase' ? '#819e9b' : '#b69d68';
      G.ellipse(g, x + w / 2, y + h / 2 - 10, item === 'vase' ? 23 : 37, 33);
      g.fill();
      line(g, x + w / 2 - 15, y + h / 2 - 17, x + w / 2 + 17, y + h / 2 + 2, '#e1cd98', 3);
    }
    line(g, x + 16, y + 9, x + w * 0.42, y + h - 32, 'rgba(220,242,236,0.28)', 4);
  }
  const dimensions = {
    skylight: [116, 72],
    vent: [88, 66],
    puddle: [134, 48],
    aerial: [76, 100],
    rope: [84, 58],
    pallet: [104, 72],
    bollards: [82, 60],
    crate: [88, 68],
    rug: [156, 88],
    plinth: [80, 86],
    painting: [114, 90],
    barrier: [132, 58],
  };
  const themeProps = {
    rooftops: ['skylight', 'puddle', 'vent', 'aerial'],
    harbour: ['rope', 'pallet', 'bollards', 'crate'],
    museum: ['rug', 'plinth', 'painting', 'barrier'],
  };
  function dressing(world, theme) {
    const props = [];
    const kinds = themeProps[theme];
    const variant = world.amVariantIndex || 0;
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 7; column++) {
        const kind = kinds[(column + row * 3 + variant) % kinds.length];
        const [w, h] = dimensions[kind];
        // Keep the arrival/extraction footprint readable instead of placing a
        // prop under the hero. Adjacent columns still cover every 400px view.
        const arrival = row === 3 && column === 0;
        const cx = arrival ? 170 : 210 + column * 240;
        const cy = arrival ? 900 : 330 + row * 240;
        props.push({
          id: theme + '-' + row + '-' + column,
          kind,
          x: cx - w / 2,
          y: cy - h / 2,
          w,
          h,
        });
      }
    }
    for (const [index, rect] of world.amCoverLayout.entries()) {
      props.push({ id: 'cover-' + index, kind: 'cover', theme, solid: true, ...rect });
    }
    if (theme === 'rooftops') {
      props.push({ id: 'water-tower', kind: 'tower', x: 785, y: 190, w: 130, h: 235 });
      props.push({ id: 'exchange-neon', kind: 'neon', x: 1400, y: 270, w: 240, h: 60 });
    }
    if (theme === 'harbour') {
      props.push({ id: 'cargo-crane', kind: 'crane', x: 1260, y: 235, w: 415, h: 865 });
      props.push({ id: 'harbour-bell', kind: 'bell', x: 330, y: 360, w: 74, h: 106 });
    }
    world.amDressing = props;
    world.amAccentLights = props
      .filter((prop) => ['plinth', 'painting', 'neon'].includes(prop.kind))
      .map((prop) => ({
        x: prop.x + prop.w / 2,
        y: prop.y + prop.h / 2,
        r: prop.kind === 'neon' ? 155 : 115,
        i: prop.kind === 'neon' ? 0.58 : 0.35,
        color: prop.kind === 'neon' ? '#d995ad' : '#e6cf91',
      }));
    return props;
  }
  function paintProp(g, prop) {
    const { kind, x, y, w, h } = prop;
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (kind === 'puddle') {
      puddle(g, cx, cy, w / 2, 'rgba(181,194,199,0.2)');
      return;
    }
    if (kind === 'rope') {
      g.strokeStyle = '#a39772';
      g.lineWidth = 3;
      for (let ring = 0; ring < 5; ring++) {
        G.ellipse(g, cx, cy, 34 - ring * 5, 22 - ring * 3);
        g.stroke();
      }
      line(g, cx + 14, cy + 14, x + w, y + h - 3, '#bca77b', 4);
      return;
    }
    if (kind === 'rug') {
      g.fillStyle = '#513d40';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#a88a6a';
      g.lineWidth = 3;
      g.strokeRect(x + 8, y + 8, w - 16, h - 16);
      g.strokeRect(x + 15, y + 15, w - 30, h - 30);
      for (let at = x + 7; at < x + w; at += 12) {
        line(g, at, y - 4, at, y + 2, '#c3ad86', 2);
        line(g, at, y + h - 2, at, y + h + 4, '#c3ad86', 2);
      }
      g.fillStyle = '#a88a6a';
      g.beginPath();
      g.moveTo(cx, cy - 20);
      g.lineTo(cx + 35, cy);
      g.lineTo(cx, cy + 20);
      g.lineTo(cx - 35, cy);
      g.closePath();
      g.fill();
      return;
    }
    if (kind === 'cover') {
      if (prop.theme === 'harbour') container(g, x, y, w, h, '#5f6b60');
      else if (prop.theme === 'museum') display(g, x, y, w, h, 'clock');
      else paintProp(g, { ...prop, kind: 'skylight' });
      return;
    }
    if (kind === 'tower' || kind === 'crane') return;
    g.fillStyle = 'rgba(3,9,17,0.25)';
    g.fillRect(x + 8, y + 10, w, h);
    if (kind === 'skylight') {
      g.fillStyle = '#566770';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#8caaa9';
      g.fillRect(x + 6, y + 6, w - 12, h - 12);
      for (let at = x + 10; at < x + w - 5; at += 22) {
        line(g, at, y + 7, at, y + h - 7, '#243944', 4);
      }
      line(g, x + 7, cy, x + w - 7, cy, '#263c47', 3);
      line(g, x + 9, y + 9, x + w - 10, y + 9, '#c4cebf', 2);
    } else if (kind === 'vent') {
      g.fillStyle = '#4c5c63';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#a6b1aa';
      g.lineWidth = 2;
      G.ellipse(g, cx, cy, w * 0.38, h * 0.38);
      g.stroke();
      for (let at = y + 9; at < y + h - 5; at += 9) {
        line(g, x + 10, at, x + w - 10, at, '#1c2b32', 4);
      }
    } else if (kind === 'aerial') {
      g.fillStyle = '#4a535c';
      g.fillRect(cx - 20, y + h - 15, 40, 15);
      line(g, cx, y, cx, y + h - 9, '#b0b8b2', 3);
      for (let bar = 0; bar < 4; bar++) {
        const yy = y + 12 + bar * 17;
        line(g, x + bar * 5, yy, x + w - bar * 5, yy, '#93a6a9', 3);
      }
      line(g, cx, y + 48, x + 6, y + h - 2, '#697b80', 2);
    } else if (kind === 'pallet') {
      g.fillStyle = '#71634d';
      g.fillRect(x, y, w, h);
      for (let at = y + 3; at < y + h; at += 14) {
        g.fillStyle = '#aa9371';
        g.fillRect(x + 3, at, w - 6, 8);
        line(g, x + 19, at + 2, x + 19, at + 6, '#3f4039', 2);
        line(g, x + w - 19, at + 2, x + w - 19, at + 6, '#3f4039', 2);
      }
    } else if (kind === 'bollards') {
      for (const at of [x + 15, x + w - 15]) {
        g.fillStyle = '#55676b';
        G.ellipse(g, at, y + h - 12, 15, 10);
        g.fill();
        g.fillRect(at - 8, y + 9, 16, h - 23);
        g.fillStyle = '#a4b1a5';
        G.ellipse(g, at, y + 10, 12, 8);
        g.fill();
      }
      line(g, x + 17, y + 25, x + w - 17, y + 36, '#ac9e77', 4);
    } else if (kind === 'crate') {
      container(g, x, y, w, h, '#786c51');
      line(g, x + 5, y + 5, x + w - 5, y + h - 5, '#b5a27c', 6);
      line(g, x + w - 5, y + 5, x + 5, y + h - 5, '#a18e6d', 5);
    } else if (kind === 'plinth') {
      g.fillStyle = '#918a75';
      g.fillRect(x + 9, y + 28, w - 18, h - 28);
      g.fillStyle = '#c0b99e';
      g.fillRect(x, y + 19, w, 19);
      g.fillStyle = '#818f88';
      G.ellipse(g, cx, y + 16, 22, 17);
      g.fill();
      g.fillStyle = '#d5c69f';
      g.fillRect(cx - 12, y + 47, 24, 12);
    } else if (kind === 'painting') {
      g.fillStyle = '#ad956c';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#354654';
      g.fillRect(x + 8, y + 8, w - 16, h - 16);
      g.fillStyle = '#8b9690';
      g.beginPath();
      g.moveTo(x + 11, y + h - 12);
      g.lineTo(cx - 9, y + 25);
      g.lineTo(cx + 15, y + 55);
      g.lineTo(x + w - 11, y + 22);
      g.lineTo(x + w - 11, y + h - 12);
      g.closePath();
      g.fill();
      g.fillStyle = '#d1b677';
      G.circle(g, x + 29, y + 27, 10);
      g.fill();
    } else if (kind === 'barrier') {
      for (const at of [x + 10, x + w - 10]) {
        g.fillStyle = '#84765b';
        G.ellipse(g, at, y + h - 9, 12, 8);
        g.fill();
        line(g, at, y + 4, at, y + h - 10, '#b5a57b', 4);
        G.circle(g, at, y + 5, 6);
        g.fill();
      }
      g.strokeStyle = '#8f5353';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x + 10, y + 10);
      g.quadraticCurveTo(cx, y + h - 10, x + w - 10, y + 10);
      g.stroke();
    } else if (kind === 'bell') {
      line(g, x + 7, y, x + 7, y + h, '#6d7774', 6);
      line(g, x + 7, y + 4, x + w - 8, y + 4, '#8f9787', 6);
      line(g, cx + 5, y + 4, cx + 5, y + 25, '#bba978', 3);
      g.fillStyle = '#c4a35b';
      g.beginPath();
      g.moveTo(cx - 15, y + 28);
      g.quadraticCurveTo(cx + 5, y + 13, cx + 22, y + 32);
      g.lineTo(cx + 30, y + 61);
      g.lineTo(cx - 24, y + 61);
      g.closePath();
      g.fill();
      line(g, cx + 5, y + 62, cx + 5, y + h - 3, '#b9aa83', 3);
    } else if (kind === 'neon') {
      g.fillStyle = '#24343d';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#9c667b';
      g.lineWidth = 3;
      g.strokeRect(x + 4, y + 4, w - 8, h - 8);
      G.text(g, 'NIGHT EXCHANGE', cx, y + 38, {
        size: 19,
        align: 'center',
        color: '#d5a3b4',
        spacing: 1.5,
      });
    }
  }
  function bake(world, theme) {
    const props = dressing(world, theme);
    world.bake((g, width, height) => {
      const rnd = U.seeded(theme === 'rooftops' ? 881 : theme === 'harbour' ? 882 : 883);
      g.fillStyle = theme === 'museum' ? '#54534c' : theme === 'harbour' ? '#34474c' : '#323a46';
      g.fillRect(0, 0, width, height);
      if (theme === 'rooftops') {
        city(g, width, rnd);
        for (let y = 220; y < height - 80; y += 135)
          for (let x = 80; x < width - 100; x += 220) {
            g.fillStyle = rnd() > 0.5 ? '#323c48' : '#2c3641';
            g.fillRect(x, y, 216, 131);
            line(g, x, y, x + 216, y, '#151e2c', 3);
          }
        for (let i = 0; i < 20; i++)
          puddle(
            g,
            180 + rnd() * 1550,
            280 + rnd() * 850,
            35 + rnd() * 80,
            'rgba(201,148,158,0.18)',
          );
        // The observatory's water tower, aerials and bridge give the roof a skyline.
        g.strokeStyle = '#76818a';
        g.lineWidth = 7;
        for (const side of [-1, 1]) G.line(g, 850 + side * 42, 315, 850 + side * 65, 425);
        g.fillStyle = '#6e6151';
        G.rr(g, 790, 225, 120, 100, 18);
        g.fill();
        g.strokeStyle = '#b0a387';
        g.lineWidth = 3;
        for (const y of [246, 301]) {
          G.ellipse(g, 850, y, 59, 10);
          g.stroke();
        }
        g.fillStyle = '#414c5a';
        g.beginPath();
        g.moveTo(785, 235);
        g.lineTo(850, 190);
        g.lineTo(915, 235);
        g.fill();
        for (const [x, y] of [
          [440, 750],
          [1000, 1030],
          [1580, 620],
        ]) {
          g.fillStyle = '#53616b';
          g.fillRect(x - 65, y - 35, 130, 70);
          for (let k = -48; k <= 48; k += 12) line(g, x + k, y - 28, x + k, y + 28, '#1c2b36', 4);
        }
        G.text(g, 'NORTH BOROUGH EXCHANGE', 970, 1190, {
          size: 30,
          spacing: 5,
          color: '#808993',
          align: 'center',
        });
        // A recognisable arrival, rather than an empty square before the skyline.
        g.fillStyle = '#162933';
        G.rr(g, 150, 790, 205, 147, 8);
        g.fill();
        g.fillStyle = '#51636d';
        g.fillRect(143, 783, 220, 17);
        g.fillStyle = '#9fb7b5';
        g.fillRect(172, 809, 65, 87);
        g.fillRect(253, 809, 77, 87);
        g.fillStyle = '#243f4d';
        g.fillRect(178, 816, 53, 75);
        g.fillRect(260, 816, 63, 75);
        line(g, 204, 813, 204, 892, '#aeb9ab', 2);
        line(g, 178, 851, 230, 851, '#aeb9ab', 2);
        g.fillStyle = '#d9c7a2';
        G.circle(g, 277, 850, 11);
        g.fill();
        g.fillStyle = '#222e39';
        g.fillRect(269, 845, 17, 6);
        g.fillStyle = '#2a3942';
        g.fillRect(378, 847, 58, 77);
        for (let j = 0; j < 6; j++) line(g, 382, 854 + j * 11, 432, 854 + j * 11, '#5c7078', 3);
        G.text(g, 'VALE DISPATCH', 252, 776, {
          size: 21,
          align: 'center',
          color: '#c3a6ac',
          spacing: 2,
        });
        line(g, 180, 945, 345, 945, '#ac9268', 3);
      } else if (theme === 'harbour') {
        // The water is outside the playable dock, never an invisible collision hole.
        g.fillStyle = '#102c3b';
        g.fillRect(0, 0, width, 205);
        g.fillRect(width - 105, 0, 105, height);
        for (let y = 20; y < 195; y += 22)
          for (let x = 0; x < width; x += 95)
            line(g, x + rnd() * 25, y, x + 55, y + 2, 'rgba(134,177,191,0.23)', 2);
        for (let y = 220; y < height - 80; y += 22) line(g, 80, y, width - 120, y, '#223840', 2);
        for (let i = 0; i < 18; i++)
          puddle(
            g,
            160 + rnd() * 1520,
            280 + rnd() * 840,
            35 + rnd() * 80,
            'rgba(152,198,206,0.18)',
          );
        g.strokeStyle = '#a89360';
        g.lineWidth = 15;
        G.line(g, 1660, 235, 1660, 1100);
        G.line(g, 1660, 300, 1270, 300);
        g.lineWidth = 3;
        G.line(g, 1640, 300, 1640, 680);
        G.line(g, 1625, 300, 1625, 680);
        g.fillStyle = '#99804d';
        g.fillRect(1612, 670, 40, 24);
        G.text(g, 'PIER 18 · EAST RIVER', 880, 1190, {
          size: 32,
          spacing: 5,
          color: '#97a7a0',
          align: 'center',
        });
        g.fillStyle = '#163341';
        g.fillRect(80, 980, 110, 200);
        for (let y = 990; y < 1180; y += 23)
          line(g, 90, y, 176, y + 3, 'rgba(155,192,192,0.23)', 2);
        // Bow, cabin and mooring lines: the extraction point visibly is a boat.
        g.fillStyle = '#e0c598';
        g.beginPath();
        g.moveTo(135, 1010);
        g.lineTo(205, 1045);
        g.lineTo(205, 1120);
        g.lineTo(135, 1154);
        g.lineTo(108, 1118);
        g.lineTo(108, 1045);
        g.closePath();
        g.fill();
        g.fillStyle = '#516b6e';
        G.rr(g, 126, 1040, 59, 76, 9);
        g.fill();
        g.fillStyle = '#a6c1be';
        g.fillRect(136, 1051, 39, 24);
        g.fillStyle = '#384d54';
        g.fillRect(143, 1084, 27, 24);
        line(g, 194, 1053, 231, 1032, '#c7b38e', 2);
        line(g, 196, 1110, 231, 1136, '#c7b38e', 2);
        g.fillStyle = '#8e8466';
        g.fillRect(194, 1073, 49, 19);
        G.text(g, 'LIFEBOAT 04', 295, 991, {
          size: 19,
          align: 'center',
          color: '#c6d4c2',
          spacing: 2,
        });
      } else {
        g.fillStyle = '#68665b';
        g.fillRect(80, 210, width - 160, 970);
        for (let y = 240; y < 1180; y += 240) {
          line(g, 80, y, width - 80, y, 'rgba(31,40,45,0.28)', 2);
        }
        for (let x = 150; x < width - 80; x += 240) {
          line(g, x, 210, x, 1180, 'rgba(31,40,45,0.2)', 2);
        }
        g.fillStyle = '#293d48';
        g.fillRect(70, 70, width - 140, 140);
        for (let x = 160; x < width - 100; x += 190) {
          g.fillStyle = 'rgba(136,179,195,0.2)';
          g.fillRect(x, 90, 128, 104);
          line(g, x, 140, x + 128, 140, '#bdc3aa', 2);
          line(g, x + 64, 90, x + 64, 194, '#bdc3aa', 2);
        }
        g.strokeStyle = '#a99b77';
        g.lineWidth = 8;
        g.strokeRect(750, 310, 240, 180);
        g.fillStyle = '#343d4c';
        g.fillRect(759, 319, 222, 162);
        for (let i = 0; i < 5; i++) line(g, 785 + i * 35, 350, 805 + i * 25, 450, '#a18b68', 12);
        G.text(g, 'THE GLASS ARCHIVE', 980, 1200, {
          size: 36,
          spacing: 6,
          color: '#b5a47a',
          align: 'center',
        });
        g.fillStyle = '#393c3e';
        G.rr(g, 170, 810, 233, 108, 7);
        g.fill();
        g.fillStyle = '#958565';
        g.fillRect(177, 815, 219, 24);
        g.fillStyle = '#b3a78a';
        g.fillRect(186, 847, 207, 4);
        g.fillStyle = '#4b6070';
        g.fillRect(208, 853, 45, 24);
        g.fillStyle = '#b8c9bc';
        g.fillRect(211, 856, 38, 15);
        g.fillStyle = '#d8cca7';
        g.fillRect(286, 854, 47, 32);
        for (let j = 0; j < 3; j++) line(g, 291, 862 + j * 7, 327, 862 + j * 7, '#797367');
        G.text(g, 'MERCER · NIGHT ENTRANCE', 285, 780, {
          size: 18,
          align: 'center',
          color: '#cdbb94',
          spacing: 2,
        });
      }
      for (const point of world.amAccentLights) {
        const pool = g.createRadialGradient(point.x, point.y, 5, point.x, point.y, point.r);
        pool.addColorStop(0, 'rgba(229,207,154,0.14)');
        pool.addColorStop(1, 'rgba(229,207,154,0)');
        g.fillStyle = pool;
        g.fillRect(point.x - point.r, point.y - point.r, point.r * 2, point.r * 2);
      }
      for (const prop of props) paintProp(g, prop);
      if (world.amVariantLabel) {
        G.text(g, world.amVariantLabel, 1040, 260, {
          size: 18,
          align: 'center',
          color: '#b9b49c',
          spacing: 3,
        });
      }
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = i % 2 ? 'rgba(220,226,213,0.04)' : 'rgba(0,0,0,0.08)';
        g.fillRect(90 + rnd() * (width - 200), 230 + rnd() * (height - 320), 1 + rnd() * 4, 1);
      }
      if (height > 1280) {
        g.fillStyle = theme === 'harbour' ? '#132c38' : '#16202c';
        g.fillRect(0, 1180, width, height - 1180);
        g.strokeStyle = 'rgba(169,186,188,0.12)';
        g.lineWidth = 2;
        for (let y = 1210; y < height; y += 38) G.line(g, 80, y, width - 80, y);
      }
    });
  }

  class AmbientScene extends DM.Entity {
    constructor(theme) {
      super({
        x: 960,
        y: 640,
        r: 1800,
        body: false,
        solid: false,
        static: true,
        disintegratable: false,
        layer: -1,
      });
      this.theme = theme;
    }
    render(g, world) {
      if (this.theme !== 'harbour') return;
      const time = quiet() ? 0 : world.time;
      g.strokeStyle = 'rgba(150,202,214,0.3)';
      g.lineWidth = 2;
      for (let j = 0; j < 9; j++) {
        const y = 40 + j * 17;
        for (let x = 0; x < world.w; x += 115)
          G.line(g, x + Math.sin(time + j) * 18, y, x + 60, y + 2);
      }
      for (let y = 230; y < 1160; y += 72) {
        const shift = Math.sin(time * 1.3 + y * 0.02) * 5;
        line(g, world.w - 80 + shift, y, world.w - 38, y + 22, 'rgba(173,206,203,0.35)', 3);
      }
    }
    renderEmissive(g, world) {
      const color = world.amLightingState?.color || (this.theme === 'museum' ? GOLD : TEAL);
      const coords = world.amLamps || lamps[this.theme];
      for (const [x, y] of coords) {
        g.fillStyle = '#222f34';
        g.fillRect(x - 30, y - 5, 60, 10);
        g.fillStyle = color;
        g.fillRect(x - 22, y - 2, 44, 3);
        G.glow(g, x, y, 45, color, 0.12);
      }
      if (this.theme === 'rooftops') {
        G.text(g, 'JUNE VALE · NIGHT DISPATCH', 320, 252, {
          size: 21,
          color: '#d7a6b4',
          spacing: 3,
        });
        const neon = world.amDressing.find((prop) => prop.kind === 'neon');
        if (neon) {
          const x = neon.x + neon.w / 2;
          const y = neon.y + 38;
          G.glow(g, x, y - 8, 115, '#d995ad', 0.12);
          G.text(g, 'NIGHT EXCHANGE', x, y, {
            size: 19,
            align: 'center',
            color: '#e5a5c0',
            spacing: 1.5,
          });
        }
      }
    }
  }
  AM.CaseArt = {
    bake,
    mapNames,
    lamps,
    layout,
    modeLayouts,
    install(ctx, theme) {
      bake(ctx.world, theme);
      ctx.add(new AmbientScene(theme));
    },
  };
})();
