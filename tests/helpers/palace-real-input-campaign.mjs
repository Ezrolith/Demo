/* Later campaign: read-only telemetry and actual power/movement inputs. */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
async function blinkToward(p, x, y) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = await p.state();
    if (dist(state, { x, y }) < 50) return;
    if (await p.auto(state)) continue;
    if (!state.powers.teleport || state.energy < 18) {
      await p.sleep(450);
      continue;
    }
    const length = dist(state, { x, y });
    const ratio = Math.min(1, 330 / length);
    await p.teleport(state.x + (x - state.x) * ratio, state.y + (y - state.y) * ratio);
  }
  throw new Error('Actual teleport route did not reach destination ' + x + ',' + y);
}
async function objectState(p, id) {
  return p.data(id => {
    const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
    const entity = play.world.entities.find(entity => entity.id === id);
    return entity ? { id, x: entity.x, y: entity.y, dead: !!entity.dead, placed: !!entity.placed,
      held: entity.heldBy === play.player } : null;
  }, id);
}
async function carryObject(p, id, destination, big = false) {
  const beganOnCrates = p.momentId === 'superman' && /Throw crates/.test((await p.state()).objective);
  for (let attempt = 0; attempt < 8; attempt++) {
    if (beganOnCrates && !/Throw crates/.test((await p.state()).objective)) {
      await p.page.keyboard.up('c');
      return;
    }
    const object = await objectState(p, id);
    if (!object || object.dead || object.placed) return;
    await p.moveTo(object.x, object.y + 75, { tolerance: 25, combat: false });
    if (big) {
      await p.until('Expand recovers normally', state => !state.locked && state.energy >= 70 &&
        state.powers.expand?.cd <= 0, 30000);
      await p.press('g');
      await p.sleep(350);
    }
    const current = await objectState(p, id);
    if (!current || !await p.aim(current.x, current.y)) continue;
    await p.page.keyboard.down('c');
    await p.sleep(160);
    const held = await p.state();
    if (held.powers.telekinesis?.targetId !== id) {
      await p.page.keyboard.up('c');
      await p.sleep(180);
      continue;
    }
    await p.moveTo(destination.x - 100, destination.y + 55, { tolerance: 25, combat: false });
    await p.aim(destination.x, destination.y);
    const began = Date.now();
    while (Date.now() - began < 3500) {
      if (beganOnCrates && !/Throw crates/.test((await p.state()).objective)) break;
      const next = await objectState(p, id);
      if (!next || next.dead || next.placed || dist(next, destination) < 18) break;
      await p.aim(destination.x, destination.y);
      await p.sleep(85);
    }
    await p.sleep(350);
    await p.page.keyboard.up('c');
    await p.sleep(250);
  }
  const final = await objectState(p, id);
  if (final && !final.placed && !final.dead) throw new Error('A real held object did not reach its target: ' + id);
}

async function superman(p) {
  await p.until('range crate objective', state => /Throw crates/.test(state.objective));
  for (let attempt = 0; attempt < 9 && /Throw crates/.test((await p.state()).objective); attempt++) {
    const targets = await p.data(() => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      const crate = play.world.entities.filter(entity => entity.tags.has('crate') && !entity.dead)
        .sort((a, b) => Math.hypot(a.x - play.player.x, a.y - play.player.y) -
          Math.hypot(b.x - play.player.x, b.y - play.player.y))[0];
      return { crate: crate && { id: crate.id }, zone: { x: play.ctx.refs.zone.x, y: play.ctx.refs.zone.y } };
    });
    if (!targets.crate) throw new Error('No range crate was available');
    await carryObject(p, targets.crate.id, targets.zone);
  }
  await p.until('jeep objective', state => /Lift the jeep/.test(state.objective));
  const jeep = await p.entity('refs.jeep');
  const zone = await p.entity('refs.zone');
  await carryObject(p, jeep.id, zone);
  await p.until('Disintegrate targets objective', state => /Disintegrate the targets/.test(state.objective));
  while ((await p.state()).stage === 0) {
    const state = await p.state();
    if (await p.auto(state)) continue;
    const target = await p.data(() => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      const target = play.ctx.refs.dummies?.find(entity => !entity.dead);
      return target ? { x: target.x, y: target.y } : null;
    });
    if (!target) { await p.sleep(120); continue; }
    await p.moveTo(target.x - 200, target.y - 50, { tolerance: 50, combat: false });
    if (await p.aim(target.x, target.y)) await p.press('q');
    await p.sleep(500);
  }
  await p.until('pier combat begins', state => state.map === 'pier' && !state.locked);
  await p.until('pier and office cleared', async state => {
    if (state.scene === 'ChapterComplete') return true;
    if (state.onTop && !state.locked && state.foes?.length) {
      if (!await p.fight(state)) {
        const next = state.foes.sort((a, b) => a.distance - b.distance)[0];
        await p.moveTo(next.x, next.y, { tolerance: 200 });
      }
    }
    return false;
  }, 5 * 60 * 1000);
}

