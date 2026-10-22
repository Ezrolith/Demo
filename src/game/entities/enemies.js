/*
 * Enemies. All share the Enemy base: targeting, stun/held handling, and the
 * lethal/non-lethal split (humans knocked out by impacts are "spared";
 * disintegrated ones are not — the game tracks both).
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
    die(kind, source) {
      if (this.human && kind === 'impact') {
        this.ko = true;
        this.body = false;
        this.layer = 0;
        this.grabbable = false;
        this.disintegratable = false;
        this.hp = 0;
        this.aim = 0;
        Events.emit('enemy:down', { enemy: this, lethal: false, kind, human: true });
        return;
      }
      if (this.dead) return;
      super.die(kind, source);
      Events.emit('enemy:down', { enemy: this, lethal: true, kind, human: this.human });
    }
    get neutralized() {
      return this.dead || this.ko;
    }
  }

  // ---- 1960s mob ------------------------------------------------------------
  const ALERT_BARKS = ["It's the blue guy!", 'Holy— it\'s him!', 'Shoot him! Shoot!', 'Nobody said nothin\' about HIM!', 'Light him up!'];
  const HELD_BARKS = ['Put me down!', 'Whoa— WHOA!', 'Mama!', 'This ain\'t natural!'];

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
      if (this.gun === 'tommy') {
        this.hp = this.maxHp = 60;
        this.mass = 1.5;
      }
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
      Audio.play('shot');
    }
    render(ctx, world) {
      if (this.ko) {
        Gfx.figure(ctx, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing + 1.2, alpha: 0.85 }));
        const t = world.realTime || 0;
        ctx.fillStyle = '#f2c418';
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + (i * Math.PI * 2) / 3;
          Gfx.circle(ctx, this.x + Math.cos(a) * 10, this.y - 4 + Math.sin(a) * 4, 1.8);
          ctx.fill();
        }
        return;
      }
      if (this.aim > 0 && this.target) {
        const k = 1 - this.aim / this.aimTime;
        ctx.save();
        ctx.strokeStyle = `rgba(255,70,50,${0.15 + k * 0.5})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        Gfx.line(ctx, this.x, this.y, this.x + Math.cos(this.facing) * 160, this.y + Math.sin(this.facing) * 160);
        ctx.restore();
      }
      Gfx.figure(ctx, Object.assign({}, this.look, {
        x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.speed > 20,
        aim: !!this.target || this.aim > 0, gun: this.gun, flash: this.hitFlash > 0 ? 0.7 : 0,
      }));
    }
  }

  // ---- machines (Chapter III / V) ---------------------------------------------
  // Every attack is announced before it lands. Telegraphs (aim lines, pod lights,
  // muzzle glows) are drawn in renderEmissive(ctx, world): World.render calls it
  // after the light layer while world.lit is set, and render() calls it directly
  // on unlit maps.
  const POWER_DOWN_T = 0.55; // seconds of sparks and flicker before a machine goes dark

  function onScreen(world, x, y, m = 0) {
    const v = world.camera.view();
    return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
  }
  // A shake, plus a directional camera nudge where the camera supports it.
  function kick(world, nx, ny, px, shake) {
    const cam = world.camera;
    cam.shake(shake);
    if (cam.kick) cam.kick(nx, ny, px);
  }
  // Four-point muzzle star (drawn additively).
  function star(ctx, x, y, a, len, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(len * 0.18, len * 0.16);
    ctx.lineTo(0, len * 0.45);
    ctx.lineTo(-len * 0.18, len * 0.16);
    ctx.lineTo(-len * 0.35, 0);
    ctx.lineTo(-len * 0.18, -len * 0.16);
    ctx.lineTo(0, -len * 0.45);
    ctx.lineTo(len * 0.18, -len * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  class Machine extends Enemy {
    constructor(o) {
      super(Object.assign({ human: false }, o));
      this.boomR = o.boomR || 50;
      this.boomDmg = o.boomDmg || 8;
      this.downT = 0;
    }
    get active() {
      return !this.dead && !this.ko && !(this.downT > 0);
    }
    update(dt, world) {
      if (this.downT > 0) {
        this.downT -= dt;
        this.aim = 0;
        this.burst = 0;
        this.vx = U.damp(this.vx, 0, 5, dt);
        this.vy = U.damp(this.vy, 0, 5, dt);
        if (Math.random() < dt * 26) world.particles.burst(this.x + U.rand(-this.r, this.r), this.y + U.rand(-this.r, this.r), 3, { color: ['#fff2c4', '#bff1ff', '#ffd27a'], speed: [40, 160], life: [0.1, 0.3], size: [1, 2.5], shape: 'spark' });
        if (this.downT <= 0) {
          this.dead = true;
          world.particles.burst(this.x, this.y, 10, { color: ['#3a3a30', '#2a2522'], speed: [10, 60], life: [0.6, 1.2], size: [6, 12], size1: 18, shape: 'smoke', add: false, alpha: 0.6 });
        }
        return;
      }
      super.update(dt, world);
    }
    // Its power source is gone: it sparks, flickers and goes dark. Not a kill
    // (no 'enemy:down'), and no explosion.
    powerDown(world) {
      if (this.dead || this.downT > 0) return;
      this.downT = POWER_DOWN_T;
      this.aim = 0;
      this.burst = 0;
      this.target = null;
      this.grabbable = false;
      this.disintegratable = false;
      world.particles.burst(this.x, this.y, 14, { color: ['#ffffff', '#bff1ff', '#ffd27a'], speed: [60, 220], life: [0.15, 0.4], size: [1, 2.5], shape: 'spark' });
      Audio.play('fizzle');
    }
    onDeath(kind) {
      if (!this.world) return;
      const w = this.world;
      if (kind === 'disintegrate') return;
      w.defer(() => w.explode(this.x, this.y, this.boomR, this.boomDmg, { team: 'enemy' }));
    }
    render(ctx, world) {
      if (this.downT > 0) {
        // Flicker out: no telegraphs while powering down.
        ctx.save();
        ctx.globalAlpha *= Math.sin((world.realTime || 0) * 70) > 0 ? 0.9 : 0.35;
        this.draw(ctx, world);
        ctx.restore();
        return;
      }
      this.draw(ctx, world);
      if (!world.lit) this.renderEmissive(ctx, world);
    }
    draw() {}
    renderEmissive(ctx, world) {
      if (this.dead || this.downT > 0 || !this.emissive) return;
      this.emissive(ctx, world);
    }
  }

  // Thin red line from a machine to what it is about to shoot. k: 0..1 wind-up.
  function aimLine(ctx, x, y, tx, ty, k, color = '255,70,50') {
    ctx.save();
    ctx.strokeStyle = `rgba(${color},${0.18 + k * 0.55})`;
    ctx.lineWidth = 1 + k;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -k * 20;
    Gfx.line(ctx, x, y, tx, ty);
    ctx.restore();
  }

  const DRONE = { aimTime: 0.5, cooldown: [1.4, 2.1], speed: 430, dmg: 5 };

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
      this.aimTime = DRONE.aimTime;
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
          world.add(new Bullet({ x: this.x + Math.cos(a) * 14, y: this.y + Math.sin(a) * 14, vx: Math.cos(a) * DRONE.speed, vy: Math.sin(a) * DRONE.speed, team: 'enemy', dmg: DRONE.dmg, color: col, kind: 'pulse', width: 3, r: 4 }));
          Audio.play('pulse');
          this.fireCd = U.rand(DRONE.cooldown[0], DRONE.cooldown[1]);
        }
        return;
      }
      this.fireCd -= dt;
      if (this.fireCd <= 0 && world.los(this.x, this.y, t.x, t.y)) {
        this.aim = this.aimTime;
        Audio.play('charge');
      }
    }
    draw(ctx) {
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
    }
    emissive(ctx) {
      const eye = this.style === 'karnak' ? '#c06bff' : '#ff5a4a';
      const ex = this.x + Math.cos(this.facing) * 7, ey = this.y + Math.sin(this.facing) * 7;
      if (this.aim > 0 && this.target) {
        const k = 1 - this.aim / this.aimTime;
        aimLine(ctx, ex, ey, this.target.x, this.target.y, k, this.style === 'karnak' ? '200,110,255' : '255,70,50');
        Gfx.glow(ctx, ex, ey, 10 + k * 12, eye, 0.95);
      } else Gfx.glow(ctx, ex, ey, 9, eye, 0.9);
    }
  }

  const TANK = { aimTime: 0.9, cooldown: [3, 4], recoilDecay: 10, flashT: 0.09, shake: 0.15 };

  class Tank extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 240, r: 28, mass: 8, friction: 4, boomR: 95, boomDmg: 25, colors: ['#5d6b4a', '#3a4430', '#2b2b2b'] }, o));
      this.turret = this.facing;
      this.hullA = this.facing;
      this.speedBase = 55;
      this.range = [240, 430];
      this.fireCd = U.rand(1.8, 3.2);
      this.aimTime = TANK.aimTime;
      this.tread = 0;
      this.recoil = 0;
      this.flashT = 0;
    }
    update(dt, world) {
      this.recoil = Math.max(0, this.recoil - dt * TANK.recoilDecay);
      this.flashT = Math.max(0, this.flashT - dt);
      super.update(dt, world);
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
      world.particles.burst(mx, my, 6, { color: ['#4a4640', '#6a645a'], speed: [20, 80], life: [0.5, 1], size: [6, 10], size1: 16, shape: 'smoke', add: false, alpha: 0.5, angle: this.turret, spread: 0.5 });
      Audio.play('cannon');
      if (onScreen(world, this.x, this.y)) world.camera.shake(TANK.shake);
      this.recoil = 1;
      this.flashT = TANK.flashT;
      this.fireCd = U.rand(TANK.cooldown[0], TANK.cooldown[1]);
    }
    draw(ctx) {
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
      // The barrel slides back into the turret when it fires.
      ctx.fillStyle = '#3a4430';
      ctx.fillRect(4 - this.recoil * 9, -3.5, 36, 7);
      ctx.fillStyle = this.hitFlash > 0 ? '#d8e0c8' : '#6d7b56';
      Gfx.circle(ctx, 0, 0, 14);
      ctx.fill();
      ctx.fillStyle = '#e8d27a';
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    emissive(ctx) {
      const mx = this.x + Math.cos(this.turret) * 40, my = this.y + Math.sin(this.turret) * 40;
      if (this.aim > 0) Gfx.glow(ctx, mx, my, 18 + (1 - this.aim / this.aimTime) * 14, '#ff9a3c', 0.9);
      if (this.flashT > 0) {
        const k = this.flashT / TANK.flashT;
        star(ctx, mx + Math.cos(this.turret) * 6, my + Math.sin(this.turret) * 6, this.turret, 34, '#fff2c4', k);
        Gfx.glow(ctx, mx, my, 40 * k + 10, '#ffd27a', k);
      }
    }
  }

  // Missile battery: blinks its pod lights for 0.8 s before every launch.
  const BATTERY = { aimTime: 0.8, aimRange: 760, cooldown: [4, 5.5], speed: 240 };

  class Battery extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: 150, r: 26, mass: 30, static: true, boomR: 90, boomDmg: 20, colors: ['#5d6b4a', '#3a4430', '#c4302b'] }, o));
      this.fireCd = U.rand(2, 4);
      this.aimTime = BATTERY.aimTime;
      this.pod = 0;
      this.aimA = 0;
      this.sight = 900;
      this.needLos = false;
    }
    podPos(i) {
      const off = (i % 2 ? 1 : -1) * 10;
      return { x: this.x + Math.cos(this.aimA) * 24 - Math.sin(this.aimA) * off, y: this.y + Math.sin(this.aimA) * 24 + Math.cos(this.aimA) * off };
    }
    think(dt, world) {
      const t = this.target;
      if (!t) return;
      this.aimA = U.dampAngle(this.aimA, U.angleTo(this.x, this.y, t.x, t.y), 2, dt);
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) this.launch(world);
        return;
      }
      this.fireCd -= dt;
      if (this.fireCd > 0) return;
      // Only lines up a launch on something it can see, or something close.
      if (U.dist(this.x, this.y, t.x, t.y) < BATTERY.aimRange || world.los(this.x, this.y, t.x, t.y)) {
        this.aim = this.aimTime;
        Audio.play('pod_alarm');
      }
    }
    launch(world) {
      this.fireCd = U.rand(BATTERY.cooldown[0], BATTERY.cooldown[1]);
      const p = this.podPos(this.pod++);
      world.add(new Missile({ x: p.x, y: p.y, angle: this.aimA, speed: BATTERY.speed }));
      world.particles.burst(p.x, p.y, 8, { color: ['#fff2c4', '#ffd27a', '#9a948a'], speed: [40, 140], life: [0.1, 0.3], size: [2, 4], angle: this.aimA + Math.PI, spread: 0.8 });
      Audio.play('whoosh');
    }
    draw(ctx) {
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
    emissive(ctx, world) {
      const t = world.realTime || 0;
      for (let i = 0; i < 2; i++) {
        const p = this.podPos(i);
        const next = this.pod % 2 === i;
        if (this.aim > 0) {
          // Blinks faster as the launch nears; the pod that will fire burns brighter.
          const k = 1 - this.aim / this.aimTime;
          const on = Math.sin(t * (14 + k * 26)) > -0.2;
          if (on) Gfx.glow(ctx, p.x, p.y, (next ? 16 : 10) + k * 8, '#ff3a2a', next ? 1 : 0.6);
          ctx.fillStyle = on ? '#ff6a4a' : '#5a1a14';
          Gfx.circle(ctx, p.x, p.y, 3);
          ctx.fill();
        } else {
          ctx.fillStyle = '#7a2a1e';
          Gfx.circle(ctx, p.x, p.y, 2.5);
          ctx.fill();
        }
      }
    }
  }

  // Chapter III boss: an experimental super-heavy tank. Armoured everywhere but
  // the engine at its rear; its own missiles, thrown back, hurt it badly.
  const BEHEMOTH = {
    hp: 1500,
    hullMul: 0.4, // disintegrate on the armour
    rearMul: 1.5, // disintegrate with Jon behind it
    ventMul: 2, // ...once the rear vent is exposed (phase 3)
    rearArc: Math.PI / 3, // "behind" = within 60 degrees of straight back
    missileMul: 2.7, // blasts from its own missiles, thrown back (about 150-170)
    phases: [0.66, 0.33],
    turn: 0.5, // rad/s: it is slow to turn round
    mgSpin: 0.6,
    hatchT: 0.5,
    mines: 4,
    escorts: 2,
  };
  const BEHEMOTH_BARKS = { 2: 'Hull breach! Mines out, call the escort!', 3: 'Coolant failure! The vent is open!' };

  class Behemoth extends Machine {
    constructor(o = {}) {
      super(Object.assign({ hp: BEHEMOTH.hp, r: 60, mass: 80, friction: 5, boomR: 160, boomDmg: 30, sight: 1400, needLos: false, grabbable: false, colors: ['#4d5a3a', '#2b2b2b', '#c4302b', '#e8d27a'] }, o));
      this.name = 'M-1 "BEHEMOTH"';
      this.turret = this.facing;
      this.hullA = this.facing;
      this.speedBase = 34;
      this.cycle = 0;
      this.actT = 2.5;
      this.mgT = 0;
      this.mgShots = 0;
      this.tread = 0;
      this.phase = 1;
      this.phaseMarks = BEHEMOTH.phases;
      this.windup = null; // 'mg' | 'missiles' while aim > 0
      this.aimTime = 1;
      this.spawned = []; // its mines and escorts, stood down when it dies
      this.ventT = 0;
    }
    // Is Jon within the rear arc?
    rearExposed() {
      const p = this.world && this.world.player;
      if (!p) return false;
      const a = U.angleTo(this.x, this.y, p.x, p.y);
      return Math.abs(U.wrapAngle(a - (this.hullA + Math.PI))) <= BEHEMOTH.rearArc;
    }
    armourMul(source, kind) {
      if (kind === 'disintegrate') return this.rearExposed() ? (this.phase >= 3 ? BEHEMOTH.ventMul : BEHEMOTH.rearMul) : BEHEMOTH.hullMul;
      if (source instanceof Missile) {
        if (kind === 'explosion' && source.team === 'player') return BEHEMOTH.missileMul;
        if (kind === 'impact') return 0; // a thrown missile counts once, by its blast
      }
      return 1;
    }
    damage(amount, source, kind) {
      if (this.dead) return false;
      const hit = super.damage(amount * this.armourMul(source, kind), source, kind);
      if (hit && !this.dead) this.checkPhase();
      return hit;
    }
    checkPhase() {
      const f = this.hp / this.maxHp;
      while (this.phase <= BEHEMOTH.phases.length && f < BEHEMOTH.phases[this.phase - 1]) {
        this.phase++;
        this.onPhase(this.phase, this.world);
      }
    }
    onPhase(n, world) {
      if (!world) return;
      if (world.hitstop) world.hitstop(0.25);
      const p = world.player;
      const n2 = p ? U.norm(p.x - this.x, p.y - this.y) : { x: 1, y: 0 };
      kick(world, n2.x, n2.y, 10, 0.35);
      world.particles.burst(this.x, this.y, 36, { color: ['#4d5a3a', '#6d7b56', '#2b3322', '#c8d0b8'], speed: [120, 420], life: [0.5, 1.2], size: [3, 7], shape: 'shard', add: false, drag: 2.5, radius: 30 });
      world.particles.burst(this.x, this.y, 18, { color: ['#fff2c4', '#ffd27a'], speed: [80, 300], life: [0.15, 0.4], size: [1.5, 3], shape: 'spark' });
      world.bark(this, BEHEMOTH_BARKS[n] || '', 2.4);
      Audio.play('phase');
      const bx = -Math.cos(this.hullA), by = -Math.sin(this.hullA); // straight back
      if (n === 2) {
        // Sows mines in its wake and calls in an escort.
        const Mine = DM.Special && DM.Special.Mine;
        for (let i = 0; i < BEHEMOTH.mines && Mine; i++) {
          const s = (i - (BEHEMOTH.mines - 1) / 2) * 55;
          const x = U.clamp(this.x + bx * 110 - by * s, 40, world.w - 40), y = U.clamp(this.y + by * 110 + bx * s, 40, world.h - 40);
          const m = world.add(new Mine(x, y));
          this.spawned.push(m);
          world.particles.burst(x, y, 6, { color: ['#9a948a', '#6a645a'], speed: [20, 80], life: [0.3, 0.7], size: [4, 8], shape: 'smoke', add: false, alpha: 0.5 });
        }
        for (let i = 0; i < BEHEMOTH.escorts; i++) {
          const x = world.w - 120, y = U.clamp(this.y + (i ? 260 : -260), 120, world.h - 120);
          this.spawned.push(world.add(new Drone({ x, y, sight: 2400, alerted: true })));
        }
      } else if (n === 3) this.ventT = 0.01;
    }
    // The operation is over: its mines are made safe and its escort powers down.
    standDown(world) {
      for (const e of this.spawned) {
        if (e.dead) continue;
        if (e.powerDown) e.powerDown(world);
        else if (e.defuse) e.defuse(world);
      }
    }
    onDeath(kind, source) {
      super.onDeath(kind, source);
      if (this.world) this.standDown(this.world);
    }
    think(dt, world) {
      const t = this.target;
      if (!t) return;
      const phase = this.phase;
      if (this.ventT > 0) {
        this.ventT += dt;
        if (Math.random() < dt * 14) {
          const vx = this.x - Math.cos(this.hullA) * 70, vy = this.y - Math.sin(this.hullA) * 70;
          world.particles.emit(vx, vy, { vx: -Math.cos(this.hullA) * 40 + U.rand(-15, 15), vy: -Math.sin(this.hullA) * 40 + U.rand(-15, 15), life: 1, size: 8, size1: 20, color: '#3a3530', add: false, shape: 'smoke', alpha: 0.45 });
        }
      }
      const ang = U.angleTo(this.x, this.y, t.x, t.y);
      const d = U.dist(this.x, this.y, t.x, t.y);
      // Heavy: turns at a fixed, slow rate, and only drives once Jon is far.
      if (d > 300 || this.rearExposed()) {
        const diff = U.wrapAngle(ang - this.hullA);
        const step = BEHEMOTH.turn * (1 + phase * 0.15) * dt;
        this.hullA += U.clamp(diff, -step, step);
        this.tread += dt * 12;
      }
      if (d > 300) {
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
          const g = this.gunPos();
          world.add(new Bullet({ x: g.x, y: g.y, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, team: 'enemy', dmg: 4 }));
          Audio.play('shot');
        }
      }
      // Wind-up of the queued attack (cancelled if it is stunned).
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) this.unleash(world, t, phase);
        return;
      }
      // A missile launch that was interrupted comes straight back, so there is
      // always a missile to catch and throw back.
      if (this.windup === 'missiles') this.cycle--;
      this.windup = null;
      this.actT -= dt;
      if (this.actT > 0) return;
      this.actT = Math.max(1.4, 3.2 - phase * 0.5);
      const act = this.cycle++ % 3;
      if (act === 0) {
        for (let i = -1; i <= 1; i++) {
          const ox = Math.cos(ang + Math.PI / 2) * i * 90, oy = Math.sin(ang + Math.PI / 2) * i * 90;
          world.add(new Shell({ x: this.x + Math.cos(this.turret) * 70, y: this.y + Math.sin(this.turret) * 70, tx: t.x + ox + t.vx * 0.6, ty: t.y + oy + t.vy * 0.6, T: 1.3, dmg: 20, radius: 75 }));
        }
        Audio.play('cannon');
        if (onScreen(world, this.x, this.y, 40)) world.camera.shake(0.2);
      } else if (act === 1) {
        // One hatch (alternating) launches; both do once the vent is open.
        this.windup = 'missiles';
        this.hatches = phase >= 3 ? [-1, 1] : [(this.hatchSide = -(this.hatchSide || 1))];
        this.aim = this.aimTime = BEHEMOTH.hatchT;
        Audio.play('pod_alarm');
      } else {
        this.windup = 'mg';
        this.aim = this.aimTime = BEHEMOTH.mgSpin;
        Audio.play('mg_spin');
      }
    }
    unleash(world, t, phase) {
      if (this.windup === 'missiles') {
        for (const side of this.hatches) this.launchMissile(world, side);
        // Hanging around behind it from phase 2 earns a missile out of the back.
        if (phase >= 2 && this.rearExposed()) world.add(new Missile({ x: this.x - Math.cos(this.hullA) * 60, y: this.y - Math.sin(this.hullA) * 60, angle: this.hullA + Math.PI, speed: 230 }));
        Audio.play('whoosh');
      } else if (this.windup === 'mg') {
        this.mgShots = 10 + phase * 4;
        this.mgT = 0;
      }
      this.windup = null;
    }
    launchMissile(world, side) {
      world.add(new Missile({ x: this.x + Math.cos(this.hullA + side * 1.6) * 50, y: this.y + Math.sin(this.hullA + side * 1.6) * 50, angle: this.hullA + side * 1.2, speed: 230 }));
    }
    gunPos() {
      return { x: this.x + Math.cos(this.turret + 0.6) * 44, y: this.y + Math.sin(this.turret + 0.6) * 44 };
    }
    draw(ctx) {
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
      // Battle damage as the phases go by.
      if (this.phase >= 2) {
        ctx.strokeStyle = 'rgba(20,20,16,0.7)';
        ctx.lineWidth = 2;
        Gfx.line(ctx, 18, -W / 2 + 16, 30, -8);
        Gfx.line(ctx, 30, -8, 24, 6);
        Gfx.line(ctx, -40, W / 2 - 16, -30, 10);
      }
      ctx.fillStyle = '#3a4430';
      for (const s of [-1, 1]) ctx.fillRect(-20, s * (W / 2 - 34) - 10, 40, 20);
      // The engine panel at the rear: the weak point.
      ctx.fillStyle = this.phase >= 3 ? '#2a1a12' : '#c4302b';
      ctx.fillRect(-L / 2 + 10, -4 - (this.phase >= 3 ? 6 : 0), 18, 8 + (this.phase >= 3 ? 12 : 0));
      if (this.phase >= 3) {
        ctx.fillStyle = '#c4302b';
        for (let i = 0; i < 3; i++) ctx.fillRect(-L / 2 + 12, -8 + i * 6, 14, 2);
      }
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
    emissive(ctx, world) {
      const t = world.realTime || 0;
      const L = this.r * 2.4, W = this.r * 1.8;
      const ca = Math.cos(this.hullA), sa = Math.sin(this.hullA);
      const toWorld = (lx, ly) => ({ x: this.x + ca * lx - sa * ly, y: this.y + sa * lx + ca * ly });
      // Rear engine: a dull glow, a hot vent once phase 3 opens it.
      const rear = toWorld(-L / 2 + 19, 0);
      if (this.phase >= 3) Gfx.glow(ctx, rear.x, rear.y, 30 + Math.sin(t * 9) * 6, '#ff6a2a', 0.95);
      else Gfx.glow(ctx, rear.x, rear.y, 14, '#ff5a3a', 0.45);
      if (this.aim > 0) {
        const k = 1 - this.aim / this.aimTime;
        if (this.windup === 'mg') {
          // Coax gun spinning up.
          const g = this.gunPos();
          Gfx.glow(ctx, g.x, g.y, 8 + k * 22, '#ffb24a', 0.6 + k * 0.4);
          ctx.save();
          ctx.strokeStyle = `rgba(255,190,90,${0.3 + k * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(g.x, g.y, 7, t * 30, t * 30 + Math.PI * (0.5 + k));
          ctx.stroke();
          ctx.restore();
        } else if (this.windup === 'missiles') {
          // The side hatch about to launch flashes.
          const on = Math.sin(t * 34) > 0;
          for (const s of this.hatches || []) {
            const h = toWorld(0, s * (W / 2 - 34));
            if (on) Gfx.glow(ctx, h.x, h.y, 26 + k * 10, '#ff3a2a', 0.95);
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.rotate(this.hullA);
            ctx.fillStyle = on ? 'rgba(255,90,60,0.9)' : 'rgba(255,200,120,0.5)';
            ctx.fillRect(-20, -10, 40, 20);
            ctx.restore();
          }
          if (this.phase >= 2 && this.rearExposed()) {
            const b = toWorld(-L / 2 - 4, 0);
            if (on) Gfx.glow(ctx, b.x, b.y, 18 + k * 8, '#ff3a2a', 0.8);
          }
        }
      }
      if (this.mgShots > 0 && this.mgT > 0.035) {
        const g = this.gunPos();
        star(ctx, g.x + Math.cos(this.turret) * 6, g.y + Math.sin(this.turret) * 6, this.turret, 18, '#fff2c4', 0.9);
      }
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
    draw(ctx) {
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
    }
    emissive(ctx) {
      Gfx.glow(ctx, this.x, this.y, this.aim > 0 ? 22 : 10, '#c06bff', 0.8);
      if (this.aim > 0 && this.target) {
        const k = 1 - this.aim / this.aimTime;
        aimLine(ctx, this.x + Math.cos(this.aimA) * 28, this.y + Math.sin(this.aimA) * 28, this.target.x, this.target.y, k, '200,110,255');
      }
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
    // Taken apart from inside (disintegrated), it does not blow up in Jon's face.
    onDeath(kind, source) {
      super.onDeath(kind, source);
      Audio.play('zap');
      if (this.world) this.world.particles.burst(this.x, this.y, 50, { color: this.colors, speed: [80, 360], life: [0.3, 1], size: [2, 4], shape: 'spark' });
      DM.Events.emit('emitter:down', this);
    }
    draw(ctx, world) {
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
  // A duel with readable rules. While his guard is up he slips every Disintegrate
  // aimed at him. A gold ring shows when it is down: stunned or held, pinned by a
  // copy, recovering after any dash, winded after three dodges in a row, and most
  // of the time while Jon watches through Temporal Sight.
  const VEIDT = {
    hp: 900,
    speed: 230,
    orbitR: [200, 300],
    dashSpeed: 760,
    dashT: 0.35,
    dodgeReach: 70, // casts landing within c.r + this of him are dodged
    dodgeDist: 150,
    evadeT: 0.25, // i-frames against disintegrate once he commits to a dodge
    recoverT: 0.8, // guard down after any dash
    streak: 3, // dodges in a row before he is winded...
    fatigueT: 2, // ...for this long, orbiting slower
    fatigueSpeed: 0.55,
    sightPeriod: 1, // under Temporal Sight his guard is up only for
    sightGuard: 0.2, // the first 20% of each (world-time) period
    pinR: 110, // a Duplicate this close pins him
    impactMul: 1,
    boltMul: 0.6,
    breakFree: 0.7, // seconds he can be held (longer if Jon is expanded)
    breakFreeBig: 1.5,
    slamStun: 1.1,
    slamRecover: 1.2, // cannot be grabbed again this soon after a slam
    discCd: [3.2, 2.4], // phase 1 / phase 2
    discWindup: 0.3,
    discRange: 520,
    meleeDmg: 20,
    meleeCd: 0.7,
    phase2: 0.5,
  };
  const VEIDT_DODGE = ['Too slow, Jon.', 'I have studied you.', 'Predictable.', 'You telegraph everything.'];
  const VEIDT_FREE = ['Not like that.', 'I caught a bullet once, Jon.', 'Unhand me.'];

  // Gold afterimage left where Veidt stood when he dodged.
  class Echo extends DM.Entity {
    constructor(v) {
      super({ x: v.x, y: v.y, r: 1, static: true, body: false, solid: false, layer: 1, disintegratable: false });
      this.look = v.look;
      this.facing = v.facing;
      this.life = 0.4;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    render(ctx) {
      const a = Math.max(0, this.life / 0.4);
      Gfx.figure(ctx, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing, alpha: 0.45 * a, noShadow: true, body: '#d4ad3a', sleeve: '#d4ad3a', legs: '#a8862a', skin: '#ffe6a0', cape: null, ink: 'rgba(120,90,20,0.6)' }));
    }
  }

  class Veidt extends Enemy {
    constructor(o = {}) {
      super(Object.assign({ hp: VEIDT.hp, r: 13, mass: 1.6, friction: 8, human: true, needLos: false, colors: ['#6f4aa6', '#d4ad3a', '#f0d0b2'] }, o));
      this.look = DM.LOOKS.veidt;
      this.name = 'ADRIAN VEIDT';
      this.phaseMarks = [VEIDT.phase2];
      this.state = 'strafe';
      this.stateT = 3;
      this.discCd = 2.5;
      this.strikeCd = 0;
      this.heldT = 0;
      this.summonT = 8;
      this.orbitR = 240;
      this.orbitDir = 1;
      this.phi = null;
      this.speedBase = VEIDT.speed;
      this.yielded = false;
      this.dashT = 0;
      this.dashTarget = null;
      this.aimTime = VEIDT.discWindup;
      this.evadeT = 0;
      this.recoverT = 0;
      this.fatigueT = 0;
      this.streak = 0;
      this.slamT = 0;
      this.sightClock = 0;
      this.pinned = false;
      this.disHits = 0;
      this.pendingEvade = null;
    }
    // Why his guard is down right now (null: it is up and he will dodge).
    guardDown(world) {
      if (this.heldBy || this.stun > 0) return 'stunned';
      if (this.pinned) return 'pinned';
      if (this.state === 'dash') return 'dashing';
      if (this.recoverT > 0) return 'recovering';
      if (this.fatigueT > 0) return 'winded';
      if (world.timesight && this.sightClock % VEIDT.sightPeriod >= VEIDT.sightGuard) return 'seen';
      return null;
    }
    disintegrate(world, source) {
      this.damage(70, source, 'disintegrate');
    }
    damage(amount, source, kind) {
      if (this.yielded || this.dead) return false;
      if (kind === 'disintegrate' && this.evadeT > 0) return false;
      if (kind === 'impact') amount *= VEIDT.impactMul;
      if (kind === 'bolt') amount *= VEIDT.boltMul;
      this.hp -= amount;
      this.hitFlash = 0.15;
      this.streak = 0;
      if (kind === 'disintegrate') this.disHits++;
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
      this.stun = Math.max(this.stun, VEIDT.slamStun);
      // No slam-to-slam stun-lock: he cannot be caught again straight away.
      this.slamT = VEIDT.slamRecover;
      this.grabbable = false;
      world.particles.burst(this.x, this.y, 10, { color: ['#d4ad3a', '#ffffff'], speed: [60, 200], life: [0.2, 0.5], size: [2, 3.5] });
      Audio.play('impact');
      world.camera.shake(0.25);
    }
    yieldNow() {
      if (this.yielded) return;
      this.yielded = true;
      this.hp = 0;
      this.aim = 0;
      this.grabbable = false;
      this.disintegratable = false;
      this.heldBy = null;
      this.vx = this.vy = 0;
      if (this.world && this.world.hitstop) this.world.hitstop(0.25);
      Events.emit('veidt:yield', this);
    }
    onHeld(dt, world) {
      this.heldT += dt;
      const limit = this.heldBy && this.heldBy.scale > 1.3 ? VEIDT.breakFreeBig : VEIDT.breakFree;
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
    // Dashes start at full speed; afterwards he needs a moment (recoverT).
    dash(x, y) {
      this.state = 'dash';
      this.dashT = VEIDT.dashT;
      const w = this.world;
      this.dashTarget = { x: U.clamp(x, 60, w.w - 60), y: U.clamp(y, 60, w.h - 60) };
      const n = U.norm(this.dashTarget.x - this.x, this.dashTarget.y - this.y);
      if (n.l) {
        this.vx = n.x * VEIDT.dashSpeed;
        this.vy = n.y * VEIDT.dashSpeed;
      }
    }
    onDisintegrateCast(c, world) {
      if (this.yielded) return;
      if (U.dist(this.x, this.y, c.x, c.y) > c.r + VEIDT.dodgeReach) return;
      if (this.guardDown(world)) return;
      let n = U.norm(this.x - c.x, this.y - c.y);
      if (!n.l) n = { x: Math.cos(this.facing + Math.PI / 2), y: Math.sin(this.facing + Math.PI / 2) };
      // Of the two sidesteps, take the one that keeps him furthest inside the arena.
      let best = null;
      for (const side of [1, -1]) {
        const x = this.x + (n.x - n.y * side) * VEIDT.dodgeDist, y = this.y + (n.y + n.x * side) * VEIDT.dodgeDist;
        const room = Math.min(x - 60, world.w - 60 - x, y - 60, world.h - 60 - y) + (world.isFree(x, y, this.r) ? 400 : 0);
        if (!best || room > best.room) best = { x, y, room };
      }
      world.add(new Echo(this));
      this.dash(best.x, best.y);
      this.evadeT = VEIDT.evadeT;
      this.pendingEvade = { c, hits: this.disHits, t: 0 };
      if (++this.streak >= VEIDT.streak) this.fatiguePending = true;
      Audio.play('veidt_dodge');
    }
    update(dt, world) {
      if (this.yielded) {
        this.vx = U.damp(this.vx, 0, 8, dt);
        this.vy = U.damp(this.vy, 0, 8, dt);
        return;
      }
      if (!this.heldBy) this.heldT = 0;
      this.evadeT = Math.max(0, this.evadeT - dt);
      if (this.slamT > 0) {
        this.slamT -= dt;
        if (this.slamT <= 0) this.grabbable = true;
      }
      if (world.timesight) this.sightClock += dt;
      else this.sightClock = 0;
      // 'Too slow' only when the dodge really took him out of harm's way.
      const pe = this.pendingEvade;
      if (pe) {
        pe.t += dt;
        if (pe.c.t <= 0 || pe.t > 0.6) {
          if (pe.c.t <= 0 && this.disHits === pe.hits) world.bark(this, U.pick(VEIDT_DODGE), 1.3);
          this.pendingEvade = null;
        }
      }
      super.update(dt, world);
    }
    think(dt, world) {
      const p = world.player;
      if (!p) return;
      this.walk += dt * this.speed * 0.09;
      this.discCd -= dt;
      this.strikeCd -= dt;
      this.summonT -= dt;
      this.recoverT = Math.max(0, this.recoverT - dt);
      this.fatigueT = Math.max(0, this.fatigueT - dt);
      const phase = this.hp < this.maxHp * VEIDT.phase2 ? 2 : 1;

      if (this.state === 'dash') {
        this.dashT -= dt;
        this.steer(this.dashTarget.x, this.dashTarget.y, VEIDT.dashSpeed, dt, 14);
        if (Math.random() < dt * 60) world.particles.emit(this.x, this.y, { life: 0.3, size: 10, size1: 4, color: '#6f4aa6', add: false, shape: 'smoke', alpha: 0.35, drag: 0 });
        if (this.dashT <= 0 || U.dist(this.x, this.y, this.dashTarget.x, this.dashTarget.y) < 12) {
          this.state = 'strafe';
          this.recoverT = VEIDT.recoverT;
          if (this.fatiguePending) {
            this.fatiguePending = false;
            this.streak = 0;
            this.fatigueT = VEIDT.fatigueT;
          }
        }
        return;
      }

      let dup = null, dd = VEIDT.pinR;
      for (const e of world.entities) {
        if (!e.isDuplicate || e.dead) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < dd) {
          dd = d;
          dup = e;
        }
      }
      this.pinned = !!dup;
      if (dup) {
        this.state = 'melee';
        this.aim = 0;
        this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, dup.x, dup.y), 14, dt);
        if (dd > this.r + dup.r + 4) this.steer(dup.x, dup.y, 300, dt, 10);
        else if (this.strikeCd <= 0) {
          this.strikeCd = VEIDT.meleeCd;
          dup.damage(VEIDT.meleeDmg, this, 'strike');
          world.particles.burst(dup.x, dup.y, 8, { color: ['#ffffff', '#7fe3ff'], speed: [80, 200], life: [0.1, 0.3], size: [2, 3], shape: 'spark' });
          Audio.play('impact');
        }
        return;
      }
      if (this.state === 'melee') this.state = 'strafe';

      const slow = this.fatigueT > 0 ? VEIDT.fatigueSpeed : 1;
      if (this.phi == null) this.phi = U.angleTo(p.x, p.y, this.x, this.y);
      this.phi += this.orbitDir * dt * (0.7 + phase * 0.3) * slow;
      const sp = this.speedBase * (phase === 2 ? 1.2 : 1) * slow;
      this.steer(p.x + Math.cos(this.phi) * this.orbitR, p.y + Math.sin(this.phi) * this.orbitR, sp, dt, 5);
      this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, p.x, p.y), 10, dt);

      // Tachyon disc: a short wind-up (arm raised, a glint at his hand), then the throw.
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) {
          const tx = p.x + p.vx * 0.4, ty = p.y + p.vy * 0.4;
          const a = U.angleTo(this.x, this.y, tx, ty);
          const h = this.handPos();
          world.add(new TachyonDisc({ x: h.x, y: h.y, tx: h.x + Math.cos(a) * 100, ty: h.y + Math.sin(a) * 100, range: VEIDT.discRange }));
          Audio.play('whoosh');
        }
      } else if (this.discCd <= 0) {
        this.discCd = VEIDT.discCd[phase - 1];
        this.aim = this.aimTime;
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
        this.orbitR = U.rand(VEIDT.orbitR[0], VEIDT.orbitR[1]);
      }
    }
    handPos() {
      return { x: this.x + Math.cos(this.facing) * 12 - Math.sin(this.facing) * 5, y: this.y + Math.sin(this.facing) * 12 + Math.cos(this.facing) * 5 };
    }
    render(ctx, world) {
      if (this.yielded) {
        Gfx.figure(ctx, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing, scale: 0.9 }));
        return;
      }
      Gfx.figure(ctx, Object.assign({}, this.look, {
        x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.speed > 20,
        carry: this.state === 'melee' || this.aim > 0, flash: this.hitFlash > 0 ? 0.7 : 0,
      }));
      if (!world.lit) this.renderEmissive(ctx, world);
    }
    renderEmissive(ctx, world) {
      if (this.yielded || this.dead) return;
      const t = world.realTime || 0;
      if (this.aim > 0) {
        const k = 1 - this.aim / this.aimTime;
        const h = this.handPos();
        Gfx.glow(ctx, h.x, h.y, 10 + k * 14, '#ffd86a', 0.7 + k * 0.3);
        star(ctx, h.x, h.y, t * 6, 8 + k * 10, '#fff6c8', 0.6 + k * 0.4);
      }
      const why = this.guardDown(world);
      if (why && why !== 'dashing') {
        ctx.save();
        ctx.strokeStyle = `rgba(242,196,24,${0.55 + Math.sin(t * 10) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -t * 20;
        Gfx.circle(ctx, this.x, this.y, this.r + 10);
        ctx.stroke();
        ctx.restore();
      }
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

  DM.Enemies = { Enemy, Gangster, Machine, Drone, Tank, Battery, Behemoth, Turret, Emitter, Veidt, TUNING: { DRONE, TANK, BATTERY, BEHEMOTH, VEIDT } };
})();
