/* Natural-damage Glass Archive journey as a melee-capable human. Actual menu/keyboard/mouse and real RAF.
 * Read-only position/cooldown/path telemetry guides a known route. After initial
 * settings setup, no placement, health/stamina refills, quest edits, god mode,
 * synthetic clock or stage skipping. node tests/play-after-midnight-archive.mjs [file.html] [--hero=rorschach]
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
const hero = process.argv.find(value => value.startsWith('--hero='))?.split('=')[1] || 'rorschach';
assert.ok(['niteowl', 'silkspectre', 'rorschach'].includes(hero), 'known playable hero');
const out = path.join(root, 'tests/out/play-after-midnight-archive', hero, target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = [], trace = [];
let lowestHealth = Infinity, held = new Set(), lastShot = 0, bossMeleeHits = 0;
const seenPhases = new Set(), chargePhases = new Set();
const bossMeleeProof = [];
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
          los: play.world.los(p.x, p.y, e.x, e.y), boss: e instanceof DM.AfterMidnight.Surveyor, phase: e.phase, mode: e.attackMode, timer: e.timer, warningAngle: e.warningAngle, screen: play.world.camera.toScreen(e.x, e.y) })),
    };
  });
  if (state.hp != null) {
    lowestHealth = Math.min(lowestHealth, state.hp);
    for (const foe of state.foes || []) if (foe.boss) { seenPhases.add(foe.phase); if (foe.mode === 'charge') chargePhases.add(foe.phase); }
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
  const foe = state.foes.filter(f => f.los && f.distance < 420).sort((a, b) => a.distance - b.distance)[0];
  if (!foe) return false;
  if (foe.boss && (foe.mode === 'warn' || foe.mode === 'charge')) {
    await page.keyboard.up('c'); await page.keyboard.up('f');
    const side = await page.evaluate(({ angle }) => {
      const p = DM.dev.play().player, w = DM.dev.play().world;
      for (const sign of [1, -1]) {
        const a = angle + sign * Math.PI / 2;
        const point = { x: p.x + Math.cos(a) * 145, y: p.y + Math.sin(a) * 145 };
        if (w.isFree(point.x, point.y, p.r + 10)) return point;
      }
      return { x: p.x - Math.cos(angle) * 100, y: p.y - Math.sin(angle) * 100 };
    }, { angle: foe.warningAngle });
    const dx = side.x - state.x, dy = side.y - state.y;
    const want = new Set();
    if (dx > 12) want.add('d'); else if (dx < -12) want.add('a');
    if (dy > 12) want.add('s'); else if (dy < -12) want.add('w');
    if (foe.mode === 'warn' && state.gear.teleport.cd <= 0 && state.energy >= state.gear.teleport.cost && await aim(side.x, side.y)) {
      await movement(new Set()); await page.keyboard.press('Space'); await page.waitForTimeout(250);
    } else { await movement(want); await page.waitForTimeout(100); }
    return true;
  }
  if (!await aim(foe.x, foe.y)) return false;
  if (foe.boss && foe.mode === 'recover' && foe.distance > 110 && foe.distance < 290 &&
    state.gear.teleport.cd <= 0 && state.energy >= state.gear.teleport.cost) {
    await movement(new Set()); await page.keyboard.press('Space'); await page.waitForTimeout(300); return true;
  }
  const want = new Set();
  if (foe.distance > 67) {
    const next = await page.evaluate(goal => {
      const p = DM.dev.play(); const path = DM.AfterMidnight.findCasePath(p.world, p.player, goal);
      return path.find(q => Math.hypot(q.x - p.player.x, q.y - p.player.y) > 25) || goal;
    }, { x: foe.x, y: foe.y });
    if (next.x - state.x > 10) want.add('d'); else if (next.x - state.x < -10) want.add('a');
    if (next.y - state.y > 10) want.add('s'); else if (next.y - state.y < -10) want.add('w');
  }
  await movement(want);
  const close = state.foes.filter(e => e.distance < 145).length;
  if (state.hp < 50 && !foe.boss && state.gear.duplicate.cd <= 0 && state.energy >= state.gear.duplicate.cost)
    await page.keyboard.press('r');
  if ((!foe.boss || bossMeleeHits >= 3) && close >= 2 && state.gear.expand.cd <= 0 && state.energy >= state.gear.expand.cost)
    await page.keyboard.press('g');
  const meleeReady = foe.boss && foe.distance < 75 && state.gear.telekinesis.cd <= 0.01 && state.energy >= state.gear.telekinesis.cost;
  // Deliberately earn the melee proof before ranged gear can finish the boss.
  // Release between measured swings so hold-to-fight cannot recast while the
  // driver samples an already-running cooldown and miss a legitimate C hit.
  if (foe.boss) await page.keyboard.up('c');
  if (foe.boss ? meleeReady : foe.distance < 90) await page.keyboard.down('c');
  else await page.keyboard.up('c');
  if ((!foe.boss || bossMeleeHits >= 3) && !meleeReady && state.gear.disintegrate.cd <= 0.01 && state.energy >= state.gear.disintegrate.cost && Date.now() - lastShot > 350 && (hero !== 'rorschach' || foe.distance < 255)) {
    await page.keyboard.press('q'); lastShot = Date.now();
  }
  if (foe.boss && foe.mode === 'recover') await page.keyboard.down('f'); else await page.keyboard.up('f');
  await page.waitForTimeout(110);
  if (foe.boss) await page.keyboard.up('c');
  const after = await read();
  const survivor = after.foes.find(e => e.id === foe.id);
  if (meleeReady && after.gear.telekinesis.cd > state.gear.telekinesis.cd + 0.05 &&
    (!survivor || survivor.hp < foe.hp)) {
    bossMeleeHits++;
    bossMeleeProof.push({ phase: foe.phase, mode: foe.mode, distance: foe.distance,
      beforeHp: foe.hp, afterHp: survivor?.hp || 0, heroHp: after.hp });
  }
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
  await page.mouse.click(230, 307); await page.waitForTimeout(100);
  await page.mouse.click(1015, 390); await page.waitForTimeout(100);
  await screenshot('case-board'); await page.mouse.click(970, 515);
  await page.waitForFunction(() => DM.dev.play()?.chapter.id === 'am_glass_archive' || DM.Engine.top() instanceof DM.Scenes.Interlude);
  if (await page.evaluate(() => DM.Engine.top() instanceof DM.Scenes.Interlude)) {
    await page.waitForTimeout(700); await screenshot('case-interlude');
    await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => DM.dev.play()?.chapter.id === 'am_glass_archive');
  await page.waitForTimeout(150); await dialogue();
  check('actual menu starts The Glass Archive with a vulnerable human hero', await page.evaluate(id =>
    DM.dev.play().player.profile.id === id && DM.dev.play().ctx.stageIndex === 0, hero));
  await screenshot('museum-arrival');
  for (let index = 0; index < 3; index++) {
    const panel = await page.evaluate(index => { const e = DM.dev.play().ctx.flags.panels[index]; return { x: e.x, y: e.y, bit: 1 << index }; }, index);
    await walk(panel.x, panel.y + 40); await page.keyboard.press('e'); await page.waitForTimeout(150);
    check('actual E isolates security circuit ' + (index + 1), await page.evaluate(bit =>
      !!(DM.dev.play().ctx.flags.circuits & bit), panel.bit));
    await dialogue();
  }
  await page.waitForFunction(() => DM.dev.play().ctx.stageIndex === 1);
  check('three real circuits reach the archive checkpoint', await page.evaluate(() =>
    DM.dev.play().ctx.flags.lasers.every(laser => laser.off)));
  await screenshot('security-isolated');
  await use('archive'); await dialogue();
  await page.waitForFunction(() => DM.dev.play().ctx.stageIndex === 2);
  check('actual E recovers the ledger and starts the Surveyor encounter', await page.evaluate(() =>
    DM.dev.play().ctx.flags.ledger && DM.dev.play().world.boss instanceof DM.AfterMidnight.Surveyor));
  await screenshot('surveyor-arrival');
  for (let attempt = 0; attempt < 1200; attempt++) {
    const state = await read();
    if (!state.foes.length) break;
    if (await fight(state)) continue;
    const next = state.foes.sort((a, b) => a.distance - b.distance)[0];
    await walk(next.x, next.y);
  }
  await page.keyboard.up('c'); await page.keyboard.up('f'); await release();
  check('ordinary melee/gear can capture the boss with Normal damage', await page.evaluate(() =>
    DM.dev.play().ctx.flags.surveyorCaptured && !DM.dev.play().failed && DM.dev.play().player.coherence > 0));
  check('the live fight passed through all three phases', [1, 2, 3].every(phase => seenPhases.has(phase)));
  check('both late phases performed their telegraphed physical charge', chargePhases.has(2) && chargePhases.has(3));
  check('at least three actual close-range primary hits damaged the boss', bossMeleeHits >= 3);
  await screenshot('surveyor-captured');
  await use('exit'); await dialogue();
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.AfterMidnight.Results, null, { timeout: 10000 });
  const record = await page.evaluate(() => DM.Engine.top().record);
  check('the Archive ending records this hero, recovered ledger and nonlethal capture', record.completed &&
    record.run.hero === hero && record.flags.ledger && record.flags.archiveReturned && record.flags.surveyorCaptured && record.stats.disintegrated === 0);
  check('no browser or engine errors', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  await screenshot('case-closed'); trace.push({ label: 'case-closed', record });
  writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ target, hero, checks, errors, trace, lowestHealth,
    bossMeleeHits, bossMeleeProof, seenPhases: [...seenPhases], chargePhases: [...chargePhases],
    method: 'Actual menu/interlude and ordinary movement, melee, hook, evasive traversal and E actions; real RAF/Normal vulnerability; read-only path/cooldown/boss telemetry. Initial settings only.' }, null, 2));
  console.log(`ARCHIVE LIVE PASSED: ${checks.length} checks; lowest observed health ${lowestHealth.toFixed(2)}; ${bossMeleeHits} boss melee hits (${hero}, ${target}).`);
} catch (error) {
  await release(); await page.keyboard.up('c'); await page.keyboard.up('f'); await screenshot('failure');
  console.error({ bossMeleeHits, bossMeleeProof, seenPhases: [...seenPhases], chargePhases: [...chargePhases] });
  console.error(await read().catch(() => ({}))); console.error(error); process.exitCode = 1;
} finally { await release(); await page.keyboard.up('c'); await page.keyboard.up('f'); await browser.close(); }
