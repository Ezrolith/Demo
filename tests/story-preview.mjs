/* Verify that the quick-review chooser uses real scenes but never production saves. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await pw.chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dr-manhattan.save', 'preview-sentinel');
    const set = Storage.prototype.setItem;
    window.__previewWrites = 0;
    Storage.prototype.setItem = function(...args) { window.__previewWrites++; return set.apply(this, args); };
  });
  await page.goto(pathToFileURL(process.argv[2] || path.join(root, 'dist/story-preview.html')).href);
  await page.waitForFunction(() => window.DM?.dev && !document.querySelector('[data-sample]').disabled);
  const options = [['pier','superman'], ['getaway','superman'], ['lockdown','prologue'], ['gentle','gentle'], ['mixed','mixed'], ['detached','detached']];
  for (const [sample, expected] of options) {
    await page.locator(`[data-sample="${sample}"]`).click();
    await page.waitForFunction(() => document.getElementById('story-chooser').hidden);
    const state = await page.evaluate(() => {
      const D=window.DM,p=D.dev.play();
      return { value:p?.chapter.id || D.Engine.top().tone, stored:localStorage.getItem('dr-manhattan.save'), writes:window.__previewWrites };
    });
    assert.equal(state.value, expected, sample);
    assert.equal(state.stored, 'preview-sentinel', 'preview must preserve the real save');
    assert.equal(state.writes, 0, 'preview must not write storage');
    console.log(`✓ ${sample}: correct scene; saved game untouched`);
    await page.locator('#preview-open').click();
    await page.waitForFunction(() => !document.getElementById('story-chooser').hidden);
  }
  await page.evaluate(() => { window.DM.Save.reset(); window.DM.Save.write(); window.DM.Save.load(); });
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('dr-manhattan.save'),window.__previewWrites]), ['preview-sentinel',0]);
  assert.deepEqual(errors, []);
  console.log('✓ reset/load/write remain save-isolated; no browser errors');
} finally { await browser.close(); }
