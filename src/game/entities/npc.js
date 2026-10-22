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
    general: { name: 'General Brandt', skin: '#d9ab86', hair: '#bdbdbd', hat: '#3e4a30', hatStyle: 'cap', hatBrim: '#232a1a', badge: '#e8c54a', body: '#4d5b3a', sleeve: '#4d5b3a', legs: '#3e4a30', bg: '#9b8a5a', color: '#e6dfb0' },
    reporter: { name: 'Reporter', skin: '#e6bf9b', hair: '#5a3b26', hairStyle: 'short', body: '#7b5e3c', sleeve: '#7b5e3c', legs: '#3b3530', bg: '#a66b6b', color: '#f0c8c8' },
    reporter2: { name: 'Reporter', skin: '#d9a77f', hair: '#1f1a17', hairStyle: 'long', body: '#7a3b4a', sleeve: '#7a3b4a', legs: '#2b2427', bg: '#8b6b9a', color: '#f0c8e0' },
    host: { name: 'TV Host', skin: '#eac2a0', hair: '#6b4a2b', hairStyle: 'slick', body: '#2e3b5a', sleeve: '#2e3b5a', legs: '#1f2638', bg: '#4f6a8a', color: '#d0e0ff' },
    laurie: { name: 'Laurie Juspeczyk', skin: '#f2cfb0', hair: '#2b1a14', hairStyle: 'long', body: '#1c1c22', sleeve: '#1c1c22', legs: '#1c1c22', trim: '#f2c94c', bg: '#c7a2c2', color: '#ffd6f0' },
    veidt: { name: 'Adrian Veidt', skin: '#f0d0b2', hair: '#e7cf72', hairStyle: 'slick', body: '#6f4aa6', sleeve: '#6f4aa6', legs: '#3d2a5e', cape: '#d4ad3a', trim: '#d4ad3a', bg: '#d6b85a', collar: '#d4ad3a', color: '#f3e0a0' },
  };

  const GANG = {
    hats: ['#2d2620', '#3a2f28', '#262a30', '#4a3b2a', '#1f1f24'],
    suits: ['#3b3a3f', '#4b3f36', '#2f3a45', '#5a4a3a', '#43363b'],
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

  DM.LOOKS = LOOKS;
  DM.NPC = NPC;
})();
