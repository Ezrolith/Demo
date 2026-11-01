/* Bonus time sanity routes. Every browser evaluation below is read-only.
 * No actor/health/clock/flags/abilities are assigned and no developer entry is used.
 * Entry is supplied by the ordinary-menu runner. Routes may fail honestly if the
 * Normal-damage pilot cannot finish; they must never forge progress to continue.
 */
import { planRealInputPath } from './palace-real-input.mjs';

const alive = entity => entity && !entity.dead && !entity.ko && !entity.neutralized;
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function object(p, path, index = null) {
  return p.data(({ path, index }) => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    let value = path.split('.').reduce((current, key) => current?.[key], play.ctx);
    if (index !== null) value = value?.[index];
    if (!value) return null;
    return { id: value.id, x: value.x, y: value.y, r: value.r, hp: value.hp,
      dead: !!value.dead, ko: !!value.ko, neutralized: !!value.neutralized,
      open: !!value.open, cycle: value.cycle, exposed: value.exposed, beamT: value.beamT,
      range: value.interact?.range || 60, label: value.interact?.label || null };
  }, { path, index });
}

async function worldObject(p, label) {
  return p.data(label => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    const value = play.world.entities.find(entity => !entity.dead && entity.interact &&
      entity.interact.label.includes(label) && (!entity.interact.enabled || entity.interact.enabled()));
    return value && { id: value.id, x: value.x, y: value.y, r: value.r,
      range: value.interact.range || 60, label: value.interact.label };
  }, label);
}

async function clearDialog(p) {
  await p.until('ordinary playable state', state => state.onTop && !state.locked && !state.dialog || state.done, 45000);
}

async function interactObject(p, entity) {
  if (!entity) throw new Error('Required normal interaction was not found');
  const points = await p.data(entity => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    const range = Math.min(42, entity.range * 0.7);
    return [[0, range], [range, 0], [-range, 0], [0, -range]]
      .map(([dx, dy]) => ({ x: entity.x + dx, y: entity.y + dy }))
      .filter(point => play.world.isFree(point.x, point.y, play.player.r));
  }, entity);
  const start = await p.state();
  points.sort((a, b) => gap(a, start) - gap(b, start));
  for (const point of points) {
    await p.moveTo(point.x, point.y, { tolerance: 9, combat: false });
    if ((await p.state()).interaction?.id !== entity.id) continue;
    await p.press('e');
    await p.sleep(120);
    return;
  }
  throw new Error('Required E interaction was not physically reached: ' + entity.label);
}

async function use(p, label) {
  await p.until('enabled interaction ' + label, async state =>
    state.onTop && !state.locked && !state.dialog && !!await worldObject(p, label), 45000);
  await interactObject(p, await worldObject(p, label));
}

async function ready(p, stageId, map, paths = []) {
  return p.until('initialized ' + stageId + ' map and entities', async state => {
    if (state.stageId !== stageId || state.map !== map || !state.onTop || state.locked || state.dialog) return false;
    return p.data(paths => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      return paths.every(path => {
        const value = path.split('.').reduce((object, key) => object?.[key], play.ctx);
        return value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0);
      });
    }, paths);
  }, 45000);
}

async function targetApproach(p, target, radius = 300) {
  const points = await p.data(({ target, radius }) => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    return [[0, radius], [-radius, radius / 2], [radius, radius / 2], [0, -radius]]
      .map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy }))
      .filter(point => play.world.isFree(point.x, point.y, play.player.r));
  }, { target, radius });
  if (!points.length) throw new Error('No physical attack approach to ' + target.id);
  const state = await p.state();
  points.sort((a, b) => gap(a, state) - gap(b, state));
  await p.moveTo(points[0].x, points[0].y, { tolerance: 30, combat: false });
}

function safePoint(world, point, radius) {
  if (point.x < radius || point.y < radius || point.x > world.w - radius || point.y > world.h - radius) return false;
  if (!world.walls.every(wall => {
    if (wall.noCollide) return true;
    const x = Math.max(wall.x, Math.min(point.x, wall.x + wall.w));
    const y = Math.max(wall.y, Math.min(point.y, wall.y + wall.h));
    return Math.hypot(point.x - x, point.y - y) >= radius - 0.01;
  })) return false;
  return (world.bodies || []).every(body => gap(point, body) >= radius + body.r - 0.01);
}

function walkKeys(state, goal) {
  const keys = [];
  if (goal.x - state.x > 5) keys.push('d');
  else if (goal.x - state.x < -5) keys.push('a');
  if (goal.y - state.y > 5) keys.push('s');
  else if (goal.y - state.y < -5) keys.push('w');
  return keys;
}

