/*
 * Power & mechanics test: registers a sandbox chapter at runtime, then drives
 * each power with simulated mouse/keyboard input and asserts the outcome.
 *
 *   node tests/powers.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || path.join(root, 'index.html');

const errors = [];
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(target).href + '?dev');
await page.waitForFunction(() => window.DM && window.DM.dev);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

await page.mouse.click(640, 360);
await ev(() => {
  const DM = window.DM;
  DM.Chapters.register({
    id: '__sandbox', numeral: 'TEST', title: 'Sandbox', date: '', place: '', clock: 0, color: '#333', music: null, form: 'manhattan',
    maps: {
      t: (ctx) => {
        const W = new DM.World({ w: 1600, h: 1000, zoom: 1 });
        W.room(0, 0, 1600, 1000, { t: 20 });
        W.spawn = { x: 400, y: 500 };
        return W;
      },
    },
    stages: [{
      id: 't', map: 't',
      run: function* (ctx) {
        for (const id of ['telekinesis', 'disintegrate', 'teleport', 'duplicate', 'timesight', 'expand']) ctx.player.unlock(id);
        while (true) yield;
      },
    }],
  });
  DM.dev.start('__sandbox');
});
await wait(500);

// Screen position of a world point (viewport is exactly 1280x720, so logical == CSS px).
const screenOf = (x, y) => ev(([x, y]) => window.DM.dev.play().world.camera.toScreen(x, y), [x, y]);
const reset = () => ev(() => {
  const p = window.DM.dev.play().player;
  p.energy = 100;
  p.coherence = 100;
  for (const s of Object.values(p.powers)) s.cd = 0;
});

// 1. Telekinesis: grab a crate, swing, throw.
await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  window.__crate = play.world.add(new DM.Props.Crate(560, 500));
});
await wait(100);
let s = await screenOf(560, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(250);
const held = await ev(() => window.DM.dev.play().player.powers.telekinesis.target === window.__crate);
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(s.x + i * 40, s.y - i * 25);
  await wait(30);
}
await page.mouse.up();
await wait(500);
const crateMoved = await ev(() => Math.hypot(window.__crate.x - 560, window.__crate.y - 500));
assert('telekinesis grabs the crate under the cursor', held);
assert('telekinesis carries and throws it', crateMoved > 120, `moved ${Math.round(crateMoved)}px`);

// 2. Disintegrate: a target under the cursor.
await reset();
await ev(() => {
  const DM = window.DM;
  window.__dummy = DM.dev.play().world.add(new DM.Props.Dummy(700, 650));
});
s = await screenOf(700, 650);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.keyboard.press('q');
await wait(450);
assert('disintegrate (Q) destroys the target', await ev(() => window.__dummy.dead));

await reset();
await ev(() => {
  const DM = window.DM;
  window.__dummy2 = DM.dev.play().world.add(new DM.Props.Dummy(760, 420));
});
s = await screenOf(760, 420);
await page.mouse.move(s.x, s.y);
await page.mouse.down({ button: 'right' });
await page.mouse.up({ button: 'right' });
await wait(450);
assert('disintegrate (right click) destroys the target', await ev(() => window.__dummy2.dead));

// 3. Teleport to the cursor.
await reset();
const before = await ev(() => ({ x: window.DM.dev.play().player.x, y: window.DM.dev.play().player.y }));
await page.mouse.move(480, 200);
await wait(80);
const aim = await ev(() => ({ ...window.DM.dev.play().world.mouse }));
await page.keyboard.press('Space');
await wait(200);
const after = await ev(() => ({ x: window.DM.dev.play().player.x, y: window.DM.dev.play().player.y }));
const tdist = Math.hypot(after.x - aim.x, after.y - aim.y);
assert('teleport (SPACE) moves Jon to the cursor', tdist < 40 && Math.hypot(after.x - before.x, after.y - before.y) > 100, `landed ${Math.round(tdist)}px from aim`);

// 4. Duplicate.
await reset();
await page.keyboard.press('r');
await wait(200);
const dups = await ev(() => window.DM.dev.play().world.entities.filter((e) => e.isDuplicate && !e.dead).length);
assert('duplicate (R) creates two copies', dups === 2, `${dups} copies`);

// 5. Temporal Sight slows the world while held.
await reset();
await page.keyboard.down('f');
await wait(600);
const ts = await ev(() => window.DM.dev.play().world.timeScale);
await page.keyboard.up('f');
await wait(600);
const ts2 = await ev(() => window.DM.dev.play().world.timeScale);
assert('temporal sight (hold F) slows time', ts < 0.5 && ts2 > 0.8, `timeScale ${ts.toFixed(2)} → ${ts2.toFixed(2)}`);

// 6. Expand.
await reset();
await page.keyboard.press('g');
await wait(900);
const scale = await ev(() => window.DM.dev.play().player.scale);
assert('expand (G) grows Jon', scale > 1.8, `scale ${scale.toFixed(2)}`);
await ev(() => {
  const p = window.DM.dev.play().player;
  p.expandT = 0.01;
});
await wait(800);

// 7. A thrown gangster is knocked out (spared), not killed.
await reset();
const ko = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const g = play.world.add(new DM.Enemies.Gangster({ x: 200, y: 300 }));
  g.thrown = 1;
  g.stun = 0.9;
  g.vx = -900;
  await new Promise((r) => setTimeout(r, 500));
  return { ko: g.ko, dead: g.dead, spared: play.ctx.stats.spared };
});
assert('thrown gangster hitting a wall is knocked out and counted as spared', ko.ko && !ko.dead && ko.spared === 1, JSON.stringify(ko));

// 8. Enemy fire damages coherence; human-form Jon is never hurt.
await reset();
const hurt = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const p = play.player;
  for (const e of play.world.entities) if (e.isDuplicate) e.dead = true; // they would block the shot
  p.invuln = 0;
  const c0 = p.coherence;
  play.world.add(new DM.Proj.Bullet({ x: p.x - 120, y: p.y, vx: 600, vy: 0, team: 'enemy', dmg: 10 }));
  await new Promise((r) => setTimeout(r, 400));
  return { c0, c1: p.coherence };
});
assert('enemy bullets reduce coherence', hurt.c1 < hurt.c0, `${Math.round(hurt.c0)} → ${Math.round(hurt.c1)}`);

// 9. Awareness form gathers atoms.
const atoms = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const p = play.player;
  p.setForm('awareness');
  p.carry = 0;
  for (let i = 0; i < 5; i++) play.world.add(new DM.Special.Atom(p.x + 30 + i * 6, p.y + 10));
  await new Promise((r) => setTimeout(r, 1200));
  const carry = p.carry;
  p.setForm('manhattan');
  return carry;
});
assert('awareness form gathers nearby atoms', atoms >= 4, `${atoms} gathered`);

// 10. Pause and resume.
await page.keyboard.press('Escape');
await wait(150);
const paused = (await ev(() => window.DM.dev.state())).scene;
await page.keyboard.press('Escape');
await wait(150);
const resumed = (await ev(() => window.DM.dev.state())).scene;
assert('ESC pauses and resumes', paused === 'Pause' && resumed === 'Play', `${paused} → ${resumed}`);

// 11. Progress is saved.
const saved = await ev(() => !!localStorage.getItem('dr-manhattan.save'));
assert('progress is written to localStorage', saved);

// 12. Resizing the window keeps the game alive and letterboxed.
await page.setViewportSize({ width: 900, height: 900 });
await wait(200);
await page.setViewportSize({ width: 1280, height: 720 });
await wait(200);
const err = (await ev(() => window.DM.dev.state())).error;
assert('survives window resizes', !err, err || '');

// ---- Powers handling: throws, buffering, reticle, teleport, energy -----------
// Each case starts from a clean sandbox: Jon at (x, y), nothing else in the world.
const setup = (x = 300, y = 500, o = {}) => ev(([x, y, o]) => {
  const DM = window.DM;
  const play = DM.dev.play();
  const p = play.player;
  for (const e of play.world.entities) if (!e.isPlayer) e.dead = true;
  for (const s of Object.values(p.powers)) {
    s.cd = 0;
    s.buf = 0;
    s.relock = 0;
    s.target = null;
    s.latched = false;
  }
  Object.assign(p, { x, y, vx: 0, vy: 0, energy: 100, coherence: 100, energyRegen: 20, regenDelay: 0, godMode: true, expandT: 0, targetScale: 1, scale: 1, invuln: 0 }, o);
  p.setForm('manhattan');
  play.world.camera.targetZoom = play.world.baseZoom;
  DM.Save.settings.tkMode = 'hold';
  window.__sounds = [];
}, [x, y, o]);
const add = (expr) => ev((expr) => {
  const DM = window.DM;
  const W = DM.dev.play().world;
  return (0, eval)(`(DM, W) => ${expr}`)(DM, W);
}, expr);
// Records every sound request (name, options) so cases can check feedback.
await ev(() => {
  const A = window.DM.Audio;
  const play = A.play;
  A.play = function (name, opts) {
    (window.__sounds = window.__sounds || []).push({ name, opts: opts || null, t: performance.now() });
    return play.apply(this, arguments);
  };
});
const sounds = () => ev(() => window.__sounds.map((s) => s.name));
// Follows an entity every frame; releaseSpeed() is its speed on the first frame after it was let go.
const track = (name) => ev((name) => {
  const tok = (window.__tok = {});
  const e = window[name];
  window.__trk = [];
  const tick = () => {
    if (window.__tok !== tok) return;
    window.__trk.push({ held: !!e.heldBy, sp: e.speed, x: e.x, y: e.y });
    if (window.__trk.length < 900) requestAnimationFrame(tick);
  };
  tick();
}, name);
const releaseSpeed = () => ev(() => {
  const T = window.__trk;
  const k = T.findIndex((s, i) => i > 0 && T[i - 1].held && !s.held);
  return k < 0 ? null : Math.max(...T.slice(k, k + 2).map((s) => s.sp));
});
const tk = () => ev(() => {
  const s = window.DM.dev.play().player.powers.telekinesis;
  return { held: !!s.target, latched: !!s.latched };
});
const pixelAt = (x, y) => ev(([x, y]) => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const cv = window.DM.Engine.canvas;
  const k = cv.width / window.innerWidth;
  res(Array.from(cv.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data).slice(0, 3));
}))), [x, y]);
const dragTo = async (from, to, steps, ms) => {
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await wait(ms);
  }
};

// T1. A drag that ends in a flick throws hard, even after a short pause.
await setup(300, 500);
await add('(window.__c = W.add(new DM.Props.Crate(380, 500)))');
await wait(150);
s = await screenOf(380, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(200);
await track('__c');
await dragTo(s, { x: s.x + 260, y: s.y }, 10, 40);
await page.mouse.move(s.x + 300, s.y);
await wait(100);
await page.mouse.up();
await wait(150);
const flickV = await releaseSpeed();
assert('throw: drag 300 px, flick, pause 100 ms, release → at least 600 px/s', flickV >= 600, `${Math.round(flickV)} px/s`);
const throwSnd = await ev(() => window.__sounds.find((x) => x.name === 'throw'));
assert('throw: the throw sound is told how fast it flew', !!(throwSnd && throwSnd.opts && throwSnd.opts.speed >= 600), JSON.stringify(throwSnd && throwSnd.opts));

// T2. Lifting and letting go without moving the mouse is a gentle drop.
await setup(300, 500);
await add('(window.__c = W.add(new DM.Props.Crate(420, 600)))');
await wait(150);
s = await screenOf(420, 600);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await track('__c');
await wait(400);
await page.mouse.up();
await wait(150);
const dropV = await releaseSpeed();
assert('throw: grab and release without moving → under 60 px/s', dropV != null && dropV < 60, `${dropV == null ? 'never held' : Math.round(dropV)} px/s`);

// T3. Slowly dragging a crate onto a gangster and letting go knocks him out.
await setup(400, 500);
await add('(window.__c = W.add(new DM.Props.Crate(480, 500)))');
await add('(window.__g = W.add(new DM.Enemies.Gangster({ x: 760, y: 500 })), window.__g.think = () => {}, 0)');
const spared0 = await ev(() => window.DM.dev.play().ctx.stats.spared);
await wait(150);
s = await screenOf(480, 500);
let g = await screenOf(760, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(150);
await dragTo(s, g, 16, 50);
await wait(600);
await page.mouse.up();
const slowKo = await ev(async (spared0) => {
  const play = window.DM.dev.play();
  const t0 = performance.now();
  while (!window.__g.ko && performance.now() - t0 < 500) await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 100));
  return { ko: window.__g.ko, dead: window.__g.dead, spared: play.ctx.stats.spared - spared0, ms: Math.round(performance.now() - t0) };
}, spared0);
assert('throw: slow drag onto a gangster, release → KO within 0.5 s, +1 spared', slowKo.ko && !slowKo.dead && slowKo.spared === 1, JSON.stringify(slowKo));

// T4. A throw roughly toward an enemy bends onto him (close enough for a light throw to knock him out).
await setup(300, 500);
await add('(window.__c = W.add(new DM.Props.Crate(380, 500)))');
await add('(window.__g = W.add(new DM.Enemies.Gangster({ x: 650, y: 545 })), window.__g.think = () => {}, 0)');
await wait(150);
s = await screenOf(380, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(200);
await track('__c');
await dragTo(s, { x: s.x + 150, y: s.y }, 5, 16);
await page.mouse.up();
await wait(50);
const aimed = await ev(async () => {
  const T = window.__trk;
  const k = T.findIndex((s, i) => i > 0 && T[i - 1].held && !s.held);
  const a = T[k], b = T[k + 1];
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const bearing = Math.atan2(window.__g.y - a.y, window.__g.x - a.x);
  await new Promise((r) => setTimeout(r, 900));
  return { off: +Math.abs(window.DM.U.wrapAngle(dir - bearing)).toFixed(3), ko: window.__g.ko };
});
assert('throw: aim assist bends a throw onto a gangster 0.2 rad off the line', aimed.off < 0.06 && aimed.ko, JSON.stringify(aimed));

// T5. Carrying things into a target zone and setting them down still works (Ch II range).
await setup(300, 500);
await add('(window.__zone = W.add(new DM.Props.Zone(700, 500, 110, { accept: (e) => e.tags.has("crate") || e.kind === "jeep", onAccept: (e) => (window.__in = (window.__in || 0) + 1) })), window.__in = 0)');
await add('(window.__c = W.add(new DM.Props.Crate(420, 500)), 0)');
await wait(150);
s = await screenOf(420, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(150);
let z = await screenOf(700, 500);
await dragTo(s, z, 20, 50);
await wait(500);
await page.mouse.up();
await wait(300);
const crateIn = await ev(() => window.__in);
await add('(window.__j = W.add(new DM.Props.Vehicle(420, 600, { kind: "jeep", hp: null })), 0)');
await wait(150);
s = await screenOf(420, 600);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(150);
z = await screenOf(700, 500);
await dragTo(s, z, 20, 60);
await wait(900);
await page.mouse.up();
await wait(400);
const jeepIn = await ev(() => window.__in);
assert('throw: a crate and a jeep carried into a zone and set down are accepted', crateIn === 1 && jeepIn === 2, `crate ${crateIn}, jeep ${jeepIn - crateIn}`);

// T6. Toggle mode: one click lifts, the mouse carries with no button held, a second click throws.
await setup(300, 500);
await ev(() => (window.DM.Save.settings.tkMode = 'toggle'));
await add('(window.__c = W.add(new DM.Props.Crate(420, 500)), 0)');
await wait(150);
s = await screenOf(420, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await page.mouse.up();
await wait(200);
const lifted = await tk();
await dragTo(s, { x: s.x + 40, y: s.y + 120 }, 12, 50);
await wait(400);
const carried = await ev(() => Math.hypot(window.__c.x - 420, window.__c.y - 500));
await track('__c');
await dragTo({ x: s.x + 40, y: s.y + 120 }, { x: s.x + 200, y: s.y + 120 }, 4, 16);
await page.mouse.down();
await page.mouse.up();
await wait(150);
const toggleV = await releaseSpeed();
const toggleTip = await ev(() => window.DM.Powers.get('telekinesis').tip);
await ev(() => (window.DM.Save.settings.tkMode = 'hold'));
assert('toggle mode: a click lifts, the cursor carries, a second click throws', lifted.held && carried > 80 && toggleV >= 600, `held ${lifted.held}, carried ${Math.round(carried)}px, thrown ${Math.round(toggleV)} px/s`);
assert('toggle mode: the unlock tip explains clicking and C', /CLICK/.test(toggleTip) && /\bC\b/.test(toggleTip));

// T7. Holding C lifts and carries; letting go of C drops.
await setup(300, 500);
await add('(window.__c = W.add(new DM.Props.Crate(420, 500)), 0)');
await wait(150);
s = await screenOf(420, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.keyboard.down('c');
await wait(200);
const cHeld = await tk();
await dragTo(s, { x: s.x, y: s.y + 120 }, 10, 50);
await wait(300);
const cCarried = await ev(() => Math.hypot(window.__c.x - 420, window.__c.y - 500));
await page.keyboard.up('c');
await wait(100);
const cAfter = await tk();
assert('hold C: lifts and carries, releasing C lets go', cHeld.held && cCarried > 80 && !cAfter.held, `carried ${Math.round(cCarried)}px`);

// T8. Buffered presses: a second Q or SPACE during the cooldown still fires.
await setup(300, 500);
await ev(() => {
  window.__casts = [];
  window.__tps = [];
  const d = window.DM.Powers.get('disintegrate');
  const fire = d.fire;
  d.fire = function () {
    window.__casts.push(performance.now());
    return fire.apply(this, arguments);
  };
  window.DM.Events.on('player:teleport', () => window.__tps.push(performance.now()));
});
await page.mouse.move(800, 300);
await wait(100);
const castGaps = [];
for (const gap of [300, 100]) {
  await ev(() => {
    window.__casts = [];
    const p = window.DM.dev.play().player;
    p.energy = 100;
    p.powers.disintegrate.cd = 0;
  });
  await page.keyboard.press('q');
  await wait(gap);
  await page.keyboard.press('q');
  await wait(700);
  castGaps.push(await ev(() => window.__casts.map((t) => Math.round(t - window.__casts[0]))));
}
assert('buffer: Q,Q 300 ms apart → 2 casts, the second when the cooldown ends', castGaps[0].length === 2 && castGaps[0][1] >= 400 && castGaps[0][1] <= 520, JSON.stringify(castGaps[0]));
assert('buffer: Q,Q 100 ms apart → 2 casts', castGaps[1].length === 2, JSON.stringify(castGaps[1]));
await setup(300, 500);
await ev(() => (window.__tps = []));
await page.mouse.move(700, 500);
await wait(150);
await page.keyboard.press('Space');
await wait(400);
await page.mouse.move(300, 300);
await page.keyboard.press('Space');
await wait(700);
const tps = await ev(() => window.__tps.length);
assert('buffer: SPACE,SPACE 400 ms apart → 2 teleports', tps === 2, `${tps} teleports`);

// T9. A press that cannot fire in time fails out loud (after the buffer, not at once).
await setup(300, 500);
await page.keyboard.press('r');
await wait(100);
await ev(() => (window.__sounds = []));
await page.keyboard.press('r');
const early = await ev(() => new Promise((r) => setTimeout(() => r(window.__sounds.some((s) => s.name === 'fail')), 60)));
await wait(200);
const late = await ev(() => ({ fail: window.__sounds.some((s) => s.name === 'fail'), pulse: window.DM.dev.play().player.reticleFail }));
assert('buffer: R on cooldown is not refused at once but fails after the buffer, with a red reticle pulse', !early && late.fail && late.pulse > 0, JSON.stringify({ early, ...late }));

// T10. Presses made while the world is frozen (hitstop) are kept.
await setup(300, 500);
await page.mouse.move(800, 300);
await ev(() => {
  window.__casts = [];
  const w = window.DM.dev.play().world;
  const update = w.update;
  window.__freeze = 0.3;
  w.update = function (dt) {
    if (window.__freeze > 0) {
      window.__freeze -= dt;
      return;
    }
    return update.call(this, dt);
  };
});
await wait(50);
await page.keyboard.press('q');
await wait(600);
const frozenCasts = await ev(() => window.__casts.length);
assert('buffer: Q pressed during a world freeze still casts afterwards', frozenCasts === 1, `${frozenCasts} casts`);

// T11. The reticle shows the Disintegrate cooldown and low energy.
await setup(300, 500);
await page.mouse.move(820, 300);
await wait(150);
// (9, 9) from the cursor: on the arc (radius 13.5), clear of the base reticle and the teleport ring.
const calm = await pixelAt(820 + 9, 300 + 9);
await page.keyboard.press('q');
await ev(async () => {
  while (!(window.DM.dev.play().player.powers.disintegrate.cd > 0.3)) await new Promise((r) => requestAnimationFrame(r));
});
const arc = await pixelAt(820 + 9, 300 + 9);
const orange = (c) => c[0] > 170 && c[0] > c[2] + 50;
assert('reticle: a cooldown arc appears just after Q', orange(arc) && !orange(calm), `before ${calm} → after ${arc}`);
await wait(700);
const ringOk = await pixelAt(820 + 6, 300 + 6);
await ev(() => {
  const p = window.DM.dev.play().player;
  p.energy = 10;
  p.energyRegen = 0;
});
const ringLow = await pixelAt(820 + 6, 300 + 6);
assert('reticle: low energy tints it red-orange', ringLow[0] > ringLow[2] + 60 && ringOk[2] >= ringOk[0], `${ringOk} → ${ringLow}`);

// T12. The system cursor comes back over the letterbox bars.
await page.setViewportSize({ width: 1440, height: 900 });
await wait(150);
await page.mouse.move(700, 20);
await wait(100);
const overBar = await ev(() => window.DM.Engine.canvas.style.cursor);
await page.mouse.move(700, 450);
await wait(100);
const overGame = await ev(() => window.DM.Engine.canvas.style.cursor);
await page.setViewportSize({ width: 1280, height: 720 });
await wait(200);
assert('cursor: visible over the 45 px bars of a 1440x900 window, hidden over the game', overBar === 'default' && overGame === 'none', `${overBar} / ${overGame}`);

// T13. Teleport with the cursor on Jon goes full range the way he faces.
await setup(400, 500, { facing: 0 });
await wait(100);
s = await screenOf(400, 500);
await page.mouse.move(s.x + 10, s.y);
await wait(300);
await page.keyboard.press('Space');
await wait(200);
const hop = await ev(() => {
  const p = window.DM.dev.play().player;
  return Math.hypot(p.x - 400, p.y - 500);
});
assert('teleport: SPACE with the cursor on Jon still leaves (full range)', hop > 300, `${Math.round(hop)}px`);

// Aim at a world point and wait for the look-ahead camera to settle on it.
const aimAt = async (x, y) => {
  for (let i = 0; i < 6; i++) {
    const p = await screenOf(x, y);
    await page.mouse.move(p.x, p.y);
    await wait(250);
  }
  return ev(() => ({ ...window.DM.dev.play().world.mouse }));
};
const preview = () => ev(() => {
  const d = window.DM.dev.play().player.powers.teleport.dest;
  return d && { x: d.x, y: d.y, clamped: d.clamped };
});
const jon = () => ev(() => ({ x: window.DM.dev.play().player.x, y: window.DM.dev.play().player.y }));

// T14. Past range, Jon lands exactly on the preview ring.
await setup(400, 500);
await aimAt(1100, 300);
const ring = await preview();
await page.keyboard.press('Space');
await wait(200);
let at = await jon();
assert('teleport: aiming past range lands on the preview ring', ring && ring.clamped && Math.hypot(at.x - ring.x, at.y - ring.y) < 3 && Math.abs(Math.hypot(ring.x - 400, ring.y - 500) - 380) < 2, `ring ${JSON.stringify(ring)}, landed ${Math.round(at.x)},${Math.round(at.y)}`);

// T15. Aiming into a wall previews (and lands on) the nearest free spot before it.
await setup(800, 500);
await ev(() => window.DM.dev.play().world.wall(1000, 300, 60, 400));
let m = await aimAt(1030, 500);
const wallRing = await preview();
const free = await ev((d) => d && window.DM.dev.play().world.isFree(d.x, d.y, window.DM.dev.play().player.r), wallRing);
await page.keyboard.press('Space');
await wait(200);
at = await jon();
assert('teleport: aiming into a wall shows the nearest free spot, and lands there', m.x > 1000 && m.x < 1060 && wallRing && free && wallRing.x > 970 && wallRing.x <= 987 && Math.hypot(at.x - wallRing.x, at.y - wallRing.y) < 3, `ring ${wallRing && Math.round(wallRing.x)}, landed ${Math.round(at.x)}`);

// T16. Nowhere to go: no teleport, a 'fail', and Jon says so.
await setup(985, 500);
m = await aimAt(1055, 500);
await ev(() => (window.__sounds = []));
const nowhere = await preview();
await page.keyboard.press('Space');
await wait(300);
at = await jon();
const refusal = await ev(() => ({ fail: window.__sounds.some((s) => s.name === 'fail'), bark: window.DM.dev.play().world.barks.map((b) => b.text) }));
assert('teleport: with nowhere to land it refuses out loud', nowhere === null && Math.abs(at.x - 985) < 2 && refusal.fail && refusal.bark.includes('Somewhere else.'), JSON.stringify(refusal));
await ev(() => window.DM.dev.play().world.walls.pop());

// T17. Disintegrate shoves what survives, and a miss sounds like a miss.
await setup(400, 500);
await add('(window.__t = W.add(new DM.Enemies.Tank({ x: 800, y: 500 })), window.__t.think = () => {}, 0)');
await aimAt(780, 500);
await ev(() => (window.__sounds = []));
await page.keyboard.press('q');
await wait(700);
const shoved = await ev(() => ({ dx: Math.round(window.__t.x - 800), hp: window.__t.hp, sounds: window.__sounds.map((s) => s.name) }));
assert('disintegrate: a tank that survives is knocked back more than 4 px', shoved.hp > 0 && shoved.dx > 4 && shoved.sounds.includes('disintegrate'), JSON.stringify(shoved));
await aimAt(500, 800);
await ev(() => (window.__sounds = []));
await page.keyboard.press('q');
await wait(400);
let snd = await sounds();
assert("disintegrate: a Q that hits nothing plays 'dis_miss'", snd.includes('dis_miss') && !snd.includes('disintegrate'), snd.join(','));

// T18. Holding a crate no longer starves Jon of energy.
await setup(300, 500, { energy: 40 });
await add('(window.__c = W.add(new DM.Props.Crate(420, 500)), 0)');
await wait(100);
s = await screenOf(420, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(3000);
const heldE = await ev(() => ({ e: window.DM.dev.play().player.energy, held: !!window.DM.dev.play().player.powers.telekinesis.target }));
await page.mouse.up();
assert('energy: holding a crate for 3 s from 40 ends at 40 or more', heldE.held && heldE.e >= 40, heldE.e.toFixed(1));

// T19. Spam-clicking at no energy cannot move anything; running dry drops with a fizzle.
await setup(300, 500, { energy: 0.3, energyRegen: 0 });
await add('(window.__c = W.add(new DM.Props.Crate(420, 500)), 0)');
await wait(100);
s = await screenOf(420, 500);
await page.mouse.move(s.x, s.y);
await wait(50);
await ev(() => {
  window.__everHeld = false;
  const tok = (window.__tok = {});
  const tick = () => {
    if (window.__tok !== tok) return;
    if (window.DM.dev.play().player.powers.telekinesis.target) window.__everHeld = true;
    requestAnimationFrame(tick);
  };
  tick();
});
for (let i = 0; i < 12; i++) {
  await page.mouse.down();
  await wait(25);
  await page.mouse.move(s.x + 60, s.y + 40);
  await page.mouse.up();
  await page.mouse.move(s.x, s.y);
  await wait(25);
}
const spam = await ev(() => ({ held: window.__everHeld, moved: Math.round(Math.hypot(window.__c.x - 420, window.__c.y - 500)), fail: window.__sounds.some((s) => s.name === 'fail') }));
assert('energy: spam-clicking at 0 energy never lifts the crate', !spam.held && spam.moved < 3 && spam.fail, JSON.stringify(spam));
await ev(() => {
  const p = window.DM.dev.play().player;
  p.energy = 9;
  window.__sounds = [];
});
await page.mouse.down();
await ev(async () => {
  const t0 = performance.now();
  while (!window.DM.dev.play().player.powers.telekinesis.target && performance.now() - t0 < 500) await new Promise((r) => requestAnimationFrame(r));
  while (window.DM.dev.play().player.powers.telekinesis.target && performance.now() - t0 < 4000) await new Promise((r) => requestAnimationFrame(r));
});
const starved = await ev(() => ({ relock: window.DM.dev.play().player.powers.telekinesis.relock, fizzle: window.__sounds.some((s) => s.name === 'fizzle') }));
await page.mouse.up();
assert('energy: running dry drops the crate with a fizzle and a short relock', starved.relock > 0 && starved.fizzle, JSON.stringify(starved));

// T20. A knockout pays exactly 10 energy and 4 coherence, once per person.
await setup(300, 500, { energy: 50, energyRegen: 0, coherence: 50, regenDelay: 99 });
const reward = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const p = play.player;
  const out = {};
  const off = DM.Events.on('enemy:down', (e) => {
    if (!e.lethal) out.first = out.first || { energy: p.energy, coherence: p.coherence };
  });
  const g = play.world.add(new DM.Enemies.Gangster({ x: 200, y: 300 }));
  g.think = () => {};
  g.thrown = 1;
  g.stun = 0.9;
  g.vx = -900;
  const t0 = performance.now();
  while (!g.ko && performance.now() - t0 < 1000) await new Promise((r) => requestAnimationFrame(r));
  g.die('impact');
  await new Promise((r) => setTimeout(r, 100));
  off();
  out.after = { energy: p.energy, coherence: p.coherence };
  return out;
});
assert('energy: a KO adds exactly 10 energy and 4 coherence (once)', reward.first && reward.first.energy === 60 && reward.first.coherence === 54 && reward.after.energy === 60, JSON.stringify(reward));

// T21. Expand refunds part of its cost, throws hit harder while expanded, and a great crystal can be carried 700 px.
await setup(300, 500, { energyRegen: 0 });
await page.keyboard.press('g');
await wait(100);
const afterExpand = await ev(() => window.DM.dev.play().player.energy);
assert('expand: casting costs 55 and refunds 25', afterExpand === 70, String(afterExpand));
await ev(() => (window.DM.dev.play().player.energyRegen = 20));
await add('(window.__shard = W.add(new DM.Special.Shard(430, 500, true)), 0)');
await wait(300);
s = await screenOf(430, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(150);
let alwaysHeld = true;
for (let i = 1; i <= 25; i++) {
  const p = await screenOf(430 + i * 30, 500);
  await page.mouse.move(p.x, p.y);
  await wait(90);
  if (!(await tk()).held) alwaysHeld = false;
}
await wait(500);
const carry = await ev(() => ({ d: Math.round(window.__shard.x - 430), held: window.__shard.heldBy === window.DM.dev.play().player, energy: Math.round(window.DM.dev.play().player.energy), expandT: +window.DM.dev.play().player.expandT.toFixed(1) }));
assert('expand: a great crystal is carried 700 px within one Expand', alwaysHeld && carry.held && carry.d >= 700 && carry.expandT > 0, JSON.stringify(carry));
await page.mouse.up();
await add('(window.__c = W.add(new DM.Props.Crate(420, 700)), 0)');
await wait(100);
s = await screenOf(420, 700);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.mouse.down();
await wait(150);
await dragTo(s, { x: s.x + 200, y: s.y }, 5, 16);
await page.mouse.up();
await wait(50);
const boostedMul = await ev(() => window.__c.impactMul);
await wait(1500);
const restoredMul = await ev(() => window.__c.impactMul);
assert('expand: things thrown while expanded hit twice as hard until they land', boostedMul === 2 && !restoredMul, `${boostedMul} → ${restoredMul}`);

// T22. Coherence recovers at the challenge level's rate (Player.coherenceRegen).
await setup(300, 500, { coherence: 50 });
const regen0 = await ev(() => window.DM.dev.play().player.coherenceRegen);
await ev(() => (window.DM.dev.play().player.coherenceRegen = 18));
await wait(500);
const regenGain = await ev(() => window.DM.dev.play().player.coherence - 50);
await ev(() => (window.DM.dev.play().player.coherenceRegen = 9));
assert('coherence regen follows Player.coherenceRegen (9 on Normal)', regen0 === 9 && regenGain > 6 && regenGain < 12, `regen ${regen0}, +${regenGain.toFixed(1)} in 0.5 s at 18/s`);

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll mechanics checks passed.');
process.exit(failures ? 1 : 0);
