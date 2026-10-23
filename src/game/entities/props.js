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
      this.rot = o.rot != null ? o.rot : U.rand(0, Math.PI);
      this.style = o.style || 'wood';
      this.mark = o.mark || null; // 'v': a stencilled gold V
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
        if (this.mark) {
          Gfx.line(ctx, -s / 2, -s / 6, s / 2, -s / 6);
          Gfx.line(ctx, -s / 2, s / 6, s / 2, s / 6);
        } else {
          Gfx.line(ctx, -s / 2, -s / 2, s / 2, s / 2);
          Gfx.line(ctx, -s / 2, s / 2, s / 2, -s / 2);
        }
      }
      if (this.mark === 'v') {
        // A contractor's mark, stencilled in gold.
        ctx.strokeStyle = '#2a2016';
        ctx.lineWidth = 5.5;
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.28);
        ctx.lineTo(0, s * 0.3);
        ctx.lineTo(s * 0.3, -s * 0.28);
        ctx.stroke();
        ctx.strokeStyle = '#e2b93e';
        ctx.lineWidth = 3.2;
        ctx.stroke();
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

  const TAU = Math.PI * 2;
  const reducedFlashing = () => !!(DM.SettingsSchema && DM.SettingsSchema.reducedFlashing && DM.SettingsSchema.reducedFlashing());

  // ---- Counterfeit press (Chapter II's warehouse) ------------------------------------
  // Heavy, static and breakable: hp 220, so Disintegrate takes four presses of Q,
  // and thrown things and blasts wear it down. Broken by damage it stays as a dead
  // machine in a drift of spoiled banknotes; unmade, it is simply gone. Either
  // way it stops, once, and calls o.onStop(press, kind).
  const BILLS = ['#dfe9cf', '#bcd3a6', '#eef4e4', '#a6c494'];

  class Press extends Entity {
    constructor(x, y, o = {}) {
      super(Object.assign({ x, y, r: 26, static: true, mass: 20, hp: 220, colors: ['#46564a', '#2e3832', '#7d8a80', '#dfe9cf'], tags: ['press'] }, o));
      this.rot = o.rot || 0;
      this.broken = false;
      this.stopped = false;
      this.onStop = o.onStop || null;
      this.t = U.rand(0, 10);
      this.litter = null; // [x, y, rot, colour] for each banknote around a wreck
    }
    update(dt, world) {
      if (!this.stopped) {
        this.t += dt;
        return;
      }
      // A wreck smoulders for a while.
      if (this.broken && this.age - this.stopAge < 7 && Math.random() < dt * 3) {
        world.particles.emit(this.x + U.rand(-14, 14), this.y + U.rand(-10, 10), { vx: U.rand(-8, 8), vy: U.rand(-30, -14), life: 1.4, size: 5, size1: 14, color: '#2e2a28', shape: 'smoke', add: false, alpha: 0.5, drag: 0.6 });
      }
    }
    die(kind, source) {
      if (kind === 'disintegrate') {
        this.stop(kind);
        return super.die(kind, source);
      }
      if (this.broken) return;
      this.broken = true;
      this.hp = null; // a wreck takes no more damage (Disintegrate still unmakes it)
      this.stop(kind);
    }
    stop(kind) {
      if (this.stopped) return;
      this.stopped = true;
      this.stopAge = this.age;
      const w = this.world;
      if (w) {
        // The paper it was printing goes everywhere.
        w.particles.burst(this.x, this.y, 56, { color: BILLS, speed: [50, 260], life: [1.2, 2.8], size: [4, 7], add: false, drag: 2.4, alpha: 0.95 });
        if (kind !== 'disintegrate') {
          w.particles.burst(this.x, this.y, 18, { color: ['#ffd27a', '#fff2c4', '#ff9a3c'], speed: [80, 320], life: [0.15, 0.4], size: [1.5, 3], shape: 'spark', drag: 3 });
          w.particles.burst(this.x, this.y, 8, { color: ['#2a2522', '#3a332e'], speed: [20, 70], life: [0.8, 1.6], size: [8, 14], size1: 22, shape: 'smoke', add: false, drag: 2, alpha: 0.6 });
          w.camera.shake(0.3);
          this.scatter();
        }
      }
      DM.Audio.play('press_break');
      if (this.onStop) this.onStop(this, kind);
    }
    // Spoiled notes on the floor around the wreck (the same drift every time).
    scatter() {
      const rnd = U.seeded(Math.round(this.x * 7 + this.y * 13));
      this.litter = [];
      for (let i = 0; i < 28; i++) {
        const a = rnd() * TAU, d = 30 + rnd() * 64;
        this.litter.push([this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.8, rnd() * Math.PI, BILLS[(rnd() * BILLS.length) | 0]]);
      }
    }
    // Already a wreck, quietly (a checkpoint reached after it was shut down).
    setBroken() {
      if (this.stopped) return;
      this.stopped = this.broken = true;
      this.stopAge = -99;
      this.hp = null;
      this.scatter();
    }
    // A small green lamp while it runs.
    light() {
      return this.stopped ? null : { r: 80, i: 0.45, color: '#8fe09a', k: 0.1 };
    }
    render(ctx, world) {
      const t = this.t, L = 66, W = 40;
      if (this.litter) {
        for (const [x, y, r, c] of this.litter) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(r);
          ctx.fillStyle = c;
          ctx.fillRect(-5, -2.6, 10, 5.2);
          ctx.fillStyle = 'rgba(60,90,50,0.45)';
          ctx.fillRect(-2, -1.2, 4, 2.4);
          ctx.restore();
        }
      }
      ctx.save();
      const j = this.stopped ? 0 : Math.sin(t * 38) * 0.6; // it shudders as it runs
      ctx.translate(this.x + j, this.y);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(-L / 2 + 4, -W / 2 + 5, L, W);
      ctx.rotate(this.rot);
      ctx.fillStyle = '#e9eadf'; // paper waiting at the feed
      ctx.fillRect(-L / 2 - 9, -W / 2 + 8, 14, W - 16);
      ctx.fillStyle = this.broken ? '#2f3530' : '#46564a';
      Gfx.rr(ctx, -L / 2, -W / 2, L, W, 5);
      ctx.fill();
      ctx.strokeStyle = DM.C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const x = -L / 2 + 13 + i * 14;
        ctx.fillStyle = this.broken ? '#4d5550' : '#7d8a80';
        ctx.fillRect(x - 5, -W / 2 + 3, 10, W - 6);
        // Highlights roll along the drums while it runs.
        ctx.fillStyle = 'rgba(255,255,255,0.26)';
        const off = this.stopped ? 3 : (t * 40 + i * 5) % 10;
        for (let y = -W / 2 + 3 + off; y < W / 2 - 4; y += 10) ctx.fillRect(x - 5, y, 10, 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 5, -W / 2 + 3, 10, W - 6);
      }
      ctx.fillStyle = '#bcd3a6'; // a stack of fresh notes
      ctx.fillRect(L / 2 - 17, -W / 2 + 8, 13, W - 16);
      ctx.strokeStyle = 'rgba(40,60,30,0.6)';
      for (let k = 0; k < 3; k++) Gfx.line(ctx, L / 2 - 17, -W / 2 + 12 + k * 6, L / 2 - 4, -W / 2 + 12 + k * 6);
      if (!this.stopped) {
        const k = (t * 1.6) % 1;
        ctx.fillStyle = '#e4ecd6';
        ctx.fillRect(L / 2 - 20 + k * 20, -5, 10, 10);
      }
      if (this.broken) {
        ctx.strokeStyle = 'rgba(10,8,6,0.8)';
        ctx.lineWidth = 1.5;
        Gfx.line(ctx, -L / 2 + 6, -W / 2 + 4, -4, 3);
        Gfx.line(ctx, -4, 3, 10, -6);
        Gfx.line(ctx, 10, -6, L / 2 - 8, W / 2 - 5);
      }
      if (this.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(-L / 2, -W / 2, L, W);
      }
      ctx.restore();
      if (!world.lit) this.renderEmissive(ctx, world);
    }
    // The status lamp, and close up, a name tag (it is optional work).
    renderEmissive(ctx, world) {
      if (this.stopped || this.dead) return;
      const c = Math.cos(this.rot), s = Math.sin(this.rot);
      const lx = this.x + c * -27 - s * 14, ly = this.y + s * -27 + c * 14;
      const on = reducedFlashing() || Math.sin(this.t * 6) > -0.2;
      ctx.fillStyle = on ? '#7dff8a' : '#2e6a36';
      Gfx.circle(ctx, lx, ly, 3);
      ctx.fill();
      if (on) Gfx.glow(ctx, lx, ly, 10, '#7dff8a', 0.6);
      const p = world.player;
      if (p && U.dist(p.x, p.y, this.x, this.y) < 260) {
        Gfx.text(ctx, 'COUNTERFEIT PRESS', this.x, this.y - 36, { size: 11, color: 'rgba(205,240,195,0.9)', align: 'center', spacing: 2, weight: 600, stroke: 'rgba(8,12,20,0.85)', strokeWidth: 3 });
      }
    }
  }

  // ---- The getaway car (Chapter II) --------------------------------------------------
  // A sedan that drives itself along o.route (waypoints) once go() is called.
  // Lifting it with telekinesis catches it for good: the engine dies. Once it
  // is caught and has come to rest (or is wrecked), its driver gives up. Unmade
  // (one press of Disintegrate does it), the driver goes with it. Reaching the
  // last waypoint is an escape. o.onOutcome(kind, car) hears 'caught' (lifted:
  // the chase is over, the story is not), then exactly one of 'arrested',
  // 'sunk' (thrown into water), 'gone' or 'escaped'.
  class Getaway extends Vehicle {
    constructor(x, y, o = {}) {
      super(x, y, Object.assign({ kind: 'sedan', paint: '#6b2433', mass: 5, hp: 400 }, o));
      this.alwaysDisintegrate = true;
      this.isGetaway = true;
      this.route = o.route || [];
      this.leg = 0;
      this.topSpeed = o.speed || 170;
      this.throttle = 0;
      this.state = 'parked'; // parked | driving | caught | done
      this.restT = 0;
      this.stuckT = 0;
      this.swerve = 1;
      this.swerveT = 0;
      this.onOutcome = o.onOutcome || null;
    }
    go() {
      if (this.state !== 'parked') return;
      this.state = 'driving';
      this.friction = 0.4; // the engine, not the road, sets its speed now
    }
    end(kind) {
      if (this.state === 'done') return;
      this.state = 'done';
      this.outcome = kind;
      this.friction = 4;
      DM.Audio.hum('getaway', false);
      if (this.onOutcome) this.onOutcome(kind, this);
    }
    onGrab(p, world) {
      if (this.state !== 'driving' && this.state !== 'parked') return;
      this.state = 'caught';
      this.friction = 4;
      DM.Audio.hum('getaway', false);
      if (world) world.bark(this, 'Hey— HEY! Put me down!', 1.8);
      if (this.onOutcome) this.onOutcome('caught', this);
    }
    onSink(world) {
      if (this.state === 'done') return;
      this.end('sunk');
      world.defer(() => (this.dead = true));
    }
    onDeath(kind, source) {
      super.onDeath(kind, source);
      this.end(kind === 'disintegrate' ? 'gone' : 'arrested'); // a wreck throws its driver clear
    }
    update(dt, world) {
      super.update(dt, world);
      if (this.state === 'driving') this.drive(dt, world);
      else if (this.state === 'caught') {
        if (!this.heldBy && this.speed < 24) {
          this.restT += dt;
          if (this.restT > 0.35) this.end('arrested');
        } else this.restT = 0;
      }
    }
    drive(dt, world) {
      if (this.heldBy) return;
      if (world.ceasefire) {
        // Dialogue and cutscenes: the world holds its breath, and so does he.
        this.vx = U.damp(this.vx, 0, 8, dt);
        this.vy = U.damp(this.vy, 0, 8, dt);
        DM.Audio.hum('getaway', false);
        return;
      }
      const wp = this.route[this.leg];
      if (!wp) {
        this.end('escaped');
        this.dead = true; // out of the gate and away
        return;
      }
      let n = U.norm(wp.x - this.x, wp.y - this.y);
      if (n.l < 28) {
        this.leg++;
        return;
      }
      this.throttle = Math.min(1, this.throttle + dt * 0.7);
      const want = this.topSpeed * this.throttle;
      // Blocked (a car thrown across the road, Jon standing in it): swerve around.
      if (this.throttle > 0.6 && this.speed < want * 0.3) this.stuckT += dt;
      else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.stuckT > 0.8) {
        this.swerve = -this.swerve;
        this.swerveT = 1.1;
        this.stuckT = 0;
      }
      if (this.swerveT > 0) {
        this.swerveT -= dt;
        n = U.norm(n.x - n.y * this.swerve * 1.3, n.y + n.x * this.swerve * 1.3);
      }
      this.vx = U.damp(this.vx, n.x * want, 4, dt);
      this.vy = U.damp(this.vy, n.y * want, 4, dt);
      if (this.speed > 20) this.rot = U.dampAngle(this.rot, Math.atan2(this.vy, this.vx), 5, dt);
      const c = Math.cos(this.rot), s = Math.sin(this.rot);
      if (Math.random() < dt * 14) {
        world.particles.emit(this.x - c * this.r * 1.3, this.y - s * this.r * 1.3, { vx: -c * 30 + U.rand(-10, 10), vy: -s * 30 + U.rand(-10, 10), life: 0.7, size: 4, size1: 10, color: '#4a4a52', shape: 'smoke', add: false, alpha: 0.45, drag: 1.5 });
      }
      const p = world.player;
      const near = p ? U.clamp(1.2 - U.dist(p.x, p.y, this.x, this.y) / 900, 0, 1) : 0;
      DM.Audio.hum('getaway', near > 0.02, { type: 'sawtooth', freq: 46 + this.speed * 0.2, type2: 'square', freq2: 23 + this.speed * 0.1, cutoff: 360, gain: 0.05 * near, mod: Math.min(1.5, this.speed / 220) });
    }
  }

  // ---- Open water -------------------------------------------------------------------
  // Water whose bank is its top edge (the pier's river), laid over a 'water'
  // wall so nobody walks in. Something thrown or blasted into it splashes in
  // instead of bouncing off the bank: objects sink, and people are knocked out
  // (never drowned: the ledger counts them spared) and fished back out onto
  // the bank a moment later, where o.onFished(e, world) hears of it. An
  // entity's own onSink(world, water) replaces all of that (the getaway car).
  class Water extends Entity {
    constructor(x, y, w, h, o = {}) {
      super({ x: x + w / 2, y: y + h / 2, r: 1, static: true, body: false, solid: false, disintegratable: false, layer: 0 });
      this.rect = { x, y, w, h };
      this.bank = o.bank == null ? y - 34 : o.bank;
      this.under = []; // { e, t, x }: people waiting to be fished out
      this.onFished = o.onFished || null;
      this.onSplash = o.onSplash || null;
    }
    update(dt, world) {
      const R = this.rect;
      for (const e of world.entities) {
        if (e.dead || e === this || e.static || e.selfMove || e.isPlayer || e.heldBy || e.team === 'player' || e.sinking) continue;
        if (e.x < R.x || e.x > R.x + R.w || !(e.vy > 60)) continue;
        if (!(e.thrown > 0) && e.speed < 220) continue;
        if (e.y + e.r + e.vy * dt < R.y + 2) continue;
        this.splash(world, e);
      }
      for (let i = this.under.length - 1; i >= 0; i--) {
        const u = this.under[i];
        u.t -= dt;
        if (u.t > 0) continue;
        this.under.splice(i, 1);
        const e = u.e;
        e.sinking = false;
        e.x = u.x;
        e.y = this.bank;
        e.vx = e.vy = 0;
        e.thrown = 0;
        if (!world.entities.includes(e)) world.add(e);
        world.particles.burst(e.x, e.y + 6, 12, { color: ['#cfe8ff', '#7fa8d0'], speed: [20, 90], life: [0.3, 0.7], size: [1.5, 3], g: 200, add: false });
        if (DM.FX && DM.FX.FloatText) world.add(new DM.FX.FloatText(e.x, e.y - e.r - 14, 'fished out', { color: '#cfe8ff', dur: 1.6 }));
        if (this.onFished) this.onFished(e, world);
      }
    }
    splash(world, e) {
      e.sinking = true;
      const x = e.x, y = this.rect.y + 12;
      const P = world.particles;
      P.burst(x, y, 26 + Math.min(30, e.r | 0), { color: ['#cfe8ff', '#ffffff', '#7fa8d0'], speed: [90, 300], angle: -Math.PI / 2, spread: 2.2, life: [0.35, 0.8], size: [2, 4.5], g: 700, drag: 0.6, add: false });
      for (let i = 0; i < 2; i++) P.emit(x, y + 10, { shape: 'ring', size: 6 + i * 8, size1: 46 + e.r + i * 20, life: 0.9 + i * 0.3, color: '#cfe8ff', drag: 0, alpha: 0.7 });
      DM.Audio.play('splash', { big: e.r > 20 });
      if (this.onSplash) this.onSplash(e, world);
      if (e.onSink) return e.onSink(world, this);
      if (e.human) {
        if (!e.ko && !e.dead && e.die) e.die('water', this);
        this.under.push({ e, t: 1.6, x: U.clamp(x, this.rect.x + 40, this.rect.x + this.rect.w - 40) });
      }
      // After this frame's updates: lift the person out of the world for now; anything else sinks.
      world.defer((w) => {
        if (!e.human) {
          e.dead = true;
          return;
        }
        const i = w.entities.indexOf(e);
        if (i >= 0) w.entities.splice(i, 1);
      });
    }
    // Bubbles where someone went in, until they are fished out.
    render(ctx, world) {
      if (!this.under.length) return;
      const t = world.realTime || 0;
      ctx.save();
      ctx.strokeStyle = 'rgba(200,230,255,0.55)';
      ctx.lineWidth = 1.2;
      for (const u of this.under) {
        for (let k = 0; k < 3; k++) {
          const f = (t * 1.3 + k / 3) % 1;
          Gfx.circle(ctx, u.x + Math.sin(k * 2.1 + t * 3) * 8, this.rect.y + 30 - f * 10, 2 + f * 3);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  // Sounds for the props above, in the style of the recipes in src/core/audio.js.
  if (DM.Audio && DM.Audio.define) {
    DM.Audio.define('splash', {
      gap: 0.08,
      fn: (a, o) => {
        const k = o && o.big ? 1.4 : 1;
        a.noise({ dur: 0.5 * k, gain: 0.28, ftype: 'lowpass', freq: 2400, freqEnd: 300, attack: 0.005 });
        a.noise({ dur: 0.25, gain: 0.12, ftype: 'bandpass', freq: 900, q: 1.2, delay: 0.04 });
        for (let i = 0; i < 4; i++) a.tone({ freq: 300 + Math.random() * 500, freqEnd: 900 + Math.random() * 600, dur: 0.06, gain: 0.03, type: 'sine', delay: 0.12 + i * 0.07 + Math.random() * 0.04 });
      },
    });
    DM.Audio.define('press_break', {
      gap: 0.2,
      fn: (a) => {
        a.noise({ dur: 0.45, gain: 0.3, ftype: 'bandpass', freq: 1600, freqEnd: 300, q: 1.1 });
        a.tone({ freq: 180, freqEnd: 60, dur: 0.5, gain: 0.16, type: 'square', filter: { freq: 900 } });
        a.tone({ freq: 1250, freqEnd: 900, dur: 0.3, gain: 0.05, type: 'triangle', delay: 0.05 }); // a spring letting go
        a.noise({ dur: 0.12, gain: 0.12, ftype: 'highpass', freq: 3000, delay: 0.18 });
      },
    });
    DM.Audio.define('engine_start', {
      gap: 0.5,
      fn: (a) => {
        a.tone({ freq: 70, freqEnd: 140, dur: 0.35, gain: 0.08, type: 'sawtooth', filter: { freq: 500 } });
        a.tone({ freq: 140, freqEnd: 65, dur: 0.6, gain: 0.1, type: 'sawtooth', filter: { freq: 700 }, delay: 0.3 });
        a.noise({ dur: 0.5, gain: 0.08, ftype: 'lowpass', freq: 500, delay: 0.3 });
      },
    });
  }

  DM.Props = { Crate, Barrel, Vehicle, Prop, Door, Zone, Dummy, Press, Getaway, Water };
})();
