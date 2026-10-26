/* Natural-damage Dead Air journey. Actual menu/keyboard/mouse and real RAF.
 * Read-only position/cooldown/path telemetry guides a known route. After initial
 * settings setup, no placement, health/stamina refills, quest edits, god mode,
 * synthetic clock or stage skipping. node tests/play-after-midnight.mjs [file.html] [--hero=niteowl]
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
const hero = process.argv.find(value => value.startsWith('--hero='))?.split('=')[1] || 'niteowl';
assert.ok(['niteowl', 'silkspectre', 'rorschach'].includes(hero), 'known playable hero');
const out = path.join(root, 'tests/out/play-after-midnight', hero, target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const boardAction = async label => {
  const point = await page.evaluate(label => {
    const menu = DM.Engine.top().menu;
    const index = menu.items.findIndex(item => item.label === label);
    if (index < 0) throw new Error('Board action missing: ' + label);
    const rect = menu.rowRect(index);
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }, label);
  await page.mouse.click(point.x, point.y);
  if (label === 'CHOOSE A CASE OR MODE') {
    await page.waitForFunction(() => DM.Engine.top()?.step === 'cases');
  } else await page.waitForTimeout(100);
};
const boardCard = async (kind, index) => {
  const point = await page.evaluate(([kind, index]) => {
    const rect = DM.Engine.top()[kind + 'Rect'](index);
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }, [kind, index]);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(100);
};

const errors = [], checks = [], trace = [];
let lowestHealth = Infinity, held = new Set(), lastShot = 0;
page.on('pageerror', error => errors.push(String(error)));
const check = (label, ok) => { assert.ok(ok, label); checks.push(label); console.log('PASS ' + label); };
const read = async () => {
  const state = await page.evaluate(() => {
    const play = DM.dev.play(); if (!play) return { scene: DM.Engine.top()?.constructor.name };
    const p = play.player;
    return { scene: DM.Engine.top()?.constructor.name, stage: play.ctx.stageIndex, x: p.x, y: p.y,
      hp: p.coherence, energy: p.energy, failed: play.failed, god: p.godMode || DM.Save.settings.invulnerable,
      challenge: DM.Save.settings.challenge, dialog: play.dialog.active, locked: p.locked,
      spared: play.ctx.stats.spared, gone: play.ctx.stats.disintegrated, map: play.world.mapId,
      gear: Object.fromEntries(Object.entries(p.powers).map(([id, value]) => [DM.Powers.get(id).action,
        { cd: value.cd, cost: DM.Powers.get(id).cost }])),
      foes: play.world.entities.filter(e => e.team === 'enemy' && !e.dead && !e.ko && !e.isProjectile && e.hp != null)
        .map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, distance: Math.hypot(e.x - p.x, e.y - p.y),
          los: play.world.los(p.x, p.y, e.x, e.y), screen: play.world.camera.toScreen(e.x, e.y) })),
    };
  });
  if (state.hp != null) {
    lowestHealth = Math.min(lowestHealth, state.hp);
    assert.ok(!state.god && state.challenge === 'normal' && !state.failed && state.hp > 0,
      'natural route must stay alive on Normal without invulnerability: ' + JSON.stringify(state));
  }
  return state;
};
const release = async () => { for (const key of held) await page.keyboard.up(key); held.clear(); };
const movement = async want => {
  for (const key of held) if (!want.has(key)) await page.keyboard.up(key);
  for (const key of want) if (!held.has(key)) await page.keyboard.down(key);
  held = want;
};
const aim = async (x, y) => {
  const s = await page.evaluate(p => DM.dev.play().world.camera.toScreen(p.x, p.y), { x, y });
  if (s.x < 15 || s.x > 1265 || s.y < 100 || s.y > 585) return false;
  await page.mouse.move(s.x, s.y); return true;
};
const dialogue = async () => {
  await release();
  for (let i = 0; i < 40 && (await read()).dialog; i++) {
    await page.keyboard.press('e'); await page.waitForTimeout(100);
  }
  await page.waitForTimeout(100);
};
async function fight(state) {
  const foe = state.foes.filter(f => f.los && f.distance < 360).sort((a, b) => a.distance - b.distance)[0];
  if (!foe) return false;
  if (!await aim(foe.x, foe.y)) return false;
  await movement(new Set());
  const close = state.foes.filter(e => e.distance < 145).length;
  if (state.hp < 55 && state.gear.duplicate.cd <= 0 && state.energy >= state.gear.duplicate.cost)
    await page.keyboard.press('r');
  if (close >= 2 && state.gear.expand.cd <= 0 && state.energy >= state.gear.expand.cost)
    await page.keyboard.press('g');
  if (foe.distance < 90) await page.keyboard.down('c');
  if (state.gear.disintegrate.cd <= 0.01 && state.energy >= state.gear.disintegrate.cost && Date.now() - lastShot > 350) {
    await page.keyboard.press('q'); lastShot = Date.now();
  }
  if (hero === 'niteowl') await page.keyboard.down('f');
  await page.waitForTimeout(110);
  await page.keyboard.up('c'); if (hero === 'niteowl') await page.keyboard.up('f');
  return true;
}
async function walk(x, y) {
  let route = [], replan = 0;
  for (let attempt = 0; attempt < 1600; attempt++) {
    const s = await read();
    if (s.dialog) { await dialogue(); route = []; continue; }
    if (Math.hypot(s.x - x, s.y - y) < 35) { await release(); return; }
    if (await fight(s)) { route = []; continue; }
    if (!route.length || --replan <= 0) {
      route = await page.evaluate(goal => DM.AfterMidnight.findCasePath(DM.dev.play().world, DM.dev.play().player, goal), { x, y });
      replan = 20;
    }
    while (route.length && Math.hypot(route[0].x - s.x, route[0].y - s.y) < 27) route.shift();
    const next = route[0] || { x, y }, dx = next.x - s.x, dy = next.y - s.y;
    const want = new Set();
    if (dx > 10) want.add('d'); else if (dx < -10) want.add('a');
    if (dy > 10) want.add('s'); else if (dy < -10) want.add('w');
    await movement(want); await page.waitForTimeout(85);
  }
  throw new Error(`Route blocked before ${x},${y}: ${JSON.stringify(await read())}`);
}
const use = async flag => {
  const p = await page.evaluate(flag => { const e = DM.dev.play().ctx.flags[flag]; return { x: e.x, y: e.y }; }, flag);
  await walk(p.x, p.y + 40); await page.keyboard.press('e'); await page.waitForTimeout(130);
};
const screenshot = name => page.screenshot({ path: path.join(out, name + '.png') });

try {
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.heroes);
  await page.evaluate(() => {
    DM.Save.settings.focusPause = false; DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.challenge = 'normal'; DM.Save.settings.invulnerable = false;
  });
  await page.mouse.click(640, 360); await page.waitForTimeout(150);
  const titlePoint = await page.evaluate(() => {
    const menu = DM.Engine.top().menu, row = menu.items.findIndex(item => item.label === 'AFTER MIDNIGHT');
    const r = menu.rowRect(row); return { x: r.x + 100, y: r.y + r.h / 2 };
  });
  await page.mouse.click(titlePoint.x, titlePoint.y);
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu);
  const heroPoint = await page.evaluate(id => {
    const board = DM.Engine.top(), r = board.heroRect(DM.AfterMidnight.heroes.findIndex(h => h.id === id));
    return { x: r.x + 170, y: r.y + 50 };
  }, hero);
  await page.mouse.click(heroPoint.x, heroPoint.y); await page.waitForTimeout(100);
  await boardAction('CHOOSE A CASE OR MODE');
  await boardCard('mode', 0);
  await boardCard('case', 0);
  await screenshot('case-board');
  await boardAction('OPEN CASE FILE');
  await page.waitForFunction(() => DM.dev.play()?.chapter.id === 'am_dead_air' || DM.Engine.top() instanceof DM.Scenes.Interlude);
  if (await page.evaluate(() => DM.Engine.top() instanceof DM.Scenes.Interlude)) {
    await page.waitForTimeout(700); await screenshot('case-interlude');
    await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => DM.dev.play()?.chapter.id === 'am_dead_air');
  await page.waitForTimeout(150); await dialogue();
  check('normal case board starts Dead Air with the chosen hero', await page.evaluate(id =>
    DM.dev.play().player.profile.id === id && DM.dev.play().ctx.stageIndex === 0, hero));
  await screenshot('rooftop-arrival');
  for (const bit of [1, 2, 4]) {
    const clue = await page.evaluate(bit => {
      const e = DM.dev.play().ctx.flags.roofClues.find(e => e.bit === bit); return { x: e.x, y: e.y };
    }, bit);
    await walk(clue.x, clue.y + 40); await page.keyboard.press('e'); await page.waitForTimeout(120);
    await dialogue();
    check('actual E recovers trace ' + bit, await page.evaluate(bit => !!(DM.dev.play().ctx.flags.clues & bit), bit));
  }
  await dialogue(); await page.waitForFunction(() => DM.dev.play().ctx.stageIndex === 1);
  check('three physical investigations naturally reach the tuning checkpoint', true);
  await screenshot('traces-recovered');
  for (let index = 0; index < 3; index++) {
    const dial = await page.evaluate(index => { const d = DM.dev.play().ctx.flags.aerials[index]; return { x: d.x, y: d.y }; }, index);
    await walk(dial.x, dial.y + 40);
    for (let press = 0; press < 3; press++) {
      if (await page.evaluate(index => DM.dev.play().ctx.flags.aerials[index].aligned, index)) break;
      await page.keyboard.press('e'); await page.waitForTimeout(150);
    }
    check('E tunes aerial ' + (index + 1), await page.evaluate(index => DM.dev.play().ctx.flags.aerials[index].aligned, index));
  }
  await use('lockTerminal'); await dialogue();
  await page.waitForFunction(() => DM.dev.play().ctx.stageIndex === 2);
  check('actual triangulation reaches the final checkpoint', await page.evaluate(() => DM.dev.play().ctx.flags.signalLocked));
  await screenshot('uplink-ambush');
  // Travel through the ambush naturally; ranged and close gear use real input.
  for (let attempt = 0; attempt < 500; attempt++) {
    const s = await read(), active = s.foes;
    if (!active.length) break;
    if (await fight(s)) continue;
    const next = active.sort((a, b) => a.distance - b.distance)[0];
    await walk(next.x, next.y);
  }
  check('nonlethal normal-damage combat clears the ambush', (await read()).foes.length === 0 && (await read()).gone === 0);
  await use('uplink'); await dialogue();
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.AfterMidnight.Results, null, { timeout: 10000 });
  const record = await page.evaluate(() => DM.Engine.top().record);
  check('complete Dead Air is recorded for this hero with no human unmade', record.completed && record.run.hero === hero && record.flags.downloaded && record.stats.disintegrated === 0);
  check('no page or engine errors', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  await screenshot('case-closed'); trace.push({ label: 'case-closed', record });
  writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ target, hero, checks, errors, trace, lowestHealth,
    method: 'Actual title/menu entry and ordinary keys/mouse, normal damage, real RAF; read-only path/cooldown telemetry. Initial settings only.' }, null, 2));
  console.log(`AFTER MIDNIGHT LIVE PASSED: ${checks.length} checks; lowest observed health ${lowestHealth.toFixed(2)} (${hero}, ${target}).`);
} catch (error) {
  await release(); await screenshot('failure'); console.error(await read().catch(() => ({})));
  console.error(error); process.exitCode = 1;
} finally { await release(); await browser.close(); }
