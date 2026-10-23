/*
 * Smoke test: boots the game in headless Chromium, walks the title screen,
 * then plays every chapter by advancing dialogue and skipping stages, failing
 * on any page error or engine crash. Screenshots go to tests/out/.
 *
 * Time is game time: the test steps the simulation with DM.dev.advance (fixed
 * 60 Hz steps; between calls nothing moves and frames only draw the latest
 * state), so screenshots and checks see exactly the game time asked for.
 *
 *   node tests/smoke.mjs            (uses Playwright; set PLAYWRIGHT_PATH if it isn't resolvable)
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
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
const out = path.join(root, 'tests', 'out');
mkdirSync(out, { recursive: true });

const errors = [];
const started = Date.now();
const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push('console: ' + m.text());
});

const url = pathToFileURL(target).href + '?dev';
await page.goto(url);
await page.waitForFunction(() => window.DM && window.DM.dev, null, { timeout: 10000 });
// Draw the latest state (the next animation frame renders it), then capture.
const shot = async (name) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.screenshot({ path: path.join(out, name + '.png') });
};
const state = () => page.evaluate(() => window.DM.dev.state());
const advance = (s) => page.evaluate((s) => window.DM.dev.advance(s), s);

async function check(label) {
  const s = await state();
  if (s.error) throw new Error(`${label}: engine error\n${s.error}`);
  if (errors.length) throw new Error(`${label}: ${errors.join('\n')}`);
  return s;
}

await advance(0.4);
await shot('00-title-gate');
await page.mouse.click(640, 360);
await advance(0.6);
await shot('01-title');
await check('title');

const chapters = await page.evaluate(() => window.DM.Chapters.list.map((c) => c.id));
for (const id of chapters) {
  await page.evaluate((cid) => window.DM.Engine.set(new window.DM.Scenes.Interlude(cid)), id);
  await advance(2.2);
  await shot(`${id}-0-interlude`);
  await page.evaluate((cid) => window.DM.dev.start(cid, 0), id);
  await advance(1.2);
  await shot(`${id}-1-start`);
  let shots = 0;
  let lastStage = -1;
  let done = false;
  for (let i = 0; i < 400 && !done; i++) {
    const s = await check(`${id} step ${i}`);
    if (s.scene === 'ChapterComplete' || s.scene === 'Interlude' || s.scene === 'Ending') {
      done = true;
      break;
    }
    if (s.stage !== lastStage) {
      lastStage = s.stage;
      await advance(0.5);
      await shot(`${id}-2-stage${s.stage}-${s.stageId}`);
      shots++;
    }
    if (s.scene === 'PowerUnlock' || s.dialog || s.scene === 'WatchRepair') {
      await advance(0.95);
      await page.keyboard.press('e');
      await advance(0.12);
      continue;
    }
    if (s.scene === 'Play') await page.evaluate(() => window.DM.dev.skip());
    await advance(0.25);
  }
  const s = await check(`${id} end`);
  if (!done) throw new Error(`${id}: did not complete (stuck at ${JSON.stringify(s)})`);
  await advance(1.2);
  await shot(`${id}-3-complete`);
  console.log(`✓ ${id}  (${shots} stages, powers: ${s.powers.join(', ') || 'none'})`);
}

// Every checkpoint must load on its own (this is what "Retry" and "Continue" do).
const cps = await page.evaluate(() =>
  window.DM.Chapters.list.flatMap((c) => c.stages.map((st, i) => (st.checkpoint ? [c.id, i] : null)).filter(Boolean)));
for (const [id, i] of cps) {
  await page.evaluate(([cid, si]) => window.DM.dev.start(cid, si), [id, i]);
  await advance(0.7);
  const s = await check(`${id} checkpoint ${i}`);
  if (s.stage !== i) throw new Error(`${id} checkpoint ${i} started at stage ${s.stage}`);
}
console.log(`✓ all ${cps.length} checkpoints load directly`);

// Dying shows DECOHERENCE; REASSEMBLE restarts from the checkpoint.
await page.evaluate(() => window.DM.dev.start('deterrent', 2));
await advance(0.8);
await page.evaluate(() => {
  const play = window.DM.dev.play();
  play.ctx.lock(false);
  play.dialog.close();
  play.player.locked = false; // a locked (cutscene) player takes no damage; Play.update would clear this next frame
  play.player.invuln = 0;
  play.player.damage(999, null, 'test');
});
await advance(2.6);
const over = await check('decoherence');
if (over.scene !== 'GameOver') throw new Error('expected GameOver, got ' + over.scene);
await shot('zy-decoherence');
await page.keyboard.press('Enter');
await advance(1.6);
const back = await check('retry');
if (back.scene !== 'Play' || back.stage !== 2) throw new Error('retry did not return to the checkpoint: ' + JSON.stringify(back));
console.log('✓ decoherence → reassemble returns to the checkpoint');

await page.evaluate(() => window.DM.Engine.set(new window.DM.Scenes.Ending()));
await advance(1.5);
await shot('zz-ending');
await check('ending');

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`(${((Date.now() - started) / 1000).toFixed(1)} s wall clock)`);
console.log('Smoke test passed.');
