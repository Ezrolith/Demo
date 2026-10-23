/* Projectiles: bullets, energy bolts, artillery shells, homing missiles, grenades, tachyon discs. */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Entity = DM.Entity;

  const TRAIL = 0.04; // tracer length, in seconds of travel

  // Fast straight shot. Moves itself with a swept segment test so it never tunnels.
  class Bullet extends Entity {
    constructor(o) {
      super({ x: o.x, y: o.y, vx: o.vx, vy: o.vy, r: o.r || 3, body: false, solid: false, layer: 2, disintegratable: true, team: o.team || 'enemy' });
      this.selfMove = true;
      this.isProjectile = true;
      this.dmg = o.dmg == null ? 6 : o.dmg;
      this.life = o.life || 1.8;
      this.color = o.color || '#ffd27a';
      this.kind = o.kind || 'bullet';
      this.width = o.width || 2;
      this.push = o.push || 0; // impulse along the shot's line on whatever it hits
    }
    update(dt, world) {
      this.life -= dt;
      if (this.life <= 0) return this.die('expire');
      const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
      const t = world.shotHit(this.x, this.y, nx, ny);
      if (t >= 0) {
        const hx = this.x + (nx - this.x) * t, hy = this.y + (ny - this.y) * t;
        world.particles.burst(hx, hy, 5, { color: [this.color, '#ffffff'], speed: [40, 160], life: [0.1, 0.25], size: [1, 2], shape: 'spark' });
        return this.die('wall');
      }
      for (const e of world.entities) {
        if (e.dead || e === this || e.team === this.team || e.isProjectile || !e.body) continue;
        if (e.hp == null && !e.isPlayer && !e.blocksShots) continue;
        if (e.ko) continue;
        if (!U.segCircle(this.x, this.y, nx, ny, e.x, e.y, e.r + this.r)) continue;
        if (e.shieldR && U.dist(this.x, this.y, e.x, e.y) > e.shieldR - 2) continue;
        e.damage(this.dmg, this, this.kind);
        if (this.push && !e.static && e.impulse) {
          const n = U.norm(this.vx, this.vy);
          e.impulse(n.x * this.push, n.y * this.push);
        }
        world.particles.burst(this.x, this.y, 6, { color: [this.color, '#ffffff'], speed: [40, 180], life: [0.1, 0.3], size: [1, 2.5], shape: 'spark' });
        return this.die('hit');
      }
      this.x = nx;
      this.y = ny;
    }
    // A dark underline first, so bright tracers still read on sand and snow.
    render(ctx) {
      const tx = this.x - this.vx * TRAIL, ty = this.y - this.vy * TRAIL;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(20,10,0,0.6)';
      ctx.lineWidth = this.width + 2;
      Gfx.line(ctx, tx, ty, this.x, this.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.width;
      Gfx.line(ctx, tx, ty, this.x, this.y);
      ctx.restore();
    }
    renderFuture(ctx, world) {
      const nx = this.x + this.vx * 1.2, ny = this.y + this.vy * 1.2;
      const t = world.shotHit(this.x, this.y, nx, ny);
      const ex = t >= 0 ? this.x + (nx - this.x) * t : nx, ey = t >= 0 ? this.y + (ny - this.y) * t : ny;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,90,74,0.35)';
      ctx.setLineDash([4, 6]);
      Gfx.line(ctx, this.x, this.y, ex, ey);
      ctx.restore();
    }
  }

  // Energy bolt fired by Dr. Manhattan's duplicates: it shoves what it hits.
  class Bolt extends Bullet {
    constructor(o) {
      super(Object.assign({ color: '#7fe3ff', team: 'player', dmg: 18, r: 4, width: 3, kind: 'bolt', life: 1.4, push: 60 }, o));
    }
    render(ctx) {
      super.render(ctx);
      Gfx.glow(ctx, this.x, this.y, 12, '#5fd4ff', 0.8);
    }
  }

  // Artillery shell: lobbed at a ground point, marked with a warning ring.
  class Shell extends Entity {
    constructor(o) {
      super({ x: o.x, y: o.y, r: 6, body: false, solid: false, layer: 3, disintegratable: true, team: o.team || 'enemy' });
      this.selfMove = true;
      this.isProjectile = true;
      this.sx = o.x;
      this.sy = o.y;
      this.tx = o.tx;
      this.ty = o.ty;
      this.T = o.T || 1.1;
      this.t = 0;
      this.dmg = o.dmg || 18;
      this.radius = o.radius || 70;
      this.h = 0;
    }
    update(dt, world) {
      this.t += dt;
      const k = Math.min(1, this.t / this.T);
      this.x = U.lerp(this.sx, this.tx, k);
      this.y = U.lerp(this.sy, this.ty, k);
      this.h = Math.sin(k * Math.PI) * Math.min(220, U.dist(this.sx, this.sy, this.tx, this.ty) * 0.45);
      if (k >= 1) {
        this.dead = true;
        world.explode(this.tx, this.ty, this.radius, this.dmg, { team: this.team });
      }
    }
    render(ctx) {
      const k = Math.min(1, this.t / this.T);
      ctx.save();
      ctx.strokeStyle = `rgba(255,80,60,${0.25 + k * 0.6})`;
      ctx.fillStyle = `rgba(255,80,60,${0.05 + k * 0.12})`;
      ctx.lineWidth = 2;
      Gfx.circle(ctx, this.tx, this.ty, this.radius);
      ctx.fill();
      ctx.stroke();
      Gfx.circle(ctx, this.tx, this.ty, this.radius * k);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      Gfx.ellipse(ctx, this.x, this.y, 6, 4);
      ctx.fill();
      ctx.fillStyle = '#3a3a30';
      Gfx.circle(ctx, this.x, this.y - this.h, 6);
      ctx.fill();
      ctx.restore();
      Gfx.glow(ctx, this.x, this.y - this.h, 14, '#ff9a3c', 0.6);
    }
  }

  // Homing missile. Grab it with telekinesis and it's yours. o.target gives it
  // one thing to home on (a battery told to hit the command post); arriving
  // there calls target.onMissileHit(missile, world).
  class Missile extends Entity {
    constructor(o) {
      super({ x: o.x, y: o.y, r: 8, mass: 0.5, friction: 0, bounce: 0, team: 'enemy', grabbable: true, hp: 1, layer: 2, colors: ['#d8d8d0', '#ff9a3c'] });
      this.isProjectile = true;
      this.angle = o.angle || 0;
      this.speedBase = o.speed || 250;
      this.turn = o.turn || 2.1;
      this.life = o.life || 8;
      this.vx = Math.cos(this.angle) * this.speedBase;
      this.vy = Math.sin(this.angle) * this.speedBase;
      this.body = false;
      this.aimAt = o.target || null;
    }
    onGrab() {
      this.team = 'player';
      this.aimAt = null;
    }
    update(dt, world) {
      this.life -= dt;
      if (this.life <= 0) return this.boom(world);
      if (this.heldBy || this.team === 'player') {
        this.body = !this.heldBy;
        if (this.speed > 40) this.angle = Math.atan2(this.vy, this.vx);
        if (!this.heldBy) {
          // Looks one step ahead, so it bursts on contact rather than after bouncing off.
          const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
          for (const e of world.entities) {
            if (e.dead || e.team !== 'enemy' || e === this || e.isProjectile || e.ko) continue;
            const reach = e.r + this.r + 4;
            if (U.dist(this.x, this.y, e.x, e.y) < reach || U.dist(nx, ny, e.x, e.y) < reach) return this.boom(world);
          }
        }
        return;
      }
      let target = null, bd = 900;
      if (this.aimAt && !this.aimAt.dead) {
        target = this.aimAt;
        bd = U.dist(this.x, this.y, target.x, target.y);
      } else {
        for (const e of world.entities) {
          if (e.dead || e.team !== 'player' || !e.targetable) continue;
          const d = U.dist(this.x, this.y, e.x, e.y);
          if (d < bd) {
            bd = d;
            target = e;
          }
        }
      }
      if (target) {
        const want = U.angleTo(this.x, this.y, target.x, target.y);
        const diff = U.wrapAngle(want - this.angle);
        this.angle += U.clamp(diff, -this.turn * dt, this.turn * dt);
        if (bd < target.r + this.r + 2) return this.boom(world);
      }
      this.vx = Math.cos(this.angle) * this.speedBase;
      this.vy = Math.sin(this.angle) * this.speedBase;
      if (Math.random() < dt * 40) world.particles.emit(this.x - Math.cos(this.angle) * 10, this.y - Math.sin(this.angle) * 10, { vx: U.rand(-20, 20), vy: U.rand(-20, 20), life: 0.5, size: 4, size1: 9, color: '#9a948a', add: false, shape: 'smoke', alpha: 0.5 });
    }
    onWall(speed, w, world) {
      this.boom(world);
    }
    onImpact(speed, other, world) {
      this.boom(world);
    }
    damage() {
      this.boom(this.world);
      return true;
    }
    boom(world) {
      if (this.dead) return;
      this.dead = true;
      const mine = this.team === 'player';
      const t = this.aimAt;
      if (!mine && t && !t.dead && t.onMissileHit && U.dist(this.x, this.y, t.x, t.y) < t.r + 45) t.onMissileHit(this, world);
      world.explode(this.x, this.y, mine ? 75 : 60, mine ? 90 : 16, { team: this.team, source: this });
    }
    render(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = this.team === 'player' ? '#cfefff' : '#d8d8d0';
      ctx.fillRect(-10, -3.5, 18, 7);
      ctx.fillStyle = '#c4302b';
      ctx.beginPath();
      ctx.moveTo(8, -3.5);
      ctx.lineTo(13, 0);
      ctx.lineTo(8, 3.5);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.fillRect(-10, -6, 4, 12);
      ctx.restore();
      if (!this.heldBy) Gfx.glow(ctx, this.x - Math.cos(this.angle) * 11, this.y - Math.sin(this.angle) * 11, 12, '#ff9a3c', 0.8);
    }
    renderFuture(ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,154,60,0.4)';
      ctx.setLineDash([3, 5]);
      Gfx.line(ctx, this.x, this.y, this.x + this.vx * 1.2, this.y + this.vy * 1.2);
      ctx.restore();
    }
  }

  // Grenade: lobbed by a Grenadier. A red ring marks where it lands and how far
  // it will reach; it bursts 1.6 s after the throw. Grabbed, it is Jon's (it
  // changes team), and thrown it bursts on the first enemy or wall it meets.
  // Disintegrate takes it apart harmlessly.
  const GRENADE = { fuse: 1.6, minFuse: 0.5, r: 70, dmg: 18, mineR: 80, mineDmg: 80, arc: 64 };

  class Grenade extends Entity {
    constructor(o) {
      super({ x: o.x, y: o.y, r: 6, mass: 0.4, friction: 5, bounce: 0.35, body: false, layer: 2, grabbable: true, disintegratable: true, team: o.team || 'enemy', colors: ['#4a5634', '#2a2f22'] });
      this.isProjectile = true;
      this.hazard = true; // in colour through Temporal Sight's grade
      this.fuse = o.fuse || GRENADE.fuse;
      this.sx = o.x;
      this.sy = o.y;
      this.tx = o.tx == null ? o.x : o.tx;
      this.ty = o.ty == null ? o.y : o.ty;
      this.T = o.T || 0.75;
      this.t = 0;
      this.h = 0;
      this.lobbing = this.T > 0;
      this.selfMove = this.lobbing;
      this.spin = 0;
    }
    get blastR() {
      return this.team === 'player' ? GRENADE.mineR : GRENADE.r;
    }
    // Jon's now: a moment to throw it, whatever the fuse says.
    onGrab() {
      this.team = 'player';
      this.fuse = Math.max(this.fuse, GRENADE.minFuse);
      this.land();
    }
    land() {
      this.lobbing = false;
      this.selfMove = false;
      this.h = 0;
    }
    update(dt, world) {
      this.fuse -= dt;
      if (this.fuse <= 0) return this.boom(world);
      if (this.heldBy) return;
      if (this.lobbing) {
        this.t += dt;
        const k = Math.min(1, this.t / this.T);
        this.x = U.lerp(this.sx, this.tx, k);
        this.y = U.lerp(this.sy, this.ty, k);
        this.h = Math.sin(k * Math.PI) * Math.min(GRENADE.arc, 20 + U.dist(this.sx, this.sy, this.tx, this.ty) * 0.2);
        this.spin += dt * 14;
        if (k >= 1) {
          this.land();
          // A short roll on from where it lands.
          const n = U.norm(this.tx - this.sx, this.ty - this.sy);
          this.vx = n.x * 70;
          this.vy = n.y * 70;
          DM.Audio.play('grenade_land');
        }
        return;
      }
      this.spin += (this.speed / 8) * dt;
      // Thrown by Jon: bursts on the first enemy it reaches.
      if (this.team === 'player' && this.thrown > 0) {
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        for (const e of world.entities) {
          if (e.dead || e.team !== 'enemy' || e === this || e.isProjectile || e.ko || e.hazard) continue;
          const reach = e.r + this.r + 4;
          if (U.dist(this.x, this.y, e.x, e.y) < reach || U.dist(nx, ny, e.x, e.y) < reach) return this.boom(world);
        }
      }
    }
    onWall(speed, w, world) {
      if (this.team === 'player' && this.thrown > 0 && speed > 150) this.boom(world);
    }
    boom(world) {
      if (this.dead) return;
      this.dead = true;
      const mine = this.team === 'player';
      world.explode(this.x, this.y, mine ? GRENADE.mineR : GRENADE.r, mine ? GRENADE.mineDmg : GRENADE.dmg, { team: this.team, source: this });
    }
    // Where it will burst: its landing point while it is in the air.
    get restX() {
      return this.lobbing ? this.tx : this.x;
    }
    get restY() {
      return this.lobbing ? this.ty : this.y;
    }
    light() {
      return { r: 60, i: 0.7, color: this.team === 'player' ? '#7fe3ff' : '#ff6a3a', k: 0.2, y: this.y - this.h };
    }
    render(ctx, world) {
      const y = this.y - this.h;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      Gfx.ellipse(ctx, this.x + 2, this.y + 3, 6, 4);
      ctx.fill();
      ctx.save();
      ctx.translate(this.x, y);
      ctx.rotate(this.spin);
      ctx.fillStyle = this.team === 'player' ? '#6f8a8a' : '#4a5634';
      ctx.strokeStyle = 'rgba(10,12,8,0.8)';
      ctx.lineWidth = 1.2;
      Gfx.ellipse(ctx, 0, 0, 6.5, 5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      Gfx.line(ctx, -2, -4.6, -2, 4.6);
      Gfx.line(ctx, 2, -4.6, 2, 4.6);
      ctx.fillStyle = '#b8b2a4'; // the lever
      ctx.fillRect(4, -1.5, 4, 3);
      ctx.restore();
      if (!world.lit) this.renderEmissive(ctx, world);
    }
    // The blast ring (filling as the fuse burns) and the fuse spark.
    renderEmissive(ctx, world) {
      if (this.dead) return;
      const t = world.realTime || 0;
      const k = U.clamp(1 - this.fuse / GRENADE.fuse, 0, 1);
      const mine = this.team === 'player';
      const x = this.restX, y = this.restY;
      ctx.save();
      if (mine) {
        ctx.strokeStyle = 'rgba(127,227,255,0.55)';
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -t * 30;
        ctx.lineWidth = 1.5;
        Gfx.circle(ctx, x, y, this.blastR);
        ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(255,70,50,${0.4 + k * 0.5})`;
        ctx.fillStyle = `rgba(255,70,50,${0.05 + k * 0.12})`;
        ctx.lineWidth = 2;
        Gfx.circle(ctx, x, y, this.blastR);
        ctx.fill();
        ctx.stroke();
        Gfx.circle(ctx, x, y, this.blastR * k);
        ctx.stroke();
      }
      ctx.restore();
      // The spark blinks faster as the fuse runs down (steady with reduced flashing).
      const S = DM.SettingsSchema;
      const steady = S && S.reducedFlashing && S.reducedFlashing();
      const on = steady || Math.sin(t * (10 + k * 30)) > -0.2;
      if (on) Gfx.glow(ctx, this.x, this.y - this.h - 5, 9 + k * 6, mine ? '#bff1ff' : '#ffb04a', 0.95);
    }
    renderFuture(ctx) {
      if (!this.lobbing) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,120,80,0.45)';
      ctx.setLineDash([3, 5]);
      Gfx.line(ctx, this.x, this.y, this.tx, this.ty);
      ctx.restore();
    }
  }

  // Veidt's tachyon disc: thrown along a line to its full range (a dodged disc
  // bursts beyond Jon or against a wall), it leaves a cloud that clouds Temporal Sight.
  const DISC = { speed: 480, range: 520, dmg: 8, jam: 1 };

  class TachyonDisc extends Entity {
    constructor(o) {
      super({ x: o.x, y: o.y, r: 6, body: false, solid: false, layer: 2, disintegratable: true, team: 'enemy' });
      this.selfMove = true;
      this.isProjectile = true;
      let n = U.norm(o.tx - o.x, o.ty - o.y);
      if (!n.l) n = { x: 1, y: 0 };
      this.vx = n.x * DISC.speed;
      this.vy = n.y * DISC.speed;
      this.travel = o.range || DISC.range;
      this.spin = 0;
    }
    update(dt, world) {
      this.spin += dt * 20;
      const step = Math.hypot(this.vx, this.vy) * dt;
      const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
      this.travel -= step;
      const p = world.player;
      if (p && !p.dead && U.segCircle(this.x, this.y, nx, ny, p.x, p.y, p.r + 6)) {
        p.damage(DISC.dmg, this, 'disc');
        p.jamT = Math.max(p.jamT, DISC.jam);
        return this.burst(world);
      }
      if (this.travel <= 0 || world.shotHit(this.x, this.y, nx, ny) >= 0) return this.burst(world);
      this.x = nx;
      this.y = ny;
    }
    burst(world) {
      this.dead = true;
      world.add(new DM.Special.TachyonCloud(this.x, this.y));
      DM.Audio.play('zap');
    }
    render(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.spin);
      ctx.fillStyle = '#d4ad3a';
      Gfx.ellipse(ctx, 0, 0, 8, 4);
      ctx.fill();
      ctx.restore();
      Gfx.glow(ctx, this.x, this.y, 16, '#c06bff', 0.7);
    }
  }

  DM.Proj = { Bullet, Bolt, Shell, Missile, Grenade, TachyonDisc, TUNING: { GRENADE } };
})();
