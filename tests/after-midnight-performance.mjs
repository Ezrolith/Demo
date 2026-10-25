/* Bounded After Midnight art/audio/performance probes in Chromium.
 * Known initial case entries, normal damage, real RAF and actual input. This is
 * neither a natural full playthrough nor a physical slow-device benchmark.
 * QA_CPU=1|4 QA_QUALITY=high|low node tests/after-midnight-performance.mjs [file.html]
 * Reports frame rate; never asserts 60 fps, disables atmosphere or disables the
 * existing quality governor to manufacture a faster result.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(value => value.endsWith('.html')) || 'index.html';
const cpu = Number(process.env.QA_CPU || 1);
const quality = process.env.QA_QUALITY || 'high';
assert.ok([1, 4].includes(cpu), 'QA_CPU must be 1 or 4');
assert.ok(['high', 'low'].includes(quality), 'QA_QUALITY must be high or low');
const build = target.startsWith('dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/after-midnight-performance', build, `${cpu}x-${quality}`);
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const checks = [], errors = [], scenes = [];
const report = { engine: 'chromium', browserVersion: browser.version(), target, build,
  cpuSlowdown: cpu, requestedQuality: quality, checks, errors, scenes,
  method: 'Normal file loading; known initial entries with settings setup, real RAF, actual D/Escape/M input. No invulnerability, actor placement, refills, synthetic clock or visual/effect removal.',
  limitations: ['Initial case openings, not peak boss/wave workload or an unassisted playthrough.',
    'CPU throttling is synthetic and not a named physical slow device.',
    'Output metering is digital signal evidence, not subjective musical listening.',
    'Automatic quality fallback remains enabled; effective tiers are recorded.',
    'Passing asserts functional/audio safety; no minimum FPS is asserted.'],
};
page.on('pageerror', error => errors.push(String(error)));
const check = (label, pass) => { assert.ok(pass, label); checks.push(label); console.log('PASS ' + label); };
const read = () => page.evaluate(() => {
  const play = DM.dev.play(), p = play?.player;
  return { scene: DM.Engine.top()?.constructor.name, chapter: play?.chapter.id,
    map: play?.world.mapId, stage: play?.ctx.stageIndex, hero: p?.profile?.id,
    x: p?.x, y: p?.y, health: p?.coherence, energy: p?.energy,
    failed: play?.failed, invulnerable: !!p?.godMode || !!DM.Save.settings.invulnerable,
    challenge: DM.Save.settings.challenge, dialog: play?.dialog.active,
    paused: !!play && DM.Engine.top() !== play,
    worldTime: play?.world.realTime, entityCount: play?.world.entities.length,
    activeEnemies: play?.world.entities.filter(e => e.team === 'enemy' && !e.dead && !e.ko && !e.isProjectile).length,
    music: DM.Audio.music.trackId, wantedMusic: DM.Audio.music.wanted, ambience: DM.Audio.amb.id,
    audioState: DM.Audio.ctx?.state,
    error: DM.Engine.error ? String(DM.Engine.error.stack || DM.Engine.error) : null };
});
async function settle() {
  await page.waitForTimeout(200);
  let calm = 0;
  for (let i = 0; i < 80; i++) {
    const busy = await page.evaluate(() => {
      const p = DM.dev.play();
      return !p || DM.Engine.top() !== p || p.dialog.active || p.ctx.locked || p.player.locked || DM.Engine.fading;
    });
    if (busy) { calm = 0; await page.keyboard.press('e'); }
    else if (++calm >= 4) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Opening did not release ordinary player control');
}
async function frameWindow() {
  return page.evaluate(async () => {
    const rows = [], started = performance.now(), deadline = started + 2000;
    let last = null;
    await new Promise(resolve => {
      function sample(time) {
        if (last != null) rows.push({ gap: time - last, update: DM.Engine.stats.updMs,
          render: DM.Engine.stats.renderMs, quality: DM.Engine.qualityTier(), governorDrop: DM.Engine.governor.drop });
        last = time;
        if (performance.now() < deadline) requestAnimationFrame(sample);
        else resolve();
      }
      requestAnimationFrame(sample);
    });
    const gaps = rows.map(row => row.gap).filter(gap => gap > 0).sort((a, b) => a - b);
    const percentile = fraction => gaps[Math.min(gaps.length - 1, Math.floor((gaps.length - 1) * fraction))];
    const median = percentile(0.5), work = rows.map(row => row.update + row.render);
    return { wallMs: performance.now() - started, frames: gaps.length, medianGapMs: median,
      p95GapMs: percentile(0.95), approximateFps: median > 0 ? 1000 / median : null,
      meanEngineWorkMs: work.reduce((sum, value) => sum + value, 0) / Math.max(1, work.length),
      workSource: 'Mean of Engine measured smoothed update/render costs sampled on real RAF.',
      effectiveQualities: [...new Set(rows.map(row => row.quality))],
      finalEffectiveQuality: DM.Engine.qualityTier(),
      governorDropStart: rows[0]?.governorDrop, governorDropEnd: DM.Engine.governor.drop,
      governorEnabled: DM.Engine.governor.enabled,
      canvas: { width: DM.Engine.canvas.width, height: DM.Engine.canvas.height, dpr: DM.Engine.dpr },
      display: { fx: DM.Save.settings.fx, grain: DM.Save.settings.grain,
        flashing: DM.Save.settings.flashing, shake: DM.Save.settings.shake } };
  });
}
async function meter(seconds = 0.7) {
  return page.evaluate(async seconds => {
    const audio = DM.Audio, analyser = audio.ctx.createAnalyser(); analyser.fftSize = 2048;
    const samples = new Float32Array(analyser.fftSize);
    let peak = 0, sum = 0, count = 0, clipped = 0, finite = true;
    audio.compressor.connect(analyser);
    try {
      const deadline = performance.now() + seconds * 1000;
      while (performance.now() < deadline) {
        analyser.getFloatTimeDomainData(samples);
        for (const value of samples) {
          if (!Number.isFinite(value)) finite = false;
          peak = Math.max(peak, Math.abs(value)); sum += value * value;
          if (Math.abs(value) >= 0.999) clipped++;
          count++;
        }
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    } finally { audio.compressor.disconnect(analyser); analyser.disconnect(); }
    return { peak, rms: Math.sqrt(sum / Math.max(1, count)), clipped, samples: count, finite,
      point: 'Actual mixed output after the game compressor' };
  }, seconds);
}
try {
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.createPlayer);
  check('game boots without an engine error', !(await read()).error);
  await page.mouse.click(640, 360); await page.waitForTimeout(200);
  if (await page.evaluate(() => DM.Audio.ctx?.state !== 'running')) await page.keyboard.press('z');
  await page.waitForFunction(() => DM.Audio.ctx?.state === 'running', null, { timeout: 10000 });
  report.audioUnlock = await page.evaluate(() => ({ state: DM.Audio.ctx.state,
    sampleRate: DM.Audio.ctx.sampleRate, currentTime: DM.Audio.ctx.currentTime,
    userActivation: navigator.userActivation?.isActive }));
  check('real input unlocks the actual audio context', report.audioUnlock.state === 'running');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  report.cpuThrottleApplied = true;
  await page.evaluate(quality => {
    DM.Save.settings.focusPause = false; DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.challenge = 'normal'; DM.Save.settings.invulnerable = false;
    DM.Save.settings.quality = quality; DM.Engine.resize();
  }, quality);
  for (const sample of [
    { id: 'dead_air', theme: 'rooftops', hero: 'niteowl', music: 'am_noir', ambience: 'am_roofs' },
    { id: 'undertow', theme: 'harbour', hero: 'silkspectre', music: 'am_storm', ambience: 'am_harbour' },
    { id: 'glass_archive', theme: 'museum', hero: 'rorschach', music: 'am_glass', ambience: 'am_museum' },
  ]) {
    await page.evaluate(sample => DM.AfterMidnight.start(sample.id,
      { hero: sample.hero, theme: sample.theme, instant: true }), sample);
    await settle();
    const entry = await read();
    check(sample.theme + ': known opening uses the intended vulnerable hero on Normal',
      entry.hero === sample.hero && entry.chapter === 'am_' + sample.id && entry.stage === 0 &&
      entry.challenge === 'normal' && !entry.invulnerable && !entry.failed && entry.health > 0);
    await page.keyboard.down('d'); await page.waitForTimeout(450); await page.keyboard.up('d');
    const moved = await read();
    check(sample.theme + ': real movement responds', Math.hypot(moved.x - entry.x, moved.y - entry.y) > 5);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const paused = await read(); await page.waitForTimeout(250);
    check(sample.theme + ': real Pause freezes the game world', paused.paused && paused.worldTime === (await read()).worldTime);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check(sample.theme + ': resume restores live control', !(await read()).paused);
    const timing = await frameWindow();
    check(sample.theme + ': actual frame/work observations are finite', timing.frames > 0 &&
      Number.isFinite(timing.medianGapMs) && timing.medianGapMs > 0 && Number.isFinite(timing.p95GapMs) &&
      Number.isFinite(timing.meanEngineWorkMs) && timing.meanEngineWorkMs >= 0);
    const audio = await meter();
    check(sample.theme + ': mixed output is finite and not clipped', audio.finite && audio.samples > 0 && audio.clipped === 0 && audio.peak < 0.999);
    check(sample.theme + ': the actual output is not silent', audio.rms > 0.00001);
    const soundState = await read();
    check(sample.theme + ': its authored track and ambience are active', soundState.music === sample.music &&
      soundState.ambience === sample.ambience && soundState.audioState === 'running');
    await page.screenshot({ path: path.join(out, sample.theme + '.png') });
    await page.keyboard.press('m'); await page.waitForFunction(() => DM.Audio.muted);
    // Respect the existing 0.3-second exponential ambience fade and its tails.
    await page.waitForTimeout(2600);
    const mute = await meter(0.4);
    check(sample.theme + ': M silences actual mixed output including ambience', mute.finite && mute.rms < 0.0001);
    await page.keyboard.press('m'); await page.waitForFunction(() => !DM.Audio.muted);
    await page.waitForTimeout(400); const unmute = await meter(0.6);
    check(sample.theme + ': unmute restores unclipped audible output', unmute.finite &&
      unmute.rms > 0.00001 && unmute.clipped === 0 && unmute.peak < 0.999);
    const after = await read();
    check(sample.theme + ': the opening remains healthy with normal damage', !after.error && !after.failed &&
      !after.invulnerable && after.health > 0 && after.challenge === 'normal');
    scenes.push({ ...sample, entry, moved, timing, audio, mute, unmute, after });
    console.log(`MEASURE ${sample.theme}: median ${timing.medianGapMs.toFixed(2)}ms; p95 ${timing.p95GapMs.toFixed(2)}ms; ` +
      `approx ${timing.approximateFps.toFixed(1)}fps; measured work ${timing.meanEngineWorkMs.toFixed(2)}ms; ` +
      `effective ${timing.effectiveQualities.join('/')}; RMS ${audio.rms.toFixed(6)}.`);
  }
  check('no browser or engine errors across all three authored locations', errors.length === 0 && !(await read()).error);
  report.status = 'passed';
  console.log(`AFTER MIDNIGHT PERFORMANCE PASSED: ${checks.length} checks (${build}, ${cpu}x, ${quality}).`);
} catch (error) {
  report.status = 'failed'; report.failure = String(error.stack || error);
  try { report.lastState = await read(); await page.screenshot({ path: path.join(out, 'failure.png') }); } catch (_) {}
  console.error(error); process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
