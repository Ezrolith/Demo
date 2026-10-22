/*
 * The player: Jon. One entity across the whole journey, with three forms:
 *   human     — Jon Osterman, 1959. Walks, talks, interacts.
 *   awareness — a lone hydrogen atom drifting through the void, gathering itself.
 *   manhattan — Dr. Manhattan. Uses whatever powers have been unlocked.
 *
 * Powers live in src/game/powers.js; the player just owns their per-power state
 * (this.powers[id]) and calls each power's update every frame.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;

  const SPEED = { human: 165, awareness: 250, manhattan: 215 };

  class Player extends DM.Entity {
    constructor(x, y) {
      super({ x, y, r: 13, mass: 3, friction: 9, team: 'player', disintegratable: false });
      this.isPlayer = true;
      this.timeless = true;
      this.targetable = true;
      this.form = 'human';
      this.look = Object.assign({}, DM.LOOKS.jon);
      this.facing = 0;
      this.walk = 0;
      this.moving = false;

      this.energy = 100;
      this.maxEnergy = 100;
      this.energyRegen = 20;
      this.coherence = 100;
      this.maxCoherence = 100;
      this.regenDelay = 0;

      this.baseR = 13;
      this.scale = 1;
      this.targetScale = 1;
      this.expandT = 0;

      this.powers = {};
      this.locked = false;
      this.hidden = false;
      this.down = false;
      this.invuln = 0;
      this.godMode = false;
      this.hurtT = 0;
      this.jamT = 0;
      this.speedMul = 1;
      this.noEnergyT = 0;

      // awareness form
      this.carry = 0;
      this.carryMax = 25;
      this.basePull = 85;
      this.pullRadius = 85;

      this.interactTarget = null;
    }

    get speedMax() {
      return (SPEED[this.form] || 200) * this.speedMul * (this.scale > 1.3 ? 0.9 : 1);
    }
    get canUsePowers() {
      return !this.locked && !this.down && this.form !== 'human';
    }
    get jammed() {
      return this.jamT > 0;
    }
    tkMaxMass() {
      return this.scale > 1.3 ? 40 : 9;
    }

    unlock(id) {
      if (!this.powers[id]) this.powers[id] = { cd: 0, active: false };
    }
    has(id) {
      return !!this.powers[id];
    }

    setForm(form) {
      this.form = form;
      if (form === 'awareness') {
        this.r = 10;
        this.baseR = 10;
      } else {
        this.baseR = 13;
      }
    }

    // Spend energy for a power; flashes the meter when short.
    spend(amount) {
      if (this.energy < amount) {
        this.noEnergyT = 0.4;
        DM.Audio.play('fail');
        return false;
      }
      this.energy -= amount;
      return true;
    }

    update(dt, world) {
      this.invuln = Math.max(0, this.invuln - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.jamT = Math.max(0, this.jamT - dt);
      this.noEnergyT = Math.max(0, this.noEnergyT - dt);

      this.scale = U.damp(this.scale, this.targetScale, 6, dt);
      this.r = this.baseR * this.scale;
      this.mass = 3 * this.scale * this.scale;

      const ax = this.locked || this.down ? { x: 0, y: 0 } : Input.axis();
      const sp = this.speedMax;
      const accel = this.form === 'awareness' ? 4.5 : 14;
      this.vx = U.damp(this.vx, ax.x * sp, accel, dt);
      this.vy = U.damp(this.vy, ax.y * sp, accel, dt);
      const v = this.speed;
      this.moving = v > 20;
      if (this.moving) this.walk += dt * v * 0.09;

      if (this.form === 'human' || this.locked) {
        if (this.moving) this.facing = U.dampAngle(this.facing, Math.atan2(this.vy, this.vx), 12, dt);
      } else {
        this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, world.mouse.x, world.mouse.y), 14, dt);
      }

      // Channelled powers set this.drain and slow energy regen to their
      // channelRegen while active (telekinesis 0.5, Temporal Sight 0.4, Coalesce 0).
      this.drain = false;
      this.regenMul = 1;
      this.reticleFail = Math.max(0, (this.reticleFail || 0) - dt);
      for (const def of DM.Powers.list) {
        const st = this.powers[def.id];
        if (!st || !def.forms.includes(this.form)) continue;
        st.cd = Math.max(0, st.cd - dt);
        def.update(this, st, world, dt);
        if (st.active && def.channelRegen != null) this.regenMul = Math.min(this.regenMul, def.channelRegen);
      }
      if (this.drain && this.regenMul === 1) this.regenMul = 0; // a drain that declares no rate stops regen
      this.powerFrame = DM.Powers.frame; // powers saw this frame's presses (see Powers.latch)
      const regen = this.energyRegen * this.regenMul * (this.jammed ? 0.35 : 1);
      this.energy = U.clamp(this.energy + regen * dt, 0, this.maxEnergy);

      // coherenceRegen: recovery per second, set per challenge level (settings.js).
      if (this.regenDelay > 0) this.regenDelay -= dt;
      else if (!this.down) this.coherence = Math.min(this.maxCoherence, this.coherence + (this.coherenceRegen ?? 9) * dt);

      if (this.expandT > 0) {
        this.expandT -= dt;
        if (this.expandT <= 0) {
          this.targetScale = 1;
          world.camera.targetZoom = world.baseZoom;
        }
      }

      // Low coherence: Jon starts shedding particles.
      if (this.form === 'manhattan' && this.coherence < 35 && Math.random() < dt * 20) {
        world.particles.emit(this.x + U.rand(-10, 10), this.y + U.rand(-10, 10), { vx: U.rand(-40, 40), vy: U.rand(-40, 40), life: 0.6, size: 2.5, color: '#7fe3ff' });
      }

      this.updateInteraction(world);
    }

    updateInteraction(world) {
      this.interactTarget = null;
      if (this.locked || this.down) return;
      let best = null;
      let bd = Infinity;
      for (const e of world.entities) {
        const it = e.interact;
        if (!it || e.dead) continue;
        if (it.enabled && !it.enabled()) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < (it.range || 60) && d < bd) {
          bd = d;
          best = e;
        }
      }
      this.interactTarget = best;
      if (best && Input.pressed('interact')) {
        Input.consume('interact');
        Input.consume('confirm');
        best.interact.onInteract(best, this);
      }
    }

    damage(amount, source, kind) {
      if (this.invuln > 0 || this.down || this.godMode || this.form === 'human') return false;
      if (this.scale > 1.4 && (kind === 'bullet' || kind === 'pulse')) amount *= 0.15;
      this.coherence -= amount;
      this.regenDelay = 2.6;
      this.hurtT = 0.25;
      DM.Audio.play('hit');
      if (this.world) this.world.camera.shake(Math.min(0.5, 0.12 + amount / 80));
      if (this.coherence <= 0) {
        this.coherence = 0;
        this.down = true;
        this.vx = this.vy = 0;
        DM.Events.emit('player:down', this);
      }
      return true;
    }

    // Thrown objects never hurt their thrower.
    onImpact() {}

    render(ctx, world) {
      if (this.hidden) return;
      const t = this.age;
      if (this.form === 'human') {
        Gfx.figure(ctx, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.moving }));
      } else if (this.form === 'awareness') {
        ctx.save();
        ctx.strokeStyle = 'rgba(127,227,255,0.18)';
        ctx.setLineDash([4, 8]);
        ctx.lineDashOffset = -t * 20;
        ctx.lineWidth = 1.5;
        Gfx.circle(ctx, this.x, this.y, this.pullRadius);
        ctx.stroke();
        ctx.restore();
        Gfx.awareness(ctx, this.x, this.y, t, 1 + Math.min(0.6, this.carry / 60), this.invuln > 0 ? 0.5 + Math.sin(t * 40) * 0.3 : 1);
      } else {
        let alpha = 1;
        if (this.coherence < 35) alpha = 0.65 + Math.random() * 0.35;
        if (this.down) alpha = 0.4;
        Gfx.manhattan(ctx, { x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.moving, scale: this.scale, t, alpha, flash: this.hurtT * 3 });
      }
    }

    // Power effects drawn above entities (beams, reticles).
    renderFx(ctx, world) {
      if (this.hidden) return;
      for (const def of DM.Powers.list) {
        const st = this.powers[def.id];
        if (!st || !def.render || !def.forms.includes(this.form)) continue;
        def.render(ctx, this, st, world);
      }
    }
  }

  DM.Player = Player;
})();
