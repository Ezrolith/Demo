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
      open: !!value.open, cycle: value.cycle, exposed: value.exposed,
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

async function bossMove(p, boss, goal) {
  let state = await p.state();
  const body = await object(p, boss.path, boss.index);
  if (!body) throw new Error('Boss movement target disappeared');
  const clearance = body.r + 80;
  if (gap(state, body) < clearance) {
    const angle = Math.atan2(state.y - body.y, state.x - body.x);
    const retreat = await p.data(({ body, angle }) => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      return [0, -0.35, 0.35, -0.7, 0.7].map(offset => ({
        x: body.x + Math.cos(angle + offset) * 220,
        y: body.y + Math.sin(angle + offset) * 220,
      })).find(point => play.world.isFree(point.x, point.y, play.player.r));
    }, { body, angle });
    if (!retreat) throw new Error('No ordinary radial retreat from the boss body');
    await p.moveTo(retreat.x, retreat.y, { tolerance: 6, combat: false, timeout: 12000 });
    state = await p.state();
  }
  const geometry = await p.world();
  const margin = body.r + 12;
  geometry.walls = [...geometry.walls, {
    x: body.x - margin, y: body.y - margin, w: margin * 2, h: margin * 2,
  }];
  const route = planRealInputPath(geometry, state, goal, state.r + 1);
  if (!route.length) throw new Error('No physical route around the solid boss body');
  p.trace.push({ label: 'boss-body collision-safe movement', boss: body.id, goal, route });
  for (const point of route) await p.moveTo(point.x, point.y, {
    tolerance: 5, combat: false, timeout: 15000,
  });
}

async function attack(p, path, index = null, options = {}) {
  const started = Date.now();
  const limit = options.timeout || 100000;
  let orbit = 0;
  let nextOrbit = 0;
  while (Date.now() - started < limit) {
    const state = await p.state();
    if (await p.auto(state)) continue;
    const target = await object(p, path, index);
    if (!alive(target) || target.hp <= 0) return;
    if (options.orbit && Date.now() >= nextOrbit) {
      const places = await p.data(target => {
        const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
        return [[-380, 300], [380, 300], [0, 500], [-430, 0], [430, 0]]
          .map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy }))
          .filter(point => play.world.isFree(point.x, point.y, play.player.r));
      }, target);
      if (!places.length) throw new Error('No ordinary boss orbit remains');
      const point = places[orbit++ % places.length];
      await bossMove(p, { path, index }, point);
      nextOrbit = Date.now() + 600;
      continue;
    }
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
  const waypoints = planRealInputPath(await p.world(), current, current.dock, current.r + 4);
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
  await group(p, 'flags.pylons');
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
