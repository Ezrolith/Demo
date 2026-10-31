/* Known Long Summer route, adapted to ordinary Bonus-menu entry. */
async function longSummer(p) {
  await p.until('avenue briefing finishes', state => state.stage === 0 && !state.dialog && !state.locked &&
    /Calm the avenue/.test(state.objective));
  await p.aim(370, 705);
  await p.hold('c', 0.22);
  await p.hold('d', 0.7);
  await p.aim(570, 570);
  await p.hold('c', 0.22);
  await p.teleport(800, 660);
  await p.press('r');
  await p.sleep(7000);
  await p.teleport(1110, 490);
  await p.teleport(1470, 435);
  await p.press('e');
  await p.until('Nite Owl opens the balcony', state => state.flags.grappleOpen, 10000);
  await p.teleport(1740, 365);
  await p.press('e');
  await p.until('tenement briefing finishes', state => state.stage === 1 && !state.dialog && !state.locked);
  await p.moveTo(820, 1035, { combat: false });
  await p.aim(820, 947);
  await p.hold('c', 0.25);
  await p.moveTo(875, 1035, { combat: false });
  await p.moveTo(875, 220, { combat: false });
  await p.moveTo(820, 220, { combat: false });
  await p.press('g');
  await p.sleep(700);
  await p.press('e');
  await p.until('roof vent actually opened', async () => p.data(() =>
    DM.dev.play().ctx.flags.summer.grid.vented), 5000);
  await p.sleep(7400);
  for (let index = 0; index < 6; index++) {
    const resident = await p.entity('flags.residents', index);
    if (resident.safe) continue;
    await p.moveTo(820, resident.y, { combat: false });
    await p.moveTo(resident.x < 820 ? resident.x + 35 : resident.x - 35, resident.y, { combat: false });
    await p.press('e');
    await p.sleep(100);
    await p.moveTo(820, resident.y, { combat: false });
    if (index === 3) await p.press('r');
  }
  await p.moveTo(820, 1400, { combat: false });
  await p.until('six actual residents reach safety', state => state.flags.rescued === 6, 60000);
  await p.moveTo(970, 1410, { combat: false });
  await p.press('e');
  await p.until('truck briefing finishes', state => state.stage === 2 && !state.dialog && !state.locked);
  await p.teleport(900, 1000);
  for (let cast = 0; cast < 14; cast++) {
    let part = await p.data(() => {
      const truck = DM.dev.play().ctx.flags.truck;
      const entity = truck.parts.find(value => value.role !== 'cab' && !value.dead);
      return entity && !truck.disabled ? { x: entity.x, y: entity.y } : null;
    });
    if (!part) break;
    const state = await p.state();
    if (Math.hypot(part.x - state.x, part.y - state.y) > 470) await p.teleport(part.x - 200, part.y + 240);
    await p.until('energy for mechanical pulse', value => value.energy >= 20, 10000);
    part = await p.data(() => {
      const entity = DM.dev.play().ctx.flags.truck.parts.find(value => value.role !== 'cab' && !value.dead);
      return entity ? { x: entity.x, y: entity.y } : null;
    });
    if (!part) break;
    if (!await p.aim(part.x, part.y)) throw Error('Moving truck component left the visible aim region.');
    await p.press('q');
    await p.sleep(1100);
  }
  await p.until('mechanical truck parts disabled', async () => p.data(() =>
    DM.dev.play().ctx.flags.truck.disabled), 10000);
  const comedian = await p.entity('flags.comedian');
  await p.teleport(comedian.x + 80, comedian.y + 80);
  await p.aim(comedian.x, comedian.y);
  await p.hold('c', 0.3);
  const driver = await p.entity('flags.truck.driver');
  await p.teleport(driver.x - 50, driver.y + 40);
  await p.moveTo(driver.x - 40, driver.y + 25, { combat: false });
  await p.press('e');
  await p.until('driver actually reaches safe passage', state => state.flags.driverOutcome === 'spared', 30000);
  await p.until('Long Summer reaches its real ending', state => state.scene === 'SummerComplete');
}
export const routes = { long_summer: longSummer };
