/* Rescue Clock feasibility through ordinary menus, real RAF and real controls.
 * Initial settings only; read-only paths, targets and warnings guide a known
 * route. No actor placement, tester refills, invulnerability, quest edits,
 * stage skips or synthetic clock. The four escorts must physically arrive
 * before the actual deadline. Not a first-time human difficulty assessment.
 * node tests/play-after-midnight-clock.mjs [index.html|dist/dr-manhattan.html]
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
const out = path.join(root, 'tests/out/play-after-midnight-clock', target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
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

const errors = [], checks = [], trace = [], evaded = new Set(), observedHazardHits = new Set();
let lowestHealth = Infinity, held = new Set(), lastShot = 0;
page.on('pageerror', e => errors.push(String(e)));
const check = (label, pass) => { assert.ok(pass, label); checks.push(label); console.log('PASS ' + label); };
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
const read = async () => {
  const s = await page.evaluate(() => {
    const p = DM.dev.play();
    if (!p) return { scene: DM.Engine.top()?.constructor.name, error: DM.Engine.error ? String(DM.Engine.error) : null };
    const actor = p.player, d = p.ctx.flags.director, f = p.ctx.flags, w = p.world;
    const active = e => !e.dead && !e.ko;
    return { scene: DM.Engine.top()?.constructor.name, chapter: p.chapter.id, hero: actor.profile?.id,
      x: actor.x, y: actor.y, radius: actor.r, hp: actor.coherence, energy: actor.energy,
      god: !!actor.godMode || !!DM.Save.settings.invulnerable, challenge: DM.Save.settings.challenge,
      failed: p.failed, dialog: p.dialog.active, error: DM.Engine.error ? String(DM.Engine.error) : null,
      clock: f.clockLeft, rescued: f.rescued || 0, lost: f.lost || 0, modeResult: f.modeResult,
      spared: p.ctx.stats.spared, gone: p.ctx.stats.disintegrated, lastHit: actor.lastHit,
      safePoint: d ? { ...d.safe } : null,
      gear: Object.fromEntries(Object.entries(actor.powers).map(([id, state]) => [DM.Powers.get(id).action,
        { cd: state.cd, cost: DM.Powers.get(id).cost }])),
      foes: w.entities.filter(e => e.team === 'enemy' && active(e) && !e.isProjectile && e.hp != null)
        .map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, distance: Math.hypot(e.x - actor.x, e.y - actor.y),
          los: w.los(actor.x, actor.y, e.x, e.y), screen: w.camera.toScreen(e.x, e.y), windup: e.windup || e.aim || 0 })),
      civilians: d?.civilians.map((e, index) => ({ index, x: e.x, y: e.y, hp: e.hp, following: e.following,
        safe: e.safe, dead: e.dead, threatened: w.entities.some(foe => foe.amChallengeEnemy && active(foe) &&
          Math.hypot(foe.x - e.x, foe.y - e.y) < 150 && w.los(foe.x, foe.y, e.x, e.y)) })) || [],
      strikes: w.entities.filter(e => !e.dead && e.constructor.name === 'SignalStrike')
        .map(e => ({ id: e.id, x: e.x, y: e.y, radius: e.r, left: e.left })),
    };
  });
  assert.ok(!s.error, 'no engine error: ' + s.error);
  if (s.hp != null) {
    lowestHealth = Math.min(lowestHealth, s.hp);
    assert.ok(s.hero === 'silkspectre' && s.challenge === 'normal' && !s.god && !s.failed && s.hp > 0,
      'normal-damage timed route stays alive: ' + JSON.stringify(s));
    assert.equal(s.lost, 0, 'all four civilians must survive the ordinary-input run');
    assert.notEqual(s.modeResult, 'timeout', 'the actual deadline may not be bypassed');
    if (s.lastHit?.by === 'SignalStrike') observedHazardHits.add(s.lastHit.at);
  }
  return s;
};
const release = async () => { for (const key of held) await page.keyboard.up(key); held.clear(); };
const movement = async want => {
  for (const key of held) if (!want.has(key)) await page.keyboard.up(key);
  for (const key of want) if (!held.has(key)) await page.keyboard.down(key);
  held = want;
};
const aim = async (x, y) => {
  const point = await page.evaluate(goal => DM.dev.play().world.camera.toScreen(goal.x, goal.y), { x, y });
  if (point.x < 15 || point.x > 1265 || point.y < 100 || point.y > 585) return false;
  await page.mouse.move(point.x, point.y); return true;
};
const dialogue = async () => {
  await release();
  for (let i = 0; i < 40 && (await read()).dialog; i++) {
    await page.keyboard.press('e'); await page.waitForTimeout(100);
  }
  await page.waitForTimeout(100);
};
async function evade(s) {
  const ring = s.strikes.find(e => e.left > 0 && Math.hypot(e.x - s.x, e.y - s.y) < e.radius + s.radius + 25);
  if (!ring) return false;
  const point = await page.evaluate(() => {
    const p = DM.dev.play(), w = p.world, actor = p.player;
    const strikes = w.entities.filter(e => !e.dead && e.constructor.name === 'SignalStrike');
    for (const a of [0, Math.PI, -Math.PI / 2, Math.PI / 2, -Math.PI / 4, Math.PI / 4, Math.PI * 0.75, -Math.PI * 0.75]) {
      const end = { x: actor.x + Math.cos(a) * 175, y: actor.y + Math.sin(a) * 175 };
      let free = true;
      for (let i = 0; i <= 12; i++) if (!w.isFree(actor.x + (end.x - actor.x) * i / 12,
        actor.y + (end.y - actor.y) * i / 12, actor.r)) { free = false; break; }
      const screen = w.camera.toScreen(end.x, end.y);
      if (free && screen.x > 20 && screen.x < 1260 && screen.y > 105 && screen.y < 580 &&
        strikes.every(e => Math.hypot(e.x - end.x, e.y - end.y) > e.r + actor.r + 15)) return end;
    }
    return null;
  });
  if (!point) return false;
  await release();
  if (!evaded.size) await shot('amber-warning');
  if (s.gear.teleport.cd <= 0.01 && s.energy >= s.gear.teleport.cost && await aim(point.x, point.y)) {
    await page.keyboard.press('Space'); await page.waitForTimeout(240);
  } else {
    const want = new Set();
    if (point.x > s.x + 10) want.add('d'); else if (point.x < s.x - 10) want.add('a');
    if (point.y > s.y + 10) want.add('s'); else if (point.y < s.y - 10) want.add('w');
    await movement(want); await page.waitForTimeout(550); await release();
  }
  const after = await read();
  if (Math.hypot(after.x - ring.x, after.y - ring.y) > ring.radius + after.radius + 8) {
    evaded.add(ring.id); trace.push({ moment: 'hazard-cleared', ring, player: after });
  }
  return true;
}
async function fight(s) {
  const foe = s.foes.filter(e => e.los && e.distance < 410).sort((a, b) => a.distance - b.distance)[0];
  if (!foe || !await aim(foe.x, foe.y)) return false;
  await movement(new Set());
  if (s.hp < 55 && s.gear.duplicate.cd <= 0 && s.energy >= s.gear.duplicate.cost) await page.keyboard.press('r');
  if (s.foes.filter(e => e.distance < 140).length >= 2 && s.gear.expand.cd <= 0 && s.energy >= s.gear.expand.cost)
    await page.keyboard.press('g');
  if (foe.distance < 90) await page.keyboard.down('c');
  if (foe.distance < 105 && foe.windup > 0) await page.keyboard.down('f');
  if (s.gear.disintegrate.cd <= 0.01 && s.energy >= s.gear.disintegrate.cost && Date.now() - lastShot > 350) {
    await page.keyboard.press('q'); lastShot = Date.now();
  }
  await page.waitForTimeout(100); await page.keyboard.up('c'); await page.keyboard.up('f');
  return true;
}
async function walk(x, y) {
  let route = [], replan = 0;
  for (let i = 0; i < 1100; i++) {
    const s = await read();
    if (s.rescued === 4 || s.scene === 'Results') { await release(); return; }
    if (s.dialog) { await dialogue(); route = []; continue; }
    if (await evade(s)) { route = []; continue; }
    if (Math.hypot(s.x - x, s.y - y) < 28) { await release(); return; }
    if (await fight(s)) { route = []; continue; }
    if (!route.length || --replan <= 0) {
      route = await page.evaluate(goal => {
        const p = DM.dev.play(); return DM.AfterMidnight.escortRoute(p.world, p.player, goal);
      }, { x, y });
      replan = 20;
    }
    while (route.length && Math.hypot(route[0].x - s.x, route[0].y - s.y) < 25) route.shift();
    const next = route[0] || { x, y }, dx = next.x - s.x, dy = next.y - s.y;
    const want = new Set();
    if (dx > 9) want.add('d'); else if (dx < -9) want.add('a');
    if (dy > 9) want.add('s'); else if (dy < -9) want.add('w');
    await movement(want); await page.waitForTimeout(80);
  }
  throw new Error('Timed route blocked before ' + x + ',' + y + ': ' + JSON.stringify(await read()));
}

try {
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.heroes);
  await page.evaluate(() => {
    DM.Save.settings.focusPause = false; DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.challenge = 'normal'; DM.Save.settings.invulnerable = false;
    window.__campaignBefore = localStorage.getItem('dr-manhattan.save');
    window.__bonusBefore = localStorage.getItem('dr-manhattan.bonus.v1');
  });
  await page.mouse.click(640, 360); await page.waitForTimeout(150);
  const title = await page.evaluate(() => {
    const menu = DM.Engine.top().menu, r = menu.rowRect(menu.items.findIndex(e => e.label === 'AFTER MIDNIGHT'));
    return { x: r.x + 100, y: r.y + r.h / 2 };
  });
  await page.mouse.click(title.x, title.y);
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu);
  const hero = await page.evaluate(() => {
    const board = DM.Engine.top(), r = board.heroRect(DM.AfterMidnight.heroes.findIndex(e => e.id === 'silkspectre'));
    return { x: r.x + 170, y: r.y + 50 };
  });
  await page.mouse.click(hero.x, hero.y); await page.waitForTimeout(100);
  await boardAction('CHOOSE A CASE OR MODE');
  const mode = await page.evaluate(() => {
    const r = DM.Engine.top().modeRect(2); return { x: r.x + 150, y: r.y + 20 };
  });
  await page.mouse.click(mode.x, mode.y); await page.waitForTimeout(100);
  const theme = await page.evaluate(() => {
    const board = DM.Engine.top(), r = board.caseRect(board.choices().findIndex(e => e.id === 'rooftops'));
    return { x: r.x + 170, y: r.y + 45 };
  });
  await page.mouse.click(theme.x, theme.y); await page.waitForTimeout(100); await shot('case-board');
  await boardAction('START THIS RUN');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.Interlude || DM.dev.play()?.chapter.id === 'am_rescue_clock');
  const sawInterlude = await page.evaluate(() => DM.Engine.top() instanceof DM.Scenes.Interlude);
  if (sawInterlude) {
    await page.waitForTimeout(700); await shot('case-interlude');
    await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => DM.dev.play()?.chapter.id === 'am_rescue_clock');
  await page.waitForTimeout(150); await dialogue();
  await page.waitForFunction(() => DM.dev.play()?.ctx.flags.director?.running);
  const initial = await read();
  check('real menus and interlude start a fresh normal-damage Rescue Clock', sawInterlude && initial.hero === 'silkspectre' &&
    initial.clock > 0 && initial.clock <= 180 && initial.rescued === 0 && initial.lost === 0);
  await shot('clock-start'); trace.push({ moment: 'clock-start', player: initial });
  for (const index of [0, 3, 1, 2]) {
    let accepted = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const e = (await read()).civilians[index];
      if (e.following || e.safe) { accepted = true; break; }
      await walk(e.x, e.y + 35); await page.keyboard.press('e'); await page.waitForTimeout(150);
      const after = (await read()).civilians[index];
      if (after.following || after.safe) { accepted = true; break; }
    }
    check('ordinary E starts physical escort ' + index, accepted);
    trace.push({ moment: 'escort-' + index, player: await read() });
  }
  check('all four requests are actual followers, not instant safe flags', (await read()).civilians.every(e => e.following || e.safe) &&
    (await read()).civilians.some(e => !e.safe));
  await shot('escorts-in-progress');
  const safe = (await read()).safePoint; await walk(safe.x, safe.y);
  for (let i = 0; i < 1200; i++) {
    const s = await read();
    if (s.rescued === 4) break;
    if (await evade(s)) continue;
    if (await fight(s)) continue;
    const threatened = s.civilians.filter(e => e.following && !e.safe && e.threatened)
      .sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
    if (threatened) await walk(threatened.x + 35, threatened.y + 35);
    else await page.waitForTimeout(100);
  }
  const rescued = await read();
  check('all four civilians physically reach safety before the actual deadline', rescued.rescued === 4 && rescued.lost === 0 &&
    rescued.clock > 0 && rescued.civilians.every(e => e.safe && Math.hypot(e.x - safe.x, e.y - safe.y) < 66));
  check('ordinary nonlethal gear dealt with real challenge enemies', rescued.spared >= 3 && rescued.gone === 0);
  check('real movement or Space vaulting cleared at least one amber strike warning', evaded.size > 0);
  await shot('four-safe'); await dialogue();
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.AfterMidnight.Results, null, { timeout: 10000 });
  const record = await page.evaluate(() => DM.Engine.top().record);
  check('the timed mode records a rescued win, not a partial extraction or timeout', record.completed &&
    record.flags.modeResult === 'rescued' && !record.flags.extracted && record.flags.rescued === 4 && record.flags.lost === 0 &&
    record.flags.clockLeft > 0 && record.score >= 2000 && record.run.hero === 'silkspectre' && record.run.theme === 'rooftops');
  check('the timed run leaves both older save slots unchanged', await page.evaluate(() =>
    localStorage.getItem('dr-manhattan.save') === __campaignBefore && localStorage.getItem('dr-manhattan.bonus.v1') === __bonusBefore));
  check('no page or engine errors during the full timed challenge', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  await shot('rescue-clock-won'); trace.push({ moment: 'rescue-clock-won', record });
  writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ target, hero: 'silkspectre', theme: 'rooftops', checks, errors,
    trace, lowestHealth, hazardsEvaded: evaded.size, observedHazardHits: observedHazardHits.size,
    method: 'Actual title/board/interlude; real keyboard/mouse/RAF; Normal and no invulnerability. Initial settings only. Read-only navigation/target/cooldown/warning telemetry; no placements, tester refills, quest edits, extraction shortcut or synthetic clock.' }, null, 2));
  console.log(`RESCUE CLOCK LIVE PASSED: ${checks.length} checks; four safe, ${record.flags.clockLeft.toFixed(2)}s left; ` +
    `lowest observed health ${lowestHealth.toFixed(2)}; ${evaded.size} hazards cleared (${target}).`);
} catch (e) {
  await release(); await shot('failure'); console.error(await read().catch(() => ({}))); console.error(e); process.exitCode = 1;
} finally { await release(); await browser.close(); }
