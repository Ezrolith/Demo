from pathlib import Path
import shutil


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    assert text.count(old) == 1, (path, text.count(old), old[:70])
    p.write_text(text.replace(old, new, 1))


replace('src/data/chapters/long-summer.js',
    "    w.spawn = spawn;\n    w.room(40, 40, width - 80, height - 80);",
    "    w.spawn = spawn;\n    // A new area's briefing must not follow the previous area's camera or marker.\n    ctx.camTarget = { x: spawn.x, y: spawn.y - 80 };\n    ctx.hud.marker = null;\n    ctx.hud.clearTransient();\n    ctx.hud.setObjective(null);\n    w.room(40, 40, width - 80, height - 80);")

replace('src/game/long-summer-truck.js',
    "    onDisintegrateCast(c, world) {\n      if (this.role !== 'cab') return;\n      this.cabTargeted = U.dist(c.x, c.y, this.x, this.y) <= this.r;\n      this.cabCastTime = world.realTime || 0;\n    }\n    disintegrate(world, source) {\n      if (this.role === 'cab' && (!this.cabTargeted ||\n        (world.realTime || 0) - this.cabCastTime > 0.35)) {\n        const now = world.realTime || 0;\n        if (this.lastCabWarning == null || now - this.lastCabWarning > 1.8) {\n          world.bark(this, 'Someone is inside.');\n          this.lastCabWarning = now;\n        }\n        return;\n      }\n      super.disintegrate(world, source);\n    }",
    "    onDisintegrateCast(c) {\n      if (this.role !== 'cab') return;\n      this.cabTargeted = U.dist(c.x, c.y, this.x, this.y) <= this.r;\n      this.cabCast = c;\n    }\n    disintegrate(world, source) {\n      if (this.role === 'cab') {\n        // Tie intent to the actual resolving pulse, not elapsed wall time.\n        // Hitstop pauses that pulse but continues advancing world.realTime.\n        const pending = source?.powers?.disintegrate?.pending;\n        const resolving = this.cabCast && this.cabCast.t <= 0 && pending?.includes(this.cabCast);\n        if (!this.cabTargeted || !resolving) {\n          const now = world.realTime || 0;\n          if (this.lastCabWarning == null || now - this.lastCabWarning > 1.8) {\n            world.bark(this, 'Someone is inside.');\n            this.lastCabWarning = now;\n          }\n          return;\n        }\n        this.cabCast = null;\n        this.cabTargeted = false;\n      }\n      super.disintegrate(world, source);\n    }")

for label, stage in [('tenement', 1), ('truck', 2)]:
    old = "  await page.evaluate(() => { T.interact(T.p().ctx.flags.exit); T.transition(); });"
    end = ("  check('E advances from the avenue into the checkpointed tenement'" if label == 'tenement'
           else "  check('the rescue exit advances through dialogue into the truck encounter'")
    new = f'''  await page.evaluate(() => {{
    T.interact(T.p().ctx.flags.exit);
    T.dialog();
    T.step(1.6);
  }});
  check('the {label} arrival briefing frames Jon and clears the old area marker', await page.evaluate(() => {{
    const p = T.p();
    const screen = p.world.camera.toScreen(p.player.x, p.player.y);
    return p.ctx.stageIndex === {stage} && p.dialog.active && p.hud.marker === null &&
      screen.x > 40 && screen.x < DM.W - 40 && screen.y > 125 && screen.y < 500;
  }}));
  await shot('{label}-arrival-briefing');
  await page.evaluate(() => T.dialog());
''' + end
    replace('tests/long-summer.mjs', old + '\n' + end, new)

anchor = "  check('three ending tiers derive from the ledger and Heat, not a final button', await page.evaluate(() =>"
new = '''  check('a deliberately aimed cab pulse survives the boss impact freeze', await page.evaluate(() => {
    T.start(2);
    const p = T.p();
    const cab = p.ctx.flags.truck.parts.find(e => e.role === 'cab');
    T.place(cab.x - 130, cab.y + 30);
    T.aim(cab.x, cab.y);
    DM.Input.simulate('KeyQ', true);
    T.step(1 / 60);
    DM.Input.simulate('KeyQ', false);
    const aimed = cab.cabTargeted && p.player.powers.disintegrate.pending.length === 1;
    // Reproduce the same 0.2-second feedback freeze used by a truck phase change.
    p.world.hitstop(0.2);
    T.step(0.5);
    return aimed && cab.dead && p.ctx.flags.driverOutcome === 'unmade' && p.ctx.stats.disintegrated === 1;
  }));
  check('an expired cab aim cannot authorise an unrelated later blast', await page.evaluate(() => {
    T.start(2);
    const p = T.p();
    const cab = p.ctx.flags.truck.parts.find(e => e.role === 'cab');
    // This old pulse has left the player's pending queue; it cannot grant lethal intent.
    cab.onDisintegrateCast({ x: cab.x, y: cab.y, t: -0.01 }, p.world);
    cab.disintegrate(p.world, p.player);
    return !cab.dead && !p.ctx.flags.truck.driver.dead && !p.ctx.stats.disintegrated;
  }));
''' + anchor
replace('tests/long-summer.mjs', anchor, new)
shutil.copyfile('.github/live-audit-template.mjs', 'tests/play-audit-followup.mjs')
Path('.github/live-audit-template.mjs').unlink()
Path('.github/apply-audit-followup.py').unlink()
