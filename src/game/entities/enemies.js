/*
 * Enemies. All share the Enemy base: targeting, stun/held handling, and the
 * lethal/non-lethal split (humans knocked out by throws, blasts or bolts are
 * "spared"; only disintegrated ones are not — the game tracks both).
 *
 * To add an enemy: extend Enemy, implement think(dt, world) and render(ctx, world).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Audio = DM.Audio;
  const Events = DM.Events;
  const { Bullet, Shell, Missile, TachyonDisc } = DM.Proj;

  class Enemy extends DM.Entity {
    constructor(o = {}) {
      super(Object.assign({ team: 'enemy', grabbable: true, r: 12, mass: 1.2, friction: 7, hp: 40 }, o));
      this.human = o.human !== false;
      this.facing = o.facing || 0;
      this.walk = 0;
      this.sight = o.sight || 620;
      this.target = null;
      this.retarget = 0;
      this.alerted = !!o.alerted;
      this.fireCd = U.rand(0.8, 1.8);
      this.aim = 0;
      this.ko = false;
      this.strafeDir = U.chance(0.5) ? 1 : -1;
      this.strafeT = U.rand(1, 3);
      this.needLos = o.needLos !== false;
    }
    get active() {
      return !this.dead && !this.ko;
    }
    acquire(world) {
      let best = null, bd = this.sight;
      for (const e of world.entities) {
        if (e.dead || e.team !== 'player' || !e.targetable || e.hidden || e.down) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d >= bd) continue;
        if (this.needLos && !world.los(this.x, this.y, e.x, e.y)) continue;
        best = e;
        bd = d;
      }
      return best;
    }
    update(dt, world) {
      if (this.ko) return;
      if (this.heldBy) {
        this.stun = Math.max(this.stun, 0.5);
        this.aim = 0;
        if (this.onHeld) this.onHeld(dt, world);
        return;
      }
      if (this.stun > 0) {
        this.stun -= dt;
        this.aim = 0;
        return;
      }
      if (world.ceasefire) {
        this.aim = 0;
        this.burst = 0;
        this.vx = U.damp(this.vx, 0, 6, dt);
        this.vy = U.damp(this.vy, 0, 6, dt);
        return;
      }
      this.retarget -= dt;
      if (this.retarget <= 0) {
        this.retarget = 0.25;
        const t = this.acquire(world);
        if (t && !this.alerted && this.onAlert) this.onAlert(world);
        if (t) this.alerted = true;
        this.target = t;
      }
      this.think(dt, world);
    }
    think() {}
    steer(tx, ty, speed, dt, k = 6) {
      const n = U.norm(tx - this.x, ty - this.y);
      this.vx = U.damp(this.vx, n.x * speed, k, dt);
      this.vy = U.damp(this.vy, n.y * speed, k, dt);
    }
    // A knocked-out body takes no further damage: explosions and later wall
    // bounces still push it around, but it can never go down a second time.
    damage(amount, source, kind) {
      if (this.ko) return false;
      return super.damage(amount, source, kind);
    }
    // The ledger: exactly one 'enemy:down' per enemy. A human goes down
    // lethally only when disintegrated; anything else (throws, blasts, bolts)
    // knocks him out.
    die(kind, source) {
      if (this.ko || this.dead) return;
      const w = this.world;
      if (this.human && kind !== 'disintegrate') {
        this.ko = true;
        this.body = false;
        this.layer = 0;
        this.grabbable = false;
        this.disintegratable = false;
        this.hp = 0;
        this.aim = 0;
        this.burst = 0;
        this.thrown = 0;
        this.stun = 0;
        this.vx *= 0.5;
        this.vy *= 0.5;
        Events.emit('enemy:down', { enemy: this, lethal: false, kind, human: true });
        if (w && w.hitstop) w.hitstop(0.06);
        if (this.onKO && w) this.onKO(w, kind, source);
        return;
      }
      super.die(kind, source);
      Events.emit('enemy:down', { enemy: this, lethal: true, kind, human: this.human });
      if (this.human && w && w.hitstop) w.hitstop(0.09);
    }
    get neutralized() {
      return this.dead || this.ko;
    }
  }

  // ---- 1960s mob ------------------------------------------------------------
  const ALERT_BARKS = ["It's the blue guy!", 'Holy— it\'s him!', 'Shoot him! Shoot!', 'Nobody said nothin\' about HIM!', 'Light him up!'];
  const HELD_BARKS = ['Put me down!', 'Whoa— WHOA!', 'Mama!', 'This ain\'t natural!'];

  // A knocked-out man is drawn washed out, so he never reads as a live threat.
  const greyLooks = new WeakMap();
  function greyed(look) {
    let g = greyLooks.get(look);
    if (g) return g;
    g = Object.assign({}, look);
    for (const k of ['skin', 'hair', 'hat', 'hatBrim', 'body', 'sleeve', 'legs']) if (typeof g[k] === 'string' && g[k][0] === '#') g[k] = U.mix(g[k], '#8a8a8e', 0.5);
    greyLooks.set(look, g);
    return g;
  }

  class Gangster extends Enemy {
    constructor(o = {}) {
      super(Object.assign({ hp: 40, colors: ['#2e2a28', '#d9b08c', '#8a2d2a', '#4b4038'] }, o));
      this.look = o.look || DM.LOOKS.randomGangster();
      this.gun = o.gun || 'pistol';
      this.range = this.gun === 'tommy' ? [150, 280] : [180, 340];
      this.speedBase = this.gun === 'tommy' ? 90 : 105;
      this.aimTime = this.gun === 'tommy' ? 0.7 : 0.45;
      this.burst = 0;
      this.burstT = 0;
      this.heldBarked = false;
      this.kick = 0; // recoil 0..1, decays 10/s
      this.flinch = 0;
      this.muzzleT = 0;
      if (this.gun === 'tommy') {
        this.hp = this.maxHp = 60;
        this.mass = 1.5;
      }
    }
    update(dt, world) {
      if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 10);
      if (this.muzzleT > 0) this.muzzleT -= dt;
      // A solid hit makes him flinch: he stops, and his aim is set back.
      if (this.flinch > 0 && !this.ko && !this.heldBy) {
        this.flinch -= dt;
        this.vx = U.damp(this.vx, 0, 10, dt);
        this.vy = U.damp(this.vy, 0, 10, dt);
        return;
      }
      super.update(dt, world);
    }
    damage(amount, source, kind) {
      const hit = super.damage(amount, source, kind);
      if (hit && amount >= 10 && !this.ko && !this.dead && !this.heldBy) {
        this.flinch = Math.max(this.flinch, 0.12);
        this.kick = 1;
        if (this.aim > 0) this.aim = Math.max(this.aim, this.aimTime * 0.6);
      }
      return hit;
    }
    // Spared: he lies where he fell, gun skidding away.
    onKO(world, kind) {
      const sp = Math.hypot(this.vx, this.vy);
      this.koAngle = sp > 30 ? Math.atan2(-this.vy, -this.vx) : this.facing + Math.PI;
      this.flinch = 0;
      this.kick = 0;
      if (DM.FX) DM.FX.knockout(world, this, { gun: this.gun });
    }
    // Gone: he comes apart from the side facing Jon.
    disintegrate(world, source) {
      if (this.dead || this.ko) return;
      const L = this.look;
      const aim = !!this.target || this.aim > 0;
      const key = ['gangster', L.skin, L.hat, L.hatBrim, L.body, L.legs, this.gun, aim].join('|');
      const draw = (g) => Gfx.figure(g, Object.assign({}, L, { x: 0, y: 0, angle: 0, aim, gun: this.gun }));
      if (!DM.FX || !DM.FX.unbind(world, this, { source, key, draw, angle: this.facing, step: 2, max: 600 })) return super.disintegrate(world, source);
      world.particles.burst(this.x, this.y, 12, { color: ['#bff1ff', '#5fd4ff'], speed: [60, 300], life: [0.2, 0.6], size: [1.5, 3], drag: 3 });
      this.wasDisintegrated = true;
      this.die('disintegrate', source);
    }
    onAlert(world) {
      if (Math.random() < 0.6) world.bark(this, U.pick(ALERT_BARKS));
    }
    onHeld(dt, world) {
      this.facing += dt * 9;
      if (!this.heldBarked) {
        this.heldBarked = true;
        world.bark(this, U.pick(HELD_BARKS), 1.4);
      }
    }
    think(dt, world) {
      this.heldBarked = false;
      const t = this.target;
      this.walk += dt * this.speed * 0.09;
      if (!t) {
        if (this.alerted && this.lastSeen && U.dist(this.x, this.y, this.lastSeen.x, this.lastSeen.y) > 30) this.steer(this.lastSeen.x, this.lastSeen.y, this.speedBase * 0.8, dt);
        else {
          this.vx = U.damp(this.vx, 0, 5, dt);
          this.vy = U.damp(this.vy, 0, 5, dt);
        }
        return;
      }
      this.lastSeen = { x: t.x, y: t.y };
      const d = U.dist(this.x, this.y, t.x, t.y);
      const ang = U.angleTo(this.x, this.y, t.x, t.y);
      this.facing = U.dampAngle(this.facing, ang, 10, dt);
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeDir *= -1;
        this.strafeT = U.rand(1.2, 2.8);
      }
      const nx = Math.cos(ang), ny = Math.sin(ang);
      let mx = -ny * this.strafeDir * 0.7, my = nx * this.strafeDir * 0.7;
      if (d > this.range[1]) {
        mx += nx;
        my += ny;
      } else if (d < this.range[0]) {
        mx -= nx;
        my -= ny;
      }
      const n = U.norm(mx, my);
      const sp = this.aim > 0 || this.burst > 0 ? this.speedBase * 0.25 : this.speedBase;
      this.vx = U.damp(this.vx, n.x * sp, 6, dt);
      this.vy = U.damp(this.vy, n.y * sp, 6, dt);

      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.fireOne(world, t, 0.13);
          this.burst--;
          this.burstT = 0.09;
        }
        return;
      }
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) this.fire(world, t);
        return;
      }
      this.fireCd -= dt;
      if (this.fireCd <= 0) this.aim = this.aimTime;
    }
    fire(world, t) {
      if (this.gun === 'tommy') {
        this.burst = 6;
        this.burstT = 0;
        this.fireCd = U.rand(2.4, 3.2);
      } else {
        this.fireOne(world, t, 0.05);
        this.fireCd = U.rand(1.3, 2.1);
      }
    }
    fireOne(world, t, spread) {
      const a = U.angleTo(this.x, this.y, t.x + t.vx * 0.12, t.y + t.vy * 0.12) + U.rand(-spread, spread);
      const mx = this.x + Math.cos(a) * 20, my = this.y + Math.sin(a) * 20;
      world.add(new Bullet({ x: mx, y: my, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, team: 'enemy', dmg: this.gun === 'tommy' ? 4 : 6 }));
      world.particles.burst(mx, my, 4, { color: ['#fff2c4', '#ffd27a'], speed: [60, 160], life: [0.05, 0.12], size: [2, 4], angle: a, spread: 0.6 });
      this.kick = 1;
      this.muzzleT = 0.035;
      Audio.play('shot');
    }
    render(ctx, world) {
      if (this.ko) {
        const a = this.koAngle == null ? this.facing + Math.PI : this.koAngle;
        Gfx.figure(ctx, Object.assign({}, greyed(this.look), { x: this.x, y: this.y, angle: a, pose: 'down', alpha: 0.8, ink: 'rgba(48,48,54,0.55)' }));
        const t = world.realTime || 0;
        const hx = this.x + Math.cos(a) * 18.5, hy = this.y + Math.sin(a) * 18.5 - 3;
        ctx.fillStyle = '#f2c418';
        for (let i = 0; i < 3; i++) {
          const b = t * 3 + (i * Math.PI * 2) / 3;
          Gfx.circle(ctx, hx + Math.cos(b) * 9, hy + Math.sin(b) * 3.5, 1.8);
          ctx.fill();
        }
        return;
      }
      Gfx.figure(ctx, Object.assign({}, this.look, {
        x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.speed > 20,
        aim: !!this.target || this.aim > 0, gun: this.gun, flash: this.hitFlash > 0 ? 0.7 : 0, kick: this.kick,
      }));
      if (!world.lit) this.renderEmissive(ctx, world);
    }
    // Light that the night must not swallow: the aim telegraph and muzzle flash.
    // (Drawn after the light layer when world.lit is set; see World.render.)
    renderEmissive(ctx, world) {
      if (this.ko || this.dead) return;
      const f = this.facing, c = Math.cos(f), s = Math.sin(f);
      const tip = (this.gun === 'tommy' ? 29 : 22) - this.kick * 4.2;
      const mx = this.x + c * tip, my = this.y + s * tip;
      const t = this.target;
      const tommy = this.gun === 'tommy';
      if (t && !t.dead && (this.aim > 0 || (tommy && this.burst > 0))) {
        const len = Math.max(20, Math.min(U.dist(mx, my, t.x, t.y) + 20, 420));
        const k = this.aim > 0 ? U.clamp(1 - this.aim / this.aimTime, 0, 1) : 1;
        ctx.save();
        if (tommy) {
          // The spray: a translucent cone the burst will fill.
          const sp = 0.13;
          ctx.fillStyle = `rgba(255,70,50,${0.05 + k * 0.13})`;
          ctx.strokeStyle = `rgba(255,90,70,${0.2 + k * 0.45})`;
          ctx.lineWidth = this.aim > 0 && this.aim < 0.15 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(mx + Math.cos(f - sp) * len, my + Math.sin(f - sp) * len);
          ctx.lineTo(mx + Math.cos(f + sp) * len, my + Math.sin(f + sp) * len);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Two sight lines closing in on the target as the aim settles.
          const sp = 0.25 * (1 - k);
          const late = this.aim < 0.15;
          ctx.strokeStyle = `rgba(255,70,50,${0.25 + k * 0.6})`;
          ctx.lineWidth = late ? 2.4 : 1.2;
          if (!late) ctx.setLineDash([6, 5]);
          for (const side of sp > 0.01 ? [-1, 1] : [0]) {
            const a = f + side * sp;
            Gfx.line(ctx, mx, my, mx + Math.cos(a) * len, my + Math.sin(a) * len);
          }
        }
        ctx.restore();
      }
      if (this.muzzleT > 0) {
        // A one- or two-frame star at the barrel.
        Gfx.glow(ctx, mx, my, 16, '#ffd27a', 0.9);
        ctx.save();
        ctx.strokeStyle = '#fff6d8';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const a = f + (i * Math.PI) / 2 + Math.PI / 4;
          const r = i % 2 ? 5 : 8;
          Gfx.line(ctx, mx, my, mx + Math.cos(a) * r, my + Math.sin(a) * r);
        }
        Gfx.line(ctx, mx, my, mx + c * 12, my + s * 12);
        ctx.restore();
      }
    }
  }

  // ---- machines (Chapter III / V) ---------------------------------------------
  class Machine extends Enemy {
    constructor(o) {
      super(Object.assign({ human: false }, o));
      this.boomR = o.boomR || 50;
      this.boomDmg = o.boomDmg || 8;
    }
    onDeath(kind) {
      if (!this.world) return;
      const w = this.world;
      if (kind === 'disintegrate') return;
      w.defer(() => w.explode(this.x, this.y, this.boomR, this.boomDmg, { team: 'enemy' }));
    }
  }

  class Drone extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 30, r: 13, mass: 0.8, friction: 3, flying: true, needLos: false, colors: ['#6b7a4a', '#2b2f24', '#ffcc66'] }, o));
      this.style = o.style || 'army';
      if (this.style === 'karnak') this.colors = ['#d4ad3a', '#6f4aa6', '#c06bff'];
      this.orbit = U.rand(150, 230);
      this.orbitDir = U.chance(0.5) ? 1 : -1;
      this.speedBase = o.speed || 190;
      this.spin = U.rand(0, 6);
      this.phi = null;
      this.aimTime = 0.35;
    }
    think(dt, world) {
      this.spin += dt * 30;
      const t = this.target;
      if (!t) {
        this.vx = U.damp(this.vx, 0, 2, dt);
        this.vy = U.damp(this.vy, 0, 2, dt);
        return;
      }
      if (this.phi == null) this.phi = U.angleTo(t.x, t.y, this.x, this.y);
      this.phi += this.orbitDir * dt * 0.9;
      this.steer(t.x + Math.cos(this.phi) * this.orbit, t.y + Math.sin(this.phi) * this.orbit, this.speedBase, dt, 3);
      this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, t.x, t.y), 8, dt);
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) {
          const a = this.facing;
          const col = this.style === 'karnak' ? '#c06bff' : '#ffcf5a';
          world.add(new Bullet({ x: this.x + Math.cos(a) * 14, y: this.y + Math.sin(a) * 14, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, team: 'enemy', dmg: 5, color: col, kind: 'pulse', width: 3, r: 4 }));
          Audio.play('pulse');
          this.fireCd = U.rand(1.4, 2.1);
        }
        return;
      }
      this.fireCd -= dt;
      if (this.fireCd <= 0 && world.los(this.x, this.y, t.x, t.y)) this.aim = this.aimTime;
    }
    render(ctx, world) {
      const k = this.style === 'karnak';
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      Gfx.ellipse(ctx, this.x + 10, this.y + 18, 13, 8);
      ctx.fill();
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      ctx.strokeStyle = k ? '#8a6a1a' : '#2b2f24';
      ctx.lineWidth = 3;
      Gfx.line(ctx, -11, -11, 11, 11);
      Gfx.line(ctx, -11, 11, 11, -11);
      for (const [sx, sy] of [[-11, -11], [11, 11], [-11, 11], [11, -11]]) {
        ctx.fillStyle = 'rgba(200,200,200,0.18)';
        Gfx.circle(ctx, sx, sy, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,230,230,0.5)';
        ctx.lineWidth = 1.2;
        Gfx.line(ctx, sx + Math.cos(this.spin) * 6, sy + Math.sin(this.spin) * 6, sx - Math.cos(this.spin) * 6, sy - Math.sin(this.spin) * 6);
      }
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : k ? '#d4ad3a' : '#5d6b4a';
      Gfx.circle(ctx, 0, 0, 9);
      ctx.fill();
      ctx.fillStyle = k ? '#6f4aa6' : '#3a4430';
      Gfx.circle(ctx, 0, 0, 5);
      ctx.fill();
      ctx.restore();
      const eye = k ? '#c06bff' : '#ff5a4a';
      Gfx.glow(ctx, this.x + Math.cos(this.facing) * 7, this.y + Math.sin(this.facing) * 7, this.aim > 0 ? 18 : 9, eye, 0.9);
    }
  }

  class Tank extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 240, r: 28, mass: 8, friction: 4, boomR: 95, boomDmg: 25, colors: ['#5d6b4a', '#3a4430', '#2b2b2b'] }, o));
      this.turret = this.facing;
      this.hullA = this.facing;
      this.speedBase = 55;
      this.range = [240, 430];
      this.fireCd = U.rand(1.8, 3.2);
      this.aimTime = 0.9;
      this.tread = 0;
    }
    think(dt, world) {
      const t = this.target;
      if (!t) return;
      const d = U.dist(this.x, this.y, t.x, t.y);
      const ang = U.angleTo(this.x, this.y, t.x, t.y);
      let dir = 0;
      if (d > this.range[1]) dir = 1;
      else if (d < this.range[0]) dir = -1;
      if (dir) {
        const a = dir > 0 ? ang : ang + Math.PI;
        this.hullA = U.dampAngle(this.hullA, a, 1.5, dt);
        this.vx = U.damp(this.vx, Math.cos(this.hullA) * this.speedBase, 3, dt);
        this.vy = U.damp(this.vy, Math.sin(this.hullA) * this.speedBase, 3, dt);
        this.tread += dt * 30;
      }
      const diff = U.wrapAngle(ang - this.turret);
      this.turret += U.clamp(diff, -1.6 * dt, 1.6 * dt);
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) this.fire(world, t);
        return;
      }
      this.fireCd -= dt;
      if (this.fireCd <= 0 && Math.abs(diff) < 0.3) this.aim = this.aimTime;
    }
    fire(world, t) {
      const mx = this.x + Math.cos(this.turret) * 40, my = this.y + Math.sin(this.turret) * 40;
      const lead = 0.9;
      world.add(new Shell({ x: mx, y: my, tx: t.x + t.vx * lead, ty: t.y + t.vy * lead, T: 1.15, dmg: 18, radius: 70, team: 'enemy' }));
      world.particles.burst(mx, my, 10, { color: ['#fff2c4', '#ffd27a', '#9a948a'], speed: [60, 200], life: [0.1, 0.35], size: [3, 6], angle: this.turret, spread: 0.7 });
      Audio.play('shot');
      world.camera.shake(0.08);
      this.fireCd = U.rand(3, 4);
    }
    render(ctx) {
      const L = this.r * 2.3, W = this.r * 1.7;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-L / 2 + 5, -W / 2 + 6, L, W);
      ctx.rotate(this.hullA);
      ctx.fillStyle = '#222';
      ctx.fillRect(-L / 2, -W / 2, L, 9);
      ctx.fillRect(-L / 2, W / 2 - 9, L, 9);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const x = -L / 2 + ((i * 8 + this.tread) % L);
        Gfx.line(ctx, x, -W / 2, x, -W / 2 + 9);
        Gfx.line(ctx, x, W / 2 - 9, x, W / 2);
      }
      ctx.fillStyle = this.hitFlash > 0 ? '#c8d0b8' : '#5d6b4a';
      ctx.fillRect(-L / 2 + 4, -W / 2 + 7, L - 8, W - 14);
      ctx.restore();
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.turret);
      ctx.fillStyle = '#3a4430';
      ctx.fillRect(4, -3.5, 36, 7);
      ctx.fillStyle = this.hitFlash > 0 ? '#d8e0c8' : '#6d7b56';
      Gfx.circle(ctx, 0, 0, 14);
      ctx.fill();
      ctx.fillStyle = '#e8d27a';
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
      if (this.aim > 0) Gfx.glow(ctx, this.x + Math.cos(this.turret) * 40, this.y + Math.sin(this.turret) * 40, 18 + (1 - this.aim / this.aimTime) * 14, '#ff9a3c', 0.9);
    }
  }

  class Battery extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 150, r: 26, mass: 30, static: true, boomR: 90, boomDmg: 20, colors: ['#5d6b4a', '#3a4430', '#c4302b'] }, o));
      this.fireCd = U.rand(2, 4);
      this.pod = 0;
      this.aimA = 0;
      this.sight = 900;
      this.needLos = false;
    }
    think(dt, world) {
      const t = this.target;
      if (!t) return;
      this.aimA = U.dampAngle(this.aimA, U.angleTo(this.x, this.y, t.x, t.y), 2, dt);
      this.fireCd -= dt;
      if (this.fireCd <= 0) {
        this.fireCd = U.rand(4, 5.5);
        const off = (this.pod++ % 2 ? 1 : -1) * 10;
        const px = this.x + Math.cos(this.aimA) * 24 - Math.sin(this.aimA) * off;
        const py = this.y + Math.sin(this.aimA) * 24 + Math.cos(this.aimA) * off;
        world.add(new Missile({ x: px, y: py, angle: this.aimA, speed: 240 }));
        Audio.play('whoosh');
      }
    }
    render(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(this.x - 24 + 5, this.y - 24 + 6, 48, 48);
      ctx.fillStyle = this.hitFlash > 0 ? '#c8d0b8' : '#4d5a3a';
      ctx.fillRect(this.x - 24, this.y - 24, 48, 48);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.aimA);
      ctx.fillStyle = '#6d7b56';
      ctx.fillRect(-14, -16, 36, 32);
      ctx.fillStyle = '#222';
      for (const oy of [-9, 9]) {
        Gfx.circle(ctx, 20, oy, 5);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Chapter III boss: an experimental super-heavy tank.
  class Behemoth extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 1300, r: 60, mass: 80, friction: 5, boomR: 160, boomDmg: 30, sight: 1400, needLos: false, grabbable: false, colors: ['#4d5a3a', '#2b2b2b', '#c4302b', '#e8d27a'] }, o));
      this.name = 'M-1 "BEHEMOTH"';
      this.turret = this.facing;
      this.hullA = this.facing;
      this.speedBase = 34;
      this.cycle = 0;
      this.actT = 2.5;
      this.mgT = 0;
      this.mgShots = 0;
      this.tread = 0;
    }
    think(dt, world) {
      const t = this.target;
      if (!t) return;
      const phase = this.hp < this.maxHp * 0.33 ? 3 : this.hp < this.maxHp * 0.66 ? 2 : 1;
      const ang = U.angleTo(this.x, this.y, t.x, t.y);
      const d = U.dist(this.x, this.y, t.x, t.y);
      if (d > 300) {
        this.hullA = U.dampAngle(this.hullA, ang, 0.8, dt);
        this.vx = U.damp(this.vx, Math.cos(this.hullA) * this.speedBase * (1 + phase * 0.15), 2, dt);
        this.vy = U.damp(this.vy, Math.sin(this.hullA) * this.speedBase * (1 + phase * 0.15), 2, dt);
        this.tread += dt * 20;
      }
      this.turret = U.dampAngle(this.turret, ang, 1.6, dt);
      if (this.mgShots > 0) {
        this.mgT -= dt;
        if (this.mgT <= 0) {
          this.mgShots--;
          this.mgT = 0.07;
          const a = this.turret + U.rand(-0.15, 0.15);
          const sx = this.x + Math.cos(this.turret + 0.6) * 44, sy = this.y + Math.sin(this.turret + 0.6) * 44;
          world.add(new Bullet({ x: sx, y: sy, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, team: 'enemy', dmg: 4 }));
          Audio.play('shot');
        }
      }
      this.actT -= dt;
      if (this.actT > 0) return;
      const act = this.cycle++ % 3;
      if (act === 0) {
        for (let i = -1; i <= 1; i++) {
          const ox = Math.cos(ang + Math.PI / 2) * i * 90, oy = Math.sin(ang + Math.PI / 2) * i * 90;
          world.add(new Shell({ x: this.x + Math.cos(this.turret) * 70, y: this.y + Math.sin(this.turret) * 70, tx: t.x + ox + t.vx * 0.6, ty: t.y + oy + t.vy * 0.6, T: 1.3, dmg: 20, radius: 75 }));
        }
        Audio.play('explosion');
        world.camera.shake(0.2);
      } else if (act === 1) {
        for (const side of [-1, 1]) world.add(new Missile({ x: this.x + Math.cos(this.hullA + side * 1.6) * 50, y: this.y + Math.sin(this.hullA + side * 1.6) * 50, angle: this.hullA + side * 1.2, speed: 230 }));
        if (phase >= 2) world.add(new Missile({ x: this.x - Math.cos(this.hullA) * 60, y: this.y - Math.sin(this.hullA) * 60, angle: this.hullA + Math.PI, speed: 230 }));
        Audio.play('whoosh');
      } else {
        this.mgShots = 10 + phase * 4;
      }
      this.actT = Math.max(1.4, 3.2 - phase * 0.5);
    }
    render(ctx) {
      const L = this.r * 2.4, W = this.r * 1.8;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-L / 2 + 8, -W / 2 + 10, L, W);
      ctx.rotate(this.hullA);
      ctx.fillStyle = '#1d1d1d';
      ctx.fillRect(-L / 2, -W / 2, L, 18);
      ctx.fillRect(-L / 2, W / 2 - 18, L, 18);
      ctx.strokeStyle = '#3a3a3a';
      for (let i = 0; i < 14; i++) {
        const x = -L / 2 + ((i * 11 + this.tread) % L);
        Gfx.line(ctx, x, -W / 2, x, -W / 2 + 18);
        Gfx.line(ctx, x, W / 2 - 18, x, W / 2);
      }
      ctx.fillStyle = this.hitFlash > 0 ? '#c8d0b8' : '#4d5a3a';
      ctx.fillRect(-L / 2 + 6, -W / 2 + 14, L - 12, W - 28);
      ctx.fillStyle = '#3a4430';
      for (const s of [-1, 1]) ctx.fillRect(-20, s * (W / 2 - 34) - 10, 40, 20);
      ctx.fillStyle = '#c4302b';
      ctx.fillRect(-L / 2 + 10, -4, 18, 8);
      ctx.restore();
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.turret);
      ctx.fillStyle = '#2b3322';
      ctx.fillRect(10, -12, 72, 8);
      ctx.fillRect(10, 4, 72, 8);
      ctx.fillStyle = this.hitFlash > 0 ? '#d8e0c8' : '#5d6b4a';
      Gfx.circle(ctx, 0, 0, 30);
      ctx.fill();
      ctx.strokeStyle = '#2b3322';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#e8d27a';
      ctx.font = Gfx.font(11, DM.FONTS.display, 700);
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 4);
      ctx.restore();
    }
  }

  // ---- Karnak defences ----------------------------------------------------------
  class Turret extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 90, r: 18, mass: 30, static: true, grabbable: false, boomR: 60, boomDmg: 10, colors: ['#d4ad3a', '#6f4aa6', '#2a2440'] }, o));
      this.aimA = 0;
      this.aimTime = 0.5;
      this.burst = 0;
      this.sight = 560;
    }
    think(dt, world) {
      const t = this.target;
      if (!t) return;
      this.aimA = U.dampAngle(this.aimA, U.angleTo(this.x, this.y, t.x, t.y), 4, dt);
      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burst--;
          this.burstT = 0.12;
          const a = this.aimA + U.rand(-0.06, 0.06);
          world.add(new Bullet({ x: this.x + Math.cos(a) * 22, y: this.y + Math.sin(a) * 22, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, team: 'enemy', dmg: 5, color: '#c06bff', kind: 'pulse', width: 3 }));
          Audio.play('pulse');
        }
        return;
      }
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) {
          this.burst = 3;
          this.burstT = 0;
          this.fireCd = U.rand(1.8, 2.6);
        }
        return;
      }
      this.fireCd -= dt;
      if (this.fireCd <= 0) this.aim = this.aimTime;
    }
    render(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      Gfx.circle(ctx, this.x + 4, this.y + 5, 20);
      ctx.fill();
      ctx.fillStyle = '#2a2440';
      Gfx.circle(ctx, this.x, this.y, 20);
      ctx.fill();
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.aimA);
      ctx.fillStyle = '#8a6a1a';
      ctx.fillRect(6, -3, 22, 6);
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#d4ad3a';
      Gfx.circle(ctx, 0, 0, 12);
      ctx.fill();
      ctx.restore();
      Gfx.glow(ctx, this.x, this.y, this.aim > 0 ? 22 : 10, '#c06bff', 0.8);
    }
  }

  // Tachyon emitter: jams Temporal Sight, shielded against anything from outside.
  class Emitter extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 140, r: 22, mass: 99, static: true, grabbable: false, boomR: 70, boomDmg: 10, colors: ['#d4ad3a', '#6f4aa6', '#c06bff', '#ffffff'] }, o));
      this.shieldR = 125;
      this.jamR = 330;
      this.inside = new Set();
      this.flash = 0;
      this.arcs = [];
    }
    update(dt, world) {
      this.flash = Math.max(0, this.flash - dt);
      const p = world.player;
      if (p && U.dist(this.x, this.y, p.x, p.y) < this.jamR) p.jamT = Math.max(p.jamT, 0.2);
      for (const e of world.entities) {
        if (e.dead || e === this || e.static) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        const inside = this.inside.has(e.id);
        if (d < this.shieldR) {
          if (inside) continue;
          if (e.isPlayer && (world.realTime || 0) - (e.teleportedAt == null ? -9 : e.teleportedAt) < 0.2) {
            this.inside.add(e.id);
            continue;
          }
          if (e.isProjectile) {
            if (e.boom) e.boom(world);
            else e.die('blocked');
            this.onShieldBlock(world);
            continue;
          }
          const n = U.norm(e.x - this.x, e.y - this.y);
          const nx = n.l ? n.x : 1, ny = n.l ? n.y : 0;
          e.x = this.x + nx * (this.shieldR + 1);
          e.y = this.y + ny * (this.shieldR + 1);
          const vn = e.vx * nx + e.vy * ny;
          if (vn < 0) {
            e.vx -= 1.6 * vn * nx;
            e.vy -= 1.6 * vn * ny;
            if (vn < -120) this.onShieldBlock(world);
          }
        } else if (inside && d > this.shieldR + e.r) this.inside.delete(e.id);
      }
      if (Math.random() < dt * 8) this.arcs.push({ a: U.rand(0, Math.PI * 2), t: 0.12 });
      for (const a of this.arcs) a.t -= dt;
      this.arcs = this.arcs.filter((a) => a.t > 0);
    }
    onShieldBlock(world) {
      this.flash = 0.4;
      Audio.play('shield');
      DM.Events.emit('shield:block', this);
    }
    onDeath(kind) {
      super.onDeath('explosion');
      Audio.play('zap');
      if (this.world) this.world.particles.burst(this.x, this.y, 50, { color: this.colors, speed: [80, 360], life: [0.3, 1], size: [2, 4], shape: 'spark' });
      DM.Events.emit('emitter:down', this);
    }
    render(ctx, world) {
      const t = world.realTime || 0;
      ctx.save();
      ctx.strokeStyle = 'rgba(111,74,166,0.3)';
      ctx.setLineDash([2, 10]);
      ctx.lineDashOffset = t * 15;
      ctx.lineWidth = 2;
      Gfx.circle(ctx, this.x, this.y, this.jamR);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      Gfx.circle(ctx, this.x + 4, this.y + 6, 26);
      ctx.fill();
      ctx.fillStyle = '#2a2440';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(this.x + Math.cos(a) * 28, this.y + Math.sin(a) * 28);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#d4ad3a';
      Gfx.circle(ctx, this.x, this.y, 15);
      ctx.fill();
      Gfx.glow(ctx, this.x, this.y, 26 + Math.sin(t * 6) * 4, '#c06bff', 0.9);
      ctx.save();
      ctx.strokeStyle = 'rgba(140,70,220,0.85)';
      ctx.lineWidth = 1.5;
      for (const a of this.arcs) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        let px = this.x, py = this.y;
        for (let i = 1; i <= 5; i++) {
          const r = (this.shieldR * i) / 5;
          px = this.x + Math.cos(a.a + U.rand(-0.15, 0.15)) * r;
          py = this.y + Math.sin(a.a + U.rand(-0.15, 0.15)) * r;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
      // Drawn without additive blending so the shield still reads against snow.
      ctx.save();
      ctx.strokeStyle = `rgba(111,74,166,${Math.min(1, 0.55 + this.flash)})`;
      ctx.lineWidth = 3 + this.flash * 6;
      ctx.setLineDash([12, 6]);
      ctx.lineDashOffset = -t * 30;
      Gfx.circle(ctx, this.x, this.y, this.shieldR);
      ctx.stroke();
      ctx.fillStyle = `rgba(111,74,166,${0.08 + this.flash * 0.2})`;
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- Adrian Veidt -------------------------------------------------------------
  const VEIDT_DODGE = ['Too slow, Jon.', 'I have studied you.', 'Predictable.', 'You telegraph everything.'];
  const VEIDT_FREE = ['Not like that.', 'I caught a bullet once, Jon.', 'Unhand me.'];

  class Veidt extends Enemy {
    constructor(o = {}) {
      super(Object.assign({ hp: 900, r: 13, mass: 1.6, friction: 8, human: true, needLos: false, colors: ['#6f4aa6', '#d4ad3a', '#f0d0b2'] }, o));
      this.look = DM.LOOKS.veidt;
      this.name = 'ADRIAN VEIDT';
      this.state = 'strafe';
      this.stateT = 3;
      this.discCd = 2.5;
      this.dodgeCd = 0;
      this.strikeCd = 0;
      this.heldT = 0;
      this.summonT = 8;
      this.orbitR = 240;
      this.orbitDir = 1;
      this.phi = null;
      this.speedBase = 230;
      this.yielded = false;
      this.dashT = 0;
      this.dashTarget = null;
    }
    disintegrate(world, source) {
      this.damage(70, source, 'disintegrate');
    }
    damage(amount, source, kind) {
      if (this.yielded || this.dead) return false;
      if (kind === 'impact') amount *= 1.7;
      if (kind === 'bolt') amount *= 0.6;
      this.hp -= amount;
      this.hitFlash = 0.15;
      if (this.hp <= 1) this.yieldNow();
      return true;
    }
    die() {
      this.yieldNow();
    }
    onImpact(speed, other, world) {
      const dmg = (speed - 200) * 0.12 * (other ? U.clamp(other.mass, 0.6, 6) : 1.4);
      if (dmg <= 1) return;
      this.damage(dmg, other, 'impact');
      this.stun = Math.max(this.stun, 1.1);
      world.particles.burst(this.x, this.y, 10, { color: ['#d4ad3a', '#ffffff'], speed: [60, 200], life: [0.2, 0.5], size: [2, 3.5] });
      Audio.play('impact');
      world.camera.shake(0.25);
    }
    yieldNow() {
      if (this.yielded) return;
      this.yielded = true;
      this.hp = 0;
      this.grabbable = false;
      this.disintegratable = false;
      this.heldBy = null;
      this.vx = this.vy = 0;
      Events.emit('veidt:yield', this);
    }
    onHeld(dt, world) {
      this.heldT += dt;
      const limit = this.heldBy && this.heldBy.scale > 1.3 ? 3 : 1.5;
      if (this.heldT > limit) {
        const p = this.heldBy;
        this.heldBy = null;
        this.heldT = 0;
        this.stun = 0;
        this.thrown = 0;
        world.bark(this, U.pick(VEIDT_FREE), 1.6);
        const n = U.norm(this.x - p.x, this.y - p.y);
        this.dash(this.x + n.x * 200, this.y + n.y * 200);
      }
    }
    dash(x, y) {
      this.state = 'dash';
      this.dashT = 0.35;
      this.dashTarget = { x: U.clamp(x, 60, this.world.w - 60), y: U.clamp(y, 60, this.world.h - 60) };
    }
    onDisintegrateCast(c, world) {
      if (this.yielded || this.heldBy || this.stun > 0 || this.dodgeCd > 0 || this.state === 'melee') return;
      if (U.dist(this.x, this.y, c.x, c.y) > c.r + 70) return;
      const chance = world.timesight ? 0.2 : 0.85;
      if (Math.random() > chance) return;
      let n = U.norm(this.x - c.x, this.y - c.y);
      if (!n.l) n = { x: 1, y: 0 };
      const side = U.chance(0.5) ? 1 : -1;
      this.dash(this.x + (n.x - n.y * side) * 150, this.y + (n.y + n.x * side) * 150);
      this.dodgeCd = 0.6;
      world.bark(this, U.pick(VEIDT_DODGE), 1.3);
    }
    update(dt, world) {
      if (this.yielded) {
        this.vx = U.damp(this.vx, 0, 8, dt);
        this.vy = U.damp(this.vy, 0, 8, dt);
        return;
      }
      if (!this.heldBy) this.heldT = 0;
      super.update(dt, world);
    }
    think(dt, world) {
      const p = world.player;
      if (!p) return;
      this.walk += dt * this.speed * 0.09;
      this.dodgeCd -= dt;
      this.discCd -= dt;
      this.strikeCd -= dt;
      this.summonT -= dt;
      const phase = this.hp < this.maxHp * 0.5 ? 2 : 1;

      if (this.state === 'dash') {
        this.dashT -= dt;
        this.steer(this.dashTarget.x, this.dashTarget.y, 760, dt, 14);
        if (Math.random() < dt * 60) world.particles.emit(this.x, this.y, { life: 0.3, size: 10, size1: 4, color: '#6f4aa6', add: false, shape: 'smoke', alpha: 0.35, drag: 0 });
        if (this.dashT <= 0 || U.dist(this.x, this.y, this.dashTarget.x, this.dashTarget.y) < 12) this.state = 'strafe';
        return;
      }

      let dup = null, dd = 110;
      for (const e of world.entities) {
        if (!e.isDuplicate || e.dead) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < dd) {
          dd = d;
          dup = e;
        }
      }
      if (dup) {
        this.state = 'melee';
        this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, dup.x, dup.y), 14, dt);
        if (dd > this.r + dup.r + 4) this.steer(dup.x, dup.y, 300, dt, 10);
        else if (this.strikeCd <= 0) {
          this.strikeCd = 0.45;
          dup.damage(30, this, 'strike');
          world.particles.burst(dup.x, dup.y, 8, { color: ['#ffffff', '#7fe3ff'], speed: [80, 200], life: [0.1, 0.3], size: [2, 3], shape: 'spark' });
          Audio.play('impact');
        }
        return;
      }
      if (this.state === 'melee') this.state = 'strafe';

      if (this.phi == null) this.phi = U.angleTo(p.x, p.y, this.x, this.y);
      this.phi += this.orbitDir * dt * (0.7 + phase * 0.3);
      const sp = this.speedBase * (phase === 2 ? 1.2 : 1);
      this.steer(p.x + Math.cos(this.phi) * this.orbitR, p.y + Math.sin(this.phi) * this.orbitR, sp, dt, 5);
      this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, p.x, p.y), 10, dt);

      if (this.discCd <= 0) {
        this.discCd = phase === 2 ? 1.6 : 2.4;
        world.add(new TachyonDisc({ x: this.x, y: this.y, tx: p.x + p.vx * 0.4, ty: p.y + p.vy * 0.4 }));
        Audio.play('whoosh');
      }
      if (phase === 2 && this.summonT <= 0) {
        this.summonT = 14;
        const drones = world.entities.filter((e) => e instanceof Drone && !e.dead).length;
        if (drones < 4) {
          for (const s of [-1, 1]) world.add(new Drone({ x: U.clamp(this.x + s * 300, 80, world.w - 80), y: U.clamp(this.y - 200, 80, world.h - 80), style: 'karnak', alerted: true }));
          world.bark(this, 'You are not the only one with help.', 2);
        }
      }
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.stateT = U.rand(2.2, 4);
        if (U.chance(0.4)) this.orbitDir *= -1;
        this.orbitR = U.rand(200, 300);
      }
    }
    render(ctx, world) {
      if (this.yielded) {
        Gfx.figure(ctx, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing, scale: 0.9 }));
        return;
      }
      Gfx.figure(ctx, Object.assign({}, this.look, {
        x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.speed > 20,
        carry: this.state === 'melee', flash: this.hitFlash > 0 ? 0.7 : 0,
      }));
    }
    renderFuture(ctx) {
      if (this.state === 'dash' && this.dashTarget) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        Gfx.figure(ctx, Object.assign({}, this.look, { x: this.dashTarget.x, y: this.dashTarget.y, angle: this.facing, noShadow: true }));
        ctx.restore();
      }
      if (this.phi != null && this.world.player) {
        const p = this.world.player;
        const fa = this.phi + this.orbitDir * 1.2;
        ctx.save();
        ctx.strokeStyle = 'rgba(242,196,24,0.45)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.orbitR, this.phi, fa, this.orbitDir < 0);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  DM.Enemies = { Enemy, Gangster, Machine, Drone, Tank, Battery, Behemoth, Turret, Emitter, Veidt };
})();
