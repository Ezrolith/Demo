/* Actual menu navigation and ten-second live UI captures, without render edits. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.CAPTURE_ROOT || here);
const out = path.resolve(process.env.CAPTURE_OUT || path.join(here, 'tests/out/part-a-menu'));
const label = process.env.CAPTURE_LABEL || 'after';
assert.match(label, /^[a-zA-Z0-9_-]+$/);
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], records = [];
page.on('pageerror', error => errors.push(String(error)));
const capture = async name => {
  const start = await page.evaluate(() => performance.now());
  await page.waitForTimeout(10000);
  const data = await page.evaluate(start => {
    const board = DM.Engine.top();
    return {
      png: DM.Engine.canvas.toDataURL('image/png').split(',')[1],
      seconds: (performance.now() - start) / 1000,
      step: board.step || 'combined',
      hero: board.selected().hero.id,
      items: board.menu.items.map(item => item.label),
      error: DM.Engine.error ? String(DM.Engine.error) : null,
    };
  }, start);
  const file = `${name}-${label}-live.png`;
  writeFileSync(path.join(out, file), Buffer.from(data.png, 'base64'));
  delete data.png;
  assert.ok(data.seconds >= 10 && !data.error, 'live menu capture has ten seconds and no engine error');
  records.push({ screenshot: file, ...data });
};
try {
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.waitForFunction(() => window.DM?.AfterMidnight?.start);
  await page.evaluate(() => { DM.Save.settings.focusPause = false; });
  await page.mouse.click(640, 360);
  await page.waitForTimeout(150);
  const title = await page.evaluate(() => {
    const menu = DM.Engine.top().menu;
    const index = menu.items.findIndex(item => item.label === 'AFTER MIDNIGHT');
    const rect = menu.rowRect(index);
    return { x: rect.x + 80, y: rect.y + rect.h / 2 };
  });
  await page.mouse.click(title.x, title.y);
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu);
  const modern = await page.evaluate(() => DM.Engine.top().step === 'hero');
  await capture(modern ? 'hero-screen' : 'combined-board');
  if (modern) {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => DM.Engine.top().step === 'cases');
    await capture('case-screen');
  }
  assert.equal(errors.length, 0, 'no browser errors');
  writeFileSync(path.join(out, `menu-${label}.json`), JSON.stringify({ label, records, errors }, null, 2));
  console.log(`LIVE MENU CAPTURE PASSED: ${records.length} views (${label}).`);
} finally {
  await browser.close();
}
