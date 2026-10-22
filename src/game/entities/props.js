/* Props: crates, barrels, vehicles, doors, target zones, training dummies, and generic set dressing. */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Entity = DM.Entity;

  // Rotation that follows motion, so thrown boxes tumble.
  function tumble(e, dt) {
    e.rot = (e.rot || 0) + (e.vx * 0.004 - e.vy * 0.002) * dt * 60 * 0.15;
  }

  class Crate extends Entity {
    constructor(x, y, o = {}) {
      super(Object.assign({ x, y, r: 15, mass: 1.5, friction: 5, hp: 60, grabbable: true, colors: ['#a07a4a', '#7a5a34', '#c49a62'], tags: ['crate'] }, o));
      this.rot = U.rand(0, Math.PI);
      this.style = o.style || 'wood';
    }
    update(dt) {
      tumble(this, dt);
    }
    onDeath(kind) {
      if (kind !== 'disintegrate' && this.world) this.world.particles.burst(this.x, this.y, 16, { color: this.colors, speed: [60, 220], life: [0.4, 0.9], size: [3, 6], shape: 'shard', vr: 12, add: false, drag: 3 });
    }
    render(ctx) {
      const s = this.r * 1.75;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-s / 2 + 3, -s / 2 + 4, s, s);
      ctx.rotate(this.rot);
      if (this.style === 'metal') {
        ctx.fillStyle = '#5d6b4a';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = '#3a4430';
        ctx.lineWidth = 2;
        ctx.strokeRect(-s / 2 + 3, -s / 2 + 3, s - 6, s - 6);
        ctx.fillStyle = '#e8d27a';
        ctx.fillRect(-s / 4, -2, s / 2, 4);
      } else {
        ctx.fillStyle = '#a57d4b';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = '#6e5130';
        ctx.lineWidth = 2;
        ctx.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);
        Gfx.line(ctx, -s / 2, -s / 2, s / 2, s / 2);
        Gfx.line(ctx, -s / 2, s / 2, s / 2, -s / 2);
      }
      if (this.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(-s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }
  }

  class Barrel extends Entity {
    constructor(x, y, o = {}) {
      super(Object.assign({ x, y, r: 12, mass: 1.2, friction: 4, hp: 25, grabbable: true, colors: ['#b8402e', '#7a2a1e', '#e0c060'] }, o));
    }
    onDeath(kind) {
      if (kind === 'disintegrate' || !this.world) return;
      this.world.defer((w) => w.explode(this.x, this.y, 85, 45, { source: this }));
    }
    render(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      Gfx.circle(ctx, this.x + 3, this.y + 4, this.r);
      ctx.fill();
      ctx.fillStyle = this.hitFlash > 0 ? '#ffd0c0' : '#b8402e';
      Gfx.circle(ctx, this.x, this.y, this.r);
      ctx.fill();
      ctx.strokeStyle = '#6e2318';
      ctx.lineWidth = 2;
      Gfx.circle(ctx, this.x, this.y, this.r * 0.65);
      ctx.stroke();
      ctx.fillStyle = '#f2c418';
      ctx.font = Gfx.font(9, DM.FONTS.display, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', this.x, this.y + 1);
    }
  }

  // Vehicles: jeep / sedan / wreck. Heavy, grabbable, great for throwing.
  class Vehicle extends Entity {
    constructor(x, y, o = {}) {
      super(Object.assign({ x, y, r: 26, mass: 5, friction: 4, hp: 400, grabbable: true, colors: ['#556b3a', '#3a4a28', '#222'] }, o));
      this.rot = o.rot || 0;
      this.kind = o.kind || 'jeep';
      this.paint = o.paint || (this.kind === 'sedan' ? U.pick(['#7a2e2e', '#2e4a7a', '#2f2f33', '#6b6b4a']) : '#556b3a');
      this.burnt = this.kind === 'wreck';
    }
    update(dt) {
      if (this.speed > 30) this.rot = U.dampAngle(this.rot, Math.atan2(this.vy, this.vx), 2, dt);
      if (this.heldBy) this.rot += dt * 0.6;
    }
    onDeath(kind) {
      if (kind !== 'disintegrate' && this.world) this.world.defer((w) => w.explode(this.x, this.y, 90, 30, { source: this }));
    }
    render(ctx) {
      const L = this.r * 2.4, W = this.r * 1.35;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-L / 2 + 4, -W / 2 + 5, L, W);
      ctx.rotate(this.rot);
      ctx.fillStyle = '#151515';
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.fillRect(sx * L * 0.3 - 6, sy * W * 0.5 - 4, 12, 8);
      ctx.fillStyle = this.burnt ? '#3a332c' : this.paint;
      Gfx.rr(ctx, -L / 2, -W / 2, L, W, 6);
      ctx.fill();
      ctx.fillStyle = this.burnt ? '#241f1b' : 'rgba(0,0,0,0.25)';
      ctx.fillRect(-L * 0.1, -W / 2 + 3, L * 0.32, W - 6);
      ctx.fillStyle = this.burnt ? '#1b1815' : 'rgba(170,210,230,0.55)';
      ctx.fillRect(L * 0.18, -W / 2 + 4, 6, W - 8);
      if (this.kind === 'jeep') {
        ctx.fillStyle = '#e8e2c8';
        Gfx.circle(ctx, -L * 0.25, 0, 5);
        ctx.fill();
      }
      if (this.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(-L / 2, -W / 2, L, W);
      }
      ctx.restore();
    }
  }

  // Generic set dressing or interactable. Pass draw(ctx, e, world).
  class Prop extends Entity {
    constructor(o) {
      super(Object.assign({ r: 14, static: true, body: false, solid: false, disintegratable: false, layer: 0 }, o));
      this.drawFn = o.draw || null;
      this.data = o.data || {};
    }
    render(ctx, world) {
      if (this.drawFn) this.drawFn(ctx, this, world);
    }
  }

  // A sliding door that toggles a wall rect.
  class Door extends Entity {
    constructor(world, x, y, w, h, o = {}) {
      super({ x: x + w / 2, y: y + h / 2, r: 4, static: true, body: false, solid: false, disintegratable: false, layer: 1 });
      this.rect = { x, y, w, h };
      this.wall = world.wall(x, y, w, h, 'door');
      this.open = !!o.open;
      this.k = this.open ? 1 : 0;
      this.vertical = h > w;
      this.color = o.color || '#8a929c';
      this.stripe = o.stripe || '#f2c418';
      this.wall.noCollide = this.open;
    }
    setOpen(v) {
      if (v === this.open) return;
      this.open = v;
      DM.Audio.play('door');
    }
    update(dt) {
      this.k = U.approach(this.k, this.open ? 1 : 0, dt * 2.6);
      this.wall.noCollide = this.k > 0.55;
    }
    render(ctx) {
      const R = this.rect;
      const k = this.k;
      ctx.save();
      ctx.fillStyle = '#1a1d22';
      ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.fillStyle = this.color;
      if (this.vertical) {
        const half = (R.h / 2) * (1 - k);
        ctx.fillRect(R.x, R.y, R.w, half);
        ctx.fillRect(R.x, R.y + R.h - half, R.w, half);
        ctx.fillStyle = this.stripe;
        if (half > 4) {
          ctx.fillRect(R.x, R.y + half - 4, R.w, 3);
          ctx.fillRect(R.x, R.y + R.h - half + 1, R.w, 3);
        }
      } else {
        const half = (R.w / 2) * (1 - k);
        ctx.fillRect(R.x, R.y, half, R.h);
        ctx.fillRect(R.x + R.w - half, R.y, half, R.h);
        ctx.fillStyle = this.stripe;
        if (half > 4) {
          ctx.fillRect(R.x + half - 4, R.y, 3, R.h);
          ctx.fillRect(R.x + R.w - half + 1, R.y, 3, R.h);
        }
      }
      ctx.restore();
    }
  }

  // A marked area that absorbs accepted entities (crates in the test range).
  class Zone extends Entity {
    constructor(x, y, r, o = {}) {
      super({ x, y, r, static: true, body: false, solid: false, disintegratable: false, layer: 0 });
      this.accept = o.accept || (() => false);
      this.onAccept = o.onAccept || null;
      this.label = o.label || 'TARGET ZONE';
      this.color = o.color || '#f2c418';
      this.pulse = 0;
    }
    update(dt, world) {
      this.pulse = Math.max(0, this.pulse - dt);
      for (const e of world.entities) {
        if (e.dead || e.heldBy || !this.accept(e)) continue;
        if (U.dist(this.x, this.y, e.x, e.y) > this.r - e.r * 0.3) continue;
        e.dead = true;
        this.pulse = 0.6;
        world.particles.burst(e.x, e.y, 30, { color: ['#f2c418', '#ffffff', '#7fe3ff'], speed: [60, 260], life: [0.3, 0.8], size: [2, 4] });
        world.particles.emit(this.x, this.y, { shape: 'ring', size: 10, size1: this.r * 1.2, life: 0.4, color: '#f2c418', drag: 0 });
        DM.Audio.play('objective');
        if (this.onAccept) this.onAccept(e);
      }
    }
    render(ctx, world) {
      const t = world.realTime || 0;
      ctx.save();
      ctx.fillStyle = U.rgba(this.color, 0.08 + this.pulse * 0.3);
      Gfx.circle(ctx, this.x, this.y, this.r);
      ctx.fill();
      ctx.strokeStyle = U.rgba(this.color, 0.85);
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -t * 20;
      Gfx.circle(ctx, this.x, this.y, this.r);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      Gfx.circle(ctx, this.x, this.y, this.r * 0.5);
      ctx.stroke();
      ctx.restore();
      Gfx.text(ctx, this.label, this.x, this.y + this.r + 18, { size: 13, align: 'center', color: U.rgba(this.color, 0.9), spacing: 2, weight: 600 });
    }
  }

  // Training target. Optional rail movement.
  class Dummy extends Entity {
    constructor(x, y, o = {}) {
      super({ x, y, r: 15, static: true, body: true, hp: 1, team: 'target', colors: ['#e8e2d0', '#c4302b', '#6b5a40'], layer: 1 });
      this.baseX = x;
      this.baseY = y;
      this.rail = o.rail || null; // { dx, dy, speed }
      this.phase = U.rand(0, 6);
    }
    update(dt) {
      if (!this.rail) return;
      this.phase += dt * this.rail.speed;
      const s = Math.sin(this.phase);
      this.x = this.baseX + this.rail.dx * s;
      this.y = this.baseY + this.rail.dy * s;
    }
    render(ctx) {
      if (this.rail) {
        ctx.strokeStyle = 'rgba(40,30,20,0.4)';
        ctx.lineWidth = 3;
        Gfx.line(ctx, this.baseX - this.rail.dx, this.baseY - this.rail.dy, this.baseX + this.rail.dx, this.baseY + this.rail.dy);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      Gfx.circle(ctx, this.x + 3, this.y + 4, this.r);
      ctx.fill();
      const cols = ['#e8e2d0', '#c4302b', '#e8e2d0', '#c4302b'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = cols[i];
        Gfx.circle(ctx, this.x, this.y, this.r * (1 - i * 0.24));
        ctx.fill();
      }
    }
  }

  DM.Props = { Crate, Barrel, Vehicle, Prop, Door, Zone, Dummy };
})();
