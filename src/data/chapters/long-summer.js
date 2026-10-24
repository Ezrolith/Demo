/* THE LONG SUMMER — original optional fan fiction. Decisions accumulate, not a last-button ending. */
(function () {
  'use strict';
  const DM = window.DM;
  const S = DM.Summer;
  const K = DM.BonusKit;
  const G = DM.Gfx;
  const U = DM.U;

  class SummerOwl extends K.Companion {
    constructor(state, x, y) {
      super(x, y, 'niteowl');
      this.state = state;
      this.showName = false;
      this.grappleT = 0;
      this.landing = null;
    }
    beginGrapple(target, done) {
      if (this.grappleT > 0) return;
      this.origin = { x: this.x, y: this.y };
      this.landing = target;
      this.grappleT = 1.3;
      this.onLanded = done;
      DM.Audio.play('summer_throw');
    }
    update(dt, world) {
      if (this.grappleT > 0) {
        if (world.ceasefire) return;
        this.grappleT = Math.max(0, this.grappleT - dt);
        const t = 1 - this.grappleT / 1.3;
        this.x = U.lerp(this.origin.x, this.landing.x, t);
        this.y = U.lerp(this.origin.y, this.landing.y, t) - Math.sin(t * Math.PI) * 50;
        this.vx = 0;
        this.vy = 0;
        if (!this.grappleT && this.onLanded) this.onLanded();
        return;
      }
      super.update(dt, world);
    }
    renderEmissive(g, world) {
      super.renderEmissive(g, world);
      if (this.grappleT > 0) {
        g.strokeStyle = '#c7ba92';
        g.lineWidth = 2;
        G.line(g, this.x, this.y, this.landing.x, this.landing.y - 20);
      }
    }
  }

  function init(ctx, width, height, spawn) {
    const w = ctx.newWorld({ w: width, h: height + 340, zoom: 1, bg: '#13212a' });
    w.playableHeight = height;
    w.spawn = spawn;
    w.room(40, 40, width - 80, height - 80);
    const state = ctx.add(new S.CityState(ctx));
    ctx.flags.summer = state;
    state.world = w;
    const comedian = ctx.add(new S.Comedian(state, spawn.x + 80, spawn.y + 65));
    const owl = ctx.add(new SummerOwl(state, spawn.x - 60, spawn.y + 65));
    ctx.flags.comedian = comedian;
    ctx.flags.owl = owl;
    return w;
  }
  function ready(ctx) {
    ctx.lock(false);
    ctx.player.energy = 100;
    ctx.player.coherence = 100;
    S.startReadableCamera(ctx);
  }

  function avenue(ctx) {
    const w = init(ctx, 2050, 1320, { x: 290, y: 640 });
    const state = ctx.flags.summer;
    S.installArt(ctx, 'avenue');
    S.addStreetFrontages(w);
    const balconyWall = w.wall(1535, 390, 160, 20, 'low');
    const seeds = [[510, 510], [545, 560], [1620, 970], [375, 655], [1190, 550], [1770, 820]];
    ctx.add(new S.FireGrid(state, { x: 80, y: 400, w: 1880, h: 660 }, seeds));
    ctx.flags.hydrants = [ctx.add(new S.Hydrant(state, 570, 570)), ctx.add(new S.Hydrant(state, 1560, 910))];
    ctx.flags.rioters = [];
    for (const [x, y, molotov] of [
      [660, 800, false], [960, 680, false], [1250, 820, false], [1780, 700, false],
      [815, 480, true], [1450, 550, true]
    ]) ctx.flags.rioters.push(ctx.add(new S.Rioter(state, x, y, molotov)));
    for (const [x, y] of [[940, 940], [1200, 450], [1700, 1090]]) ctx.add(new DM.Props.Crate(x, y));
    ctx.flags.grapple = ctx.add(new K.Terminal(1510, 420, 'Ask Nite Owl to open the balcony', () => {
      if (ctx.flags.grappleOpen || ctx.flags.owl.grappleT > 0) return;
      ctx.flags.owl.beginGrapple({ x: 1620, y: 330 }, () => {
        ctx.flags.grappleOpen = true;
        balconyWall.noCollide = true;
        w.bark(ctx.flags.owl, 'Stairs are open. Get them out, Jon.');
        DM.Audio.play('summer_metal');
      });
    }, () => !ctx.flags.grappleOpen));
    ctx.flags.exit = ctx.add(new K.Terminal(1765, 360, 'Enter the tenement', () => {
      if (state.heat >= 40) ctx.toast('THE STREET IS STILL ON EDGE · LOWER CITY HEAT', S.AMBER);
      else if (!ctx.flags.grappleOpen) ctx.toast('DAN CAN OPEN THE BALCONY ROUTE', S.AMBER);
      else ctx.flags.avenueExit = true;
    }));
    ctx.add(new K.Sign(1765, 300, 'ALVAREZ ROOMS', S.AMBER, 15));
    return w;
  }

  function tenement(ctx) {
    const w = init(ctx, 1640, 1640, { x: 820, y: 1380 });
    const state = ctx.flags.summer;
    state.safePoint = { x: 820, y: 1400 };
    S.installArt(ctx, 'tenement');
    ctx.flags.comedian.silent = true;
    ctx.flags.comedian.x = 1080;
    ctx.flags.comedian.y = 1450;
    ctx.flags.owl.holdPosition = true;
    ctx.flags.owl.x = 710;
    ctx.flags.owl.y = 1430;
    for (let i = 0; i < 5; i++) {
      const y = 130 + i * 235;
      w.room(240, y, 440, 210, { t: 12, doors: [{ side: 'right', at: 75, w: 84 }] });
      w.room(940, y, 440, 210, { t: 12, doors: [{ side: 'left', at: 75, w: 84 }] });
    }
    const fire = ctx.add(new S.FireGrid(state, { x: 210, y: 110, w: 1200, h: 1220 },
      [[410, 220], [1190, 485], [535, 940], [1130, 1170], [800, 730]]));
    const barrier = w.wall(710, 940, 220, 28, 'low');
    ctx.flags.beam = ctx.add(new S.StairBeam(state, 820, 947, barrier));
    ctx.flags.vent = ctx.add(new K.Terminal(820, 175, 'Tear open the roof', () => {
      if (ctx.player.scale < 1.5) {
        ctx.toast('G TO EXPAND · THEN E AT THE ROOF LATCH', S.AMBER);
        return;
      }
      fire.vent();
      ctx.toast('SMOKE VENTED · THE FIRE WILL NOT SPREAD', S.TEAL);
    }, () => !fire.vented));
    ctx.flags.residents = [];
    const placements = [[460, 255], [1140, 255], [460, 490], [1140, 725], [460, 960], [1140, 1195]];
    for (let id = 0; id < placements.length; id++) {
      const [x, y] = placements[id];
      const route = [{ x: x < 820 ? 703 : 917, y }, { x: 820, y }, state.safePoint];
      const e = ctx.add(new S.Resident(state, x, y, id, route));
      if ((ctx.flags.rescuedMask || 0) & (1 << id)) {
        e.safe = true;
        e.x = 720 + id * 32;
        e.y = 1405;
        e.grabbable = false;
        e.interact = null;
      }
      ctx.flags.residents.push(e);
    }
    ctx.flags.looter = ctx.add(new S.Rioter(state, 1170, 960));
    ctx.flags.looter.exitPoint = state.safePoint;
    ctx.flags.exit = ctx.add(new K.Terminal(820, 1460, 'Leave for the armoury', () => {
      if (ctx.flags.rescued < 6) ctx.toast('SIX RESIDENTS MUST REACH THE STREET', S.AMBER);
      else ctx.flags.tenementExit = true;
    }));
    return w;
  }

  function truckMap(ctx) {
    const w = init(ctx, 2050, 1480, { x: 530, y: 1040 });
    const state = ctx.flags.summer;
    state.safePoint = { x: 540, y: 1120 };
    S.installArt(ctx, 'truck');
    S.addStreetFrontages(w, true);
    ctx.add(new S.FireGrid(state, { x: 80, y: 350, w: 1880, h: 940 }, [[330, 610], [1810, 580], [1630, 1135]]));
    ctx.flags.hydrants = [ctx.add(new S.Hydrant(state, 475, 555)), ctx.add(new S.Hydrant(state, 1570, 1130))];
    ctx.flags.comedian.silent = true;
    ctx.flags.truck = ctx.add(new S.RiotTruck(state, 1110, 650));
    w.boss = ctx.flags.truck;
    for (const [x, y] of [[650, 810], [1400, 1060], [1610, 480], [350, 900]]) ctx.add(new DM.Props.Crate(x, y));
    w.decals.push(g => {
      g.fillStyle = 'rgba(92,150,133,0.17)';
      G.ellipse(g, state.safePoint.x, state.safePoint.y, 90, 55);
      g.fill();
      K.ring(g, state.safePoint.x, state.safePoint.y, 70, '#729c85', 2);
    });
    ctx.add(new K.Sign(540, 1170, 'SAFE PASSAGE', S.TEAL, 15));
    return w;
  }

  const ENDINGS = {
    calm: {
      title: 'MERCY',
      text: 'By dawn the street has its people back. Six residents sit on the kerb in borrowed coats. ' +
        'The boy from the truck is among them. Order, I discover, is not the same thing as silence.',
      comedian: 'You left them all something to complain about tomorrow.',
      jon: 'Yes. Tomorrow.',
    },
    uneasy: {
      title: 'ORDER',
      text: 'The fires are lower. Six people have somewhere to stand. The street is quiet enough for an official ' +
        'to call it restored. I can see the morning. It has not decided whether to forgive us.',
      comedian: 'They will call this a good night. Watch.',
      jon: 'I am watching the people they will not count.',
    },
    burning: {
      title: 'SILENCE',
      text: 'The city stops shouting. That is not the same thing as peace. There are doors that will not open ' +
        'in the morning, names that will not be called, and a blue light remembered for the wrong reason.',
      comedian: 'Quiet at last.',
      jon: 'There is less of the city left to make a sound.',
    },
  };
  class SummerComplete {
    constructor(play, record) {
      this.play = play;
      this.record = record;
      this.t = 0;
      this.cursor = 'pointer';
      this.tone = S.tone(record.stats, record.flags);
      this.ending = ENDINGS[this.tone];
    }
    enter() {
      DM.Audio.stopHums();
      DM.Audio.play('success');
      DM.Audio.music.play('summer_street');
      this.menu = new DM.UI.Menu([
        { label: 'RETURN TO BONUS LEVELS', action: () => DM.Engine.set(new DM.Scenes.BonusMenu()) },
        { label: 'PLAY AGAIN · LEAVE A DIFFERENT CITY', action: () => DM.Bonus.start('long_summer', false) },
      ], { x: 640, y: 570, w: 720, itemH: 42, size: 20, align: 'center', accent: S.AMBER });
    }
    update(dt) {
      this.t += dt;
      if (this.t > 1) this.menu.update(dt);
    }
    render(g) {
      S.backdrop(g, this.t);
      g.fillStyle = 'rgba(9,18,24,0.94)';
      g.fillRect(105, 40, 1070, 640);
      g.strokeStyle = '#776c58';
      g.strokeRect(105, 40, 1070, 640);
      G.text(g, 'THE LONG SUMMER · BONUS III COMPLETE', 640, 93,
        { align: 'center', size: 15, spacing: 4, color: S.AMBER });
      G.text(g, this.ending.title, 640, 163, { align: 'center', size: 52, spacing: 7, weight: 700, color: '#efe2c3' });
      G.paragraph(g, this.ending.text, 248, 206, 784, 27, { size: 20, font: DM.FONTS.type, color: '#d9cfba' });
      const f = this.record.flags;
      const s = this.record.stats;
      const rows = [
        ['PEOPLE SPARED / UNMADE', `${s.spared || 0} / ${s.disintegrated || 0}`],
        ['COMEDIAN CASUALTIES', String(f.comedianCasualties || 0)],
        ['RESIDENTS RESCUED', `${f.rescued || 0} / 6`],
        ['CITY HEAT', `${Math.round(f.heat || 0)} / 100`],
      ];
      rows.forEach(([label, value], i) => {
        G.text(g, label, 617, 344 + i * 33, { align: 'right', size: 15, spacing: 2, color: '#b0bcb3' });
        G.text(g, value, 648, 344 + i * 33, { size: 22, color: i === 1 && f.comedianCasualties ? S.RED : S.TEAL });
      });
      G.paragraph(g, '“' + this.ending.comedian + '”', 248, 489, 784, 23,
        { size: 17, align: 'left', font: DM.FONTS.type, color: '#d8b889' });
      this.menu.render(g);
      G.postFx(g);
    }
  }

  const chapter = DM.Bonus.register({
    id: 'long_summer', numeral: 'BONUS III', title: 'The Long Summer', date: 'August 1977', place: 'New York',
    clock: 5, color: '#6f4c36', music: 'summer_street', form: 'manhattan',
    menuAccent: S.AMBER, menuTitle: ['THE LONG', 'SUMMER'], menuLocation: 'NEW YORK · AUGUST 1977',
    menuCast: ['comedian', 'niteowl'], menuBackdrop: S.backdrop,
    menuSummary: 'The police are on strike. The city is burning. You have been sent to restore order.',
    menuBrief: 'Keep people alive. Bring six residents home. Your most dangerous weapon may be the man beside you.',
    menuTagline: 'A QUIET STREET IS NOT ALWAYS A SAVED STREET.',
    menuEmblem(g, x, y) {
      K.ring(g, x, y, 65, S.AMBER, 3);
      g.strokeStyle = S.AMBER;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 37, 0.1, Math.PI - 0.1);
      g.stroke();
      for (const dx of [-21, 21]) {
        G.circle(g, x + dx, y - 17, 6);
        g.fillStyle = S.AMBER;
        g.fill();
      }
      g.strokeStyle = S.RED;
      G.line(g, x + 18, y - 65, x + 37, y - 6);
    },
    bonusComplete: SummerComplete,
    persistFlags: ['heat', 'rescued', 'rescuedMask', 'comedianCasualties', 'restraints', 'grappleOpen',
      'beamCleared', 'vented', 'driverOutcome', 'avenueExit', 'tenementExit'],
    intro: [
      'It is August 1977. The fans have stopped in a thousand windows. The police do not come when people call.',
      'Dan has brought ropes and blankets. Edward has brought ammunition. We have both been told this is a rescue.',
      'I can lower the temperature of a city. I do not yet know how to lower its anger.'
    ],
    maps: { summer_avenue: avenue, summer_tenement: tenement, summer_truck: truckMap },
    stages: [
      {
        id: 'avenue', label: 'Blackout Avenue', map: 'summer_avenue', checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            ['niteowl', 'The tenement is burning. But we cannot move anyone through a street like this.'],
            ['comedian', 'Then give them a reason to get out of it.'],
            ['niteowl', 'Jon, those are live rounds. He raises his gun before firing. Lift him while he aims. ' +
              'A quick hold takes his gun away for ten seconds.'],
            ['manhattan', 'I was told to help the people here. I do not see an exception for the angry ones.'],
            ['niteowl', 'Spare them and the street calms down. Rip the red hydrants free to put out fires. ' +
              'Catch the bottles and drop them in the water. I can grapple to the balcony when you call me.'],
          ]);
          ready(ctx);
          ctx.objective('Calm the avenue · Reach the tenement', () =>
            `Heat ${Math.round(ctx.flags.heat)} / 100 · must be below 40`);
          ctx.marker(1510, 420, 'BALCONY ROUTE');
          ctx.tutorial('Hold C on the Comedian to disarm him. Spare rioters. Lift red hydrants. E calls Dan.', 16);
          yield ctx.until(() => ctx.flags.avenueExit);
          ctx.objectiveDone();
          yield ctx.dialog([
            ['niteowl', 'The way is open. There are still people upstairs.'],
            ['comedian', ctx.flags.restraints ? 'You going to carry me all night?' : 'You are taking the long way round this.'],
            ['manhattan', 'It is the only way that leaves people at the end of it.'],
          ]);
        },
      },
      {
        id: 'tenement', label: 'The Tenement', map: 'summer_tenement', checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            ['niteowl', 'Five floors. Six residents. I will keep the street door open. Edward, stay with me.'],
            ['comedian', 'A room full of people who cannot shoot back. I think you can manage.'],
            ['niteowl', 'E asks them to follow; telekinesis can carry them. They are safe only at the green exit. ' +
              'Lift the beam off the stairs.'],
            ['manhattan', 'The fire is gathering itself. Temporal Sight shows where it will be in three seconds.'],
            ['niteowl', 'Your duplicate can reassure another resident while you work. At the top landing, ' +
              'grow with G, then use the roof latch with E to let the smoke out.'],
          ]);
          ready(ctx);
          ctx.objective('Bring six residents to the street', () => `${ctx.flags.rescued} / 6 safely outside`);
          ctx.marker(820, 1400, 'SAFE EXIT');
          ctx.tutorial('E guides residents; C carries them. F predicts fire. R helps another room. G + E vents.', 16);
          yield ctx.until(() => ctx.flags.tenementExit);
          ctx.objectiveDone();
          yield ctx.dialog([
            ['summer_resident', 'The photographs are upstairs. Leave them. My daughter is here.'],
            ['niteowl', 'There is a riot truck on the next block. Someone took it from the armoury.'],
            ['manhattan', 'I can see a boy behind the windscreen. He is more frightened than anyone outside it.'],
          ]);
        },
      },
      {
        id: 'truck', label: 'The Armoury Truck', map: 'summer_truck', checkpoint: true,
        run: function* (ctx) {
          yield ctx.dialog([
            ['summer_driver', 'They kept coming. I thought if I had the truck they would stop.'],
            ['niteowl', 'Cannon and four wheels, Jon. The teal rings are machinery. The amber cab is a person. ' +
              'Use Q or thrown crates on the parts. Keep the cab intact.'],
            ['comedian', 'Or I could make one shot and we could all go home.'],
            ['manhattan', 'Not all of us.'],
            ['niteowl', 'When he comes out, E guides him to the green safe passage. Watch Edward.'],
          ]);
          ready(ctx);
          ctx.objective('Stop the truck · Decide what happens to its driver');
          ctx.tutorial('Q or thrown crates break teal parts. The amber cab is lethal. Amber lanes warn of a ram.', 16);
          yield ctx.until(() => ctx.flags.truck.disabled);
          if (!ctx.flags.driverOutcome) {
            ctx.objective('Bring the driver to safe passage · Stop the Comedian');
            ctx.marker(540, 1120, 'SAFE PASSAGE');
            ctx.tutorial('Hold C on the Comedian to disarm him. E guides the driver; C can carry him to safety.', 16);
          }
          yield ctx.until(() => !!ctx.flags.driverOutcome);
          ctx.lock(true);
          ctx.objectiveDone();
          const tone = S.tone(ctx.stats, ctx.flags);
          yield ctx.dialog([
            ['niteowl', ctx.flags.driverOutcome === 'spared' ? 'He is out. Keep walking. You are safe now.' :
              'There was a person in there. That is what the report needs to say.'],
            ['comedian', ENDINGS[tone].comedian],
            ['manhattan', ENDINGS[tone].jon],
          ]);
        },
      },
    ],
  });
  Object.assign(S, { SummerOwl, SummerComplete, ENDINGS, chapter });
})();
