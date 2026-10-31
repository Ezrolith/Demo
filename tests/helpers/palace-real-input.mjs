/* Real input only. Browser evaluations read state; route planning stays in Node. */
import assert from 'node:assert/strict';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const free = (world, point, radius) => {
  if (point.x < radius || point.y < radius || point.x > world.w - radius || point.y > world.h - radius) return false;
  if ((world.bodies || []).some(body => distance(point, body) < radius + body.r - 0.01)) return false;
  return world.walls.every(wall => {
    if (wall.noCollide) return true;
    const x = Math.max(wall.x, Math.min(point.x, wall.x + wall.w));
    const y = Math.max(wall.y, Math.min(point.y, wall.y + wall.h));
    return Math.hypot(point.x - x, point.y - y) >= radius - 0.01;
  });
};
const clearLine = (world, a, b, radius) => {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 8));
  for (let n = 0; n <= steps; n++) {
    const point = { x: a.x + (b.x - a.x) * n / steps, y: a.y + (b.y - a.y) * n / steps };
    if (!free(world, point, radius)) return false;
  }
  return true;
};
function pathThrough(world, start, goal, radius) {
  if (clearLine(world, start, goal, radius)) return [goal];
  const step = 40;
  const grid = new Map();
  for (let y = step; y < world.h; y += step) {
    for (let x = step; x < world.w; x += step) {
      const node = { x, y, cost: Infinity, parent: null };
      if (free(world, node, radius)) grid.set(x + ':' + y, node);
    }
  }
  const open = new Set();
  const closed = new Set();
  for (const node of grid.values()) {
    if (distance(start, node) <= step * 2 && clearLine(world, start, node, radius)) {
      node.cost = distance(start, node);
      open.add(node);
    }
  }
  let end = null;
  while (open.size) {
    let current = null;
    for (const node of open) {
      if (!current || node.cost + distance(node, goal) < current.cost + distance(current, goal)) current = node;
    }
    open.delete(current);
    if (distance(current, goal) < step * 2 && clearLine(world, current, goal, radius)) {
      end = current;
      break;
    }
    closed.add(current);
    for (let dy = -step; dy <= step; dy += step) {
      for (let dx = -step; dx <= step; dx += step) {
        if (!dx && !dy) continue;
        const next = grid.get(current.x + dx + ':' + (current.y + dy));
        if (!next || closed.has(next) || !clearLine(world, current, next, radius)) continue;
        const cost = current.cost + Math.hypot(dx, dy);
        if (cost >= next.cost) continue;
        next.cost = cost;
        next.parent = current;
        open.add(next);
      }
    }
  }
  if (!end) return [];
  const path = [goal];
  for (let node = end; node; node = node.parent) path.push({ x: node.x, y: node.y });
  path.push({ x: start.x, y: start.y });
  path.reverse();
  const route = [];
  for (let n = 0; n < path.length - 1;) {
    let next = path.length - 1;
    while (next > n + 1 && !clearLine(world, path[n], path[next], radius)) next--;
    route.push(path[next]);
    n = next;
  }
  return route;
}

export const planRealInputPath = pathThrough;

