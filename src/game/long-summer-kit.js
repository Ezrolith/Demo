/* The Long Summer: encounter-local rules. Nothing here replaces a campaign system. */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const G = DM.Gfx;
  const K = DM.BonusKit;
  const S = DM.Summer = {};
  S.AMBER = '#edb66c';
  S.TEAL = '#92d8cf';
  S.RED = '#ef8568';
  S.alive = e => !e.dead && !e.ko && !e.casualty;

  S.move = function (e, goal, speed, dt, world) {
    const angle = U.angleTo(e.x, e.y, goal.x, goal.y);
    let best = null;
    let score = Infinity;
    for (const offset of [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, 2.2, -2.2]) {
      const a = angle + offset;
      const x = e.x + Math.cos(a) * 44;
      const y = e.y + Math.sin(a) * 44;
      if (!world.isFree(x, y, e.r)) continue;
      const distance = U.dist(x, y, goal.x, goal.y);
      if (distance < score) {
        score = distance;
        best = a;
      }
    }
    const moving = best !== null && U.dist(e.x, e.y, goal.x, goal.y) > 9;
    e.vx = U.damp(e.vx, moving ? Math.cos(best) * speed : 0, 14, dt);
    e.vy = U.damp(e.vy, moving ? Math.sin(best) * speed : 0, 14, dt);
    if (moving) e.facing = best;
    e.moving = moving;
    e.walk += moving ? dt * speed * 0.09 : 0;
  };

  S.tone = function (stats, flags) {
    const killed = (stats.disintegrated || 0) + (flags.comedianCasualties || 0);
    if (flags.heat >= 70 || killed > (stats.spared || 0)) return 'burning';
    if (killed === 0 && flags.heat < 40 && flags.rescued === 6) return 'calm';
    return 'uneasy';
  };

  class CityState extends DM.Entity {
    constructor(ctx) {
      super({ body: false, solid: false, static: true, disintegratable: false, layer: 100, r: 1 });
      this.ctx = ctx;
      this.hazard = true;
      this.reinforcementT = 0;
      this.waves = 0;
      this.gas = [];
      this.water = [];
      this.reasons = [];
      for (const [key, value] of Object.entries({ heat: 46, rescued: 0, rescuedMask: 0, comedianCasualties: 0, restraints: 0 })) {
        if (!Number.isFinite(ctx.flags[key])) ctx.flags[key] = value;
      }
      ctx.on('enemy:down', ev => {
        if (!ev.human || ev.enemy.world !== this.world) return;
        ev.enemy.summerCounted = ev.lethal ? 'unmade' : 'spared';
        this.change(ev.lethal ? 18 : -7, ev.lethal ? 'A person unmade' : 'A person spared');
      });
    }
    get heat() {
      return this.ctx.flags.heat;
    }
    change(amount, reason) {
      this.ctx.flags.heat = U.clamp(this.heat + amount, 0, 100);
      this.reasons.push({ amount, reason });
      if (this.reasons.length > 24) this.reasons.shift();
    }
    casualty(person) {
      if (person.casualty || person.dead) return false;
      // A previous knockout is reclassified, not counted twice or called Jon's unmaking.
      if (person.summerCounted === 'spared') this.ctx.stats.spared = Math.max(0, this.ctx.stats.spared - 1);
      person.summerCounted = 'casualty';
      person.casualty = true;
      person.dead = true;
      this.ctx.flags.comedianCasualties++;
      this.change(20, 'The Comedian killed someone');
      this.ctx.toast('A LIFE LOST TO THE COMEDIAN', S.RED);
      K.burst(this.world, person.x, person.y, '#b5a493');
      return true;
    }
    update(dt, world) {
      const p = world.player;
      if (!p) return;
      this.x = p.x;
      this.y = p.y;
      this.gas = this.gas.filter(e => !e.dead);
      const exposed = this.gas.some(e => U.dist(p.x, p.y, e.x, e.y) < e.r);
      p.speedMul = exposed && !world.ceasefire ? 0.58 : 1;
      this.gassed = exposed;
      if (world.ceasefire) return;
      if (this.grid && this.grid.active.size < 3 && this.ctx.flags.comedian && this.ctx.flags.comedian.disarmed > 0) {
        this.change(-dt * 0.25, 'A quiet street');
      }
      if (world.mapId === 'summer_avenue' && this.heat >= 70 && this.waves < 3) {
        this.reinforcementT += dt;
        if (this.reinforcementT >= 14) {
          this.reinforcementT = 0;
          this.waves++;
          world.add(new Rioter(this, 180, 790 + this.waves * 70, true));
          world.add(new Rioter(this, 1900, 780 + this.waves * 70));
          this.ctx.toast('MORE PEOPLE JOIN THE RIOT', S.AMBER);
        }
      }
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (!this.ctx.hud.gameHudVisible()) return;
      const E = DM.Engine;
      g.save();
      g.setTransform(E.dpr * E.scale, 0, 0, E.dpr * E.scale, E.dpr * E.offX, E.dpr * E.offY);
      if (this.gassed) {
        g.fillStyle = 'rgba(67,70,45,0.19)';
        g.fillRect(0, 0, DM.W, DM.H);
      }
      g.fillStyle = 'rgba(9,12,16,0.88)';
      G.rr(g, 1022, 66, 232, 57, 5);
      g.fill();
      const color = this.heat >= 70 ? S.RED : this.heat < 40 ? S.TEAL : S.AMBER;
      G.text(g, 'CITY HEAT', 1034, 85, { size: 12, color, spacing: 2 });
      G.text(g, Math.round(this.heat).toString(), 1241, 85, { size: 15, color, align: 'right' });
      g.fillStyle = '#34332e';
      g.fillRect(1034, 95, 207, 7);
      g.fillStyle = color;
      g.fillRect(1034, 95, 207 * this.heat / 100, 7);
      g.fillStyle = '#f6e6c7';
      g.fillRect(1034 + 207 * 0.4, 93, 1, 11);
      G.text(g, this.heat < 40 ? 'CALM' : this.heat >= 70 ? 'ESCALATING' : 'ON EDGE', 1034, 116,
        { size: 10, color: '#c4baaa', spacing: 1.2 });
      g.restore();
    }
  }

  class FireGrid extends DM.Entity {
    constructor(state, bounds, seeds) {
      super({ x: bounds.x, y: bounds.y, r: 3000, body: false, solid: false, static: true, disintegratable: false, layer: 0 });
      this.state = state;
      this.bounds = bounds;
      this.cell = 66;
      this.cols = Math.floor(bounds.w / this.cell);
      this.rows = Math.floor(bounds.h / this.cell);
      this.active = new Set();
      this.wet = new Set();
      this.tick = 0;
      this.timer = 0;
      this.hurtT = 0;
      this.hazard = true;
      this.vented = false;
      this.predicted = new Set();
      for (const [x, y] of seeds) this.active.add(this.key(x, y));
      state.grid = this;
    }
    key(x, y) {
      const col = Math.floor((x - this.bounds.x) / this.cell);
      const row = Math.floor((y - this.bounds.y) / this.cell);
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
      return col + row * this.cols;
    }
    point(key) {
      return { x: this.bounds.x + (key % this.cols + 0.5) * this.cell,
        y: this.bounds.y + (Math.floor(key / this.cols) + 0.5) * this.cell };
    }
    valid(key) {
      if (key < 0 || key >= this.cols * this.rows || this.wet.has(key)) return false;
      const p = this.point(key);
      return this.world && this.world.isFree(p.x, p.y, this.cell * 0.42);
    }
    advance(active, tick) {
      const next = new Set(active);
      if (this.vented || active.size >= 75) return next;
      for (const key of active) {
        const offsets = [1, this.cols, -1, -this.cols];
        const offset = offsets[(key + tick) % 4];
        const candidate = key + offset;
        if (Math.abs(offset) === 1 && Math.floor(key / this.cols) !== Math.floor(candidate / this.cols)) continue;
        const a = this.point(key);
        const b = this.point(candidate);
        if (this.valid(candidate) && this.world.los(a.x, a.y, b.x, b.y) && next.size < 75) next.add(candidate);
      }
      return next;
    }
    predict(seconds = 3) {
      let result = new Set(this.active);
      const ticks = Math.floor((this.timer + seconds) / 3);
      for (let i = 0; i < ticks; i++) result = this.advance(result, this.tick + i);
      return result;
    }
    ignite(x, y) {
      const key = this.key(x, y);
      if (this.valid(key) && !this.active.has(key)) {
        this.active.add(key);
        this.state.change(1.5, 'A fire started');
      }
    }
    douse(x, y, radius) {
      let count = 0;
      for (let key = 0; key < this.cols * this.rows; key++) {
        const p = this.point(key);
        if (U.dist(p.x, p.y, x, y) > radius) continue;
        this.wet.add(key);
        if (this.active.delete(key)) count++;
      }
      if (count) this.state.change(-Math.min(10, count * 2), 'Fire extinguished');
      return count;
    }
    vent() {
      if (this.vented) return;
      this.vented = true;
      this.state.ctx.flags.vented = true;
      // Ventilation removes smoke and ends propagation; flames still need to be avoided.
      this.state.change(-8, 'Smoke vented');
      DM.Audio.play('summer_vent');
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.timer += dt;
      while (this.timer >= 3) {
        this.timer -= 3;
        const next = this.advance(this.active, this.tick++);
        this.state.change((next.size - this.active.size) * 0.65, 'Fire spreading');
        this.active = next;
      }
      this.predicted = world.timesight ? this.predict(3) : new Set();
      const p = world.player;
      const near = this.active.has(this.key(p.x, p.y));
      this.hurtT -= dt;
      if (near && this.hurtT <= 0) {
        p.damage(this.vented ? 4 : 7, this, 'fire');
        this.hurtT = 0.65;
      }
      let distance = 1000;
      for (const key of this.active) {
        const q = this.point(key);
        distance = Math.min(distance, U.dist(p.x, p.y, q.x, q.y));
      }
      DM.Audio.hum('summer-local-fire', distance < 500, {
        kind: 'noise', freq: 210, q: 0.4, gain: 0.014 * U.clamp(1 - distance / 500, 0, 1)
      });
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      const view = world.camera.view();
      for (const key of this.active) {
        const p = this.point(key);
        if (p.x < view.x0 - 90 || p.x > view.x1 + 90 || p.y < view.y0 - 90 || p.y > view.y1 + 90) continue;
        const motion = DM.SettingsSchema.reducedFlashing() || DM.Save.settings.fx === 'off' ? 0 : world.time;
        g.fillStyle = '#38201a';
        G.ellipse(g, p.x, p.y + 8, 30, 18);
        g.fill();
        G.glow(g, p.x, p.y, 75, '#e37936', 0.3);
        for (let i = 0; i < 3; i++) {
          const sway = Math.sin(motion * 3 + key + i * 2) * 7;
          const x = p.x - 19 + i * 19;
          const height = 32 + Math.sin(key + i) * 9 + i * 4;
          g.fillStyle = ['rgba(172,62,31,0.85)', 'rgba(228,116,48,0.92)', '#edbc6d'][i];
          g.beginPath();
          g.moveTo(x - 13, p.y + 12);
          g.bezierCurveTo(x - 23, p.y - 13, x + 7, p.y - 12, x + sway, p.y - height);
          g.bezierCurveTo(x + 25, p.y - 10, x + 11, p.y - 5, x + 15, p.y + 12);
          g.quadraticCurveTo(x, p.y + 21, x - 13, p.y + 12);
          g.fill();
          g.fillStyle = 'rgba(255,225,158,0.65)';
          g.beginPath();
          g.moveTo(x - 5, p.y + 11);
          g.quadraticCurveTo(x - 8, p.y, x + 2, p.y - height * 0.5);
          g.quadraticCurveTo(x + 10, p.y + 3, x + 6, p.y + 12);
          g.fill();
        }
        if (!this.vented && DM.Save.settings.fx !== 'off') {
          g.fillStyle = 'rgba(56,49,40,0.24)';
          G.ellipse(g, p.x + 9, p.y - 55, 28, 36);
          g.fill();
        }
      }
    }
    renderFuture(g) {
      for (const key of this.predicted) {
        if (this.active.has(key)) continue;
        const p = this.point(key);
        g.fillStyle = 'rgba(243,184,106,0.16)';
        g.fillRect(p.x - 30, p.y - 30, 60, 60);
        g.strokeStyle = '#e4b979';
        g.lineWidth = 2;
        g.setLineDash([5, 5]);
        g.strokeRect(p.x - 30, p.y - 30, 60, 60);
        g.setLineDash([]);
      }
    }
    light() {
      return null;
    }
  }

  class Puddle extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 120, body: false, solid: false, static: true, disintegratable: false, layer: -1 });
      this.state = state;
      state.water.push(this);
    }
    update(dt, world) {
      if (!world.ceasefire && this.state.grid) this.state.grid.douse(this.x, this.y, this.r);
    }
    render(g, world) {
      g.fillStyle = 'rgba(65,116,127,0.45)';
      G.ellipse(g, this.x, this.y, this.r, this.r * 0.55);
      g.fill();
      g.strokeStyle = 'rgba(161,218,226,0.4)';
      g.lineWidth = 1;
      const time = DM.Save.settings.fx === 'off' || DM.SettingsSchema.reducedFlashing() ? 0 : world.time;
      for (let i = 0; i < 4; i++) {
        const r = ((time * 23 + i * 25) % 110) + 8;
        G.ellipse(g, this.x, this.y, r, r * 0.55);
        g.stroke();
      }
    }
  }
  class Hydrant extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 19, grabbable: true, disintegratable: false, mass: 4, friction: 12 });
      this.state = state;
      this.origin = { x, y };
      this.ripped = false;
    }
    onGrab() {
      if (this.ripped) return;
      this.ripped = true;
      this.world.add(new Puddle(this.state, this.origin.x, this.origin.y));
      this.state.change(-4, 'A hydrant opened');
      K.burst(this.world, this.origin.x, this.origin.y, S.TEAL);
      DM.Audio.play('summer_water');
    }
    render(g) {
      g.fillStyle = '#973d31';
      G.rr(g, this.x - 13, this.y - 27, 26, 48, 5);
      g.fill();
      g.fillStyle = '#c98452';
      G.ellipse(g, this.x, this.y - 25, 15, 7);
      g.fill();
      g.fillRect(this.x - 21, this.y - 8, 42, 9);
      g.strokeStyle = '#edba82';
      g.lineWidth = 2;
      G.line(g, this.x - 4, this.y - 18, this.x - 4, this.y + 15);
    }
  }
  class Gas extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 95, body: false, solid: false, static: true, disintegratable: false, layer: 3 });
      this.state = state;
      this.left = 5;
      this.hazard = true;
      state.gas.push(this);
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      if (this.left <= 0) this.dead = true;
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      const a = Math.min(1, this.left);
      g.fillStyle = `rgba(165,170,105,${0.13 * a})`;
      for (let i = 0; i < 5; i++) {
        G.ellipse(g, this.x + Math.cos(i * 1.3) * 35, this.y + Math.sin(i * 1.3) * 30, 65, 48);
        g.fill();
      }
      K.ring(g, this.x, this.y, this.r, 'rgba(204,204,142,0.25)', 1);
    }
  }
  class Molotov extends DM.Entity {
    constructor(state, x, y, target) {
      const a = U.angleTo(x, y, target.x, target.y);
      super({ x, y, r: 7, vx: Math.cos(a) * 235, vy: Math.sin(a) * 235, friction: 0.2,
        mass: 0.4, grabbable: true, team: 'enemy', body: false });
      this.state = state;
      this.fuse = 2.6;
      this.isProjectile = true;
      this.hazard = true;
      this.snuffed = false;
    }
    onGrab() {
      this.team = 'player';
      this.fuse = Math.max(1.4, this.fuse);
    }
    update(dt, world) {
      if (world.ceasefire) return;
      if (this.state.water.some(p => U.dist(p.x, p.y, this.x, this.y) < p.r)) {
        this.snuffed = true;
        this.dead = true;
        DM.Audio.play('summer_hiss');
        return;
      }
      if (this.heldBy) return;
      this.fuse -= dt;
      if (this.fuse > 0) return;
      this.dead = true;
      if (this.state.grid) this.state.grid.ignite(this.x, this.y);
      world.explode(this.x, this.y, 78, 18, { source: this, team: this.team });
      DM.Audio.play('summer_glass');
    }
    render(g, world) {
      g.fillStyle = '#80975c';
      g.fillRect(this.x - 4, this.y - 10, 8, 19);
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      G.glow(g, this.x, this.y - 8, 30, '#f3b361', 0.6);
      K.ring(g, this.x, this.y, 12, '#f4be6a', 1.5);
    }
  }

  class Rioter extends DM.Enemies.Gangster {
    constructor(state, x, y, thrower = false) {
      super({ x, y, hp: thrower ? 45 : 35, look: DM.LOOKS.summer_rioter, sight: 470 });
      this.state = state;
      this.thrower = thrower;
      this.isSummerHuman = true;
      this.cool = thrower ? 3 : 1;
      this.leaving = false;
      this.exitPoint = { x: x < 1000 ? 80 : 1920, y: 1030 };
    }
    think(dt, world) {
      if (this.leaving || (this.state.heat < 30 && !this.alerted && !this.target)) {
        this.leaving = true;
        S.move(this, this.exitPoint, 125, dt, world);
        if (U.dist(this.x, this.y, this.exitPoint.x, this.exitPoint.y) < 35) {
          this.die('leave');
          this.dead = true;
        }
        return;
      }
      this.cool -= dt;
      const target = this.target;
      if (!target) return;
      const distance = this.distTo(target);
      this.facing = U.angleTo(this.x, this.y, target.x, target.y);
      if (distance > (this.thrower ? 280 : 48)) S.move(this, target, this.thrower ? 75 : 110, dt, world);
      if (this.cool <= 0 && distance < (this.thrower ? 460 : 65)) {
        if (this.thrower) {
          world.add(new Molotov(this.state, this.x, this.y, target));
          this.cool = 5;
          DM.Audio.play('summer_throw');
        } else {
          target.damage(8, this, 'impact');
          this.cool = 1.6;
          DM.Audio.play('impact');
        }
      }
    }
    render(g, world) {
      super.render(g, world);
      if (this.thrower && !this.ko) {
        g.fillStyle = '#b4ba71';
        g.fillRect(this.x + 12, this.y - 5, 5, 13);
      }
    }
  }

  class LiveRound extends DM.Entity {
    constructor(state, from, target) {
      const a = U.angleTo(from.x, from.y, target.x, target.y);
      super({ x: from.x, y: from.y, r: 3, body: false, solid: false, team: 'hostile_ally' });
      this.state = state;
      this.selfMove = true;
      this.vx = Math.cos(a) * 430;
      this.vy = Math.sin(a) * 430;
      this.left = 1.8;
      this.isProjectile = true;
      this.hazard = true;
    }
    update(dt, world) {
      if (world.ceasefire) return;
      const nx = this.x + this.vx * dt;
      const ny = this.y + this.vy * dt;
      if (world.shotHit(this.x, this.y, nx, ny) >= 0) this.dead = true;
      for (const e of world.entities) {
        if (this.dead || !e.isSummerHuman || e.dead || e.inCab || e.safe) continue;
        if (K.segmentDistance(e.x, e.y, this.x, this.y, nx, ny) < e.r + 4) {
          this.dead = true;
          if (this.state.casualty(e) && e.isDriver) this.state.ctx.flags.driverOutcome = 'shot';
        }
      }
      this.x = nx;
      this.y = ny;
      this.left -= dt;
      if (this.left <= 0) this.dead = true;
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      g.strokeStyle = '#f3c17c';
      g.lineWidth = 2;
      G.line(g, this.x, this.y, this.x - this.vx * 0.035, this.y - this.vy * 0.035);
    }
  }

  class Comedian extends DM.NPC {
    constructor(state, x, y) {
      super({ x, y, look: 'comedian', lookAtPlayer: false });
      this.state = state;
      this.team = 'player';
      this.body = false;
      this.mass = 2;
      this.grabbable = true;
      this.disarmed = 0;
      this.cool = 6;
      this.aimT = 0;
      this.shots = 0;
      this.silent = false;
      this.target = null;
      this.restrainedThisHold = false;
    }
    onGrab() {
      this.aimT = 0;
      this.target = null;
      if (this.disarmed <= 0) {
        this.state.change(-10, 'The Comedian restrained');
        this.state.ctx.flags.restraints++;
        this.world.bark(this, this.state.ctx.flags.restraints === 1 ? 'Put me down, Jon.' : 'I remember the first time.');
      }
      this.disarmed = 10;
    }
    onRelease() {
      this.disarmed = 10;
      this.cool = 2;
    }
    update(dt, world) {
      if (world.ceasefire || this.heldBy) return;
      this.disarmed = Math.max(0, this.disarmed - dt);
      const p = world.player;
      if (U.dist(this.x, this.y, p.x, p.y) > 210) S.move(this, { x: p.x + 85, y: p.y + 70 }, 145, dt, world);
      else {
        this.vx = U.damp(this.vx, 0, 8, dt);
        this.vy = U.damp(this.vy, 0, 8, dt);
      }
      if (this.silent || this.disarmed > 0) return;
      if (this.aimT > 0) {
        this.aimT -= dt;
        if (this.aimT <= 0 && this.target && !this.target.dead && !this.target.safe) {
          world.add(new LiveRound(this.state, this, this.target));
          this.state.change(3, 'The Comedian fired');
          this.shots++;
          DM.Audio.play('summer_shot');
          if (this.shots % 3 === 0) {
            world.add(new Gas(this.state, this.target.x, this.target.y));
            DM.Audio.play('summer_gas');
          }
          this.cool = 4.2;
        }
        return;
      }
      this.cool -= dt;
      if (this.cool > 0) return;
      this.target = world.entities.find(e => e.isSummerHuman && !e.dead && !e.safe && !e.inCab &&
        U.dist(e.x, e.y, this.x, this.y) < 520 && world.los(this.x, this.y, e.x, e.y));
      if (this.target) {
        this.facing = U.angleTo(this.x, this.y, this.target.x, this.target.y);
        this.aimT = this.target.isDriver ? 2.2 : 1.3;
        world.bark(this, this.target.isDriver ? 'I can finish this.' : this.target.ko ? 'Stay down means stay down.' : 'Clear the street.');
      }
    }
    render(g, world) {
      super.render(g, world);
      g.fillStyle = '#e4c25b';
      G.circle(g, this.x - 5, this.y + 4, 3);
      g.fill();
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.aimT > 0 && this.target && !this.target.dead) {
        g.strokeStyle = '#d98d5d';
        g.lineWidth = 1;
        g.setLineDash([5, 8]);
        G.line(g, this.x, this.y, this.target.x, this.target.y);
        g.setLineDash([]);
      }
      if (K.withinRange(world, this, 135) && this.disarmed > 0) {
        K.label(g, `DISARMED · ${Math.ceil(this.disarmed)}s`, this.x, this.y - 34, S.TEAL, 11);
      }
    }
  }

  class Resident extends DM.NPC {
    constructor(state, x, y, id, waypoints) {
      super({ x, y, look: id % 2 ? 'summer_resident_b' : 'summer_resident', lookAtPlayer: true });
      this.state = state;
      this.residentId = id;
      this.grabbable = true;
      this.body = false;
      this.mass = 1;
      this.escort = false;
      this.safe = false;
      this.waypoints = waypoints;
      this.interact = { label: 'Guide resident to the stairs', range: 65, enabled: () => !this.safe,
        onInteract: () => {
          this.escort = true;
          this.world.bark(this, 'I can see the stairs now.');
        } };
    }
    onGrab() {
      this.escort = true;
    }
    update(dt, world) {
      if (world.ceasefire || this.safe) return;
      if (!this.escort && world.entities.some(e => e.isDuplicate && !e.dead && U.dist(this.x, this.y, e.x, e.y) < 145)) {
        this.escort = true;
        world.bark(this, 'There are two of you. One is enough.');
      }
      const exit = this.state.safePoint;
      if (!this.heldBy && U.dist(this.x, this.y, exit.x, exit.y) < 70) {
        this.safe = true;
        this.grabbable = false;
        this.escort = false;
        this.interact = null;
        this.vx = 0;
        this.vy = 0;
        this.state.ctx.flags.rescued++;
        this.state.ctx.flags.rescuedMask |= 1 << this.residentId;
        DM.Events.emit('enemy:down', { enemy: this, human: true, lethal: false, kind: 'rescue' });
        DM.Audio.play('summer_safe');
        return;
      }
      if (this.heldBy || !this.escort) return;
      // Being carried to the stairwell bypasses the room-door waypoints legitimately.
      if (this.x > 700 && this.x < 925) this.waypoints = [exit];
      while (this.waypoints.length > 1 && U.dist(this.x, this.y, this.waypoints[0].x, this.waypoints[0].y) < 32) {
        this.waypoints.shift();
      }
      S.move(this, this.waypoints[0] || exit, this.state.grid.vented ? 122 : 95, dt, world);
    }
    render(g, world) {
      super.render(g, world);
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.safe) return;
      K.ring(g, this.x, this.y, 19, this.escort ? S.TEAL : S.AMBER, 1.5);
      if (world.timesight) G.glow(g, this.x, this.y, 36, S.TEAL, 0.16);
    }
  }

  class StairBeam extends DM.Entity {
    constructor(state, x, y, wall) {
      super({ x, y, r: 33, mass: 7, grabbable: true, disintegratable: false, body: false });
      this.state = state;
      this.barrier = wall;
    }
    onGrab() {
      if (this.state.ctx.flags.beamCleared) return;
      this.barrier.noCollide = true;
      this.state.ctx.flags.beamCleared = true;
      this.state.change(-3, 'The stairwell opened');
    }
    render(g) {
      g.save();
      g.translate(this.x, this.y);
      g.rotate(-0.18);
      g.fillStyle = '#40302a';
      g.fillRect(-100, -16, 200, 32);
      g.fillStyle = '#906242';
      g.fillRect(-100, -15, 200, 5);
      g.strokeStyle = '#d88b56';
      g.lineWidth = 1;
      for (const y of [-8, 2, 9]) G.line(g, -85, y, 90, y - 3);
      for (const x of [-80, -50, 50, 80]) {
        g.fillStyle = '#171c20';
        G.circle(g, x, 0, 3);
        g.fill();
      }
      g.restore();
    }
  }
  Object.assign(S, { CityState, FireGrid, Hydrant, Puddle, Gas, Molotov, Rioter, LiveRound, Comedian, Resident, StairBeam });
})();
