/* Rules-v2 optionality acceptance. The 72 completion cases are explicit
 * completed-story state fixtures, not natural routes or time calibration.
 * Mandatory state stays valid while exactly one optional condition changes.
 * Separate real entity/power/damage operations test telemetry wiring.
 * node tests/glass-palace-optionality.mjs [index.html|dist/dr-manhattan.html]
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
const build = target.includes('dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/glass-palace-optionality', engine, build);
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const checks = [];
const errors = [];
const completions = [];
const telemetry = [];
const migrations = [];
const ids = [
  'prologue', 'reassembly', 'superman', 'deterrent', 'mars', 'karnak',
  'last_broadcast', 'ninth_minute', 'long_summer', 'am_dead_air', 'am_undertow', 'am_glass_archive',
];
const slots = ['mercy', 'swift', 'detail'];
page.on('pageerror', error => errors.push(String(error)));
const ev = (fn, value) => page.evaluate(fn, value);
const wait = fn => page.waitForFunction(fn, null, { polling: 100 });
const check = (name, pass) => {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const start = (id, stage = 0, carry = null, hero = 'niteowl') => ev(values => O.start(...values), [id, stage, carry, hero]);
const key = async name => {
  await page.keyboard.down(name);
  await ev(() => O.step(0.05));
  await page.keyboard.up(name);
  await ev(() => O.step(0.07));
};

try {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.__optionalWrites = [];
    const set = Storage.prototype.setItem;
    window.__optionalRawSet = set;
    Storage.prototype.setItem = function (key, value) {
      window.__optionalWrites.push(String(key));
      return set.call(this, key, value);
    };
    if (!localStorage.getItem('dr-manhattan.save')) {
    set.call(localStorage, 'dr-manhattan.save', JSON.stringify({
      version: 2, reached: 6, completed: {}, checkpoint: null, checkpoints: {}, seen: { unlocks: {} },
      totals: { spared: 0, disintegrated: 0, memories: 0, decoherences: 0 },
      settings: { focusPause: false, textSpeed: 'instant', challenge: 'normal', invulnerable: false },
    }));
    set.call(localStorage, 'dr-manhattan.bonus.v1', JSON.stringify({ version: 1, completed: {}, checkpoints: {}, deaths: 0 }));
    set.call(localStorage, 'dr-manhattan.after-midnight.v1', JSON.stringify({
      version: 1, selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
      checkpoints: {}, records: {}, deaths: 0,
    }));
    }
  });
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await wait(() => window.DM?.dev && DM.GlassPalace?.beginRuleRun && DM.PalaceChallengeRulesV2);
  const install = fresh => {
    const GP = DM.GlassPalace;
    DM.Engine.governor.enabled = false;
    window.O = {
      step(seconds) {
        const engine = DM.Engine;
        const render = engine.render;
        engine.render = () => {};
        try {
          for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
            engine.frame(engine.last + 1000 / 60);
            if (engine.error) throw engine.error;
          }
        } finally { engine.render = render; }
        engine.render();
        if (engine.error) throw engine.error;
      },
      freshPalace() {
        GP.data = GP.sanitize({
          version: 2, rulesVersion: 2, challenges: {}, awardVersions: {}, epilogueSeen: {}, visits: 0, tracking: null, runs: {},
        });
        GP.readOnly = false;
        GP.available = true;
        GP.warning = '';
        GP.write();
      },
      start(id, stage = 0, carry = null, hero = 'niteowl') {
        const chapter = DM.Chapters.get(id);
        if (chapter.afterMidnight) DM.AfterMidnight.run = DM.AfterMidnight.config({ hero }, chapter);
        DM.Input.clearAll();
        DM.Engine.fade.dir = 0;
        DM.Engine.fade.a = 0;
        DM.Engine.set(new DM.Scenes.Play(), { chapter: id, stage, carry });
        const play = DM.dev.play();
        if (id === chapter.id && !chapter.kind?.match(/patrol|rescue/)) {
          if (!play.glassPalaceRun) throw new Error('Actual Play did not begin rules-v2 evidence: ' + id);
        }
        return play;
      },
      positiveEvidence(play) {
        const run = play.glassPalaceRun;
        if (!run || run.rulesVersion !== 2 || run.chapterId !== play.chapter.id || !run.eligible)
          throw new Error('Fresh canonical run evidence is required before constructing a boundary fixture.');
        Object.assign(run, {
          photoSeen: true, researchMask: 7, badgeSeen: true, vortexAtomsLost: 0, passiveAtoms: 30, unmade: 0,
          behemothSeen: true, behemothDefeated: true, behemothDisintegrations: 0,
          behemothCoherence: 100, behemothMaxCoherence: 100,
          marsSeen: true, marsDamage: 0, emittersSeen: true, emittersComplete: true, emittersDamage: 0,
          veidtSeen: true, veidtDefeated: true, veidtDisintegrations: 0, damageTaken: 0, fieldNotesMask: 3,
        });
        return run;
      },
      mandatoryState(play) {
        const f = play.ctx.flags;
        Object.assign(f, {
          metJaney: true, hasWatch: true, repaired: true, coatHung: true, calibrated: true,
          needCoat: true, gotCoat: true, lockdown: true, flashed: true, reassembled: true, briefed: true,
          left: true, palaceDone: true, evidence: 7, engineers: 7, passengers: 6, moments: 7,
          rescued: 6, rescuedMask: 63, heat: 10, choice: 'broadcast', tenementExit: true,
          clues: 7, downloaded: true, departed: true, ledger: true, surveyorCaptured: true, archiveReturned: true,
        });
        for (const entity of play.world.entities) {
          if (entity.team === 'enemy') {
            entity.dead = true;
          }
        }
        if (play.chapter.id === 'deterrent') {
          const boss = play.world.add(new DM.Enemies.Behemoth({ x: 1200, y: 900 }));
          boss.dead = true;
        }
        if (play.chapter.id === 'karnak') {
          const boss = play.world.add(new DM.Enemies.Veidt({ x: 2100, y: 1000 }));
          boss.yielded = true;
        }
        if (play.chapter.id === 'ninth_minute') f.choice = 'release';
        if (play.chapter.id === 'long_summer') {
          f.avenueExit = true;
          f.grappleOpen = true;
          f.truck = { disabled: true };
          f.driverOutcome = 'spared';
        }
        if (play.ctx.refs.emitters) for (const emitter of play.ctx.refs.emitters) emitter.dead = true;
        if (play.ctx.refs.sub) play.ctx.refs.sub.dead = true;
        play.failed = false;
        play.player.down = false;
        if (play.chapter.id === 'reassembly') play.player.setForm('manhattan');
        play.player.coherence = play.player.maxCoherence;
        Object.assign(play.ctx.stats, { time: 60, disintegrated: 0, spared: 4, memories: 6 });
      },
      mandatoryValid(play) {
        const id = play.chapter.id;
        const f = play.ctx.flags;
        if (play.failed || play.player.down || play.player.coherence <= 0) return false;
        if (id === 'prologue') return f.repaired && f.calibrated && f.gotCoat && f.lockdown && f.flashed;
        if (id === 'reassembly') return f.reassembled && play.player.form === 'manhattan';
        if (id === 'superman') return f.briefed && play.world.entities.every(entity => entity.team !== 'enemy' || entity.dead);
        if (id === 'deterrent') return play.world.entities.some(entity => entity instanceof DM.Enemies.Behemoth && entity.dead);
        if (id === 'mars') return f.left && f.palaceDone;
        if (id === 'karnak') return play.ctx.refs.emitters?.length === 4 &&
          play.ctx.refs.emitters.every(entity => entity.dead || entity.neutralized) && !!play.ctx.refs.sub?.dead &&
          play.world.entities.some(entity => entity instanceof DM.Enemies.Veidt && entity.yielded);
        if (id === 'last_broadcast') return f.engineers === 7 && ['broadcast', 'silence'].includes(f.choice);
        if (id === 'ninth_minute') return f.passengers === 6 && ['preserve', 'release'].includes(f.choice);
        if (id === 'long_summer') return f.rescued >= 6 && f.avenueExit && f.tenementExit &&
          f.truck.disabled && ['spared', 'unmade', 'shot'].includes(f.driverOutcome);
        if (id === 'am_dead_air') return f.clues === 7 && f.downloaded;
        if (id === 'am_undertow') return f.rescued >= 4 && f.departed;
        return f.ledger && f.surveyorCaptured && f.archiveReturned;
      },
      miss(play, slot) {
        const id = play.chapter.id;
        const f = play.ctx.flags;
        const run = play.glassPalaceRun;
        if (slot === 'swift') { play.ctx.stats.time = GP.timeTargets[id] + 1; return; }
        if (slot === 'mercy') {
          if (id === 'prologue') run.photoSeen = false;
          else if (id === 'reassembly') run.vortexAtomsLost = 1;
          else if (id === 'deterrent') run.behemothDisintegrations = 1;
          else if (id === 'mars') run.marsDamage = 1;
          else if (id === 'karnak') run.veidtDisintegrations = 1;
          else if (id.startsWith('am_')) run.damageTaken = { am_dead_air: 80, am_undertow: 100, am_glass_archive: 120 }[id] + 0.1;
          else { run.unmade = 1; play.ctx.stats.disintegrated = 1; }
          return;
        }
        if (id === 'prologue') run.researchMask = 3;
        else if (id === 'reassembly') run.passiveAtoms = 29;
        else if (id === 'superman') run.badgeSeen = false;
        else if (id === 'deterrent') run.behemothCoherence = 74.9;
        else if (id === 'mars') play.ctx.stats.memories = 5;
        else if (id === 'karnak') run.emittersDamage = 40.1;
        else if (id === 'last_broadcast') f.evidence = 3;
        else if (id === 'ninth_minute') f.moments = 3;
        else if (id === 'long_summer') f.heat = 30;
        else run.fieldNotesMask = 1;
      },
      completionFixture(id, slot, earn) {
        this.freshPalace();
        const play = this.start(id);
        this.mandatoryState(play);
        this.positiveEvidence(play);
        if (!earn) this.miss(play, slot);
        if (!this.mandatoryValid(play)) throw new Error('Optional miss corrupted mandatory state: ' + id + '/' + slot);
        const required = {
          repaired: play.ctx.flags.repaired, calibrated: play.ctx.flags.calibrated, reassembled: play.ctx.flags.reassembled,
          palaceDone: play.ctx.flags.palaceDone, engineers: play.ctx.flags.engineers, passengers: play.ctx.flags.passengers,
          rescued: play.ctx.flags.rescued, clues: play.ctx.flags.clues, downloaded: play.ctx.flags.downloaded,
          departed: play.ctx.flags.departed, ledger: play.ctx.flags.ledger,
          surveyorCaptured: play.ctx.flags.surveyorCaptured, archiveReturned: play.ctx.flags.archiveReturned,
        };
        const evidence = { ...play.glassPalaceRun };
        play.completeChapter();
        const result = play.glassPalaceResult;
        const status = GP.status(id);
        return {
          id, slot, earn, mandatoryValid: this.mandatoryValid(play), required, evidence,
          successfulRecord: GP.find(id).completed, fragments: GP.fragmentCount(),
          selected: status.challenges.find(row => row.id === slot),
          passed: result?.passed, newlyEarned: result?.newlyEarned, breakdown: result?.breakdown,
        };
      },
      isolatedCombat(play) {
        play.ctx.threads = [];
        play.ctx.lock(false);
        play.dialog.close();
        play.hud.clearTransient();
        play.player.locked = false;
        play.player.invuln = 0;
        for (const entity of play.world.entities) if (entity.team === 'enemy') entity.dead = true;
      },
      noteReachable(play, note) {
        const world = play.world;
        const radius = play.player.r;
        const step = 32;
        const cache = new Map();
        const free = (x, y) => {
          const key = x + ':' + y;
          if (cache.has(key)) return cache.get(key);
          const safe = world.isFree(x, y, radius) && world.entities.every(entity =>
            !entity.static || !entity.body || !entity.solid || entity.dead ||
            Math.hypot(entity.x - x, entity.y - y) >= entity.r + radius);
          cache.set(key, safe);
          return safe;
        };
        const segment = (a, b) => {
          const n = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 6));
          for (let i = 0; i <= n; i++) {
            if (!free(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
          }
          return true;
        };
        const start = { x: play.player.x, y: play.player.y };
        const queue = [];
        const seen = new Set();
        for (let y = 16; y < world.h; y += step) for (let x = 16; x < world.w; x += step) {
          if (Math.hypot(x - start.x, y - start.y) <= 64 && free(x, y) && segment(start, { x, y })) {
            queue.push({ x, y });
            seen.add(x + ':' + y);
          }
        }
        for (let head = 0; head < queue.length; head++) {
          const point = queue[head];
          if (Math.hypot(point.x - note.x, point.y - note.y) < note.interact.range - 8)
            return { reachable: true, visited: head + 1, approach: point };
          for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const next = { x: point.x + dx, y: point.y + dy };
            const key = next.x + ':' + next.y;
            if (seen.has(key) || !free(next.x, next.y) || !segment(point, next)) continue;
            seen.add(key);
            queue.push(next);
          }
        }
        return { reachable: false, visited: queue.length };
      },
    };
    if (fresh) O.freshPalace();
  };
  await ev(install, true);
  check('twelve moments still expose exactly thirty-six stable slot IDs under rules version two', await ev(() => {
    const GP = DM.GlassPalace;
    const rows = GP.moments().flatMap(moment => GP.challengeDefs(moment.id));
    return GP.rulesVersion === 2 && rows.length === 36 && rows.every(row => row.rulesVersion === 2) &&
      GP.moments().every(moment => GP.challengeDefs(moment.id).map(row => row.id).join(',') === 'mercy,swift,detail');
  }));
  check('time challenges have twelve distinct level-specific names', await ev(() =>
    new Set(DM.GlassPalace.moments().map(moment =>
      DM.GlassPalace.challengeDefs(moment.id).find(row => row.id === 'swift').label)).size === 12));
  check('missing full-run evidence never defaults any negative or time goal to clean', await ev(() => {
    const GP = DM.GlassPalace;
    return GP.moments().every(moment => {
      const state = { run: null, stats: { time: 1, unmade: 0, memories: 6 }, flags: {}, player: {}, refs: {} };
      return GP.challengeDefs(moment.id).filter(rule => rule.id !== 'detail').every(rule => !rule.test(state));
    });
  }));
  for (const id of ids) {
    for (const slot of slots) {
      for (const earn of [false, true]) {
        const result = await ev(values => O.completionFixture(...values), [id, slot, earn]);
        completions.push(result);
        check(id + '/' + slot + ': valid completed-story fixture ' + (earn ? 'earns' : 'misses') + ' the optional slot',
          result.mandatoryValid && result.successfulRecord && result.selected.complete === earn &&
          result.fragments === (earn ? 3 : 2) && result.newlyEarned.length === (earn ? 3 : 2) &&
          result.passed.includes(slot) === earn && result.selected.awardVersion === (earn ? 2 : 0));
      }
    }
  }
  check('all thirty-six slots have separate miss and earn completions with mandatory state preserved',
    completions.length === 72 && new Set(completions.map(row => row.id + '/' + row.slot + '/' + row.earn)).size === 72);

  for (const id of ids) {
    for (const slot of slots) {
      const result = await ev(({ id, slot }) => {
        const GP = DM.GlassPalace;
        const legacy = { version: 1, challenges: { [id]: { [slot]: true } }, epilogueSeen: { observe: true }, visits: 4 };
        const raw = JSON.stringify(legacy);
        window.__optionalRawSet.call(localStorage, GP.key, raw);
        GP.data = null;
        GP.readOnly = false;
        GP.available = true;
        window.__optionalWrites = [];
        const data = GP.load();
        const row = GP.status(id).challenges.find(row => row.id === slot);
        return { id, slot, version: data.version, rulesVersion: data.rulesVersion, count: GP.fragmentCount(),
          preserved: localStorage.getItem(GP.key) === raw && window.__optionalWrites.length === 0,
          row: { complete: row.complete, legacy: row.legacy, awardVersion: row.awardVersion },
          epilogue: data.epilogueSeen.observe, visits: data.visits };
      }, { id, slot });
      migrations.push(result);
      check(id + '/' + slot + ': legacy fragment migrates intact and stays visibly tagged as earlier rules',
        result.version === 2 && result.rulesVersion === 2 && result.count === 1 && result.preserved &&
        result.row.complete && result.row.legacy && result.row.awardVersion === 1 && result.epilogue && result.visits === 4);
    }
  }
  check('a v2 completion never duplicates or relabels all thirty-six retained legacy awards', await ev(() => {
    const GP = DM.GlassPalace;
    const challenges = Object.fromEntries(GP.moments().map(moment => [moment.id, { mercy: true, swift: true, detail: true }]));
    GP.data = GP.sanitize({ version: 1, challenges, epilogueSeen: {}, visits: 0 });
    const before = GP.fragmentCount();
    const play = O.start('prologue');
    O.mandatoryState(play);
    O.positiveEvidence(play);
    play.completeChapter();
    return before === 36 && GP.fragmentCount() === 36 && play.glassPalaceResult.newlyEarned.length === 0 &&
      GP.moments().every(moment => GP.status(moment.id).challenges.every(row => row.legacy && row.awardVersion === 1));
  }));
  check('a v1 backup keeps fragments, epilogues and pin while migrating to v2 metadata', await ev(() => {
    const GP = DM.GlassPalace;
    const legacy = { version: 1, challenges: { prologue: { mercy: true } }, epilogueSeen: { return: true }, visits: 3,
      tracking: { momentId: 'prologue', challengeId: 'swift' } };
    GP.Backup.restore(JSON.stringify({ format: 'dr-manhattan.glass-palace.backup', version: 1, data: legacy }));
    const decoded = GP.Backup.decode(GP.Backup.encode());
    return decoded.data.version === 2 && decoded.data.awardVersions.prologue.mercy === 1 &&
      decoded.data.epilogueSeen.return && decoded.data.tracking.challengeId === 'swift' && GP.fragmentCount() === 1;
  }));

  await ev(() => O.freshPalace());
  await start('am_dead_air');
  const damage = await ev(() => {
    const play = DM.dev.play();
    O.isolatedCombat(play);
    const run = play.glassPalaceRun;
    const p = play.player;
    const before = run.damageTaken;
    p.invuln = 1;
    const ignored = p.damage(10, { x: p.x + 100, y: p.y }, 'bullet');
    const afterIgnored = run.damageTaken;
    p.invuln = 0;
    const health = p.coherence;
    const accepted = p.damage(10, { x: p.x + 100, y: p.y }, 'bullet');
    const lost = health - p.coherence;
    const afterHit = run.damageTaken;
    p.coherence = p.maxCoherence;
    return { ignored, accepted, before, afterIgnored, lost, afterHit, afterHeal: run.damageTaken, runId: run.runId };
  });
  telemetry.push({ type: 'actual-damage', ...damage });
  check('actual damage telemetry ignores invulnerability and records the post-armour health reduction',
    damage.ignored === false && damage.afterIgnored === damage.before && damage.accepted && damage.lost > 0 &&
    Math.abs(damage.afterHit - damage.before - damage.lost) < 1e-6);
  check('healing never subtracts from the observed full-run damage budget', damage.afterHeal === damage.afterHit);
  const retry = await ev(() => {
    const play = DM.dev.play();
    const before = { runId: play.glassPalaceRun.runId, damage: play.glassPalaceRun.damageTaken };
    play.ctx.checkpoint = 0;
    play.ctx.checkpointCarry = { stats: { time: 10, spared: 0, disintegrated: 0, memories: 0 }, found: [], flags: {} };
    play.retry();
    O.step(1.2);
    return { before, after: { ...DM.dev.play().glassPalaceRun }, time: DM.dev.play().ctx.stats.time };
  });
  telemetry.push({ type: 'actual-retry', ...retry });
  check('actual Retry retains observed damage and run identity while restoring the normal field-time carry',
    retry.after.runId === retry.before.runId && retry.after.damageTaken === retry.before.damage &&
    retry.time >= 10 && retry.time < 12);

  for (const [id, Boss, field] of [['deterrent', 'Behemoth', 'behemoth'], ['karnak', 'Veidt', 'veidt']]) {
    await ev(() => O.freshPalace());
    await start(id);
    const setup = await ev(({ Boss }) => {
      const play = DM.dev.play();
      O.isolatedCombat(play);
      const p = play.player;
      p.unlock('disintegrate');
      p.energy = p.maxEnergy;
      p.invuln = 0;
      p.damage(p.maxCoherence * 0.4, { x: p.x + 100, y: p.y }, 'impact');
      const boss = play.ctx.add(new DM.Enemies[Boss]({ x: p.x + 100, y: p.y, facing: Math.PI }));
      boss.hp = 1;
      boss.stun = 2;
      play.world.boss = boss;
      window.__optionalBoss = boss;
      const point = play.world.camera.toScreen(boss.x, boss.y);
      return { point, coherence: p.coherence, maximum: p.maxCoherence,
        seenAtIntroduction: play.glassPalaceRun[Boss === 'Behemoth' ? 'behemothSeen' : 'veidtSeen'],
        castsBeforeInput: play.glassPalaceRun[Boss === 'Behemoth' ? 'behemothDisintegrations' : 'veidtDisintegrations'] };
    }, { Boss });
    check(id + ': actual context addition observes the live fight before any power is fired',
      setup.seenAtIntroduction && setup.castsBeforeInput === 0);
    await page.mouse.move(setup.point.x, setup.point.y);
    await key('q');
    const afterCast = await ev(field => ({
      casts: DM.dev.play().glassPalaceRun[field + 'Disintegrations'],
      dead: !!window.__optionalBoss.dead,
      yielded: !!window.__optionalBoss.yielded,
    }), field);
    await ev(() => O.step(0.4));
    const finished = await ev(field => ({
      run: { ...DM.dev.play().glassPalaceRun }, dead: !!window.__optionalBoss.dead,
      yielded: !!window.__optionalBoss.yielded,
      live: DM.GlassPalace.liveChallenge(DM.dev.play(), 'mercy'),
      coherence: DM.dev.play().player.coherence,
    }), field);
    telemetry.push({ type: id + '-finishing-cast', setup, afterCast, finished });
    check(id + ': the actual accepted killing cast is counted before the boss can die or yield',
      afterCast.casts === 1 && !afterCast.dead && !afterCast.yielded &&
      finished.run[field + 'Disintegrations'] === 1 && (finished.dead || finished.yielded) &&
      finished.live.state === 'missed' && !finished.live.metNow);
    if (id === 'deterrent') {
      const healed = await ev(() => {
        const play = DM.dev.play();
        const before = { coherence: play.glassPalaceRun.behemothCoherence,
          maximum: play.glassPalaceRun.behemothMaxCoherence };
        O.step(8);
        return { before, healthNow: play.player.coherence,
          frozen: play.glassPalaceRun.behemothCoherence, detail: DM.GlassPalace.liveChallenge(play, 'detail') };
      });
      telemetry.push({ type: 'combat-end-freeze', ...healed });
      check('Behemoth combat-end coherence is frozen before safe healing rather than sampled at chapter completion',
        healed.before.coherence < healed.before.maximum * 0.75 && healed.healthNow >= healed.before.maximum * 0.75 &&
        healed.frozen === healed.before.coherence && !healed.detail.metNow && healed.detail.state === 'missed');
    }
  }

  await ev(() => O.freshPalace());
  await start('superman');
  const checkpoint = await ev(() => {
    const play = DM.dev.play();
    play.glassPalaceRun.unmade = 1;
    play.ctx.stats.time = 75;
    const carry = play.ctx.snapshot();
    DM.Save.checkpointAt(play.chapter.id, 1, carry);
    DM.GlassPalace.saveRunCheckpoint(play, 1, carry);
    return { carry, runId: play.glassPalaceRun.runId };
  });
  await start('superman', 1, checkpoint.carry);
  check('a matching palace-local checkpoint restores real run coverage and retained outcomes', await ev(runId => {
    const play = DM.dev.play();
    return play.glassPalaceRun.eligible && play.glassPalaceRun.runId === runId &&
      play.glassPalaceRun.unmade === 1 && DM.GlassPalace.liveChallenge(play, 'mercy').state === 'missed';
  }, checkpoint.runId));
  const changedCarry = JSON.parse(JSON.stringify(checkpoint.carry));
  changedCarry.stats.time++;
  await start('superman', 1, changedCarry);
  check('mismatched Resume cannot turn missing history into a clean run or a speed award', await ev(() => {
    const play = DM.dev.play();
    const GP = DM.GlassPalace;
    return !play.glassPalaceRun.eligible && !GP.liveChallenge(play, 'mercy').metNow &&
      GP.liveChallenge(play, 'mercy').state === 'pending' && !GP.liveChallenge(play, 'swift').metNow;
  }));
  await ev(() => O.freshPalace());
  await start('superman', 1, checkpoint.carry);
  check('legacy checkpoints without v2 evidence explain that a fresh run is needed', await ev(() => {
    const play = DM.dev.play();
    const row = DM.GlassPalace.liveChallenge(play, 'mercy');
    return !play.glassPalaceRun.eligible && row.state === 'pending' && /fresh/i.test(row.reason) && !row.metNow;
  }));
  await ev(() => O.freshPalace());
  await start('am_undertow');
  const amCheckpoint = await ev(() => {
    const play = DM.dev.play();
    play.glassPalaceRun.damageTaken = 12;
    Object.assign(play.ctx.stats, { time: 37, spared: 2, disintegrated: 0, memories: 0 });
    Object.assign(play.ctx.flags, { power: 3, winchOpen: true });
    const carry = play.ctx.snapshot();
    DM.Save.checkpointAt(play.chapter.id, 1, carry);
    DM.GlassPalace.saveRunCheckpoint(play, 1, carry);
    const slot = DM.AfterMidnight.slot(play.chapter.amId, DM.AfterMidnight.run);
    const stored = JSON.parse(localStorage.getItem(DM.GlassPalace.sourceKeys.afterMidnight)).checkpoints[slot];
    return { stored, originalCarry: carry, runId: play.glassPalaceRun.runId,
      normalizerChangedOrder: JSON.stringify(carry) !== JSON.stringify(stored.carry) };
  });
  check('the AM checkpoint fixture uses its actual stored normalization rather than a fabricated identical signature',
    amCheckpoint.normalizerChangedOrder && Array.isArray(amCheckpoint.stored.carry.found));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(() => window.DM?.dev && DM.GlassPalace?.beginRuleRun && DM.PalaceChallengeRulesV2);
  await ev(install, false);
  await start('am_undertow', amCheckpoint.stored.stage, amCheckpoint.stored.carry);
  check('actual stored AM checkpoint survives reload and restores eligible run evidence despite key-order normalization',
    await ev(runId => {
      const play = DM.dev.play();
      return play.glassPalaceRun.eligible && play.glassPalaceRun.runId === runId &&
        play.glassPalaceRun.damageTaken === 12 && play.ctx.stats.time === 37;
    }, amCheckpoint.runId));
  await ev(() => O.freshPalace());
  await start('am_dead_air');
  const zeroCheckpoint = await ev(() => {
    const play = DM.dev.play();
    play.glassPalaceRun.damageTaken = 5;
    play.ctx.stats.time = 11;
    const carry = play.ctx.snapshot();
    DM.Save.checkpointAt(play.chapter.id, 0, carry);
    DM.GlassPalace.saveRunCheckpoint(play, 0, carry);
    const slot = DM.AfterMidnight.slot(play.chapter.amId, DM.AfterMidnight.run);
    return { runId: play.glassPalaceRun.runId, stored: DM.AfterMidnight.load().checkpoints[slot] };
  });
  await start('am_dead_air', 0, zeroCheckpoint.stored.carry);
  check('a matching stage-zero checkpoint with carry restores evidence instead of being mistaken for an unobserved start',
    await ev(runId => {
      const play = DM.dev.play();
      return play.glassPalaceRun.eligible && play.glassPalaceRun.runId === runId &&
        play.glassPalaceRun.damageTaken === 5 && play.ctx.stats.time === 11;
    }, zeroCheckpoint.runId));
  check('six unique optional field-note definitions belong only to the three story cases', await ev(() => {
    const notes = DM.GlassPalace.fieldNoteDefinitions;
    return notes.length === 6 && new Set(notes.map(note => note.id)).size === 6 &&
      ['am_dead_air', 'am_undertow', 'am_glass_archive'].every(id =>
        notes.filter(note => note.chapterId === id).map(note => note.bit).sort().join(',') === '1,2');
  }));
  for (const id of ['am_dead_air', 'am_undertow', 'am_glass_archive']) {
    const maps = await ev(id => {
      const chapter = DM.Chapters.get(id);
      return Object.keys(chapter.maps).map(map => ({ map, stage: chapter.stages.findIndex(stage => stage.map === map) }));
    }, id);
    for (const map of maps) {
      await start(id, map.stage);
      const placements = await ev(() => {
        const play = DM.dev.play();
        const notes = play.world.entities.filter(entity => entity.glassPalaceNoteId);
        return notes.map(note => ({
          id: note.glassPalaceNoteId, label: note.interact.label, x: note.x, y: note.y,
          floor: play.world.isFree(note.x, note.y, play.player.r),
          separated: play.world.entities.every(entity => entity === note || !entity.interact ||
            Math.hypot(entity.x - note.x, entity.y - note.y) >= 160 - 1e-6),
          ...O.noteReachable(play, note),
        }));
      });
      telemetry.push({ type: 'field-note-floor', id, map: map.map, placements });
      check(id + '/' + map.map + ': both optional notes are distinct, reachable and clear of other E prompts',
        placements.length === 2 && new Set(placements.map(note => note.id)).size === 2 &&
        placements.every(note => note.floor && note.separated && note.reachable && note.label));
    }
    await start(id);
    const interactions = await ev(() => {
      const play = DM.dev.play();
      O.isolatedCombat(play);
      const before = Object.fromEntries(Object.values(DM.GlassPalace.sourceKeys)
        .map(key => [key, localStorage.getItem(key)]));
      const notes = play.world.entities.filter(entity => entity.glassPalaceNoteId);
      const read = note => {
        play.dialog.close();
        play.player.locked = false;
        play.player.x = note.x;
        play.player.y = note.y + 25;
        DM.Input._press('KeyE');
        play.player.updateInteraction(play.world);
        DM.Input.clearAll();
        return play.glassPalaceRun.fieldNotesMask;
      };
      const first = read(notes[0]);
      const repeated = read(notes[0]);
      const second = read(notes[1]);
      return { first, repeated, second, noSourceWrites: Object.entries(before)
        .every(([key, value]) => localStorage.getItem(key) === value) };
    });
    telemetry.push({ type: 'actual-field-note-interaction', id, ...interactions });
    check(id + ': actual E interactions collect two different note bits without counting one note twice',
      [1, 2].includes(interactions.first) && interactions.repeated === interactions.first &&
      interactions.second === 3 && interactions.noSourceWrites);
    check(id + ': palace preview worlds contain no new gameplay field notes or run evidence', await ev(id => {
      const preview = new DM.GlassPalace.MomentPreview(DM.GlassPalace.find(id));
      preview.build();
      const okay = !preview.error && !preview.world.entities.some(entity => entity.glassPalaceNoteId) &&
        !DM.GlassPalace.runEvidence(preview.context.scene);
      preview.dispose();
      return okay;
    }, id));
  }
  for (const id of ['am_patrol', 'am_rescue_clock']) {
    await start(id);
    check(id + ': replay modes receive no canonical optionality run evidence', await ev(() =>
      !DM.GlassPalace.runEvidence(DM.dev.play())));
    check(id + ': replay modes contain no optional story field notes', await ev(() =>
      !DM.dev.play().world.entities.some(entity => entity.glassPalaceNoteId)));
  }
  check('rules-v2 tests produce no page or engine error', errors.length === 0 && await ev(() => !DM.Engine.error));
  const finalLine = `GLASS PALACE OPTIONALITY PASSED: ${checks.length} checks; 36 misses + 36 earns (${engine}, ${target}).`;
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({
    target, engine, browser: browser.version(), checks, errors, completions, telemetry, migrations, finalLine, exitCode: 0,
    method: 'Explicit completed-story state fixtures through actual completion paths; separate actual entity/power/damage/lifecycle tests.',
    limitations: 'The 72 completion fixtures do not claim natural traversal of all stage generators or validated time targets.',
  }, null, 2) + '\n');
  console.log(finalLine);
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure-diagnostic.png') });
  writeFileSync(path.join(out, 'failure.json'), JSON.stringify({
    target, engine, checks, errors, completions, telemetry, migrations, error: String(error.stack || error), exitCode: 1,
  }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
