/*
 * Atmosphere & frame test: the pre-composited post effects, the glow sprite
 * cache, quality settings and the frame governor; the light layer and its
 * emissive pass; weather; walls with depth; Temporal Sight's colour grade.
 * Screenshots of every map go to tests/out/visual/.
 *
 *   node tests/visual.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || path.join(root, 'index.html');
const url = pathToFileURL(target).href + '?dev';
const outDir = path.join(root, 'tests', 'out', 'visual');
fs.mkdirSync(outDir, { recursive: true });

const errors = [];
const browser = await playwright.chromium.launch();
async function openPage(dpr = 1) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.DM && window.DM.dev);
  await page.mouse.click(640, 360);
  // Keep the resolution fixed: the governor would react to this machine's load.
  await page.evaluate(() => { window.DM.Engine.governor.enabled = false; });
  return page;
}
const page = await openPage();
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = (name) => page.screenshot({ path: path.join(outDir, name + '.png') });

let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

// Start a chapter at a stage id, then close dialogue and overlays so the map is in view.
async function start(ch, id, ms = 2500) {
  await ev(([ch, id]) => {
    const DM = window.DM;
    DM.dev.start(ch, Math.max(0, DM.Chapters.get(ch).stages.findIndex((s) => s.id === id)));
  }, [ch, id]);
  await wait(ms);
  await clear();
}
const clear = () => ev(() => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play();
  while (E.top() !== play && E.stack.length > 1) {
    const t = E.top();
    E.pop();
    if (t.onClose) t.onClose();
  }
  if (play.dialog.active) {
    play.dialog.active = false;
    play.dialog.queue = [];
  }
});
const place = (x, y) => ev(([x, y]) => {
  const play = window.DM.dev.play();
  play.player.x = x;
  play.player.y = y;
  play.player.godMode = true;
  play.world.camera.snap(x, y);
}, [x, y]);

// ---- 1. Cheaper frames ---------------------------------------------------------------
await start('mars', 'palace', 3000);
const pfx = await ev(() => {
  const DM = window.DM, E = DM.Engine, S = DM.Gfx.postFxState;
  E.render();
  const b0 = S.builds;
  for (let i = 0; i < 60; i++) E.render();
  const f = S.frames;
  return { builds: S.builds - b0, n: f.length, w: f[0] && f[0].width, h: f[0] && f[0].height, cw: E.canvas.width, ch: E.canvas.height };
});
assert('post effects are three pre-composited frames at device size', pfx.n === 3 && pfx.w === pfx.cw && pfx.h === pfx.ch, JSON.stringify(pfx));
assert('post effect frames are built once, not per frame', pfx.builds === 0, `${pfx.builds} rebuilds in 60 frames`);

const grainOff = await ev(() => {
  const DM = window.DM, E = DM.Engine;
  DM.SettingsSchema.set('grain', false);
  E.render();
  const n = DM.Gfx.postFxState.frames.length;
  DM.SettingsSchema.set('grain', true);
  E.render();
  return { off: n, on: DM.Gfx.postFxState.frames.length, saved: JSON.parse(localStorage.getItem('dr-manhattan.save') || '{}').settings };
});
assert('FILM GRAIN off leaves the vignette only, and is saved', grainOff.off === 1 && grainOff.on === 3 && grainOff.saved && grainOff.saved.grain === true, JSON.stringify({ off: grainOff.off, on: grainOff.on }));

// Interleaved timing: drawing the post effects vs not drawing them at all.
async function postFxCost(p) {
  return p.evaluate(() => {
    const DM = window.DM, E = DM.Engine, G = DM.Gfx;
    const play = DM.dev.play();
    const pf = G.postFx;
    const block = (n = 20) => {
      let s = 0;
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        play.update(1 / 60);
        E.render();
        E.ctx.getImageData(0, 0, 1, 1);
        DM.Input.endFrame();
        s += performance.now() - t0;
      }
      return s / n;
    };
    const on = [], off = [];
    for (let r = 0; r < 6; r++) {
      G.postFx = pf;
      block(3);
      on.push(block());
      G.postFx = () => {};
      block(3);
      off.push(block());
    }
    G.postFx = pf;
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return (s[2] + s[3]) / 2; };
    return { on: +med(on).toFixed(2), off: +med(off).toFixed(2) };
  });
}
const within = (c) => c.on <= c.off * 1.15 || c.on - c.off <= 1;
let c1 = await postFxCost(page);
if (!within(c1)) c1 = await postFxCost(page); // timing on a shared machine: measure again before failing
assert('pre-composited post effects cost within 15% of none (DPR 1)', within(c1), `${c1.on} vs ${c1.off} ms/frame`);
{
  const p2 = await openPage(2);
  await p2.evaluate(() => window.DM.dev.start('mars', 1));
  await p2.waitForTimeout(3000);
  let c2 = await postFxCost(p2);
  if (!within(c2)) c2 = await postFxCost(p2);
  assert('pre-composited post effects cost within 15% of none (DPR 2)', within(c2), `${c2.on} vs ${c2.off} ms/frame`);
  await p2.close();
}

// Glow sprites: at most two canvases per colour, however the radius animates.
await ev(() => {
  const orig = document.createElement.bind(document);
  window.__canvases = 0;
  document.createElement = (tag, ...a) => {
    if (String(tag).toLowerCase() === 'canvas') window.__canvases++;
    return orig(tag, ...a);
  };
  const G = window.DM.Gfx, gs = G.glowSprite;
  window.__colours = new Set();
  G.glowSprite = (c, r) => (window.__colours.add(c), gs(c, r));
});
const glowRun = (label, fn) => ev(([label, src]) => {
  const DM = window.DM;
  const c0 = window.__canvases, g0 = DM.Gfx.glowStats.created;
  window.__colours.clear();
  new Function(src)();
  return { label, canvases: window.__canvases - c0, glows: DM.Gfx.glowStats.created - g0, colours: window.__colours.size };
}, [label, `(${fn})()`]);
const rise = await glowRun('palace rise', () => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play();
  const pal = play.world.entities.find((e) => e.constructor.name === 'Palace');
  play.player.x = pal.x; play.player.y = pal.y + 200; play.world.camera.snap(pal.x, pal.y);
  pal.rise = 0; pal.risingT = 4;
  for (let i = 0; i < 240; i++) { play.world.update(1 / 60); E.render(); }
});
const card = await glowRun('unlock card', () => {
  const DM = window.DM, E = DM.Engine;
  E.push(new DM.Scenes.PowerUnlock('teleport', () => {}));
  for (let i = 0; i < 60; i++) { E.top().update(1 / 60); E.render(); }
  E.pop();
});
const expand = await glowRun('expand', () => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play();
  play.player.targetScale = 2.2; play.player.expandT = 3;
  for (let i = 0; i < 120; i++) { play.world.update(1 / 60); E.render(); }
});
for (const r of [rise, card, expand]) assert(`glow cache: ${r.label} creates at most 2 canvases per colour`, r.glows <= 2 * r.colours && r.canvases <= 2 * r.colours + 2, `${r.canvases} canvases, ${r.glows} glow sprites, ${r.colours} colours`);

// Quality: render scale 1 / 0.75 / 0.5.
const q = await ev(() => {
  const DM = window.DM, E = DM.Engine, S = DM.SettingsSchema;
  const out = {};
  for (const v of ['balanced', 'low', 'high']) {
    S.set('quality', v);
    out[v] = { w: E.canvas.width, dpr: +E.dpr.toFixed(3) };
  }
  return out;
});
assert('QUALITY sets the render scale (1 / 0.75 / 0.5)', q.high.w === 1280 && q.balanced.w === 960 && q.low.w === 640, JSON.stringify(q));

// Frame governor: a sustained slow frame gap drops one tier for this session and says so.
const gov = await ev(() => {
  const DM = window.DM, E = DM.Engine, g = E.governor;
  g.enabled = true;
  g.grace = 0;
  g.slow = 0;
  E.stats.gapMs = 33.3;
  // A display capped at 30 fps with light work is not slow: no drop.
  E.stats.updMs = 2;
  E.stats.renderMs = 1.5;
  for (let i = 0; i < 300; i++) E.measure(33.3);
  const capped = E.qualityTier();
  // Real overload: the game's own work fills most of each 40 ms frame.
  E.stats.updMs = 8;
  E.stats.renderMs = 14;
  E.stats.gapMs = 16.7;
  g.slow = 0;
  for (let i = 0; i < 40; i++) E.measure(40); // 1.6 s of 40 ms frames: not yet
  const before = E.qualityTier();
  for (let i = 0; i < 30; i++) E.measure(40);
  const after = E.qualityTier();
  const width = E.canvas.width;
  const play = DM.dev.play();
  E.render();
  const toast = play.hud.toasts.some((t) => /QUALITY LOWERED/.test(t.text));
  const saved = DM.Save.settings.quality;
  for (let i = 0; i < 200; i++) E.measure(1000); // a tab switch is ignored
  const ignored = E.qualityTier();
  // Choosing a QUALITY in Settings replaces the automatic drop.
  DM.SettingsSchema.set('quality', 'high');
  const chosen = E.qualityTier();
  g.enabled = false;
  g.drop = 0;
  E.resize();
  return { capped, before, after, width, toast, saved, ignored, chosen };
});
assert('a 30 fps cap with light work keeps HIGH quality', gov.capped === 'high', JSON.stringify(gov));
assert('frame governor drops one tier after 2 s above 22 ms', gov.before === 'high' && gov.after === 'balanced' && gov.width === 960, JSON.stringify(gov));
assert('choosing QUALITY in Settings overrides the automatic drop', gov.chosen === 'high', gov.chosen);
assert('governor shows a toast and keeps the saved setting', gov.toast && gov.saved === 'high' && gov.ignored === 'balanced');

const dbg = await ev(() => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play();
  play.debug = true;
  E.render();
  play.debug = false;
  const s = E.stats;
  return { ok: [s.updMs, s.renderMs, s.gapMs].every(Number.isFinite), err: DM.dev.state().error };
});
assert('Engine.stats {updMs, renderMs, gapMs} feed the debug overlay', dbg.ok && !dbg.err, dbg.err || '');

// ---- 2. Lighting -------------------------------------------------------------------------
await start('superman', 'yard', 3000);
await place(560, 760);
await wait(300);
await shot('pier');
// The darkness mask alone (each light's colour wash also adds alpha).
const pier = await ev(() => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play(), w = play.world;
  DM.Lighting.colour = false;
  E.render();
  DM.Lighting.colour = true;
  const { dark } = DM.Lighting.layers();
  const g = dark.getContext('2d', { willReadFrequently: true });
  const k = dark.width / DM.W;
  const a = (wx, wy) => {
    const s = w.camera.toScreen(wx, wy);
    return g.getImageData(Math.round(s.x * k), Math.round(s.y * k), 1, 1).data[3] / 255;
  };
  // The darkest point of the view should still be close to the ambient (0.76).
  const v = w.camera.view();
  let darkest = 0;
  for (let x = v.x0 + 20; x < v.x1; x += 40) for (let y = v.y0 + 20; y < v.y1; y += 40) darkest = Math.max(darkest, a(x, y));
  return { mapId: w.mapId, lit: w.lit, lighting: w.lighting, jon: a(560, 760), lamp: a(620, 560), dark: darkest, lights: DM.Lighting.stats.lights };
});
assert('loadMap sets world.mapId', pier.mapId === 'pier', pier.mapId);
assert('the night pier is lit: darkness with light pools', pier.lighting && pier.lit && pier.dark > 0.5, JSON.stringify(pier));
assert('Jon and the sodium lamps light their surroundings', pier.jon < 0.15 && pier.lamp < 0.3, `jon ${pier.jon.toFixed(2)}, lamp ${pier.lamp.toFixed(2)}, unlit ${pier.dark.toFixed(2)}`);

const torch = await ev(() => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play(), w = play.world;
  const gx = 1150, gy = 1000;
  const g1 = w.add(new DM.Enemies.Gangster({ x: gx, y: gy, facing: 0 }));
  g1.update = () => {};
  const prof = w.atmosphere.light, lamps = prof.lights;
  prof.lights = null; // only this man's lights
  DM.Lighting.colour = false;
  const px = play.player.x, py = play.player.y;
  play.player.x = 300; play.player.y = 1000;
  w.camera.snap(gx, gy);
  const { dark } = DM.Lighting.layers();
  const g = dark.getContext('2d', { willReadFrequently: true });
  const k = dark.width / DM.W;
  const a = (wx, wy) => {
    const s = w.camera.toScreen(wx, wy);
    return g.getImageData(Math.round(s.x * k), Math.round(s.y * k), 1, 1).data[3] / 255;
  };
  E.render();
  const facing = a(gx + 170, gy);
  g1.facing = Math.PI;
  E.render();
  const away = a(gx + 170, gy);
  g1.dead = true;
  prof.lights = lamps;
  DM.Lighting.colour = true;
  play.player.x = px; play.player.y = py;
  w.camera.snap(px, py);
  return { facing: +facing.toFixed(2), away: +away.toFixed(2) };
});
assert('an armed man\'s flashlight lights the way he faces', torch.facing < torch.away - 0.15, JSON.stringify(torch));

// renderEmissive runs after the light layer, with world.lit set during render().
async function emissiveProbe() {
  return ev(() => {
    const DM = window.DM, E = DM.Engine, play = DM.dev.play(), w = play.world;
    const log = [];
    const L = DM.Lighting.render;
    DM.Lighting.render = (...a) => (log.push('light'), L(...a));
    w.camera.snap(play.player.x, play.player.y);
    const probe = w.add(new DM.Entity({ x: play.player.x + 40, y: play.player.y, body: false, solid: false }));
    probe.render = (ctx, world) => log.push('render:' + world.lit);
    probe.renderEmissive = () => log.push('emissive');
    E.render();
    DM.Lighting.render = L;
    probe.dead = true;
    return log;
  });
}
const lit = await emissiveProbe();
assert('lit map: render() sees world.lit, renderEmissive follows the light layer', lit.join() === 'render:true,light,emissive', lit.join());

// Package A's combat feedback draws after Temporal Sight and before the post effects.
const order = await ev(() => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play();
  const log = [];
  const had = DM.Feedback;
  DM.Feedback = { render: (ctx, scene) => log.push(scene === play ? 'feedback' : 'feedback?') };
  const ts = play.renderTimesight, pf = DM.Gfx.postFx;
  play.renderTimesight = function (ctx) { log.push('timesight'); return ts.call(this, ctx); };
  DM.Gfx.postFx = (...a) => (log.push('postFx'), pf(...a));
  E.render();
  delete play.renderTimesight;
  DM.Gfx.postFx = pf;
  if (had) DM.Feedback = had;
  else delete DM.Feedback;
  return log;
});
assert('Play.render: Temporal Sight, then DM.Feedback.render(ctx, scene), then post effects', order.join() === 'timesight,feedback,postFx', order.join());

// Play.render CPU with ~40 lights vs without the light layer.
const lightCpu = () => ev(() => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play(), w = play.world, ctx = E.ctx;
  play.player.x = 560; play.player.y = 760; w.camera.snap(560, 760);
  const shots = [];
  for (let i = 0; i < 24; i++) shots.push(w.add(new DM.Proj.Bullet({ x: 380 + i * 32, y: 600 + (i % 3) * 70, vx: 0.01, vy: 0, team: 'enemy', dmg: 0 })));
  const L = DM.Lighting.render;
  const T = (n = 30) => {
    const a = [];
    for (let i = 0; i < n; i++) {
      ctx.save();
      const t0 = performance.now();
      play.render(ctx);
      a.push(performance.now() - t0);
      ctx.restore();
      ctx.getImageData(0, 0, 1, 1);
    }
    a.sort((x, y) => x - y);
    return a[n >> 1];
  };
  const on = [], off = [];
  for (let r = 0; r < 6; r++) {
    DM.Lighting.render = L; T(4); on.push(T());
    DM.Lighting.render = () => false; T(4); off.push(T());
  }
  DM.Lighting.render = L;
  play.render(ctx);
  const n = DM.Lighting.collect(w, w.atmosphere);
  for (const s of shots) s.dead = true;
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return (s[2] + s[3]) / 2; };
  return { on: +med(on).toFixed(2), off: +med(off).toFixed(2), lights: n, drawn: DM.Lighting.stats.lights };
});
let cpu = await lightCpu();
if (cpu.on - cpu.off > 2) cpu = await lightCpu(); // shared machine: measure again before failing
assert('the light layer adds at most 2 ms of Play.render CPU with ~40 lights', cpu.on - cpu.off <= 2, `${cpu.on} vs ${cpu.off} ms, ${cpu.lights} lights (${cpu.drawn} on screen)`);

await start('superman', 'range', 4000);
await place(600, 500);
const day = await emissiveProbe();
const dayLit = await ev(() => window.DM.dev.play().world.lighting);
assert('daylight map: no light layer, entities draw their own emissive', !dayLit && day.join() === 'render:false', day.join());

// The prologue alarm: rotating red beacons replace the full-screen tint.
await start('prologue', 'accident', 2500);
await ev(() => { window.DM.dev.play().ctx.flags.lockdown = true; });
await wait(2500);
await clear();
await shot('gila-alarm');
const alarm = await ev(() => {
  const DM = window.DM, E = DM.Engine, play = DM.dev.play(), w = play.world;
  const tint = w.tint;
  w.tint = 'rgba(0,255,0,1)'; // would paint the whole screen green
  E.render();
  const px = E.ctx.getImageData(E.canvas.width >> 1, E.canvas.height >> 1, 1, 1).data;
  w.tint = tint;
  const prof = DM.Atmosphere.get('gila');
  const cones = (t) => {
    const out = [];
    const rt = w.realTime;
    w.realTime = t;
    prof.light.lights(w, (x, y, r, o) => o && o.cone != null && o.color === '#ff2a1a' && out.push(o.cone), t);
    w.realTime = rt;
    return out;
  };
  const spin = () => (cones(10.1)[0] - cones(10)[0]) / 0.1;
  const full = spin();
  DM.SettingsSchema.set('flashing', 'reduced');
  const reduced = spin();
  DM.SettingsSchema.set('flashing', 'full');
  return { alarm: !!w.alarm, lighting: w.lighting, green: px[1] > 200 && px[0] < 80, beacons: cones(10).length, full: +full.toFixed(2), reduced: +reduced.toFixed(2) };
});
assert('alarm: the light layer carries it, the full-screen tint is not drawn', alarm.alarm && alarm.lighting && !alarm.green, JSON.stringify(alarm));
assert('alarm: rotating red beacon cones; REDUCED flashing slows them', alarm.beacons >= 4 && alarm.full > 2 && alarm.reduced < 1, `${alarm.beacons} cones, ${alarm.full} vs ${alarm.reduced} rad/s`);

// REDUCED flashing: no lamp flicker, no studio flashbulbs.
const steady = await ev(() => {
  const DM = window.DM, w = DM.dev.play().world;
  const studio = DM.Atmosphere.get('studio');
  const fake = { realTime: 0, entities: [new DM.NPC({ x: 600, y: 500, look: 'reporter' })], atmo: null, player: null };
  const count = () => {
    let bulbs = 0;
    fake.atmo = null;
    for (let i = 0; i < 600; i++) {
      const t = i / 30;
      fake.realTime = t;
      studio.light.lights(fake, (x, y, r, o) => { if (o && o.color === '#ffffff') bulbs++; }, t);
    }
    return bulbs;
  };
  const full = count();
  DM.SettingsSchema.set('flashing', 'reduced');
  const reduced = count();
  DM.SettingsSchema.set('flashing', 'full');
  return { full, reduced };
});
assert('studio flashbulbs pop, and never with REDUCED flashing', steady.full > 0 && steady.reduced === 0, JSON.stringify(steady));

// ---- 3. Weather ------------------------------------------------------------------------
const MAPS = [['prologue', 'lunch', 'gila'], ['reassembly', 'gather', 'void'], ['superman', 'range', 'range'], ['superman', 'yard', 'pier'], ['deterrent', 'waves1', 'proving'], ['mars', 'studio', 'studio'], ['mars', 'palace', 'mars'], ['karnak', 'emitters', 'karnak']];
const motion = [];
for (const [ch, id, map] of MAPS) {
  await start(ch, id, 1500);
  // Up to three windows: an unlock card or pause opening mid-window freezes the
  // world (and its weather) for reasons that have nothing to do with weather.
  let r;
  for (let attempt = 0; attempt < 3 && !(r && r.diff >= 40); attempt++) {
  if (attempt) await clear();
  r = await ev(async () => {
    const DM = window.DM, play = DM.dev.play(), w = play.world;
    const grab = () => {
      const c = document.createElement('canvas');
      c.width = DM.W;
      c.height = DM.H;
      DM.Weather.render(c.getContext('2d'), w, w.atmosphere);
      return c.getContext('2d').getImageData(0, 0, DM.W, DM.H).data;
    };
    const a = grab();
    await new Promise((res) => setTimeout(res, 500));
    const b = grab();
    let diff = 0;
    for (let i = 3; i < a.length; i += 16) if (Math.abs(a[i] - b[i]) > 8) diff++;
    return { map: w.mapId, diff, particles: DM.Weather.stats.particles, top: DM.Engine.top().constructor.name };
  });
  }
  motion.push(r);
  await ev(() => window.DM.Engine.render());
  await shot('map-' + map);
}
const still = motion.filter((m) => m.diff < 40);
assert('every map has ambient motion between frames 0.5 s apart', !still.length, motion.map((m) => `${m.map} ${m.diff}${m.diff < 40 ? ' (' + m.top + ')' : ''}`).join(', '));

await start('reassembly', 'gather', 1500);
const par = await ev(() => {
  const DM = window.DM, w = DM.dev.play().world;
  const grab = () => {
    const c = document.createElement('canvas');
    c.width = DM.W;
    c.height = DM.H;
    DM.Weather.render(c.getContext('2d'), w, w.atmosphere);
    return c.getContext('2d').getImageData(0, 0, DM.W, DM.H).data;
  };
  w.camera.ox = w.camera.oy = 0;
  const a = grab();
  const a2 = grab();
  w.camera.x += 120;
  const b = grab();
  let same = 0, moved = 0;
  for (let i = 3; i < a.length; i += 4) {
    if (a[i] !== a2[i]) same++;
    if (a[i] !== b[i]) moved++;
  }
  w.camera.x -= 120;
  return { unchanged: same, moved, layers: w.weatherState.layers.map((l) => l.type) };
});
assert('void stars parallax when the camera moves', par.unchanged === 0 && par.moved > 200 && par.layers.includes('stars'), JSON.stringify(par));

const fx = await ev(() => {
  const DM = window.DM, w = DM.dev.play().world, S = DM.SettingsSchema;
  const n = () => DM.Weather.state(w, w.atmosphere).layers.reduce((s, l) => s + (l.ps ? l.ps.length : l.layers ? l.layers.reduce((q, y) => q + y.s.length, 0) : 0), 0);
  const full = n();
  S.set('fx', 'reduced');
  const reduced = n();
  S.set('fx', 'off');
  const off = DM.Weather.state(w, w.atmosphere).layers.length;
  const drew = DM.Weather.render(document.createElement('canvas').getContext('2d'), w, w.atmosphere);
  S.set('fx', 'full');
  return { full, reduced, off, drew };
});
assert('AMBIENT EFFECTS: reduced halves the particles, off removes the layer', fx.reduced <= Math.ceil(fx.full / 2) + 3 && fx.off === 0 && fx.drew === false, JSON.stringify(fx));

await start('karnak', 'emitters', 4000);
await place(600, 900);
const slow = await ev(() => {
  const DM = window.DM, play = DM.dev.play(), w = play.world;
  const c = document.createElement('canvas').getContext('2d');
  const dist = (slowmo) => {
    w.slowmo = slowmo;
    for (let i = 0; i < 40; i++) { w.slowmo = slowmo; w.update(1 / 60); } // (the Sight power resets slowmo each update)
    DM.Weather.render(c, w, w.atmosphere);
    const L = w.weatherState.layers.find((l) => l.type === 'snow');
    const before = L.ps.map((p) => p.y);
    const cam = [w.camera.x, w.camera.y];
    for (let i = 0; i < 30; i++) { // one weather frame per update, as in play
      w.slowmo = slowmo;
      w.update(1 / 60);
      w.camera.x = cam[0];
      w.camera.y = cam[1];
      DM.Weather.render(c, w, w.atmosphere);
    }
    let s = 0;
    L.ps.forEach((p, i) => (s += Math.abs(p.y - before[i]) < 200 ? Math.abs(p.y - before[i]) : 0));
    return s / L.ps.length;
  };
  const normal = dist(false);
  const sight = dist(true);
  w.slowmo = false;
  return { normal: +normal.toFixed(1), sight: +sight.toFixed(1) };
});
assert('Temporal Sight slows the snow', slow.sight < slow.normal * 0.5, JSON.stringify(slow));

// ---- 4. Walls --------------------------------------------------------------------------
await start('superman', 'range', 4000);
await place(1150, 500);
const shadow = await ev(() => {
  const DM = window.DM, E = DM.Engine, w = DM.dev.play().world;
  E.render();
  // Concrete block at (980, 260, 30, 140): its shadow falls to the lower right.
  const lum = (wx, wy) => {
    const s = w.camera.toScreen(wx, wy);
    const d = E.ctx.getImageData(Math.round(s.x * E.dpr), Math.round(s.y * E.dpr), 1, 1).data;
    return d[0] + d[1] + d[2];
  };
  return { shade: lum(1016, 330), open: lum(1060, 330) };
});
assert('walls cast shadows away from the light', shadow.shade < shadow.open * 0.85, JSON.stringify(shadow));

const wallPass = () => ev(() => {
  const DM = window.DM, E = DM.Engine, w = DM.dev.play().world;
  const view = w.camera.view();
  const ctx = E.ctx;
  const times = [];
  for (let i = 0; i < 40; i++) {
    ctx.save();
    w.camera.apply(ctx);
    const a = performance.now();
    w.renderWalls(ctx, view, w.atmosphere);
    times.push(performance.now() - a);
    ctx.restore();
  }
  times.sort((a, b) => a - b);
  return { names: Object.keys(DM.WallSurfaces), ms: +times[20].toFixed(3), walls: w._wallVis.length };
});

for (const [ch, id, x, y, kind, key, name] of [['superman', 'yard', 700, 500, 'rust', '_ribbed', 'pier containers'], ['deterrent', 'waves1', 1850, 800, 'rock', '_rock', 'proving rocks'], ['karnak', 'emitters', 600, 900, 'ice', '_ice', 'Karnak ice'], ['mars', 'palace', 520, 560, 'rock', '_rock', 'Mars rocks']]) {
  await start(ch, id, ch === 'karnak' ? 4000 : 2500);
  await place(x, y);
  const ok = await ev(([kind, key]) => {
    const DM = window.DM, E = DM.Engine, w = DM.dev.play().world;
    E.render();
    return w.walls.some((wl) => wl.kind === kind && wl[key]);
  }, [kind, key]);
  assert(`${name} are drawn with their surface`, ok);
  await shot('walls-' + kind + '-' + ch);
  if (ch === 'superman') {
    let surf = await wallPass();
    if (surf.ms > 0.5) surf = await wallPass();
    assert('wall surfaces: ribbed, brick, sandbag, rock, ice, shelf, gold', ['ribbed', 'brick', 'sandbag', 'rock', 'ice', 'shelf', 'gold'].every((n) => surf.names.includes(n)), surf.names.join(', '));
    assert('the wall pass costs at most 0.5 ms (pier)', surf.ms <= 0.5, `${surf.ms} ms for ${surf.walls} walls`);
  }
}

await start('prologue', 'accident', 2000);
const door = await ev(() => {
  const DM = window.DM, E = DM.Engine, w = DM.dev.play().world;
  const d = w.entities.find((e) => e.constructor.name === 'Door');
  d.setOpen(true);
  for (let i = 0; i < 60; i++) d.update(1 / 60);
  E.render();
  const open = d.wall.noCollide;
  d.setOpen(false);
  for (let i = 0; i < 60; i++) d.update(1 / 60);
  E.render();
  return { open, closed: !d.wall.noCollide, err: DM.dev.state().error };
});
assert('doors still open and close', door.open && door.closed && !door.err, JSON.stringify(door));

// ---- 5. Temporal Sight -----------------------------------------------------------------
await start('mars', 'great', 1000);
for (let i = 0; i < 60; i++) {
  await clear();
  const free = await ev(() => { const DM = window.DM, play = DM.dev.play(); return DM.Engine.top() === play && !play.ctx.locked; });
  if (free) break;
  await wait(250);
}
await place(560, 960);
// Highest saturation in a small patch around a screen point.
const sat = (x, y, r = 0) => ev(([x, y, r]) => {
  const E = window.DM.Engine;
  E.render();
  let best = { s: -1 };
  for (let dx = -r; dx <= r; dx += 3) for (let dy = -r; dy <= r; dy += 3) {
    const d = E.ctx.getImageData(Math.round((x + dx) * E.dpr), Math.round((y + dy) * E.dpr), 1, 1).data;
    const mx = Math.max(d[0], d[1], d[2]), mn = Math.min(d[0], d[1], d[2]);
    const s = mx ? (mx - mn) / mx : 0;
    if (s > best.s) best = { s: +s.toFixed(2), rgb: [d[0], d[1], d[2]] };
  }
  return best;
}, [x, y, r]);
await ev(() => {
  const DM = window.DM, play = DM.dev.play(), p = play.player;
  p.unlock('timesight');
  play.ctx.locked = false;
  p.energy = 100;
  window.__meteor = play.world.add(new DM.Special.Meteor(p.x + 140, p.y + 80, { T: 30 }));
});
const jonAt = await ev(() => { const w = window.DM.dev.play().world, p = w.player; return w.camera.toScreen(p.x, p.y); });
const floor0 = await sat(300, 600);
await page.keyboard.down('f');
await wait(350);
const ts = await ev(() => {
  const w = window.DM.dev.play().world;
  return { k: +w.sightK.toFixed(2), timesight: w.timesight, kept: (w._keep || []).map((e) => e.constructor.name) };
});
const floor1 = await sat(300, 600);
const jon1 = await sat(jonAt.x, jonAt.y, 9);
await shot('timesight');
await page.keyboard.up('f');
await wait(600);
const after = await ev(() => +window.DM.dev.play().world.sightK.toFixed(2));
const floor2 = await sat(300, 600);
assert('holding F grades the world within about 0.3 s', ts.timesight && ts.k > 0.9 && floor1.s < floor0.s * 0.5, `k ${ts.k}, floor saturation ${floor0.s.toFixed(2)} → ${floor1.s.toFixed(2)}`);
assert('Jon and the meteor warning stay in colour', ts.kept.includes('Player') && ts.kept.includes('Meteor') && jon1.s > 0.3, `kept ${ts.kept.join(',')}; Jon ${JSON.stringify(jon1)}`);
assert('releasing F restores colour', after < 0.05 && floor2.s > floor0.s * 0.8, `k ${after}, floor ${floor2.s.toFixed(2)}`);
await ev(() => { window.__meteor.dead = true; });

await start('karnak', 'emitters', 4000);
const jam = await ev(() => {
  const DM = window.DM, play = DM.dev.play(), w = play.world;
  const em = w.entities.find((e) => e.constructor.name === 'Emitter');
  play.player.x = em.x + 150;
  play.player.y = em.y;
  play.player.energy = 100;
  w.camera.snap(play.player.x, play.player.y);
  return true;
});
await page.keyboard.down('f');
await wait(400);
const jammed = await ev(() => { const w = window.DM.dev.play().world; return { timesight: w.timesight, k: w.sightK || 0 }; });
await page.keyboard.up('f');
assert('tachyon jamming still blocks Temporal Sight', jam && !jammed.timesight && jammed.k < 0.02, JSON.stringify(jammed));

await browser.close();
const engineErr = errors.length ? errors.join('\n') : null;
if (engineErr) {
  console.error('Page errors:\n' + engineErr);
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll atmosphere checks passed.');
process.exit(failures ? 1 : 0);