async function deterrent(p) {
  await p.until('canyon objective', state => /Cross the canyon/.test(state.objective));
  await blinkToward(p, 1120, 800);
  await p.until('command post objective', state => /Reach the command/.test(state.objective));
  await blinkToward(p, 1450, 840);
  await p.until('Operation Blue Fire ends', async state => {
    if (state.scene === 'ChapterComplete') return true;
    if (state.onTop && !state.locked && state.foes?.length) {
      if (state.hp < 40 && state.powers.teleport && state.energy > 20) {
        if (!await p.recoverBehindCover(75)) await p.fight(await p.state());
      } else if (!await p.fight(state)) {
        const foe = state.foes.sort((a, b) => a.distance - b.distance)[0];
        await p.moveTo(foe.x, foe.y, { tolerance: 330 });
      }
    }
    return false;
  }, 7 * 60 * 1000);
}

async function mars(p) {
  await p.until('leave the television studio', state => /Leave/.test(state.objective));
  await p.teleport(900, 460);
  await p.until('palace crystal objective', state => state.map === 'mars' && !state.locked && /Build/.test(state.objective));
  for (const big of [false, true]) {
    if (big) await p.until('great crystal objective', state => /Set the great/.test(state.objective) && !state.locked);
    for (let attempt = 0; attempt < (big ? 8 : 20); attempt++) {
      const pair = await p.data(big => {
        const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
        const slot = play.ctx.refs.palace?.slots.find(slot => slot.big === big && !slot.filled);
        const shard = play.world.entities.filter(entity => entity instanceof DM.Special.Shard &&
          entity.big === big && !entity.placed && !entity.dead)
          .sort((a, b) => Math.hypot(a.x - play.player.x, a.y - play.player.y) -
            Math.hypot(b.x - play.player.x, b.y - play.player.y))[0];
        return slot && shard ? { slot: { x: slot.x, y: slot.y }, shard: { id: shard.id } } : null;
      }, big);
      if (!pair) break;
      await carryObject(p, pair.shard.id, pair.slot, big);
    }
  }
  await p.until('palace and Laurie story end naturally', state => state.scene === 'ChapterComplete', 60000);
}

async function karnak(p) {
  await p.until('emitter objective', state => /Destroy the tachyon/.test(state.objective) && !state.locked);
  for (let index = 0; index < 4; index++) {
    let emitter = await p.entity('refs.emitters', index);
    while (emitter && !emitter.dead) {
      const state = await p.state();
      if (await p.auto(state)) continue;
      await p.moveTo(emitter.x, emitter.y + 170, { tolerance: 25, combat: false });
      await p.until('energy for shield entry', value => value.energy >= 36, 20000);
      await p.teleport(emitter.x, emitter.y + 40);
      await p.aim(emitter.x, emitter.y);
      await p.press('q');
      await p.sleep(500);
      emitter = await p.entity('refs.emitters', index);
    }
  }
  await p.until('enter Karnak objective', state => /Enter Karnak/.test(state.objective) && !state.locked);
  await blinkToward(p, 2020, 1000);
  await p.until('subtractor reassembly', state => state.form === 'awareness' && !state.locked, 60000);
  await p.until('rebuild from ordinary atoms', async state => {
    if (state.form !== 'awareness') return true;
    const data = await p.data(() => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      const body = play.world.entities.find(entity => entity instanceof DM.Special.BodyForm && !entity.dead);
      const atoms = play.world.entities.filter(entity => entity instanceof DM.Special.Atom && !entity.dead)
        .sort((a, b) => Math.hypot(a.x - play.player.x, a.y - play.player.y) -
          Math.hypot(b.x - play.player.x, b.y - play.player.y));
      return { body: body && { x: body.x, y: body.y }, atom: atoms[0] && { x: atoms[0].x, y: atoms[0].y } };
    });
    if (state.carry >= 30 || !data.atom && state.carry > 0) {
      await p.page.keyboard.up('c');
      await p.moveTo(data.body.x, data.body.y + 30, { tolerance: 25, combat: false });
      await p.sleep(1400);
    } else if (data.atom) {
      await p.page.keyboard.down('c');
      await p.moveTo(data.atom.x, data.atom.y, { tolerance: 35, combat: false });
      await p.sleep(150);
    }
    return false;
  }, 90000);
  await p.release();
  await p.until('Veidt yields and story ends', async state => {
    if (state.scene === 'ChapterComplete') return true;
    if (state.onTop && !state.locked && state.foes?.length) await p.fight(state);
    return false;
  }, 120000);
}

export const routes = { superman, deterrent, mars, karnak };
