/* After Midnight: original investigations built for three mortal vigilantes. */
(function () {
  'use strict';
  const DM = window.DM,
    U = DM.U,
    G = DM.Gfx,
    K = DM.BonusKit;
  const AM = (DM.AfterMidnight = DM.AfterMidnight || {});
  const GOLD = '#e5bc73',
    TEAL = '#8bcec8',
    RED = '#eb997f';
  const alive = (e) => !e.dead && !e.ko;
  const bits = (n) => [1, 2, 4, 8].filter((bit) => (n || 0) & bit).length;
  const heroLine = (ctx, owl, silk, ink) =>
    ctx.player.profile?.id === 'niteowl'
      ? owl
      : ctx.player.profile?.id === 'silkspectre'
        ? silk
        : ink;
  const heroSpeaker = (ctx) => ctx.player.profile?.id || 'niteowl';

  DM.LOOKS.junevale = {
    name: 'June Vale',
    skin: '#d8ad8e',
    hair: '#32272a',
    hairStyle: 'short',
    body: '#627789',
    sleeve: '#627789',
    legs: '#303e4b',
    collar: '#d8c7a6',
    bg: '#53677a',
    color: '#b6d3e2',
    mask(g) {
      g.strokeStyle = '#273941';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(50, 49, 23, Math.PI, 0);
      g.stroke();
      g.fillStyle = '#a9b9b4';
      g.fillRect(23, 47, 8, 17);
      g.fillRect(69, 47, 8, 17);
      g.strokeStyle = '#273941';
      g.lineWidth = 2;
      G.line(g, 73, 61, 61, 70);
      g.fillStyle = '#273941';
      G.circle(g, 60, 70, 3);
      g.fill();
    },
  };
  DM.LOOKS.surveyor = {
    name: 'The Surveyor',
    skin: '#c8af91',
    hair: '#8a8880',
    hairStyle: 'short',
    body: '#494b4f',
    sleeve: '#494b4f',
    legs: '#252f38',
    trim: '#bda26d',
    collar: '#bdab80',
    bg: '#465563',
    color: GOLD,
    mask(g) {
      g.fillStyle = '#243c49';
      G.rr(g, 28, 41, 44, 15, 3);
      g.fill();
      g.strokeStyle = '#b5c8c7';
      g.lineWidth = 2;
      G.line(g, 32, 44, 63, 44);
      g.strokeStyle = '#e5ba68';
      G.line(g, 48, 39, 48, 59);
    },
  };
  const workerNames = ['Della Park', 'Isaac Bell', 'Mara Ortiz', 'Frank Alvarez'];
  for (let i = 0; i < 4; i++)
    DM.LOOKS['am_worker' + i] = {
      name: workerNames[i],
      skin: ['#d4aa85', '#9b7357', '#d0a487', '#c99d78'][i],
      hair: ['#37292a', '#242027', '#503b31', '#666058'][i],
      hairStyle: i === 2 ? 'long' : 'short',
      hat: i === 2 ? null : '#c8a45d',
      hatStyle: 'cap',
      body: ['#829285', '#778a99', '#925f63', '#827452'][i],
      sleeve: '#9d9b83',
      legs: '#34424a',
      bg: '#76858b',
      color: TEAL,
    };

  function ready(ctx) {
    ctx.lock(false);
    ctx.hud.clearTransient();
    ctx.marker(null);
    ctx.focus(null);
  }
  function clearArrival(ctx) {
    ctx.marker(null);
    ctx.hud.clearTransient();
    ctx.hud.setObjective(null);
    ctx.camTarget = null;
  }

  // A grid path is reused by each physical escort for a second; it is not run
  // per render frame, and connected corridors never depend on character powers.
  function findPath(world, start, goal, radius = 14) {
    const cell = 64,
      cols = Math.ceil(world.w / cell),
      rows = Math.ceil(world.h / cell);
    const key = (x, y) => x + y * cols;
    const point = (i) => ({ x: ((i % cols) + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell });
    const grid = world.amNavigation || (world.amNavigation = new Map());
    let valid = grid.get(radius);
    if (!valid) {
      valid = new Uint8Array(cols * rows);
      for (let i = 0; i < valid.length; i++) {
        const p = point(i);
        valid[i] = world.isFree(p.x, p.y, radius + 4) ? 1 : 0;
      }
      grid.set(radius, valid);
    }
    const nearest = (p) => {
      const cx = U.clamp(Math.floor(p.x / cell), 0, cols - 1),
        cy = U.clamp(Math.floor(p.y / cell), 0, rows - 1);
      let best = -1,
        distance = Infinity;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = cx + dx,
            y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = key(x, y);
          if (!valid[i]) continue;
          const q = point(i),
            d = U.dist(p.x, p.y, q.x, q.y);
          if (d < distance) {
            distance = d;
            best = i;
          }
        }
      return best;
    };
    const from = nearest(start),
      to = nearest(goal);
    if (from < 0 || to < 0) return [];
    const parents = new Int32Array(cols * rows);
    parents.fill(-2);
    const queue = [from];
    parents[from] = -1;
    for (let at = 0; at < queue.length && parents[to] === -2; at++) {
      const i = queue[at],
        x = i % cols,
        y = Math.floor(i / cols);
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const next = key(nx, ny);
        if (!valid[next] || parents[next] !== -2) continue;
        parents[next] = i;
        queue.push(next);
      }
    }
    if (parents[to] === -2) return [];
    const path = [];
    for (let i = to; i >= 0; i = parents[i]) path.push(point(i));
    path.reverse();
    if (world.isFree(goal.x, goal.y, radius)) path.push({ x: goal.x, y: goal.y });
    return path;
  }
  function pathMove(entity, goal, speed, dt, world) {
    entity.pathTimer = (entity.pathTimer || 0) - dt;
    if (entity.pathTimer <= 0 || !entity.path?.length) {
      entity.path = findPath(world, entity, goal, entity.r);
      entity.pathTimer = 1;
    }
    while (
      entity.path.length &&
      U.dist(entity.x, entity.y, entity.path[0].x, entity.path[0].y) < 20
    )
      entity.path.shift();
    const target = entity.path[0] || goal;
    const n = U.norm(target.x - entity.x, target.y - entity.y);
    entity.vx = U.damp(entity.vx, n.l > 10 ? n.x * speed : 0, 13, dt);
    entity.vy = U.damp(entity.vy, n.l > 10 ? n.y * speed : 0, 13, dt);
    entity.moving = n.l > 10;
    if (entity.moving) {
      entity.facing = Math.atan2(n.y, n.x);
      entity.walk += dt * speed * 0.09;
    }
  }

  class CaseCivilian extends DM.NPC {
    constructor(ctx, x, y, id, options = {}) {
      super({ x, y, look: 'am_worker' + (id % 4) });
      this.ctx = ctx;
      this.caseId = id;
      this.options = options;
      this.following = false;
      this.safe = false;
      this.body = false;
      this.amLight = true;
      this.disintegratable = false;
      this.interact = {
        label: 'E · GUIDE ' + workerNames[id % 4].split(' ')[0].toUpperCase(),
        range: 80,
        enabled: () => !this.safe,
        onInteract: () => {
          if (options.ready && !options.ready())
            return ctx.toast('LOWER THE GANGWAY WITH THE WINCH FIRST', GOLD);
          this.following = true;
          ctx.world.bark(this, 'Stay where I can see you. I am coming.');
        },
      };
      if (options.alreadySafe) {
        this.safe = true;
        this.interact = null;
        this.x = 220 + id * 31;
        this.y = 1110;
      }
    }
    update(dt, world) {
      if (world.ceasefire || this.safe) {
        this.vx = this.vy = 0;
        this.moving = false;
        return;
      }
      const exit = world.amSafePoint || world.spawn;
      if (this.following && U.dist(this.x, this.y, exit.x, exit.y) < 95) {
        this.safe = true;
        this.following = false;
        this.interact = null;
        this.vx = this.vy = 0;
        this.moving = false;
        if (this.options.onSafe) this.options.onSafe(this);
        else {
          const bit = 1 << this.caseId;
          this.ctx.flags.rescuedMask = (this.ctx.flags.rescuedMask || 0) | bit;
          this.ctx.flags.rescued = bits(this.ctx.flags.rescuedMask);
          this.ctx.toast(
            workerNames[this.caseId % 4].toUpperCase() + ' REACHED THE LIFEBOAT',
            TEAL,
          );
          DM.Audio.play('success');
        }
        return;
      }
      this.cowering = world.entities.some(
        (e) => e.team === 'enemy' && e.human && alive(e) && U.dist(e.x, e.y, this.x, this.y) < 170,
      );
      if (
        !this.following ||
        this.cowering ||
        U.dist(this.x, this.y, world.player.x, world.player.y) < 55
      ) {
        this.vx = U.damp(this.vx, 0, 9, dt);
        this.vy = U.damp(this.vy, 0, 9, dt);
        this.moving = false;
        return;
      }
      pathMove(this, world.player, 148, dt, world);
    }
    light() {
      return this.safe ? null : { r: 110, i: 0.5, k: 0.08, color: this.cowering ? GOLD : TEAL };
    }
    render(g, world) {
      super.render(g);
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.safe) return;
      K.ring(g, this.x, this.y, 21, this.cowering ? GOLD : TEAL, 1.5);
      if (this.cowering) K.label(g, 'CLEAR A SAFE PATH', this.x, this.y - 35, GOLD, 11);
    }
  }

  class CaseGuard extends DM.Enemies.Enemy {
    constructor(x, y) {
      super({ x, y, hp: 46, human: true, sight: 560, alerted: false, grabbable: false });
      this.look = {
        name: 'Contract Security',
        skin: '#c8a481',
        hair: '#3e3230',
        hairStyle: 'short',
        body: '#526371',
        sleeve: '#526371',
        legs: '#2b3945',
        trim: GOLD,
      };
      this.name = 'Contract Security';
      this.cool = 0.9;
      this.windup = 0;
      this.aimTime = 0.75;
    }
    think(dt, world) {
      this.cool -= dt;
      const target = this.target;
      if (!target) {
        this.vx = U.damp(this.vx, 0, 8, dt);
        this.vy = U.damp(this.vy, 0, 8, dt);
        return;
      }
      const distance = U.dist(this.x, this.y, target.x, target.y);
      this.facing = U.angleTo(this.x, this.y, target.x, target.y);
      if (this.windup > 0) {
        this.windup -= dt;
        this.aim = this.windup;
        this.vx = this.vy = 0;
        if (this.windup <= 0) {
          if (distance < 85) target.damage(10, this, 'baton');
          this.cool = 1.5;
          this.aim = 0;
          DM.Audio.play('impact');
        }
      } else if (distance < 73 && this.cool <= 0) {
        this.windup = this.aim = 0.75;
      } else if (distance > 58) pathMove(this, target, 128, dt, world);
      else {
        this.vx = this.vy = 0;
      }
      this.moving = this.speed > 15;
      this.walk += dt * this.speed * 0.09;
    }
    render(g, world) {
      g.save();
      if (this.ko) g.globalAlpha *= 0.4;
      G.figure(g, {
        ...this.look,
        x: this.x,
        y: this.y,
        angle: this.facing + (this.ko ? 1.57 : 0),
        walk: this.walk,
        moving: !this.ko && this.moving,
      });
      g.restore();
      if (!this.ko) {
        g.strokeStyle = '#b5b9ad';
        g.lineWidth = 4;
        G.line(
          g,
          this.x + Math.cos(this.facing + 0.7) * 8,
          this.y + Math.sin(this.facing + 0.7) * 8,
          this.x + Math.cos(this.facing) * 29,
          this.y + Math.sin(this.facing) * 29,
        );
      }
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.ko) {
        K.label(g, 'SPARED', this.x, this.y + 29, TEAL, 10);
        return;
      }
      if (this.windup > 0 && !this.ko) K.ring(g, this.x, this.y, 79, GOLD, 2);
    }
  }
  function spawnGuards(ctx, points, armed = false) {
    return points.map(([x, y], i) => {
      let guard;
      if (armed && i % 3 === 2) {
        guard = new DM.Enemies.Gangster({
          x,
          y,
          hp: 40,
          look: {
            name: 'Contract Security',
            skin: '#bf9975',
            hair: '#49423a',
            body: '#526371',
            sleeve: '#526371',
            legs: '#293641',
            hat: '#334d5e',
            hatStyle: 'cap',
          },
        });
        guard.aimTime = 1.05;
        guard.speedBase = 83;
        guard.range = [95, 220];
      } else guard = new CaseGuard(x, y);
      return ctx.add(guard);
    });
  }
  class Clue extends DM.Entity {
    constructor(ctx, x, y, bit, title, text) {
      super({ x, y, r: 19, body: false, solid: false, static: true, disintegratable: false });
      this.ctx = ctx;
      this.bit = bit;
      this.title = title;
      this.amEvidence = true;
      this.amLight = true;
      this.interact = {
        label: 'E · INVESTIGATE ' + title,
        range: 80,
        enabled: () => !((ctx.flags.clues || 0) & bit),
        onInteract: () => {
          ctx.flags.clues = (ctx.flags.clues || 0) | bit;
          DM.Audio.play('am_radio');
          ctx.scene.dialog.open([
            ['junevale', text],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'The timing is too neat to be an accident. Someone drew this route.',
                'These are people, June. Keep their names on the line.',
                'A schedule. A buyer. Following the money now.',
              ),
            ],
          ]);
        },
      };
    }
    light() {
      return (this.ctx.flags.clues || 0) & this.bit
        ? null
        : { r: 100, i: 0.52, color: '#d3bd85', k: 0.1 };
    }
    render(g, world) {
      g.fillStyle = '#615e53';
      g.fillRect(this.x - 18, this.y - 13, 36, 26);
      g.fillStyle = '#e2d2ad';
      g.fillRect(this.x - 11, this.y - 10, 22, 20);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#736e61';
        g.fillRect(this.x - 7, this.y - 5 + i * 5, 14, 1);
      }
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (!((this.ctx.flags.clues || 0) & this.bit)) K.ring(g, this.x, this.y, 28, GOLD, 1.5);
    }
  }
  class Dial extends K.Terminal {
    constructor(ctx, x, y, index, target) {
      super(
        x,
        y,
        'E · TUNE AERIAL ' + (index + 1),
        () => {
          if ((ctx.flags.clues || 0) !== 7)
            return ctx.toast('THREE TRACES REVEAL THE FREQUENCIES', GOLD);
          const key = 'tune' + index;
          ctx.flags[key] = ((ctx.flags[key] || 0) + 1) % 3;
          DM.Audio.play('am_switch');
          ctx.toast('AERIAL ' + (index + 1) + ' · CHANNEL ' + (ctx.flags[key] + 1), TEAL);
        },
        () => !ctx.flags.signalLocked,
        TEAL,
      );
      this.ctx = ctx;
      this.index = index;
      this.target = target;
    }
    get aligned() {
      return (this.ctx.flags['tune' + this.index] || 0) === this.target;
    }
    render(g, world) {
      super.render(g, world);
      const channel = (this.ctx.flags['tune' + this.index] || 0) + 1;
      g.strokeStyle = '#9dada8';
      g.lineWidth = 4;
      const angle = channel * 0.6 - 1.8;
      G.line(
        g,
        this.x,
        this.y - 18,
        this.x + Math.cos(angle) * 42,
        this.y - 18 + Math.sin(angle) * 42,
      );
    }
    renderEmissive(g, world) {
      super.renderEmissive(g, world);
      K.label(
        g,
        'AERIAL ' + (this.index + 1) + ' · ' + ((this.ctx.flags['tune' + this.index] || 0) + 1),
        this.x,
        this.y + 49,
        this.aligned ? TEAL : GOLD,
        12,
      );
    }
  }
  class Laser extends DM.Entity {
    constructor(ctx, x, y, bit, vertical) {
      super({ x, y, r: 180, static: true, body: false, solid: false, disintegratable: false });
      this.ctx = ctx;
      this.bit = bit;
      this.vertical = vertical;
      this.phase = bit * 0.4;
      this.hazard = true;
      this.cool = 0;
    }
    get off() {
      return !!((this.ctx.flags.circuits || 0) & this.bit);
    }
    update(dt, world) {
      if (world.ceasefire || this.off) return;
      this.phase = (this.phase + dt) % 4.8;
      this.cool -= dt;
      if (this.phase < 1.1 || this.phase > 2.9 || this.cool > 0) return;
      const p = world.player;
      const distance = this.vertical ? Math.abs(p.x - this.x) : Math.abs(p.y - this.y);
      const along = this.vertical ? Math.abs(p.y - this.y) : Math.abs(p.x - this.x);
      if (distance < 14 + p.r && along < 170) {
        p.damage(7, this, 'security-laser');
        this.cool = 0.7;
      }
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.off || this.phase > 2.9) return;
      const warning = this.phase < 1.1;
      g.save();
      g.strokeStyle = warning ? GOLD : RED;
      g.lineWidth = warning ? 1.5 : 4;
      if (warning) g.setLineDash([7, 9]);
      G.line(
        g,
        this.x - (this.vertical ? 0 : 170),
        this.y - (this.vertical ? 170 : 0),
        this.x + (this.vertical ? 0 : 170),
        this.y + (this.vertical ? 170 : 0),
      );
      g.restore();
    }
  }

  class LiveCable extends DM.Entity {
    constructor(ctx, x, y, bit) {
      super({ x, y, r: 90, body: false, solid: false, static: true, disintegratable: false });
      this.ctx = ctx;
      this.bit = bit;
      this.phase = bit * 0.6;
      this.cool = 0;
      this.hazard = true;
      this.amLight = true;
    }
    get off() {
      return !!((this.ctx.flags.power || 0) & this.bit);
    }
    update(dt, world) {
      if (world.ceasefire || this.off) return;
      this.phase = (this.phase + dt) % 3.8;
      this.cool -= dt;
      if (
        this.phase >= 0.9 &&
        this.phase < 2.0 &&
        this.cool <= 0 &&
        U.dist(this.x, this.y, world.player.x, world.player.y) < this.r + world.player.r
      ) {
        world.player.damage(6, this, 'live-cable');
        this.cool = 0.8;
      }
    }
    light() {
      return this.off
        ? null
        : { r: 145, i: this.phase < 2 ? 0.65 : 0.32, k: 0.09, color: '#a3d6db' };
    }
    render(g, world) {
      g.strokeStyle = '#141f25';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(this.x - 45, this.y - 22);
      g.bezierCurveTo(this.x - 3, this.y - 55, this.x + 13, this.y + 46, this.x + 44, this.y + 8);
      g.stroke();
      g.fillStyle = 'rgba(80,137,151,0.2)';
      G.ellipse(g, this.x, this.y, 85, 45);
      g.fill();
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.off || this.phase > 2) return;
      const active = this.phase >= 0.9;
      g.save();
      g.strokeStyle = active ? '#a7e2e7' : GOLD;
      g.lineWidth = active ? 2.5 : 1.5;
      if (!active) g.setLineDash([6, 7]);
      G.ellipse(g, this.x, this.y, 90, 67);
      g.stroke();
      if (active) {
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(this.x + side * 32, this.y);
          g.lineTo(this.x + side * 43, this.y - 16);
          g.lineTo(this.x + side * 55, this.y + 8);
          g.lineTo(this.x + side * 71, this.y - 12);
          g.stroke();
        }
      }
      g.restore();
    }
  }

  const arenas = (AM.arenas = [
    {
      id: 'rooftops',
      title: 'Rain over North Borough',
      description: 'Aerials, service roofs and a sleepless skyline.',
      color: '#d7b078',
    },
    {
      id: 'harbour',
      title: 'East River Storm',
      description: 'Cargo piers, moving water and the harbour bell.',
      color: TEAL,
    },
    {
      id: 'museum',
      title: 'The Glass Archive',
      description: 'Marble, specimen cases and unblinking security lights.',
      color: '#d6b77c',
    },
  ]);
  function buildArena(ctx, theme = 'rooftops', options = {}) {
    if (!arenas.some((a) => a.id === theme)) theme = 'rooftops';
    clearArrival(ctx);
    // The extra south backdrop lets the camera keep a mortal hero above the
    // hint/power HUD while the physical room still ends at the original wall.
    const world = ctx.newWorld({ w: 1920, h: 1500, zoom: 1.03 });
    const layout = options.layout || AM.CaseArt.layout();
    world.amVariant = layout.id;
    world.amVariantLabel = layout.label;
    world.amVariantIndex = layout.index;
    world.amLightingState = layout.lighting;
    world.amCoverLayout = layout.cover.map((rect) => ({ ...rect }));
    world.amLamps = AM.CaseArt.lamps[theme].map(([x, y, r]) => [
      x + (layout.lighting?.offsetX || 0),
      y + (layout.lighting?.offsetY || 0),
      r,
    ]);
    world.amTheme = theme;
    world.amSafePoint = { x: 270, y: 1060 };
    world.amPlayableBounds = { x: 80, y: 210, w: 1760, h: 970 };
    world.spawn = { ...world.amSafePoint };
    world.room(80, 210, 1760, 970, { t: 18, kind: 'wall' });
    for (const rect of world.amCoverLayout) {
      world.wall(rect.x, rect.y, rect.w, rect.h, 'low');
    }
    world.amSpawnPoints = [
      { x: 1450, y: 340 },
      { x: 1630, y: 760 },
      { x: 1050, y: 960 },
      { x: 600, y: 360 },
      { x: 1170, y: 650 },
    ];
    world.amRescueSpawns = [
      { x: 620, y: 370 },
      { x: 1500, y: 370 },
      { x: 1530, y: 940 },
      { x: 900, y: 650 },
    ];
    const ownMap = AM.CaseArt.mapNames[theme];
    const stageMap = ctx.chapter.stages[ctx.stageIndex]?.map;
    if (stageMap && stageMap !== ownMap) {
      DM.Atmosphere.register(stageMap, DM.Atmosphere.get(ownMap));
      DM.Ambience.maps[stageMap] = DM.Ambience.maps[ownMap];
    }
    world.mapId = ownMap;
    AM.CaseArt.install(ctx, theme);
    world.decals.push((g) => {
      g.fillStyle = 'rgba(101,174,154,0.13)';
      G.ellipse(g, 270, 1060, 96, 62);
      g.fill();
      g.strokeStyle = TEAL;
      g.lineWidth = 2;
      G.ellipse(g, 270, 1060, 85, 52);
      g.stroke();
      G.text(g, 'SAFE PASSAGE', 270, 1130, { size: 15, align: 'center', color: TEAL, spacing: 2 });
    });
    const point = { x: world.spawn.x, y: world.spawn.y - 70 };
    ctx.fork(function* () {
      while (ctx.world === world && !ctx.done) {
        if (!world.boss || world.boss.ko || world.boss.dead) {
          point.x = ctx.player.x + U.clamp((world.mouse.x - ctx.player.x) * 0.1, -65, 65);
          point.y = ctx.player.y - 65;
          ctx.camTarget = point;
        }
        yield;
      }
    });
    return world;
  }

  function roofs(ctx) {
    const world = buildArena(ctx, 'rooftops');
    ctx.flags.roofClues = [
      ctx.add(
        new Clue(
          ctx,
          480,
          360,
          1,
          'PAYPHONE',
          'A call sheet. The third channel carries the witness list. Aerial one: three.',
        ),
      ),
      ctx.add(
        new Clue(
          ctx,
          1460,
          340,
          2,
          'PHOTO NEGATIVE',
          'A night photograph of our own dispatch window. Aerial two: one. They have been watching me.',
        ),
      ),
      ctx.add(
        new Clue(
          ctx,
          1590,
          960,
          4,
          'DELIVERY RECORD',
          'Six crates of surveillance equipment, billed as medical supplies. Aerial three: two.',
        ),
      ),
    ];
    ctx.flags.aerials = [
      [650, 760, 0, 2],
      [1160, 420, 1, 0],
      [1330, 930, 2, 1],
    ].map((args) => ctx.add(new Dial(ctx, ...args)));
    ctx.flags.lockTerminal = ctx.add(
      new K.Terminal(
        1050,
        760,
        'E · TRIANGULATE THE SIGNAL',
        () => {
          if ((ctx.flags.clues || 0) !== 7 || !ctx.flags.aerials.every((d) => d.aligned))
            return ctx.toast('AERIAL CHANNELS MUST READ 3 · 1 · 2', GOLD);
          ctx.flags.signalLocked = true;
          DM.Audio.play('success');
        },
        () => !ctx.flags.signalLocked,
      ),
    );
    ctx.flags.uplink = ctx.add(
      new K.Terminal(
        1590,
        360,
        'E · DOWNLOAD THE BUYER LIST',
        () => {
          if (!ctx.flags.signalLocked || ctx.flags.ambush?.some(alive))
            return ctx.toast('CLEAR THE UPLINK FIRST', GOLD);
          ctx.flags.downloaded = true;
        },
        () => !!ctx.flags.signalLocked && !ctx.flags.downloaded,
      ),
    );
    return world;
  }
  function harbour(ctx) {
    const world = buildArena(ctx, 'harbour');
    ctx.flags.generators = [
      [630, 360, 1],
      [1450, 360, 2],
    ].map(([x, y, bit]) =>
      ctx.add(
        new K.Terminal(
          x,
          y,
          'E · ISOLATE LIVE CABLE ' + bit,
          () => {
            if ((ctx.flags.power || 0) & bit) return;
            ctx.flags.power = (ctx.flags.power || 0) | bit;
            DM.Audio.play('am_switch');
            ctx.toast('CABLE ISOLATED · WINCH CIRCUIT RESTORED', TEAL);
          },
          () => !((ctx.flags.power || 0) & bit),
          TEAL,
        ),
      ),
    );
    ctx.flags.cables = [
      ctx.add(new LiveCable(ctx, 880, 410, 1)),
      ctx.add(new LiveCable(ctx, 1540, 680, 2)),
    ];
    ctx.flags.winch = ctx.add(
      new K.Terminal(
        1530,
        760,
        'E · LOWER THE CARGO GANGWAY',
        () => {
          if ((ctx.flags.power || 0) !== 3)
            return ctx.toast('ISOLATE BOTH LIVE CABLES FIRST', GOLD);
          if (ctx.flags.winchOpen) return;
          if (ctx.flags.dockGuards?.some((e) => alive(e) && U.dist(e.x, e.y, 1530, 760) < 250))
            return ctx.toast('CLEAR THE WINCH SO THE WORKERS CAN CROSS', GOLD);
          ctx.flags.winchOpen = true;
          world.amNavigation = null;
          DM.Audio.play('am_crane');
          ctx.toast('GANGWAY DOWN · E GUIDES EACH WORKER', TEAL);
        },
        () => !ctx.flags.winchOpen,
        TEAL,
      ),
    );
    // Keep rescue prompts away from the live-feed breakers. Overlapping E
    // targets otherwise make a worker intercept the intended switch action.
    const workerPoints = [
      { x: 670, y: 800 },
      { x: 1580, y: 480 },
      { x: 1510, y: 1040 },
      { x: 930, y: 690 },
    ];
    ctx.flags.workers = workerPoints.map((p, id) =>
      ctx.add(
        new CaseCivilian(ctx, p.x, p.y, id, {
          ready: () => !!ctx.flags.winchOpen,
          alreadySafe: !!((ctx.flags.rescuedMask || 0) & (1 << id)),
        }),
      ),
    );
    ctx.flags.rescued = bits(ctx.flags.rescuedMask);
    ctx.flags.launch = ctx.add(
      new K.Terminal(
        310,
        1010,
        'E · CAST OFF THE LIFEBOAT',
        () => {
          if ((ctx.flags.rescuedMask || 0) !== 15)
            return ctx.toast('FOUR WORKERS STILL NEED A WAY HOME', GOLD);
          if (ctx.flags.pursuers?.some(alive))
            return ctx.toast('KEEP THE PURSUERS OFF THE LIFEBOAT', GOLD);
          ctx.flags.departed = true;
        },
        () => (ctx.flags.rescuedMask || 0) === 15 && !ctx.flags.departed,
        TEAL,
      ),
    );
    world.overlays.push((g) => {
      g.strokeStyle = ctx.flags.winchOpen ? TEAL : GOLD;
      g.lineWidth = 7;
      const angle = ctx.flags.winchOpen ? 0 : -0.7;
      G.line(g, 1510, 800, 1510 + Math.cos(angle) * 180, 800 + Math.sin(angle) * 180);
      g.lineWidth = 2;
      G.line(g, 1510, 790, 1510 + Math.cos(angle) * 180, 790 + Math.sin(angle) * 180);
    });
    return world;
  }
  function museum(ctx) {
    const world = buildArena(ctx, 'museum');
    ctx.flags.panels = [
      [540, 360, 1],
      [1500, 360, 2],
      [1540, 940, 4],
    ].map(([x, y, bit]) =>
      ctx.add(
        new K.Terminal(
          x,
          y,
          'E · ISOLATE SECURITY CIRCUIT ' + bit,
          () => {
            ctx.flags.circuits = (ctx.flags.circuits || 0) | bit;
            DM.Audio.play('am_switch');
            ctx.toast('SECURITY CIRCUIT ISOLATED', TEAL);
          },
          () => !((ctx.flags.circuits || 0) & bit),
          TEAL,
        ),
      ),
    );
    ctx.flags.lasers = [
      [760, 700, 1, false],
      [1180, 350, 2, true],
      [1510, 790, 4, false],
    ].map((args) => ctx.add(new Laser(ctx, ...args)));
    ctx.flags.archive = ctx.add(
      new K.Terminal(
        900,
        390,
        'E · RECOVER THE GLASS ARCHIVE',
        () => {
          if ((ctx.flags.circuits || 0) !== 7)
            return ctx.toast('THREE LIVE CIRCUITS PROTECT THE DISPLAY', GOLD);
          ctx.flags.ledger = true;
          DM.Audio.play('am_camera');
        },
        () => !ctx.flags.ledger,
        GOLD,
      ),
    );
    ctx.flags.exit = ctx.add(
      new K.Terminal(
        300,
        1010,
        'E · RETURN THE ARCHIVE TO JUNE',
        () => {
          if (!ctx.flags.surveyorCaptured) return ctx.toast('THE SURVEYOR IS STILL WATCHING', GOLD);
          ctx.flags.archiveReturned = true;
        },
        () => !!ctx.flags.surveyorCaptured && !ctx.flags.archiveReturned,
        GOLD,
      ),
    );
    return world;
  }

  class Surveyor extends DM.Enemies.Enemy {
    constructor(ctx, x, y) {
      super({
        x,
        y,
        r: 18,
        hp: 320,
        human: true,
        mass: 3,
        grabbable: false,
        sight: 1800,
        alerted: true,
      });
      this.ctx = ctx;
      this.name = 'THE SURVEYOR';
      this.look = DM.LOOKS.surveyor;
      this.phaseMarks = [0.66, 0.33];
      this.phase = 1;
      this.attackMode = 'approach';
      this.timer = 1.8;
      this.warningAngle = 0;
      this.hazard = true;
      this.amLight = true;
      this.cameraFrame = new K.BossFraming(ctx, this, { left: 90, right: 90, top: 90, bottom: 90 });
    }
    light() {
      return { r: 170, i: 0.65, k: 0.1, color: this.attackMode === 'warn' ? GOLD : '#b5cfc9' };
    }
    damage(amount, source, kind) {
      // The visible teal recovery ring is the opening. A normal stun bolt
      // cannot turn every later hit into an armoured boss's full-damage opening.
      const exposed = this.attackMode === 'recover';
      return super.damage(amount * (exposed ? 1 : 0.55), source, kind);
    }
    update(dt, world) {
      if (this.ko || this.dead) return;
      this.cameraFrame.update();
      // Ordinary guards accept the full stun. This armoured boss visibly
      // staggers, but regains control between successive ordinary gear casts.
      this.stun = Math.min(this.stun, 0.12);
      const phase = this.hp > this.maxHp * 0.66 ? 1 : this.hp > this.maxHp * 0.33 ? 2 : 3;
      if (phase !== this.phase) {
        this.phase = phase;
        this.attackMode = 'warn';
        this.timer = 1.15;
        this.warningAngle = U.angleTo(this.x, this.y, world.player.x, world.player.y);
        this.vx = this.vy = 0;
        this.aim = this.timer;
        this.ctx.toast(
          phase === 2
            ? 'VISOR FRACTURED · WATCH THE CHARGE'
            : 'ARMOUR FRACTURED · WATCH THE LAST CHARGE',
          GOLD,
        );
        DM.Audio.play('am_alarm');
      }
      super.update(dt, world);
    }
    think(dt, world) {
      this.timer -= dt;
      const p = world.player;
      if (!p || p.down) return;
      if (this.attackMode === 'approach') {
        pathMove(this, p, this.phase === 3 ? 140 : 110, dt, world);
        if (this.timer <= 0 || U.dist(this.x, this.y, p.x, p.y) < 95) {
          this.attackMode = 'warn';
          this.timer = this.phase === 1 ? 1.15 : 0.95;
          this.warningAngle = U.angleTo(this.x, this.y, p.x, p.y);
          this.vx = this.vy = 0;
          this.aim = this.timer;
          DM.Audio.play('am_camera');
        }
      } else if (this.attackMode === 'warn') {
        this.vx = this.vy = 0;
        this.aim = Math.max(0, this.timer);
        if (this.timer <= 0) {
          this.aim = 0;
          if (this.phase === 1) {
            for (const spread of [-0.13, 0, 0.13])
              world.add(
                new DM.Proj.Bullet({
                  x: this.x,
                  y: this.y,
                  vx: Math.cos(this.warningAngle + spread) * 350,
                  vy: Math.sin(this.warningAngle + spread) * 350,
                  dmg: 7,
                  life: 1.4,
                  color: '#e1b582',
                }),
              );
            this.attackMode = 'recover';
            this.timer = 1.75;
          } else {
            this.attackMode = 'charge';
            this.timer = 0.72;
            this.chargeHit = false;
          }
        }
      } else if (this.attackMode === 'charge') {
        this.vx = Math.cos(this.warningAngle) * 360;
        this.vy = Math.sin(this.warningAngle) * 360;
        if (!this.chargeHit && U.dist(this.x, this.y, p.x, p.y) < 48) {
          p.damage(14, this, 'surveyor-charge');
          this.chargeHit = true;
        }
        if (
          this.timer <= 0 ||
          !world.isFree(this.x + this.vx * dt, this.y + this.vy * dt, this.r + 2)
        ) {
          this.vx = this.vy = 0;
          this.attackMode = 'recover';
          this.timer = this.phase === 3 ? 2.3 : 1.9;
        }
      } else {
        this.vx = U.damp(this.vx, 0, 12, dt);
        this.vy = U.damp(this.vy, 0, 12, dt);
        if (this.timer <= 0) {
          this.attackMode = 'approach';
          this.timer = 2.7;
        }
      }
      this.facing =
        this.attackMode === 'warn' || this.attackMode === 'charge'
          ? this.warningAngle
          : U.angleTo(this.x, this.y, p.x, p.y);
      this.walk += dt * this.speed * 0.09;
    }
    onKO() {
      this.ctx.flags.surveyorCaptured = true;
      this.cameraFrame.release();
      this.world.boss = null;
      this.ctx.toast('THE SURVEYOR IS DOWN · TAKE THE ARCHIVE HOME', TEAL);
      DM.Audio.play('success');
    }
    render(g, world) {
      g.save();
      if (this.ko) g.globalAlpha *= 0.4;
      G.figure(g, {
        ...this.look,
        x: this.x,
        y: this.y,
        angle: this.facing + (this.ko ? 1.57 : 0),
        walk: this.walk,
        moving: this.speed > 10 && !this.ko,
        scale: 1.15,
      });
      g.restore();
      if (!this.ko) {
        g.save();
        g.translate(this.x, this.y);
        g.rotate(this.facing);
        g.fillStyle = '#9f986f';
        g.fillRect(-9, -12, 22, 24);
        g.strokeStyle = this.phase === 3 ? '#e5c67f' : '#d3d7c3';
        g.lineWidth = 2;
        G.line(g, -7, -10, this.phase === 3 ? 4 : 11, 9);
        g.fillStyle = '#acc7cc';
        g.fillRect(10, -8, 4, 16);
        g.restore();
      }
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.ko) {
        K.label(g, 'IN CUSTODY', this.x, this.y + 32, TEAL, 11);
        return;
      }
      if (this.attackMode === 'warn' || this.attackMode === 'charge') {
        g.save();
        g.translate(this.x, this.y);
        g.rotate(this.warningAngle);
        g.strokeStyle = GOLD;
        g.fillStyle = 'rgba(229,188,115,0.08)';
        g.lineWidth = 2;
        if (this.attackMode === 'warn') g.setLineDash([8, 9]);
        g.fillRect(20, -32, 300, 64);
        g.strokeRect(20, -32, 300, 64);
        g.restore();
      }
      if (this.attackMode === 'recover') K.ring(g, this.x, this.y, 35, TEAL, 2);
    }
  }

  const deadAir = {
    id: 'dead_air',
    title: 'Dead Air',
    date: 'OCTOBER 1977',
    place: 'NORTH BOROUGH',
    clock: 4,
    color: '#9b7581',
    music: 'am_noir',
    theme: 'rooftops',
    description:
      'Follow three intercepted calls across the roofs, then turn a surveillance network against its buyer.',
    intro: [
      'At 12:03, June Vale hears her own voice on a channel she has never used.',
      'Someone has built a map of the city from the people who call for help.',
      'Tonight, the person answering June is someone the map did not expect.',
    ],
    maps: { am_rooftops: roofs },
    persistFlags: ['clues', 'tune0', 'tune1', 'tune2', 'signalLocked', 'downloaded'],
    stages: [
      {
        id: 'traces',
        label: 'Three dead lines',
        map: 'am_rooftops',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'Three places called me. Then every line went dead. The payphone, an ' +
                'east-roof camera, a delivery book.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'Keep your receiver open. I will follow the circuit.',
                'I am going to find the people behind those calls.',
                'Three places. One pattern. Keep talking.',
              ),
            ],
            [
              'junevale',
              'Security is on the roofs. Give them a reason to drop the contract, not a ' +
                'reason to become a name on it.',
            ],
          ]);
          ready(ctx);
          ctx.flags.roofGuards = spawnGuards(
            ctx,
            [
              [650, 850],
              [980, 350],
              [1450, 850],
              [1560, 520],
            ],
            true,
          );
          ctx.objective('Recover three intercepted traces', () => `${bits(ctx.flags.clues)} / 3`);
          ctx.marker(480, 360, 'PAYPHONE TRACE');
          ctx.tutorial(
            'E investigates amber evidence. C fights; Q uses your secondary gear. Space evades.',
            16,
          );
          ctx.fork(function* () {
            while ((ctx.flags.clues || 0) !== 7) {
              const clue = ctx.flags.roofClues.find((c) => !((ctx.flags.clues || 0) & c.bit));
              if (clue) ctx.marker(clue.x, clue.y, clue.title);
              yield;
            }
          });
          yield ctx.until(() => ctx.flags.clues === 7 && !ctx.scene.dialog.active);
          ctx.objectiveDone();
          ctx.marker(null);
        },
        restore(ctx) {
          ctx.flags.clues = 7;
        },
      },
      {
        id: 'triangulate',
        label: 'The listening city',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'The papers give us three channels: three, one, two. Tune the aerials, then ' +
                'lock the signal at the centre console.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'Analogue equipment. A lock I understand.',
                'Someone listened to every frightened person who picked up a phone.',
                'A city reduced to numbers. Numbers can point back.',
              ),
            ],
          ]);
          ready(ctx);
          ctx.objective(
            'Tune aerials to 3 · 1 · 2, then triangulate',
            () => `${ctx.flags.aerials.filter((d) => d.aligned).length} / 3 aligned`,
          );
          ctx.marker(650, 760, 'AERIAL ONE');
          ctx.tutorial(
            'E cycles each aerial through channels 1–3. The centre console locks the signal.',
            16,
          );
          yield ctx.until(() => !!ctx.flags.signalLocked);
          ctx.objectiveDone();
          ctx.marker(null);
        },
        restore(ctx) {
          ctx.flags.clues = 7;
          ctx.flags.signalLocked = true;
          ctx.flags.tune0 = 2;
          ctx.flags.tune1 = 0;
          ctx.flags.tune2 = 1;
        },
      },
      {
        id: 'uplink',
        label: 'Someone is watching',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'The buyer calls himself the Surveyor. Your signal just told him where you are.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'Then let us be worth the journey.',
                'Good. Now he can watch us take his records.',
                'Let him come. This time we are listening.',
              ),
            ],
          ]);
          ready(ctx);
          ctx.flags.ambush = spawnGuards(
            ctx,
            [
              [1100, 690],
              [1440, 340],
              [1550, 770],
            ],
            true,
          );
          ctx.objective(
            'Clear the uplink · Recover the buyer list',
            () => `${ctx.flags.ambush.filter(alive).length} guards`,
          );
          ctx.marker(1590, 360, 'UPLINK');
          ctx.tutorial(
            'Clear the guards, then E downloads the buyer list. Smoke creates room to recover.',
            16,
          );
          yield ctx.until(() => !!ctx.flags.downloaded);
          ctx.objectiveDone();
          ctx.marker(null);
          ctx.lock(true);
          yield ctx.dialog([
            [
              'junevale',
              'A harbour lease, an exhibition invoice, and my own address. Now we know where this goes.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'First we get the people out. Then we find who paid.',
                'Let us make sure the next call gets an answer.',
                'The Surveyor has a name. We will get to that.',
              ),
            ],
          ]);
        },
      },
    ],
  };
  const undertow = {
    id: 'undertow',
    title: 'Undertow',
    date: 'OCTOBER 1977',
    place: 'EAST RIVER · PIER 18',
    clock: 3,
    color: '#658c99',
    music: 'am_storm',
    theme: 'harbour',
    description:
      'Restore a cargo winch and physically escort four dock workers through a storm to the lifeboat.',
    intro: [
      'The harbour bell is ringing with nobody at its rope.',
      'The Surveyor has leased a pier, a crane, and four people who were never ' +
        'told they belonged to the cargo.',
      'June counts four voices on the emergency channel. She will not stop counting until they answer.',
    ],
    maps: { am_harbour: harbour },
    persistFlags: ['power', 'winchOpen', 'rescuedMask', 'rescued', 'departed'],
    stages: [
      {
        id: 'power',
        label: 'Live water',
        map: 'am_harbour',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'Two live feeds are stopping the cargo winch. Isolate both breakers. Four ' +
                'workers are waiting for a gangway.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'Power first. Nobody steps into a live circuit.',
                'Four people. We are bringing back four people.',
                'A rescue written into a shipping manifest. Not tonight.',
              ),
            ],
          ]);
          ready(ctx);
          ctx.flags.dockGuards = spawnGuards(
            ctx,
            [
              [700, 740],
              [1350, 350],
              [1530, 800],
            ],
            true,
          );
          ctx.objective('Isolate both live cable feeds', () => `${bits(ctx.flags.power)} / 2`);
          ctx.marker(630, 360, 'WEST BREAKER');
          ctx.tutorial(
            'E isolates each live feed. The east winch lowers the gangway when both are safe.',
            16,
          );
          yield ctx.until(() => ctx.flags.power === 3);
          ctx.objectiveDone();
          ctx.marker(null);
        },
        restore(ctx) {
          ctx.flags.power = 3;
        },
      },
      {
        id: 'workers',
        label: 'Four voices',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'The winch is ready. Lower the gangway, then ask each worker to follow. ' +
                'Bring them to the green lifeboat marker.',
            ],
            ['am_worker0', 'We did not sign up for this. The papers said it was only machinery.'],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'Stay close. I will find the safest path.',
                'Watch me, not the water. One step at a time.',
                'You have names. That makes you more than cargo.',
              ),
            ],
          ]);
          ready(ctx);
          ctx.flags.dockGuards = [
            ...(ctx.flags.dockGuards || []),
            ...spawnGuards(ctx, [
              [1450, 740],
              [1190, 850],
            ]),
          ];
          ctx.objective(
            'Lower the gangway · Escort four workers',
            () => `${bits(ctx.flags.rescuedMask)} / 4 at the lifeboat`,
          );
          ctx.marker(1530, 760, 'CARGO WINCH');
          ctx.tutorial(
            'E guides a worker. Stay near and lead them around cargo to the green safe passage.',
            18,
          );
          ctx.fork(function* () {
            yield ctx.until(() => !!ctx.flags.winchOpen);
            while ((ctx.flags.rescuedMask || 0) !== 15) {
              const worker = ctx.flags.workers.find((e) => !e.safe && !e.following);
              if (worker) ctx.marker(worker.x, worker.y, worker.look.name);
              else ctx.marker(270, 1060, 'LIFEBOAT');
              yield;
            }
          });
          yield ctx.until(() => ctx.flags.rescuedMask === 15);
          ctx.objectiveDone();
          ctx.marker(null);
        },
        restore(ctx) {
          ctx.flags.power = 3;
          ctx.flags.winchOpen = true;
          ctx.flags.rescuedMask = 15;
          ctx.flags.rescued = 4;
        },
      },
      {
        id: 'lifeboat',
        label: 'Nobody left on the pier',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'Four aboard. There is another truck on the access road. Keep its security team off that boat.',
            ],
            [
              'am_worker2',
              'They moved something to a museum. I saw the cases. They were full of files.',
            ],
          ]);
          ready(ctx);
          ctx.flags.pursuers = spawnGuards(ctx, [
            [690, 910],
            [760, 700],
            [1000, 880],
          ]);
          ctx.objective(
            'Defend the lifeboat · Cast off',
            () => `${ctx.flags.pursuers.filter(alive).length} pursuers`,
          );
          ctx.marker(310, 1010, 'CAST OFF');
          ctx.tutorial(
            'Keep the pursuers away. E casts off only after every worker is aboard and safe.',
            16,
          );
          yield ctx.until(() => !!ctx.flags.departed);
          ctx.objectiveDone();
          ctx.marker(null);
          ctx.lock(true);
          yield ctx.dialog([
            ['junevale', 'Della. Isaac. Mara. Frank. Four voices. All answered.'],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'Tell them the boat has a heater. I will follow the files.',
                'Keep those names, June. That is the story.',
                'The museum is next. The people are already out.',
              ),
            ],
          ]);
        },
      },
    ],
  };
  const glass = {
    id: 'glass_archive',
    title: 'The Glass Archive',
    date: 'OCTOBER 1977',
    place: 'MERCER MUSEUM',
    clock: 2,
    color: '#b29b70',
    music: 'am_glass',
    theme: 'museum',
    description:
      'Unpick a museum security grid and confront the man selling an entire city to its own watchers.',
    intro: [
      'The exhibition is called The City of Tomorrow.',
      'Under glass: a clock, a map, and the private lives of everyone who ever asked June Vale for help.',
      'The Surveyor has invited nobody. He is expecting somebody.',
    ],
    maps: { am_museum: museum },
    persistFlags: ['circuits', 'ledger', 'surveyorCaptured', 'archiveReturned'],
    stages: [
      {
        id: 'security',
        label: 'Three unblinking eyes',
        map: 'am_museum',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'Three circuits protect the archive. Amber lines are warnings; red lines are ' +
                'live. Each breaker takes one eye off the room.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'I built a visor to help me see. He built these to stop anyone seeing him.',
                'An entire city under glass. Let us open a window.',
                'A museum of other people. No admission. No consent.',
              ),
            ],
          ]);
          ready(ctx);
          ctx.flags.museumGuards = spawnGuards(
            ctx,
            [
              [650, 650],
              [1350, 850],
              [1450, 340],
            ],
            true,
          );
          ctx.objective('Isolate three security circuits', () => `${bits(ctx.flags.circuits)} / 3`);
          ctx.marker(540, 360, 'WEST SECURITY');
          ctx.tutorial(
            'Amber lines warn before red lasers fire. E isolates nearby security circuits.',
            16,
          );
          yield ctx.until(() => ctx.flags.circuits === 7);
          ctx.objectiveDone();
          ctx.marker(null);
        },
        restore(ctx) {
          ctx.flags.circuits = 7;
        },
      },
      {
        id: 'archive',
        label: 'Lives in a ledger',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'junevale',
              'Every feed is isolated. The central case holds the originals. Take them before the buyer arrives.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'A paper trail still leaves footprints.',
                'These records go back to the people in them.',
                'Evidence. Not an exhibit.',
              ),
            ],
          ]);
          ready(ctx);
          ctx.objective('Recover the original archive');
          ctx.marker(900, 390, 'GLASS ARCHIVE');
          ctx.tutorial('E opens the central display after all three circuits are isolated.', 14);
          yield ctx.until(() => !!ctx.flags.ledger);
          ctx.objectiveDone();
          ctx.marker(null);
        },
        restore(ctx) {
          ctx.flags.circuits = 7;
          ctx.flags.ledger = true;
        },
      },
      {
        id: 'surveyor',
        label: 'Who watches the watcher',
        checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            [
              'surveyor',
              'People beg to be protected. I merely priced the service. Every address, every fear, every weakness.',
            ],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'You listened to people asking for help. You sold the recordings.',
                'Protection is what you do for someone. Not what you own about them.',
                'You kept a file on everybody. Here is yours.',
              ),
            ],
            [
              'junevale',
              'His armour opens after an attack. Amber marks the line. Move aside, then move in.',
            ],
          ]);
          ready(ctx);
          const boss = ctx.add(new Surveyor(ctx, 1290, 410));
          worldBoss(ctx, boss);
          ctx.objective('Stop the Surveyor · Bring the archive home');
          ctx.tutorial(
            'Dodge amber attack lanes. Teal rings mark recovery: move in, strike, then get clear.',
            18,
          );
          yield ctx.until(() => boss.neutralized);
          ctx.marker(300, 1010, 'RETURN THE ARCHIVE');
          yield ctx.until(() => !!ctx.flags.archiveReturned);
          ctx.objectiveDone();
          ctx.marker(null);
          ctx.lock(true);
          yield ctx.dialog([
            ['junevale', 'The phones will ring tomorrow. They always do. What do I tell them?'],
            [
              heroSpeaker(ctx),
              heroLine(
                ctx,
                'Tell them somebody is listening. For the right reason.',
                'Tell them their city belongs to them.',
                'Tell them to keep calling. We are not finished.',
              ),
            ],
            ['junevale', 'Then I will keep the line open.'],
          ]);
        },
      },
    ],
  };
  function worldBoss(ctx, boss) {
    ctx.world.boss = boss;
  }
  Object.assign(AM, {
    buildArena,
    findCasePath: findPath,
    CaseCivilian,
    CaseGuard,
    LiveCable,
    Surveyor,
  });
  for (const chapter of [deadAir, undertow, glass]) AM.registerCase(chapter);
})();