async function circlingAttack(p, path, index, options) {
  const started = Date.now();
  const geometry = await p.world();
  const radius = options.openWindow ? 508 : 580;
  let direction = 1;
  let sight = false;
  let lastRecord = 0;
  try {
    while (Date.now() - started < (options.timeout || 180000)) {
      const state = await p.state();
      if (await p.auto(state)) continue;
      const target = await object(p, path, index);
      if (!alive(target) || target.hp <= 0) return;
      let firingTarget = target;
      if (options.pylons) {
        const remaining = await p.data(() => {
          const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
          return play.ctx.flags.pylons.filter(entity => !entity.dead).map(entity => ({
            id: entity.id, x: entity.x, y: entity.y, hp: entity.hp,
          }));
        });
        if (!remaining.length) return;
        remaining.sort((a, b) => gap(a, state) - gap(b, state));
        firingTarget = remaining[0];
      }
      if (options.pylons && state.powers.expand?.cd <= 0.01 && state.energy >= 70) await p.press('g');
      const radial = gap(state, target);
      const angle = Math.atan2(state.y - target.y, state.x - target.x);
      if (radial < 440) {
        const goal = { x: target.x + Math.cos(angle) * radius, y: target.y + Math.sin(angle) * radius };
        const tp = state.powers.teleport;
        if (safePoint(geometry, goal, state.r) && tp?.cd <= 0.01 && state.energy >= tp.cost && await p.aim(goal.x, goal.y)) {
          await p.movement([]);
          await p.press('Space');
        } else await p.movement(walkKeys(state, goal));
        await p.sleep(80);
        continue;
      }
      if (angle < 0.22 || angle > Math.PI - 0.22) direction = angle < Math.PI / 2 ? 1 : -1;
      let goal = null;
      for (const sign of [direction, -direction]) {
        const nextAngle = angle + sign * 0.22;
        const point = { x: target.x + Math.cos(nextAngle) * radius, y: target.y + Math.sin(nextAngle) * radius };
        let clear = true;
        for (let n = 0; n <= 8; n++) {
          const probe = { x: state.x + (point.x - state.x) * n / 8, y: state.y + (point.y - state.y) * n / 8 };
          if (gap(probe, target) < 430 || !safePoint(geometry, probe, state.r)) clear = false;
        }
        if (clear) { goal = point; direction = sign; break; }
      }
      if (!goal) throw new Error('No hazard-safe small-angle boss arc: ' + JSON.stringify({ state, target }));
      // A short circular chord stays outside the clock hands. No A* movement
      // may shortcut through the hazard circle, and movement never blocks Q/F.
      await p.movement(walkKeys(state, goal));
      const open = !options.openWindow || target.open && target.cycle >= 6 && target.cycle < 8.85 || target.exposed > 0.3;
      const beamActive = path === 'flags.carrier' && target.beamT >= 0.65 && target.beamT <= 3.5;
      const wantSight = !!state.powers.timesight && state.energy > 26 &&
        (options.openWindow ? open : beamActive);
      if (beamActive && state.powers.teleport?.cd <= 0.01 && state.energy >= 36) {
        const crossing = await p.data(() => {
          const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
          const boss = play.ctx.flags.carrier;
          return boss.beamHit(play.player, Math.max(1, boss.beamT), Math.min(3.5, boss.beamT + 0.3));
        });
        const jumpAngle = angle + direction * 0.55;
        const jump = { x: target.x + Math.cos(jumpAngle) * radius, y: target.y + Math.sin(jumpAngle) * radius };
        if (crossing && safePoint(geometry, jump, state.r) && await p.aim(jump.x, jump.y)) await p.press('Space');
      }
      if (wantSight !== sight) {
        sight = wantSight;
        p.actions.push({ type: sight ? 'hold-begin' : 'hold-end', key: 'f', at: Date.now() - p.beganAt });
        if (sight) await p.page.keyboard.down('f');
        else await p.page.keyboard.up('f');
      }
      const q = state.powers.disintegrate;
      if (open && q?.cd <= 0.01 && state.energy >= q.cost && await p.aim(firingTarget.x, firingTarget.y)) await p.press('q');
      else if (!open) {
        const other = state.foes?.filter(foe => !foe.boss && foe.los && foe.distance < 480)
          .sort((a, b) => a.distance - b.distance)[0];
        if (other && q?.cd <= 0.01 && state.energy >= q.cost && await p.aim(other.x, other.y)) await p.press('q');
        else if (state.powers.duplicate?.cd <= 0.01 && state.energy >= 86) await p.press('r');
      }
      if (Date.now() - lastRecord > 1200) {
        p.trace.push({ label: 'actual circular boss combat', hp: state.hp, energy: state.energy,
          bossHp: target.hp, cycle: target.cycle, open: target.open, radius: radial, goal, sight,
          firingTarget: firingTarget.id, beamT: target.beamT });
        lastRecord = Date.now();
      }
      await p.sleep(80);
    }
    throw new Error('Normal-input circular boss combat exceeded its route budget');
  } finally {
    await p.page.keyboard.up('f');
    await p.movement([]);
  }
}

