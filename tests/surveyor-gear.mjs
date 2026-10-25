/* Focused boss-local regression: ordinary Owl Q must not suppress every phase.
 * Controlled initial checkpoint/position, actual keyboard Q, real powers and
 * stepped engine; no direct damage, stamina/health refills or ability overrides.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(value => value.endsWith('.html')) || 'index.html';
const out = path.join(root, 'tests/out/surveyor-gear', target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(String(error)));
const check = (label, ok) => { assert.ok(ok, label); checks.push(label); console.log('PASS ' + label); };
try {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.Surveyor, null, { polling: 100 });
  await page.evaluate(() => {
    const AM = DM.AfterMidnight;
    DM.Save.settings.focusPause = false; DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.invulnerable = false; DM.Save.settings.challenge = 'normal'; DM.Engine.governor.enabled = false;
    AM.run = AM.config({ hero: 'niteowl' }, AM.byId.glass_archive);
    window.B = { phases: new Set(), modes: new Set(), chargePhases: new Set(), shots: 0, minimumHealth: Infinity,
      step(seconds = 0.05) {
        const E = DM.Engine, render = E.render; E.render = () => {};
        try { for (let i = 0; i < Math.ceil(seconds * 60); i++) {
          E.frame(E.last + 1000 / 60); if (E.error) throw E.error;
          const p = DM.dev.play(), boss = p.ctx.refs.testBoss || p.world.boss;
          if (boss) { this.phases.add(boss.phase); this.modes.add(boss.attackMode);
            if (boss.attackMode === 'charge') this.chargePhases.add(boss.phase); }
          this.minimumHealth = Math.min(this.minimumHealth, p.player.coherence);
        } } finally { E.render = render; }
        E.render();
      } };
    DM.Engine.set(new DM.Scenes.Play(), { chapter: 'am_glass_archive', stage: 2,
      carry: { stats: { time: 0, spared: 0, disintegrated: 0, memories: 0 }, flags: { circuits: 7, ledger: true }, found: [] } });
    B.step(0.1);
    for (let i = 0; i < 20 && DM.dev.play().dialog.active; i++) DM.dev.play().dialog.advance();
    B.step(0.1);
    const play = DM.dev.play(); play.ctx.place(1050, 680); play.ctx.refs.testBoss = play.world.boss;
    B.step(0.1);
  });
  check('controlled encounter uses normal vulnerability and the real Owl stun bolt', await page.evaluate(() => {
    const p = DM.dev.play().player;
    return !p.godMode && !DM.Save.settings.invulnerable && p.form === 'vigilante' &&
      p.profile.id === 'niteowl' && DM.Powers.get(p.profile.abilities[1].id).action === 'disintegrate';
  }));
  for (let frame = 0; frame < 900; frame++) {
    const state = await page.evaluate(() => {
      const p = DM.dev.play(), b = p.ctx.refs.testBoss, gear = p.player.powers[p.player.profile.abilities[1].id];
      return { dead: b.dead, ko: b.ko, down: p.player.down, hp: p.player.coherence,
        ready: gear.cd <= 0.035 && p.player.energy >= 13, aim: p.world.camera.toScreen(b.x, b.y) };
    });
    assert.ok(!state.down && state.hp > 0, 'ordinary gear test must survive without health edits');
    if (state.ko || state.dead) break;
    if (state.ready) {
      await page.mouse.move(state.aim.x, state.aim.y);
      await page.keyboard.press('q');
      await page.evaluate(() => { B.shots++; });
    }
    await page.evaluate(() => B.step(0.05));
  }
  const result = await page.evaluate(() => {
    const play = DM.dev.play(), b = play.ctx.refs.testBoss;
    return { phases: [...B.phases], modes: [...B.modes], chargePhases: [...B.chargePhases],
      shots: B.shots, minimumHealth: B.minimumHealth, ko: b.ko, dead: b.dead, hp: b.hp,
      captured: play.ctx.flags.surveyorCaptured, spared: play.ctx.stats.spared, gone: play.ctx.stats.disintegrated };
  });
  writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  await page.screenshot({ path: path.join(out, 'ordinary-Q-outcome.png') });
  console.log(JSON.stringify(result));
  check('ordinary repeated Q cannot suppress the second and third boss phases', result.phases.includes(2) && result.phases.includes(3));
  check('both damaged phases show a physical charge rather than permanent stun', result.chargePhases.includes(2) && result.chargePhases.includes(3));
  check('normal gear can still capture the Surveyor nonlethally', result.ko && !result.dead && result.captured && result.spared === 1 && result.gone === 0);
  check('boss gear regression produces no browser errors', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  console.log(`SURVEYOR GEAR PASSED: ${checks.length} checks (${target}).`);
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') }); console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
