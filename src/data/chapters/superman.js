/*
 * CHAPTER II — The Superman Exists. Nevada test range, 1960; New York, 1966.
 * Learn Telekinesis and Disintegration, then raid a mob warehouse. Thrown
 * gangsters are knocked out (spared); disintegrated ones are not.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const { Crate, Barrel, Vehicle, Prop, Zone, Dummy } = DM.Props;
  const { Gangster } = DM.Enemies;
  const NPC = DM.NPC;

  // ---- Test range ------------------------------------------------------------
  const RANGE_WALLS = {
    sandbag: { top: '#b49a64', face: '#8a7448', edge: '#5a4a2a', low: true },
    concrete: { top: '#b8b2a4', face: '#8a8478', edge: '#5a564e' },
  };

  function bakeRange(g) {
    const rnd = U.seeded(1960);
    g.fillStyle = '#cfa86c';
    g.fillRect(0, 0, 2000, 1300);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(120,80,40,0.08)' : 'rgba(255,240,200,0.08)';
      g.fillRect(rnd() * 2000, rnd() * 1300, 3, 3);
    }
    g.strokeStyle = 'rgba(255,240,210,0.25)';
    g.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const y = rnd() * 1300;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(600, y + rnd() * 80 - 40, 1300, y + rnd() * 80 - 40, 2000, y + rnd() * 60 - 30);
      g.stroke();
    }
    g.strokeStyle = 'rgba(90,60,30,0.25)';
    g.lineWidth = 5;
    g.setLineDash([10, 8]);
    for (const off of [0, 22]) {
      g.beginPath();
      g.moveTo(300, 1300);
      g.bezierCurveTo(500, 900 + off, 900, 1000 + off, 1100, 600 + off);
      g.stroke();
    }
    g.setLineDash([]);
    g.fillStyle = '#a8a294';
    g.fillRect(120, 120, 340, 280);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.font = '700 28px Oswald, Arial Narrow, sans-serif';
    g.fillText('U.S. ARMY · RANGE 4', 140, 390);
  }

  function buildRange(ctx) {
    const W = ctx.newWorld({ w: 2000, h: 1300, bg: '#b8945c', wallStyles: RANGE_WALLS, zoom: 1.25 });
    W.bake(bakeRange);
    W.spawn = { x: 500, y: 480, facing: 0 };
    W.room(0, 0, 2000, 1300, { t: 20, kind: 'concrete' });
    W.wall(150, 360, 280, 26, 'sandbag');
    W.wall(420, 150, 26, 236, 'sandbag');
    W.wall(160, 150, 110, 70, 'concrete');
    W.wall(980, 260, 30, 140, 'concrete');
    W.wall(1100, 900, 140, 30, 'concrete');
    W.wall(1260, 640, 30, 120, 'concrete');
    const R = (ctx.refs = {});
    ctx.add(new NPC({ x: 250, y: 290, look: 'colonel', facing: 0 }));
    ctx.add(new NPC({ x: 330, y: 300, look: 'glass', facing: 0 }));
    for (let i = 0; i < 7; i++) ctx.add(new Crate(620 + (i % 4) * 46 + U.rand(-6, 6), 560 + Math.floor(i / 4) * 52, { style: i % 3 ? 'wood' : 'metal' }));
    R.zone = ctx.add(new Zone(1460, 420, 110, { label: 'TARGET ZONE' }));
    R.jeep = ctx.add(new Vehicle(760, 960, { kind: 'jeep', hp: null, disintegratable: false, rot: -0.3 }));
    R.dummies = [
      [1560, 900], [1700, 1010], [1830, 860], [1640, 1160],
    ].map(([x, y]) => ctx.add(new Dummy(x, y)));
    R.dummies.push(
      ctx.add(new Dummy(1500, 1060, { rail: { dx: 0, dy: 90, speed: 1.2 } })),
      ctx.add(new Dummy(1760, 740, { rail: { dx: 110, dy: 0, speed: 1 } })),
      ctx.add(new Dummy(1890, 1110, { rail: { dx: 0, dy: 100, speed: 1.5 } })),
      ctx.add(new Dummy(1590, 760, { rail: { dx: 80, dy: 0, speed: 1.8 } })),
    );
    return W;
  }

  // ---- Pier 9 ----------------------------------------------------------------
  const PIER_WALLS = {
    brick: { top: '#6b3a2e', face: '#4a281f', edge: '#2a1712' },
    shelf: { top: '#5a5248', face: '#3e3830', edge: '#211d18' },
    rust: { top: '#8a3a26', face: '#62291b', edge: '#33150d' },
    navy: { top: '#2e4f7a', face: '#203856', edge: '#111e2e' },
    moss: { top: '#3b6b4a', face: '#294b34', edge: '#142519' },
    water: { top: 'rgba(0,0,0,0)', face: null, edge: null, low: true, flat: true },
    desk: { top: '#6a4f30', face: '#4e3a23', edge: '#2e2214', low: true },
  };

  function bakePier(g) {
    const rnd = U.seeded(1966);
    g.fillStyle = '#2b2d33';
    g.fillRect(0, 0, 2200, 1400);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.03)';
      g.fillRect(rnd() * 2200, rnd() * 1180, 3, 3);
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * 2000, y = rnd() * 1100, rx = 30 + rnd() * 70;
      g.fillStyle = 'rgba(10,20,40,0.45)';
      Gfx.ellipse(g, x, y, rx, rx * 0.45);
      g.fill();
      g.strokeStyle = 'rgba(120,160,210,0.15)';
      g.stroke();
    }
    g.fillStyle = '#4a4844';
    g.fillRect(1000, 150, 1100, 750);
    for (let i = 0; i < 20; i++) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      Gfx.ellipse(g, 1050 + rnd() * 1000, 200 + rnd() * 650, 20 + rnd() * 50, 10 + rnd() * 25);
      g.fill();
    }
    g.fillStyle = '#4a3a2a';
    g.fillRect(0, 1180, 2200, 120);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    for (let x = 0; x < 2200; x += 26) Gfx.line(g, x, 1180, x, 1300);
    g.fillStyle = '#0d1a2a';
    g.fillRect(0, 1300, 2200, 100);
    g.strokeStyle = 'rgba(120,170,220,0.18)';
    for (let i = 0; i < 40; i++) {
      const x = rnd() * 2200, y = 1310 + rnd() * 80;
      Gfx.line(g, x, y, x + 40 + rnd() * 60, y);
    }
    g.strokeStyle = 'rgba(240,220,120,0.5)';
    g.lineWidth = 4;
    g.setLineDash([30, 26]);
    Gfx.line(g, 0, 1100, 1000, 1100);
    g.setLineDash([]);
    g.save();
    g.translate(1560, 935);
    g.rotate(-0.03);
    g.font = '700 30px "Patrick Hand", "Trebuchet MS", sans-serif';
    g.fillStyle = 'rgba(230,60,50,0.85)';
    g.textAlign = 'center';
    g.fillText('WHO WATCHES THE WATCHMEN?', 0, 0);
    g.restore();
  }

  function buildPier(ctx) {
    const W = ctx.newWorld({ w: 2200, h: 1400, bg: '#16171b', wallStyles: PIER_WALLS, zoom: 1.3 });
    W.bake(bakePier);
    W.spawn = { x: 260, y: 1000, facing: 0 };
    W.room(0, 0, 2200, 1400, { t: 20, kind: 'brick' });
    W.wall(20, 1300, 2160, 80, 'water');
    W.room(1000, 150, 1100, 750, { t: 24, kind: 'brick', doors: [{ side: 'bottom', at: 350, w: 150 }, { side: 'left', at: 250, w: 120 }] });
    W.wall(1700, 174, 24, 126, 'brick');
    W.wall(1700, 380, 24, 100, 'brick');
    W.wall(1724, 456, 76, 24, 'brick');
    W.wall(1880, 456, 196, 24, 'brick');
    W.wall(1100, 300, 40, 220, 'shelf');
    W.wall(1250, 300, 40, 220, 'shelf');
    W.wall(1100, 640, 260, 36, 'shelf');
    W.wall(1460, 560, 36, 200, 'shelf');
    W.wall(1900, 200, 150, 60, 'desk');
    W.wall(500, 300, 240, 90, 'rust');
    W.wall(300, 600, 90, 240, 'navy');
    W.wall(700, 780, 240, 90, 'moss');
    W.wall(850, 430, 90, 200, 'rust');

    const lamps = [[200, 300], [200, 820], [900, 1120], [1420, 1060], [620, 560]];
    W.decals.push((g) => {
      for (const [x, y] of lamps) {
        g.fillStyle = 'rgba(255,220,140,0.06)';
        Gfx.circle(g, x, y, 170);
        g.fill();
      }
    });
    W.overlays.push((g, world) => {
      for (const [x, y] of lamps) {
        g.fillStyle = '#222';
        Gfx.circle(g, x, y, 6);
        g.fill();
        Gfx.glow(g, x, y, 60, '#ffd27a', 0.5 + Math.sin((world.realTime || 0) * 7 + x) * 0.03);
      }
    });

    ctx.add(new NPC({ x: 170, y: 1040, look: 'captain', facing: 0 }));
    ctx.add(new Vehicle(140, 930, { kind: 'sedan', paint: '#1d2b4f', mass: 6 }));
    ctx.add(new Vehicle(620, 1020, { kind: 'sedan', rot: 0.2 }));
    ctx.add(new Vehicle(1700, 1060, { kind: 'sedan', rot: -0.1 }));
    const crates = [[460, 470], [500, 470], [780, 560], [1020, 1000], [1080, 980], [1180, 420], [1600, 300], [1640, 320], [1560, 820], [1900, 700], [1960, 760], [1320, 820]];
    for (const [x, y] of crates) ctx.add(new Crate(x, y));
    for (const [x, y] of [[760, 700], [1390, 380], [1980, 620], [1820, 380]]) ctx.add(new Barrel(x, y));
    ctx.add(new Prop({
      x: 1975, y: 230, r: 4,
      draw: (g) => Gfx.smiley(g, 1975, 228, 8),
      interact: {
        label: 'Look at the badge', range: 60,
        onInteract: () => ctx.fork(function* () {
          yield ctx.dialog([['manhattan', 'A smiley-face badge, left on the desk. Somebody here has a sense of humour. I suspect I know who.']]);
        }),
      },
    }));
    return W;
  }

  function spawnGroup(ctx, list) {
    return list.map(([x, y, gun]) => ctx.add(new Gangster({ x, y, gun: gun || 'pistol', facing: U.rand(0, Math.PI * 2) })));
  }
  const down = (g) => g.filter((e) => e.neutralized).length;

  const YARD = [[700, 500], [460, 920], [980, 720], [620, 680]];
  const WAREHOUSE = [[1200, 560], [1380, 420], [1580, 700], [1650, 840], [1350, 760, 'tommy']];
  const OFFICE = [[1900, 300, 'tommy'], [2020, 400, 'tommy'], [1790, 230]];

  DM.Chapters.register({
    id: 'superman',
    numeral: 'CHAPTER II',
    title: 'The Superman Exists',
    date: '1960 – 1966',
    place: 'Nevada · New York',
    clock: 8,
    color: '#7a3b2e',
    music: 'action',
    form: 'manhattan',
    epigraph: { text: 'Now I am become Death, the destroyer of worlds.', by: 'J. Robert Oppenheimer, quoting the Bhagavad Gita' },
    intro: [
      'The Army gives me a name, a costume and a test range in the Nevada desert. I wear the costume for a while. It seems to make them comfortable.',
      'They want to know what I can do. Honestly, so do I.',
      'Within a year I am on the cover of every newspaper in the world. Within two, the Russians are building more bombs.',
    ],
    maps: { range: buildRange, pier: buildPier },
    stages: [
      {
        id: 'range',
        map: 'range',
        grants: ['telekinesis', 'disintegrate'],
        run: function* (ctx) {
          const R = ctx.refs;
          ctx.lock(true);
          yield ctx.wait(0.6);
          yield ctx.dialog([
            ['colonel', 'Doctor Manhattan. The Joint Chiefs are watching this on closed circuit. No pressure.'],
            ['glass', 'Jon, just... show them what you showed me. Gently, if you can.'],
          ]);
          yield ctx.unlock('telekinesis');
          ctx.lock(false);
          let crates = 0;
          R.zone.accept = (e) => e.tags.has('crate');
          R.zone.onAccept = () => crates++;
          ctx.objective('Throw crates into the target zone', () => `${crates}/5`);
          ctx.marker(R.zone.x, R.zone.y - R.zone.r, 'ZONE');
          ctx.fork(function* () {
            while (crates < 5) {
              let left = 0;
              for (const e of ctx.world.entities) if (e.tags.has('crate')) left++;
              if (left + crates < 5) ctx.add(new Crate(660 + U.rand(-40, 40), 600 + U.rand(-40, 40)));
              yield ctx.wait(1);
            }
          });
          yield ctx.until(() => crates >= 5);
          ctx.objectiveDone();
          ctx.marker(null);
          yield ctx.wait(1);
          yield ctx.dialog([['colonel', '...Now the jeep, Doctor. If you would.']]);
          let jeepIn = false;
          R.zone.accept = (e) => e === R.jeep;
          R.zone.onAccept = () => (jeepIn = true);
          ctx.objective('Lift the jeep into the target zone');
          ctx.hint('Heavier things move slower. Be patient with it.', 6);
          yield ctx.until(() => jeepIn);
          ctx.objectiveDone();
          yield ctx.wait(1);
          yield ctx.dialog([['colonel', 'Good God.'], ['glass', 'Show them the rest, Jon.']]);
          yield ctx.unlock('disintegrate');
          ctx.objective('Disintegrate the targets', () => `${R.dummies.filter((d) => d.dead).length}/${R.dummies.length}`);
          ctx.marker(1690, 860, 'TARGETS');
          yield ctx.until(() => R.dummies.every((d) => d.dead));
          ctx.objectiveDone();
          ctx.marker(null);
          ctx.lock(true);
          yield ctx.wait(1);
          yield ctx.dialog([
            ['glass', 'Do you understand what you just saw, Colonel? There is a superman now. And he works for the United States.'],
            ['colonel', 'I understand the Russians are about to have a very bad decade.'],
          ]);
        },
      },
      {
        id: 'yard',
        map: 'pier',
        checkpoint: true,
        run: function* (ctx) {
          ctx.lock(true);
          yield ctx.banner('NEW YORK', 'PIER 9 · 1966', { color: DM.C.yellow });
          if (ctx.startedHere || !ctx.flags.briefed) {
            yield ctx.dialog([
              ['captain', "Doctor Manhattan? Captain Rourke, NYPD. Moloch's people are running a counterfeit plant out of that warehouse. They've got my men pinned down."],
              ['captain', 'Do what you do. Just... try to leave somebody for me to arrest.'],
            ]);
            ctx.flags.briefed = true;
          }
          ctx.lock(false);
          ctx.hint('Thrown people are knocked out. Disintegrated people are gone. The choice is yours.', 9);
          const g = spawnGroup(ctx, YARD);
          ctx.objective('Clear the yard', () => `${down(g)}/${g.length}`);
          yield ctx.until(() => g.every((e) => e.neutralized));
          ctx.objectiveDone();
        },
      },
      {
        id: 'warehouse',
        checkpoint: true,
        run: function* (ctx) {
          const P = ctx.player;
          if (ctx.startedHere) ctx.place(980, 1020, -Math.PI / 2);
          yield ctx.wait(1);
          const g = spawnGroup(ctx, WAREHOUSE);
          ctx.objective('Clear the warehouse', () => `${down(g)}/${g.length}`);
          ctx.marker(1425, 900, 'WAREHOUSE');
          ctx.fork(function* () {
            yield ctx.until(() => P.y < 880 && P.x > 1000);
            ctx.marker(null);
          });
          yield ctx.until(() => g.every((e) => e.neutralized));
          ctx.objectiveDone();
          ctx.marker(null);
        },
      },
      {
        id: 'office',
        checkpoint: true,
        run: function* (ctx) {
          const P = ctx.player;
          if (ctx.startedHere) ctx.place(1420, 820, -Math.PI / 2);
          yield ctx.wait(0.8);
          const g = spawnGroup(ctx, OFFICE);
          ctx.objective('Clear the back office', () => `${down(g)}/${g.length}`);
          ctx.marker(1840, 480, 'OFFICE');
          ctx.fork(function* () {
            yield ctx.until(() => P.x > 1700 && P.y < 470);
            ctx.marker(null);
          });
          yield ctx.until(() => g.every((e) => e.neutralized));
          ctx.objectiveDone();
          ctx.marker(null);
        },
      },
      {
        id: 'aftermath',
        run: function* (ctx) {
          ctx.lock(true);
          yield ctx.wait(1);
          yield ctx.dialog([
            ['captain', "...That's the last of them. Nineteen years on the force, Doctor. I never saw anything like that.", { name: 'Captain Rourke — Radio' }],
            ['manhattan', 'Neither had I, until recently.'],
          ]);
          const s = ctx.stats;
          let line;
          if (s.disintegrated === 0) line = 'Every one of them will live to stand trial. It is a small thing. I notice that I wanted it.';
          else if (s.spared === 0) line = 'None of them will stand trial. I notice that I feel nothing about this. I notice that I notice.';
          else line = 'Some of them will stand trial. Some will not. It made no difference at all to my heart rate.';
          yield ctx.narrate(line, { dur: 6 });
          yield ctx.narrate('The next morning, every newspaper in America runs the same headline. They have found their superman.', { dur: 6 });
        },
      },
    ],
  });
})();
