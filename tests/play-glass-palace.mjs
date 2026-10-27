/* A real-input tour of the twelve panes, using an explicitly unlocked
 * validation save. This does not claim natural campaign-completion history.
 * After the initial save fixtures, only keyboard/mouse input and read-only
 * telemetry are used: no actor/camera placement, flags, synthetic clock or RAF
 * replacement. Failure screenshots are diagnostics, not delivered live evidence.
 * node tests/play-glass-palace.mjs [index.html|dist/dr-manhattan.html]
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(value => value.endsWith('.html')) || 'index.html';
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');
const build = target.startsWith('dist/') || target.includes('/dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/play-glass-palace', engine, build);
mkdirSync(out, { recursive: true });

const keys = ['dr-manhattan.save', 'dr-manhattan.bonus.v1', 'dr-manhattan.after-midnight.v1'];
const fixtures = {
  campaign: {
    version: 2,
    reached: 6,
    completed: {},
    checkpoint: null,
    checkpoints: {},
    seen: { unlocks: {} },
    totals: { spared: 0, disintegrated: 0, memories: 0, decoherences: 0 },
    settings: { focusPause: false, textSpeed: 'instant', challenge: 'normal', invulnerable: false },
  },
  bonus: { version: 1, completed: {}, checkpoints: {}, deaths: 0 },
  afterMidnight: {
    version: 1,
    selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
    checkpoints: {},
    records: {},
    deaths: 0,
  },
};
const browser = await pw[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const checks = [], errors = [], visits = [], movementTrace = [];
const held = new Set();
let baseline = null;
let keyboardPolls = 0;
page.on('pageerror', error => errors.push(String(error)));
const check = (name, pass) => {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const read = () => page.evaluate(() => {
  const scene = DM.Engine.top();
  const hub = DM.Engine.stack.find(item => item.isGlassPalace);
  const player = hub?.player;
  return {
    hubOnTop: scene === hub,
    scene: scene?.constructor.name,
    x: player?.x,
    y: player?.y,
    health: player?.coherence,
    down: !!player?.down,
    godMode: !!player?.godMode,
    invulnerable: !!DM.Save.settings.invulnerable,
    powers: player ? Object.keys(player.powers).length : null,
    canUsePowers: player?.canUsePowers,
    enemies: hub?.world.entities.filter(entity => entity.team === 'enemy' && !entity.dead).length,
    interactMoment: player?.interactTarget?.moment?.id || null,
    error: DM.Engine.error ? String(DM.Engine.error.stack || DM.Engine.error) : null,
  };
});
const release = async () => {
  for (const key of held) await page.keyboard.up(key);
  held.clear();
};
const movement = async wanted => {
  for (const key of held) if (!wanted.has(key)) await page.keyboard.up(key);
  for (const key of wanted) if (!held.has(key)) await page.keyboard.down(key);
  held.clear();
  for (const key of wanted) held.add(key);
};
async function walk(x, y, label) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 22000) {
    const state = await read();
    assert.equal(state.error, null, 'no engine error while walking');
    assert.ok(state.hubOnTop, 'ordinary walking stays in the hub: ' + JSON.stringify(state));
    assert.ok(!state.godMode && !state.invulnerable && !state.down && state.health > 0,
      'tour retains an ordinary healthy player: ' + JSON.stringify(state));
    assert.ok(state.powers === 0 && state.canUsePowers === false && state.enemies === 0,
      'tour remains noncombat: ' + JSON.stringify(state));
    const dx = x - state.x, dy = y - state.y;
    if (Math.hypot(dx, dy) <= 20) {
      await release();
      movementTrace.push({ label, x, y, arrived: { x: state.x, y: state.y }, seconds: (Date.now() - started) / 1000 });
      return;
    }
    const wanted = new Set();
    if (Math.abs(dx) > 9) wanted.add(dx < 0 ? 'a' : 'd');
    if (Math.abs(dy) > 9) wanted.add(dy < 0 ? 'w' : 's');
    await movement(wanted);
    keyboardPolls++;
    last = state;
    await page.waitForTimeout(100);
  }
  await release();
  throw new Error('Walk timed out at ' + label + ': ' + JSON.stringify({ goal: { x, y }, last }));
}
const action = async label => {
  const point = await page.evaluate(label => {
    const menu = DM.Engine.top().menu;
    const index = menu?.items.findIndex(item => item.label === label);
    if (!(index >= 0)) throw new Error('Actual menu action missing: ' + label);
    const rect = menu.rowRect(index);
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }, label);
  await page.mouse.click(point.x, point.y);
};
const sourceSlots = () => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), keys);
const sourceUnchanged = async () => {
  const slots = await sourceSlots();
  const writes = await page.evaluate(() => window.__palaceTourSourceWrites);
  return JSON.stringify(slots) === JSON.stringify(baseline) && writes.length === 0;
};

try {
  await page.addInitScript(({ keys, fixtures }) => {
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    const clear = Storage.prototype.clear;
    for (const [index, group] of ['campaign', 'bonus', 'afterMidnight'].entries()) {
      set.call(localStorage, keys[index], JSON.stringify(fixtures[group]));
    }
    window.__palaceTourSourceWrites = [];
    Storage.prototype.setItem = function (key, value) {
      if (keys.includes(String(key))) window.__palaceTourSourceWrites.push({ method: 'setItem', key: String(key) });
      return set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (keys.includes(String(key))) window.__palaceTourSourceWrites.push({ method: 'removeItem', key: String(key) });
      return remove.call(this, key);
    };
    Storage.prototype.clear = function () {
      window.__palaceTourSourceWrites.push({ method: 'clear' });
      return clear.call(this);
    };
  }, { keys, fixtures });
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.GlassPalace &&
    DM.Scenes?.GlassPalace && DM.Engine.top());
  baseline = await sourceSlots();
  check('validation fixture unlocks twelve panes without claiming completed history or palace fragments', await page.evaluate(() =>
    DM.GlassPalace.moments().filter(moment => moment.unlocked).length === 12 &&
    DM.GlassPalace.moments().every(moment => !moment.completed) && DM.GlassPalace.fragmentCount() === 0));
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => DM.Engine.top().menu?.items.some(item => item.label === 'THE GLASS PALACE'));
  await action('THE GLASS PALACE');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.GlassPalace);
  check('actual title input opens the palace without source-slot writes', await sourceUnchanged());
  const panes = await page.evaluate(() => DM.Engine.top().panes.map(pane => ({
    id: pane.moment.id, title: pane.moment.title, x: pane.x, y: pane.y,
  })));
  check('all twelve pane destinations are available to the walking tour',
    panes.length === 12 && new Set(panes.map(pane => pane.id)).size === 12);

  for (const pane of panes) {
    const started = Date.now();
    const position = await read();
    await walk(1050, position.y, pane.id + ' central spine');
    await walk(1050, pane.y + 100, pane.id + ' approach row');
    await walk(pane.x, pane.y + 100, pane.id + ' pane approach');
    await page.waitForTimeout(150);
    check(pane.id + ': ordinary walking reaches the pane interaction', (await read()).interactMoment === pane.id);
    await page.keyboard.press('e');
    await page.waitForFunction(id => DM.Engine.top() instanceof DM.GlassPalace.MomentMenu &&
      DM.Engine.top().moment.id === id, pane.id);
    check(pane.id + ': real E opens its own Play / Resume / Challenges menu', await page.evaluate(id => {
      const screen = DM.Engine.top();
      return screen.moment.id === id && ['PLAY THIS MOMENT', 'RESUME CHECKPOINT', 'CHALLENGES']
        .every(label => screen.menu.items.some(item => item.label === label));
    }, pane.id));
    await action('CHALLENGES');
    await page.waitForFunction(id => DM.Engine.top() instanceof DM.GlassPalace.ChallengesPanel &&
      DM.Engine.top().moment.id === id, pane.id);
    check(pane.id + ': actual menu input exposes three challenge entries', await page.evaluate(() => {
      const screen = DM.Engine.top();
      return screen.rows.length === 3 && new Set(screen.rows.map(row => row.id)).size === 3;
    }));
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => DM.Engine.top() instanceof DM.GlassPalace.MomentMenu &&
      DM.Engine.top().moment.id === id, pane.id);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.GlassPalace);
    check(pane.id + ': returning from both panels leaves source save bytes and write trace unchanged', await sourceUnchanged());
    visits.push({ ...pane, seconds: (Date.now() - started) / 1000, position: await read() });
  }

  const previews = await page.evaluate(() => DM.Engine.top().panes.map(pane => ({
    id: pane.moment.id,
    renders: pane.preview.renders,
    sourceMap: pane.preview.sourceMap,
    usesOwnBuilder: pane.preview.sourceBuilder === pane.moment.chapter.maps[pane.preview.sourceMap],
    error: pane.preview.error,
  })));
  check('every visited pane has rendered its own original builder without an error',
    previews.length === 12 && previews.every(preview => preview.renders > 0 && preview.usesOwnBuilder && !preview.error));
  check('walking and reading challenge menus grants no artificial fragments', await page.evaluate(() =>
    DM.GlassPalace.fragmentCount() === 0));
  check('the completed tour preserves all three source slots byte-for-byte and makes no write attempt', await sourceUnchanged());
  check('all twelve panes were reached with real movement input', visits.length === 12 && keyboardPolls > 50);
  check('no browser or engine error occurred during the full tour', errors.length === 0 && !(await read()).error);
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({
    target, engine, browser: browser.version(), checks, errors, visits, previews, movementTrace, keyboardPolls,
    fixtureProvenance: 'Explicit reached=6 validation fixture; completion records and palace fragments remain empty.',
    fixtures,
    method: 'Actual title entry and real WASD/E/mouse/Escape input; read-only navigation telemetry; normal RAF.',
    sourceWrites: await page.evaluate(() => window.__palaceTourSourceWrites),
    sourceSlotsUnchanged: await sourceUnchanged(),
  }, null, 2));
  console.log(`GLASS PALACE LIVE TOUR PASSED: ${checks.length} checks; twelve panes, real keyboard movement (${target}).`);
} catch (error) {
  await release();
  if (!page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') });
  writeFileSync(path.join(out, 'failure.json'), JSON.stringify({
    error: String(error.stack || error), checks, errors, visits, movementTrace, keyboardPolls,
  }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await release();
  await context.close();
  await browser.close();
}
