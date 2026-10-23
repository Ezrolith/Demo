/*
 * Combat impact & the spare/kill ledger: one 'enemy:down' per person, only
 * Disintegrate kills, hitstop and scripted slow motion, screen shake, player
 * hit feedback, knockouts vs unbindings, gangster telegraphs, decoherence.
 *
 *   node tests/ledger.mjs
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

let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

// Close dialogue and power cards until the stage hands over control.
async function clearTalk(n = 14) {
  for (let i = 0; i < n; i++) {
    const s = await ev(() => {
      const st = window.DM.dev.state();
      const play = window.DM.dev.play();
      return { dialog: st.dialog, scene: st.scene, locked: !!(play && play.ctx.locked) };
    });
    if (s.dialog || s.scene === 'PowerUnlock') await page.keyboard.press('e');
    else if (!s.locked) return;
    await wait(250);
  }
}

await page.mouse.click(640, 360);

// ---- 1. The ledger in the pier yard ------------------------------------------------
await ev(() => window.DM.dev.start('superman', 1));
await wait(1200);
await clearTalk();
await ev(() => (window.DM.dev.play().player.godMode = true));

// (a) A gangster thrown diagonally into the pier's top-left corner hits two walls
// in quick succession, and goes down exactly once.
const corner = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world;
  const before = { ...play.ctx.stats };
  const g = W.add(new DM.Enemies.Gangster({ x: 140, y: 120, sight: 1 }));
  const downs = [];
  const off = DM.Events.on('enemy:down', (e) => {
    if (e.enemy === g) downs.push(e.lethal ? 'lethal' : 'spared');
  });
  g.thrown = 1;
  g.stun = 1;
  g.vx = -820;
  g.vy = -760;
  await new Promise((r) => setTimeout(r, 1200));
  off();
  const st = play.ctx.stats;
  return { downs, ko: g.ko, dead: g.dead, spared: st.spared - before.spared, gone: st.disintegrated - before.disintegrated };
});
assert('a corner throw emits exactly one enemy:down (spared)', corner.downs.length === 1 && corner.downs[0] === 'spared' && corner.ko && !corner.dead && corner.spared === 1 && corner.gone === 0, JSON.stringify(corner));

// The SPARED · GONE tally under the objective counts it.
const tally = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  await new Promise((r) => setTimeout(r, 300));
  const texts = [];
  const text = DM.Gfx.text;
  DM.Gfx.text = function (ctx, t) {
    texts.push(String(t));
    return text.apply(this, arguments);
  };
  try {
    DM.Feedback.render(DM.Engine.ctx, play);
  } finally {
    DM.Gfx.text = text;
  }
  return { texts, spared: play.ctx.stats.spared, gone: play.ctx.stats.disintegrated };
});
assert('the pier yard tally reads SPARED n · GONE n', tally.texts.includes('SPARED ') && tally.texts.includes(String(tally.spared)) && tally.texts.some((t) => t.includes('GONE')), tally.texts.join('|'));

// ---- sandbox for the rest -------------------------------------------------------------
await ev(() => {
  const DM = window.DM;
  DM.Chapters.register({
    id: '__ledger', numeral: 'TEST', title: 'Ledger', date: '', place: '', clock: 0, color: '#333', music: null, form: 'manhattan',
    maps: {
      t: () => {
        const W = new DM.World({ w: 1600, h: 1000, zoom: 1 });
        W.room(0, 0, 1600, 1000, { t: 20 });
        W.spawn = { x: 400, y: 500 };
        return W;
      },
    },
    stages: [{
      id: 't', map: 't',
      run: function* (ctx) {
        for (const id of ['telekinesis', 'disintegrate', 'teleport', 'duplicate', 'timesight', 'expand']) ctx.player.unlock(id);
        while (true) yield;
      },
    }],
  });
  DM.dev.start('__ledger');
});
await wait(600);

const fresh = () => ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  for (const e of W.entities) if (e !== p) e.dead = true;
  W.particles.list.length = 0;
  W.freezeT = 0;
  W.slowmoT = 0;
  W.timeScale = 1;
  Object.assign(p, { x: 400, y: 500, vx: 0, vy: 0, energy: 100, coherence: 100, invuln: 0, down: false, hidden: false, godMode: false, hurtDirs: [], hurtFlash: null });
  for (const s of Object.values(p.powers)) s.cd = 0;
  W.camera.trauma = 0;
  W.camera.kx = W.camera.ky = 0;
});
const screenOf = (x, y) => ev(([x, y]) => window.DM.dev.play().world.camera.toScreen(x, y), [x, y]);

// (b) A knocked-out man caught in a barrel blast is not counted again.
await fresh();
await wait(100);
const barrelKO = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world;
  const g = W.add(new DM.Enemies.Gangster({ x: 800, y: 300, sight: 1 }));
  g.die('impact');
  const afterKO = { ...play.ctx.stats };
  const bar = W.add(new DM.Props.Barrel(g.x + 20, g.y));
  bar.damage(99, null, 'impact');
  await new Promise((r) => setTimeout(r, 400));
  const st = play.ctx.stats;
  return { same: st.spared === afterKO.spared && st.disintegrated === afterKO.disintegrated, ko: g.ko, dead: g.dead, barrel: bar.dead, hp: g.hp };
});
assert('a barrel exploding beside a knocked-out man leaves the ledger unchanged', barrelKO.same && barrelKO.ko && !barrelKO.dead && barrelKO.barrel, JSON.stringify(barrelKO));

// (c) A barrel blast on a live gangster knocks him out: spared, not gone.
await fresh();
await wait(100);
const barrelLive = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world;
  const before = { ...play.ctx.stats };
  const g = W.add(new DM.Enemies.Gangster({ x: 800, y: 300, sight: 1 }));
  g.hp = 20;
  const kinds = [];
  const off = DM.Events.on('enemy:down', (e) => e.enemy === g && kinds.push(e.kind + (e.lethal ? ':lethal' : ':spared')));
  const bar = W.add(new DM.Props.Barrel(g.x + 24, g.y));
  bar.damage(99, null, 'impact');
  await new Promise((r) => setTimeout(r, 400));
  off();
  const st = play.ctx.stats;
  return { kinds, spared: st.spared - before.spared, gone: st.disintegrated - before.disintegrated, ko: g.ko, dead: g.dead };
});
assert('a barrel explosion on a live gangster gives spared +1, disintegrated 0', barrelLive.spared === 1 && barrelLive.gone === 0 && barrelLive.ko && !barrelLive.dead, JSON.stringify(barrelLive));

// (d) Q on a gangster: gone, and the world freezes on the frame he goes.
await fresh();
await wait(100);
await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world;
  const g = (window.__g = W.add(new DM.Enemies.Gangster({ x: 640, y: 500, sight: 1 })));
  g.stun = 5;
  window.__before = { ...play.ctx.stats };
  window.__freezeAtDeath = null;
  const update = W.update;
  W.update = function (dt) {
    update.call(this, dt);
    if (g.dead && window.__freezeAtDeath == null) window.__freezeAtDeath = this.freezeT || 0;
  };
  window.__unbind = 0;
  const offAdd = W.add;
  W.add = function (e) {
    if (e instanceof DM.FX.Unbinding) window.__unbind++;
    return offAdd.call(this, e);
  };
});
let s = await screenOf(640, 500);
await page.mouse.move(s.x, s.y);
await wait(80);
await page.keyboard.press('q');
await wait(700);
const qKill = await ev(() => {
  const play = window.DM.dev.play();
  const st = play.ctx.stats, b = window.__before;
  return { dead: window.__g.dead, ko: window.__g.ko, gone: st.disintegrated - b.disintegrated, spared: st.spared - b.spared, freeze: window.__freezeAtDeath, unbind: window.__unbind };
});
assert('Q on a gangster gives disintegrated +1', qKill.dead && !qKill.ko && qKill.gone === 1 && qKill.spared === 0, JSON.stringify(qKill));
assert('a disintegration freezes the world on the frame it resolves (hitstop)', qKill.freeze > 0, `freezeT ${qKill.freeze}`);
assert('the disintegrated gangster comes apart as an Unbinding', qKill.unbind >= 1, `${qKill.unbind} unbinding(s)`);

// ---- 2. Hitstop & slow motion --------------------------------------------------------------
await fresh();
await wait(100);
const freeze = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world;
  const c = W.add(new DM.Props.Crate(700, 300));
  c.vx = 300;
  W.particles.emit(600, 600, { vx: 200, vy: 0, life: 2, size: 3, drag: 0 });
  const pt = W.particles.list[W.particles.list.length - 1];
  const x0 = c.x, px0 = pt.x;
  W.hitstop(0.1);
  for (let i = 0; i < 3; i++) W.update(1 / 60);
  const frozen = { crateDx: c.x - x0, particleDx: pt.x - px0, freezeT: W.freezeT };
  for (let i = 0; i < 6; i++) W.update(1 / 60);
  frozen.crateDxAfter = c.x - x0;
  return frozen;
});
assert('hitstop: after 3 frames a moving crate has not moved, particles still drift', freeze.crateDx === 0 && freeze.particleDx > 0, JSON.stringify(freeze));
assert('hitstop ends on its own and the world moves again', freeze.crateDxAfter > 0, `crate moved ${freeze.crateDxAfter.toFixed(1)}px`);

const caps = await ev(() => {
  const W = window.DM.dev.play().world;
  W.freezeT = 0;
  W.hitstop(5);
  const capped = W.freezeT;
  W.hitstop(0.03);
  const kept = W.freezeT;
  W.freezeT = 0;
  return { capped, kept };
});
assert('hitstop is capped at 0.2 s and the longest request wins', caps.capped === 0.2 && caps.kept === 0.2, JSON.stringify(caps));

const slowmo = await ev(() => {
  const W = window.DM.dev.play().world;
  W.slowmoT = 0.5;
  W.slowmoTarget = 0.3;
  for (let i = 0; i < 20; i++) W.update(1 / 60);
  const during = W.timeScale;
  for (let i = 0; i < 60; i++) W.update(1 / 60);
  return { during, after: W.timeScale, sight: W.sightScale };
});
assert('scripted slow motion (slowmoT/slowmoTarget) slows the world, then lets go', slowmo.during < 0.4 && slowmo.after > 0.9 && slowmo.sight > 0.95, JSON.stringify(slowmo));

await ev(() => (window.DM.dev.play().world.slowmoScale = 0.6));
await page.keyboard.down('f');
await wait(700);
const sightScale = await ev(() => window.DM.dev.play().world.timeScale);
await page.keyboard.up('f');
await ev(() => (window.DM.dev.play().world.slowmoScale = null));
await wait(600);
assert('world.slowmoScale sets how slow Temporal Sight runs', Math.abs(sightScale - 0.6) < 0.03, `timeScale ${sightScale.toFixed(2)}`);

// With screen shake OFF there is no hitstop and no shake at all.
await fresh();
const noShake = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, cam = W.camera, p = play.player;
  const saved = DM.Save.settings.shake;
  DM.Save.settings.shake = 0;
  try {
    W.freezeT = 0;
    W.hitstop(0.1);
    const g = W.add(new DM.Enemies.Gangster({ x: 900, y: 800, sight: 1 }));
    g.disintegrate(W, p);
    const freezeT = W.freezeT || 0;
    let mx = 0;
    cam.shake(0.8);
    cam.kick(1, 0, 10);
    p.damage(10, { x: p.x - 30, y: p.y, vx: 600, vy: 0 }, 'bullet');
    W.explode(cam.x, cam.y, 95, 0, {});
    for (let i = 0; i < 30; i++) {
      cam.update(1 / 60);
      mx = Math.max(mx, Math.abs(cam.ox), Math.abs(cam.oy));
    }
    return { freezeT, mx };
  } finally {
    DM.Save.settings.shake = saved;
  }
});
assert('with SCREEN SHAKE off, freezeT stays 0', noShake.freezeT === 0, `freezeT ${noShake.freezeT}`);
assert('with SCREEN SHAKE off, every shake probe reads 0 px', noShake.mx === 0, `${noShake.mx}px`);

// ---- 3. Screen shake ---------------------------------------------------------------------------
// Peak offset over 0.5 s, median of 30 tries at random noise phases.
await fresh();
const shake = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, cam = W.camera, p = play.player;
  const probe = (fire) => {
    const peaks = [];
    for (let k = 0; k < 30; k++) {
      cam.trauma = 0;
      cam.kx = cam.ky = 0;
      cam.t = Math.random() * 100;
      fire();
      let mx = 0;
      for (let i = 0; i < 30; i++) {
        cam.update(1 / 60);
        mx = Math.max(mx, Math.abs(cam.ox), Math.abs(cam.oy));
      }
      peaks.push(mx);
    }
    peaks.sort((a, b) => a - b);
    return +peaks[15].toFixed(2);
  };
  const out = {
    playerHit: probe(() => {
      Object.assign(p, { invuln: 0, coherence: 100, locked: false });
      p.damage(6, { x: p.x - 30, y: p.y, vx: 560, vy: 0 }, 'bullet');
    }),
    explosion70: probe(() => W.explode(cam.x, cam.y, 70, 0, {})),
    expand: probe(() => cam.shake(0.6)),
    max: probe(() => cam.shake(5)),
  };
  W.freezeT = 0;
  p.coherence = 100;
  return out;
});
assert('a 6-damage bullet shakes the view 2-4 px', shake.playerHit >= 2 && shake.playerHit <= 4, `${shake.playerHit}px`);
assert('an r70 explosion shakes the view 5-8 px', shake.explosion70 >= 5 && shake.explosion70 <= 8, `${shake.explosion70}px`);
assert('Expand (trauma 0.6) stays within 15 px, and nothing exceeds 22 px', shake.expand <= 15 && shake.max <= 22, `expand ${shake.expand}px, max ${shake.max}px`);

const kick = await ev(() => {
  const cam = window.DM.dev.play().world.camera;
  cam.trauma = 0;
  cam.kx = cam.ky = 0;
  cam.kick(-1, 0, 6);
  cam.update(1 / 60);
  const first = cam.ox;
  for (let i = 0; i < 20; i++) cam.update(1 / 60);
  return { first, later: cam.ox };
});
assert('Camera.kick shoves the view along a direction and springs back', kick.first < -4 && Math.abs(kick.later) < 0.5, JSON.stringify(kick));

// ---- 4. Player hit feedback --------------------------------------------------------------
await fresh();
await wait(300);
const hitFx = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  const g = DM.Engine.ctx;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  // Redness (r - max(g, b)) at the arc on Jon's left and at the screen edges.
  const sample = () => {
    const s = W.camera.toScreen(p.x, p.y);
    const R = 70 * Math.max(1, W.camera.zoom * p.scale * 0.8);
    let arc = -255;
    for (let a = -0.2; a <= 0.2; a += 0.1) {
      for (let dr = -4; dr <= 4; dr += 2) {
        const x = Math.round(s.x + Math.cos(Math.PI + a) * (R + dr)), y = Math.round(s.y + Math.sin(Math.PI + a) * (R + dr));
        const d = g.getImageData(x, y, 1, 1).data;
        arc = Math.max(arc, d[0] - Math.max(d[1], d[2]));
      }
    }
    let right = -255;
    for (let a = -0.2; a <= 0.2; a += 0.1) {
      const d = g.getImageData(Math.round(s.x + Math.cos(a) * R), Math.round(s.y + Math.sin(a) * R), 1, 1).data;
      right = Math.max(right, d[0] - Math.max(d[1], d[2]));
    }
    let edge = 0;
    for (const [x, y] of [[30, 360], [1250, 360], [640, 20], [640, 700], [30, 200], [1250, 520]]) {
      const d = g.getImageData(x, y, 1, 1).data;
      edge += (d[0] - Math.max(d[1], d[2])) / 6;
    }
    return { arc, right, edge };
  };
  await frame();
  const before = sample();
  W.add(new DM.Proj.Bullet({ x: p.x - 40, y: p.y, vx: 600, vy: 0, team: 'enemy', dmg: 10 }));
  const t0 = performance.now();
  while (p.coherence >= 100 && performance.now() - t0 < 500) await frame();
  const hitAt = performance.now();
  await new Promise((r) => setTimeout(r, 50));
  await frame();
  const after = sample();
  return { before, after, coherence: p.coherence, dirs: p.hurtDirs.length, angle: p.hurtDirs[0] && p.hurtDirs[0].angle, lastHit: p.lastHit, ms: Math.round(performance.now() - hitAt) };
});
assert('a bullet from the left draws a red arc on Jon\'s left side', hitFx.after.arc - hitFx.before.arc > 60 && hitFx.after.right - hitFx.before.right < 30 && Math.abs(Math.abs(hitFx.angle) - Math.PI) < 0.2,
  `arc redness ${hitFx.before.arc} → ${hitFx.after.arc}, right side ${hitFx.before.right} → ${hitFx.after.right}, ${hitFx.ms} ms after the hit`);
assert('the screen edges flash red on a hit', hitFx.after.edge - hitFx.before.edge > 6, `edge redness ${hitFx.before.edge.toFixed(1)} → ${hitFx.after.edge.toFixed(1)}`);
assert('Player.lastHit records what hit him', hitFx.lastHit && hitFx.lastHit.kind === 'bullet' && hitFx.lastHit.by === 'Bullet', JSON.stringify(hitFx.lastHit));

// FLASHING LIGHTS: REDUCED keeps the edge flash dim.
await fresh();
const flashPeak = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const p = play.player;
  const ctx = DM.Engine.ctx;
  const peak = (mode) => {
    DM.Save.settings.flashing = mode;
    p.invuln = 0;
    p.coherence = 100;
    p.damage(40, { x: p.x - 30, y: p.y }, 'explosion');
    let a = 0;
    const draw = ctx.drawImage;
    ctx.drawImage = function () {
      a = Math.max(a, ctx.globalAlpha);
      return draw.apply(this, arguments);
    };
    try {
      DM.Feedback.renderHurt(ctx, play.world, p);
    } finally {
      ctx.drawImage = draw;
    }
    return +a.toFixed(3);
  };
  const saved = DM.Save.settings.flashing;
  const r = { full: peak('full'), reduced: peak('reduced') };
  DM.Save.settings.flashing = saved;
  play.world.freezeT = 0;
  p.coherence = 100;
  return r;
});
assert('with FLASHING LIGHTS reduced the red edge flash stays dim', flashPeak.full > 0.3 && flashPeak.reduced > 0 && flashPeak.reduced <= 0.15, JSON.stringify(flashPeak));

await fresh();
await wait(100);
const volley = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  const c0 = p.coherence;
  for (let i = 0; i < 3; i++) W.add(new DM.Proj.Bullet({ x: p.x - 30, y: p.y + (i - 1) * 2, vx: 600, vy: 0, team: 'enemy', dmg: 6 }));
  await new Promise((r) => setTimeout(r, 300));
  return { lost: +(c0 - p.coherence).toFixed(2), left: W.entities.filter((e) => e instanceof DM.Proj.Bullet && !e.dead).length };
});
assert('three bullets in the same frame cost 6 coherence, not 18', volley.lost === 6, JSON.stringify(volley));

await fresh();
await ev(() => window.DM.dev.play().dialog.open([['manhattan', 'A moment of quiet.']]));
await wait(150);
const talk = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  const c0 = p.coherence;
  W.add(new DM.Proj.Bullet({ x: p.x - 60, y: p.y, vx: 600, vy: 0, team: 'enemy', dmg: 10 }));
  await new Promise((r) => setTimeout(r, 300));
  const r = { c0, c1: p.coherence, locked: p.locked, dialog: play.dialog.active };
  play.dialog.close();
  return r;
});
assert('a bullet fired while a dialog is open does no damage', talk.dialog && talk.locked && talk.c1 === talk.c0, JSON.stringify(talk));

await fresh();
await wait(150);
const hooks = await ev(() => {
  const p = window.DM.dev.play().player;
  const keep = [p.damageMul, p.regenDelayBase];
  p.damageMul = 0.5;
  p.regenDelayBase = 1.2;
  p.damage(10, null, 'test');
  const r = { lost: 100 - p.coherence, regenDelay: p.regenDelay };
  [p.damageMul, p.regenDelayBase] = keep;
  return r;
});
assert('Player.damage honours damageMul and regenDelayBase (challenge levels)', hooks.lost === 5 && hooks.regenDelay === 1.2, JSON.stringify(hooks));

// ---- 5. Spared vs gone ----------------------------------------------------------------------
await fresh();
await wait(100);
const ko = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world;
  const g = W.add(new DM.Enemies.Gangster({ x: 800, y: 500, sight: 1 }));
  g.vx = 200;
  g.thrown = 0.5;
  g.stun = 0.5;
  g.die('impact');
  const state = { thrown: g.thrown, stun: g.stun, vx: g.vx };
  const gun = W.entities.find((e) => e instanceof DM.FX.DroppedGun);
  const tag = W.entities.find((e) => e instanceof DM.FX.FloatText);
  const g0 = gun && { x: gun.x, y: gun.y };
  // A second knockout or a disintegration of the body is impossible.
  const again = g.damage(99, null, 'explosion');
  g.die('impact');
  g.disintegrate(W, play.player);
  await new Promise((r) => setTimeout(r, 1000));
  return { state, gun: !!gun, slid: gun ? Math.round(Math.hypot(gun.x - g0.x, gun.y - g0.y)) : null, gunStays: gun && !gun.dead, tag: tag && tag.text, again, dead: g.dead, ko: g.ko };
});
assert('a knockout clears thrown/stun and halves the velocity', ko.state.thrown === 0 && ko.state.stun === 0 && ko.state.vx === 100, JSON.stringify(ko.state));
assert('a knocked-out body takes no more damage and cannot be disintegrated', ko.again === false && ko.ko && !ko.dead, JSON.stringify({ again: ko.again, ko: ko.ko, dead: ko.dead }));
assert('a knockout drops his gun (it slides 30-60 px and stays) and floats a "spared" tag', ko.gun && ko.slid >= 25 && ko.slid <= 65 && ko.gunStays && ko.tag === 'spared', JSON.stringify({ slid: ko.slid, tag: ko.tag }));

await fresh();
await wait(100);
const unbind = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  const look = DM.LOOKS.randomGangster();
  const g = W.add(new DM.Enemies.Gangster({ x: 800, y: 500, sight: 1, look }));
  g.disintegrate(W, p);
  const u = W.entities.find((e) => e instanceof DM.FX.Unbinding);
  if (!u) return { found: false };
  const n = u.snap.n;
  const facing = [];
  // The side facing Jon (smaller x here) lets go first.
  let near = 0, far = 0, cn = 0, cf = 0;
  for (let i = 0; i < n; i++) {
    if (u.snap.xs[i] * u.ca - u.snap.ys[i] * u.sa < 0) { near += u.delay[i]; cn++; } else { far += u.delay[i]; cf++; }
  }
  facing.push(near / cn, far / cf);
  const t0 = performance.now();
  let gone = null;
  while (performance.now() - t0 < 1500) {
    await new Promise((r) => requestAnimationFrame(r));
    if (u.dead && gone == null) gone = (performance.now() - t0) / 1000;
  }
  return { found: true, cells: n, nearDelay: +facing[0].toFixed(3), farDelay: +facing[1].toFixed(3), gone };
});
assert('a disintegrated gangster unbinds cell by cell (≤ 600 cells), from the side facing Jon, in about 0.6 s', unbind.found && unbind.cells > 50 && unbind.cells <= 600 && unbind.nearDelay < unbind.farDelay && unbind.gone > 0.3 && unbind.gone < 1.0, JSON.stringify(unbind));

// Frame cost of a kill with a cached snapshot vs a plain frame, timed on the
// game's own loop (update + render of each real frame).
await fresh();
await wait(100);
const cost = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  const E = DM.Engine;
  const look = DM.LOOKS.randomGangster();
  const times = [];
  const frame = E.frame;
  E.frame = function (t) {
    const t0 = performance.now();
    frame.call(this, t);
    times.push(performance.now() - t0);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  try {
    // The first kill of a look snapshots it; later kills reuse the cells.
    const g0 = W.add(new DM.Enemies.Gangster({ x: 900, y: 300, sight: 1, look }));
    await sleep(100);
    let n0 = times.length;
    g0.disintegrate(W, p);
    await sleep(800);
    const first = Math.max(...times.slice(n0));
    const base = [], kill = [];
    for (let k = 0; k < 6; k++) {
      n0 = times.length;
      const g = W.add(new DM.Enemies.Gangster({ x: 640 + k * 50, y: 650, sight: 1, look }));
      await sleep(300);
      base.push(...times.slice(n0));
      n0 = times.length;
      g.disintegrate(W, p);
      await sleep(800);
      kill.push(Math.max(...times.slice(n0)));
    }
    return { base: +med(base).toFixed(2), kill: +med(kill).toFixed(2), first: +first.toFixed(2) };
  } finally {
    E.frame = frame;
  }
});
assert('a kill (cached snapshot) costs at most 3 ms over a plain frame', cost.kill - cost.base <= 3, `plain frame ${cost.base} ms, worst frame after a kill ${cost.kill} ms (medians); first kill of a look ${cost.first} ms`);

// ---- 6. Gangster telegraphs -----------------------------------------------------------------
await fresh();
await wait(100);
const aimLine = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  const out = [];
  for (const [dx, dy, gun] of [[300, 80, 'pistol'], [390, -40, 'pistol'], [200, 120, 'pistol']]) {
    const g = W.add(new DM.Enemies.Gangster({ x: p.x + dx, y: p.y + dy, sight: 1, gun }));
    g.target = p;
    g.facing = DM.U.angleTo(g.x, g.y, p.x, p.y);
    g.aim = g.aimTime * 0.5;
    const lines = [];
    const line = DM.Gfx.line;
    DM.Gfx.line = function (ctx, x1, y1, x2, y2) {
      lines.push([x2, y2]);
      return line.apply(this, arguments);
    };
    try {
      g.renderEmissive(DM.Engine.ctx, W);
    } finally {
      DM.Gfx.line = line;
    }
    // Where the sight lines meet (their ends' midpoint) vs where Jon stands.
    const ex = lines.reduce((a, l) => a + l[0], 0) / lines.length, ey = lines.reduce((a, l) => a + l[1], 0) / lines.length;
    out.push({ dist: Math.round(Math.hypot(dx, dy)), lines: lines.length, end: lines.length ? Math.round(Math.hypot(ex - p.x, ey - p.y)) : null });
    g.dead = true;
  }
  return out;
});
assert('the aim line ends within 30 px of Jon at any range', aimLine.every((a) => a.lines >= 1 && a.end != null && a.end <= 30), JSON.stringify(aimLine));

await fresh();
await wait(100);
const flinch = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  p.godMode = true;
  const g = W.add(new DM.Enemies.Gangster({ x: 700, y: 500, sight: 1000 }));
  g.target = p;
  g.alerted = true;
  g.retarget = 99;
  g.facing = Math.PI;
  g.fireCd = 9;
  g.aim = 0.15; // a moment from firing
  let aimAfter = null;
  const damage = g.damage;
  g.damage = function () {
    const r = damage.apply(this, arguments);
    aimAfter = this.aim;
    return r;
  };
  W.add(new DM.Proj.Bolt({ x: g.x - 30, y: g.y, vx: 640, vy: 0 }));
  const t0 = performance.now();
  while (aimAfter == null && performance.now() - t0 < 500) await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 60));
  const r = { aimAfter, aimTime: g.aimTime, aimLater: g.aim, ko: g.ko, hp: g.hp };
  p.godMode = false;
  return r;
});
assert('a gangster mid-aim hit by a Duplicate bolt has his aim set back', flinch.aimAfter != null && flinch.aimAfter >= flinch.aimTime * 0.6 - 1e-6 && flinch.aimLater > 0.2 && !flinch.ko, JSON.stringify(flinch));

const contrast = await ev(() => {
  const DM = window.DM;
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const floor = lum('#2b2d33');
  const suits = new Set();
  for (let i = 0; i < 300; i++) suits.add(DM.LOOKS.randomGangster().body);
  let min = Infinity;
  for (const s of suits) {
    const l = lum(s);
    min = Math.min(min, (Math.max(l, floor) + 0.05) / (Math.min(l, floor) + 0.05));
  }
  return { suits: suits.size, min: +min.toFixed(2) };
});
assert('every gangster suit has a luminance contrast of at least 1.6 against #2b2d33', contrast.min >= 1.6, JSON.stringify(contrast));

// ---- 7. Decoherence -------------------------------------------------------------------------
await fresh();
await ev(() => {
  const DM = window.DM;
  const W = DM.dev.play().world;
  for (const [x, y] of [[330, 380], [470, 380], [330, 620], [470, 620]]) W.add(new DM.Props.Barrel(x, y));
});
await wait(400);
const deco = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  const W = play.world, p = play.player;
  const g = DM.Engine.ctx;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  // Mean saturation of the play area (HUD excluded: it is drawn on top).
  const saturation = () => {
    const d = g.getImageData(160, 140, 960, 400).data;
    let sum = 0, n = 0;
    for (let y = 0; y < 400; y += 8) {
      for (let x = 0; x < 960; x += 8) {
        const i = (y * 960 + x) * 4;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        if (mx < 24) continue;
        sum += (mx - mn) / mx;
        n++;
      }
    }
    return n ? sum / n : 0;
  };
  const shooter = W.add(new DM.Enemies.Gangster({ x: 640, y: 500, sight: 1000, gun: 'tommy' }));
  shooter.fireCd = 0.2;
  await frame();
  const sat0 = saturation();
  let downAt = null;
  let added = 0;
  const add = W.add;
  W.add = function (e) {
    if (downAt != null && e.isProjectile && e.team === 'enemy') added++;
    return add.call(this, e);
  };
  const off = DM.Events.on('player:down', () => (downAt = performance.now()));
  p.coherence = 1;
  p.invuln = 0;
  W.add(new DM.Proj.Bullet({ x: p.x - 40, y: p.y, vx: 600, vy: 0, team: 'enemy', dmg: 6 }));
  let minTs = 1, cloud = 0, sat1 = null;
  const t0 = performance.now();
  while (performance.now() - t0 < 2600) {
    await frame();
    if (downAt == null) continue;
    const el = performance.now() - downAt;
    if (el <= 300) minTs = Math.min(minTs, W.timeScale);
    if (sat1 == null && el > 1200) {
      sat1 = saturation();
      cloud = W.particles.list.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 220 && q.color && /^#(7fe3ff|5fd4ff|ffffff)$/i.test(q.color)).length;
    }
    if (el > 1800 && DM.Engine.top() !== play) break;
  }
  off();
  W.add = add;
  return { down: downAt != null, failed: play.failed, minTs: +minTs.toFixed(2), added, sat0: +sat0.toFixed(3), sat1: sat1 == null ? null : +sat1.toFixed(3), cloud, top: DM.Engine.top().constructor.name };
});
assert('on decoherence the world drops below 0.4x speed within 0.3 s', deco.down && deco.minTs < 0.4, `timeScale ${deco.minTs}`);
assert('no enemy projectile is fired while Jon comes apart', deco.down && deco.added === 0, `${deco.added} added`);
assert('the picture drains of colour and Jon\'s atoms hang in a cloud', deco.sat1 != null && deco.sat1 < deco.sat0 * 0.55 && deco.cloud >= 30, `saturation ${deco.sat0} → ${deco.sat1}, ${deco.cloud} particles nearby`);
assert('the Game Over screen follows', deco.top === 'GameOver', deco.top);

await ev(() => {
  const DM = window.DM;
  window.__implode = [];
  const implode = DM.Particles.prototype.implode;
  DM.Particles.prototype.implode = function (x, y, r, n) {
    window.__implode.push({ r, n });
    return implode.apply(this, arguments);
  };
  window.__beginInvuln = null;
  DM.Events.on('play:begin', (e) => {
    if (e.retry) window.__beginInvuln = e.scene.player.invuln;
  });
});
await wait(900); // the Game Over menu takes input after 0.6 s
await page.keyboard.press('Enter');
await wait(1600);
const reassemble = await ev(() => ({ scene: window.DM.dev.state().scene, implode: window.__implode, invuln: window.__beginInvuln }));
assert('REASSEMBLE plays the implode and grants a moment of invulnerability', reassemble.scene === 'Play' && reassemble.implode.some((c) => c.r === 160 && c.n === 80) && reassemble.invuln >= 0.6, JSON.stringify(reassemble));

// ---- 8. A Chapter III wave holds the frame budget ------------------------------------------
await ev(() => window.DM.dev.start('deterrent', 1));
await wait(1000);
await clearTalk();
const perf = await ev(async () => {
  const DM = window.DM;
  const play = DM.dev.play();
  play.player.godMode = true;
  const E = DM.Engine;
  const times = [];
  const render = E.render;
  E.render = function () {
    const t = performance.now();
    render.apply(this, arguments);
    times.push(performance.now() - t);
  };
  const upd = play.update;
  const ut = [];
  play.update = function (dt) {
    const t = performance.now();
    upd.call(this, dt);
    ut.push(performance.now() - t);
  };
  const t0 = performance.now();
  let kills = 0;
  while (performance.now() - t0 < 5000) {
    await new Promise((r) => setTimeout(r, 400));
    const W = play.world;
    const e = W.entities.find((x) => x instanceof DM.Enemies.Enemy && !x.dead && !x.ko && x !== W.boss);
    if (e) {
      e.disintegrate(W, play.player);
      kills++;
    }
  }
  E.render = render;
  delete play.update;
  const n = Math.min(times.length, ut.length);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(times[i] + ut[i]);
  frames.sort((a, b) => a - b);
  return { frames: n, p90: +frames[Math.floor(n * 0.9)].toFixed(2), fps: Math.round(E.fps), kills, entities: play.world.entities.length };
});
assert('a Chapter III wave with kills fits the 60 fps frame budget', perf.p90 < 16.7, `p90 update+render ${perf.p90} ms over ${perf.frames} frames, Engine.fps ${perf.fps}, ${perf.kills} kills`);

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll ledger & combat-feel checks passed.');
process.exit(failures ? 1 : 0);
