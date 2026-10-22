/*
 * World: one playable map. Owns entities, walls, particles and the camera.
 *
 * Maps are built by chapter `maps` functions using the helpers here
 * (wall, room, bake, decal...). Walls are axis-aligned rects; their look comes
 * from WALL_STYLES (extendable per map via world.wallStyles).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;

  // low: blocks movement but not shots/sight. seeThrough: blocks shots, not sight.
  const WALL_STYLES = {
    wall: { top: '#3d4552', face: '#262c35', edge: '#11151b' },
    glass: { top: 'rgba(150,215,255,0.22)', face: 'rgba(120,190,240,0.3)', edge: 'rgba(190,235,255,0.75)', seeThrough: true },
    low: { top: '#7a6a4c', face: '#54472f', edge: '#2e2619', low: true },
    door: { draw: () => {} },
  };

  class World {
    constructor(o = {}) {
      this.w = o.w || 2000;
      this.h = o.h || 2000;
      this.bg = o.bg || '#05070b';
      this.entities = [];
      this.walls = [];
      this.decals = []; // fn(ctx, world, view) drawn above the floor
      this.overlays = []; // fn(ctx, world, view) drawn above entities
      this.barks = [];
      this.particles = new DM.Particles(4000);
      this.camera = new DM.Camera();
      this.camera.bounds = { w: this.w, h: this.h };
      this.baseZoom = o.zoom || 1; // per-map camera zoom; Expand zooms out relative to it
      this.camera.zoom = this.camera.targetZoom = this.baseZoom;
      this.wallStyles = Object.assign({}, WALL_STYLES, o.wallStyles || {});
      this.time = 0;
      this.timeScale = 1;
      this.slowmo = false; // set by Temporal Sight
      this.timesight = false;
      this.mouse = { x: 0, y: 0 };
      this.player = null;
      this.boss = null;
      this.floorCanvas = null;
      this.floorLive = null;
      this.tint = null; // screen tint colour (rgba string)
      this._bodies = [];
      this._deferred = [];
    }

    // Run fn after this frame's entity updates (chain reactions, spawns from callbacks).
    defer(fn) {
      this._deferred.push(fn);
    }

    // ---- building ---------------------------------------------------------
    add(e) {
      e.world = this;
      this.entities.push(e);
      if (e.onAdd) e.onAdd(this);
      return e;
    }

    wall(x, y, w, h, kind = 'wall', extra) {
      const st = this.wallStyles[kind] || this.wallStyles.wall;
      const wl = Object.assign({ x, y, w, h, kind, low: !!st.low, seeThrough: !!st.seeThrough, noCollide: false }, extra || {});
      this.walls.push(wl);
      return wl;
    }

    // A rectangular room outline with door gaps.
    // doors: [{ side: 'top'|'bottom'|'left'|'right', at: offset along side, w: width }]
    room(x, y, w, h, o = {}) {
      const t = o.t || 16;
      const kind = o.kind || 'wall';
      const doors = o.doors || [];
      const side = (name, len, seg) => {
        const gaps = doors.filter((d) => d.side === name).map((d) => [d.at, d.at + d.w]).sort((a, b) => a[0] - b[0]);
        let cur = 0;
        for (const [g0, g1] of gaps) {
          if (g0 > cur) seg(cur, g0);
          cur = Math.max(cur, g1);
        }
        if (cur < len) seg(cur, len);
      };
      side('top', w, (a, b) => this.wall(x + a, y, b - a, t, kind));
      side('bottom', w, (a, b) => this.wall(x + a, y + h - t, b - a, t, kind));
      side('left', h, (a, b) => this.wall(x, y + a, t, b - a, kind));
      side('right', h, (a, b) => this.wall(x + w - t, y + a, t, b - a, kind));
    }

    // Pre-render the static floor once into an offscreen canvas.
    bake(drawFn) {
      const maxPx = 5.5e6;
      const s = Math.min(1, Math.sqrt(maxPx / (this.w * this.h)));
      const c = document.createElement('canvas');
      c.width = Math.ceil(this.w * s);
      c.height = Math.ceil(this.h * s);
      const g = c.getContext('2d');
      g.scale(s, s);
      drawFn(g, this.w, this.h);
      this.floorCanvas = c;
      this.floorScale = s;
    }

    bark(e, text, dur = 1.8) {
      this.barks = this.barks.filter((b) => b.e !== e);
      this.barks.push({ e, text, t: dur, dur });
    }

    // ---- queries ----------------------------------------------------------
    query(x, y, r, filter) {
      const out = [];
      for (const e of this.entities) {
        if (e.dead) continue;
        if (U.dist2(x, y, e.x, e.y) > (r + e.r) * (r + e.r)) continue;
        if (filter && !filter(e)) continue;
        out.push(e);
      }
      return out;
    }

    // Can a circle of radius r stand at (x, y)?
    isFree(x, y, r) {
      if (x < r || y < r || x > this.w - r || y > this.h - r) return false;
      for (const w of this.walls) {
        if (w.noCollide) continue;
        if (U.circleRect(x, y, r, w)) return false;
      }
      return true;
    }

    // Line of sight (low walls and glass don't block sight).
    los(x1, y1, x2, y2) {
      for (const w of this.walls) {
        if (w.noCollide || w.low || w.seeThrough) continue;
        if (U.segRect(x1, y1, x2, y2, w) >= 0) return false;
      }
      return true;
    }

    // First wall hit by a shot along the segment, as t in [0,1] or -1.
    shotHit(x1, y1, x2, y2) {
      let best = -1;
      for (const w of this.walls) {
        if (w.noCollide || w.low) continue;
        const t = U.segRect(x1, y1, x2, y2, w);
        if (t >= 0 && (best < 0 || t < best)) best = t;
      }
      return best;
    }

    // Damage + knockback in a radius. o.team: entities on this team are spared.
    explode(x, y, r, dmg, o = {}) {
      for (const e of this.entities) {
        if (e.dead || e === o.source) continue;
        if (o.team && e.team === o.team) continue;
        const d = U.dist(x, y, e.x, e.y);
        if (d > r + e.r) continue;
        const k = 1 - U.clamp(d / (r + e.r), 0, 1) * 0.6;
        if (e.hp != null || e.isPlayer || e.takesExplosions) e.damage(dmg * k, o.source || null, 'explosion');
        if (!e.static) {
          const n = U.norm(e.x - x, e.y - y);
          const f = (o.force || 520) * k;
          e.vx += (n.x * f) / Math.sqrt(e.mass);
          e.vy += (n.y * f) / Math.sqrt(e.mass);
        }
        if (e.onBlast) e.onBlast(x, y, r, this);
      }
      const P = this.particles;
      const fire = o.colors || ['#ffd27a', '#ff9a3c', '#ff5a2a', '#fff2c4'];
      P.burst(x, y, 26, { color: fire, speed: [40, r * 3.4], life: [0.2, 0.6], size: [4, 9], shape: 'glow', drag: 4 });
      P.burst(x, y, 14, { color: ['#2a2522', '#3a332e', '#1d1a18'], speed: [20, 90], life: [0.7, 1.5], size: [8, 15], size1: 24, shape: 'smoke', add: false, drag: 2, alpha: 0.7 });
      P.emit(x, y, { shape: 'ring', size: r * 0.3, size1: r * 1.1, life: 0.35, color: '#ffe2a8', drag: 0 });
      DM.Audio.play('explosion');
      this.camera.shake(Math.min(0.7, 0.3 * (r / 70)));
    }

    // Broadcast that a disintegration is about to land (bosses may dodge).
    emitCast(c) {
      for (const e of this.entities) if (!e.dead && e.onDisintegrateCast) e.onDisintegrateCast(c, this);
    }

    // ---- simulation -------------------------------------------------------
    update(dt) {
      this.timeScale = U.damp(this.timeScale, this.slowmo ? 0.28 : 1, 9, dt);
      const wdt = dt * this.timeScale;
      const pdt = dt * (this.slowmo ? 0.8 : 1);
      this.time += wdt;
      this.realTime = (this.realTime || 0) + dt;

      const list = this.entities;
      const n = list.length;
      for (let i = 0; i < n; i++) {
        const e = list[i];
        if (e.dead) continue;
        const edt = e.timeless ? pdt : wdt;
        e.age += edt;
        if (e.hitFlash > 0) e.hitFlash -= edt;
        if (e.thrown > 0) e.thrown -= edt;
        e.update(edt, this);
      }
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead || e.static || e.selfMove) continue;
        this.integrate(e, e.timeless ? pdt : wdt);
      }
      this.collideBodies();

      if (this._deferred.length) {
        const q = this._deferred;
        this._deferred = [];
        for (const fn of q) fn(this);
      }

      let anyDead = false;
      for (const e of list) if (e.dead) anyDead = true;
      if (anyDead) {
        this.entities = list.filter((e) => {
          if (e.dead && e.onRemove) e.onRemove(this);
          return !e.dead;
        });
      }

      for (const b of this.barks) b.t -= dt;
      this.barks = this.barks.filter((b) => b.t > 0 && !b.e.dead);
      this.particles.update(wdt);
      this.camera.update(dt);
    }

    integrate(e, dt) {
      if (!e.heldBy) {
        // Thrown things fly: ground friction is mostly off while `thrown` lasts.
        const f = Math.exp(-(e.thrown > 0 ? e.friction * 0.22 : e.friction) * dt);
        e.vx *= f;
        e.vy *= f;
      }
      const travel = (Math.abs(e.vx) + Math.abs(e.vy)) * dt;
      const steps = e.solid ? Math.min(6, Math.max(1, Math.ceil(travel / Math.max(4, e.r * 0.8)))) : 1;
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        e.x += e.vx * sdt;
        e.y += e.vy * sdt;
        if (e.solid) this.collideWalls(e);
      }
      if (e.x < e.r) { e.x = e.r; if (e.vx < 0) e.vx *= -0.3; }
      if (e.y < e.r) { e.y = e.r; if (e.vy < 0) e.vy *= -0.3; }
      if (e.x > this.w - e.r) { e.x = this.w - e.r; if (e.vx > 0) e.vx *= -0.3; }
      if (e.y > this.h - e.r) { e.y = this.h - e.r; if (e.vy > 0) e.vy *= -0.3; }
    }

    collideWalls(e) {
      for (const w of this.walls) {
        if (w.noCollide) continue;
        if (e.flying && w.low) continue;
        if (e.x + e.r < w.x || e.x - e.r > w.x + w.w || e.y + e.r < w.y || e.y - e.r > w.y + w.h) continue;
        const hit = U.circleRect(e.x, e.y, e.r, w);
        if (!hit) continue;
        e.x += hit.nx * hit.depth;
        e.y += hit.ny * hit.depth;
        const vn = e.vx * hit.nx + e.vy * hit.ny;
        if (vn < 0) {
          if (e.onWall) e.onWall(-vn, w, this);
          if (e.thrown > 0 && -vn > 260) e.onImpact(-vn, null, this);
          const b = e.bounce;
          e.vx -= (1 + b) * vn * hit.nx;
          e.vy -= (1 + b) * vn * hit.ny;
        }
      }
    }

    collideBodies() {
      const B = this._bodies;
      B.length = 0;
      for (const e of this.entities) if (e.body && !e.dead) B.push(e);
      B.sort((a, b) => a.x - a.r - (b.x - b.r));
      for (let i = 0; i < B.length; i++) {
        const a = B[i];
        const ax1 = a.x + a.r;
        for (let j = i + 1; j < B.length; j++) {
          const b = B[j];
          if (b.x - b.r > ax1) break;
          if (a.flying !== b.flying) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2);
          const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
          const ima = a.static ? 0 : 1 / a.mass, imb = b.static ? 0 : 1 / b.mass;
          const sum = ima + imb;
          if (sum === 0) continue;
          const overlap = rr - d;
          a.x -= nx * overlap * (ima / sum);
          a.y -= ny * overlap * (ima / sum);
          b.x += nx * overlap * (imb / sum);
          b.y += ny * overlap * (imb / sum);
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            const sp = -rv;
            if ((a.thrown > 0 || b.thrown > 0) && sp > 240) {
              a.onImpact(sp, b, this);
              b.onImpact(sp, a, this);
            }
            const jn = (-1.2 * rv) / sum;
            a.vx -= jn * ima * nx;
            a.vy -= jn * ima * ny;
            b.vx += jn * imb * nx;
            b.vy += jn * imb * ny;
          }
        }
      }
    }

    // ---- rendering --------------------------------------------------------
    render(ctx) {
      const cam = this.camera;
      const view = cam.view();
      ctx.save();
      cam.apply(ctx);

      ctx.fillStyle = this.bg;
      ctx.fillRect(view.x0 - 40, view.y0 - 40, view.x1 - view.x0 + 80, view.y1 - view.y0 + 80);
      if (this.floorCanvas) {
        const s = this.floorScale;
        const x0 = Math.max(0, view.x0), y0 = Math.max(0, view.y0);
        const x1 = Math.min(this.w, view.x1), y1 = Math.min(this.h, view.y1);
        if (x1 > x0 && y1 > y0) ctx.drawImage(this.floorCanvas, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s, x0, y0, x1 - x0, y1 - y0);
      }
      if (this.floorLive) this.floorLive(ctx, this, view);
      for (const d of this.decals) d(ctx, this, view);

      for (const w of this.walls) {
        if (w.x > view.x1 || w.x + w.w < view.x0 || w.y > view.y1 || w.y + w.h < view.y0) continue;
        this.drawWall(ctx, w);
      }

      const vis = [];
      for (const e of this.entities) {
        if (e.dead) continue;
        const m = e.r + 120;
        if (e.x < view.x0 - m || e.x > view.x1 + m || e.y < view.y0 - m || e.y > view.y1 + m) continue;
        vis.push(e);
      }
      vis.sort((a, b) => a.layer - b.layer || a.y - b.y);
      for (const e of vis) e.render(ctx, this);

      if (this.timesight) for (const e of vis) if (e.renderFuture) e.renderFuture(ctx, this);
      if (this.player && this.player.renderFx) this.player.renderFx(ctx, this);
      this.particles.render(ctx, view);
      for (const o of this.overlays) o(ctx, this, view);

      for (const b of this.barks) {
        const a = Math.min(1, b.t * 3, (b.dur - b.t) * 8);
        Gfx.bubble(ctx, b.text, b.e.x, b.e.y - b.e.r - 8, { alpha: a });
      }
      ctx.restore();
    }

    drawWall(ctx, w) {
      const st = this.wallStyles[w.kind] || this.wallStyles.wall;
      if (w.draw) return w.draw(ctx, w, this);
      if (st.draw) return st.draw(ctx, w, this);
      ctx.fillStyle = st.top;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      if (st.face && w.h > 10 && !st.flat) {
        ctx.fillStyle = st.face;
        ctx.fillRect(w.x, w.y + w.h - Math.min(8, w.h * 0.35), w.w, Math.min(8, w.h * 0.35));
      }
      if (st.edge) {
        ctx.strokeStyle = st.edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(w.x + 0.75, w.y + 0.75, w.w - 1.5, w.h - 1.5);
      }
    }
  }

  DM.World = World;
  DM.WALL_STYLES = WALL_STYLES;
})();
