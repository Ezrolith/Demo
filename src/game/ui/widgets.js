/*
 * Menu: a vertical list driven by keyboard (W/S/arrows + Enter/Space) and mouse.
 * Items: { label, action(), disabled, value() -> string, adjust(dir), desc }.
 * Items with `adjust` are sliders/choices/toggles: left/right change them. With
 * the mouse, the ‹ and › glyphs step down/up and a click anywhere else on the
 * row steps forward. Sliders also give `frac()` (0..1, drawn as a bar) and
 * `setFrac(f)`, so clicking the bar sets the value directly.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Audio = DM.Audio;

  const BAR_W = 150;
  const inside = (x, z) => !!z && x >= z[0] && x <= z[1];

  class Menu {
    constructor(items, o = {}) {
      this.items = items;
      this.x = o.x || 100;
      this.y = o.y || 300;
      this.w = o.w || 340;
      this.itemH = o.itemH || 46;
      this.size = o.size || 24;
      this.align = o.align || 'left';
      this.onBack = o.onBack || null;
      this.accent = o.accent || DM.C.blue;
      this.valueW = o.valueW || 120; // width of the value column between ‹ and ›
      this.sel = Math.max(0, items.findIndex((i) => !i.disabled));
      this.t = 0;
    }
    rowRect(i) {
      const x = this.align === 'center' ? this.x - this.w / 2 : this.x;
      return { x, y: this.y + i * this.itemH, w: this.w, h: this.itemH };
    }
    hit(mx, my) {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.rowRect(i);
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
      }
      return -1;
    }
    // Horizontal hit zones of an adjustable row: the two glyphs and the slider bar.
    zones(i) {
      const r = this.rowRect(i);
      const right = r.x + r.w - 16;
      const gw = this.size * 0.8;
      const lx = right - gw - 8 - this.valueW - 8; // right edge of the ‹ glyph
      const z = { left: [lx - gw - 10, lx + 6], right: [right - gw - 6, right + 12], value: [lx + 8, right - gw - 8] };
      if (this.items[i].frac) z.bar = [lx - gw - 14 - BAR_W, lx - gw - 14];
      return z;
    }
    move(dir) {
      const n = this.items.length;
      for (let k = 1; k <= n; k++) {
        const i = (this.sel + dir * k + n * 4) % n;
        if (!this.items[i].disabled) {
          this.sel = i;
          Audio.play('ui_move');
          return;
        }
      }
    }
    update(dt) {
      this.t += dt;
      const m = Input.mouse;
      if (m.moved) {
        const i = this.hit(m.x, m.y);
        if (i >= 0 && !this.items[i].disabled && i !== this.sel) {
          this.sel = i;
          Audio.play('ui_move');
        }
      }
      if (Input.clicked()) {
        const i = this.hit(m.x, m.y);
        Input.consume('confirm');
        if (i >= 0) {
          this.sel = i;
          this.click(i, m.x);
        }
        return;
      }
      if (Input.pressed('menuDown')) this.move(1);
      if (Input.pressed('menuUp')) this.move(-1);
      const it = this.items[this.sel];
      if (it && it.adjust && !it.disabled) {
        if (Input.pressed('menuLeft')) {
          it.adjust(-1);
          Audio.play('ui_move');
        }
        if (Input.pressed('menuRight')) {
          it.adjust(1);
          Audio.play('ui_move');
        }
      }
      if (Input.pressed('confirm')) {
        Input.consume('confirm');
        this.activate(this.sel, 1);
      } else if (this.onBack && Input.pressed('back')) {
        Input.consume('back');
        Audio.play('ui_back');
        this.onBack();
      }
    }
    click(i, mx) {
      const it = this.items[i];
      if (!it || it.disabled) return;
      if (!it.adjust) return this.activate(i, 1);
      const z = this.zones(i);
      if (inside(mx, z.bar) && it.setFrac) {
        it.setFrac(Math.max(0, Math.min(1, (mx - z.bar[0]) / (z.bar[1] - z.bar[0]))));
        Audio.play('ui_move');
        return;
      }
      this.activate(i, inside(mx, z.left) ? -1 : 1);
    }
    activate(i, dir) {
      const it = this.items[i];
      if (!it || it.disabled) return;
      if (it.adjust) {
        it.adjust(dir);
        Audio.play('ui_move');
      } else if (it.action) {
        Audio.play('ui_select');
        it.action();
      }
    }
    render(ctx) {
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        const r = this.rowRect(i);
        const sel = i === this.sel && !it.disabled;
        const cy = r.y + r.h / 2 + this.size * 0.36;
        const tx = this.align === 'center' ? r.x + r.w / 2 : r.x + 34;
        if (sel) {
          ctx.fillStyle = 'rgba(95,212,255,0.08)';
          ctx.fillRect(r.x, r.y + 4, r.w, r.h - 8);
          ctx.fillStyle = this.accent;
          ctx.fillRect(r.x, r.y + 4, 3, r.h - 8);
          if (this.align !== 'center') Gfx.hydrogen(ctx, r.x + 17, r.y + r.h / 2, 7, this.accent, this.t * 3, 1.5);
        }
        const color = it.disabled ? 'rgba(160,180,200,0.3)' : sel ? '#ffffff' : 'rgba(200,225,240,0.72)';
        Gfx.text(ctx, it.label, tx, cy, { size: this.size, color, align: this.align === 'center' ? 'center' : 'left', spacing: 2, weight: sel ? 600 : 400 });
        if (!it.value) continue;
        const v = it.value();
        const vs = this.size * 0.8;
        const vcol = sel ? this.accent : 'rgba(200,225,240,0.6)';
        if (!it.adjust) {
          Gfx.text(ctx, v, r.x + r.w - 16, cy, { size: vs, color: vcol, align: 'right', spacing: 1 });
          continue;
        }
        const z = this.zones(i);
        const gcol = sel ? this.accent : 'rgba(200,225,240,0.35)';
        Gfx.text(ctx, '‹', z.left[1] - 6, cy, { size: vs, color: gcol, align: 'right' });
        Gfx.text(ctx, '›', z.right[0] + 6, cy, { size: vs, color: gcol });
        Gfx.text(ctx, v, (z.value[0] + z.value[1]) / 2, cy, { size: vs, color: vcol, align: 'center', spacing: 1 });
        if (z.bar) Gfx.bar(ctx, z.bar[0], r.y + r.h / 2 - 3, z.bar[1] - z.bar[0], 6, it.frac(), sel ? this.accent : 'rgba(200,225,240,0.45)', { segments: 10 });
      }
    }
  }

  DM.UI = { Menu };
})();
