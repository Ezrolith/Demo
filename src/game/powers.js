/*
 * Powers registry.
 *
 * A power is a plain definition object:
 *   id, name, action (Input action), forms (which player forms can use it),
 *   color, cost, cooldown, desc, tip (shown on the unlock card)
 *   update(player, state, world, dt)   — every frame while unlocked
 *   render(ctx, player, state, world)  — optional world-space effects
 *
 * Per-player state lives in player.powers[id] = { cd, active, ... }.
 * The HUD shows every unlocked power for the current form, in registration
 * order. To add a power: register it here, then grant it from a chapter stage
 * (`grants: ['myPower']` + `yield ctx.unlock('myPower')`).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Audio = DM.Audio;

  const Powers = { list: [], byId: {} };
  Powers.register = (def) => {
    def.forms = def.forms || ['manhattan'];
    def.cost = def.cost || 0;
    def.cooldown = def.cooldown || 0;
    Powers.list.push(def);
    Powers.byId[def.id] = def;
    return def;
  };
  Powers.get = (id) => Powers.byId[id];

  // Clamp a point to within `range` of the player.
  function reach(p, x, y, range) {
    const dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= range) return { x, y, clamped: false };
    return { x: p.x + (dx / d) * range, y: p.y + (dy / d) * range, clamped: true };
  }

  // ---- Coalesce (awareness form) -------------------------------------------
  Powers.register({
    id: 'coalesce',
    name: 'Coalesce',
    action: 'telekinesis',
    forms: ['awareness'],
    color: '#9fe8ff',
    desc: 'Your scattered atoms drift toward you when you pass near them.',
    tip: 'Hold LEFT CLICK to widen your pull. Return to the chamber to rebuild yourself.',
    update(p, s, world, dt) {
      s.active = p.canUsePowers && Input.down('telekinesis') && p.energy > 1;
      if (s.active) {
        p.drain = true;
        p.energy -= 20 * dt;
      }
      p.pullRadius = U.damp(p.pullRadius, p.basePull * (s.active ? 2.1 : 1), 8, dt);
    },
  });

  // ---- Telekinesis ---------------------------------------------------------
  function findGrab(world, p, mx, my, range) {
    let best = null, bd = Infinity;
    for (const e of world.entities) {
      if (!e.grabbable || e.dead || e === p) continue;
      if (e.heldBy && e.heldBy !== p) continue;
      const dm = U.dist(mx, my, e.x, e.y) - e.r;
      if (dm > 30) continue;
      if (U.dist(p.x, p.y, e.x, e.y) > range + e.r) continue;
      if (dm < bd) {
        bd = dm;
        best = e;
      }
    }
    return best;
  }
  function tkRelease(p, s, world, quiet) {
    const e = s.target;
    s.target = null;
    s.active = false;
    Audio.hum('tk', false);
    if (!e) return;
    if (e.heldBy === p) {
      e.heldBy = null;
      e.thrown = 1.0;
      e.vx *= 1.15;
      e.vy *= 1.15;
      if (e.team === 'enemy') e.stun = Math.max(e.stun, 0.9); // no mid-air recovery
      if (e.onRelease) e.onRelease(p, world);
      if (!quiet && e.speed > 260) Audio.play('throw');
    }
  }

  Powers.register({
    id: 'telekinesis',
    name: 'Telekinesis',
    action: 'telekinesis',
    color: '#5fd4ff',
    desc: 'Lift objects (and people) with your mind.',
    tip: 'HOLD LEFT CLICK on something to lift it. Move the mouse to carry it. Flick and let go to throw. Thrown people are knocked out, not killed.',
    range: 430,
    update(p, s, world, dt) {
      const m = world.mouse;
      const range = this.range * p.scale;
      if (s.target && (s.target.dead || s.target.heldBy !== p || !s.target.grabbable || !Input.down('telekinesis') || !p.canUsePowers || p.energy <= 0)) {
        tkRelease(p, s, world);
      }
      if (!s.target) {
        s.hover = p.canUsePowers ? findGrab(world, p, m.x, m.y, range) : null;
        if (p.canUsePowers && Input.pressed('telekinesis') && s.hover) {
          const e = s.hover;
          if (e.mass > p.tkMaxMass()) {
            Audio.play('fail');
            world.bark(p, p.has('expand') ? 'Too massive. I need to be larger.' : 'Too massive.', 1.4);
          } else {
            s.target = e;
            e.heldBy = p;
            if (e.onGrab) e.onGrab(p, world);
            Audio.play('tk_grab');
          }
        }
        return;
      }
      const e = s.target;
      s.active = true;
      p.drain = true;
      p.energy -= (3 + e.mass * 1.1) * dt;
      const pt = reach(p, m.x, m.y, range);
      const sq = Math.sqrt(Math.max(0.5, e.mass));
      const maxV = (1150 / sq) * Math.max(1, p.scale * 0.8);
      let tvx = (pt.x - e.x) * 10, tvy = (pt.y - e.y) * 10;
      const tl = Math.hypot(tvx, tvy);
      if (tl > maxV) {
        tvx *= maxV / tl;
        tvy *= maxV / tl;
      }
      const resp = (16 / sq) * p.scale;
      e.vx = U.damp(e.vx, tvx, resp, dt);
      e.vy = U.damp(e.vy, tvy, resp, dt);
      e.thrown = Math.max(e.thrown, 0.15);
      Audio.hum('tk', true, { freq: 70, cutoff: 420, gain: 0.04, mod: Math.min(2, e.speed / 500) });
      if (Math.random() < dt * 30) world.particles.emit(e.x + U.rand(-e.r, e.r), e.y + U.rand(-e.r, e.r), { vx: U.rand(-20, 20), vy: U.rand(-20, 20), life: 0.5, size: 2, color: '#9fe8ff' });
    },
    render(ctx, p, s, world) {
      const t = world.realTime || 0;
      if (s.hover && !s.target) {
        const e = s.hover;
        const heavy = e.mass > p.tkMaxMass();
        ctx.save();
        ctx.strokeStyle = heavy ? 'rgba(255,120,100,0.6)' : 'rgba(127,227,255,0.65)';
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -t * 30;
        ctx.lineWidth = 1.5;
        Gfx.circle(ctx, e.x, e.y, e.r + 7);
        ctx.stroke();
        ctx.restore();
      }
      const e = s.target;
      if (!e) return;
      const hx = p.x + Math.cos(p.facing) * 14 * p.scale, hy = p.y + Math.sin(p.facing) * 14 * p.scale;
      const dx = e.x - hx, dy = e.y - hy;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k === 0 ? 'rgba(127,227,255,0.55)' : 'rgba(95,212,255,0.25)';
        ctx.lineWidth = k === 0 ? 2 : 5 - k;
        ctx.beginPath();
        for (let i = 0; i <= 18; i++) {
          const f = i / 18;
          const w = Math.sin(f * Math.PI) * Math.sin(t * 9 + f * 10 + k * 2) * (6 + k * 3);
          const x = hx + dx * f + nx * w, y = hy + dy * f + ny * w;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      Gfx.glow(ctx, e.x, e.y, e.r * 2.6, '#5fd4ff', 0.55);
      ctx.save();
      ctx.strokeStyle = 'rgba(190,240,255,0.8)';
      ctx.lineWidth = 1.5;
      Gfx.circle(ctx, e.x, e.y, e.r + 5 + Math.sin(t * 8) * 1.5);
      ctx.stroke();
      ctx.restore();
    },
  });

  // ---- Disintegrate --------------------------------------------------------
  Powers.register({
    id: 'disintegrate',
    name: 'Disintegrate',
    action: 'disintegrate',
    color: '#ffb27a',
    cost: 20,
    cooldown: 0.45,
    range: 520,
    desc: 'Undo the bonds that hold matter together. Permanent.',
    tip: 'Press Q or RIGHT CLICK to disintegrate whatever is under the cursor. Tougher things take several hits.',
    update(p, s, world, dt) {
      s.pending = s.pending || [];
      for (const b of s.pending) {
        b.t -= dt;
        if (b.t <= 0) this.resolve(p, b, world);
      }
      s.pending = s.pending.filter((b) => b.t > 0);
      if (!p.canUsePowers || !Input.pressed('disintegrate') || s.cd > 0) return;
      if (!p.spend(this.cost)) return;
      s.cd = this.cooldown;
      const pt = reach(p, world.mouse.x, world.mouse.y, this.range * p.scale);
      const b = { x: pt.x, y: pt.y, t: 0.16, r: p.scale > 1.3 ? 80 : 50 };
      s.pending.push(b);
      world.particles.implode(b.x, b.y, b.r * 1.2, 14, { life: 0.16 });
      world.emitCast(b);
      Audio.play('dis_charge');
    },
    resolve(p, b, world) {
      let hits = 0;
      for (const e of world.entities) {
        if (e.dead || e === p || e.team === 'player') continue;
        if (!e.disintegratable) continue;
        if (U.dist(b.x, b.y, e.x, e.y) > b.r + e.r * 0.6) continue;
        if (e.shieldR && U.dist(p.x, p.y, e.x, e.y) > e.shieldR) {
          if (e.onShieldBlock) e.onShieldBlock(world);
          continue;
        }
        hits++;
        if (e.hp == null || e.hp <= 70 || e.alwaysDisintegrate) e.disintegrate(world, p);
        else e.damage(70, p, 'disintegrate');
      }
      const P = world.particles;
      P.emit(b.x, b.y, { shape: 'ring', size: 6, size1: b.r * 1.3, life: 0.3, color: '#dff7ff', drag: 0 });
      P.burst(b.x, b.y, 18, { color: ['#ffffff', '#bff1ff', '#ffb27a'], speed: [80, 300], life: [0.15, 0.4], size: [1.5, 3], shape: 'spark', drag: 4 });
      Audio.play('disintegrate');
      world.camera.shake(hits ? 0.22 : 0.08);
      DM.Events.emit('power:disintegrate', { x: b.x, y: b.y, hits });
    },
    render(ctx, p, s, world) {
      if (!p.canUsePowers) return;
      for (const b of s.pending || []) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,220,190,0.9)';
        ctx.lineWidth = 2;
        Gfx.circle(ctx, b.x, b.y, b.r * (0.4 + b.t * 3));
        ctx.stroke();
        ctx.restore();
      }
      const pt = reach(p, world.mouse.x, world.mouse.y, this.range * p.scale);
      if (pt.clamped) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,178,122,0.35)';
        ctx.setLineDash([3, 5]);
        Gfx.line(ctx, pt.x, pt.y, world.mouse.x, world.mouse.y);
        Gfx.circle(ctx, pt.x, pt.y, 6);
        ctx.stroke();
        ctx.restore();
      }
    },
  });

  // ---- Teleport -------------------------------------------------------------
  Powers.register({
    id: 'teleport',
    name: 'Teleport',
    action: 'teleport',
    color: '#c9a7ff',
    cost: 16,
    cooldown: 0.5,
    range: 380,
    desc: 'Be somewhere else. Walls, chasms and shields do not apply.',
    tip: 'Press SPACE to teleport to the cursor (within range).',
    update(p, s, world, dt) {
      if (!p.canUsePowers || !Input.pressed('teleport') || s.cd > 0) return;
      const pt = reach(p, world.mouse.x, world.mouse.y, this.range * p.scale);
      const dx = pt.x - p.x, dy = pt.y - p.y;
      const d = Math.hypot(dx, dy);
      let dest = null;
      for (let k = 0; k <= d; k += 10) {
        const f = (d - k) / (d || 1);
        const x = p.x + dx * f, y = p.y + dy * f;
        if (world.isFree(x, y, p.r)) {
          dest = { x, y };
          break;
        }
      }
      if (!dest || U.dist(p.x, p.y, dest.x, dest.y) < 20) {
        Audio.play('fail');
        return;
      }
      if (!p.spend(this.cost)) return;
      s.cd = this.cooldown;
      const from = { x: p.x, y: p.y };
      world.add(new DM.Special.Afterimage(p));
      world.particles.burst(p.x, p.y, 22, { color: ['#7fe3ff', '#c9a7ff', '#ffffff'], speed: [30, 160], life: [0.3, 0.7], size: [1.5, 3] });
      p.x = dest.x;
      p.y = dest.y;
      p.vx *= 0.3;
      p.vy *= 0.3;
      p.invuln = Math.max(p.invuln, 0.35);
      p.teleportedAt = world.realTime;
      world.particles.emit(p.x, p.y, { shape: 'ring', size: 4, size1: 40 * p.scale, life: 0.3, color: '#c9a7ff', drag: 0 });
      world.particles.burst(p.x, p.y, 18, { color: ['#7fe3ff', '#ffffff'], speed: [60, 220], life: [0.2, 0.5], size: [1.5, 3] });
      Audio.play('teleport');
      DM.Events.emit('player:teleport', { from, to: dest });
    },
  });

  // ---- Quantum Duplication ---------------------------------------------------
  Powers.register({
    id: 'duplicate',
    name: 'Duplicate',
    action: 'duplicate',
    color: '#7bd88f',
    cost: 50,
    cooldown: 9,
    desc: 'Divide your attention. And yourself.',
    tip: 'Press R to split off two copies of yourself. They hunt nearby threats for a few seconds.',
    update(p, s, world, dt) {
      if (!p.canUsePowers || !Input.pressed('duplicate')) return;
      if (s.cd > 0) {
        Audio.play('fail');
        return;
      }
      if (!p.spend(this.cost)) return;
      s.cd = this.cooldown;
      const mine = world.entities.filter((e) => e.isDuplicate && !e.dead);
      while (mine.length > 2) mine.shift().expire(world);
      for (const side of [-1, 1]) {
        const a = p.facing + side * 1.9;
        let x = p.x + Math.cos(a) * 42, y = p.y + Math.sin(a) * 42;
        if (!world.isFree(x, y, 12)) {
          x = p.x;
          y = p.y;
        }
        world.add(new DM.Special.Duplicate(p, x, y, 10));
        world.particles.burst(x, y, 16, { color: ['#7fe3ff', '#7bd88f', '#ffffff'], speed: [40, 180], life: [0.2, 0.6], size: [1.5, 3] });
      }
      Audio.play('duplicate');
    },
  });

  // ---- Temporal Sight -------------------------------------------------------
  Powers.register({
    id: 'timesight',
    name: 'Temporal Sight',
    action: 'timesight',
    color: '#f2c418',
    desc: 'See every moment at once. The world slows; what is about to happen becomes visible.',
    tip: 'HOLD F or SHIFT. Time slows, incoming danger is marked and hidden memories appear. Drains energy.',
    update(p, s, world, dt) {
      const want = p.canUsePowers && Input.down('timesight') && p.energy > 0.5 && !p.jammed;
      if (want !== s.active) {
        s.active = want;
        Audio.play(want ? 'timesight_on' : 'timesight_off');
        Audio.setMusicFilter(want ? 650 : 18000);
        if (!want && p.jammed && Input.down('timesight')) world.bark(p, 'Tachyons. I cannot see.', 1.4);
      }
      world.slowmo = s.active;
      world.timesight = s.active;
      if (s.active) {
        p.drain = true;
        p.energy -= 12 * dt;
      }
    },
  });

  // ---- Expand ---------------------------------------------------------------
  Powers.register({
    id: 'expand',
    name: 'Expand',
    action: 'expand',
    color: '#ff8fb8',
    cost: 55,
    cooldown: 16,
    desc: 'Mass is a matter of opinion. Grow, briefly, to the size of a building.',
    tip: 'Press G to grow for a few seconds: a shockwave, triple strength, bullets barely register, and you can lift the heaviest things.',
    update(p, s, world, dt) {
      if (!p.canUsePowers || !Input.pressed('expand')) return;
      if (s.cd > 0 || p.expandT > 0) {
        Audio.play('fail');
        return;
      }
      if (!p.spend(this.cost)) return;
      s.cd = this.cooldown;
      p.expandT = 7;
      p.targetScale = 2.2;
      world.camera.targetZoom = world.baseZoom * 0.8;
      for (const e of world.entities) {
        if (e === p || e.dead || e.static || e.team === 'player') continue;
        const d = U.dist(p.x, p.y, e.x, e.y);
        if (d > 260) continue;
        const n = U.norm(e.x - p.x, e.y - p.y);
        const k = 1 - d / 260;
        e.vx += (n.x * 900 * k) / Math.sqrt(e.mass);
        e.vy += (n.y * 900 * k) / Math.sqrt(e.mass);
        if (e.team === 'enemy') {
          e.stun = Math.max(e.stun, 1.2);
          e.thrown = 0.6;
        }
        if (e.isProjectile) e.die('blocked');
      }
      world.particles.emit(p.x, p.y, { shape: 'ring', size: 20, size1: 270, life: 0.45, color: '#ff8fb8', drag: 0 });
      world.particles.burst(p.x, p.y, 40, { color: ['#7fe3ff', '#ff8fb8', '#ffffff'], speed: [200, 520], life: [0.3, 0.7], size: [2, 4], shape: 'spark', drag: 3 });
      world.camera.shake(0.6);
      Audio.play('expand');
    },
  });

  DM.Powers = Powers;
})();