async function attack(p, path, index = null, options = {}) {
  if (options.orbit) return circlingAttack(p, path, index, options);
  const started = Date.now();
  const limit = options.timeout || 100000;
  while (Date.now() - started < limit) {
    const state = await p.state();
    if (await p.auto(state)) continue;
    const target = await object(p, path, index);
    if (!alive(target) || target.hp <= 0) return;
    if (gap(state, target) > 540 || !await p.aim(target.x, target.y)) {
      await targetApproach(p, target);
      continue;
    }
    const q = state.powers.disintegrate;
    const attackWindow = !options.openWindow || target.open && target.cycle >= 6 && target.cycle < 8.6 ||
      target.exposed > 0.4;
    if (q?.cd <= 0.01 && state.energy >= q.cost && attackWindow) {
      await p.press('q');
      await p.sleep(220);
    } else await p.sleep(100);
  }
  throw new Error('Normal-input attacks did not finish ' + path + ' within route budget');
}

async function group(p, path, options = {}) {
  await p.until('initialized combat group ' + path, async state => state.onTop && !state.locked && !state.dialog &&
    await p.data(path => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      return Array.isArray(path.split('.').reduce((value, key) => value?.[key], play.ctx));
    }, path), 45000);
  const length = await p.data(path => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    return path.split('.').reduce((value, key) => value?.[key], play.ctx).length;
  }, path);
  for (let index = 0; index < length; index++) await attack(p, path, index, options);
}

async function coil(p, index) {
  const sample = () => p.data(index => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    const item = play.ctx.flags.coilObjects[index];
    const dock = play.world.entities.find(entity => entity.coil === item);
    if (!item || !dock) return null;
    return { id: item.id, x: item.x, y: item.y, r: item.r, speed: item.speed,
      held: item.heldBy === play.player, docked: !!item.docked,
      dock: { x: dock.x, y: dock.y }, player: { x: play.player.x, y: play.player.y } };
  }, index);
  const first = await sample();
  if (!first) throw new Error('Required coil and dock were not initialized');
  if (first.docked) return;
  const value = await p.data(index => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    const item = play.ctx.flags.coilObjects[index];
    const dock = play.world.entities.find(entity => entity.coil === item);
    const middle = { x: (item.x + dock.x) / 2, y: (item.y + dock.y) / 2 };
    return [[0, 100], [0, -100], [-100, 0], [100, 0]]
      .map(([dx, dy]) => ({ x: middle.x + dx, y: middle.y + dy }))
      .filter(point => play.world.isFree(point.x, point.y, play.player.r));
  }, index);
  if (!value.length) throw new Error('Coil has no ordinary carrying position');
  await p.moveTo(value[0].x, value[0].y, { tolerance: 12, combat: false });
  const current = await sample();
  const waypoints = planRealInputPath(await p.world(), current, current.dock, current.r);
  if (!waypoints.length) throw new Error('No collision-safe object route to the coil dock');
  p.trace.push({ label: 'coil ' + index + ' collision-safe path', waypoints, initial: current });
  if (!await p.aim(current.x, current.y)) throw new Error('Coil is outside the actual viewport');
  p.actions.push({ type: 'hold-begin', key: 'c', at: Date.now() - p.beganAt });
  await p.page.keyboard.down('c');
  try {
    await p.until('coil grabbed by normal C input', async () => (await sample())?.held, 4000);
    for (const [step, point] of waypoints.entries()) {
      const started = Date.now();
      let observed;
      let stable = 0;
      do {
        if (!await p.aim(point.x, point.y)) throw new Error('Coil waypoint is outside the actual viewport');
        await p.sleep(80);
        observed = await sample();
        if (!observed?.held) throw new Error('Coil released before its dock: ' + JSON.stringify(observed));
        stable = gap(observed, point) <= 14 && observed.speed < 90 ? stable + 1 : 0;
        if (stable >= (step === waypoints.length - 1 ? 3 : 1)) break;
      } while (Date.now() - started < 12000);
      p.trace.push({ label: 'coil ' + index + ' mouse waypoint ' + step, point, observed });
      if (!observed || gap(observed, point) > 14 || observed.speed >= 90)
        throw new Error('Physical coil drag did not settle: ' + JSON.stringify({ point, observed }));
    }
    const settled = await sample();
    if (!settled || gap(settled, settled.dock) >= 45 || settled.speed >= 90)
      throw new Error('Coil is not ready for gentle release: ' + JSON.stringify(settled));
    p.trace.push({ label: 'coil ' + index + ' actual pre-release', ...settled });
  } finally {
    await p.page.keyboard.up('c');
    p.actions.push({ type: 'hold-end', key: 'c', at: Date.now() - p.beganAt });
  }
  await p.until('coil physically docked', state => !!(state.flags.coils & (1 << index)), 8000);
  p.trace.push({ label: 'coil ' + index + ' actual dock result', ...await sample() });
}

