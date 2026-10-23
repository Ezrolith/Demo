/*
 * Chapter interlude: a comic page. Nine-panel grid, the chapter's colour, the
 * Doomsday Clock, an epigraph, and Jon's narration typed out line by line.
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

  class Interlude {
    constructor(chapterId) {
      this.ch = DM.Chapters.get(chapterId);
      this.t = 0;
      this.cursor = 'pointer';
      this.line = 0;
      this.chars = 0;
      this.lines = this.ch.intro || [];
      this.left = false;
    }
    enter() {
      DM.Audio.music.play(this.ch.introMusic || 'title');
    }
    get finished() {
      return this.line >= this.lines.length;
    }
    update(dt) {
      this.t += dt;
      if (this.t < 0.6) return;
      if (!this.finished) {
        const L = this.lines[this.line];
        const prev = Math.floor(this.chars);
        this.chars += dt * 48;
        if (Math.floor(this.chars) > prev && Math.floor(this.chars) % 3 === 0) DM.Audio.play('type');
        if (this.chars >= L.length + 22) {
          this.line++;
          this.chars = 0;
        }
      }
      if (Input.pressed('confirm')) {
        Input.consume('confirm');
        if (!this.finished) {
          this.line = this.lines.length;
          this.chars = 0;
        } else this.begin();
      } else if (Input.pressed('back')) this.begin();
    }
    begin() {
      if (this.left) return;
      this.left = true;
      DM.Audio.play('ui_select');
      Engine.fadeTo(() => Engine.set(new Scenes.Play(), { chapter: this.ch.id, stage: 0 }), { out: 0.7, in: 0.6 });
    }
    render(ctx) {
      const ch = this.ch;
      const t = this.t;
      ctx.fillStyle = '#0b0a09';
      ctx.fillRect(0, 0, DM.W, DM.H);
      const gx = 40, gy = 30, gw = DM.W - 80, gh = DM.H - 60, gut = 12;
      const pw = (gw - gut * 2) / 3, ph = (gh - gut * 2) / 3;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const k = U.clamp((t - (r * 3 + c) * 0.05) * 3, 0, 1);
        ctx.globalAlpha = k;
        ctx.fillStyle = U.mix(ch.color, '#000000', 0.15 + ((r + c) % 3) * 0.08);
        ctx.fillRect(gx + c * (pw + gut), gy + r * (ph + gut), pw, ph);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(gx, gy, pw * 2 + gut, gh);

      Gfx.clock(ctx, gx + pw * 2 + gut * 2 + pw / 2, gy + ph * 1.5 + gut, 118, ch.clock, { blood: true });
      Gfx.text(ctx, `${ch.clock} MINUTES TO MIDNIGHT`, gx + pw * 2 + gut * 2 + pw / 2, gy + ph * 2.5 + gut * 2 + 10, { size: 15, color: DM.C.paper, align: 'center', spacing: 4 });

      const x = gx + 44;
      Gfx.text(ctx, ch.numeral, x, 104, { size: 20, color: DM.C.paper, spacing: 8, weight: 600 });
      Gfx.text(ctx, ch.title.toUpperCase(), x, 166, { size: 54, color: '#ffffff', weight: 700, spacing: 4, shadow: 'rgba(0,0,0,0.5)', shadowOff: 3 });
      Gfx.text(ctx, `${ch.date.toUpperCase()}  ·  ${ch.place.toUpperCase()}`, x, 200, { size: 16, color: DM.C.paper, spacing: 4 });

      let y = 250;
      for (let i = 0; i < this.lines.length; i++) {
        if (i > this.line) break;
        const chars = i < this.line ? Infinity : this.chars;
        const h = Gfx.paragraph(ctx, this.lines[i], x, y, pw * 2 - 70, 27, { size: 19, font: F.type, color: '#f6efdf', chars });
        y += h + 16;
      }

      if (ch.epigraph) {
        const ey = gy + gh - 96;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - 14, ey - 12, pw * 2 - 50, 78);
        Gfx.paragraph(ctx, `“${ch.epigraph.text}”`, x, ey, pw * 2 - 80, 22, { size: 16, font: F.type, color: DM.C.paper });
        Gfx.text(ctx, '— ' + ch.epigraph.by, x + pw * 2 - 80, ey + 56, { size: 14, color: DM.C.paper, align: 'right', font: F.type });
      }

      if (this.finished && Math.sin(t * 4) > -0.4) Gfx.text(ctx, 'CLICK OR PRESS SPACE TO BEGIN', DM.W - 60, DM.H - 46, { size: 14, color: '#ffffff', align: 'right', spacing: 4 });
      else if (!this.finished) Gfx.text(ctx, 'SPACE TO SKIP', DM.W - 60, DM.H - 46, { size: 12, color: 'rgba(255,255,255,0.45)', align: 'right', spacing: 4 });
      Gfx.postFx(ctx, { vignette: 0, grain: 0.06 });
    }
  }

  Scenes.Interlude = Interlude;
})();
