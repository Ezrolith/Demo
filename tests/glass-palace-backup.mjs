/* Portable palace progress and the actual file-preview modal.
 * Controlled save fixtures are used; this is not natural challenge-play evidence.
 * node tests/glass-palace-backup.mjs [index.html|dist/dr-manhattan.html]
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find((value) => value.endsWith('.html')) || 'index.html';
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');
const build = target.includes('dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/glass-palace-backup', engine, build);
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const page = await context.newPage();
const checks = [];
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (fn) => page.waitForFunction(fn, null, { polling: 100 });
const check = (name, result) => {
  assert.ok(result, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const palaceKey = 'dr-manhattan.glass-palace.v1';
const packet = (data) => JSON.stringify({ format: 'dr-manhattan.glass-palace.backup', version: 1, data });
const progress = (count = 2) => ({
  version: 1,
  challenges: { prologue: count === 3 ? { mercy: true, swift: true, detail: true } : { mercy: true, detail: true } },
  epilogueSeen: { return: true },
  visits: 5,
});
const file = (name, text) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
const seed = async (data = progress()) => ev((data) => {
  const GP = DM.GlassPalace;
  window.__storageBlock = false;
  window.__nativeSet.call(localStorage, GP.key, JSON.stringify(data));
  GP.data = GP.sanitize(data);
  GP.available = true;
  GP.readOnly = false;
  GP.warning = '';
  window.__writes = [];
}, data);
const unchanged = async () => ev(() =>
  JSON.stringify(T.protected()) === JSON.stringify(window.__protectedBefore) &&
  window.__writes.every((key) => key === DM.GlassPalace.key));
const open = async () => ev(() => {
  DM.Input.clearAll();
  DM.Engine.push(new DM.GlassPalace.BackupScreen(window.__hub));
});
const status = () => page.locator('#glass-palace-backup [role="status"]').textContent();
const restore = () => page.getByRole('button', { name: 'RESTORE THIS PALACE PROGRESS', exact: true });

try {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.__storageBlock = false;
    window.__writes = [];
    window.__nativeSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dr-manhattan.glass-palace.v1' && window.__storageBlock)
        throw new DOMException('Storage blocked', 'QuotaExceededError');
      window.__writes.push(key);
      return window.__nativeSet.call(this, key, value);
    };
    localStorage.setItem('dr-manhattan.save', JSON.stringify({
      version: 2,
      reached: 0,
      settings: { focusPause: false, textSpeed: 'instant', invulnerable: false, challenge: 'normal' },
      totals: { spared: 7, disintegrated: 2, memories: 0, decoherences: 0 },
    }));
    localStorage.setItem('dr-manhattan.bonus.v1', ' {"version":1,"completed":{},"checkpoints":{}} ');
    localStorage.setItem('dr-manhattan.after-midnight.v1', ' {"version":1,"records":{},"checkpoints":{}} ');
  });
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.Engine.canvas &&
    DM.GlassPalace?.BackupScreen && DM.GlassPalace.Backup, null, { polling: 100 });
  await ev(() => {
    window.T = {
      protected() {
        return {
          slots: Object.fromEntries(Object.values(DM.GlassPalace.sourceKeys)
            .map((key) => [key, localStorage.getItem(key)])),
          settings: JSON.stringify(DM.Save.settings),
        };
      },
      rejected(text) {
        try {
          DM.GlassPalace.Backup.decode(text);
          return false;
        } catch (_) {
          return true;
        }
      },
    };
    window.__protectedBefore = T.protected();
    DM.Engine.governor.enabled = false;
  });
  await seed();
  const encoded = await ev(() => DM.GlassPalace.Backup.encode());
  check('export has the palace-specific versioned envelope', (() => {
    const value = JSON.parse(encoded);
    return value.format === 'dr-manhattan.glass-palace.backup' && value.version === 1;
  })());
  check('decode returns a detached sanitized preview with exact counts', await ev((encoded) => {
    const GP = DM.GlassPalace;
    const value = GP.Backup.decode(encoded);
    value.data.challenges.prologue.swift = true;
    return value.countFragments === 2 && value.countEpilogues === 1 && value.visits === 5 &&
      GP.data.challenges.prologue.swift === undefined;
  }, encoded));
  check('preview and export never write source slots or settings', await unchanged());
  check('blocked-storage session progress is still exportable without writes', await ev(() => {
    const GP = DM.GlassPalace;
    GP.data.challenges.prologue.swift = true;
    GP.available = false;
    GP.warning = 'session fixture';
    window.__storageBlock = true;
    const before = window.__writes.length;
    const preview = GP.Backup.decode(GP.Backup.encode());
    return preview.countFragments === 3 && before === window.__writes.length &&
      GP.available === false && GP.warning === 'session fixture';
  }));
  await seed();
  const failures = [
    ['unreadable JSON is rejected', '{'],
    ['non-object packets are rejected', '[]'],
    ['other progress formats are rejected', JSON.stringify({ format: 'dr-manhattan-after-midnight', version: 1 })],
    ['future wrapper versions are rejected', encoded.replace('"version": 1', '"version": 2')],
    ['unexpected envelope fields are rejected', JSON.stringify({ ...JSON.parse(encoded), campaign: {} })],
    ['missing progress data is rejected', JSON.stringify({ format: 'dr-manhattan.glass-palace.backup', version: 1 })],
    ['future palace data versions are rejected', packet({ ...progress(), version: 3 })],
    ['unknown progress fields are rejected', packet({ ...progress(), sourceSlots: {} })],
    ['unknown moments are rejected', packet({ ...progress(), challenges: { imaginary: { mercy: true } } })],
    ['unknown challenge names are rejected', packet({ ...progress(), challenges: { prologue: { invented: true } } })],
    ['non-boolean challenge values are rejected', packet({ ...progress(), challenges: { prologue: { mercy: 'true' } } })],
    ['unknown reflections are rejected', packet({ ...progress(), epilogueSeen: { invented: true } })],
    ['non-boolean reflections are rejected', packet({ ...progress(), epilogueSeen: { return: 1 } })],
    ['negative visit counts are rejected', packet({ ...progress(), visits: -1 })],
    ['fractional visit counts are rejected', packet({ ...progress(), visits: 1.2 })],
    ['unsafe nested JSON fields are rejected', encoded.replace('"mercy": true', '"__proto__": {}, "mercy": true')],
    ['oversized text is rejected', ' '.repeat(256 * 1024 + 1)],
    ['the size limit counts UTF-8 bytes', 'é'.repeat(128 * 1024 + 1)],
  ];
  for (const [name, text] of failures) check(name, await ev((text) => T.rejected(text), text));
  check('all rejected previews preserve existing progress and protected slots', await ev(() =>
    DM.GlassPalace.fragmentCount() === 2 && window.__writes.length === 0) && await unchanged());
  check('restore commits only the palace slot and clears a session warning', await ev((text) => {
    const GP = DM.GlassPalace;
    GP.available = false;
    GP.warning = 'session fixture';
    const result = GP.Backup.restore(text);
    return result.countFragments === 3 && GP.fragmentCount() === 3 && GP.available && !GP.readOnly &&
      GP.warning === '' && JSON.parse(localStorage.getItem(GP.key)).challenges.prologue.swift === true &&
      JSON.stringify(window.__writes) === JSON.stringify([GP.key]);
  }, packet(progress(3))) && await unchanged());
  await seed();
  check('failed writes preserve the exact session object, flags and stored bytes', await ev((text) => {
    const GP = DM.GlassPalace;
    const before = { data: GP.data, json: JSON.stringify(GP.data), raw: localStorage.getItem(GP.key) };
    GP.available = false;
    GP.warning = 'preserve this warning';
    window.__storageBlock = true;
    let rejected = false;
    try { GP.Backup.restore(text); } catch (_) { rejected = true; }
    return rejected && GP.data === before.data && JSON.stringify(GP.data) === before.json &&
      GP.available === false && GP.readOnly === false && GP.warning === 'preserve this warning' &&
      localStorage.getItem(GP.key) === before.raw;
  }, packet(progress(3))));
  await seed();
  check('protected session state cannot be replaced by restore', await ev((text) => {
    const GP = DM.GlassPalace;
    const before = GP.data;
    GP.readOnly = true;
    GP.available = false;
    GP.warning = 'protected fixture';
    let rejected = false;
    try { GP.Backup.restore(text); } catch (_) { rejected = true; }
    return rejected && GP.data === before && GP.readOnly && !GP.available &&
      GP.warning === 'protected fixture' && window.__writes.length === 0;
  }, encoded));
  await seed();
  check('a newer stored palace is protected even before the session reloads', await ev((text) => {
    const GP = DM.GlassPalace;
    const raw = '{"version":99,"future":"preserve"}';
    window.__nativeSet.call(localStorage, GP.key, raw);
    const before = GP.data;
    let rejected = false;
    try { GP.Backup.restore(text); } catch (_) { rejected = true; }
    return rejected && GP.data === before && localStorage.getItem(GP.key) === raw && window.__writes.length === 0;
  }, encoded));
  await seed();
  check('an unreadable stored palace is protected from overwrite', await ev((text) => {
    const GP = DM.GlassPalace;
    window.__nativeSet.call(localStorage, GP.key, '{unreadable');
    let rejected = false;
    try { GP.Backup.restore(text); } catch (_) { rejected = true; }
    return rejected && localStorage.getItem(GP.key) === '{unreadable' && window.__writes.length === 0;
  }, encoded));
  await seed();
  await ev(() => {
    window.__hub = new DM.Scenes.GlassPalace();
    DM.Engine.set(window.__hub);
    window.__writes = [];
  });
  await open();
  check('the native backup dialog is labelled and focuses Export', await ev(() => {
    const root = document.getElementById('glass-palace-backup');
    return root.getAttribute('role') === 'dialog' && root.getAttribute('aria-modal') === 'true' &&
      document.activeElement.textContent === 'EXPORT PALACE PROGRESS';
  }));
  check('Restore is disabled until a compatible file is previewed', await restore().isDisabled());
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT PALACE PROGRESS', exact: true }).click();
  const download = await downloadPromise;
  const downloaded = JSON.parse(readFileSync(await download.path(), 'utf8'));
  check('Export downloads the actual current palace progress', downloaded.format === 'dr-manhattan.glass-palace.backup' &&
    downloaded.data.challenges.prologue.detail === true && download.suggestedFilename() === 'glass-palace-progress.json');
  await page.keyboard.press('Shift+Tab');
  check('Shift+Tab wraps from Export to Back while Restore is disabled', await ev(() =>
    document.activeElement.textContent === 'BACK TO THE PALACE'));
  await page.keyboard.press('Tab');
  check('Tab wraps from Back to Export', await ev(() => document.activeElement.textContent === 'EXPORT PALACE PROGRESS'));
  await page.locator('#glass-palace-backup input').setInputFiles(file('valid.json', packet(progress(3))));
  await wait(() => !document.querySelector('#glass-palace-backup button:nth-of-type(2)').disabled);
  check('choosing a file previews counts without changing stored progress', (await status()).includes('3 fragment(s)') &&
    await ev(() => DM.GlassPalace.fragmentCount() === 2 && window.__writes.length === 0));
  await restore().click();
  check('explicit Restore updates palace progress and reports the result', (await status()).startsWith('Restored 3 fragment(s)') &&
    await ev(() => DM.GlassPalace.fragmentCount() === 3));
  check('successful restore disables its old action and moves focus to Back', await restore().isDisabled() &&
    await ev(() => document.activeElement.textContent === 'BACK TO THE PALACE'));
  await page.keyboard.press('Escape');
  check('Escape closes the modal and the normal hub resume rebuilds its structure', await ev(() =>
    !document.getElementById('glass-palace-backup') && DM.Engine.top() === window.__hub &&
    window.__hub.structureCount === 3 && document.activeElement === DM.Engine.canvas));
  check('all API and native modal actions preserve source-slot bytes and settings', await unchanged());
  await open();
  await page.locator('#glass-palace-backup input').setInputFiles(file('bad.json', '{'));
  await wait(() => document.querySelector('#glass-palace-backup [role="status"]').textContent.includes('not be read'));
  check('an invalid file cannot enable Restore or alter progress', await restore().isDisabled() &&
    await ev(() => DM.GlassPalace.fragmentCount() === 3));
  await ev(() => {
    window.__fileText = File.prototype.text;
    window.__reads = {};
    File.prototype.text = function () {
      if (!this.name.startsWith('delay-')) return window.__fileText.call(this);
      return new Promise((resolve) => { window.__reads[this.name] = resolve; });
    };
  });
  await page.locator('#glass-palace-backup input').setInputFiles(file('delay-old.json', encoded));
  await wait(() => !!window.__reads['delay-old.json']);
  await page.locator('#glass-palace-backup input').setInputFiles(file('delay-new.json', packet(progress(3))));
  await wait(() => !!window.__reads['delay-new.json']);
  await ev((text) => window.__reads['delay-new.json'](text), packet(progress(3)));
  await wait(() => document.querySelector('#glass-palace-backup [role="status"]').textContent.startsWith('3 fragment(s)'));
  await ev((text) => window.__reads['delay-old.json'](text), encoded);
  check('a superseded slow file cannot replace the latest preview', (await status()).startsWith('3 fragment(s)') &&
    !await restore().isDisabled());
  await page.locator('#glass-palace-backup input').setInputFiles(file('delay-close.json', encoded));
  await wait(() => !!window.__reads['delay-close.json']);
  check('selecting another file immediately clears the old pending restore', await restore().isDisabled());
  await page.keyboard.press('Escape');
  await open();
  await ev((text) => window.__reads['delay-close.json'](text), encoded);
  check('a read completing after close cannot affect a newly opened dialog', (await status()) === '' &&
    await restore().isDisabled());
  await ev(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.keyboard.press('Tab');
  check('Tab recovers focus from outside the modal', await ev(() =>
    document.activeElement.textContent === 'EXPORT PALACE PROGRESS'));
  await page.keyboard.press('Escape');
  check('closing removes the modal keyboard listener without swallowing later keys', await ev(() => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return !event.defaultPrevented && !document.getElementById('glass-palace-backup');
  }));
  check('race and cleanup checks preserve source slots and settings', await unchanged());
  check('no uncaught browser errors', errors.length === 0);
  const finalLine = `GLASS PALACE BACKUP PASSED: ${checks.length} checks (${engine}, ${target}).`;
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, target, checks, errors, finalLine, exit: 0 }, null, 2));
  console.log(finalLine);
} catch (error) {
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, target, checks, errors, error: String(error), exit: 1 }, null, 2));
  throw error;
} finally {
  await browser.close();
}
