/*
 * Playtest & balance gate: an in-page bot plays the combat stages of Chapters
 * II, III and V through the real input layer and the run is held to balance
 * bands. It also checks the fixed-step simulation itself.
 *
 * The bot drives DM.Input exactly as a player would (Input.simulate for keys
 * and buttons, Input.mouse aimed through the camera) from a DM.dev.onFrame hook,
 * which runs before every simulation step. Time is game time: the test steps
 * the game with DM.dev.advance, seeded with DM.dev.seed, so a run is fast and
 * reproducible. The bot navigates with A* around walls, dodges what it can see,
 * and records damage, energy, decoherences and per-stage timings.
 *
 * Bands (ranges rather than exact counts, so a richer enemy roster still fits):
 *   engine     60 steps per game second at 60, 144 and 30 Hz; a press made on
 *              a frame with no step is seen by exactly one step
 *   seed       the same seed and inputs reproduce the same run
 *   tk         a held gangster gets free (or drains Jon) within 12 s; a crate
 *              can be held for 20 s without emptying the meter
 *   pier       a pacifist clears the pier: every man spared, none gone, no
 *              double counting, at most one decoherence
 *   waves      each Chapter III wave in under 120 s, fewer than 2 decoherences
 *              in all, energy under 20 for less than 25% of the fighting
 *   behemoth   30-90 s throwing its missiles back, and with Disintegrate only
 *   emitters   Karnak's defences fall with the last emitter: no damage after it
 *   veidt      each hinted tactic (Disintegrate, Temporal Sight, copies, a
 *              throw) makes him yield in 40-120 s with at most 2 decoherences
 *   retry      REASSEMBLE to control in at most 3 s at every combat checkpoint
 *
 *   node tests/playtest.mjs [section ...]     (default: all sections)
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
const args = process.argv.slice(2);
const target = args.find((a) => a.endsWith('.html')) || path.join(root, 'index.html');
const SECTIONS = ['engine', 'seed', 'tk', 'pier', 'waves', 'behemoth', 'emitters', 'veidt', 'retry'];
const only = args.filter((a) => SECTIONS.includes(a));
const want = (s) => !only.length || only.includes(s);
const SEED = 1985;

const started = Date.now();
const errors = [];
const browser = await playwright.chromium.launch();
let failures = 0;
const table = [];
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}
const r1 = (v) => (v == null ? v : Math.round(v * 10) / 10);

// ---- the bot (runs in the page) -------------------------------------------------------
function installBot() {
  const DM = window.DM;
  const U = DM.U;
  const Input = DM.Input;
  const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', tk: 'Mouse0', dis: 'KeyQ', tele: 'Space', dup: 'KeyR', sight: 'KeyF', expand: 'KeyG', e: 'KeyE' };

  const BOT = {
    held: new Set(),
    want: new Set(),
    taps: [],
    releaseNext: [],
    brain: null,
    mem: {},
    m: null,
    err: null,
    talkT: 0,
    autoTalk: true,
    autoRetry: true,
    reset() {
      for (const c of this.held) Input.simulate(c, false);
      this.held = new Set();
      this.want = new Set();
      this.taps = [];
      this.releaseNext = [];
      this.brain = null;
      this.err = null;
      this.talkT = 0;
      this.autoTalk = true;
      this.autoRetry = true;
      this.mem = {};
      this.m = {
        realT: 0, playT: 0, lockedT: 0, fightT: 0, lowEnergyT: 0, zeroEnergyT: 0, energyFail: 0,
        dmg: [], downs: 0, retries: 0, stages: [], lastStage: null, coherenceMin: 100, notes: [],
        events: [],
      };
    },
    note(s) {
      this.m.notes.push(`[${this.m.realT.toFixed(1)}] ${s}`);
    },
    key(name, on) {
      const c = KEYS[name] || name;
      if (on) this.want.add(c);
      else this.want.delete(c);
    },
    tap(name) {
      this.taps.push(KEYS[name] || name);
    },
    play() {
      return DM.dev.play();
    },
    aim(x, y) {
      const p = this.play();
      if (!p) return;
      const s = p.world.camera.toScreen(x, y);
      Input.mouse.x = U.clamp(s.x, 0, DM.W);
      Input.mouse.y = U.clamp(s.y, 0, DM.H);
      Input.mouse.moved = true;
    },
    // Hold WASD toward (x, y); returns the distance.
    moveTo(x, y, stop = 12) {
      const p = this.play().player;
      const dx = x - p.x, dy = y - p.y;
      const d = Math.hypot(dx, dy);
      this.key('left', d > stop && dx < -d * 0.38);
      this.key('right', d > stop && dx > d * 0.38);
      this.key('up', d > stop && dy < -d * 0.38);
      this.key('down', d > stop && dy > d * 0.38);
      return d;
    },
    stop() {
      for (const k of ['up', 'down', 'left', 'right']) this.key(k, false);
    },
    // Grid A* around walls; returns the remaining distance.
    nav(x, y, stop = 16) {
      const play = this.play(), w = play.world, p = play.player;
      const C = 32;
      const gw = Math.ceil(w.w / C), gh = Math.ceil(w.h / C);
      const dGoal = Math.hypot(x - p.x, y - p.y);
      if (dGoal < stop) {
        this.stop();
        return dGoal;
      }
      const nv = this.mem._nav;
      const now = this.m.realT;
      const need = !nv || nv.w !== w || Math.hypot(nv.gx - x, nv.gy - y) > 40 || now - nv.t > 0.8 || !nv.path.length;
      if (need) {
        if (!w._botGrid || w._botGridR !== p.r || now - (w._botGridT || 0) > 2 || now < (w._botGridT || 0)) {
          const g = new Uint8Array(gw * gh);
          for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) g[j * gw + i] = w.isFree(i * C + C / 2, j * C + C / 2, p.r + 3) ? 1 : 0;
          w._botGrid = g;
          w._botGridR = p.r;
          w._botGridT = now;
        }
        const g = w._botGrid;
        const si = U.clamp(Math.floor(p.x / C), 0, gw - 1), sj = U.clamp(Math.floor(p.y / C), 0, gh - 1);
        const ti = U.clamp(Math.floor(x / C), 0, gw - 1), tj = U.clamp(Math.floor(y / C), 0, gh - 1);
        const N = gw * gh;
        const gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
        const open = [];
        const h = (i, j) => Math.hypot(i - ti, j - tj);
        const s0 = sj * gw + si;
        gS[s0] = 0;
        open.push([h(si, sj), s0]);
        let found = -1, it = 0, bestK = s0, bestH = h(si, sj);
        while (open.length && it++ < 30000) {
          let bi = 0;
          for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
          const cur = open[bi][1];
          open[bi] = open[open.length - 1];
          open.pop();
          if (closed[cur]) continue;
          closed[cur] = 1;
          const ci = cur % gw, cj = (cur / gw) | 0;
          const hh = h(ci, cj);
          if (hh < bestH) {
            bestH = hh;
            bestK = cur;
          }
          if (ci === ti && cj === tj) {
            found = cur;
            break;
          }
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              if (!di && !dj) continue;
              const ni = ci + di, nj = cj + dj;
              if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
              const nk = nj * gw + ni;
              if (!g[nk] && !(ni === ti && nj === tj)) continue;
              if (di && dj && (!g[cj * gw + ni] || !g[nj * gw + ci])) continue;
              const ng = gS[cur] + (di && dj ? 1.414 : 1);
              if (ng < gS[nk]) {
                gS[nk] = ng;
                from[nk] = cur;
                open.push([ng + h(ni, nj), nk]);
              }
            }
          }
        }
        if (found < 0) found = bestK;
        const pathPts = [];
        for (let k = found; k >= 0 && k !== s0; k = from[k]) pathPts.push({ x: (k % gw) * C + C / 2, y: ((k / gw) | 0) * C + C / 2 });
        pathPts.reverse();
        if (found % gw === ti && ((found / gw) | 0) === tj) pathPts.push({ x, y });
        this.mem._nav = { w, gx: x, gy: y, t: now, path: pathPts };
      }
      const pts = this.mem._nav.path;
      while (pts.length > 1 && Math.hypot(pts[0].x - p.x, pts[0].y - p.y) < 20) pts.shift();
      // Head for the farthest waypoint in a straight, free line.
      let tgt = pts[0] || { x, y };
      for (let k = Math.min(pts.length - 1, 6); k > 0; k--) {
        const q = pts[k];
        let ok = true;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        for (let s = 0; s <= d; s += 10) {
          const f = s / (d || 1);
          if (!w.isFree(p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f, p.r + 1)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          tgt = q;
          break;
        }
      }
      const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
      this.key('left', dx < -d * 0.38);
      this.key('right', dx > d * 0.38);
      this.key('up', dy < -d * 0.38);
      this.key('down', dy > d * 0.38);
      return dGoal;
    },
    // Active foes: not knocked out, yielded, powering down, a projectile or a mine.
    enemies(filter) {
      const w = this.play().world;
      return w.entities.filter((e) => !e.dead && e.team === 'enemy' && !e.ko && !e.isProjectile && e.hp != null && !e.hazard && !(e.downT > 0) && !e.yielded && (!filter || filter(e)));
    },
    nearest(list, x, y) {
      let b = null, bd = Infinity;
      for (const e of list) {
        const d = U.dist(x, y, e.x, e.y);
        if (d < bd) {
          bd = d;
          b = e;
        }
      }
      return b;
    },
    instrument(play) {
      const p = play.player;
      if (p._botWrapped) return;
      p._botWrapped = true;
      const orig = p.damage.bind(p);
      const bot = this;
      p.damage = function (amount, source, kind) {
        const before = p.coherence;
        const r = orig(amount, source, kind);
        if (r) bot.m.dmg.push({ t: +bot.m.realT.toFixed(2), amt: +(before - p.coherence).toFixed(1), kind, src: source && source.constructor ? source.constructor.name : String(source), stage: play.ctx.stageIndex });
        return r;
      };
      const spend = p.spend.bind(p);
      p.spend = function (a) {
        const ok = spend(a);
        if (!ok) bot.m.energyFail++;
        return ok;
      };
    },
    tick(dt) {
      for (const c of this.releaseNext) if (!this.want.has(c)) Input.simulate(c, false);
      this.releaseNext = [];
      if (!this.m) this.reset();
      const play = this.play();
      const top = DM.Engine.top();
      const topName = top && top.constructor.name;
      this.m.realT += dt;
      if (play) {
        this.instrument(play);
        const st = play.ctx.stageIndex;
        if (st !== this.m.lastStage) {
          this.m.stages.push({ stage: st, id: play.chapter.stages[st] && play.chapter.stages[st].id, t: +this.m.realT.toFixed(2) });
          this.m.lastStage = st;
        }
        const p = play.player;
        if (topName === 'Play') {
          if (p.locked) this.m.lockedT += dt;
          else {
            this.m.playT += dt;
            if (p.form === 'manhattan' && this.enemies().length) {
              this.m.fightT += dt;
              if (p.energy < 20) this.m.lowEnergyT += dt;
              if (p.energy < 1) this.m.zeroEnergyT += dt;
            }
          }
          this.m.coherenceMin = Math.min(this.m.coherenceMin, p.coherence);
        }
      }
      this.talkT -= dt;
      if (topName === 'GameOver') {
        if (!this.mem.goSeen) {
          this.mem.goSeen = true;
          this.m.downs++;
          this.note('DECOHERENCE at stage ' + (play && play.ctx.stageIndex));
        }
        this.want.clear();
        if (this.autoRetry && top.t > 1 && this.talkT <= 0) {
          this.tap('e');
          this.talkT = 0.5;
          this.m.retries++;
        }
      } else this.mem.goSeen = false;
      if (this.autoTalk && play && (topName === 'PowerUnlock' || (topName === 'Play' && play.dialog.active))) {
        if (this.talkT <= 0) {
          this.tap('e');
          this.talkT = 0.25;
        }
      } else if (topName === 'Play' && play && this.brain && !play.player.locked) {
        try {
          this.brain(dt, play, this);
        } catch (e) {
          this.err = String(e.stack || e);
        }
      }
      for (const c of this.want) Input.simulate(c, true);
      for (const c of [...this.held]) if (!this.want.has(c)) Input.simulate(c, false);
      this.held = new Set(this.want);
      for (const c of this.taps) {
        if (!this.want.has(c)) {
          Input.simulate(c, true);
          this.releaseNext.push(c);
        }
      }
      this.taps = [];
    },
  };
  BOT.reset();
  DM.Events.on('enemy:down', (d) => {
    if (BOT.m) BOT.m.events.push({ t: +BOT.m.realT.toFixed(2), type: 'down', human: !!d.human, lethal: !!d.lethal, id: d.enemy.id });
  });
  DM.Events.on('player:down', () => BOT.m && BOT.m.events.push({ t: +BOT.m.realT.toFixed(2), type: 'player:down' }));
  DM.Events.on('emitter:down', () => BOT.m && BOT.m.events.push({ t: +BOT.m.realT.toFixed(2), type: 'emitter:down' }));
  DM.dev.onFrame((dt) => {
    try {
      BOT.tick(dt);
    } catch (e) {
      BOT.err = String(e.stack || e);
    }
  });
  window.BOT = BOT;
}

// ---- brains: one per stage kind (run in the page) -------------------------------------
function installBrains() {
  const DM = window.DM;
  const U = DM.U;
  const B = (window.BRAINS = {});
  const tk = (play) => play.player.powers.telekinesis;

  const H = (B.H = {
    // Grab e (walking into range first). True once it is held.
    grab(bot, play, e, approach = 360) {
      const p = play.player, s = tk(play);
      if (s && s.target === e) return true;
      if (s && s.target && s.target !== e) {
        bot.key('tk', false);
        return false;
      }
      const d = U.dist(p.x, p.y, e.x, e.y);
      bot.aim(e.x + e.vx * 0.03, e.y + e.vy * 0.03);
      if (d > approach || !play.world.los(p.x, p.y, e.x, e.y)) {
        bot.nav(e.x, e.y);
        bot.key('tk', false);
        return false;
      }
      bot.stop();
      if (bot.held.has('Mouse0')) bot.key('tk', false); // let go, to press again
      else if (s && s.hover === e) bot.key('tk', true);
      return false;
    },
    // Wind up and fling a held enemy at a wall 150-400 px away, as a player would.
    slam(bot, play, e) {
      const p = play.player, world = play.world, M = bot.mem;
      if (M.flungT > 0) {
        M.flungT -= 1 / 60;
        bot.key('tk', false);
        bot.stop();
        if (e.speed > 60 && M.flungT > 0) return 'flying';
        M.flungT = 0;
      }
      if (!H.grab(bot, play, e)) {
        M.slamPhase = 'wind';
        M.slamT = 0;
        return 'grab';
      }
      bot.key('tk', true);
      bot.stop();
      const range = 430 * p.scale;
      if (!M.slamTgt || M.slamTgtFor !== e) {
        let best = null, bs = -1e9;
        for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2;
          for (let d = 120; d < range - 10; d += 15) {
            const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
            if (!world.isFree(x, y, 4)) {
              const sc = -Math.abs(d - 300);
              if (sc > bs) {
                bs = sc;
                best = { x, y, a };
              }
              break;
            }
          }
        }
        M.slamTgt = best || { x: p.x + 400, y: p.y, a: 0 };
        M.slamTgtFor = e;
        M.slamPhase = 'wind';
        M.slamT = 0;
      }
      const T = M.slamTgt;
      M.slamT += 1 / 60;
      if (M.slamPhase === 'wind') {
        bot.aim(p.x - Math.cos(T.a) * 50, p.y - Math.sin(T.a) * 50);
        if (U.dist(e.x, e.y, p.x, p.y) < 70 || M.slamT > 0.8) {
          M.slamPhase = 'fling';
          M.slamT = 0;
        }
      } else {
        bot.aim(T.x + Math.cos(T.a) * 80, T.y + Math.sin(T.a) * 80);
        const va = Math.atan2(e.vy, e.vx);
        if ((e.speed > 650 && Math.abs(U.wrapAngle(va - T.a)) < 0.35) || M.slamT > 0.7) {
          bot.key('tk', false);
          M.flungT = 0.8;
          M.slamTgt = null;
          bot.m.flings = (bot.m.flings || 0) + 1;
        }
      }
      return 'slam';
    },
    // Disintegrate at e, leading its motion. True if cast.
    zap(bot, play, e, lead = 0.16) {
      const p = play.player, s = p.powers.disintegrate;
      if (!s) return false;
      const x = e.x + e.vx * lead, y = e.y + e.vy * lead;
      bot.aim(x, y);
      if (s.cd <= 0 && p.energy >= 20 && U.dist(p.x, p.y, x, y) < 515 * p.scale) {
        bot.tap('dis');
        return true;
      }
      return false;
    },
    // Step away from what can be seen coming: shells, meteors, discs, missiles.
    dodge(bot, play) {
      const p = play.player, w = play.world;
      let fx = 0, fy = 0, danger = false;
      for (const e of w.entities) {
        if (e.dead) continue;
        const name = e.constructor.name;
        if (name === 'Shell') {
          if (U.dist(p.x, p.y, e.tx, e.ty) < e.radius + p.r + 10) {
            const n = U.norm(p.x - e.tx, p.y - e.ty);
            fx += n.l ? n.x : 1;
            fy += n.l ? n.y : 0;
            danger = true;
          }
        } else if (name === 'TachyonDisc') {
          const sp = Math.hypot(e.vx, e.vy) || 1;
          const rx = p.x - e.x, ry = p.y - e.y;
          const along = (rx * e.vx + ry * e.vy) / sp;
          if (along > 0 && along < 260) {
            const perp = (rx * -e.vy + ry * e.vx) / sp;
            if (Math.abs(perp) < 34) {
              const sgn = perp >= 0 ? 1 : -1;
              fx += (-e.vy / sp) * sgn * 2;
              fy += (e.vx / sp) * sgn * 2;
              danger = true;
            }
          }
        } else if (name === 'Missile' && e.team === 'enemy' && !e.heldBy) {
          if (U.dist(p.x, p.y, e.x, e.y) < 160) {
            const n = U.norm(p.x - e.x, p.y - e.y);
            fx += -n.y;
            fy += n.x;
            danger = true;
          }
        }
      }
      if (danger) bot.moveTo(p.x + fx * 100, p.y + fy * 100, 1);
      return danger;
    },
    // Ranged combat: Disintegrate the nearest visible foe, keep a distance, dodge,
    // catch missiles and throw them back, copies when outnumbered, an emergency teleport.
    fight(dt, play, bot, o = {}) {
      const p = play.player, w = play.world;
      const s = tk(play);
      const foes = bot.enemies(o.filter);
      if (o.catchMissiles && s) {
        const held = s.target;
        if (held && held.constructor.name === 'Missile') {
          const tgt = o.missileTarget ? o.missileTarget() : bot.nearest(foes, held.x, held.y);
          bot.key('tk', true);
          if (tgt) {
            bot.aim(tgt.x, tgt.y);
            const a1 = Math.atan2(held.vy, held.vx), a2 = U.angleTo(held.x, held.y, tgt.x, tgt.y);
            if (held.speed > 300 && Math.abs(U.wrapAngle(a1 - a2)) < 0.25) {
              bot.key('tk', false);
              bot.m.thrownMissiles = (bot.m.thrownMissiles || 0) + 1;
            }
          } else bot.key('tk', false);
          bot.mem.holdingMissileT = (bot.mem.holdingMissileT || 0) + dt;
          if (bot.mem.holdingMissileT > 2.5) {
            bot.key('tk', false);
            bot.mem.holdingMissileT = 0;
          }
          return;
        }
        bot.mem.holdingMissileT = 0;
        const ms = w.entities.filter((e) => !e.dead && e.constructor.name === 'Missile' && e.team === 'enemy' && U.dist(p.x, p.y, e.x, e.y) < 330);
        const m = bot.nearest(ms, p.x, p.y);
        if (m && p.energy > 15) {
          bot.aim(m.x + m.vx * 0.03, m.y + m.vy * 0.03);
          if (bot.held.has('Mouse0')) bot.key('tk', false);
          else if (s.hover === m) bot.key('tk', true);
          if (!H.dodge(bot, play)) bot.stop();
          return;
        }
        if (bot.held.has('Mouse0')) bot.key('tk', false);
      }
      if (!foes.length) {
        if (!H.dodge(bot, play)) bot.stop();
        return;
      }
      if (p.powers.duplicate && p.powers.duplicate.cd <= 0 && p.energy >= 75 && foes.length >= (o.dupMin || 3)) bot.tap('dup');
      if (p.powers.teleport && p.coherence < 30 && p.energy >= 16 && p.powers.teleport.cd <= 0) {
        const t0 = bot.nearest(foes, p.x, p.y);
        const n = U.norm(p.x - t0.x, p.y - t0.y);
        bot.aim(p.x + n.x * 360, p.y + n.y * 360);
        bot.tap('tele');
        bot.m.emergencyTeleports = (bot.m.emergencyTeleports || 0) + 1;
        return;
      }
      const pref = o.prefer ? foes.filter(o.prefer) : [];
      const vis = foes.filter((e) => w.los(p.x, p.y, e.x, e.y) && U.dist(p.x, p.y, e.x, e.y) < 500);
      const t = bot.nearest(pref.filter((e) => vis.includes(e)), p.x, p.y) || bot.nearest(vis, p.x, p.y);
      const near = bot.nearest(foes, p.x, p.y);
      if (!H.dodge(bot, play)) {
        const goal = t || near;
        const d = U.dist(p.x, p.y, goal.x, goal.y);
        if (d > 430 || !t) bot.nav(goal.x, goal.y, 30);
        else if (d < 200) {
          const n = U.norm(p.x - goal.x, p.y - goal.y);
          bot.nav(p.x + n.x * 120 - n.y * 60, p.y + n.y * 120 + n.x * 60, 5);
        } else bot.stop();
      }
      if (t) H.zap(bot, play, t, o.lead == null ? 0.16 : o.lead);
    },
  });

  // Chapter II, the pier: knock everyone out (throws only), or 'lethal'.
  B.pier = (style) => (dt, play, bot) => {
    const p = play.player, w = play.world;
    const foes = bot.enemies();
    const hold = tk(play).target;
    if (!foes.length) {
      bot.key('tk', false);
      const mk = play.hud.marker;
      if (mk) bot.nav(mk.x, mk.y + 40);
      else bot.stop();
      return;
    }
    let t = bot.mem.tgt;
    if (!t || t.dead || t.ko || !foes.includes(t) || (hold && hold !== t)) {
      const vis = foes.filter((e) => w.los(p.x, p.y, e.x, e.y));
      t = bot.mem.tgt = bot.nearest(vis.length ? vis : foes, p.x, p.y);
    }
    const d = U.dist(p.x, p.y, t.x, t.y);
    const los = w.los(p.x, p.y, t.x, t.y);
    if (style === 'lethal') {
      bot.key('tk', false);
      if (d > 450 || !los) bot.nav(t.x, t.y);
      else if (!H.dodge(bot, play)) bot.stop();
      if (los) H.zap(bot, play, t, 0.12);
      return;
    }
    if (!los && !hold) {
      bot.key('tk', false);
      bot.nav(t.x, t.y);
      return;
    }
    H.slam(bot, play, t);
    if (hold === t && t.ko) bot.key('tk', false);
  };

  // Chapter III.
  B.waves = (dt, play, bot) => H.fight(dt, play, bot, { catchMissiles: true, prefer: (e) => e.constructor.name === 'Drone' });
  B.behemoth = (style) => (dt, play, bot) => {
    const boss = play.world.boss;
    H.fight(dt, play, bot, { catchMissiles: style !== 'zap', missileTarget: () => boss, prefer: (e) => e === boss, dupMin: 1 });
  };

  // Chapter V: emitters (teleport inside each shield, then Disintegrate), the
  // reassembly, the walk in, then Veidt with one tactic:
  // 'zap' (Disintegrate), 'sightzap' (Temporal Sight around each cast),
  // 'dup' (copies to pin him, plus Disintegrate), 'grab' (catch and throw him).
  B.karnak = (vstyle = 'zap') => (dt, play, bot) => {
    const p = play.player, w = play.world, R = play.ctx.refs, M = bot.mem;
    const { Atom, BodyForm } = DM.Special;
    const obj = (play.hud.objective && !play.hud.objective.done && play.hud.objective.text) || '';
    if (p.form === 'awareness') {
      const body = w.entities.find((e) => e instanceof BodyForm && !e.dead);
      if (!body) return;
      const atoms = w.entities.filter((e) => e instanceof Atom && !e.dead);
      const pr = play.hud.objective && play.hud.objective.progress ? play.hud.objective.progress() : '';
      const m = /(\d+)\/(\d+)/.exec(pr || '');
      const need = m ? +m[2] - +m[1] : 30;
      if (p.carry >= Math.min(p.carryMax, need) || !atoms.length) {
        bot.key('tk', false);
        bot.nav(body.x, body.y, 30);
        return;
      }
      const a = bot.nearest(atoms, p.x, p.y);
      bot.key('tk', p.energy > 10);
      bot.nav(a.x, a.y, 4);
      return;
    }
    const ems = (R.emitters || []).filter((e) => !e.dead);
    if (ems.length) {
      let e = M.em;
      if (!e || e.dead) e = M.em = bot.nearest(ems, p.x, p.y);
      const d = U.dist(p.x, p.y, e.x, e.y);
      if (d >= e.shieldR) {
        if (d > 330 || !w.los(p.x, p.y, e.x, e.y)) {
          bot.nav(e.x, e.y, 40);
          H.dodge(bot, play);
          return;
        }
        bot.stop();
        const n = U.norm(p.x - e.x, p.y - e.y);
        bot.aim(e.x + n.x * 55, e.y + n.y * 55);
        if (p.powers.teleport.cd <= 0 && p.energy >= 16) bot.tap('tele');
        return;
      }
      bot.stop();
      H.zap(bot, play, e, 0);
      return;
    }
    if (/Enter Karnak/.test(obj)) {
      bot.nav(1990, 1000, 10);
      return;
    }
    const v = w.boss;
    if (!v || v.yielded) {
      bot.stop();
      bot.key('tk', false);
      bot.key('sight', false);
      return;
    }
    const d = U.dist(p.x, p.y, v.x, v.y);
    if (vstyle === 'dup' && p.powers.duplicate.cd <= 0 && p.energy >= 50) bot.tap('dup');
    if (vstyle === 'grab') {
      H.slam(bot, play, v);
      if (tk(play).target !== v && d > 380) bot.nav(v.x, v.y, 200);
      return;
    }
    if (vstyle === 'sightzap') {
      // Hold F for a moment around each cast.
      const s = p.powers.disintegrate;
      const ready = s.cd <= 0 && p.energy >= 26;
      M.sightT = Math.max(0, (M.sightT || 0) - dt);
      if (ready && d < 500 && M.sightT <= 0) M.sightT = 0.45;
      bot.key('sight', M.sightT > 0);
      if (M.sightT > 0 && M.sightT < 0.3 && w.timesight) {
        if (H.zap(bot, play, v, 0.1)) M.sightT = Math.min(M.sightT, 0.05);
      } else bot.aim(v.x, v.y);
    } else H.zap(bot, play, v, 0.12);
    if (!H.dodge(bot, play)) {
      if (d > 420) bot.nav(v.x, v.y, 300);
      else bot.stop();
    }
  };
}

// ---- page and driver ------------------------------------------------------------------
async function openPage(init) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  if (init) await page.addInitScript(init.fn, init.arg);
  await page.goto(pathToFileURL(target).href + '?dev');
  await page.waitForFunction(() => window.DM && window.DM.dev);
  return page;
}

const page = await openPage();
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.mouse.click(640, 360);
await page.waitForTimeout(100);
await ev(installBot);
await ev(installBrains);

// Start a stage with a seed and a brain (an expression evaluated in the page).
async function start(ch, st, brain, seed = SEED) {
  await ev(([ch, st, brain, seed]) => {
    const DM = window.DM;
    DM.dev.seed(seed);
    window.BOT.reset();
    DM.dev.start(ch, st);
    window.BOT.brain = brain ? (0, eval)(brain) : null;
  }, [ch, st, brain, seed]);
}
// Advance until cond (source of a function, evaluated in the page before every
// step) is true, for at most `max` game seconds. Returns the game seconds it took
// (null on timeout); throws on an engine or bot error.
async function runUntil(label, cond, max) {
  let t = 0;
  while (t < max) {
    const r = await ev(([src, chunk]) => {
      const DM = window.DM;
      const f = (0, eval)('(' + src + ')');
      const took = DM.dev.until(() => !!DM.Engine.error || !!window.BOT.err || f(), chunk);
      return { took, engine: DM.Engine.error ? String(DM.Engine.error.stack || DM.Engine.error) : null, bot: window.BOT.err };
    }, [cond.toString(), Math.min(5, max - t)]);
    if (r.engine) throw new Error(`${label}: engine error ${r.engine}`);
    if (r.bot) throw new Error(`${label}: bot error ${r.bot}`);
    if (r.took != null) return r1(t + r.took);
    t += Math.min(5, max - t);
  }
  return null;
}
const metrics = () => ev(() => window.BOT.m);
const stageGe = (n) => `() => window.DM.dev.play().ctx.stageIndex >= ${n}`;
const complete = () => window.DM.Engine.top().constructor.name === 'ChapterComplete';
const summary = (m) => ({
  downs: m.downs,
  dmg: r1(m.dmg.reduce((a, d) => a + d.amt, 0)),
  lowE: m.fightT > 0 ? Math.round((100 * m.lowEnergyT) / m.fightT) : 0,
  cohMin: Math.round(m.coherenceMin),
});

// ---- engine: fixed steps whatever the display -------------------------------------------
if (want('engine')) {
  const rates = {};
  for (const hz of [60, 144, 30]) {
    // A virtual display: each frame's timestamp advances by exactly 1/hz s.
    const g = await openPage({
      fn: (rate) => {
        let vt = performance.now();
        window.requestAnimationFrame = (cb) => setTimeout(() => cb((vt += 1000 / rate)), 0);
      },
      arg: hz,
    });
    rates[hz] = await g.evaluate(async () => {
      const E = window.DM.Engine;
      let frames = 0;
      const f = E.frame;
      E.frame = function (t) {
        frames++;
        return f.call(this, t);
      };
      const f0 = frames, s0 = E.steps;
      while (frames - f0 < 2 * 144) await new Promise((r) => setTimeout(r, 5));
      // Steps per second of display time.
      const n = frames - f0;
      return { frames: n, steps: E.steps - s0 };
    });
    rates[hz].perSec = r1((rates[hz].steps * hz) / rates[hz].frames);
    // A tap made after a frame that ran no step, with the next frame running none
    // either, is still seen, by exactly one step.
    if (hz === 144) {
      rates.latch = await g.evaluate(async () => {
        const DM = window.DM, E = DM.Engine;
        let seen = 0, pressed = false, quiet = 0, stepsAfter = 0;
        const off = DM.dev.onFrame(() => DM.Input.pressed('hint') && seen++);
        const f = E.frame;
        E.frame = function (t) {
          const s0 = E.steps;
          const r = f.call(this, t);
          if (pressed) {
            if (E.steps === s0 && !stepsAfter) quiet++;
            stepsAfter += E.steps - s0;
          } else if (E.steps === s0 && E.acc + 1 / 144 < E.STEP - E.SNAP) {
            pressed = true;
            DM.Input.simulate('KeyH', true);
            DM.Input.simulate('KeyH', false);
          }
          return r;
        };
        while (!pressed || stepsAfter < 3) await new Promise((r) => setTimeout(r, 5));
        E.frame = f;
        off();
        return { seen, quietFrames: quiet, stepsAfter };
      });
    }
    await g.close();
  }
  assert('the simulation steps 60 times a second at 60, 144 and 30 Hz', [60, 144, 30].every((hz) => Math.abs(rates[hz].perSec - 60) <= 1.5), [60, 144, 30].map((hz) => `${hz} Hz: ${rates[hz].perSec}/s (${rates[hz].steps} steps, ${rates[hz].frames} frames)`).join(', '));
  assert('a press across frames with no simulation step is seen by exactly one step', rates.latch.seen === 1 && rates.latch.quietFrames >= 1 && rates.latch.stepsAfter >= 3, JSON.stringify(rates.latch));
}

// ---- seed: the same seed and inputs give the same run ---------------------------------------
if (want('seed')) {
  const snap = async (seed) => {
    await start('deterrent', 1, 'window.BRAINS.waves', seed);
    await runUntil('waves 45 s', () => false, 45);
    return ev(() => {
      const play = window.DM.dev.play(), p = play.player;
      return JSON.stringify({ stats: play.ctx.stats, x: p.x.toFixed(3), y: p.y.toFixed(3), e: p.energy.toFixed(3), c: p.coherence.toFixed(3), n: play.world.entities.length, foes: window.BOT.enemies().map((e) => [e.constructor.name, Math.round(e.x), Math.round(e.y), Math.round(e.hp)]) });
    });
  };
  const a = await snap(7), b = await snap(7), c = await snap(8);
  assert('the same seed and the same inputs reproduce a Chapter III fight exactly', a === b, a === b ? '' : `${a.slice(0, 200)}\n   vs ${b.slice(0, 200)}`);
  assert('a different seed plays out differently', a !== c);
}

// ---- tk: holding a person costs, holding a crate does not -----------------------------------
if (want('tk')) {
  await ev(() => {
    const DM = window.DM;
    DM.Chapters.register({
      id: '__playtest', numeral: 'TEST', title: 'Playtest', date: '', place: '', clock: 0, color: '#333', music: null, form: 'manhattan',
      maps: {
        t: (ctx) => {
          const W = ctx.newWorld({ w: 1600, h: 1000, zoom: 1.15, bg: '#c49a62' });
          W.room(0, 0, 1600, 1000, { t: 20 });
          W.spawn = { x: 500, y: 500, facing: 0 };
          return W;
        },
      },
      stages: [{
        id: 't', map: 't',
        run: function* (ctx) {
          ctx.player.unlock('telekinesis');
          while (true) yield;
        },
      }],
    });
  });
  // Hold `make()`'s entity from full energy for up to `secs`; report when it got away.
  const hold = (make, secs) => ev(([make, secs]) => {
    const DM = window.DM;
    DM.dev.seed(3);
    window.BOT.reset();
    DM.dev.start('__playtest', 0);
    DM.dev.advance(0.2);
    const play = DM.dev.play(), W = play.world, p = play.player;
    p.godMode = true;
    p.energy = p.maxEnergy;
    const e = W.add((0, eval)(make)(DM, p));
    const s = p.powers.telekinesis;
    let heldFor = 0, minE = p.energy, grabbed = false;
    const aim = () => {
      const q = W.camera.toScreen(e.x, e.y);
      DM.Input.mouse.x = q.x;
      DM.Input.mouse.y = q.y;
    };
    aim();
    DM.dev.advance(0.1);
    DM.Input.simulate('Mouse0', true);
    for (let i = 0; i < secs * 60; i++) {
      DM.dev.advance(1 / 60);
      if (s.target === e) {
        grabbed = true;
        heldFor += 1 / 60;
      } else if (grabbed) break;
      minE = Math.min(minE, p.energy);
    }
    DM.Input.simulate('Mouse0', false);
    DM.dev.advance(0.1);
    return { grabbed, heldFor: +heldFor.toFixed(2), minE: Math.round(minE), stillHeld: s.target === e || DM.Input.down('telekinesis') };
  }, [make.toString(), secs]);
  const man = await hold((DM, p) => new DM.Enemies.Gangster({ x: p.x + 120, y: p.y }), 14);
  assert('a held gangster gets free (or drains Jon) within 12 s from full energy', man.grabbed && (man.heldFor <= 12 || man.minE <= 1), JSON.stringify(man));
  const crate = await hold((DM, p) => new DM.Props.Crate(p.x + 120, p.y), 20);
  assert('a crate can be held for 20 s without emptying the meter', crate.grabbed && crate.heldFor >= 19.9 && crate.minE > 0, JSON.stringify(crate));
  table.push({ stage: 'tk hold', t: man.heldFor, note: `gangster held ${man.heldFor} s (min energy ${man.minE}); crate ${crate.heldFor} s (min energy ${crate.minE})` });
}

// ---- pier: a pacifist clears Chapter II's raid --------------------------------------------
if (want('pier')) {
  await start('superman', 1, "window.BRAINS.pier('pacifist')");
  const times = {};
  times.yard = await runUntil('yard', stageGe(2), 150);
  times.warehouse = times.yard != null ? await runUntil('warehouse', stageGe(3), 150) : null;
  times.office = times.warehouse != null ? await runUntil('office', stageGe(4), 150) : null;
  times.done = times.office != null ? await runUntil('aftermath', complete, 60) : null;
  const m = await metrics();
  const stats = await ev(() => window.DM.dev.play().ctx.stats);
  const kos = m.events.filter((e) => e.type === 'down' && e.human && !e.lethal);
  const distinct = new Set(kos.map((e) => e.id)).size;
  const s = summary(m);
  table.push({ stage: 'pier (pacifist)', t: r1(m.realT), note: `yard ${times.yard} s, warehouse ${times.warehouse} s, office ${times.office} s; spared ${stats.spared}, gone ${stats.disintegrated}; ${s.downs} downs, ${s.dmg} damage` });
  assert('a pacifist bot clears the pier', times.done != null, JSON.stringify(times));
  assert('every man on the pier is spared, once, and none is gone', stats.disintegrated === 0 && stats.spared === kos.length && distinct === kos.length && stats.spared >= 10, `spared ${stats.spared}, gone ${stats.disintegrated}, knockouts ${kos.length} (${distinct} distinct)`);
  assert('the pier costs a careful pacifist at most one decoherence', s.downs <= 1, `${s.downs} downs`);
}

// ---- waves: Chapter III's four waves ------------------------------------------------------
if (want('waves')) {
  await start('deterrent', 1, 'window.BRAINS.waves');
  const waves = [];
  let cur = null, t0 = 0;
  for (let t = 0; t < 600; ) {
    const r = await ev(() => {
      const DM = window.DM;
      let label = null;
      const took = DM.dev.until(() => {
        const play = DM.dev.play();
        if (DM.Engine.error || window.BOT.err || play.ctx.stageIndex >= 3) return true;
        const o = play.hud.objective;
        const m = o && !o.done && o.progress ? /Wave (\d)/.exec(o.progress()) : null;
        label = m ? +m[1] : null;
        return label != null && label !== window.__wave;
      }, 5);
      if (label != null) window.__wave = label;
      return { took, wave: label, stage: DM.dev.play().ctx.stageIndex, t: window.BOT.m.realT, err: DM.Engine.error ? String(DM.Engine.error) : window.BOT.err };
    });
    if (r.err) throw new Error('waves: ' + r.err);
    t = r.t;
    if (r.stage >= 3 || (r.wave != null && r.wave !== cur)) {
      if (cur != null) waves.push({ wave: cur, secs: r1(r.t - t0) });
      if (r.stage >= 3) break;
      cur = r.wave;
      t0 = r.t;
    }
  }
  const m = await metrics();
  const s = summary(m);
  for (const w of waves) table.push({ stage: `wave ${w.wave}`, t: w.secs, note: '' });
  table.push({ stage: 'waves (all)', t: r1(m.realT), note: `${s.downs} downs, ${s.dmg} damage, energy < 20 for ${s.lowE}% of the fighting, ${m.thrownMissiles || 0} missiles thrown back` });
  assert('the bot gets through all four Chapter III waves', waves.length === 4, JSON.stringify(waves));
  assert('each wave falls in under 120 s', waves.length === 4 && waves.every((w) => w.secs < 120), waves.map((w) => `${w.wave}: ${w.secs} s`).join(', '));
  assert('the waves cost fewer than 2 decoherences', s.downs < 2, `${s.downs}`);
  assert('energy is under 20 for less than 25% of the waves', s.lowE < 25, `${s.lowE}% of ${r1(m.fightT)} s`);
  await ev(() => delete window.__wave);
}

// ---- behemoth -----------------------------------------------------------------------------
if (want('behemoth')) {
  for (const style of ['catch', 'zap']) {
    await start('deterrent', 3, `window.BRAINS.behemoth('${style}')`);
    const seen = await runUntil('behemoth arrives', () => !!window.DM.dev.play().world.boss && !window.DM.dev.play().player.locked, 20);
    const t0 = (await metrics()).realT;
    const t = seen == null ? null : await runUntil(`behemoth (${style})`, () => !window.DM.dev.play().world.boss || window.DM.dev.play().ctx.stageIndex >= 4, 150);
    const m = await metrics();
    const s = summary(m);
    const secs = t == null ? null : r1(m.realT - t0);
    table.push({ stage: `behemoth (${style})`, t: secs, note: `${s.downs} downs, ${s.dmg} damage, min coherence ${s.cohMin}${style === 'catch' ? `, ${m.thrownMissiles || 0} missiles thrown back` : ''}` });
    assert(`the Behemoth falls in 30-90 s ${style === 'catch' ? 'to its own missiles' : 'to Disintegrate alone'}`, secs != null && secs >= 30 && secs <= 90 && s.downs <= 1, `${secs} s, ${s.downs} downs`);
  }
}

// ---- emitters: Karnak's defences fall with the grid ----------------------------------------
if (want('emitters')) {
  await start('karnak', 0, "window.BRAINS.karnak('zap')");
  const t = await runUntil('emitters', stageGe(1), 240);
  // Let the narration play out, as the player would.
  await runUntil('after the emitters', () => !window.DM.dev.play().player.locked && window.DM.dev.play().ctx.stageIndex >= 1, 15);
  await runUntil('settle', () => false, 3);
  const m = await metrics();
  const last = m.events.filter((e) => e.type === 'emitter:down').map((e) => e.t).pop();
  const after = m.dmg.filter((d) => last != null && d.t > last + 0.05);
  const downAfter = m.events.filter((e) => e.type === 'player:down' && last != null && e.t > last);
  const s = summary(m);
  table.push({ stage: 'karnak emitters', t, note: `${s.downs} downs, ${s.dmg} damage; after the last emitter: ${after.length} hits` });
  assert('the bot destroys all four emitters', t != null, `${t} s`);
  assert('nothing hurts Jon once the last emitter falls', last != null && after.length === 0 && downAfter.length === 0, after.map((d) => `${d.t} ${d.src}/${d.kind} ${d.amt}`).join(', '));
}

// ---- veidt: every hinted tactic wins, none trivially --------------------------------------
if (want('veidt')) {
  const tactics = { zap: 'Disintegrate', sightzap: 'Temporal Sight + Disintegrate', dup: 'copies + Disintegrate', grab: 'catch and throw' };
  for (const [style, name] of Object.entries(tactics)) {
    await start('karnak', 2, `window.BRAINS.karnak('${style}')`);
    const seen = await runUntil('veidt arrives', () => !!window.DM.dev.play().world.boss && !window.DM.dev.play().player.locked, 20);
    const t0 = (await metrics()).realT;
    const t = seen == null ? null : await runUntil(`veidt (${style})`, () => { const b = window.DM.dev.play().world.boss; return !b || b.yielded; }, 200);
    const m = await metrics();
    const s = summary(m);
    const secs = t == null ? null : r1(m.realT - t0);
    table.push({ stage: `veidt (${style})`, t: secs, note: `${s.downs} downs, ${s.dmg} damage, energy < 20 for ${s.lowE}%` });
    assert(`Veidt yields in 40-120 s to ${name}`, secs != null && secs >= 40 && secs <= 120 && s.downs <= 2, `${secs} s, ${s.downs} downs`);
  }
}

// ---- retry: back in control quickly ----------------------------------------------------------
if (want('retry')) {
  const cases = [['superman', 1], ['superman', 3], ['deterrent', 1], ['deterrent', 3], ['mars', 1], ['mars', 2], ['karnak', 0], ['karnak', 2]];
  const res = [];
  for (const [ch, st] of cases) {
    await start(ch, st, null);
    const control = () => {
      const DM = window.DM, p = DM.dev.play();
      return !!p && DM.Engine.top() === p && !p.failed && !p.player.locked && !DM.Engine.fading && p.player.form === 'manhattan';
    };
    await runUntil('control', control, 30);
    await runUntil('settle', () => false, 0.5);
    await ev(() => {
      const p = window.DM.dev.play().player;
      p.invuln = 0;
      p.damage(999, null, 'test');
      window.BOT.autoRetry = false;
    });
    await runUntil('game over', () => window.DM.Engine.top().constructor.name === 'GameOver' && window.DM.Engine.top().t > 0.8, 10);
    await ev(() => window.BOT.tap('e'));
    await runUntil('fade out', () => window.DM.Engine.fading || window.DM.Engine.top().constructor.name !== 'GameOver', 2);
    const t = await runUntil('control again', () => {
      const DM = window.DM, p = DM.dev.play();
      return !!p && DM.Engine.top() === p && !p.failed && !p.player.locked && !DM.Engine.fading && p.player.form === 'manhattan';
    }, 20);
    res.push({ ch, st, t });
  }
  const worst = Math.max(...res.map((r) => (r.t == null ? 99 : r.t)));
  table.push({ stage: 'retry to control', t: worst, note: res.map((r) => `${r.ch} ${r.st}: ${r.t} s`).join(', ') });
  assert('REASSEMBLE gives control back within 3 s at every combat checkpoint', res.every((r) => r.t != null && r.t <= 3), res.map((r) => `${r.ch} ${r.st}: ${r.t} s`).join(', '));
}

await browser.close();
if (table.length) {
  console.log('\nstage                  game s  notes');
  for (const row of table) console.log(`${row.stage.padEnd(22)} ${String(row.t).padStart(6)}  ${row.note}`);
}
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  failures++;
}
console.log(`(${((Date.now() - started) / 1000).toFixed(1)} s wall clock)`);
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll playtest balance checks passed.');
process.exit(failures ? 1 : 0);
