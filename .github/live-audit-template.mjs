/* Real-RAF known-route audit. First-spawn setup only; no actor placement or health cheats. */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  pw = require('/opt/pyvenv/lib/python3.13/site-packages/playwright/driver/package');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const offline = process.argv.includes('--offline');
const target = process.argv.find(a => a.endsWith('.html')) || 'index.html';
const out = path.join(root, 'tests/out/audit-followup');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = [], trace = [];
let minimumHealth = 100;
page.on('pageerror', e => errors.push(String(e)));
const check = (label, ok) => {
  assert.ok(ok, label);
  checks.push(label);
  console.log('✓ ' + label);
};
const read = async () => {
  const s = await page.evaluate(() => {
    const p = DM.dev.play();
    return { stage: p.ctx.stageIndex, x: p.player.x, y: p.player.y, hp: p.player.coherence,
      rescued: p.ctx.flags.rescued, spared: p.ctx.stats.spared, unmade: p.ctx.stats.disintegrated,
      heat: p.ctx.flags.heat, failed: p.failed, dialog: p.dialog.active, time: p.world.realTime,
      god: !!p.player.godMode || !!DM.Save.settings.invulnerable,
      screen: p.world.camera.toScreen(p.player.x, p.player.y), marker: p.hud.marker };
  });
  minimumHealth = Math.min(minimumHealth, s.hp);
  assert.ok(!s.god && !s.failed && s.hp > 0, 'journey must stay alive with normal vulnerability');
  return s;
};
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
const aim = async (x, y) => {
  const q = await page.evaluate(p => DM.dev.play().world.camera.toScreen(p.x, p.y), { x, y });
  await page.mouse.move(q.x, q.y);
};
const wait = async seconds => {
  const t = (await read()).time + seconds;
  await page.waitForFunction(t => DM.dev.play().world.realTime >= t, t,
    { polling: 50, timeout: 2000 + seconds * 8000 });
  await read();
};
const hold = async (key, seconds) => {
  await page.keyboard.down(key);
  try {
    await wait(seconds);
  } finally {
    await page.keyboard.up(key);
  }
};
const teleport = async (x, y) => {
  await aim(x, y);
  await page.keyboard.press('Space');
  await wait(0.65);
};
const dialogue = async () => {
  for (let i = 0; i < 35 && (await read()).dialog; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(110);
  }
};
const walk = async (x, y) => {
  const down = new Set();
  try {
    for (let i = 0; i < 250; i++) {
      const p = await read(), dx = x - p.x, dy = y - p.y;
      if (Math.hypot(dx, dy) < 13) break;
      const want = new Set([dx < -7 ? 'a' : dx > 7 ? 'd' : null, dy < -7 ? 'w' : dy > 7 ? 's' : null]);
      for (const k of ['a', 'd', 'w', 's']) {
        if (want.has(k) && !down.has(k)) {
          await page.keyboard.down(k);
          down.add(k);
        }
        if (!want.has(k) && down.has(k)) {
          await page.keyboard.up(k);
          down.delete(k);
        }
      }
      await page.waitForTimeout(65);
    }
  } finally {
    for (const k of down) await page.keyboard.up(k);
  }
  const p = await read();
  assert.ok(Math.hypot(x - p.x, y - p.y) < 28, `walk blocked at ${p.x},${p.y} on route to ${x},${y}`);
};
const arrived = async (stage, name) => {
  for (let i = 0; i < 25; i++) {
    const p = await read();
    if (p.stage === stage && p.dialog) break;
    if (p.dialog) await page.keyboard.press('Space');
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(1500);
  const s = await read();
  trace.push({ label: name, ...s });
  await shot(name);
  check(name + ': Jon visible and old marker cleared', s.stage === stage && s.dialog && s.marker === null &&
    s.screen.x > 40 && s.screen.x < 1240 && s.screen.y > 125 && s.screen.y < 500);
};
try {
  if (offline) {
    await page.evaluate(() => {
      window.__store = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: k => window.__store[k] ?? null, setItem: (k, v) => window.__store[k] = String(v),
        removeItem: k => delete window.__store[k],
      } });
    });
    let html = readFileSync(path.join(root, target), 'utf8');
    html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
      '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
    await page.setContent(html.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
  } else {
    await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => window.DM?.dev);
  await page.evaluate(() => {
    DM.Save.settings.focusPause = false;
    DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.challenge = 'normal';
    DM.Save.settings.invulnerable = false;
    DM.Engine.governor.enabled = false;
    DM.Engine.set(new DM.Scenes.Play(), { chapter: 'long_summer', stage: 0 });
  });
  await dialogue();
  await aim(370, 705);
  await hold('c', 0.22);
  await hold('d', 0.7);
  await aim(570, 570);
  await hold('c', 0.22);
  await teleport(800, 660);
  await page.keyboard.press('r');
  await wait(7);
  const avenue = await read();
  check('actual nonlethal powers settle the avenue', avenue.spared >= 2 && avenue.unmade === 0);
  await teleport(1110, 490);
  await teleport(1470, 435);
  await page.keyboard.press('e');
  await wait(1.8);
  check('E calls Nite Owl to open the balcony', await page.evaluate(() => DM.dev.play().ctx.flags.grappleOpen));
  await teleport(1740, 365);
  await page.keyboard.press('e');
  await arrived(1, 'tenement-arrival-live');
  await dialogue();
  await walk(820, 1035);
  await aim(820, 947);
  await hold('c', 0.25);
  await walk(875, 1035);
  await walk(875, 220);
  await walk(820, 220);
  await page.keyboard.press('g');
  await wait(0.7);
  await page.keyboard.press('e');
  check('G and E open the roof vent', await page.evaluate(() => DM.dev.play().ctx.flags.summer.grid.vented));
  await wait(7.4);
  for (let id = 0; id < 6; id++) {
    const e = await page.evaluate(id => {
      const e = DM.dev.play().ctx.flags.residents[id];
      return { x: e.x, y: e.y, safe: e.safe };
    }, id);
    if (e.safe) continue;
    await walk(820, e.y);
    await walk(e.x < 820 ? e.x + 35 : e.x - 35, e.y);
    await page.keyboard.press('e');
    await wait(0.1);
    check('resident ' + id + ' follows E', await page.evaluate(id => {
      const e = DM.dev.play().ctx.flags.residents[id];
      return e.escort || e.safe;
    }, id));
    await walk(820, e.y);
    if (id === 3) await page.keyboard.press('r');
  }
  await walk(820, 1400);
  await page.waitForFunction(() => DM.dev.play().ctx.flags.rescued === 6, null, { timeout: 60000 });
  const safe = await read();
  trace.push({ label: 'six-rescued', ...safe });
  await shot('six-rescued-live');
  check('six real escorts reach safety without cheats', safe.rescued === 6 && safe.unmade === 0);
  await walk(970, 1410);
  await page.keyboard.press('e');
  await arrived(2, 'truck-arrival-live');
  check('truck checkpoint preserves both preceding areas', await page.evaluate(() => {
    const cp = DM.Bonus.data.checkpoints.long_summer;
    return cp.stage === 2 && cp.carry.flags.rescued === 6 && cp.carry.stats.disintegrated === 0;
  }));
  if (!offline) {
    const checkpoint = await page.evaluate(() => JSON.stringify(DM.Bonus.data.checkpoints.long_summer));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.DM?.dev);
    await page.evaluate(() => {
      DM.Save.settings.focusPause = false;
      DM.Bonus.load();
      DM.Bonus.selectedId = 'long_summer';
      DM.Engine.set(new DM.Scenes.BonusMenu());
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => DM.dev.play()?.ctx.stageIndex === 2);
    const resumed = await read();
    check('reload then menu RESUME preserves the real truck checkpoint', resumed.rescued === 6 &&
      resumed.unmade === 0 && checkpoint === await page.evaluate(() => JSON.stringify(DM.Bonus.data.checkpoints.long_summer)));
    await shot('truck-resumed-live');
  }
  check('no page or engine errors', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ target, checks, errors, minimumHealth, trace,
    mode: offline ? 'inlined/memory storage' : 'normal file loading',
    method: 'Real RAF and keyboard/mouse; first-spawn setup only; known route.' }, null, 2));
  console.log(`LIVE JOURNEY PASSED: ${checks.length} checks; minimum coherence ${minimumHealth.toFixed(2)}.`);
} catch (error) {
  try {
    await shot('failure');
    console.error(await read());
  } catch (_) {}
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
