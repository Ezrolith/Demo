/* Math, randomness, easing, colour and geometry helpers. */
(function () {
  'use strict';
  const DM = window.DM;
  const TAU = Math.PI * 2;

  const U = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    chance: (p) => Math.random() < p,
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    dist2: (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay),
    angleTo: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    // Frame-rate independent exponential smoothing toward a target.
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    approach: (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target)),
  };

  U.wrapAngle = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  U.lerpAngle = (a, b, t) => a + U.wrapAngle(b - a) * t;
  U.dampAngle = (a, b, lambda, dt) => a + U.wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));

  U.norm = (x, y) => {
    const l = Math.hypot(x, y);
    return l > 1e-9 ? { x: x / l, y: y / l, l } : { x: 0, y: 0, l: 0 };
  };

  U.ease = {
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outQuad: (t) => 1 - (1 - t) * (1 - t),
  };

  // ---- colour -------------------------------------------------------------
  const rgbCache = new Map();
  U.hexToRgb = (hex) => {
    let c = rgbCache.get(hex);
    if (c) return c;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    const n = parseInt(h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
    return c;
  };
  U.rgba = (hex, a) => {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  U.mix = (hexA, hexB, t, a = 1) => {
    const A = U.hexToRgb(hexA), B = U.hexToRgb(hexB);
    const r = Math.round(A[0] + (B[0] - A[0]) * t);
    const g = Math.round(A[1] + (B[1] - A[1]) * t);
    const b = Math.round(A[2] + (B[2] - A[2]) * t);
    return `rgba(${r},${g},${b},${a})`;
  };

  // ---- geometry -----------------------------------------------------------
  // Circle vs axis-aligned rect. Returns push-out normal and depth, or null.
  U.circleRect = (cx, cy, r, R) => {
    const nx = U.clamp(cx, R.x, R.x + R.w);
    const ny = U.clamp(cy, R.y, R.y + R.h);
    const dx = cx - nx, dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      return { nx: dx / d, ny: dy / d, depth: r - d };
    }
    const left = cx - R.x, right = R.x + R.w - cx, top = cy - R.y, bottom = R.y + R.h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { nx: -1, ny: 0, depth: left + r };
    if (m === right) return { nx: 1, ny: 0, depth: right + r };
    if (m === top) return { nx: 0, ny: -1, depth: top + r };
    return { nx: 0, ny: 1, depth: bottom + r };
  };

  // Segment vs rect (Liang–Barsky). Returns entry t in [0,1], or -1 for a miss.
  U.segRect = (x1, y1, x2, y2, R) => {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - R.x, R.x + R.w - x1, y1 - R.y, R.y + R.h - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return -1;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > t1) return -1;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return -1;
          if (t < t1) t1 = t;
        }
      }
    }
    return t0;
  };

  // Does segment (x1,y1)-(x2,y2) pass within r of point (cx,cy)?
  U.segCircle = (x1, y1, x2, y2, cx, cy, r) => {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
    t = U.clamp(t, 0, 1);
    const px = x1 + dx * t, py = y1 + dy * t;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
  };

  U.pointInRect = (x, y, R) => x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h;

  // ---- misc ---------------------------------------------------------------
  U.fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  U.roman = (n) => ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n] || String(n);

  // Deterministic RNG (mulberry32) so baked backgrounds look the same every run.
  U.seeded = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  DM.U = U;
})();
