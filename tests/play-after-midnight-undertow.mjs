/* Ordinary-input Undertow as Silk Spectre: normal menus/interlude, real RAF.
 * Only initial settings are changed. Read-only path/target/cooldown telemetry
 * guides a known route. No placement, tester refills, god mode, quest edits,
 * stage skips or synthetic clock. Four workers must physically reach safety.
 * node tests/play-after-midnight-undertow.mjs [index.html|dist/dr-manhattan.html]
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
const out = path.join(root, 'tests/out/play-after-midnight-undertow', target.startsWith('dist/') ? 'standalone' : 'source');
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

const errors = [], checks = [], trace = [];
let lowestHealth = Infinity, held = new Set(), lastShot = 0;
page.on('pageerror', e => errors.push(String(e)));
const check = (label, pass) => { assert.ok(pass, label); checks.push(label); console.log('PASS ' + label); };
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
const read = async () => {
  const state = await page.evaluate(() => {
    const p = DM.dev.play();
    if (!p) return { scene: DM.Engine.top()?.constructor.name, error: DM.Engine.error ? String(DM.Engine.error) : null };
    const actor = p.player;
    return { scene: DM.Engine.top()?.constructor.name, chapter: p.chapter.id, stage: p.ctx.stageIndex,
      x: actor.x, y: actor.y, hp: actor.coherence, energy: actor.energy,
      hero: actor.profile?.id, challenge: DM.Save.settings.challenge, god: !!actor.godMode || !!DM.Save.settings.invulnerable,
      failed: p.failed, dialog: p.dialog.active, error: DM.Engine.error ? String(DM.Engine.error) : null,
      power: p.ctx.flags.power || 0, winchOpen: !!p.ctx.flags.winchOpen,
      rescued: p.ctx.flags.rescued || 0, mask: p.ctx.flags.rescuedMask || 0,
      spared: p.ctx.stats.spared, gone: p.ctx.stats.disintegrated,
      gear: Object.fromEntries(Object.entries(actor.powers).map(([id, state]) => [DM.Powers.get(id).action,
        { cd: state.cd, cost: DM.Powers.get(id).cost }])),
      foes: p.world.entities.filter(e => e.team === 'enemy' && !e.dead && !e.ko && !e.isProjectile && e.hp != null)
        .map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp,
          distance: Math.hypot(e.x - actor.x, e.y - actor.y), los: p.world.los(actor.x, actor.y, e.x, e.y),
          screen: p.world.camera.toScreen(e.x, e.y), windup: e.windup || e.aim || 0 })),
    };
  });
  assert.ok(!state.error, 'no engine error: ' + state.error);
  if (state.hp != null) {
    lowestHealth = Math.min(lowestHealth, state.hp);
    assert.ok(state.hero === 'silkspectre' && state.challenge === 'normal' && !state.god && !state.failed && state.hp > 0,
      'normal-damage Silk Spectre route remains alive: ' + JSON.stringify(state));
  }
  return state;
};
const release = async () => {
  for (const key of held) await page.keyboard.up(key);
  held.clear();
};
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
async function fight(state) {
  const foe = state.foes.filter(e => e.los && e.distance < 360).sort((a, b) => a.distance - b.distance)[0];
  if (!foe || !await aim(foe.x, foe.y)) return false;
  await movement(new Set());
  if (state.hp < 55 && state.gear.duplicate.cd <= 0 && state.energy >= state.gear.duplicate.cost)
    await page.keyboard.press('r');
  if (state.foes.filter(e => e.distance < 140).length >= 2 && state.gear.expand.cd <= 0 && state.energy >= state.gear.expand.cost)
    await page.keyboard.press('g');
  if (foe.distance < 90) await page.keyboard.down('c');
  if (foe.distance < 105 && foe.windup > 0) await page.keyboard.down('f');
  if (state.gear.disintegrate.cd <= 0.01 && state.energy >= state.gear.disintegrate.cost && Date.now() - lastShot > 350) {
    await page.keyboard.press('q'); lastShot = Date.now();
  }
  await page.waitForTimeout(110);
  await page.keyboard.up('c'); await page.keyboard.up('f');
  return true;
}
async function walk(x, y) {
  let route = [], replan = 0;
  for (let i = 0; i < 1600; i++) {
    const s = await read();
    if (s.dialog) { await dialogue(); route = []; continue; }
    if (Math.hypot(s.x - x, s.y - y) < 28) { await release(); return; }
    if (await fight(s)) { route = []; continue; }
    if (!route.length || --replan <= 0) {
      route = await page.evaluate(goal => {
        const p = DM.dev.play(); return DM.AfterMidnight.findCasePath(p.world, p.player, goal);
      }, { x, y });
      replan = 20;
    }
    while (route.length && Math.hypot(route[0].x - s.x, route[0].y - s.y) < 25) route.shift();
    const next = route[0] || { x, y }, dx = next.x - s.x, dy = next.y - s.y;
    const want = new Set();
    if (dx > 9) want.add('d'); else if (dx < -9) want.add('a');
    if (dy > 9) want.add('s'); else if (dy < -9) want.add('w');
    await movement(want); await page.waitForTimeout(85);
  }
  throw new Error('Route blocked before ' + x + ',' + y + ': ' + JSON.stringify(await read()));
}
const use = async flag => {
  const point = await page.evaluate(flag => { const e = DM.dev.play().ctx.flags[flag]; return { x: e.x, y: e.y }; }, flag);
  await walk(point.x, point.y + 38); await page.keyboard.press('e'); await page.waitForTimeout(150);
};
const clearEncounter = async () => {
  for (let i = 0; i < 500; i++) {
    const s = await read();
    if (s.dialog) { await dialogue(); continue; }
    if (!s.foes.length) return;
    if (await fight(s)) continue;
    const foe = s.foes.sort((a, b) => a.distance - b.distance)[0];
    await walk(foe.x, foe.y);
  }
  throw new Error('The actual-input encounter did not clear');
};

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
    const board = DM.Engine.top(), index = DM.AfterMidnight.heroes.findIndex(e => e.id === 'silkspectre');
    const r = board.heroRect(index); return { x: r.x + 170, y: r.y + 50 };
  });
  await page.mouse.click(hero.x, hero.y); await page.waitForTimeout(100);
  await boardAction('CHOOSE A CASE OR MODE');
  await boardCard('mode', 0);
  const casePoint = await page.evaluate(() => {
    const board = DM.Engine.top(), index = board.choices().findIndex(choice => choice.id === 'undertow');
    const r = board.caseRect(index); return { x: r.x + 160, y: r.y + 45 };
  });
  await page.mouse.click(casePoint.x, casePoint.y); await page.waitForTimeout(100);
  await shot('case-board');
  await boardAction('OPEN CASE FILE');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.Interlude || DM.dev.play()?.chapter.id === 'am_undertow');
  const sawInterlude = await page.evaluate(() => DM.Engine.top() instanceof DM.Scenes.Interlude);
  if (sawInterlude) {
    await page.waitForTimeout(700); await shot('case-interlude');
    await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => DM.dev.play()?.chapter.id === 'am_undertow');
  await page.waitForTimeout(150); await dialogue();
  check('normal menus and interlude start Undertow as vulnerable Silk Spectre', sawInterlude && await page.evaluate(() => {
    const p = DM.dev.play(); return p.player.profile.id === 'silkspectre' && !p.player.godMode && p.ctx.stageIndex === 0;
  }));
  await shot('harbour-arrival'); trace.push({ moment: 'arrival', ...await read() });
  for (let index = 0; index < 2; index++) {
    const point = await page.evaluate(index => {
      const e = DM.dev.play().ctx.flags.generators[index]; return { x: e.x, y: e.y };
    }, index);
    await walk(point.x, point.y + 38); await page.keyboard.press('e'); await page.waitForTimeout(150);
    check('E physically isolates cable feed ' + (index + 1), await page.evaluate(bit =>
      !!(DM.dev.play().ctx.flags.power & bit), 1 << index));
  }
  await page.waitForFunction(() => DM.dev.play().ctx.stageIndex === 1); await dialogue();
  check('both isolated feeds stop their actual wet-dock hazards', await page.evaluate(() =>
    DM.dev.play().ctx.flags.cables.every(e => e.off)));
  await shot('cables-isolated'); trace.push({ moment: 'cables-isolated', ...await read() });
  await clearEncounter(); await use('winch');
  check('real E lowers the powered, cleared cargo winch', (await read()).winchOpen);
  await shot('gangway-lowered');
  // Gather the east workers first, then return west along a clear shared route.
  for (const index of [1, 2, 3, 0]) {
    const worker = await page.evaluate(index => {
      const e = DM.dev.play().ctx.flags.workers[index]; return { x: e.x, y: e.y, safe: e.safe };
    }, index);
    if (!worker.safe) {
      await walk(worker.x, worker.y + 38); await page.keyboard.press('e'); await page.waitForTimeout(150);
    }
    check('worker ' + index + ' actually accepts the E escort request', await page.evaluate(index => {
      const e = DM.dev.play().ctx.flags.workers[index]; return e.following || e.safe;
    }, index));
  }
  check('escort requests alone have not fabricated four safe workers', await page.evaluate(() =>
    DM.dev.play().ctx.flags.workers.some(e => !e.safe)));
  await shot('four-workers-following');
  await walk(270, 1060);
  await page.waitForFunction(() => DM.dev.play().ctx.flags.rescuedMask === 15, null, { timeout: 60000 });
  check('all four workers physically reach the green lifeboat area', await page.evaluate(() => {
    const p = DM.dev.play(); return p.ctx.flags.rescued === 4 && p.ctx.flags.rescuedMask === 15 &&
      p.ctx.flags.workers.every(e => e.safe && Math.hypot(e.x - p.world.amSafePoint.x, e.y - p.world.amSafePoint.y) < 96);
  }));
  await shot('four-workers-safe'); trace.push({ moment: 'four-safe', ...await read() });
  await page.waitForFunction(() => DM.dev.play().ctx.stageIndex === 2); await dialogue();
  check('the departure checkpoint retains four genuine rescues', await page.evaluate(() => {
    const p = DM.dev.play(); return p.ctx.checkpointCarry.flags.rescuedMask === 15 && p.ctx.checkpointCarry.flags.rescued === 4;
  }));
  await clearEncounter();
  check('actual nonlethal combat clears the final lifeboat pursuers', (await read()).foes.length === 0 && (await read()).gone === 0);
  await use('launch'); await dialogue();
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.AfterMidnight.Results, null, { timeout: 10000 });
  const record = await page.evaluate(() => DM.Engine.top().record);
  check('Silk Spectre closes Undertow with all four rescued and none unmade', record.completed &&
    record.run.hero === 'silkspectre' && record.flags.departed && record.flags.rescued === 4 &&
    record.flags.rescuedMask === 15 && record.stats.disintegrated === 0);
  check('the harbour journey never writes old campaign or bonus saves', await page.evaluate(() =>
    localStorage.getItem('dr-manhattan.save') === __campaignBefore && localStorage.getItem('dr-manhattan.bonus.v1') === __bonusBefore));
  check('no page or engine errors during the full harbour journey', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  await shot('case-closed'); trace.push({ moment: 'case-closed', record });
  writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ target, hero: 'silkspectre', checks, errors, trace, lowestHealth,
    method: 'Normal title/board/interlude, real keyboard/mouse/RAF, normal damage. Initial settings only; read-only path/target/cooldown telemetry. No placements, tester refills, invulnerability, quest edits or skips.' }, null, 2));
  console.log(`UNDERTOW LIVE PASSED: ${checks.length} checks; lowest observed health ${lowestHealth.toFixed(2)} (silkspectre, ${target}).`);
} catch (e) {
  await release(); await shot('failure'); console.error(await read().catch(() => ({}))); console.error(e); process.exitCode = 1;
} finally { await release(); await browser.close(); }
