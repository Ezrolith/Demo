/* A moving machine with a human inside. Components and driver have separate outcomes. */
(function () {
  'use strict';
  const DM = window.DM;
  const S = DM.Summer;
  const K = DM.BonusKit;
  const G = DM.Gfx;
  const U = DM.U;

  class Driver extends DM.NPC {
    constructor(state, x, y) {
      super({ x, y, look: 'summer_driver', lookAtPlayer: true });
      this.state = state;
      this.isSummerHuman = true;
      this.isDriver = true;
      this.inCab = true;
      this.safe = false;
      this.body = false;
      this.hp = 30;
      this.maxHp = 30;
      this.disintegratable = false;
      this.grabbable = false;
      this.mass = 1;
      this.following = false;
      this.interact = { label: 'Help the driver out', range: 90, enabled: () => !this.inCab && !this.safe,
        onInteract: () => {
          this.following = true;
          this.world.bark(this, 'I only wanted them to stop pushing us.');
        } };
    }
    emerge(x, y) {
      this.x = x;
      this.y = y;
      this.inCab = false;
      this.disintegratable = true;
      this.grabbable = true;
    }
    onGrab() {
      this.following = true;
    }
    damage(amount, source, kind) {
      if (this.dead || this.safe || this.inCab) return false;
      if (kind === 'disintegrate') this.disintegrate(this.world, source);
      else this.following = true;
      return true;
    }
    disintegrate(world, source) {
      if (this.dead || this.safe) return;
      this.state.ctx.flags.driverOutcome = 'unmade';
      DM.Events.emit('enemy:down', { enemy: this, human: true, lethal: true, kind: 'disintegrate' });
      DM.Entity.prototype.disintegrate.call(this, world, source);
    }
    update(dt, world) {
      if (this.inCab || this.safe || world.ceasefire) return;
      const exit = this.state.safePoint;
      if (!this.heldBy && U.dist(this.x, this.y, exit.x, exit.y) < 75) {
        this.safe = true;
        this.grabbable = false;
        this.disintegratable = false;
        this.interact = null;
        this.vx = 0;
        this.vy = 0;
        this.state.ctx.flags.driverOutcome = 'spared';
        DM.Events.emit('enemy:down', { enemy: this, human: true, lethal: false, kind: 'rescue' });
        DM.Audio.play('summer_safe');
      } else if (!this.heldBy && this.following) S.move(this, exit, 135, dt, world);
    }
    render(g) {
      if (!this.inCab) super.render(g);
    }
    renderEmissive(g) {
      if (!this.inCab && !this.safe) K.ring(g, this.x, this.y, 20, S.TEAL, 2);
    }
  }

  class TruckPart extends DM.Entity {
    constructor(truck, role, dx, dy, hp) {
      super({ x: truck.x + dx, y: truck.y + dy, r: role === 'cab' ? 30 : 23,
        hp, static: true, body: true, solid: false, team: 'enemy', grabbable: false });
      this.truck = truck;
      this.role = role;
      this.offset = { x: dx, y: dy };
      this.hazard = true;
      this.colors = ['#748170', '#36483e', '#b8b69a'];
    }
    sync() {
      const a = this.truck.facing;
      const o = this.offset;
      this.x = this.truck.x + Math.cos(a) * o.x - Math.sin(a) * o.y;
      this.y = this.truck.y + Math.sin(a) * o.x + Math.cos(a) * o.y;
    }
    update() {
      this.sync();
    }
    damage(amount, source, kind) {
      if (this.dead || this.truck.disabled) return false;
      if (this.role === 'cab' && kind !== 'disintegrate') {
        this.truck.world.bark(this, 'There is someone inside.');
        return false;
      }
      return super.damage(amount, source, kind);
    }
    die(kind, source) {
      if (this.dead) return;
      if (this.role === 'cab' && kind !== 'disintegrate') return;
      this.dead = true;
      if (this.role === 'cab') this.truck.driver.disintegrate(this.world, source);
      this.truck.componentChanged();
      K.burst(this.world, this.x, this.y, S.AMBER);
      DM.Audio.play('summer_metal');
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.truck.disabled || this.dead) return;
      K.ring(g, this.x, this.y, this.role === 'cab' ? 29 : 20, this.role === 'cab' ? '#ebac80' : S.TEAL, 1.5);
      if (this.hitFlash > 0) G.glow(g, this.x, this.y, 43, '#bce9e3', 0.4);
    }
  }

  class GasMortar extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 70, body: false, solid: false, static: true, disintegratable: false });
      this.state = state;
      this.left = 1.5;
      this.hazard = true;
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      if (this.left <= 0) {
        this.dead = true;
        world.add(new S.Gas(this.state, this.x, this.y));
        DM.Audio.play('summer_gas');
      }
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      K.ring(g, this.x, this.y, 60, '#d9c680', 2);
      g.strokeStyle = '#d9c680';
      G.line(g, this.x - 12, this.y, this.x + 12, this.y);
      G.line(g, this.x, this.y - 12, this.x, this.y + 12);
    }
  }

  class RiotTruck extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 165, hp: 420, mass: 100, static: true, body: false, disintegratable: false, team: 'enemy' });
      this.state = state;
      this.ctx = state.ctx;
      this.facing = 0;
      this.phase = 1;
      this.bonusBoss = true;
      this.name = 'THE ARMOURY TRUCK';
      this.title = this.name;
      this.barColor = S.AMBER;
      this.hazard = true;
      this.disabled = false;
      this.timer = 0;
      this.mode = 'move';
      this.modeT = 3;
      this.waterAngle = Math.PI / 2;
      this.lockAngle = 0;
      this.hitT = 0;
      this.mortarT = 8;
      this.ramCount = 0;
      this.driver = new Driver(state, x + 147, y);
      this.parts = [];
    }
    onAdd(world) {
      world.add(this.driver);
      for (const [role, x, y, hp] of [
        ['cannon', -40, 0, 140], ['wheel', -96, -83, 70], ['wheel', 65, -83, 70],
        ['wheel', -96, 83, 70], ['wheel', 65, 83, 70], ['cab', 153, 0, 30]
      ]) this.parts.push(world.add(new TruckPart(this, role, x, y, hp)));
      this.cameraFrame = new K.BossFraming(this.ctx, this, { left: 235, right: 235, top: 235, bottom: 235 });
    }
    componentChanged() {
      const mechanics = this.parts.filter(p => p.role !== 'cab');
      this.hp = mechanics.reduce((sum, p) => sum + (p.dead ? 0 : p.hp), 0);
      if (!this.driver.dead && this.hp > 0) {
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
          this.phase = 2;
          this.world.hitstop(0.2);
          this.world.camera.shake(0.3);
          DM.Audio.play('summer_ram');
          this.ctx.toast('THE DRIVER IS PANICKING', S.AMBER);
          this.mode = 'ramWarn';
          this.modeT = 1.5;
          this.lockAngle = U.angleTo(this.x, this.y, this.world.player.x, this.world.player.y);
        }
        return;
      }
      this.disable();
    }
    disable() {
      if (this.disabled) return;
      this.disabled = true;
      this.hp = 0;
      this.world.boss = null;
      this.cameraFrame.release();
      this.state.change(-10, 'The truck stopped');
      for (const p of this.parts) p.disintegratable = false;
      if (!this.driver.dead) {
        this.driver.emerge(this.x + 210, this.y + 85);
        this.ctx.flags.comedian.cool = 2;
        this.ctx.flags.comedian.silent = false;
        this.world.bark(this.driver, 'I am getting out. Please.');
      }
      DM.Audio.play('summer_metal');
    }
    update(dt, world) {
      if (this.disabled) return;
      this.componentChanged();
      if (this.disabled) return;
      this.cameraFrame.update();
      if (world.ceasefire) return;
      this.timer += dt;
      this.modeT -= dt;
      this.hitT -= dt;
      this.mortarT -= dt;
      const p = world.player;
      const cannon = this.parts.find(part => part.role === 'cannon');
      if (this.mortarT <= 0) {
        this.mortarT = 9;
        world.add(new GasMortar(this.state, p.x, p.y));
      }
      if (this.mode === 'move') {
        const tx = 1000 + Math.cos(this.timer * 0.27) * 310;
        const ty = 650 + Math.sin(this.timer * 0.27) * 145;
        this.x = U.damp(this.x, tx, 0.4, dt);
        this.y = U.damp(this.y, ty, 0.4, dt);
        if (this.modeT <= 0) {
          this.lockAngle = U.angleTo(this.x, this.y, p.x, p.y);
          this.mode = this.phase === 2 ? 'ramWarn' : 'waterWarn';
          this.modeT = 1.3;
        }
      } else if (this.mode === 'waterWarn') {
        this.waterAngle = this.lockAngle - 0.55;
        if (this.modeT <= 0) {
          this.mode = cannon.dead ? 'move' : 'water';
          this.modeT = 2;
          if (!cannon.dead) DM.Audio.play('summer_water');
        }
      } else if (this.mode === 'water') {
        this.waterAngle = this.lockAngle - 0.55 + (2 - this.modeT) * 0.55;
        if (!cannon.dead && this.hitT <= 0) {
          const ex = this.x + Math.cos(this.waterAngle) * 640;
          const ey = this.y + Math.sin(this.waterAngle) * 640;
          if (K.segmentDistance(p.x, p.y, this.x, this.y, ex, ey) < 26 + p.r) {
            p.damage(5, this, 'water');
            p.impulse(Math.cos(this.waterAngle) * 750, Math.sin(this.waterAngle) * 750);
            this.hitT = 0.3;
          }
        }
        if (this.modeT <= 0) {
          this.mode = this.phase === 2 ? 'ramWarn' : 'move';
          this.modeT = this.phase === 2 ? 1.5 : 2.4;
          this.lockAngle = U.angleTo(this.x, this.y, p.x, p.y);
        }
      } else if (this.mode === 'ramWarn') {
        if (this.modeT <= 0) {
          this.mode = 'ram';
          this.modeT = 1.4;
          this.ramCount++;
          DM.Audio.play('summer_ram');
        }
      } else if (this.mode === 'ram') {
        const ax = this.x;
        const ay = this.y;
        this.x = U.clamp(this.x + Math.cos(this.lockAngle) * 270 * dt, 360, world.w - 360);
        this.y = U.clamp(this.y + Math.sin(this.lockAngle) * 270 * dt, 360, world.h - 330);
        if (this.hitT <= 0 && K.segmentDistance(p.x, p.y, ax, ay, this.x, this.y) < 125 + p.r) {
          p.damage(17, this, 'impact');
          p.impulse(Math.cos(this.lockAngle) * 950, Math.sin(this.lockAngle) * 950);
          this.hitT = 0.75;
        }
        if (this.modeT <= 0) {
          this.mode = 'waterWarn';
          this.lockAngle = U.angleTo(this.x, this.y, p.x, p.y);
          this.modeT = 1.3;
        }
      }
      this.facing = U.dampAngle(this.facing, this.mode === 'ram' ? this.lockAngle : 0, 2, dt);
      for (const part of this.parts) part.sync();
      if (this.driver.inCab) {
        this.driver.x = this.parts[5].x;
        this.driver.y = this.parts[5].y;
      }
      // Framing must use the moved chassis, not the previous frame's position.
      this.cameraFrame.update();
    }
    render(g, world) {
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.facing);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      G.rr(g, -174, -90, 360, 200, 20);
      g.fill();
      const steel = g.createLinearGradient(0, -80, 0, 80);
      steel.addColorStop(0, '#65705e');
      steel.addColorStop(0.5, '#3c4b43');
      steel.addColorStop(1, '#222e2a');
      g.fillStyle = steel;
      G.rr(g, -163, -72, 319, 144, 9);
      g.fill();
      g.fillStyle = '#6f7567';
      g.fillRect(-154, -65, 191, 128);
      g.strokeStyle = '#303d34';
      g.lineWidth = 3;
      for (let x = -142; x < 35; x += 17) G.line(g, x, -60, x, 57);
      for (const part of this.parts) {
        if (part.role !== 'wheel') continue;
        const o = part.offset;
        g.fillStyle = part.dead ? '#242727' : '#11191a';
        G.rr(g, o.x - 25, o.y - 15, 50, 30, 7);
        g.fill();
        g.fillStyle = '#767b6d';
        g.fillRect(o.x - 16, o.y - 4, 32, 8);
        if (part.dead) {
          g.strokeStyle = '#aa8156';
          G.line(g, o.x - 24, o.y - 13, o.x + 22, o.y + 13);
        }
      }
      g.fillStyle = '#4d6057';
      G.rr(g, 65, -69, 105, 138, 7);
      g.fill();
      g.fillStyle = this.driver.dead ? '#171e1b' : '#8fbaa5';
      g.fillRect(119, -49, 32, 98);
      g.fillStyle = '#d5b589';
      if (!this.driver.dead && this.driver.inCab) {
        G.circle(g, 136, 20, 8);
        g.fill();
      }
      g.strokeStyle = '#273b34';
      g.lineWidth = 5;
      G.line(g, 134, -50, 134, 48);
      g.fillStyle = '#ced2b0';
      for (let x = -150; x < 160; x += 36) {
        G.circle(g, x, -62, 2);
        g.fill();
        G.circle(g, x, 60, 2);
        g.fill();
      }
      g.fillStyle = '#171c1c';
      g.fillRect(166, -64, 12, 128);
      if (this.phase === 2 || this.disabled) {
        g.strokeStyle = '#1a2420';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(-124, -60);
        g.lineTo(-65, -23);
        g.lineTo(-84, 22);
        g.lineTo(12, 57);
        g.stroke();
      }
      g.restore();
      if (!this.parts[0].dead) {
        g.save();
        g.translate(this.x - Math.cos(this.facing) * 40, this.y - Math.sin(this.facing) * 40);
        g.rotate(this.waterAngle);
        g.fillStyle = '#b6baa0';
        G.circle(g, 0, 0, 26);
        g.fill();
        g.fillStyle = '#788d82';
        g.fillRect(-8, -10, 73, 20);
        g.fillStyle = '#192c2b';
        g.fillRect(56, -7, 10, 14);
        g.restore();
      }
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.disabled) return;
      if (this.mode === 'ramWarn' || this.mode === 'ram') {
        const a = this.lockAngle;
        g.save();
        g.translate(this.x, this.y);
        g.rotate(a);
        g.fillStyle = this.mode === 'ramWarn' ? 'rgba(238,168,91,0.12)' : 'rgba(238,168,91,0.06)';
        g.fillRect(125, -95, 430, 190);
        g.strokeStyle = '#d9a366';
        g.lineWidth = 2;
        g.setLineDash([13, 10]);
        g.strokeRect(125, -95, 430, 190);
        g.setLineDash([]);
        g.restore();
      }
      if ((this.mode === 'waterWarn' || this.mode === 'water') && !this.parts[0].dead) {
        g.save();
        g.translate(this.x, this.y);
        g.rotate(this.waterAngle);
        if (this.mode === 'waterWarn') {
          g.strokeStyle = '#e4bc79';
          g.lineWidth = 2;
          g.setLineDash([8, 11]);
          G.line(g, 0, 0, 640, 0);
          g.setLineDash([]);
        } else {
          const spray = g.createLinearGradient(20, 0, 640, 0);
          spray.addColorStop(0, 'rgba(185,232,230,0.8)');
          spray.addColorStop(0.6, 'rgba(158,211,220,0.45)');
          spray.addColorStop(1, 'rgba(176,219,217,0.05)');
          g.fillStyle = spray;
          g.beginPath();
          g.moveTo(12, -5);
          g.lineTo(640, -42);
          g.quadraticCurveTo(692, 0, 640, 42);
          g.lineTo(12, 5);
          g.fill();
          if (DM.Save.settings.fx !== 'off') {
            g.strokeStyle = 'rgba(218,240,230,0.7)';
            g.lineWidth = 1.3;
            for (let i = 0; i < 32; i++) {
              const x = (i * 63 + world.time * 570) % 620 + 18;
              const y = Math.sin(i * 4.7) * (4 + x * 0.048);
              G.line(g, x, y, x + 11 + x * 0.025, y);
            }
          }
        }
        g.restore();
      }
      G.glow(g, this.x + 170, this.y - 44, 70, '#eed5a5', 0.22);
      G.glow(g, this.x + 170, this.y + 44, 70, '#eed5a5', 0.22);
    }
    light() {
      return { r: 200, i: 0.45, color: '#e8cf9e', k: 0.09 };
    }
  }
  Object.assign(S, { Driver, TruckPart, GasMortar, RiotTruck });
})();
