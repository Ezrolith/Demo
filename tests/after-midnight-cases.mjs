/* After Midnight story acceptance. Real engine/storage; controlled placement and
 * stepped simulation isolate progression, physical escorts and checkpoint state.
 * This is not a natural-damage balance run. node tests/after-midnight-cases.mjs [file.html]
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
const out = path.join(root, 'tests/out/after-midnight-cases', engine, target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(String(error)));
const check = (label, ok) => { assert.ok(ok, label); checks.push(label); console.log('PASS ' + label); };
const ev = (fn, arg) => page.evaluate(fn, arg);
try {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.cases.length >= 3, null, { polling: 100 });
  await ev(() => {
    const AM = DM.AfterMidnight;
    DM.Save.settings.focusPause = false; DM.Save.settings.textSpeed = 'instant'; DM.Engine.governor.enabled = false;
    window.T = {
      play: () => DM.dev.play(),
      step(seconds = 0.1) {
        const E = DM.Engine, render = E.render; E.render = () => {};
        try { for (let i = 0; i < Math.ceil(seconds * 60); i++) {
          E.frame(E.last + 1000 / 60); if (E.error) throw E.error;
        } } finally { E.render = render; }
        E.render(); if (E.error) throw E.error;
      },
      start(id, stage = 0, hero = 'niteowl', carry = null) {
        AM.run = AM.config({ hero, theme: AM.byId[id].theme }, AM.byId[id]);
        DM.Input.clearAll(); DM.Engine.fade.dir = 0; DM.Engine.fade.a = 0;
        DM.Engine.set(new DM.Scenes.Play(), { chapter: 'am_' + id, stage, carry });
        this.step(0.1); this.dialog();
      },
      dialog() { for (let i = 0; i < 25 && this.play()?.dialog.active; i++) this.play().dialog.advance(); this.step(0.1); },
      key(code) { DM.Input.simulate(code, true); this.step(0.05); DM.Input.simulate(code, false); this.step(0.1); },
      place(x, y) { this.play().ctx.place(x, y); this.step(0.05); },
      use(e) { this.place(e.x, e.y + 45); this.key('KeyE'); },
      clear() { const p = this.play(); for (const e of p.world.entities)
        if (e.team === 'enemy' && !e.isProjectile && !e.dead && !e.ko) e.damage(9999, p.player, 'impact'); this.step(0.1); },
      transition() { this.dialog(); this.step(0.2); this.dialog(); this.step(0.2); },
    };
    window.__mainBefore = localStorage.getItem('dr-manhattan.save');
    window.__bonusBefore = localStorage.getItem('dr-manhattan.bonus.v1');
  });
  check('original six campaign chapters and three bonus cards remain separate', await ev(() =>
    DM.Chapters.list.length === 6 && DM.Bonus.list.length === 3));
  for (const hero of ['niteowl', 'silkspectre', 'rorschach']) {
    for (const id of ['dead_air', 'undertow', 'glass_archive']) {
      await ev(([id, hero]) => T.start(id, 0, hero), [id, hero]);
      check(`${id}/${hero}: vulnerable hero has six gear actions`, await ev(() => {
        const p = T.play().player; return p.form === 'vigilante' && !p.godMode && Object.keys(p.powers).length === 6;
      }));
      check(`${id}/${hero}: every combat/rescue seed is free and connected`, await ev(() => {
        const w = T.play().world;
        return [...w.amSpawnPoints, ...w.amRescueSpawns, w.amSafePoint].every(p =>
          w.isFree(p.x, p.y, 18) && DM.AfterMidnight.findCasePath(w, w.spawn, p).length > 0);
      }));
      await ev(() => T.clear());
      if (id === 'dead_air') {
        check(`${id}/${hero}: aerials cannot bypass the physical evidence`, await ev(() => {
          T.use(T.play().ctx.flags.lockTerminal); return !T.play().ctx.flags.signalLocked;
        }));
        await ev(() => { for (const clue of T.play().ctx.flags.roofClues) { T.use(clue); T.transition(); } });
        check(`${id}/${hero}: all three E investigations reach the tuning checkpoint`, await ev(() =>
          T.play().ctx.flags.clues === 7 && T.play().ctx.stageIndex === 1));
        await ev(() => {
          for (const dial of T.play().ctx.flags.aerials) for (let i = 0; i < 3 && !dial.aligned; i++) T.use(dial);
          T.use(T.play().ctx.flags.lockTerminal); T.transition();
        });
        check(`${id}/${hero}: actual dial sequence 3-1-2 locks and reaches ambush checkpoint`, await ev(() =>
          T.play().ctx.flags.signalLocked && T.play().ctx.stageIndex === 2 && T.play().ctx.flags.ambush.length === 3));
        const carry = await ev(() => T.play().ctx.checkpointCarry);
        await ev(([carry, hero]) => T.start('dead_air', 2, hero, carry), [carry, hero]);
        check(`${id}/${hero}: checkpoint restores collected evidence and tuning`, await ev(() =>
          T.play().ctx.flags.clues === 7 && T.play().ctx.flags.signalLocked && T.play().ctx.flags.aerials.every(d => d.aligned)));
        await ev(() => { T.clear(); T.use(T.play().ctx.flags.uplink); T.transition(); T.step(0.8); });
      } else if (id === 'undertow') {
        check(`${id}/${hero}: unpowered winch cannot skip the cable objective`, await ev(() => {
          T.use(T.play().ctx.flags.winch); return !T.play().ctx.flags.winchOpen;
        }));
        await ev(() => { for (const e of T.play().ctx.flags.generators) T.use(e); T.transition(); T.clear(); });
        check(`${id}/${hero}: both cable feeds reach rescue checkpoint`, await ev(() =>
          T.play().ctx.flags.power === 3 && T.play().ctx.stageIndex === 1));
        check(`${id}/${hero}: isolated feeds physically disable both wet-dock hazards`, await ev(() =>
          T.play().ctx.flags.cables.length === 2 && T.play().ctx.flags.cables.every(cable => cable.off)));
        await ev(() => { T.use(T.play().ctx.flags.winch); for (const e of T.play().ctx.flags.workers) T.use(e); });
        check(`${id}/${hero}: lowered gangway and E invite four physical followers`, await ev(() =>
          T.play().ctx.flags.winchOpen && T.play().ctx.flags.workers.every(e => e.following || e.safe)));
        await ev(() => { T.place(270, 1060); T.step(35); T.transition(); });
        check(`${id}/${hero}: four workers physically reach the lifeboat before departure checkpoint`, await ev(() =>
          T.play().ctx.flags.rescuedMask === 15 && T.play().ctx.flags.rescued === 4 && T.play().ctx.stageIndex === 2));
        const carry = await ev(() => T.play().ctx.checkpointCarry);
        await ev(([carry, hero]) => T.start('undertow', 2, hero, carry), [carry, hero]);
        check(`${id}/${hero}: retry keeps every rescued worker safe`, await ev(() =>
          T.play().ctx.flags.workers.every(e => e.safe) && T.play().ctx.flags.rescuedMask === 15));
        await ev(() => { T.clear(); T.use(T.play().ctx.flags.launch); T.transition(); T.step(0.8); });
      } else {
        check(`${id}/${hero}: sealed display cannot bypass security`, await ev(() => {
          T.use(T.play().ctx.flags.archive); return !T.play().ctx.flags.ledger;
        }));
        await ev(() => { for (const panel of T.play().ctx.flags.panels) T.use(panel); T.transition(); });
        check(`${id}/${hero}: isolated circuits stop every laser and open archive checkpoint`, await ev(() =>
          T.play().ctx.flags.circuits === 7 && T.play().ctx.flags.lasers.every(l => l.off) && T.play().ctx.stageIndex === 1));
        await ev(() => { T.use(T.play().ctx.flags.archive); T.transition(); });
        check(`${id}/${hero}: taking the original ledger starts the final boss checkpoint`, await ev(() =>
          T.play().ctx.flags.ledger && T.play().ctx.stageIndex === 2 && T.play().world.boss instanceof DM.AfterMidnight.Surveyor));
        const carry = await ev(() => T.play().ctx.checkpointCarry);
        await ev(([carry, hero]) => T.start('glass_archive', 2, hero, carry), [carry, hero]);
        check(`${id}/${hero}: boss retry retains security and original ledger`, await ev(() =>
          T.play().ctx.flags.circuits === 7 && T.play().ctx.flags.ledger));
        check(`${id}/${hero}: boss has three live phases and ends nonlethally`, await ev(() => {
          const p = T.play(), b = p.world.boss;
          const first = b.phase === 1; b.damage(210, p.player, 'impact'); T.step(0.15);
          const second = b.phase === 2 && !b.dead && !b.ko;
          b.damage(190, p.player, 'impact'); T.step(0.15); const third = b.phase === 3 && !b.dead && !b.ko;
          b.damage(999, p.player, 'impact'); T.step(0.15);
          return first && second && third && b.ko && !b.dead && p.ctx.flags.surveyorCaptured && p.world.boss === null;
        }));
        await page.screenshot({ path: path.join(out, `surveyor-${hero}.png`) });
        await ev(() => { T.use(T.play().ctx.flags.exit); T.transition(); T.step(0.8); });
      }
      check(`${id}/${hero}: case closes in the expansion results screen`, await ev(() =>
        DM.Engine.top().constructor.name === 'Results' && DM.Engine.top().record.completed));
    }
  }
  check('all case progress leaves campaign and bonus save bytes unchanged', await ev(() =>
    __mainBefore === localStorage.getItem('dr-manhattan.save') && __bonusBefore === localStorage.getItem('dr-manhattan.bonus.v1')));
  check('all cases finish without page or engine errors', errors.length === 0 && await ev(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, engine, checks, errors,
    method: 'Controlled setup/placement and stepped real engine; physical escort simulation; no assertion bypass.' }, null, 2));
  console.log(`AFTER MIDNIGHT CASES PASSED: ${checks.length} checks (${engine}, ${target}).`);
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') });
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
