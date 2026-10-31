/* Opening campaign routes. Read-only telemetry steers actual input. */
async function prologue(p) {
  await p.until('Janey objective appears', state => /Find Janey/.test(state.objective));
  await p.interact('refs.janey');
  await p.until('Janey hands over the watch', state => state.flags.hasWatch && !state.dialog);
  await p.until('workbench objective', state => /Repair/.test(state.objective));
  await p.interact('refs.bench');
  await p.until('watch minigame opens', state => state.scene === 'WatchRepair');
  const began = Date.now();
  while (Date.now() - began < 90000) {
    const watch = await p.data(() => {
      const scene = DM.Engine.top();
      if (scene.constructor.name !== 'WatchRepair') return null;
      return { t: scene.t, angle: scene.angle, speed: scene.speed, direction: scene.dir,
        target: scene.zone.a, width: scene.zone.w, finished: scene.finished, step: scene.step };
    });
    if (!watch) break;
    if (!watch.finished && watch.t > 0.45) {
      const predicted = watch.angle + watch.speed * watch.direction * 0.025;
      const delta = Math.atan2(Math.sin(predicted - watch.target), Math.cos(predicted - watch.target));
      if (Math.abs(delta) < watch.width * 0.28) await p.press('Space');
    }
    await p.page.waitForTimeout(8);
  }
  await p.until('watch repaired normally', state => state.flags.repaired);
  await p.until('generator calibration objective', state => /Calibrate/.test(state.objective));
  await p.interact('refs.panel');
  await p.until('generator calibrated', state => state.flags.calibrated);
  await p.until('return Janey objective', state => /Bring Janey/.test(state.objective));
  await p.interact('refs.janey');
  await p.until('coat retrieval objective', state => /Fetch your coat/.test(state.objective));
  await p.interact('refs.coat');
  await p.until('intrinsic-field ending completes naturally', state => state.scene === 'ChapterComplete', 60000);
}
async function reassembly(p) {
  await p.until('Coalesce unlock and first layer', state => state.form === 'awareness' && !state.locked &&
    state.scene === 'Play' && /Rebuild/.test(state.objective), 30000);
  const began = Date.now();
  while (Date.now() - began < 7 * 60 * 1000) {
    const state = await p.state();
    if (state.form !== 'awareness' || state.flags.reassembled) break;
    if (await p.auto(state)) continue;
    const scene = await p.data(() => {
      const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
      return { body: { x: play.ctx.refs.body.x, y: play.ctx.refs.body.y,
        bank: play.ctx.refs.body.bank, quota: play.ctx.refs.body.quota, layer: play.ctx.refs.body.layerIndex },
      atoms: play.world.entities.filter(entity => entity instanceof DM.Special.Atom && !entity.dead)
        .map(entity => ({ x: entity.x, y: entity.y })),
      vortices: play.world.entities.filter(entity => entity instanceof DM.Special.Vortex && !entity.dead)
        .map(entity => ({ x: entity.x, y: entity.y, r: entity.r })) };
    });
    const needed = scene.body.quota - scene.body.bank;
    if (state.carry >= Math.min(state.carryMax, needed) && state.carry > 0) {
      await p.page.keyboard.up('c');
      await p.moveTo(scene.body.x, scene.body.y + 65, { tolerance: 35, combat: false, timeout: 30000 });
      await p.until('carried atoms deposited', value => value.carry === 0 ||
        value.form !== 'awareness' || !/Rebuild/.test(value.objective), 12000);
      continue;
    }
    const candidates = scene.atoms.map(atom => ({ ...atom,
      nearby: scene.atoms.filter(other => Math.hypot(atom.x - other.x, atom.y - other.y) < 120).length,
      distance: Math.hypot(atom.x - state.x, atom.y - state.y),
      danger: scene.vortices.some(vortex => Math.hypot(atom.x - vortex.x, atom.y - vortex.y) < 160),
    })).filter(atom => !atom.danger).sort((a, b) => a.distance / Math.max(1, a.nearby) - b.distance / Math.max(1, b.nearby));
    if (!candidates.length) {
      await p.sleep(100);
      continue;
    }
    if (state.energy > 12) await p.page.keyboard.down('c');
    else await p.page.keyboard.up('c');
    const goal = candidates[0];
    const dx = goal.x - state.x;
    const dy = goal.y - state.y;
    const keys = [];
    if (dx > 12) keys.push('d');
    else if (dx < -12) keys.push('a');
    if (dy > 12) keys.push('s');
    else if (dy < -12) keys.push('w');
    await p.movement(keys);
    await p.page.waitForTimeout(85);
  }
  await p.release();
  await p.until('real body reassembles and chapter ends', state => state.scene === 'ChapterComplete', 60000);
}
export const routes = { prologue, reassembly };
