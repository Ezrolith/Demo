/* Reproducible visual evidence. Normal file:// navigation is the default.
 * node tests/capture-bonus-polish.mjs --before-root=/path/to/original-bonus
 * --offline is a restricted-environment fallback, not proof of file loading.
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beforeArg = process.argv.find(value => value.startsWith('--before-root='));
const before = beforeArg ? path.resolve(beforeArg.slice('--before-root='.length)) : null;
const offline = process.argv.includes('--offline');
const out = path.join(root, 'docs/screenshots/bonus-polish');
mkdirSync(out, { recursive: true });

// Map overviews share a literal framing before and after; boss shots use the
// real encounter camera with the same player position instead of an override.
const maps = [
  ['nm-platform', 'ninth_minute', 0, 1050, 850, 980, 635, 0.8],
  ['nm-train', 'ninth_minute', 1, 1000, 900, 1170, 700, 0.8],
  ['nm-engine', 'ninth_minute', 2, 940, 1010, 950, 780, 0.9],
  ['lb-roofs', 'last_broadcast', 0, 880, 620, 1030, 555, 0.85],
  ['lb-relay', 'last_broadcast', 1, 850, 800, 900, 620, 0.85],
  ['lb-tower', 'last_broadcast', 2, 900, 850, 900, 650, 0.95],
];
const bosses = [
  ['nm-pendulum-phase1', 'ninth_minute', 2, 1250, 1020],
  ['nm-pendulum-phase2', 'ninth_minute', 2, 1250, 1020],
  ['lb-carrier-phase1', 'last_broadcast', 2, 1150, 900],
  ['lb-carrier-phase2', 'last_broadcast', 2, 1150, 900],
];
const records = [];
const browser = await pw.chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function open(source) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const init = () => {
    window.requestAnimationFrame = () => 0;
    let seed = 93027;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  };
  if (offline) {
    await page.evaluate(init);
    await page.evaluate(() => {
      const store = {};
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: key => store[key] || null,
          setItem: (key, value) => { store[key] = String(value); },
          removeItem: key => { delete store[key]; },
        },
      });
    });
    let html = readFileSync(path.join(source, 'index.html'), 'utf8');
    html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, filename) => {
      const text = readFileSync(path.join(source, filename), 'utf8').replace(/<\/script/gi, '<\\/script');
      return '<script>\n' + text + '</script>';
    }).replace(/<link[^>]*>/g, '');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
  } else {
    await page.addInitScript(init);
    await page.goto(pathToFileURL(path.join(source, 'index.html')).href + '?dev', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => window.DM && DM.dev, null, { polling: 100, timeout: 15000 });
  await page.evaluate(() => {
    DM.Engine.governor.enabled = false;
    DM.Save.settings.focusPause = false;
    DM.Save.settings.textSpeed = 'instant';
  });
  return { page, errors };
}

async function capture(page, spec, sight, version, bossShot = false) {
  const state = await page.evaluate(({ spec, sight, bossShot }) => {
    const [name, chapter, stage, px, py, cx, cy, zoom] = spec;
    DM.Input.clearAll();
    DM.Engine.fade.dir = 0;
    DM.Engine.fade.a = 0;
    DM.dev.start(chapter, stage);
    const play = DM.dev.play();
    const tick = () => DM.Engine.frame(DM.Engine.last + 1000 / 60);
    const clearDialogue = () => {
      for (let i = 0; i < 40 && play.dialog.active; i++) play.dialog.advance();
    };
    for (let i = 0; i < 20; i++) {
      clearDialogue();
      tick();
    }
    play.ctx.place(px, py);
    if (sight) DM.Input.simulate('KeyF', true);
    for (let i = 0; i < 240; i++) {
      if (i % 60 === 0) {
        play.player.coherence = 100;
        play.player.energy = 100;
      }
      clearDialogue();
      tick();
    }
    const boss = play.world.boss;
    if (bossShot) {
      if (chapter === 'ninth_minute') {
        if (name.endsWith('phase2')) {
          boss.exposed = 3;
          boss.damage(430, play.player, 'test');
          tick();
          boss.exposed = 0;
        }
        boss.cycle = 1.55;
        boss.previousCycle = 1.55;
      } else {
        for (const pylon of play.ctx.flags.pylons) pylon.damage(999, play.player, 'disintegrate');
        for (let i = 0; i < 20; i++) tick();
        if (name.endsWith('phase2')) {
          boss.damage(boss.maxHp * 0.55, play.player, 'test');
          tick();
        }
        boss.beamT = 1.5;
        boss.beamAim = Math.atan2(play.player.y - boss.y, play.player.x - boss.x);
      }
      for (let i = 0; i < 15; i++) {
        play.player.coherence = 100;
        tick();
      }
      if (boss.cameraFrame && !boss.cameraFrame.projectionSafe(
        play.world.camera.zoom, play.world.camera.x, play.world.camera.y
      )) throw new Error('Boss projects outside the safe frame: ' + name);
    } else {
      play.world.camera.zoom = zoom;
      play.world.camera.targetZoom = zoom;
      play.world.camera.snap(cx, cy);
    }
    play.player.coherence = 100;
    play.player.energy = 100;
    DM.Engine.render();
    if (DM.Engine.error) throw DM.Engine.error;
    return {
      chapter, stage, sight, bossShot, bossPhase: boss && boss.phase,
      player: { x: play.player.x, y: play.player.y },
      camera: { x: play.world.camera.x, y: play.world.camera.y, zoom: play.world.camera.zoom },
      cycle: play.world.cycleT,
    };
  }, { spec, sight, bossShot });
  const filename = spec[0] === 'pier-reference' ? 'pier-reference.png' : `${spec[0]}-${version}${sight ? '-sight' : ''}.png`;
  await page.screenshot({ path: path.join(out, filename) });
  records.push({ filename, version, mode: offline ? 'offline' : 'file', ...state });
  console.log(filename);
}

try {
  for (const [source, version] of [[before, 'before'], [root, 'after']]) {
    if (!source) continue;
    const { page, errors } = await open(source);
    for (const spec of maps) {
      for (const sight of [false, true]) await capture(page, spec, sight, version);
    }
    for (const spec of bosses) {
      for (const sight of [false, true]) await capture(page, spec, sight, version, true);
    }
    if (version === 'after') {
      await capture(page, ['pier-reference', 'superman', 1, 720, 1000, 1000, 700, 1.05], false, version);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
  writeFileSync(path.join(out, 'capture-settings.json'), JSON.stringify({ viewport: [1280, 720], records }, null, 2) + '\n');
  console.log(`VISUAL EVIDENCE PASSED: ${records.length} screenshots; no page errors.`);
} finally {
  await browser.close();
}
