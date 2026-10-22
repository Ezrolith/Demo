/*
 * PROLOGUE — The Watchmaker's Son. Gila Flats, 1959.
 * Jon is still a man: walk, talk, repair Janey's watch, and go back for the coat.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const { Prop, Door } = DM.Props;
  const NPC = DM.NPC;

  const WALLS = {
    wall: { top: '#56656b', face: '#3b464b', edge: '#1d2427' },
    desk: { top: '#8a6a44', face: '#6a4f30', edge: '#3e2e1c', low: true },
    bench: { top: '#7d5d3a', face: '#5a4128', edge: '#33251a', low: true },
    console: { top: '#6f7f86', face: '#4b575c', edge: '#2a3235', low: true },
    cabinet: { top: '#7d8b72', face: '#5b6753', edge: '#2f362a' },
    counter: { top: '#d8d2c0', face: '#a39d8b', edge: '#5e594d', low: true },
  };
  const GEN = { x: 1426, y: 520 };
  const SHIRT = { body: '#9fb7c9', sleeve: '#9fb7c9' };

  function checker(g, x, y, w, h, s, a, b) {
    for (let yy = y; yy < y + h; yy += s) for (let xx = x; xx < x + w; xx += s) {
      g.fillStyle = (Math.round((xx - x) / s) + Math.round((yy - y) / s)) % 2 ? a : b;
      g.fillRect(xx, yy, Math.min(s, x + w - xx), Math.min(s, y + h - yy));
    }
  }

  function bakeFloor(g) {
    const rnd = U.seeded(59);
    g.fillStyle = '#2a2620';
    g.fillRect(0, 0, 1760, 1040);
    checker(g, 24, 440, 1092, 140, 35, '#d9d3bd', '#b9c4a8');
    g.fillStyle = '#b08658';
    g.fillRect(24, 24, 592, 416);
    g.strokeStyle = 'rgba(80,52,26,0.35)';
    g.lineWidth = 1.5;
    for (let y = 24; y < 440; y += 22) {
      g.beginPath(); g.moveTo(24, y); g.lineTo(616, y); g.stroke();
      for (let k = 0; k < 4; k++) {
        const x = 24 + rnd() * 592;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22); g.stroke();
      }
    }
    checker(g, 616, 24, 500, 416, 46, '#a3b4ab', '#93a59c');
    checker(g, 24, 580, 552, 436, 40, '#ebe3cb', '#b84a3a');
    g.fillStyle = '#7d6f5c';
    g.fillRect(576, 580, 540, 436);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
      g.fillRect(576 + rnd() * 540, 580 + rnd() * 436, 2, 2);
    }
    // test chamber
    g.fillStyle = '#3e4950';
    g.fillRect(1116, 24, 620, 992);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let x = 1116; x < 1736; x += 62) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 1016); g.stroke(); }
    for (let y = 24; y < 1016; y += 62) { g.beginPath(); g.moveTo(1116, y); g.lineTo(1736, y); g.stroke(); }
    for (const [r, c] of [[300, '#56646d'], [230, '#4a5860'], [150, '#56646d']]) {
      g.strokeStyle = c;
      g.lineWidth = 10;
      g.beginPath(); g.arc(GEN.x, GEN.y, r, 0, Math.PI * 2); g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? '#1d1d1d' : '#d8b02a';
      g.fillRect(1116 + i * 8, 440, 8, 140);
    }
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = '600 22px Oswald, Arial Narrow, sans-serif';
    g.fillText('TEST CHAMBER 3', 1500, 980);
  }

  // Shorthand for a flavour interactable that plays one or more dialogue lines.
  function flavor(ctx, x, y, label, lines, o = {}) {
    return ctx.add(new Prop({
      x, y, r: 4,
      draw: o.draw,
      interact: {
        label, range: o.range || 58, enabled: o.enabled,
        onInteract: () => ctx.fork(function* () { yield ctx.dialog(lines); }),
      },
    }));
  }

  function buildGila(ctx) {
    const W = ctx.newWorld({ w: 1760, h: 1040, bg: '#15120e', wallStyles: WALLS, zoom: 1.4 });
    const R = (ctx.refs = {});
    W.bake(bakeFloor);
    W.spawn = { x: 120, y: 510, facing: 0 };

    W.room(0, 0, 1760, 1040, { t: 24 });
    W.wall(24, 424, 216, 16); W.wall(330, 424, 270, 16); W.wall(600, 24, 16, 416);
    W.wall(616, 424, 184, 16); W.wall(890, 424, 210, 16);
    W.wall(1100, 24, 16, 96); W.wall(1100, 120, 16, 260, 'glass'); W.wall(1100, 380, 16, 60);
    W.wall(1100, 580, 16, 436);
    W.wall(24, 580, 216, 16); W.wall(330, 580, 230, 16); W.wall(560, 580, 16, 436);
    W.wall(576, 580, 204, 16); W.wall(870, 580, 230, 16);

    W.wall(44, 40, 240, 50, 'bench');
    W.wall(400, 200, 150, 64, 'desk');
    W.wall(28, 180, 36, 180, 'cabinet');
    W.wall(640, 40, 440, 36, 'console');
    W.wall(1050, 140, 36, 220, 'console');
    W.wall(80, 680, 130, 56, 'desk'); W.wall(80, 860, 130, 56, 'desk'); W.wall(270, 860, 130, 56, 'desk');
    W.wall(470, 640, 70, 300, 'counter');
    W.wall(600, 970, 480, 36, 'cabinet');
    W.wall(760, 760, 160, 64, 'desk');
    W.wall(1130, 230, 24, 110, 'console');

    R.door = W.add(new Door(W, 1100, 440, 16, 140, { open: true }));

    // Room signs, chalkboard, console lights.
    W.decals.push((g, world) => {
      const t = world.realTime || 0;
      g.fillStyle = '#2f4a3a';
      g.fillRect(330, 24, 220, 14);
      g.strokeStyle = 'rgba(240,240,230,0.7)';
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++) Gfx.line(g, 340 + i * 34, 30, 360 + i * 34, 32);
      for (let i = 0; i < 18; i++) {
        const on = Math.sin(t * 2 + i * 1.7) > 0.2;
        g.fillStyle = on ? ['#ff5a4a', '#7bd88f', '#f2c418'][i % 3] : '#2a3235';
        g.fillRect(652 + i * 23, 52, 6, 6);
      }
      for (let i = 0; i < 8; i++) {
        const on = Math.sin(t * 3 + i) > 0;
        g.fillStyle = on ? '#7bd88f' : '#2a3235';
        g.fillRect(1062, 156 + i * 25, 6, 6);
      }
      const lbl = (s, x, y) => Gfx.text(g, s, x, y, { size: 13, color: 'rgba(30,30,30,0.55)', spacing: 3, weight: 600 });
      lbl('WORKSHOP', 470, 410);
      lbl('CONTROL', 920, 410);
      lbl('CANTEEN', 400, 1000);
      lbl('RECORDS', 960, 940);
    });

    // Workshop: workbench and flavour.
    R.bench = ctx.add(new Prop({
      x: 165, y: 108, r: 4,
      draw: (g) => {
        g.fillStyle = '#c9c2ae';
        g.fillRect(60, 50, 60, 26);
        g.fillStyle = '#d8b860';
        Gfx.circle(g, 160, 64, 9);
        g.fill();
        g.fillStyle = '#3a3a3a';
        g.fillRect(200, 56, 40, 6);
        g.fillRect(205, 68, 30, 4);
      },
      interact: {
        label: "Repair Janey's watch", range: 70,
        enabled: () => ctx.flags.hasWatch && !ctx.flags.repaired,
        onInteract: () => ctx.fork(function* () {
          ctx.lock(true);
          yield ctx.minigame(DM.Scenes.WatchRepair);
          ctx.flags.repaired = true;
          ctx.lock(false);
        }),
      },
    }));
    flavor(ctx, 440, 62, 'Read the chalkboard', [['jon', "Equations from Tuesday's seminar. Underneath, in my handwriting: 'What holds the shape of a thing together?'"]]);
    flavor(ctx, 476, 232, 'Look at the photograph', [['jon', 'A photograph from the carnival at Palisades Park. Janey is laughing at something I said. I cannot remember what it was.']], {
      draw: (g) => {
        g.fillStyle = '#f1e7cc';
        g.fillRect(464, 222, 26, 20);
        g.fillStyle = '#6b7a86';
        g.fillRect(467, 225, 20, 13);
      },
    });

    // Control room.
    R.wally = ctx.add(new NPC({
      x: 960, y: 250, look: 'wally', facing: 0,
      talk: () => ctx.fork(function* () {
        if (ctx.flags.lockdown) return;
        yield ctx.dialog(ctx.flags.calibrated
          ? [['wally', "Thanks, Jon. Glass says the test runs itself tonight. Fully automatic. Isn't that something?"]]
          : [['wally', "Jon! Glass is in a mood. Big test tonight."], ['wally', "Did you fix Janey's watch yet? Everyone knows you're sweet on her, you know."]]);
      }),
    }));
    R.glass = ctx.add(new NPC({
      x: 870, y: 330, look: 'glass', facing: 0,
      talk: () => ctx.fork(function* () {
        if (ctx.flags.lockdown) return;
        yield ctx.dialog([['glass', 'Intrinsic fields, Jon. Take away what holds a thing together and what is left? Nothing. Or everything. We are close to knowing which.']]);
      }),
    }));

    // Canteen.
    R.janey = ctx.add(new NPC({ x: 330, y: 770, look: 'janey', facing: -Math.PI / 2, talk: () => ctx.fork(janeyTalk) }));
    flavor(ctx, 505, 700, 'Pour a coffee', [['jon', 'The coffee at Gila Flats is famous. Not for good reasons.']]);
    flavor(ctx, 145, 708, 'Listen to the radio', [['jon', '"...the Soviet Premier said today that his country\'s rockets..." I turn it down.']], {
      draw: (g) => {
        g.fillStyle = '#6b3a24';
        g.fillRect(132, 696, 26, 16);
        g.fillStyle = '#e8d27a';
        g.fillRect(136, 700, 10, 8);
      },
    });

    // Records.
    flavor(ctx, 840, 792, 'Read the magazine', [['jon', "A copy of Time. The cover asks whether there will be a nuclear war. Somebody has answered in pencil: 'Probably.'"]], {
      draw: (g) => {
        g.fillStyle = '#c4302b';
        g.fillRect(826, 780, 26, 32);
        g.fillStyle = '#f1e7cc';
        g.fillRect(830, 790, 18, 18);
      },
    });
    flavor(ctx, 840, 950, 'Check the files', [['jon', 'Thirty years of intrinsic field research, alphabetised by Wally. Under W, he has filed his lunch.']]);

    // Test chamber: generator, calibration panel, coat hook, and lockdown flavour.
    R.gen = ctx.add(new Prop({
      x: GEN.x, y: GEN.y, r: 4, data: { power: 0 },
      draw: (g, e, world) => {
        const t = world.realTime || 0;
        const pw = e.data.power;
        g.save();
        g.translate(GEN.x, GEN.y);
        g.strokeStyle = '#8a969e';
        g.lineWidth = 6;
        Gfx.circle(g, 0, 0, 96);
        g.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + t * (0.2 + pw * 3);
          g.fillStyle = '#5c6870';
          g.fillRect(Math.cos(a) * 96 - 9, Math.sin(a) * 96 - 9, 18, 18);
        }
        g.restore();
        Gfx.glow(g, GEN.x, GEN.y, 120 + pw * 260, '#5fd4ff', 0.12 + pw * 0.7);
        if (pw > 0.05) {
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = `rgba(160,230,255,${Math.min(1, pw)})`;
          g.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            Gfx.circle(g, GEN.x, GEN.y, ((t * 120 * (1 + pw) + i * 100) % 300) + 20);
            g.stroke();
          }
          g.restore();
        }
      },
    }));
    R.panel = ctx.add(new Prop({
      x: 1178, y: 285, r: 4,
      interact: {
        label: 'Calibrate the generator', range: 60,
        enabled: () => !ctx.flags.calibrated || ctx.flags.lockdown,
        onInteract: () => ctx.fork(function* () {
          if (ctx.flags.lockdown) {
            yield ctx.dialog([['jon', 'LOCKED OUT. The sequence is running itself, exactly as designed.']]);
            return;
          }
          if (!ctx.flags.repaired) {
            yield ctx.dialog([['jon', "Not yet. Wally hasn't run the pre-checks."]]);
            return;
          }
          ctx.lock(true);
          yield ctx.dialog([['jon', "It's warm in here. I hang my coat on the hook by the generator. Janey's watch is in the pocket."]]);
          ctx.flags.coatHung = true;
          Object.assign(ctx.player.look, SHIRT);
          DM.Audio.play('gear');
          yield ctx.wait(0.4);
          yield ctx.narrate('Calibration nominal. Field coherence: ninety-nine point nine seven percent.', { dur: 3.5 });
          ctx.flags.calibrated = true;
          ctx.lock(false);
        }),
      },
    }));
    R.coat = ctx.add(new Prop({
      x: 1700, y: 520, r: 4,
      draw: (g) => {
        g.fillStyle = '#3a3a3a';
        g.fillRect(1714, 512, 10, 16);
        if (!ctx.flags.coatHung || ctx.flags.gotCoat) return;
        g.fillStyle = '#ebe7dc';
        g.beginPath();
        g.moveTo(1716, 500); g.lineTo(1690, 506); g.lineTo(1682, 540); g.lineTo(1716, 544);
        g.closePath();
        g.fill();
        g.strokeStyle = '#b9b4a6';
        g.stroke();
      },
      interact: {
        label: 'Take your coat', range: 64,
        enabled: () => ctx.flags.needCoat && !ctx.flags.gotCoat,
        onInteract: () => {
          ctx.flags.gotCoat = true;
          ctx.player.look = Object.assign({}, DM.LOOKS.jon);
          DM.Audio.play('ui_select');
        },
      },
    }));
    flavor(ctx, 1132, 510, 'Try the door', [['jon', 'It does not move. It was designed not to.']], { enabled: () => ctx.flags.lockdown, range: 60 });
    flavor(ctx, 1136, 180, 'Look through the window', [['jon', 'Wally is shouting something. The glass is three inches thick.']], { enabled: () => ctx.flags.lockdown, range: 60 });

    return W;
  }

  function* janeyTalk(ctx) {
    const f = ctx.flags;
    if (f.lockdown) return;
    if (!f.metJaney) {
      yield ctx.dialog([
        ['janey', 'Jon! Look at this. Somebody stepped on it at the carnival. It\'s ruined.'],
        ['jon', 'May I? ...The balance wheel has come loose, and the crystal is cracked. It isn\'t ruined.'],
        ['janey', 'You can fix it? Really?'],
        ['jon', 'My father repaired watches. I still remember how. Give me an hour.'],
        ['janey', "You're sweet, Jon Osterman. Don't let anyone tell you otherwise."],
      ]);
      f.metJaney = true;
      f.hasWatch = true;
    } else if (!f.repaired) {
      yield ctx.dialog([['janey', "Take your time. It's only a watch."]]);
    } else if (!f.calibrated) {
      yield ctx.dialog([['jon', "It's fixed. I'll bring it by as soon as I've seen to the generator."], ['janey', 'Go on, then. Glass hates waiting.']]);
    } else if (!f.needCoat) {
      yield ctx.dialog([
        ['jon', 'Janey, your watch— '],
        ['jon', "...It's in my coat. I left my coat in the test chamber."],
        ['janey', "Then go and get it, silly. I'll be right here."],
      ]);
      f.needCoat = true;
    } else {
      yield ctx.dialog([['janey', "Go on. I'll wait."]]);
    }
  }

  DM.Chapters.register({
    id: 'prologue',
    numeral: 'PROLOGUE',
    title: "The Watchmaker's Son",
    date: 'August 1959',
    place: 'Gila Flats, Arizona',
    clock: 12,
    color: '#b8901e',
    music: 'prologue',
    form: 'human',
    epigraph: { text: 'If only I had known, I should have become a watchmaker.', by: 'Albert Einstein' },
    intro: [
      '1945. My father repairs watches. When the news comes from Hiroshima, he sweeps his gears into a box and tells me the future belongs to physics. I believe him.',
      '1959. I am thirty years old. I study intrinsic fields at Gila Flats, Arizona: the force that holds a thing in its shape.',
      'In a few days, that force will let go of me. Today, I am late for lunch.',
    ],
    maps: { gila: buildGila },
    stages: [
      {
        id: 'lunch',
        map: 'gila',
        run: function* (ctx) {
          ctx.lock(true);
          yield ctx.wait(0.6);
          yield ctx.narrate('Gila Flats Research Base. The desert holds its heat long after sundown. Janey said she would be in the canteen.');
          ctx.lock(false);
          ctx.hint('Move with W A S D or the arrow keys. Press E to talk and interact.', 9);
          ctx.objective('Find Janey in the canteen');
          ctx.marker(ctx.refs.janey.x, ctx.refs.janey.y, 'JANEY');
          yield ctx.until(() => ctx.flags.metJaney && !ctx.scene.dialog.active);
          ctx.objectiveDone();
          ctx.marker(null);
          yield ctx.wait(1.2);
          ctx.objective('Repair the watch at your workbench');
          ctx.marker(ctx.refs.bench.x, ctx.refs.bench.y, 'WORKBENCH');
          yield ctx.until(() => ctx.flags.repaired);
          ctx.objectiveDone();
          ctx.marker(null);
          yield ctx.narrate('Gears, springs, a balance wheel. Everything in its place and its time. It is the last thing I will ever build with my hands.', { dur: 6 });
        },
        restore(ctx) {
          Object.assign(ctx.flags, { metJaney: true, hasWatch: true, repaired: true });
        },
      },
      {
        id: 'calibrate',
        run: function* (ctx) {
          yield ctx.wait(0.6);
          yield ctx.dialog([['wally', "Jon? It's Wally. Glass wants the field generator calibrated before tonight's test. Could you check the panel in the test chamber? Door's open.", { name: 'Wally Weaver — Intercom' }]]);
          ctx.objective('Calibrate the generator in the Test Chamber');
          ctx.marker(ctx.refs.panel.x, ctx.refs.panel.y, 'PANEL');
          yield ctx.until(() => ctx.flags.calibrated);
          ctx.objectiveDone();
          ctx.marker(null);
        },
        restore(ctx) {
          Object.assign(ctx.flags, { coatHung: true, calibrated: true });
          Object.assign(ctx.player.look, SHIRT);
        },
      },
      {
        id: 'coat',
        run: function* (ctx) {
          yield ctx.wait(1);
          ctx.objective('Bring Janey her watch');
          ctx.marker(ctx.refs.janey.x, ctx.refs.janey.y, 'JANEY');
          yield ctx.until(() => ctx.flags.needCoat && !ctx.scene.dialog.active);
          ctx.objectiveDone();
          yield ctx.wait(0.8);
          ctx.objective('Fetch your coat from the Test Chamber');
          ctx.marker(ctx.refs.coat.x, ctx.refs.coat.y, 'COAT');
          yield ctx.until(() => ctx.flags.gotCoat);
          ctx.marker(null);
        },
        restore(ctx) {
          Object.assign(ctx.flags, { needCoat: true, gotCoat: true });
          ctx.player.look = Object.assign({}, DM.LOOKS.jon);
        },
      },
      {
        id: 'accident',
        run: function* (ctx) {
          const R = ctx.refs, W = ctx.world, P = ctx.player;
          ctx.objective(null);
          if (ctx.startedHere) ctx.place(1600, 520, Math.PI);
          R.door.setOpen(false);
          W.camera.shake(0.5);
          ctx.flags.lockdown = true;
          ctx.music('tension');
          ctx.fork(function* () {
            while (!ctx.flags.flashed) {
              DM.Audio.play('alarm');
              W.tint = 'rgba(255,40,30,0.13)';
              yield ctx.wait(0.42);
              W.tint = null;
              yield ctx.wait(0.43);
            }
            W.tint = null;
          });
          R.wally.walkTo(1074, 230);
          R.glass.walkTo(1074, 300);
          yield ctx.wait(0.9);
          yield ctx.dialog([
            ['wally', "Jon! The door— it's sealed! The time lock's engaged!"],
            ['glass', "The test program has started. It's automatic, Jon. It cannot be interrupted. I'm so sorry."],
            ['jon', 'Yes. I see.'],
          ]);
          ctx.objective('Find a way out');
          ctx.fork(function* () {
            yield ctx.wait(7);
            ctx.narrate("Janey's watch is ticking in my coat pocket. I fixed it this morning. It keeps perfect time.", { dur: 5.5 });
          });
          ctx.fork(function* () {
            const t0 = W.realTime;
            while (!ctx.flags.flashed) {
              R.gen.data.power = Math.min(1, (W.realTime - t0) / 16);
              yield;
            }
          });
          yield ctx.countdown(16, 'INTRINSIC FIELD GENERATOR ENGAGING');
          ctx.objective(null);
          ctx.lock(true);
          ctx.cinematic(true);
          DM.Audio.play('flash');
          R.gen.data.power = 1.6;
          for (let i = 0; i < 36; i++) {
            W.particles.implode(P.x, P.y, 220 - i * 4, 6, { life: 0.3, color: '#ffffff' });
            W.camera.shake(0.08);
            yield ctx.wait(0.05);
          }
          ctx.flash('#ffffff', 3.5);
          P.hidden = true;
          W.particles.burst(P.x, P.y, 260, { color: ['#7fe3ff', '#ffffff', '#ecc8a6', '#ebe7dc'], speed: [60, 620], life: [0.8, 2.6], size: [1.5, 4], drag: 1.2 });
          ctx.flags.flashed = true;
          yield ctx.wait(2.8);
          ctx.music('void');
          yield ctx.narrate('August 1959. I am taken apart.', { dur: 4 });
        },
      },
    ],
  });
})();
