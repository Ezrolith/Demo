/*
 * Audio test: the recipe library, ambient beds, reactive music, the spare/kill
 * cues, danger cues, Temporal Sight and footsteps. Drives the real game in
 * headless Chromium, reads DM.Audio / DM.AudioDirector state, wraps Audio.play
 * and the music sequencer to count what was played, and renders recipes and
 * tracks into an OfflineAudioContext to measure levels.
 *
 *   node tests/audio.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || path.join(root, 'index.html');
const url = pathToFileURL(target).href + '?dev';

let failures = 0;
function assert(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

// Every literal sound name the game asks for, so a package that calls a new
// name without a recipe fails here instead of playing silence.
function soundNamesInSource() {
  const names = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js') && !p.endsWith(path.join('core', 'audio.js'))) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/Audio\.play\(([^;]*?)\)/g)) {
          const arg = m[1].split(/,\s*\{/)[0];
          for (const q of arg.matchAll(/'([a-z0-9_]+)'|"([a-z0-9_]+)"/g)) names.add(q[1] || q[2]);
        }
      }
    }
  };
  walk(path.join(root, 'src'));
  return [...names].sort();
}
// The names packages A-C rely on (iteration-1 contracts).
const CONTRACT = ['charge', 'pod_alarm', 'mg_spin', 'cannon', 'phase', 'veidt_dodge', 'fizzle', 'dis_miss', 'ko', 'spared', 'unmade', 'beat', 'jammed', 'step', 'whoosh', 'throw'];

const errors = [];
const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

// ---- 1. Before the audio is unlocked, everything is a safe no-op ------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && errs.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.DM && window.DM.dev);
  const r = await page.evaluate(async () => {
    const DM = window.DM, A = DM.Audio;
    const before = A.ctx;
    for (const n of Object.keys(A.recipes)) A.play(n, { speed: 700, surface: 'snow' });
    A.hum('emitter', true, { freq: 98, freq2: 103.6, gain: 0.02 });
    A.hum('static', true, { kind: 'noise' });
    A.hum('sight', true, { kind: 'sight' });
    A.stopHums();
    A.ambience('karnak');
    A.setTimeScale(0.28);
    A.duck(true);
    A.setMusicCap(400);
    A.setMusicFilter(650);
    A.setAmbienceDuck(0.4);
    A.music.play('finale', { intensity: 0.5 });
    A.music.setIntensity(1);
    A.setVolumes({ music: 0.5, sfx: 0.5, ambience: 0.5 });
    DM.dev.start('karnak', 0);
    await new Promise((res) => setTimeout(res, 600));
    DM.dev.start('prologue', 0);
    await new Promise((res) => setTimeout(res, 400));
    const out = { ctx: before, ambId: A.amb.id, dirErr: DM.AudioDirector.lastError, engineErr: DM.Engine.error ? String(DM.Engine.error) : null };
    A.setTimeScale(1);
    A.duck(false);
    A.setMusicCap(null);
    A.setMusicFilter(18000);
    return out;
  });
  assert('before unlock: every Audio call is a silent no-op (no context, no errors)', r.ctx === null && !r.dirErr && !r.engineErr && errs.length === 0, errs.concat([r.dirErr, r.engineErr].filter(Boolean)).join(' | '));
  assert('before unlock: the director still tracks the bed it will play', r.ambId === 'gila', `amb.id ${r.ambId}`);
  await page.close();
}

// ---- the main page: unlocked audio, instrumented sources ---------------------------
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && errors.push(m.text()));
await page.addInitScript(() => {
  const P = (window.AudioContext || window.webkitAudioContext).prototype;
  window.__aud = { started: 0, ended: 0 };
  for (const m of ['createOscillator', 'createBufferSource']) {
    const orig = P[m];
    P[m] = function () {
      const n = orig.apply(this, arguments);
      const st = n.start;
      n.start = function () {
        window.__aud.started++;
        n.addEventListener('ended', () => window.__aud.ended++);
        return st.apply(n, arguments);
      };
      return n;
    };
  }
});
await page.goto(url);
await page.waitForFunction(() => window.DM && window.DM.dev);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.mouse.click(640, 360);
await wait(600);
const st = () => ev(() => window.DM.dev.state());
// Skip dialogue, cutscene narration and unlock cards until Jon has control (for 0.75 s).
async function settle(n = 40) {
  let free = 0;
  for (let i = 0; i < n && free < 3; i++) {
    const busy = await ev(() => {
      const DM = window.DM, p = DM.dev.play();
      return !p || DM.Engine.top() !== p || DM.Engine.fading || p.dialog.active || p.ctx.locked;
    });
    if (busy) {
      free = 0;
      await page.keyboard.press('e');
    } else free++;
    await wait(250);
  }
}
async function start(ch, stage) {
  await ev(([c, s]) => window.DM.dev.start(c, s), [ch, stage]);
  await wait(700);
}
// Count Audio.play calls by name (with the options passed).
await ev(() => {
  const A = window.DM.Audio;
  const orig = A.play;
  window.__plays = [];
  A.play = function (n, o) {
    window.__plays.push({ n, o: o || {}, t: performance.now() });
    return orig.call(this, n, o);
  };
  // An analyser on the ambience bus.
  const an = A.ctx.createAnalyser();
  an.fftSize = 2048;
  A.ambBus.connect(an);
  const buf = new Float32Array(2048);
  window.__ambRms = () => {
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    return Math.sqrt(s / buf.length);
  };
});
const plays = (name, since = 0) => ev(([name, since]) => window.__plays.filter((p) => p.n === name && p.t >= since), [name, since]);
const now = () => ev(() => performance.now());

assert('audio unlocks on the first click', (await ev(() => window.DM.Audio.ctx && window.DM.Audio.ctx.state)) === 'running');

// ---- 2. Recipe library ------------------------------------------------------------------
{
  const used = soundNamesInSource();
  const have = await ev(() => Object.keys(window.DM.Audio.recipes));
  const missing = used.filter((n) => !have.includes(n));
  assert(`every sound name called in src/ has a recipe (${used.length} names)`, missing.length === 0, missing.length ? 'missing: ' + missing.join(', ') : '');
  const missingC = CONTRACT.filter((n) => !have.includes(n));
  assert('the iteration-1 contract names exist', missingC.length === 0, missingC.join(', '));
  const silent = await ev(async () => {
    const DM = window.DM, sr = 44100, out = [];
    for (const n of Object.keys(DM.Audio.recipes)) {
      const off = new OfflineAudioContext(1, sr * 4, sr);
      Object.defineProperty(off, 'state', { get: () => 'running' });
      const A = Object.create(DM.Audio);
      Object.assign(A, { ctx: off, muted: false, last: {}, hums: {}, sfxBus: off.createGain() });
      A.sfxBus.connect(off.destination);
      A.noiseBuf = off.createBuffer(1, sr, sr);
      const d = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
      A.play(n, { speed: 700, surface: 'concrete' });
      const b = await off.startRendering();
      let peak = 0;
      for (const v of b.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
      if (!(peak > 1e-4)) out.push(n);
    }
    return out;
  });
  assert('every recipe renders a non-silent offline buffer', silent.length === 0, silent.join(', '));
  const n0 = errors.length;
  await ev(() => {
    const A = window.DM.Audio;
    for (const n of Object.keys(A.recipes)) A.play(n, { speed: 700, surface: 'snow', form: 'manhattan' });
    A.define('__test_blip', { gap: 0, fn: (a) => a.tone({ freq: 1000, dur: 0.05, gain: 0.01 }) });
    A.play('__test_blip');
  });
  await wait(300);
  assert('Audio.play of every recipe is error-free; Audio.define adds a recipe', errors.length === n0 && (await ev(() => window.DM.Audio.has('__test_blip'))), errors.slice(n0).join(' | '));
}

// ---- 3. Levels: throw vs disintegrate, Veidt's dodge, small speakers, track loudness ----------
{
  const r = await ev(async () => {
    const DM = window.DM, sr = 44100;
    function harness(secs, hp) {
      const off = new OfflineAudioContext(1, Math.ceil(sr * secs), sr);
      Object.defineProperty(off, 'state', { get: () => 'running' });
      const A = Object.create(DM.Audio);
      Object.assign(A, { ctx: off, muted: false, last: {}, hums: {}, sfxBus: off.createGain() });
      let out = A.sfxBus;
      if (hp) for (let i = 0; i < 2; i++) { const f = off.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 150; out.connect(f); out = f; }
      out.connect(off.destination);
      A.noiseBuf = off.createBuffer(1, sr, sr);
      const d = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
      return { off, A };
    }
    const measure = (buf) => {
      const d = buf.getChannelData(0);
      let peak = 0, e = 0;
      for (const v of d) { peak = Math.max(peak, Math.abs(v)); e += v * v; }
      const W = Math.round(sr * 0.05); let best = 0;
      for (let i = 0; i + W < d.length; i += W >> 1) { let s = 0; for (let k = 0; k < W; k++) s += d[i + k] * d[i + k]; best = Math.max(best, Math.sqrt(s / W)); }
      return { peakDb: 20 * Math.log10(peak), rms50: 20 * Math.log10(best), e };
    };
    async function sfx(n, o, hp) { const h = harness(3.5, hp); h.A.play(n, o || {}); return measure(await h.off.startRendering()); }
    const out = { peak: {}, low: {}, mus: {} };
    for (const n of ['throw', 'disintegrate', 'veidt_dodge', 'whoosh']) out.peak[n] = (await sfx(n, { speed: 700 })).peakDb;
    for (const n of ['expand', 'explosion', 'door']) out.low[n] = 10 * Math.log10((await sfx(n, {}, true)).e / (await sfx(n, {}, false)).e);
    for (const id of Object.keys(DM.MusicTracks)) {
      const { off, A } = harness(26);
      const M = Object.create(DM.Audio.music);
      Object.assign(M, { audio: A, track: DM.MusicTracks[id], intensity: 1, barI: 1, target: 1 });
      M.gain = off.createGain();
      M.gain.gain.value = Math.pow(10, (M.track.level || 0) / 20);
      M.gain.connect(off.destination);
      const tr = M.track, sp = 60 / tr.bpm / (tr.div || 4);
      let t = 0.02, step = (tr.div || 4) * (tr.beats || 4) * 4;
      while (t < 24) { M.playStep(step, t, sp); t += sp; step++; }
      out.mus[id] = measure(await off.startRendering()).rms50;
    }
    return out;
  });
  const f = (x) => x.toFixed(1);
  assert('a throw at speed 700 peaks within 8 dB of disintegrate', r.peak.throw >= r.peak.disintegrate - 8, `throw ${f(r.peak.throw)} dBFS, disintegrate ${f(r.peak.disintegrate)} dBFS`);
  assert("'veidt_dodge' and the disc 'whoosh' peak at -20 dBFS or louder", r.peak.veidt_dodge >= -20 && r.peak.whoosh >= -20, `dodge ${f(r.peak.veidt_dodge)}, whoosh ${f(r.peak.whoosh)}`);
  assert('through a 150 Hz highpass: Expand loses at most 6 dB, explosion and door at most 4 dB', r.low.expand >= -6 && r.low.explosion >= -4 && r.low.door >= -4, `expand ${f(r.low.expand)}, explosion ${f(r.low.explosion)}, door ${f(r.low.door)}`);
  const vals = Object.values(r.mus), mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const off = Object.entries(r.mus).filter(([, v]) => Math.abs(v - mean) > 3);
  assert('every track\'s loudest 50 ms is within ±3 dB of the others (level applied)', off.length === 0, Object.entries(r.mus).map(([k, v]) => `${k} ${f(v)}`).join(', '));
}

// ---- 4. An ambient bed for every map --------------------------------------------------
{
  const cases = [['prologue', 0], ['reassembly', 0], ['superman', 0], ['superman', 1], ['deterrent', 1], ['mars', 0], ['mars', 2], ['karnak', 0], ['karnak', 2]];
  const seen = new Set();
  let ok = true;
  const notes = [];
  for (const [c, s] of cases) {
    await start(c, s);
    await wait(900);
    const r = await ev(() => {
      const DM = window.DM, play = DM.dev.play(), p = play.player;
      const m = DM.Ambience.maps[play.ctx.mapName];
      let bed = m.bed;
      for (const z of m.zones || []) if (p.x > z.rect[0] && p.y > z.rect[1] && p.x < z.rect[2] && p.y < z.rect[3]) { bed = z.bed; break; }
      return { map: play.ctx.mapName, want: bed, got: DM.Audio.amb.id, live: DM.Audio.amb.live, rms: window.__ambRms() };
    });
    seen.add(r.map);
    if (r.got !== r.want || !r.live || !(r.rms > 1e-5)) ok = false;
    notes.push(`${r.map}:${r.got}${r.rms > 1e-5 ? '' : '(silent)'}`);
  }
  assert(`Audio.amb.id matches each map's bed and the bed is audible (${seen.size} maps)`, ok && seen.size === 8, notes.join(' '));

  // Karnak: crossing into the sanctum crossfades to the machine hum.
  await start('karnak', 1);
  await settle();
  const k1 = await ev(() => window.DM.Audio.amb.id);
  await ev(() => { const p = window.DM.dev.play().player; p.x = 2050; p.y = 1000; });
  await wait(300);
  const k2 = await ev(() => window.DM.Audio.amb.id);
  assert('Karnak: the gale changes to the sanctum hum past x 1960', k1 === 'karnak' && k2 === 'sanctum', `${k1} → ${k2}`);

  // Studio -> Mars: a smooth crossfade (no step in level). Events are removed for the measurement.
  await ev(() => {
    const B = window.DM.Ambience.beds;
    window.__bedsSaved = { studio: B.studio, mars: B.mars };
    for (const id of ['studio', 'mars']) B[id] = { layers: B[id].layers.filter((L) => L.kind !== 'events') };
  });
  await start('mars', 0);
  await wait(2500);
  await ev(() => {
    window.__env = [];
    window.__envT = setInterval(() => window.__env.push(window.__ambRms()), 30);
    window.DM.dev.play().ctx.loadMap('mars');
  });
  await wait(3500);
  const env = await ev(() => { clearInterval(window.__envT); const B = window.DM.Ambience.beds; Object.assign(B, window.__bedsSaved); return { env: window.__env, id: window.DM.Audio.amb.id }; });
  let jump = 0;
  for (let i = 1; i < env.env.length; i++) if (env.env[i - 1] > 1e-5 && env.env[i] > 1e-5) jump = Math.max(jump, Math.abs(20 * Math.log10(env.env[i] / env.env[i - 1])));
  const minRms = Math.min(...env.env);
  assert('studio → Mars crossfades with no click (no 6 dB step between 30 ms frames, never silent)', env.id === 'mars' && jump < 6 && minRms > 1e-5, `largest step ${jump.toFixed(1)} dB, min rms ${minRms.toExponential(1)}`);

  // Pause and Temporal Sight duck the bed; the title has none.
  await start('mars', 2);
  await settle();
  await page.keyboard.press('Escape');
  await wait(300);
  const duckPause = await ev(() => window.DM.Audio.ambDuck);
  await page.keyboard.press('Escape');
  await wait(300);
  await ev(() => window.DM.Engine.set(new window.DM.Scenes.Title()));
  await wait(3800);
  const title = await ev(() => ({ id: window.DM.Audio.amb.id, rms: window.__ambRms() }));
  assert('Pause ducks the bed to 60%; the title has no bed and the bus falls silent', Math.abs(duckPause - 0.6) < 0.01 && title.id === null && title.rms < 1e-6, `pause ${duckPause}, title ${title.id} rms ${title.rms.toExponential(1)}`);
}

// ---- 5. Music follows the fight and steps aside for dialogue -----------------------------------
{
  // Interlude -> Play: the same track continues, no restart.
  for (const ch of ['superman', 'deterrent', 'prologue']) {
    await ev((c) => window.DM.Engine.set(new window.DM.Scenes.Interlude(c)), ch);
    await wait(1500);
    const a = await ev(() => { const M = window.DM.Audio.music; window.__g = M.gain; return { id: M.trackId, step: M.step }; });
    await ev(() => window.DM.Engine.top().begin());
    await page.waitForFunction(() => window.DM.dev.play() && !window.DM.Engine.fading, null, { timeout: 8000 });
    await wait(1500);
    const b = await ev(() => { const M = window.DM.Audio.music; return { id: M.trackId, same: M.gain === window.__g, step: M.step }; });
    assert(`interlude → play (${ch}) keeps '${a.id}' playing without a restart`, a.id === b.id && b.same && b.step > a.step, `${a.id}@${a.step} → ${b.id}@${b.step}${b.same ? '' : ' (restarted)'}`);
  }

  // Dialogue ducks the music to 0.5.
  await start('deterrent', 2);
  await wait(800);
  const duck = await ev(() => ({ dialog: window.DM.dev.play().dialog.active, g: window.DM.Audio.duckGain.gain.value }));
  assert('during dialogue the music duck gain reads 0.5', duck.dialog && Math.abs(duck.g - 0.5) < 0.03, `dialog ${duck.dialog}, duck ${duck.g.toFixed(3)}`);

  // Intensity: the kick waits for alerted enemies. The wave script is stopped and
  // the field cleared, so only the drones placed below count.
  await settle();
  await ev(() => {
    const DM = window.DM, play = DM.dev.play(), p = play.player;
    p.godMode = true;
    play.ctx.threads = [];
    play.world.entities = play.world.entities.filter((e) => e.team !== 'enemy');
    window.__held = [];
    for (let i = 0; i < 3; i++) {
      const d = play.world.add(new DM.Enemies.Drone({ x: p.x + 1500, y: p.y + i * 100 }));
      d.__upd = d.update;
      d.update = () => {};
      window.__held.push(d);
    }
  });
  await wait(2500); // the earlier fight dies away
  await ev(() => {
    const M = window.DM.Audio.music;
    window.__kicks = [];
    const k = M.kick;
    M.kick = function (t, L, w) { window.__kicks.push({ t, w, now: M.audio.ctx.currentTime }); return k.call(this, t, L, w); };
  });
  await wait(4600); // two bars of 'action'
  const calm = await ev(() => ({ kicks: window.__kicks.length, track: window.DM.Audio.music.trackId, I: window.DM.Audio.music.intensity }));
  const alertAt = await ev(() => {
    const DM = window.DM, play = DM.dev.play(), p = play.player;
    window.__held.forEach((e, i) => { e.x = p.x + 250; e.y = p.y - 150 + i * 150; e.alerted = true; });
    return DM.Audio.ctx.currentTime;
  });
  await wait(3600);
  const fight = await ev((t0) => ({ first: (window.__kicks.find((k) => k.t >= t0 && k.w >= 0.25) || {}).t, n: window.__kicks.length, t0, I: window.DM.Audio.music.intensity }), alertAt);
  assert("'action' with nobody alerted: the kick is silent", calm.track === 'action' && calm.kicks === 0, `${calm.kicks} kicks, intensity ${calm.I.toFixed(2)}`);
  const firstW = fight.first != null ? await ev((t) => window.__kicks.find((k) => k.t === t).w, fight.first) : 0;
  assert('three alerted enemies within 900 px: the kick is audible (at least 1/4 level) within a bar (2.14 s, +0.4 s scheduling)', fight.first != null && fight.first - fight.t0 < 2.14 + 0.4, fight.first != null ? `first kick ${(fight.first - fight.t0).toFixed(2)} s after the alert at ${Math.round(firstW * 100)}% level, intensity now ${fight.I.toFixed(2)}` : 'no kick');
  await ev(() => { for (const e of window.__held) e.update = e.__upd; });

  // A switch lands on the old track's beat grid.
  const grid = await ev(async () => {
    const M = window.DM.Audio.music, c = M.audio.ctx;
    const starts = [];
    const s0 = M.start;
    M.start = function (id, t, f) { starts.push({ id, t }); return s0.call(this, id, t, f); };
    M.play('void', { at: 'now' });
    await new Promise((r) => setTimeout(r, 1700));
    const origin = starts[starts.length - 1].t;
    const beat = 60 / window.DM.MusicTracks.void.bpm;
    M.play('reflect');
    await new Promise((r) => setTimeout(r, 1800));
    M.start = s0;
    const sw = starts[starts.length - 1];
    const k = (sw.t - origin) / beat;
    return { id: sw.id, off: Math.abs(k - Math.round(k)) * beat, now: c.currentTime };
  });
  assert('a track switch lands within 5 ms of the old track\'s beat grid', grid.id === 'reflect' && grid.off < 0.005, `${(grid.off * 1000).toFixed(2)} ms off the grid`);

  // Veidt yields: the finale makes way.
  await start('karnak', 2);
  await settle();
  const before = await ev(() => window.DM.Audio.music.trackId);
  await ev(() => window.DM.dev.play().world.boss.yieldNow());
  await wait(2200);
  const after = await ev(() => ({ id: window.DM.Audio.music.trackId, dialog: window.DM.dev.play().dialog.active }));
  assert("after Veidt yields the music is no longer 'finale'", before === 'finale' && after.id !== 'finale', `${before} → ${after.id}`);

  // Stage cues.
  await start('superman', 0);
  await wait(1500);
  const range = await ev(() => window.DM.Audio.music.trackId);
  await start('mars', 0);
  await wait(1500);
  const studio = await ev(() => window.DM.Audio.music.trackId);
  assert("stage cues: the test range plays 'range', the TV studio 'tension'", range === 'range' && studio === 'tension', `${range}, ${studio}`);

  // The ending's music follows the same rule as its text.
  const endings = await ev(async () => {
    const DM = window.DM, saved = DM.Save.data.completed, out = [];
    for (const c of [{ disintegrated: 20, spared: 0 }, { disintegrated: 1, spared: 12 }]) {
      DM.Save.data.completed = { karnak: c };
      DM.Engine.set(new DM.Scenes.Ending());
      await new Promise((r) => setTimeout(r, 300));
      out.push(DM.Audio.music.wanted);
    }
    DM.Save.data.completed = saved;
    DM.Engine.set(new DM.Scenes.Title());
    return out;
  });
  assert("the ending plays 'ending_cold' for a detached Jon and 'ending' otherwise", endings[0] === 'ending_cold' && endings[1] === 'ending', endings.join(', '));
}

// ---- 6. The spare/kill moment ---------------------------------------------------------------
{
  await start('superman', 1);
  await settle();
  await ev(() => {
    const DM = window.DM, play = DM.dev.play(), p = play.player;
    p.godMode = true;
    const gs = play.world.entities.filter((e) => e instanceof DM.Enemies.Gangster && !e.dead && !e.ko);
    window.__g1 = gs[0];
    window.__g2 = gs[1];
    for (const g of [gs[0], gs[1]]) { g.__upd = g.update; g.update = () => {}; }
  });
  const t0 = await now();
  // A throw into the ground at speed: a knockout.
  await ev(() => {
    const play = window.DM.dev.play(), p = play.player, g = window.__g1;
    g.x = p.x + 60; g.y = p.y;
    g.update = g.__upd;
    g.stun = 1; g.thrown = 1; g.vx = 0; g.vy = 0;
    g.damage(999, p, 'impact');
  });
  await wait(1200);
  const ko = await plays('ko', t0), spared = await plays('spared', t0), unmade0 = await plays('unmade', t0);
  assert("a knockout plays 'ko' and 'spared' exactly once, and no 'unmade'", ko.length === 1 && spared.length === 1 && unmade0.length === 0, `ko ${ko.length}, spared ${spared.length}, unmade ${unmade0.length}`);
  // A disintegration with Q under the cursor.
  const t1 = await now();
  const s = await ev(() => {
    const play = window.DM.dev.play(), p = play.player, g = window.__g2;
    g.x = p.x + 160; g.y = p.y; g.vx = g.vy = 0;
    p.energy = 100;
    for (const st of Object.values(p.powers)) st.cd = 0;
    return play.world.camera.toScreen(g.x, g.y);
  });
  await page.mouse.move(s.x, s.y);
  await wait(120);
  await page.keyboard.press('q');
  await wait(250);
  const cap = await ev(() => window.DM.Audio.musicCap);
  await wait(1200);
  const un = await plays('unmade', t1), ko1 = await plays('ko', t1);
  const g2 = await ev(() => ({ dead: window.__g2.dead, cap: window.DM.Audio.musicCap }));
  assert("a disintegrated person plays 'unmade' exactly once and dips the music", g2.dead && un.length === 1 && ko1.length === 0 && cap === 900 && g2.cap == null, `unmade ${un.length}, ko ${ko1.length}, cap during ${cap}, after ${g2.cap}`);
  const miss = await plays('dis_miss', 0);
  assert("a cast that unmade nobody plays 'dis_miss' (package B), and it exists", (await ev(() => window.DM.Audio.has('dis_miss'))), `${miss.length} so far`);
}

// ---- 7. Danger: emitters, static, jammed, heartbeat, decoherence --------------------------------
{
  await start('karnak', 0);
  await settle();
  const place = (d) => ev((d) => {
    const DM = window.DM, play = DM.dev.play(), p = play.player, w = play.world;
    p.godMode = true;
    const em = w.entities.filter((e) => e.jamR && !e.dead);
    // An emitter with free ground d px to one side of it.
    for (const e of em) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = e.x + dx * d, y = e.y + dy * d;
      if (x < 60 || y < 60 || x > w.w - 60 || y > w.h - 60) continue;
      if (w.walls && w.walls.some((W) => x > W.x - 20 && x < W.x + W.w + 20 && y > W.y - 20 && y < W.y + W.h + 20)) continue;
      const near = em.filter((o) => Math.hypot(o.x - x, o.y - y) < d - 1);
      if (near.length) continue;
      p.x = x; p.y = y; p.vx = p.vy = 0;
      return true;
    }
    return false;
  }, d);
  const ok200 = await place(200);
  await wait(500);
  const h200 = await ev(() => Object.keys(window.DM.Audio.hums));
  const t0 = await now();
  await page.keyboard.down('f');
  await wait(150);
  await page.keyboard.up('f');
  await wait(200);
  const jammed = await plays('jammed', t0);
  const ok600 = await place(600);
  await wait(700);
  const h600 = await ev(() => Object.keys(window.DM.Audio.hums));
  assert("200 px from an emitter: hums 'emitter' and 'static'", ok200 && h200.includes('emitter') && h200.includes('static'), h200.join(', '));
  assert('600 px away: neither', ok600 && !h600.includes('emitter') && !h600.includes('static'), h600.join(', ') || 'none');
  assert("F while jammed plays 'jammed'", jammed.length === 1, `${jammed.length}`);

  // Heartbeat.
  await ev(() => { window.__hold = setInterval(() => { const p = window.DM.dev.play().player; p.coherence = 20; }, 30); });
  await wait(300);
  const tb = await now();
  await wait(4000);
  const beats = (await plays('beat', tb)).map((p) => p.t);
  const capLow = await ev(() => window.DM.Audio.musicCap);
  await ev(() => { clearInterval(window.__hold); window.DM.dev.play().player.coherence = 100; });
  await wait(400);
  const ta = await now();
  await wait(1500);
  const after = await plays('beat', ta);
  const gaps = beats.slice(1).map((t, i) => (t - beats[i]) / 1000);
  const avg = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  assert("coherence 20: 'beat' about every 0.95 s, music capped at 2500 Hz", beats.length >= 3 && Math.abs(avg - 0.95) < 0.12 && capLow === 2500, `${beats.length} beats, mean gap ${avg.toFixed(2)} s, cap ${capLow}`);
  assert('coherence 100: the heartbeat stops', after.length === 0, `${after.length} beats`);

  // Decoherence: music to 400 Hz at once, danger hums stop.
  await place(200);
  await wait(300);
  await ev(() => { const p = window.DM.dev.play().player; p.godMode = false; p.invuln = 0; p.locked = false; p.damage(500, null); });
  await wait(250);
  const down = await ev(() => ({ cap: window.DM.Audio.musicCap, hums: Object.keys(window.DM.Audio.hums), f: window.DM.Audio.musicFilter.frequency.value }));
  assert('decoherence: music lowpass capped at 400 Hz and the danger hums stop', down.cap === 400 && !down.hums.includes('emitter') && down.f < 1000, `cap ${down.cap}, filter ${Math.round(down.f)}, hums ${down.hums.join(',') || 'none'}`);
}

// ---- 8. Temporal Sight bends sound ----------------------------------------------------------
{
  await start('mars', 2);
  await settle();
  await ev(() => { const p = window.DM.dev.play().player; p.energy = 100; p.godMode = true; });
  await page.keyboard.down('f');
  await wait(1200);
  const held = await ev(() => ({ f: window.DM.Audio.sfxFilter.frequency.value, k: window.DM.Audio.timeScale, hums: Object.keys(window.DM.Audio.hums), duck: window.DM.Audio.ambDuck }));
  await page.keyboard.up('f');
  await wait(500);
  const rel = await ev(() => ({ f: window.DM.Audio.sfxFilter.frequency.value, hums: Object.keys(window.DM.Audio.hums) }));
  assert("holding F: sfxFilter below 2500 Hz, Audio.timeScale about 0.28, the 'sight' hum and ticking, the bed ducked to 40%", held.f < 2500 && Math.abs(held.k - 0.28) < 0.04 && held.hums.includes('sight') && held.duck === 0.4, `filter ${Math.round(held.f)} Hz, k ${held.k.toFixed(3)}, hums ${held.hums.join(',')}, duck ${held.duck}`);
  assert('releasing F restores the effects to 18 kHz within 0.5 s', rel.f > 17000 && !rel.hums.includes('sight'), `filter ${Math.round(rel.f)} Hz`);
}

// ---- 9. Footsteps by surface -----------------------------------------------------------------
{
  await start('prologue', 0);
  await settle();
  await ev(() => { const p = window.DM.dev.play().player; p.x = 140; p.y = 510; p.vx = p.vy = 0; });
  await wait(600);
  const ts = await now();
  await wait(1000);
  const standing = await plays('step', ts);
  // Walk until Jon has covered 2 s at his full walking speed (game time, so a slow
  // headless frame rate cannot shorten it), counting steps.
  const w0 = await ev(() => { window.__w0 = window.DM.dev.play().player.walk; return performance.now(); });
  await page.keyboard.down('d');
  await page.waitForFunction(() => { const p = window.DM.dev.play().player; return p.walk - window.__w0 >= 2 * p.speedMax * 0.09; }, null, { timeout: 8000, polling: 'raf' }).catch(() => {});
  const walking = await plays('step', w0);
  await page.keyboard.up('d');
  const walked = await ev(() => { const p = window.DM.dev.play().player; return (p.walk - window.__w0) / (p.speedMax * 0.09); });
  const surf = [...new Set(walking.map((p) => p.o.surface))];
  assert('standing still: no footsteps', standing.length === 0, `${standing.length}`);
  assert("2 s walking as human Jon in Gila Flats: 8-10 'step' on concrete", walked >= 1.95 && walking.length >= 8 && walking.length <= 10 && surf.length === 1 && surf[0] === 'concrete', `${walking.length} steps on ${surf.join(',')} over ${walked.toFixed(2)} s of walking`);

  await start('karnak', 1);
  await settle();
  await ev(() => { const p = window.DM.dev.play().player; p.x = 1300; p.y = 1000; p.vx = p.vy = 0; });
  await wait(300);
  const tk = await now();
  await page.keyboard.down('a');
  await wait(1500);
  await page.keyboard.up('a');
  const ks = await plays('step', tk);
  assert("Karnak: Dr. Manhattan's steps fall on snow, every second step, with his shimmer", ks.length >= 2 && ks.every((p) => p.o.surface === 'snow' && p.o.form === 'manhattan'), `${ks.length} steps: ${[...new Set(ks.map((p) => p.o.surface + '/' + p.o.form))].join(',')}`);
}

// ---- 10. Live sources stay bounded over two minutes of play ------------------------------------------
{
  let max = 0;
  const sample = async (label, secs, act) => {
    for (let i = 0; i < secs * 2; i++) {
      if (act) await act(i);
      await wait(500);
      const n = await ev(() => window.__aud.started - window.__aud.ended);
      if (n > max) max = n;
    }
  };
  await start('deterrent', 2);
  await settle();
  await ev(() => { window.DM.dev.play().player.godMode = true; });
  await sample('waves', 60, async (i) => {
    if (i % 2) return;
    await ev(() => { const p = window.DM.dev.play().player; p.energy = 100; for (const s of Object.values(p.powers)) s.cd = 0; });
    await page.mouse.move(500 + (i * 37) % 300, 260 + (i * 53) % 200);
    await page.keyboard.press('q');
  });
  await start('karnak', 0);
  await settle();
  await ev(() => { window.DM.dev.play().player.godMode = true; });
  await sample('karnak', 30, async (i) => {
    if (i % 4 === 0) await page.keyboard.down('f');
    if (i % 4 === 2) await page.keyboard.up('f');
  });
  await page.keyboard.up('f');
  await start('superman', 1);
  await settle();
  await sample('pier', 30, async (i) => {
    if (i % 6 === 0) await page.keyboard.down('d');
    if (i % 6 === 3) await page.keyboard.up('d');
  });
  await page.keyboard.up('d');
  assert('live audio sources stay under 40 over two minutes of play', max < 40, `max ${max}`);
}

const dirErr = await ev(() => window.DM.AudioDirector.lastError);
assert('the audio director never threw', !dirErr, dirErr || '');
assert('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));

await browser.close();
if (failures) {
  console.log(`\n${failures} audio check(s) failed.`);
  process.exit(1);
}
console.log('\nAll audio checks passed.');
