/* Tested source+standalone: Q aimed at a wheel must not unmake the turning truck cab.
 * Normal mode uses file navigation and browser storage. --offline is an explicitly
 * limited local harness. Setup positions actors and sometimes protects Jon; inputs
 * perform objectives. These checks are not an unassisted human playthrough. */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  pw = require('/opt/pyvenv/lib/python3.13/site-packages/playwright/driver/package');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(a => a.endsWith('.html')) || 'index.html';
const offline = process.argv.includes('--offline');
const out = path.join(root, 'tests/out/long-summer');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const checks = [];
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const check = (name, ok) => {
  assert.ok(ok, name);
  checks.push(name);
  console.log('✓ ' + name);
};
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
try {
  const init = () => {
    window.requestAnimationFrame = () => 0;
    window.__campaign = JSON.stringify({ version: 2, reached: 6, completed: { karnak: { spared: 7, time: 100 } },
      settings: {}, checkpoint: null });
  };
  if (offline) {
    await page.evaluate(init);
    await page.evaluate(() => {
      window.__store = { 'dr-manhattan.save': window.__campaign };
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: k => window.__store[k] || null,
        setItem: (k, v) => window.__store[k] = String(v),
        removeItem: k => delete window.__store[k],
      } });
    });
    let html = readFileSync(path.join(root, target), 'utf8');
    html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
      '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
    await page.setContent(html.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
  } else {
    await page.addInitScript(init);
    await page.addInitScript(() => localStorage.setItem('dr-manhattan.save', window.__campaign));
    await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => window.DM && DM.dev, null, { polling: 100, timeout: 12000 });
  await page.evaluate(() => {
    DM.Engine.governor.enabled = false;
    DM.Save.settings.focusPause = false;
    DM.Save.settings.textSpeed = 'instant';
    window.__before = localStorage.getItem('dr-manhattan.save');
    DM.Bonus.load();
    for (const id of ['last_broadcast', 'ninth_minute']) {
      DM.Bonus.data.completed[id] = { stats: { spared: 12 }, flags: { choice: 'preserve' } };
      DM.Bonus.checkpointAt(id, 1, { stats: { spared: 3 }, flags: { evidence: 1, moments: 1 } });
    }
    window.__old = JSON.stringify(DM.Bonus.data);
    window.T = {
      p: () => DM.dev.play(), aimPoint: null,
      step(seconds = 0.1) {
        const E = DM.Engine;
        const render = E.render;
        E.render = () => {};
        try {
          for (let i = 0; i < Math.ceil(seconds * 60); i++) {
            if (this.aimPoint && this.p()) {
              const q = this.p().world.camera.toScreen(this.aimPoint.x, this.aimPoint.y);
              DM.Input.mouse.x = q.x;
              DM.Input.mouse.y = q.y;
            }
            E.frame(E.last + 1000 / 60);
            if (E.error) throw E.error;
            if (this.observe) this.observe();
          }
        } finally {
          E.render = render;
        }
        if (!this.fast) E.render();
        if (E.error) throw E.error;
      },
      key(code, seconds = 0.05) {
        DM.Input.simulate(code, true);
        this.step(seconds);
        DM.Input.simulate(code, false);
        this.step(0.07);
      },
      dialog() {
        for (let k = 0; k < 50 && this.p()?.dialog.active; k++) this.p().dialog.advance();
        this.step(0.1);
      },
      start(stage = 0, carry = null, vulnerable = false) {
        DM.Input.clearAll();
        this.aimPoint = null;
        DM.Engine.fade.dir = 0;
        DM.Engine.fade.a = 0;
        DM.Engine.set(new DM.Scenes.Play(), { chapter: 'long_summer', stage, carry });
        this.step(0.1);
        this.dialog();
        this.p().player.godMode = !vulnerable;
      },
      place(x, y) {
        this.p().ctx.place(x, y);
        this.step(0.02);
      },
      aim(x, y) {
        this.aimPoint = { x, y };
        this.step(0.02);
      },
      interact(e) {
        const w = this.p().world;
        const y = w.isFree(e.x, e.y + 45, 14) ? e.y + 45 : e.y - 45;
        this.place(e.x, y);
        this.key('KeyE');
      },
      grab(e) {
        this.p().player.energy = 100;
        this.place(e.x - 95, e.y + 40);
        this.aim(e.x, e.y);
        DM.Input.simulate('KeyC', true);
        this.step(0.18);
      },
      release() {
        DM.Input.simulate('KeyC', false);
        this.step(0.1);
      },
      restrain() {
        this.grab(this.p().ctx.flags.comedian);
        this.release();
      },
      shoot(e) {
        this.p().player.energy = 100;
        this.place(e.x - 140, e.y + 35);
        this.aim(e.x, e.y);
        this.key('KeyQ');
        this.step(0.6);
      },
      transition() {
        this.dialog();
        this.step(1.6);
        this.dialog();
        if (this.p()) this.p().player.godMode = true;
      },
      finite() {
        return this.p().world.entities.every(e => Number.isFinite(e.x) && Number.isFinite(e.y));
      },
    };
  });
  check('original campaign registry and final chapter remain unchanged', await page.evaluate(() =>
    DM.Chapters.list.length === 6 && DM.Chapters.next('karnak') === null));
  check('three independent bonus IDs are registered in order', await page.evaluate(() =>
    DM.Bonus.list.map(c => c.id).join(',') === 'last_broadcast,ninth_minute,long_summer'));
  await page.evaluate(() => {
    DM.Bonus.selectedId = null;
    DM.Engine.set(new DM.Scenes.BonusMenu());
    T.step(0.2);
  });
  check('all three menu cards fit within the canvas and do not overlap', await page.evaluate(() => {
    const menu = DM.Engine.top();
    return [0, 1, 2].every(i => {
      const r = menu.cardRect(i);
      return r.x >= 0 && r.x + r.w < DM.W && (i === 2 || r.x + r.w < menu.cardRect(i + 1).x);
    });
  }));
  check('third adventure is immediately playable without changing the campaign', await page.evaluate(() =>
    DM.Engine.top().chapter.id === 'long_summer' && DM.Engine.top().menu.items[0].label === 'PLAY THE LONG SUMMER'));
  await shot('01-menu');
  await page.evaluate(() => { T.key('Enter'); T.step(1.1); });
  check('real menu opens The Long Summer introduction', await page.evaluate(() =>
    DM.Engine.top() instanceof DM.Scenes.Interlude && DM.Engine.top().ch.id === 'long_summer'));
  await page.evaluate(() => { T.key('Space'); T.step(0.2); T.key('Space'); T.step(1.6); T.dialog(); });
  check('introduction leads to the playable avenue', await page.evaluate(() => DM.dev.state().stageId === 'avenue'));
  await page.evaluate(() => T.start());
  check('all six powers are available and all entities have finite positions', await page.evaluate(() =>
    Object.keys(T.p().player.powers).length === 6 && T.finite()));
  check('city Heat starts in bounds with a dedicated visible meter', await page.evaluate(() =>
    T.p().ctx.flags.heat === 46 && T.p().ctx.flags.summer.hazard));
  check('movement uses the existing keyboard input', await page.evaluate(() => {
    const x = T.p().player.x;
    T.key('KeyD', 0.5);
    return T.p().player.x > x + 30;
  }));
  await page.evaluate(() => T.grab(T.p().ctx.flags.comedian));
  check('the Comedian can actually be lifted with C', await page.evaluate(() =>
    T.p().ctx.flags.comedian.heldBy === T.p().player));
  await page.evaluate(() => T.release());
  check('release disarms him for ten seconds and lowers Heat', await page.evaluate(() =>
    T.p().ctx.flags.comedian.disarmed > 9.8 && T.p().ctx.flags.heat < 46 && T.p().ctx.flags.restraints === 1));
  check('repeated grabs during disarm cannot farm Heat reduction', await page.evaluate(() => {
    const n = T.p().ctx.flags.restraints;
    T.restrain();
    return T.p().ctx.flags.restraints === n;
  }));
  check('disarm expires rather than permanently removing his danger', await page.evaluate(() => {
    T.step(10.2);
    return T.p().ctx.flags.comedian.disarmed === 0;
  }));
  await page.evaluate(() => T.start());
  check('Heat rises after a real Q unmaking', await page.evaluate(() => {
    T.restrain();
    const p = T.p();
    const before = p.ctx.flags.heat;
    const e = p.ctx.flags.rioters[0];
    T.shoot(e);
    return e.dead && p.ctx.stats.disintegrated === 1 && p.ctx.flags.heat > before;
  }));
  await page.evaluate(() => T.start());
  check('R creates nonlethal duplicates which can spare a rioter', await page.evaluate(() => {
    T.restrain();
    const p = T.p();
    const e = p.ctx.flags.rioters[0];
    T.place(e.x - 105, e.y + 50);
    T.key('KeyR');
    T.step(4);
    return e.ko && p.ctx.stats.spared > 0 && p.ctx.stats.disintegrated === 0;
  }));
  await page.evaluate(() => T.start());
  check('the Comedian can kill an already knocked-out rioter without double-counting', await page.evaluate(() => {
    const p = T.p();
    const f = p.ctx.flags;
    const e = f.rioters[0];
    f.rioters.slice(1).forEach(r => { r.x = 1900; r.y = 450; });
    e.x = f.comedian.x + 170;
    e.y = f.comedian.y;
    e.damage(100, p.player, 'impact');
    const spared = p.ctx.stats.spared;
    T.step(34);
    return e.casualty && f.comedianCasualties === 1 && p.ctx.stats.spared === spared - 1 && p.ctx.stats.disintegrated === 0;
  }));
  await page.evaluate(() => T.start());
  check('high Heat brings a bounded reinforcement wave', await page.evaluate(() => {
    const p = T.p();
    p.ctx.flags.heat = 82;
    p.ctx.flags.comedian.disarmed = 30;
    T.place(500, 1150);
    T.step(14.2);
    return p.ctx.flags.summer.waves === 1;
  }));
  check('low Heat allows an unengaged rioter to leave and count once as spared', await page.evaluate(() => {
    const p = T.p();
    p.ctx.flags.heat = 20;
    T.place(1000, 400);
    const e = p.world.add(new DM.Summer.Rioter(p.ctx.flags.summer, 85, 1030));
    const count = p.ctx.stats.spared;
    T.step(0.2);
    return e.dead && e.summerCounted === 'spared' && p.ctx.stats.spared === count + 1;
  }));
  await page.evaluate(() => T.start());
  check('C rips a hydrant and water extinguishes nearby fires', await page.evaluate(() => {
    const f = T.p().ctx.flags;
    T.restrain();
    const grid = f.summer.grid;
    const before = grid.active.size;
    T.grab(f.hydrants[0]);
    T.step(0.2);
    T.release();
    return f.hydrants[0].ripped && f.summer.water.length === 1 && grid.active.size < before;
  }));
  check('a caught Molotov can be guided into the hydrant water and snuffed', await page.evaluate(() => {
    const p = T.p();
    const puddle = p.ctx.flags.summer.water[0];
    const m = p.world.add(new DM.Summer.Molotov(p.ctx.flags.summer, puddle.x - 160, puddle.y + 30, puddle));
    T.grab(m);
    const held = m.heldBy === p.player;
    T.aim(puddle.x, puddle.y);
    T.step(1.4);
    T.release();
    return held && m.dead && m.snuffed;
  }));
  await page.evaluate(() => { T.start(); T.restrain(); T.interact(T.p().ctx.flags.grapple); T.step(1.6); });
  check('E gives Nite Owl a real grapple route-opening job', await page.evaluate(() => T.p().ctx.flags.grappleOpen));
  check('the avenue exit rejects high Heat even after the grapple is open', await page.evaluate(() => {
    T.p().ctx.flags.heat = 75;
    T.interact(T.p().ctx.flags.exit);
    return !T.p().ctx.flags.avenueExit;
  }));
  // Restraint, water and the actual exit inputs now drive the entire avenue objective.
  await page.evaluate(() => {
    T.start();
    T.restrain();
    for (const hydrant of T.p().ctx.flags.hydrants) {
      T.grab(hydrant);
      T.release();
    }
    T.interact(T.p().ctx.flags.grapple);
    T.step(1.6);
  });
  check('hydrants alone cannot bypass the still-active riot', await page.evaluate(() => {
    const p = T.p();
    if (!(p.ctx.flags.heat < 40 && p.ctx.flags.grappleOpen)) return false;
    // Keep the initial crowd active: opening water cannot count as calming people.
    const unresolved = p.ctx.flags.rioters.filter(e => !e.ko && !e.dead).length;
    if (unresolved < 5) return false;
    T.interact(p.ctx.flags.exit);
    return !p.ctx.flags.avenueExit;
  }));
  await page.evaluate(() => {
    const p = T.p();
    T.place(820, 535);
    T.key('KeyR');
    T.step(5.5);
  });
  check('settling two rioters nonlethally unlocks the avenue without editing Heat', await page.evaluate(() => {
    const p = T.p();
    const n = p.ctx.flags.crowdSettled();
    return n >= 2 && p.ctx.stats.disintegrated === 0 && p.ctx.flags.heat < 40;
  }));
  await page.evaluate(() => { T.interact(T.p().ctx.flags.exit); T.transition(); });
  check('E advances from the avenue into the checkpointed tenement', await page.evaluate(() =>
    DM.dev.state().stageId === 'tenement' && T.p().ctx.checkpoint === 1));
  check('the rescue is five storeys with six residents and only one enemy', await page.evaluate(() => {
    const p = T.p();
    return p.ctx.flags.residents.length === 6 && p.world.entities.filter(e => e instanceof DM.Summer.Rioter).length === 1;
  }));
  check('E starts an escort but does not immediately count a rescue', await page.evaluate(() => {
    const p = T.p();
    T.interact(p.ctx.flags.residents[0]);
    return p.ctx.flags.residents[0].escort && p.ctx.flags.rescued === 0;
  }));
  check('three-second fire prediction agrees with the deterministic spread rule', await page.evaluate(() => {
    const f = T.p().ctx.flags.summer.grid;
    const predicted = [...f.predict(3)].sort((a, b) => a - b).join(',');
    f.update(3.000001, T.p().world);
    return [...f.active].sort((a, b) => a - b).join(',') === predicted;
  }));
  check('fire and predicted spread remain visible under actual Temporal Sight input', await page.evaluate(() => {
    T.p().player.energy = 100;
    T.key('KeyF', 0.5);
    DM.Input.simulate('KeyF', true);
    T.step(0.25);
    const f = T.p().ctx.flags.summer.grid;
    const ok = T.p().world.timesight && DM.World.keepsColour(f) && f.predicted.size >= f.active.size;
    DM.Input.simulate('KeyF', false);
    T.step(0.1);
    return ok;
  }));
  check('C lifts the burning beam and physically clears the staircase collision', await page.evaluate(() => {
    const beam = T.p().ctx.flags.beam;
    T.grab(beam);
    const ok = beam.heldBy === T.p().player && beam.barrier.noCollide;
    T.release();
    return ok;
  }));
  check('the roof requires expansion rather than an ordinary E press', await page.evaluate(() => {
    T.interact(T.p().ctx.flags.vent);
    return !T.p().ctx.flags.summer.grid.vented;
  }));
  check('G then E opens the roof, stops spread and lowers Heat', await page.evaluate(() => {
    const p = T.p();
    p.player.energy = 100;
    T.key('KeyG');
    T.step(0.5);
    T.interact(p.ctx.flags.vent);
    const f = p.ctx.flags.summer.grid;
    return f.vented && p.ctx.flags.vented && f.predict(3).size === f.active.size;
  }));
  check('a duplicate can start guiding a second resident', await page.evaluate(() => {
    const p = T.p();
    const e = p.ctx.flags.residents[1];
    T.place(e.x - 40, e.y);
    p.player.energy = 100;
    T.key('KeyR');
    T.step(0.4);
    return e.escort && p.world.entities.some(x => x.isDuplicate);
  }));
  check('the next-stage console stays disabled and clear of the rescue exit', await page.evaluate(() => {
    const p = T.p();
    const e = p.ctx.flags.exit;
    const safe = p.ctx.flags.summer.safePoint;
    if (e.interact.enabled() || Math.hypot(e.x - safe.x, e.y - safe.y) < 130) return false;
    T.interact(e);
    return !p.ctx.flags.tenementExit;
  }));
  await page.evaluate(() => {
    const p = T.p();
    // Position actors by the stairs; actual C carries them into safety. A later test walks from their real rooms.
    for (const e of p.ctx.flags.residents) {
      if (e.safe) continue;
      e.x = 805;
      e.y = 1330;
      e.vx = 0;
      e.vy = 0;
      T.grab(e);
      T.aim(p.ctx.flags.summer.safePoint.x, p.ctx.flags.summer.safePoint.y);
      T.step(1.25);
      T.release();
      T.step(1.3);
    }
  });
  check('six residents count only after physically arriving at safety', await page.evaluate(() =>
    T.p().ctx.flags.rescued === 6 && T.p().ctx.flags.residents.every(e => e.safe)));
  check('the onward-route console activates after all six reach the street', await page.evaluate(() =>
    T.p().ctx.flags.exit.interact.enabled()));
  check('waiting at the exit cannot double-count residents', await page.evaluate(() => {
    const n = T.p().ctx.stats.spared;
    T.step(2);
    return T.p().ctx.flags.rescued === 6 && T.p().ctx.stats.spared === n;
  }));
  await page.evaluate(() => { T.interact(T.p().ctx.flags.exit); T.transition(); });
  check('the rescue exit advances through dialogue into the truck encounter', await page.evaluate(() =>
    DM.dev.state().stageId === 'truck' && T.p().ctx.flags.rescued === 6));
  check('truck parts are separate targets, the cab contains a human and it can move', await page.evaluate(() => {
    const t = T.p().ctx.flags.truck;
    const x = t.x;
    T.step(1);
    return t.parts.length === 6 && t.driver.inCab && Math.abs(t.x - x) > 1;
  }));
  check('water warning is harmless and the visible sweep damages Jon', await page.evaluate(() => {
    const p = T.p();
    const t = p.ctx.flags.truck;
    p.player.godMode = false;
    p.player.invuln = 0;
    t.mode = 'waterWarn';
    t.modeT = 1;
    t.lockAngle = Math.PI / 2 + 0.55;
    T.place(t.x, t.y + 250);
    const before = p.player.coherence;
    T.step(0.3);
    const safe = p.player.coherence >= before;
    t.mode = 'water';
    t.modeT = 2;
    t.hitT = 0;
    p.player.invuln = 0;
    const health = p.player.coherence;
    T.step(0.1);
    p.player.godMode = true;
    return safe && p.player.coherence < health;
  }));
  check('tear gas slows Jon only inside the cloud and restores movement afterwards', await page.evaluate(() => {
    const p = T.p();
    p.world.add(new DM.Summer.Gas(p.ctx.flags.summer, p.player.x, p.player.y));
    T.step(0.1);
    const slow = p.player.speedMul < 1;
    T.place(450, 1150);
    T.step(0.1);
    return slow && p.player.speedMul === 1;
  }));
  await page.evaluate(() => {
    const t = T.p().ctx.flags.truck;
    for (const part of t.parts.filter(e => e.role !== 'cab').slice(0, 3)) {
      for (let i = 0; i < 4 && !part.dead; i++) T.shoot(part);
    }
  });
  check('destroying mechanical parts does not count as unmaking a person', await page.evaluate(() =>
    !T.p().ctx.flags.truck.driver.dead && !T.p().ctx.flags.driverOutcome && T.p().ctx.stats.disintegrated === 0));
  check('half-health triggers the telegraphed ram phase', await page.evaluate(() => T.p().ctx.flags.truck.phase === 2));
  check('truck framing includes the machine at all four arena corners', await page.evaluate(() => {
    const p = T.p();
    const t = p.ctx.flags.truck;
    return [[220, 390], [1820, 390], [220, 1200], [1820, 1200]].every(([x, y]) => {
      p.player.x = x;
      p.player.y = y;
      t.cameraFrame.update();
      T.step(0.4);
      return t.cameraFrame.projectionSafe(p.world.camera.zoom, p.world.camera.x, p.world.camera.y);
    });
  }));
  await page.evaluate(() => {
    for (const part of T.p().ctx.flags.truck.parts.filter(e => e.role !== 'cab')) {
      for (let i = 0; i < 4 && !part.dead; i++) T.shoot(part);
    }
    T.restrain();
  });
  check('disabling machinery releases a living driver and restores the camera', await page.evaluate(() => {
    const t = T.p().ctx.flags.truck;
    return t.disabled && !t.driver.dead && !t.driver.inCab && !t.cameraFrame.active && T.p().world.boss === null;
  }));
  await page.evaluate(() => {
    const driver = T.p().ctx.flags.truck.driver;
    T.interact(driver);
    driver.x = 540;
    driver.y = T.p().ctx.flags.summer.safePoint.y + 60;
    T.place(540, T.p().ctx.flags.summer.safePoint.y + 30);
    T.step(1.5);
  });
  check('guiding the driver to safe passage counts him as spared', await page.evaluate(() =>
    T.p().ctx.flags.driverOutcome === 'spared' && T.p().ctx.flags.truck.driver.safe));
  await page.evaluate(() => { T.dialog(); T.step(1); });
  check('the complete route reaches the dedicated ending screen', await page.evaluate(() =>
    DM.Engine.top() instanceof DM.Summer.SummerComplete));
  await shot('ending-route');
  await page.evaluate(() => T.start(2));
  check('a wheel-targeted blast cannot accidentally unmake the turning cab', await page.evaluate(() => {
    T.start(2);
    const p = T.p();
    const t = p.ctx.flags.truck;
    const wheel = t.parts.find(e => e.role === 'wheel');
    const cab = t.parts.find(e => e.role === 'cab');
    // A real cast freezes the player's aim; the mobile cab can enter its radius
    // during the 0.16s wind-up. Test that collision without disabling gameplay.
    p.world.emitCast({ x: wheel.x, y: wheel.y, t: 0.16, r: 50 });
    const original = { x: cab.x, y: cab.y };
    cab.x = wheel.x + 6;
    cab.y = wheel.y + 6;
    cab.disintegrate(p.world, p.player);
    const safe = !cab.dead && !t.driver.dead && !p.ctx.flags.driverOutcome &&
      p.ctx.stats.disintegrated === 0 &&
      p.world.barks.some(b => b.e === cab && b.text === 'Someone is inside.');
    cab.x = original.x;
    cab.y = original.y;
    return safe;
  }));
  check('Q deliberately aimed at cab produces the lethal driver outcome exactly once', await page.evaluate(() => {
    const p = T.p();
    T.shoot(p.ctx.flags.truck.parts.find(e => e.role === 'cab'));
    const n = p.ctx.stats.disintegrated;
    T.step(0.3);
    return p.ctx.flags.driverOutcome === 'unmade' && n === 1 && p.ctx.stats.disintegrated === 1;
  }));
  check('three ending tiers derive from the ledger and Heat, not a final button', await page.evaluate(() =>
    DM.Summer.tone({ spared: 10, disintegrated: 0 }, { heat: 20, rescued: 6, comedianCasualties: 0 }) === 'calm' &&
    DM.Summer.tone({ spared: 8, disintegrated: 2 }, { heat: 45, rescued: 6, comedianCasualties: 0 }) === 'uneasy' &&
    DM.Summer.tone({ spared: 4, disintegrated: 8 }, { heat: 80, rescued: 6, comedianCasualties: 1 }) === 'burning'));
  for (const [tone, stats, flags] of [
    ['calm', { spared: 14, disintegrated: 0 }, { heat: 24, rescued: 6, comedianCasualties: 0 }],
    ['uneasy', { spared: 8, disintegrated: 2 }, { heat: 46, rescued: 6, comedianCasualties: 0 }],
    ['burning', { spared: 4, disintegrated: 9 }, { heat: 82, rescued: 6, comedianCasualties: 2 }],
  ]) {
    await page.evaluate(({ stats, flags }) => {
      DM.Engine.push(new DM.Summer.SummerComplete(T.p(), { stats, flags }));
      T.step(0.2);
    }, { stats, flags });
    await shot('ending-' + tone);
    await page.evaluate(() => DM.Engine.pop());
  }
  check('three checkpoint retries preserve carried Heat and moral totals', await page.evaluate(() => {
    return [0, 1, 2].every(stage => {
      const carry = { stats: { time: 12, spared: 3, disintegrated: 1, memories: 0 },
        flags: { heat: 52, rescued: stage === 2 ? 6 : 0, rescuedMask: stage === 2 ? 63 : 0,
          comedianCasualties: 2, restraints: 1 } };
      T.start(stage, carry);
      const p = T.p();
      const cp = DM.Bonus.data.checkpoints.long_summer;
      p.begin('long_summer', cp.stage, cp.carry, true);
      T.step(0.1);
      return p.ctx.checkpoint === stage && p.ctx.stats.spared === 3 && p.ctx.flags.comedianCasualties === 2 &&
        Math.abs(p.ctx.flags.heat - 52) < 0.1;
    });
  }));
  check('all residents escort from their actual rooms without repositioning', await page.evaluate(() => {
    T.start(1);
    const p = T.p();
    T.grab(p.ctx.flags.beam);
    T.release();
    for (const e of p.ctx.flags.residents) T.interact(e);
    T.place(820, 1450);
    T.step(42);
    return p.ctx.flags.rescued === 6 && p.ctx.flags.residents.every(e => e.safe);
  }));
  check('lifting the cleared beam again cannot farm Heat', await page.evaluate(() => {
    const p = T.p();
    const before = p.ctx.flags.heat;
    const changes = p.ctx.flags.summer.reasons.filter(r => r.reason === 'The stairwell opened').length;
    p.ctx.flags.beam.onGrab();
    return p.ctx.flags.heat === before && p.ctx.flags.summer.reasons.filter(r => r.reason === 'The stairwell opened').length === changes;
  }));
  check('an impact cannot kill the driver through the truck cab', await page.evaluate(() => {
    T.start(2);
    const t = T.p().ctx.flags.truck;
    const cab = t.parts.find(e => e.role === 'cab');
    cab.damage(999, T.p().player, 'impact');
    return !cab.dead && !t.driver.dead && !T.p().ctx.stats.disintegrated;
  }));
  check('the ram has a harmless warning and a damaging physical sweep', await page.evaluate(() => {
    const p = T.p();
    const t = p.ctx.flags.truck;
    p.player.godMode = false;
    p.player.coherence = 100;
    p.player.invuln = 0;
    t.mode = 'ramWarn';
    t.lockAngle = Math.PI / 2;
    t.modeT = 1.5;
    t.hitT = 0;
    T.place(t.x, t.y + 210);
    const before = p.player.coherence;
    T.step(0.8);
    const warningSafe = p.player.coherence === before;
    T.step(1.2);
    const hit = p.player.coherence < before && t.ramCount > 0;
    p.player.godMode = true;
    return warningSafe && hit;
  }));
  check('the original campaign save is byte-for-byte untouched', await page.evaluate(() =>
    localStorage.getItem('dr-manhattan.save') === window.__before));
  check('both older adventures retain their records and checkpoints', await page.evaluate(() => {
    const before = JSON.parse(window.__old);
    return ['last_broadcast', 'ninth_minute'].every(id =>
      JSON.stringify(DM.Bonus.data.completed[id]) === JSON.stringify(before.completed[id]) &&
      JSON.stringify(DM.Bonus.data.checkpoints[id]) === JSON.stringify(before.checkpoints[id]));
  }));
  await page.evaluate(() => T.fast = true);
  // Fairness reproductions use the real simulation, original spawns and normal damage.
  const idleAvenue = await page.evaluate(() => {
    T.start(0, null, true);
    const p = T.p();
    const f = p.ctx.flags;
    let maximumHeat = f.heat;
    let minimumHealth = p.player.coherence;
    for (let i = 0; i < 300; i++) {
      T.step(0.1);
      maximumHeat = Math.max(maximumHeat, f.heat);
      minimumHealth = Math.min(minimumHealth, p.player.coherence);
      if (p.player.godMode || DM.Save.settings.invulnerable) throw new Error('Idle run invulnerable');
    }
    return { maximumHeat, minimumHealth, casualties: f.comedianCasualties, shots: f.comedian.shots,
      elapsed: f.summer.elapsed, alive: !p.player.down };
  });
  console.log('Idle avenue, 30 seconds: ' + JSON.stringify(idleAvenue));
  check('idle opening: 30 playable seconds, no Comedian casualty, Heat <=60, Jon alive without invulnerability',
    idleAvenue.elapsed >= 30 && idleAvenue.casualties === 0 && idleAvenue.maximumHeat <= 60 && idleAvenue.alive);
  check('no live fire during the protected opening', idleAvenue.shots === 0);

  check('a real C lift during the >=2-second warning cancels the shot; distinct cue and bark exist', await page.evaluate(() => {
    T.start();
    const p = T.p();
    const f = p.ctx.flags;
    const e = f.rioters[0];
    f.rioters.slice(1).forEach(r => { r.x = 1900; r.y = 450; });
    e.x = f.comedian.x + 170;
    e.y = f.comedian.y;
    e.damage(100, p.player, 'impact');
    T.step(30);
    const warning = f.comedian.aimT;
    const bark = p.world.barks.some(b => b.text === 'Comedian takes aim');
    T.grab(f.comedian);
    const cancelled = f.comedian.aimT === 0 && f.comedian.heldBy === p.player;
    T.step(2.3);
    T.release();
    return warning >= 2 && bark && cancelled && f.comedian.shots === 0 && f.comedianCasualties === 0 &&
      DM.Audio.has('summer_aim');
  }));
  check('the casualty limiter rejects a second Comedian victim within thirty seconds', await page.evaluate(() => {
    T.start();
    const f = T.p().ctx.flags;
    const first = f.summer.casualty(f.rioters[0]);
    const second = f.summer.casualty(f.rioters[1]);
    return first && !second && !f.rioters[1].dead && f.comedianCasualties === 1;
  }));
  check('passive Heat is bounded at 1.5/s overall and fire at 0.5/s regardless of cell count', await page.evaluate(() => {
    T.start(1);
    const state = T.p().ctx.flags.summer;
    const initialHeat = state.heat;
    state.casualty(T.p().ctx.flags.looter);
    if (state.heat !== initialHeat || T.p().ctx.flags.comedianCasualties !== 1) return false;
    state.shotHeat += 200;
    let previous = state.passiveAdded;
    let previousFire = state.fireHeatAdded;
    let previousHeat = state.heat;
    for (let i = 0; i < 40; i++) {
      T.step(1);
      if (state.passiveAdded - previous > 1.50001 || state.fireHeatAdded - previousFire > 0.50001 ||
        state.heat - previousHeat > 1.50001) return false;
      previous = state.passiveAdded;
      previousFire = state.fireHeatAdded;
      previousHeat = state.heat;
    }
    return true;
  }));
  const idleTenement = await page.evaluate(() => {
    T.start(1, null, true);
    const p = T.p();
    const grid = p.ctx.flags.summer.grid;
    const initial = grid.active.size;
    T.step(14.8);
    const beforeFifteen = grid.active.size;
    T.step(5.2);
    return { initial, beforeFifteen, atTwenty: grid.active.size, time: grid.timer,
      heat: p.ctx.flags.heat, alive: !p.player.down, invulnerable: p.player.godMode };
  });
  console.log('Idle tenement, 20 seconds: ' + JSON.stringify(idleTenement));
  check('tenement: no spread before fifteen seconds, at most six burning cells at twenty',
    idleTenement.beforeFifteen === idleTenement.initial && idleTenement.atTwenty <= 6 && idleTenement.time >= 20 &&
    idleTenement.alive && !idleTenement.invulnerable);
  check('cells mature for six seconds and spread beats are five seconds apart', await page.evaluate(() => {
    const grid = T.p().ctx.flags.summer.grid;
    const key = [...grid.active][0];
    const now = grid.timer;
    const early = grid.advance(new Set([key]), 0, now + 5.9, new Map([[key, now]]));
    const mature = grid.advance(new Set([key]), 0, now + 6.1, new Map([[key, now]]));
    const next = grid.nextSpread;
    T.step(5);
    return early.size === 1 && mature.size === 2 && Math.abs(grid.nextSpread - next - 5) < 0.01;
  }));
  check('extinguished cells retain scorch marks', await page.evaluate(() => {
    const grid = T.p().ctx.flags.summer.grid;
    const key = [...grid.active][0];
    const q = grid.point(key);
    grid.douse(q.x, q.y, 20);
    return !grid.active.has(key) && grid.scorched.has(key);
  }));

  // The rescue route never places actors or changes health/energy. All escorts
  // start at real room positions; WASD, C, G, E and R are the only interventions.
  const rescue = await page.evaluate(() => {
    T.start(1, null, true);
    const p = T.p();
    const f = p.ctx.flags;
    let minHealth = p.player.coherence;
    let frames = 0;
    let hintClearance = Infinity;
    T.observe = () => {
      frames++;
      if (p.player.godMode || DM.Save.settings.invulnerable) throw new Error('Rescue uses invulnerability');
      if (p.player.down) throw new Error('Rescue lost Jon');
      minHealth = Math.min(minHealth, p.player.coherence);
      if (p.hud.hintMsg && p.hud.gameHudVisible()) {
        const q = p.world.camera.toScreen(p.player.x, p.player.y);
        hintClearance = Math.min(hintClearance, DM.H - 170 - q.y - (p.player.r + 20) * p.world.camera.zoom);
      }
    };
    const walk = (x, y) => {
      for (let i = 0; i < 350; i++) {
        const dx = x - p.player.x;
        const dy = y - p.player.y;
        if (Math.hypot(dx, dy) < 12) break;
        DM.Input.simulate('KeyA', dx < -7);
        DM.Input.simulate('KeyD', dx > 7);
        DM.Input.simulate('KeyW', dy < -7);
        DM.Input.simulate('KeyS', dy > 7);
        T.step(0.06);
      }
      for (const key of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) DM.Input.simulate(key, false);
      T.step(0.1);
      if (Math.hypot(x - p.player.x, y - p.player.y) > 22) {
        throw new Error('Rescue blocked: ' + JSON.stringify({ x, y, px: p.player.x, py: p.player.y }));
      }
    };
    try {
      walk(820, 1035);
      T.aim(f.beam.x, f.beam.y);
      DM.Input.simulate('KeyC', true);
      T.step(0.25);
      if (f.beam.heldBy !== p.player) throw new Error('Beam not grabbed');
      T.aim(685, 1010);
      T.step(0.7);
      T.release();
      walk(875, 1035);
      walk(875, 220);
      walk(820, 220);
      T.key('KeyG');
      T.step(0.7);
      T.key('KeyE');
      if (!f.summer.grid.vented) throw new Error('Vent not opened');
      T.step(7.4);
      for (const e of f.residents) {
        const y = e.y;
        walk(820, y);
        walk(e.x < 820 ? e.x + 35 : e.x - 35, y);
        T.key('KeyE');
        if (!e.escort && !e.safe) throw new Error('Resident did not respond');
        walk(820, y);
        if (e.residentId === 3) T.key('KeyR');
      }
      walk(820, f.summer.safePoint.y);
      for (let i = 0; i < 450 && f.rescued < 6; i++) T.step(0.1);
      return { rescued: f.rescued, allSafe: f.residents.every(e => e.safe), minHealth, hintClearance,
        inputFrames: frames, time: f.summer.elapsed, alive: !p.player.down };
    } finally {
      T.observe = null;
      DM.Input.clearAll();
    }
  });
  console.log('Vulnerable real-input rescue: ' + JSON.stringify(rescue));
  check('six real-room escorts can succeed with normal damage, no relocation or health/energy cheats',
    rescue.rescued === 6 && rescue.allSafe && rescue.alive && rescue.minHealth > 0 && rescue.inputFrames > 600);
  check('Jon remains above the hint exclusion zone throughout the normal-damage rescue', rescue.hintClearance > 0);
  check('all Summer maps reserve bottom margin, including live boss framing and H hint recall', await page.evaluate(() => {
    for (let stage = 0; stage < 3; stage++) {
      T.start(stage);
      const p = T.p();
      const h = p.world.playableHeight;
      if (p.world.h - h < 300) return false;
      for (const [x, y] of [[260, 420], [p.world.w - 280, 460], [280, h - 100], [p.world.w - 280, h - 100]]) {
        // Geometry probes, not the live screenshot capture.
        T.place(x, y);
        T.key('KeyH');
        T.step(0.15);
        const q = p.world.camera.toScreen(p.player.x, p.player.y);
        if (q.y + (p.player.r + 20) * p.world.camera.zoom >= DM.H - 170) return false;
      }
    }
    return true;
  }));
  check('truck safe-passage caption stays above the hint after ten live simulation seconds', await page.evaluate(() => {
    T.start(2, null, true);
    T.step(10);
    const p = T.p();
    const sign = p.world.entities.find(e => e.text === 'SAFE PASSAGE');
    if (!sign || !p.hud.hintMsg) return false;
    const q = p.world.camera.toScreen(sign.x, sign.y);
    return q.y + 10 * p.world.camera.zoom < DM.H - 170;
  }));
  check('no 400px square of playable avenue lacks deliberate scenery/debris', await page.evaluate(() => {
    T.start();
    const anchors = T.p().world.summerDressing;
    if (!anchors || anchors.length < 30) return false;
    for (let y = 400; y <= 920; y += 25) {
      for (let x = 60; x <= 1590; x += 25) {
        if (!anchors.some(a => a.x + a.r >= x && a.x - a.r <= x + 400 &&
          a.y + a.r >= y && a.y - a.r <= y + 400)) return false;
      }
    }
    return true;
  }));
  check('hostile rioters have independent steady spill light', await page.evaluate(() => {
    const light = T.p().ctx.flags.rioters[0].light();
    return light.i >= 0.5 && light.r >= 70;
  }));
  check('warm fire lights remain strong and perfectly steady with reduced flashing', await page.evaluate(() => {
    const w = T.p().world;
    const profile = DM.Atmosphere.get(w.mapId);
    const old = DM.Save.settings.flashing;
    const time = w.time;
    DM.Save.settings.flashing = 'reduced';
    const collect = () => {
      const result = [];
      profile.light.lights(w, (x, y, r, o) => {
        if (o.color === '#f5ad60') result.push({ x, y, r, i: o.i });
      });
      return result;
    };
    const first = collect();
    w.time += 1.9;
    const second = collect();
    w.time = time;
    DM.Save.settings.flashing = old;
    return first.length === T.p().ctx.flags.summer.grid.active.size && first.every(l => l.r >= 260 && l.i >= 0.85) &&
      JSON.stringify(first) === JSON.stringify(second);
  }));
  await page.evaluate(() => { T.fast = false; DM.Engine.render(); });
  check('all new sounds and dedicated ambience are registered', await page.evaluate(() =>
    ['summer_water', 'summer_gas', 'summer_ram', 'summer_safe', 'summer_crowd', 'summer_siren'].every(n => DM.Audio.has(n)) &&
    ['summer_avenue', 'summer_tenement', 'summer_truck'].every(id => DM.Ambience.maps[id].bed.startsWith('summer_'))));
  const musicLevels = await page.evaluate(async () => {
    const sr = 44100;
    const levels = {};
    for (const id of Object.keys(DM.MusicTracks)) {
      const off = new OfflineAudioContext(1, 26 * sr, sr);
      Object.defineProperty(off, 'state', { get: () => 'running' });
      const A = Object.create(DM.Audio);
      Object.assign(A, { ctx: off, muted: false, last: {}, hums: {}, sfxBus: off.createGain() });
      A.sfxBus.connect(off.destination);
      A.noiseBuf = off.createBuffer(1, sr, sr);
      const noise = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < sr; i++) noise[i] = Math.random() * 2 - 1;
      const M = Object.create(DM.Audio.music);
      Object.assign(M, { audio: A, track: DM.MusicTracks[id], intensity: 1, barI: 1, target: 1 });
      M.gain = off.createGain();
      M.gain.gain.value = Math.pow(10, (M.track.level || 0) / 20);
      M.gain.connect(off.destination);
      const tr = M.track;
      const sp = 60 / tr.bpm / (tr.div || 4);
      let step = (tr.div || 4) * (tr.beats || 4) * 4;
      for (let t = 0.02; t < 24; t += sp) M.playStep(step++, t, sp);
      const d = (await off.startRendering()).getChannelData(0);
      const size = Math.round(sr * 0.05);
      let best = 0;
      for (let i = 0; i + size < d.length; i += size >> 1) {
        let energy = 0;
        for (let k = 0; k < size; k++) energy += d[i + k] * d[i + k];
        best = Math.max(best, Math.sqrt(energy / size));
      }
      levels[id] = 20 * Math.log10(best);
    }
    return levels;
  });
  console.log('Music loudest 50 ms (dB): ' + JSON.stringify(musicLevels));
  const mean = Object.values(musicLevels).reduce((sum, n) => sum + n, 0) / Object.keys(musicLevels).length;
  check('new music meets the original plus-or-minus 3 dB loudness tolerance',
    ['summer_street', 'summer_truck'].every(id => Math.abs(musicLevels[id] - mean) <= 3));
  const hints = [...readFileSync(path.join(root, 'src/data/chapters/long-summer.js'), 'utf8')
    .matchAll(/ctx\.tutorial\('([^']*)'/g)].map(m => m[1]);
  check('new hints respect the 95-character HUD limit', hints.length >= 3 && hints.every(t => t.length <= 95));
  check('no game-engine or browser errors', errors.length === 0 && await page.evaluate(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, mode: offline ? 'offline harness' : 'normal file loading',
    checks, errors }, null, 2));
  console.log(`LONG SUMMER PASSED: ${checks.length} checks (${offline ? 'offline harness' : 'normal file loading'}).`);
} catch (error) {
  try {
    await shot('failure');
    console.error(await page.evaluate(() => ({ state: DM.dev.state(), flags: T.p() && {
      heat: T.p().ctx.flags.heat, rescued: T.p().ctx.flags.rescued, driverOutcome: T.p().ctx.flags.driverOutcome,
      stats: T.p().ctx.stats, residents: T.p().ctx.flags.residents?.map(e => ({ x: e.x, y: e.y, safe: e.safe, held: !!e.heldBy })),
    } })));
  } catch (_) {}
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
