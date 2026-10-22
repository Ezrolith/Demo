/*
 * Story flow test: plays chapter scripts through their real triggers (no stage
 * skipping). Movement is shortcut by placing Jon next to things; everything
 * else — dialogue, interactions, the watch minigame — goes through real input.
 *
 *   node tests/flows.mjs
 */
import { createRequire } from 'node:module';
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

const errors = [];
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(target).href + '?dev');
await page.waitForFunction(() => window.DM && window.DM.dev);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const state = () => ev(() => window.DM.dev.state());

let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

// Wait until fn() (evaluated in page) is truthy, pressing E through any dialogue.
async function until(label, fn, { timeout = 30000, talk = true } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (s.error) throw new Error(`${label}: ${s.error}`);
    if (await ev(fn)) return true;
    if (talk && (s.dialog || s.scene === 'PowerUnlock')) await page.keyboard.press('e');
    await wait(180);
  }
  const s = await state();
  throw new Error(`timed out waiting for: ${label}  (${JSON.stringify(s)})`);
}
const moveTo = (x, y) => ev(([x, y]) => {
  const p = window.DM.dev.play().player;
  p.x = x;
  p.y = y;
  p.vx = p.vy = 0;
}, [x, y]);
const flags = () => ev(() => window.DM.dev.play().ctx.flags);

await page.mouse.click(640, 360);

// ---- Prologue ------------------------------------------------------------------
await ev(() => window.DM.dev.start('prologue'));
await until('narration done, Janey objective', () => {
  const h = window.DM.dev.play().hud;
  return h.objective && /Janey/.test(h.objective.text);
});
assert('prologue opens on "Find Janey"', true);

await moveTo(330, 815);
await wait(150);
const prompt = await ev(() => {
  const t = window.DM.dev.play().player.interactTarget;
  return t && t.interact.label;
});
assert('standing by Janey shows a talk prompt', prompt === 'Talk to Janey', String(prompt));
await page.keyboard.press('e');
await until('met Janey', () => window.DM.dev.play().ctx.flags.metJaney && !window.DM.dev.play().dialog.active);
assert('talking to Janey gives Jon her watch', (await flags()).hasWatch);

await until('repair objective', () => /Repair/.test((window.DM.dev.play().hud.objective || {}).text || ''));
await moveTo(165, 150);
await wait(150);
await page.keyboard.press('e');
await until('watch minigame open', () => window.DM.Engine.top().constructor.name === 'WatchRepair', { talk: false });
// Play the minigame for real: press when the pivot is inside the gold zone.
for (let i = 0; i < 400; i++) {
  const st = await ev(() => {
    const m = window.DM.Engine.top();
    if (m.constructor.name !== 'WatchRepair') return { gone: true };
    const d = Math.abs(window.DM.U.wrapAngle(m.angle - m.zone.a));
    return { gone: false, inZone: d < m.zone.w * 0.3 && !m.finished && m.t > 0.45, finished: m.finished };
  });
  if (st.gone) break;
  if (st.inZone) {
    await page.keyboard.press('Space');
    await wait(60);
  } else await wait(8);
}
await until('watch repaired', () => window.DM.dev.play().ctx.flags.repaired, { talk: false });
assert('watch repair minigame completes with real timing input', true);

await until('calibrate objective', () => /Calibrate/.test((window.DM.dev.play().hud.objective || {}).text || ''));
await moveTo(1185, 300);
await wait(150);
await page.keyboard.press('e');
await until('calibrated', () => window.DM.dev.play().ctx.flags.calibrated);
assert('calibrating hangs the coat in the chamber', (await flags()).coatHung);

await until('bring watch objective', () => /Bring Janey/.test((window.DM.dev.play().hud.objective || {}).text || ''));
await moveTo(330, 815);
await wait(150);
await page.keyboard.press('e');
await until('Jon remembers the coat', () => window.DM.dev.play().ctx.flags.needCoat && !window.DM.dev.play().dialog.active);
await until('coat objective', () => /coat/.test((window.DM.dev.play().hud.objective || {}).text || ''));
await moveTo(1680, 520);
await wait(150);
await page.keyboard.press('e');
await until('lockdown', () => window.DM.dev.play().ctx.flags.lockdown);
const doorShut = await ev(() => !window.DM.dev.play().ctx.refs.door.open);
assert('taking the coat seals the chamber door', doorShut);
await until('accident', () => window.DM.dev.play().ctx.flags.flashed, { timeout: 40000 });
assert('the countdown ends in the accident', true);
await until('prologue complete', () => window.DM.Engine.top().constructor.name === 'ChapterComplete', { timeout: 20000 });
assert('prologue completes', true);

// ---- Chapter I: deposits fill layers and Jon becomes Dr. Manhattan ---------------------
await ev(() => window.DM.dev.start('reassembly'));
await until('gather objective', () => /nervous/.test((window.DM.dev.play().hud.objective || {}).text || ''));
// Keep handing Jon a full load of atoms at the chamber until the body is complete.
for (let i = 0; i < 40; i++) {
  const form = await ev(() => {
    const play = window.DM.dev.play();
    const p = play.player;
    if (p.form !== 'awareness' || play.ctx.flags.reassembled) return p.form;
    p.carry = p.carryMax;
    p.x = 1200;
    p.y = 1260;
    return p.form;
  });
  if (form !== 'awareness') break;
  await wait(1600);
}
await until('becomes Dr. Manhattan', () => window.DM.dev.play().player.form === 'manhattan', { timeout: 30000 });
assert('rebuilding all four layers turns Jon into Dr. Manhattan', true);
await until('chapter I complete', () => window.DM.Engine.top().constructor.name === 'ChapterComplete', { timeout: 30000 });
assert('chapter I completes', true);

// ---- Chapter II: range objectives chain correctly ------------------------------------------
await ev(() => window.DM.dev.start('superman'));
await until('crates objective', () => /crates/.test((window.DM.dev.play().hud.objective || {}).text || ''));
await ev(() => {
  const play = window.DM.dev.play();
  const z = play.ctx.refs.zone;
  play.world.entities.filter((e) => e.tags.has('crate')).slice(0, 5).forEach((c, i) => {
    c.x = z.x + (i - 2) * 12;
    c.y = z.y;
  });
});
await until('jeep objective', () => /jeep/.test((window.DM.dev.play().hud.objective || {}).text || ''));
assert('five crates in the zone completes the first trial', true);
await ev(() => {
  const play = window.DM.dev.play();
  const z = play.ctx.refs.zone, j = play.ctx.refs.jeep;
  j.x = z.x;
  j.y = z.y;
  j.vx = j.vy = 0;
});
await until('targets objective', () => /targets/.test((window.DM.dev.play().hud.objective || {}).text || ''));
assert('jeep in the zone unlocks Disintegrate', (await state()).powers.includes('disintegrate'));
await ev(() => window.DM.dev.play().ctx.refs.dummies.forEach((d) => d.disintegrate(window.DM.dev.play().world)));
await until('pier', () => window.DM.dev.play().ctx.mapName === 'pier', { timeout: 30000 });
assert('clearing the targets moves the story to New York', true);

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll story flow checks passed.');
process.exit(failures ? 1 : 0);
