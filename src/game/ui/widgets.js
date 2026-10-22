/*
 * Menu: a vertical list driven by keyboard (W/S/arrows + Enter/Space) and mouse.
 * Items: { label, action(), disabled, value() -> string, adjust(dir) }.
 * Items with `adjust` are sliders/toggles: left/right or clicking changes them.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const Gfx = DM.Gfx;
  const Input = DM.Input;
  const Audio = DM.Audio;

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
          const r = this.rowRect(i);
          this.activate(i, m.x < r.x + r.w * 0.55 ? -1 : 1);
        }
        return;
      }
      if (Input.pressed('menuDown')) this.move(1);
      if (Input.pressed('menuUp')) this.move(-1);
      const it = this.items[this.sel];
      if (it && it.adjust) {
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
        if (it.value) {
          const v = it.value();
          const vx = r.x + r.w - 16;
          Gfx.text(ctx, (it.adjust ? '‹  ' : '') + v + (it.adjust ? '  ›' : ''), vx, cy, { size: this.size * 0.8, color: sel ? this.accent : 'rgba(200,225,240,0.6)', align: 'right', spacing: 1 });
        }
      }
    }
  }

  DM.UI = { Menu };
})();
