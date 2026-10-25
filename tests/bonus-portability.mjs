/* Backup UI/API checks; no campaign writes. Run on each browser and standalone. */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let pw;
try { pw = require(process.env.PLAYWRIGHT_PATH || 'playwright'); }
catch (_) { pw = require('/opt/pyvenv/lib/python3.13/site-packages/playwright/driver/package'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.env.QA_BROWSER || 'chromium';
const target = process.argv.find(a => a.endsWith('.html')) || 'index.html';
const offline = process.argv.includes('--offline');
const out = path.join(root, 'tests/out/bonus-portability', engine);
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true,
  ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}),
  ...(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const errors = [], checks = [];
page.on('pageerror', e => errors.push(String(e)));
const check = (name, pass) => { assert.ok(pass, name); checks.push(name); console.log('PASS ' + name); };
try {
  if (offline) {
    await page.evaluate(() => {
      const data = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: k => data[k] ?? null, setItem: (k, v) => data[k] = String(v), removeItem: k => delete data[k],
      }, configurable: true });
    });
    let html = readFileSync(path.join(root, target), 'utf8');
    html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
      '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
    await page.setContent(html.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
  } else await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.BonusBackup && DM.dev);
  await page.evaluate(() => {
    DM.Save.settings.focusPause = false;
    window.__campaignBeforeBackup = localStorage.getItem('dr-manhattan.save');
    DM.Engine.set(new DM.Scenes.Play(), { chapter: 'long_summer', stage: 1 });
  });
  const text = await page.evaluate(() => DM.BonusBackup.encode());
  check('export contains bonus progress only', JSON.parse(text).bonus.checkpoints.long_summer.stage === 1 &&
    !Object.hasOwn(JSON.parse(text), 'campaign'));
  check('malformed and wrong-version data are rejected', await page.evaluate(() =>
    ['{}', '{broken', JSON.stringify({ format: 'dr-manhattan-bonus-backup', version: 99 })].every(text => {
      try { DM.BonusBackup.validate(text); return false; } catch (_) { return true; }
    })));
  check('unsafe nested property names are rejected', await page.evaluate(() => {
    try { DM.BonusBackup.validate('{"format":"dr-manhattan-bonus-backup","version":1,"bonus":{"__proto__":{}}}'); }
    catch (_) { return true; }
    return false;
  }));
  check('invalid checkpoints and nonfinite progress are rejected', await page.evaluate(text => {
    const value = JSON.parse(text);
    value.bonus.checkpoints.long_summer.stage = 999;
    try { DM.BonusBackup.validate(JSON.stringify(value)); return false; } catch (_) {}
    value.bonus.checkpoints.long_summer.stage = 1;
    value.bonus.checkpoints.long_summer.carry = { stats: { time: -1 } };
    try { DM.BonusBackup.validate(JSON.stringify(value)); return false; } catch (_) { return true; }
  }, text));
  await page.evaluate(() => {
    DM.Engine.set(new DM.Scenes.BonusMenu());
  });
  const point = await page.evaluate(() => {
    const menu = DM.Engine.top().menu;
    const i = menu.items.findIndex(item => item.label === 'BACK UP / RESTORE BONUS SAVES');
    const r = menu.rowRect(i), e = DM.Engine;
    return { x: e.offX + (r.x + 100) * e.scale, y: e.offY + (r.y + r.h / 2) * e.scale };
  });
  await page.mouse.click(point.x, point.y);
  await page.locator('#bonus-backup').waitFor();
  check('backup dialog opens from the actual menu', await page.locator('#bonus-backup').isVisible());
  await page.keyboard.press('Tab');
  const fileFocused = await page.evaluate(() => document.activeElement.id === 'bonus-backup-file');
  await page.keyboard.press('Tab');
  const backFocused = await page.evaluate(() => document.activeElement.textContent === 'BACK TO BONUS LEVELS');
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => document.activeElement.textContent === 'EXPORT BONUS BACKUP');
  await page.keyboard.press('Shift+Tab');
  const reverseWrapped = await page.evaluate(() => document.activeElement.textContent === 'BACK TO BONUS LEVELS');
  check('Tab and Shift+Tab reach every enabled control and wrap once',
    fileFocused && backFocused && wrapped && reverseWrapped);
  await page.keyboard.press('Tab');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT BONUS BACKUP', exact: true }).click();
  const download = await downloadPromise;
  const downloaded = JSON.parse(readFileSync(await download.path(), 'utf8'));
  check('export button creates a usable JSON download', downloaded.format === 'dr-manhattan-bonus-backup');
  const beforeInvalid = await page.evaluate(() => JSON.stringify(DM.Bonus.data));
  await page.locator('#bonus-backup-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.waitForFunction(() => document.querySelector('#bonus-backup-status').textContent.includes('not a valid'));
  check('bad file never enables restore or edits progress', await page.getByRole('button', { name: 'RESTORE THIS BACKUP' }).isDisabled() &&
    beforeInvalid === await page.evaluate(() => JSON.stringify(DM.Bonus.data)));
  await page.evaluate(() => {
    window.__fileText = File.prototype.text;
    File.prototype.text = function () {
      const result = window.__fileText.call(this);
      return this.name === 'slow.json' ? new Promise(resolve => setTimeout(() => resolve(result), 350)) : result;
    };
  });
  await page.locator('#bonus-backup-file').setInputFiles({
    name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from(text)
  });
  await page.locator('#bonus-backup-file').setInputFiles({
    name: 'latest-invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad')
  });
  await page.waitForTimeout(650);
  check('an older slow file cannot replace the latest invalid selection',
    await page.getByRole('button', { name: 'RESTORE THIS BACKUP' }).isDisabled() &&
    await page.locator('#bonus-backup-status').textContent().then(t => t.includes('not a valid')));
  await page.evaluate(() => { File.prototype.text = window.__fileText; delete window.__fileText; });
  await page.evaluate(() => {
    delete DM.Bonus.data.checkpoints.long_summer;
    DM.Bonus.data.checkpoints.last_broadcast = { stage: 1, carry: null };
    DM.Bonus.write();
  });
  await page.locator('#bonus-backup-file').setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction(() => document.querySelector('#bonus-backup-status').textContent.includes('Ready to restore'));
  check('file selection is a preview, not an implicit overwrite', await page.evaluate(() =>
    !DM.Bonus.data.checkpoints.long_summer));
  await page.getByRole('button', { name: 'RESTORE THIS BACKUP', exact: true }).click();
  check('explicit restore restores the checkpoint and preserves other adventures', await page.evaluate(() =>
    DM.Bonus.data.checkpoints.long_summer.stage === 1 && DM.Bonus.data.checkpoints.last_broadcast.stage === 1));
  check('campaign save remains byte-for-byte unchanged', await page.evaluate(() =>
    localStorage.getItem('dr-manhattan.save') === window.__campaignBeforeBackup));
  check('blocked persistence never mutates in-memory progress', await page.evaluate(text => {
    const before = JSON.stringify(DM.Bonus.data), descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    try {
      Object.defineProperty(window, 'localStorage', { value: { setItem() { throw new Error('blocked'); } }, configurable: true });
      try { DM.BonusBackup.restore(text); return false; } catch (_) { return JSON.stringify(DM.Bonus.data) === before; }
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
      else delete window.localStorage;
    }
  }, text));
  await page.screenshot({ path: path.join(out, 'backup-restored.png') });
  await page.keyboard.press('Escape');
  check('Escape closes the dialog and refreshes Resume', await page.evaluate(() =>
    !document.getElementById('bonus-backup') && DM.Engine.top().menu.items[0].label === 'RESUME ADVENTURE'));
  const fresh = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  fresh.on('pageerror', e => errors.push(String(e)));
  const otherTarget = target.startsWith('dist/') ? 'index.html' : 'dist/dr-manhattan.html';
  if (offline) {
    await fresh.evaluate(() => {
      const store = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = String(v), removeItem: k => delete store[k]
      } });
    });
    let otherHtml = readFileSync(path.join(root, otherTarget), 'utf8');
    otherHtml = otherHtml.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
      '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
    await fresh.setContent(otherHtml.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
  } else await fresh.goto(pathToFileURL(path.join(root, otherTarget)).href, { waitUntil: 'domcontentloaded' });
  await fresh.waitForFunction(() => window.DM?.BonusBackup && DM.dev);
  const initial = await fresh.evaluate(() => ({ bonus: DM.Bonus.load(), campaign: localStorage.getItem('dr-manhattan.save') }));
  assert.equal(Object.keys(initial.bonus.checkpoints).length, 0, 'new browser profile must start empty');
  await fresh.evaluate(() => { DM.Engine.set(new DM.Scenes.BonusMenu()); DM.BonusBackup.open(); });
  await fresh.locator('#bonus-backup-file').setInputFiles({
    name: 'exported-on-other-copy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(downloaded))
  });
  await fresh.getByRole('button', { name: 'RESTORE THIS BACKUP', exact: true }).click();
  const restored = await fresh.evaluate(() => ({
    checkpoint: DM.Bonus.load().checkpoints.long_summer,
    raw: localStorage.getItem('dr-manhattan.bonus.v1'), campaign: localStorage.getItem('dr-manhattan.save')
  }));
  assert.deepEqual(restored.checkpoint, downloaded.bonus.checkpoints.long_summer);
  check('downloaded backup transfers to a different game copy in an empty browser profile',
    restored.campaign === initial.campaign);
  if (!offline) {
    await fresh.reload({ waitUntil: 'domcontentloaded' });
    await fresh.waitForFunction(() => window.DM?.BonusBackup && DM.dev);
    check('transferred progress persists after reloading the other copy', restored.raw ===
      await fresh.evaluate(() => localStorage.getItem('dr-manhattan.bonus.v1')));
  }
  await fresh.close();
  check('no browser errors', errors.length === 0);
  console.log(`BONUS PORTABILITY PASSED: ${checks.length} checks (${engine}, ${target}).`);
} catch (error) {
  try { await page.screenshot({ path: path.join(out, 'failure.png') }); } catch (_) {}
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, target, offline, checks, errors }, null, 2));
  await browser.close();
}
