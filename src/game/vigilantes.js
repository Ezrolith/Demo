/* After Midnight: three vulnerable people, three different ways through a fight.
 * New player forms/powers are opt-in. No original looks, powers or enemy classes
 * are replaced; human enemies still use their existing impact -> knockout path.
 */
(function () {
  'use strict';
  const DM = window.DM, U = DM.U, G = DM.Gfx, I = DM.Input, A = DM.Audio;
  const AM = DM.AfterMidnight = DM.AfterMidnight || {};
  const TAU = Math.PI * 2;
  const validLevel = value => Number.isFinite(value) ? U.clamp(Math.floor(value), 0, 3) : 0;
  const liveFoe = e => e.team === 'enemy' && !e.dead && !e.ko && !e.isProjectile && e.hp != null;
  const nearby = (world, p, range) => world.entities.filter(e => liveFoe(e) &&
    U.dist(p.x, p.y, e.x, e.y) <= range + e.r && world.los(p.x, p.y, e.x, e.y));
  const direction = (p, world) => U.angleTo(p.x, p.y, world.mouse.x, world.mouse.y);
  const ring = (g, x, y, r, color, width = 2) => {
    g.strokeStyle = color; g.lineWidth = width; G.circle(g, x, y, r); g.stroke();
  };
  const spark = (world, x, y, color, count = 8) => world.particles.burst(x, y, count, {
    color: [color, '#eee6d0'], speed: [30, 130], life: [0.15, 0.35], size: [1, 2.5], shape: 'spark',
  });

  A.define('am_strike', { gap: 0.06, fn(a) {
    a.noise({ dur: 0.11, gain: 0.095, ftype: 'lowpass', freq: 1000, freqEnd: 180 });
    a.tone({ freq: 170, freqEnd: 75, dur: 0.09, gain: 0.055, type: 'triangle' });
  } });
  A.define('am_grapple', { gap: 0.1, fn(a) {
    a.noise({ dur: 0.18, gain: 0.055, ftype: 'bandpass', freq: 2800, freqEnd: 700 });
    a.tone({ freq: 440, freqEnd: 120, dur: 0.14, gain: 0.035, type: 'triangle' });
  } });
  A.define('am_smoke', { gap: 0.1, fn(a) {
    a.noise({ dur: 0.5, gain: 0.09, ftype: 'lowpass', freq: 1100, freqEnd: 240, attack: 0.015 });
  } });
  A.define('am_parry', { gap: 0.08, fn(a) {
    a.tone({ freq: 880, freqEnd: 530, dur: 0.16, gain: 0.045, type: 'triangle' });
    a.noise({ dur: 0.05, gain: 0.06, ftype: 'highpass', freq: 3000 });
  } });

  // Small procedural glyphs, matching the original HUD rather than a new UI skin.
  function glyph(kind) {
    return (g, x, y, size, color, t = 0) => {
      const s = size / 32;
      g.save(); g.translate(x, y); g.scale(s, s);
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1.8;
      if (kind === 'fist') {
        G.rr(g, -10, -5, 19, 14, 3); g.stroke();
        for (let x = -8; x < 7; x += 5) G.line(g, x, -5, x, -11);
        G.line(g, -12, 2, -9, -1); G.line(g, 1, 9, 1, 14);
      } else if (kind === 'bolt') {
        g.beginPath(); g.moveTo(3, -14); g.lineTo(-8, 1); g.lineTo(0, 1);
        g.lineTo(-3, 14); g.lineTo(10, -4); g.lineTo(2, -4); g.closePath(); g.stroke();
      } else if (kind === 'grapple') {
        G.line(g, -11, 12, 6, -6); g.beginPath(); g.arc(7, -8, 5, 0, Math.PI * 1.5); g.stroke();
        G.line(g, 7, -3, 2, -8); G.line(g, 2, -8, 2, -3);
      } else if (kind === 'smoke') {
        for (const [x, y, r] of [[-7, 4, 6], [2, -3, 8], [9, 5, 5]]) ring(g, x, y, r, color, 1.6);
      } else if (kind === 'eye') {
        g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(0, -14, 14, 0);
        g.quadraticCurveTo(0, 14, -14, 0); g.stroke(); ring(g, 0, 0, 4, color);
      } else if (kind === 'guard') {
        g.beginPath(); g.moveTo(0, -13); g.lineTo(11, -8); g.lineTo(9, 6);
        g.lineTo(0, 14); g.lineTo(-9, 6); g.lineTo(-11, -8); g.closePath(); g.stroke();
      } else if (kind === 'spin') {
        g.beginPath(); g.arc(0, 0, 11, t, t + Math.PI * 1.6); g.stroke();
        G.line(g, -9, 8, 6, -7); G.line(g, -10, 7, -10, 14); G.line(g, -10, 14, -3, 12);
      } else if (kind === 'baton') {
        g.rotate(-0.6); g.strokeRect(-3, -13, 6, 25); G.line(g, -7, 5, 7, 5);
      } else if (kind === 'decoy') {
        for (const x of [-6, 6]) { ring(g, x, -7, 4, color, 1.3); G.line(g, x, -2, x, 11); }
        G.line(g, -11, 4, -1, 4); G.line(g, 1, 4, 11, 4);
      } else if (kind === 'burst') {
        ring(g, 0, 0, 5, color);
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; G.line(g, Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 14, Math.sin(a) * 14); }
      }
      g.restore();
    };
  }

  class GearArc extends DM.Entity {
    constructor(p, range, angle, color, full = false) {
      super({ x: p.x, y: p.y, body: false, solid: false, static: true, layer: 3, disintegratable: false });
      this.owner = p; this.range = range; this.angle = angle; this.color = color; this.full = full;
      this.left = 0.2;
    }
    update(dt, world) { if (!world.ceasefire) this.left -= dt; if (this.left <= 0) this.dead = true; }
    render(g, world) { if (!world.lit) this.renderEmissive(g); }
    renderEmissive(g) {
      const k = U.clamp(this.left / 0.2, 0, 1);
      g.save(); g.globalAlpha *= k * 0.7; g.strokeStyle = this.color; g.lineWidth = 3;
      g.beginPath(); g.arc(this.x, this.y, this.range * (1 - k * 0.22),
        this.full ? 0 : this.angle - 0.72, this.full ? TAU : this.angle + 0.72); g.stroke(); g.restore();
    }
  }

  // Smoke hides its owner from ordinary Enemy.acquire and missiles while inside.
  // Existing aim/bursts are cancelled as the cloud forms. It does not make
  // bullets already travelling through it harmless, so moving still matters.
  class Smoke extends DM.Entity {
    constructor(p, radius, duration, chaff) {
      super({ x: p.x, y: p.y, r: radius, body: false, solid: false, static: true, disintegratable: false, layer: 4 });
      this.owner = p; this.left = duration; this.duration = duration; this.amSmoke = true;
      this.chaff = chaff; this.didDisrupt = false;
    }
    contains(p) { return !this.dead && U.dist(p.x, p.y, this.x, this.y) < this.r; }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      if (this.left <= 0) { this.dead = true; return; }
      const covered = this.contains(this.owner);
      for (const e of world.entities) {
        if (!liveFoe(e)) continue;
        if (covered && e.target === this.owner) {
          e.target = null; e.aim = 0; e.burst = 0; e.retarget = 0;
          e.fireCd = Math.max(e.fireCd || 0, 0.4);
        }
        if (!this.didDisrupt && U.dist(e.x, e.y, this.x, this.y) < this.r + e.r) {
          e.aim = 0; e.burst = 0;
          e.stun = Math.max(e.stun || 0, this.chaff && !e.human ? 1.4 : 0.45);
        }
      }
      this.didDisrupt = true;
    }
    render(g) {
      const alpha = U.clamp(this.left, 0, 1) * Math.min(1, (this.duration - this.left) * 5 + 0.1);
      g.save(); g.globalAlpha *= alpha;
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU, r = this.r * (0.35 + i % 3 * 0.13);
        g.fillStyle = i % 2 ? 'rgba(70,80,80,0.14)' : 'rgba(163,164,141,0.12)';
        G.ellipse(g, this.x + Math.cos(a + this.age * 0.1) * r,
          this.y + Math.sin(a + this.age * 0.1) * r, this.r * 0.5, this.r * 0.36); g.fill();
      }
      ring(g, this.x, this.y, this.r, 'rgba(199,199,170,0.25)', 1); g.restore();
    }
  }

  class Feint extends DM.Entity {
    constructor(p, world) {
      const a = direction(p, world);
      let x = p.x + Math.cos(a) * 74, y = p.y + Math.sin(a) * 74;
      if (!world.isFree(x, y, 11)) { x = p.x; y = p.y; }
      super({ x, y, r: 11, hp: 24, team: 'player', body: true, solid: true, disintegratable: false, mass: 1.5 });
      this.owner = p; this.targetable = true; this.left = 4.5; this.look = Object.assign({}, p.look);
      this.facing = a; this.walk = 0;
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      if (this.left <= 0) { this.dead = true; return; }
      this.vx = Math.cos(this.facing + 1.2) * 35; this.vy = Math.sin(this.facing + 1.2) * 35;
      this.walk += dt * 5;
    }
    render(g) {
      G.figure(g, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing,
        walk: this.walk, moving: true, alpha: 0.35 + Math.min(1, this.left) * 0.2 }));
    }
  }

  class GearShot extends DM.Entity {
    constructor(p, world, o) {
      const a = o.angle == null ? direction(p, world) : o.angle;
      super({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, r: 4,
        team: 'player', body: false, solid: false, disintegratable: false, layer: 3 });
      this.selfMove = true; this.isProjectile = true; this.owner = p; this.angle = a;
      this.speedBase = o.speed || 600; this.vx = Math.cos(a) * this.speedBase; this.vy = Math.sin(a) * this.speedBase;
      this.left = o.life || 0.9; this.duration = this.left; this.damageAmount = o.damage;
      this.color = o.color; this.stunTime = o.stun || 0; this.baton = !!o.baton;
      this.returning = false; this.hits = new Set(); this.refunded = false;
    }
    update(dt, world) {
      if (world.ceasefire) return;
      this.left -= dt;
      if (this.left <= 0) { this.dead = true; return; }
      if (this.baton && this.left < this.duration * 0.5) this.returning = true;
      if (this.returning) {
        this.angle = U.angleTo(this.x, this.y, this.owner.x, this.owner.y);
        this.vx = Math.cos(this.angle) * this.speedBase; this.vy = Math.sin(this.angle) * this.speedBase;
        if (U.dist(this.x, this.y, this.owner.x, this.owner.y) < 24) {
          if (!this.owner.down && !this.refunded) this.owner.energy = Math.min(this.owner.maxEnergy, this.owner.energy + 7);
          this.refunded = true; this.dead = true; return;
        }
      }
      const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
      if (world.shotHit(this.x, this.y, nx, ny) >= 0) {
        if (this.baton && !this.returning) this.returning = true;
        else this.dead = true;
        return;
      }
      for (const e of world.entities) {
        const key = e.id + (this.returning ? ':back' : ':out');
        if (!liveFoe(e) || this.hits.has(key) || !U.segCircle(this.x, this.y, nx, ny, e.x, e.y, e.r + this.r)) continue;
        this.hits.add(key);
        e.damage(this.returning ? 16 : this.damageAmount, this.owner, 'impact');
        if (!e.dead && !e.ko) e.stun = Math.max(e.stun || 0, this.stunTime);
        spark(world, e.x, e.y, this.color);
        if (this.baton && !this.returning) this.returning = true;
        else if (!this.baton) this.dead = true;
        break;
      }
      this.x = nx; this.y = ny;
    }
    render(g, world) { if (!world.lit) this.renderEmissive(g); }
    renderEmissive(g) {
      g.save(); g.strokeStyle = this.color; g.lineWidth = this.baton ? 4 : 2;
      if (this.baton) {
        const a = this.age * 28;
        G.line(g, this.x - Math.cos(a) * 11, this.y - Math.sin(a) * 11,
          this.x + Math.cos(a) * 11, this.y + Math.sin(a) * 11);
      } else G.line(g, this.x - Math.cos(this.angle) * 16, this.y - Math.sin(this.angle) * 16, this.x, this.y);
      g.restore(); G.glow(g, this.x, this.y, 16, this.color, 0.3);
    }
  }

  function strike(p, world, amount, range, arc = 1.1, options = {}) {
    const a = direction(p, world); let hits = 0;
    for (const e of nearby(world, p, range)) {
      const ea = U.angleTo(p.x, p.y, e.x, e.y);
      if (!options.full && Math.abs(U.wrapAngle(ea - a)) > arc) continue;
      let damage = amount;
      if (p.profile.id === 'rorschach' && p.readTarget === e && p.readCharge >= 0.75) {
        damage += 16; p.readCharge = 0;
      }
      if (e.damage(damage, p, 'impact')) {
        hits++;
        if (!e.dead && !e.ko) e.stun = Math.max(e.stun || 0, options.stun || 0.2);
        if (!e.static) e.impulse(Math.cos(ea) * (options.force || 100) * e.mass,
          Math.sin(ea) * (options.force || 100) * e.mass);
        spark(world, e.x, e.y, p.profile.color, 6);
      }
    }
    world.add(new GearArc(p, range, a, p.profile.color, !!options.full));
    p.attackT = 0.18; A.play('am_strike');
    if (hits && world.hitstop) world.hitstop(0.025);
    return hits;
  }

  function traverse(p, world, baseRange, duration, grapple) {
    const a = direction(p, world), reach = baseRange * (1 + p.upgrades.mobility * 0.08);
    let distance = Math.min(reach, U.dist(p.x, p.y, world.mouse.x, world.mouse.y));
    if (distance < 35) distance = Math.min(100, reach);
    // Sweeping the entire route prevents crossing a thin wall between endpoints.
    let safe = 0;
    for (let d = 6; d <= distance; d += 6) {
      if (!world.isFree(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, p.r)) break;
      safe = d;
    }
    if (safe < 12) { p.reticleFail = 0.2; return; }
    p.traversal = { angle: a, left: duration, remaining: safe, speed: safe / duration, grapple };
    p.traversalTrail = [];
    if (grapple) p.grappleLine = { x: p.x + Math.cos(a) * safe, y: p.y + Math.sin(a) * safe, left: duration + 0.1 };
    A.play('am_grapple');
  }

  const heroSpecs = [
    { id: 'niteowl', name: 'Nite Owl', look: 'niteowl', color: '#e3bc6d', tagline: 'A plan for every dark corner.',
      description: 'Armour and stun gear. Plan the approach.',
      health: 110, speed: 205, staminaRegen: 18, armour: 0.85,
      kit: [
        ['BATON', 'C / LMB', 'A measured close strike. Hold to keep fighting.', 'fist', 'telekinesis', 3, 0.46, (p, w) => strike(p, w, 23, 68, 1.05, { stun: 0.35 })],
        ['STUN BOLT', 'Q / RMB', 'A nonlethal bolt. Hold the visor to steady your aim.', 'bolt', 'disintegrate', 13, 0.55, (p, w) => {
          let a = direction(p, w);
          // Q runs before the channelled F gear. Read its live, powered input
          // here rather than the display flag F sets later in this update.
          if (I.down('timesight') && p.energy > 2) {
            const candidates = nearby(w, p, 550).filter(e => Math.abs(U.wrapAngle(U.angleTo(p.x, p.y, e.x, e.y) - a)) < 0.3)
              .sort((a, b) => U.dist(p.x, p.y, a.x, a.y) - U.dist(p.x, p.y, b.x, b.y));
            if (candidates[0]) a = U.angleTo(p.x, p.y, candidates[0].x, candidates[0].y);
          }
          w.add(new GearShot(p, w, { angle: a, damage: 34, stun: 0.6, color: p.profile.color })); A.play('bolt');
        }],
        ['GRAPPLE', 'SPACE', 'Reel forward along a clear route. Walls stop the line.', 'grapple', 'teleport', 16, 1.4, (p, w) => traverse(p, w, 280, 0.32, true)],
        ['CHAFF SMOKE', 'R', 'Smoke breaks target locks; nearby machines are briefly disrupted.', 'smoke', 'duplicate', 28, 8, (p, w) => {
          const cloud = w.add(new Smoke(p, 150, 4, true)); cloud.update(0, w); A.play('am_smoke');
        }],
        ['VISOR', 'HOLD F', 'Highlights evidence and threats; steadies nearby stun-bolt targets.', 'eye', 'timesight', 0, 0, null],
        ['SHOCK RING', 'G', 'A short-range electrical pulse. Stuns and knocks people out.', 'burst', 'expand', 42, 7.5, (p, w) => {
          strike(p, w, 44, 155, Math.PI, { full: true, stun: 1.2, force: 150 }); A.play('pulse');
        }],
      ] },
    { id: 'silkspectre', name: 'Silk Spectre', look: 'silkspectre', color: '#f2cf6d', tagline: 'Be where the blow is not.',
      description: 'Fast combos, vaults and a precise counter-guard.',
      health: 90, speed: 245, staminaRegen: 24, armour: 1.0,
      kit: [
        ['COMBINATION', 'C / LMB', 'Three fast strikes; the third drives the target back.', 'fist', 'telekinesis', 3, 0.29, (p, w) => {
          p.combo = p.comboT > 0 ? (p.combo + 1) % 3 : 0; p.comboT = 1.1;
          strike(p, w, [13, 17, 25][p.combo], 72, 1.2, { stun: 0.18, force: p.combo === 2 ? 220 : 65 });
        }],
        ['RETURN BATON', 'Q / RMB', 'Throw a baton. The returning pass can hit again; catching it restores stamina.', 'baton', 'disintegrate', 17, 0.9, (p, w) => {
          w.add(new GearShot(p, w, { damage: 24, stun: 0.22, color: p.profile.color, speed: 510, life: 1.35, baton: true })); A.play('am_grapple');
        }],
        ['VAULT', 'SPACE', 'A quick physical dodge with brief damage reduction. Solid walls still stop you.', 'grapple', 'teleport', 13, 0.85, (p, w) => traverse(p, w, 190, 0.2, false)],
        ['FEINT', 'R', 'Leave a moving silhouette that draws enemy fire until it is hit or fades.', 'decoy', 'duplicate', 25, 7, (p, w) => { w.add(new Feint(p, w)); A.play('am_grapple'); }],
        ['GUARD', 'HOLD F', 'Face the threat. A newly timed guard counters nearby attackers; holding it reduces frontal damage.', 'guard', 'timesight', 0, 0, null],
        ['SWEEP', 'G', 'A full turning kick that clears space around you.', 'spin', 'expand', 34, 5.5, (p, w) => strike(p, w, 33, 125, Math.PI, { full: true, stun: 0.6, force: 260 })],
      ] },
    { id: 'rorschach', name: 'Rorschach', look: 'rorschach', color: '#e4d9bd', tagline: 'Every street leaves a witness.',
      description: 'Heavy fists, hooks and an eye for hidden weaknesses.',
      health: 100, speed: 220, staminaRegen: 20, armour: 0.95,
      kit: [
        ['HEAVY HAND', 'C / LMB', 'A deliberate close hit. Reading the opponent first makes it stronger.', 'fist', 'telekinesis', 5, 0.62, (p, w) => strike(p, w, 33, 70, 1.0, { stun: 0.4, force: 130 })],
        ['HOOK', 'Q / RMB', 'Catch the closest aimed opponent and pull them toward you. Walls obstruct it.', 'grapple', 'disintegrate', 16, 1.1, (p, w) => {
          const a = direction(p, w), foes = nearby(w, p, 265)
            .filter(e => Math.abs(U.wrapAngle(U.angleTo(p.x, p.y, e.x, e.y) - a)) < 0.5)
            .sort((a, b) => U.dist(p.x, p.y, a.x, a.y) - U.dist(p.x, p.y, b.x, b.y));
          const e = foes[0];
          if (e) {
            e.damage(16, p, 'impact'); e.stun = Math.max(e.stun || 0, 0.5);
            if (!e.static && !e.dead && !e.ko) { const n = U.norm(p.x - e.x, p.y - e.y); e.impulse(n.x * 370 * e.mass, n.y * 370 * e.mass); }
            p.grappleLine = { x: e.x, y: e.y, left: 0.22 }; spark(w, e.x, e.y, p.profile.color);
          } else p.reticleFail = 0.15;
          A.play('am_grapple');
        }],
        ['ZIPLINE', 'SPACE', 'A physical hook-assisted lunge along a clear line.', 'grapple', 'teleport', 17, 1.35, (p, w) => traverse(p, w, 230, 0.29, true)],
        ['SMOKE', 'R', 'Break gunmen\'s target locks while you stay inside the smoke. Moving bullets remain dangerous.', 'smoke', 'duplicate', 24, 7.5, (p, w) => {
          const cloud = w.add(new Smoke(p, 140, 4.5, false)); cloud.update(0, w); A.play('am_smoke');
        }],
        ['READ THE SCENE', 'HOLD F', 'Reveals evidence and threats. Watch an aimed opponent for a moment, then strike a weakness.', 'eye', 'timesight', 0, 0, null],
        ['INTIMIDATE', 'G', 'Force nearby people to hesitate and step back; machines only stagger briefly.', 'burst', 'expand', 31, 6, (p, w) => {
          for (const e of nearby(w, p, 185)) {
            e.damage(e.human ? 14 : 6, p, 'impact'); e.stun = Math.max(e.stun || 0, e.human ? 1.5 : 0.35);
            if (!e.static) { const n = U.norm(e.x - p.x, e.y - p.y); e.impulse(n.x * 240 * e.mass, n.y * 240 * e.mass); }
          }
          w.add(new GearArc(p, 185, 0, p.profile.color, true)); A.play('am_strike');
        }],
      ] },
  ];

  const heroes = heroSpecs.map(spec => {
    const hero = Object.assign({}, spec);
    hero.abilities = spec.kit.map((v, index) => ({ id: `am_${spec.id}_${index}`, name: v[0], key: v[1], desc: v[2] }));
    return hero;
  });

  for (const hero of heroes) hero.kit.forEach((kit, index) => {
    const def = {
      id: hero.abilities[index].id, name: kit[0], label: kit[0], desc: kit[2], tip: `${kit[1]} · ${kit[2]}`,
      icon: glyph(kit[3]), action: kit[4], forms: ['vigilante'], color: hero.color, cost: kit[5], cooldown: kit[6],
      channelRegen: index === 4 ? 0.15 : undefined,
      update(p, s, world, dt) {
        s.active = false;
        const pressed = I.pressed(this.action) || !!s.latchPress;
        s.latchPress = false;
        if (!p.canUsePowers) { s.buffer = 0; return; }
        if (index === 4) {
          s.active = I.down(this.action) && p.energy > 2;
          if (!s.active) return;
          p.drain = true; p.energy = Math.max(0, p.energy - (hero.id === 'silkspectre' ? 10 : 11) * dt);
          if (hero.id === 'silkspectre') { p.guarding = true; p.guardAge += dt; }
          else {
            p.investigating = true;
            if (hero.id === 'rorschach') {
              const a = direction(p, world);
              const target = nearby(world, p, 370).filter(e => Math.abs(U.wrapAngle(U.angleTo(p.x, p.y, e.x, e.y) - a)) < 0.65)
                .sort((a, b) => U.dist(p.x, p.y, a.x, a.y) - U.dist(p.x, p.y, b.x, b.y))[0];
              if (target !== p.readTarget) { p.readTarget = target; p.readCharge = 0; }
              if (target) p.readCharge = Math.min(1, p.readCharge + dt);
            }
          }
          return;
        }
        // Hold-to-fight on the primary; other gear gets a short honest buffer.
        if (index === 0) s.buffer = I.down(this.action) || pressed ? 0.12 : 0;
        else if (pressed) s.buffer = 0.16 + Math.min(0.3, Math.max(0, s.cd));
        if (!(s.buffer > 0)) return;
        s.buffer = Math.max(0, s.buffer - dt);
        if (s.cd > 0) return;
        s.buffer = 0;
        if (!p.spend(this.cost)) return;
        s.cd = this.cooldown * (1 - 0.06 * p.upgrades.mobility);
        kit[7](p, world);
      },
    };
    DM.Powers.register(def);
  });

  class Vigilante extends DM.Player {
    constructor(id, upgrades = {}) {
      super(0, 0);
      this.profile = heroes.find(hero => hero.id === id) || heroes[0];
      this.form = 'vigilante';
      this.look = Object.assign({}, DM.LOOKS[this.profile.look] || DM.LOOKS.laurie);
      this.gearLabel = 'STAMINA / FIELD GEAR';
      this.upgrades = { vitality: validLevel(upgrades.vitality), capacitor: validLevel(upgrades.capacitor), mobility: validLevel(upgrades.mobility) };
      this.syncUpgradeStats();
      this.coherence = this.maxCoherence; this.energy = this.maxEnergy;
      this.combo = 0; this.comboT = 0; this.attackT = 0; this.guardAge = 0;
      this.readCharge = 0; this.readTarget = null;
      this.traversal = null; this.traversalTrail = [];
      this.investigating = false; this.guarding = false; this.inSmoke = false;
      for (const ability of this.profile.abilities) this.unlock(ability.id);
      this.controlRows = [
        ['MOVE / AIM', 'WASD / ARROWS · MOUSE'],
        ...this.profile.abilities.map(a => [a.name, a.key]),
        ['INTERACT / RESCUE', 'E'], ['LAST HINT', 'H'], ['PAUSE', 'ESC / P'], ['MUTE', 'M'],
      ];
    }
    syncUpgradeStats() {
      this.maxCoherence = this.profile.health + this.upgrades.vitality * 15;
      this.maxEnergy = 100 + this.upgrades.capacitor * 12;
      this.energyRegen = this.profile.staminaRegen + this.upgrades.capacitor * 2;
    }
    applyUpgrade(id) {
      if (!Object.prototype.hasOwnProperty.call(this.upgrades, id) || this.upgrades[id] >= 3) return false;
      this.upgrades[id]++;
      this.syncUpgradeStats();
      if (id === 'vitality') this.coherence = Math.min(this.maxCoherence, this.coherence + 15);
      if (id === 'capacitor') this.energy = Math.min(this.maxEnergy, this.energy + 12);
      return true;
    }
    get speedMax() { return this.profile.speed * this.speedMul * (1 + this.upgrades.mobility * 0.05) * (this.guarding ? 0.72 : 1); }
    update(dt, world) {
      const wasGuarding = this.guarding;
      this.investigating = false; this.guarding = false;
      this.attackT = Math.max(0, this.attackT - dt); this.comboT = Math.max(0, this.comboT - dt);
      if (this.grappleLine) { this.grappleLine.left -= dt; if (this.grappleLine.left <= 0) this.grappleLine = null; }
      const regen = this.coherenceRegen;
      // Human recovery is slower than Jon's. Keep Story/Normal/Hard's relative
      // recovery without overwriting the shared challenge configuration.
      this.coherenceRegen = Math.max(0, (regen == null ? 9 : regen) * 0.22);
      super.update(dt, world);
      this.coherenceRegen = regen;
      if (!this.guarding || !wasGuarding) this.guardAge = 0;
      if (!this.investigating) { this.readCharge = 0; this.readTarget = null; }
      this.inSmoke = world.entities.some(e => e.amSmoke && e.owner === this && e.contains(this));
      this.targetable = !this.inSmoke && !this.down;
      if (this.traversal && !this.locked && !this.down && !world.ceasefire) {
        const move = this.traversal;
        this.traversalTrail.push({ x: this.x, y: this.y, left: 0.25 });
        if (this.traversalTrail.length > 10) this.traversalTrail.shift();
        let distance = Math.min(move.remaining, move.speed * dt);
        while (distance > 0) {
          const step = Math.min(5, distance), x = this.x + Math.cos(move.angle) * step, y = this.y + Math.sin(move.angle) * step;
          if (!world.isFree(x, y, this.r)) { move.remaining = 0; break; }
          this.x = x; this.y = y; distance -= step; move.remaining -= step;
        }
        this.vx = this.vy = 0; move.left -= dt;
        if (move.left <= 0 || move.remaining <= 0.1) this.traversal = null;
      } else if (this.locked || this.down) this.traversal = null;
      for (const t of this.traversalTrail) t.left -= dt;
      this.traversalTrail = this.traversalTrail.filter(t => t.left > 0);
    }
    damage(amount, source, kind) {
      if (this.locked || this.down || this.invuln > 0 || this.godMode) return false;
      amount *= this.profile.armour;
      if (this.traversal && this.profile.id === 'silkspectre') amount *= 0.3;
      if (this.guarding && source && this.energy >= 6) {
        const angle = U.angleTo(this.x, this.y, source.x, source.y);
        if (Math.abs(U.wrapAngle(angle - this.facing)) < Math.PI * 0.6) {
          this.energy -= 6;
          const timed = this.guardAge <= 0.3;
          amount *= timed ? 0.15 : 0.45;
          if (timed && this.world) {
            strike(this, this.world, 15, 90, 1.4, { stun: 0.55, force: 170 });
            A.play('am_parry');
          }
        }
      }
      return super.damage(amount, source, kind);
    }
    light() {
      return { r: this.investigating ? 210 : 145, i: 0.7, color: this.profile.color, k: 0.11 };
    }
    render(g, world) {
      if (this.hidden) return;
      G.figure(g, Object.assign({}, this.look, { x: this.x, y: this.y, angle: this.facing,
        walk: this.walk, moving: this.moving, aim: this.attackT > 0, pose: this.down ? 'down' : null,
        flash: this.hurtT > 0 ? Math.min(0.7, this.hurtT * 2) : 0 }));
      if (this.down) return;
      g.save(); g.translate(this.x, this.y); g.rotate(this.facing);
      if (this.profile.id === 'niteowl') {
        g.fillStyle = '#80633e'; g.beginPath(); g.moveTo(-3, -6); g.lineTo(-3, -11); g.lineTo(4, -6);
        g.moveTo(-3, 6); g.lineTo(-3, 11); g.lineTo(4, 6); g.fill();
        g.strokeStyle = '#e4c377'; g.lineWidth = 2;
        for (const y of [-3, 3]) { G.circle(g, 6, y, 2.5); g.stroke(); }
      } else if (this.profile.id === 'rorschach') {
        g.fillStyle = '#e6e2d2'; G.ellipse(g, 7, 0, 3, 5); g.fill();
        g.fillStyle = '#252527'; G.ellipse(g, 8, -2, 1.5, 1); g.fill(); G.ellipse(g, 8, 2, 1.5, 1); g.fill();
      } else if (this.attackT > 0) {
        g.strokeStyle = '#d7b865'; g.lineWidth = 3; G.line(g, 11, 6, 30, 14);
      }
      g.restore();
      if (world && !world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      if (this.down || this.hidden) return;
      if (this.guarding) {
        g.save(); g.strokeStyle = this.guardAge < 0.3 ? '#fff2bd' : this.profile.color; g.lineWidth = 3;
        g.beginPath(); g.arc(this.x, this.y, 23, this.facing - 1.15, this.facing + 1.15); g.stroke(); g.restore();
      }
      if (this.investigating && this.world) {
        const w = this.world, radius = this.profile.id === 'niteowl' ? 650 : 490;
        for (const e of w.entities) {
          if (e.dead || U.dist(this.x, this.y, e.x, e.y) > radius || (!liveFoe(e) && !e.amEvidence)) continue;
          ring(g, e.x, e.y, (e.r || 15) + 8 + Math.sin(this.age * 3) * 2, e.amEvidence ? '#e8c468' : this.profile.color, 1.3);
          if (e === this.readTarget) {
            g.save(); g.strokeStyle = '#f3dab0'; g.lineWidth = 3;
            g.beginPath(); g.arc(e.x, e.y, (e.r || 15) + 14, -Math.PI / 2, -Math.PI / 2 + this.readCharge * TAU); g.stroke(); g.restore();
          }
        }
      }
    }
    renderFx(g) {
      if (this.hidden) return;
      for (const t of this.traversalTrail) {
        g.save(); g.globalAlpha *= t.left * 0.5;
        G.figure(g, Object.assign({}, this.look, { x: t.x, y: t.y, angle: this.facing, noShadow: true })); g.restore();
      }
      if (this.grappleLine) {
        g.save(); g.strokeStyle = '#c2b28c'; g.lineWidth = 1.3;
        G.line(g, this.x, this.y, this.grappleLine.x, this.grappleLine.y); g.restore();
      }
    }
  }

  AM.heroes = heroes;
  AM.Vigilante = Vigilante;
  AM.Smoke = Smoke;
  AM.Feint = Feint;
  AM.GearShot = GearShot;
  AM.createPlayer = (id, upgrades) => new Vigilante(id, upgrades);
})();
