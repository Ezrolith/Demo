/* Two unposed live views of challenge tracking. A fresh normal save is prepared
 * before boot. Every subsequent action uses real title/menu/keyboard input.
 * No actor, camera, health, flags, stats, clock or RAF is modified after boot.
 * This deliberately does not claim a natural level completion or balanced time
 * target: it captures the running prologue HUD and its actual pause panel.
 * node tests/capture-glass-palace-tracking.mjs [index.html|dist/dr-manhattan.html]
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(value => value.endsWith('.html')) || 'index.html';
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');
const build = target.includes('dist/') ? 'standalone' : 'source';
const out = path.resolve(process.env.CAPTURE_OUT || path.join(root, 'tests/out/glass-palace-tracking-live', engine, build));
mkdirSync(out, { recursive: true });
const digest = value => createHash('sha256').update(value).digest('hex');
const sourceDigest = () => {
  const hash = createHash('sha256');
  const scripts = [...readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  for (const file of scripts) hash.update(file + '\0' + readFileSync(path.join(root, file)));
  return { scripts: scripts.length, sha256: hash.digest('hex') };
};
const initialSource = sourceDigest();
const initialStandalone = digest(readFileSync(path.join(root, 'dist/dr-manhattan.html')));
const browser = await pw[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const checks = [];
const errors = [];
const views = [];
const inputTrace = [];
const phases = [];
const sourceKeys = ['dr-manhattan.save', 'dr-manhattan.bonus.v1', 'dr-manhattan.after-midnight.v1'];
page.on('pageerror', error => errors.push(String(error)));
const check = (name, pass) => {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const wait = (fn, timeout = 30000) => page.waitForFunction(fn, null, { polling: 100, timeout });
const key = async name => {
  inputTrace.push({ type: 'key', key: name });
  await page.keyboard.down(name);
  await page.waitForTimeout(80);
  await page.keyboard.up(name);
  await page.waitForTimeout(100);
};
const action = async label => {
  const point = await page.evaluate(label => {
    const menu = DM.Engine.top().menu;
    const index = menu?.items.findIndex(item => item.label === label);
    if (!(index >= 0)) throw new Error('Actual menu action missing: ' + label);
    const rect = menu.rowRect(index);
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }, label);
  inputTrace.push({ type: 'menu-click', label, point });
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
};
const telemetry = () => {
  const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
  if (!play) return { scene: DM.Engine.top()?.constructor.name, error: DM.Engine.error ? String(DM.Engine.error) : null };
  const controller = play.glassPalaceTracking;
  return {
    scene: DM.Engine.top()?.constructor.name,
    playOnTop: DM.Engine.top() === play,
    chapter: play.chapter.id,
    stage: play.ctx.stageIndex,
    fieldTime: play.ctx.stats.time,
    worldTime: play.world.time,
    worldRealTime: play.world.realTime,
    player: { x: play.player.x, y: play.player.y, health: play.player.coherence, maximum: play.player.maxCoherence },
    down: !!play.player.down,
    failed: !!play.failed,
    godMode: !!play.player.godMode,
    invulnerable: !!DM.Save.settings.invulnerable,
    challenge: DM.Save.settings.challenge,
    fragments: DM.GlassPalace.fragmentCount(),
    tracking: DM.GlassPalace.tracking(),
    controller: controller && {
      momentId: controller.momentId,
      challengeId: controller.challengeId,
      updates: controller.updates,
      snapshot: { ...controller.snapshot },
    },
    hudVisible: play.hud.gameHudVisible(),
    captions: play.hud.captions.length,
    banners: play.hud.banners.length,
    interaction: play.player.interactTarget?.interact?.label || null,
    originalRaf: /\[native code\]/.test(String(window.requestAnimationFrame)),
    error: DM.Engine.error ? String(DM.Engine.error.stack || DM.Engine.error) : null,
  };
};
const state = () => page.evaluate(telemetry);
const snapshot = () => page.evaluate(keys => ({
  slots: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])),
  settings: JSON.stringify(DM.Save.settings),
  writeOffset: window.__trackingLiveWrites.length,
}), sourceKeys);
const phaseEnd = async (name, before) => {
  const after = await snapshot();
  const writes = await page.evaluate(offset => window.__trackingLiveWrites.slice(offset), before.writeOffset);
  const unchanged = JSON.stringify(before.slots) === JSON.stringify(after.slots) && before.settings === after.settings;
  phases.push({
    name,
    unchanged,
    sourceHashesBefore: Object.fromEntries(Object.entries(before.slots).map(([key, value]) => [key, digest(value ?? '<null>')])),
    sourceHashesAfter: Object.fromEntries(Object.entries(after.slots).map(([key, value]) => [key, digest(value ?? '<null>')])),
    settingsUnchanged: before.settings === after.settings,
    writes,
  });
  return unchanged && writes.every(row => row.key === 'dr-manhattan.glass-palace.v1');
};
const capture = async (name, extra) => {
  const result = await page.evaluate(() => ({
    png: DM.Engine.canvas.toDataURL('image/png'),
    canvas: { width: DM.Engine.canvas.width, height: DM.Engine.canvas.height },
  }));
  const bytes = Buffer.from(result.png.slice(result.png.indexOf(',') + 1), 'base64');
  const filename = name + '-' + build + '-live.png';
  writeFileSync(path.join(out, filename), bytes);
  const record = { name, filename, sha256: digest(bytes), bytes: bytes.length, canvas: result.canvas, ...extra, state: await state() };
  views.push(record);
  return record;
};

try {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    const clear = Storage.prototype.clear;
    set.call(localStorage, 'dr-manhattan.save', JSON.stringify({
      version: 2,
      reached: 0,
      completed: {},
      checkpoint: null,
      checkpoints: {},
      seen: { unlocks: {} },
      totals: { spared: 0, disintegrated: 0, memories: 0, decoherences: 0 },
      settings: { focusPause: false, textSpeed: 'instant', challenge: 'normal', invulnerable: false },
    }));
    set.call(localStorage, 'dr-manhattan.bonus.v1', JSON.stringify({
      version: 1, completed: {}, checkpoints: {}, deaths: 0,
    }));
    set.call(localStorage, 'dr-manhattan.after-midnight.v1', JSON.stringify({
      version: 1,
      selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
      checkpoints: {}, records: {}, deaths: 0,
    }));
    set.call(localStorage, 'dr-manhattan.glass-palace.v1', JSON.stringify({
      version: 1, challenges: {}, epilogueSeen: {}, visits: 0, tracking: null,
    }));
    window.__trackingLiveWrites = [];
    Storage.prototype.setItem = function (key, value) {
      window.__trackingLiveWrites.push({ method: 'setItem', key: String(key), time: performance.now() });
      return set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      window.__trackingLiveWrites.push({ method: 'removeItem', key: String(key), time: performance.now() });
      return remove.call(this, key);
    };
    Storage.prototype.clear = function () {
      window.__trackingLiveWrites.push({ method: 'clear', key: null, time: performance.now() });
      return clear.call(this);
    };
  });
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await wait(() => window.DM?.dev && DM.Engine.canvas && DM.Engine.top() instanceof DM.Scenes.Title);
  inputTrace.push({ type: 'title-gate-click', point: { x: 640, y: 360 } });
  await page.mouse.click(640, 360);
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Title && DM.Engine.top().gate === false);
  await action('NEW GAME');
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Interlude && DM.Engine.top().t >= 0.65);
  await key('Space');
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Interlude && DM.Engine.top().finished);
  await key('Space');
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Play && DM.Engine.fade.dir === 0);
  const entry = await state();
  const stageStartedAt = Date.now();
  check('actual title New Game and interlude inputs start the fresh prologue',
    entry.chapter === 'prologue' && entry.stage === 0 && entry.fragments === 0 && entry.tracking === null);
  check('the actual run starts on normal challenge without invulnerability or synthetic frames',
    entry.challenge === 'normal' && !entry.godMode && !entry.invulnerable && entry.originalRaf);

  const pinBefore = await snapshot();
  await key('Escape');
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Pause);
  await action('MOMENT CHALLENGES');
  await wait(() => DM.Engine.top() instanceof DM.GlassPalace.TrackingPanel);
  const pinPoint = await page.evaluate(() => {
    const panel = DM.Engine.top();
    const index = panel.menu.items.findIndex(item => item.challengeId === 'swift');
    const rect = panel.menu.rowRect(index);
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  });
  inputTrace.push({ type: 'challenge-click', id: 'swift', point: pinPoint });
  await page.mouse.click(pinPoint.x, pinPoint.y);
  await wait(() => DM.GlassPalace.tracking()?.momentId === 'prologue' &&
    DM.GlassPalace.tracking()?.challengeId === 'swift');
  check('real Pause menu input pins the time challenge without touching other progress or settings',
    await phaseEnd('pin-from-pause', pinBefore));
  await action('RETURN TO PAUSE');
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Pause);
  await action('RESUME');
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Play);
  const liveStart = await state();
  const activeStartedAt = Date.now();
  inputTrace.push({ type: 'held-key', key: 'd', milliseconds: 600 });
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  await page.keyboard.up('d');
  const deadline = Date.now() + 45000;
  let live;
  do {
    await page.waitForTimeout(100);
    live = await state();
    assert.equal(live.error, null, 'the live game remains error-free');
    assert.ok(live.playOnTop && !live.down && !live.failed, 'the ordinary prologue keeps running');
    if (Date.now() - activeStartedAt >= 10000 && live.worldRealTime - liveStart.worldRealTime >= 10 &&
      live.hudVisible && live.captions === 0 && live.banners === 0 && live.controller?.snapshot) break;
  } while (Date.now() < deadline);
  check('the actual stage runs at least ten active seconds before capture',
    Date.now() - activeStartedAt >= 10000 && live.worldRealTime - liveStart.worldRealTime >= 10);
  check('the unobscured live HUD shows the pinned challenge on an ordinary healthy player',
    live.hudVisible && live.captions === 0 && live.banners === 0 && live.interaction === null &&
    live.controller?.challengeId === 'swift' && live.controller.snapshot.state === 'viable' &&
    live.player.health > 0 && !live.down && !live.godMode && !live.invulnerable && live.originalRaf);
  check('real keyboard movement changes the player position without actor placement', live.player.x > liveStart.player.x + 20);
  const first = await capture('tracking-hud', {
    kind: 'running-gameplay',
    stageWallSeconds: (Date.now() - stageStartedAt) / 1000,
    activeWallSeconds: (Date.now() - activeStartedAt) / 1000,
    activeWorldSeconds: live.worldRealTime - liveStart.worldRealTime,
  });
  check('live tracking grants no provisional fragment', first.state.fragments === 0);

  const readBefore = await snapshot();
  await key('Escape');
  await wait(() => DM.Engine.top() instanceof DM.Scenes.Pause);
  await action('MOMENT CHALLENGES');
  await wait(() => DM.Engine.top() instanceof DM.GlassPalace.TrackingPanel && DM.Engine.top().rows.length === 3);
  const paused = await state();
  await page.waitForTimeout(300);
  const second = await capture('tracking-pause-panel', {
    kind: 'actual-pause-overview',
    stageWallSeconds: (Date.now() - stageStartedAt) / 1000,
    precedingActiveWorldSeconds: first.activeWorldSeconds,
  });
  check('the pause view contains three real challenge snapshots and freezes the field timer',
    second.state.fieldTime === paused.fieldTime && await page.evaluate(() =>
      DM.Engine.top().rows.every(row => row.live?.momentId === 'prologue')));
  check('reading the actual pause panel leaves source slots and settings unchanged', await phaseEnd('read-pause-panel', readBefore));
  check('both views retain normal health, no artificial completion and zero earned fragments', views.every(view =>
    view.state.player.health > 0 && !view.state.down && !view.state.godMode && !view.state.invulnerable && view.state.fragments === 0));
  const finalSource = sourceDigest();
  const finalStandalone = digest(readFileSync(path.join(root, 'dist/dr-manhattan.html')));
  check('source and standalone files remain identical throughout capture',
    initialSource.sha256 === finalSource.sha256 && initialStandalone === finalStandalone);
  check('no browser or engine error occurred', errors.length === 0 && second.state.error === null);
  writeFileSync(path.join(out, 'capture-manifest.json'), JSON.stringify({
    target, engine, browser: browser.version(), checks, errors, views, phases, inputTrace,
    sourceScripts: initialSource, standaloneSha256: initialStandalone,
    gameplayWrites: await page.evaluate(() => window.__trackingLiveWrites),
    initialProgress: 'Fresh normal save; no reached chapters, completion records, fragments or tracking selection.',
    method: 'Actual title New Game, interlude inputs, Pause pinning, Resume and real D movement; at least ten active ' +
      'seconds of ordinary RAF before raw canvas pixels. No actor/camera/health/flags/stats/clock/renderer overrides.',
    naturalCompletion: false,
    limits: 'Two live views of the opening stage, not a natural completion or challenge-balance proof. ' +
      'The second image is the actual paused overview after the first running gameplay capture.',
  }, null, 2) + '\n');
  console.log(`GLASS PALACE TRACKING LIVE CAPTURE PASSED: ${checks.length} checks; two raw live views (${target}).`);
} catch (error) {
  await page.keyboard.up('d');
  await page.screenshot({ path: path.join(out, 'failure-diagnostic.png') });
  writeFileSync(path.join(out, 'failure.json'), JSON.stringify({
    target, engine, checks, errors, views, phases, inputTrace, error: String(error.stack || error),
  }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
