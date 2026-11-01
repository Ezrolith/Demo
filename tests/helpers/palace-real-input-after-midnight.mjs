/* Known case routes, entered normally by the shared pilot. No state setup here. */
async function deadAir(p) {
  await p.until('Dead Air briefing completes', state => !state.dialog && !state.locked && state.stage === 0);
  for (let index = 0; index < 3; index++) {
    await p.interact('flags.roofClues', index);
    await p.until('intercepted trace ' + index, state => !!(state.flags.clues & (1 << index)) && !state.dialog);
  }
  await p.until('aerial stage', state => state.stage === 1 && !state.dialog && !state.locked);
  for (let index = 0; index < 3; index++) {
    await p.interact('flags.aerials', index);
    for (let n = 0; n < 3; n++) {
      if ((await p.entity('flags.aerials', index)).aligned) break;
      await p.press('e');
      await p.sleep(150);
    }
    if (!(await p.entity('flags.aerials', index)).aligned) throw Error('Real aerial input did not align panel ' + index);
  }
  await p.interact('flags.lockTerminal');
  await p.until('uplink stage', state => state.stage === 2 && !state.dialog && !state.locked);
  await p.clearEnemies();
  await p.interact('flags.uplink');
  await p.until('Dead Air closes through actual upload', state => state.scene === 'Results');
}
async function undertow(p) {
  await p.until('Undertow briefing completes', state => !state.dialog && !state.locked && state.stage === 0);
  for (let index = 0; index < 2; index++) {
    await p.interact('flags.generators', index);
    await p.until('cable feed ' + index + ' isolated', state => !!(state.flags.power & (1 << index)));
  }
  await p.until('winch stage', state => state.stage === 1 && !state.dialog && !state.locked);
  await p.clearEnemies();
  await p.interact('flags.winch');
  await p.until('gangway is lowered', state => state.flags.winchOpen);
  for (const index of [1, 2, 3, 0]) {
    const worker = await p.entity('flags.workers', index);
    if (!worker.safe) await p.interact('flags.workers', index);
  }
  await p.moveTo(270, 1060);
  await p.until('four actual escorts aboard', state => state.flags.rescued === 4 && state.flags.rescuedMask === 15, 60000);
  await p.until('departure stage', state => state.stage === 2 && !state.dialog && !state.locked);
  await p.clearEnemies();
  await p.interact('flags.launch');
  await p.until('Undertow closes through actual cast-off', state => state.scene === 'Results');
}
async function archive(p) {
  await p.until('Archive briefing completes', state => !state.dialog && !state.locked && state.stage === 0);
  for (let index = 0; index < 3; index++) {
    await p.interact('flags.panels', index);
    await p.until('security circuit ' + index + ' isolated', state => !!(state.flags.circuits & (1 << index)));
  }
  await p.until('archive stage', state => state.stage === 1 && !state.dialog && !state.locked);
  await p.interact('flags.archive');
  await p.until('Surveyor stage', state => state.stage === 2 && !state.dialog && !state.locked);
  await p.clearEnemies(180000);
  await p.until('Surveyor actually captured', state => state.flags.surveyorCaptured);
  await p.interact('flags.exit');
  await p.until('Archive closes through actual return', state => state.scene === 'Results');
}
export const routes = { am_dead_air: deadAir, am_undertow: undertow, am_glass_archive: archive };
