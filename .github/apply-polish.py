from pathlib import Path
p = Path('src/data/chapters/ninth-minute.js')
s = p.read_text()
needle = '  class Pendulum extends DM.Entity {'
addition = '''  // Human staff repeat their route until a nearby intruder or a hit breaks the loop.
  // Combat and the spared/gone ledger remain the campaign's normal Enemy behaviour.
  class TransitGuard extends DM.Enemies.Gangster {
    constructor(x, y, offset = 0) {
      super({ x, y, gun: 'pistol', sight: 360 });
      this.home = { x, y };
      this.loopOffset = offset;
      this.engaged = false;
      this.look = {
        name: 'Transit security', skin: '#c39b79', hair: '#3d3933', hairStyle: 'short',
        hat: '#31424b', hatBrim: '#212c32', body: '#405961', sleeve: '#405961',
        legs: '#273a40', collar: '#b0b6a4', trim: '#a3a87c',
      };
    }
    damage(amount, source, kind) {
      this.engaged = true;
      return super.damage(amount, source, kind);
    }
    update(dt, world) {
      if (this.dead || this.ko) return;
      if (this.heldBy || this.thrown || this.hp < this.maxHp) this.engaged = true;
      const player = world.player;
      if (player && U.dist(this.x, this.y, player.x, player.y) < 310 &&
          world.los(this.x, this.y, player.x, player.y)) this.engaged = true;
      if (this.engaged || this.stun > 0 || world.ceasefire) {
        super.update(dt, world);
        return;
      }
      const angle = ((world.cycleT || 0) + this.loopOffset) / 9 * Math.PI * 2;
      const nx = this.home.x + Math.sin(angle) * 65;
      const ny = this.home.y + Math.cos(angle) * 22;
      this.facing = Math.atan2(ny - this.y, nx - this.x);
      this.x = nx;
      this.y = ny;
      this.vx = 0;
      this.vy = 0;
      this.walk += dt * 5;
    }
    onAlert(world) {
      world.bark(this, 'Step away from the train!');
    }
    onHeld(dt, world) {
      this.facing += dt * 4;
      if (!this.heldBarked) {
        this.heldBarked = true;
        world.bark(this, 'Put me down. Please.');
      }
    }
  }

  class TransitWitness extends DM.Entity {
    constructor(ctx) {
      super({ body: false, solid: false, static: true, disintegratable: false });
      this.ctx = ctx;
      this.pending = false;
      this.reactions = 0;
      ctx.on('enemy:down', event => {
        if (event.lethal && event.enemy instanceof TransitGuard && event.enemy.world === ctx.world &&
            !ctx.flags.laurieReacted) this.pending = true;
      });
    }
    update() {
      const ctx = this.ctx;
      if (!this.pending || ctx.scene.dialog.active || ctx.flags.laurieReacted) return;
      this.pending = false;
      this.reactions++;
      ctx.flags.laurieReacted = true;
      ctx.scene.dialog.open([
        ['silkspectre', 'He was trapped here too, Jon. He only had nine seconds to understand us.'],
      ]);
    }
  }

'''
assert s.count(needle) == 1
s = s.replace(needle, addition + needle)
old = "    ctx.add(new Sign(240, 1250, '← EXIT TO THE STREET', TEAL, 16));"
new = '''    ctx.flags.transitGuards = [
      [690, 1120], [1090, 1030], [1550, 1080], [1880, 880],
    ].map(([x, y], index) => ctx.add(new TransitGuard(x, y, index * 1.7)));
    ctx.flags.rescueFoes.push(...ctx.flags.transitGuards);
    ctx.flags.transitWitness = ctx.add(new TransitWitness(ctx));
''' + old
assert s.count(old) == 1
s = s.replace(old, new)
s = s.replace("return ctx.toast('CLEAR THE REMAINING SECURITY DRONES', GOLD);", "return ctx.toast('CLEAR THE REMAINING SECURITY', GOLD);")
s = s.replace("      'stable'\n", "      'stable',\n      'laurieReacted'\n")
needle = "      const rows = [\n        ['PASSENGERS HOME'"
insert = """      this.ledgerText = DM.BonusKit.ledgerSentence(this.record.stats, 'ninth_minute');
      G.paragraph(g, this.ledgerText, 244, 326, 792, 22, {
        size: 16, font: DM.FONTS.type, color: '#bdc9c0',
      });
      const rows = [
        ['PEOPLE SPARED / UNMADE', `${this.record.stats.spared || 0} / ${this.record.stats.disintegrated || 0}`],
        ['PASSENGERS HOME'"""
