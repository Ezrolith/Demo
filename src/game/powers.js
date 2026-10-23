/*
 * Powers registry.
 *
 * A power is a plain definition object:
 *   id, name, action (Input action), forms (which player forms can use it),
 *   color, cost, cooldown, desc, tip (shown on the unlock card)
 *   update(player, state, world, dt)   — every frame while unlocked
 *   render(ctx, player, state, world)  — optional world-space effects
 *   channelRegen                       — optional: energy regen multiplier while
 *                                        state.active (a channelled power)
 *
 * Press-type powers (press: true) share one buffered input path instead of
 * reading Input.pressed themselves: they define
 *   blocked(player, state, world)      — why it cannot fire now, or null
 *   fire(player, state, world)         — cast it (energy is already affordable)
 *   onFail(player, state, world, why)  — optional extra failure feedback
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
  const TAU = Math.PI * 2;

  const Powers = { list: [], byId: {}, frame: 0 };
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

  // ---- Buffered presses ----------------------------------------------------
  // A press is remembered for BUFFER seconds, and a press made near the end of a
  // cooldown (within QUEUE) waits for it, so a key tapped a moment early still
  // casts. A press that expires unspent fails out loud: a 'fail' blip and a red
  // pulse on the reticle.
  const BUFFER = 0.15;
  const QUEUE = 0.5;

  function arm(s) {
    s.buf = BUFFER + (s.cd > 0 && s.cd <= QUEUE ? s.cd : 0);
  }

  function fail(p, why) {
    if (why === 'energy') p.noEnergyT = 0.4;
    p.reticleFail = 0.25;
    Audio.play('fail');
  }

  function pressUpdate(def, p, s, world, dt) {
    if (!p.canUsePowers) {
      s.buf = 0;
      return;
    }
    if (Input.pressed(def.action)) arm(s);
    if (!(s.buf > 0)) return;
    const why = def.blocked(p, s, world);
    if (!why) {
      s.buf = 0;
      def.fire(p, s, world);
      return;
    }
    s.buf -= dt;
    if (s.buf <= 0) {
      s.buf = 0;
      if (def.onFail) def.onFail(p, s, world, why);
      fail(p, why);
    }
  }

  // Frames where the world is frozen (hitstop) skip the player's update, so the
  // powers never see presses made during them. At the end of each frame, presses
  // the powers did not get to read are latched into their buffers instead.
  // Player.update stamps p.powerFrame; only a scene that was already on top last
  // frame counts, so the key that closes an overlay is not replayed into Jon.
  Powers.latch = (p) => {
    for (const def of Powers.list) {
      const s = p.powers[def.id];
      if (!s || !def.forms.includes(p.form) || !Input.pressed(def.action)) continue;
      if (def.press) arm(s);
      else s.latchPress = true;
    }
  };
  const endFrame = Input.endFrame;
  Input.endFrame = function () {
    const top = DM.Engine && DM.Engine.top();
    const p = top && top.player;
    if (p && p.powers && top === Powers.lastTop && p.world === top.world && p.powerFrame !== Powers.frame && p.canUsePowers) Powers.latch(p);
    Powers.lastTop = top;
    Powers.frame++;
    return endFrame.apply(this, arguments);
  };

  // ---- Coalesce (awareness form) -------------------------------------------
  Powers.register({
    id: 'coalesce',
    name: 'Coalesce',
    action: 'telekinesis',
    forms: ['awareness'],
    color: '#9fe8ff',
    channelRegen: 0,
    desc: 'Your scattered atoms drift toward you when you pass near them.',
    tip: 'Hold LEFT CLICK (or C) to widen your pull. Return to the chamber to rebuild yourself.',
    update(p, s, world, dt) {
      s.latchPress = false;
      s.active = p.canUsePowers && Input.down('telekinesis') && p.energy > 1;
      if (s.active) {
        p.drain = true;
        p.energy -= 20 * dt;
      }
      p.pullRadius = U.damp(p.pullRadius, p.basePull * (s.active ? 2.1 : 1), 8, dt);
    },
  });

  // ---- Telekinesis ---------------------------------------------------------
  // How a release reads: the fastest motion of the last `hist` seconds decides.
  // Faster than `flick` is a throw of at least throwV / sqrt(mass), bent toward
  // an enemy near its line. Slower is a gentle drop, so crates and crystals can
  // be set down in zones and slots, unless an enemy is right under the cursor,
  // in which case the object is thrown at them.
  const TK = {
    grabMin: 8, // energy needed to start a lift
    relock: 0.3, // seconds before the next lift after running dry
    hist: 0.12, // how far back a release looks for the throwing motion
    histToggle: 0.2, // toggle mode: a click lands a moment after the flick
    flick: 150,
    throwV: 800,
    aimRange: 650,
    aimCone: 0.32,
    dropAim: 110,
    settle: 2.5, // the grab point eases onto the cursor instead of snapping to it
    preview: 0.35, // seconds of flight drawn by the predicted path
  };
  const boosted = []; // things thrown while expanded: { e, mul } until they land

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

  // Someone worth throwing `held` at: an active enemy it can actually hit (crates
  // pass under flying drones; a thrown missile bursts next to anything).
  function isFoe(t, held) {
    if (t === held || t.team !== 'enemy' || t.dead || t.ko || t.isProjectile || t.yielded || t.hidden) return false;
    return !!t.flying === !!held.flying || !!held.isProjectile;
  }

  // The enemy best lined up with a throw from e along (vx, vy), if any.
  function aimAssist(world, e, vx, vy) {
    const dir = Math.atan2(vy, vx);
    let best = null, bs = Infinity;
    for (const t of world.entities) {
      if (!isFoe(t, e)) continue;
      const d = U.dist(e.x, e.y, t.x, t.y);
      if (d > TK.aimRange || d < 1) continue;
      const ang = Math.abs(U.wrapAngle(U.angleTo(e.x, e.y, t.x, t.y) - dir));
      if (ang > TK.aimCone || !world.los(e.x, e.y, t.x, t.y)) continue;
      const score = ang / TK.aimCone + d / TK.aimRange;
      if (score < bs) {
        bs = score;
        best = t;
      }
    }
    return best;
  }

  // Velocity that meets t, leading its motion.
  function leadAt(e, t, speed) {
    const lt = U.dist(e.x, e.y, t.x, t.y) / speed;
    const n = U.norm(t.x + t.vx * lt - e.x, t.y + t.vy * lt - e.y);
    return { vx: n.x * speed, vy: n.y * speed };
  }

  // What letting go right now would do: { vx, vy, target } for a throw, or null
  // for a drop (the object keeps its own slow drift and stops with normal friction).
  function throwPlan(p, s, world, e) {
    const sq = Math.sqrt(Math.max(0.5, e.mass));
    const big = Math.max(1, p.scale * 0.8);
    const maxV = (1150 / sq) * big * 1.15;
    const minV = Math.min(maxV, (TK.throwV / sq) * big);
    const now = world.realTime || 0;
    const hist = DM.Save.settings.tkMode === 'toggle' ? TK.histToggle : TK.hist;
    let fast = null, fs = 0;
    for (const h of s.vHist) {
      if (now - h.t > hist) continue;
      const v = Math.hypot(h.vx, h.vy);
      if (v > fs) {
        fs = v;
        fast = h;
      }
    }
    if (fast && fs > TK.flick) {
      const sp = U.clamp(fs * 1.15, minV, maxV);
      const target = aimAssist(world, e, fast.vx, fast.vy);
      const v = target ? leadAt(e, target, sp) : { vx: (fast.vx / fs) * sp, vy: (fast.vy / fs) * sp };
      return { vx: v.vx, vy: v.vy, target };
    }
    const m = world.mouse;
    let target = null, bd = TK.dropAim;
    for (const t of world.entities) {
      if (!isFoe(t, e)) continue;
      const dm = U.dist(m.x, m.y, t.x, t.y) - t.r;
      if (dm > bd || U.dist(e.x, e.y, t.x, t.y) <= e.r || !world.los(e.x, e.y, t.x, t.y)) continue;
      bd = dm;
      target = t;
    }
    if (!target) return null;
    const v = leadAt(e, target, minV);
    return { vx: v.vx, vy: v.vy, target };
  }

  // why: 'release' (the player let go), 'starved' (out of energy) or 'lost'
  // (the object or the player can no longer take part).
  function tkRelease(p, s, world, why) {
    const e = s.target;
    s.target = null;
    s.active = false;
    s.latched = false;
    s.plan = null;
    Audio.hum('tk', false);
    if (!e) return;
    if (e.heldBy === p) {
      e.heldBy = null;
      const plan = why === 'release' ? throwPlan(p, s, world, e) : null;
      if (plan) {
        e.vx = plan.vx;
        e.vy = plan.vy;
        e.thrown = 1.0;
      } else e.thrown = 0; // set down: ordinary friction stops it where it was left
      if (e.team === 'enemy') e.stun = Math.max(e.stun, 0.9); // no mid-air recovery
      // Expanded, Jon throws with far more than his usual strength.
      if (plan && p.expandT > 0 && e.hp != null) {
        if (!boosted.some((b) => b.e === e)) boosted.push({ e, mul: e.impactMul });
        e.impactMul = 2;
      }
      if (e.onRelease) e.onRelease(p, world);
      if (why !== 'lost' && e.speed > 260) Audio.play('throw', { speed: e.speed });
    }
    if (why === 'starved') {
      s.relock = TK.relock;
      p.noEnergyT = 0.4;
      Audio.play('fizzle');
      world.particles.burst(e.x, e.y, 16, { color: ['#5fd4ff', '#bff1ff', '#2a6f99'], speed: [30, 140], life: [0.2, 0.5], size: [1.5, 3], shape: 'spark', drag: 4 });
    }
  }

  function tkGrab(p, s, world, e) {
    if (e.mass > p.tkMaxMass()) {
      fail(p, 'mass');
      world.bark(p, p.has('expand') ? 'Too massive. I need to be larger.' : 'Too massive.', 1.4);
      return;
    }
    if (s.relock > 0 || p.energy < TK.grabMin) {
      fail(p, 'energy');
      return;
    }
    const m = world.mouse;
    s.target = e;
    s.latched = true;
    s.vHist = [];
    s.offX = e.x - m.x;
    s.offY = e.y - m.y;
    s.lastE = p.energy;
    s.eRate = 0;
    e.heldBy = p;
    if (e.onGrab) e.onGrab(p, world);
    Audio.play('tk_grab');
  }

  Powers.register({
    id: 'telekinesis',
    name: 'Telekinesis',
    action: 'telekinesis',
    color: '#5fd4ff',
    channelRegen: 0.5,
    desc: 'Lift objects (and people) with your mind.',
    get tip() {
      return DM.Save.settings.tkMode === 'toggle'
        ? 'CLICK (or press C) on something to lift it, move the mouse to carry it, click again to let go. Let go while moving to throw. Thrown people are knocked out, not killed.'
        : 'HOLD LEFT CLICK (or C) on something to lift it, move the mouse to carry it. Let go while moving to throw. Thrown people are knocked out, not killed.';
    },
    range: 430,
    update(p, s, world, dt) {
      const m = world.mouse;
      const range = this.range * p.scale;
      const toggle = DM.Save.settings.tkMode === 'toggle';
      const pressed = Input.pressed('telekinesis') || !!s.latchPress;
      s.latchPress = false;
      s.relock = Math.max(0, (s.relock || 0) - dt);
      s.vHist = s.vHist || [];
      for (let i = boosted.length - 1; i >= 0; i--) {
        const b = boosted[i];
        if (b.e.dead || b.e.heldBy || b.e.thrown <= 0 || b.e.world !== world) {
          b.e.impactMul = b.mul;
          boosted.splice(i, 1);
        }
      }

      if (s.target) {
        const e = s.target;
        let why = null;
        if (e.dead || e.heldBy !== p || !e.grabbable || !p.canUsePowers) why = 'lost';
        else if (p.energy <= 0) why = 'starved';
        else if (toggle ? pressed : !Input.down('telekinesis')) why = 'release';
        if (why) {
          tkRelease(p, s, world, why);
          if (pressed) return; // in toggle mode, the press that threw does not also grab
        }
      }
      if (!s.target) {
        s.hover = p.canUsePowers ? findGrab(world, p, m.x, m.y, range) : null;
        if (!p.canUsePowers) s.grabBuf = 0;
        else if (pressed) s.grabBuf = BUFFER;
        if (s.grabBuf > 0) {
          // A press just before the cursor reaches something still lifts it.
          if (!toggle && !Input.down('telekinesis')) s.grabBuf = 0;
          else if (s.hover) {
            s.grabBuf = 0;
            tkGrab(p, s, world, s.hover);
          } else s.grabBuf -= dt;
        }
        if (!s.target) return;
      }

      const e = s.target;
      s.active = true;
      p.drain = true;
      p.energy -= (3 + e.mass * 1.1) * dt;
      // Remember how the object actually moved (after last frame's collisions),
      // so pressing it against a wall and letting go reads as a drop.
      const now = world.realTime || 0;
      s.vHist.push({ t: now, vx: e.vx, vy: e.vy });
      while (s.vHist.length > 1 && now - s.vHist[0].t > TK.histToggle) s.vHist.shift();
      const settle = Math.exp(-TK.settle * dt);
      s.offX *= settle;
      s.offY *= settle;
      const pt = reach(p, m.x + s.offX, m.y + s.offY, range);
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
      s.plan = throwPlan(p, s, world, e);
      if (dt > 0) s.eRate = U.damp(s.eRate || 0, (p.energy - s.lastE) / dt, 6, dt);
      s.lastE = p.energy;
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
      // Hold time left, once it starts to matter.
      const left = s.eRate < -0.5 ? p.energy / -s.eRate : Infinity;
      if (left < 6) {
        ctx.strokeStyle = left < 1.5 ? 'rgba(255,120,90,0.95)' : 'rgba(190,240,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 11, -Math.PI / 2, -Math.PI / 2 + (left / 6) * TAU);
        ctx.stroke();
      }
      ctx.restore();
      if (s.plan) this.renderPlan(ctx, e, s.plan, world, t);
    },
    // Where a release would send it: a dotted path and a bracket on the target.
    renderPlan(ctx, e, plan, world, t) {
      const sp = Math.hypot(plan.vx, plan.vy);
      if (sp < 1) return;
      const k = e.friction * 0.22;
      const len = k > 0 ? (sp * (1 - Math.exp(-k * TK.preview))) / k : sp * TK.preview;
      const ux = plan.vx / sp, uy = plan.vy / sp;
      // The path ends where it meets the target, or the first wall in the way.
      let L = plan.target ? Math.min(len, U.dist(e.x, e.y, plan.target.x, plan.target.y) - plan.target.r) : len;
      for (const w of world.walls) {
        if (w.noCollide || (e.flying && w.low)) continue;
        const hit = U.segRect(e.x, e.y, e.x + ux * len, e.y + uy * len, w);
        if (hit >= 0) L = Math.min(L, hit * len);
      }
      ctx.save();
      ctx.fillStyle = plan.target ? 'rgba(255,190,160,0.9)' : 'rgba(190,240,255,0.85)';
      const step = 13;
      for (let q = e.r + 6 + ((t * 60) % step); q < L; q += step) {
        ctx.globalAlpha = 0.85 * (1 - q / (L + step));
        Gfx.circle(ctx, e.x + ux * q, e.y + uy * q, 2);
        ctx.fill();
      }
      ctx.restore();
      const g = plan.target;
      if (!g) return;
      const r = g.r + 7, c = Math.max(5, g.r * 0.45);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,90,74,0.9)';
      ctx.lineWidth = 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = g.x + sx * r, y = g.y + sy * r;
        ctx.beginPath();
        ctx.moveTo(x, y - sy * c);
        ctx.lineTo(x, y);
        ctx.lineTo(x - sx * c, y);
        ctx.stroke();
      }
      ctx.restore();
    },
  });

  // ---- Disintegrate --------------------------------------------------------
  Powers.register({
    id: 'disintegrate',
    name: 'Disintegrate',
    action: 'disintegrate',
    press: true,
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
      pressUpdate(this, p, s, world, dt);
    },
    blocked(p, s) {
      if (s.cd > 0) return 'cooldown';
      if (p.energy < this.cost) return 'energy';
      return null;
    },
    fire(p, s, world) {
      p.spend(this.cost);
      s.cd = this.cooldown;
      const pt = reach(p, world.mouse.x, world.mouse.y, this.range * p.scale);
      const b = { x: pt.x, y: pt.y, t: 0.16, r: p.scale > 1.3 ? 80 : 50 };
      s.pending.push(b);
      world.particles.implode(b.x, b.y, b.r * 1.2, 14, { life: 0.16 });
      world.emitCast(b);
      Audio.play('dis_charge');
    },
    resolve(p, b, world) {
      let hits = 0, shoved = 0;
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
        // Whatever survives is shoved away from the blast.
        if (!e.dead && !e.static && !e.yielded) {
          let n = U.norm(e.x - b.x, e.y - b.y);
          if (n.l < 4) n = U.norm(e.x - p.x, e.y - p.y);
          const j = 220 * Math.sqrt(e.mass);
          e.impulse(n.x * j, n.y * j);
          shoved++;
        }
      }
      const P = world.particles;
      P.emit(b.x, b.y, { shape: 'ring', size: 6, size1: b.r * 1.3, life: 0.3, color: '#dff7ff', drag: 0 });
      P.burst(b.x, b.y, 18, { color: ['#ffffff', '#bff1ff', '#ffb27a'], speed: [80, 300], life: [0.15, 0.4], size: [1.5, 3], shape: 'spark', drag: 4 });
      Audio.play(hits ? 'disintegrate' : 'dis_miss');
      world.camera.shake(hits ? 0.35 : 0.12);
      if (hits && world.camera.kick) {
        const n = U.norm(b.x - p.x, b.y - p.y);
        world.camera.kick(n.x, n.y, 3);
      }
      // A beat of weight when something takes the blast and stays standing (kills get theirs from Enemy.die).
      if (shoved && world.hitstop) world.hitstop(0.04);
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
  const TELE_NEAR = 60; // a cursor this close to Jon gives no direction to aim at
  const TELE_MIN = 20; // shorter hops than this are not worth taking

  // Walk back from (tx, ty) toward Jon until there is room to stand.
  function walkBack(p, world, tx, ty) {
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    for (let k = 0; k <= d; k += 10) {
      const f = (d - k) / (d || 1);
      const x = p.x + dx * f, y = p.y + dy * f;
      if (!world.isFree(x, y, p.r)) continue;
      if (U.dist(p.x, p.y, x, y) < TELE_MIN) return null;
      return { x, y, clamped: k > 0 };
    }
    return null;
  }

  // Where a teleport would land right now: { x, y, clamped } or null. The cursor,
  // clamped to range, walked back to the nearest free spot. With the cursor on
  // top of Jon, he goes full range the way he is moving or facing, turning
  // aside if that way is blocked.
  function teleportDest(p, world, range) {
    const m = world.mouse;
    if (U.dist(p.x, p.y, m.x, m.y) >= TELE_NEAR) {
      const pt = reach(p, m.x, m.y, range);
      const d = walkBack(p, world, pt.x, pt.y);
      if (d && pt.clamped) d.clamped = true;
      return d;
    }
    const a0 = p.speed > 20 ? Math.atan2(p.vy, p.vx) : p.facing;
    let best = null, bl = 0;
    for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI]) {
      const a = a0 + da;
      const d = walkBack(p, world, p.x + Math.cos(a) * range, p.y + Math.sin(a) * range);
      if (!d) continue;
      const l = U.dist(p.x, p.y, d.x, d.y);
      if (l > bl) {
        bl = l;
        best = d;
      }
      if (l >= range * 0.6) break;
    }
    if (best) best.clamped = true;
    return best;
  }
  Powers.teleportDest = teleportDest;

  Powers.register({
    id: 'teleport',
    name: 'Teleport',
    action: 'teleport',
    press: true,
    color: '#c9a7ff',
    cost: 16,
    cooldown: 0.5,
    range: 380,
    desc: 'Be somewhere else. Walls, chasms and shields do not apply.',
    tip: 'Press SPACE to teleport to the cursor, or as far as you can reach toward it. The ring shows where you will land.',
    update(p, s, world, dt) {
      s.dest = p.canUsePowers ? teleportDest(p, world, this.range * p.scale) : null;
      pressUpdate(this, p, s, world, dt);
    },
    blocked(p, s) {
      if (s.cd > 0) return 'cooldown';
      if (!s.dest) return 'target';
      if (p.energy < this.cost) return 'energy';
      return null;
    },
    onFail(p, s, world, why) {
      const now = world.realTime || 0;
      if (why !== 'target' || now - (s.barkT == null ? -9 : s.barkT) < 3) return;
      s.barkT = now;
      world.bark(p, 'Somewhere else.', 1.4);
    },
    fire(p, s, world) {
      const dest = s.dest;
      p.spend(this.cost);
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
      DM.Events.emit('player:teleport', { from, to: { x: dest.x, y: dest.y } });
    },
    // Destination preview: where Jon would land, or an X when nowhere fits.
    render(ctx, p, s, world) {
      if (!p.canUsePowers || s.cd > 0) return;
      const m = world.mouse;
      const d = s.dest;
      ctx.save();
      if (!d) {
        ctx.strokeStyle = 'rgba(255,90,74,0.8)';
        ctx.lineWidth = 2;
        Gfx.line(ctx, m.x - 6, m.y - 6, m.x + 6, m.y + 6);
        Gfx.line(ctx, m.x - 6, m.y + 6, m.x + 6, m.y - 6);
        ctx.restore();
        return;
      }
      const a = p.energy < this.cost ? 0.14 : 0.35;
      ctx.strokeStyle = `rgba(201,167,255,${a})`;
      ctx.lineWidth = 1.5;
      Gfx.circle(ctx, d.x, d.y, p.r);
      ctx.stroke();
      if (d.clamped) {
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = `rgba(201,167,255,${a * 0.8})`;
        Gfx.line(ctx, d.x, d.y, m.x, m.y);
      }
      ctx.restore();
    },
  });

  // ---- Quantum Duplication ---------------------------------------------------
  Powers.register({
    id: 'duplicate',
    name: 'Duplicate',
    action: 'duplicate',
    press: true,
    color: '#7bd88f',
    cost: 50,
    cooldown: 9,
    desc: 'Divide your attention. And yourself.',
    tip: 'Press R to split off two copies of yourself. They hunt nearby threats for a few seconds.',
    update(p, s, world, dt) {
      pressUpdate(this, p, s, world, dt);
    },
    blocked(p, s) {
      if (s.cd > 0) return 'cooldown';
      if (p.energy < this.cost) return 'energy';
      return null;
    },
    fire(p, s, world) {
      p.spend(this.cost);
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
  const CLOUDED_SLOWMO = 0.6; // the slowest Sight can run inside a tachyon cloud (world.sightFloor)

  Powers.register({
    id: 'timesight',
    name: 'Temporal Sight',
    action: 'timesight',
    color: '#f2c418',
    channelRegen: 0.4,
    desc: 'See every moment at once. The world slows; what is about to happen becomes visible.',
    tip: 'HOLD F or SHIFT. Time slows, incoming danger is marked and hidden memories appear. Drains energy.',
    update(p, s, world, dt) {
      // Only the emitters' jamming (jamT) blinds Sight. A tachyon cloud
      // (sightJamT) clouds it: it still works, but time slows less.
      p.sightJamT = Math.max(0, (p.sightJamT || 0) - dt);
      const want = p.canUsePowers && Input.down('timesight') && p.energy > 0.5 && !p.jammed;
      if (want !== s.active) {
        s.active = want;
        Audio.play(want ? 'timesight_on' : 'timesight_off');
        Audio.setMusicFilter(want ? 650 : 18000);
        if (!want && p.jammed && Input.down('timesight')) world.bark(p, 'Tachyons. I cannot see.', 1.4);
      }
      world.slowmo = s.active;
      world.timesight = s.active;
      world.sightFloor = s.active && p.sightJamT > 0 ? CLOUDED_SLOWMO : 0;
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
    press: true,
    color: '#ff8fb8',
    cost: 55,
    refund: 25, // handed back on cast, so there is energy left to lift with
    cooldown: 16,
    desc: 'Mass is a matter of opinion. Grow, briefly, to the size of a building.',
    tip: 'Press G to grow for a few seconds: a shockwave, triple strength, bullets barely register, and you can lift the heaviest things.',
    update(p, s, world, dt) {
      pressUpdate(this, p, s, world, dt);
    },
    blocked(p, s) {
      if (s.cd > 0) return 'cooldown';
      if (p.expandT > 0) return 'active';
      if (p.energy < this.cost) return 'energy';
      return null;
    },
    fire(p, s, world) {
      p.spend(this.cost);
      p.energy = Math.min(p.maxEnergy, p.energy + this.refund);
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

  // ---- Reticle --------------------------------------------------------------
  // Drawn by the engine over its base reticle, in screen space, so power state
  // reads where the player is already looking.
  Powers.renderReticle = (ctx, x, y, p) => {
    const t = DM.Engine.time;
    ctx.save();
    if (p.energy < 20) {
      // Running low: the whole reticle warms to red-orange.
      ctx.strokeStyle = 'rgba(255,128,84,0.95)';
      ctx.lineWidth = 1.5;
      Gfx.circle(ctx, x, y, 9);
      ctx.stroke();
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2;
        Gfx.line(ctx, x + Math.cos(ang) * 12, y + Math.sin(ang) * 12, x + Math.cos(ang) * 17, y + Math.sin(ang) * 17);
      }
    }
    const def = Powers.byId.disintegrate;
    const ds = p.powers.disintegrate;
    if (ds && ds.cd > 0 && def.forms.includes(p.form)) {
      const f = ds.cd / def.cooldown;
      ctx.strokeStyle = 'rgba(255,178,122,0.28)';
      ctx.lineWidth = 2;
      Gfx.circle(ctx, x, y, 13.5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,190,140,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, 13.5, -Math.PI / 2, -Math.PI / 2 + f * TAU);
      ctx.stroke();
    }
    const tk = p.powers.telekinesis;
    if (tk && (tk.hover || tk.target) && p.form === 'manhattan') {
      // A small cradle under the reticle: open while hovering, filled while holding.
      const heavy = tk.hover && !tk.target && tk.hover.mass > p.tkMaxMass();
      ctx.strokeStyle = heavy ? 'rgba(255,120,100,0.9)' : 'rgba(127,227,255,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + 21, 5, 0.15, Math.PI - 0.15);
      ctx.stroke();
      if (tk.target) {
        ctx.fillStyle = 'rgba(127,227,255,0.95)';
        Gfx.circle(ctx, x, y + 21, 2.6);
        ctx.fill();
      }
    }
    if (p.reticleFail > 0) {
      const k = p.reticleFail / 0.25;
      ctx.strokeStyle = `rgba(255,70,60,${0.95 * k})`;
      ctx.lineWidth = 2.5;
      Gfx.circle(ctx, x, y, 9 + (1 - k) * 12);
      ctx.stroke();
      ctx.globalAlpha = 0.5 * k * (0.6 + 0.4 * Math.sin(t * 60));
      ctx.fillStyle = '#ff463c';
      Gfx.circle(ctx, x, y, 9);
      ctx.fill();
    }
    ctx.restore();
  };

  // ---- Sparing pays -----------------------------------------------------------
  // A knockout (never a kill) steadies Jon: a little energy and coherence, carried
  // back to him from the body as a visible pip.
  const SPARE_ENERGY = 10;
  const SPARE_COHERENCE = 4;
  const rewarded = new WeakSet(); // one reward per person, however often a body is knocked about
  DM.Events.on('enemy:down', (ev) => {
    if (!ev || !ev.human || ev.lethal || !ev.enemy || rewarded.has(ev.enemy)) return;
    const e = ev.enemy;
    const w = e.world;
    const p = w && w.player;
    if (!p || p.down || p.form === 'human') return;
    rewarded.add(e);
    p.energy = Math.min(p.maxEnergy, p.energy + SPARE_ENERGY);
    p.coherence = Math.min(p.maxCoherence, p.coherence + SPARE_COHERENCE);
    const life = U.clamp(U.dist(e.x, e.y, p.x, p.y) / 650, 0.25, 0.9);
    const vx = (p.x - e.x) / life, vy = (p.y - e.y) / life;
    w.particles.emit(e.x, e.y, { vx, vy, life, size: 7, size1: 4, color: '#7fe3ff', drag: 0, shape: 'glow' });
    w.particles.emit(e.x, e.y, { vx, vy, life, size: 2.5, size1: 1.5, color: '#ffffff', drag: 0 });
  });

  DM.Powers = Powers;
})();
