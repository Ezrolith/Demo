/*
 * Atmosphere: how each map looks beyond its floor plan, keyed by map id
 * (world.mapId, set by ChapterContext.loadMap), so chapter files stay untouched.
 *
 *   shadow   colour multiplied under walls for their cast shadows
 *   light    darkness and lights (src/core/lighting.js); no ambient = daylight, free
 *   weather  ambient motion layers (src/core/weather.js)
 *   walls    wall kind -> { pattern, height, top, lit, dark } (surfaces in world.js);
 *            height scales the cast shadow (1 = DM.LIGHT_DIR, low walls 0.5)
 *
 * Positions below repeat a few things the chapter maps place (lamps, rooms, the
 * generator); they are presentation only, so a mismatch just looks odd.
 * Add a map: DM.Atmosphere.register('mymap', { light: {...}, weather: [...] }).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;

  const reduced = () => !!(DM.SettingsSchema && DM.SettingsSchema.reducedFlashing());

  // Per-world scratch state for profiles (ramps, flashbulbs, cached entity refs).
  const scratch = (world) => world.atmo || (world.atmo = {});
  // A 0..1 value easing toward `on` at `rate` per second, in real time.
  function ramp(world, key, on, rate) {
    const s = scratch(world);
    const rt = world.realTime || 0;
    const r = s[key] || (s[key] = { v: 0, t: rt });
    r.v = U.approach(r.v, on ? 1 : 0, U.clamp(rt - r.t, 0, 0.1) * rate);
    r.t = rt;
    return r.v;
  }
  // The first live entity matching pred, remembered until it dies.
  function find(world, key, pred) {
    const s = scratch(world);
    const e = s[key];
    if (e && !e.dead && world.entities.includes(e)) return e;
    return (s[key] = world.entities.find((x) => !x.dead && pred(x)) || null);
  }
  function all(world, key, pred) {
    const s = scratch(world);
    if (!s[key] || s[key + 'N'] !== world.entities.length) {
      s[key] = world.entities.filter(pred);
      s[key + 'N'] = world.entities.length;
    }
    return s[key];
  }

  // ---- Pier 9 (superman.js buildPier) --------------------------------------------
  const PIER_LAMPS = [[200, 300], [200, 820], [900, 1120], [1420, 1060], [620, 560]];
  const WAREHOUSE = { x: 1000, y: 150, w: 1100, h: 750 };
  const WAREHOUSE_BULBS = [[1190, 250], [1380, 580], [1620, 330], [1600, 770], [1860, 700], [1900, 330]];
  let pierPuddles = null;
  // The puddles bakePier scatters, found by replaying its seeded generator.
  function puddles() {
    if (pierPuddles) return pierPuddles;
    const rnd = U.seeded(1966);
    for (let i = 0; i < 9000; i++) {
      rnd();
      rnd();
      rnd();
    }
    pierPuddles = [];
    for (let i = 0; i < 14; i++) {
      const x = rnd() * 2000, y = rnd() * 1100, rx = 30 + rnd() * 70;
      pierPuddles.push({ x, y, rx });
    }
    return pierPuddles;
  }

  // ---- Gila Flats (prologue.js buildGila) ------------------------------------------
  const GEN = { x: 1426, y: 520 };
  const BEACONS = [[1136, 44, 0], [1716, 996, Math.PI / 2], [560, 510, Math.PI]];
  const GILA_ROOMS = [[320, 230], [850, 250], [300, 800], [840, 800], [560, 510]];

  // ---- Studio (mars.js buildStudio) --------------------------------------------------
  const DESK = { x: 700, y: 300 };
  const SPOTS = [[430, 110], [700, 70], [970, 110]];

  // ---- Karnak (karnak.js buildKarnak) ------------------------------------------------
  const COURT = { x: 1300, y: 160, w: 1300, h: 1680 };
  const SANCTUM = { x: 1900, y: 500, w: 676, h: 1000 };
  const SUB = { x: 2470, y: 1000 };
  const TORCHES = [];
  for (let y = 580; y < 1460; y += 160) TORCHES.push([1938, y], [2538, y]);
  const BRAZIERS = [];
  for (let x = 1450; x < 1850; x += 260) for (const y of [300, 700, 1300, 1700]) BRAZIERS.push([x + 20, y + 20]);

  const DUST_WALLS = {
    sandbag: { pattern: 'sandbag', height: 0.5 },
    concrete: { pattern: 'concrete', height: 1.2 },
    rock: { pattern: 'rock', height: 1.1 },
  };

  const profiles = {
    // Prologue lab. Daylight until the lockdown alarm: then the room lights drop,
    // red beacons sweep the walls and the generator's glow builds.
    gila: {
      shadow: 'rgba(60,45,30,0.32)',
      light: {
        player: 0,
        ambient(world) {
          const k = ramp(world, 'alarm', world.alarm, 1.6);
          return k > 0.01 ? `rgba(30,4,8,${(0.74 * k).toFixed(3)})` : null;
        },
        lights(world, add, t) {
          const k = scratch(world).alarm ? scratch(world).alarm.v : 0;
          // Emergency lighting: dim pools in each room.
          for (const [x, y] of GILA_ROOMS) add(x, y, 300, { i: 0.42 * k });
          // Rotating beacons. They sweep rather than blink; REDUCED flashing slows them right down.
          const spin = reduced() ? 0.6 : 2.6;
          for (const [x, y, ph] of BEACONS) {
            const a = t * spin + ph;
            add(x, y, 640, { i: 0.95 * k, cone: a, spread: 0.34, color: '#ff2a1a', k: 0.62 * k });
            add(x, y, 640, { i: 0.95 * k, cone: a + Math.PI, spread: 0.34, color: '#ff2a1a', k: 0.62 * k });
            add(x, y, 50, { i: k, color: '#ff4a30', k: 0.6 * k });
          }
          const gen = find(world, 'gen', (e) => e.data && e.data.power != null && Math.abs(e.x - GEN.x) < 4 && Math.abs(e.y - GEN.y) < 4);
          const pw = gen ? Math.min(1.6, gen.data.power) : 0;
          add(GEN.x, GEN.y, 220 + pw * 320, { i: 0.65 + pw * 0.3, color: '#5fd4ff', k: 0.12 + pw * 0.3 });
          const p = world.player;
          if (p && !p.hidden) add(p.x, p.y, 110, { i: 0.4 * k }); // enough to keep Jon readable
        },
      },
      weather: [{ type: 'haze', n: 60, alpha: 0.045, color: '#fff0d0' }],
    },

    // Chapter I. Jon is the only light; every atom is a spark.
    void: {
      light: {
        ambient: 'rgba(0,2,10,0.74)',
        player: 1.3,
        lights(world, add) {
          const b = find(world, 'body', (e) => e.depositR != null && e.layers);
          if (b) add(b.x, b.y, 320, { i: 0.5, color: '#5fd4ff', k: 0.08 });
        },
      },
      weather: [{ type: 'stars', n: 160 }],
    },

    // Chapter II, Nevada: desert daylight, drifting dust.
    range: {
      shadow: 'rgba(120,70,30,0.4)',
      weather: [{ type: 'dust', color: '#f0dcb0', devilColor: '#d8b880', wind: 50 }],
      walls: { sandbag: DUST_WALLS.sandbag, concrete: DUST_WALLS.concrete },
    },

    // Chapter II, New York at night: sodium lamps, headlights, drizzle, and a
    // darker warehouse lit by a few bare bulbs.
    pier: {
      shadow: 'rgba(16,16,40,0.55)',
      light: {
        ambient: 'rgba(10,10,34,0.76)',
        zones: [{ x: WAREHOUSE.x, y: WAREHOUSE.y, w: WAREHOUSE.w, h: WAREHOUSE.h, ambient: 'rgba(5,5,14,0.82)' }],
        lights(world, add) {
          for (const [x, y] of PIER_LAMPS) add(x, y, 260, { color: '#ffbf60', k: 0.24, flicker: true });
          for (const [x, y] of WAREHOUSE_BULBS) add(x, y, 210, { i: 0.88, color: '#ffd9a0', k: 0.12, flicker: true });
          add(1425, 905, 190, { i: 0.75, color: '#ffd27a', k: 0.1 }); // spill from the loading door
          add(1000, 460, 130, { i: 0.55, color: '#ffd27a', k: 0.06 });
          const V = DM.Props && DM.Props.Vehicle;
          for (const v of all(world, 'sedans', (e) => V && e instanceof V && e.kind === 'sedan')) {
            if (v.dead || v.burnt || v.heldBy) continue;
            const c = Math.cos(v.rot), s = Math.sin(v.rot), f = v.r * 1.2;
            for (const side of [-1, 1]) {
              const hx = v.x + c * f - s * side * v.r * 0.42, hy = v.y + s * f + c * side * v.r * 0.42;
              add(hx, hy, 300, { i: 0.8, cone: v.rot, spread: 0.26, color: '#fff4d0', k: 0.05 });
            }
          }
        },
      },
      weather: [
        { type: 'drizzle', exclude: [WAREHOUSE], get puddles() { return puddles(); } },
        { type: 'haze', only: WAREHOUSE, n: 70, alpha: 0.06, shaftsAt: [0.3, 0.65] },
      ],
      walls: {
        brick: { pattern: 'brick', height: 1.2 },
        rust: { pattern: 'ribbed', height: 1.4 },
        navy: { pattern: 'ribbed', height: 1.4 },
        moss: { pattern: 'ribbed', height: 1.4 },
        shelf: { pattern: 'shelf', height: 1.1 },
      },
    },

    // Chapter III: the proving ground. Dust, dust devils and broken rock.
    proving: {
      shadow: 'rgba(120,70,30,0.42)',
      weather: [{ type: 'dust', color: '#f0d8a8', devilColor: '#c8a070', wind: 70 }],
      walls: DUST_WALLS,
    },

    // Chapter IV: a television studio, dark except for the stage and the flashbulbs.
    studio: {
      shadow: 'rgba(10,0,24,0.45)',
      light: {
        ambient: 'rgba(12,8,26,0.66)',
        lights(world, add, t) {
          for (const [x, y] of SPOTS) add(x, y, 400, { cone: U.angleTo(x, y, DESK.x, DESK.y + 40), spread: 0.3, color: '#fff0c8', k: 0.12 });
          add(700, 480, 380, { i: 0.45 });
          for (let i = 0; i < 5; i++) add(300 + i * 200, 40, 180, { i: 0.5, color: '#fff2d0', k: 0.05 });
          // Reporters' flashbulbs: a white pop of 0.08 s now and then (never with REDUCED flashing).
          if (reduced()) return;
          const s = scratch(world);
          const dt = U.clamp(t - (s.bulbT == null ? t : s.bulbT), 0, 0.1);
          s.bulbT = t;
          const bulbs = s.bulbs || (s.bulbs = new Map());
          const L = DM.LOOKS || {};
          for (const r of all(world, 'press', (e) => e.look && (e.look === L.reporter || e.look === L.reporter2))) {
            if (r.dead) continue;
            const until = bulbs.get(r) || 0;
            if (t < until) add(r.x + Math.cos(r.facing) * 12, r.y + Math.sin(r.facing) * 12, 190, { i: 1, color: '#ffffff', k: 0.5 });
            else if (Math.random() < dt * 0.35) bulbs.set(r, t + 0.08);
          }
        },
      },
      weather: [{ type: 'haze', n: 70, alpha: 0.075, tilt: 0.15, shaftsAt: [0.33, 0.5, 0.67] }],
    },

    // Chapter IV: Mars. Thin daylight, red dust, dust devils, cloud shadows.
    mars: {
      shadow: 'rgba(110,30,10,0.45)',
      weather: [{ type: 'dust', color: '#f4b888', devilColor: '#d08058', wind: 45, clouds: true, cloudColor: '#6e2c1a' }],
      walls: { rock: { pattern: 'rock', height: 1.3, top: '#8a3a1e', lit: '#c4683c', dark: '#56200e' } },
    },

    // Chapter V: Antarctic twilight and a blizzard outside; gold halls, braziers
    // and the purple light of the Subtractor inside.
    karnak: {
      shadow: 'rgba(80,100,160,0.36)',
      light: {
        ambient: 'rgba(34,48,96,0.32)',
        playerK: 0.16,
        zones: [
          { x: COURT.x, y: COURT.y, w: COURT.w, h: COURT.h, ambient: 'rgba(26,18,40,0.46)' },
          { x: SANCTUM.x, y: SANCTUM.y, w: SANCTUM.w, h: SANCTUM.h, ambient: 'rgba(16,6,32,0.66)' },
        ],
        lights(world, add) {
          for (const [x, y] of BRAZIERS) add(x, y, 150, { color: '#ffb84a', k: 0.2, flicker: true });
          for (const [x, y] of TORCHES) add(x, y, 130, { color: '#ffb84a', k: 0.22, flicker: true });
          const sub = find(world, 'sub', (e) => e.data && e.data.charge != null);
          const c = sub ? sub.data.charge : 0;
          add(SUB.x - 80, SUB.y, 220 + c * 380, { i: 0.75 + c * 0.25, color: '#c06bff', k: 0.18 + c * 0.4 });
          add(2250, 1000, 300, { i: 0.55, color: '#d4ad3a', k: 0.06 });
        },
      },
      weather: [
        { type: 'snow', exclude: [COURT] },
        { type: 'haze', only: COURT, n: 60, alpha: 0.05, color: '#ffe0b0' },
      ],
      walls: {
        ice: { pattern: 'ice', height: 1.1 },
        karnak: { pattern: 'gold', height: 1.5 },
        wall: { pattern: 'gold', height: 1.5 },
        pillar: { pattern: 'gold', height: 1.8 },
      },
    },
  };

  DM.Atmosphere = {
    profiles,
    get(id) {
      return (id && profiles[id]) || null;
    },
    register(id, profile) {
      profiles[id] = profile;
      return profile;
    },
    ramp,
  };
})();
