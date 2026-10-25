/* Platform probes: controlled stage entries, real input and RAF; not a human playthrough. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
} catch (_) {
  pw = require('/opt/pyvenv/lib/python3.13/site-packages/playwright/driver/package');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');
const target = process.argv.find(a => a.endsWith('.html')) || 'index.html';
const offline = process.argv.includes('--offline');
const cpu = Number(process.env.QA_CPU || 1);
const quality = process.env.QA_QUALITY || 'high';
assert.ok(['high', 'balanced', 'low'].includes(quality), 'known quality');
const slug = `${engine}-${target.startsWith('dist/') ? 'dist' : 'source'}-${cpu}x-${quality}`;
const out = path.join(root, 'tests/out/platform-qa', slug);
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true,
  ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}),
  ...(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [], checks = [], scenes = [];
const report = { engine, version: browser.version(), target, cpuSlowdown: cpu, quality,
  mode: offline ? 'inlined scripts, memory storage' : 'normal file navigation, browser storage',
  checks, errors, scenes, limitations: ['Known stage entries, not first-time human play.',
    'WebKit is not branded macOS Safari; CPU throttling is not a physical low-end device.'] };
page.on('pageerror', e => errors.push(String(e)));
report.console = [];
page.on('console', m => {
  if (['warning', 'error'].includes(m.type())) report.console.push(m.text());
});
const check = (name, ok) => {
  assert.ok(ok, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const read = () => page.evaluate(() => {
  const p = DM.dev.play();
  return { scene: DM.Engine.top()?.constructor.name, map: p?.world?.map?.id,
    x: p?.player.x, y: p?.player.y, hp: p?.player.coherence,
    failed: p?.failed, paused: p && DM.Engine.top() !== p, dialog: p?.dialog.active,
    time: p?.world.realTime, error: DM.Engine.error ? String(DM.Engine.error) : null };
});
async function settle() {
  // Chapter generators may schedule their first dialogue after one update.
  await page.waitForTimeout(450);
  let calmSince = 0;
  for (let i = 0; i < 100; i++) {
    const busy = await page.evaluate(() => {
      const p = DM.dev.play();
      return !p || DM.Engine.top() !== p || p.dialog.active || p.ctx.locked || DM.Engine.fading;
    });
    if (busy) {
      calmSince = 0;
      await page.keyboard.press('e');
    } else {
      calmSince++;
      if (calmSince >= 6) return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error('stage did not release control');
}
async function stage(id, index) {
  await page.evaluate(([id, index]) => {
    DM.Save.settings.focusPause = false;
    DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.invulnerable = false;
    DM.Save.settings.challenge = 'normal';
    DM.Engine.set(new DM.Scenes.Play(), { chapter: id, stage: index });
  }, [id, index]);
  await settle();
}
async function meter(seconds = 2) {
  return page.evaluate(async seconds => {
    const a = DM.Audio, an = a.ctx.createAnalyser();
    an.fftSize = 2048;
    a.compressor.connect(an);
    const samples = new Float32Array(an.fftSize);
    let peak = 0, sum = 0, n = 0, clipped = 0;
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end) {
      an.getFloatTimeDomainData(samples);
      for (const x of samples) {
        peak = Math.max(peak, Math.abs(x));
        sum += x * x;
        if (Math.abs(x) >= 0.999) clipped++;
        n++;
      }
      await new Promise(r => setTimeout(r, 30));
    }
    a.compressor.disconnect(an);
    an.disconnect();
    return { peak, rms: Math.sqrt(sum / Math.max(1, n)), clipped, samples: n };
  }, seconds);
}
let renamed;
try {
  if (offline) {
    await page.evaluate(() => {
      const store = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = String(v),
        removeItem: k => delete store[k], clear: () => Object.keys(store).forEach(k => delete store[k]),
      } });
    });
    let html = readFileSync(path.join(root, target), 'utf8');
    html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
      '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
    await page.setContent(html.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
  } else {
    await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => window.DM?.dev);
  check('game boots without engine errors', !(await read()).error);
  // A genuine input gesture, not an autoplay-policy override.
  await page.mouse.click(640, 360);
  await page.waitForTimeout(200);
  report.audioAfterFirstClick = await page.evaluate(() => ({
    state: DM.Audio.ctx?.state, time: DM.Audio.ctx?.currentTime, rate: DM.Audio.ctx?.sampleRate,
    active: navigator.userActivation?.isActive, hidden: document.hidden,
  }));
  if (report.audioAfterFirstClick.state !== 'running') await page.keyboard.press('z');
  await page.waitForFunction(() => DM.Audio.ctx?.state === 'running', null, { timeout: 10000 });
  check('audio unlocks from actual user input', await page.evaluate(() => DM.Audio.ctx.state === 'running'));
  if (cpu !== 1) {
    assert.equal(engine, 'chromium', 'CPU throttle requires Chromium CDP');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  await page.evaluate(quality => {
    DM.Save.settings.focusPause = false;
    DM.Save.settings.quality = quality;
    DM.Engine.resize();
    DM.Engine.set(new DM.Scenes.BonusMenu());
  }, quality);
  await page.waitForTimeout(400);
  check('all three cards are present', await page.evaluate(() => DM.Bonus.list.length === 3));
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(100);
  check('keyboard selects another adventure', await page.evaluate(() => DM.Bonus.selectedId === 'ninth_minute'));
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => DM.Bonus.selectedId === 'long_summer');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.Interlude ||
    DM.dev.play()?.chapter.id === 'long_summer', null, { timeout: 5000 });
  check('selected adventure opens through the real menu', await page.evaluate(() =>
    DM.Engine.top() instanceof DM.Scenes.Interlude || DM.dev.play()?.chapter.id === 'long_summer'));

  const ids = ['last_broadcast', 'ninth_minute', 'long_summer'];
  for (const id of ids) {
    for (let index = 0; index < 3; index++) {
      await stage(id, index);
      const before = await read();
      await page.keyboard.down('d');
      await page.waitForTimeout(450);
      await page.keyboard.up('d');
      const moved = await read();
      check(`${id}/${index}: real movement is accepted`, Math.abs(moved.x - before.x) > 5);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const pausedAt = await read();
      await page.waitForTimeout(250);
      check(`${id}/${index}: pause freezes simulation`, pausedAt.paused && (await read()).time === pausedAt.time);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      check(`${id}/${index}: resume restores control`, !(await read()).paused);
      await page.keyboard.down('f');
      await page.waitForTimeout(300);
      const sight = await page.evaluate(() => DM.dev.play().world.timeScale);
      await page.keyboard.up('f');
      check(`${id}/${index}: Sight slows the world`, sight < 0.9);
      await page.keyboard.press('h');
      // Measure real frames without overriding the engine governor or simulation clock.
      const timing = await page.evaluate(async () => {
        const rows = [], deadline = performance.now() + 3500;
        let last = performance.now();
        await new Promise(resolve => {
          function sample(t) {
            rows.push({ gap: t - last, update: DM.Engine.stats.updMs, render: DM.Engine.stats.renderMs });
            last = t;
            if (performance.now() < deadline) requestAnimationFrame(sample);
            else resolve();
          }
          requestAnimationFrame(sample);
        });
        const gaps = rows.map(r => r.gap).filter(x => x > 0).sort((a, b) => a - b);
        const percentile = p => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))];
        return { frames: rows.length, medianGapMs: percentile(0.5), p95GapMs: percentile(0.95),
          meanWorkMs: rows.reduce((s, r) => s + r.update + r.render, 0) / rows.length,
          quality: DM.Engine.qualityTier(), governorDrop: DM.Engine.governor.drop,
          entities: DM.dev.play().world.entities.length };
      });
      const state = await read();
      check(`${id}/${index}: live scene remains error-free`, !state.error && !state.failed && state.hp > 0);
      const audio = await meter(0.5);
      check(`${id}/${index}: output is finite and not clipped`, Number.isFinite(audio.rms) && audio.peak < 0.999);
      scenes.push({ id, index, ...state, timing, audio });
      await page.screenshot({ path: path.join(out, `${id}-${index}.png`) });
    }
  }
  await page.keyboard.press('m');
  await page.waitForFunction(() => DM.Audio.muted);
  // The ambience bus has a 0.3 s exponential fade; measure after its tail.
  await page.waitForTimeout(2600);
  const muted = await meter(0.4);
  report.mute = muted;
  report.muteState = await page.evaluate(() => ({ muted: DM.Audio.muted,
    music: DM.Audio.musicBus.gain.value, sfx: DM.Audio.sfxBus.gain.value,
    ambience: DM.Audio.ambBus.gain.value }));
  check('mute silences the actual output, including ambience', muted.rms < 0.0001);
  await page.keyboard.press('m');
  await page.waitForTimeout(400);
  const audible = await meter(0.5);
  check('unmute restores audible output', audible.rms > 0.00001);
  report.mute = muted;
  report.unmute = audible;

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dr-manhattan.bonus.v1')));
  check('normal stage entry writes a valid bonus checkpoint', saved?.checkpoints?.long_summer?.stage === 2);
  if (!offline) {
    const raw = await page.evaluate(() => localStorage.getItem('dr-manhattan.bonus.v1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.DM?.dev);
    check('reload retains the actual saved bonus record', raw === await page.evaluate(() =>
      localStorage.getItem('dr-manhattan.bonus.v1')));
    // Observation only: file-origin persistence differs between browsers and is not guaranteed.
    if (target.startsWith('dist/')) {
      renamed = path.join(root, 'dist/qa-renamed-copy.html');
      copyFileSync(path.join(root, target), renamed);
      await page.goto(pathToFileURL(renamed).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.DM?.dev);
      report.renamedFileAutoSharesSave = raw === await page.evaluate(() =>
        localStorage.getItem('dr-manhattan.bonus.v1'));
    }
  }
  check('no page errors in all platform probes', errors.length === 0);
  report.status = 'passed';
  console.log(`PLATFORM QA PASSED: ${checks.length} checks (${slug}).`);
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.stack || error);
  try {
    report.lastState = await read();
    report.lastAudio = await page.evaluate(() => ({ state: DM.Audio.ctx?.state,
      time: DM.Audio.ctx?.currentTime, rate: DM.Audio.ctx?.sampleRate }));
  } catch (_) {}
  try { await page.screenshot({ path: path.join(out, 'failure.png') }); } catch (_) {}
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  if (renamed) unlinkSync(renamed);
  await browser.close();
}
