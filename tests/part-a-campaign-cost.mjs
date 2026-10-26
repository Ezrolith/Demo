/* Part A1 paired campaign-cost diagnostic.
 * node tests/part-a-campaign-cost.mjs [baseline-root] [current-root] [--ablate]
 * Runs browser pages sequentially. No assertions in visual.mjs are changed.
 * The timing function below is loaded verbatim from that suite at runtime.
 * Profiles and optional ablations are diagnostics, not acceptance substitutes.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const positional = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const roots = {
  baseline: path.resolve(positional[0] || process.env.PART_A_BASELINE_ROOT || '/private/tmp/watchmen-part-a-baseline'),
  current: path.resolve(positional[1] || here),
};
const out = path.resolve(process.env.PART_A_OUT || path.join(here, 'tests/out/part-a/campaign-cost.json'));
const source = readFileSync(path.join(here, 'tests/visual.mjs'), 'utf8');
const benchmarkSource = source.match(/async function postFxCost\(p\) \{[\s\S]*?\n\}/)?.[0];
if (!benchmarkSource) throw new Error('Cannot locate the unchanged postFxCost function in visual.mjs.');
const postFxCost = new Function('return (' + benchmarkSource + ');')();
const within = cost => cost.on <= cost.off * 1.15 || cost.on - cost.off <= 1;
for (const [name, root] of Object.entries(roots)) {
  if (!existsSync(path.join(root, 'index.html'))) throw new Error(name + ' index.html missing: ' + root);
}
mkdirSync(path.dirname(out), { recursive: true });
const browser = await pw.chromium.launch();
const report = {
  createdAtUtc: new Date().toISOString(),
  browser: browser.version(),
  roots,
  scene: { chapter: 'mars', stage: 1, dpr: 2, viewport: { width: 1280, height: 720 }, liveWarmupMs: 3000 },
  method: 'Exact visual.mjs postFxCost; three sequential paired runs, alternating root order.',
  benchmarkFunctionSha256: createHash('sha256').update(benchmarkSource).digest('hex'),
  threshold: { postFxRelative: 1.15, postFxAbsoluteAllowanceMs: 1, campaignBaselineRelative: 1.05 },
  runs: [],
  ablations: [],
  errors: [],
};

async function open(root, label) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2,
  });
  page.on('pageerror', error => report.errors.push({ label, error: String(error) }));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?dev');
  await page.waitForFunction(() => window.DM && window.DM.dev);
  await page.mouse.click(640, 360);
  await page.evaluate(() => { window.DM.Engine.governor.enabled = false; });
  await page.evaluate(() => window.DM.dev.start('mars', 1));
  await page.waitForTimeout(3000);
  return page;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const DM = window.DM, E = DM.Engine, play = DM.dev.play(), w = play.world;
    return {
      chapter: play.chapter.id,
      stage: play.ctx.stageIndex,
      map: w.mapId,
      dialog: play.dialog.active,
      locked: play.player.locked,
      entities: w.entities.length,
      particles: w.particles.list.length,
      powerDefinitions: DM.Powers.list.length,
      ownedPowers: Object.keys(play.player.powers),
      lighting: w.lighting,
      lights: DM.Lighting.stats.lights,
      dpr: E.dpr,
      width: E.canvas.width,
      height: E.canvas.height,
      governorEnabled: E.governor.enabled,
      error: E.error ? String(E.error) : null,
    };
  });
}

async function cost(page) {
  const attempts = [await postFxCost(page)];
  // Retain the suite's existing shared-machine retry and expose both attempts.
  if (!within(attempts[0])) attempts.push(await postFxCost(page));
  const final = attempts.at(-1);
  return { ...final, attempts, postFxPass: within(final) };
}

async function profile(page) {
  return page.evaluate(() => {
    const DM = window.DM, E = DM.Engine, play = DM.dev.play();
    const timings = {}, restores = [];
    function wrap(label, object, key) {
      if (!object || typeof object[key] !== 'function') return;
      const original = object[key];
      const stats = timings[label] = { calls: 0, totalMs: 0 };
      object[key] = function (...args) {
        const before = performance.now();
        try { return original.apply(this, args); }
        finally { stats.calls++; stats.totalMs += performance.now() - before; }
      };
      restores.push(() => { object[key] = original; });
    }
    wrap('playUpdate', play, 'update');
    wrap('worldUpdate', play.world, 'update');
    wrap('playerUpdate', DM.Player.prototype, 'update');
    wrap('engineRender', E, 'render');
    wrap('worldRender', play.world, 'render');
    wrap('hudPowers', DM.HUD.prototype, 'renderPowers');
    wrap('playerEffects', DM.Player.prototype, 'renderFx');
    wrap('lighting', DM.Lighting, 'render');
    wrap('weather', DM.Weather, 'render');
    wrap('postFx', DM.Gfx, 'postFx');
    let flushMs = 0;
    const frames = 80;
    try {
      for (let frame = 0; frame < frames; frame++) {
        play.update(1 / 60);
        E.render();
        const before = performance.now();
        E.ctx.getImageData(0, 0, 1, 1);
        flushMs += performance.now() - before;
        DM.Input.endFrame();
      }
    } finally {
      for (const restore of restores.reverse()) restore();
    }
    for (const stats of Object.values(timings)) {
      stats.perFrameMs = +(stats.totalMs / frames).toFixed(4);
      stats.totalMs = +stats.totalMs.toFixed(4);
    }
    return {
      frames, timings, forcedFlushPerFrameMs: +(flushMs / frames).toFixed(4),
      caution: 'Inclusive diagnostic timings add instrumentation overhead; deferred canvas work appears in forced flush.',
    };
  });
}

try {
  for (let run = 1; run <= 3; run++) {
    const result = { run, order: run % 2 ? ['baseline', 'current'] : ['current', 'baseline'] };
    for (const name of result.order) {
      const page = await open(roots[name], name + '-' + run);
      try {
        const before = await snapshot(page);
        const measured = await cost(page);
        const after = await snapshot(page);
        result[name] = { ...measured, before, after };
        if (run === 3) result[name].profile = await profile(page);
        console.log(`${name} run=${run} postFx=${measured.on} none=${measured.off} ms/frame pass=${measured.postFxPass}`);
      } finally { await page.close(); }
    }
    result.campaignOffRatio = +(result.current.off / result.baseline.off).toFixed(5);
    result.campaignWithin5Percent = result.current.off <= result.baseline.off * 1.05;
    report.runs.push(result);
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }

  if (process.argv.includes('--ablate')) {
    for (const variant of ['no-am-gear', 'cached-icons', 'no-am-gear-and-cached-icons']) {
      const page = await open(roots.current, variant);
      try {
        await page.evaluate(variant => {
          const DM = window.DM;
          if (variant.includes('no-am-gear')) {
            DM.Powers.list = DM.Powers.list.filter(def => !def.id.startsWith('am_'));
          }
          if (variant.includes('cached-icons')) {
            for (const def of DM.Powers.list) {
              if (!def.icon) def.icon = (g, x, y, size, color, time) => DM.Gfx.icon(g, def.id, x, y, size, color, time);
            }
          }
        }, variant);
        const before = await snapshot(page);
        const measured = await cost(page);
        report.ablations.push({ variant, before, ...measured, profile: await profile(page) });
        console.log(`diagnostic ${variant} postFx=${measured.on} none=${measured.off} ms/frame`);
      } finally { await page.close(); }
    }
  }
  report.acceptance = {
    threePairedRuns: report.runs.length === 3,
    currentPostFxThreePasses: report.runs.every(run => run.current.postFxPass),
    baselinePostFxThreePasses: report.runs.every(run => run.baseline.postFxPass),
    campaignWithin5PercentAllRuns: report.runs.every(run => run.campaignWithin5Percent),
    noBrowserErrors: report.errors.length === 0,
  };
  report.passed = Object.values(report.acceptance).every(Boolean);
  console.log(`PART A CAMPAIGN COST ${report.passed ? 'PASSED' : 'FAILED'}: ${JSON.stringify(report.acceptance)}`);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
  console.error(error);
} finally {
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
