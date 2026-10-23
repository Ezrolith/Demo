/*
 * Character looks (used for both top-down figures and dialogue portraits) and
 * the NPC entity. Add a cast member by adding a LOOKS entry; dialogue lines
 * refer to speakers by these keys.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;

  const LOOKS = {
    jon: { name: 'Jon Osterman', skin: '#ecc8a6', hair: '#3b2a1f', hairStyle: 'short', body: '#ebe7dc', sleeve: '#ebe7dc', legs: '#3a3f4b', bg: '#c4a964', collar: '#8aa1b4', color: '#cfe8ff' },
    manhattan: { name: 'Dr. Manhattan', manhattan: true, skin: '#7fd8ff', body: '#4fc0f2', hair: null, hairStyle: 'bald', bg: '#0c2740', color: '#7fe3ff' },
    janey: { name: 'Janey Slater', skin: '#f1cba9', hair: '#8c3a20', hairStyle: 'long', body: '#5d9384', sleeve: '#f1cba9', legs: '#5d9384', bg: '#d9b26a', color: '#ffd1a8' },
    wally: { name: 'Wally Weaver', skin: '#f0c9ab', hair: '#d6b05a', hairStyle: 'short', body: '#ebe7dc', sleeve: '#ebe7dc', legs: '#4b4339', size: 1.15, bg: '#8fb0a1', glasses: true, color: '#ffe6a0' },
    glass: { name: 'Prof. Milton Glass', skin: '#e2bd9c', hair: '#cfcac2', hairStyle: 'thin', glasses: true, body: '#5a554f', sleeve: '#5a554f', legs: '#3b3835', bg: '#a08e7c', color: '#e8dccb' },
    colonel: { name: 'Colonel Hart', skin: '#dcb08a', hair: '#555555', hat: '#4a5638', hatStyle: 'cap', hatBrim: '#2c3322', badge: '#d8b23a', body: '#5a6a44', sleeve: '#5a6a44', legs: '#4a5638', bg: '#8c9a6a', color: '#d7e3b0' },
    captain: { name: 'Captain Rourke', skin: '#e0b28e', hair: '#3a3a3a', hat: '#1d2b4f', hatStyle: 'cap', hatBrim: '#0f172d', badge: '#d8d8d8', body: '#22345e', sleeve: '#22345e', legs: '#1d2b4f', bg: '#5d7290', moustache: true, color: '#c8d6f0' },
    // A patrolman: a step lighter than the captain so he reads behind a car at night.
    cop: { name: 'Patrolman', skin: '#e3b894', hair: '#4a3626', hairStyle: 'short', hat: '#24386a', hatStyle: 'cap', hatBrim: '#121c38', badge: '#e2e2e2', body: '#33508c', sleeve: '#33508c', legs: '#22335c', bg: '#6a80a0', color: '#c8d6f0' },
    moloch: { name: 'Moloch', skin: '#e9d8c6', hair: null, hairStyle: 'bald', body: '#2c2733', sleeve: '#2c2733', legs: '#1c1a20', collar: '#d8d2c8', bg: '#5a3a4a', color: '#e6c8d8' },
    general: { name: 'General Brandt', skin: '#d9ab86', hair: '#bdbdbd', hat: '#3e4a30', hatStyle: 'cap', hatBrim: '#232a1a', badge: '#e8c54a', body: '#4d5b3a', sleeve: '#4d5b3a', legs: '#3e4a30', bg: '#9b8a5a', color: '#e6dfb0' },
    reporter: { name: 'Reporter', skin: '#e6bf9b', hair: '#5a3b26', hairStyle: 'short', body: '#7b5e3c', sleeve: '#7b5e3c', legs: '#3b3530', bg: '#a66b6b', color: '#f0c8c8' },
    reporter2: { name: 'Reporter', skin: '#d9a77f', hair: '#1f1a17', hairStyle: 'long', body: '#7a3b4a', sleeve: '#7a3b4a', legs: '#2b2427', bg: '#8b6b9a', color: '#f0c8e0' },
    // The masked investigator in the snow (Chapter V's witness): a pale cloth
    // mask for a face, a hat pulled low and a long coat.
    witness: { name: 'Masked Investigator', skin: '#ebe6d8', hair: null, hairStyle: 'bald', hat: '#5b4a35', hatBrim: '#3a2f22', body: '#86704c', sleeve: '#86704c', legs: '#3d3a33', collar: '#6b5838', bg: '#7d7466', color: '#efe6d0' },
    host: { name: 'TV Host', skin: '#eac2a0', hair: '#6b4a2b', hairStyle: 'slick', body: '#2e3b5a', sleeve: '#2e3b5a', legs: '#1f2638', bg: '#4f6a8a', color: '#d0e0ff' },
    laurie: { name: 'Laurie Juspeczyk', skin: '#f2cfb0', hair: '#2b1a14', hairStyle: 'long', body: '#1c1c22', sleeve: '#1c1c22', legs: '#1c1c22', trim: '#f2c94c', bg: '#c7a2c2', color: '#ffd6f0' },
    veidt: { name: 'Adrian Veidt', skin: '#f0d0b2', hair: '#e7cf72', hairStyle: 'slick', body: '#6f4aa6', sleeve: '#6f4aa6', legs: '#3d2a5e', cape: '#d4ad3a', trim: '#d4ad3a', bg: '#d6b85a', collar: '#d4ad3a', color: '#f3e0a0' },
  };

  const GANG = {
    hats: ['#2d2620', '#3a2f28', '#262a30', '#4a3b2a', '#1f1f24'],
    // A step lighter than the asphalt so they read at night (contrast >= 1.7 on #2b2d33).
    suits: ['#55535c', '#665443', '#46596b', '#705c46', '#5f4b54'],
    skins: ['#e6bf9b', '#d9a77f', '#c98f66', '#f0c9ab', '#a8714c'],
  };
  LOOKS.randomGangster = () => {
    const suit = U.pick(GANG.suits);
    return { name: 'Gangster', skin: U.pick(GANG.skins), hat: U.pick(GANG.hats), hatBrim: '#17130f', body: suit, sleeve: suit, legs: '#1d1b1c', bg: '#6a5a4a' };
  };

  class NPC extends DM.Entity {
    constructor(o) {
      super({ x: o.x, y: o.y, r: 13, mass: 40, friction: 10, disintegratable: false, team: 'neutral' });
      this.look = typeof o.look === 'string' ? LOOKS[o.look] : o.look;
      this.facing = o.facing || 0;
      this.baseFacing = this.facing;
      this.walk = 0;
      this.moving = false;
      this.speedBase = o.speed || 120;
      this.lookAtPlayer = o.lookAtPlayer !== false;
      this.moveTarget = null;
      if (o.talk) {
        const first = (this.look.name || 'them').split(' ')[0];
        this.interact = { label: o.label || 'Talk to ' + first, range: o.range || 62, onInteract: o.talk, enabled: o.enabled };
      }
    }
    walkTo(x, y) {
      this.moveTarget = { x, y };
    }
    update(dt, world) {
      if (this.moveTarget) {
        const d = U.dist(this.x, this.y, this.moveTarget.x, this.moveTarget.y);
        if (d < 6) {
          this.moveTarget = null;
        } else {
          const n = U.norm(this.moveTarget.x - this.x, this.moveTarget.y - this.y);
          this.vx = U.damp(this.vx, n.x * this.speedBase, 8, dt);
          this.vy = U.damp(this.vy, n.y * this.speedBase, 8, dt);
          this.facing = U.dampAngle(this.facing, Math.atan2(n.y, n.x), 10, dt);
        }
      }
      this.moving = this.speed > 15;
      if (this.moving) this.walk += dt * this.speed * 0.09;
      if (!this.moveTarget) {
        const p = world.player;
        if (this.lookAtPlayer && p && !p.hidden && U.dist(this.x, this.y, p.x, p.y) < 180) this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, p.x, p.y), 6, dt);
        else this.facing = U.dampAngle(this.facing, this.baseFacing, 3, dt);
      }
    }
    render(ctx) {
      Gfx.figure(ctx, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.moving }));
    }
  }

  // ---- Officers ---------------------------------------------------------------
  // A police officer pinned down behind cover (Chapter II's pier). He crouches
  // behind a car, now and then rises to fire back over it, and gunmen target
  // him just as they target Jon (team 'player', targetable). A bullet that
  // finds him while he is down behind the car does half damage. At 0 hp he is
  // wounded, never killed: he lies where he fell, out of the fight, and calls
  // o.onWound(officer). His shots only keep heads down (they do no damage), so
  // the spared/gone ledger stays Jon's alone.
  const rnd = (a, b) => (DM.rng && DM.rng.range ? DM.rng.range(a, b) : U.rand(a, b));
  const OFFICER_HIT = ["I'm hit!", 'Officer down!', 'Agh— my arm!', "They got me, Cap'!"];
  const OFFICER_FIRE = ['Stay down!', 'Police! Drop it!', "Keep 'em pinned!", 'Get back!'];

  class Officer extends NPC {
    constructor(o) {
      super(Object.assign({ look: 'cop', lookAtPlayer: false }, o));
      this.team = 'player';
      this.targetable = true;
      this.static = true; // he holds his cover
      this.hp = this.maxHp = o.hp || 30;
      this.cover = this.facing; // the way he fires, over the car
      this.down = false;
      this.peekT = 0; // > 0 while he is up and firing
      this.peekCd = rnd(1.2, 3);
      this.shot = false;
      this.muzzleT = 0;
      this.foe = null;
      this.scanT = 0;
      this.onWound = o.onWound || null;
    }
    // The nearest gunman still standing that he can see.
    scan(world) {
      let best = null, bd = 560;
      for (const e of world.entities) {
        if (e.dead || e.ko || e.team !== 'enemy' || !e.human || e.yielded || e.isProjectile) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < bd && world.los(this.x, this.y, e.x, e.y)) {
          bd = d;
          best = e;
        }
      }
      return best;
    }
    update(dt, world) {
      if (this.muzzleT > 0) this.muzzleT -= dt;
      if (this.down) return;
      if (world.ceasefire) {
        this.peekT = 0;
        this.facing = U.dampAngle(this.facing, this.cover, 4, dt);
        return;
      }
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 0.3;
        this.foe = this.scan(world);
      }
      const foe = this.foe && !this.foe.dead && !this.foe.ko ? this.foe : null;
      if (this.peekT > 0) {
        this.peekT -= dt;
        if (foe) this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, foe.x, foe.y), 10, dt);
        if (this.shot && this.peekT < 0.4) {
          this.shot = false;
          if (foe) this.fire(world, foe);
        }
        return;
      }
      this.facing = U.dampAngle(this.facing, this.cover, 4, dt);
      this.peekCd -= dt;
      if (this.peekCd <= 0 && foe) {
        this.peekT = 0.8;
        this.shot = true;
        this.peekCd = rnd(2.6, 4.6);
      }
    }
    // Over their heads: aimed a little wide, and harmless.
    fire(world, foe) {
      const side = rnd(0, 1) < 0.5 ? -1 : 1;
      const a = U.angleTo(this.x, this.y, foe.x, foe.y) + side * rnd(0.1, 0.22);
      const mx = this.x + Math.cos(a) * 18, my = this.y + Math.sin(a) * 18;
      if (DM.Proj && DM.Proj.Bullet) world.add(new DM.Proj.Bullet({ x: mx, y: my, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, team: 'player', dmg: 0, color: '#ffe6b0', kind: 'warning' }));
      world.particles.burst(mx, my, 4, { color: ['#fff2c4', '#ffd27a'], speed: [60, 160], life: [0.05, 0.12], size: [2, 4], angle: a, spread: 0.6 });
      this.muzzleT = 0.06;
      DM.Audio.play('shot');
      if (rnd(0, 1) < 0.25) world.bark(this, U.pick(OFFICER_FIRE), 1.4);
    }
    damage(amount, source, kind) {
      if (this.down || this.hp == null) return false;
      if (this.peekT <= 0 && kind === 'bullet') amount *= 0.5; // the car takes some of it
      this.hp -= amount;
      this.hitFlash = 0.12;
      if (this.hp <= 0) this.wound();
      return true;
    }
    die() {
      this.wound();
    }
    wound() {
      if (this.down) return;
      this.hp = 0;
      this.down = true;
      this.body = false;
      this.targetable = false;
      this.peekT = 0;
      this.koAngle = this.facing + Math.PI;
      if (this.world) this.world.bark(this, U.pick(OFFICER_HIT), 2.2);
      if (this.onWound) this.onWound(this);
    }
    // Already wounded, quietly (a checkpoint reached after he was hit).
    setWounded() {
      this.down = true;
      this.hp = 0;
      this.body = false;
      this.targetable = false;
      this.koAngle = this.facing + Math.PI;
    }
    // A little spill so he never vanishes behind the car at night, and his muzzle flash.
    light() {
      if (this.muzzleT > 0) return { r: 130, i: 0.85, color: '#ffd27a', k: 0.18 };
      return { r: this.down ? 60 : 72, i: this.down ? 0.35 : 0.5 };
    }
    render(ctx, world) {
      if (this.down) {
        Gfx.figure(ctx, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.koAngle, pose: 'down', alpha: 0.9 }));
        return;
      }
      const up = this.peekT > 0;
      Gfx.figure(ctx, Object.assign({}, this.look, {
        x: this.x, y: this.y, angle: this.facing, size: up ? 1 : 0.86, aim: up, gun: up ? 'pistol' : null,
        kick: this.muzzleT > 0 ? 1 : 0, flash: this.hitFlash > 0 ? 0.6 : 0,
      }));
      if (!world.lit) this.renderEmissive(ctx, world);
    }
    renderEmissive(ctx) {
      if (this.muzzleT <= 0 || this.down) return;
      const c = Math.cos(this.facing), s = Math.sin(this.facing);
      Gfx.glow(ctx, this.x + c * 24, this.y + s * 24, 16, '#ffe2a0', 0.9);
    }
  }

  DM.LOOKS = LOOKS;
  DM.NPC = NPC;
  DM.Officer = Officer;
})();
