/*
 * Chapter-specific entities: the reassembly (atoms, entropy, the body), Mars
 * (crystal shards, palace slots, memories, meteors), and power effects
 * (duplicates, afterimages, tachyon clouds), plus mines.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Audio = DM.Audio;
  const Entity = DM.Entity;
  const TAU = Math.PI * 2;

  // ---- Reassembly ---------------------------------------------------------------
  class Atom extends Entity {
    constructor(x, y, o = {}) {
      super({ x, y, r: 4, body: false, solid: false, layer: 2, disintegratable: false, mass: 0.1, friction: 1.6 });
      this.seed = Math.random() * 100;
      this.color = U.pick(['#9fe8ff', '#5fd4ff', '#ffffff', '#bfe9ff']);
      if (o.vx) {
        this.vx = o.vx;
        this.vy = o.vy;
      }
    }
    update(dt, world) {
      this.vx += Math.cos(this.age * 0.7 + this.seed) * 10 * dt;
      this.vy += Math.sin(this.age * 0.6 + this.seed * 1.3) * 10 * dt;
      const p = world.player;
      if (!p || p.form !== 'awareness' || p.locked) return;
      const d = U.dist(this.x, this.y, p.x, p.y);
      if (d > p.pullRadius || p.carry >= p.carryMax) return;
      const n = U.norm(p.x - this.x, p.y - this.y);
      const k = (1 - d / p.pullRadius) * 1100 + 160;
      this.vx += n.x * k * dt;
      this.vy += n.y * k * dt;
      if (d < p.r + 6) {
        this.dead = true;
        p.carry++;
        Audio.play('atom', { i: p.carry });
        world.particles.burst(this.x, this.y, 4, { color: ['#ffffff', '#7fe3ff'], speed: [20, 80], life: [0.2, 0.4], size: [1.5, 2.5] });
        DM.Events.emit('atom:absorbed', p.carry);
      }
    }
    render(ctx, world) {
      const tw = 0.7 + Math.sin(this.age * 5 + this.seed) * 0.3;
      Gfx.glow(ctx, this.x, this.y, 12, '#5fd4ff', 0.55 * tw);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - 1.6, this.y - 1.6, 3.2, 3.2);
    }
  }

  // Entropy: wandering dark vortices that tear loose atoms back out of you.
  class Vortex extends Entity {
    constructor(x, y, o = {}) {
      super({ x, y, r: o.r || 48, body: false, solid: false, layer: 0, disintegratable: false, friction: 0.8 });
      this.speedBase = o.speed || 45;
      this.wander = U.rand(0, TAU);
      this.cool = 0;
      this.home = o.home || null; // stay out of this circle {x, y, r}
      this.spin = U.rand(0, TAU);
    }
    update(dt, world) {
      this.cool -= dt;
      this.spin += dt * 2.2;
      const p = world.player;
      this.wander += U.rand(-1.2, 1.2) * dt;
      let a = this.wander;
      if (p) a = U.lerpAngle(this.wander, U.angleTo(this.x, this.y, p.x, p.y), 0.3);
      let tx = Math.cos(a) * this.speedBase, ty = Math.sin(a) * this.speedBase;
      if (this.home) {
        const d = U.dist(this.x, this.y, this.home.x, this.home.y);
        if (d < this.home.r) {
          const n = U.norm(this.x - this.home.x, this.y - this.home.y);
          tx = n.x * 90;
          ty = n.y * 90;
          this.wander = Math.atan2(n.y, n.x);
        }
      }
      this.vx = U.damp(this.vx, tx, 1.5, dt);
      this.vy = U.damp(this.vy, ty, 1.5, dt);
      for (const e of world.entities) {
        if (!(e instanceof Atom)) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d > 200 || d < 1) continue;
        const n = U.norm(this.x - e.x, this.y - e.y);
        e.vx += n.x * 120 * (1 - d / 200) * dt;
        e.vy += n.y * 120 * (1 - d / 200) * dt;
        if (d < 10) e.dead = true;
      }
      if (!p || p.form !== 'awareness' || p.locked) return;
      const d = U.dist(this.x, this.y, p.x, p.y);
      if (d < 210) {
        const n = U.norm(this.x - p.x, this.y - p.y);
        p.vx += n.x * 240 * (1 - d / 210) * dt;
        p.vy += n.y * 240 * (1 - d / 210) * dt;
      }
      if (d < this.r * 0.6 && this.cool <= 0 && p.invuln <= 0) {
        const lost = Math.ceil(p.carry * 0.4);
        p.carry -= lost;
        for (let i = 0; i < lost; i++) {
          const ang = U.rand(0, TAU);
          const sp = U.rand(160, 360);
          world.add(new Atom(p.x, p.y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp }));
        }
        const n = U.norm(p.x - this.x, p.y - this.y);
        p.vx = (n.l ? n.x : 1) * 520;
        p.vy = (n.l ? n.y : 0) * 520;
        p.invuln = 1.2;
        this.cool = 1.5;
        Audio.play('hit');
        world.camera.shake(0.35);
        DM.Events.emit('vortex:hit', lost);
      }
    }
    render(ctx, world) {
      const r = this.r;
      ctx.save();
      ctx.translate(this.x, this.y);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.35, 'rgba(25,6,30,0.75)');
      g.addColorStop(1, 'rgba(25,6,30,0)');
      ctx.fillStyle = g;
      Gfx.circle(ctx, 0, 0, r * 2.2);
      ctx.fill();
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = i % 2 ? 'rgba(160,40,90,0.55)' : 'rgba(90,40,140,0.55)';
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const f = k / 24;
          const a = this.spin + (i * TAU) / 5 + f * 3.4;
          const rr = r * 1.9 * (1 - f) + 4;
          if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // The body Jon rebuilds, drawn front-on as an anatomical figure, layer by layer.
  // layers: [nervous, circulatory, skeleton, muscle] each 0..1; skin 0..1.
  class BodyForm extends Entity {
    constructor(x, y, o = {}) {
      super({ x, y, r: 60, static: true, body: false, solid: false, layer: 0, disintegratable: false });
      this.H = o.H || 260;
      this.layers = [0, 0, 0, 0];
      this.skin = 0;
      this.depositR = o.depositR || 120;
      this.ring = o.ring !== false;
      this.pulse = 0;
      const rnd = U.seeded(1959);
      this.branches = [];
      for (let i = 0; i < 40; i++) this.branches.push({ seg: (rnd() * 8) | 0, f: rnd(), len: 0.02 + rnd() * 0.03, side: rnd() < 0.5 ? -1 : 1 });
    }
    update(dt) {
      this.pulse = Math.max(0, this.pulse - dt);
    }
    render(ctx, world) {
      const t = world.realTime || 0;
      const X = this.x, Y = this.y, H = this.H;
      if (this.ring) {
        ctx.save();
        ctx.strokeStyle = `rgba(127,227,255,${0.25 + this.pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = t * 12;
        Gfx.circle(ctx, X, Y, this.depositR);
        ctx.stroke();
        ctx.setLineDash([2, 10]);
        ctx.lineDashOffset = -t * 20;
        Gfx.circle(ctx, X, Y, this.depositR * 1.35);
        ctx.stroke();
        ctx.restore();
        Gfx.glow(ctx, X, Y, this.depositR * 1.4, '#1b7fd0', 0.25 + this.pulse * 0.6);
      }
      const P = (u, v) => [X + u * H, Y + v * H];
      const K = {
        head: [0, -0.4], neck: [0, -0.33], sL: [-0.12, -0.3], sR: [0.12, -0.3], eL: [-0.16, -0.14], eR: [0.16, -0.14],
        wL: [-0.18, 0.01], wR: [0.18, 0.01], hL: [-0.19, 0.06], hR: [0.19, 0.06], hipL: [-0.065, 0.02], hipR: [0.065, 0.02],
        kL: [-0.075, 0.24], kR: [0.075, 0.24], aL: [-0.08, 0.44], aR: [0.08, 0.44], fL: [-0.105, 0.47], fR: [0.105, 0.47], pel: [0, 0.01],
      };
      const limbs = [
        ['sL', 'eL'], ['eL', 'wL'], ['sR', 'eR'], ['eR', 'wR'], ['hipL', 'kL'], ['kL', 'aL'], ['hipR', 'kR'], ['kR', 'aR'],
      ];
      const seg = (a, b) => {
        const A = P(...K[a]), B = P(...K[b]);
        ctx.beginPath();
        ctx.moveTo(A[0], A[1]);
        ctx.lineTo(B[0], B[1]);
        ctx.stroke();
      };
      const fl = (v) => (v >= 1 ? 1 : v * (0.55 + Math.random() * 0.45));
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // skeleton
      const sk = fl(this.layers[2]);
      if (sk > 0) {
        ctx.globalAlpha = sk;
        ctx.strokeStyle = '#efe7d2';
        ctx.fillStyle = '#efe7d2';
        ctx.lineWidth = H * 0.016;
        for (const [a, b] of limbs) seg(a, b);
        for (const k of ['eL', 'eR', 'kL', 'kR', 'wL', 'wR', 'aL', 'aR', 'sL', 'sR']) {
          const p = P(...K[k]);
          Gfx.circle(ctx, p[0], p[1], H * 0.013);
          ctx.fill();
        }
        ctx.lineWidth = H * 0.007;
        seg('sL', 'neck');
        seg('sR', 'neck');
        for (let i = 0; i < 16; i++) {
          const p = P(0, -0.33 + i * 0.021);
          ctx.fillRect(p[0] - H * 0.008, p[1] - H * 0.006, H * 0.016, H * 0.012);
        }
        for (let i = 0; i < 7; i++) {
          const y = -0.285 + i * 0.026;
          for (const s of [-1, 1]) {
            const A = P(0, y), C = P(s * 0.11, y - 0.005), B = P(s * 0.075, y + 0.04);
            ctx.beginPath();
            ctx.moveTo(A[0], A[1]);
            ctx.quadraticCurveTo(C[0], C[1], B[0], B[1]);
            ctx.stroke();
          }
        }
        ctx.lineWidth = H * 0.01;
        for (const s of [-1, 1]) {
          const A = P(0, -0.005), C = P(s * 0.11, -0.03), B = P(s * 0.06, 0.05);
          ctx.beginPath();
          ctx.moveTo(A[0], A[1]);
          ctx.quadraticCurveTo(C[0], C[1], B[0], B[1]);
          ctx.stroke();
        }
        const hd = P(...K.head);
        ctx.lineWidth = H * 0.012;
        Gfx.circle(ctx, hd[0], hd[1], H * 0.057);
        ctx.stroke();
        ctx.fillStyle = '#2a2622';
        Gfx.circle(ctx, hd[0] - H * 0.02, hd[1], H * 0.012);
        ctx.fill();
        Gfx.circle(ctx, hd[0] + H * 0.02, hd[1], H * 0.012);
        ctx.fill();
      }

      // nervous system
      const nv = fl(this.layers[0]);
      if (nv > 0) {
        ctx.globalAlpha = nv;
        ctx.strokeStyle = '#fff1c1';
        ctx.lineWidth = H * 0.005;
        const hd = P(...K.head);
        Gfx.ellipse(ctx, hd[0], hd[1] - H * 0.006, H * 0.05, H * 0.044);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(hd[0] + (i - 1.5) * H * 0.02, hd[1] - H * 0.01, H * 0.015, 0, Math.PI);
          ctx.stroke();
        }
        seg('neck', 'pel');
        for (const [a, b] of limbs) seg(a, b);
        seg('neck', 'sL');
        seg('neck', 'sR');
        seg('pel', 'hipL');
        seg('pel', 'hipR');
        for (let i = 0; i < 8; i++) {
          const y = -0.29 + i * 0.035;
          for (const s of [-1, 1]) {
            const A = P(0, y), B = P(s * 0.075, y + 0.015);
            ctx.beginPath();
            ctx.moveTo(A[0], A[1]);
            ctx.lineTo(B[0], B[1]);
            ctx.stroke();
          }
        }
        ctx.lineWidth = H * 0.003;
        for (const b of this.branches) {
          const [a, c] = limbs[b.seg];
          const A = K[a], C = K[c];
          const u = U.lerp(A[0], C[0], b.f), v = U.lerp(A[1], C[1], b.f);
          const p0 = P(u, v), p1 = P(u + b.side * b.len, v + b.len * 0.6);
          Gfx.line(ctx, p0[0], p0[1], p1[0], p1[1]);
        }
        Gfx.glow(ctx, hd[0], hd[1], H * 0.12, '#fff1c1', 0.35 * nv);
      }

      // circulatory system
      const cv = fl(this.layers[1]);
      if (cv > 0) {
        ctx.globalAlpha = cv;
        ctx.lineWidth = H * 0.006;
        for (const [col, off] of [['#d8473f', 0.008], ['#4a6fd8', -0.008]]) {
          ctx.strokeStyle = col;
          ctx.save();
          ctx.translate(off * H, 0);
          seg('neck', 'pel');
          for (const [a, b] of limbs) seg(a, b);
          seg('neck', 'sL');
          seg('neck', 'sR');
          seg('pel', 'hipL');
          seg('pel', 'hipR');
          seg('neck', 'head');
          ctx.restore();
        }
        const hp = P(0.02, -0.21);
        const beat = 1 + Math.max(0, Math.sin(t * 7)) * 0.15;
        ctx.fillStyle = '#d8473f';
        Gfx.ellipse(ctx, hp[0], hp[1], H * 0.026 * beat, H * 0.03 * beat, 0.4);
        ctx.fill();
      }

      // musculature
      const mv = fl(this.layers[3]);
      if (mv > 0) {
        ctx.globalAlpha = mv * 0.75;
        ctx.fillStyle = '#b8423a';
        for (const [a, b] of limbs) {
          const A = P(...K[a]), B = P(...K[b]);
          const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
          const thick = b.startsWith('k') || b.startsWith('e') ? 0.034 : 0.027;
          Gfx.ellipse(ctx, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, len / 2 + H * 0.01, H * thick, Math.atan2(B[1] - A[1], B[0] - A[0]));
          ctx.fill();
        }
        for (const s of [-1, 1]) {
          const pc = P(s * 0.047, -0.255);
          Gfx.ellipse(ctx, pc[0], pc[1], H * 0.05, H * 0.034);
          ctx.fill();
          const dl = P(s * 0.125, -0.29);
          Gfx.circle(ctx, dl[0], dl[1], H * 0.03);
          ctx.fill();
          for (let i = 0; i < 3; i++) {
            const ab = P(s * 0.022, -0.19 + i * 0.045);
            Gfx.rr(ctx, ab[0] - H * 0.018, ab[1] - H * 0.018, H * 0.036, H * 0.036, H * 0.01);
            ctx.fill();
          }
        }
        ctx.strokeStyle = 'rgba(255,190,170,0.35)';
        ctx.lineWidth = 1;
        for (const [a, b] of limbs) seg(a, b);
      }

      // skin: the blue man
      if (this.skin > 0) {
        ctx.globalAlpha = this.skin;
        ctx.strokeStyle = '#55c6f4';
        ctx.fillStyle = '#55c6f4';
        ctx.lineWidth = H * 0.055;
        for (const [a, b] of limbs) seg(a, b);
        ctx.lineWidth = H * 0.05;
        seg('sL', 'sR');
        seg('hipL', 'hipR');
        const to = P(0, -0.15);
        Gfx.ellipse(ctx, to[0], to[1], H * 0.105, H * 0.17);
        ctx.fill();
        const hd = P(...K.head);
        Gfx.circle(ctx, hd[0], hd[1], H * 0.064);
        ctx.fill();
        ctx.globalAlpha = this.skin;
        Gfx.hydrogen(ctx, hd[0], hd[1] - H * 0.022, H * 0.022, '#eafcff', t, 1.5);
        Gfx.glow(ctx, X, Y - H * 0.05, H * 0.75, '#2fa8ff', 0.6 * this.skin);
      }
      ctx.restore();
    }
  }

  // ---- Mars -----------------------------------------------------------------------
  class Shard extends Entity {
    constructor(x, y, big = false) {
      super({ x, y, r: big ? 26 : 12, mass: big ? 20 : 1.2, friction: 3, grabbable: true, disintegratable: false, layer: 1, colors: ['#cfefff', '#7fe3ff'] });
      this.big = big;
      this.rot = U.rand(0, TAU);
      this.placed = false;
      const n = big ? 7 : 5;
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + U.rand(-0.2, 0.2);
        const rr = this.r * U.rand(0.75, 1.25);
        this.verts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
    }
    update(dt) {
      if (!this.placed) this.rot += (this.vx - this.vy) * 0.0006 * dt * 60;
    }
    onBlast(x, y, r, world) {
      if (this.heldBy) this.heldBy = null;
    }
    render(ctx, world) {
      const t = world.realTime || 0;
      ctx.save();
      ctx.translate(this.x, this.y);
      if (!this.placed) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        Gfx.ellipse(ctx, 4, 6, this.r, this.r * 0.7);
        ctx.fill();
      }
      ctx.rotate(this.rot);
      ctx.beginPath();
      this.verts.forEach(([vx, vy], i) => (i ? ctx.lineTo(vx, vy) : ctx.moveTo(vx, vy)));
      ctx.closePath();
      ctx.fillStyle = this.placed ? 'rgba(190,240,255,0.55)' : 'rgba(170,230,255,0.38)';
      ctx.fill();
      ctx.strokeStyle = '#e6fbff';
      ctx.lineWidth = this.big ? 2.5 : 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      ctx.lineTo(0, 0);
      ctx.lineTo(this.verts[2][0], this.verts[2][1]);
      ctx.strokeStyle = 'rgba(230,251,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      Gfx.glow(ctx, this.x, this.y, this.r * 2.4, '#7fe3ff', this.placed ? 0.6 : 0.3 + Math.sin(t * 3 + this.id) * 0.08);
    }
  }

  class Slot extends Entity {
    constructor(x, y, big, palace) {
      super({ x, y, r: big ? 26 : 12, static: true, body: false, solid: false, layer: 0, disintegratable: false });
      this.big = big;
      this.palace = palace;
      this.filled = null;
      this.rot = U.rand(0, TAU);
    }
    update(dt, world) {
      if (this.filled) return;
      for (const e of world.entities) {
        if (!(e instanceof Shard) || e.placed || e.dead || e.big !== this.big) continue;
        if (U.dist(this.x, this.y, e.x, e.y) > (this.big ? 44 : 30)) continue;
        this.fill(e, world);
        break;
      }
    }
    fill(e, world) {
      e.placed = true;
      e.static = true;
      e.body = false;
      e.grabbable = false;
      e.heldBy = null;
      e.x = this.x;
      e.y = this.y;
      e.vx = e.vy = 0;
      e.rot = this.rot;
      this.filled = e;
      Audio.play('snap');
      if (world) {
        world.particles.burst(this.x, this.y, 24, { color: ['#ffffff', '#7fe3ff', '#f2c418'], speed: [40, 200], life: [0.3, 0.8], size: [1.5, 3] });
        world.particles.emit(this.x, this.y, { shape: 'ring', size: 6, size1: 60, life: 0.4, color: '#bff1ff', drag: 0 });
      }
      if (this.palace) this.palace.onFill(this);
    }
    render(ctx, world) {
      if (this.filled) return;
      const t = world.realTime || 0;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot + t * 0.3);
      ctx.strokeStyle = `rgba(242,196,24,${0.45 + Math.sin(t * 3) * 0.2})`;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      const r = this.r * 1.1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // The glass palace: a clockwork blueprint that fills in as slots are filled.
  class Palace extends Entity {
    constructor(x, y) {
      super({ x, y, r: 320, static: true, body: false, solid: false, layer: 0, disintegratable: false });
      this.slots = [];
      this.rise = 0;
      this.risingT = 0;
      this.onFillCb = null;
    }
    addSlot(world, x, y, big) {
      const s = world.add(new Slot(x, y, big, this));
      this.slots.push(s);
      return s;
    }
    count(big) {
      return this.slots.filter((s) => s.big === big && s.filled).length;
    }
    total(big) {
      return this.slots.filter((s) => s.big === big).length;
    }
    onFill(slot) {
      if (this.onFillCb) this.onFillCb(slot);
    }
    update(dt) {
      if (this.risingT > 0) this.rise = Math.min(1, this.rise + dt / this.risingT);
    }
    render(ctx, world) {
      const t = world.realTime || 0;
      const filled = this.slots.filter((s) => s.filled).length / Math.max(1, this.slots.length);
      const a = 0.18 + filled * 0.5;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = `rgba(160,225,255,${a})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = t * 8;
      Gfx.circle(ctx, 0, 0, 300);
      ctx.stroke();
      ctx.setLineDash([]);
      Gfx.circle(ctx, 0, 0, 230);
      ctx.stroke();
      Gfx.circle(ctx, 0, 0, 110);
      ctx.stroke();
      for (const s of this.slots) {
        if (s.big) continue;
        ctx.strokeStyle = s.filled ? 'rgba(200,245,255,0.7)' : `rgba(160,225,255,${a * 0.7})`;
        Gfx.line(ctx, 0, 0, s.x - this.x, s.y - this.y);
      }
      ctx.rotate(t * 0.05);
      ctx.strokeStyle = `rgba(242,196,24,${0.2 + filled * 0.4})`;
      for (let i = 0; i < 48; i++) {
        const ang = (i / 48) * TAU;
        Gfx.line(ctx, Math.cos(ang) * 296, Math.sin(ang) * 296, Math.cos(ang) * (i % 4 ? 286 : 276), Math.sin(ang) * (i % 4 ? 286 : 276));
      }
      ctx.restore();
      if (this.rise > 0) {
        const k = U.ease.outCubic(this.rise);
        Gfx.glow(ctx, this.x, this.y, 420 * k, '#7fe3ff', 0.45 * k);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = k;
        for (let ring = 0; ring < 3; ring++) {
          const R = 70 + ring * 70;
          const n = 6 + ring * 3;
          ctx.rotate(t * 0.04 * (ring % 2 ? -1 : 1));
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * TAU;
            const h = (40 - ring * 8) * k;
            ctx.save();
            ctx.translate(Math.cos(ang) * R, Math.sin(ang) * R);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(-h * 0.4, -h * 0.25);
            ctx.lineTo(h, 0);
            ctx.lineTo(-h * 0.4, h * 0.25);
            ctx.closePath();
            ctx.fillStyle = 'rgba(190,240,255,0.35)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(230,251,255,0.8)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore();
        Gfx.hydrogen(ctx, this.x, this.y, 36 * k, 'rgba(230,251,255,0.9)', t, 3);
      }
    }
  }

  // A moment from Jon's life, visible only to Temporal Sight.
  class Memory extends Entity {
    constructor(x, y, o) {
      super({ x, y, r: 16, static: true, body: false, solid: false, layer: 2, disintegratable: false });
      this.year = o.year;
      this.text = o.text;
      this.rot = U.rand(-0.3, 0.3);
    }
    update(dt, world) {
      const p = world.player;
      if (!p || !world.timesight) return;
      if (U.dist(this.x, this.y, p.x, p.y) < 34 + p.r) {
        this.dead = true;
        Audio.play('memory');
        world.particles.burst(this.x, this.y, 30, { color: ['#f2c418', '#ffffff', '#7fe3ff'], speed: [40, 200], life: [0.4, 1], size: [1.5, 3] });
        DM.Events.emit('memory:found', this);
      }
    }
    render(ctx, world) {
      const t = world.realTime || 0;
      const vis = U.clamp((1 - world.timeScale) / 0.7, 0, 1);
      if (vis < 0.05) {
        if (Math.sin(t * 2 + this.id) > 0.92) Gfx.glow(ctx, this.x, this.y, 10, '#f2c418', 0.35);
        return;
      }
      ctx.save();
      ctx.globalAlpha = vis;
      ctx.translate(this.x, this.y + Math.sin(t * 2 + this.id) * 3);
      ctx.rotate(this.rot);
      Gfx.glow(ctx, 0, 0, 46, '#f2c418', 0.45);
      ctx.fillStyle = '#f1e7cc';
      ctx.fillRect(-17, -21, 34, 40);
      ctx.fillStyle = '#4a5560';
      ctx.fillRect(-13, -17, 26, 24);
      ctx.fillStyle = '#16120f';
      ctx.font = Gfx.font(9, DM.FONTS.type);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.year), 0, 13);
      ctx.restore();
    }
  }

  class Meteor extends Entity {
    constructor(x, y, o = {}) {
      super({ x, y, r: 70, static: true, body: false, solid: false, layer: 3, disintegratable: false });
      this.hazard = true; // stays in colour under Temporal Sight's grade
      this.T = o.T || 2.6;
      this.t = 0;
      this.radius = o.radius || 70;
      this.dmg = o.dmg || 14;
      this.whistled = false;
    }
    update(dt, world) {
      this.t += dt;
      if (!this.whistled && this.T - this.t < 0.9) {
        this.whistled = true;
        Audio.play('meteor');
      }
      if (this.t >= this.T) {
        this.dead = true;
        world.explode(this.x, this.y, this.radius, this.dmg, { team: 'hazard', colors: ['#ffd27a', '#ff9a3c', '#c2552f', '#fff2c4'], force: 700 });
        const cx = this.x, cy = this.y, cr = this.radius * 0.55;
        world.decals.push((c) => {
          c.fillStyle = 'rgba(60,20,10,0.35)';
          Gfx.circle(c, cx, cy, cr);
          c.fill();
        });
      }
    }
    render(ctx, world) {
      const k = this.t / this.T;
      const late = this.T - this.t < 0.75;
      if (world.timesight || late) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,90,60,${0.35 + k * 0.5})`;
        ctx.fillStyle = `rgba(255,90,60,${0.05 + k * 0.15})`;
        ctx.lineWidth = 2;
        Gfx.circle(ctx, this.x, this.y, this.radius);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (world.timesight) {
        ctx.save();
        ctx.strokeStyle = 'rgba(242,196,24,0.4)';
        ctx.setLineDash([5, 6]);
        Gfx.line(ctx, this.x + 360, this.y - 700, this.x, this.y);
        ctx.restore();
      }
      if (late) {
        const f = 1 - (this.T - this.t) / 0.75;
        const mx = this.x + (1 - f) * 360, my = this.y - (1 - f) * 700;
        Gfx.glow(ctx, mx, my, 40, '#ff9a3c', 0.9);
        ctx.fillStyle = '#3a2418';
        Gfx.circle(ctx, mx, my, 9);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        Gfx.circle(ctx, this.x, this.y, 10 + f * 20);
        ctx.fill();
      }
    }
  }

  // ---- shared ------------------------------------------------------------------------
  class Mine extends Entity {
    constructor(x, y) {
      super({ x, y, r: 10, static: true, body: false, solid: false, hp: 1, layer: 0, team: 'enemy', colors: ['#3a3a30', '#c4302b'] });
      this.trig = -1;
    }
    update(dt, world) {
      if (this.trig >= 0) {
        this.trig -= dt;
        if (this.trig < 0) {
          this.dead = true;
          world.explode(this.x, this.y, 80, 28, { team: 'enemy' });
        }
        return;
      }
      for (const e of world.entities) {
        if (e.team !== 'player' || e.dead || e.flying) continue;
        if (U.dist(this.x, this.y, e.x, e.y) < 36 + e.r) {
          this.trig = 0.3;
          Audio.play('ui_move');
          break;
        }
      }
    }
    onDeath(kind) {
      if (kind !== 'disintegrate' && this.world && this.trig < 0) {
        const w = this.world;
        w.defer(() => w.explode(this.x, this.y, 80, 28, { team: 'enemy' }));
      }
    }
    render(ctx, world) {
      const t = world.realTime || 0;
      const vis = world.timesight ? 1 : 0.55;
      ctx.save();
      ctx.globalAlpha = vis;
      ctx.fillStyle = '#3a3a30';
      Gfx.circle(ctx, this.x, this.y, 9);
      ctx.fill();
      ctx.strokeStyle = '#1d1d18';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      const blink = this.trig >= 0 || Math.sin(t * 6 + this.id) > 0.6;
      if (blink) Gfx.glow(ctx, this.x, this.y, this.trig >= 0 ? 24 : 9, '#ff3a2a', world.timesight ? 1 : 0.7);
      if (world.timesight) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,90,60,0.35)';
        ctx.setLineDash([3, 4]);
        Gfx.circle(ctx, this.x, this.y, 80);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  class Duplicate extends Entity {
    constructor(owner, x, y, life) {
      super({ x, y, r: 12, mass: 2.5, friction: 9, team: 'player', hp: 60, disintegratable: false });
      this.isDuplicate = true;
      this.timeless = true;
      this.targetable = true;
      this.owner = owner;
      this.life = life;
      this.maxLife = life;
      this.fireCd = U.rand(0.2, 0.6);
      this.facing = owner.facing;
      this.walk = 0;
      this.offset = U.rand(0, TAU);
    }
    expire(world) {
      if (this.dead) return;
      this.dead = true;
      world.particles.burst(this.x, this.y, 18, { color: ['#7fe3ff', '#ffffff'], speed: [30, 140], life: [0.3, 0.7], size: [1.5, 3] });
    }
    die() {
      this.expire(this.world);
    }
    onImpact() {}
    update(dt, world) {
      this.life -= dt;
      if (this.life <= 0) return this.expire(world);
      let target = null, bd = 560;
      for (const e of world.entities) {
        if (e.dead || e.team !== 'enemy' || e.ko || e.isProjectile || e.yielded) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          target = e;
        }
      }
      let tx, ty;
      if (target) {
        const n = U.norm(this.x - target.x, this.y - target.y);
        const keep = target instanceof DM.Enemies.Veidt ? 0 : 150;
        tx = target.x + n.x * keep;
        ty = target.y + n.y * keep;
        this.facing = U.dampAngle(this.facing, U.angleTo(this.x, this.y, target.x, target.y), 12, dt);
        this.fireCd -= dt;
        if (this.fireCd <= 0 && world.los(this.x, this.y, target.x, target.y)) {
          this.fireCd = 0.75;
          const a = U.angleTo(this.x, this.y, target.x, target.y);
          world.add(new DM.Proj.Bolt({ x: this.x + Math.cos(a) * 14, y: this.y + Math.sin(a) * 14, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640 }));
          DM.Audio.play('bolt');
        }
      } else {
        const o = this.owner;
        this.offset += dt * 0.8;
        tx = o.x + Math.cos(this.offset) * 60;
        ty = o.y + Math.sin(this.offset) * 60;
        this.facing = U.dampAngle(this.facing, o.facing, 6, dt);
      }
      const n = U.norm(tx - this.x, ty - this.y);
      const sp = Math.min(260, n.l * 4);
      this.vx = U.damp(this.vx, n.x * sp, 8, dt);
      this.vy = U.damp(this.vy, n.y * sp, 8, dt);
      if (this.speed > 20) this.walk += dt * this.speed * 0.09;
    }
    render(ctx, world) {
      const fade = Math.min(1, this.life / 1.2);
      Gfx.manhattan(ctx, { x: this.x, y: this.y, angle: this.facing, walk: this.walk, moving: this.speed > 20, t: this.age, alpha: (0.55 + Math.random() * 0.12) * fade });
    }
  }

  class Afterimage extends Entity {
    constructor(p) {
      super({ x: p.x, y: p.y, r: 1, static: true, body: false, solid: false, layer: 1, disintegratable: false });
      this.timeless = true;
      this.facing = p.facing;
      this.scale = p.scale;
      this.life = 0.5;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    render(ctx) {
      Gfx.manhattan(ctx, { x: this.x, y: this.y, angle: this.facing, scale: this.scale, alpha: (this.life / 0.5) * 0.45, t: this.age });
    }
  }

  class TachyonCloud extends Entity {
    constructor(x, y) {
      super({ x, y, r: 90, static: true, body: false, solid: false, layer: 0, disintegratable: false });
      this.life = 5;
    }
    update(dt, world) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      const p = world.player;
      if (p && U.dist(p.x, p.y, this.x, this.y) < this.r) p.jamT = Math.max(p.jamT, 0.2);
      if (Math.random() < dt * 25) {
        const a = U.rand(0, TAU), r = U.rand(0, this.r);
        world.particles.emit(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, { life: 0.3, size: 2, color: U.pick(['#c06bff', '#ffffff', '#6f4aa6']) });
      }
    }
    render(ctx) {
      const a = Math.min(1, this.life);
      Gfx.glow(ctx, this.x, this.y, this.r * 1.3, '#6f4aa6', 0.35 * a);
      ctx.save();
      ctx.strokeStyle = `rgba(192,107,255,${0.35 * a})`;
      ctx.setLineDash([3, 6]);
      Gfx.circle(ctx, this.x, this.y, this.r);
      ctx.stroke();
      ctx.restore();
    }
  }

  DM.Special = { Atom, Vortex, BodyForm, Shard, Slot, Palace, Memory, Meteor, Mine, Duplicate, Afterimage, TachyonCloud };
})();
