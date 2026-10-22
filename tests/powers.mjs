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

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll mechanics checks passed.');
process.exit(failures ? 1 : 0);
