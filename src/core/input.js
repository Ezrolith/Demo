/*
 * Input: keyboard + mouse (+ basic touch for menus), mapped to named actions.
 *
 * Game code never asks "is KeyQ down?" — it asks Input.pressed('disintegrate').
 * Rebinding, gamepad support or touch controls later only touch this file.
 *
 * Keys use KeyboardEvent.code (physical position), so WASD stays WASD on
 * AZERTY/Dvorak layouts. Mac specifics handled here:
 *   - Ctrl+click counts as right click, and game keys still work while Ctrl
 *     is held (Ctrl+letter is not a browser shortcut on macOS).
 *   - Releasing Cmd clears all keys (macOS swallows keyup while Cmd is held).
 * Losing focus (window blur, hidden tab) releases everything and emits the
 * DM.Events 'app:blur' event, which the Play scene turns into a pause.
 */
(function () {
  'use strict';
  const DM = window.DM;

  const BINDINGS = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],

    telekinesis: ['Mouse0'],
    disintegrate: ['KeyQ', 'Mouse2'],
    teleport: ['Space'],
    duplicate: ['KeyR'],
    timesight: ['KeyF', 'ShiftLeft', 'ShiftRight'],
    expand: ['KeyG'],
    interact: ['KeyE', 'Enter'],

    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'Space', 'KeyE', 'Mouse0'],
    back: ['Escape', 'Backspace'],
    menuUp: ['KeyW', 'ArrowUp'],
    menuDown: ['KeyS', 'ArrowDown'],
    menuLeft: ['KeyA', 'ArrowLeft'],
    menuRight: ['KeyD', 'ArrowRight'],
    mute: ['KeyM'],

    debug: ['Backquote'],
    skip: ['BracketRight'],
  };

  // Human-readable labels used by the HUD and controls screen.
  const LABELS = {
    telekinesis: 'HOLD LEFT CLICK',
    disintegrate: 'Q / RIGHT CLICK',
    teleport: 'SPACE',
    duplicate: 'R',
    timesight: 'HOLD F / SHIFT',
    expand: 'G',
    interact: 'E',
  };
  const SHORT = {
    telekinesis: 'LMB',
    disintegrate: 'Q',
    teleport: 'SPC',
    duplicate: 'R',
    timesight: 'F',
    expand: 'G',
    interact: 'E',
  };

  const bound = new Set();
  for (const k in BINDINGS) for (const c of BINDINGS[k]) bound.add(c);

  const state = {};
  const get = (code) => state[code] || (state[code] = { down: false, pressed: false, released: false });

  const Input = {
    bindings: BINDINGS,
    labels: LABELS,
    short: SHORT,
    mouse: { x: DM.W / 2, y: DM.H / 2, moved: false, inside: true },
    touch: false,
    _any: false,
    _ctrlClick: false,

    init(canvas) {
      this.canvas = canvas;
      const press = (code) => {
        const s = get(code);
        if (!s.down) {
          s.down = true;
          s.pressed = true;
        }
        this._any = true;
      };
      const release = (code) => {
        const s = get(code);
        if (s.down) {
          s.down = false;
          s.released = true;
        }
      };
      this._press = press;
      this._release = release;

      const isMac = /Mac|iP(hone|ad)/.test(navigator.platform || navigator.userAgent || '');
      window.addEventListener('keydown', (e) => {
        // Leave browser/OS shortcuts (Cmd+R, Ctrl+F, Alt+Tab, F11...) alone. On a Mac,
        // Ctrl is held for Ctrl+click, so bound keys keep working with it.
        if (e.metaKey || e.altKey || (e.ctrlKey && !(isMac && bound.has(e.code)))) return;
        if (bound.has(e.code) || e.code === 'Tab') e.preventDefault();
        if (e.repeat) {
          // OS auto-repeat of a key that is still held: re-arm it after a clearAll()
          // (fades, closed cards, refocus) without creating a new press.
          get(e.code).down = true;
        } else press(e.code);
        DM.Audio && DM.Audio.unlock();
      });
      window.addEventListener('keyup', (e) => {
        release(e.code);
        if (e.key === 'Meta') this.clearAll();
      });
      const lostFocus = () => {
        this.clearAll();
        if (DM.Events) DM.Events.emit('app:blur');
      };
      window.addEventListener('blur', lostFocus);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) lostFocus();
      });

      canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (canvas.focus) canvas.focus({ preventScroll: true });
        this.touch = false;
        this.updateMouse(e);
        let b = e.button;
        if (b === 0 && e.ctrlKey) {
          b = 2;
          this._ctrlClick = true;
        }
        press('Mouse' + b);
        DM.Audio && DM.Audio.unlock();
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && this._ctrlClick) {
          this._ctrlClick = false;
          release('Mouse2');
        }
        release('Mouse' + e.button);
      });
      window.addEventListener('mousemove', (e) => this.updateMouse(e));
      canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
      canvas.addEventListener('mouseenter', () => (this.mouse.inside = true));
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // Touch: taps act as left clicks so menus work on tablets. Full touch
      // controls for gameplay are on the roadmap.
      const touchOpts = { passive: false };
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.touch = true;
        this.updateMouse(e.changedTouches[0]);
        press('Mouse0');
        DM.Audio && DM.Audio.unlock();
      }, touchOpts);
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        this.updateMouse(e.changedTouches[0]);
      }, touchOpts);
      canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        release('Mouse0');
      }, touchOpts);
      canvas.addEventListener('touchcancel', () => release('Mouse0'), touchOpts);
    },

    updateMouse(e) {
      const p = DM.Engine.toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.moved = true;
      this.mouse.inside = true;
    },

    down(action) {
      const codes = BINDINGS[action];
      if (!codes) return false;
      for (const c of codes) if (state[c] && state[c].down) return true;
      return false;
    },
    pressed(action) {
      const codes = BINDINGS[action];
      if (!codes) return false;
      for (const c of codes) if (state[c] && state[c].pressed) return true;
      return false;
    },
    released(action) {
      const codes = BINDINGS[action];
      if (!codes) return false;
      for (const c of codes) if (state[c] && state[c].released) return true;
      return false;
    },
    // Mark an action's press as handled so nothing else reacts to it this frame.
    consume(action) {
      const codes = BINDINGS[action];
      if (codes) for (const c of codes) if (state[c]) state[c].pressed = false;
    },
    clicked() {
      return !!(state.Mouse0 && state.Mouse0.pressed);
    },
    anyPressed() {
      return this._any;
    },
    axis() {
      let x = 0, y = 0;
      if (this.down('left')) x -= 1;
      if (this.down('right')) x += 1;
      if (this.down('up')) y -= 1;
      if (this.down('down')) y += 1;
      if (x && y) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    endFrame() {
      for (const k in state) {
        state[k].pressed = false;
        state[k].released = false;
      }
      this._any = false;
      this.mouse.moved = false;
    },
    clearAll() {
      for (const k in state) {
        if (state[k].down) state[k].released = true;
        state[k].down = false;
        state[k].pressed = false;
      }
    },
    // Test/automation hooks: simulate presses without real events.
    simulate(code, isDown) {
      if (isDown) this._press(code);
      else this._release(code);
    },
  };

  DM.Input = Input;
})();
