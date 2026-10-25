/* Real storage fault injection: warn before session-only bonus progress is lost. */
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
const target = process.argv.find(arg => arg.endsWith('.html')) || 'index.html';
const engine = process.env.QA_BROWSER || 'chromium';
const out = path.join(root, 'tests/out/bonus-storage', engine, target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true,
  ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}),
  ...(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(String(error)));
const check = (label, pass) => { assert.ok(pass, label); checks.push(label); console.log('PASS ' + label); };
const menuDrawn = async () => {
  await page.evaluate(() => { window.__storageDrawn.clear(); });
  await page.waitForTimeout(100);
  return page.evaluate(() => [...window.__storageDrawn]);
};
try {
  await page.addInitScript(() => {
    window.__storageFault = { read: false, write: false };
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'dr-manhattan.bonus.v1' && window.__storageFault.read) {
        throw new DOMException('Site storage is blocked', 'SecurityError');
      }
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dr-manhattan.bonus.v1' && window.__storageFault.write) {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      }
      return set.call(this, key, value);
    };
  });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.BonusBackup && DM.dev);
  const campaignBefore = await page.evaluate(() => {
    DM.Save.settings.focusPause = false;
    DM.Save.settings.music = 0.3;
    DM.Save.write();
    window.__storageDrawn = new Set();
    const text = DM.Gfx.text;
    DM.Gfx.text = function (ctx, value, ...args) {
      __storageDrawn.add(String(value));
      return text.call(this, ctx, value, ...args);
    };
    __storageFault.read = true;
    DM.Engine.set(new DM.Scenes.BonusMenu());
    return localStorage.getItem('dr-manhattan.save');
  });
  check('a blocked bonus read is identified without disabling campaign storage', await page.evaluate(() =>
    !DM.Bonus.available && DM.Save.available && !DM.Engine.error));
  let drawn = await menuDrawn();
  check('Bonus Levels explains session-only progress and exporting before closing', drawn.some(text =>
    text.includes('BONUS PROGRESS IS SESSION ONLY') && text.includes('EXPORT A BACKUP BEFORE CLOSING')));
  await page.screenshot({ path: path.join(out, 'read-failure-menu.png') });

  await page.evaluate(() => {
    __storageFault.read = false;
    __storageFault.write = true;
    DM.Engine.set(new DM.Scenes.Play(), { chapter: 'long_summer', stage: 0 });
  });
  await page.waitForFunction(() => DM.Bonus.data.checkpoints.long_summer && DM.dev.play()?.hud.toasts.some(toast =>
    toast.text.includes('BONUS PROGRESS COULD NOT BE SAVED')));
  check('a failed automatic checkpoint warns in game while retaining progress in memory', await page.evaluate(() =>
    !DM.Bonus.available && DM.Bonus.data.checkpoints.long_summer.stage === 0 &&
    localStorage.getItem('dr-manhattan.bonus.v1') === null &&
    DM.dev.play().hud.toasts.filter(toast => toast.text.includes('BONUS PROGRESS COULD NOT BE SAVED')).length === 1));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, 'write-failure-game.png') });
  check('repeated failed writes retain the latest checkpoint without repeating the warning', await page.evaluate(() => {
    const carry = DM.dev.play().ctx.snapshot();
    carry.stats.spared = 3;
    DM.Bonus.checkpointAt('long_summer', 1, carry);
    DM.Bonus.write();
    DM.Bonus.write();
    return DM.Bonus.data.checkpoints.long_summer.stage === 1 &&
      DM.dev.play().hud.toasts.filter(toast => toast.text.includes('BONUS PROGRESS COULD NOT BE SAVED')).length === 1;
  }));
  await page.evaluate(() => DM.Engine.set(new DM.Scenes.BonusMenu()));
  drawn = await menuDrawn();
  check('the storage warning persists after returning from the game to Bonus Levels',
    drawn.some(text => text.includes('BONUS PROGRESS IS SESSION ONLY')));
  await page.screenshot({ path: path.join(out, 'write-failure-menu.png') });
  const point = await page.evaluate(() => {
    const menu = DM.Engine.top().menu;
    const row = menu.items.findIndex(item => item.label === 'BACK UP / RESTORE BONUS SAVES');
    const rect = menu.rowRect(row), e = DM.Engine;
    return { x: e.offX + (rect.x + 100) * e.scale, y: e.offY + (rect.y + rect.h / 2) * e.scale };
  });
  await page.mouse.click(point.x, point.y);
  await page.locator('#bonus-backup').waitFor();
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT BONUS BACKUP', exact: true }).click();
  const download = await pendingDownload;
  const backupText = readFileSync(await download.path(), 'utf8');
  const backup = JSON.parse(backupText);
  check('the actual export button rescues the latest unsaved progress as a usable backup',
    backup.bonus.checkpoints.long_summer.stage === 1 && backup.bonus.checkpoints.long_summer.carry.stats.spared === 3 &&
    !Object.hasOwn(backup, 'campaign'));
  check('a failed restore preserves in-memory progress and its session-only warning', await page.evaluate(text => {
    const before = JSON.stringify(DM.Bonus.data);
    let rejected = false;
    try { DM.BonusBackup.restore(text); } catch (error) { rejected = /blocked saving/.test(error.message); }
    return rejected && !DM.Bonus.available && JSON.stringify(DM.Bonus.data) === before;
  }, backupText));
  check('a successful write recovers persistence for all retained progress', await page.evaluate(() => {
    __storageFault.write = false;
    DM.Bonus.write();
    const disk = JSON.parse(localStorage.getItem('dr-manhattan.bonus.v1'));
    return DM.Bonus.available && disk.checkpoints.long_summer.stage === 1 &&
      disk.checkpoints.long_summer.carry.stats.spared === 3;
  }));
  await page.keyboard.press('Escape');
  await page.locator('#bonus-backup').waitFor({ state: 'detached' });
  drawn = await menuDrawn();
  check('the menu removes the warning only after saving succeeds',
    !drawn.some(text => text.includes('BONUS PROGRESS IS SESSION ONLY')) &&
    drawn.some(text => text.includes('SEPARATE BONUS SAVES')));
  await page.screenshot({ path: path.join(out, 'recovered-menu.png') });

  await page.evaluate(() => {
    DM.Engine.set(new DM.Scenes.Play(), { chapter: 'long_summer', stage: 0 });
    __storageFault.write = true;
    DM.Bonus.write();
  });
  // This fixture starts Play directly, unlike the menu-only restore UI. Wait
  // for its first-frame checkpoint before restoring another checkpoint below.
  await page.waitForFunction(() => DM.dev.play()?.ctx.checkpointCarry &&
    DM.Bonus.data.checkpoints.long_summer?.stage === 0 && DM.Bonus.data.checkpoints.long_summer.carry,
    null, { polling: 50, timeout: 5000 });
  check('a later independent storage failure warns again after recovery', await page.evaluate(() =>
    !DM.Bonus.available && DM.dev.play().hud.toasts.filter(toast =>
      toast.text.includes('BONUS PROGRESS COULD NOT BE SAVED')).length === 1));
  check('a successful backup restore also clears the storage-failure status', await page.evaluate(text => {
    __storageFault.write = false;
    DM.BonusBackup.restore(text);
    return DM.Bonus.available && JSON.parse(localStorage.getItem('dr-manhattan.bonus.v1')).checkpoints.long_summer.stage === 1;
  }, backupText));
  check('campaign progress and settings are unchanged by bonus failures and recovery',
    campaignBefore === await page.evaluate(() => localStorage.getItem('dr-manhattan.save')));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.BonusBackup && DM.dev);
  check('recovered bonus progress survives a real reload', await page.evaluate(() =>
    DM.Bonus.load().checkpoints.long_summer.stage === 1 &&
    DM.Bonus.data.checkpoints.long_summer.carry.stats.spared === 3 && DM.Bonus.available));
  check('storage failures produce no browser errors', errors.length === 0);
  writeFileSync(path.join(out, 'result.json'), JSON.stringify({ target, engine, checks, errors }, null, 2));
  console.log(`BONUS STORAGE PASSED: ${checks.length} checks (normal file loading).`);
} finally {
  await browser.close();
}
