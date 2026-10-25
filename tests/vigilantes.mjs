/* Focused actor/gear regression. Real keyboard events with controlled sandbox
 * placement and stepped RAF isolate mechanics; this is not natural play evidence.
 * node tests/vigilantes.mjs [index.html|dist/dr-manhattan.html]
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(arg => arg.endsWith('.html')) || 'index.html';
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');
const out = path.join(root, 'tests/out/vigilantes', engine, target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true,
  ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}),
  ...(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = [];
const signatureResults = [];
page.on('pageerror', error => errors.push(String(error)));
const check = (name, pass) => { assert.ok(pass, name); checks.push(name); console.log('PASS ' + name); };
const ev = (fn, value) => page.evaluate(fn, value);
const key = async (name, seconds = 0.06) => {
  await page.keyboard.down(name); await ev(seconds => T.step(seconds), seconds);
  await page.keyboard.up(name); await ev(() => T.step(0.05));
};
const start = id => ev(id => T.start(id), id);

try {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.createPlayer, null, { polling: 100 });
  const original = await ev(() => {
    DM.Save.settings.focusPause = false; DM.Engine.governor.enabled = false;
    DM.Save.settings.challenge = 'normal'; DM.Save.settings.invulnerable = false;
    window.T = {
      hero: 'niteowl', aim: null,
      play: () => DM.dev.play(),
      step(seconds = 0.1) {
        const E = DM.Engine, render = E.render; E.render = () => {};
        try {
          for (let i = 0; i < Math.ceil(seconds * 60); i++) {
            if (this.aim && this.play()) {
              const s = this.play().world.camera.toScreen(this.aim.x, this.aim.y);
              DM.Input.mouse.x = s.x; DM.Input.mouse.y = s.y;
            }
            E.frame(E.last + 1000 / 60);
            if (E.error) throw E.error;
          }
        } finally { E.render = render; }
        E.render();
        if (E.error) throw E.error;
      },
      start(id) {
        this.hero = id; this.aim = { x: 650, y: 500 };
        DM.Input.clearAll(); DM.Engine.fade.dir = 0; DM.Engine.fade.a = 0;
        DM.Engine.set(new DM.Scenes.Play(), { chapter: '__vigilante_test', stage: 0 });
        this.step(0.1);
      },
      foe(x = 450, y = 500, machine = false) {
        const e = this.play().world.add(machine ? new DM.Enemies.Drone({ x, y }) : new DM.Enemies.Gangster({ x, y }));
        e.stun = 100; e.fireCd = 100;
        this.target = e; this.aim = { x, y }; this.step(0.02);
        return e;
      },
    };
    DM.Chapters.byId.__vigilante_test = {
      id: '__vigilante_test', index: 0, numeral: 'TEST', title: 'Field gear', date: '1978', place: 'NEW YORK', clock: 4,
      afterMidnight: true, createPlayer: () => DM.AfterMidnight.createPlayer(T.hero), startPowers: [],
      progress: { checkpointAt() {}, death() {} }, music: null,
      maps: { t(ctx) { const w = ctx.newWorld({ w: 1600, h: 1000, zoom: 1 }); w.room(0, 0, 1600, 1000); w.spawn = { x: 400, y: 500 }; return w; } },
      stages: [{ id: 'field', map: 't', run: function* () { while (true) yield; } }],
    };
    return { campaign: localStorage.getItem('dr-manhattan.save'), bonus: localStorage.getItem('dr-manhattan.bonus.v1'),
      chapters: DM.Chapters.list.length, bonuses: DM.Bonus.list.length };
  });
  check('three heroes each own six distinct gear abilities', await ev(() => {
    const h = DM.AfterMidnight.heroes;
    return h.length === 3 && h.every(h => h.abilities.length === 6) && new Set(h.flatMap(h => h.abilities.map(a => a.id))).size === 18;
  }));

  for (const id of ['niteowl', 'silkspectre', 'rorschach']) {
    await start(id);
    check(id + ': factory owns six gear states and stays human-vulnerable', await ev(() => {
      const p = T.play().player, hp = p.coherence;
      p.damage(20, null, 'bullet');
      return p.form === 'vigilante' && p.profile.id === T.hero && !p.godMode &&
        p.coherence < hp && Object.keys(p.powers).length === 6 && !p.has('disintegrate');
    }));
    await start(id); await ev(() => T.foe()); await key('c', 1.15);
    check(id + ': ordinary primary attacks knock people out exactly once', await ev(() =>
      T.target.ko && !T.target.dead && T.play().ctx.stats.spared === 1 && T.play().ctx.stats.disintegrated === 0));
    await page.screenshot({ path: path.join(out, id + '-gear.png') });

    await start(id);
    await ev(() => { T.play().world.wall(470, 400, 16, 200, 'wall'); T.aim = { x: 700, y: 500 }; });
    await page.keyboard.down('Space'); await ev(() => T.step(0.05));
    const early = await ev(() => T.play().player.x);
    await page.keyboard.up('Space'); await ev(() => T.step(0.6));
    const late = await ev(() => T.play().player.x);
    check(id + ': traversal moves over time and stops before a thin wall', early > 400 && early < late && late <= 457);
  }

  for (const [id, expectedDamage] of [['niteowl', 44], ['silkspectre', 33], ['rorschach', 14]]) {
    await start(id);
    await ev(() => {
      const play = T.play(), world = play.world;
      const foe = (x, y) => {
        const e = world.add(new DM.Enemies.Gangster({ x, y }));
        e.hp = e.maxHp = 100; e.stun = 100; e.fireCd = 100;
        return e;
      };
      const near = foe(460, 500), far = foe(850, 500), blocked = foe(400, 410);
      near.stun = 0;
      world.wall(350, 445, 100, 12, 'wall');
      const friend = world.add(new DM.Entity({ x: 430, y: 465, hp: 100, team: 'player',
        body: false, solid: false, static: true, disintegratable: false }));
      const civilian = world.add(new DM.NPC({ x: 430, y: 535, look: 'jon' }));
      civilian.hp = civilian.maxHp = 100;
      T.signature = { near, far, blocked, friend, civilian, nearStartX: near.x,
        startingEnergy: play.player.energy, startingHealth: play.player.coherence };
      T.aim = { x: 460, y: 500 };
    });
    await key('g');
    const result = await ev(() => {
      const p = T.play().player, s = T.signature;
      return { hero: p.profile.id, damage: 100 - s.near.hp, stun: s.near.stun,
        push: s.near.x - s.nearStartX, spent: s.startingEnergy - p.energy,
        cooldown: p.powers[p.profile.abilities[5].id].cd,
        farHealth: s.far.hp, wallBlockedHealth: s.blocked.hp,
        blockedLineOfSight: !T.play().world.los(p.x, p.y, s.blocked.x, s.blocked.y),
        friendlyHealth: s.friend.hp, civilianHealth: s.civilian.hp,
        heroHealth: p.coherence, heroStartingHealth: s.startingHealth,
        spared: T.play().ctx.stats.spared, gone: T.play().ctx.stats.disintegrated };
    });
    signatureResults.push(result);
    check(id + ': real G signature damages, staggers and pushes a nearby opponent at a stamina/cooldown cost',
      result.damage === expectedDamage && result.stun > 0 && result.push > 2 && result.spent > 0 && result.cooldown > 0);
    check(id + ': G leaves both out-of-range and solid-wall-protected opponents unharmed',
      result.farHealth === 100 && result.wallBlockedHealth === 100 && result.blockedLineOfSight);
    check(id + ': G harms no friendly, civilian or caster and changes no human ledger',
      result.friendlyHealth === 100 && result.civilianHealth === 100 && result.heroHealth === result.heroStartingHealth &&
      result.spared === 0 && result.gone === 0);
    await page.screenshot({ path: path.join(out, id + '-signature.png') });
  }

  await start('niteowl'); await ev(() => T.foe(650, 500, true)); await key('q'); await ev(() => T.step(0.65));
  check('Owl stun bolt physically hits a machine', await ev(() => T.target.dead && T.play().ctx.stats.disintegrated === 0));

  await start('rorschach'); await ev(() => T.foe(620, 500)); await key('q'); await ev(() => T.step(0.3));
  check('Rorschach hook damages and physically pulls a live opponent', await ev(() => T.target.hp === 24 && T.target.x < 600));

  await start('silkspectre'); await ev(() => T.foe(600, 500));
  await page.keyboard.down('q'); await ev(() => { T.step(0.04); T.shot = T.play().world.entities.find(e => e instanceof DM.AfterMidnight.GearShot); });
  await page.keyboard.up('q'); await ev(() => T.step(1.2));
  check('returning baton hits on both passes, is caught and refunds stamina', await ev(() =>
    T.target.ko && T.shot.returning && T.shot.refunded && T.play().ctx.stats.spared === 1));

  for (const id of ['niteowl', 'rorschach']) {
    await start(id);
    await ev(() => { const e = T.foe(650, 500); e.stun = 0; e.target = T.play().player; e.aim = 0.4; });
    await key('r'); await ev(() => T.step(0.3));
    check(id + ': smoke cancels target locks and conceals its owner', await ev(() =>
      T.play().player.inSmoke && !T.play().player.targetable && T.target.target === null && T.target.aim === 0));
    await ev(() => { T.play().ctx.place(850, 500); T.aim = { x: 900, y: 500 }; T.step(0.4); });
    check(id + ': leaving smoke restores normal enemy targeting', await ev(() =>
      !T.play().player.inSmoke && T.play().player.targetable && T.target.target === T.play().player));
  }

  await start('silkspectre'); await ev(() => { const e = T.foe(650, 500); e.stun = 0; }); await key('r');
  await ev(() => T.step(0.3));
  check('Silk Spectre feint is an actual enemy target with finite health', await ev(() =>
    T.target.target instanceof DM.AfterMidnight.Feint && T.target.target.hp === 24));
  await ev(() => { T.target.target.damage(30, T.target, 'bullet'); T.step(0.4); });
  check('destroying the feint returns enemy attention to the real hero', await ev(() => T.target.target === T.play().player));

  await start('silkspectre'); await ev(() => { T.foe(450, 500); T.play().player.facing = 0; });
  await page.keyboard.down('f'); await ev(() => T.step(0.05));
  const timed = await ev(() => { const p = T.play().player, hp = p.coherence; p.invuln = 0; p.damage(20, T.target, 'bullet'); return hp - p.coherence; });
  await ev(() => T.step(0.6));
  const held = await ev(() => { const p = T.play().player, hp = p.coherence; p.invuln = 0; p.damage(20, T.target, 'bullet'); return hp - p.coherence; });
  await page.keyboard.up('f'); await ev(() => T.step(0.1));
  const released = await ev(() => { const p = T.play().player, hp = p.coherence; p.invuln = 0; p.damage(20, T.target, 'bullet'); return hp - p.coherence; });
  check('timed guard, sustained guard and no guard have genuinely different damage',
    Math.abs(timed - 3) < 0.01 && Math.abs(held - 9) < 0.01 && Math.abs(released - 20) < 0.01);

  await start('niteowl');
  await ev(() => { T.foe(650, 500, true); T.aim = { x: 650, y: 565 }; });
  await key('q'); await ev(() => T.step(0.65));
  const unaidedShot = await ev(() => ({ targetHp: T.target.hp, dead: T.target.dead, investigating: T.play().player.investigating }));
  await start('niteowl');
  await ev(() => { T.foe(650, 500, true); T.aim = { x: 650, y: 565 }; });
  await page.keyboard.down('f'); await ev(() => T.step(0.2));
  await key('q'); await ev(() => T.step(0.65));
  const visorShot = await ev(() => ({ targetHp: T.target.hp, dead: T.target.dead, investigating: T.play().player.investigating,
    energy: T.play().player.energy }));
  await page.keyboard.up('f'); await ev(() => T.step(0.05));
  writeFileSync(path.join(out, 'visor-aim.json'), JSON.stringify({ unaidedShot, visorShot }, null, 2));
  check('held powered Owl visor steadies a slightly off-target Q that otherwise misses',
    unaidedShot.targetHp === 30 && !unaidedShot.dead && !unaidedShot.investigating &&
    visorShot.dead && visorShot.investigating && visorShot.energy > 2);
  await start('niteowl');
  await ev(() => { T.foe(650, 500, true); T.aim = { x: 650, y: 565 }; T.play().player.energy = 13.5; });
  await page.keyboard.down('f'); await key('q'); await ev(() => T.step(0.65));
  const exhaustedVisorShot = await ev(() => ({ targetHp: T.target.hp, dead: T.target.dead }));
  await page.keyboard.up('f'); await ev(() => T.step(0.05));
  check('Owl aim assist requires powered visor input when the shot fires',
    exhaustedVisorShot.targetHp === 30 && !exhaustedVisorShot.dead);

  await start('rorschach'); await ev(() => T.foe(450, 500)); await page.keyboard.down('f'); await ev(() => T.step(0.85));
  check('reading an opponent charges a real weakness', await ev(() => T.play().player.readCharge >= 0.75 && T.play().player.readTarget === T.target));
  await key('c'); await page.keyboard.up('f'); await ev(() => T.step(0.1));
  check('a read heavy strike exploits that weakness nonlethally', await ev(() => T.target.ko && T.play().ctx.stats.spared === 1));

  await start('niteowl'); await page.keyboard.down('f'); await ev(() => T.step(0.2));
  check('Owl visor is investigative gear rather than Manhattan time manipulation', await ev(() =>
    T.play().player.investigating && T.play().player.light().r > 180 && !T.play().world.timesight && !T.play().world.slowmo));
  await page.keyboard.up('f');

  check('all earned upgrades use the same capped math as creation', await ev(() => {
    const AM = DM.AfterMidnight, p = AM.createPlayer('niteowl');
    const old = { hp: p.maxCoherence, energy: p.maxEnergy, regen: p.energyRegen, speed: p.speedMax };
    const accepted = ['vitality', 'capacitor', 'mobility'].every(id => p.applyUpgrade(id));
    const same = AM.createPlayer('niteowl', { vitality: 1, capacitor: 1, mobility: 1 });
    return accepted && p.maxCoherence === old.hp + 15 && p.maxEnergy === old.energy + 12 &&
      p.energyRegen === old.regen + 2 && Math.abs(p.speedMax - old.speed * 1.05) < 0.01 &&
      p.maxCoherence === same.maxCoherence && p.maxEnergy === same.maxEnergy && p.speedMax === same.speedMax &&
      p.applyUpgrade('mobility') && p.applyUpgrade('mobility') && !p.applyUpgrade('mobility') && !p.applyUpgrade('__proto__');
  }));
  check('character checks never modify either original save or chapter registry', await ev(old =>
    localStorage.getItem('dr-manhattan.save') === old.campaign && localStorage.getItem('dr-manhattan.bonus.v1') === old.bonus &&
    DM.Chapters.list.length === old.chapters && DM.Bonus.list.length === old.bonuses, original));
  check('no browser or engine errors', errors.length === 0 && await ev(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, engine, version: browser.version(), checks, errors,
    method: 'Normal file loading; real keyboard events, controlled sandbox actor placement and stepped RAF.',
    guardDamage: { timed, held, released }, signatureResults, visorAim: { unaidedShot, visorShot, exhaustedVisorShot } }, null, 2));
  console.log(`VIGILANTES PASSED: ${checks.length} checks (${engine}, ${target}).`);
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') });
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
