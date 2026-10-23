/*
 * Encounter test: enemy telegraphs, offscreen threat indicators, the Behemoth
 * and Veidt fights, tachyon clouds, Karnak's emitters and the minefield.
 *
 * The animation loop is paused and the test steps the engine itself at a fixed
 * 60 Hz, so timings are exact and a busy machine cannot make it flaky. Input
 * goes through DM.Input like a player's would.
 *
 *   node tests/encounters.mjs
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
await page.mouse.click(640, 360);
const ev = (fn, arg) => page.evaluate(fn, arg);

let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

// ---- fixed-step driver -------------------------------------------------------------
await ev(() => {
  const DM = window.DM;
  const E = DM.Engine;
  const frame = E.frame;
  const T = (window.__T = { on: false, t: performance.now(), hooks: [] });
  E.frame = function (t) {
    if (T.on) return void requestAnimationFrame((tt) => E.frame(tt));
    return frame.call(this, t);
  };
  // Advance `secs` of game time. render: draw the last frame (HUD state).
  window.__step = (secs, render) => {
    T.on = true;
    const n = Math.max(1, Math.round(secs * 60));
    const raf = window.requestAnimationFrame, draw = E.render;
    window.requestAnimationFrame = () => 0;
    try {
      for (let i = 0; i < n; i++) {
        T.t += 1000 / 60;
        for (const h of T.hooks) h('before');
        E.render = render && i === n - 1 ? draw : () => {};
        frame.call(E, T.t);
        for (const h of T.hooks) h('after');
        if (E.error) return String(E.error.stack || E.error);
      }
    } finally {
      window.requestAnimationFrame = raf;
      E.render = draw;
    }
    return null;
  };
  // A key tap, held for one frame.
  window.__tap = (code) => {
    DM.Input.simulate(code, true);
    window.__step(1 / 60);
    DM.Input.simulate(code, false);
  };
  // Point the mouse at a world position.
  window.__aim = (x, y) => {
    const s = DM.dev.play().world.camera.toScreen(x, y);
    DM.Input.mouse.x = s.x;
    DM.Input.mouse.y = s.y;
  };
  // Everything Audio.play is asked for.
  window.__sounds = [];
  const play = DM.Audio.play.bind(DM.Audio);
  DM.Audio.play = (name, o) => {
    window.__sounds.push(name);
    return play(name, o);
  };
});
const step = async (secs, render) => {
  const err = await ev(([s, r]) => window.__step(s, r), [secs, !!render]);
  if (err) throw new Error(err);
};
// Start a chapter stage and press E through its dialogue until Jon is free.
async function begin(chapter, stage) {
  await ev(([c, s]) => window.DM.dev.start(c, s), [chapter, stage]);
  await step(0.1);
  for (let i = 0; i < 200; i++) {
    const s = await ev(() => {
      const p = window.DM.dev.play();
      return { top: window.DM.Engine.top().constructor.name, dlg: p.dialog.active, locked: p.player.locked || p.ctx.locked, fading: window.DM.Engine.fading };
    });
    if (s.top === 'PowerUnlock' || s.dlg) await ev(() => window.__tap('KeyE'));
    else if (s.top === 'Play' && !s.locked && !s.fading) return;
    await step(0.2);
  }
  throw new Error(`could not get control in ${chapter} ${stage}`);
}

// ---- sandbox ------------------------------------------------------------------------
await ev(() => {
  const DM = window.DM;
  DM.Chapters.register({
    id: '__encounters', numeral: 'TEST', title: 'Encounters', date: '', place: '', clock: 0, color: '#333', music: null, form: 'manhattan',
    maps: {
      t: (ctx) => {
        const W = ctx.newWorld({ w: 3200, h: 2000, zoom: 1.15, bg: '#c49a62' });
        W.room(0, 0, 3200, 2000, { t: 20 });
        W.spawn = { x: 1200, y: 1000, facing: 0 };
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
});
await begin('__encounters', 0);

// 1. Telegraphs. The Battery winds up for 0.8 s (pod lights) before every missile.
const battery = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), W = play.world, p = play.player;
  p.godMode = true;
  const b = W.add(new DM.Enemies.Battery({ x: p.x + 420, y: p.y - 120 }));
  b.fireCd = 0.5;
  const st = (window.__bat = { aimRun: 0, launches: [] });
  window.__T.hooks.push((when) => {
    if (when === 'after') st.aimRun = b.aim > 0 ? st.aimRun + 1 / 60 : 0;
  });
  const add = W.add.bind(W);
  W.add = (e) => {
    if (e instanceof DM.Proj.Missile) st.launches.push(+st.aimRun.toFixed(3));
    return add(e);
  };
  window.__battery = b;
  return { aimTime: b.aimTime };
});
await step(14);
const bat = await ev(() => {
  window.__T.hooks.length = 0;
  const W = window.DM.dev.play().world;
  delete W.add;
  return Object.assign({ alarm: window.__sounds.includes('pod_alarm') }, window.__bat);
});
assert('the Battery aims for at least 0.7 s before each missile', bat.launches.length >= 2 && bat.launches.every((t) => t >= 0.7), `${bat.launches.length} launches after ${bat.launches.join(', ')} s of aiming`);
assert('the Battery plays its pod alarm when it starts aiming', bat.alarm);

const drone = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  window.__battery.dead = true;
  window.__sounds.length = 0;
  const d = play.world.add(new DM.Enemies.Drone({ x: p.x + 160, y: p.y - 120, alerted: true }));
  d.fireCd = 0.2;
  window.__drone = d;
  return d.aimTime;
});
let aimed = false;
for (let i = 0; i < 40 && !aimed; i++) {
  await step(0.05);
  aimed = await ev(() => window.__drone.aim > 0);
}
const dr = await ev(() => ({ charge: window.__sounds.includes('charge'), emissive: typeof window.__drone.renderEmissive === 'function' }));
assert('drones wind up for 0.5 s with a charge sound and an aim line', drone === 0.5 && aimed && dr.charge && dr.emissive, `aimTime ${drone}, aimed ${aimed}, charge ${dr.charge}`);

const tank = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  window.__drone.dead = true;
  window.__sounds.length = 0;
  const t = play.world.add(new DM.Enemies.Tank({ x: p.x + 330, y: p.y + 60, facing: Math.PI, alerted: true, sight: 1800, needLos: false }));
  t.turret = Math.PI + 0.2;
  t.fireCd = 0;
  window.__tank = t;
  return true;
});
let fired = false;
for (let i = 0; i < 60 && !fired; i++) {
  await step(0.05);
  fired = await ev(() => window.__tank.recoil > 0);
}
const tk = await ev(() => ({ cannon: window.__sounds.includes('cannon'), shot: window.__sounds.includes('shot'), recoil: window.__tank.recoil, flash: window.__tank.flashT }));
assert('the tank fires with a cannon sound, barrel recoil and a muzzle flash', fired && tk.cannon && !tk.shot && tk.flash > 0, JSON.stringify(tk));
await ev(() => { window.__tank.dead = true; });

// Bullets carry a dark underline, so they read on sand.
const underline = await ev(() => {
  const DM = window.DM;
  const c = document.createElement('canvas');
  c.width = 80;
  c.height = 40;
  const g = c.getContext('2d');
  g.fillStyle = '#c49a62';
  g.fillRect(0, 0, 80, 40);
  const b = new DM.Proj.Bullet({ x: 60, y: 20, vx: 560, vy: 0 });
  b.render(g);
  const px = g.getImageData(0, 0, 80, 40).data;
  let dark = 0, lit = 0;
  for (let i = 0; i < px.length; i += 4) {
    const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    if (l < 120) dark++;
    if (l > 200) lit++;
  }
  return { dark, lit };
});
assert('bullets draw a dark underline under the bright core', underline.dark > 10 && underline.lit > 10, JSON.stringify(underline));

// 2. Threat indicators.
const threat = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  const b = play.world.add(new DM.Enemies.Battery({ x: p.x + 700, y: p.y, alerted: true }));
  b.fireCd = 0;
  window.__b700 = b;
  return true;
});
let threatState = null;
for (let i = 0; i < 40; i++) {
  await step(0.05, true);
  threatState = await ev(() => {
    const play = window.DM.dev.play();
    const v = play.world.camera.view();
    const b = window.__b700;
    return { aim: b.aim, off: b.x > v.x1, n: play.hud.threatsDrawn, t: play.hud.threats.filter((t) => t.kind === 'aim').map((t) => ({ kind: t.kind, sx: Math.round(t.sx), sy: Math.round(t.sy) })) };
  });
  if (threatState.aim > 0) break;
}
const right = threatState.t[0];
assert('an aiming Battery 700 px to the right shows one red chevron on the right edge', threat && threatState.off && threatState.n === 1 && right.kind === 'aim' && right.sx > 1280 - 60, JSON.stringify(threatState));
await ev(() => window.DM.dev.play().ctx.lock(true));
await step(0.05, true);
const ceasefire = await ev(() => window.DM.dev.play().hud.threats.length);
await ev(() => window.DM.dev.play().ctx.lock(false));
assert('no threat indicators are drawn during a cutscene (ceasefire)', ceasefire === 0, `${ceasefire} drawn`);
const shellThreat = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  window.__b700.dead = true;
  play.world.add(new DM.Proj.Shell({ x: p.x - 900, y: p.y, tx: p.x + 30, ty: p.y, T: 2 }));
  return true;
});
await step(0.2, true);
const sh = await ev(() => window.DM.dev.play().hud.threats.map((t) => ({ kind: t.kind, culled: t.culled })));
assert('a shell coming down near Jon from offscreen gets an orange triangle and its impact ring', shellThreat && sh.some((t) => t.kind === 'shell' && t.culled), JSON.stringify(sh));
await step(2);
const last = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  window.__last = [-1, 1].map((s) => play.world.add(new DM.Enemies.Tank({ x: p.x + s * 900, y: p.y + 400, alerted: true, sight: 50 })));
  return true;
});
await step(0.1, true);
const lastN = await ev(() => window.DM.dev.play().hud.threats.filter((t) => t.kind === 'last').length);
assert("'last enemies': with three or fewer left, grey chevrons point to each offscreen one", last && lastN === 2, `${lastN} grey chevrons`);
await ev(() => { for (const t of window.__last) t.dead = true; });

// 3. Tachyon discs and clouds.
const disc = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  // Thrown at a point 40 px off Jon's shoulder: it misses, and must fly on to its full range.
  const d = play.world.add(new DM.Proj.TachyonDisc({ x: p.x - 300, y: p.y + 40, tx: p.x, ty: p.y + 40, range: 520 }));
  window.__disc = { x0: d.x, y0: d.y };
  return true;
});
await step(1.3);
const cloud = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  const c = play.world.entities.find((e) => e instanceof DM.Special.TachyonCloud);
  return c && { d: Math.round(Math.hypot(c.x - window.__disc.x0, c.y - window.__disc.y0)), fromJon: Math.round(Math.hypot(c.x - p.x, c.y - p.y)), r: c.r, life: +c.life.toFixed(2) };
});
assert('a missed disc flies on to its full range (520 px) before it bursts', disc && cloud && Math.abs(cloud.d - 520) < 12 && cloud.fromJon > 150, JSON.stringify(cloud));
const clouded = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  for (const e of play.world.entities) if (e instanceof DM.Special.TachyonCloud) e.dead = true;
  const c = play.world.add(new DM.Special.TachyonCloud(p.x, p.y));
  p.energy = 100;
  p.jamT = 0;
  DM.Input.simulate('KeyF', true);
  return { r: c.r, life: c.life };
});
await step(0.5);
const cl = await ev(() => {
  const play = window.DM.dev.play(), p = play.player;
  return { sightJamT: p.sightJamT, jamT: p.jamT, timesight: play.world.timesight, scale: play.world.sightFloor };
});
assert('tachyon clouds are 60 px and last 3 s', clouded.r === 60 && clouded.life === 3, JSON.stringify(clouded));
assert('inside a cloud Temporal Sight still works, at a weaker slow-down (sightFloor 0.6)', cl.sightJamT > 0 && cl.jamT === 0 && cl.timesight && cl.scale === 0.6, JSON.stringify(cl));
await ev(() => { window.DM.dev.play().player.jamT = 1; });
await step(0.1);
const jammed = await ev(() => window.DM.dev.play().world.timesight);
await ev(() => { window.DM.Input.simulate('KeyF', false); window.DM.dev.play().player.jamT = 0; });
await step(0.3);
const restored = await ev(() => window.DM.dev.play().world.sightFloor);
assert("an emitter's jamming (jamT) still blinds Sight", jammed === false);
assert('leaving Sight restores the default slow-down', restored !== 0.6, String(restored));

// 4. Mines: a 0.6 s fuse, 18 damage, set off by anything thrown or heavy, no chain reactions.
const mines = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), W = play.world, p = play.player;
  for (const e of W.entities) if (e instanceof DM.Special.TachyonCloud) e.dead = true;
  const m1 = W.add(new DM.Special.Mine(p.x + 300, p.y - 300));
  const crate = W.add(new DM.Props.Crate(p.x + 220, p.y - 300));
  crate.vx = 700;
  crate.thrown = 1;
  const m2 = W.add(new DM.Special.Mine(p.x - 300, p.y + 300));
  const t = W.add(new DM.Enemies.Tank({ x: p.x - 300, y: p.y + 350, sight: 10 }));
  const m3 = W.add(new DM.Special.Mine(p.x + 500, p.y + 200));
  const m4 = W.add(new DM.Special.Mine(p.x + 570, p.y + 200)); // 70 px from m3
  m3.arm();
  window.__mines = { m1, m2, m3, m4, t };
  return { hazard: m1.hazard };
});
await step(0.1);
const armed = await ev(() => { const M = window.__mines; return { crate: M.m1.trig, tank: M.m2.trig }; });
await step(0.6);
const blown = await ev(() => { const M = window.__mines; return { m1: M.m1.dead, m2: M.m2.dead, m3: M.m3.dead, m4: M.m4.dead, m4armed: M.m4.trig >= 0 }; });
assert('a thrown crate and a tank rolling over each set a mine off', armed.crate > 0.4 && armed.tank > 0.4 && blown.m1 && blown.m2, JSON.stringify({ armed, blown }));
assert('mines arm on a 0.6 s fuse and are flagged as hazards', mines.hazard && armed.crate <= 0.6 && armed.crate > 0.45);
assert('one mine going off does not set off its neighbour', blown.m3 && !blown.m4 && !blown.m4armed, JSON.stringify(blown));
const stepOn = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player;
  p.godMode = false;
  p.coherence = 100;
  p.invuln = 0;
  window.__mines.m4.dead = true;
  window.__mines.t.dead = true;
  const m = play.world.add(new DM.Special.Mine(p.x + 20, p.y));
  window.__m5 = m;
  return true;
});
await step(0.75);
const mineHit = await ev(() => { const p = window.DM.dev.play().player; const lost = 100 - p.coherence; p.godMode = true; return { lost: +lost.toFixed(1), dead: window.__m5.dead }; });
assert('standing on a mine costs 18 coherence', stepOn && mineHit.dead && mineHit.lost > 12 && mineHit.lost <= 18.5, JSON.stringify(mineHit));

// 5. The Behemoth.
await begin('deterrent', 3);
const beh = await ev(() => {
  const play = window.DM.dev.play();
  const b = play.world.boss;
  play.player.godMode = true;
  window.__b = b;
  return { hp: b.hp, marks: b.phaseMarks, hint: play.hud.lastHint && play.hud.lastHint.text };
});
assert('the Behemoth has 1500 HP and phase notches at 66% and 33%', beh.hp === 1500 && beh.marks.join() === '0.66,0.33', JSON.stringify(beh));
assert('its hint points at the rear and at its own missiles', /rear/.test(beh.hint) && /missile/.test(beh.hint), beh.hint);
// Q on the hull, then from behind.
async function zapBoss(side) {
  await ev((side) => {
    const play = window.DM.dev.play(), b = window.__b, p = play.player;
    b.aim = 0;
    b.actT = 99;
    b.vx = b.vy = 0;
    const a = b.hullA + (side === 'rear' ? Math.PI : 0);
    p.x = b.x + Math.cos(a) * 280;
    p.y = b.y + Math.sin(a) * 280;
    p.energy = 100;
    p.powers.disintegrate.cd = 0;
    play.world.camera.snap(p.x, p.y);
    window.__hp0 = b.hp;
  }, side);
  await step(0.05);
  await ev(() => { window.__aim(window.__b.x, window.__b.y); window.__tap('KeyQ'); });
  await step(0.3);
  return ev(() => Math.round(window.__hp0 - window.__b.hp));
}
const hull = await zapBoss('front');
const rear = await zapBoss('rear');
assert('Disintegrate on its armour deals 28 (x0.4); from behind, 105 (x1.5)', hull === 28 && rear === 105, `hull ${hull}, rear ${rear}`);
const thrown = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), b = window.__b, p = play.player;
  p.x = b.x - 400;
  p.y = b.y;
  const m = play.world.add(new DM.Proj.Missile({ x: b.x - 220, y: b.y, angle: 0, speed: 230 }));
  m.team = 'player';
  m.vx = 700;
  m.vy = 0;
  m.thrown = 1;
  window.__hp0 = b.hp;
  return true;
});
await step(0.5);
const missileDmg = await ev(() => Math.round(window.__hp0 - window.__b.hp));
assert('one of its own missiles, thrown back, deals at least 150', thrown && missileDmg >= 150 && missileDmg <= 200, `${missileDmg}`);
// Phase transitions.
await ev(() => { const b = window.__b; b.damage(b.hp - b.maxHp * 0.66 - 5, null, 'test'); window.__sounds.length = 0; b.damage(10, null, 'test'); });
// Its wake (mines and escort) arrives at the end of the frame after the phase's hitstop.
await step(0.4);
const ph2 = await ev(() => {
  const DM = window.DM, b = window.__b, W = DM.dev.play().world;
  return { phase: b.phase, mines: b.spawned.filter((e) => e instanceof DM.Special.Mine).length, drones: b.spawned.filter((e) => e instanceof DM.Enemies.Drone).length, bark: W.barks.some((x) => x.e === b), sound: window.__sounds.includes('phase') };
});
assert('at 66% it changes phase: a bark, 4 mines in its wake and 2 escort drones', ph2.phase === 2 && ph2.mines === 4 && ph2.drones === 2 && ph2.bark && ph2.sound, JSON.stringify(ph2));
await ev(() => { const b = window.__b; b.damage(b.hp - b.maxHp * 0.33 - 5, null, 'test'); b.damage(10, null, 'test'); });
await step(0.05);
const ph3 = await ev(() => ({ phase: window.__b.phase, vent: window.__b.ventT > 0 }));
const vent = await zapBoss('rear');
assert('at 33% the rear vent opens and Disintegrate from behind deals 140 (x2)', ph3.phase === 3 && ph3.vent && vent === 140, `${JSON.stringify(ph3)}, rear ${vent}`);
// Its death clears the air, stands its escort down and goes to the outro.
await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), b = window.__b, W = play.world, p = play.player;
  p.x = b.x - 500;
  p.y = b.y;
  for (const a of [-0.4, 0, 0.4]) W.add(new DM.Proj.Missile({ x: b.x - 150, y: b.y + a * 200, angle: Math.PI + a, speed: 230 }));
  W.add(new DM.Proj.Bullet({ x: p.x + 200, y: p.y, vx: -500, vy: 0 }));
  b.die('disintegrate');
  window.__downs = 0; // (the Behemoth's own death has been counted; its escort must not be)
  window.__offDown = DM.Events.on('enemy:down', () => window.__downs++);
});
await step(1 / 30);
const after = await ev(() => {
  const play = window.DM.dev.play(), W = play.world;
  return {
    hostile: W.entities.filter((e) => e.isProjectile && !e.dead && e.team !== 'player').length,
    mines: window.__b.spawned.filter((e) => e instanceof window.DM.Special.Mine && !e.dead).length,
    escort: window.__b.spawned.filter((e) => e.powerDown && !e.dead && !(e.downT > 0)).length,
  };
});
await step(1);
const escortDowns = await ev(() => { window.__offDown(); return { downs: window.__downs, alive: window.__b.spawned.filter((e) => !e.dead).length }; });
assert('when it dies, nothing hostile stays in the air and its mines and escort stand down', after.hostile === 0 && after.mines === 0 && after.escort === 0 && escortDowns.alive === 0, JSON.stringify({ after, escortDowns }));
assert('powered-down escorts are not counted as kills', escortDowns.downs === 0, `${escortDowns.downs} enemy:down events`);
let outro = null;
for (let i = 0; i < 30 && !outro; i++) {
  await step(0.2);
  outro = await ev(() => { const p = window.DM.dev.play(); return p.ctx.stageIndex === 4 && p.ctx.locked ? { stage: p.ctx.stageIndex } : null; });
}
assert('Chapter III reaches its outro', !!outro);

// Standing still and spamming Q takes at least 45 s, even in god mode.
await begin('deterrent', 3);
await ev(() => {
  const DM = window.DM;
  window.__spam = { t: 0 };
  window.__T.hooks.push((when) => {
    if (when !== 'before') return;
    const play = DM.dev.play(), b = play.world.boss, p = play.player;
    if (!b || b.dead) return;
    p.godMode = true;
    window.__spam.t += 1 / 60;
    window.__aim(b.x, b.y);
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    DM.Input.simulate('KeyD', d > 450);
    const q = d < 500 && p.energy >= 20 && p.powers.disintegrate.cd <= 0;
    DM.Input.simulate('KeyQ', q);
  });
});
let spamT = null;
for (let i = 0; i < 16 && spamT == null; i++) {
  await step(5);
  spamT = await ev(() => { const b = window.DM.dev.play().world.boss; return !b || b.dead ? +window.__spam.t.toFixed(1) : null; });
}
await ev(() => { window.__T.hooks.length = 0; window.DM.Input.simulate('KeyQ', false); window.DM.Input.simulate('KeyD', false); });
assert('stand-still Q spam needs at least 45 s to kill the Behemoth', spamT == null || spamT >= 45, spamT == null ? 'still alive after 80 s' : `${spamT} s`);

// 6. Karnak's emitters.
await begin('karnak', 0);
const em = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), W = play.world, p = play.player, R = play.ctx.refs;
  for (const e of [...R.turrets, ...R.drones]) e.stun = 99; // quiet while we test the emitter itself
  const e = R.emitters[0];
  p.x = e.x + 60;
  p.y = e.y;
  p.teleportedAt = W.realTime; // as if teleported inside the shield
  p.coherence = 100;
  p.godMode = false;
  p.invuln = 0;
  window.__hits = [];
  const dmg = p.damage.bind(p);
  p.damage = (a, s, k) => { const c0 = p.coherence; const r = dmg(a, s, k); if (p.coherence < c0) window.__hits.push([k, +(c0 - p.coherence).toFixed(1)]); return r; };
  W.camera.snap(p.x, p.y);
  window.__em = e;
  return true;
});
for (let i = 0; i < 2; i++) {
  await ev(() => { const p = window.DM.dev.play().player; p.energy = 100; p.powers.disintegrate.cd = 0; window.__aim(window.__em.x, window.__em.y); window.__tap('KeyQ'); });
  await step(0.5);
}
const em1 = await ev(() => ({ dead: window.__em.dead, hits: window.__hits.slice() }));
assert('an emitter taken apart with Q from inside its shield does not blow up in Jon\'s face', em && em1.dead && !em1.hits.some((h) => h[0] === 'explosion'), JSON.stringify(em1));
await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), R = play.ctx.refs;
  for (const e of [...R.turrets, ...R.drones]) e.stun = 0;
  window.__hits.length = 0;
  for (const e of R.emitters) if (!e.dead) e.die('disintegrate');
  window.__downs = 0;
  window.__offDown = DM.Events.on('enemy:down', () => window.__downs++);
});
await step(0.1);
const grid = await ev(() => {
  const play = window.DM.dev.play(), R = play.ctx.refs;
  return { powering: [...R.turrets, ...R.drones].filter((e) => e.downT > 0 || e.dead).length, total: R.turrets.length + R.drones.length, locked: play.ctx.locked, hint: play.hud.lastHint };
});
await step(6);
const quiet = await ev(() => { window.__offDown(); const R = window.DM.dev.play().ctx.refs; return { hits: window.__hits.length, downs: window.__downs, alive: [...R.turrets, ...R.drones].filter((e) => !e.dead).length }; });
assert('when the last emitter falls, every turret and drone powers down', grid.powering === grid.total && quiet.alive === 0, JSON.stringify({ grid, quiet }));
assert('Jon is held for the narration and nothing hits him for 6 s', grid.locked && quiet.hits === 0 && !grid.hint, JSON.stringify({ locked: grid.locked, hits: quiet.hits }));
assert('powered-down defences are not counted as kills', quiet.downs === 0, `${quiet.downs}`);

// 7. Veidt.
await begin('karnak', 2);
await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), v = play.world.boss, p = play.player;
  p.godMode = true;
  window.__v = v;
  window.__veidtSnap = () => ({ hp: Math.round(v.hp), state: v.state });
});
// One Q at him: his guard is up, so he slips it, and only then says so.
async function castAtVeidt(setup) {
  await ev((setup) => {
    const play = window.DM.dev.play(), v = window.__v, p = play.player;
    v.discCd = 9;
    v.aim = 0;
    p.energy = 100;
    p.powers.disintegrate.cd = 0;
    play.world.barks.length = 0;
    if (setup) new Function('v', 'p', 'play', setup)(v, p, play);
  }, setup || '');
  await step(0.05);
  await ev(() => {
    window.__hp0 = window.__v.hp; const v = window.__v; window.__aim(v.x, v.y); window.__tap('KeyQ'); });
  await step(0.4);
  return ev(() => ({ dmg: Math.round(window.__hp0 - window.__v.hp), state: window.__v.state, bark: window.DM.dev.play().world.barks.map((b) => b.text) }));
}
await step(0.5);
const dodge = await castAtVeidt('v.recoverT = 0; v.fatigueT = 0; v.state = "strafe";');
assert('with his guard up, Veidt dodges a Disintegrate and only then taunts', dodge.dmg === 0 && dodge.bark.length === 1, JSON.stringify(dodge));
await step(1);
const stunned = await castAtVeidt('v.stun = 1; v.state = "strafe";');
assert('stunned, he cannot dodge', stunned.dmg === 70, JSON.stringify(stunned));
await step(1.2);
const windup = await castAtVeidt('v.state = "strafe"; v.recoverT = 0; v.aim = 0.25; v.aimTime = 0.3; v.vx = v.vy = 0;');
assert('winding up a disc, his guard is down', windup.dmg === 70, JSON.stringify(windup));
// Temporal Sight: his guard is down most of the time.
await step(1);
const sight = await ev(() => {
  window.DM.Input.simulate('KeyF', true);
  const s = (window.__sightSample = { down: 0, n: 0 });
  window.__T.hooks.push((when) => {
    if (when !== 'after') return;
    const play = window.DM.dev.play();
    play.player.energy = 100;
    if (!play.world.timesight) return;
    const v = window.__v;
    if (v.stun > 0 || v.state !== 'strafe' || v.recoverT > 0 || v.aim > 0) return;
    s.n++;
    if (v.guardDown(play.world) === 'seen') s.down++;
  });
  return true;
});
await step(4);
const seen = await ev(() => { window.__T.hooks.length = 0; window.DM.Input.simulate('KeyF', false); return window.__sightSample; });
const frac = seen.down / Math.max(1, seen.n);
assert('under Temporal Sight his guard is down about 80% of the time', sight && frac > 0.7 && frac < 0.9, `${Math.round(frac * 100)}% of ${seen.n} frames`);
// F held while spamming Q: at least 70% of casts land.
await step(1);
await ev(() => {
  const DM = window.DM;
  const st = (window.__fheld = { casts: 0, hits: 0 });
  const v = window.__v;
  const od = v.damage.bind(v);
  v.damage = (a, s, k) => { const h0 = v.hp; const r = od(a, s, k); if (k === 'disintegrate' && v.hp < h0) st.hits++; return r; };
  v.hp = v.maxHp;
  DM.Input.simulate('KeyF', true);
  window.__T.hooks.push((when) => {
    if (when !== 'before') return;
    const play = DM.dev.play(), p = play.player;
    p.energy = 100; // keep Sight up for the whole test
    v.hp = Math.max(v.hp, 300);
    window.__aim(v.x, v.y);
    const fire = p.powers.disintegrate.cd <= 0 && (st.next = (st.next || 0) - 1 / 60) <= 0 && play.world.timeScale < 0.5;
    if (fire) { st.casts++; st.next = 0.6; }
    DM.Input.simulate('KeyQ', fire);
  });
});
await step(15);
const fheld = await ev(() => { window.__T.hooks.length = 0; window.DM.Input.simulate('KeyF', false); window.DM.Input.simulate('KeyQ', false); delete window.__v.damage; return window.__fheld; });
assert('with F held, at least 70% of Disintegrate casts hit him', fheld.casts >= 10 && fheld.hits / fheld.casts >= 0.7, `${fheld.hits}/${fheld.casts}`);
// Copies pin him.
await step(1.5);
await ev(() => { for (const e of window.DM.dev.play().world.entities) if (e instanceof window.DM.Enemies.Drone) e.dead = true; });
const pinned = await castAtVeidt('v.state = "strafe"; v.recoverT = 0; const d = play.world.add(new window.DM.Special.Duplicate(p, v.x + 20, v.y, 10)); window.__dup = d;');
assert('a Duplicate within reach pins him, and Q lands', pinned.dmg >= 70, JSON.stringify(pinned));
const dupHp = await ev(() => {
  const play = window.DM.dev.play(), v = window.__v, p = play.player;
  window.__dup.expire(play.world);
  v.strikeCd = 0;
  window.__dup = play.world.add(new window.DM.Special.Duplicate(p, v.x + 20, v.y, 10));
  return true;
});
await step(1.0);
const dupLeft = await ev(() => { const d = window.__dup; const hp = d.hp; d.expire(window.DM.dev.play().world); return hp; });
assert('his strikes on a copy do 20 every 0.7 s', dupHp && dupLeft === 20, `copy hp ${dupLeft} after 1 s`);
// Telekinesis: a slam does plain impact damage, and he cannot be caught again straight away.
await step(1.5);
const slam = await ev(() => {
  const play = window.DM.dev.play(), v = window.__v, W = play.world;
  v.state = 'strafe';
  const h0 = v.hp;
  v.onImpact(700, null, W);
  const first = Math.round(h0 - v.hp);
  const h1 = v.hp;
  v.onImpact(700, null, W);
  return { first, second: Math.round(h1 - v.hp), grabbable: v.grabbable, slamT: v.slamT };
});
assert('a slam deals plain impact damage (x1.0) and no second slam lands straight after', slam.first === 84 && slam.second === 0, JSON.stringify(slam));
assert('after a slam he cannot be grabbed for a while', slam.grabbable === false && slam.slamT >= 1.2, JSON.stringify(slam));
await step(3);
const freed = await ev(() => { const play = window.DM.dev.play(), v = window.__v; v.stun = 0; v.heldBy = play.player; v.heldT = 0; return true; });
await step(0.8);
const breakFree = await ev(() => ({ held: !!window.__v.heldBy, state: window.__v.state }));
assert('he breaks free of telekinesis after 0.7 s', freed && !breakFree.held, JSON.stringify(breakFree));
// Plain Q spam for 20 s (god mode, no Sight) barely scratches him.
await step(2);
await ev(() => {
  const DM = window.DM;
  const v = window.__v;
  const play = DM.dev.play(), p = play.player;
  v.hp = v.maxHp;
  v.state = 'strafe';
  p.x = 2240;
  p.y = 1000;
  v.x = p.x + 250;
  v.y = p.y;
  v.phi = 0;
  play.world.camera.snap(p.x, p.y);
  const st = (window.__plain = { dmg: 0, casts: 0, badBarks: 0, guard: {} });
  v.onDisintegrateCast = function (c, w) {
    const g = this.guardDown(w) || 'up';
    st.guard[g] = (st.guard[g] || 0) + 1;
    return Object.getPrototypeOf(this).onDisintegrateCast.call(this, c, w);
  };
  const od = v.damage.bind(v);
  v.damage = (a, s, k) => {
    const h0 = v.hp;
    const r = od(a, s, k);
    if (v.hp < h0) {
      st.dmg += h0 - v.hp;
      if (DM.dev.play().world.barks.some((b) => b.e === v && /Too slow|studied|Predictable|telegraph/.test(b.text))) st.badBarks++;
    }
    return r;
  };
  window.__T.hooks.push((when) => {
    if (when !== 'before') return;
    const p = DM.dev.play().player;
    window.__aim(v.x, v.y);
    const q = p.energy >= 20 && p.powers.disintegrate.cd <= 0 && Math.hypot(v.x - p.x, v.y - p.y) < 500;
    if (q) st.casts++;
    DM.Input.simulate('KeyQ', q);
  });
});
await step(20);
const plain = await ev(() => { window.__T.hooks.length = 0; window.DM.Input.simulate('KeyQ', false); delete window.__v.damage; delete window.__v.onDisintegrateCast; return window.__plain; });
console.log(`  (plain Q spam for 20 s: ${plain.casts} casts, ${Math.round(plain.dmg)} damage; his guard at each cast: ${JSON.stringify(plain.guard)})`);
assert('20 s of plain Q spam deals at most 280 damage (of 1000)', plain.dmg <= 280, `${Math.round(plain.dmg)}`);
assert("he never says 'Too slow' while taking a hit", plain.badBarks === 0, `${plain.badBarks}`);
// His yield clears the air.
await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), v = window.__v, p = play.player;
  play.world.add(new DM.Proj.TachyonDisc({ x: v.x, y: v.y, tx: p.x, ty: p.y }));
  play.world.add(new DM.Proj.Bullet({ x: p.x + 200, y: p.y, vx: -500, vy: 0 }));
  v.damage(5000, null, 'test');
});
await step(1 / 30);
const yielded = await ev(() => {
  const play = window.DM.dev.play();
  return { yielded: window.__v.yielded, hostile: play.world.entities.filter((e) => e.isProjectile && !e.dead && e.team !== 'player').length };
});
assert('when Veidt yields, nothing hostile stays in the air', yielded.yielded && yielded.hostile === 0, JSON.stringify(yielded));

// 8. The minefield (Chapter III).
await begin('deterrent', 0);
await ev(() => {
  const play = window.DM.dev.play();
  play.player.godMode = false;
  window.__mineHits = [];
  const p = play.player;
  const dmg = p.damage.bind(p);
  p.damage = (a, s, k) => { const c0 = p.coherence; const r = dmg(a, s, k); if (k === 'explosion' && p.coherence < c0) window.__mineHits.push(+(c0 - p.coherence).toFixed(1)); return r; };
});
// Walk straight across at three heights (field restored in between).
const crossings = [];
for (const y of [330, 650, 1000, 1180, 1240]) {
  await ev((y) => {
    const play = window.DM.dev.play(), p = play.player;
    p.x = 895;
    p.y = y;
    p.vx = p.vy = 0;
    p.coherence = 100;
    p.invuln = 0;
    window.__mineHits.length = 0;
    play.world.camera.snap(p.x, p.y);
    window.DM.Input.simulate('KeyD', true);
  }, y);
  for (let i = 0; i < 120; i++) {
    await step(1 / 30);
    if (await ev(() => window.DM.dev.play().player.x > 1345 && !window.DM.Input.simulate('KeyD', false))) break;
  }
  await step(0.8);
  crossings.push(await ev(() => { window.DM.Input.simulate('KeyD', false); return { lost: +window.__mineHits.reduce((a, b) => a + b, 0).toFixed(1), hits: window.__mineHits.length, x: Math.round(window.DM.dev.play().player.x) }; }));
}
assert('walking straight across the minefield costs at most 60 coherence', crossings.every((c) => c.lost <= 60 && c.x > 1345), JSON.stringify(crossings));
// Follow each cleared lane.
const lanes = await ev(() => window.DM.Chapters.get('deterrent').minefield.lanes.length);
const laneRuns = [];
for (let li = 0; li < lanes; li++) {
  await ev((li) => {
    const DM = window.DM;
    const play = DM.dev.play(), p = play.player;
    const mf = DM.Chapters.get('deterrent').minefield;
    const pts = mf.lanes[li].map(([c, r]) => mf.centre(c, r));
    const path = [...pts, { x: pts[pts.length - 1].x + 20, y: pts[pts.length - 1].y }];
    p.x = pts[0].x - 60;
    p.y = pts[0].y;
    p.vx = p.vy = 0;
    p.coherence = 100;
    window.__mineHits.length = 0;
    window.__armed = 0;
    for (const e of play.world.entities) if (e instanceof DM.Special.Mine) e.__wasArmed = e.trig >= 0;
    play.world.camera.snap(p.x, p.y);
    let i = 0;
    window.__T.hooks.push((when) => {
      if (when !== 'before') return;
      const t = path[i];
      const keys = { KeyA: false, KeyD: false, KeyW: false, KeyS: false };
      if (t) {
        const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
        if (d < 8) i++;
        else {
          if (dx < -d * 0.38) keys.KeyA = true;
          if (dx > d * 0.38) keys.KeyD = true;
          if (dy < -d * 0.38) keys.KeyW = true;
          if (dy > d * 0.38) keys.KeyS = true;
        }
      }
      for (const k in keys) DM.Input.simulate(k, keys[k]);
      window.__laneDone = !t;
    });
  }, li);
  for (let i = 0; i < 60; i++) {
    await step(0.25);
    if (await ev(() => window.__laneDone)) break;
  }
  laneRuns.push(await ev(() => {
    window.__T.hooks.length = 0;
    for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) window.DM.Input.simulate(k, false);
    const armed = window.DM.dev.play().world.entities.filter((e) => e instanceof window.DM.Special.Mine && e.trig >= 0 && !e.__wasArmed).length;
    return { done: !!window.__laneDone, hits: window.__mineHits.length, armed };
  }));
  await step(1);
}
assert('each cleared lane can be walked with at most one hit', lanes >= 2 && laneRuns.every((r) => r.done && r.hits <= 1), JSON.stringify(laneRuns));
const hintNow = await ev(() => { const h = window.DM.dev.play().hud.lastHint; return h && h.text; });
assert('the minefield hint offers both routes', /pick your way through/.test(hintNow || '') && /not walk at all/.test(hintNow || ''), hintNow || '(no hint)');
// The teleport route still works.
const hop = await ev(() => {
  const DM = window.DM;
  const play = DM.dev.play(), p = play.player, W = play.world;
  p.x = 895;
  p.y = 900;
  p.vx = p.vy = 0;
  p.energy = 100;
  p.powers.teleport.cd = 0;
  W.camera.snap(p.x, p.y);
  window.__mineHits.length = 0;
  return true;
});
for (let i = 0; i < 3; i++) {
  await ev(() => {
    const DM = window.DM;
    const play = DM.dev.play(), p = play.player, W = play.world;
    const mines = W.entities.filter((e) => e instanceof DM.Special.Mine && !e.dead);
    let best = null;
    for (let k = 0; k < 120; k++) {
      const a = (k / 120 - 0.5) * 1.6, d = 360;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!W.isFree(x, y, p.r)) continue;
      const clear = Math.min(...mines.map((m) => Math.hypot(m.x - x, m.y - y)));
      if (clear < 60) continue;
      if (!best || x > best.x) best = { x, y };
    }
    if (best) window.__aim(best.x, best.y);
    p.powers.teleport.cd = 0;
    window.__tap('Space');
  });
  await step(0.3);
}
const hopped = await ev(() => ({ x: Math.round(window.DM.dev.play().player.x), hits: window.__mineHits.length }));
assert('teleporting across the minefield still works', hop && hopped.x > 1330 && hopped.hits === 0, JSON.stringify(hopped));

// 9. The wave objective matches its win condition.
await begin('deterrent', 1);
await step(2.5);
const obj = await ev(() => { const o = window.DM.dev.play().hud.objective; return o && o.text; });
assert("Operation Blue Fire's objective is to break it, not survive it", obj === 'Break Operation Blue Fire', obj);

await browser.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll encounter checks passed.');
process.exit(failures ? 1 : 0);
