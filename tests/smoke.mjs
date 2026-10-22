/*
 * Smoke test: boots the game in headless Chromium, walks the title screen,
 * then plays every chapter by advancing dialogue and skipping stages, failing
 * on any page error or engine crash. Screenshots go to tests/out/.
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
const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push('console: ' + m.text());
});

const url = pathToFileURL(target).href + '?dev';
await page.goto(url);
await page.waitForFunction(() => window.DM && window.DM.dev, null, { timeout: 10000 });
const shot = (name) => page.screenshot({ path: path.join(out, name + '.png') });
const state = () => page.evaluate(() => window.DM.dev.state());
const wait = (ms) => page.waitForTimeout(ms);

async function check(label) {
  const s = await state();
  if (s.error) throw new Error(`${label}: engine error\n${s.error}`);
  if (errors.length) throw new Error(`${label}: ${errors.join('\n')}`);
  return s;
}

await wait(400);
await shot('00-title-gate');
await page.mouse.click(640, 360);
await wait(600);
await shot('01-title');
await check('title');

const chapters = await page.evaluate(() => window.DM.Chapters.list.map((c) => c.id));
for (const id of chapters) {
  await page.evaluate((cid) => window.DM.Engine.set(new window.DM.Scenes.Interlude(cid)), id);
  await wait(2200);
  await shot(`${id}-0-interlude`);
  await page.evaluate((cid) => window.DM.dev.start(cid, 0), id);
  await wait(1200);
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
      await wait(500);
      await shot(`${id}-2-stage${s.stage}-${s.stageId}`);
      shots++;
    }
    if (s.scene === 'PowerUnlock' || s.dialog || s.scene === 'WatchRepair') {
      await wait(950);
      await page.keyboard.press('e');
      await wait(120);
      continue;
    }
    if (s.scene === 'Play') await page.evaluate(() => window.DM.dev.skip());
    await wait(250);
  }
  const s = await check(`${id} end`);
  if (!done) throw new Error(`${id}: did not complete (stuck at ${JSON.stringify(s)})`);
  await wait(1200);
  await shot(`${id}-3-complete`);
  console.log(`✓ ${id}  (${shots} stages, powers: ${s.powers.join(', ') || 'none'})`);
}

// Every checkpoint must load on its own (this is what "Retry" and "Continue" do).
const cps = await page.evaluate(() =>
  window.DM.Chapters.list.flatMap((c) => c.stages.map((st, i) => (st.checkpoint ? [c.id, i] : null)).filter(Boolean)));
for (const [id, i] of cps) {
  await page.evaluate(([cid, si]) => window.DM.dev.start(cid, si), [id, i]);
  await wait(700);
  const s = await check(`${id} checkpoint ${i}`);
  if (s.stage !== i) throw new Error(`${id} checkpoint ${i} started at stage ${s.stage}`);
}
console.log(`✓ all ${cps.length} checkpoints load directly`);

// Dying shows DECOHERENCE; REASSEMBLE restarts from the checkpoint.
await page.evaluate(() => window.DM.dev.start('deterrent', 2));
await wait(800);
await page.evaluate(() => {
  const play = window.DM.dev.play();
  play.ctx.lock(false);
  play.dialog.close();
  play.player.invuln = 0;
  play.player.damage(999, null, 'test');
});
await wait(2600);
const over = await check('decoherence');
if (over.scene !== 'GameOver') throw new Error('expected GameOver, got ' + over.scene);
await shot('zy-decoherence');
await page.keyboard.press('Enter');
await wait(1600);
const back = await check('retry');
if (back.scene !== 'Play' || back.stage !== 2) throw new Error('retry did not return to the checkpoint: ' + JSON.stringify(back));
console.log('✓ decoherence → reassemble returns to the checkpoint');

await page.evaluate(() => window.DM.Engine.set(new window.DM.Scenes.Ending()));
await wait(1500);
await shot('zz-ending');
await check('ending');

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Smoke test passed.');
