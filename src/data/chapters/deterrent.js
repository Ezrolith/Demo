/*
 * CHAPTER III — The Deterrent. Nevada Test Site, 1971–1977.
 * Teleport across a canyon and a minefield, then survive Operation Blue Fire:
 * waves of drones, tanks and missile batteries, and the Behemoth.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const { Crate, Barrel, Vehicle } = DM.Props;
  const { Drone, Tank, Battery, Behemoth } = DM.Enemies;
  const { Mine } = DM.Special;
  const NPC = DM.NPC;

  const WALLS = {
    concrete: { top: '#b8b2a4', face: '#8a8478', edge: '#5a564e' },
    sandbag: { top: '#a8905c', face: '#7e6a40', edge: '#4e4024', low: true },
    rock: { top: '#7a5a3a', face: '#5a4028', edge: '#3a2818' },
    chasm: {
      low: true,
      draw: (g, w) => {
        g.fillStyle = '#21160e';
        g.fillRect(w.x, w.y, w.w, w.h);
        g.fillStyle = '#0e0905';
        g.fillRect(w.x + w.w * 0.3, w.y, w.w * 0.4, w.h);
        g.fillStyle = '#9a7246';
        for (let y = w.y; y < w.y + w.h; y += 40) {
          const j = Math.sin(y * 0.13) * 8;
          g.fillRect(w.x - 6 + j, y, 10, 22);
          g.fillRect(w.x + w.w - 4 - j, y + 14, 10, 22);
        }
      },
    },
  };

  const CANYON = { x: 760, w: 110 };
  const POST = { x: 1450, y: 900 };

  // The minefield: a grid of cells, most of them mined. Three zig-zag lanes are
  // left clear (seeded, so every attempt is the same) with the mines beside them
  // pushed back, and a trodden path in the sand gives them away.
  const FIELD = { x: 930, y: 260, cols: 5, rows: 13, cw: 92, ch: 88 };
  const LANES = (() => {
    const rnd = U.seeded(1973);
    const cells = new Set();
    const paths = [];
    for (const start of [2, 6, 10]) {
      let r = U.clamp(start + Math.floor(rnd() * 3) - 1, 1, FIELD.rows - 2);
      const pts = [];
      for (let c = 0; c < FIELD.cols; c++) {
        cells.add(c + ',' + r);
        pts.push([c, r]);
        if (c === FIELD.cols - 1) break;
        let step = (rnd() < 0.5 ? 1 : 2) * (rnd() < 0.5 ? -1 : 1);
        if (r + step < 1 || r + step > FIELD.rows - 2) step = -step;
        for (let k = 1; k <= Math.abs(step); k++) {
          const rr = r + Math.sign(step) * k;
          cells.add(c + ',' + rr);
          pts.push([c, rr]);
        }
        r += step;
      }
      paths.push(pts);
    }
    return { cells, paths };
  })();
  const inLane = (c, r) => LANES.cells.has(c + ',' + r);
  // Centre of a cell's clear spot (mines sit in the top-left 50 x 40 of their cell).
  const cellCentre = (c, r) => ({ x: FIELD.x + c * FIELD.cw + 25, y: FIELD.y + r * FIELD.ch + 20 });

  function bakeProving(g) {
    const rnd = U.seeded(1971);
    g.fillStyle = '#c49a62';
    g.fillRect(0, 0, 2600, 1600);
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(110,70,30,0.08)' : 'rgba(255,240,210,0.08)';
      g.fillRect(rnd() * 2600, rnd() * 1600, 3, 3);
    }
    for (let i = 0; i < 26; i++) {
      const x = 1450 + rnd() * 1100, y = rnd() * 1600, r = 30 + rnd() * 70;
      g.fillStyle = 'rgba(70,45,20,0.35)';
      Gfx.ellipse(g, x, y, r, r * 0.8);
      g.fill();
      g.strokeStyle = 'rgba(240,210,160,0.35)';
      g.lineWidth = 4;
      g.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const x = 1500 + rnd() * 1000, y = rnd() * 1600;
      g.fillStyle = 'rgba(30,20,10,0.22)';
      Gfx.ellipse(g, x, y, 90 + rnd() * 60, 50 + rnd() * 40);
      g.fill();
    }
    g.fillStyle = 'rgba(150,40,30,0.12)';
    g.fillRect(900, 230, 420, 1140);
    g.strokeStyle = 'rgba(200,40,30,0.5)';
    g.setLineDash([16, 12]);
    g.lineWidth = 3;
    g.strokeRect(900, 230, 420, 1140);
    g.setLineDash([]);
    for (let y = 280; y < 1360; y += 180) {
      g.fillStyle = '#5a4028';
      g.fillRect(886, y, 6, 30);
      g.fillStyle = '#e8d27a';
      g.fillRect(866, y - 22, 46, 26);
      g.fillStyle = '#c4302b';
      g.font = '700 10px Oswald, Arial Narrow, sans-serif';
      g.fillText('DANGER', 870, y - 10);
      g.fillText('MINES', 874, y);
    }
    // Boot prints along the cleared lanes, and a survey stake at each end.
    for (const pts of LANES.paths) {
      for (let i = 0; i < pts.length; i++) {
        const a = cellCentre(pts[i][0], pts[i][1]);
        const b = i + 1 < pts.length ? cellCentre(pts[i + 1][0], pts[i + 1][1]) : { x: a.x + 80, y: a.y };
        const d = U.dist(a.x, a.y, b.x, b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        for (let k = 0, n = 0; k < d; k += 13, n++) {
          const side = n % 2 ? 4 : -4;
          g.fillStyle = 'rgba(95,62,30,0.22)';
          Gfx.ellipse(g, a.x + Math.cos(ang) * k - Math.sin(ang) * side, a.y + Math.sin(ang) * k + Math.cos(ang) * side, 4, 2.4, ang);
          g.fill();
        }
      }
      const s0 = cellCentre(pts[0][0], pts[0][1]), s1 = cellCentre(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      for (const [x, y] of [[s0.x - 70, s0.y], [s1.x + 70, s1.y]]) {
        g.fillStyle = '#5a4028';
        g.fillRect(x - 2, y - 18, 4, 22);
        g.fillStyle = '#f2ead8';
        g.fillRect(x + 2, y - 18, 12, 7);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.font = '700 40px Oswald, Arial Narrow, sans-serif';
    g.fillText('AREA 7 · OPERATION BLUE FIRE', 1600, 80);
  }

  function buildProving(ctx) {
    const W = ctx.newWorld({ w: 2600, h: 1600, bg: '#a8824e', wallStyles: WALLS, zoom: 1.15 });
    W.bake(bakeProving);
    W.spawn = { x: 360, y: 800, facing: 0 };
    W.room(0, 0, 2600, 1600, { t: 20, kind: 'rock' });
    W.wall(CANYON.x, 20, CANYON.w, 1560, 'chasm');
    W.wall(1380, 640, 140, 110, 'concrete');
    W.wall(1360, 790, 70, 22, 'sandbag');
    W.wall(1480, 790, 70, 22, 'sandbag');
    for (const [x, y, w, h] of [[1800, 300, 120, 80], [2100, 1100, 160, 90], [1900, 780, 70, 140], [2300, 500, 100, 100], [1650, 1260, 140, 60], [2250, 1380, 90, 70], [300, 400, 120, 70], [420, 1200, 90, 110]]) W.wall(x, y, w, h, 'rock');

    const rnd = U.seeded(7);
    for (let c = 0; c < FIELD.cols; c++) {
      for (let r = 0; r < FIELD.rows; r++) {
        if (rnd() < 0.22) continue;
        let u = rnd() * 50, v = rnd() * 40;
        if (inLane(c, r)) continue;
        // Beside a lane, the mine sits at the far side of its cell.
        if (inLane(c + 1, r)) u = 0;
        else if (inLane(c - 1, r)) u = 50;
        if (inLane(c, r + 1)) v = 0;
        else if (inLane(c, r - 1)) v = 40;
        ctx.add(new Mine(FIELD.x + c * FIELD.cw + u, FIELD.y + r * FIELD.ch + v));
      }
    }
    ctx.add(new NPC({ x: 1450, y: 840, look: 'general', facing: Math.PI / 2 }));
    for (const [x, y, k] of [[1700, 620, 'wreck'], [2000, 1010, 'wreck'], [2220, 300, 'wreck'], [560, 980, 'jeep']]) ctx.add(new Vehicle(x, y, { kind: k, mass: 6, hp: 300, rot: rnd() * 3 }));
    for (const [x, y] of [[1660, 900], [1700, 930], [2150, 700], [2400, 1300], [1980, 560], [1600, 420]]) ctx.add(new Crate(x, y, { style: 'metal' }));
    for (const [x, y] of [[1760, 1120], [2060, 460], [2380, 900]]) ctx.add(new Barrel(x, y));
    return W;
  }

  function edgeSpot(W, r) {
    for (let i = 0; i < 30; i++) {
      const x = U.rand(2360, 2540), y = U.rand(160, 1440);
      if (W.isFree(x, y, r)) return { x, y };
    }
    return { x: 2480, y: 800 };
  }

  function spawnWave(ctx, spec) {
    const W = ctx.world;
    const out = [];
    for (let i = 0; i < (spec.drones || 0); i++) {
      const p = edgeSpot(W, 14);
      out.push(ctx.add(new Drone({ x: p.x, y: p.y, sight: 2400, alerted: true })));
    }
    for (let i = 0; i < (spec.tanks || 0); i++) {
      const p = edgeSpot(W, 32);
      out.push(ctx.add(new Tank({ x: p.x, y: p.y, sight: 1800, needLos: false, facing: Math.PI })));
    }
    for (const [x, y] of spec.batteries || []) out.push(ctx.add(new Battery({ x, y })));
    for (const e of out) W.particles.burst(e.x, e.y, 14, { color: ['#e8d27a', '#ffffff'], speed: [40, 160], life: [0.2, 0.5], size: [2, 3] });
    return out;
  }

  function* runWaves(ctx, from, specs) {
    for (let i = 0; i < specs.length; i++) {
      const n = from + i;
      yield ctx.banner(`WAVE ${n}`, specs[i].title, { dur: 2.2, color: DM.C.orange });
      const enemies = spawnWave(ctx, specs[i]);
      ctx.objective('Break Operation Blue Fire', () => `Wave ${n}/5 · ${enemies.filter((e) => !e.dead).length} left`);
      if (specs[i].hint) ctx.hint(specs[i].hint, 8);
      yield ctx.until(() => enemies.every((e) => e.dead));
      ctx.objectiveDone();
      yield ctx.wait(1.6);
    }
  }

  DM.Chapters.register({
    id: 'deterrent',
    numeral: 'CHAPTER III',
    title: 'The Deterrent',
    date: '1971 – 1977',
    place: 'Nevada Test Site',
    clock: 5,
    color: '#5f6a2a',
    music: 'action',
    form: 'manhattan',
    epigraph: { text: 'I know not with what weapons World War III will be fought, but World War IV will be fought with sticks and stones.', by: 'Albert Einstein' },
    intro: [
      '1971. The war in Vietnam ends in a week. I am the reason. Whole units surrender to me personally; some of them try to touch me, as though I were a god.',
      'At home, the Soviets answer me with warheads. Every missile they build, they build because of me.',
      'The Pentagon wants proof that nothing on Earth can stop me. They will spend a great deal of money finding out.',
    ],
    maps: { proving: buildProving },
    // The minefield layout, for tests and tools: lane paths as [col, row] cells.
    minefield: { field: FIELD, lanes: LANES.paths, centre: cellCentre },
    stages: [
      {
        id: 'blink',
        map: 'proving',
        grants: ['teleport'],
        run: function* (ctx) {
          const P = ctx.player;
          ctx.lock(true);
          yield ctx.wait(0.6);
          yield ctx.dialog([
            ['general', 'Doctor. Operation Blue Fire: everything this country has, pointed at one man. Congress wants to know whether you can be stopped.'],
            ['manhattan', 'And if I can?'],
            ['general', 'Then I sleep better. Get across that canyon. We start when you reach my bunker.'],
          ]);
          yield ctx.unlock('teleport');
          ctx.lock(false);
          ctx.objective('Cross the canyon');
          ctx.marker(CANYON.x + CANYON.w + 60, 800, 'ACROSS');
          yield ctx.until(() => P.x > CANYON.x + CANYON.w + 10);
          ctx.objectiveDone();
          ctx.marker(POST.x, POST.y, 'COMMAND POST');
          yield ctx.wait(0.6);
          ctx.objective('Reach the command post');
          ctx.hint('A minefield. You could pick your way through. Or you could not walk at all.', 8);
          yield ctx.until(() => U.dist(P.x, P.y, POST.x, POST.y) < 90);
          ctx.objectiveDone();
          ctx.marker(null);
        },
      },
      {
        id: 'waves1',
        checkpoint: true,
        run: function* (ctx) {
          if (ctx.startedHere) ctx.place(1600, 900, 0);
          ctx.lock(true);
          yield ctx.dialog([['general', 'All units: weapons free. God help us all.']]);
          ctx.lock(false);
          yield* runWaves(ctx, 1, [
            { title: 'RECONNAISSANCE DRONES', drones: 6, hint: 'Throw things at them. Or throw them at things.' },
            { title: 'ARMOUR', drones: 4, tanks: 2, hint: 'Watch for red rings: that is where a shell will land.' },
          ]);
        },
      },
      {
        id: 'waves2',
        checkpoint: true,
        grants: ['duplicate'],
        run: function* (ctx) {
          if (ctx.startedHere) ctx.place(1600, 900, 0);
          ctx.lock(true);
          yield ctx.dialog([['general', 'Send in everything. Everything!']]);
          yield ctx.narrate('There are more of them than there are of me. That is easily corrected.', { dur: 4 });
          yield ctx.unlock('duplicate');
          ctx.lock(false);
          yield* runWaves(ctx, 3, [
            { title: 'COMBINED ARMS', drones: 7, tanks: 2, batteries: [[2350, 460]], hint: 'Grab a missile in flight and it is yours to throw back.' },
            { title: 'SATURATION', drones: 5, tanks: 3, batteries: [[2350, 1150], [2460, 760]] },
          ]);
        },
      },
      {
        id: 'behemoth',
        checkpoint: true,
        run: function* (ctx) {
          const W = ctx.world;
          if (ctx.startedHere) ctx.place(1600, 900, 0);
          ctx.lock(true);
          yield ctx.dialog([['general', 'Bring out the Behemoth. Four hundred tons of experimental armour. It cost more than the moon programme.']]);
          const b = ctx.add(new Behemoth({ x: 2420, y: 800, facing: Math.PI }));
          W.boss = b;
          ctx.focus(b.x, b.y);
          W.camera.shake(0.6);
          DM.Audio.play('explosion');
          yield ctx.wait(1.6);
          ctx.focus(null);
          ctx.lock(false);
          ctx.objective('Destroy the Behemoth');
          ctx.hint('Too heavy to lift. Throw its own missiles back at it, or get behind it: the engine at the rear has no armour.', 10);
          yield ctx.until(() => b.dead);
          ctx.clearHostiles(); // nothing still in the air lands on the victory
          W.boss = null;
          ctx.objectiveDone();
          yield ctx.wait(2);
        },
      },
      {
        id: 'outro',
        run: function* (ctx) {
          ctx.lock(true);
          yield ctx.dialog([
            ['general', '...Cease fire. Cease fire.'],
            ['general', "Doctor, I've just watched a billion dollars of hardware turn into weather."],
            ['manhattan', 'The Soviets were watching too.'],
            ['general', '...Yes. Yes, they were.'],
          ]);
          yield ctx.narrate('The Doomsday Clock moves forward. Every warhead they build, they build because of me.', { dur: 5.5 });
        },
      },
    ],
  });
})();
