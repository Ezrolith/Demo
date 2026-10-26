/* Live Part A evidence: start a real stage, dismiss its opening with keyboard
 * input, then let normal RAF/gameplay run for at least ten wall-clock seconds.
 * No actor placement, health edits, invulnerability, camera edits or clock steps.
 *
 * CAPTURE_ROOT=/checkout CAPTURE_OUT=/output CAPTURE_LABEL=before node this-file.mjs
 * --all-heroes captures each of the nine views with all three heroes (27 views).
 * --assert-contrast checks the fixed 1.8 luminance metric after saving every view.
 *
 * Fixed contrast metric, declared before visual tuning: median linear-sRGB
 * relative luminance inside a facing-aligned 12x16-world-unit hero ellipse,
 * compared with the median of its 28..48-unit floor annulus. Other character
 * bodies are excluded from floor samples. Baked dressing remains in the sample;
 * percentile/count diagnostics reveal its variation. Ratio=(higher+.05)/(lower+.05).
 * This measures screen-space contrast, not a novice's recognition time.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.CAPTURE_ROOT || path.join(here, '..'));
const label = process.env.CAPTURE_LABEL || 'after';
assert.match(label, /^[a-zA-Z0-9_-]+$/, 'CAPTURE_LABEL is a filename-safe label');
const out = path.resolve(process.env.CAPTURE_OUT || path.join(root, 'tests/out/part-a-captures'));
const target = path.resolve(root, process.env.CAPTURE_TARGET || 'index.html');
const dpr = Number(process.env.CAPTURE_DPR || 1);
assert.ok([1, 2].includes(dpr), 'CAPTURE_DPR is 1 or 2');
const allHeroes = process.argv.includes('--all-heroes');
const assertContrast = process.argv.includes('--assert-contrast');
const threshold = 1.8;
const heroes = ['niteowl', 'silkspectre', 'rorschach'];
const baseViews = [
  { id: 'dead-air', caseId: 'dead_air', hero: 'niteowl', theme: 'rooftops' },
  { id: 'undertow', caseId: 'undertow', hero: 'silkspectre', theme: 'harbour' },
  { id: 'glass-archive', caseId: 'glass_archive', hero: 'rorschach', theme: 'museum' },
  { id: 'patrol-rooftops', caseId: 'patrol', hero: 'niteowl', theme: 'rooftops' },
  { id: 'patrol-harbour', caseId: 'patrol', hero: 'silkspectre', theme: 'harbour' },
  { id: 'patrol-museum', caseId: 'patrol', hero: 'rorschach', theme: 'museum' },
  { id: 'rescue-rooftops', caseId: 'rescue_clock', hero: 'rorschach', theme: 'rooftops' },
  { id: 'rescue-harbour', caseId: 'rescue_clock', hero: 'niteowl', theme: 'harbour' },
  { id: 'rescue-museum', caseId: 'rescue_clock', hero: 'silkspectre', theme: 'museum' },
];
const views = baseViews.flatMap(view => allHeroes ? heroes.map(hero => ({ ...view, hero })) : [view]);
const selectedViews = process.env.CAPTURE_ONLY
  ? views.filter(view => view.id === process.env.CAPTURE_ONLY)
  : views;
assert.ok(selectedViews.length, 'at least one capture view is selected');
mkdirSync(out, { recursive: true });

const browser = await pw.chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const records = [];
const errors = [];
const failures = [];
const report = {
  label,
  target,
  browser: browser.version(),
  requestedDpr: dpr,
  threshold,
  allHeroes,
  method: 'Real stage start, real opening-dialogue keyboard input, ten seconds of live normal-damage RAF.',
  screenshotMethod: 'Untouched current game-canvas pixels; PNG and measurement metadata read in the same evaluation.',
  contrastMetric: {
    colorSpace: 'sRGB channels linearized with the standard 0.04045 transfer breakpoint',
    luminanceWeights: [0.2126, 0.7152, 0.0722],
    hero: 'median luminance in a facing-aligned ellipse, world radii 12 and 16',
    floor: 'median luminance in a 28..48-world-unit annulus, excluding other character bodies',
    dressing: 'Baked floor dressing is retained; no post-observation bright-pixel exclusion.',
    ratio: '(max(hero,floor)+0.05)/(min(hero,floor)+0.05)',
    minimum: threshold,
  },
  limitations: [
    'Initial live stage views, not full playthroughs or every combat/lighting state.',
    'The numerical contrast check cannot establish one-second recognition by a first-time viewer.',
    'The ordinary quality governor remains enabled; effective DPR and tier are recorded.',
  ],
  records,
  errors,
  failures,
};

async function releaseOpening(page, view) {
  let sawDialogue = false;
  let calmFrames = 0;
  for (let i = 0; i < 100; i++) {
    const state = await page.evaluate(() => {
      const play = DM.dev.play();
      return {
        chapter: play?.chapter.id,
        dialog: play?.dialog.active,
        busy: !play || DM.Engine.top() !== play || play.ctx.locked || play.player.locked || DM.Engine.fading,
        error: DM.Engine.error ? String(DM.Engine.error) : null,
      };
    });
    assert.equal(state.error, null, 'opening has no engine error');
    if (state.dialog) {
      sawDialogue = true;
      calmFrames = 0;
      await page.keyboard.press('Space');
    } else if (!state.busy && state.chapter === 'am_' + view.caseId) {
      if (++calmFrames >= 3) return { sawDialogue };
    } else {
      calmFrames = 0;
    }
    await page.waitForTimeout(120);
  }
  throw new Error('Opening did not release ordinary control: ' + view.id);
}

try {
  for (const view of selectedViews) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    const viewErrors = [];
    page.on('pageerror', error => viewErrors.push(String(error)));
    try {
      await page.goto(pathToFileURL(target).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.start);
      await page.mouse.click(640, 360);
      await page.evaluate(view => {
        DM.Save.settings.focusPause = false;
        DM.Save.settings.textSpeed = 'instant';
        DM.Save.settings.challenge = 'normal';
        DM.Save.settings.invulnerable = false;
        DM.Save.settings.quality = 'high';
        DM.Engine.resize();
        DM.AfterMidnight.start(view.caseId, {
          hero: view.hero,
          theme: view.theme,
          instant: true,
        });
      }, view);
      await page.waitForFunction(caseId => DM.dev.play()?.chapter.id === 'am_' + caseId, view.caseId);
      const opening = await releaseOpening(page, view);
      const start = await page.evaluate(() => {
        const play = DM.dev.play();
        return {
          wallTime: performance.now(),
          worldTime: play.world.time,
          realTime: play.world.realTime,
          stage: play.ctx.stageIndex,
          hero: play.player.profile.id,
          health: play.player.coherence,
          x: play.player.x,
          y: play.player.y,
        };
      });
      await page.waitForTimeout(10000);
      const captured = await page.evaluate(({ start, threshold }) => {
        const play = DM.dev.play();
        if (!play) throw new Error('Live play scene is missing');
        const player = play.player;
        const world = play.world;
        const camera = world.camera;
        const engine = DM.Engine;
        const canvas = engine.canvas;
        const scale = camera.zoom * engine.scale * engine.dpr;
        const logical = {
          x: (player.x - camera.x + camera.ox) * camera.zoom + DM.W / 2,
          y: (player.y - camera.y + camera.oy) * camera.zoom + DM.H / 2,
        };
        const center = {
          x: (engine.offX + logical.x * engine.scale) * engine.dpr,
          y: (engine.offY + logical.y * engine.scale) * engine.dpr,
        };
        const radius = 49 * scale;
        const x0 = Math.max(0, Math.floor(center.x - radius));
        const y0 = Math.max(0, Math.floor(center.y - radius));
        const width = Math.min(canvas.width - x0, Math.ceil(radius * 2 + 2));
        const height = Math.min(canvas.height - y0, Math.ceil(radius * 2 + 2));
        const pixels = engine.ctx.getImageData(x0, y0, width, height).data;
        const linear = Array.from({ length: 256 }, (_, n) => {
          const c = n / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        const otherBodies = world.entities.filter(entity => entity !== player && !entity.dead && !entity.hidden &&
          (entity.human || entity.team === 'enemy' || entity.isPlayer || entity.isDuplicate));
        const hero = [];
        const floor = [];
        let excludedBodies = 0;
        const cosine = Math.cos(player.facing);
        const sine = Math.sin(player.facing);
        for (let py = 0; py < height; py++) {
          for (let px = 0; px < width; px++) {
            const dx = (x0 + px + 0.5 - center.x) / scale;
            const dy = (y0 + py + 0.5 - center.y) / scale;
            const localX = dx * cosine + dy * sine;
            const localY = -dx * sine + dy * cosine;
            const inHero = (localX / 12) ** 2 + (localY / 16) ** 2 <= 1;
            const distance = Math.hypot(dx, dy);
            const inFloor = distance >= 28 && distance <= 48;
            if (!inHero && !inFloor) continue;
            if (inFloor && otherBodies.some(entity =>
              Math.hypot(player.x + dx - entity.x, player.y + dy - entity.y) <= Math.max(16, entity.r || 0) + 5)) {
              excludedBodies++;
              continue;
            }
            const at = (py * width + px) * 4;
            const luminance = 0.2126 * linear[pixels[at]] +
              0.7152 * linear[pixels[at + 1]] + 0.0722 * linear[pixels[at + 2]];
            if (inHero) hero.push(luminance);
            else floor.push(luminance);
          }
        }
        const summarize = values => {
          values.sort((a, b) => a - b);
          const percentile = fraction => values[Math.floor((values.length - 1) * fraction)] ?? null;
          return { count: values.length, p10: percentile(0.1), median: percentile(0.5), p90: percentile(0.9) };
        };
        const heroLuminance = summarize(hero);
        const floorLuminance = summarize(floor);
        const enoughPixels = hero.length >= 20 && floor.length >= 100;
        const contrast = enoughPixels ?
          (Math.max(heroLuminance.median, floorLuminance.median) + 0.05) /
          (Math.min(heroLuminance.median, floorLuminance.median) + 0.05) : null;
        return {
          png: canvas.toDataURL('image/png').split(',')[1],
          metadata: {
            wallSeconds: (performance.now() - start.wallTime) / 1000,
            worldSeconds: world.time - start.worldTime,
            worldRealSeconds: world.realTime - start.realTime,
            scene: engine.top()?.constructor.name,
            chapter: play.chapter.id,
            stage: play.ctx.stageIndex,
            map: world.mapId,
            theme: world.amTheme,
            variant: world.amVariant ?? null,
            dialogueActive: play.dialog.active,
            paused: engine.top() !== play,
            failed: !!play.failed,
            hero: {
              id: player.profile.id,
              x: player.x,
              y: player.y,
              facing: player.facing,
              health: player.coherence,
              maxHealth: player.maxCoherence,
              down: !!player.down,
              godMode: !!player.godMode,
              logicalScreen: logical,
              backingScreen: center,
            },
            settings: {
              challenge: DM.Save.settings.challenge,
              invulnerable: DM.Save.settings.invulnerable,
              effects: DM.Save.settings.fx,
              quality: DM.Save.settings.quality,
              effectiveQuality: engine.qualityTier(),
              governorEnabled: engine.governor.enabled,
              effectiveDpr: engine.dpr,
            },
            camera: {
              x: camera.x,
              y: camera.y,
              zoom: camera.zoom,
              ox: camera.ox,
              oy: camera.oy,
            },
            canvas: { width: canvas.width, height: canvas.height },
            contrast: {
              ratio: contrast,
              threshold,
              passed: contrast != null && contrast >= threshold,
              enoughPixels,
              hero: heroLuminance,
              floor: floorLuminance,
              excludedBodyPixels: excludedBodies,
              sampleBounds: { x: x0, y: y0, width, height },
            },
            error: engine.error ? String(engine.error.stack || engine.error) : null,
          },
        };
      }, { start, threshold });
      const name = `${view.id}-${view.hero}-${label}-live.png`;
      writeFileSync(path.join(out, name), Buffer.from(captured.png, 'base64'));
      const record = { view, opening, start, screenshot: name, ...captured.metadata, errors: viewErrors };
      records.push(record);
      const actualErrors = [record.error, ...viewErrors].filter(Boolean);
      errors.push(...actualErrors.map(error => ({ view: view.id, hero: view.hero, error })));
      if (record.wallSeconds < 10 || record.worldSeconds <= 0 || record.paused || record.dialogueActive) {
        failures.push({ view: view.id, hero: view.hero, reason: 'Not an uninterrupted ten-second live capture' });
      }
      if (record.hero.godMode || record.settings.invulnerable || record.settings.challenge !== 'normal') {
        failures.push({ view: view.id, hero: view.hero, reason: 'Ordinary vulnerability was not retained' });
      }
      if (record.failed || record.hero.down || record.hero.health <= 0) {
        failures.push({ view: view.id, hero: view.hero, reason: 'Hero was defeated during the live capture' });
      }
      if (assertContrast && !record.contrast.passed) {
        failures.push({ view: view.id, hero: view.hero, reason: 'Hero contrast is below 1.8', contrast: record.contrast });
      }
      console.log(`LIVE ${view.id}/${view.hero}: ${record.wallSeconds.toFixed(2)}s, ` +
        `health ${record.hero.health.toFixed(2)}, contrast ${record.contrast.ratio?.toFixed(3) ?? 'unavailable'}`);
    } finally {
      await context.close();
    }
  }
  writeFileSync(path.join(out, `capture-${label}.json`), JSON.stringify(report, null, 2));
  assert.equal(errors.length, 0, 'live captures have no browser or engine errors');
  assert.equal(failures.length, 0, 'live captures meet the requested evidence conditions');
  console.log(`AFTER MIDNIGHT LIVE CAPTURE PASSED: ${records.length} views (${label}).`);
} catch (error) {
  report.error = String(error.stack || error);
  writeFileSync(path.join(out, `capture-${label}.json`), JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
