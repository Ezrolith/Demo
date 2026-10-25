/* Real-RAF known-route Patrol. Initial scene/settings setup only, followed by
 * ordinary keyboard/mouse. Read-only path/target telemetry guides the route;
 * there is no actor placement, tester refill, invulnerability or quest edit.
 * The field kit heals through an ordinary E interaction. Not a first-time
 * human playthrough or a guarantee about the challenge's balance.
 * node tests/play-after-midnight-patrol.mjs [index.html|dist/dr-manhattan.html]
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
const out = path.join(root, 'tests/out/after-midnight-live', target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
let lowest = Infinity;
const read = async () => {
  const s = await page.evaluate(() => {
    const p = DM.dev.play(), d = p?.ctx.flags.director;
    return { x: p?.player.x, y: p?.player.y, hp: p?.player.coherence, god: !!p?.player.godMode || !!DM.Save.settings.invulnerable,
      failed: p?.failed, scene: DM.Engine.top().constructor.name, dialog: p?.dialog.active,
      phase: d?.phase, score: p?.ctx.flags.score, wave: p?.ctx.flags.wave, spared: p?.ctx.stats.spared, gone: p?.ctx.stats.disintegrated,
      hero: p?.player.profile?.id, engineError: DM.Engine.error ? String(DM.Engine.error) : null };
  });
  lowest = Math.min(lowest, s.hp);
  assert.ok(!s.god && !s.failed && s.hp > 0 && !s.engineError && s.hero === 'niteowl', JSON.stringify(s)); return s;
};
async function walk(x, y, seconds = 20) {
  const route = await page.evaluate(([x, y]) => {
    const p = DM.dev.play(), AM = DM.AfterMidnight;
    const direct = AM.escortRoute(p.world, p.player, { x, y });
    if (direct.length) return direct;
    // A moving enemy can stand closer to cover than the civilian route grid.
    // Approach its nearest validated arrival point instead of moving any actor.
    for (const point of [...p.world.amSpawnPoints].sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))) {
      const route = AM.escortRoute(p.world,p.player,point); if (route.length) return route;
    }
    return [];
  }, [x, y]);
  assert.ok(route.length, 'read-only path planning finds a walkable route');
  let index = 0; const down = new Set();
  try {
    for (let i = 0; i < seconds * 10; i++) {
      const p = await read(); if (Math.hypot(x - p.x, y - p.y) < 25) return true;
      while (index < route.length - 1 && Math.hypot(route[index].x - p.x, route[index].y - p.y) < 22) index++;
      const target = route[index], dx = target.x - p.x, dy = target.y - p.y;
      const keys = new Set([dx < -8 ? 'a' : dx > 8 ? 'd' : null, dy < -8 ? 'w' : dy > 8 ? 's' : null]);
      for (const k of ['a', 'd', 'w', 's']) {
        if (keys.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
        if (!keys.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
      }
      await page.waitForTimeout(100);
    }
  } finally { for (const k of down) await page.keyboard.up(k); }
  return false;
}
try {
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.PatrolDirector);
  await page.mouse.click(640, 360);
  await page.evaluate(() => {
    window.__oldCampaign = localStorage.getItem('dr-manhattan.save');
    window.__oldBonus = localStorage.getItem('dr-manhattan.bonus.v1');
    DM.Save.settings.focusPause = false; DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.challenge = 'normal'; DM.Save.settings.invulnerable = false;
    DM.AfterMidnight.start('patrol', { hero: 'niteowl', theme: 'rooftops', instant: true });
  });
  await page.waitForFunction(() => DM.dev.play()?.dialog.active || DM.dev.play()?.ctx.flags.director);
  for (let i = 0; i < 20 && (await read()).dialog; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(120); }
  await page.waitForFunction(() => DM.dev.play()?.ctx.flags.director?.phase === 'combat');
  await page.waitForTimeout(2600);
  for (let i = 0; i < 45 && (await read()).phase !== 'rest'; i++) {
    const target = await page.evaluate(() => {
      const p = DM.dev.play(), e = p.ctx.flags.director.enemies.filter(e => !e.dead && !e.ko)
        .sort((a, b) => Math.hypot(a.x-p.player.x,a.y-p.player.y)-Math.hypot(b.x-p.player.x,b.y-p.player.y))[0];
      if (!e) return null;
      const screen = p.world.camera.toScreen(e.x, e.y);
      return { x: e.x, y: e.y, screen, distance: Math.hypot(e.x-p.player.x,e.y-p.player.y), los: p.world.los(p.player.x,p.player.y,e.x,e.y) };
    });
    if (!target) { await page.waitForTimeout(300); continue; }
    if (target.distance > 490 || !target.los || target.screen.x < 20 || target.screen.x > 1260 || target.screen.y < 110 || target.screen.y > 550) {
      await page.mouse.move(640,360); await walk(target.x, target.y, 1.2);
    } else {
      await page.mouse.move(target.screen.x,target.screen.y);
      await page.keyboard.press('q'); await page.waitForTimeout(650);
    }
    if ((await read()).hp < 55) await page.keyboard.press('r');
  }
  assert.equal((await read()).phase,'rest','natural stun bolts and movement clear the two-guard patrol');
  await page.screenshot({path:out+'/patrol-cleared.png'});
  const terminal = async text => {
    const e = await page.evaluate(text => { const e=DM.dev.play().world.entities.find(e=>e.interact?.label.includes(text));return{x:e.x,y:e.y};},text);
    await page.mouse.move(640,360); assert.ok(await walk(e.x,e.y-35,22)); await page.keyboard.press('e');await page.waitForTimeout(180);
  };
  await terminal('FIELD KIT'); await terminal('ARMOUR');
  assert.equal(await page.evaluate(()=>DM.dev.play().player.upgrades.vitality),1);
  await terminal('EXTRACT');
  for(let i=0;i<20;i++){const s=await read();if(s.scene==='Results')break;if(s.dialog)await page.keyboard.press('Space');await page.waitForTimeout(150);}
  await page.waitForFunction(()=>DM.Engine.top() instanceof DM.AfterMidnight.Results);
  const end = await read(); assert.equal(end.spared,2);assert.equal(end.gone,0);
  assert.ok(await page.evaluate(() => {
    const AM = DM.AfterMidnight, record = AM.data.records[AM.slot('patrol', AM.run)];
    return record.completed && record.flags.modeResult === 'extracted' && record.flags.wave === 1 && record.score > 0 &&
      localStorage.getItem('dr-manhattan.save') === __oldCampaign && localStorage.getItem('dr-manhattan.bonus.v1') === __oldBonus;
  }), 'natural extraction records its actual completed wave while old saves stay unchanged');
  assert.equal(errors.length, 0, 'no page errors');
  await page.screenshot({path:out+'/patrol-extracted.png'});
  writeFileSync(out+'/patrol.json',JSON.stringify({target,method:'First-spawn/settings setup only; real RAF/keyboard/mouse and read-only path/target telemetry. No placement, tester refills, invulnerability or quest edits. Field-kit healing uses actual E.',lowestObservedHealth:lowest,end,errors},null,2));
  console.log('NORMAL PATROL PASSED: two spared, gear chosen, real field kit and extraction; lowest observed health '+lowest+' ('+target+').');
} catch(e){await page.screenshot({path:out+'/patrol-failure.png'});console.error(await read().catch(()=>null));console.error(e);process.exitCode=1;}
finally{await browser.close();}
