/*
 * Dialogue box with portraits and a typewriter reveal.
 * Lines: 'plain narration' | ['speaker', 'text'] | ['speaker', 'text', { name: 'Override' }]
 * Speakers are keys of DM.LOOKS. Dr. Manhattan's lines get his blue box.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Audio = DM.Audio;
  const F = DM.FONTS;

  const CPS = 55; // characters per second

  class Dialog {
    constructor() {
      this.active = false;
      this.lines = [];
      this.i = 0;
      this.chars = 0;
      this.t = 0;
    }
    normalize(l) {
      if (typeof l === 'string') return { who: null, text: l };
      if (Array.isArray(l)) return Object.assign({ who: l[0], text: l[1] }, l[2] || {});
      return l;
    }
    open(lines) {
      this.lines = lines.map((l) => this.normalize(l));
      this.i = 0;
      this.chars = 0;
      this.t = 0;
      this.cool = 0.2;
      this.active = this.lines.length > 0;
    }
    close() {
      this.active = false;
    }
    get line() {
      return this.lines[this.i];
    }
    update(dt) {
      if (!this.active) return;
      this.t += dt;
      this.cool -= dt;
      const line = this.line;
      const prev = Math.floor(this.chars);
      this.chars = Math.min(line.text.length, this.chars + dt * CPS);
      const now = Math.floor(this.chars);
      if (now > prev && now < line.text.length && now % 2 === 0 && line.text[now] !== ' ') Audio.play('type');
      const go = Input.pressed('confirm') || Input.pressed('interact');
      if (this.cool <= 0 && go) {
        Input.consume('confirm');
        Input.consume('interact');
        Input.consume('teleport');
        Input.consume('telekinesis');
        if (this.chars < line.text.length) this.chars = line.text.length;
        else {
          this.i++;
          this.chars = 0;
          this.cool = 0.12;
          if (this.i >= this.lines.length) this.active = false;
          else Audio.play('ui_move');
        }
      }
    }
    render(ctx) {
      if (!this.active) return;
      const line = this.line;
      const look = line.who ? DM.LOOKS[line.who] : null;
      const x = 150, y = 528, w = DM.W - 300, h = 150;
      const done = this.chars >= line.text.length;

      if (!look) {
        Gfx.caption(ctx, line.text, DM.W / 2, y + 20, w - 120, { chars: this.chars, size: 19 });
      } else {
        const mh = look.manhattan;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 6, y + 6, w, h);
        ctx.fillStyle = mh ? '#0d2a44' : '#fbf8ef';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = mh ? '#7fe3ff' : DM.C.ink;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, w, h);
        Gfx.portrait(ctx, x + 18, y + 18, h - 36, look, this.t, !done);
        const name = line.name || look.name;
        const tx = x + h + 6;
        Gfx.text(ctx, name.toUpperCase(), tx, y + 34, { size: 15, color: mh ? '#7fe3ff' : '#8a3b22', spacing: 2, weight: 600 });
        Gfx.paragraph(ctx, line.text, tx, y + 46, w - h - 40, 29, { size: 23, font: F.hand, color: mh ? '#d8f6ff' : DM.C.ink, chars: this.chars });
      }
      if (done && Math.sin(this.t * 6) > -0.3) {
        Gfx.text(ctx, '▼', x + w - 22, y + h - 14, { size: 14, color: look && look.manhattan ? '#7fe3ff' : '#8a3b22', align: 'center' });
      }
      Gfx.text(ctx, 'SPACE / CLICK', x + w, y + h + 20, { size: 11, color: 'rgba(200,225,240,0.45)', align: 'right', spacing: 2 });
    }
  }

  DM.Dialog = Dialog;
})();
