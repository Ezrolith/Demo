/* Controlled live-engine replay-mode acceptance. Ordinary E/keyboard input;
 * actor placement, enemy neutralisation and a stepped clock isolate mechanics.
 * This is not an unassisted or balance-certified human playthrough.
 * node tests/after-midnight-modes.mjs [index.html|dist/dr-manhattan.html]
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
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const out = path.join(root, 'tests/out/after-midnight-modes', engine, target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = [];
page.on('pageerror', e => errors.push(String(e)));
const check = (name, pass) => { assert.ok(pass, name); checks.push(name); console.log('PASS ' + name); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = sec => ev(sec => T.step(sec), sec);
const key = async code => {
  await page.keyboard.down(code); await step(0.05);
  await page.keyboard.up(code); await step(0.08);
};
const start = async (id, hero = 'niteowl', theme = 'rooftops') => {
  await ev(({ id, hero, theme }) => {
    DM.Input.clearAll(); DM.Engine.fade.a = 0; DM.Engine.fade.dir = 0;
    DM.AfterMidnight.start(id, { hero, theme, instant: true }); T.step(0.1); T.dialog(); T.step(0.2);
  }, { id, hero, theme });
};
const terminal = async text => {
  await ev(text => {
    const e = T.play().world.entities.find(e => e.interact?.label.includes(text));
    if (!e) throw new Error('Missing terminal: ' + text);
    T.play().ctx.place(e.x, e.y - 38); T.step(0.1);
  }, text);
  await key('e');
};
try {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.RescueDirector, null, { polling: 100, timeout: 12000 });
  await ev(() => {
    DM.Save.settings.focusPause = false; DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.challenge = 'normal'; DM.Save.settings.invulnerable = false;
    DM.Engine.governor.enabled = false;
    window.__oldSave = localStorage.getItem('dr-manhattan.save');
    window.__oldBonus = localStorage.getItem('dr-manhattan.bonus.v1');
    window.T = {
      play: () => DM.dev.play(),
      step(seconds = 0.1) {
        const E = DM.Engine, render = E.render; E.render = () => {};
        try {
          for (let i = 0; i < Math.ceil(seconds * 60); i++) {
            E.frame(E.last + 1000 / 60);
            if (E.error) throw E.error;
          }
        } finally { E.render = render; }
        E.render(); if (E.error) throw E.error;
      },
      dialog() {
        for (let i = 0; i < 30 && this.play()?.dialog.active; i++) this.play().dialog.advance();
        this.step(0.1);
      },
      clear() {
        const play = this.play();
        for (const e of play.world.entities) if (e.amChallengeEnemy && !e.dead && !e.ko) e.damage(999, play.player, 'impact');
        this.step(0.2);
      },
      secondsSafely(seconds) {
        for (let i = 0; i < Math.ceil(seconds); i++) {
          this.step(1); this.clear();
        }
      },
    };
  });
  check('original campaign and three existing bonus adventures keep their registries', await ev(() =>
    DM.Chapters.list.length === 6 && DM.Bonus.list.length === 3));
  check('Patrol and Rescue Clock have independent registered live-run chapters', await ev(() =>
    ['patrol', 'rescue_clock'].every(id => DM.AfterMidnight.byId[id]?.stages.length &&
      DM.AfterMidnight.byId[id].afterMidnight && DM.AfterMidnight.byId[id].progress === DM.AfterMidnight.progress)));

  for (const hero of ['niteowl', 'silkspectre', 'rorschach']) {
    for (const theme of ['rooftops', 'harbour', 'museum']) {
      await start('patrol', hero, theme); await step(3);
      check(hero + ' can enter a live normal-damage Patrol in ' + theme, await ev(({ hero, theme }) => {
        const p = T.play(), d = p.ctx.flags.director;
        return p.player.profile.id === hero && p.player.form === 'vigilante' && !p.player.godMode &&
          DM.AfterMidnight.run.theme === theme && p.ctx.flags.wave === 1 && d.enemies.length === 2 &&
          d.enemies.every(e => p.world.isFree(e.x, e.y, e.r)) && !DM.AfterMidnight.extract(p);
      }, { hero, theme }));
    }
  }

  await start('patrol'); await step(3); await ev(() => T.clear());
  check('neutralising the whole wave opens rest/extraction and scores actual enemies', await ev(() => {
    const f = T.play().ctx.flags;
    return f.director.phase === 'rest' && f.score >= 350 && T.play().ctx.stats.spared === 2;
  }));
  await terminal('START THE NEXT WAVE');
  check('next wave cannot bypass the between-wave gear choice', await ev(() =>
    T.play().ctx.flags.wave === 1 && T.play().ctx.flags.director.phase === 'rest'));
  await ev(() => { T.play().player.coherence = 30; T.play().player.energy = 30; });
  await terminal('FIELD KIT');
  check('E field kit provides its bounded, once-per-cleared-wave health and stamina', await ev(() => {
    const p = T.play(), e = p.world.entities.find(e => e.interact?.label.includes('FIELD KIT'));
    return p.player.coherence >= 55 && p.player.coherence < 58 && p.player.energy >= 55 && p.ctx.flags.director.fieldKitUsed && !e.interact.enabled();
  }));
  await terminal('ARMOUR');
  check('E gear choice immediately applies one upgrade and records the live run config', await ev(() => {
    const p = T.play();
    return p.player.upgrades.vitality === 1 && p.player.maxCoherence === p.player.profile.health + 15 &&
      DM.AfterMidnight.run.upgrades.vitality === 1 && p.ctx.flags.director.upgradePicked;
  }));
  check('one choice disables every other upgrade until the next cleared wave', await ev(() =>
    T.play().world.entities.filter(e => e.interact && /ARMOUR|CAPACITOR|MOBILITY/.test(e.interact.label))
      .every(e => !e.interact.enabled())));
  await page.screenshot({ path: path.join(out, 'patrol-gear.png') });
  await terminal('START THE NEXT WAVE'); await step(4);
  check('the next wave escalates to three actual enemies and closes extraction', await ev(() => {
    const p = T.play(), d = p.ctx.flags.director;
    return p.ctx.flags.wave === 2 && d.enemies.length === 3 && d.phase === 'combat' && !DM.AfterMidnight.extract(p);
  }));
  await ev(() => T.clear()); await terminal('EXTRACT');
  await ev(() => { T.dialog(); T.step(0.9); });
  check('real extraction finishes the Patrol with a persistent score', await ev(() => {
    const AM = DM.AfterMidnight, scene = DM.Engine.top();
    const record = AM.data.records[AM.slot('patrol', AM.run)];
    return scene instanceof AM.Results && record.score > 600 && record.flags.wave === 2 &&
      record.flags.modeResult === 'extracted' && record.completed;
  }));
  await page.screenshot({ path: path.join(out, 'patrol-result.png') });

  // Validate physical paths in every decorated arena, including thin low walls.
  for (const theme of ['rooftops', 'harbour', 'museum']) {
    await start('rescue_clock', 'silkspectre', theme);
    check(theme + ': all four civilian routes fit through actual cover geometry', await ev(() => {
      const p = T.play(), AM = DM.AfterMidnight, w = p.world, d = p.ctx.flags.director;
      return d.civilians.every(e => {
        const route = AM.escortRoute(w, e, d.safe);
        if (!route.length) return false;
        const points = [{ x: e.x, y: e.y }, ...route];
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 12));
          for (let j = 0; j <= n; j++) if (!w.isFree(a.x + (b.x - a.x) * j / n, a.y + (b.y - a.y) * j / n, 16)) return false;
        }
        return true;
      });
    }));
  }
  check('a real body beside low cover can step away and join the wider escort path', await ev(() => {
    const w = T.play().world, from = { x: 1055, y: 1060, r: 13 };
    return w.isFree(from.x, from.y, 13) && !w.isFree(from.x, from.y, 16) &&
      DM.AfterMidnight.escortRoute(w, from, w.amSafePoint).length > 0;
  }));
  await start('rescue_clock', 'rorschach', 'harbour'); await step(5); await ev(() => T.clear());
  await ev(() => {
    const e = T.play().ctx.flags.director.civilians[0];
    window.__escortStart = { x: e.x, y: e.y };
    T.play().ctx.place(e.x, e.y + 38); T.step(0.1);
  });
  await key('e');
  check('E starts a real escort but does not award an instant rescue', await ev(() =>
    T.play().ctx.flags.director.civilians[0].following && T.play().ctx.flags.rescued === 0));
  await step(0.7);
  check('the civilian physically follows its route through the World', await ev(() => {
    const e = T.play().ctx.flags.director.civilians[0];
    return Math.hypot(e.x - __escortStart.x, e.y - __escortStart.y) > 15 && !e.safe;
  }));
  for (let index = 1; index < 4; index++) {
    await ev(index => {
      const e = T.play().ctx.flags.director.civilians[index]; T.play().ctx.place(e.x, e.y + 38); T.step(0.1);
    }, index); await key('e');
  }
  await ev(() => {
    for (let i = 0; i < 100 && T.play().ctx.flags.rescued < 4; i++) { T.step(1); T.clear(); }
    T.dialog(); T.step(1);
  });
  check('all four physical escorts finish Rescue Clock and award time/score', await ev(() => {
    const AM = DM.AfterMidnight, p = T.play(), record = AM.data.records[AM.slot('rescue_clock', AM.run)];
    return DM.Engine.top() instanceof AM.Results && p.ctx.flags.rescued === 4 && p.ctx.flags.lost === 0 &&
      record.flags.modeResult === 'rescued' && record.completed && record.score >= 2000 &&
      p.ctx.flags.clockLeft > 150 && p.ctx.flags.director.civilians.every(e => e.safe);
  }));
  await page.screenshot({ path: path.join(out, 'rescue-result.png') });

  await start('rescue_clock', 'niteowl', 'museum'); await step(5); await ev(() => T.clear());
  await ev(() => {
    const p = T.play(), e = p.ctx.flags.director.civilians[0];
    p.ctx.place(e.x, e.y + 38);
    window.__fearGuard = p.world.add(new DM.Enemies.Gangster({ x: e.x + 65, y: e.y, alerted: true }));
    __fearGuard.amChallengeEnemy = true; __fearGuard.amValue = 100; __fearGuard.fireCd = 9;
    T.step(0.1);
  });
  await key('e');
  const fear = await ev(() => {
    const p = T.play(), e = p.ctx.flags.director.civilians[0], x = e.x, y = e.y;
    T.step(0.8); const stopped = Math.hypot(e.x - x, e.y - y) < 4;
    __fearGuard.damage(999, p.player, 'impact'); T.step(1);
    return { stopped, moved: Math.hypot(e.x - x, e.y - y) > 10 };
  });
  check('nearby gunmen halt an escort; clearing the threat restores movement', fear.stopped && fear.moved);
  check('nonlethal friendly gear cannot silently kill a rescued civilian', await ev(() => {
    const e = T.play().ctx.flags.director.civilians[1], hp = e.hp;
    e.damage(100, { team: 'player' }, 'bolt'); return !e.dead && e.hp === hp;
  }));

  await start('rescue_clock', 'silkspectre', 'rooftops');
  await ev(() => { T.secondsSafely(182); T.dialog(); T.step(1); });
  check('a real elapsed deadline ends the run without pretending to rescue or win', await ev(() => {
    const AM = DM.AfterMidnight, record = AM.data.records[AM.slot('rescue_clock', AM.run)];
    return DM.Engine.top() instanceof AM.Results && record.flags.clockLeft === 0 && record.flags.rescued === 0 &&
      record.flags.modeResult === 'timeout' && !record.completed;
  }));

  // The same hero/location already completed a real four-person escort above.
  // A subsequent deadline must remain a failed current run, with history kept.
  await start('rescue_clock', 'rorschach', 'harbour');
  await ev(() => { T.secondsSafely(182); T.dialog(); T.step(1); });
  check('timeout after an earlier victory stays a timeout while preserving personal bests', await ev(() => {
    const AM = DM.AfterMidnight, record = AM.data.records[AM.slot('rescue_clock', AM.run)];
    return record.flags.modeResult === 'timeout' && !record.completed && record.everCompleted &&
      record.bestScore >= 2000 && record.bestRescued === 4 && record.bestTime > 0;
  }));

  await start('patrol'); await step(3); await ev(() => T.clear()); await terminal('ARMOUR');
  await ev(() => {
    const p = T.play(); p.player.invuln = 0; p.player.locked = false; p.player.damage(999, null, 'test'); T.step(3);
  });
  check('normal damage ends a human Patrol and records its score/death separately', await ev(() => {
    const AM = DM.AfterMidnight, r = AM.data.records[AM.slot('patrol', AM.run)];
    return DM.Engine.top() instanceof DM.Scenes.GameOver && AM.data.deaths > 0 && r.score > 0 &&
      r.flags.modeResult === 'defeated';
  }));
  await key('Enter'); await step(1.5); await ev(() => { T.dialog(); T.step(0.3); });
  check('retry begins a fresh wave-one run without carrying earned gear', await ev(() => {
    const p = T.play();
    return p.ctx.flags.wave === 1 && p.ctx.flags.score === 0 && p.player.maxCoherence === p.player.profile.health &&
      Object.values(p.player.upgrades).every(n => n === 0) && !p.player.godMode;
  }));
  check('all new-mode outcomes leave old campaign and bonus save bytes untouched', await ev(() =>
    localStorage.getItem('dr-manhattan.save') === __oldSave && localStorage.getItem('dr-manhattan.bonus.v1') === __oldBonus));
  check('no browser or engine errors across all modes and themes', errors.length === 0 && await ev(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, checks, errors,
    method: 'Normal file loading; real E/keyboard with explicit placement/enemy-neutralisation setup and stepped simulation.' }, null, 2));
  console.log(`AFTER MIDNIGHT MODES PASSED: ${checks.length} checks (${target}).`);
} catch (e) {
  await page.screenshot({ path: path.join(out, 'failure.png') });
  console.error(await ev(() => DM.dev.state()).catch(() => null));
  console.error(e); process.exitCode = 1;
} finally { await browser.close(); }
