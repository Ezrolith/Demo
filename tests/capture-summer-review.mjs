/* Live simulation captures: no invulnerability, actor placement, forced attacks or
 * health refills. Matched comparisons reframe ONLY the renderer at the live state;
 * a second set retains the untouched gameplay camera to prove HUD clearance. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.CAPTURE_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const out = path.resolve(process.env.CAPTURE_OUT || path.join(root, 'docs/screenshots/summer-review'));
const label = process.env.CAPTURE_LABEL || 'after';
const offline = process.argv.includes('--offline');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const records = [];
const views = [
  ['avenue', 'long_summer', 0, 750, 660, 0.85],
  ['tenement', 'long_summer', 1, 820, 970, 0.72],
  ['truck', 'long_summer', 2, 930, 800, 0.8],
  ['relay', 'last_broadcast', 1, 960, 680, 0.85],
  ['pier-reference', 'superman', 1, 1020, 820, 0.75],
];
try {
  for (const [name, chapter, stage, x, y, zoom] of views) {
    if (process.env.CAPTURE_ONLY && process.env.CAPTURE_ONLY !== name) continue;
    // A fresh page/store for each stage, without changing the simulation clock.
    if (offline) {
      await page.goto('about:blank');
      await page.evaluate(() => {
        const store = {};
        Object.defineProperty(window, 'localStorage', { value: {
          getItem: k => store[k] || null,
          setItem: (k, v) => store[k] = String(v),
          removeItem: k => delete store[k],
        } });
      });
      let html = readFileSync(path.join(root, 'index.html'), 'utf8');
      html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
        '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
      await page.setContent(html.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?dev', { waitUntil: 'domcontentloaded' });
    }
    await page.waitForFunction(() => window.DM && DM.dev);
    await page.evaluate(([chapter, stage]) => {
      DM.Save.settings.focusPause = false;
      DM.Save.settings.invulnerable = false;
      DM.Save.settings.challenge = 'normal';
      DM.Save.settings.flashing = 'reduced';
      DM.Audio.unlock();
      DM.dev.start(chapter, stage);
    }, [chapter, stage]);
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const p = DM.dev.play();
      for (let n = 0; n < 60 && p.dialog.active; n++) p.dialog.advance();
      window.__captureStart = { time: performance.now(), worldTime: p.world.time, x: p.player.x, y: p.player.y };
    });
    // Real RAF/rendering and unassisted enemies for ten WALL-CLOCK seconds.
    await page.waitForTimeout(10000);
    await page.screenshot({ path: path.join(out, `${name}-${label}-live.png`) });
    const record = await page.evaluate(() => {
      const p = DM.dev.play();
      const q = p.world.camera.toScreen(p.player.x, p.player.y);
      return { start: window.__captureStart, wallSeconds: (performance.now() - window.__captureStart.time) / 1000,
        worldSeconds: p.world.time - window.__captureStart.worldTime, player: { x: p.player.x, y: p.player.y,
          health: p.player.coherence, godMode: p.player.godMode, down: p.player.down, screen: q },
        heat: p.ctx.flags.heat, comedianCasualties: p.ctx.flags.comedianCasualties,
        burning: p.ctx.flags.summer?.grid?.active.size, hint: p.hud.hintMsg?.text,
        camera: { x: p.world.camera.x, y: p.world.camera.y, zoom: p.world.camera.zoom } };
    });
    // Export a second, matched view of the SAME LIVE STATE. No entity is moved,
    // no attack is posed, and the gameplay camera is restored before the next RAF.
    const matched = async suffix => {
      const data = await page.evaluate(([x, y, zoom]) => {
        const p = DM.dev.play();
        const cam = p.world.camera;
        const old = { x: cam.x, y: cam.y, zoom: cam.zoom, ox: cam.ox, oy: cam.oy };
        Object.assign(cam, { x, y, zoom, ox: 0, oy: 0 });
        DM.Engine.render();
        const image = document.querySelector('canvas').toDataURL('image/png').split(',')[1];
        Object.assign(cam, old);
        DM.Engine.render();
        return image;
      }, [x, y, zoom]);
      writeFileSync(path.join(out, `${name}-${label}${suffix}.png`), Buffer.from(data, 'base64'));
    };
    await matched('');
    if (name !== 'pier-reference') {
      await page.keyboard.down('f');
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(out, `${name}-${label}-live-sight.png`) });
      await matched('-sight');
      await page.keyboard.up('f');
    }
    records.push({ name, chapter, stage, framing: { x, y, zoom }, ...record });
    console.log(`${label} ${name}: ${record.wallSeconds.toFixed(2)}s live, health ${record.player.health}, Heat ${record.heat}`);
  }
  // Portrait-only comparison is explicitly artwork evidence, not gameplay.
  if (!process.env.CAPTURE_ONLY) {
    const portrait = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 720;
      c.height = 380;
      const g = c.getContext('2d');
      g.fillStyle = '#15232a';
      g.fillRect(0, 0, 720, 380);
      DM.Gfx.portrait(g, 55, 45, 280, DM.LOOKS.comedian, 0);
      DM.Gfx.portrait(g, 385, 45, 280, DM.LOOKS.niteowl, 0);
      DM.Gfx.text(g, 'COMEDIAN', 195, 354, { size: 20, align: 'center', color: '#d6c5a0' });
      DM.Gfx.text(g, 'NITE OWL', 525, 354, { size: 20, align: 'center', color: '#d6c5a0' });
      return c.toDataURL().split(',')[1];
    });
    writeFileSync(path.join(out, `portrait-${label}.png`), Buffer.from(portrait, 'base64'));
  }
  writeFileSync(path.join(out, `capture-${label}.json`), JSON.stringify({ mode: offline ? 'local inline harness' : 'normal file loading',
    notes: 'Ten seconds of uninterrupted RAF gameplay after dialogue; no actor edits, damage cheats or forced boss states. ' +
      'Files ending -live use the untouched camera; paired files reframe only the renderer to identical coordinates.',
    records, errors }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('LIVE CAPTURE PASSED: ' + records.length + ' stages; no page errors.');
} finally {
  await browser.close();
}
