/* After Midnight's replayable street challenges. Campaign and bonus saves are separate. */
(function () {
  'use strict';
  const DM = window.DM;
  const AM = (DM.AfterMidnight = DM.AfterMidnight || {});
  const U = DM.U,
    G = DM.Gfx,
    K = DM.BonusKit;
  const GOLD = '#e4bd79',
    TEAL = '#8fd7ca',
    RED = '#e9927d';
  const alive = (e) => !e.dead && !e.ko;
  const distance = (a, b) => U.dist(a.x, a.y, b.x, b.y);
  function buildModeArena(ctx) {
    const theme = AM.run?.theme || 'rooftops';
    const stage = ctx.chapter.stages[ctx.stageIndex];
    DM.Ambience.cues[ctx.chapter.id + '.' + stage.id] =
      { rooftops: 'am_noir', harbour: 'am_storm', museum: 'am_glass' }[theme] || 'am_noir';
    const run = AM.config(AM.run || {}, ctx.chapter);
    const record = AM.load().records[AM.slot(ctx.chapter.amId, run)];
    const attempts = Number.isFinite(record?.attempts)
      ? Math.max(0, Math.floor(record.attempts))
      : 0;
    const layout = AM.CaseArt.layout(ctx.chapter.amId, attempts % 2);
    return AM.buildArena(ctx, theme, { layout });
  }

  // The arena decorator supplies suggested positions. Validate them against the
  // actual geometry rather than putting a combatant or interaction in a wall.
  function freePoint(world, point, radius = 17) {
    const bounds = world.amPlayableBounds || { x: 0, y: 0, w: world.w, h: world.h };
    for (const r of [0, 36, 72, 108, 144]) {
      for (let i = 0; i < (r ? 12 : 1); i++) {
        const a = (i * Math.PI) / 6;
        const x = U.clamp(
          point.x + Math.cos(a) * r,
          bounds.x + radius + 30,
          bounds.x + bounds.w - radius - 30,
        );
        const y = U.clamp(
          point.y + Math.sin(a) * r,
          bounds.y + radius + 30,
          bounds.y + bounds.h - radius - 30,
        );
        if (world.isFree(x, y, radius)) return { x, y };
      }
    }
    return { ...world.spawn };
  }

  function spawnPoint(world, index) {
    const bounds = world.amPlayableBounds || { x: 0, y: 0, w: world.w, h: world.h };
    const seeds = world.amSpawnPoints || [
      { x: bounds.x + bounds.w - 250, y: bounds.y + 100 },
      { x: bounds.x + bounds.w - 250, y: bounds.y + bounds.h - 200 },
      { x: bounds.x + bounds.w / 2, y: bounds.y + 120 },
      { x: bounds.x + 300, y: bounds.y + 180 },
    ];
    const ordered = seeds.slice(index % seeds.length).concat(seeds.slice(0, index % seeds.length));
    const candidates = ordered.map((p) => freePoint(world, p));
    return (
      candidates.find((p) => distance(p, world.player) >= 500) ||
      candidates.sort((a, b) => distance(b, world.player) - distance(a, world.player))[0]
    );
  }

  function enemyFor(world, point, wave, index) {
    let enemy;
    if (wave >= 3 && index % 4 === 3) {
      enemy = new DM.Enemies.Drone({ ...point, alerted: true, sight: 1600 });
      enemy.amValue = 125;
    } else {
      enemy = new DM.Enemies.Gangster({
        ...point,
        alerted: true,
        sight: 1450,
        gun: wave >= 4 && index % 3 === 1 ? 'tommy' : 'pistol',
      });
      enemy.amValue = 100;
      enemy.onAlert = (w) => w.bark(enemy, 'Costumes. Keep them out!');
    }
    const factor = 1 + Math.min(0.65, Math.max(0, wave - 2) * 0.06);
    enemy.hp = enemy.maxHp = Math.round(enemy.maxHp * factor);
    enemy.amChallengeEnemy = true;
    enemy.fireCd = 2;
    enemy.stun = 0.8;
    return world.add(enemy);
  }

  class Arrival extends DM.Entity {
    constructor(point, make, delay = 1.8) {
      super({
        ...point,
        r: 80,
        body: false,
        solid: false,
        static: true,
        disintegratable: false,
        layer: 0,
      });
      this.left = delay;
      this.duration = delay;
      this.make = make;
      this.hazard = true;
      this.amArrival = true;
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      if (this.left <= 0) {
        this.dead = true;
        this.make(freePoint(world, this, 18));
      }
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      g.save();
      g.setLineDash([8, 6]);
      K.ring(g, this.x, this.y, 43 + (this.left / this.duration) * 25, GOLD, 2);
      g.setLineDash([]);
      G.text(g, 'INCOMING', this.x, this.y - 77, {
        size: 12,
        align: 'center',
        color: GOLD,
        spacing: 2,
      });
      g.restore();
    }
  }

  // A complete route around static cover, shared by all civilian escorts.
  // A* runs when E is used, not every animation frame. Final movement still
  // goes through the World's ordinary wall/body integration.
  function escortRoute(world, from, to) {
    const cell = 48,
      cols = Math.ceil(world.w / cell),
      rows = Math.ceil(world.h / cell);
    const walkable = (a, b, radius = 16) => {
      const steps = Math.max(1, Math.ceil(distance(a, b) / 12));
      for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        if (!world.isFree(U.lerp(a.x, b.x, k), U.lerp(a.y, b.y, k), radius)) return false;
      }
      return true;
    };
    const point = (key) => ({
      x: ((key % cols) + 0.5) * cell,
      y: (Math.floor(key / cols) + 0.5) * cell,
    });
    const key = (p) =>
      U.clamp(Math.floor(p.x / cell), 0, cols - 1) +
      U.clamp(Math.floor(p.y / cell), 0, rows - 1) * cols;
    const nearest = (p, radius = 16) => {
      const start = key(p),
        queue = [start],
        seen = new Set(queue);
      for (let i = 0; i < queue.length; i++) {
        const n = queue[i],
          q = point(n);
        if (world.isFree(q.x, q.y, 16) && walkable(p, q, radius)) return n;
        for (const d of [1, -1, cols, -cols]) {
          const next = n + d;
          if (next < 0 || next >= cols * rows || seen.has(next)) continue;
          if (Math.abs(d) === 1 && Math.floor(next / cols) !== Math.floor(n / cols)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      return null;
    };
    // A thirteen-pixel person can stand fifteen pixels from a wall. Let them
    // step away using their actual body radius before joining the wider grid.
    const first = nearest(from, Math.min(16, from.r || 16)),
      last = nearest(to);
    if (first == null || last == null) return [];
    const open = new Set([first]),
      costs = new Map([[first, 0]]),
      came = new Map();
    while (open.size) {
      let best = null,
        score = Infinity;
      for (const n of open) {
        const value = costs.get(n) + distance(point(n), point(last)) / cell;
        if (value < score) {
          best = n;
          score = value;
        }
      }
      if (best === last) {
        const result = [point(last)];
        while (came.has(best)) {
          best = came.get(best);
          result.push(point(best));
        }
        result.reverse();
        result.push({ ...to });
        return result;
      }
      open.delete(best);
      const at = point(best);
      for (const d of [1, -1, cols, -cols]) {
        const next = best + d;
        if (
          next < 0 ||
          next >= cols * rows ||
          (Math.abs(d) === 1 && Math.floor(next / cols) !== Math.floor(best / cols))
        )
          continue;
        const p = point(next);
        if (!world.isFree(p.x, p.y, 16) || !walkable(at, p)) continue;
        const cost = costs.get(best) + 1;
        if (cost >= (costs.get(next) ?? Infinity)) continue;
        costs.set(next, cost);
        came.set(next, best);
        open.add(next);
      }
    }
    return [];
  }

  class ClockCivilian extends DM.NPC {
    constructor(director, point, index) {
      const colors = ['#788c9d', '#a67d68', '#6d9386', '#9b88a1'];
      super({
        ...point,
        look: {
          name: ['Avery', 'Mara', 'Luis', 'Dev'][index % 4],
          skin: '#d8b08f',
          hair: '#40322a',
          body: colors[index % 4],
          sleeve: colors[index % 4],
          legs: '#30343b',
          hairStyle: index % 2 ? 'long' : 'short',
          color: TEAL,
          bg: '#536d71',
        },
      });
      this.director = director;
      this.amCivilian = true;
      this.hp = this.maxHp = 45;
      this.mass = 1.8;
      this.disintegratable = false;
      this.following = false;
      this.safe = false;
      this.route = [];
      this.routeIndex = 0;
      this.stuckT = 0;
      this.fearNote = 0;
      this.lastEscortPosition = { ...point };
      this.interact = {
        label: 'Guide ' + this.look.name + ' to safety',
        range: 86,
        enabled: () => !this.safe && !this.following && !this.dead,
        onInteract: () => this.beginEscort(),
      };
    }
    beginEscort() {
      this.route = escortRoute(this.world, this, this.director.safe);
      if (!this.route.length) {
        this.director.ctx.toast('CLEAR A PATH TO THE GREEN SAFE AREA', GOLD);
        return false;
      }
      this.following = true;
      this.routeIndex = 0;
      this.director.markNext();
      this.world.bark(this, 'All right. I can see the way.');
      DM.Audio.play('ui_select');
      return true;
    }
    damage(amount, source, kind) {
      if (this.safe || this.dead || this.world.ceasefire) return false;
      // The heroes' stun gear is nonlethal; a stray friendly bolt is not an
      // unannounced civilian killing mechanic. Enemy fire and hazards remain dangerous.
      if (source?.isPlayer || source?.team === 'player') return false;
      return DM.Entity.prototype.damage.call(this, amount, source, kind);
    }
    onDeath() {
      this.director.ctx.flags.lost++;
      this.director.ctx.toast(this.look.name.toUpperCase() + ' DID NOT MAKE IT', RED);
      this.director.markNext();
    }
    update(dt, world) {
      if (this.safe || this.dead || world.ceasefire) {
        this.vx = this.vy = 0;
        return;
      }
      this.fearNote = Math.max(0, this.fearNote - dt);
      if (this.following && distance(this, this.director.safe) < 65) {
        this.safe = true;
        this.following = false;
        this.interact = null;
        this.body = false;
        this.vx = this.vy = 0;
        this.director.rescued(this);
        return;
      }
      const danger =
        this.following &&
        world.entities.some(
          (e) =>
            e.amChallengeEnemy &&
            alive(e) &&
            distance(e, this) < 150 &&
            world.los(e.x, e.y, this.x, this.y),
        );
      if (!this.following || danger) {
        this.vx = U.damp(this.vx, 0, 12, dt);
        this.vy = U.damp(this.vy, 0, 12, dt);
        this.moving = false;
        if (danger && this.fearNote <= 0) {
          this.fearNote = 4;
          world.bark(this, 'Keep them away from me!');
        }
        return;
      }
      while (
        this.routeIndex < this.route.length - 1 &&
        distance(this, this.route[this.routeIndex]) < 24
      )
        this.routeIndex++;
      const target = this.route[this.routeIndex];
      if (!target) return;
      const dx = target.x - this.x,
        dy = target.y - this.y,
        length = Math.hypot(dx, dy) || 1;
      this.vx = U.damp(this.vx, (dx / length) * 125, 12, dt);
      this.vy = U.damp(this.vy, (dy / length) * 125, 12, dt);
      this.facing = Math.atan2(dy, dx);
      this.moving = true;
      this.walk += dt * 9;
      const travelled = distance(this, this.lastEscortPosition);
      this.lastEscortPosition = { x: this.x, y: this.y };
      this.stuckT = travelled < 0.25 ? this.stuckT + dt : 0;
      if (this.stuckT > 1.5) {
        this.stuckT = 0;
        this.route = escortRoute(world, this, this.director.safe);
        this.routeIndex = 0;
      }
    }
    render(g, world) {
      super.render(g, world);
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.safe || this.dead) return;
      K.ring(g, this.x, this.y, 22, this.following ? TEAL : GOLD, 2);
    }
    light() {
      return this.safe ? null : { r: 85, i: 0.3, color: TEAL, k: 0.1 };
    }
  }

  class SignalStrike extends DM.Entity {
    constructor(x, y) {
      super({
        x,
        y,
        r: 65,
        body: false,
        solid: false,
        static: true,
        disintegratable: false,
        layer: 0,
      });
      this.hazard = true;
      this.left = 1.8;
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      if (this.left > 0) return;
      this.dead = true;
      for (const e of world.query(this.x, this.y, 62, (e) => e.isPlayer || e.amCivilian)) {
        if (world.los(this.x, this.y, e.x, e.y)) e.damage(11, this, 'impact');
      }
      world.particles.burst(this.x, this.y, 24, {
        color: [GOLD, '#ffffff'],
        speed: [30, 190],
        life: [0.15, 0.45],
        size: [1, 3],
      });
      DM.Audio.play('impact');
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      g.fillStyle = 'rgba(229,174,100,0.12)';
      G.circle(g, this.x, this.y, 62);
      g.fill();
      K.ring(g, this.x, this.y, 62, GOLD, 2);
      K.ring(g, this.x, this.y, Math.max(2, (62 * this.left) / 1.8), GOLD, 1);
      g.strokeStyle = GOLD;
      G.line(g, this.x - 12, this.y, this.x + 12, this.y);
      G.line(g, this.x, this.y - 12, this.x, this.y + 12);
    }
  }

  class ModeDirector extends DM.Entity {
    constructor(ctx) {
      super({
        x: 0,
        y: 0,
        r: 3000,
        body: false,
        solid: false,
        static: true,
        disintegratable: false,
        layer: 100,
      });
      this.ctx = ctx;
      this.hazard = true;
      this.safe = { ...(ctx.world.amSafePoint || ctx.world.spawn) };
      this.enemies = [];
      this.pending = [];
      this.serial = 0;
      this.lastScoreAt = -Infinity;
      this.chain = 0;
      ctx.flags.score = 0;
      ctx.flags.wave = 0;
      ctx.flags.rescued = 0;
      ctx.flags.lost = 0;
      ctx.flags.extracted = false;
      ctx.flags.modeResult = 'active';
      ctx.flags.director = this;
      ctx.on('enemy:down', (ev) => {
        if (ev.enemy.world !== this.world || !ev.enemy.amChallengeEnemy) return;
        const time = this.world.realTime || 0;
        this.chain = time - this.lastScoreAt < 3 ? Math.min(5, this.chain + 1) : 0;
        this.lastScoreAt = time;
        this.ctx.flags.score += ev.enemy.amValue + this.chain * 20;
      });
      ctx.on('player:down', (player) => {
        if (player === ctx.player && !ctx.done) this.ctx.flags.modeResult = 'defeated';
      });
    }
    terminal(x, y, label, action, enabled, color = TEAL) {
      const p = freePoint(this.ctx.world, { x, y }, 22);
      return this.ctx.add(new K.Terminal(p.x, p.y, label, action, enabled, color));
    }
    queueEnemy(wave, index, delay) {
      const point = spawnPoint(this.world, this.serial++);
      let arrival;
      arrival = this.world.add(
        new Arrival(
          point,
          (p) => {
            const e = enemyFor(this.world, p, wave, index);
            this.enemies.push(e);
            this.pending = this.pending.filter((item) => item !== arrival);
          },
          delay,
        ),
      );
      this.pending.push(arrival);
    }
    settled() {
      return this.pending.length === 0 && this.enemies.every((e) => !alive(e));
    }
    finish(result) {
      this.ctx.flags.modeResult = result;
      for (const e of this.pending) e.dead = true;
      this.pending = [];
      this.ctx.clearHostiles();
      this.ctx.lock(true);
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (!this.ctx.hud.gameHudVisible() || DM.Engine.top() !== this.ctx.scene) return;
      const f = this.ctx.flags,
        e = DM.Engine;
      const x = 24,
        y = 148;
      g.save();
      g.setTransform(e.dpr * e.scale, 0, 0, e.dpr * e.scale, e.dpr * e.offX, e.dpr * e.offY);
      G.panel(g, x, y, 264, 74, { fill: 'rgba(6,12,20,0.9)', accent: TEAL });
      G.text(
        g,
        this.kind === 'patrol' ? 'PATROL · WAVE ' + f.wave : 'RESCUE CLOCK',
        x + 13,
        y + 21,
        { size: 12, color: TEAL, spacing: 1.6 },
      );
      G.text(g, 'SCORE ' + Math.floor(f.score), x + 13, y + 45, { size: 18, color: '#efe2c7' });
      const text =
        this.kind === 'patrol'
          ? this.phase === 'rest'
            ? 'GEAR / EXTRACT'
            : this.pending.length + this.enemies.filter(alive).length + ' ACTIVE'
          : Math.ceil(f.clockLeft) + 's · ' + f.rescued + ' / ' + f.rescueTarget + ' SAFE';
      G.text(g, text, x + 252, y + 65, {
        size: 12,
        color: this.kind !== 'patrol' && f.clockLeft < 30 ? RED : GOLD,
        align: 'right',
      });
      g.restore();
    }
  }

  class PatrolDirector extends ModeDirector {
    constructor(ctx) {
      super(ctx);
      this.kind = 'patrol';
      this.phase = 'briefing';
      this.upgradePicked = false;
      this.nextRequested = false;
      this.fieldKitUsed = false;
    }
    installCamp() {
      const s = this.safe;
      this.terminal(
        s.x - 90,
        s.y,
        'EXTRACT · BANK THIS PATROL',
        () => AM.extract(this.ctx.scene),
        () => this.phase === 'rest' && this.ctx.flags.wave > 0,
        GOLD,
      );
      this.terminal(
        s.x - 70,
        s.y - 100,
        'FIELD KIT · +25 HEALTH / STAMINA',
        () => {
          const p = this.ctx.player;
          p.coherence = Math.min(p.maxCoherence, p.coherence + 25);
          p.energy = Math.min(p.maxEnergy, p.energy + 25);
          this.fieldKitUsed = true;
          DM.Audio.play('success');
          this.ctx.toast('FIELD KIT USED · ONE PER CLEARED WAVE', TEAL);
        },
        () => this.phase === 'rest' && !this.fieldKitUsed,
      );
      for (const [id, label, index] of [
        ['vitality', 'ARMOUR · +15 MAX HEALTH', 0],
        ['capacitor', 'CAPACITOR · MORE STAMINA', 1],
        ['mobility', 'MOBILITY · FASTER MOVEMENT', 2],
      ]) {
        this.terminal(
          s.x + 170 + index * 140,
          s.y + 40,
          label,
          () => {
            const p = this.ctx.player;
            if (p.applyUpgrade && p.applyUpgrade(id)) {
              AM.run.upgrades = { ...p.upgrades };
              this.upgradePicked = true;
              this.ctx.toast(label + ' · READY FOR THE NEXT WAVE', TEAL);
              DM.Audio.play('unlock');
            } else this.ctx.toast('THAT UPGRADE IS ALREADY AT ITS LIMIT', GOLD);
          },
          () =>
            this.phase === 'rest' &&
            !this.upgradePicked &&
            (this.ctx.player.upgrades?.[id] || 0) < 3,
        );
      }
      this.terminal(
        s.x + 590,
        s.y + 40,
        'START THE NEXT WAVE',
        () => {
          const capped =
            Object.values(this.ctx.player.upgrades || {}).filter((n) => n >= 3).length >= 3;
          if (!this.upgradePicked && !capped)
            return this.ctx.toast('CHOOSE ONE GEAR UPGRADE OR EXTRACT', GOLD);
          this.nextRequested = true;
        },
        () => this.phase === 'rest',
      );
    }
    startWave() {
      this.phase = 'combat';
      this.nextRequested = false;
      this.upgradePicked = false;
      this.fieldKitUsed = false;
      const f = this.ctx.flags;
      f.wave++;
      // Clear the previous wave's KO bodies after their score has been banked.
      for (const e of this.enemies) if (e.ko) e.dead = true;
      this.enemies = [];
      this.waveStartReal = this.world.realTime || 0;
      const count = Math.min(8, f.wave + 1);
      for (let i = 0; i < count; i++) this.queueEnemy(f.wave, i, 1.8 + i * 0.65);
      this.ctx.hud.banner('PATROL ' + f.wave, count + ' contacts · Watch the amber arrival rings', {
        dur: 2.5,
        color: GOLD,
      });
      this.ctx.objective(
        'Clear the patrol',
        () =>
          'Wave ' +
          f.wave +
          ' · ' +
          (this.pending.length + this.enemies.filter(alive).length) +
          ' remaining',
      );
      this.ctx.marker(null);
    }
    rest() {
      this.phase = 'rest';
      this.ctx.clearHostiles();
      if (!(this.ctx.player.lastHit && this.ctx.player.lastHit.t >= this.waveStartReal)) {
        this.ctx.flags.score += 100;
        this.ctx.toast('CLEAN PATROL · +100', TEAL);
      }
      this.ctx.flags.score += this.ctx.flags.wave * 50;
      this.ctx.objective(
        'Regroup · Choose gear or extract',
        () => 'Wave ' + this.ctx.flags.wave + ' cleared',
      );
      this.ctx.marker(this.safe.x, this.safe.y, 'GEAR / EXTRACTION');
      this.ctx.tutorial(
        'E chooses one gear upgrade. Take the field kit, then start another wave or extract.',
        12,
      );
    }
  }

  class RescueDirector extends ModeDirector {
    constructor(ctx) {
      super(ctx);
      this.kind = 'rescue';
      this.ctx.flags.clockLeft = 180;
      this.ctx.flags.rescueTarget = 4;
      this.reinforceT = 32;
      this.reinforcements = 0;
      this.strikeT = 18;
      this.civilians = [];
      this.running = false;
    }
    install() {
      const points = this.world.amRescueSpawns || [
        { x: 620, y: 370 },
        { x: 1500, y: 370 },
        { x: 1530, y: 940 },
        { x: 900, y: 650 },
      ];
      for (let i = 0; i < 4; i++) {
        this.civilians.push(
          this.world.add(
            new ClockCivilian(this, freePoint(this.world, points[i % points.length]), i),
          ),
        );
      }
      for (let i = 0; i < 3; i++) this.queueEnemy(1, i, 2.2 + i * 1.2);
      this.terminal(
        this.safe.x - 90,
        this.safe.y,
        'EXTRACT · BANK THE RESCUES',
        () => AM.extract(this.ctx.scene),
        () => this.running && this.ctx.flags.rescued > 0,
        GOLD,
      );
      this.world.decals.push((g) => {
        g.fillStyle = 'rgba(108,202,163,0.12)';
        G.ellipse(g, this.safe.x, this.safe.y, 88, 62);
        g.fill();
        K.ring(g, this.safe.x, this.safe.y, 65, TEAL, 2);
      });
      this.world.add(new K.Sign(this.safe.x, this.safe.y + 82, 'SAFE PASSAGE', TEAL, 14));
    }
    rescued(person) {
      const f = this.ctx.flags;
      f.rescued++;
      f.score += 500;
      f.clockLeft = Math.min(240, f.clockLeft + 18);
      this.world.bark(person, 'Safe. Thank you.');
      this.ctx.toast('A LIFE OUT OF DANGER · +500 / +18 SECONDS', TEAL);
      DM.Audio.play('success');
      this.markNext();
    }
    markNext() {
      const remaining = this.civilians
        .filter((e) => !e.safe && !e.dead && !e.following)
        .sort((a, b) => distance(a, this.ctx.player) - distance(b, this.ctx.player));
      if (remaining[0]) this.ctx.marker(remaining[0].x, remaining[0].y, 'CIVILIAN · E TO GUIDE');
      else this.ctx.marker(this.safe.x, this.safe.y, 'SAFE PASSAGE');
    }
    update(dt, world) {
      if (!this.running || world.ceasefire || this.ctx.flags.modeResult !== 'active') return;
      const f = this.ctx.flags;
      f.clockLeft = Math.max(0, f.clockLeft - dt);
      this.reinforceT -= dt;
      this.strikeT -= dt;
      if (this.reinforceT <= 0 && this.reinforcements < 3) {
        this.reinforcements++;
        this.reinforceT = 36;
        this.queueEnemy(2, this.reinforcements, 2);
        this.queueEnemy(2, this.reinforcements + 1, 3.2);
        this.ctx.toast('MORE CONTACTS · KEEP THE ESCORT ROUTE CLEAR', GOLD);
      }
      if (this.strikeT <= 0) {
        this.strikeT = 20;
        world.add(new SignalStrike(world.player.x, world.player.y));
        this.ctx.toast('AMBER RING · MOVE CLEAR', GOLD);
      }
    }
  }

  AM.extract = function (play) {
    const d = play?.ctx?.flags.director;
    if (!d || play.failed || play.ctx.done) return false;
    if (d.kind === 'patrol' && (d.phase !== 'rest' || play.ctx.flags.wave < 1)) return false;
    if (d.kind === 'rescue' && play.ctx.flags.rescued < 1) return false;
    play.ctx.flags.extracted = true;
    return true;
  };
  AM.escortRoute = escortRoute;
  AM.ClockCivilian = ClockCivilian;
  AM.PatrolDirector = PatrolDirector;
  AM.RescueDirector = RescueDirector;
  AM.modes = [
    {
      id: 'story',
      name: 'CASE FILES',
      description: "Three connected investigations. Find the people behind the city's machinery.",
    },
    {
      id: 'patrol',
      name: 'NIGHT PATROL',
      description:
        'Survive escalating waves. Choose gear between rounds and extract to bank your score.',
    },
    {
      id: 'rescue_clock',
      name: 'RESCUE CLOCK',
      description:
        'Guide four people to safety before time runs out. Each rescue buys eighteen seconds.',
    },
  ];

  AM.registerCase({
    id: 'patrol',
    kind: 'patrol',
    numeral: 'NIGHT PATROL',
    title: 'The City Does Not Sleep',
    date: '1977',
    place: 'NEW YORK',
    clock: 5,
    color: '#35464e',
    music: 'am_noir',
    description:
      'Escalating nonlethal street encounters, field supplies and choices about when to get out.',
    intro: [
      'There is no last call for trouble in this city. Only the moment you decide to go home.',
    ],
    persistFlags: ['score', 'wave', 'modeResult', 'extracted'],
    maps: { patrol_arena: buildModeArena },
    stages: [
      {
        id: 'patrol',
        label: 'Night Patrol',
        map: 'patrol_arena',
        checkpoint: false,
        run: function* (ctx) {
          ctx.lock(true);
          yield ctx.dialog([
            [
              'niteowl',
              'We clear a block, take a breath, and decide whether to keep going. ' +
                'Supplies are by the green extraction point. You can bank the patrol after each cleared wave.',
            ],
          ]);
          const d = ctx.add(new PatrolDirector(ctx));
          d.installCamp();
          ctx.lock(false);
          ctx.tutorial(
            'C fights. Q is your ranged gear. Space evades. Amber rings announce reinforcements.',
            12,
          );
          while (!ctx.flags.extracted) {
            d.startWave();
            yield ctx.until(() => d.settled());
            d.rest();
            yield ctx.until(() => d.nextRequested || ctx.flags.extracted);
          }
          d.finish('extracted');
          ctx.objectiveDone();
          yield ctx.dialog([
            [
              'niteowl',
              'That block is quiet. We can come back tomorrow. People will still need us.',
            ],
          ]);
        },
      },
    ],
  });

  AM.registerCase({
    id: 'rescue_clock',
    kind: 'rescue',
    numeral: 'RESCUE CLOCK',
    title: 'Every Second Someone',
    date: '1977',
    place: 'NEW YORK',
    clock: 3,
    color: '#355c61',
    music: 'am_noir',
    description: 'Find four civilians, clear their paths and guide them to the green safe passage.',
    intro: ['Four people are still out there. The safe route will not stay open forever.'],
    persistFlags: [
      'score',
      'rescued',
      'lost',
      'rescueTarget',
      'clockLeft',
      'modeResult',
      'extracted',
    ],
    maps: { rescue_arena: buildModeArena },
    stages: [
      {
        id: 'rescue',
        label: 'Against the clock',
        map: 'rescue_arena',
        checkpoint: false,
        run: function* (ctx) {
          ctx.lock(true);
          yield ctx.dialog([
            [
              'niteowl',
              'E asks someone to follow the marked safe route. They will stop if a gunman ' +
                'gets too close. Clear the path; every person who reaches the green passage buys eighteen seconds.',
            ],
            [
              'laurie',
              'Amber rings mean move. And if we cannot get everyone out, bring back the people we can.',
            ],
          ]);
          const d = ctx.add(new RescueDirector(ctx));
          d.install();
          ctx.lock(false);
          d.running = true;
          ctx.objective(
            'Get four people to safe passage',
            () => ctx.flags.rescued + ' / 4 safe · ' + Math.ceil(ctx.flags.clockLeft) + 's',
          );
          ctx.tutorial(
            'E guides a civilian. Clear nearby enemies so they can move. Reach the green safe passage.',
            14,
          );
          d.markNext();
          yield ctx.until(
            () =>
              ctx.flags.rescued + ctx.flags.lost >= 4 ||
              ctx.flags.clockLeft <= 0 ||
              ctx.flags.extracted,
          );
          const f = ctx.flags;
          const result =
            f.rescued === 4
              ? 'rescued'
              : f.extracted
                ? 'extracted'
                : f.clockLeft <= 0
                  ? 'timeout'
                  : 'partial';
          if (result === 'rescued') f.score += Math.floor(f.clockLeft) * 5;
          d.finish(result);
          ctx.objectiveDone();
          yield ctx.dialog([
            [
              'laurie',
              f.rescued === 4
                ? 'Four people. Four mornings they still get to see.'
                : 'We got ' +
                  f.rescued +
                  ' out. Remember the ones still out there. We come back for them.',
            ],
          ]);
        },
      },
    ],
  });
})();
