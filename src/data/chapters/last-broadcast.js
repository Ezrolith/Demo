/* THE LAST BROADCAST — an original, optional Watchmen-inspired side adventure.
* Uses the existing engine, power registry, procedural figures and synthesizer.
* No original campaign stages, dialogue, music tracks or endings are replaced.
*/
(function() {
  'use strict';
  const DM = window.DM, U = DM.U, G = DM.Gfx;
  const BLUE = '#80dcff', GOLD = '#e5ba68', RED = '#f17f70';
  const countBits = (n) => [1, 2, 4].filter(b => (n || 0) & b).length;
  const active = e => !e.dead && !e.ko;
  Object.assign(DM.LOOKS, {
    switchman: {
      name: 'The Switchman', skin: '#cfb393', hair: '#393a3c', hairStyle: 'short', glasses: true,
      body: '#313d4d', sleeve: '#313d4d', legs: '#222b37', collar: '#da904b', bg: '#4c3541', color: RED
    },
    radioengineer: {
      name: 'Radio Engineer', skin: '#deb694', hair: '#504236', hairStyle: 'short', body: '#7a918f',
      sleeve: '#7a918f', legs: '#364549', bg: '#455b62', color: '#a3d3cd'
    },
  });
  DM.MusicTracks.bonus_noir = {
    bpm: 74, level: -1, barsPerChord: 2, echo: 0.43,
    prog: [
      [50, 57, 60, 64],
      [46, 53, 57, 60],
      [48, 55, 58, 62],
      [45, 52, 57, 61]
    ],
    layers: [
      {
        kind: 'pad', wave: 'sine', gain: 0.026, attack: 1.8
      },
      {
        kind: 'arp', wave: 'triangle', gain: 0.025, every: 3, pattern: [
          0, 2, -1, 3, 1, -1, 2,
          4
        ], oct: 12, cutoff: 1900, len: 3
      },
      {
        kind: 'bass', wave: 'sine', gain: 0.055, oct: -12, every: 8
      },
      {
        kind: 'tick', gain: 0.035, every: 4
      },
      {
        kind: 'kick', gain: 0.13, pattern: [
          1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0
        ], min: 0.5
      },
    ],
  };
  DM.MusicTracks.bonus_carrier = {
    bpm: 108, level: -2, barsPerChord: 1, echo: 0.28,
    prog: [
      [50, 57, 60, 64],
      [50, 57, 60, 65],
      [46, 53, 57, 60],
      [45, 52, 56, 60]
    ],
    layers: [
      {
        kind: 'pad', wave: 'sine', gain: 0.022, attack: 0.8
      },
      {
        kind: 'arp', wave: 'triangle', gain: 0.028, every: 1, pattern: [
          0, 2, 1, 3, 0, 2, 4, 2
        ], oct: 12,
        cutoff: 2300, len: 1.4
      },
      {
        kind: 'bass', wave: 'sawtooth', gain: 0.033, oct: -12, every: 4, cutoff: 350
      },
      {
        kind: 'kick', gain: 0.16, pattern: [
          1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0
        ], min: 0.2
      },
      {
        kind: 'snare', gain: 0.04, pattern: [
          0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0
        ], min: 0.6
      },
    ],
  };
  for (const map of ['broadcast_roofs', 'broadcast_tower'])
    DM.Ambience.maps[map] = {
      bed: 'broadcast_rain', surface: 'concrete'
    };
  DM.Ambience.maps.broadcast_relay = {
    bed: 'broadcast_hum', surface: 'concrete'
  };
  Object.assign(DM.Ambience.cues, {
    'last_broadcast.arrival': 'bonus_noir', 'last_broadcast.relay': 'bonus_noir',
    'last_broadcast.carrier': 'bonus_carrier', 'last_broadcast.choice': 'bonus_noir',
  });
  // Lights use the map profile, so this works on the shipped iteration-1 engine.
  function lights(world, add) {
    for (const e of world.entities) {
      if (e.dead || !e.light)
        continue;
      const l = e.light(world);
      if (l)
        add(l.x == null ? e.x : l.x, l.y == null ? e.y : l.y, l.r || 150, l);
    }
    if (world.mapId === 'broadcast_roofs') {
      for (const [x, y] of [
        [250, 760],
        [640, 420],
        [1170, 660],
        [1700, 320]
      ])
        add(x, y, 260, {
          i: 0.76, color: GOLD, k: 0.17
        });
      add(1490, 210, 320, {
        i: 0.65, color: '#bd6380', k: 0.19
      });
    }
    else if (world.mapId === 'broadcast_relay') {
      for (const [x, y] of [
        [300, 280],
        [820, 260],
        [1440, 280],
        [360, 840],
        [920, 870],
        [1510, 830]
      ])
        add(x, y, 300, {
          i: 0.8, color: '#aad9d6', k: 0.1
        });
    }
    else {
      for (const [x, y] of [
        [250, 830],
        [1340, 850],
        [330, 270],
        [1400, 290]
      ])
        add(x, y, 280, {
          i: 0.72, color: GOLD, k: 0.18
        });
    }
  }
  for (const map of ['broadcast_roofs', 'broadcast_relay', 'broadcast_tower'])
    DM.Atmosphere.register(map, {
      shadow: 'rgba(5,10,23,0.6)',
      light: {
        ambient: map === 'broadcast_relay' ? 'rgba(6,15,24,0.53)' : 'rgba(8,13,30,0.57)', lights
      },
      weather: map === 'broadcast_relay' ? [
        {
          type: 'haze', n: 35, alpha: 0.035
        }
      ] : [
        {
          type: 'drizzle', puddles: []
        }
      ],
      walls: {
        wall: {
          pattern: 'concrete', height: 1
        }, low: {
          pattern: 'concrete', height: 0.5
        }, brick: {
          pattern: 'brick', height: 1.2
        }, rib: {
          pattern: 'ribbed', height: 1.1
        }
      },
    });
  const { label, ring, burst: smallBurst, withinRange: near, Sign, Terminal: Console, Companion } = DM.BonusKit;
  class Evidence extends Console {
    constructor(ctx, x, y, bit, text, available = () => true) {
      super(x, y, 'E · RECOVER EVIDENCE', () => {
        ctx.flags.evidence = (ctx.flags.evidence || 0) | bit;
        ctx.scene.dialog.open([
          ['rorschach', text],
          ['niteowl', `That's ${countBits(ctx.flags.evidence)} of three records. We can put names behind this.`]
        ]);
        DM.Audio.play('success');
        smallBurst(ctx.world, x, y, GOLD);
      }, () => available() && !((ctx.flags.evidence || 0) & bit), GOLD);
      this.ctx = ctx;
      this.bit = bit;
      this.available = available;
    }
    light() {
      return this.available() && !(this.ctx.flags.evidence & this.bit) ? super.light() : null;
    }
    render(g, w) {
      if (this.available() && !((this.ctx.flags.evidence || 0) & this.bit))
        super.render(g, w);
    }
    renderEmissive(g, w) {
      if (this.available() && !((this.ctx.flags.evidence || 0) & this.bit))
        super.renderEmissive(g, w);
    }
  }
  class Owlship extends DM.Entity {
    constructor(x, y) {
      super({
        x, y, r: 100, body: false, solid: false, static: true, disintegratable: false, layer: 0
      });
      this.light = () => ({
        r: 290, i: 0.6, color: GOLD, k: 0.14
      });
    }
    render(g, w) {
      g.save();
      g.translate(this.x, this.y);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      G.ellipse(g, 10, 19, 150, 91);
      g.fill();
      const grad = g.createLinearGradient(-140, -80, 130, 75);
      grad.addColorStop(0, '#ac925c');
      grad.addColorStop(0.5, '#6c644e');
      grad.addColorStop(1, '#383e3d');
      g.fillStyle = grad;
      G.ellipse(g, 0, 0, 144, 80);
      g.fill();
      g.strokeStyle = '#bba56d';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#151e25';
      G.ellipse(g, 0, -18, 85, 43);
      g.fill();
      g.strokeStyle = '#988753';
      g.lineWidth = 4;
      g.stroke();
      for (const sx of [-1, 1]) {
        g.fillStyle = '#bda66d';
        G.circle(g, sx * 43, -20, 29);
        g.fill();
        g.fillStyle = '#21313c';
        G.circle(g, sx * 43, -20, 22);
        g.fill();
        g.fillStyle = 'rgba(139,199,216,0.5)';
        G.ellipse(g, sx * 43 - 5, -25, 9, 6);
        g.fill();
      }
      g.fillStyle = '#ab8b4c';
      g.beginPath();
      g.moveTo(-15, 0);
      g.lineTo(15, 0);
      g.lineTo(0, 30);
      g.closePath();
      g.fill();
      for (const sx of [-1, 1]) {
        g.strokeStyle = '#333c3e';
        g.lineWidth = 5;
        for (let i = 0; i < 4; i++)
          G.line(g, sx * (85 + i * 10), 13, sx * (75 + i * 10), 37);
      }
      g.fillStyle = '#6a6e62';
      g.fillRect(-30, 66, 60, 55);
      g.strokeStyle = '#bcb295';
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++)
        G.line(g, -27, 71 + i * 10, 27, 71 + i * 10);
      g.restore();
      if (!w.lit)
        this.renderEmissive(g, w);
    }
    renderEmissive(g) {
      for (const s of [-1, 1])
        G.glow(g, this.x + s * 124, this.y + 18, 28, GOLD, 0.4);
    }
  }
  class SignalGuard extends DM.Enemies.Gangster {
    constructor(ctx, options) {
      super(options);
      this.ctx = ctx;
      this.interrogating = false;
    }
    onKO() {
      if (this.ctx.world.mapId !== 'broadcast_roofs')
        return;
      this.interact = {
        label: 'E · ASK RORSCHACH TO QUESTION HIM', range: 85,
        enabled: () => this.ko && !this.dead && !this.ctx.flags.interrogated,
        onInteract: () => {
          const companion = this.ctx.flags.rorschach;
          if (companion.taskTarget instanceof SignalGuard)
            companion.taskTarget.interrogating = false;
          this.interrogating = true;
          companion.taskTarget = this;
          this.ctx.toast('RORSCHACH IS COMING OVER', GOLD);
        },
      };
    }
    update(dt, world) {
      super.update(dt, world);
      if (!this.interrogating)
        return;
      const companion = this.ctx.flags.rorschach;
      if (this.dead || this.ctx.flags.interrogated || companion.taskTarget !== this) {
        this.interrogating = false;
        if (companion.taskTarget === this)
          companion.taskTarget = null;
        return;
      }
      if (world.ceasefire)
        return;
      if (U.dist(companion.x, companion.y, this.x, this.y) > 75)
        return;
      this.interrogating = false;
      companion.taskTarget = null;
      this.ctx.flags.interrogated = true;
      this.interact = null;
      this.ctx.scene.dialog.open([
        [
          'rorschach',
          'You are still here. That gives you something to bargain with. Where is the dispatch record?'
        ],
        { who: 'radioengineer', name: 'Signal Guard', text: 'Service box, by the east aerial. Please. I only drove the truck.' },
        [
          'niteowl',
          'We have a location. And someone who can testify to it.'
        ],
      ]);
      this.ctx.marker(1150, 350, 'DISPATCH RECORD');
      DM.Audio.play('success');
    }
  }
  class BoothDoor extends DM.Entity {
    constructor(ctx) {
      super({
        x: 1320, y: 650, r: 30, static: true, body: false, solid: false, disintegratable: false
      });
      this.ctx = ctx;
      this.working = false;
      this.progress = 0;
      this.opened = false;
      this.interact = {
        label: 'E · CALL NITE OWL TO THE LOCK', range: 85,
        enabled: () => !this.opened,
        onInteract: () => {
          this.working = true;
          this.ctx.flags.owl.taskTarget = { x: this.x - 45, y: this.y };
          this.ctx.scene.dialog.open([
            [
              'niteowl',
              'Four seconds at the panel. Keep anyone with a clear shot away from me.'
            ],
            [
              'rorschach',
              'I will watch the door. You watch his back.'
            ],
          ]);
        },
      };
      // A real collision gate, removed only when Dan has completed the lock.
      this.gate = ctx.world.wall(1312, 612, 16, 82, 'low');
      this.gateRect = {
        x: 1312, y: 612, w: 16, h: 82
      };
    }
    update(dt, world) {
      if (this.opened || !this.working || world.ceasefire)
        return;
      const owl = this.ctx.flags.owl;
      if (U.dist(owl.x, owl.y, this.x - 45, this.y) > 65)
        return;
      const unsafe = world.entities.some(e => e.team === 'enemy' && active(e) && !e.isProjectile &&
        U.dist(e.x, e.y, owl.x, owl.y) < 430 && world.los(e.x, e.y, owl.x, owl.y));
      this.progress = unsafe ? 0 : this.progress + dt;
      if (this.progress < 4)
        return;
      this.opened = true;
      this.ctx.flags.boothOpen = true;
      owl.taskTarget = null;
      world.walls = world.walls.filter(wall => wall !== this.gate);
      DM.Audio.play('door');
      this.ctx.toast('SUPERVISOR BOOTH UNLOCKED', BLUE);
    }
    render(g, world) {
      g.fillStyle = this.opened ? '#56716e' : '#a49b7c';
      g.fillRect(this.x - 9, this.y - 37, this.opened ? 6 : 18, 74);
      g.fillStyle = '#253d43';
      g.fillRect(this.x - 23, this.y - 46, 15, 23);
      if (!world.lit)
        this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      g.fillStyle = this.opened ? BLUE : GOLD;
      g.fillRect(this.x - 19, this.y - 42, 7, 6);
      if (!this.working || this.opened)
        return;
      g.fillStyle = '#132730';
      g.fillRect(this.x - 50, this.y - 70, 100, 6);
      g.fillStyle = BLUE;
      g.fillRect(this.x - 50, this.y - 70, 100 * Math.min(1, this.progress / 4), 6);
    }
  }
  function companions(ctx, x, y) {
    ctx.flags.owl = ctx.add(new Companion(x - 60, y + 45, 'niteowl'));
    ctx.flags.rorschach = ctx.add(new Companion(x + 65, y + 40, 'rorschach'));
  }
  function guards(ctx, pts) {
    return pts.map(([x, y, gun]) => ctx.add(new SignalGuard(ctx, {
      x, y, gun: gun || 'pistol', alerted: true, sight: 680, look: {
        name: 'Signal Guard', skin: '#cba98b', hat: '#293944', hatBrim: '#162029', body: '#415766', sleeve: '#415766',
        legs: '#26353e', bg: '#38444d'
      }
    })));
  }
  function dressing(w, seed, floor = '#303d49') {
    w.bake((g, width, height) => {
      const rnd = U.seeded(seed);
      g.fillStyle = '#0b1522';
      g.fillRect(0, 0, width, height);
      DM.Bonus.city(g, 0, 0, 0, width, 210);
      g.fillStyle = floor;
      g.fillRect(65, 210, width - 130, height - 270);
      g.strokeStyle = 'rgba(143,166,177,0.08)';
      g.lineWidth = 1;
      for (let x = 65; x < width - 65; x += 60)
        G.line(g, x, 210, x, height - 60);
      for (let y = 210; y < height - 60; y += 60)
        G.line(g, 65, y, width - 65, y);
      for (let i = 0; i < 2400; i++) {
        g.fillStyle = rnd() > .5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
        g.fillRect(65 + rnd() * (width - 130), 210 + rnd() * (height - 270), 1 + rnd() * 5, 1 + rnd() * 3);
      }
      for (let i = 0; i < 16; i++) {
        g.fillStyle = 'rgba(125,159,176,0.08)';
        G.ellipse(g, 130 + rnd() * (width - 260), 260 + rnd() * (height - 360), 30 + rnd() * 55, 8 + rnd() * 15);
        g.fill();
      }
    });
    w.room(65, 210, w.w - 130, w.h - 270, {
      t: 16, kind: 'low'
    });
  }
  function buildRoofs(ctx) {
    const w = ctx.newWorld({
      w: 2000, h: 1160, zoom: 1.12
    });
    w.spawn = {
      x: 360, y: 890
    };
    dressing(w, 1976);
    DM.BroadcastAtmosphere.install(ctx, 'roofs');
    w.wall(815, 210, 170, 330, 'wall');
    w.wall(815, 710, 170, 390, 'wall');
    w.decals.push((g) => {
      g.fillStyle = '#111c28';
      g.fillRect(815, 210, 170, 330);
      g.fillRect(815, 710, 170, 390);
      g.fillStyle = '#64727b';
      g.fillRect(815, 540, 170, 170);
      g.strokeStyle = '#a29a73';
      g.lineWidth = 2;
      for (let x = 825; x < 980; x += 20)
        G.line(g, x, 545, x, 704);
    });
    for (const [x, y] of [
      [535, 400],
      [1090, 770],
      [1400, 540]
    ]) {
      w.wall(x, y, 155, 100, 'low');
    }
    for (const [x, y] of [
      [500, 755],
      [710, 565],
      [1190, 400],
      [1550, 820]
    ])
      ctx.add(new DM.Props.Crate(x, y, {
        style: 'metal'
      }));
    ctx.add(new Owlship(310, 865));
    companions(ctx, 405, 875);
    ctx.add(new Sign(900, 618, 'SERVICE BRIDGE', '#d8c596', 14));
    ctx.flags.roofGuards = guards(ctx, [
      [670, 720],
      [640, 540],
      [1190, 660],
      [1460, 710, 'tommy'],
      [1710,
        420],
      [1580, 310]
    ]);
    ctx.add(new Evidence(ctx, 1150, 350, 1, 'Dispatch log. Same truck. Same hour. Three nights. They took people, not equipment.',
      () => !!ctx.flags.interrogated));
    ctx.add(new Console(1760, 300, 'E · ENTER THE RELAY', () => {
      if (ctx.flags.roofGuards.some(active))
        return ctx.toast('THE ROOFTOP GUARDS STILL CONTROL THE STAIRS', GOLD);
      ctx.flags.enterRelay = true;
    }, () => true));
    return w;
  }
  class Coil extends DM.Props.Crate {
    constructor(x, y, n) {
      super(x, y, {
        r: 22, mass: 3, hp: null, style: 'metal'
      });
      this.hp = this.maxHp = null;
      this.disintegratable = false;
      this.n = n;
      this.docked = false;
      this.colors = [BLUE, GOLD];
      this.light = () => ({
        r: 130, i: .6, color: n === 1 ? BLUE : GOLD, k: .15
      });
    }
    render(g, w) {
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.rot);
      g.fillStyle = '#283d49';
      g.fillRect(-23, -20, 46, 40);
      g.strokeStyle = this.n === 1 ? BLUE : GOLD;
      g.lineWidth = 3;
      for (let x = -14; x <= 14; x += 7)
        G.line(g, x, -13, x, 13);
      g.restore();
      if (!w.lit)
        this.renderEmissive(g, w);
    }
    renderEmissive(g, w) {
      const color = this.n === 1 ? BLUE : GOLD;
      g.strokeStyle = color;
      g.lineWidth = 3;
      if (this.n === 1)
        ring(g, this.x, this.y, 9, color, 3);
      else
        g.strokeRect(this.x - 8, this.y - 8, 16, 16);
      if (this.docked)
        G.glow(g, this.x, this.y, 26, color, 0.25);
    }
  }
  class Dock extends DM.Entity {
    constructor(ctx, x, y, coil) {
      super({
        x, y, r: 35, body: false, solid: false, static: true, disintegratable: false, layer: 0
      });
      this.coil = coil;
      this.ctx = ctx;
      this.light = () => ({
        r: 160, i: .65, color: coil.n === 1 ? BLUE : GOLD, k: .12
      });
    }
    update(dt, w) {
      const c = this.coil;
      if (c.docked || c.heldBy)
        return;
      if (U.dist(c.x, c.y, this.x, this.y) < 70 && c.speed < 130) {
        c.docked = true;
        c.static = true;
        c.body = false;
        c.grabbable = false;
        c.x = this.x;
        c.y = this.y;
        c.vx = c.vy = 0;
        this.ctx.flags.coils = (this.ctx.flags.coils || 0) | (1 << (c.n - 1));
        smallBurst(w, this.x, this.y, c.n === 1 ? BLUE : GOLD);
        DM.Audio.play('success');
        this.ctx.toast(`COIL ${c.n} CONNECTED · SIGNAL GROUNDING`, BLUE);
      }
    }
    render(g, w) {
      g.fillStyle = '#13222b';
      g.fillRect(this.x - 42, this.y - 38, 84, 76);
      g.strokeStyle = this.coil.n === 1 ? BLUE : GOLD;
      g.lineWidth = 2;
      g.setLineDash([6, 5]);
      g.strokeRect(this.x - 42, this.y - 38, 84, 76);
      g.setLineDash([]);
      if (!w.lit)
        this.renderEmissive(g, w);
    }
    renderEmissive(g) {
      const color = this.coil.n === 1 ? BLUE : GOLD;
      if (this.coil.n === 1)
        ring(g, this.x, this.y, 28, color, 2);
      else {
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.strokeRect(this.x - 27, this.y - 27, 54, 54);
      }
    }
  }
  function buildRelay(ctx) {
    const w = ctx.newWorld({
      w: 1780, h: 1160, zoom: 1.08
    });
    w.spawn = {
      x: 230, y: 940
    };
    dressing(w, 886, '#354248');
    DM.BroadcastAtmosphere.install(ctx, 'relay');
    w.decals.push(g => {
      g.strokeStyle = '#a5864f';
      g.lineWidth = 5;
      for (const y of [490, 690]) {
        g.beginPath();
        g.moveTo(910, y);
        g.lineTo(1150, y);
        g.lineTo(1150, 900);
        g.lineTo(1500, 900);
        g.stroke();
      }
    });
    for (const x of [430, 710, 1160]) {
      w.wall(x, 380, 85, 200, 'low');
      w.decals.push(g => {
        g.fillStyle = '#506d71';
        g.fillRect(x + 8, 390, 69, 178);
        for (let y = 407; y < 555; y += 22) {
          g.fillStyle = '#9eb7a5';
          g.fillRect(x + 17, y, 21, 5);
          g.fillStyle = '#bf925c';
          g.fillRect(x + 49, y, 12, 5);
        }
      });
    }
    ctx.add(new Sign(850, 255, 'RELAY FLOOR / EMERGENCY CARRIER', GOLD, 22));
    companions(ctx, 260, 950);
    ctx.flags.relayGuards = guards(ctx, [
      [600, 820],
      [850, 950],
      [1040, 420],
      [1380, 560, 'tommy'],
      [1480,
        840],
      [350, 330]
    ]);
    ctx.flags.engineers = 0;
    ctx.flags.coils = 0;
    const spots = [
      [280, 280],
      [960, 300],
      [1490, 320]
    ];
    spots.forEach(([x, y], i) => {
      w.wall(x - 70, y - 15, 16, 100, 'low');
      w.wall(x + 54, y - 15, 16, 100, 'low');
      const npc = ctx.add(new DM.NPC({
        x, y, look: 'radioengineer', talk: () => {
          if (ctx.flags.relayGuards.some(e => active(e) && U.dist(e.x, e.y, x, y) < 160))
            return ctx.toast('CLEAR THE GUARD NEAR THE ENGINEER', GOLD);
          ctx.flags.engineers |= (1 << i);
          npc.interact = null;
          npc.walkTo(240, 940);
          npc.solid = false;
          npc.body = false;
          ctx.scene.dialog.open([
            ['radioengineer', [
              'He calls himself the Switchman. He is feeding stolen panic recordings into every emergency channel.',
              'Ground the carrier with both coils. Match each coil to the dock with the same colour ' +
              'and shape, then let go. The lift cannot run while the signal is live.',
              'The rooftop amplifier has three shield pylons. Break those first. The man behind it is only a voice.'
            ][i]],
            [
              'niteowl',
              'I have you. Stay behind us. We will get you out.'
            ]
          ]);
          DM.Audio.play('success');
        }, label: 'Free the engineer', range: 82
      }));
      npc.light = () => ({
        r: 120, i: .65, color: '#b3ded4', k: .08
      });
    });
    const a = ctx.add(new Coil(600, 700, 1)), b = ctx.add(new Coil(1290, 700, 2));
    ctx.flags.coilObjects = [a, b];
    ctx.add(new Dock(ctx, 900, 490, a));
    ctx.add(new Dock(ctx, 900, 690, b));
    w.wall(1312, 450, 16, 162, 'low');
    w.wall(1312, 694, 16, 16, 'low');
    w.wall(1312, 442, 358, 16, 'low');
    w.wall(1654, 450, 16, 260, 'low');
    w.wall(1312, 702, 358, 16, 'low');
    ctx.flags.boothDoor = ctx.add(new BoothDoor(ctx));
    ctx.add(new Evidence(ctx, 1520, 600, 2, 'Payment ledger. Shell companies paying shell companies. People hiding inside the ' +
      'paperwork. Not very well.', () => !!ctx.flags.boothOpen));
    ctx.add(new Console(1520, 900, 'E · ROOFTOP LIFT', () => {
      if (ctx.flags.engineers !== 7 || ctx.flags.coils !== 3)
        return ctx.toast('RESCUE ALL THREE ENGINEERS AND CONNECT BOTH COILS', GOLD);
      ctx.flags.enterTower = true;
    }, () => true));
    return w;
  }
  class Pylon extends DM.Entity {
    constructor(x, y, n) {
      super({
        x, y, r: 26, hp: 120, static: true, team: 'enemy', grabbable: false, disintegratable: true
      });
      this.n = n;
      this.bonusPylon = true;
      this.hazard = true;
      this.light = () => ({
        r: 210, i: .7, color: '#b597e5', k: .22
      });
    }
    render(g, w) {
      g.fillStyle = '#393c52';
      g.fillRect(this.x - 25, this.y - 23, 50, 46);
      g.strokeStyle = '#8b79b8';
      g.lineWidth = 3;
      g.strokeRect(this.x - 25, this.y - 23, 50, 46);
      if (!w.lit)
        this.renderEmissive(g, w);
    }
    renderEmissive(g, w) {
      ring(g, this.x, this.y, 19 + Math.sin(w.time * 3) * 3, '#c9b3ff', 3);
      g.fillStyle = '#171b28';
      g.fillRect(this.x - 26, this.y + 32, 52, 5);
      g.fillStyle = '#bd9ce9';
      g.fillRect(this.x - 26, this.y + 32, 52 * this.hp / this.maxHp, 5);
    }
    onDeath() {
      const w = this.world;
      smallBurst(w, this.x, this.y, '#bca5ff');
      DM.Audio.play('impact');
      w.camera.shake(.17);
    }
  }
  class Carrier extends DM.Entity {
    constructor(ctx, x, y, pylons) {
      super({
        x, y, r: 62, hp: 700, static: true, team: 'enemy', disintegratable: true
      });
      this.ctx = ctx;
      this.pylons = pylons;
      this.bonusBoss = true;
      this.human = false;
      this.name = 'THE CARRIER';
      this.phaseMarks = [0.5];
      this.phase = 1;
      this.hazard = true;
      this.alerted = true;
      this.threatWeight = 6;
      this.cd = 2;
      this.beamT = 5;
      this.beamAim = 0;
      this.shutter = 0;
      this.shieldWasUp = true;
      this.cameraFrame = new DM.BonusKit.BossFraming(ctx, this, {
        left: 240, right: 240, top: 155, bottom: 220
      });
    }
    light() {
      return {
        r: 350, i: 0.8, color: this.shielded ? '#a48bcf' : BLUE, k: 0.22
      };
    }
    get shielded() {
      return this.pylons.some(entity => !entity.dead);
    }
    damage(amount, source, kind) {
      if (this.shielded) {
        if (!this.blockNote || this.world.time > this.blockNote) {
          this.ctx.toast('BREAK THE THREE PYLONS FIRST', GOLD);
          this.blockNote = this.world.time + 3;
        }
        return false;
      }
      return super.damage(amount, source, kind);
    }
    disintegrate(world, player) {
      if (this.shielded)
        return this.damage(0, player, 'disintegrate');
      super.disintegrate(world, player);
    }
    dishes() {
      const radius = this.phase === 2 ? 155 : 93;
      return [-1, 1].map(side => ({
        x: this.x + side * radius,
        y: this.y + (this.phase === 2 ? 42 + Math.sin(this.world.time * 0.7 + side) * 24 : 16),
        side,
      }));
    }
    beamAngle(dish, time = this.beamT) {
      return this.beamAim + (dish.side > 0 && this.phase === 2 ? 0.6 : 0) + Math.max(0, time - 1) * 0.32 - 0.42;
    }
    beamHit(person, previous, current) {
      if (current < 1 || current > 3.5)
        return false;
      return this.dishes().filter(d => this.phase === 2 || d.side < 0).some(dish => DM.BonusKit.sweptArmHit(person, dish,
        this.beamAngle(dish, Math.max(1, previous)), this.beamAngle(dish, current), {
        inner: 1, outer: 950, shaft: 10, weight: 1
      }));
    }
    update(dt, world) {
      if (this.dead)
        return;
      this.cameraFrame.update();
      this.shutter = U.damp(this.shutter, this.shielded ? 0 : 1, 4, dt);
      if (this.shieldWasUp && !this.shielded) {
        this.shieldWasUp = false;
        world.hitstop(0.15);
        world.camera.shake(0.2);
        smallBurst(world, this.x, this.y, BLUE);
        this.ctx.toast('SHIELD DOWN · CORE EXPOSED', BLUE);
        DM.Audio.play('success');
      }
      if (this.hp <= this.maxHp / 2 && this.phase === 1) {
        this.phase = 2;
        this.beamT = 7;
        world.hitstop(0.2);
        world.camera.shake(0.25);
        if (DM.Save.settings.fx !== 'off') {
          for (const side of [-1, 1])
            smallBurst(world, this.x + side * 85, this.y, GOLD);
        }
        this.ctx.toast('DISHES DETACHED · TWO SWEEPS', GOLD);
        DM.Audio.play('impact');
        for (const [x, y] of [
          [400, 500],
          [1400, 520]
        ])
          world.add(new DM.Enemies.Drone({ x, y, alerted: true }));
      }
      if (world.ceasefire)
        return;
      const player = world.player;
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = this.phase === 2 ? 3 : 4;
        const angle = U.angleTo(this.x, this.y, player.x, player.y);
        world.add(new DM.Proj.Missile({
          x: this.x + Math.cos(angle) * 75, y: this.y + Math.sin(angle) * 75,
          angle, target: player, team: 'enemy', dmg: 13,
        }));
        DM.Audio.play('shot');
      }
      const previous = this.beamT;
      this.beamT += dt;
      if (this.beamT >= 7) {
        this.beamT -= 7;
        this.beamAim = U.angleTo(this.x, this.y, player.x, player.y);
      }
      if (previous < 1 && this.beamT >= 1)
        DM.Audio.play('broadcast_beam');
      if (this.beamHit(player, previous, this.beamT))
        player.damage(15, this, 'carrier-beam');
    }
    onDeath() {
      const world = this.world;
      this.cameraFrame.release();
      DM.Audio.hum('broadcast-carrier', false);
      this.ctx.flags.carrierDown = true;
      world.explode(this.x, this.y, 120, 0, { source: this, force: 60, colors: [BLUE, '#d9c796', '#ffffff'] });
      DM.Audio.play('success');
    }
    render(g, world) {
      g.save();
      g.translate(this.x, this.y);
      g.fillStyle = '#142635';
      G.circle(g, 0, 0, 92);
      g.fill();
      g.strokeStyle = '#8e9c9b';
      g.lineWidth = 8;
      g.stroke();
      for (const side of [-1, 1]) {
        g.fillStyle = this.phase === 2 ? '#69777e' : '#86918d';
        const offset = side * this.shutter * 35;
        g.fillRect(side < 0 ? -72 + offset : offset, -64, 72, 128);
        g.strokeStyle = '#394a56';
        g.lineWidth = 2;
        for (let yy = -51; yy < 60; yy += 15) {
          G.line(g, (side < 0 ? -67 : 5) + offset, yy, (side < 0 ? -5 : 67) + offset, yy);
        }
      }
      if (this.phase === 2) {
        g.strokeStyle = '#0a1e2a';
        g.lineWidth = 5;
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(side * 45, -60);
          g.lineTo(side * 70, -22);
          g.lineTo(side * 50, 15);
          g.lineTo(side * 94, 45);
          g.stroke();
        }
      }
      g.restore();
      for (const dish of this.dishes()) {
        const firing = this.beamT < 3.5 && (dish.side < 0 || this.phase === 2);
        const angle = firing ? this.beamAngle(dish) : U.angleTo(dish.x, dish.y, world.player.x, world.player.y);
        g.strokeStyle = '#4c5f69';
        g.lineWidth = this.phase === 2 ? 3 : 9;
        G.line(g, this.x + dish.side * 70, this.y + 30, dish.x, dish.y);
        g.save();
        g.translate(dish.x, dish.y);
        g.rotate(angle);
        g.fillStyle = '#87999e';
        g.beginPath();
        g.moveTo(-22, -49);
        g.quadraticCurveTo(-63, 0, -22, 49);
        g.lineTo(0, 49);
        g.quadraticCurveTo(-23, 0, 0, -49);
        g.closePath();
        g.fill();
        g.strokeStyle = '#d7cfab';
        g.lineWidth = 2;
        g.stroke();
        g.strokeStyle = '#9bb2b5';
        for (const yy of [-39, 39])
          G.line(g, -12, yy, 29, 0);
        g.fillStyle = GOLD;
        G.circle(g, 29, 0, 6);
        g.fill();
        g.restore();
      }
      if (!world.lit)
        this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.shielded) {
        ring(g, this.x, this.y, 105, 'rgba(190,155,245,0.55)', 3);
        for (const pylon of this.pylons.filter(p => !p.dead)) {
          g.strokeStyle = 'rgba(179,143,226,0.55)';
          g.lineWidth = 3;
          G.line(g, pylon.x, pylon.y, this.x, this.y);
          for (let i = 0; i < 4; i++) {
            const u = DM.Save.settings.fx === 'off' ? (i + 0.5) / 4 : (world.time * 0.45 + i / 4) % 1;
            G.glow(g, U.lerp(pylon.x, this.x, u), U.lerp(pylon.y, this.y, u), 8, '#d1c0ff', 0.5);
          }
        }
      }
      else {
        G.glow(g, this.x, this.y, 52 * this.shutter, BLUE, 0.55);
        G.hydrogen(g, this.x, this.y, 27 * this.shutter, '#c6f1ff', world.time * 0.5, 2);
      }
      if (this.beamT >= 3.5)
        return;
      for (const dish of this.dishes().filter(d => this.phase === 2 || d.side < 0)) {
        g.save();
        if (this.beamT < 1) {
          g.strokeStyle = '#f1c078';
          g.lineWidth = 2;
          g.setLineDash([12, 10]);
          for (const t of [1, 3.5]) {
            const a = this.beamAngle(dish, t);
            G.line(g, dish.x, dish.y, dish.x + Math.cos(a) * 950, dish.y + Math.sin(a) * 950);
          }
          g.setLineDash([]);
          g.beginPath();
          g.arc(dish.x, dish.y, 180, this.beamAngle(dish, 1), this.beamAngle(dish, 3.5));
          g.stroke();
        }
        else {
          const a = this.beamAngle(dish);
          g.strokeStyle = 'rgba(106,208,237,0.25)';
          g.lineWidth = 22;
          G.line(g, dish.x, dish.y, dish.x + Math.cos(a) * 950, dish.y + Math.sin(a) * 950);
          g.strokeStyle = '#b5eff2';
          g.lineWidth = 5;
          G.line(g, dish.x, dish.y, dish.x + Math.cos(a) * 950, dish.y + Math.sin(a) * 950);
        }
        g.restore();
      }
    }
  }
  function buildTower(ctx) {
    const w = ctx.newWorld({
      w: 1760, h: 1200, zoom: 1.02
    });
    w.spawn = {
      x: 290, y: 960
    };
    dressing(w, 1985, '#343c49');
    DM.BroadcastAtmosphere.install(ctx, 'tower');
    companions(ctx, 300, 945);
    ctx.add(new Sign(870, 255, 'EMERGENCY TRANSMITTER / AUTHORIZED PERSONNEL ONLY', GOLD, 19));
    for (const [x, y] of [
      [440, 740],
      [1170, 750],
      [380, 370],
      [1320, 390]
    ])
      w.wall(x, y, 140, 66, 'low');
    ctx.add(new Owlship(1430, 975));
    ctx.flags.pylons = [
      [610, 430],
      [1190, 430],
      [895, 790]
    ].map(([x, y], i) => ctx.add(new Pylon(x, y, i + 1)));
    const boss = ctx.add(new Carrier(ctx, 895, 480, ctx.flags.pylons));
    w.boss = boss;
    ctx.flags.carrier = boss;
    ctx.flags.towerGuards = guards(ctx, [
      [410, 580],
      [1330, 610, 'tommy'],
      [1160, 940]
    ]);
    for (const [x, y] of [
      [590, 870],
      [1100, 680],
      [380, 660]
    ])
      ctx.add(new DM.Props.Crate(x, y, {
        style: 'metal', hp: 200
      }));
    ctx.add(new Evidence(ctx, 1450, 300, 4, 'Master tape. A list of targets. His employers planned the panic, then sold the city a cure.'));
    ctx.add(new Console(680, 400, 'E · BROADCAST THE EVIDENCE', () => {
      ctx.flags.choice = 'broadcast';
    }, () => ctx.flags.decision && !ctx.flags.choice, GOLD));
    ctx.add(new Console(1110, 400, 'E · SHUT IT DOWN SILENTLY', () => {
      ctx.flags.choice = 'silence';
    }, () => ctx.flags.decision && !ctx.flags.choice, BLUE));
    const exit = ctx.add(new Console(1430, 1100, 'E · BOARD THE OWLSHIP', () => {
      if ((ctx.flags.interceptors || []).some(active))
        return ctx.toast('CLEAR THE INTERCEPTORS BEFORE TAKEOFF', GOLD);
      ctx.flags.departed = true;
    }, () => !!ctx.flags.choice));
    ctx.flags.exit = exit;
    w.decals.push(g => {
      g.strokeStyle = '#7a6a56';
      g.lineWidth = 4;
      for (const e of ctx.flags.pylons)
        G.line(g, 895, 480, e.x, e.y);
      g.strokeStyle = 'rgba(228,199,133,0.25)';
      g.lineWidth = 3;
      G.circle(g, 895, 480, 260);
      g.stroke();
    });
    return w;
  }
  function pacifyTower(ctx) {
    const f = ctx.flags;
    f.carrierDown = true;
    if (f.carrier) {
      f.carrier.cameraFrame.release();
      DM.Audio.hum('broadcast-carrier', false);
      f.carrier.dead = true;
      f.carrier.hp = 0;
    }
    for (const e of f.pylons || [])
      e.dead = true;
    for (const e of f.towerGuards || [])
      e.dead = true;
    ctx.world.boss = null;
    ctx.clearHostiles();
  }
  function ready(ctx) {
    ctx.player.energy = 100;
    ctx.player.coherence = 100;
    ctx.player.regenDelay = 0;
    ctx.lock(false);
  }
  const chapter = DM.Bonus.register({
    id: 'last_broadcast', numeral: 'BONUS I', title: 'The Last Broadcast', date: 'November 1976', place: 'New York City',
    clock: 4, color: '#283c4d', music: 'bonus_noir', form: 'manhattan',
    persistFlags: [
      'evidence',
      'engineers',
      'coils',
      'carrierDown',
      'choice',
      'interrogated',
      'boothOpen'
    ],
    intro: [
      'It is 1976. Above Manhattan, an aircraft shaped like an owl waits in the rain.',
      'Dan asks for my help. Three radio engineers have vanished. At midnight, a stolen ' +
      'transmitter will speak through every emergency channel in the city.',
      'Walter has followed the men who took them. I have followed the sound of a voice that ' + 'has not spoken yet.'
    ],
    maps: {
      broadcast_roofs: buildRoofs, broadcast_relay: buildRelay, broadcast_tower: buildTower
    },
    stages: [
      {
        id: 'arrival', label: 'Rain on the rooftops', map: 'broadcast_roofs', checkpoint: true,
        run: function*(ctx) {
          yield ctx.dialog([
            [
              'niteowl',
              'Jon. Thanks for coming. Walter traced the kidnappers to this relay station. We need the ' + 'engineers alive.'
            ],
            [
              'rorschach',
              'Six men on the roof. More inside. Their employer is a voice on a radio. Calls himself the Switchman.'
            ],
            [
              'manhattan',
              'In nine minutes, that voice is speaking from a hundred thousand rooms.'
            ],
            [
              'niteowl',
              'Then let us make those nine minutes count. I have stun darts. Walter has his own approach.'
            ]
          ]);
          ready(ctx);
          ctx.objective('Reach the relay entrance', () => `${ctx.flags.roofGuards.filter(active).length} guards remaining`);
          ctx.marker(1760, 300, 'RELAY ENTRANCE');
          ctx.tutorial('All six powers are ready. Cross the bridge or teleport. E interacts; H recalls this hint.', 14);
          yield ctx.until(() => ctx.flags.enterRelay);
          ctx.objectiveDone();
          yield ctx.dialog([
            [
              'rorschach',
              'A hired gun is still a man who chose to take the money.'
            ],
            [
              'niteowl',
              'And three people downstairs did not get a choice. Come on.'
            ]
          ]);
        }, restore: function(ctx) {
          ctx.flags.enterRelay = true;
        }
      },
      {
        id: 'relay', label: 'The voices below', map: 'broadcast_relay', checkpoint: true,
        run: function*(ctx) {
          yield ctx.dialog([
            [
              'switchman',
              'You brought a god to a radio station. How flattering. Let us see if he knows which voices to save.'
            ],
            [
              'niteowl',
              'The engineers are behind those equipment cages. I can get them out once you clear the floor.'
            ],
            [
              'rorschach',
              'Two coils, two matching docks. Lift one into place and release it gently. Then free the engineers.'
            ]
          ]);
          ready(ctx);
          ctx.objective('Rescue the engineers · Ground the carrier', () => `${countBits(ctx.flags.engineers)}/3 people · ${[1,
            2].filter(b => ctx.flags.coils & b).length}/2 coils`);
          ctx.marker(1520, 900, 'ROOFTOP LIFT');
          ctx.tutorial('Lift each coil into its matching dock and release gently. E frees an engineer.', 16);
          yield ctx.until(() => ctx.flags.enterTower);
          ctx.objectiveDone();
          yield ctx.dialog([
            [
              'radioengineer',
              'He never showed his face. Just that voice. I thought if I kept working he would let us go.'
            ],
            ['rorschach', 'He did not. We did.'],
            [
              'niteowl',
              'The three of you, down the stairs. I will bring Archie around to the roof. Jon, the ' +
              'transmitter is still running on its own supply.'
            ]
          ]);
        }, restore: function(ctx) {
          ctx.flags.engineers = 7;
          ctx.flags.coils = 3;
        }
      },
      {
        id: 'carrier', label: 'The carrier wave', map: 'broadcast_tower', checkpoint: true,
        run: function*(ctx) {
          yield ctx.dialog([
            [
              'switchman',
              'Do you know what frightened people will believe? Anything, if enough speakers say it at once.'
            ],
            [
              'niteowl',
              'Three pylons are shielding that core. Break them, then hit the transmitter. Watch the ' + 'red pulse markers.'
            ],
            [
              'manhattan',
              'The signal is not inevitable. It is only very loud.'
            ]
          ]);
          ready(ctx);
          ctx.objective('Break the three shield pylons · Disable the carrier');
          ctx.marker(895, 480, 'THE CARRIER');
          ctx.tutorial('Break the pylons, then attack the core. Catch missiles to return them. F slows danger.', 16);
          yield ctx.until(() => ctx.flags.carrierDown);
          ctx.objectiveDone();
          ctx.clearHostiles();
          for (const e of ctx.world.entities)
            if (e.team === 'enemy' && active(e) && !e.isProjectile)
              e.die('impact');
          ctx.world.boss = null;
          yield ctx.dialog([
            [
              'switchman',
              'You have broken a machine. There will be another. The people paying me can afford a ' + 'great many machines.'
            ],
            [
              'rorschach',
              'Then we give them something they cannot buy back. Their names.'
            ]
          ]);
        }, restore: pacifyTower
      },
      {
        id: 'choice', label: 'What the city hears', checkpoint: true,
        run: function*(ctx) {
          pacifyTower(ctx);
          ready(ctx);
          ctx.flags.decision = true;
          ctx.flags.choice = null;
          yield ctx.dialog([
            [
              'niteowl',
              'There is still enough power for one transmission. Send the records and his people will ' +
              'know exactly where we are. Kill the carrier, and we leave quietly.'
            ],
            ['rorschach', 'Quiet is how they got this far.'],
            [
              'manhattan',
              'I can end the noise. I cannot decide what it means for you.'
            ]
          ]);
          ctx.objective('Choose what the city hears');
          ctx.marker(895, 400, 'TWO CONSOLES');
          ctx.tutorial('Gold sends the evidence and brings interceptors. Blue shuts down quietly. E chooses.', 15);
          yield ctx.until(() => !!ctx.flags.choice);
          ctx.objectiveDone();
          ctx.marker(null);
          if (ctx.flags.choice === 'broadcast') {
            yield ctx.dialog([
              ['niteowl', countBits(ctx.flags.evidence) === 3 ?
                'All three records. Names, payments, target lists. I am sending it to every newsroom I can reach.' :
                'We did not recover every record. I will send what we have. It is enough to start an investigation.'],
              [
                'switchman',
                'You think a city will thank you for making it afraid?'
              ],
              ['rorschach', 'Not asking for thanks.']
            ]);
            ctx.flags.interceptors = [
              [450, 450],
              [1300, 400],
              [750, 850],
              [1200, 760]
            ].map(([x, y]) => ctx.add(new DM.Enemies.Drone({
              x, y, alerted: true
            })));
            ctx.music('bonus_carrier');
          }
          else {
            yield ctx.dialog([
              [
                'niteowl',
                'Carrier is down. The emergency channels are clear. The engineers are safe.'
              ],
              [
                'rorschach',
                'And somebody walks away with clean hands and dirty money.'
              ],
              [
                'manhattan',
                'There is a difference between silence and peace. Tonight, we have made one of them.'
              ]
            ]);
            ctx.flags.interceptors = [];
          }
        }
      },
      {
        id: 'departure', label: 'A city still awake',
        run: function*(ctx) {
          ready(ctx);
          ctx.music(ctx.flags.choice === 'broadcast' ? 'bonus_carrier' : 'reflect');
          ctx.objective('Return to the owlship', () => {
            const n = (ctx.flags.interceptors || []).filter(active).length;
            return n ? `${n} interceptors remain` : 'E to board';
          });
          ctx.marker(1430, 1100, 'OWLSHIP');
          yield ctx.until(() => (ctx.flags.interceptors || []).every(e => !active(e)));
          ctx.music('reflect');
          yield ctx.until(() => ctx.flags.departed);
          ctx.objectiveDone();
          ctx.marker(null);
          ctx.lock(true);
          ctx.clearHostiles();
          yield ctx.dialog([
            [
              'niteowl',
              'Three people are going home tonight. Whatever else happened, that part is real.'
            ],
            ['rorschach', ctx.stats.disintegrated ? 'Some of them knew names. You left us nothing to ask.' :
              'They will be questioned. All of them. Being alive is not the same as being innocent.'],
            [
              'manhattan',
              'Below us, a woman switches on her radio. She hears the weather. She will never know how ' + 'much effort that required.'
            ]
          ]);
          ctx.music('reflect');
          yield ctx.narrate('For a moment, the only voice above the city is the rain.', {
            dur: 4
          });
        }
      },
    ],
  });
  // Public constructors only for focused acceptance tests and later adventures.
  DM.LastBroadcast = {
    chapter, Companion, Coil, Dock, Pylon, Carrier, SignalGuard, BoothDoor, countBits
  };
})();
