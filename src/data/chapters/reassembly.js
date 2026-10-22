/*
 * CHAPTER I — Reassembly. Gila Flats, 1959–1960.
 * Jon is a single point of awareness. Gather scattered atoms, bring them back
 * to the chamber, and rebuild a body one system at a time.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const { Atom, Vortex, BodyForm } = DM.Special;
  const C = { x: 1200, y: 1200 };

  const LAYERS = [
    { name: 'nervous system', quota: 30, carry: 20, pull: 85, vortices: 1, text: 'November 10th, 1959. A nervous system flickers in the test chamber for eleven seconds, then is gone. The guards are told it was a malfunction.' },
    { name: 'circulatory system', quota: 40, carry: 25, pull: 100, vortices: 2, text: 'December 1959. A circulatory system, beating around nothing. Somebody screams. They hang curtains over the observation window.' },
    { name: 'skeleton', quota: 45, carry: 30, pull: 115, vortices: 3, text: 'February 1960. A skeleton, partly muscled, takes two steps and falls apart. I am learning.' },
    { name: 'musculature', quota: 55, carry: 35, pull: 130, vortices: 4, text: 'March 1960. I have remembered everything but my skin. I decide on something simpler.' },
  ];

  function bakeVoid(g) {
    const rnd = U.seeded(1960);
    g.fillStyle = '#03050a';
    g.fillRect(0, 0, 2400, 2400);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * 2400, y = rnd() * 2400, r = 100 + rnd() * 320;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(30,60,130,${0.05 + rnd() * 0.07})`);
      gr.addColorStop(1, 'rgba(30,60,130,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(200,230,255,${rnd() * 0.55})`;
      const s = rnd() * 1.8;
      g.fillRect(rnd() * 2400, rnd() * 2400, s, s);
    }
    g.strokeStyle = 'rgba(127,227,255,0.07)';
    g.lineWidth = 2;
    for (let k = -620; k <= 620; k += 62) {
      Gfx.line(g, C.x + k, C.y - 620, C.x + k, C.y + 620);
      Gfx.line(g, C.x - 620, C.y + k, C.x + 620, C.y + k);
    }
    for (const r of [300, 230]) {
      g.strokeStyle = 'rgba(127,227,255,0.1)';
      g.lineWidth = 8;
      Gfx.circle(g, C.x, C.y, r);
      g.stroke();
    }
  }

  function spawnCluster(W) {
    const a = U.rand(0, Math.PI * 2), d = U.rand(380, 1050);
    const cx = U.clamp(C.x + Math.cos(a) * d, 80, W.w - 80), cy = U.clamp(C.y + Math.sin(a) * d, 80, W.h - 80);
    const n = U.randInt(5, 9);
    for (let i = 0; i < n; i++) W.add(new Atom(cx + U.rand(-55, 55), cy + U.rand(-55, 55)));
  }

  function buildVoid(ctx) {
    const W = ctx.newWorld({ w: 2400, h: 2400, bg: '#03050a', zoom: 1.05 });
    W.bake(bakeVoid);
    W.spawn = { x: C.x, y: C.y + 260, facing: -Math.PI / 2 };
    const body = W.add(new BodyForm(C.x, C.y, { H: 260, depositR: 130 }));
    body.bank = 0;
    body.quota = 1;
    body.layerIndex = 0;
    ctx.refs = { body };
    for (let i = 0; i < 18; i++) spawnCluster(W);
    return W;
  }

  // Move atoms from Jon into the body while he is inside the chamber ring.
  function* depositLoop(ctx) {
    const body = ctx.refs.body;
    while (!ctx.flags.reassembled) {
      const P = ctx.player, W = ctx.world;
      if (P.form === 'awareness' && P.carry > 0 && !P.locked && U.dist(P.x, P.y, body.x, body.y) < body.depositR && body.bank < body.quota) {
        P.carry--;
        body.bank++;
        body.pulse = 0.35;
        body.layers[body.layerIndex] = Math.min(0.999, body.bank / body.quota);
        W.particles.emit(P.x, P.y, { vx: (body.x - P.x) * 2.4, vy: (body.y - 40 - P.y) * 2.4, life: 0.42, size: 3, size1: 1, color: '#bff1ff', drag: 0 });
        DM.Audio.play('deposit');
        yield ctx.wait(0.04);
      } else yield;
    }
  }

  function* spawner(ctx) {
    while (!ctx.flags.reassembled) {
      const W = ctx.world;
      let n = 0;
      for (const e of W.entities) if (e instanceof Atom) n++;
      if (n < 130) spawnCluster(W);
      yield ctx.wait(0.35);
    }
  }

  DM.Chapters.register({
    id: 'reassembly',
    numeral: 'CHAPTER I',
    title: 'Reassembly',
    date: 'November 1959',
    place: 'Gila Flats, Arizona',
    clock: 10,
    color: '#1b4f8a',
    music: 'void',
    introMusic: 'void',
    form: 'awareness',
    epigraph: { text: 'Nothing is lost, nothing is created, everything is transformed.', by: 'Antoine Lavoisier' },
    intro: [
      'There is no body to bury. They hold a funeral anyway. Wally helps carry an empty coffin.',
      'But a pattern does not stop being a pattern because it has been scattered. I am still here, in pieces, spread through the chamber.',
      'Slowly, I begin to remember what shape I used to be.',
    ],
    maps: { void: buildVoid },
    stages: [
      {
        id: 'gather',
        map: 'void',
        grants: ['coalesce'],
        run: function* (ctx) {
          const P = ctx.player, body = ctx.refs.body;
          ctx.setForm('awareness');
          ctx.lock(true);
          ctx.focus(C.x, C.y);
          yield ctx.wait(1.2);
          yield ctx.narrate('Nothing. And then less than nothing: a pattern, scattered across the chamber, remembering its own shape.');
          yield ctx.unlock('coalesce');
          ctx.focus(null);
          ctx.lock(false);
          ctx.hint('Drift near your atoms to gather them. Hold LEFT CLICK to widen your pull.', 9);
          ctx.fork(depositLoop);
          ctx.fork(spawner);
          ctx.fork(function* () {
            yield ctx.until(() => P.carry >= P.carryMax);
            ctx.hint('You cannot hold any more. Return to the chamber at the centre to rebuild yourself.', 8);
            ctx.marker(C.x, C.y + 130, 'CHAMBER');
            yield ctx.until(() => body.bank > 0);
            ctx.marker(null);
          });
          let warned = false;
          ctx.on('vortex:hit', () => {
            if (warned) return;
            warned = true;
            ctx.hint('Entropy. It tears loose whatever you are carrying. Keep clear of the dark.', 7);
          });

          for (let i = 0; i < LAYERS.length; i++) {
            const L = LAYERS[i];
            P.carryMax = L.carry;
            P.basePull = L.pull;
            body.layerIndex = i;
            body.bank = 0;
            body.quota = L.quota;
            let v = ctx.world.entities.filter((e) => e instanceof Vortex).length;
            for (; v < L.vortices; v++) {
              const a = U.rand(0, Math.PI * 2);
              ctx.add(new Vortex(C.x + Math.cos(a) * 750, C.y + Math.sin(a) * 750, { home: { x: C.x, y: C.y, r: 260 }, speed: 40 + i * 8 }));
            }
            ctx.objective(`Rebuild your ${L.name}`, () => `${body.bank}/${L.quota}`);
            yield ctx.until(() => body.bank >= L.quota);
            body.layers[i] = 1;
            ctx.objectiveDone();
            DM.Audio.play('layer');
            ctx.flash('#bff1ff', 0.6);
            ctx.world.camera.shake(0.25);
            ctx.narrate(L.text, { dur: 7 });
            yield ctx.wait(1.5);
          }

          ctx.flags.reassembled = true;
          ctx.lock(true);
          ctx.objective(null);
          const W = ctx.world;
          for (const e of W.entities) {
            if (e instanceof Vortex || e instanceof Atom) {
              W.particles.burst(e.x, e.y, 6, { color: ['#7fe3ff', '#ffffff'], speed: [20, 90], life: [0.3, 0.7], size: [1.5, 3] });
              e.dead = true;
            }
          }
          ctx.focus(body.x, body.y);
          const sx = P.x, sy = P.y;
          for (let k = 0; k < 1; k += 1 / 70) {
            const e = U.ease.inOutCubic(k);
            P.x = U.lerp(sx, body.x, e);
            P.y = U.lerp(sy, body.y - 60, e);
            yield;
          }
          P.hidden = true;
          DM.Audio.play('unlock');
          for (let k = 0; k <= 1; k += 0.025) {
            body.skin = k;
            yield ctx.wait(0.03);
          }
          ctx.flash('#dff7ff', 1.6);
          W.camera.shake(0.5);
          ctx.setForm('manhattan');
          body.dead = true;
          P.hidden = false;
          P.x = body.x;
          P.y = body.y;
          P.facing = Math.PI / 2;
          W.particles.burst(P.x, P.y, 120, { color: ['#7fe3ff', '#ffffff', '#5fd4ff'], speed: [80, 420], life: [0.5, 1.4], size: [1.5, 3.5], drag: 2 });
          yield ctx.wait(1.4);
          yield ctx.narrate('April 1960. I walk out of the test chamber.', { dur: 3.5 });
          yield ctx.banner('DR. MANHATTAN', 'GILA FLATS · APRIL 1960', { dur: 3.6 });
        },
        restore(ctx) {
          ctx.flags.reassembled = true;
          ctx.setForm('manhattan');
          ctx.player.hidden = false;
          if (ctx.refs.body) ctx.refs.body.dead = true;
          for (const e of ctx.world.entities) if (e instanceof Vortex || e instanceof Atom) e.dead = true;
        },
      },
      {
        id: 'naming',
        run: function* (ctx) {
          ctx.lock(true);
          ctx.focus(null);
          yield ctx.wait(0.5);
          yield ctx.dialog([
            ['colonel', "Doctor... Osterman? Colonel Hart, Army liaison. The President's people asked me to tell you they've chosen a name for you."],
            ['colonel', "'Doctor Manhattan.' It's meant to make certain people in Moscow very nervous."],
            ['manhattan', 'Manhattan. After the bomb.'],
            ['colonel', "After what it stands for. We had a symbol drawn up, too. An atom, with the little orbits—"],
            ['manhattan', 'No. If I am to wear a symbol, it will be one I respect.'],
            ['manhattan', 'Hydrogen. One proton, one electron. The simplest thing there is.'],
          ]);
          yield ctx.narrate('I draw it on my forehead myself. It is the last decision I make for a long time that feels like mine.', { dur: 5.5 });
        },
      },
    ],
  });
})();
