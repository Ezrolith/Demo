/*
 * Settings & accessibility test: the settings schema and screen, challenge
 * levels, reduced flashing, hints you can recall, and narration/dialogue pace.
 * Drives the real game in headless Chromium with simulated input.
 *
 *   node tests/settings.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || path.join(root, 'index.html');
const url = pathToFileURL(target).href + '?dev';
const outDir = path.join(root, 'tests', 'out', 'settings');
fs.mkdirSync(outDir, { recursive: true });

const errors = [];
const browser = await playwright.chromium.launch();
async function openPage(ctxOpts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, ctxOpts));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.DM && window.DM.dev);
  return page;
}
const page = await openPage();
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = (name) => page.screenshot({ path: path.join(outDir, name + '.png') });

let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}
const skip = (name, why) => console.log(`– ${name}  — skipped: ${why}`);

const set = (id, v) => ev(([id, v]) => window.DM.SettingsSchema.set(id, v), [id, v]);
const top = () => ev(() => window.DM.Engine.top().constructor.name);
const stageIndex = (ch, id) => ev(([ch, id]) => window.DM.Chapters.get(ch).stages.findIndex((s) => s.id === id), [ch, id]);
async function start(ch, stage = 0) {
  await ev(([c, s]) => window.DM.dev.start(c, s), [ch, stage]);
  await wait(250);
}
// Wait until fn() (evaluated in page) is truthy, pressing E through dialogue and unlock cards.
async function until(label, fn, { timeout = 30000, talk = true } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await ev(fn)) return true;
    if (talk) {
      const s = await ev(() => ({ dialog: window.DM.dev.state().dialog, scene: window.DM.Engine.top().constructor.name }));
      if (s.dialog || s.scene === 'PowerUnlock') await page.keyboard.press('e');
    }
    await wait(120);
  }
  throw new Error(`timed out waiting for: ${label}`);
}

await page.mouse.click(640, 360);
await wait(200);

// A plain arena to run scripted checks in.
await ev(() => {
  const DM = window.DM;
  DM.Chapters.register({
    id: '__arena', numeral: 'TEST', title: 'Arena', date: '', place: '', clock: 0, color: '#333', music: null, form: 'manhattan',
    maps: {
      t: () => {
        const W = new DM.World({ w: 1600, h: 1000, zoom: 1 });
        W.room(0, 0, 1600, 1000, { t: 20 });
        W.spawn = { x: 800, y: 500 };
        return W;
      },
    },
    stages: [{ id: 't', map: 't', run: function* () { while (true) yield; } }],
  });
});

// ---- 1. The schema ------------------------------------------------------------------
const keys = await ev(() => ({ defaults: Object.keys(window.DM.SettingsSchema.defaults()), saved: Object.keys(window.DM.Save.settings) }));
const expected = ['music', 'sfx', 'ambience', 'flashing', 'shake', 'grain', 'quality', 'fx', 'challenge', 'invulnerable', 'hints', 'textSpeed', 'focusPause', 'tkMode'];
assert('every option has a default built from the schema', expected.every((k) => keys.defaults.includes(k) && keys.saved.includes(k)), keys.defaults.join(', '));

const added = await ev(() => {
  const DM = window.DM;
  const S = DM.SettingsSchema;
  S.push({ id: '__probe', section: 'GAMEPLAY', label: 'PROBE OPTION', type: 'choice', options: [['a', 'ALPHA'], ['b', 'BETA']], def: 'a' });
  const scene = new DM.Scenes.Settings();
  DM.Engine.push(scene);
  scene.switchTab(S.sections.indexOf('GAMEPLAY'));
  const row = scene.menu.items.find((i) => i.label === 'PROBE OPTION');
  const shown = row ? row.value() : null;
  if (row) row.adjust(1);
  const r = { shown, after: DM.Save.settings.__probe, inDefaults: S.defaults().__probe === 'a' };
  DM.Engine.pop();
  S.splice(S.indexOf(S.get('__probe')), 1);
  delete DM.Save.settings.__probe;
  return r;
});
assert('adding an option needs only one schema entry', added.shown === 'ALPHA' && added.after === 'b' && added.inDefaults, JSON.stringify(added));

// Old saves keep their values; booleans from version 1 map onto the new choices.
for (const [label, old, want] of [
  ['an old save keeps its music, sfx, shake and hints (off)', { music: 0.3, sfx: 0.5, shake: 0, hints: false }, { music: 0.3, sfx: 0.5, shake: 0, hints: 'essential' }],
  ['an old save keeps its music, sfx, shake and hints (on)', { music: 1, sfx: 0.2, shake: 1, hints: true }, { music: 1, sfx: 0.2, shake: 1, hints: 'all' }],
]) {
  const p2 = await openPage();
  await p2.evaluate((s) => {
    localStorage.setItem('dr-manhattan.save', JSON.stringify({ version: 1, reached: 2, completed: {}, checkpoint: null, totals: { disintegrated: 0, spared: 0, decoherences: 0, memories: 0 }, settings: s }));
  }, old);
  await p2.reload();
  await p2.waitForFunction(() => window.DM && window.DM.dev);
  const got = await p2.evaluate(() => {
    const S = window.DM.SettingsSchema;
    const v = { music: S.value('music'), sfx: S.value('sfx'), shake: S.value('shake'), hints: S.value('hints'), challenge: S.value('challenge') };
    S.sanitize(window.DM.Save.settings);
    v.storedHints = window.DM.Save.settings.hints;
    return v;
  });
  const ok = Object.keys(want).every((k) => got[k] === want[k]) && got.storedHints === want.hints && got.challenge === 'normal';
  assert(label, ok, JSON.stringify(got));
  await p2.context().close();
}

// The Settings screen: tabs, layout, and mouse behaviour on adjustable rows.
await ev(() => window.DM.Engine.push(new window.DM.Scenes.Settings()));
await wait(150);
const layout = await ev(() => {
  const DM = window.DM;
  const S = DM.SettingsSchema;
  const scene = DM.Engine.top();
  const ctx = DM.Engine.ctx;
  const out = [];
  for (let t = 0; t < S.sections.length; t++) {
    scene.tab = t;
    scene.build();
    const m = scene.menu;
    const last = m.rowRect(m.items.length - 1);
    let labelsClear = true;
    let descFits = true;
    m.items.forEach((it, i) => {
      const r = m.rowRect(i);
      const lw = DM.Gfx.measure(ctx, it.label, { size: m.size, spacing: 2, weight: 600 });
      if (it.adjust) {
        const z = m.zones(i);
        const leftmost = z.bar ? z.bar[0] : z.left[0];
        if (r.x + 34 + lw > leftmost - 8 || z.right[1] > DM.W) labelsClear = false;
      }
      const d = it.desc ? it.desc() : '';
      if (d && DM.Gfx.paragraphHeight(ctx, d, 720, 24, { size: 17, font: DM.FONTS.type }) > 48) descFits = false;
    });
    out.push({ section: S.sections[t], rows: m.items.length, bottom: last.y + last.h, foot: scene.constructor.FOOT_Y, labelsClear, descFits });
  }
  scene.tab = 0;
  scene.build();
  return out;
});
assert('every section fits 1280x720 above the footer', layout.every((l) => l.bottom <= l.foot && l.labelsClear && l.descFits), layout.map((l) => `${l.section}: ${l.rows} rows end ${l.bottom}/${l.foot}`).join('; '));

for (let t = 0; t < 4; t++) {
  await shot(`settings-${t}`);
  await page.keyboard.press('e');
  await wait(120);
}
const tabs = [];
await page.keyboard.press('e');
await wait(80);
tabs.push(await ev(() => window.DM.Engine.top().tab));
await page.keyboard.press('q');
await wait(80);
tabs.push(await ev(() => window.DM.Engine.top().tab));
await page.keyboard.press('ArrowUp');
await wait(80);
await page.keyboard.press('ArrowRight');
await wait(80);
tabs.push(await ev(() => window.DM.Engine.top().tab));
await page.keyboard.press('ArrowLeft');
await wait(80);
await page.keyboard.press('ArrowDown');
await wait(80);
tabs.push(await ev(() => ({ tab: window.DM.Engine.top().tab, focus: window.DM.Engine.top().tabFocus })));
assert('Q / E and the tab row switch sections', tabs[0] === 1 && tabs[1] === 0 && tabs[2] === 1 && tabs[3].tab === 0 && !tabs[3].focus, JSON.stringify(tabs));

const rowGeom = (label) => ev((label) => {
  const m = window.DM.Engine.top().menu;
  const i = m.items.findIndex((it) => it.label === label);
  const r = m.rowRect(i);
  return { r, z: m.zones(i) };
}, label);
const music = () => ev(() => window.DM.Save.settings.music);
await set('music', 0.6);
const g = await rowGeom('MUSIC');
const cy = g.r.y + g.r.h / 2;
await page.mouse.click(g.r.x + 60, cy);
await wait(80);
const m1 = await music();
await page.mouse.click((g.z.left[0] + g.z.left[1]) / 2, cy);
await wait(80);
const m2 = await music();
await page.mouse.click((g.z.right[0] + g.z.right[1]) / 2, cy);
await wait(80);
await page.mouse.click((g.z.right[0] + g.z.right[1]) / 2, cy + 1);
await wait(80);
const m3 = await music();
await page.mouse.click(g.z.bar[0] + (g.z.bar[1] - g.z.bar[0]) * 0.3, cy);
await wait(80);
const m4 = await music();
assert('clicking the MUSIC label no longer lowers the volume', m1 >= 0.6, `0.6 → ${m1}`);
assert('clicking ‹ / › steps the value down / up', Math.abs(m2 - (m1 - 0.1)) < 1e-9 && Math.abs(m3 - (m2 + 0.2)) < 1e-9, `${m1} → ${m2} → ${m3}`);
assert('clicking the slider bar sets the value there', Math.abs(m4 - 0.3) < 1e-9, String(m4));
await set('music', 0.6);
await ev(() => window.DM.Engine.pop());

// ---- 2. Challenge ------------------------------------------------------------------
const begins = await ev(() => {
  window.__begins = [];
  window.DM.Events.on('play:begin', (e) => window.__begins.push({ chapter: e.chapter && e.chapter.id, retry: !!e.retry }));
});
const tuning = {};
for (const lvl of ['story', 'normal', 'hard']) {
  await set('challenge', lvl);
  await start('__arena');
  tuning[lvl] = await ev(() => {
    const p = window.DM.dev.play().player;
    return [p.damageMul, p.regenDelayBase, p.coherenceRegen];
  });
}
assert('challenge levels set damage, regen delay and regen on the player', JSON.stringify(tuning) === JSON.stringify({ story: [0.3, 1.2, 18], normal: [1, 2.6, 9], hard: [1.35, 3.2, 7] }), JSON.stringify(tuning));

const assist = await ev(() => {
  const DM = window.DM;
  const p = DM.dev.play().player;
  DM.SettingsSchema.set('invulnerable', true);
  p.invuln = 0;
  p.damage(60, null, 'bullet');
  const r = { god: p.godMode, coherence: p.coherence };
  DM.SettingsSchema.set('invulnerable', false);
  r.godAfter = p.godMode;
  return r;
});
assert('the invulnerability assist applies at once and blocks damage', assist.god && assist.coherence === 100 && !assist.godAfter, JSON.stringify(assist));

await set('challenge', 'story');
await ev(() => window.DM.dev.play().retry());
await wait(1100);
const retried = await ev(() => ({ mul: window.DM.dev.play().player.damageMul, last: window.__begins[window.__begins.length - 1] }));
assert("'play:begin' re-applies the challenge on retry", retried.mul === 0.3 && retried.last && retried.last.retry === true, JSON.stringify(retried));

// Idle time-to-decoherence under a steady stream of hits (the same idea as review/playability/ttk.mjs).
const merged = await ev(() => /damageMul/.test(window.DM.Player.prototype.damage.toString()) && /coherenceRegen/.test(window.DM.Player.prototype.update.toString()));
if (merged) {
  const ttk = await ev(() => {
    const DM = window.DM;
    const res = {};
    for (const lvl of ['story', 'normal', 'hard']) {
      DM.SettingsSchema.set('challenge', lvl);
      const w = new DM.World({ w: 800, h: 800 });
      const p = new DM.Player(400, 400);
      p.setForm('manhattan');
      w.player = p;
      p.world = w;
      w.add(p);
      DM.Challenge.applyTo(p);
      let t = 0, next = 0;
      while (t < 600 && !p.down) {
        if (t >= next) {
          p.invuln = 0;
          p.damage(10, null, 'bullet');
          next += 0.7;
        }
        w.update(1 / 60);
        t += 1 / 60;
      }
      res[lvl] = Math.round(t * 10) / 10;
    }
    DM.SettingsSchema.set('challenge', 'normal');
    return res;
  });
  assert('story survives at least 2x as long as normal; hard about 25% shorter', ttk.story >= 2 * ttk.normal && ttk.hard <= ttk.normal * 0.85 && ttk.hard >= ttk.normal * 0.6, JSON.stringify(ttk));
} else skip('time-to-decoherence by challenge', 'needs Player.damageMul (package A) and coherenceRegen (package B)');

// Three decoherences at one checkpoint offer the story challenge.
await set('challenge', 'normal');
await start('__arena');
const offers = [];
for (let i = 0; i < 3; i++) {
  await ev(() => {
    const p = window.DM.dev.play().player;
    p.invuln = 0;
    p.damage(999, null, 'bullet');
  });
  await page.waitForFunction(() => window.DM.Engine.top().constructor.name === 'GameOver', null, { timeout: 8000 });
  offers.push(await ev(() => window.DM.Engine.top().menu.items.map((it) => it.label)));
  if (i < 2) {
    await ev(() => window.DM.Engine.top().play.retry());
    await page.waitForFunction(() => window.DM.Engine.top().constructor.name === 'Play' && !window.DM.Engine.fading && window.DM.Engine.fade.a === 0, null, { timeout: 8000 });
  }
}
await wait(700);
await shot('gameover-offer');
const choose = await ev(() => {
  const m = window.DM.Engine.top().menu;
  m.activate(m.items.findIndex((it) => it.label === 'TRY STORY CHALLENGE'));
  return window.DM.Save.settings.challenge;
});
await page.waitForFunction(() => window.DM.Engine.top().constructor.name === 'Play' && window.DM.Engine.fade.a === 0, null, { timeout: 8000 });
const afterOffer = await ev(() => window.DM.dev.play().player.damageMul);
assert('the first two decoherences offer no switch', !offers[0].includes('TRY STORY CHALLENGE') && !offers[1].includes('TRY STORY CHALLENGE'), JSON.stringify(offers.slice(0, 2)));
assert("three decoherences at one checkpoint offer 'TRY STORY CHALLENGE'", offers[2].includes('TRY STORY CHALLENGE'), JSON.stringify(offers[2]));
assert('choosing it switches the setting and retries', choose === 'story' && afterOffer === 0.3, `${choose}, damageMul ${afterOffer}`);

const ccRows = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  return new DM.Scenes.ChapterComplete(play, { time: 61, disintegrated: 0, spared: 0, memories: 0 }, null).rows();
});
assert('Chapter Complete records the challenge as a neutral line', ccRows.some(([a, b]) => a === 'CHALLENGE' && b === 'STORY'), JSON.stringify(ccRows));
await set('challenge', 'normal');

// ---- 3. Photosensitivity and motion -------------------------------------------------
// Instrument what the HUD actually draws.
await ev(() => {
  const H = window.DM.HUD.prototype;
  const render = H.render;
  window.__flash = { max: 0, flashes: 0, prev: 0 };
  H.render = function (ctx) {
    const a = this.flashAlpha;
    const f = window.__flash;
    f.max = Math.max(f.max, a);
    if (a > 0.02 && f.prev <= 0.02) f.flashes++;
    f.prev = a;
    return render.call(this, ctx);
  };
});
const resetFlash = () => ev(() => Object.assign(window.__flash, { max: 0, flashes: 0, prev: 0 }));
const flashStats = () => ev(() => Object.assign({}, window.__flash));

await set('flashing', 'reduced');
await start('__arena');
await resetFlash();
await ev(() => {
  const hud = window.DM.dev.play().hud;
  hud.flash('#ffffff', 1.2);
});
await wait(600);
await ev(() => window.DM.dev.play().ctx.flash('#ffffff', 3.5));
await wait(1500);
const capped = await flashStats();
await ev(() => {
  window.DM.dev.play().hud.flashA = 0; // let the long flash above finish
});
await wait(50);
await resetFlash();
await ev(() => window.DM.dev.play().ctx.flash('#ffffff', 0.25, { strobe: true }));
await wait(300);
const strobe = await flashStats();
assert('REDUCED caps every full-screen flash at alpha 0.25', capped.max > 0.1 && capped.max <= 0.25 + 1e-9, `max ${capped.max.toFixed(3)}`);
assert('REDUCED drops strobe flashes entirely', strobe.max === 0, `max ${strobe.max}`);

// The Mars press scene: flashbulbs every 0.8 s at 60% odds.
const pressScene = async () => {
  await start('mars', await stageIndex('mars', 'studio'));
  await until('the studio lets Jon go', () => {
    const p = window.DM.dev.play();
    return p.hud.objective && /Leave/.test(p.hud.objective.text) && !p.ctx.locked;
  });
  await resetFlash();
};
await set('hints', 'essential');
await pressScene();
const essentialHint = await ev(() => (window.DM.dev.play().hud.hintMsg || {}).text || '');
await wait(10000);
const reducedMars = await flashStats();
await shot('mars-press-reduced');
assert('Mars press scene shows 0 full-screen flashes in 10 s on REDUCED', reducedMars.flashes === 0 && reducedMars.max === 0, JSON.stringify(reducedMars));
assert('with hints ESSENTIAL the Mars teleport instruction still appears', /teleport/i.test(essentialHint), essentialHint);
await set('hints', 'all');
await set('flashing', 'full');
await pressScene();
await wait(5000);
const fullMars = await flashStats();
assert('…and still flashes on FULL', fullMars.flashes >= 1 && fullMars.max > 0.8, JSON.stringify(fullMars));

// The prologue alarm: a blinking red tint on FULL, a steady dim one on REDUCED.
const alarm = async () => {
  await start('prologue', await stageIndex('prologue', 'accident'));
  return ev(async () => {
    const W = window.DM.dev.play().world;
    const seen = new Set();
    let alarmOn = true;
    for (let i = 0; i < 40; i++) {
      seen.add(String(W.tint));
      alarmOn = alarmOn && W.alarm === true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return { tints: [...seen], alarm: alarmOn };
  });
};
await set('flashing', 'reduced');
const aReduced = await alarm();
await set('flashing', 'full');
const aFull = await alarm();
assert('the prologue alarm sets world.alarm for the lockdown', aReduced.alarm && aFull.alarm);
assert('REDUCED keeps the alarm tint steady at half strength', aReduced.tints.length === 1 && /0\.065/.test(aReduced.tints[0]), JSON.stringify(aReduced.tints));
assert('FULL blinks the alarm tint as before', aFull.tints.includes('null') && aFull.tints.some((t) => /0\.13/.test(t)), JSON.stringify(aFull.tints));

// prefers-reduced-motion on a fresh profile.
for (const [rm, flashing, shake] of [['reduce', 'reduced', 0.5], ['no-preference', 'full', 1]]) {
  const p3 = await openPage({ reducedMotion: rm });
  const s = await p3.evaluate(() => ({ flashing: window.DM.Save.settings.flashing, shake: window.DM.Save.settings.shake }));
  assert(`reduced motion '${rm}' on a fresh profile gives flashing ${flashing.toUpperCase()}, shake ${shake}`, s.flashing === flashing && s.shake === shake, JSON.stringify(s));
  await p3.context().close();
}

// The title gate warns before anything can flash.
{
  const p4 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await p4.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fillText;
    window.__texts = new Set();
    CanvasRenderingContext2D.prototype.fillText = function (s, ...rest) {
      window.__texts.add(String(s));
      return fill.call(this, s, ...rest);
    };
  });
  await p4.goto(url);
  await p4.waitForFunction(() => window.DM && window.DM.dev);
  await p4.waitForTimeout(400);
  const warned = await p4.evaluate(() => [...window.__texts].some((t) => /Contains flashing lights/.test(t)));
  await p4.screenshot({ path: path.join(outDir, 'title-gate.png') });
  assert('the title gate carries a flashing-lights notice', warned);
  await p4.close();
}

// ---- 4. Hints ----------------------------------------------------------------------
await set('invulnerable', true);
await start('deterrent', await stageIndex('deterrent', 'behemoth'));
await until('the Behemoth tip', () => {
  const h = window.DM.dev.play().hud;
  return h.lastHint && h.hintMsg && /Behemoth/.test((h.objective || {}).text || '');
});
const tip = await ev(() => window.DM.dev.play().hud.lastHint.text);
await page.keyboard.press('Escape');
await wait(200);
const notes = await ev(() => (window.DM.Engine.top().notes ? window.DM.Engine.top().notes() : null));
await shot('pause-field-note');
assert('pausing during the Behemoth shows the objective and its tip', notes && notes.note === tip && /Behemoth/.test(notes.objective || ''), JSON.stringify(notes));
await page.keyboard.press('Escape');
await wait(200);
await ev(() => {
  window.DM.dev.play().hud.hintMsg = null;
});
await page.keyboard.press('h');
await wait(150);
const recalled = await ev(() => (window.DM.dev.play().hud.hintMsg || {}).text);
assert('H re-shows the last tip', recalled === tip, String(recalled));
await set('invulnerable', false);

await start('__arena');
const hintRules = await ev(() => {
  const DM = window.DM;
  const ctx = DM.dev.play().ctx;
  const hud = ctx.hud;
  DM.SettingsSchema.set('hints', 'essential');
  ctx.hint('A passing tip.', 5);
  const tipShown = !!hud.hintMsg;
  const tipKept = hud.lastHint && hud.lastHint.text;
  ctx.tutorial('Press SPACE now.', 5);
  const tutShown = hud.hintMsg && hud.hintMsg.text;
  DM.SettingsSchema.set('hints', 'all');
  hud.hintMsg = null;
  hud.lastHint = null;
  return { tipShown, tipKept, tutShown };
});
assert('ESSENTIAL hides tips but keeps them for recall, and always shows tutorials', !hintRules.tipShown && hintRules.tipKept === 'A passing tip.' && hintRules.tutShown === 'Press SPACE now.', JSON.stringify(hintRules));

await ev(() => {
  const play = window.DM.dev.play();
  play.ctx.hint('Issued just before a conversation.', 2);
  play.dialog.open([['jon', 'One.'], ['janey', 'Two.']]);
});
await wait(2600);
const during = await ev(() => !!window.DM.dev.play().hud.hintMsg);
await page.keyboard.press('e');
await wait(250);
await page.keyboard.press('e');
await wait(250);
await page.keyboard.press('e');
await wait(250);
const afterTalk = await ev(() => ({ dialog: window.DM.dev.play().dialog.active, hint: (window.DM.dev.play().hud.hintMsg || {}).text }));
assert('a hint issued just before a dialogue is still there when it closes', during && !afterTalk.dialog && afterTalk.hint === 'Issued just before a conversation.', JSON.stringify(afterTalk));

const nudge = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const hud = play.hud;
  play.ctx.objective('Find the way through');
  play.ctx.hint('The way through is to the north.', 0.2);
  await new Promise((r) => setTimeout(r, 600));
  const gone = !hud.hintMsg;
  hud.objective.idleT = 44.8;
  await new Promise((r) => setTimeout(r, 400));
  const back = hud.hintMsg && hud.hintMsg.text;
  hud.hintMsg = null;
  hud.objective.idleT = 60;
  await new Promise((r) => setTimeout(r, 200));
  return { gone, back, again: !!hud.hintMsg };
});
assert('after 45 s stuck on one objective the last tip comes back, once', nudge.gone && nudge.back === 'The way through is to the north.' && !nudge.again, JSON.stringify(nudge));

// ---- 5. Narration and dialogue pace ------------------------------------------------------
const caption = (locked) => ev(async (locked) => {
  const ctx = window.DM.dev.play().ctx;
  ctx.hud.captions = [];
  ctx.lock(locked);
  window.__cap = ctx.hud.caption('A long line of narration that takes a good while to type out and longer still to read in full.');
  await new Promise((r) => setTimeout(r, 400));
}, locked);
await caption(true);
await page.keyboard.press('e');
await wait(100);
const revealed = await ev(() => window.__cap.chars >= window.__cap.text.length && !window.__cap.gone);
await page.keyboard.press('e');
await wait(450);
const skipped = await ev(() => window.__cap.gone);
assert('in a cutscene, a press finishes the caption and a second press ends it', revealed && skipped, `revealed ${revealed}, gone ${skipped}`);
await caption(false);
await page.keyboard.press('e');
await page.keyboard.press('e');
await wait(450);
const kept = await ev(() => !window.__cap.gone);
assert('captions are not skipped while Jon is free to move', kept);
await ev(() => {
  const ctx = window.DM.dev.play().ctx;
  ctx.hud.captions = [];
  ctx.lock(false);
});

const speed = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const S = DM.SettingsSchema;
  const text = 'Thirty-one characters of text.';
  S.set('textSpeed', 'normal');
  const normalDur = play.hud.caption(text).dur;
  S.set('textSpeed', 'slow');
  const slowDur = play.hud.caption(text).dur;
  S.set('textSpeed', 'instant');
  play.dialog.open([['jon', text]]);
  const instant = play.dialog.chars === text.length;
  play.dialog.close();
  play.hud.captions = [];
  S.set('textSpeed', 'normal');
  return { normalDur, slowDur, instant };
});
assert('INSTANT shows full lines on open', speed.instant);
assert('SLOW gives captions 1.5x the read time', Math.abs(speed.slowDur - speed.normalDur * 1.5) < 1e-9, `${speed.normalDur.toFixed(2)}s → ${speed.slowDur.toFixed(2)}s`);

const tenLines = () => ev(() => window.DM.dev.play().dialog.open(Array.from({ length: 10 }, (_, i) => ['jon', `Line ${i + 1} of a conversation that goes on for some time.`])));
await tenLines();
await wait(100);
await page.keyboard.down('Space');
await wait(1600);
await page.keyboard.up('Space');
const ff = await ev(() => window.DM.dev.play().dialog.active);
assert('holding SPACE fast-forwards a whole conversation', !ff);
await page.keyboard.down('Space');
await wait(100);
await tenLines();
await wait(1000);
await page.keyboard.up('Space');
const held = await ev(() => ({ active: window.DM.dev.play().dialog.active, i: window.DM.dev.play().dialog.i }));
assert('a key already held when a conversation opens does not fast-forward it', held.active && held.i === 0, JSON.stringify(held));
await shot('dialog-prompt');
await ev(() => window.DM.dev.play().dialog.close());

// A new game: Jon can walk within a second.
await start('prologue', 0);
await wait(650);
const x0 = await ev(() => ({ x: window.DM.dev.play().player.x, locked: window.DM.dev.play().player.locked }));
await page.keyboard.down('d');
await wait(300);
await page.keyboard.up('d');
const x1 = await ev(() => window.DM.dev.play().player.x);
await shot('prologue-opening');
assert('a new game allows movement within 1 s', !x0.locked && x1 - x0.x > 20, `moved ${Math.round(x1 - x0.x)}px`);

// Retrying a checkpoint with instant presses (review/playability/retry.mjs): seconds until
// Jon can move, and until the objective is up (waves open with a banner Jon can move during).
async function controlTime(ch, id) {
  await ev(([c, s]) => window.DM.dev.start(c, s), [ch, await stageIndex(ch, id)]);
  const t0 = Date.now();
  let control = null;
  while (Date.now() - t0 < 15000) {
    const s = await ev(() => {
      const DM = window.DM;
      const p = DM.dev.play();
      const t = DM.Engine.top();
      const c = p.hud.captions[0];
      return {
        top: t.constructor.name, cardReady: t.constructor.name === 'PowerUnlock' && t.t > 0.9, dialog: p.dialog.active,
        caption: !!(c && c.skippable), free: !p.player.locked && !DM.Engine.fading && DM.Engine.fade.a === 0, objective: !!p.hud.objective,
      };
    });
    const now = (Date.now() - t0) / 1000;
    if (s.top === 'Play' && s.free && now > 0.2) {
      if (control == null) control = now;
      if (s.objective) return { control, objective: now };
    }
    if (s.cardReady || s.dialog || s.caption) await page.keyboard.press('e');
    await wait(40);
  }
  return { control: control == null ? Infinity : control, objective: Infinity };
}
const onceCards = await ev(() => !!window.DM.Save.data.seen);
for (const [ch, id] of [['mars', 'palace'], ['deterrent', 'waves2']]) {
  await controlTime(ch, id); // first run: the unlock card is new
  const t = await controlTime(ch, id);
  const detail = `control ${t.control.toFixed(1)}s, objective ${t.objective.toFixed(1)}s`;
  if (onceCards) assert(`retrying ${ch} ${id} gives control in under 3 s`, t.control < 3, detail);
  else assert(`retrying ${ch} ${id} gives control in under 3.5 s (unlock card still shown until package F)`, t.control < 3.5, detail);
}

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll settings & accessibility checks passed.');
process.exit(failures ? 1 : 0);
