/* Live challenge tracking acceptance in the actual engine. Controlled stat,
 * flag and completion fixtures establish state boundaries; they are not natural
 * playthrough or challenge-balance evidence. Diagnostic screenshots are never
 * presented as live gameplay captures.
 * node tests/glass-palace-tracking.mjs [index.html|dist/dr-manhattan.html]
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
const out = path.resolve(process.env.TRACKING_OUT || path.join(root, 'tests/out/glass-palace-tracking', engine, build));
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const checks = [];
const errors = [];
const snapshots = [];
const completionResults = [];
const reloadDiagnostics = {};
page.on('pageerror', error => errors.push(String(error)));
const ev = (fn, value) => page.evaluate(fn, value);
const wait = fn => page.waitForFunction(fn, null, { polling: 100 });
const check = (name, pass) => {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const key = async name => {
  await page.keyboard.down(name);
  await ev(() => T.step(0.05));
  await page.keyboard.up(name);
  await ev(() => T.step(0.07));
};
const action = async label => {
  const rect = await ev(label => {
    const menu = DM.Engine.top().menu;
    const index = menu?.items.findIndex(item => item.label === label);
    if (!(index >= 0)) throw new Error('Missing actual menu action: ' + label);
    return menu.rowRect(index);
  }, label);
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2);
  await ev(() => T.step(0.1));
};
const challengeAction = async id => {
  const rect = await ev(id => {
    const menu = DM.Engine.top().menu;
    const index = menu?.items.findIndex(item => item.challengeId === id);
    if (!(index >= 0)) throw new Error('Missing actual challenge action: ' + id);
    return menu.rowRect(index);
  }, id);
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2);
  await ev(() => T.step(0.1));
};
const palace = () => ({ version: 1, challenges: {}, epilogueSeen: {}, visits: 0 });
const seedPalace = async data => ev(data => T.seedPalace(data), data || palace());
const start = async (id, stage = 0, carry = null) => ev(value => T.start(...value), [id, stage, carry]);
const pure = async () => ev(() => {
  const GP = DM.GlassPalace;
  const before = { raw: localStorage.getItem(GP.key), fragments: GP.fragmentCount() };
  window.__trackingGets = [];
  window.__trackingWrites = [];
  return before;
});
const noWrites = () => ev(() => window.__trackingWrites.length === 0);
const protectedNow = () => ev(() => T.protected());
const unchanged = before => ev(before => JSON.stringify(T.protected()) === JSON.stringify(before) &&
  window.__trackingWrites.every(entry => entry.key === DM.GlassPalace.key), before);
const live = challengeId => ev(challengeId => DM.GlassPalace.liveChallenge(DM.dev.play(), challengeId), challengeId);
const reloadState = pinSelection => {
  const GP = window.DM?.GlassPalace;
  const accepted = pinSelection ? GP.pinChallenge('prologue', 'swift') : undefined;
  let raw = null;
  let storageError = null;
  try { raw = localStorage.getItem(GP?.key || 'dr-manhattan.glass-palace.v1'); }
  catch (error) { storageError = String(error); }
  let parsed = null;
  try { parsed = raw === null ? null : JSON.parse(raw); }
  catch (_) { parsed = { invalidJSON: true }; }
  return {
    accepted,
    documentNonce: window.__trackingDocumentNonce,
    timeOrigin: performance.timeOrigin,
    readyState: document.readyState,
    url: location.href,
    booted: !!window.DM?.dev,
    raw,
    parsed,
    storageError,
    data: GP?.data ? JSON.parse(JSON.stringify(GP.data)) : null,
    available: GP?.available,
    readOnly: GP?.readOnly,
    warning: GP?.warning,
    blocked: window.__trackingBlock,
    writes: window.__trackingWrites,
    gets: window.__trackingGets,
    campaignIds: window.DM?.Chapters?.list.map(chapter => chapter.id),
    bonusIds: window.DM?.Bonus?.list.map(chapter => chapter.id),
    caseIds: window.DM?.AfterMidnight?.cases.map(chapter => chapter.id),
  };
};
const install = () => {
  DM.Save.settings.focusPause = false;
  DM.Save.settings.textSpeed = 'instant';
  DM.Engine.governor.enabled = false;
  window.T = {
    step(seconds = 0.1) {
      const engine = DM.Engine;
      const render = engine.render;
      engine.render = () => {};
      try {
        for (let i = 0; i < Math.ceil(seconds * 60); i++) {
          engine.frame(engine.last + 1000 / 60);
          if (engine.error) throw engine.error;
        }
      } finally { engine.render = render; }
      engine.render();
      if (engine.error) throw engine.error;
    },
    protected() {
      return {
        slots: Object.fromEntries(Object.values(DM.GlassPalace.sourceKeys)
          .map(key => [key, localStorage.getItem(key)])),
        settings: JSON.stringify(DM.Save.settings),
      };
    },
    seedPalace(data) {
      const GP = DM.GlassPalace;
      window.__trackingBlock = false;
      window.__trackingRawSet.call(localStorage, GP.key, JSON.stringify(data));
      GP.data = null;
      GP.readOnly = false;
      GP.available = true;
      GP.warning = '';
      GP.load();
      window.__trackingWrites = [];
      window.__trackingGets = [];
    },
    reach(index) {
      const key = DM.GlassPalace.sourceKeys.campaign;
      const data = JSON.parse(localStorage.getItem(key));
      data.reached = index;
      DM.Save.data.reached = index;
      window.__trackingRawSet.call(localStorage, key, JSON.stringify(data));
      window.__trackingWrites = [];
    },
    ruleFixture(play, options = {}) {
      const run = play.glassPalaceRun;
      if (!run) throw new Error('Fresh Play did not establish rules-v2 evidence.');
      // Explicit controlled evidence, independent of the genuine event tests in
      // glass-palace-optionality. Mandatory story flags remain valid.
      Object.assign(run, {
        photoSeen: options.mercy !== false,
        researchMask: options.detail === false ? 3 : 7,
        badgeSeen: true,
        vortexAtomsLost: 0,
        passiveAtoms: 30,
        unmade: options.unmade ?? 0,
        behemothSeen: true,
        behemothDefeated: true,
        behemothDisintegrations: 0,
        behemothCoherence: 100,
        behemothMaxCoherence: 100,
        marsSeen: true,
        marsDamage: 0,
        emittersSeen: true,
        emittersComplete: true,
        emittersDamage: 0,
        veidtSeen: true,
        veidtDefeated: true,
        veidtDisintegrations: 0,
        damageTaken: 0,
        fieldNotesMask: 3,
      });
      return run;
    },
    start(id, stage = 0, carry = null) {
      const AM = DM.AfterMidnight;
      const chapter = DM.Chapters.get(id);
      if (chapter.afterMidnight) AM.run = AM.config({ hero: 'niteowl' }, chapter);
      DM.Input.clearAll();
      DM.Engine.fade.dir = 0;
      DM.Engine.fade.a = 0;
      DM.Engine.set(new DM.Scenes.Play(), { chapter: id, stage, carry });
      return DM.dev.play().chapter.id;
    },
    texts() {
      const context = DM.Engine.ctx;
      const fillText = context.fillText;
      const words = [];
      context.fillText = function (value, ...args) {
        words.push(String(value));
        return fillText.call(this, value, ...args);
      };
      try { DM.Engine.render(); }
      finally { context.fillText = fillText; }
      return words;
    },
    finish(id, options = {}) {
      this.start(id);
      const play = DM.dev.play();
      Object.assign(play.ctx.stats, {
        time: options.time ?? 1,
        spared: 4,
        disintegrated: options.unmade ?? 0,
        memories: 6,
      });
      Object.assign(play.ctx.flags, {
        repaired: true,
        calibrated: true,
        reassembled: true,
        evidence: 7,
        engineers: 7,
        passengers: 6,
        rescued: 6,
        heat: 10,
        clues: 7,
        downloaded: true,
        departed: true,
        ledger: true,
        surveyorCaptured: true,
        archiveReturned: true,
        choice: 'broadcast',
        moments: 7,
      });
      this.ruleFixture(play, options);
      play.ctx.refs.emitters = [{ dead: true }, { neutralized: true }, { dead: true }, { dead: true }];
      if (id === 'reassembly') play.player.setForm('manhattan');
      play.player.coherence = play.player.maxCoherence;
      play.completeChapter();
      this.lastCompletion = play;
      return {
        result: play.glassPalaceResult,
        screenSummary: DM.Engine.top().glassPalaceSummary,
        fragments: DM.GlassPalace.fragmentCount(),
      };
    },
  };
};

try {
  await page.addInitScript(() => {
    window.__trackingDocumentNonce = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() : performance.timeOrigin + ':' + Date.now();
    window.requestAnimationFrame = () => 0;
    window.__trackingGets = [];
    window.__trackingWrites = [];
    window.__trackingBlock = false;
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    const clear = Storage.prototype.clear;
    window.__trackingRawSet = set;
    Storage.prototype.getItem = function (key) {
      window.__trackingGets.push(String(key));
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      window.__trackingWrites.push({ method: 'setItem', key: String(key) });
      if (String(key) === 'dr-manhattan.glass-palace.v1' && window.__trackingBlock)
        throw new DOMException('Storage blocked', 'QuotaExceededError');
      return set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      window.__trackingWrites.push({ method: 'removeItem', key: String(key) });
      return remove.call(this, key);
    };
    Storage.prototype.clear = function () {
      window.__trackingWrites.push({ method: 'clear', key: null });
      return clear.call(this);
    };
    if (!get.call(localStorage, 'dr-manhattan.save')) {
      set.call(localStorage, 'dr-manhattan.save', JSON.stringify({
        version: 2,
        reached: 0,
        completed: {},
        checkpoint: null,
        checkpoints: {},
        seen: { unlocks: {} },
        totals: { spared: 0, disintegrated: 0, memories: 0, decoherences: 0 },
        settings: { focusPause: false, textSpeed: 'instant', challenge: 'normal', invulnerable: false },
      }));
      set.call(localStorage, 'dr-manhattan.bonus.v1', ' {"version":1,"completed":{},"checkpoints":{},"deaths":0} ');
      set.call(localStorage, 'dr-manhattan.after-midnight.v1', JSON.stringify({
        version: 1,
        selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
        checkpoints: {}, records: {}, deaths: 0,
      }));
    }
  });
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await wait(() => window.DM?.dev && DM.Engine.canvas && DM.GlassPalace?.liveChallenge && DM.GlassPalace.pinChallenge);
  await ev(install);
  await seedPalace();
  const original = await protectedNow();
  check('older palace saves without a tracking field load with no pin', await ev(() => DM.GlassPalace.tracking() === null));
  check('locked, unknown and mode destinations cannot be pinned', await ev(() => {
    const GP = DM.GlassPalace;
    return !GP.pinChallenge('karnak', 'swift') && !GP.pinChallenge('unknown', 'mercy') &&
      !GP.pinChallenge('am_patrol', 'mercy') && !GP.pinChallenge('prologue', 'unknown') && GP.tracking() === null;
  }));
  check('pinning a valid challenge writes only the palace slot and no fragment', await ev(() => {
    const GP = DM.GlassPalace;
    window.__trackingWrites = [];
    return GP.pinChallenge('prologue', 'swift') && GP.tracking().momentId === 'prologue' &&
      GP.tracking().challengeId === 'swift' && GP.fragmentCount() === 0 &&
      window.__trackingWrites.length === 1 && window.__trackingWrites[0].key === GP.key;
  }) && await unchanged(original));
  check('the stored selection survives model reload and callers cannot mutate its detached snapshot', await ev(() => {
    const GP = DM.GlassPalace;
    const selection = GP.tracking();
    selection.challengeId = 'detail';
    GP.data = null;
    return GP.tracking().momentId === 'prologue' && GP.tracking().challengeId === 'swift';
  }));
  check('clearing the pin is palace-local and a repeated clear performs no extra write', await ev(() => {
    const GP = DM.GlassPalace;
    GP.clearTracking();
    window.__trackingWrites = [];
    return GP.tracking() === null && GP.clearTracking() && window.__trackingWrites.length === 0;
  }) && await unchanged(original));

  await start('prologue');
  const timer = await ev(() => {
    const play = DM.dev.play();
    const GP = DM.GlassPalace;
    const target = GP.timeTargets.prologue;
    return [0, 1, target - 0.01, target, target + 1].map(time => {
      play.ctx.stats.time = time;
      const snapshot = GP.liveChallenge(play, 'swift');
      return { time, ...snapshot };
    });
  });
  snapshots.push({ label: 'timer-boundaries', rows: timer });
  check('the timer reports the actual carried time and exact target', timer.every(row =>
    row.current === row.time && row.target === 480));
  check('the strict under-target challenge remains possible before its deadline and misses at equality',
    timer[1].state === 'viable' && timer[2].state === 'viable' &&
    timer[3].state === 'missed' && timer[4].state === 'missed');
  check('a zero-time live snapshot cannot claim the finishing condition is already met', !timer[0].metNow);
  await start('superman');
  const mercy = await ev(() => {
    const play = DM.dev.play();
    return [0, 1, 4].map(unmade => {
      play.ctx.stats.disintegrated = unmade;
      play.glassPalaceRun.unmade = unmade;
      return { unmade, ...DM.GlassPalace.liveChallenge(play, 'mercy') };
    });
  });
  snapshots.push({ label: 'mercy-boundaries', rows: mercy });
  check('mercy tracks people actually unmade and becomes missed after the first',
    mercy[0].state === 'viable' && mercy[0].current === 0 &&
    mercy[1].state === 'missed' && mercy[1].current === 1 && mercy[2].state === 'missed');
  await start('prologue');
  await ev(() => {
    const play = DM.dev.play();
    Object.assign(play.ctx.stats, { time: 60, disintegrated: 0 });
    Object.assign(play.ctx.flags, { repaired: true, calibrated: true });
    T.ruleFixture(play);
  });
  const provisional = await pure();
  check('live reads consume no source-slot or palace-storage reads and perform no writes', await ev(() => {
    const GP = DM.GlassPalace;
    for (let i = 0; i < 25; i++) for (const id of ['mercy', 'swift', 'detail']) GP.liveChallenge(DM.dev.play(), id);
    return window.__trackingGets.length === 0 && window.__trackingWrites.length === 0;
  }));
  check('a provisionally ready detail challenge never grants a fragment or writes progress',
    (await live('detail')).state === 'ready' && await noWrites() &&
    await ev(before => DM.GlassPalace.fragmentCount() === before.fragments &&
      localStorage.getItem(DM.GlassPalace.key) === before.raw, provisional));
  check('fake chapter/context identities and unknown challenges are rejected', await ev(() => {
    const GP = DM.GlassPalace;
    const play = DM.dev.play();
    return GP.liveChallenge(play, 'invented') === null &&
      GP.liveChallenge({ ...play, chapter: { ...play.chapter } }, 'mercy') === null &&
      GP.liveChallenge({ ...play, ctx: { ...play.ctx, scene: {} } }, 'mercy') === null;
  }));
  check('failed and downed attempts cannot display a still-viable challenge', await ev(() => {
    const play = DM.dev.play();
    play.failed = true;
    const failed = DM.GlassPalace.liveChallenge(play, 'detail');
    play.failed = false;
    play.player.down = true;
    const downed = DM.GlassPalace.liveChallenge(play, 'swift');
    play.player.down = false;
    return failed.state === 'missed' && downed.state === 'missed';
  }));

  const boundaries = [
    ['prologue', { repaired: true, calibrated: true }, {}],
    ['reassembly', { reassembled: true }, {}],
    ['superman', {}, {}],
    ['deterrent', {}, {}],
    ['mars', {}, {}],
    ['karnak', {}, {}],
    ['last_broadcast', { evidence: 3, engineers: 7, choice: 'broadcast' }, { evidence: 7 }],
    ['ninth_minute', { passengers: 6, moments: 3 }, { moments: 7 }],
    ['long_summer', { rescued: 6, heat: 30 }, { rescued: 6, heat: 29.99 }],
    ['am_dead_air', { clues: 7, downloaded: true }, {}],
    ['am_undertow', { rescued: 4, departed: true }, {}],
    ['am_glass_archive', { ledger: true, surveyorCaptured: true, archiveReturned: true }, {}],
  ];
  for (const [id, pending, ready] of boundaries) {
    await start(id);
    const result = await ev(({ id, pending, ready }) => {
      const play = DM.dev.play();
      const GP = DM.GlassPalace;
      const run = T.ruleFixture(play);
      Object.assign(play.ctx.flags, pending);
      if (id === 'reassembly') play.player.setForm('manhattan');
      if (id === 'prologue') run.researchMask = 3;
      if (id === 'reassembly') run.passiveAtoms = 29;
      if (id === 'superman') run.badgeSeen = false;
      if (id === 'deterrent') run.behemothCoherence = 74.9;
      if (id === 'mars') play.ctx.stats.memories = 5;
      if (id === 'karnak') run.emittersDamage = 40.1;
      if (id.startsWith('am_')) run.fieldNotesMask = 1;
      const first = GP.liveChallenge(play, 'detail');
      Object.assign(play.ctx.flags, ready);
      if (id === 'prologue') run.researchMask = 7;
      if (id === 'reassembly') run.passiveAtoms = 30;
      if (id === 'superman') run.badgeSeen = true;
      if (id === 'deterrent') run.behemothCoherence = 75;
      if (id === 'mars') play.ctx.stats.memories = 6;
      if (id === 'karnak') run.emittersDamage = 40;
      if (id.startsWith('am_')) run.fieldNotesMask = 3;
      const second = GP.liveChallenge(play, 'detail');
      return { first, second };
    }, { id, pending, ready });
    snapshots.push({ label: id + '-detail-boundary', ...result });
    const firstState = ['deterrent', 'karnak'].includes(id) ? 'missed' : 'pending';
    const secondState = id === 'karnak' ? 'viable' : 'ready';
    check(id + ': a missing or missed detail is distinct from a provisionally satisfied optional condition',
      result.first.state === firstState && !result.first.metNow &&
      result.second.state === secondState && result.second.metNow && !result.second.earned &&
      !!result.first.reason && !!result.second.reason && !!result.second.progress);
  }
  await start('long_summer');
  check('City Heat can become eligible again after cooling rather than being called permanently missed', await ev(() => {
    const play = DM.dev.play();
    play.ctx.flags.rescued = 6;
    play.ctx.flags.heat = 55;
    const hot = DM.GlassPalace.liveChallenge(play, 'detail');
    play.ctx.flags.heat = 20;
    const cool = DM.GlassPalace.liveChallenge(play, 'detail');
    return hot.state === 'pending' && cool.state === 'ready';
  }));
  await start('karnak');
  check('mandatory emitter shutdown cannot invent missing or incomplete optional-segment evidence', await ev(() => {
    const play = DM.dev.play();
    const run = T.ruleFixture(play);
    play.ctx.refs.emitters = [{ dead: true }, { dead: true }, { dead: true }, { dead: true }];
    run.emittersSeen = false;
    run.emittersComplete = false;
    const empty = DM.GlassPalace.liveChallenge(play, 'detail');
    run.emittersSeen = true;
    const truncated = DM.GlassPalace.liveChallenge(play, 'detail');
    return !empty.metNow && empty.state === 'pending' && !truncated.metNow && truncated.state === 'viable';
  }));
  for (const id of ['am_patrol', 'am_rescue_clock']) {
    await start(id);
    check(id + ': replay modes do not claim canonical moment challenges', await ev(() =>
      DM.GlassPalace.liveChallenge(DM.dev.play(), 'mercy') === null));
  }

  await seedPalace();
  await ev(() => {
    const hub = new DM.Scenes.GlassPalace();
    DM.Engine.set(hub);
    DM.Engine.push(new DM.GlassPalace.MomentMenu(hub, DM.GlassPalace.find('prologue')));
    T.step(0.1);
  });
  const paneBefore = await protectedNow();
  await action('CHALLENGES');
  check('the actual pane action opens three selectable challenge rows', await ev(() => {
    const panel = DM.Engine.top();
    return panel instanceof DM.GlassPalace.ChallengesPanel && panel.rows.length === 3 &&
      panel.menu.items.filter(item => item.challengeId).length === 3;
  }));
  check('challenge actions and return controls stay inside the readable panel', await ev(() => {
    const panel = DM.Engine.top();
    return panel.menu.size >= 13 && panel.menu.items.every((item, index) => {
      const rect = panel.menu.rowRect(index);
      return rect.x >= 72 && rect.x + rect.w <= 1208 && rect.y >= 170 && rect.y + rect.h <= 652;
    });
  }));
  await key('ArrowDown');
  await key('Enter');
  check('keyboard selection pins the time challenge from the actual pane screen', await ev(() =>
    DM.GlassPalace.tracking()?.momentId === 'prologue' && DM.GlassPalace.tracking()?.challengeId === 'swift'));
  check('the chosen row exposes a working Stop Tracking action', await ev(() =>
    DM.Engine.top().menu.items.find(item => item.challengeId === 'swift').label === 'STOP TRACKING'));
  await challengeAction('swift');
  check('mouse Stop Tracking clears the selected challenge', await ev(() => DM.GlassPalace.tracking() === null));
  await challengeAction('swift');
  check('pane pinning and clearing preserve other progress and award no fragment',
    await unchanged(paneBefore) && await ev(() => DM.GlassPalace.fragmentCount() === 0));
  await action('RETURN TO THE MOMENT');
  await key('Escape');

  const carry = {
    stats: { time: 120, spared: 1, disintegrated: 0, memories: 0 },
    found: [], flags: {},
  };
  await start('prologue');
  await ev(carry => {
    const play = DM.dev.play();
    Object.assign(play.ctx.stats, carry.stats);
    DM.GlassPalace.saveRunCheckpoint(play, 1, carry);
  }, carry);
  await start('prologue', 1, carry);
  check('normal level entry attaches a matching pin and reads the carried clock immediately', await ev(() => {
    const controller = DM.dev.play().glassPalaceTracking;
    return controller?.momentId === 'prologue' && controller.challengeId === 'swift' &&
      controller.snapshot.current === 120 && controller.snapshot.target === 480;
  }));
  // Instant map construction still yields one script frame before the stage's
  // normal checkpoint write. Complete that lifecycle before measuring HUD work.
  await ev(() => T.step(0.05));
  check('the resumed stage establishes its real checkpoint before the read-only sampling baseline', await ev(() =>
    DM.dev.play().ctx.checkpoint === 1));
  const controllerBefore = await protectedNow();
  const sampling = await ev(() => {
    const GP = DM.GlassPalace;
    const originalLive = GP.liveChallenge;
    const originalFind = GP.find;
    const originalStatus = GP.status;
    let liveCalls = 0;
    let sourceCalls = 0;
    GP.liveChallenge = function (...args) { liveCalls++; return originalLive.apply(this, args); };
    GP.find = function (...args) { sourceCalls++; return originalFind.apply(this, args); };
    GP.status = function (...args) { sourceCalls++; return originalStatus.apply(this, args); };
    window.__trackingGets = [];
    window.__trackingWrites = [];
    try { T.step(1); }
    finally { GP.liveChallenge = originalLive; GP.find = originalFind; GP.status = originalStatus; }
    const play = DM.dev.play();
    return { liveCalls, sourceCalls, gets: window.__trackingGets, writes: window.__trackingWrites,
      current: play.glassPalaceTracking.snapshot.current, time: play.ctx.stats.time };
  });
  snapshots.push({ label: 'bounded-controller-sampling', ...sampling });
  check('the tracked HUD samples at a bounded rate without reading progress slots every frame',
    sampling.liveCalls >= 3 && sampling.liveCalls <= 5 && sampling.sourceCalls === 0 && sampling.gets.length === 0 &&
    sampling.writes.length === 0 && sampling.current > 120 && sampling.current <= sampling.time &&
    await unchanged(controllerBefore));
  check('ordinary HUD drawing explains tracked progress without claiming an earned fragment', await ev(() => {
    const play = DM.dev.play();
    play.dialog.close();
    play.hud.clearTransient();
    play.hud.cineK = 0;
    const words = T.texts();
    return words.includes('TRACKED MOMENT CHALLENGE') &&
      words.some(word => word.includes('FINISH TO CLAIM')) && DM.GlassPalace.fragmentCount() === 0;
  }));
  check('an overlapping interaction prompt takes priority over the optional tracker', await ev(() => {
    const play = DM.dev.play();
    const old = play.player.interactTarget;
    const point = play.world.camera.toWorld(170, 200);
    play.player.interactTarget = {
      x: point.x, y: point.y + 43, r: 13, interact: { label: 'CONTROLLED NEARBY INTERACTION' },
    };
    const words = T.texts();
    play.player.interactTarget = old;
    return words.includes('CONTROLLED NEARBY INTERACTION') && !words.includes('TRACKED MOMENT CHALLENGE');
  }));
  check('a prompt elsewhere on screen keeps both the interaction and tracker readable', await ev(() => {
    const play = DM.dev.play();
    const old = play.player.interactTarget;
    const point = play.world.camera.toWorld(900, 400);
    play.player.interactTarget = {
      x: point.x, y: point.y + 43, r: 13, interact: { label: 'CONTROLLED DISTANT INTERACTION' },
    };
    const words = T.texts();
    play.player.interactTarget = old;
    return words.includes('CONTROLLED DISTANT INTERACTION') && words.includes('TRACKED MOMENT CHALLENGE');
  }));
  check('dialogue and captions hide the optional tracker to keep their existing space clear', await ev(() => {
    const play = DM.dev.play();
    play.dialog.open([['jon', 'A controlled dialogue fixture.']]);
    const dialogueHidden = !T.texts().includes('TRACKED MOMENT CHALLENGE');
    play.dialog.close();
    play.hud.caption('A controlled caption fixture.', { dur: 5 });
    const captionHidden = !T.texts().includes('TRACKED MOMENT CHALLENGE');
    play.hud.clearTransient();
    return dialogueHidden && captionHidden;
  }));
  await key('Escape');
  check('Pause preserves its existing actions and exposes Moment Challenges', await ev(() => {
    const pause = DM.Engine.top();
    return pause instanceof DM.Scenes.Pause &&
      JSON.stringify(pause.menu.items.slice(0, 5).map(item => item.label)) === JSON.stringify([
        'RESUME', 'RESTART FROM CHECKPOINT', 'SETTINGS', 'CONTROLS', 'QUIT TO TITLE',
      ]) && pause.menu.items.some(item => item.label === 'MOMENT CHALLENGES');
  }));
  check('pausing freezes both the actual field timer and the tracker samples', await ev(() => {
    const play = DM.dev.play();
    const before = { time: play.ctx.stats.time, updates: play.glassPalaceTracking.updates };
    T.step(2);
    return play.ctx.stats.time === before.time && play.glassPalaceTracking.updates === before.updates;
  }));
  await action('MOMENT CHALLENGES');
  check('the pause challenge panel shows all three current attempt snapshots', await ev(() => {
    const panel = DM.Engine.top();
    const play = DM.dev.play();
    return panel instanceof DM.GlassPalace.TrackingPanel && panel.play === play && panel.rows.length === 3 &&
      panel.rows.every(row => row.live?.momentId === 'prologue') &&
      panel.rows.find(row => row.id === 'swift').live.current === play.ctx.stats.time;
  }));
  await challengeAction('mercy');
  check('choosing another challenge while paused replaces the live controller', await ev(() => {
    const controller = DM.dev.play().glassPalaceTracking;
    return DM.GlassPalace.tracking().challengeId === 'mercy' && controller.challengeId === 'mercy' &&
      controller.snapshot.state === 'pending';
  }));
  await action('CLEAR TRACKED CHALLENGE');
  check('clearing tracking restores the original HUD methods on that play instance', await ev(() => {
    const play = DM.dev.play();
    return play.glassPalaceTracking === null && play.hud.update === DM.HUD.prototype.update &&
      play.hud.render === DM.HUD.prototype.render;
  }));
  await action('RETURN TO PAUSE');
  check('the named return action leaves gameplay paused until Resume', await ev(() => DM.Engine.top() instanceof DM.Scenes.Pause));
  await action('RESUME');
  check('an unpinned play frame calls no live challenge reader and keeps normal HUD behavior', await ev(() => {
    const GP = DM.GlassPalace;
    const original = GP.liveChallenge;
    let calls = 0;
    GP.liveChallenge = function (...args) { calls++; return original.apply(this, args); };
    window.__trackingGets = [];
    window.__trackingWrites = [];
    try { T.step(0.5); }
    finally { GP.liveChallenge = original; }
    const play = DM.dev.play();
    return calls === 0 && window.__trackingGets.length === 0 && window.__trackingWrites.length === 0 &&
      play.glassPalaceTracking === null && play.hud.update === DM.HUD.prototype.update &&
      play.hud.render === DM.HUD.prototype.render;
  }));
  check('reading, pausing and changing tracked challenges preserve all non-palace progress', await unchanged(controllerBefore));

  await ev(() => {
    const GP = DM.GlassPalace;
    const play = DM.dev.play();
    GP.pinChallenge('prologue', 'mercy');
    GP.attachTracking(play);
    play.glassPalaceRun.photoSeen = true;
    play.ctx.checkpoint = 0;
    play.ctx.checkpointCarry = {
      stats: { time: 75, spared: 1, disintegrated: 0, memories: 0 }, found: [], flags: {},
    };
    play.ctx.stats.time = 400;
    play.ctx.stats.disintegrated = 3;
    window.__trackingPriorContext = play.ctx;
    play.retry();
    T.step(1.2);
  });
  check('actual Retry keeps observed optional evidence while restoring the base checkpoint carry', await ev(() => {
    const play = DM.dev.play();
    return play.ctx !== window.__trackingPriorContext && play.ctx.stats.time >= 75 && play.ctx.stats.time < 77 &&
      play.ctx.stats.disintegrated === 0 && play.glassPalaceTracking?.challengeId === 'mercy' &&
      play.glassPalaceRun.photoSeen === true && play.glassPalaceTracking.snapshot.state === 'ready';
  }));
  await start('last_broadcast');
  check('a pin for another moment stays saved without attaching extra work to this level', await ev(() => {
    const play = DM.dev.play();
    return DM.GlassPalace.tracking().momentId === 'prologue' && play.glassPalaceTracking === null &&
      play.hud.update === DM.HUD.prototype.update && play.hud.render === DM.HUD.prototype.render;
  }));
  await ev(() => DM.GlassPalace.pinChallenge('am_dead_air', 'detail'));
  await start('am_dead_air');
  check('After Midnight story entry attaches the selected case challenge to the real human hero', await ev(() => {
    const play = DM.dev.play();
    return play.player.profile.id === 'niteowl' && play.glassPalaceTracking?.momentId === 'am_dead_air' &&
      play.glassPalaceTracking.challengeId === 'detail';
  }));
  await start('am_patrol');
  check('After Midnight replay modes never attach a story-case tracker', await ev(() =>
    DM.dev.play().glassPalaceTracking === null));

  await seedPalace();
  const first = await ev(() => T.finish('prologue', { mercy: false, detail: false }));
  completionResults.push(first);
  check('the real completion hook awards only fulfilled challenges and gives three frozen outcome rows',
    first.fragments === 1 && first.result.breakdown.length === 3 &&
    first.result.breakdown.find(row => row.id === 'swift').outcome === 'new' &&
    first.result.breakdown.filter(row => row.outcome === 'missed').length === 2);
  check('actual completion screens receive the same authoritative breakdown',
    JSON.stringify(first.result) === JSON.stringify(first.screenSummary));
  await ev(() => {
    window.__trackingResultScreen = DM.Engine.top();
    T.step(1.2);
  });
  await key('h');
  check('real H opens completion details with new and missed outcomes', await ev(() => {
    const panel = DM.Engine.top();
    const words = T.texts();
    return panel instanceof DM.GlassPalace.TrackingPanel && panel.result === T.lastCompletion.glassPalaceResult &&
      panel.rows.every(row => row.result) && words.some(word => word.includes('NEW FRAGMENT')) &&
      words.some(word => word.includes('MISSED THIS RUN'));
  }));
  await action('RETURN TO RESULTS');
  check('completion details return to the same result without advancing the chapter', await ev(() =>
    DM.Engine.top() === window.__trackingResultScreen && DM.dev.play().chapter.id === 'prologue'));
  const detailsRect = await ev(() => DM.Engine.top().glassPalaceDetailsRect);
  await page.mouse.click(detailsRect.x + detailsRect.w / 2, detailsRect.y + detailsRect.h / 2);
  await ev(() => T.step(0.1));
  check('the result Details click is consumed before the underlying generic Continue action', await ev(() =>
    DM.Engine.top() instanceof DM.GlassPalace.TrackingPanel &&
    DM.Engine.stack.includes(window.__trackingResultScreen) && DM.Engine.fade.dir === 0));
  await key('Escape');
  check('Escape from result details returns to the result screen', await ev(() =>
    DM.Engine.top() === window.__trackingResultScreen));
  check('completion reasons remain frozen if live state changes afterward', await ev(() => {
    const play = T.lastCompletion;
    const before = JSON.stringify(play.glassPalaceResult.breakdown);
    play.ctx.stats.time = 0;
    play.ctx.stats.disintegrated = 0;
    play.ctx.flags.repaired = true;
    play.ctx.flags.calibrated = true;
    return JSON.stringify(play.glassPalaceResult.breakdown) === before;
  }));
  const second = await ev(() => T.finish('prologue'));
  completionResults.push(second);
  check('later actual completion distinguishes two new fragments from the previously earned one',
    second.fragments === 3 && second.result.breakdown.filter(row => row.outcome === 'new').length === 2 &&
    second.result.breakdown.find(row => row.id === 'swift').outcome === 'already');
  const third = await ev(() => T.finish('prologue', { time: 600, mercy: false, detail: false }));
  completionResults.push(third);
  check('already earned fragments remain distinct from a later attempt that misses their conditions',
    third.fragments === 3 && third.result.breakdown.every(row => row.outcome === 'already' && row.passed === false));
  check('repeated completion observation cannot duplicate fragments or invent newly earned rows', await ev(() => {
    const GP = DM.GlassPalace;
    const count = GP.fragmentCount();
    window.__trackingWrites = [];
    const result = GP.observeCompletion(T.lastCompletion);
    return GP.fragmentCount() === count && result.newlyEarned.length === 0 && window.__trackingWrites.length === 0;
  }));
  await start('prologue');
  check('a prior award is reported separately from the current attempt’s failed condition', await ev(() => {
    const play = DM.dev.play();
    play.ctx.stats.time = 600;
    const value = DM.GlassPalace.liveChallenge(play, 'swift');
    return value.earned === true && value.state === 'missed' && value.metNow === false;
  }));
  check('an already recovered fragment is labelled honestly without promising another reward', await ev(() => {
    const GP = DM.GlassPalace;
    const play = DM.dev.play();
    const before = GP.fragmentCount();
    GP.pinChallenge('prologue', 'swift');
    GP.attachTracking(play);
    play.dialog.close();
    play.hud.clearTransient();
    play.hud.cineK = 0;
    play.player.interactTarget = null;
    const words = T.texts();
    return words.includes('FRAGMENT ALREADY RECOVERED') &&
      !words.some(word => word.includes('FINISH TO CLAIM')) && GP.fragmentCount() === before;
  }));

  await seedPalace();
  await ev(() => T.reach(0));
  await ev(() => DM.GlassPalace.pinChallenge('prologue', 'mercy'));
  const portabilityBefore = await protectedNow();
  check('palace backup round-trips the selected challenge', await ev(() => {
    const GP = DM.GlassPalace;
    const decoded = GP.Backup.decode(GP.Backup.encode());
    return decoded.data.tracking.momentId === 'prologue' && decoded.data.tracking.challengeId === 'mercy';
  }) && await unchanged(portabilityBefore));
  check('an older palace backup clears the pin without altering earned fragments or other slots', await ev(() => {
    const GP = DM.GlassPalace;
    const text = JSON.stringify({
      format: 'dr-manhattan.glass-palace.backup', version: 1,
      data: { version: 1, challenges: { prologue: { swift: true } }, epilogueSeen: {}, visits: 2 },
    });
    GP.Backup.restore(text);
    return GP.tracking() === null && GP.fragmentCount() === 1;
  }) && await unchanged(portabilityBefore));
  check('portable pins for a currently locked canonical moment never unlock the level', await ev(() => {
    const GP = DM.GlassPalace;
    const data = { ...GP.load(), tracking: { momentId: 'karnak', challengeId: 'detail' } };
    const text = JSON.stringify({ format: 'dr-manhattan.glass-palace.backup', version: 1, data });
    GP.Backup.restore(text);
    return GP.tracking().momentId === 'karnak' && GP.find('karnak').unlocked === false;
  }));
  const invalidPins = [[], {}, { momentId: 'prologue' }, { challengeId: 'mercy' },
    { momentId: 'invented', challengeId: 'mercy' }, { momentId: 'prologue', challengeId: 'invented' },
    { momentId: 'prologue', challengeId: 'mercy', sourceSlots: {} }];
  for (let index = 0; index < invalidPins.length; index++) {
    check('malformed portable pin ' + (index + 1) + ' is rejected without writes', await ev(tracking => {
      const GP = DM.GlassPalace;
      window.__trackingWrites = [];
      const data = { ...GP.load(), tracking };
      let rejected = false;
      try {
        GP.Backup.decode(JSON.stringify({ format: 'dr-manhattan.glass-palace.backup', version: 1, data }));
      } catch (_) { rejected = true; }
      return rejected && window.__trackingWrites.length === 0;
    }, invalidPins[index]));
  }

  await seedPalace();
  const storageBefore = await protectedNow();
  check('blocked persistence retains an accepted session pin and warns without changing stored bytes', await ev(() => {
    const GP = DM.GlassPalace;
    const before = localStorage.getItem(GP.key);
    window.__trackingBlock = true;
    const accepted = GP.pinChallenge('prologue', 'detail');
    return accepted && GP.tracking().challengeId === 'detail' && !GP.available && !!GP.warning &&
      localStorage.getItem(GP.key) === before && GP.Backup.decode(GP.Backup.encode()).data.tracking.challengeId === 'detail';
  }) && await unchanged(storageBefore));
  await ev(() => { window.__trackingBlock = false; });
  for (const raw of ['{unreadable', '{"version":99,"future":"preserve"}']) {
    check('protected palace progress allows session tracking without overwriting its original bytes', await ev(raw => {
      const GP = DM.GlassPalace;
      window.__trackingRawSet.call(localStorage, GP.key, raw);
      GP.data = null;
      GP.readOnly = false;
      GP.available = true;
      GP.warning = '';
      GP.load();
      const accepted = GP.pinChallenge('prologue', 'swift');
      return accepted && GP.readOnly && !GP.available && GP.tracking().challengeId === 'swift' &&
        localStorage.getItem(GP.key) === raw && !!GP.warning;
    }, raw));
  }
  check('tracking storage failures never change campaign, bonus, After Midnight or settings bytes',
    await unchanged(storageBefore));
  await seedPalace();
  reloadDiagnostics.before = await ev(reloadState, true);
  reloadDiagnostics.accepted = reloadDiagnostics.before.accepted;
  check('the final reload fixture pin is accepted and persisted before navigation',
    reloadDiagnostics.accepted === true && reloadDiagnostics.before.available === true &&
    reloadDiagnostics.before.readOnly === false && reloadDiagnostics.before.blocked === false &&
    reloadDiagnostics.before.parsed?.tracking?.momentId === 'prologue' &&
    reloadDiagnostics.before.parsed?.tracking?.challengeId === 'swift');
  const reloadBefore = await protectedNow();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(previousNonce => window.__trackingDocumentNonce !== previousNonce &&
    window.DM?.dev && DM.GlassPalace?.tracking, reloadDiagnostics.before.documentNonce, { polling: 100 });
  reloadDiagnostics.afterBoot = await ev(reloadState);
  check('reload reaches a different fully booted document', reloadDiagnostics.afterBoot.booted &&
    reloadDiagnostics.afterBoot.documentNonce !== reloadDiagnostics.before.documentNonce);
  await ev(install);
  reloadDiagnostics.afterInstall = await ev(reloadState);
  check('reload retains the exact stored palace packet before its lazy model read',
    reloadDiagnostics.afterInstall.raw === reloadDiagnostics.before.raw);
  check('the selected challenge survives an actual page reload', await ev(() =>
    DM.GlassPalace.tracking()?.momentId === 'prologue' && DM.GlassPalace.tracking()?.challengeId === 'swift'));
  reloadDiagnostics.afterRead = await ev(reloadState);
  check('reload and tracked selection retain all protected progress and settings', await unchanged(reloadBefore));
  check('tracking checks produce no browser or engine error', errors.length === 0 && await ev(() => !DM.Engine.error));
  const finalLine = `GLASS PALACE TRACKING PASSED: ${checks.length} checks (${engine}, ${target}).`;
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({
    target, engine, browser: browser.version(), checks, errors, snapshots, completionResults,
    reloadDiagnostics, finalLine, exitCode: 0,
    method: 'Controlled canonical level/stat/flag fixtures, actual Play/completion/backup methods and real UI keys/mouse; stepped engine.',
    limits: 'This proves state and integration contracts, not natural full-level challenge balance. No diagnostic image is live evidence.',
  }, null, 2));
  console.log(finalLine);
} catch (error) {
  reloadDiagnostics.onFailure = await ev(reloadState).catch(error => ({ diagnosticError: String(error) }));
  await page.screenshot({ path: path.join(out, 'failure-diagnostic.png') });
  writeFileSync(path.join(out, 'failure.json'), JSON.stringify({
    target, engine, checks, errors, snapshots, completionResults, reloadDiagnostics,
    error: String(error.stack || error), exitCode: 1,
  }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
