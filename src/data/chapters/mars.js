/*
 * CHAPTER IV — The Watchmaker. A television studio, then Mars, 1985.
 * Leave Earth, unlock Temporal Sight and Expand, build the glass palace,
 * and find the memories hidden in time.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;
  const { Prop } = DM.Props;
  const { Shard, Palace, Memory, Meteor } = DM.Special;
  const NPC = DM.NPC;
  const C = { x: 1200, y: 1200 };

  // ---- studio --------------------------------------------------------------------
  const STUDIO_WALLS = {
    wall: { top: '#2a2633', face: '#1c1924', edge: '#0d0b12' },
    seat: { top: '#5a2a3a', face: '#3e1d28', edge: '#1e0e14', low: true },
    desk: { top: '#2e3b5a', face: '#1f2840', edge: '#0e1320', low: true },
  };
  function bakeStudio(g) {
    g.fillStyle = '#1d1a24';
    g.fillRect(0, 0, 1400, 900);
    const gr = g.createRadialGradient(700, 330, 40, 700, 330, 420);
    gr.addColorStop(0, 'rgba(120,140,200,0.18)');
    gr.addColorStop(1, 'rgba(120,140,200,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1400, 900);
    g.fillStyle = '#2e2a3a';
    Gfx.rr(g, 440, 210, 520, 270, 30);
    g.fill();
    g.strokeStyle = '#7fa0e0';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.font = '700 46px Oswald, Arial Narrow, sans-serif';
    g.textAlign = 'center';
    g.fillText('NOVA EXPRESS', 700, 140);
    g.textAlign = 'left';
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(100 + i * 40, 880);
      g.bezierCurveTo(300 + i * 30, 700, 400, 650 - i * 10, 520, 560);
      g.stroke();
    }
  }
  function buildStudio(ctx) {
    const W = ctx.newWorld({ w: 1400, h: 900, bg: '#121018', wallStyles: STUDIO_WALLS, zoom: 1.35 });
    W.bake(bakeStudio);
    W.spawn = { x: 700, y: 400, facing: Math.PI / 2 };
    W.room(0, 0, 1400, 900, { t: 24 });
    W.wall(620, 240, 160, 40, 'desk');
    for (const y of [640, 710, 780]) {
      W.wall(180, y, 470, 26, 'seat');
      W.wall(750, y, 470, 26, 'seat');
    }
    const R = (ctx.refs = {});
    R.host = ctx.add(new NPC({ x: 700, y: 310, look: 'host', facing: Math.PI / 2 }));
    R.press = [
      [560, 520, 'reporter'], [840, 520, 'reporter2'], [700, 570, 'reporter'], [470, 440, 'reporter2'], [930, 440, 'reporter'],
    ].map(([x, y, look]) => ctx.add(new NPC({ x, y, look, facing: U.angleTo(x, y, 700, 400), lookAtPlayer: true, speed: 70 })));
    const cams = [[500, 600], [900, 600], [340, 360], [1060, 360]];
    W.overlays.push((g, world) => {
      const t = world.realTime || 0;
      for (const [x, y] of cams) {
        g.fillStyle = '#111';
        g.fillRect(x - 14, y - 10, 28, 20);
        g.fillStyle = '#333';
        g.fillRect(x - 6, y - 18, 12, 10);
        Gfx.glow(g, x, y - 14, 8, '#ff3a2a', Math.sin(t * 4 + x) > 0 ? 0.9 : 0.3);
      }
      for (let i = 0; i < 5; i++) Gfx.glow(g, 300 + i * 200, 40, 120, '#fff2d0', 0.12);
    });
    return W;
  }

  // ---- Mars ------------------------------------------------------------------------
  const MARS_WALLS = {
    rock: {
      draw: (g, w) => {
        g.fillStyle = '#5a2412';
        Gfx.rr(g, w.x, w.y, w.w, w.h, Math.min(w.w, w.h) * 0.45);
        g.fill();
        g.fillStyle = 'rgba(230,140,90,0.25)';
        Gfx.rr(g, w.x + 6, w.y + 4, w.w * 0.6, w.h * 0.4, Math.min(w.w, w.h) * 0.2);
        g.fill();
      },
    },
  };
  const ROCKS = [[500, 500, 120, 90], [1800, 400, 90, 140], [400, 1700, 160, 80], [1900, 1800, 100, 100], [1100, 300, 140, 60], [300, 1100, 70, 150], [2000, 1150, 80, 120], [1450, 2050, 120, 70]];
  const MEMORIES = [
    { x: 500, y: 900, year: 1945, text: 'My father throws his watch parts out of the window. They fall into the street like seeds. The future belongs to physics, he says.' },
    { x: 1900, y: 700, year: 1959, text: "Janey's watch, in pieces on my bench. Everything goes back together, if you understand it well enough. Almost everything." },
    { x: 820, y: 1900, year: 1963, text: 'A motel room in Arizona. Janey is getting older. I am not. We both pretend not to have noticed.' },
    { x: 1700, y: 1850, year: 1966, text: 'A room full of masked people who want to save the world. I am the only one who does not need a mask.' },
    { x: 2080, y: 1350, year: 1970, text: 'Laurie, sixteen, laughing at something I said. Janey sees me watching her, and understands before I do.' },
    { x: 1000, y: 520, year: 1977, text: 'Wally Weaver is buried. I stand at the graveside. I cannot tell if I am sad, or only remembering being sad.' },
  ];

  function bakeMars(g) {
    const rnd = U.seeded(1985);
    const gr = g.createRadialGradient(C.x, C.y, 100, C.x, C.y, 1700);
    gr.addColorStop(0, '#b9582f');
    gr.addColorStop(1, '#7e3219');
    g.fillStyle = gr;
    g.fillRect(0, 0, 2400, 2400);
    for (let i = 0; i < 14000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(60,20,8,0.12)' : 'rgba(255,200,150,0.07)';
      g.fillRect(rnd() * 2400, rnd() * 2400, 3, 3);
    }
    g.strokeStyle = 'rgba(255,190,140,0.12)';
    g.lineWidth = 6;
    for (let i = 0; i < 22; i++) {
      const y = rnd() * 2400;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(800, y + rnd() * 160 - 80, 1600, y + rnd() * 160 - 80, 2400, y + rnd() * 100 - 50);
      g.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 2400, y = rnd() * 2400, r = 30 + rnd() * 110;
      if (U.dist(x, y, C.x, C.y) < 420) continue;
      g.fillStyle = 'rgba(80,25,10,0.4)';
      Gfx.ellipse(g, x, y, r, r * 0.85);
      g.fill();
      g.strokeStyle = 'rgba(240,150,100,0.35)';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.85, 0, Math.PI * 1.1, Math.PI * 2.1);
      g.stroke();
    }
  }

  function freeSpot(W, rMin, rMax, rad) {
    for (let i = 0; i < 60; i++) {
      const a = U.rand(0, Math.PI * 2), d = U.rand(rMin, rMax);
      const x = C.x + Math.cos(a) * d, y = C.y + Math.sin(a) * d;
      if (W.isFree(x, y, rad + 10)) return { x, y };
    }
    return { x: C.x + rMax, y: C.y };
  }

  function buildMars(ctx) {
    const W = ctx.newWorld({ w: 2400, h: 2400, bg: '#6e2c16', wallStyles: MARS_WALLS, zoom: 1.1 });
    W.bake(bakeMars);
    W.spawn = { x: C.x, y: C.y + 380, facing: -Math.PI / 2 };
    for (const [x, y, w, h] of ROCKS) W.wall(x, y, w, h, 'rock');
    const palace = W.add(new Palace(C.x, C.y));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      palace.addSlot(W, C.x + Math.cos(a) * 230, C.y + Math.sin(a) * 230, false);
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      palace.addSlot(W, C.x + Math.cos(a) * 110, C.y + Math.sin(a) * 110, true);
    }
    for (let i = 0; i < 15; i++) {
      const p = freeSpot(W, 430, 1050, 14);
      W.add(new Shard(p.x, p.y, false));
    }
    for (let i = 0; i < 4; i++) {
      const p = freeSpot(W, 520, 880, 30);
      W.add(new Shard(p.x, p.y, true));
    }
    // Memories already found this run (carried by Retry/Continue) stay found.
    const found = ctx.foundMemories || [];
    for (const m of MEMORIES) if (!found.includes(m.year)) W.add(new Memory(m.x, m.y, m));
    W.overlays.push((g, world) => {
      const t = world.realTime || 0;
      const v = world.camera.view();
      g.save();
      g.globalAlpha = 0.18;
      g.strokeStyle = '#f0b080';
      g.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const x = v.x0 + ((i * 197 + t * 140) % (v.x1 - v.x0 + 200)) - 100;
        const y = v.y0 + ((i * 113 + t * 20) % (v.y1 - v.y0));
        Gfx.line(g, x, y, x + 50, y + 6);
      }
      g.restore();
    });
    ctx.refs = { palace };
    return W;
  }

  function* meteorShower(ctx) {
    while (!ctx.flags.palaceDone) {
      yield ctx.wait(U.rand(3.2, 5.2));
      if (ctx.flags.palaceDone || ctx.locked) continue;
      const P = ctx.player;
      let x = P.x + U.rand(-260, 260), y = P.y + U.rand(-260, 260);
      if (U.chance(0.35)) {
        x = P.x + P.vx * 1.6;
        y = P.y + P.vy * 1.6;
      }
      x = U.clamp(x, 80, 2320);
      y = U.clamp(y, 80, 2320);
      if (U.dist(x, y, C.x, C.y) < 160) continue;
      ctx.add(new Meteor(x, y, { T: 2.6, radius: 70, dmg: 14 }));
    }
  }

  function fillSlots(ctx, big) {
    const W = ctx.world;
    const palace = ctx.refs.palace;
    const shards = W.entities.filter((e) => e instanceof Shard && e.big === big && !e.placed);
    for (const s of palace.slots) {
      if (s.big !== big || s.filled) continue;
      const sh = shards.pop();
      if (sh) s.fill(sh, null);
    }
  }

  DM.Chapters.register({
    id: 'mars',
    numeral: 'CHAPTER IV',
    title: 'The Watchmaker',
    date: 'October 1985',
    place: 'New York · Mars',
    clock: 3,
    color: '#a8432a',
    music: 'mars',
    form: 'manhattan',
    epigraph: { text: 'The distinction between past, present and future is only a stubbornly persistent illusion.', by: 'Albert Einstein' },
    intro: [
      'October 1985. A television studio in New York. The interviewer smiles at me as if we are friends.',
      'Then the questions start: about Wally, about Janey, about the cancers carried by the people who have stood closest to me.',
      'There are too many voices. There is too much light. I go somewhere quiet.',
    ],
    maps: { studio: buildStudio, mars: buildMars },
    stages: [
      {
        id: 'studio',
        map: 'studio',
        run: function* (ctx) {
          const P = ctx.player, R = ctx.refs, W = ctx.world;
          ctx.music('tension');
          ctx.lock(true);
          ctx.cinematic(true);
          yield ctx.wait(0.6);
          yield ctx.dialog([
            ['host', "...and we're back. Doctor Manhattan, thank you for joining us, live."],
            ['reporter', 'Doctor! Wally Weaver died of cancer in 1977. Your friend. Is it true he worked beside you every day?'],
            ['reporter2', 'Janey Slater has cancer too. She says you gave it to her. Is that true?'],
            ['reporter', 'How many others, Doctor? How many people have you hurt just by standing next to them?'],
            ['manhattan', 'Please. Stop.'],
            ['reporter2', "Is that a no, Doctor? Doctor! Look this way!"],
          ]);
          ctx.cinematic(false);
          const barks = ['Doctor!', 'Is it true?', 'Look this way!', 'Did you know?', 'Doctor Manhattan!', 'Answer the question!'];
          ctx.fork(function* () {
            while (!ctx.flags.left) {
              for (const r of R.press) {
                r.walkTo(P.x + U.rand(-70, 70), P.y + U.rand(-70, 70));
                if (U.chance(0.3)) W.bark(r, U.pick(barks), 1.2);
              }
              if (U.chance(0.6)) {
                ctx.flash('#ffffff', 0.25, { strobe: true });
                DM.Audio.play('tick');
              }
              yield ctx.wait(0.8);
            }
          });
          ctx.lock(false);
          const before = P.teleportedAt;
          ctx.objective('Leave');
          ctx.tutorial('Aim somewhere far away, then press SPACE to teleport.', 99);
          yield ctx.until(() => P.teleportedAt !== before);
          ctx.flags.left = true;
          ctx.hint(null);
          ctx.objective(null);
          ctx.lock(true);
          ctx.flash('#ffffff', 1.2);
          DM.Audio.play('teleport');
          yield ctx.wait(0.5);
        },
      },
      {
        id: 'palace',
        map: 'mars',
        checkpoint: true,
        grants: ['timesight'],
        run: function* (ctx) {
          const palace = ctx.refs.palace;
          ctx.music('mars');
          ctx.lock(true);
          yield ctx.wait(1);
          yield ctx.narrate('Mars. It is quiet here. Nobody is asking me anything.', { dur: 4 });
          yield ctx.narrate('I have begun to see time the way I see space: all of it at once, laid out in front of me.', { dur: 5 });
          yield ctx.unlock('timesight');
          ctx.lock(false);
          ctx.objective('Build the palace', () => `${palace.count(false)}/${palace.total(false)}`);
          ctx.hint('Lift crystals into the glowing slots. Meteors fall here: Temporal Sight shows you where.', 9);
          ctx.fork(meteorShower);
          ctx.fork(function* () {
            yield ctx.wait(30);
            if (ctx.stats.memories === 0) ctx.hint('Hold F somewhere quiet. There are moments hidden here, out of the corner of time.', 8);
          });
          yield ctx.until(() => palace.count(false) >= palace.total(false));
          ctx.objectiveDone();
        },
        restore(ctx) {
          fillSlots(ctx, false);
        },
      },
      {
        id: 'great',
        checkpoint: true,
        grants: ['expand'],
        run: function* (ctx) {
          const palace = ctx.refs.palace;
          if (ctx.startedHere) ctx.fork(meteorShower);
          ctx.lock(true);
          yield ctx.wait(0.8);
          yield ctx.narrate('The great crystals are too heavy to lift. For a man my size.', { dur: 4 });
          yield ctx.unlock('expand');
          ctx.lock(false);
          ctx.objective('Set the great crystals', () => `${palace.count(true)}/${palace.total(true)}`);
          ctx.hint('Press G to grow, then lift a great crystal into the centre before you shrink back.', 9);
          yield ctx.until(() => palace.count(true) >= palace.total(true));
          ctx.objectiveDone();
        },
        restore(ctx) {
          fillSlots(ctx, true);
        },
      },
      {
        id: 'laurie',
        run: function* (ctx) {
          const P = ctx.player, W = ctx.world, palace = ctx.refs.palace;
          ctx.flags.palaceDone = true;
          ctx.lock(true);
          ctx.focus(palace.x, palace.y);
          palace.risingT = 3;
          DM.Audio.play('unlock');
          W.camera.shake(0.4);
          yield ctx.wait(3.4);
          ctx.focus(null);
          const lx = U.clamp(P.x + 90, 60, W.w - 60), ly = P.y;
          W.particles.burst(lx, ly, 40, { color: ['#7fe3ff', '#ffffff'], speed: [40, 200], life: [0.3, 0.8], size: [1.5, 3] });
          DM.Audio.play('teleport');
          ctx.add(new NPC({ x: lx, y: ly, look: 'laurie', facing: Math.PI }));
          yield ctx.wait(0.8);
          yield ctx.dialog([
            ['laurie', "Jon. ...It's beautiful. It's also the loneliest thing I've ever seen."],
            ['laurie', "The world's about to end. You have to come back. You're the only one who can stop it."],
            ['manhattan', 'Why? Life on Earth is no more remarkable than the silence here.'],
            ['laurie', 'Then look at me. One person. Is that so unremarkable?'],
            ['manhattan', 'Thermodynamic miracles. Events so unlikely they are effectively impossible, like oxygen spontaneously becoming gold.'],
            ['manhattan', 'Every human life is one. I had forgotten. We will go back.'],
          ]);
        },
      },
    ],
  });
})();