export class RealInputPilot {
  constructor(page, momentId, options = {}) {
    this.page = page;
    this.momentId = momentId;
    this.trace = [];
    this.actions = [];
    this.errors = [];
    this.held = new Set();
    this.minimumHealth = Infinity;
    this.beganAt = Date.now();
    this.deadline = this.beganAt + (options.timeoutMs || 15 * 60 * 1000);
    this.lastCast = 0;
    this.worldCache = null;
    this.progressKey = '';
    this.progressAt = this.beganAt;
    this.page.on('pageerror', error => this.errors.push(String(error)));
  }
  data(fn, value) {
    return this.page.evaluate(fn, value);
  }
  async state() {
    const state = await this.data(() => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      const top = DM.Engine.top();
      if (!play) return { scene: top?.constructor.name, error: DM.Engine.error ? String(DM.Engine.error) : null };
      const player = play.player;
      const scalar = object => Object.fromEntries(Object.entries(object || {})
        .filter(([, value]) => value === null || ['number', 'string', 'boolean'].includes(typeof value)));
      return {
        scene: top?.constructor.name,
        onTop: top === play,
        chapter: play.chapter.id,
        stage: play.ctx.stageIndex,
        stageId: play.chapter.stages[play.ctx.stageIndex]?.id,
        map: play.world.mapId,
        x: player.x,
        y: player.y,
        r: player.r,
        hp: player.coherence,
        maxHp: player.maxCoherence,
        energy: player.energy,
        carry: player.carry,
        carryMax: player.carryMax,
        body: play.ctx.refs.body ? { bank: play.ctx.refs.body.bank, quota: play.ctx.refs.body.quota,
          layer: play.ctx.refs.body.layerIndex } : null,
        form: player.form,
        scale: player.scale,
        hero: player.profile?.id || null,
        locked: player.locked || play.ctx.locked,
        dialog: play.dialog.active,
        captionSkippable: play.hud.captionSkippable() && play.hud.captions.length > 0,
        failed: play.failed,
        down: player.down,
        god: !!player.godMode || !!DM.Save.settings.invulnerable,
        challenge: DM.Save.settings.challenge,
        stats: { ...play.ctx.stats },
        flags: scalar(play.ctx.flags),
        done: play.ctx.done,
        objective: play.hud.objective?.text || '',
        interaction: player.interactTarget ? { id: player.interactTarget.id, label: player.interactTarget.interact.label } : null,
        powers: Object.fromEntries(Object.entries(player.powers).map(([id, value]) => [id, {
          cd: value.cd, active: value.active, targetId: value.target?.id || null,
          cost: DM.Powers.get(id)?.cost || 0, action: DM.Powers.get(id)?.action,
        }])),
        foes: play.world.entities.filter(entity => entity.team === 'enemy' && !entity.dead &&
          !entity.ko && !entity.isProjectile && !entity.neutralized && entity.hp != null &&
          (entity instanceof DM.Enemies.Enemy || entity === play.world.boss)).map(entity => ({
          id: entity.id, x: entity.x, y: entity.y, hp: entity.hp,
          human: !!entity.human, boss: entity === play.world.boss,
          phase: entity.phase, mode: entity.attackMode, timer: entity.timer, warningAngle: entity.warningAngle,
          distance: Math.hypot(entity.x - player.x, entity.y - player.y),
          los: play.world.los(player.x, player.y, entity.x, entity.y),
          screen: play.world.camera.toScreen(entity.x, entity.y),
        })),
        error: DM.Engine.error ? String(DM.Engine.error.stack || DM.Engine.error) : null,
      };
    });
    this.lastState = state;
    if (this.onState) await this.onState(state);
    assert.ok(!state.error, 'engine error: ' + state.error);
    if (state.chapter) {
      assert.equal(state.chapter, this.momentId, 'ordinary entry stays in the selected moment');
      assert.equal(state.challenge, 'normal', 'Normal difficulty is retained');
      assert.ok(!state.god, 'no invulnerability or god mode');
      this.minimumHealth = Math.min(this.minimumHealth, state.hp);
      if (state.failed || state.down || state.hp <= 0) throw new Error('Normal-damage actor was defeated: ' + JSON.stringify(state));
      const progress = JSON.stringify([state.stage, Math.round(state.x), Math.round(state.y),
        Math.round(state.hp * 10), Math.floor(state.energy), state.carry, state.body,
        state.objective, state.flags, state.foes.map(foe => [foe.id, foe.hp])]);
      if (progress !== this.progressKey || state.locked || !state.onTop || state.dialog) {
        this.progressKey = progress;
        this.progressAt = Date.now();
      } else if (!state.done && Date.now() - this.progressAt > 60000) {
        throw new Error('Pilot stagnated for sixty seconds without actor, quest or combat progress: ' + JSON.stringify(state));
      }
    }
    if (Date.now() > this.deadline) throw new Error('Route time budget expired: ' + JSON.stringify(state));
    return state;
  }
  async press(key) {
    this.actions.push({ type: 'key', key, at: Date.now() - this.beganAt });
    await this.page.keyboard.down(key);
    await this.page.waitForTimeout(35);
    await this.page.keyboard.up(key);
    await this.page.waitForTimeout(40);
  }
  async movement(keys) {
    const wanted = new Set(keys);
    for (const key of this.held) if (!wanted.has(key)) await this.page.keyboard.up(key);
    for (const key of wanted) if (!this.held.has(key)) await this.page.keyboard.down(key);
    this.held = wanted;
  }
  async release() {
    await this.movement([]);
    for (const key of ['c', 'f', 'r', 'g', 'q', 'Space']) await this.page.keyboard.up(key);
  }
  async sleep(ms) {
    await this.page.waitForTimeout(ms);
    await this.state();
  }
  async hold(key, seconds) {
    this.actions.push({ type: 'hold', key, seconds, at: Date.now() - this.beganAt });
    await this.page.keyboard.down(key);
    try { await this.sleep(seconds * 1000); }
    finally { await this.page.keyboard.up(key); }
  }
  async auto(state = null) {
    const value = state || await this.state();
    if (value.scene === 'PowerUnlock' || value.scene === 'Interlude' || value.dialog || value.captionSkippable) {
      await this.release();
      await this.press('Space');
      return true;
    }
    return false;
  }
  async until(label, predicate, timeout = 30000) {
    const began = Date.now();
    while (Date.now() - began < timeout) {
      const state = await this.state();
      if (await predicate(state)) {
        this.trace.push({ label, ...state });
        return state;
      }
      await this.auto(state);
      await this.page.waitForTimeout(90);
    }
    throw new Error('Timed out: ' + label + ' ' + JSON.stringify(await this.state()));
  }
  async menu(prefix) {
    const point = await this.data(prefix => {
      const menu = DM.Engine.top()?.menu;
      const index = menu?.items.findIndex(item => item.label === prefix || item.label.startsWith(prefix));
      if (!(index >= 0)) throw new Error('Actual menu action missing: ' + prefix);
      const rect = menu.rowRect(index);
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    }, prefix);
    this.actions.push({ type: 'menu', prefix, point, at: Date.now() - this.beganAt });
    await this.page.mouse.click(point.x, point.y);
    await this.page.waitForTimeout(100);
  }
  async aim(x, y) {
    const point = await this.data(goal => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      return play.world.camera.toScreen(goal.x, goal.y);
    }, { x, y });
    if (point.x < 8 || point.x > 1272 || point.y < 8 || point.y > 712) return false;
    await this.page.mouse.move(point.x, point.y);
    return true;
  }
  async entity(path, index = null) {
    return this.data(({ path, index }) => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      let entity = path.split('.').reduce((value, key) => value?.[key], play.ctx);
      if (index !== null) entity = entity?.[index];
      if (!entity) return null;
      return { id: entity.id, x: entity.x, y: entity.y, r: entity.r, range: entity.interact?.range,
        dead: !!entity.dead, safe: !!entity.safe, aligned: !!entity.aligned, neutralized: !!entity.neutralized };
    }, { path, index });
  }
  async world() {
    return this.data(() => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      return { w: play.world.w, h: play.world.h,
        walls: play.world.walls.map(wall => ({ x: wall.x, y: wall.y, w: wall.w, h: wall.h, noCollide: !!wall.noCollide })),
        bodies: play.world.entities.filter(entity => entity !== play.player && entity.static && entity.body &&
          !entity.dead && !entity.heldBy && entity.flying === play.player.flying)
          .map(entity => ({ x: entity.x, y: entity.y, r: entity.r })) };
    });
  }
  async objectPath(start, goal, radius) {
    return pathThrough(await this.world(), start, goal, radius);
  }
  async moveTo(x, y, options = {}) {
    const tolerance = options.tolerance ?? 25;
    const began = Date.now();
    let route = [];
    let refreshAt = 0;
    while (Date.now() - began < (options.timeout || 60000)) {
      const state = await this.state();
      if (!state.onTop || state.locked) {
        await this.auto(state);
        await this.page.waitForTimeout(80);
        continue;
      }
      if (distance(state, { x, y }) <= tolerance) {
        await this.movement([]);
        return state;
      }
      if (options.combat !== false && await this.fight(state)) {
        route = [];
        continue;
      }
      if (!route.length || Date.now() > refreshAt) {
        const world = await this.world();
        route = pathThrough(world, state, { x, y }, state.r);
        refreshAt = Date.now() + 800;
        if (!route.length) throw new Error('No collision-safe route to ' + x + ',' + y);
      }
      while (route.length > 1 && distance(state, route[0]) < 22) route.shift();
      const goal = route[0] || { x, y };
      const keys = [];
      if (goal.x - state.x > 7) keys.push('d');
      else if (goal.x - state.x < -7) keys.push('a');
      if (goal.y - state.y > 7) keys.push('s');
      else if (goal.y - state.y < -7) keys.push('w');
      await this.movement(keys);
      await this.page.waitForTimeout(65);
    }
    await this.movement([]);
    throw new Error('Walking route blocked at ' + JSON.stringify(await this.state()) + ' goal ' + x + ',' + y);
  }
  async interact(path, index = null) {
    const entity = await this.entity(path, index);
    if (!entity) throw new Error('Interaction entity unavailable: ' + path);
    const world = await this.world();
    const state = await this.state();
    const range = Math.min(42, (entity.range || 60) * 0.7);
    const candidates = [[0, range], [range, 0], [-range, 0], [0, -range]]
      .map(([dx, dy]) => ({ x: entity.x + dx, y: entity.y + dy }))
      .filter(point => free(world, point, state.r)).sort((a, b) => distance(a, state) - distance(b, state));
    for (const point of candidates) {
      await this.moveTo(point.x, point.y, { tolerance: 10 });
      const reached = await this.state();
      if (reached.interaction?.id !== entity.id) continue;
      await this.press('e');
      await this.page.waitForTimeout(100);
      return;
    }
    throw new Error('Could not physically reach the intended interaction: ' + path);
  }
  async teleport(x, y) {
    await this.movement([]);
    const target = await this.data(goal => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      const screen = play.world.camera.toScreen(goal.x, goal.y);
      const applied = { x: Math.max(8, Math.min(1272, screen.x)), y: Math.max(8, Math.min(712, screen.y)) };
      return { requestedScreen: screen, appliedScreen: applied, appliedWorld: play.world.camera.toWorld(applied.x, applied.y) };
    }, { x, y });
    this.actions.push({ type: 'teleport-aim', requestedWorld: { x, y }, ...target, at: Date.now() - this.beganAt });
    await this.page.mouse.move(target.appliedScreen.x, target.appliedScreen.y);
    await this.press('Space');
    await this.sleep(650);
  }
  async recoverBehindCover(targetHealth = 75) {
    const cover = await this.data(() => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      const boss = play.world.boss;
      if (!boss || boss.dead) return null;
      const mines = play.world.entities.filter(entity => entity instanceof DM.Special.Mine && !entity.dead);
      const candidates = [];
      for (const wall of play.world.walls) {
        if (wall.noCollide || wall.low || wall.seeThrough) continue;
        const cx = wall.x + wall.w / 2;
        const cy = wall.y + wall.h / 2;
        for (const point of [
          { x: wall.x - 110, y: cy }, { x: wall.x + wall.w + 110, y: cy },
          { x: cx, y: wall.y - 110 }, { x: cx, y: wall.y + wall.h + 110 },
        ]) {
          if (!play.world.isFree(point.x, point.y, play.player.r + 10)) continue;
          if (play.world.los(boss.x, boss.y, point.x, point.y)) continue;
          if (mines.some(mine => Math.hypot(point.x - mine.x, point.y - mine.y) < 100)) continue;
          candidates.push(point);
        }
      }
      candidates.sort((a, b) => Math.hypot(a.x - play.player.x, a.y - play.player.y) -
        Math.hypot(b.x - play.player.x, b.y - play.player.y));
      return candidates[0] || null;
    });
    if (!cover) return false;
    const before = await this.state();
    this.trace.push({ label: 'ordinary cover recovery begins', cover, hp: before.hp, fieldTime: before.stats.time });
    for (let jump = 0; jump < 8; jump++) {
      const state = await this.state();
      if (distance(state, cover) < 40) break;
      if (state.energy < 18) {
        await this.sleep(400);
        continue;
      }
      const ratio = Math.min(1, 280 / distance(state, cover));
      await this.teleport(state.x + (cover.x - state.x) * ratio, state.y + (cover.y - state.y) * ratio);
    }
    await this.release();
    const began = Date.now();
    while (Date.now() - began < 18000) {
      const state = await this.state();
      if (state.hp >= targetHealth || state.done) {
        this.trace.push({ label: 'ordinary recovery reached target', hp: state.hp, fieldTime: state.stats.time });
        return true;
      }
      if (state.powers.duplicate?.cd <= 0 && state.energy >= state.powers.duplicate.cost) await this.press('r');
      await this.sleep(250);
    }
    const after = await this.state();
    this.trace.push({ label: 'ordinary recovery timeout', hp: after.hp, fieldTime: after.stats.time });
    return after.hp > before.hp;
  }
  async fight(state = null) {
    const value = state || await this.state();
    const attackRange = value.hero ? 420 : (value.powers.disintegrate ? 480 : 400) * (value.scale || 1);
    const foe = value.foes?.filter(enemy => enemy.los && enemy.distance < attackRange &&
      enemy.screen.x >= 8 && enemy.screen.x <= 1272 && enemy.screen.y >= 8 && enemy.screen.y <= 712)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!foe) {
      const next = value.foes?.slice().sort((a, b) => a.distance - b.distance)[0];
      if (!next) return false;
      const point = await this.data(enemy => {
        const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
        const points = Array.from({ length: 12 }, (_, index) => {
          const angle = index * Math.PI / 6;
          return { x: enemy.x + Math.cos(angle) * 180, y: enemy.y + Math.sin(angle) * 180 };
        }).filter(point => play.world.isFree(point.x, point.y, play.player.r + 2) &&
          play.world.los(point.x, point.y, enemy.x, enemy.y));
        points.sort((a, b) => Math.hypot(a.x - play.player.x, a.y - play.player.y) -
          Math.hypot(b.x - play.player.x, b.y - play.player.y));
        return points[0] || null;
      }, next);
      if (!point || distance(value, point) < 4) return false;
      await this.moveTo(point.x, point.y, { tolerance: 6, combat: false, timeout: 15000 });
      return true;
    }
    if (!await this.aim(foe.x, foe.y)) return false;
    if (value.hero) {
      const powers = Object.values(value.powers);
      const ready = action => powers.find(power => power.action === action && power.cd <= 0.01 && value.energy >= power.cost);
      if (foe.boss && (foe.mode === 'warn' || foe.mode === 'charge')) {
        const angle = foe.warningAngle + Math.PI / 2;
        const keys = [];
        if (Math.cos(angle) > 0.2) keys.push('d');
        else if (Math.cos(angle) < -0.2) keys.push('a');
        if (Math.sin(angle) > 0.2) keys.push('s');
        else if (Math.sin(angle) < -0.2) keys.push('w');
        await this.movement(keys);
        await this.page.waitForTimeout(100);
        return true;
      }
      if (foe.distance > (value.hero === 'rorschach' ? 75 : 250)) {
        const keys = [];
        if (foe.x - value.x > 15) keys.push('d');
        else if (foe.x - value.x < -15) keys.push('a');
        if (foe.y - value.y > 15) keys.push('s');
        else if (foe.y - value.y < -15) keys.push('w');
        await this.movement(keys);
      } else await this.movement([]);
      if (value.hp < 55 && ready('duplicate')) await this.press('r');
      if (value.foes.filter(enemy => enemy.distance < 145).length >= 2 && ready('expand')) await this.press('g');
      if (foe.distance < 95) await this.page.keyboard.down('c');
      if (ready('disintegrate') && Date.now() - this.lastCast > 350 &&
        (value.hero !== 'rorschach' || foe.distance < 255)) {
        await this.press('q');
        this.lastCast = Date.now();
      }
      if (value.hero === 'niteowl' || foe.boss && foe.mode === 'recover') await this.page.keyboard.down('f');
      await this.page.waitForTimeout(100);
      await this.page.keyboard.up('c');
      await this.page.keyboard.up('f');
      return true;
    }
    await this.movement([]);
    if (value.powers.duplicate?.cd <= 0 && value.energy >= value.powers.duplicate.cost) await this.press('r');
    if (value.powers.expand?.cd <= 0 && value.energy >= value.powers.expand.cost && foe.distance < 240) await this.press('g');
    if (value.powers.disintegrate?.cd <= 0 && value.energy >= value.powers.disintegrate.cost) {
      if (foe.boss && value.powers.timesight && value.energy > 40) await this.page.keyboard.down('f');
      await this.press('q');
      await this.page.keyboard.up('f');
    } else if (value.powers.telekinesis?.cd <= 0 && value.energy >= 10 && foe.distance < 380) {
      await this.page.keyboard.down('c');
      await this.page.waitForTimeout(240);
      await this.page.mouse.move(foe.screen.x + 150, foe.screen.y + 80, { steps: 2 });
      await this.page.keyboard.up('c');
    }
    await this.page.waitForTimeout(120);
    return true;
  }
  async clearEnemies(timeout = 120000) {
    const began = Date.now();
    while (Date.now() - began < timeout) {
      const state = await this.state();
      if (await this.auto(state)) continue;
      if (!state.foes?.length) return;
      if (await this.fight(state)) continue;
      const foe = state.foes.sort((a, b) => a.distance - b.distance)[0];
      await this.moveTo(foe.x, foe.y, { tolerance: 220, timeout: 30000 });
    }
    throw new Error('Actual-input combat did not clear within its route budget');
  }
}
