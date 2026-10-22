/*
 * Minigames run as overlay scenes. Chapter scripts start them with
 * `yield ctx.minigame(DM.Scenes.WatchRepair)`; they call done(result) when finished.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Engine = DM.Engine;
  const F = DM.FONTS;
  const Scenes = (DM.Scenes = DM.Scenes || {});

  function gear(ctx, x, y, r, teeth, rot, fill, stroke) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 ? r : r * 0.82;
      const a2 = a + Math.PI / (teeth * 2);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    Gfx.circle(ctx, 0, 0, r * 0.25);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * r * 0.5 - 2, Math.sin(a) * r * 0.5 - 2, 4, 4);
    }
    ctx.restore();
  }

  // Seat four gears in Janey's watch by pressing at the right moment.
  class WatchRepair {
    constructor(opts, done) {
      this.done = done;
      this.opaque = false;
      this.cursor = 'pointer';
      this.t = 0;
      this.step = 0;
      this.angle = -Math.PI / 2;
      this.speed = 2.0;
      this.dir = 1;
      this.zone = { a: U.rand(0, Math.PI * 2), w: 0.7 };
      this.missT = 0;
      this.hitT = 0;
      this.finished = false;
      this.endT = 0;
      this.spin = 0;
      this.gears = [
        { x: -50, y: -40, r: 46, teeth: 14 },
        { x: 45, y: -10, r: 34, teeth: 11 },
        { x: -10, y: 60, r: 30, teeth: 10 },
        { x: 70, y: 70, r: 22, teeth: 8 },
      ];
    }
    update(dt) {
      this.t += dt;
      this.missT = Math.max(0, this.missT - dt);
      this.hitT = Math.max(0, this.hitT - dt);
      if (this.finished) {
        this.spin += dt * 1.5;
        this.endT -= dt;
        if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) DM.Audio.play('tick', { alt: Math.floor(this.t * 2) % 2 });
        if (this.endT <= 0) {
          Engine.pop();
          this.done(true);
        }
        return;
      }
      this.angle += this.speed * this.dir * dt;
      if (this.t > 0.4 && (Input.pressed('confirm') || Input.pressed('interact'))) {
        Input.consume('confirm');
        Input.consume('interact');
        const d = Math.abs(U.wrapAngle(this.angle - this.zone.a));
        if (d < this.zone.w / 2) {
          this.step++;
          this.hitT = 0.35;
          DM.Audio.play('gear');
          if (this.step >= this.gears.length) {
            this.finished = true;
            this.endT = 2.4;
            DM.Audio.play('success');
          } else {
            this.speed *= 1.22;
            this.dir *= -1;
            this.zone.w *= 0.86;
            this.zone.a = U.rand(0, Math.PI * 2);
          }
        } else {
          this.missT = 0.4;
          DM.Audio.play('miss');
        }
      }
    }
    render(ctx) {
      ctx.fillStyle = 'rgba(8,6,4,0.86)';
      ctx.fillRect(0, 0, DM.W, DM.H);
      const cx = DM.W / 2, cy = 370;
      Gfx.text(ctx, "REPAIRING JANEY'S WATCH", cx, 92, { size: 30, color: DM.C.paper, align: 'center', weight: 600, spacing: 6 });
      Gfx.text(ctx, this.finished ? 'It runs.' : 'Press SPACE or CLICK when the pivot lines up with the gold jewel setting.', cx, 124, { size: 17, color: 'rgba(242,231,204,0.75)', align: 'center', font: F.type });

      const shake = this.missT > 0 ? Math.sin(this.t * 80) * 4 : 0;
      ctx.save();
      ctx.translate(cx + shake, cy);
      ctx.fillStyle = '#b8902e';
      Gfx.circle(ctx, 0, 0, 190);
      ctx.fill();
      ctx.fillStyle = '#e2c46a';
      Gfx.circle(ctx, 0, 0, 178);
      ctx.fill();
      ctx.fillStyle = '#2a2622';
      Gfx.circle(ctx, 0, 0, 160);
      ctx.fill();

      this.gears.forEach((g, i) => {
        const seated = i < this.step;
        if (seated) {
          const rot = (this.finished ? this.spin : this.t * 0.6) * (i % 2 ? -1 : 1) * (46 / g.r);
          gear(ctx, g.x, g.y, g.r, g.teeth, rot, i % 2 ? '#c9a24a' : '#d8b860', '#7a5a1a');
        } else {
          ctx.save();
          ctx.strokeStyle = i === this.step ? 'rgba(242,196,24,0.8)' : 'rgba(242,231,204,0.2)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          Gfx.circle(ctx, g.x, g.y, g.r);
          ctx.stroke();
          ctx.restore();
        }
      });
      ctx.fillStyle = '#c4302b';
      for (const [x, y] of [[-50, -40], [45, -10], [-10, 60], [70, 70]]) {
        Gfx.circle(ctx, x, y, 3.5);
        ctx.fill();
      }

      if (this.finished) {
        const k = Math.min(1, (2.4 - this.endT) * 1.5);
        ctx.globalAlpha = k;
        ctx.fillStyle = '#f6efdf';
        Gfx.circle(ctx, 0, 0, 160);
        ctx.fill();
        ctx.strokeStyle = DM.C.ink;
        ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          Gfx.line(ctx, Math.cos(a) * 130, Math.sin(a) * 130, Math.cos(a) * 148, Math.sin(a) * 148);
        }
        const sec = -Math.PI / 2 + this.spin * 2;
        ctx.lineWidth = 6;
        Gfx.line(ctx, 0, 0, Math.cos(-2.2) * 70, Math.sin(-2.2) * 70);
        ctx.lineWidth = 4;
        Gfx.line(ctx, 0, 0, Math.cos(-0.9) * 110, Math.sin(-0.9) * 110);
        ctx.strokeStyle = DM.C.blood;
        ctx.lineWidth = 1.5;
        Gfx.line(ctx, 0, 0, Math.cos(sec) * 130, Math.sin(sec) * 130);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      if (!this.finished) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = 'rgba(242,231,204,0.18)';
        ctx.lineWidth = 10;
        Gfx.circle(ctx, 0, 0, 215);
        ctx.stroke();
        ctx.strokeStyle = this.hitT > 0 ? '#ffffff' : DM.C.yellow;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 215, this.zone.a - this.zone.w / 2, this.zone.a + this.zone.w / 2);
        ctx.stroke();
        const a = this.angle;
        ctx.fillStyle = this.missT > 0 ? DM.C.red : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 200, Math.sin(a) * 200);
        ctx.lineTo(Math.cos(a - 0.06) * 236, Math.sin(a - 0.06) * 236);
        ctx.lineTo(Math.cos(a + 0.06) * 236, Math.sin(a + 0.06) * 236);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (let i = 0; i < this.gears.length; i++) {
        ctx.fillStyle = i < this.step ? DM.C.yellow : 'rgba(242,231,204,0.2)';
        Gfx.circle(ctx, cx - 45 + i * 30, DM.H - 60, 7);
        ctx.fill();
      }
    }
  }

  Scenes.WatchRepair = WatchRepair;
})();
