/*
 * CHAPTER V — Karnak. Antarctica, November 1985.
 * Destroy the shielded tachyon emitters, survive the Intrinsic Field
 * Subtractor (by reassembling, again), then stop Adrian Veidt.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const { Prop, Door, Crate } = DM.Props;
  const { Drone, Turret, Emitter, Veidt } = DM.Enemies;
  const { Atom, BodyForm } = DM.Special;
  const NPC = DM.NPC;

  const WALLS = {
    ice: { top: '#bcd3e6', face: '#93b1cc', edge: '#6d8fae' },
    karnak: { top: '#c9a24a', face: '#8a6a22', edge: '#4e3a10' },
    pillar: { top: '#d8b860', face: '#9a7a2a', edge: '#5a4410' },
    wall: { top: '#c9a24a', face: '#8a6a22', edge: '#4e3a10' },
  };
  const SUB = { x: 2470, y: 1000 };
  const EMITTERS = [[420, 420], [950, 320], [520, 1580], [1050, 1420]];

  function bakeKarnak(g) {
    const rnd = U.seeded(1985);
    g.fillStyle = '#e6eef5';
    g.fillRect(0, 0, 2600, 2000);
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = rnd() < 0.6 ? 'rgba(120,150,190,0.07)' : 'rgba(255,255,255,0.5)';
      g.fillRect(rnd() * 1300, rnd() * 2000, 3, 3);
    }
    g.strokeStyle = 'rgba(150,180,215,0.25)';
    g.lineWidth = 3;
    for (let i = 0; i < 30; i++) {
      const x = rnd() * 1300, y = rnd() * 2000;
      Gfx.line(g, x, y, x + 60 + rnd() * 120, y + rnd() * 10 - 5);
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = 'rgba(170,215,240,0.35)';
      Gfx.ellipse(g, rnd() * 1200, rnd() * 2000, 60 + rnd() * 120, 30 + rnd() * 60, rnd() * 3);
      g.fill();
    }
    g.fillStyle = '#c9b27a';
    g.fillRect(1300, 160, 1300, 1680);
    g.strokeStyle = 'rgba(90,70,30,0.25)';
    g.lineWidth = 2;
    for (let x = 1300; x < 2600; x += 60) Gfx.line(g, x, 160, x, 1840);
    for (let y = 160; y < 1840; y += 60) Gfx.line(g, 1300, y, 2600, y);
    g.fillStyle = '#d8b860';
    g.fillRect(1340, 960, 560, 80);
    g.fillStyle = '#2e2440';
    g.fillRect(1900, 500, 650, 1000);
    g.strokeStyle = 'rgba(212,173,58,0.6)';
    g.lineWidth = 3;
    for (const r of [120, 200, 280]) {
      Gfx.circle(g, 2250, 1000, r);
      g.stroke();
    }
    g.fillStyle = 'rgba(212,173,58,0.5)';
    for (let i = 0; i < 40; i++) {
      const x = 1940 + i * 15;
      g.fillRect(x, 540, 6, 14);
      g.fillRect(x, 1446, 6, 14);
    }
    g.fillStyle = 'rgba(40,30,10,0.25)';
    g.font = '700 54px Oswald, Arial Narrow, sans-serif';
    g.fillText('KARNAK', 1420, 260);
  }

  function buildKarnak(ctx) {
    const W = ctx.newWorld({ w: 2600, h: 2000, bg: '#d6e2ec', wallStyles: WALLS, zoom: 1.2 });
    W.bake(bakeKarnak);
    W.spawn = { x: 150, y: 1000, facing: 0 };
    W.room(0, 0, 2600, 2000, { t: 20, kind: 'ice' });
    W.wall(1300, 160, 1300, 40, 'karnak');
    W.wall(1300, 1800, 1300, 40, 'karnak');
    W.wall(1300, 200, 40, 700, 'karnak');
    W.wall(1300, 1100, 40, 700, 'karnak');
    W.room(1900, 500, 676, 1000, { kind: 'karnak', t: 24, doors: [{ side: 'left', at: 440, w: 120 }] });
    for (let x = 1450; x < 1850; x += 130) {
      for (let y = 300; y < 1760; y += 200) {
        if (y > 820 && y < 1180) continue;
        W.wall(x, y, 40, 40, 'pillar');
      }
    }
    for (const [x, y, w, h] of [[300, 820, 200, 40], [780, 980, 40, 200], [200, 1300, 160, 40], [1000, 700, 140, 40], [640, 1180, 140, 40]]) W.wall(x, y, w, h, 'ice');

    const R = (ctx.refs = {});
    R.gate = W.add(new Door(W, 1300, 900, 40, 200, { color: '#b8902e', stripe: '#6f4aa6' }));
    R.emitters = EMITTERS.map(([x, y]) => W.add(new Emitter({ x, y })));
    R.turrets = [[620, 520], [1130, 440], [700, 1480], [1180, 1260]].map(([x, y]) => W.add(new Turret({ x, y })));
    R.drones = [[700, 900], [1100, 1050], [400, 1200]].map(([x, y]) => W.add(new Drone({ x, y, style: 'karnak', sight: 700 })));
    for (const [x, y] of [[260, 600], [300, 640], [880, 1100], [900, 640], [460, 1400], [1150, 900]]) W.add(new Crate(x, y, { style: 'metal' }));
    R.sub = W.add(new Prop({
      x: SUB.x, y: SUB.y, r: 4, data: { charge: 0 },
      draw: (g, e, world) => {
        const t = world.realTime || 0;
        const k = e.data.charge;
        g.fillStyle = '#2a2440';
        Gfx.circle(g, SUB.x, SUB.y, 54);
        g.fill();
        g.strokeStyle = '#d4ad3a';
        g.lineWidth = 6;
        Gfx.circle(g, SUB.x, SUB.y, 46);
        g.stroke();
        g.save();
        g.translate(SUB.x, SUB.y);
        g.rotate(t * (0.5 + k * 6));
        for (let i = 0; i < 6; i++) {
          g.rotate(Math.PI / 3);
          g.fillStyle = '#8a6a22';
          g.fillRect(30, -5, 22, 10);
        }
        g.restore();
        g.fillStyle = '#6f4aa6';
        g.fillRect(SUB.x - 80, SUB.y - 10, 40, 20);
        Gfx.glow(g, SUB.x - 80, SUB.y, 30 + k * 60, '#c06bff', 0.4 + k * 0.6);
      },
    }));
    R.veidtNpc = W.add(new NPC({ x: 2340, y: 1000, look: 'veidt', facing: Math.PI }));
    return W;
  }

  // The Intrinsic Field Subtractor beam.
  function beamOverlay(ctx) {
    return (g, world) => {
      const k = ctx.flags.beam || 0;
      if (k <= 0) return;
      const P = ctx.player;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = i ? `rgba(192,107,255,${0.3 * k})` : `rgba(255,255,255,${0.9 * k})`;
        g.lineWidth = (i ? 18 - i * 4 : 4) * k;
        g.beginPath();
        g.moveTo(SUB.x - 80, SUB.y);
        for (let s = 1; s <= 12; s++) {
          const f = s / 12;
          g.lineTo(U.lerp(SUB.x - 80, P.x, f) + U.rand(-6, 6) * k, U.lerp(SUB.y, P.y, f) + U.rand(-6, 6) * k);
        }
        g.stroke();
      }
      g.restore();
    };
  }

  function* reassemble(ctx) {
    const P = ctx.player, W = ctx.world;
    const body = W.add(new BodyForm(P.x, P.y, { H: 170, depositR: 95 }));
    const quota = 30;
    let bank = 0;
    ctx.setForm('awareness');
    P.carry = 0;
    P.carryMax = 40;
    P.basePull = 120;
    P.y += 150;
    for (let i = 0; i < 46; i++) {
      const a = U.rand(0, Math.PI * 2), d = U.rand(170, 430);
      W.add(new Atom(U.clamp(body.x + Math.cos(a) * d, 1950, 2520), U.clamp(body.y + Math.sin(a) * d, 550, 1450)));
    }
    ctx.lock(false);
    ctx.objective('Reassemble', () => `${bank}/${quota}`);
    ctx.hint('You have done this before. Gather yourself, then return to the ring.', 8);
    while (bank < quota) {
      if (P.carry > 0 && U.dist(P.x, P.y, body.x, body.y) < body.depositR) {
        P.carry--;
        bank++;
        body.pulse = 0.35;
        const f = bank / quota;
        body.layers = [Math.min(1, f * 4), Math.min(1, Math.max(0, f * 4 - 1)), Math.min(1, Math.max(0, f * 4 - 2)), Math.min(1, Math.max(0, f * 4 - 3))];
        DM.Audio.play('deposit');
        yield ctx.wait(0.035);
      } else yield;
    }
    ctx.objectiveDone();
    ctx.lock(true);
    for (const e of W.entities) if (e instanceof Atom) e.dead = true;
    for (let k = 0; k <= 1; k += 0.05) {
      body.skin = k;
      yield ctx.wait(0.03);
    }
    ctx.flash('#dff7ff', 1.4);
    W.camera.shake(0.6);
    DM.Audio.play('expand');
    ctx.setForm('manhattan');
    P.x = body.x;
    P.y = body.y;
    body.dead = true;
    P.targetScale = 2.2;
    P.expandT = 4;
    W.camera.targetZoom = W.baseZoom * 0.8;
  }

  DM.Chapters.register({
    id: 'karnak',
    numeral: 'CHAPTER V',
    title: 'Karnak',
    date: 'November 1985',
    place: 'Antarctica',
    clock: 1,
    color: '#5b3a7a',
    music: 'finale',
    form: 'manhattan',
    epigraph: { text: 'Quis custodiet ipsos custodes? Who watches the watchmen?', by: 'Juvenal, Satires' },
    intro: [
      'November 1985. Laurie has persuaded me to look at the world again. When I try to look ahead, I see only static.',
      'Tachyons: a storm of them, pouring out of Antarctica, drowning my view of the future. Someone has gone to great lengths to hide from me.',
      'At the bottom of the world, behind a wall of ice, an old friend is waiting.',
    ],
    maps: { karnak: buildKarnak },
    stages: [
      {
        id: 'emitters',
        map: 'karnak',
        checkpoint: true,
        run: function* (ctx) {
          const R = ctx.refs, P = ctx.player;
          ctx.lock(true);
          yield ctx.wait(0.8);
          yield ctx.narrate('Antarctica. My future is white noise here. Somebody does not want to be seen.', { dur: 4.5 });
          ctx.lock(false);
          const left = () => R.emitters.filter((e) => !e.dead);
          ctx.objective('Destroy the tachyon emitters', () => `${4 - left().length}/4`);
          ctx.hint('Tachyon emitters jam Temporal Sight. Find them and take them apart.', 8);
          let told = false;
          ctx.on('shield:block', () => {
            if (told) return;
            told = true;
            ctx.tutorial('The shield stops anything thrown or fired from outside. It will not stop you. SPACE: teleport inside.', 10);
          });
          ctx.fork(function* () {
            while (left().length) {
              let best = null, bd = Infinity;
              for (const e of left()) {
                const d = U.dist(P.x, P.y, e.x, e.y);
                if (d < bd) {
                  bd = d;
                  best = e;
                }
              }
              if (best) ctx.marker(best.x, best.y - 40, 'EMITTER');
              yield ctx.wait(0.5);
            }
            ctx.marker(null);
          });
          yield ctx.until(() => left().length === 0);
          // The grid fed the defences: with it gone, they spark and go dark.
          const W = ctx.world;
          ctx.clearHostiles();
          for (const e of W.entities) if (e instanceof Turret || e instanceof Drone) e.powerDown(W);
          ctx.hint(null);
          ctx.objectiveDone();
          R.gate.setOpen(true);
          ctx.lock(true);
          yield ctx.wait(0.8);
          yield ctx.narrate('The static clears. I can see again. I see the next eleven minutes, and I do not like them.', { dur: 5 });
          ctx.lock(false);
        },
        restore(ctx) {
          const R = ctx.refs;
          for (const e of [...R.emitters, ...R.turrets, ...R.drones]) e.dead = true;
          R.gate.open = true;
          R.gate.k = 1;
          R.gate.wall.noCollide = true;
        },
      },
      {
        id: 'subtractor',
        checkpoint: true,
        run: function* (ctx) {
          const R = ctx.refs, P = ctx.player, W = ctx.world;
          if (ctx.startedHere) ctx.place(1200, 1000, 0);
          ctx.objective('Enter Karnak');
          ctx.marker(1960, 1000, 'SANCTUM');
          yield ctx.until(() => P.x > 1960);
          ctx.marker(null);
          ctx.objective(null);
          ctx.lock(true);
          ctx.cinematic(true);
          ctx.focus(2200, 1000);
          yield ctx.dialog([
            ['veidt', 'Jon. I hoped you would come. I prepared for it, in fact.'],
            ['manhattan', 'Adrian. The tachyons were yours.'],
            ['veidt', 'Of course. You see everything, so I gave you nothing to see. Forgive me. And forgive this.'],
          ]);
          W.overlays.push(beamOverlay(ctx));
          for (let k = 0; k <= 1; k += 0.04) {
            R.sub.data.charge = k;
            yield ctx.wait(0.03);
          }
          DM.Audio.play('zap');
          DM.Audio.play('flash');
          for (let k = 0; k <= 1; k += 0.1) {
            ctx.flags.beam = k;
            yield ctx.wait(0.02);
          }
          W.camera.shake(0.8);
          yield ctx.wait(0.8);
          ctx.flash('#ffffff', 1.6);
          W.particles.burst(P.x, P.y, 200, { color: ['#7fe3ff', '#5fd4ff', '#ffffff', '#c06bff'], speed: [80, 520], life: [0.6, 1.8], size: [1.5, 4], drag: 1.4 });
          ctx.flags.beam = 0;
          R.sub.data.charge = 0.2;
          P.hidden = true;
          yield ctx.wait(1.8);
          yield ctx.dialog([['veidt', "...It's done. I am sorry, Jon. Truly."]]);
          ctx.cinematic(false);
          ctx.focus(null);
          P.hidden = false;
          yield* reassemble(ctx);
          yield ctx.wait(0.6);
          W.particles.burst(SUB.x, SUB.y, 90, { color: ['#d4ad3a', '#6f4aa6', '#2a2440', '#c06bff'], speed: [40, 300], life: [0.5, 1.4], size: [2, 5], add: false });
          R.sub.dead = true;
          DM.Audio.play('disintegrate');
          yield ctx.dialog([
            ['manhattan', 'I am disappointed in you, Adrian. Reassembling myself was the first thing I ever learned.'],
            ['veidt', "...Then I'll simply have to be faster than you, won't I?"],
          ]);
        },
        restore(ctx) {
          if (ctx.refs.sub) ctx.refs.sub.dead = true;
        },
      },
      {
        id: 'veidt',
        checkpoint: true,
        run: function* (ctx) {
          const R = ctx.refs, P = ctx.player, W = ctx.world;
          if (ctx.startedHere) ctx.place(2050, 1000, 0);
          P.targetScale = 1;
          W.camera.targetZoom = W.baseZoom;
          const n = R.veidtNpc;
          const v = ctx.add(new Veidt({ x: n.x, y: n.y, facing: Math.PI }));
          n.dead = true;
          W.boss = v;
          ctx.lock(false);
          ctx.objective('Stop Adrian Veidt');
          ctx.hint('He is fast enough to dodge you. Slow time, pin him with copies, or catch him and throw him.', 10);
          yield ctx.until(() => v.yielded);
          ctx.clearHostiles();
          W.boss = null;
          ctx.objectiveDone();
          ctx.lock(true);
          for (const e of W.entities) if (e instanceof Drone) e.disintegrate(W);
          yield ctx.wait(1.2);
          yield ctx.dialog([
            ['veidt', "Enough. Enough! Jon, listen to me. It's already done. New York. Thirty-five minutes ago."],
            ['veidt', 'Half a city, so the rest of the world would stop pointing missiles at itself. Look at the broadcasts. They are shaking hands.'],
            ['manhattan', '...'],
            ['veidt', 'I did the right thing, didn\'t I? Tell me it all works out, in the end.'],
            ['manhattan', 'There is no end, Adrian. There is only the next moment.'],
          ]);
        },
      },
    ],
  });
})();