async function lastBroadcast(p) {
  await ready(p, 'arrival', 'broadcast_roofs', ['flags.roofGuards']);
  await group(p, 'flags.roofGuards');
  await use(p, 'ENTER THE RELAY');
  await ready(p, 'relay', 'broadcast_relay', ['flags.relayGuards', 'flags.coilObjects', 'flags.engineers', 'flags.coils']);
  await group(p, 'flags.relayGuards');
  for (let index = 0; index < 3; index++) {
    await use(p, 'Free the engineer');
    await clearDialog(p);
  }
  await coil(p, 0);
  await coil(p, 1);
  await use(p, 'ROOFTOP LIFT');
  await ready(p, 'carrier', 'broadcast_tower', ['flags.towerGuards', 'flags.pylons', 'flags.carrier']);
  await group(p, 'flags.towerGuards');
  await circlingAttack(p, 'flags.carrier', null, { pylons: true, timeout: 120000 });
  await attack(p, 'flags.carrier', null, { orbit: true, timeout: 120000 });
  await p.until('real carrier defeat reveals decision', state => state.stageId === 'choice', 45000);
  await clearDialog(p);
  await use(p, 'SHUT IT DOWN SILENTLY');
  await p.until('silent route reaches departure', state => state.stageId === 'departure', 45000);
  await clearDialog(p);
  await use(p, 'BOARD THE OWLSHIP');
  return p.until('Last Broadcast naturally completes', state => state.done || state.scene === 'BonusComplete', 45000);
}

async function ninthMinute(p) {
  await ready(p, 'platform', 'ninth_platform', ['flags.platformFoes', 'flags.switch']);
  await group(p, 'flags.platformFoes');
  await p.interact('flags.switch');
  await p.until('SERVICE route selected', state => state.flags.route === 1, 5000);
  await use(p, 'SERVICE TUNNEL');
  await ready(p, 'rescue', 'ninth_train', ['flags.rescueFoes', 'flags.doors', 'flags.laurie']);
  await group(p, 'flags.rescueFoes');
  for (let index = 0; index < 3; index++) {
    await p.interact('flags.doors', index);
    await group(p, 'flags.rescueFoes');
    const door = await object(p, 'flags.doors', index);
    await p.moveTo(door.x + 80, door.y + 100, { tolerance: 25, combat: false });
    await p.until('carriage ' + (index + 1) + ' opens by defended work', async () => {
      const current = await object(p, 'flags.doors', index);
      return current.open;
    }, 30000);
  }
  await p.until('six passengers physically reach safety', state => state.flags.passengers === 6, 50000);
  await use(p, 'CLOCK CHAMBER');
  await ready(p, 'pendulum', 'ninth_engine', ['flags.engineFoes', 'flags.pendulum']);
  await group(p, 'flags.engineFoes');
  await attack(p, 'flags.pendulum', null, { orbit: true, openWindow: true, timeout: 180000 });
  await p.until('real Pendulum defeat reveals decision', state => state.stageId === 'decision', 45000);
  await clearDialog(p);
  await use(p, 'RELEASE THE LOOP');
  await p.until('release route reaches departure', state => state.stageId === 'departure', 45000);
  await clearDialog(p);
  await use(p, 'RETURN TO THE PLATFORM');
  return p.until('Ninth Minute naturally completes', state => state.done || state.scene === 'NinthComplete', 45000);
}

export const bonusRoutes = { last_broadcast: lastBroadcast, ninth_minute: ninthMinute };
export const routes = bonusRoutes;
