/*
 * Gfx: procedural drawing. There are no image assets — characters, symbols,
 * portraits and icons are all drawn here, which keeps the game a handful of
 * text files and makes restyling cheap.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const F = DM.FONTS;
  const TAU = Math.PI * 2;
  const Gfx = {};

  // ---- primitives ---------------------------------------------------------
  Gfx.circle = (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, TAU);
  };
  Gfx.ellipse = (ctx, x, y, rx, ry, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  };
  Gfx.rr = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };
  Gfx.line = (ctx, x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  // ---- glow sprites (cached radial gradients, drawn additively) -----------
  const glowCache = new Map();
  Gfx.glowSprite = (color, radius) => {
    const r = Math.max(4, Math.ceil(radius / 4) * 4);
    const key = color + r;
    let c = glowCache.get(key);
    if (c) return c;
    if (glowCache.size > 600) glowCache.clear();
    c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, U.rgba(color, 1));
    grad.addColorStop(0.22, U.rgba(color, 0.55));
    grad.addColorStop(0.55, U.rgba(color, 0.16));
    grad.addColorStop(1, U.rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    glowCache.set(key, c);
    return c;
  };
  Gfx.glow = (ctx, x, y, radius, color, alpha = 1) => {
    if (alpha <= 0.003 || radius <= 0) return;
    const s = Gfx.glowSprite(color, radius);
    const op = ctx.globalCompositeOperation;
    const a = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * Math.min(1, alpha);
    ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = a;
  };

  // ---- text ---------------------------------------------------------------
  Gfx.font = (size, family = F.display, weight = 400) => `${weight} ${size}px ${family}`;
  const hasSpacing = (ctx) => 'letterSpacing' in ctx;

  Gfx.text = (ctx, str, x, y, o = {}) => {
    ctx.font = Gfx.font(o.size || 16, o.font || F.display, o.weight || 400);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (hasSpacing(ctx)) ctx.letterSpacing = (o.spacing || 0) + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(str, x + (o.shadowOff || 2), y + (o.shadowOff || 2));
    }
    if (o.stroke) {
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.strokeWidth || 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, x, y);
    if (o.alpha != null) ctx.globalAlpha /= o.alpha;
    if (hasSpacing(ctx)) ctx.letterSpacing = '0px';
  };

  Gfx.measure = (ctx, str, o = {}) => {
    ctx.font = Gfx.font(o.size || 16, o.font || F.display, o.weight || 400);
    if (hasSpacing(ctx)) ctx.letterSpacing = (o.spacing || 0) + 'px';
    const w = ctx.measureText(str).width;
    if (hasSpacing(ctx)) ctx.letterSpacing = '0px';
    return w;
  };

  const wrapCache = new Map();
  Gfx.wrap = (ctx, text, maxW) => {
    const key = ctx.font + '|' + maxW + '|' + text;
    let lines = wrapCache.get(key);
    if (lines) return lines;
    lines = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      lines.push(line);
    }
    if (wrapCache.size > 600) wrapCache.clear();
    wrapCache.set(key, lines);
    return lines;
  };

  // Wrapped text. `chars` reveals only the first N characters (typewriter effect).
  Gfx.paragraph = (ctx, text, x, y, maxW, lh, o = {}) => {
    ctx.font = Gfx.font(o.size || 18, o.font || F.hand, o.weight || 400);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'top';
    if (hasSpacing(ctx)) ctx.letterSpacing = '0px';
    ctx.fillStyle = o.color || '#fff';
    const lines = Gfx.wrap(ctx, text, maxW);
    let remaining = o.chars == null ? Infinity : o.chars;
    for (let i = 0; i < lines.length; i++) {
      if (remaining <= 0) break;
      let ln = lines[i];
      if (ln.length > remaining) ln = ln.slice(0, Math.max(0, Math.floor(remaining)));
      ctx.fillText(ln, x, y + i * lh);
      remaining -= lines[i].length + 1;
    }
    return lines.length * lh;
  };
  Gfx.paragraphHeight = (ctx, text, maxW, lh, o = {}) => {
    ctx.font = Gfx.font(o.size || 18, o.font || F.hand, o.weight || 400);
    return Gfx.wrap(ctx, text, maxW).length * lh;
  };

  // ---- UI pieces ----------------------------------------------------------
  Gfx.panel = (ctx, x, y, w, h, o = {}) => {
    ctx.fillStyle = o.fill || DM.C.uiBg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = o.edge || 'rgba(140, 200, 240, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // corner brackets
    const c = o.accent || DM.C.uiEdge;
    const k = Math.min(10, w / 4, h / 4);
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
    ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
    ctx.moveTo(x + w, y + h - k); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - k, y + h);
    ctx.moveTo(x + k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - k);
    ctx.stroke();
  };

  Gfx.bar = (ctx, x, y, w, h, frac, color, o = {}) => {
    ctx.fillStyle = o.bg || 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * U.clamp(frac, 0, 1), h);
    if (o.segments) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 1; i < o.segments; i++) ctx.fillRect(x + (w * i) / o.segments - 1, y, 2, h);
    }
  };

  // Watchmen-style narration caption: paper box, ink border, typewriter text.
  Gfx.caption = (ctx, text, cx, y, maxW, o = {}) => {
    const pad = 14;
    const size = o.size || 17;
    const lh = Math.round(size * 1.35);
    ctx.font = Gfx.font(size, F.type);
    const lines = Gfx.wrap(ctx, text, maxW - pad * 2);
    let w = 0;
    for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    w += pad * 2;
    const h = lines.length * lh + pad * 2 - (lh - size);
    const x = cx - w / 2;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = o.bg || DM.C.paper;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = o.border || DM.C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    Gfx.paragraph(ctx, text, x + pad, y + pad, maxW - pad * 2, lh, { size, font: F.type, color: o.color || DM.C.ink, chars: o.chars });
    ctx.restore();
    return h;
  };

  // Comic speech bubble with a tail pointing down at (x, y).
  Gfx.bubble = (ctx, text, x, y, o = {}) => {
    const size = o.size || 15;
    ctx.font = Gfx.font(size, F.hand);
    const w = Math.min(220, ctx.measureText(text).width) + 16;
    const lines = Gfx.wrap(ctx, text, w - 16);
    const h = lines.length * (size + 2) + 10;
    const bx = x - w / 2, by = y - h - 12;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.fillStyle = o.bg || '#fbf8ef';
    ctx.strokeStyle = DM.C.ink;
    ctx.lineWidth = 1.5;
    Gfx.rr(ctx, bx, by, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, by + h - 1);
    ctx.lineTo(x, y - 2);
    ctx.lineTo(x + 6, by + h - 1);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x - 5, by + h - 3, 10, 3);
    Gfx.paragraph(ctx, text, x, by + 5, w - 16, size + 2, { size, font: F.hand, color: DM.C.ink, align: 'center' });
    ctx.restore();
  };

  // ---- Watchmen motifs ----------------------------------------------------
  // The hydrogen atom: Jon's chosen symbol.
  Gfx.hydrogen = (ctx, x, y, r, color, t = 0, lw) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw || Math.max(1, r * 0.14);
    Gfx.circle(ctx, x, y, r);
    ctx.stroke();
    Gfx.circle(ctx, x, y, r * 0.24);
    ctx.fill();
    Gfx.circle(ctx, x + Math.cos(t) * r, y + Math.sin(t) * r, r * 0.17);
    ctx.fill();
    ctx.restore();
  };

  // The Doomsday Clock. `minutes` = minutes to midnight.
  Gfx.clock = (ctx, x, y, r, minutes, o = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = o.face || DM.C.paper;
    Gfx.circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.strokeStyle = o.rim || DM.C.ink;
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.stroke();
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.lineWidth = i === 0 ? r * 0.08 : r * 0.04;
      Gfx.line(ctx, Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74, Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
    }
    const mA = -Math.PI / 2 - (minutes / 60) * TAU;
    const hA = -Math.PI / 2 - (minutes / 720) * TAU;
    ctx.strokeStyle = o.hands || DM.C.ink;
    ctx.lineWidth = r * 0.1;
    Gfx.line(ctx, 0, 0, Math.cos(hA) * r * 0.48, Math.sin(hA) * r * 0.48);
    ctx.lineWidth = r * 0.06;
    Gfx.line(ctx, 0, 0, Math.cos(mA) * r * 0.78, Math.sin(mA) * r * 0.78);
    ctx.fillStyle = o.hands || DM.C.ink;
    Gfx.circle(ctx, 0, 0, r * 0.08);
    ctx.fill();
    if (o.blood) {
      ctx.fillStyle = DM.C.blood;
      const bx = r * 0.28, by = -r * 0.55;
      Gfx.circle(ctx, bx, by, r * 0.13);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - r * 0.06, by);
      ctx.quadraticCurveTo(bx - r * 0.02, by + r * 0.5, bx + r * 0.02, by + r * 0.62);
      ctx.quadraticCurveTo(bx + r * 0.08, by + r * 0.3, bx + r * 0.12, by);
      ctx.fill();
    }
    ctx.restore();
  };

  // The smiley badge. A small nod; used as an easter egg prop.
  Gfx.smiley = (ctx, x, y, r) => {
    ctx.save();
    ctx.fillStyle = DM.C.yellow;
    Gfx.circle(ctx, x, y, r);
    ctx.fill();
    ctx.strokeStyle = DM.C.ink;
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    ctx.fillStyle = DM.C.ink;
    Gfx.ellipse(ctx, x - r * 0.33, y - r * 0.25, r * 0.1, r * 0.2);
    ctx.fill();
    Gfx.ellipse(ctx, x + r * 0.33, y - r * 0.25, r * 0.1, r * 0.2);
    ctx.fill();
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.05, r * 0.55, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = DM.C.blood;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.15, y - r * 0.9);
    ctx.quadraticCurveTo(x + r * 0.05, y - r * 0.2, x + r * 0.32, y + r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.45, y - r * 0.35, x + r * 0.45, y - r * 0.8);
    ctx.fill();
    ctx.restore();
  };

  // ---- characters (top-down) ----------------------------------------------
  // `o` = a look (see DM.LOOKS) plus x, y, angle, walk, moving, scale, alpha,
  // aim (arms forward), gun ('pistol' | 'tommy'), flash (0..1 white hit flash).
  Gfx.figure = (ctx, o) => {
    const s = (o.scale || 1) * (o.size || 1);
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (!o.noShadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      Gfx.ellipse(ctx, 3 * s, 4 * s, 14 * s, 11 * s);
      ctx.fill();
    }
    ctx.rotate(o.angle || 0);
    ctx.scale(s, s);
    const sw = o.moving ? Math.sin(o.walk || 0) : 0;
    const armsFwd = o.aim || o.carry;
    // Comic-book ink line around each shape keeps figures readable on any floor.
    const ink = o.ink === false ? null : o.ink || 'rgba(16,12,10,0.6)';
    ctx.strokeStyle = ink || 'transparent';
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    const paint = (color) => {
      ctx.fillStyle = color;
      ctx.fill();
      if (ink) ctx.stroke();
    };

    if (o.cape) {
      ctx.beginPath();
      ctx.moveTo(-1, -13);
      ctx.quadraticCurveTo(-24 - Math.abs(sw) * 4, 0, -1, 13);
      ctx.closePath();
      paint(o.cape);
    }
    Gfx.ellipse(ctx, sw * 7, -5, 6.5, 4);
    paint(o.legs || '#333');
    Gfx.ellipse(ctx, -sw * 7, 5, 6.5, 4);
    paint(o.legs || '#333');

    const sleeve = o.sleeve || o.body || '#777';
    if (armsFwd) {
      Gfx.circle(ctx, 8, -8, 4.1);
      paint(sleeve);
      Gfx.circle(ctx, 8, 8, 4.1);
      paint(sleeve);
    } else {
      Gfx.circle(ctx, -sw * 6 + 1, -12, 4.2);
      paint(sleeve);
      Gfx.circle(ctx, sw * 6 + 1, 12, 4.2);
      paint(sleeve);
    }
    Gfx.ellipse(ctx, 0, 0, 8.5, 12.5);
    paint(o.body || '#777');
    if (o.trim) {
      ctx.fillStyle = o.trim;
      ctx.fillRect(-1.5, -10, 3, 20);
    }
    const skin = o.skin || '#e0b896';
    ctx.fillStyle = skin;
    if (armsFwd) {
      Gfx.circle(ctx, 12.5, -5, 2.7);
      ctx.fill();
      Gfx.circle(ctx, 12.5, 5, 2.7);
      ctx.fill();
    } else {
      Gfx.circle(ctx, -sw * 6 + 4.5, -12.5, 2.6);
      ctx.fill();
      Gfx.circle(ctx, sw * 6 + 4.5, 12.5, 2.6);
      ctx.fill();
    }
    if (o.gun) {
      ctx.fillStyle = '#17171a';
      ctx.fillRect(12, -1.8, o.gun === 'tommy' ? 17 : 10, 3.6);
      if (o.gun === 'tommy') {
        Gfx.circle(ctx, 18, 0, 3.6);
        ctx.fill();
      }
    }

    // head
    Gfx.circle(ctx, 1, 0, 7.2);
    paint(skin);
    if (o.hairStyle === 'long' && o.hair) {
      Gfx.ellipse(ctx, -5, 0, 7, 8.5);
      paint(o.hair);
    }
    if (o.hat) {
      const brim = o.hatBrim || o.hat;
      if (o.hatStyle === 'cap') {
        Gfx.circle(ctx, 0.5, 0, 7.8);
        paint(brim);
        Gfx.ellipse(ctx, 7.5, 0, 3.6, 6.2);
        paint(brim);
      } else {
        Gfx.circle(ctx, 0, 0, 10.5);
        paint(brim);
        Gfx.circle(ctx, 0, 0, 6.8);
        paint(o.hat);
      }
    } else if (o.hair && o.hairStyle !== 'bald') {
      ctx.beginPath();
      ctx.arc(0.5, 0, 7.6, Math.PI * 0.36, Math.PI * 1.64);
      ctx.closePath();
      ctx.fillStyle = o.hair;
      ctx.fill();
    }
    if (o.glasses) {
      ctx.strokeStyle = 'rgba(20,20,20,0.85)';
      ctx.lineWidth = 1.2;
      Gfx.line(ctx, 7.6, -4, 7.6, 4);
    }
    if (o.mark) Gfx.hydrogen(ctx, 1, 0, 3.4, o.mark, o.markT || 0, 0.9);
    if (o.flash) {
      ctx.fillStyle = `rgba(255,255,255,${o.flash})`;
      Gfx.ellipse(ctx, 0, 0, 9, 13);
      ctx.fill();
      Gfx.circle(ctx, 1, 0, 7.6);
      ctx.fill();
    }
    ctx.restore();
  };

  Gfx.MANHATTAN_LOOK = { skin: '#8fe1ff', body: '#55c6f4', sleeve: '#55c6f4', legs: '#3aa6dc', hair: null, ink: '#0b3558' };

  Gfx.manhattan = (ctx, o) => {
    const s = (o.scale || 1) * (o.size || 1);
    const a = o.alpha == null ? 1 : o.alpha;
    const pulse = 0.85 + Math.sin((o.t || 0) * 2.2) * 0.08;
    Gfx.glow(ctx, o.x, o.y, 54 * s, '#2fa8ff', 0.4 * a * pulse);
    Gfx.figure(ctx, Object.assign({}, Gfx.MANHATTAN_LOOK, o, { mark: '#eafcff', markT: (o.t || 0) * 1.4 }));
    Gfx.glow(ctx, o.x, o.y, 22 * s, '#bff1ff', 0.18 * a);
  };

  // Jon as pure awareness: a lone hydrogen atom.
  Gfx.awareness = (ctx, x, y, t, s = 1, alpha = 1) => {
    Gfx.glow(ctx, x, y, 46 * s, '#2fa8ff', 0.75 * alpha);
    Gfx.glow(ctx, x, y, 14 * s, '#eefbff', 0.9 * alpha);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.rotate(t * 0.7);
    ctx.strokeStyle = 'rgba(210,246,255,0.85)';
    ctx.lineWidth = 1.5;
    Gfx.ellipse(ctx, 0, 0, 17 * s, 6.5 * s);
    ctx.stroke();
    const ea = t * 4.2;
    ctx.fillStyle = '#ffffff';
    Gfx.circle(ctx, Math.cos(ea) * 17 * s, Math.sin(ea) * 6.5 * s, 2.6 * s);
    ctx.fill();
    Gfx.circle(ctx, 0, 0, 3.8 * s);
    ctx.fill();
    ctx.restore();
  };

  // ---- portraits (front view, for dialogue) --------------------------------
  Gfx.portrait = (ctx, x, y, size, look, t = 0, talking = false) => {
    const s = size / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.rect(0, 0, 100, 100);
    ctx.clip();
    ctx.fillStyle = look.bg || '#2a3340';
    ctx.fillRect(0, 0, 100, 100);
    // halftone dots for a printed-comic feel
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let yy = 4; yy < 100; yy += 8) for (let xx = (yy / 8) % 2 ? 4 : 0; xx < 100; xx += 8) {
      Gfx.circle(ctx, xx, yy, 1.3);
      ctx.fill();
    }
    if (look.manhattan) Gfx.glow(ctx, 50, 52, 80, '#2fa8ff', 0.7);

    if (look.cape) {
      ctx.fillStyle = look.cape;
      Gfx.ellipse(ctx, 50, 112, 52, 34);
      ctx.fill();
    }
    ctx.fillStyle = look.body || '#666';
    Gfx.ellipse(ctx, 50, 110, 44, 32);
    ctx.fill();
    if (look.collar) {
      ctx.fillStyle = look.collar;
      ctx.beginPath();
      ctx.moveTo(38, 80); ctx.lineTo(50, 96); ctx.lineTo(62, 80); ctx.lineTo(56, 80); ctx.lineTo(50, 88); ctx.lineTo(44, 80);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = U.mix(look.skin, '#000000', 0.18);
    ctx.fillRect(43, 64, 14, 18);
    if (look.hairStyle === 'long') {
      ctx.fillStyle = look.hair;
      Gfx.ellipse(ctx, 50, 56, 28, 36);
      ctx.fill();
    }
    ctx.fillStyle = look.skin;
    Gfx.ellipse(ctx, 50, 48, 20, 25);
    ctx.fill();
    Gfx.ellipse(ctx, 30.5, 50, 3.5, 6);
    ctx.fill();
    Gfx.ellipse(ctx, 69.5, 50, 3.5, 6);
    ctx.fill();

    const style = look.hairStyle || 'short';
    if (look.hair && style !== 'bald') {
      ctx.fillStyle = look.hair;
      if (style === 'long') {
        Gfx.ellipse(ctx, 50, 32, 22, 13);
        ctx.fill();
        ctx.fillRect(28, 32, 7, 34);
        ctx.fillRect(65, 32, 7, 34);
      } else if (style === 'slick') {
        Gfx.ellipse(ctx, 50, 30, 21, 11);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(29, 36); ctx.quadraticCurveTo(45, 18, 72, 30); ctx.lineTo(70, 38); ctx.quadraticCurveTo(52, 28, 31, 42);
        ctx.fill();
      } else if (style === 'thin') {
        ctx.beginPath();
        ctx.moveTo(30, 44); ctx.quadraticCurveTo(30, 26, 40, 27); ctx.lineTo(36, 46);
        ctx.moveTo(70, 44); ctx.quadraticCurveTo(70, 26, 60, 27); ctx.lineTo(64, 46);
        ctx.fill();
      } else {
        Gfx.ellipse(ctx, 50, 31, 21, 12);
        ctx.fill();
        ctx.fillRect(29, 31, 5, 13);
        ctx.fillRect(66, 31, 5, 13);
      }
    }
    if (look.hat) {
      ctx.fillStyle = look.hat;
      if (look.hatStyle === 'cap') {
        Gfx.ellipse(ctx, 50, 27, 25, 11);
        ctx.fill();
        ctx.fillStyle = look.hatBrim || '#111';
        Gfx.ellipse(ctx, 50, 34, 27, 5);
        ctx.fill();
        if (look.badge) {
          ctx.fillStyle = look.badge;
          Gfx.circle(ctx, 50, 26, 4);
          ctx.fill();
        }
      } else {
        Gfx.ellipse(ctx, 50, 31, 36, 7);
        ctx.fill();
        Gfx.rr(ctx, 32, 10, 36, 22, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(32, 24, 36, 5);
      }
    }

    // face
    if (look.manhattan) {
      ctx.fillStyle = '#ffffff';
      Gfx.ellipse(ctx, 42, 49, 4.2, 2.6);
      ctx.fill();
      Gfx.ellipse(ctx, 58, 49, 4.2, 2.6);
      ctx.fill();
      Gfx.glow(ctx, 42, 49, 9, '#bff1ff', 0.7);
      Gfx.glow(ctx, 58, 49, 9, '#bff1ff', 0.7);
    } else {
      ctx.fillStyle = '#1b1612';
      Gfx.ellipse(ctx, 42, 49, 2.3, 2.6);
      ctx.fill();
      Gfx.ellipse(ctx, 58, 49, 2.3, 2.6);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,20,15,0.75)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    Gfx.line(ctx, 37, 42, 46, 41);
    Gfx.line(ctx, 54, 41, 63, 42);
    ctx.lineWidth = 1.6;
    Gfx.line(ctx, 50, 50, 48, 57);
    Gfx.line(ctx, 48, 57, 51, 58);
    const open = talking ? (Math.sin(t * 22) * 0.5 + 0.5) * 4 : 0;
    ctx.fillStyle = 'rgba(60,20,20,0.8)';
    if (open > 0.6) {
      Gfx.ellipse(ctx, 50, 64, 5, open / 2 + 0.5);
      ctx.fill();
    } else Gfx.line(ctx, 45, 64, 55, 64);
    if (look.glasses) {
      ctx.strokeStyle = '#1b1612';
      ctx.lineWidth = 1.8;
      Gfx.circle(ctx, 42, 49, 6.5);
      ctx.stroke();
      Gfx.circle(ctx, 58, 49, 6.5);
      ctx.stroke();
      Gfx.line(ctx, 48.5, 49, 51.5, 49);
    }
    if (look.moustache) {
      ctx.fillStyle = look.hair || '#222';
      Gfx.ellipse(ctx, 50, 60, 8, 2.4);
      ctx.fill();
    }
    if (look.manhattan) Gfx.hydrogen(ctx, 50, 33, 6.5, '#e8fbff', t * 0.8, 1.5);
    ctx.restore();
    ctx.strokeStyle = DM.C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
  };

  // ---- power icons -------------------------------------------------------
  Gfx.icon = (ctx, id, x, y, size, color, t = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 40, size / 40);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    switch (id) {
      case 'telekinesis':
        Gfx.circle(ctx, 0, 0, 4.5);
        ctx.fill();
        for (let i = 1; i <= 2; i++) {
          const r = 6 + i * 6 + Math.sin(t * 3 + i) * 0.8;
          ctx.beginPath(); ctx.arc(0, 0, r, -0.65, 0.65); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, r, Math.PI - 0.65, Math.PI + 0.65); ctx.stroke();
        }
        break;
      case 'disintegrate':
        ctx.setLineDash([3, 3]);
        Gfx.circle(ctx, -3, 2, 7);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 9; i++) {
          const a = -1.2 + i * 0.32;
          const r = 10 + (i % 3) * 3.5;
          Gfx.circle(ctx, -3 + Math.cos(a) * r, 2 + Math.sin(a) * r, 2.4 - (i % 3) * 0.6);
          ctx.fill();
        }
        break;
      case 'teleport':
        ctx.setLineDash([2.5, 3]);
        Gfx.circle(ctx, -9, 6, 6);
        ctx.stroke();
        ctx.setLineDash([]);
        Gfx.circle(ctx, 9, -6, 6);
        ctx.fill();
        Gfx.line(ctx, -3, 2, 3, -2);
        Gfx.line(ctx, 3, -2, -1, -3);
        Gfx.line(ctx, 3, -2, 2, 2);
        break;
      case 'duplicate':
        for (const [dx, dy, a] of [[-11, 3, 0.5], [11, 3, 0.5], [0, -2, 1]]) {
          ctx.globalAlpha = a;
          Gfx.circle(ctx, dx, dy - 6, 4.5);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx, dy + 9, 8, Math.PI, 0);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      case 'timesight':
        Gfx.circle(ctx, 0, 0, 15);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          Gfx.line(ctx, Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(a) * 14, Math.sin(a) * 14);
        }
        Gfx.line(ctx, 0, 0, Math.cos(t * 2 - 1.57) * 10, Math.sin(t * 2 - 1.57) * 10);
        Gfx.line(ctx, 0, 0, 6, 3);
        break;
      case 'expand':
        ctx.strokeRect(-5, -5, 10, 10);
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          Gfx.line(ctx, sx * 8, sy * 8, sx * 15, sy * 15);
          Gfx.line(ctx, sx * 15, sy * 15, sx * 10, sy * 15);
          Gfx.line(ctx, sx * 15, sy * 15, sx * 15, sy * 10);
        }
        break;
      case 'coalesce':
        Gfx.circle(ctx, 0, 0, 4);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + t * 0.5;
          const r = 13 + Math.sin(t * 3 + i) * 2;
          Gfx.circle(ctx, Math.cos(a) * r, Math.sin(a) * r, 2);
          ctx.fill();
        }
        break;
      default:
        Gfx.circle(ctx, 0, 0, 12);
        ctx.stroke();
    }
    ctx.restore();
  };

  // ---- screen effects -----------------------------------------------------
  let vignetteCanvas = null;
  Gfx.vignette = (ctx, alpha = 1) => {
    if (!vignetteCanvas) {
      vignetteCanvas = document.createElement('canvas');
      vignetteCanvas.width = DM.W / 2;
      vignetteCanvas.height = DM.H / 2;
      const g = vignetteCanvas.getContext('2d');
      const grad = g.createRadialGradient(DM.W / 4, DM.H / 4, DM.H * 0.18, DM.W / 4, DM.H / 4, DM.W * 0.42);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.72)');
      g.fillStyle = grad;
      g.fillRect(0, 0, DM.W / 2, DM.H / 2);
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(vignetteCanvas, 0, 0, DM.W, DM.H);
    ctx.restore();
  };

  let grainPattern = null;
  Gfx.grain = (ctx, alpha = 0.05) => {
    if (!grainPattern) {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const g = c.getContext('2d');
      const img = g.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainPattern = ctx.createPattern(c, 'repeat');
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grainPattern;
    const ox = (Math.random() * 160) | 0, oy = (Math.random() * 160) | 0;
    ctx.translate(-ox, -oy);
    ctx.fillRect(0, 0, DM.W + 160, DM.H + 160);
    ctx.restore();
  };

  // Seeded starfield
  Gfx.makeStars = (seed, n, w, h) => {
    const rnd = U.seeded(seed);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: rnd() * w, y: rnd() * h, r: rnd() * 1.4 + 0.2, a: rnd() * 0.7 + 0.2, tw: rnd() * TAU });
    return out;
  };

  DM.Gfx = Gfx;
})();
