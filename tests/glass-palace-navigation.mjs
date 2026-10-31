/* Glass Palace navigation acceptance, with explicitly controlled progression
 * fixtures. This checks routing and actual keyboard/mouse interaction in the
 * real game; fixture completions are not naturally earned playthrough evidence.
 * It uses normal requestAnimationFrame and never places Jon or the camera.
 * Failure screenshots are diagnostics, not delivered live-play captures.
 * node tests/glass-palace-navigation.mjs [index.html|dist/dr-manhattan.html]
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
const capture = process.argv.includes('--capture');
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');
const build = target.startsWith('dist/') || target.includes('/dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/glass-palace-navigation', engine, build);
mkdirSync(out, { recursive: true });

const keys = ['dr-manhattan.save', 'dr-manhattan.bonus.v1', 'dr-manhattan.after-midnight.v1'];
const palaceKey = 'dr-manhattan.glass-palace.v1';
const campaignIds = ['prologue', 'reassembly', 'superman', 'deterrent', 'mars', 'karnak'];
const bonusIds = ['last_broadcast', 'ninth_minute', 'long_summer'];
const fixtures = () => ({
  campaign: {
    version: 2, reached: 0, completed: {}, checkpoint: null, checkpoints: {},
    seen: { unlocks: {} },
    totals: { spared: 0, disintegrated: 0, memories: 0, decoherences: 0 },
    settings: { focusPause: false, textSpeed: 'instant', challenge: 'normal', invulnerable: false },
  },
  bonus: { version: 1, completed: {}, checkpoints: {}, deaths: 0 },
  afterMidnight: {
    version: 1,
    selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
    checkpoints: {}, records: {}, deaths: 0,
  },
  palace: { version: 1, challenges: {}, epilogueSeen: {}, visits: 0 },
});
const complete = fixtures();
complete.campaign.reached = 6;
for (const id of campaignIds) complete.campaign.completed[id] = { time: 60, spared: 1, disintegrated: 0 };
for (const id of bonusIds) complete.bonus.completed[id] = { stats: { time: 60, spared: 1, disintegrated: 0 } };
complete.campaign.checkpoint = { chapter: 'reassembly', stage: 1, carry: null };
complete.campaign.checkpoints.reassembly = { chapter: 'reassembly', stage: 1, carry: null };
complete.bonus.checkpoints.last_broadcast = { stage: 1, carry: null };
complete.afterMidnight.checkpoints['dead_air:niteowl:rooftops'] = {
  caseId: 'dead_air', stage: 1, run: { hero: 'niteowl', theme: 'rooftops', mode: 'story' },
};
complete.palace.challenges.prologue = { mercy: true, swift: true, detail: true };

const browser = await pw[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const checks = [], errors = [], routes = [], walks = [], captures = [];
const held = new Set();
let baseline = null;
page.on('pageerror', error => errors.push(String(error)));
const ev = (fn, value) => page.evaluate(fn, value);
const check = (name, pass) => {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const pause = ms => page.waitForTimeout(ms);
const key = async value => {
  await page.keyboard.down(value);
  await pause(70);
  await page.keyboard.up(value);
  await pause(85);
};
const slots = () => ev(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), keys);
const unchanged = async () => JSON.stringify(await slots()) === JSON.stringify(baseline) &&
  (await ev(() => window.__navigationSourceWrites.length)) === 0;
const action = async (label, direction = 0) => {
  const point = await ev(({ label, direction }) => {
    const menu = DM.Engine.top().menu;
    const index = menu?.items.findIndex(item => item.label === label);
    if (!(index >= 0)) throw new Error('Missing actual menu action: ' + label);
    const rect = menu.rowRect(index);
    let x = rect.x + rect.w / 2;
    if (direction && menu.items[index].adjust) {
      const zone = menu.zones(index)[direction < 0 ? 'left' : 'right'];
      x = (zone[0] + zone[1]) / 2;
    }
    return { x, y: rect.y + rect.h / 2 };
  }, { label, direction });
  await page.mouse.click(point.x, point.y);
  await pause(120);
};
const openAtlas = async () => {
  await key('h');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.GlassPalace.AtlasPanel);
};
const readAtlas = () => ev(() => {
  const atlas = DM.Engine.top();
  return {
    filter: atlas.filter,
    page: atlas.page,
    pageSize: atlas.pageSize,
    entries: atlas.entries.map(entry => ({
      id: entry.id, kind: entry.kind, earned: entry.earned, total: entry.total,
      checkpoint: !!entry.checkpoint, title: entry.title,
    })),
    rows: atlas.menu.items.filter(item => item.destinationId).map(item => item.destinationId),
    selected: atlas.menu.sel,
    visibleRows: atlas.menu.items.map((item, index) => ({
      label: item.label, rect: atlas.menu.rowRect(index), size: atlas.menu.size,
    })),
  };
});
const navigation = () => ev(() => {
  const hub = DM.Engine.stack.find(scene => scene.isGlassPalace);
  const target = hub.navigationTarget();
  const interact = hub.player.interactTarget;
  return {
    onTop: DM.Engine.top() === hub,
    id: hub.navigationTargetId,
    target: target && { id: target.id, kind: target.kind, x: target.x, y: target.y },
    route: hub.navigationRoute.map(point => ({ x: point.x, y: point.y })),
    x: hub.player.x, y: hub.player.y,
    interactId: interact?.moment?.id ||
      (interact && interact === hub.slab ? 'ledger' :
        interact && interact === hub.epilogueTerminal ? 'earth' : null),
    error: DM.Engine.error ? String(DM.Engine.error.stack || DM.Engine.error) : null,
    down: !!hub.player.down,
    god: !!hub.player.godMode || !!DM.Save.settings.invulnerable,
    combat: hub.player.canUsePowers || Object.keys(hub.player.powers).length > 0 ||
      hub.world.entities.some(entity => entity.team === 'enemy' && !entity.dead),
  };
});
const release = async () => {
  for (const value of held) await page.keyboard.up(value);
  held.clear();
};
const movement = async wanted => {
  for (const value of held) if (!wanted.has(value)) await page.keyboard.up(value);
  for (const value of wanted) if (!held.has(value)) await page.keyboard.down(value);
  held.clear();
  for (const value of wanted) held.add(value);
};
async function followGuide(label) {
  const start = await navigation();
  assert.ok(start.target && start.route.length, 'a walking guide exists before following it');
  const goal = start.target;
  const began = Date.now();
  let polls = 0, latest = start;
  while (Date.now() - began < 30000) {
    latest = await navigation();
    assert.ok(latest.onTop && !latest.error && !latest.down && !latest.god && !latest.combat,
      'ordinary noncombat walking remains active');
    if (latest.id === null && Math.hypot(latest.x - goal.x, latest.y - goal.y) < 60) {
      await release();
      const walk = { label, goal, x: latest.x, y: latest.y, polls, seconds: (Date.now() - began) / 1000 };
      walks.push(walk);
      return walk;
    }
    const waypoint = latest.route.slice(1).find(point =>
      Math.hypot(point.x - latest.x, point.y - latest.y) > 18) || goal;
    const dx = waypoint.x - latest.x, dy = waypoint.y - latest.y;
    const wanted = new Set();
    if (Math.abs(dx) > 6) wanted.add(dx < 0 ? 'a' : 'd');
    if (Math.abs(dy) > 6) wanted.add(dy < 0 ? 'w' : 's');
    await movement(wanted);
    polls++;
    await pause(40);
  }
  await release();
  throw new Error('Guide walking timed out: ' + JSON.stringify({ label, goal, latest }));
}
const refreshFixture = async value => {
  // This is an explicit external-save fixture change, outside the read-only
  // observation phase. The hub must read it without writing any source slot.
  await ev(({ keys, palaceKey, value }) => {
    ['campaign', 'bonus', 'afterMidnight'].forEach((group, index) => {
      window.__navigationRawSet.call(localStorage, keys[index], JSON.stringify(value[group]));
    });
    window.__navigationRawSet.call(localStorage, palaceKey, JSON.stringify(value.palace));
    window.__navigationSourceWrites = [];
    DM.GlassPalace.data = null;
  }, { keys, palaceKey, value });
  baseline = await slots();
  await ev(() => DM.Engine.stack.find(scene => scene.isGlassPalace).resume());
  await pause(150);
};

try {
  await page.addInitScript(({ keys, palaceKey, value }) => {
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    const clear = Storage.prototype.clear;
    window.__navigationRawSet = set;
    ['campaign', 'bonus', 'afterMidnight'].forEach((group, index) =>
      set.call(localStorage, keys[index], JSON.stringify(value[group])));
    set.call(localStorage, palaceKey, JSON.stringify(value.palace));
    window.__navigationSourceWrites = [];
    Storage.prototype.setItem = function (key, value) {
      if (keys.includes(String(key))) window.__navigationSourceWrites.push({ method: 'setItem', key: String(key) });
      return set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (keys.includes(String(key))) window.__navigationSourceWrites.push({ method: 'removeItem', key: String(key) });
      return remove.call(this, key);
    };
    Storage.prototype.clear = function () {
      window.__navigationSourceWrites.push({ method: 'clear' });
      return clear.call(this);
    };
  }, { keys, palaceKey, value: fixtures() });
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => DM.GlassPalace?.AtlasPanel && DM.Scenes.GlassPalace && DM.Engine.top());
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => DM.Engine.top().gate === false &&
    DM.Engine.top().menu?.items.some(item => item.label === 'THE GLASS PALACE'));
  baseline = await slots();
  await ev(() => { window.__navigationSourceWrites = []; });
  await action('THE GLASS PALACE');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.GlassPalace);
  check('actual title input opens the hub without changing a source save', await unchanged());

  const fresh = await ev(() => DM.Engine.top().destinations());
  check('fresh navigation lists the seven normally unlocked moments and ledger only',
    fresh.length === 8 && fresh.filter(entry => entry.kind === 'moment').length === 7 &&
    fresh.filter(entry => entry.kind === 'ledger').length === 1 && !fresh.some(entry => entry.kind === 'earth'));
  check('locked campaign and gated Earth destinations cannot be selected', await ev(() => {
    const hub = DM.Engine.top();
    return hub.setDestination('karnak') === false && hub.setDestination('earth') === false &&
      hub.setDestination('not-a-moment') === false && hub.navigationTargetId === null;
  }));
  await openAtlas();
  let atlas = await readAtlas();
  check('H opens the atlas through actual input and keeps locked names out of its entries',
    atlas.filter === 'all' && atlas.entries.length === 8 &&
    !atlas.entries.some(entry => ['reassembly', 'superman', 'deterrent', 'mars', 'karnak'].includes(entry.id)));
  check('the atlas shows at most five destinations with readable rows inside its panel',
    atlas.pageSize === 5 && atlas.rows.length <= 5 && atlas.visibleRows.every(row =>
      row.size >= 13 && row.rect.y >= 170 && row.rect.y + row.rect.h <= 652));
  await key('Escape');
  check('Escape closes the atlas back to the walking hub', (await navigation()).onTop);
  await page.mouse.click(1140, 78);
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.GlassPalace.AtlasPanel);
  check('the visible atlas button opens the same screen with the mouse', await ev(() =>
    DM.Engine.top() instanceof DM.GlassPalace.AtlasPanel));
  await key('Escape');
  await key('Escape');
  const leaveLabel = await ev(() => DM.Engine.top().menu.items.find(item => /ATLAS/.test(item.label))?.label);
  check('the leave menu keeps the atlas reachable', !!leaveLabel);
  await action(leaveLabel);
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.GlassPalace.AtlasPanel);
  await key('Escape');
  check('opening the atlas from the leave menu returns directly to the hub', (await navigation()).onTop);
  check('fresh-save atlas discovery makes no write attempt against any source slot', await unchanged());
  if (capture) {
    await pause(10000);
    await openAtlas();
    const atlasPath = path.join(out, 'atlas-fresh-live.png');
    await page.screenshot({ path: atlasPath });
    captures.push({ view: 'atlas', path: atlasPath, navigation: await navigation(), sourceUnchanged: await unchanged() });
    const freshLabel = await ev(() =>
      DM.Engine.top().menu.items.find(item => item.destinationId === 'prologue').label);
    await action(freshLabel);
    await pause(1000);
    const guidePath = path.join(out, 'guide-fresh-live.png');
    await page.screenshot({ path: guidePath });
    captures.push({ view: 'guide', path: guidePath, navigation: await navigation(), sourceUnchanged: await unchanged() });
    check('live atlas and trail captures use fresh zero-fragment saves after ten seconds of normal game frames',
      captures.every(item => item.sourceUnchanged && !item.navigation.god && !item.navigation.down) &&
      await ev(() => DM.GlassPalace.fragmentCount() === 0));
    await openAtlas();
    await action('CLEAR WALKING GUIDE');
    writeFileSync(path.join(out, 'capture-source.json'), JSON.stringify({
      target, engine, browser: browser.version(), captures,
      method: 'Fresh initial saves; open the hub from its actual title menu, leave normal RAF running at least ten seconds, ' +
        'open the atlas and choose a destination through real input. No actor/camera positioning, god mode, ' +
        'simulation clock changes or frame replacement. Trail view is taken before movement.',
    }, null, 2));
  }

  await refreshFixture(complete);
  const destinations = await ev(() => DM.Engine.top().destinations());
  check('external progression refresh exposes all twelve moments, the ledger and gated Earth',
    destinations.length === 14 && destinations.filter(entry => entry.kind === 'moment').length === 12 &&
    destinations.some(entry => entry.kind === 'ledger') && destinations.some(entry => entry.kind === 'earth'));
  check('each moment index reads its real fragment count and selected-hero checkpoint', await ev(() => {
    const list = DM.Engine.top().destinations();
    const moments = list.filter(entry => entry.kind === 'moment');
    return moments.every(entry => {
      const moment = DM.GlassPalace.find(entry.id), status = DM.GlassPalace.status(entry.id);
      return entry.earned === status.earned && entry.total === 3 && !!entry.checkpoint === !!moment.checkpoint;
    }) && list.find(entry => entry.id === 'prologue').earned === 3 &&
      ['reassembly', 'last_broadcast', 'am_dead_air'].every(id => !!list.find(entry => entry.id === id).checkpoint);
  }));
  check('refreshing navigation after an external save change preserves all three new source snapshots', await unchanged());
  check('a route can start beside a wall using the actual thirteen-pixel player footprint', await ev(() => {
    const hub = DM.Engine.top();
    // Exact contact at x=139 is blocked by the existing circle/rect contract.
    // A tenth of a pixel of clearance is valid at r=13 and invalid at r=16.
    const start = { x: 139.1, y: 1300 };
    const goal = hub.destinations().find(entry => entry.id === 'prologue');
    const route = DM.GlassPalace.planPalaceRoute(hub.world, start, goal, 13);
    return hub.player.r === 13 && hub.world.isFree(start.x, start.y, 13) && route.length > 0 &&
      route.every(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  }));
  check('routing accepts physical wall contact and rejects actual wall penetration', await ev(() => {
    const hub = DM.Engine.top();
    const contact = { x: 139, y: 1300 };
    const goal = hub.destinations().find(entry => entry.id === 'prologue');
    const route = DM.GlassPalace.planPalaceRoute(hub.world, contact, goal, 13);
    const penetrating = DM.GlassPalace.planPalaceRoute(hub.world, { x: 138.5, y: 1300 }, goal, 13);
    if (hub.world.isFree(contact.x, contact.y, 13) || !route.length || penetrating.length) return false;
    for (let index = 1; index < route.length; index++) {
      const a = route[index - 1], b = route[index];
      const samples = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let sample = 0; sample <= samples; sample++) {
        const x = a.x + (b.x - a.x) * sample / samples;
        const y = a.y + (b.y - a.y) * sample / samples;
        if (hub.world.walls.some(wall => !wall.noCollide && DM.U.circleRect(x, y, 13, wall)?.depth > 0.001)) {
          return false;
        }
      }
    }
    return route[0].x === contact.x && route[0].y === contact.y;
  }));

  const routeResults = await ev(() => {
    const hub = DM.Engine.top(), radius = hub.player.r;
    return hub.destinations().map(destination => {
      const accepted = hub.setDestination(destination.id);
      const route = hub.navigationRoute.map(point => ({ x: point.x, y: point.y }));
      const points = [{ x: hub.player.x, y: hub.player.y }, ...route];
      let samples = 0, blocked = null;
      for (let index = 1; index < points.length; index++) {
        const a = points[index - 1], b = points[index];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
        for (let step = 0; step <= steps; step++) {
          const x = a.x + (b.x - a.x) * step / steps;
          const y = a.y + (b.y - a.y) * step / steps;
          samples++;
          if (!hub.world.isFree(x, y, radius)) blocked ||= { x, y, segment: index - 1 };
        }
      }
      const last = route.at(-1);
      return {
        id: destination.id, kind: destination.kind, accepted, samples, blocked, route,
        nearGoal: !!last && Math.hypot(last.x - destination.x, last.y - destination.y) <= 55,
        finite: route.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
      };
    });
  });
  routes.push(...routeResults);
  for (const result of routeResults) {
    check(result.id + ': guide segments clear every actual map wall at the player radius',
      result.accepted === true && result.route.length > 0 && result.samples > 0 &&
      result.finite && result.nearGoal && result.blocked === null);
  }
  check('the ordinary world renderer draws an active guide at the unchanged spawn camera', await ev(() => {
    const hub = DM.Engine.top();
    hub.setDestination('prologue');
    const guide = hub.world.entities.find(entity => entity instanceof DM.GlassPalace.WalkingGuide);
    if (!guide) return false;
    const render = guide.render;
    let rendered = 0;
    guide.render = function (...args) {
      rendered++;
      return render.apply(this, args);
    };
    try { DM.Engine.render(); }
    finally { guide.render = render; }
    return rendered > 0 && Math.hypot(hub.player.x - 1050, hub.player.y - 1310) < 1;
  }));
  await ev(() => DM.Engine.top().clearDestination());
  check('clearing a guide removes both its target and its route', await ev(() => {
    const hub = DM.Engine.top();
    return hub.navigationTargetId === null && hub.navigationTarget() === null && hub.navigationRoute.length === 0;
  }));

  await openAtlas();
  await key('ArrowRight');
  atlas = await readAtlas();
  check('keyboard filtering shows only moments with fragments still to earn',
    atlas.filter === 'unfinished' && atlas.entries.length === 11 &&
    atlas.entries.every(entry => entry.kind === 'moment' && entry.earned < entry.total) &&
    !atlas.entries.some(entry => entry.id === 'prologue'));
  await key('ArrowRight');
  atlas = await readAtlas();
  check('the checkpoint filter lists only existing selected-character resumes',
    atlas.filter === 'checkpoints' && atlas.entries.length === 3 &&
    atlas.entries.every(entry => entry.kind === 'moment' && entry.checkpoint));
  await action('SHOW', 1);
  atlas = await readAtlas();
  check('mouse filter adjustment restores the complete index and resets pagination',
    atlas.filter === 'all' && atlas.page === 0 && atlas.entries.length === 14);
  const pageIds = [...atlas.rows];
  await action('PAGE', 1);
  atlas = await readAtlas();
  check('mouse pagination exposes the next five destinations without repeating the first page',
    atlas.page === 1 && atlas.rows.length === 5 && atlas.rows.every(id => !pageIds.includes(id)));
  pageIds.push(...atlas.rows);
  await action('PAGE', 1);
  atlas = await readAtlas();
  pageIds.push(...atlas.rows);
  check('all fourteen destinations are reachable across three bounded pages',
    atlas.page === 2 && atlas.rows.length === 4 && new Set(pageIds).size === 14);
  await action('PAGE', -1);
  await action('PAGE', -1);
  await key('Escape');
  await openAtlas();
  atlas = await readAtlas();
  const firstDestination = atlas.rows[0];
  await key('ArrowDown');
  await key('Enter');
  check('keyboard destination selection closes the atlas and creates a walking guide',
    (await navigation()).onTop && (await navigation()).id === firstDestination);
  await openAtlas();
  await action('CLEAR WALKING GUIDE');
  check('the clear-guide action works through its visible menu row', await ev(() => {
    const hub = DM.Engine.stack.find(scene => scene.isGlassPalace);
    return hub.navigationTargetId === null && hub.navigationRoute.length === 0;
  }));
  if (!(await navigation()).onTop) await key('Escape');

  await openAtlas();
  const mouseLabel = await ev(() => DM.Engine.top().menu.items.find(item => item.destinationId === 'prologue').label);
  await action(mouseLabel);
  check('mouse destination selection changes no actor position by itself', await ev(() => {
    const hub = DM.Engine.top();
    return hub.isGlassPalace && hub.navigationTargetId === 'prologue' &&
      Math.hypot(hub.player.x - 1050, hub.player.y - 1310) < 1;
  }));
  const walked = await followGuide('prologue');
  check('real WASD follows the guide to a pane and physical arrival clears it',
    walked.polls > 5 && (await navigation()).id === null && (await navigation()).interactId === 'prologue');
  await key('e');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.GlassPalace.MomentMenu);
  check('E at the guided destination opens the real moment menu', await ev(() =>
    DM.Engine.top().moment.id === 'prologue'));
  await key('Escape');

  const ledgerId = destinations.find(entry => entry.kind === 'ledger').id;
  await ev(id => DM.Engine.top().setDestination(id), ledgerId);
  const beforeRebuild = await navigation();
  await ev(() => DM.Engine.top().rebuild());
  await pause(120);
  check('rebuilding the hub refreshes a valid guide at the current physical position', await ev(id => {
    const hub = DM.Engine.top();
    return hub.navigationTargetId === id && hub.navigationTarget()?.id === id && hub.navigationRoute.length > 0;
  }, ledgerId));
  check('rebuilding a guide does not warp Jon', Math.hypot(
    (await navigation()).x - beforeRebuild.x, (await navigation()).y - beforeRebuild.y) < 1);
  check('all atlas filters, route selections and real walking preserve the full-progression source saves', await unchanged());
  await ev(() => DM.Engine.top().setDestination('karnak'));
  await refreshFixture(fixtures());
  check('a destination that becomes locked is removed with its stale walking guide', await ev(() => {
    const hub = DM.Engine.top();
    return !hub.destinations().some(entry => entry.id === 'karnak' || entry.kind === 'earth') &&
      hub.navigationTargetId === null && hub.navigationTarget() === null && hub.navigationRoute.length === 0;
  }));
  check('navigation, filters, walking and refreshes leave source slots byte-for-byte unchanged', await unchanged());
  check('no browser or engine error occurred during navigation', errors.length === 0 && !(await navigation()).error);
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({
    target, engine, browser: browser.version(), checks, errors, routes, walks, captures,
    sourceSlotsUnchanged: await unchanged(),
    sourceWrites: await ev(() => window.__navigationSourceWrites),
    fixtureProvenance: 'Explicit fresh/full/external-restore saves, with controlled completion and challenge records. ' +
      'These records are not naturally earned. Each observation phase snapshots all source bytes and traces writes.',
    method: 'Normal RAF and real keyboard/mouse inputs; no actor/camera placement, no invulnerability, ' +
      'route segments independently sampled every three world pixels with the actual player collision radius.',
  }, null, 2));
  console.log(`GLASS PALACE NAVIGATION PASSED: ${checks.length} checks (${target}).`);
} catch (error) {
  await release();
  if (!page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') });
  writeFileSync(path.join(out, 'failure.json'), JSON.stringify({
    error: String(error.stack || error), checks, errors, routes, walks,
  }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await release();
  await context.close();
  await browser.close();
}
