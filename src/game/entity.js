/*
 * Entity: base class for everything that lives in a World.
 *
 * Physics flags:
 *   solid   — collides with walls
 *   body    — pushes against other bodies
 *   static  — never moved by physics
 *   selfMove— moves itself in update() (projectiles); the world won't integrate it
 *   flying  — ignores low walls and doesn't collide with ground bodies
 *   timeless— keeps (most of) its speed during Temporal Sight (the player, duplicates)
 * Gameplay flags:
 *   grabbable (telekinesis), disintegratable, hp (null = indestructible), team
 *   interact = { label, range, onInteract(entity, player), enabled() }
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  let nextId = 1;

  class Entity {
    constructor(o = {}) {
      this.id = nextId++;
      this.x = o.x || 0;
      this.y = o.y || 0;
      this.vx = o.vx || 0;
      this.vy = o.vy || 0;
      this.r = o.r == null ? 12 : o.r;
      this.mass = o.mass == null ? 1 : o.mass;
      this.friction = o.friction == null ? 6 : o.friction;
      this.bounce = o.bounce == null ? 0.25 : o.bounce;
      this.solid = o.solid == null ? true : o.solid;
      this.body = o.body == null ? true : o.body;
      this.static = !!o.static;
      this.flying = !!o.flying;
      this.team = o.team || 'neutral';
      this.hp = o.hp == null ? null : o.hp;
      this.maxHp = this.hp;
      this.grabbable = !!o.grabbable;
      this.disintegratable = o.disintegratable == null ? true : o.disintegratable;
      this.layer = o.layer == null ? 1 : o.layer;
      this.colors = o.colors || ['#ffffff', '#cccccc'];
      this.interact = o.interact || null;
      this.tags = new Set(o.tags || []);
      this.dead = false;
      this.age = 0;
      this.heldBy = null;
      this.thrown = 0;
      this.stun = 0;
      this.hitFlash = 0;
    }

    update(dt, world) {}
    render(ctx, world) {}

    get speed() {
      return Math.hypot(this.vx, this.vy);
    }

    damage(amount, source, kind) {
      if (this.hp == null || this.dead) return false;
      this.hp -= amount;
      this.hitFlash = 0.12;
      if (this.hp <= 0) {
        this.hp = 0;
        this.die(kind, source);
      }
      return true;
    }

    die(kind, source) {
      if (this.dead) return;
      this.dead = true;
      if (this.onDeath) this.onDeath(kind, source);
    }

    // Default: the thing comes apart from the side facing Jon (DM.FX.unbind,
    // coarse cells for crates, vehicles and machines). Small things such as
    // projectiles just scatter.
    disintegrate(world, source) {
      if (this.dead) return;
      const n = Math.min(110, 18 + this.r * 2.5);
      const big = this.r > 40;
      const unbound = !this.isProjectile && this.r >= 9 && DM.FX && DM.FX.unbind(world, this, { source, step: big ? 4 : 3, max: big ? 400 : 600 });
      if (!unbound) world.particles.burst(this.x, this.y, n, { color: this.colors, speed: [30, 280], life: [0.4, 1.3], size: [2, 4.5], drag: 2.5, add: false, radius: this.r });
      world.particles.burst(this.x, this.y, Math.round(n / (unbound ? 4 : 2)), { color: ['#bff1ff', '#5fd4ff'], speed: [60, 340], life: [0.3, 0.9], size: [1.5, 3], drag: 3 });
      this.wasDisintegrated = true;
      this.die('disintegrate', source);
    }

    // Called when this hits a wall/body hard while thrown.
    onImpact(speed, other, world) {
      if (this.hp == null) return;
      const m = other ? U.clamp(other.mass, 0.6, 6) : 1.4;
      // An expanded Jon's throws hit harder: the thrown object's impactMul applies to what it hits too.
      const hitBy = other && other.thrown > 0 && other.impactMul ? other.impactMul : 1;
      const dmg = (speed - 200) * 0.12 * m * (this.impactMul || 1) * hitBy;
      if (dmg <= 1) return;
      if (!this.damage(dmg, other, 'impact')) return;
      world.particles.burst(this.x, this.y, 8, { color: ['#d8d0c0', '#9a9080'], speed: [40, 160], life: [0.2, 0.5], size: [2, 3.5], add: false });
      DM.Audio.play('impact');
      world.camera.shake(Math.min(0.55, 0.15 + dmg / 180));
      if (dmg > 30 && world.hitstop) world.hitstop(0.03 + dmg / 2000);
    }

    impulse(ix, iy) {
      if (this.static) return;
      this.vx += ix / this.mass;
      this.vy += iy / this.mass;
    }

    distTo(e) {
      return U.dist(this.x, this.y, e.x, e.y);
    }
  }

  DM.Entity = Entity;
})();
