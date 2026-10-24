/* The Long Summer: encounter-local rules. Nothing here replaces a campaign system. */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const G = DM.Gfx;
  const K = DM.BonusKit;
  const S = DM.Summer = {};
  S.AMBER = '#edb66c';
  S.TEAL = '#92d8cf';
  S.RED = '#ef8568';
  S.alive = e => !e.dead && !e.ko && !e.casualty;

  S.move = function (e, goal, speed, dt, world) {
    const angle = U.angleTo(e.x, e.y, goal.x, goal.y);
    let best = null;
    let score = Infinity;
    for (const offset of [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, 2.2, -2.2]) {
      const a = angle + offset;
      const x = e.x + Math.cos(a) * 44;
      const y = e.y + Math.sin(a) * 44;
      if (!world.isFree(x, y, e.r)) continue;
      const distance = U.dist(x, y, goal.x, goal.y);
      if (distance < score) {
        score = distance;
        best = a;
      }
    }
    const moving = best !== null && U.dist(e.x, e.y, goal.x, goal.y) > 9;
    e.vx = U.damp(e.vx, moving ? Math.cos(best) * speed : 0, 14, dt);
    e.vy = U.damp(e.vy, moving ? Math.sin(best) * speed : 0, 14, dt);
    if (moving) e.facing = best;
    e.moving = moving;
    e.walk += moving ? dt * speed * 0.09 : 0;
  };

  S.tone = function (stats, flags) {
    const killed = (stats.disintegrated || 0) + (flags.comedianCasualties || 0);
    if (flags.heat >= 70 || killed > (stats.spared || 0)) return 'burning';
    if (killed === 0 && flags.heat < 40 && flags.rescued === 6) return 'calm';
    return 'uneasy';
  };

  const HUD_BOTTOM = 190;
  class SummerBossFraming extends K.BossFraming {
    projectionSafe(zoom, x, y, includePlayer = true) {
      if (!super.projectionSafe(zoom, x, y, includePlayer)) return false;
      const p = this.world.player;
      const bottom = (p.y - y + p.r + 28) * zoom + DM.H / 2;
      return !includePlayer || bottom < DM.H - HUD_BOTTOM;
    }
    target(zoom) {
      const p = this.world.player;
      const b = this.boss;
      const w = this.world;
      const e = this.extent;
      const hw = DM.W / 2 / zoom;
      const hh = DM.H / 2 / zoom;
      const minX = Math.max(hw, b.x + e.right - (DM.W / 2 - 38) / zoom, p.x + p.r - (DM.W / 2 - 38) / zoom);
      const maxX = Math.min(w.w - hw, b.x - e.left + (DM.W / 2 - 38) / zoom, p.x - p.r + (DM.W / 2 - 38) / zoom);
      const minY = Math.max(hh, b.y + e.bottom - (DM.H / 2 - 135) / zoom,
        p.y + p.r + 32 - (DM.H / 2 - HUD_BOTTOM) / zoom);
      const maxY = Math.min(w.h - hh, b.y - e.top + (DM.H / 2 - 125) / zoom, p.y - p.r + (DM.H / 2 - 112) / zoom);
      return {
        x: U.clamp(U.lerp(p.x, b.x, 0.35), minX, maxX),
        y: U.clamp(U.lerp(p.y, b.y, 0.35), minY, maxY),
        feasible: minX <= maxX && minY <= maxY,
      };
    }
  }
  S.startReadableCamera = function (ctx) {
    const world = ctx.world;
    const point = { x: ctx.player.x, y: ctx.player.y };
    ctx.fork(function* () {
      while (ctx.world === world && !ctx.done) {
        const p = ctx.player;
        const camera = world.camera;
        const boss = world.boss;
        if (boss && !boss.dead && boss.cameraFrame) {
          boss.cameraFrame.update();
        } else {
          const zoom = camera.zoom;
          point.x = p.x + U.clamp((world.mouse.x - p.x) * 0.12, -70, 70);
          point.y = p.y - 80 / zoom;
          ctx.camTarget = point;
          const screen = camera.toScreen(p.x, p.y);
          if (screen.y + (p.r + 28) * zoom > DM.H - HUD_BOTTOM) {
            camera.snap(point.x, point.y);
          }
        }
        yield;
      }
    });
  };

  class CityState extends DM.Entity {
    constructor(ctx) {
      super({ body: false, solid: false, static: true, disintegratable: false, layer: 100, r: 1 });
      this.ctx = ctx;
      this.hazard = true;
      this.reinforcementT = 0;
      this.waves = 0;
      this.gas = [];
      this.water = [];
      this.reasons = [];
      this.elapsed = 0;
      this.lastCasualty = -Infinity;
      this.shotHeat = 0;
      this.passiveAdded = 0;
      this.fireHeatAdded = 0;
      for (const [key, value] of Object.entries({ heat: 46, rescued: 0, rescuedMask: 0, comedianCasualties: 0, restraints: 0 })) {
        if (!Number.isFinite(ctx.flags[key])) ctx.flags[key] = value;
      }
      ctx.on('enemy:down', ev => {
        if (!ev.human || ev.enemy.world !== this.world) return;
        ev.enemy.summerCounted = ev.lethal ? 'unmade' : 'spared';
        this.change(ev.lethal ? 18 : -7, ev.lethal ? 'A person unmade' : 'A person spared');
      });
    }
    get heat() {
      return this.ctx.flags.heat;
    }
    change(amount, reason) {
      this.ctx.flags.heat = U.clamp(this.heat + amount, 0, 100);
      this.reasons.push({ amount, reason });
      if (this.reasons.length > 24) this.reasons.shift();
    }
    casualty(person) {
      if (person.casualty || person.dead || this.elapsed - this.lastCasualty < 30) return false;
      this.lastCasualty = this.elapsed;
      // A previous knockout is reclassified, not counted twice or called Jon's unmaking.
      if (person.summerCounted === 'spared') this.ctx.stats.spared = Math.max(0, this.ctx.stats.spared - 1);
      person.summerCounted = 'casualty';
      person.casualty = true;
      person.dead = true;
      this.ctx.flags.comedianCasualties++;
      // Autonomous fatalities use the same rate limit as live fire; the ledger updates immediately.
      this.shotHeat += 20;
      this.ctx.toast('A LIFE LOST TO THE COMEDIAN', S.RED);
      K.burst(this.world, person.x, person.y, '#b5a493');
      return true;
    }
    update(dt, world) {
      const p = world.player;
      if (!p) return;
      this.x = p.x;
      this.y = p.y;
      this.gas = this.gas.filter(e => !e.dead);
      const exposed = this.gas.some(e => U.dist(p.x, p.y, e.x, e.y) < e.r);
      p.speedMul = exposed && !world.ceasefire ? 0.58 : 1;
      this.gassed = exposed;
      if (world.ceasefire) return;
      this.elapsed += dt;
      // Escalation is a rate, not an exponential per-cell burst. The opening
      // budget leaves time to read the first instruction before the street boils.
      const fireRate = this.grid && this.elapsed >= 1 ? Math.min(0.5, this.grid.active.size * 0.045) : 0;
      const budget = (this.elapsed <= 30 ? 0.4 : 1.5) * dt;
      const fireHeat = Math.min(budget, fireRate * dt);
      const shotHeat = Math.min(Math.max(0, budget - fireHeat), this.shotHeat);
      this.shotHeat -= shotHeat;
      this.fireHeatAdded += fireHeat;
      this.passiveAdded += fireHeat + shotHeat;
      if (fireHeat + shotHeat > 0) this.change(fireHeat + shotHeat, 'Ambient escalation');
      if (this.grid && this.grid.active.size < 3 && this.ctx.flags.comedian && this.ctx.flags.comedian.disarmed > 0) {
        this.change(-dt * 0.25, 'A quiet street');
      }
      if (world.mapId === 'summer_avenue' && this.heat >= 70 && this.waves < 3) {
        this.reinforcementT += dt;
        if (this.reinforcementT >= 14) {
          this.reinforcementT = 0;
          this.waves++;
          world.add(new Rioter(this, 180, 790 + this.waves * 70, true));
          world.add(new Rioter(this, 1900, 780 + this.waves * 70));
          this.ctx.toast('MORE PEOPLE JOIN THE RIOT', S.AMBER);
        }
      }
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (!this.ctx.hud.gameHudVisible()) return;
      const E = DM.Engine;
      g.save();
      g.setTransform(E.dpr * E.scale, 0, 0, E.dpr * E.scale, E.dpr * E.offX, E.dpr * E.offY);
      if (this.gassed) {
        g.fillStyle = 'rgba(67,70,45,0.19)';
        g.fillRect(0, 0, DM.W, DM.H);
      }
      g.fillStyle = 'rgba(9,12,16,0.88)';
      G.rr(g, 1022, 66, 232, 57, 5);
      g.fill();
      const color = this.heat >= 70 ? S.RED : this.heat < 40 ? S.TEAL : S.AMBER;
      G.text(g, 'CITY HEAT', 1034, 85, { size: 12, color, spacing: 2 });
      G.text(g, Math.round(this.heat).toString(), 1241, 85, { size: 15, color, align: 'right' });
      g.fillStyle = '#34332e';
      g.fillRect(1034, 95, 207, 7);
      g.fillStyle = color;
      g.fillRect(1034, 95, 207 * this.heat / 100, 7);
      g.fillStyle = '#f6e6c7';
      g.fillRect(1034 + 207 * 0.4, 93, 1, 11);
      G.text(g, this.heat < 40 ? 'CALM' : this.heat >= 70 ? 'ESCALATING' : 'ON EDGE', 1034, 116,
        { size: 10, color: '#c4baaa', spacing: 1.2 });
      g.restore();
    }
  }

  class FireGrid extends DM.Entity {
    constructor(state, bounds, seeds) {
      super({ x: bounds.x, y: bounds.y, r: 3000, body: false, solid: false, static: true, disintegratable: false, layer: 0 });
      this.state = state;
      this.bounds = bounds;
      this.cell = 66;
      this.cols = Math.floor(bounds.w / this.cell);
      this.rows = Math.floor(bounds.h / this.cell);
      this.active = new Set();
      this.wet = new Set();
      this.tick = 0;
      this.timer = 0;
      this.nextSpread = 16;
      this.born = new Map();
      this.scorched = new Set();
      this.particleT = 0;
      this.hurtT = 0;
      this.hazard = true;
      this.vented = false;
      this.predicted = new Set();
      for (const [x, y] of seeds) {
        const key = this.key(x, y);
        if (key < 0) continue;
        this.active.add(key);
        this.born.set(key, 0);
        this.scorched.add(key);
      }
      state.grid = this;
    }
    key(x, y) {
      const col = Math.floor((x - this.bounds.x) / this.cell);
      const row = Math.floor((y - this.bounds.y) / this.cell);
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
      return col + row * this.cols;
    }
    point(key) {
      return { x: this.bounds.x + (key % this.cols + 0.5) * this.cell,
        y: this.bounds.y + (Math.floor(key / this.cols) + 0.5) * this.cell };
    }
    valid(key) {
      if (key < 0 || key >= this.cols * this.rows || this.wet.has(key)) return false;
      const p = this.point(key);
      return this.world && this.world.isFree(p.x, p.y, this.cell * 0.42);
    }
    advance(active, tick, at = this.timer, born = this.born) {
      const next = new Set(active);
      if (this.vented || active.size >= 75) return next;
      // One new frontier cell per beat. Every new flame must mature before it
      // propagates, so rescuing someone never starts an exponential fire race.
      const keys = [...active].sort((a, b) => a - b);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[(i + tick) % keys.length];
        if (at - (born.get(key) || 0) < 6) continue;
        const offsets = [1, this.cols, -1, -this.cols];
        for (let j = 0; j < offsets.length; j++) {
          const offset = offsets[(key + tick + j) % 4];
          const candidate = key + offset;
          if (next.has(candidate)) continue;
          if (Math.abs(offset) === 1 && Math.floor(key / this.cols) !== Math.floor(candidate / this.cols)) continue;
          const a = this.point(key);
          const b = this.point(candidate);
          if (!this.valid(candidate) || !this.world.los(a.x, a.y, b.x, b.y)) continue;
          next.add(candidate);
          born.set(candidate, at);
          return next;
        }
      }
      return next;
    }
    predict(seconds = 3) {
      let result = new Set(this.active);
      const born = new Map(this.born);
      let tick = this.tick;
      for (let at = this.nextSpread; at <= this.timer + seconds + 1e-8; at += 5) {
        result = this.advance(result, tick++, at, born);
      }
      return result;
    }
    ignite(x, y) {
      const key = this.key(x, y);
      if (this.valid(key) && !this.active.has(key)) {
        this.active.add(key);
        this.born.set(key, this.timer);
        this.scorched.add(key);
      }
    }
    douse(x, y, radius) {
      let count = 0;
      for (let key = 0; key < this.cols * this.rows; key++) {
        const p = this.point(key);
        if (U.dist(p.x, p.y, x, y) > radius) continue;
        this.wet.add(key);
        if (this.active.delete(key)) count++;
      }
      if (count) this.state.change(-Math.min(10, count * 2), 'Fire extinguished');
      return count;
    }
    vent() {
      if (this.vented) return;
      this.vented = true;
      this.state.ctx.flags.vented = true;
      // Ventilation removes smoke and ends propagation; flames still need to be avoided.
      this.state.change(-8, 'Smoke vented');
      DM.Audio.play('summer_vent');
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.timer += dt;
      while (this.timer + 1e-8 >= this.nextSpread) {
        this.active = this.advance(this.active, this.tick++, this.nextSpread);
        for (const key of this.active) this.scorched.add(key);
        this.nextSpread += 5;
      }
      this.predicted = world.timesight ? this.predict(3) : new Set();
      this.emitEmbers(dt, world);
      const p = world.player;
      const near = this.active.has(this.key(p.x, p.y));
      this.hurtT -= dt;
      if (near && this.hurtT <= 0) {
        p.damage(this.vented ? 4 : 7, this, 'fire');
        this.hurtT = 0.65;
      }
      let distance = 1000;
      for (const key of this.active) {
        const q = this.point(key);
        distance = Math.min(distance, U.dist(p.x, p.y, q.x, q.y));
      }
      DM.Audio.hum('summer-local-fire', distance < 500, {
        kind: 'noise', freq: 210, q: 0.4, gain: 0.014 * U.clamp(1 - distance / 500, 0, 1)
      });
    }
    render(g, world) {
      // Scorches remain after water removes a flame. They are floor detail, not
      // identical flame icons left behind in the hazard pass.
      for (const key of this.scorched) {
        const p = this.point(key);
        const seed = Math.sin(key * 17.37) * 0.5 + 0.5;
        g.fillStyle = 'rgba(14,12,11,0.64)';
        G.ellipse(g, p.x - 4 + seed * 9, p.y + 8, 27 + seed * 8, 17 + seed * 6);
        g.fill();
        g.strokeStyle = 'rgba(107,69,39,0.38)';
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const angle = key + i * 1.71;
          G.line(g, p.x, p.y, p.x + Math.cos(angle) * 38, p.y + Math.sin(angle) * 25);
        }
      }
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      const view = world.camera.view();
      const reduced = DM.SettingsSchema.reducedFlashing();
      const time = reduced || DM.Save.settings.fx === 'off' ? 0 : world.time;
      for (const key of this.active) {
        const p = this.point(key);
        if (p.x < view.x0 - 100 || p.x > view.x1 + 100 || p.y < view.y0 - 100 || p.y > view.y1 + 100) continue;
        const seed = Math.sin(key * 17.37) * 0.5 + 0.5;
        const cx = p.x + Math.sin(key * 3.7) * 12;
        const cy = p.y + Math.cos(key * 2.3) * 8;
        const lift = 36 + seed * 33;
        G.glow(g, cx, cy - 7, 83 + seed * 32, '#e98135', 0.32);
        // Nested translucent tongues share neither a height nor an animation
        // phase. They rise from a ragged bed instead of a row of repeated icons.
        for (let layer = 0; layer < 3; layer++) {
          for (let i = 0; i < 4; i++) {
            const phase = key * 1.83 + i * 2.71 + layer;
            const x = cx + Math.sin(phase) * (24 - layer * 5);
            const sway = Math.sin(time * (2.2 + seed) + phase) * (10 - layer * 2);
            const h = lift * (1.1 - layer * 0.24) * (0.7 + 0.3 * Math.sin(phase + time * 1.7));
            const wide = 16 - layer * 3;
            const flame = g.createLinearGradient(x, cy - h, x, cy + 16);
            const warm = key % 3 === 0 ? '246,151,57' : '248,123,39';
            flame.addColorStop(0, `rgba(${warm},0.03)`);
            flame.addColorStop(0.4, `rgba(${warm},${0.32 + layer * 0.12})`);
            flame.addColorStop(0.83, `rgba(255,207,111,${0.38 + layer * 0.13})`);
            flame.addColorStop(1, 'rgba(255,231,153,0.85)');
            g.fillStyle = flame;
            g.beginPath();
            g.moveTo(x - wide, cy + 14);
            g.bezierCurveTo(x - wide * 1.5, cy - h * 0.25, x + sway - wide, cy - h * 0.52, x + sway, cy - h);
            g.bezierCurveTo(x + sway * 1.6, cy - h * 0.45, x + wide * 1.6, cy - h * 0.17, x + wide, cy + 10);
            g.quadraticCurveTo(x, cy + 22, x - wide, cy + 14);
            g.fill();
          }
        }
        if (!this.vented && DM.Save.settings.fx !== 'off') {
          for (let i = 0; i < 3; i++) {
            const rise = (time * 17 + i * 24 + seed * 53) % 88;
            g.fillStyle = `rgba(72,61,48,${0.13 * (1 - rise / 100)})`;
            G.ellipse(g, cx + Math.sin(time * 0.7 + key + i) * 16, cy - 30 - rise,
              15 + rise * 0.2, 17 + rise * 0.25);
            g.fill();
          }
        }
      }
    }
    emitEmbers(dt, world) {
      if (DM.Save.settings.fx === 'off') return;
      this.particleT -= dt;
      if (this.particleT > 0) return;
      this.particleT = 0.14;
      const view = world.camera.view();
      let visible = 0;
      for (const key of this.active) {
        const p = this.point(key);
        if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
        if (visible++ >= 10) break;
        const phase = world.time * 2 + key;
        world.particles.emit(p.x + Math.sin(phase) * 17, p.y - 13, {
          vx: Math.cos(phase) * 12, vy: -35 - key % 21, life: 1.3, size: 1.8,
          color: key % 2 ? '#ffb752' : '#ef7636', shape: 'spark', drag: 0.2, alpha: 0.65,
        });
        if (!this.vented && key % 2 === 0) {
          world.particles.emit(p.x, p.y - 24, {
            vx: 5, vy: -20, life: 2.2, size: 9, size1: 27, color: '#62584b',
            shape: 'smoke', add: false, alpha: 0.12, drag: 0.1,
          });
        }
      }
    }
    renderFuture(g) {
      for (const key of this.predicted) {
        if (this.active.has(key)) continue;
        const p = this.point(key);
        g.fillStyle = 'rgba(243,184,106,0.16)';
        g.fillRect(p.x - 30, p.y - 30, 60, 60);
        g.strokeStyle = '#e4b979';
        g.lineWidth = 2;
        g.setLineDash([5, 5]);
        g.strokeRect(p.x - 30, p.y - 30, 60, 60);
        g.setLineDash([]);
      }
    }
    light() {
      return null;
    }
  }

  class Puddle extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 120, body: false, solid: false, static: true, disintegratable: false, layer: -1 });
      this.state = state;
      state.water.push(this);
    }
    update(dt, world) {
      if (!world.ceasefire && this.state.grid) this.state.grid.douse(this.x, this.y, this.r);
    }
    render(g, world) {
      g.fillStyle = 'rgba(43,98,115,0.55)';
      G.ellipse(g, this.x, this.y, this.r, this.r * 0.57);
      g.fill();
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      const time = DM.Save.settings.fx === 'off' || DM.SettingsSchema.reducedFlashing() ? 0 : world.time;
      const shine = g.createLinearGradient(this.x - this.r, this.y, this.x + this.r, this.y);
      shine.addColorStop(0, 'rgba(102,171,188,0)');
      shine.addColorStop(0.35, 'rgba(233,161,86,0.24)');
      shine.addColorStop(0.68, 'rgba(126,202,213,0.23)');
      shine.addColorStop(1, 'rgba(102,171,188,0)');
      g.fillStyle = shine;
      G.ellipse(g, this.x, this.y, this.r, this.r * 0.55);
      g.fill();
      g.strokeStyle = 'rgba(181,221,224,0.42)';
      g.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const radius = ((time * 23 + i * 23) % 110) + 8;
        G.ellipse(g, this.x, this.y, radius, radius * 0.55);
        g.stroke();
      }
      // Arcing jets from the broken main land in the same actual dousing pool.
      for (let i = 0; i < 7; i++) {
        const spread = (i - 3) * 25;
        g.strokeStyle = i % 2 ? 'rgba(175,220,231,0.65)' : 'rgba(96,171,198,0.48)';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(this.x, this.y);
        g.quadraticCurveTo(this.x + spread * 0.4, this.y - 86 - Math.sin(time * 3 + i) * 4,
          this.x + spread, this.y + 15 + i % 2 * 12);
        g.stroke();
        G.glow(g, this.x + spread, this.y + 15, 8, '#8ac7d5', 0.12);
      }
    }
  }

  class Hydrant extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 19, grabbable: true, disintegratable: false, mass: 4, friction: 12 });
      this.state = state;
      this.origin = { x, y };
      this.ripped = false;
    }
    onGrab() {
      if (this.ripped) return;
      this.ripped = true;
      this.world.add(new Puddle(this.state, this.origin.x, this.origin.y));
      this.state.change(-4, 'A hydrant opened');
      K.burst(this.world, this.origin.x, this.origin.y, S.TEAL);
      DM.Audio.play('summer_water');
    }
    render(g) {
      g.fillStyle = '#973d31';
      G.rr(g, this.x - 13, this.y - 27, 26, 48, 5);
      g.fill();
      g.fillStyle = '#c98452';
      G.ellipse(g, this.x, this.y - 25, 15, 7);
      g.fill();
      g.fillRect(this.x - 21, this.y - 8, 42, 9);
      g.strokeStyle = '#edba82';
      g.lineWidth = 2;
      G.line(g, this.x - 4, this.y - 18, this.x - 4, this.y + 15);
    }
  }
  class Gas extends DM.Entity {
    constructor(state, x, y) {
      super({ x, y, r: 95, body: false, solid: false, static: true, disintegratable: false, layer: 3 });
      this.state = state;
      this.left = 5;
      this.hazard = true;
      state.gas.push(this);
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      this.x += dt * 8;
      this.y += Math.sin(this.age * 0.7) * dt * 3;
      if (this.left <= 0) this.dead = true;
    }
    light() {
      return { r: this.r * 1.2, i: 0.16, color: '#c6c39a', k: 0.08 };
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      const a = Math.min(1, this.left);
      g.fillStyle = `rgba(165,170,105,${0.13 * a})`;
      for (let i = 0; i < 5; i++) {
        G.ellipse(g, this.x + Math.cos(i * 1.3) * 35, this.y + Math.sin(i * 1.3) * 30, 65, 48);
        g.fill();
      }
      g.strokeStyle = `rgba(219,211,166,${0.15 * a})`;
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse(this.x + Math.sin(i * 2 + this.age) * 25, this.y - 8, 54 + i * 8, 27 + i * 5,
          -0.25, Math.PI * 1.05, Math.PI * 1.83);
        g.stroke();
      }
    }
  }
  class Molotov extends DM.Entity {
    constructor(state, x, y, target) {
      const a = U.angleTo(x, y, target.x, target.y);
      super({ x, y, r: 7, vx: Math.cos(a) * 235, vy: Math.sin(a) * 235, friction: 0.2,
        mass: 0.4, grabbable: true, team: 'enemy', body: false });
      this.state = state;
      this.fuse = 2.6;
      this.isProjectile = true;
      this.hazard = true;
      this.snuffed = false;
    }
    onGrab() {
      this.team = 'player';
      this.fuse = Math.max(1.4, this.fuse);
    }
    update(dt, world) {
      if (world.ceasefire) return;
      if (this.state.water.some(p => U.dist(p.x, p.y, this.x, this.y) < p.r)) {
        this.snuffed = true;
        this.dead = true;
        DM.Audio.play('summer_hiss');
        return;
      }
      if (this.heldBy) return;
      this.fuse -= dt;
      if (this.fuse > 0) return;
      this.dead = true;
      if (this.state.grid) this.state.grid.ignite(this.x, this.y);
      world.explode(this.x, this.y, 78, 18, { source: this, team: this.team });
      DM.Audio.play('summer_glass');
    }
    render(g, world) {
      g.fillStyle = '#80975c';
      g.fillRect(this.x - 4, this.y - 10, 8, 19);
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      G.glow(g, this.x, this.y - 8, 30, '#f3b361', 0.6);
      K.ring(g, this.x, this.y, 12, '#f4be6a', 1.5);
    }
  }

  class Rioter extends DM.Enemies.Gangster {
    constructor(state, x, y, thrower = false) {
      super({ x, y, hp: thrower ? 45 : 35, look: DM.LOOKS.summer_rioter, sight: 470 });
      this.state = state;
      this.thrower = thrower;
      this.isSummerHuman = true;
      this.cool = thrower ? 3 : 1;
      this.leaving = false;
      this.exitPoint = { x: x < 1000 ? 80 : 1920, y: 1030 };
    }
    think(dt, world) {
      if (this.leaving || (this.state.heat < 30 && !this.alerted && !this.target)) {
        this.leaving = true;
        S.move(this, this.exitPoint, 125, dt, world);
        if (U.dist(this.x, this.y, this.exitPoint.x, this.exitPoint.y) < 35) {
          this.die('leave');
          this.dead = true;
        }
        return;
      }
      this.cool -= dt;
      const target = this.target;
      if (!target) return;
      const distance = this.distTo(target);
      this.facing = U.angleTo(this.x, this.y, target.x, target.y);
      if (distance > (this.thrower ? 280 : 48)) S.move(this, target, this.thrower ? 75 : 110, dt, world);
      if (this.cool <= 0 && distance < (this.thrower ? 460 : 65)) {
        if (this.thrower) {
          world.add(new Molotov(this.state, this.x, this.y, target));
          this.cool = 5;
          DM.Audio.play('summer_throw');
        } else {
          target.damage(8, this, 'impact');
          this.cool = 1.6;
          DM.Audio.play('impact');
        }
      }
    }
    light() {
      return this.dead ? null : { r: 85, i: 0.62, color: '#e7b88b', k: 0.09 };
    }
    renderEmissive(g, world) {
      super.renderEmissive(g, world);
      if (this.ko || this.dead) return;
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.facing);
      g.strokeStyle = 'rgba(237,184,128,0.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-10, -9);
      g.quadraticCurveTo(-17, -4, -14, 9);
      g.moveTo(10, -9);
      g.quadraticCurveTo(17, -4, 14, 9);
      g.stroke();
      g.strokeStyle = 'rgba(245,204,155,0.55)';
      g.beginPath();
      g.arc(0, -8, 8, Math.PI * 1.1, Math.PI * 1.95);
      g.stroke();
      g.restore();
    }
    render(g, world) {
      super.render(g, world);
      if (this.thrower && !this.ko) {
        g.fillStyle = '#b4ba71';
        g.fillRect(this.x + 12, this.y - 5, 5, 13);
      }
    }
  }

  class LiveRound extends DM.Entity {
    constructor(state, from, target) {
      const a = U.angleTo(from.x, from.y, target.x, target.y);
      super({ x: from.x, y: from.y, r: 3, body: false, solid: false, team: 'hostile_ally' });
      this.state = state;
      this.selfMove = true;
      this.vx = Math.cos(a) * 430;
      this.vy = Math.sin(a) * 430;
      this.left = 1.8;
      this.isProjectile = true;
      this.hazard = true;
    }
    update(dt, world) {
      if (world.ceasefire) return;
      const nx = this.x + this.vx * dt;
      const ny = this.y + this.vy * dt;
      if (world.shotHit(this.x, this.y, nx, ny) >= 0) this.dead = true;
      for (const e of world.entities) {
        if (this.dead || !e.isSummerHuman || e.dead || e.inCab || e.safe) continue;
        if (K.segmentDistance(e.x, e.y, this.x, this.y, nx, ny) < e.r + 4) {
          this.dead = true;
          if (this.state.casualty(e) && e.isDriver) this.state.ctx.flags.driverOutcome = 'shot';
        }
      }
      this.x = nx;
      this.y = ny;
      this.left -= dt;
      if (this.left <= 0) this.dead = true;
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      g.strokeStyle = '#f3c17c';
      g.lineWidth = 2;
      G.line(g, this.x, this.y, this.x - this.vx * 0.035, this.y - this.vy * 0.035);
    }
  }

  class Comedian extends DM.NPC {
    constructor(state, x, y) {
      super({ x, y, look: 'comedian', lookAtPlayer: false });
      this.state = state;
      this.team = 'player';
      this.body = false;
      this.mass = 2;
      this.grabbable = true;
      this.disarmed = 0;
      this.cool = 0;
      this.aimT = 0;
      this.shots = 0;
      this.silent = false;
      this.target = null;
      this.restrainedThisHold = false;
    }
    onGrab() {
      this.aimT = 0;
      this.target = null;
      if (this.disarmed <= 0) {
        this.state.change(-10, 'The Comedian restrained');
        this.state.ctx.flags.restraints++;
        this.world.bark(this, this.state.ctx.flags.restraints === 1 ? 'Put me down, Jon.' : 'I remember the first time.');
      }
      this.disarmed = 10;
    }
    onRelease() {
      this.disarmed = 10;
      this.cool = 2;
    }
    update(dt, world) {
      if (world.ceasefire || this.heldBy) return;
      this.disarmed = Math.max(0, this.disarmed - dt);
      const p = world.player;
      if (U.dist(this.x, this.y, p.x, p.y) > 210) S.move(this, { x: p.x + 85, y: p.y + 70 }, 145, dt, world);
      else {
        this.vx = U.damp(this.vx, 0, 8, dt);
        this.vy = U.damp(this.vy, 0, 8, dt);
      }
      // Thirty readable seconds also satisfies the twenty-second no-live-fire
      // minimum. The first warning then gives a further 2.2 seconds to respond.
      if (this.silent || this.disarmed > 0 || this.state.elapsed < 30 ||
        this.state.elapsed - this.state.lastCasualty < 30) return;
      if (this.aimT > 0) {
        if (!this.target || this.target.dead || this.target.safe) {
          this.aimT = 0;
          this.target = null;
          return;
        }
        this.facing = U.angleTo(this.x, this.y, this.target.x, this.target.y);
        this.aimT -= dt;
        if (this.aimT <= 0 && this.target && !this.target.dead && !this.target.safe) {
          world.add(new LiveRound(this.state, this, this.target));
          this.state.shotHeat += 3;
          this.shots++;
          DM.Audio.play('summer_shot');
          if (this.shots % 3 === 0) {
            world.add(new Gas(this.state, this.target.x, this.target.y));
            DM.Audio.play('summer_gas');
          }
          this.cool = 4.2;
        }
        return;
      }
      this.cool -= dt;
      if (this.cool > 0) return;
      this.target = world.entities.find(e => e.isSummerHuman && !e.dead && !e.safe && !e.inCab &&
        U.dist(e.x, e.y, this.x, this.y) < 520 && world.los(this.x, this.y, e.x, e.y));
      if (this.target) {
        this.facing = U.angleTo(this.x, this.y, this.target.x, this.target.y);
        this.aimT = 2.2;
        world.bark(this, 'Comedian takes aim');
        DM.Audio.play('summer_aim');
      }
    }
    render(g, world) {
      super.render(g, world);
      g.fillStyle = '#e4c25b';
      G.circle(g, this.x - 5, this.y + 4, 3);
      g.fill();
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.aimT > 0 && this.target && !this.target.dead) {
        const handX = this.x + Math.cos(this.facing) * 25;
        const handY = this.y + Math.sin(this.facing) * 25;
        g.strokeStyle = '#c9b197';
        g.lineWidth = 5;
        G.line(g, this.x, this.y, handX, handY);
        g.strokeStyle = '#222b2e';
        g.lineWidth = 7;
        G.line(g, handX, handY, handX + Math.cos(this.facing) * 13, handY + Math.sin(this.facing) * 13);
        g.strokeStyle = '#d98d5d';
        g.lineWidth = 2.5;
        g.setLineDash([10, 6]);
        G.line(g, this.x, this.y, this.target.x, this.target.y);
        g.setLineDash([]);
      }
      if (K.withinRange(world, this, 135) && this.disarmed > 0) {
        K.label(g, `DISARMED · ${Math.ceil(this.disarmed)}s`, this.x, this.y - 34, S.TEAL, 11);
      }
    }
  }

  class Resident extends DM.NPC {
    constructor(state, x, y, id, waypoints) {
      super({ x, y, look: id % 2 ? 'summer_resident_b' : 'summer_resident', lookAtPlayer: true });
      this.state = state;
      this.residentId = id;
      this.grabbable = true;
      this.body = false;
      this.mass = 1;
      this.escort = false;
      this.safe = false;
      this.waypoints = waypoints;
      this.interact = { label: 'Guide resident to the stairs', range: 65, enabled: () => !this.safe,
        onInteract: () => {
          this.escort = true;
          this.world.bark(this, 'I can see the stairs now.');
        } };
    }
    onGrab() {
      this.escort = true;
    }
    update(dt, world) {
      if (world.ceasefire || this.safe) return;
      if (!this.escort && world.entities.some(e => e.isDuplicate && !e.dead && U.dist(this.x, this.y, e.x, e.y) < 145)) {
        this.escort = true;
        world.bark(this, 'There are two of you. One is enough.');
      }
      const exit = this.state.safePoint;
      if (!this.heldBy && U.dist(this.x, this.y, exit.x, exit.y) < 70) {
        this.safe = true;
        this.grabbable = false;
        this.escort = false;
        this.interact = null;
        this.vx = 0;
        this.vy = 0;
        this.state.ctx.flags.rescued++;
        this.state.ctx.flags.rescuedMask |= 1 << this.residentId;
        DM.Events.emit('enemy:down', { enemy: this, human: true, lethal: false, kind: 'rescue' });
        DM.Audio.play('summer_safe');
        return;
      }
      if (this.heldBy || !this.escort) return;
      // Being carried to the stairwell bypasses the room-door waypoints legitimately.
      if (this.x > 700 && this.x < 925) this.waypoints = [exit];
      while (this.waypoints.length > 1 && U.dist(this.x, this.y, this.waypoints[0].x, this.waypoints[0].y) < 32) {
        this.waypoints.shift();
      }
      S.move(this, this.waypoints[0] || exit, this.state.grid.vented ? 122 : 95, dt, world);
    }
    render(g, world) {
      super.render(g, world);
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.safe) return;
      K.ring(g, this.x, this.y, 19, this.escort ? S.TEAL : S.AMBER, 1.5);
      if (world.timesight) G.glow(g, this.x, this.y, 36, S.TEAL, 0.16);
    }
  }

  class StairBeam extends DM.Entity {
    constructor(state, x, y, wall) {
      super({ x, y, r: 33, mass: 7, grabbable: true, disintegratable: false, body: false });
      this.state = state;
      this.barrier = wall;
    }
    onGrab() {
      if (this.state.ctx.flags.beamCleared) return;
      this.barrier.noCollide = true;
      this.state.ctx.flags.beamCleared = true;
      this.state.change(-3, 'The stairwell opened');
    }
    render(g) {
      g.save();
      g.translate(this.x, this.y);
      g.rotate(-0.18);
      g.fillStyle = '#40302a';
      g.fillRect(-100, -16, 200, 32);
      g.fillStyle = '#906242';
      g.fillRect(-100, -15, 200, 5);
      g.strokeStyle = '#d88b56';
      g.lineWidth = 1;
      for (const y of [-8, 2, 9]) G.line(g, -85, y, 90, y - 3);
      for (const x of [-80, -50, 50, 80]) {
        g.fillStyle = '#171c20';
        G.circle(g, x, 0, 3);
        g.fill();
      }
      g.restore();
    }
  }
  Object.assign(S, {
    SummerBossFraming, CityState, FireGrid, Hydrant, Puddle, Gas, Molotov, Rioter, LiveRound, Comedian, Resident, StairBeam,
  });
})();
