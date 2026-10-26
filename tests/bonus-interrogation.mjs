/* Focused real-keyboard regression for Rorschach's optional interrogation.
 * Controlled actor placement and a stepped clock isolate retargeting; this is
 * not an unassisted gameplay route. Normal file loading and browser storage.
 * node tests/bonus-interrogation.mjs [index.html|dist/dr-manhattan.html]
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(arg => arg.endsWith('.html')) || 'index.html';
const out = path.join(root, 'tests/out/bonus-interrogation', target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(String(error)));
const check = (name, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  assert.ok(ok, name);
  checks.push(name);
};
const step = seconds => page.evaluate(seconds => T.step(seconds), seconds);
const key = async name => {
  await page.keyboard.down(name);
  await step(0.04);
  await page.keyboard.up(name);
  await step(0.04);
};
const closeDialogue = () => page.evaluate(() => {
  for (let i = 0; i < 20 && T.play().dialog.active; i++) T.play().dialog.advance();
  T.step(0.1);
});

try {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev, null, { polling: 100, timeout: 12000 });
  await page.evaluate(() => {
    DM.Save.settings.focusPause = false;
    DM.Save.settings.textSpeed = 'instant';
    DM.Engine.governor.enabled = false;
    window.T = {
      play: () => DM.dev.play(),
      step(seconds = 0.1) {
        const engine = DM.Engine, render = engine.render;
        engine.render = () => {};
        try {
          for (let i = 0; i < Math.ceil(seconds * 60); i++) {
            engine.frame(engine.last + 1000 / 60);
            if (engine.error) throw engine.error;
          }
        } finally { engine.render = render; }
        engine.render();
      },
      dialogues: 0, markers: 0,
    };
    DM.Engine.set(new DM.Scenes.Play(), { chapter: 'last_broadcast', stage: 0 });
    T.step(0.1);
    for (let i = 0; i < 20 && T.play().dialog.active; i++) T.play().dialog.advance();
    T.step(0.1);
    const play = T.play(), f = play.ctx.flags;
    for (const guard of f.roofGuards) guard.damage(999, play.player, 'impact');
    [T.a, T.b] = f.roofGuards;
    Object.assign(T.a, { x: 400, y: 600, vx: 0, vy: 0 });
    Object.assign(T.b, { x: 650, y: 600, vx: 0, vy: 0 });
    // Hold the companion while the player changes the request, before arrival.
    Object.assign(f.rorschach, { x: 400, y: 900, vx: 0, vy: 0, holdPosition: true });
    const dialogOpen = play.dialog.open.bind(play.dialog);
    play.dialog.open = lines => {
      if (lines.some(line => Array.isArray(line) && line[1].includes('something to bargain with'))) T.dialogues++;
      return dialogOpen(lines);
    };
    const marker = play.ctx.marker.bind(play.ctx);
    play.ctx.marker = (x, y, label) => {
      if (label === 'DISPATCH RECORD') T.markers++;
      marker(x, y, label);
    };
    play.ctx.place(400, 640);
    T.step(0.1);
  });

  await key('e');
  check('E requests guard A before Rorschach arrives', await page.evaluate(() =>
    T.a.interrogating && T.play().ctx.flags.rorschach.taskTarget === T.a && T.dialogues === 0));
  await page.evaluate(() => { T.play().ctx.place(650, 640); T.step(0.1); });
  await key('e');
  check('another E retargets Rorschach to guard B before arrival', await page.evaluate(() =>
    T.b.interrogating && T.play().ctx.flags.rorschach.taskTarget === T.b && T.dialogues === 0));
  await page.evaluate(() => {
    Object.assign(T.play().ctx.flags.rorschach, { x: 650, y: 650, vx: 0, vy: 0 });
    T.step(0.1);
  });
  check('guard B supplies exactly one interrogation and releases the task', await page.evaluate(() =>
    T.play().ctx.flags.interrogated && T.dialogues === 1 && T.markers === 1 &&
    T.play().ctx.flags.rorschach.taskTarget === null));
  await closeDialogue();
  await page.evaluate(() => {
    T.play().ctx.place(400, 640);
    Object.assign(T.play().ctx.flags.rorschach, { x: 400, y: 650, vx: 0, vy: 0 });
    T.step(0.2);
  });
  const after = await page.evaluate(() => ({ dialogues: T.dialogues, markers: T.markers,
    aPending: T.a.interrogating, dialogActive: T.play().dialog.active }));
  writeFileSync(path.join(out, 'retarget.json'), JSON.stringify(after, null, 2));
  await page.screenshot({ path: path.join(out, 'after-retarget.png') });
  check('later approaching guard A does not repeat dialogue or reset the marker',
    after.dialogues === 1 && after.markers === 1 && !after.aPending && !after.dialogActive);
  check('no guard offers another interrogation after the record is revealed', await page.evaluate(() =>
    T.play().ctx.flags.roofGuards.every(guard => !guard.interact || !guard.interact.enabled())));
  await page.evaluate(() => {
    const evidence = T.play().world.entities.find(entity => entity.bit === 1);
    T.play().ctx.place(evidence.x, evidence.y + 40);
    T.step(0.1);
  });
  await key('e');
  check('revealed dispatch evidence is still collected with E', await page.evaluate(() =>
    T.play().ctx.flags.evidence === 1));
  await closeDialogue();
  check('browser and game engine remain error free', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, checks, errors,
    method: 'Normal file navigation; real keyboard E; controlled actor placement and stepped simulation.' }, null, 2));
  console.log(`BONUS INTERROGATION PASSED: ${checks.length} checks (${target}).`);
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') });
  console.error(error);
  process.exitCode = 1;
} finally { await browser.close(); }
