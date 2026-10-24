/* Shared bonus-adventure helpers. No campaign behaviour is replaced. */
(function() {
  'use strict';
  const DM = window.DM;
  const G = DM.Gfx;
  const U = DM.U;
  const BLUE = '#80dcff';
  const GOLD = '#e5ba68';
  const active = entity => !entity.dead && !entity.ko;
  function withinRange(world, entity, distance = 250) {
    return !!world.player && U.dist(entity.x, entity.y, world.player.x, world.player.y) < distance;
  }
  function label(g, text, x, y, color = GOLD, size = 13) {
    if (!text)
      return;
    const width = G.measure(g, text, {
      size, font: DM.FONTS.display
    }) + 24;
    g.fillStyle = 'rgba(3,8,16,0.88)';
    G.rr(g, x - width / 2, y - 18, width, 26, 4);
    g.fill();
    G.text(g, text, x, y, {
      size, align: 'center', weight: 600, color, spacing: 0.6
    });
  }
  function ring(g, x, y, radius, color, width = 2) {
    g.strokeStyle = color;
    g.lineWidth = width;
    G.circle(g, x, y, radius);
    g.stroke();
  }
  function burst(world, x, y, color = BLUE) {
    world.particles.burst(x, y, 20, {
      color: [color, '#ffffff'], speed: [35, 140], life: [0.3, 0.9], size: [1.5, 3], shape: 'spark',
    });
  }
  class Sign extends DM.Entity {
    constructor(x, y, text, color = GOLD, size = 16) {
      super({
        x, y, body: false, solid: false, static: true, disintegratable: false
      });
      this.text = text;
      this.col = color;
      this.size = size;
      this.sceneryLabel = true;
    }
    render(g, world) {
      if (!world.lit)
        this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      label(g, this.text, this.x, this.y, this.col, this.size);
    }
  }
  class Lamp extends DM.Entity {
    constructor(x, y, profile) {
      super({
        x, y, static: true, body: false, solid: false, disintegratable: false
      });
      this.profile = profile;
    }
    light() {
      return this.profile;
    }
  }
  class Terminal extends DM.Entity {
    constructor(x, y, text, action, enabled = () => true, color = BLUE) {
      super({
        x, y, r: 20, body: false, static: true, disintegratable: false
      });
      this.text = text;
      this.color = color;
      this.col = color;
      this.on = false;
      this.interact = {
        label: text, range: 85, enabled, onInteract: action
      };
    }
    light() {
      return {
        r: 145, i: 0.6, color: this.color, k: 0.16
      };
    }
    render(g, world) {
      g.fillStyle = '#374c56';
      g.fillRect(this.x - 22, this.y - 19, 44, 36);
      g.fillStyle = '#101d27';
      g.fillRect(this.x - 17, this.y - 14, 34, 19);
      g.fillStyle = this.color;
      g.fillRect(this.x - 14, this.y - 11, 28, 3);
      g.fillStyle = '#667b7f';
      g.fillRect(this.x - 14, this.y + 9, 18, 3);
      if (!world.lit)
        this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.interact.enabled && !this.interact.enabled())
        return;
      ring(g, this.x, this.y, 32 + Math.sin(world.time * 2) * 2, this.color, 1);
      if (withinRange(world, this, 95))
        label(g, this.interact.label, this.x, this.y - 42, this.color);
    }
  }
  function owlMask(g) {
    g.fillStyle = '#806239';
    g.beginPath();
    g.moveTo(28, 43);
    g.lineTo(29, 17);
    g.lineTo(43, 30);
    g.lineTo(57, 30);
    g.lineTo(71, 17);
    g.lineTo(72, 43);
    g.lineTo(66, 60);
    g.lineTo(50, 55);
    g.lineTo(34, 60);
    g.closePath();
    g.fill();
    for (const x of [40, 60]) {
      g.fillStyle = '#d9bb73';
      G.circle(g, x, 46, 11);
      g.fill();
      g.fillStyle = '#172938';
      G.circle(g, x, 46, 8);
      g.fill();
      g.fillStyle = '#91acac';
      G.ellipse(g, x - 2, 44, 3, 2);
      g.fill();
    }
    g.fillStyle = '#d3ad62';
    g.beginPath();
    g.moveTo(46, 49);
    g.lineTo(54, 49);
    g.lineTo(50, 58);
    g.fill();
  }
  function inkMask(g) {
    g.fillStyle = '#e9e4d4';
    G.ellipse(g, 50, 52, 18, 23);
    g.fill();
    g.fillStyle = '#242528';
    for (const side of [-1, 1]) {
      g.save();
      g.translate(50, 0);
      g.scale(side, 1);
      g.beginPath();
      g.moveTo(3, 40);
      g.bezierCurveTo(15, 35, 17, 44, 10, 49);
      g.bezierCurveTo(18, 56, 8, 62, 4, 53);
      g.lineTo(1, 48);
      g.closePath();
      g.fill();
      G.ellipse(g, 7, 65, 4, 3);
      g.fill();
      g.restore();
    }
  }
  DM.LOOKS.niteowl = {
    name: 'Nite Owl', skin: '#d2b483', hair: null, hairStyle: 'bald', hat: null,
    body: '#a98c55', sleeve: '#79603d', legs: '#443b30', cape: '#5c472e',
    collar: '#c2a46b', trim: '#d8bc71', glasses: true, bg: '#6e674c', color: GOLD, mask: owlMask,
  };
  DM.LOOKS.rorschach = {
    name: 'Rorschach', skin: '#e9e4d4', hair: null, hairStyle: 'bald', hat: '#68503c', hatBrim: '#392c23',
    body: '#806347', sleeve: '#806347', legs: '#382f2a', collar: '#b99b76', bg: '#5c5550', color: '#e9dfcd',
    mask: inkMask,
  };
  class Companion extends DM.NPC {
    constructor(x, y, who, options = {}) {
      super({
        x, y, look: who, lookAtPlayer: false, speed: 195
      });
      this.who = who;
      this.options = options;
      this.holdPosition = false;
      this.showName = true;
      this.taskTarget = null;
      this.team = 'player';
      this.body = false;
      this.cool = 1;
      this.grapple = 0;
      this.strikes = 0;
      this.light = () => ({
        r: 80, i: 0.44, color: who === 'niteowl' ? GOLD : '#d9e1dd', k: 0.04
      });
    }
    update(dt, w) {
      if (w.ceasefire || this.holdPosition || (this.options.holdPosition && this.options.holdPosition(w))) {
        this.vx = this.vy = 0;
        return;
      }
      this.cool -= dt;
      this.grapple = Math.max(0, this.grapple - dt);
      const p = w.player;
      let foe = null, bd = this.who === 'niteowl' ? 430 : 210;
      for (const e of this.taskTarget ? [] : w.entities)
        if (e.team === 'enemy' && active(e) && !e.isProjectile && !e.bonusBoss && e.hp != null && w.los(this.x, this.y, e.x, e.y)) {
          const d = U.dist(this.x, this.y, e.x, e.y);
          if (d < bd) {
            bd = d;
            foe = e;
          }
        }
      let tx = this.taskTarget ? this.taskTarget.x : p.x + (this.who === 'niteowl' ? -65 : 65);
      let ty = this.taskTarget ? this.taskTarget.y : p.y + 75;
      if (foe) {
        this.facing = U.angleTo(this.x, this.y, foe.x, foe.y);
        if (this.who === 'rorschach') {
          tx = foe.x;
          ty = foe.y;
        }
      }
      const d = U.dist(this.x, this.y, tx, ty);
      if (d > 650 && this.grapple <= 0) {
        // A visible grapple catches companions up across rooftops; never blocks progression.
        const nx = p.x + (this.who === 'niteowl' ? -85 : 85), ny = p.y + 65;
        if (w.isFree(nx, ny, 14)) {
          burst(w, this.x, this.y, GOLD);
          this.x = nx;
          this.y = ny;
          this.grapple = 4;
        }
      }
      else if (d > 85 || (foe && this.who === 'rorschach' && bd > 42)) {
        const angle = U.angleTo(this.x, this.y, tx, ty);
        let best = angle, score = Infinity;
        for (const off of [
          0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2
        ]) {
          const a = angle + off, nx = this.x + Math.cos(a) * 55, ny = this.y + Math.sin(a) * 55;
          if (!w.isFree(nx, ny, 14))
            continue;
          const s = U.dist(nx, ny, tx, ty);
          if (s < score) {
            score = s;
            best = a;
          }
        }
        if (score < Infinity) {
          this.vx = U.damp(this.vx, Math.cos(best) * 190, 10, dt);
          this.vy = U.damp(this.vy, Math.sin(best) * 190, 10, dt);
          if (!foe)
            this.facing = best;
        }
      }
      else {
        this.vx = U.damp(this.vx, 0, 10, dt);
        this.vy = U.damp(this.vy, 0, 10, dt);
      }
      if (foe && this.cool <= 0) {
        if (this.who === 'niteowl') {
          const a = this.facing;
          w.add(new DM.Proj.Bolt({
            x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20, vx: Math.cos(a) * 490, vy: Math.sin(a) * 490,
            dmg: 11, color: GOLD
          }));
          this.cool = 1.5;
          DM.Audio.play('zap');
          this.strikes++;
        }
        else if (bd < 62) {
          foe.damage(15, this, 'impact');
          foe.stun = Math.max(foe.stun, 0.8);
          burst(w, foe.x, foe.y, '#ddd6c6');
          this.cool = 1.3;
          DM.Audio.play('impact');
          this.strikes++;
        }
      }
      this.moving = this.speed > 15;
      if (this.moving)
        this.walk += dt * this.speed * 0.09;
    }
    render(g, w) {
      super.render(g, w);
      if (this.who === 'rorschach') {
        g.save();
        g.translate(this.x, this.y);
        g.rotate(this.facing);
        g.fillStyle = '#23242a';
        G.ellipse(g, 7, -3, 3, 2);
        g.fill();
        G.ellipse(g, 6, 3, 2, 3);
        g.fill();
        g.restore();
      }
      if (!w.lit)
        this.renderEmissive(g, w);
    }
    renderEmissive(g, w) {
      if (this.showName && (!this.options.showName || this.options.showName(w)) && withinRange(w, this, 210))
        label(g, this.who === 'niteowl' ? 'NITE OWL' : 'RORSCHACH', this.x, this.y - 35, GOLD, 11);
    }
  }
  // Collision tests sample the swept shaft, not an invisible full-radius attack.
  function segmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const length2 = dx * dx + dy * dy;
    const t = length2 ? U.clamp(((px - ax) * dx + (py - ay) * dy) / length2, 0, 1) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function sweptArmHit(person, pivot, previous, current, options = {}) {
    const inner = options.inner || 106;
    const outer = options.outer || 330;
    const shaft = options.shaft || 12;
    const weight = options.weight || 30;
    const samples = Math.max(1, Math.ceil(Math.abs(current - previous) * outer / 10));
    for (let i = 0; i <= samples; i++) {
      const a = previous + (current - previous) * i / samples;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = pivot.x + outer * c;
      const y = pivot.y + outer * s;
      const distance = segmentDistance(person.x, person.y, pivot.x + inner * c, pivot.y + inner * s, x, y);
      if (distance < shaft + person.r || U.dist(person.x, person.y, x, y) < weight + person.r)
        return true;
    }
    return false;
  }
  // Uses ChapterContext's normal focus target. Only this bonus encounter owns it.
  class BossFraming {
    constructor(ctx, boss, radius = 150) {
      this.ctx = ctx;
      this.boss = boss;
      this.extent = typeof radius === 'number' ? {
        left: radius, right: radius, top: radius, bottom: radius
      } : radius;
      this.world = ctx.world;
      this.camera = this.world.camera;
      this.baseZoom = this.world.baseZoom;
      this.previousTarget = ctx.camTarget;
      this.point = { x: boss.x, y: boss.y };
      this.active = false;
    }
    projectionSafe(zoom, x, y, includePlayer = true) {
      const boss = this.boss;
      const sx = (boss.x - x) * zoom + DM.W / 2;
      const sy = (boss.y - y) * zoom + DM.H / 2;
      const e = this.extent;
      if (sx - e.left * zoom < 37.9 || sx + e.right * zoom > DM.W - 37.9 ||
        sy - e.top * zoom < 124.9 || sy + e.bottom * zoom > DM.H - 134.9)
        return false;
      if (!includePlayer)
        return true;
      const p = this.world.player;
      const px = (p.x - x) * zoom + DM.W / 2;
      const py = (p.y - y) * zoom + DM.H / 2;
      return px > 38 && px < DM.W - 38 && py > 112 && py < DM.H - 135;
    }
    target(zoom) {
      const p = this.world.player;
      const w = this.world;
      const x = U.lerp(p.x, this.boss.x, 0.35);
      const y = U.lerp(p.y, this.boss.y, 0.35);
      const hw = DM.W / 2 / zoom;
      const hh = DM.H / 2 / zoom;
      const e = this.extent;
      const minX = Math.max(w.w <= 2 * hw ? w.w / 2 : hw, this.boss.x + e.right - (DM.W / 2 - 38) / zoom, p.x +
        p.r - (DM.W / 2 - 38) / zoom);
      const maxX = Math.min(w.w <= 2 * hw ? w.w / 2 : w.w - hw, this.boss.x - e.left + (DM.W / 2 - 38) / zoom, p.x - p.r +
        (DM.W / 2 - 38) / zoom);
      const minY = Math.max(w.h <= 2 * hh ? w.h / 2 : hh, this.boss.y + e.bottom - (DM.H / 2 - 135) / zoom, p.y +
        p.r - (DM.H / 2 - 135) / zoom);
      const maxY = Math.min(w.h <= 2 * hh ? w.h / 2 : w.h - hh, this.boss.y - e.top + (DM.H / 2 - 125) / zoom, p.y - p.r +
        (DM.H / 2 - 112) / zoom);
      return {
        x: U.clamp(x, minX, maxX),
        y: U.clamp(y, minY, maxY),
        feasible: minX <= maxX && minY <= maxY,
      };
    }
    update() {
      if (this.boss.dead || this.world.boss !== this.boss || this.ctx.world !== this.world) {
        this.release();
        return;
      }
      const camera = this.camera;
      let zoom = this.baseZoom * 0.9;
      let point = this.target(zoom);
      // A long teleport can separate Jon and the boss more than a fixed 10% zoom permits.
      while (zoom > 0.28 && (!point.feasible || !this.projectionSafe(zoom, point.x, point.y))) {
        zoom -= 0.01;
        point = this.target(zoom);
      }
      this.point.x = point.x;
      this.point.y = point.y;
      this.ctx.camTarget = this.point;
      this.active = true;
      camera.targetZoom = zoom;
      if (camera.zoom > zoom)
        camera.zoom = zoom;
      if (!this.projectionSafe(camera.zoom, camera.x, camera.y))
        camera.snap(point.x, point.y);
    }
    release() {
      if (!this.active)
        return;
      if (this.ctx.camTarget === this.point)
        this.ctx.camTarget = this.previousTarget;
      this.camera.targetZoom = this.baseZoom;
      this.active = false;
    }
  }
  DM.BonusKit = {
    label, ring, burst, withinRange, Sign, Terminal, Companion, Lamp, segmentDistance, sweptArmHit, BossFraming
  };
})();
