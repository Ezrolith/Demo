/*
 * Progress & robustness test: broken saves and a stalled font host still boot
 * to the title; stats survive Retry and Continue; checkpoints never go
 * backwards; unlock cards show once; focus loss pauses; held keys survive
 * fades; cutscenes clear hostile fire; 'play:begin' and persistFlags work.
 *
 *   node tests/saves.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || path.join(root, 'index.html');
const out = path.join(root, 'tests', 'out');
mkdirSync(out, { recursive: true });
const KEY = 'dr-manhattan.save';

const browser = await playwright.chromium.launch();
const errors = [];
// ONLY=3,5 node tests/saves.mjs runs just those sections.
const want = (n) => !process.env.ONLY || process.env.ONLY.split(',').includes(String(n));
let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

// A fresh browser context (its own localStorage). `seed` is written to the save
// slot once, before the game's scripts run; `init` runs before every load.
async function open({ seed, dev = true, init, initArg, route } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  if (seed !== undefined) {
    await page.addInitScript(([k, raw]) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem(k, raw);
    }, [KEY, seed]);
  }
  if (init) await page.addInitScript(init, initArg);
  if (route) await route(page);
  const url = pathToFileURL(target).href + (dev ? '?dev' : '');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const state = () => ev(() => window.DM.dev.state());
  const boot = async () => {
    await page.waitForFunction(() => window.DM && window.DM.dev && window.DM.Engine.stack.length > 0, null, { timeout: 10000 });
  };
  await page.goto(url);
  await boot();
  // Wait until fn() (evaluated in page) is truthy, pressing E through dialogue and unlock cards.
  async function until(label, fn, { timeout = 20000, talk = true, arg } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const s = await state();
      if (s.error) throw new Error(`${label}: ${s.error}`);
      if (await ev(fn, arg)) return true;
      if (talk && (s.dialog || s.scene === 'PowerUnlock')) await page.keyboard.press('e');
      await wait(150);
    }
    throw new Error(`timed out waiting for: ${label}  (${JSON.stringify(await state())})`);
  }
  const gate = async () => {
    await page.mouse.click(640, 360);
    await wait(300);
  };
  const menu = () => ev(() => {
    const t = window.DM.Engine.top();
    return t.menu ? t.menu.items.map((i) => ({ label: i.label, sub: i.sub || '' })) : null;
  });
  return { context, page, ev, wait, state, until, gate, menu, boot, close: () => context.close() };
}

// ---- 1. Broken saves boot to the title ----------------------------------------------
const payloads = [
  ['settings: null', '{"version":1,"settings":null}'],
  ['completed: null', '{"version":1,"completed":null}'],
  ['unknown checkpoint chapter', '{"version":1,"checkpoint":{"chapter":"nope","stage":3}}'],
  ['newer version, string reached', '{"version":7,"reached":"3"}'],
  ['out-of-range checkpoint stage', '{"version":1,"reached":2,"checkpoint":{"chapter":"superman","stage":12}}'],
  ['unparseable JSON', '{"version":1,"reached":'],
  ['not an object', '[1,2,3]'],
];
if (want(1)) for (const [name, raw] of payloads) {
  const errBefore = errors.length;
  const g = await open({ seed: raw, dev: false });
  const st = await g.ev(() => ({
    top: window.DM.Engine.top().constructor.name,
    bootDiv: !!document.getElementById('boot'),
    err: window.DM.Engine.error && String(window.DM.Engine.error),
    music: window.DM.Save.settings && window.DM.Save.settings.music,
    reached: window.DM.Save.data.reached,
    readOnly: window.DM.Save.readOnly,
    available: window.DM.Save.available,
    corrupt: localStorage.getItem('dr-manhattan.save.corrupt'),
  }));
  await g.gate();
  await g.page.keyboard.press('Enter'); // first menu item: CONTINUE when offered, else NEW GAME
  await g.wait(1400);
  const after = await g.ev(() => ({ top: window.DM.Engine.top().constructor.name, err: window.DM.Engine.error && String(window.DM.Engine.error) }));
  const ok = st.top === 'Title' && !st.bootDiv && !st.err && !after.err && errors.length === errBefore && typeof st.music === 'number';
  assert(`bad save (${name}) boots to the title and its first menu item works`, ok, `then ${after.top}${after.err ? ' ERROR ' + after.err : ''}`);
  if (name.startsWith('newer')) {
    await g.ev(() => window.DM.Save.write());
    const kept = await g.ev((k) => JSON.parse(localStorage.getItem(k)).version, KEY);
    assert('a save from a newer version is read-only (never down-converted)', st.readOnly && kept === 7 && st.reached === 3, `readOnly ${st.readOnly}, stored version ${kept}, reached ${st.reached}`);
  }
  if (name.startsWith('unparseable')) {
    assert('an unreadable save is kept as .corrupt and storage stays available', st.corrupt === raw && st.available === true);
  }
  if (name.startsWith('out-of-range')) {
    assert('a stale checkpoint is dropped: Continue starts the furthest chapter instead of crashing', after.top === 'Interlude' && !after.err, after.top);
  }
  await g.close();
}

// ---- 2. A stalled font host does not delay boot -------------------------------------
if (want(2)) {
  const t0 = Date.now();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', async (r) => {
    await new Promise((res) => setTimeout(res, 12000));
    r.abort().catch(() => {});
  });
  await page.goto(pathToFileURL(target).href, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.DM && window.DM.Engine && window.DM.Engine.stack.length > 0, null, { timeout: 30000 });
  const ms = Date.now() - t0;
  assert('with the font host stalled for 12 s the title appears in under 3 s', ms < 3000, `${ms} ms`);
  const cleared = await page.evaluate(() => {
    let n = 0;
    const orig = window.DM.Gfx.clearTextCache;
    window.DM.Gfx.clearTextCache = () => {
      n++;
      orig();
    };
    document.fonts.dispatchEvent(new Event('loadingdone'));
    window.DM.Gfx.clearTextCache = orig;
    return n;
  });
  assert('late web fonts clear the wrapped-text cache', cleared === 1);
  await context.close();
}

// ---- 3. Stats survive Retry and Continue (bugs repro1) --------------------------------
if (want(3)) {
  const g = await open();
  await g.gate();
  await g.ev(() => window.DM.dev.start('superman', 1));
  await g.until('yard ready', () => {
    const p = window.DM.dev.play();
    return p.ctx.stageIndex === 1 && !p.player.locked;
  });
  await g.ev(() => {
    const DM = window.DM;
    const play = DM.dev.play();
    for (const e of play.world.entities) if (e instanceof DM.Enemies.Gangster) e.disintegrate(play.world, play.player);
  });
  await g.until('warehouse checkpoint', () => window.DM.dev.play().ctx.stageIndex === 2);
  const before = await g.ev(() => window.DM.dev.play().ctx.stats.disintegrated);
  await g.ev(() => window.DM.dev.play().retry());
  await g.wait(1400);
  const after = await g.ev(() => ({ stage: window.DM.dev.play().ctx.stageIndex, d: window.DM.dev.play().ctx.stats.disintegrated }));
  assert('4 yard kills are still counted after a retry at the warehouse', before === 4 && after.d === 4 && after.stage === 2, `before ${before}, after ${JSON.stringify(after)}`);

  // A kill in the failed attempt is discarded on retry.
  await g.until('warehouse gangsters', () => window.DM.dev.play().world.entities.some((e) => e instanceof window.DM.Enemies.Gangster && !e.dead && !e.ko));
  await g.ev(() => {
    const DM = window.DM;
    const play = DM.dev.play();
    const e = play.world.entities.find((x) => x instanceof DM.Enemies.Gangster && !x.dead && !x.ko);
    if (e) e.disintegrate(play.world, play.player);
  });
  await g.wait(200);
  await g.ev(() => window.DM.dev.play().retry());
  await g.wait(1400);
  const again = await g.ev(() => window.DM.dev.play().ctx.stats.disintegrated);
  assert('kills from the failed attempt are discarded by the retry', again === 4, String(again));

  await g.page.reload();
  await g.boot();
  await g.gate();
  const items = await g.menu();
  assert('Continue names its destination', /^CONTINUE\s+·\s+CHAPTER II$/.test(items[0].label) && /Warehouse/.test(items[0].sub), `${items[0].label} / ${items[0].sub}`);
  await g.page.screenshot({ path: path.join(out, 'saves-title-continue.png') });
  await g.page.keyboard.press('Enter');
  await g.until('continued', () => window.DM.dev.play() && window.DM.dev.play().ctx.stageIndex === 2);
  const cont = await g.ev(() => window.DM.dev.play().ctx.stats.disintegrated);
  assert('the kills are still counted after a page reload and CONTINUE', cont === 4, String(cont));

  // ---- Mars: memories found before a checkpoint stay found -----------------------------
  await g.ev(() => window.DM.dev.start('mars', 1));
  await g.until('palace ready', () => {
    const p = window.DM.dev.play();
    return p.ctx.stageIndex === 1 && !p.player.locked && window.DM.Engine.top() === p;
  });
  const years = await g.ev(() => {
    const DM = window.DM;
    const play = DM.dev.play();
    const W = play.world;
    const mems = W.entities.filter((e) => e instanceof DM.Special.Memory).slice(0, 2);
    for (const m of mems) {
      play.player.x = m.x;
      play.player.y = m.y;
      W.timesight = true;
      m.update(0, W);
    }
    W.timesight = false;
    return mems.map((m) => m.year);
  });
  await g.ev(() => window.DM.dev.skip());
  await g.until('great checkpoint', () => window.DM.dev.play().ctx.stageIndex === 2);
  await g.ev(() => window.DM.dev.play().retry());
  await g.wait(1400);
  const mars = await g.ev((ys) => {
    const DM = window.DM;
    const play = DM.dev.play();
    const left = play.world.entities.filter((e) => e instanceof DM.Special.Memory).map((m) => m.year);
    return { stage: play.ctx.stageIndex, memories: play.ctx.stats.memories, left: left.length, respawned: ys.filter((y) => left.includes(y)).length };
  }, years);
  assert('a Mars retry at "great" keeps 2/6 memories and they do not respawn', mars.stage === 2 && mars.memories === 2 && mars.left === 4 && mars.respawned === 0, JSON.stringify(mars));
  await g.close();
}

// ---- 4. Checkpoints never go backwards; Continue / New Game / Chapter Select ----------
if (want(4)) {
  // A version-1 save at Karnak's Veidt fight.
  const v1 = JSON.stringify({ version: 1, reached: 5, checkpoint: { chapter: 'karnak', stage: 2 }, completed: { prologue: { time: 300, disintegrated: 0, spared: 0, memories: 0 } }, totals: { disintegrated: 3, spared: 9, decoherences: 2, memories: 4 }, settings: { music: 0.4, sfx: 0.5, shake: 1, hints: true } });
  const g = await open({ seed: v1, dev: false });
  const mig = await g.ev(() => {
    const d = window.DM.Save.data;
    return { version: d.version, cp: d.checkpoint, cps: d.checkpoints, seen: Object.keys(d.seen.unlocks).sort(), music: d.settings.music, totals: d.totals };
  });
  assert('a v1 save migrates to v2 cleanly', mig.version === 2 && mig.cp.chapter === 'karnak' && mig.cp.stage === 2 && mig.cps.karnak && mig.cps.karnak.stage === 2 && mig.music === 0.4 && mig.totals.spared === 9, JSON.stringify(mig));
  assert('migration marks the powers of finished chapters as seen', ['coalesce', 'disintegrate', 'duplicate', 'expand', 'telekinesis', 'teleport', 'timesight'].every((p) => mig.seen.includes(p)), mig.seen.join(','));
  await g.gate();
  let items = await g.menu();
  assert('Continue reads "CONTINUE · CHAPTER V" with its stage', /CHAPTER V$/.test(items[0].label) && /Karnak/.test(items[0].sub) && /Veidt/.test(items[0].sub), `${items[0].label} / ${items[0].sub}`);

  // Replay the Prologue from Chapter Select.
  await g.ev(() => window.DM.Engine.top().menu.items.find((i) => i.label === 'CHAPTERS').action());
  await g.wait(300);
  await g.ev(() => window.DM.Engine.top().pick(0));
  await g.until('prologue interlude', () => window.DM.Engine.top().constructor.name === 'Interlude', { talk: false });
  await g.wait(900);
  await g.page.keyboard.press('Space'); // reveal the narration
  await g.wait(200);
  await g.page.keyboard.press('Space'); // begin
  await g.until('prologue playing', () => window.DM.dev.play() && window.DM.dev.play().chapter.id === 'prologue', { talk: false });
  await g.wait(1500);
  let cp = await g.ev(() => window.DM.Save.data.checkpoint);
  assert('replaying the Prologue leaves the Karnak checkpoint unchanged', cp.chapter === 'karnak' && cp.stage === 2, JSON.stringify(cp));
  await g.ev(() => window.DM.dev.start('prologue', 3));
  await g.wait(800);
  cp = await g.ev(() => ({ cp: window.DM.Save.data.checkpoint, pro: window.DM.Save.data.checkpoints.prologue }));
  assert('a replayed chapter records its own resume point without moving Continue', cp.cp.chapter === 'karnak' && cp.pro && cp.pro.stage === 3, JSON.stringify(cp));
  await g.ev(() => window.DM.dev.play().completeChapter());
  cp = await g.ev(() => ({ cp: window.DM.Save.data.checkpoint, pro: window.DM.Save.data.checkpoints.prologue }));
  assert('finishing a replayed chapter does not move Continue back', cp.cp.chapter === 'karnak' && cp.cp.stage === 2 && !cp.pro, JSON.stringify(cp));

  // Chapter Select: a visible Back button and Resume on cards with a mid-chapter checkpoint.
  await g.ev(() => window.DM.Engine.set(new window.DM.Scenes.Title()));
  await g.wait(200);
  await g.ev(() => window.DM.Engine.top().menu.items.find((i) => i.label === 'CHAPTERS').action());
  await g.wait(400);
  await g.page.mouse.move(700, 300);
  await g.page.mouse.move(1130, 556);
  await g.wait(150);
  await g.page.screenshot({ path: path.join(out, 'saves-chapter-select.png') });
  const cs = await g.ev(() => {
    const s = window.DM.Engine.top();
    return { resume: s.cards.map((c) => (c.resume ? c.resume.stage : null)), sel: s.sel, sub: s.sub, back: s.backRect };
  });
  assert('the Karnak card offers RESUME at its checkpoint', cs.resume[5] === 2 && cs.resume.filter((r) => r != null).length === 1 && cs.sel === 5 && cs.sub === 1, JSON.stringify(cs));
  await g.page.mouse.click(cs.back.x + cs.back.w / 2, cs.back.y + cs.back.h / 2);
  await g.wait(300);
  assert('the Chapter Select BACK button is clickable', (await g.state()).scene === 'Title');
  await g.ev(() => window.DM.Engine.top().menu.items.find((i) => i.label === 'CHAPTERS').action());
  await g.wait(300);
  await g.page.mouse.click(1130, 556);
  await g.until('resumed karnak', () => window.DM.dev.play() && window.DM.dev.play().chapter.id === 'karnak', { talk: false });
  await g.wait(300);
  const res = await g.state();
  assert('RESUME starts the chapter at its checkpoint', res.chapter === 'karnak' && res.stage === 2, JSON.stringify({ c: res.chapter, s: res.stage }));

  // Finishing the last chapter: no CONTINUE that leads back to the Prologue.
  await g.ev(() => window.DM.dev.play().completeChapter());
  await g.ev(() => window.DM.Engine.set(new window.DM.Scenes.Title()));
  await g.wait(300);
  items = await g.menu();
  assert('after finishing Karnak there is no CONTINUE; CHAPTERS leads', !items.some((i) => /CONTINUE/.test(i.label)) && items[0].label === 'CHAPTERS', items.map((i) => i.label).join(' | '));
  await g.page.screenshot({ path: path.join(out, 'saves-title-finished.png') });

  // New Game asks first; Cancel keeps everything; Start Over keeps chapters unlocked.
  await g.ev(() => window.DM.Engine.top().menu.items.find((i) => i.label === 'NEW GAME').action());
  await g.wait(400);
  assert('NEW GAME with progress asks for confirmation', (await g.state()).scene === 'ConfirmNewGame');
  await g.page.screenshot({ path: path.join(out, 'saves-confirm-new-game.png') });
  await g.page.keyboard.press('Escape');
  await g.wait(250);
  const kept = await g.ev(() => ({ top: window.DM.Engine.top().constructor.name, reached: window.DM.Save.data.reached, cp: window.DM.Save.data.checkpoint }));
  assert('cancelling keeps the save as it was', kept.top === 'Title' && kept.reached === 6 && kept.cp === null, JSON.stringify(kept));
  await g.ev(() => window.DM.Engine.top().menu.items.find((i) => i.label === 'NEW GAME').action());
  await g.wait(300);
  await g.page.keyboard.press('ArrowUp');
  await g.page.keyboard.press('Enter');
  await g.until('new game interlude', () => window.DM.Engine.top().constructor.name === 'Interlude', { talk: false });
  const fresh = await g.ev(() => ({ reached: window.DM.Save.data.reached, cp: window.DM.Save.data.checkpoint, ch: window.DM.Engine.top().ch.id }));
  assert('START OVER begins the Prologue and keeps chapters unlocked', fresh.ch === 'prologue' && fresh.reached === 6 && fresh.cp.chapter === 'prologue' && fresh.cp.stage === 0, JSON.stringify(fresh));
  await g.close();
}

// ---- 5. New checkpoints: Continue during the accident, calibrate and naming ----------
if (want(5)) {
  const g = await open();
  await g.gate();
  await g.ev(() => window.DM.dev.start('prologue', 3));
  await g.wait(800);
  await g.page.reload();
  await g.boot();
  await g.gate();
  const items = await g.menu();
  assert('quitting during the accident offers CONTINUE · PROLOGUE', /PROLOGUE$/.test(items[0].label) && /Accident/.test(items[0].sub), `${items[0].label} / ${items[0].sub}`);
  await g.page.keyboard.press('Enter');
  await g.until('accident resumed', () => window.DM.dev.play() && window.DM.dev.play().ctx.flags.lockdown, { talk: false });
  const acc = await g.ev(() => {
    const p = window.DM.dev.play();
    return { stage: p.ctx.stageIndex, coat: p.ctx.flags.gotCoat, door: p.ctx.refs.door.open };
  });
  assert('Continue resumes at the accident with the story state restored', acc.stage === 3 && acc.coat && !acc.door, JSON.stringify(acc));

  for (const [ch, st, check, label, talk] of [
    ['prologue', 1, () => { const p = window.DM.dev.play(); return !!p && p.ctx.flags.repaired && p.ctx.flags.metJaney && /Calibrate/.test((p.hud.objective || {}).text || ''); }, 'calibrate', true],
    ['reassembly', 1, () => { const p = window.DM.dev.play(); return !!p && p.player.form === 'manhattan' && !p.player.hidden && window.DM.U.dist(p.player.x, p.player.y, 1200, 1200) < 5 && p.dialog.active; }, 'naming', false],
  ]) {
    await g.ev(([c, s]) => {
      window.DM.Save.data.checkpoint = { chapter: c, stage: s, carry: null };
      window.DM.Save.write();
    }, [ch, st]);
    await g.page.reload();
    await g.boot();
    await g.gate();
    await g.page.keyboard.press('Enter');
    let ok = true, why = '';
    try {
      await g.until(`${label} restored`, check, { talk, timeout: 8000 });
    } catch (e) {
      ok = false;
      why = e.message;
    }
    assert(`Continue at ${ch} '${label}' restores the earlier stages`, ok && (await g.state()).stage === st, why);
  }
  await g.close();
}

// ---- 6. Unlock cards once; retry is quick; memo; 'play:begin' ----------------------------
if (want(6)) {
  const g = await open();
  await g.gate();
  await g.ev(() => {
    window.__pb = [];
    window.DM.Events.on('play:begin', (e) => window.__pb.push({ chapter: e.chapter, stage: e.stage, retry: e.retry, scene: e.scene === window.DM.dev.play() }));
  });
  await g.ev(() => window.DM.dev.start('deterrent', 2));
  await g.until('duplicate card', () => window.DM.Engine.top().constructor.name === 'PowerUnlock', { talk: true });
  await g.wait(1000);
  await g.page.keyboard.press('e');
  await g.until('waves2 control', () => !window.DM.dev.play().player.locked && window.DM.Engine.top() === window.DM.dev.play());
  const seen = await g.ev(() => !!window.DM.Save.data.seen.unlocks.duplicate);
  assert('the unlock card is shown the first time and marked seen when closed', seen);
  const once = await g.ev(() => [window.DM.dev.play().ctx.once('brief'), window.DM.dev.play().ctx.once('brief')]);
  // Die, then REASSEMBLE.
  await g.ev(() => {
    const play = window.DM.dev.play();
    play.player.invuln = 0;
    play.player.damage(999, null, 'test');
  });
  await g.until('game over', () => window.DM.Engine.top().constructor.name === 'GameOver', { talk: false });
  await g.wait(800);
  const t0 = Date.now();
  await g.page.keyboard.press('Enter');
  let card = false;
  let toast = '';
  let control = null;
  while (Date.now() - t0 < 15000) {
    const s = await g.ev(() => {
      const DM = window.DM;
      const p = DM.dev.play();
      const top = DM.Engine.top();
      return { top: top.constructor.name, locked: p.player.locked, dialog: p.dialog.active, fading: DM.Engine.fade.a > 0, toasts: p.hud.toasts.map((t) => t.text).join('|'), stage: p.ctx.stageIndex };
    });
    if (s.top === 'PowerUnlock') card = true;
    if (s.toasts) toast = s.toasts;
    if (s.dialog) await g.page.keyboard.press('e');
    if (s.top === 'Play' && !s.locked && !s.fading && s.stage === 2 && Date.now() - t0 > 700) {
      control = (Date.now() - t0) / 1000;
      break;
    }
    await g.wait(60);
  }
  assert('on retry the card is replaced by a toast naming the power and key', !card && /DUPLICATE\s+·\s+R/.test(toast), `card ${card}, toast "${toast}"`);
  console.log(`  (deterrent waves2: control ${control} s after REASSEMBLE; the remaining wait is the narration caption, which package G makes skippable)`);
  const after = await g.ev(() => window.__pb);
  assert("'play:begin' fires once per begin, with retry set on REASSEMBLE", after.length === 2 && after[0].retry === false && after[1].retry === true && after[1].stage === 2 && after[1].chapter === 'deterrent' && after[1].scene, JSON.stringify(after));
  const onceAfter = await g.ev(() => window.DM.dev.play().ctx.once('brief'));
  assert('ctx.once is true once per chapter and stays false across retries', once[0] === true && once[1] === false && onceAfter === false);

  // ---- Focus loss pauses the fight ----
  const c0 = await g.ev(() => window.DM.dev.play().player.coherence);
  await g.ev(() => window.dispatchEvent(new Event('blur')));
  await g.wait(2500);
  const blur = await g.ev(() => ({ stack: window.DM.Engine.stack.map((s) => s.constructor.name), coh: window.DM.dev.play().player.coherence }));
  assert('a window blur mid-fight pauses the game and Jon takes no damage', blur.stack[blur.stack.length - 1] === 'Pause' && blur.coh >= c0, JSON.stringify(blur));
  await g.page.keyboard.press('Escape');
  await g.wait(200);
  await g.ev(() => {
    window.DM.Save.settings.focusPause = false;
    window.dispatchEvent(new Event('blur'));
  });
  await g.wait(200);
  const noPause = await g.ev(() => window.DM.Engine.top().constructor.name);
  assert('with focusPause off a blur does not pause', noPause === 'Play', noPause);
  await g.ev(() => {
    window.DM.Save.settings.focusPause = true;
    window.DM.Engine.set(new window.DM.Scenes.Title());
    window.dispatchEvent(new Event('blur'));
  });
  await g.wait(200);
  assert('a blur on the title does nothing', (await g.state()).stack.join() === 'Title');

  // ---- Cutscene safety: lock(true) clears hostile projectiles ----
  await g.ev(() => window.DM.dev.start('deterrent', 3));
  await g.until('behemoth fight', () => {
    const p = window.DM.dev.play();
    return p.world.boss && !p.player.locked;
  });
  const shots = await g.ev(() => {
    const DM = window.DM;
    const play = DM.dev.play();
    const W = play.world, p = play.player;
    for (const a of [-0.5, 0, 0.5]) W.add(new DM.Proj.Missile({ x: p.x + 400, y: p.y + a * 200, angle: Math.PI + a, speed: 230 }));
    W.add(new DM.Proj.Bullet({ x: p.x + 300, y: p.y, vx: -400, vy: 0 }));
    W.add(new DM.Proj.Shell({ x: p.x + 500, y: p.y, tx: p.x, ty: p.y, T: 3 }));
    const mine = W.add(new DM.Proj.Missile({ x: p.x - 300, y: p.y, angle: 0, speed: 230 }));
    mine.team = 'player';
    const hostile = () => W.entities.filter((e) => e.isProjectile && !e.dead && e.team !== 'player').length;
    const n0 = hostile();
    play.ctx.lock(true);
    const n1 = hostile();
    play.ctx.lock(false);
    return { n0, n1, mineAlive: !mine.dead };
  });
  assert('ctx.lock(true) fizzles every hostile projectile and spares thrown-back ones', shots.n0 === 5 && shots.n1 === 0 && shots.mineAlive, JSON.stringify(shots));
  await g.ev(() => {
    const DM = window.DM;
    const play = DM.dev.play();
    const W = play.world, b = W.boss;
    for (const a of [-0.5, 0, 0.5]) W.add(new DM.Proj.Missile({ x: b.x - 150, y: b.y + a * 200, angle: Math.PI + a, speed: 230 }));
    window.__outro = [];
    b.die('disintegrate');
  });
  let outroOk = null;
  const tEnd = Date.now() + 9000;
  while (Date.now() < tEnd) {
    const s = await g.ev(() => {
      const DM = window.DM;
      const play = DM.dev.play();
      // Enemy missiles only: the thrown-back one made above is Jon's, and is spared on purpose.
      return { stage: play.ctx.stageIndex, locked: play.ctx.locked, missiles: play.world.entities.filter((e) => e instanceof DM.Proj.Missile && !e.dead && e.team !== 'player').length };
    });
    if (s.stage === 4 && s.locked) {
      outroOk = s.missiles === 0;
      break;
    }
    await g.wait(40);
  }
  assert('no enemy missile survives into the Behemoth outro', outroOk === true, String(outroOk));
  await g.close();
}

// ---- 7. Input you can trust --------------------------------------------------------------
if (want(7)) {
  const g = await open();
  await g.gate();
  const alpha = await g.ev(() => {
    const c = document.createElement('canvas').getContext('2d');
    const G = window.DM.Gfx;
    const r = [];
    c.globalAlpha = 1;
    G.text(c, 'x', 0, 0, { alpha: 0 });
    r.push(c.globalAlpha);
    c.globalAlpha = 1;
    G.text(c, 'x', 0, 0, { alpha: 1.5 });
    r.push(c.globalAlpha);
    c.globalAlpha = 0.5;
    G.text(c, 'x', 0, 0, { alpha: 0.5 });
    r.push(c.globalAlpha);
    return r;
  });
  assert('Gfx.text leaves globalAlpha as it found it (alpha 0, 1.5, 0.5)', alpha[0] === 1 && alpha[1] === 1 && alpha[2] === 0.5, alpha.join(','));

  await g.ev(() => window.DM.dev.start('deterrent', 1));
  await g.until('waves1 control', () => !window.DM.dev.play().player.locked && window.DM.Engine.top() === window.DM.dev.play());
  await g.page.keyboard.down('d');
  await g.wait(400);
  const vx0 = await g.ev(() => Math.round(window.DM.dev.play().player.vx));
  await g.ev(() => window.DM.Engine.fadeTo(() => {}, { out: 0.2, in: 0.2 }));
  await g.wait(700);
  for (let i = 0; i < 6; i++) {
    await g.ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', repeat: true })));
    await g.wait(30);
  }
  await g.wait(150);
  const held = await g.ev(() => ({ right: window.DM.Input.down('right'), vx: Math.round(window.DM.dev.play().player.vx) }));
  await g.page.keyboard.up('d');
  assert('a key held through a fade works again on its next auto-repeat', held.right && vx0 > 40 && held.vx >= vx0 * 0.8, `vx ${vx0} before the fade, ${JSON.stringify(held)} after`);
  const rep = await g.ev(() => {
    const I = window.DM.Input;
    I.clearAll();
    I.endFrame();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true }));
    const r = { pressed: I.pressed('teleport'), down: I.down('teleport') };
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
    return r;
  });
  assert('an auto-repeat never counts as a new press', !rep.pressed && rep.down, JSON.stringify(rep));
  const touch = await g.ev(() => {
    const I = window.DM.Input;
    I.simulate('Mouse0', true);
    const a = I.down('telekinesis');
    I.canvas.dispatchEvent(new Event('touchcancel'));
    return [a, I.down('telekinesis')];
  });
  assert('touchcancel releases the held left button', touch[0] === true && touch[1] === false);
  const ctrl = await g.ev(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', ctrlKey: true }));
    const r = window.DM.Input.down('up');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
    return r;
  });
  assert('off a Mac, Ctrl+W is left to the browser', ctrl === false);
  await g.close();

  // Mac: Ctrl held for Ctrl+click must not kill movement.
  const m = await open({ init: () => Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }) });
  await m.gate();
  await m.ev(() => window.DM.dev.start('deterrent', 1));
  await m.until('waves1 control', () => !window.DM.dev.play().player.locked && window.DM.Engine.top() === window.DM.dev.play());
  const y0 = await m.ev(() => window.DM.dev.play().player.y);
  await m.page.keyboard.down('Control');
  await m.page.keyboard.down('w');
  await m.wait(400);
  const y1 = await m.ev(() => window.DM.dev.play().player.y);
  await m.page.keyboard.up('w');
  await m.page.keyboard.up('Control');
  assert('on a Mac, Control+W still moves Jon', y1 < y0 - 30, `${Math.round(y0)} -> ${Math.round(y1)}`);
  await m.close();
}

// ---- 8. Same timing at 120 and 240 Hz --------------------------------------------------
// requestAnimationFrame is replaced by a virtual display: each frame advances the
// timestamp by exactly 1/hz s, however long it really took to draw.
if (want(8)) for (const hz of [120, 240]) {
  const g = await open({
    init: (rate) => {
      let vt = performance.now();
      window.requestAnimationFrame = (cb) => setTimeout(() => cb((vt += 1000 / rate)), 0);
    },
    initArg: hz,
  });
  const motes = await g.ev(async () => {
    const DM = window.DM;
    const t = DM.Engine.top();
    const a0 = t.motes[0].a, e0 = DM.Engine.time;
    await new Promise((r) => setTimeout(r, 1500));
    return (t.motes[0].a - a0) / (DM.Engine.time - e0) / t.motes[0].s;
  });
  await g.gate();
  await g.ev(() => window.DM.dev.start('reassembly'));
  await g.until('gather objective', () => /nervous/.test((window.DM.dev.play().hud.objective || {}).text || ''), { timeout: 90000 });
  await g.ev(() => {
    const ctx = window.DM.dev.play().ctx;
    const orig = ctx.tween.bind(ctx);
    window.__walk = null;
    ctx.tween = (dur, fn) => {
      const e0 = window.DM.Engine.time;
      let frames = -1;
      return orig(dur, (k) => {
        fn(k);
        frames++;
        if (k >= 1 && !window.__walk) window.__walk = { dur, s: window.DM.Engine.time - e0, frames };
      });
    };
  });
  await g.until('walk done', () => {
    const play = window.DM.dev.play();
    const b = play.ctx.refs.body;
    if (b && !play.ctx.flags.reassembled) b.bank = b.quota;
    return !!window.__walk;
  }, { timeout: 120000 });
  const walk = await g.ev(() => window.__walk);
  const want = Math.ceil(1.15 * hz);
  assert(`at ${hz} Hz the reassembly walk lasts 1.15 s ± 1 frame`, walk.dur === 1.15 && Math.abs(walk.frames - want) <= 1 && Math.abs(walk.s - 1.15) <= 1 / hz + 1e-6, `${walk.s.toFixed(4)} s over ${walk.frames} frames`);
  assert(`at ${hz} Hz the title motes turn at the same speed`, Math.abs(motes - 0.15) < 0.005, `${motes.toFixed(4)} rad/s per unit speed`);
  await g.close();
}

// ---- 9. persistFlags reach the saved chapter record ------------------------------------------
if (want(9)) {
  const g = await open();
  await g.gate();
  await g.ev(() => {
    const DM = window.DM;
    DM.Chapters.register({
      id: '__flags', numeral: 'TEST', title: 'Flags', date: '', place: '', clock: 0, color: '#333', music: null, form: 'manhattan',
      persistFlags: ['verdict'],
      maps: {
        t: () => {
          const W = new DM.World({ w: 800, h: 600, zoom: 1 });
          W.room(0, 0, 800, 600, { t: 20 });
          W.spawn = { x: 400, y: 300 };
          return W;
        },
      },
      stages: [{
        id: 't', map: 't',
        run: function* (ctx) {
          ctx.flags.verdict = 'mercy';
          ctx.flags.scratch = true;
          yield ctx.wait(0.2);
        },
      }],
    });
    DM.dev.start('__flags');
  });
  await g.until('flags chapter complete', () => window.DM.Engine.top().constructor.name === 'ChapterComplete', { talk: false });
  const rec = await g.ev(() => window.DM.Save.data.completed.__flags);
  assert("a chapter's persistFlags are saved with its completion", rec && rec.flags && rec.flags.verdict === 'mercy' && !('scratch' in rec.flags), JSON.stringify(rec));
  await g.close();
}

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll save & robustness checks passed.');
process.exit(failures ? 1 : 0);
