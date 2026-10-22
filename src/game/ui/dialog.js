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
  const Schema = DM.SettingsSchema;
  const F = DM.FONTS;

  // Holding advance this long fast-forwards: whole lines, one every FF_STEP seconds.
  const FF_HOLD = 0.45;
  const FF_STEP = 0.08;

  class Dialog {
    constructor() {
      this.active = false;
      this.lines = [];
      this.i = 0;
      this.chars = 0;
      this.t = 0;
      this.holdT = 0;
      this.ffT = 0;
      this.armed = false;
    }
    normalize(l) {
      if (typeof l === 'string') return { who: null, text: l };
      if (Array.isArray(l)) return Object.assign({ who: l[0], text: l[1] }, l[2] || {});
      return l;
    }
    // Characters shown when a line starts: all of them at TEXT SPEED INSTANT.
    startChars() {
      return Schema.textCPS() === Infinity && this.line ? this.line.text.length : 0;
    }
    open(lines) {
      this.lines = lines.map((l) => this.normalize(l));
      this.i = 0;
      this.t = 0;
      this.cool = 0.2;
      this.holdT = 0;
      this.armed = false; // a key still held from whatever opened this must be let go first
      this.active = this.lines.length > 0;
      this.chars = this.startChars();
    }
    close() {
      this.active = false;
    }
    get line() {
      return this.lines[this.i];
    }
    advance() {
      this.i++;
      this.cool = 0.12;
      if (this.i >= this.lines.length) this.active = false;
      else {
        this.chars = this.startChars();
        Audio.play('ui_move');
      }
    }
    update(dt) {
      if (!this.active) return;
      this.t += dt;
      this.cool -= dt;
      const line = this.line;
      const prev = Math.floor(this.chars);
      this.chars = Math.min(line.text.length, this.chars + dt * Schema.textCPS());
      const now = Math.floor(this.chars);
      if (now > prev && now < line.text.length && now % 2 === 0 && line.text[now] !== ' ') Audio.play('type');

      const held = Input.down('confirm') || Input.down('interact');
      if (!held) this.armed = true;
      this.holdT = held && this.armed ? this.holdT + dt : 0;
      if (this.holdT >= FF_HOLD) {
        Input.consume('confirm');
        Input.consume('interact');
        this.chars = line.text.length;
        this.ffT -= dt;
        if (this.ffT <= 0) {
          this.ffT = FF_STEP;
          this.advance();
        }
        return;
      }
      this.ffT = FF_STEP;

      const go = Input.pressed('confirm') || Input.pressed('interact');
      if (this.cool <= 0 && go) {
        Input.consume('confirm');
        Input.consume('interact');
        Input.consume('teleport');
        Input.consume('telekinesis');
        if (this.chars < line.text.length) this.chars = line.text.length;
        else this.advance();
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
      Gfx.text(ctx, 'E / SPACE / CLICK   ·   HOLD TO FAST-FORWARD', x + w, y + h + 22, { size: 13, color: 'rgba(200,225,240,0.7)', align: 'right', spacing: 2 });
    }
  }

  DM.Dialog = Dialog;
})();
