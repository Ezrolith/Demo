/* Fixed review views, not a playthrough. Normal mode loads the real HTML and storage. */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(a => a.endsWith('.html')) || 'index.html';
const offline = process.argv.includes('--offline');
const out = path.join(root, 'docs/screenshots/long-summer');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const init = () => window.requestAnimationFrame = () => 0;
  if (offline) {
    await page.evaluate(init);
    await page.evaluate(() => {
      const store = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: k => store[k] || null,
        setItem: (k, v) => store[k] = String(v),
        removeItem: k => delete store[k],
      } });
    });
    let html = readFileSync(path.join(root, target), 'utf8');
    html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
      '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
    await page.setContent(html.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
  } else {
    await page.addInitScript(init);
    await page.goto(pathToFileURL(path.join(root, target)).href + '?dev', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => window.DM && DM.dev, null, { polling: 100, timeout: 12000 });
  await page.evaluate(() => {
    DM.Engine.governor.enabled = false;
    DM.Save.settings.focusPause = false;
    window.Capture = {
      step(seconds) {
        const E = DM.Engine;
        const render = E.render;
        E.render = () => {};
        try {
          for (let i = 0; i < Math.ceil(seconds * 60); i++) {
            const p = DM.dev.play();
            if (p) p.player.coherence = 100;
            E.frame(E.last + 1000 / 60);
            if (E.error) throw E.error;
          }
        } finally {
          E.render = render;
        }
        E.render();
      },
      start(chapter, stage, x, y) {
        DM.Input.clearAll();
        DM.Engine.fade.dir = 0;
        DM.Engine.fade.a = 0;
        DM.dev.start(chapter, stage);
        this.step(0.15);
        const p = DM.dev.play();
        for (let i = 0; i < 50 && p.dialog.active; i++) p.dialog.advance();
        p.ctx.lock(false);
        p.player.godMode = true;
        p.ctx.place(x, y);
        this.step(3.3);
      },
    };
  });
  const views = [
    ['avenue', 'long_summer', 0, 870, 650, 1010, 560, 0.72],
    ['tenement', 'long_summer', 1, 820, 850, 820, 820, 0.46],
    ['tenement-detail', 'long_summer', 1, 820, 490, 820, 490, 0.85],
    ['truck', 'long_summer', 2, 750, 1100, null, null, null],
    ['pier-reference', 'superman', 1, 950, 1050, 1020, 820, 0.75],
  ];
  for (const [name, chapter, stage, x, y, fx, fy, zoom] of views) {
    await page.evaluate(([chapter, stage, x, y, fx, fy, zoom]) => {
      Capture.start(chapter, stage, x, y);
      const p = DM.dev.play();
      if (zoom) {
        p.ctx.focus(fx, fy);
        p.world.camera.zoom = zoom;
        p.world.camera.targetZoom = zoom;
        p.world.camera.snap(fx, fy);
      }
      DM.Engine.render();
    }, [chapter, stage, x, y, fx, fy, zoom]);
    await page.screenshot({ path: path.join(out, name + '.png') });
    if (chapter === 'long_summer') {
      await page.evaluate(() => {
        DM.dev.play().player.energy = 100;
        DM.Input.simulate('KeyF', true);
        Capture.step(0.9);
      });
      await page.screenshot({ path: path.join(out, name + '-sight.png') });
      await page.evaluate(() => DM.Input.simulate('KeyF', false));
    }
  }
  for (const mode of ['water', 'ram']) {
    await page.evaluate(mode => {
      Capture.start('long_summer', 2, 790, 1040);
      const t = DM.dev.play().ctx.flags.truck;
      if (mode === 'ram') {
        t.parts[0].hp = 0;
        t.parts[1].hp = 0;
        t.phase = 2;
      }
      t.mode = mode;
      t.modeT = mode === 'ram' ? 1.3 : 1.8;
      t.lockAngle = Math.PI / 2;
      t.waterAngle = Math.PI / 2;
      Capture.step(0.25);
    }, mode);
    await page.screenshot({ path: path.join(out, 'truck-' + mode + '.png') });
    await page.evaluate(() => {
      DM.Input.simulate('KeyF', true);
      Capture.step(0.5);
    });
    await page.screenshot({ path: path.join(out, 'truck-' + mode + '-sight.png') });
  }
  await page.evaluate(() => {
    DM.Input.clearAll();
    DM.Bonus.selectedId = 'long_summer';
    DM.Engine.set(new DM.Scenes.BonusMenu());
    Capture.step(0.4);
  });
  await page.screenshot({ path: path.join(out, 'bonus-menu.png') });
  writeFileSync(path.join(out, 'capture-settings.json'), JSON.stringify({ target, offline, viewport: [1280, 720],
    views, notes: 'Fixed map framing. Truck shots use the actual encounter camera; scenarios are staged, not a playthrough.', errors }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('LONG SUMMER CAPTURE PASSED: 14 images; no page errors.');
} finally {
  await browser.close();
}