assert s.count(needle) == 1
s = s.replace(needle, insert)
s = s.replace('386 + i * 42', '390 + i * 30')
s = s.replace('    TimeRing\n', '    TimeRing, TransitGuard, TransitWitness, NinthComplete\n')
p.write_text(s)

p = Path('tests/ninth-minute.mjs')
s = p.read_text()
s = s.replace('T.clear(T.play().ctx.flags.rescueFoes);T.interact(T.play().ctx.flags.doors[0]);',
              'T.clear(T.play().ctx.flags.rescueFoes);T.dialog();T.clear(T.play().ctx.flags.rescueFoes);T.interact(T.play().ctx.flags.doors[0]);')
needle = '  // Every original campaign checkpoint still constructs cleanly.'
new = '''  // Staff are people, not another drone skin. Their ledger is the campaign ledger.
  const humanEvidence = await page.evaluate(() => {
    T.start(1);
    T.dialog();
    const play = T.play();
    play.player.godMode = true;
    const guards = play.ctx.flags.transitGuards;
    for (const companion of [play.ctx.flags.owl, play.ctx.flags.laurie]) {
      if (companion) {
        companion.x = 100;
        companion.y = 200;
        companion.heldBy = play.player;
      }
    }
    play.ctx.place(200, 200);
    const guard = guards[3];
    guard.engaged = false;
    guard.target = null;
    play.world.cycleT = 1;
    guard.update(1 / 60, play.world);
    const first = { x: guard.x, y: guard.y };
    play.world.cycleT = 5;
    guard.update(1 / 60, play.world);
    const moved = Math.hypot(guard.x - first.x, guard.y - first.y) > 20;
    play.world.cycleT = 1;
    guard.update(1 / 60, play.world);
    const repeats = Math.hypot(guard.x - first.x, guard.y - first.y) < 0.001;
    const stats = play.ctx.stats;
    const before = { spared: stats.spared, gone: stats.disintegrated };
    guards[0].damage(100, play.player, 'impact');
    const nonlethal = guards[0].ko && stats.spared === before.spared + 1 && stats.disintegrated === before.gone;
    guards[0].damage(100, play.player, 'impact');
    const once = stats.spared === before.spared + 1;
    T.shoot(guards[1]);
    T.step(0.2);
    const firstReaction = play.ctx.flags.transitWitness.reactions;
    const reaction = play.ctx.flags.laurieReacted && firstReaction === 1 && play.dialog.active;
    T.dialog();
    T.shoot(guards[2]);
    T.step(0.2);
    const noRepeat = play.ctx.flags.transitWitness.reactions === firstReaction;
    return {
      humans: guards.length === 4 && guards.every(e => e.human), moved, repeats, nonlethal, once, reaction, noRepeat,
      lethal: stats.disintegrated === before.gone + 2 && guards[1].dead && guards[2].dead,
    };
  });
  check('the rescue map contains four human transit guards', humanEvidence.humans);
  check('undisturbed staff repeat a moving patrol on the shared nine-second clock', humanEvidence.moved && humanEvidence.repeats);
  check('knocking out a transit guard increments spared exactly once', humanEvidence.nonlethal && humanEvidence.once);
  check('real disintegration input counts both human guards as gone', humanEvidence.lethal);
  check('Laurie reacts to the first unmaking and never repeats the interruption', humanEvidence.reaction && humanEvidence.noRepeat);
  const moralEndings = await page.evaluate(() => {
    const play = T.play();
    return [[0, 4], [1, 3], [4, 0]].map(([disintegrated, spared]) => {
      const scene = new DM.NinthMinute.NinthComplete(play, {
        stats: { disintegrated, spared, time: 20, decoherences: 0 },
        flags: { choice: 'release', passengers: 6, moments: 0 },
      });
      DM.Engine.set(scene);
      DM.Engine.render();
      return scene.ledgerText;
    });
  });
  check('the real subway completion screen renders three distinct human-consequence paragraphs',
    new Set(moralEndings).size === 3 && moralEndings.every(text => typeof text === 'string' && text.length > 30));
''' + needle
assert s.count(needle) == 1
p.write_text(s.replace(needle, new))
