/* Live Glass Palace views at zero, half and full challenge progress.
 * Fresh progress is natural. Half/full saves are prepared through actual Play
 * completion methods with the explicit controlled stats/flags below. They are
 * validation saves, not evidence of natural playthroughs or earned run times.
 * After GP.open(), only real keyboard movement and normal RAF are used: no
 * actor placement, camera edits, health edits, clock steps or invulnerability.
 * node tests/capture-glass-palace.mjs [index.html|dist/dr-manhattan.html]
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.CAPTURE_ROOT || here);
const target = process.argv.find(value => value.endsWith('.html')) || process.env.CAPTURE_TARGET || 'index.html';
const out = path.resolve(process.env.CAPTURE_OUT || path.join(here, 'tests/out/glass-palace-captures'));
const label = process.env.CAPTURE_LABEL || 'current';
assert.match(label, /^[a-zA-Z0-9_-]+$/, 'filename-safe label');
const dpr = Number(process.env.CAPTURE_DPR || 1);
assert.ok([1, 2].includes(dpr), 'CAPTURE_DPR is one or two');
const campaign = ['prologue', 'reassembly', 'superman', 'deterrent', 'mars', 'karnak'];
const bonus = ['last_broadcast', 'ninth_minute', 'long_summer'];
const cases = ['am_dead_air', 'am_undertow', 'am_glass_archive'];
const states = [
  { name: 'zero', count: 0, completions: [] },
  { name: 'half', count: 18, completions: campaign },
  { name: 'full', count: 36, completions: [...campaign, ...bonus, ...cases] },
];
const selected = process.env.CAPTURE_ONLY
  ? states.filter(state => state.name === process.env.CAPTURE_ONLY)
  : states;
assert.ok(selected.length, 'at least one requested state');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const records = [], errors = [], failures = [];
const setup = {
  method: 'Actual Play.completeChapter() paths with controlled completion fixtures, before entering the hub.',
  naturalPlaythrough: false,
  stats: { time: 1, spared: 4, disintegrated: 0, memories: 6 },
  flags: {
    repaired: true, calibrated: true, reassembled: true,
    evidence: 7, engineers: 7, passengers: 6, rescued: 6, heat: 10,
    clues: 7, downloaded: true, departed: true,
    ledger: true, surveyorCaptured: true, archiveReturned: true,
  },
  reassemblyForm: 'manhattan',
  karnakEmitterRefs: [{ dead: true }, { neutralized: true }, { dead: true }, { dead: true }],
  note: 'These fixtures satisfy challenge predicates without playing the levels. No GP challenge or fragment fields are edited.',
};
const report = {
  label,
  target,
  browser: browser.version(),
  dpr,
  method: 'Fresh context per state; normal RAF, one second of real W movement, then ten seconds before raw canvas capture.',
  screenshotMethod: 'Current unmodified game canvas and same-evaluation metadata; no renderer or camera override.',
  controlledCompletionFixture: setup,
  limitations: [
    'Half/full progress comes from controlled completion-fixture saves, not natural playthroughs.',
    'Captures establish live hub behavior and geometry for those saves, not challenge balance or earned times.',
    'Only panes near the live player are refreshed; their render counters and errors are retained.',
  ],
  records,
  errors,
  failures,
};
const save = () => writeFileSync(path.join(out, `capture-${label}.json`), JSON.stringify(report, null, 2) + '\n');
save();
const hash = value => createHash('sha256').update(value === null ? '<null>' : value).digest('hex');

try {
  for (const state of selected) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr,
    });
    await context.addInitScript(() => {
      window.__palaceCaptureWrites = [];
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        window.__palaceCaptureWrites.push(key);
        return set.call(this, key, value);
      };
    });
    const page = await context.newPage();
    const viewErrors = [];
    page.on('pageerror', error => viewErrors.push(String(error)));
    try {
      await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.DM?.GlassPalace?.open && DM.dev);
      await page.mouse.click(640, 360);
      await page.evaluate(() => {
        DM.Save.settings.focusPause = false;
        DM.Save.settings.textSpeed = 'instant';
        DM.Save.settings.challenge = 'normal';
        DM.Save.settings.invulnerable = false;
      });
      const history = [];
      for (const id of state.completions) {
        const completion = await page.evaluate(({ id, setup }) => {
          const DM = window.DM, GP = DM.GlassPalace, E = DM.Engine;
          const chapter = DM.Chapters.get(id);
          if (chapter.afterMidnight) {
            DM.AfterMidnight.run = DM.AfterMidnight.config({ hero: 'niteowl' }, chapter);
          }
          DM.Input.clearAll();
          E.set(new DM.Scenes.Play(), { chapter: id, stage: 0 });
          const play = DM.dev.play();
          if (!play || play.chapter !== chapter || play.failed || play.player.down || play.player.godMode) {
            throw new Error('Ordinary completion fixture could not start: ' + id);
          }
          play.ctx.stats = { ...setup.stats };
          Object.assign(play.ctx.flags, setup.flags);
          if (id === 'reassembly') play.player.setForm(setup.reassemblyForm);
          if (id === 'karnak') play.ctx.refs.emitters = setup.karnakEmitterRefs.map(value => ({ ...value }));
          play.completeChapter();
          return {
            id,
            status: GP.status(id).earned,
            fragments: GP.fragmentCount(),
            completionMethod: 'Play.completeChapter',
            stage: play.ctx.stageIndex,
            stats: { ...play.ctx.stats },
            flags: { ...setup.flags },
            health: play.player.coherence,
            maxHealth: play.player.maxCoherence,
            godMode: !!play.player.godMode,
          };
        }, { id, setup });
        assert.equal(completion.status, 3, 'fixture completion satisfies three declared challenges: ' + id);
        history.push(completion);
      }
      const before = await page.evaluate(() => {
        const GP = DM.GlassPalace;
        return Object.fromEntries(Object.values(GP.sourceKeys).map(key => [key, localStorage.getItem(key)]));
      });
      await page.evaluate(() => {
        window.__palaceCaptureWrites = [];
        DM.GlassPalace.open();
      });
      await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.GlassPalace && DM.Engine.top().world);
      const entry = await page.evaluate(() => {
        const scene = DM.Engine.top();
        return {
          wallTime: performance.now(), worldTime: scene.world.time,
          x: scene.player.x, y: scene.player.y, fragments: DM.GlassPalace.fragmentCount(),
        };
      });
      assert.equal(entry.fragments, state.count, 'actual completion history derives the requested fragment state');
      await page.keyboard.down('w');
      await page.waitForTimeout(1000);
      await page.keyboard.up('w');
      const start = await page.evaluate(() => {
        const scene = DM.Engine.top();
        return {
          wallTime: performance.now(), worldTime: scene.world.time, realTime: scene.world.realTime,
          x: scene.player.x, y: scene.player.y,
        };
      });
      await page.waitForTimeout(10000);
      const captured = await page.evaluate(({ start, entry }) => {
        const scene = DM.Engine.top();
        if (!(scene instanceof DM.Scenes.GlassPalace)) throw new Error('Hub was interrupted before capture.');
        const world = scene.world, player = scene.player, E = DM.Engine, GP = DM.GlassPalace;
        const preview = scene.panes.map(pane => ({
          id: pane.moment.id,
          renders: pane.preview.renders,
          sourceMap: pane.preview.sourceMap,
          error: pane.preview.error,
          usingLevelBuilder: !!pane.preview.world &&
            pane.preview.sourceBuilder === pane.moment.chapter.maps[pane.preview.sourceMap],
        }));
        return {
          png: E.canvas.toDataURL('image/png').split(',')[1],
          metadata: {
            wallSeconds: (performance.now() - start.wallTime) / 1000,
            worldSeconds: world.time - start.worldTime,
            worldRealSeconds: world.realTime - start.realTime,
            wallSecondsSinceHubEntry: (performance.now() - entry.wallTime) / 1000,
            walk: { input: 'W', heldMs: 1000, from: { x: entry.x, y: entry.y }, to: { x: start.x, y: start.y } },
            fragmentCount: GP.fragmentCount(),
            structureCount: scene.structureCount,
            structurePieces: scene.structurePieces.length,
            structureRise: scene.structure.rise,
            ledger: GP.ledger(),
            epilogueUnlocked: GP.epilogueReady(),
            hero: {
              x: player.x, y: player.y, health: player.coherence, maxHealth: player.maxCoherence,
              down: !!player.down, godMode: !!player.godMode, form: player.form,
            },
            camera: {
              x: world.camera.x, y: world.camera.y, zoom: world.camera.zoom,
              ox: world.camera.ox, oy: world.camera.oy,
            },
            settings: {
              challenge: DM.Save.settings.challenge,
              invulnerable: DM.Save.settings.invulnerable,
              requestedQuality: DM.Save.settings.quality,
              effectiveQuality: E.qualityTier(),
              governorEnabled: E.governor.enabled,
              effectiveDpr: E.dpr,
            },
            canvas: { width: E.canvas.width, height: E.canvas.height },
            noCombatActors: world.entities.every(entity => entity.team !== 'enemy' && !entity.isProjectile),
            preview,
            sourceAfter: Object.fromEntries(Object.values(GP.sourceKeys).map(key => [key, localStorage.getItem(key)])),
            writes: [...window.__palaceCaptureWrites],
            error: E.error ? String(E.error.stack || E.error) : null,
          },
        };
      }, { start, entry });
      const filename = `palace-${state.count}-fragments-${label}-live.png`;
      writeFileSync(path.join(out, filename), Buffer.from(captured.png, 'base64'));
      const metadata = captured.metadata;
      const sourceUnchanged = JSON.stringify(before) === JSON.stringify(metadata.sourceAfter);
      const sourceWrites = metadata.writes.filter(key => Object.hasOwn(before, key));
      delete metadata.sourceAfter;
      const record = {
        state: state.name,
        screenshot: filename,
        preparation: state.count === 0 ? 'Fresh game; no completion fixtures.' : 'Controlled completion-fixture progress.',
        progressPreparedByFixture: state.count !== 0,
        naturalLevelPlaythroughsClaimed: false,
        completionHistory: history,
        sourceSlotIntegrity: {
          byteIdentical: sourceUnchanged,
          writes: sourceWrites,
          sha256: Object.fromEntries(Object.entries(before).map(([key, value]) => [key, hash(value)])),
        },
        ...metadata,
        browserErrors: viewErrors,
      };
      records.push(record);
      for (const error of [record.error, ...viewErrors].filter(Boolean)) errors.push({ state: state.name, error });
      const fail = reason => failures.push({ state: state.name, reason });
      if (record.wallSeconds < 10 || record.worldSeconds <= 0) fail('Not a ten-second live simulation view.');
      if (!sourceUnchanged || sourceWrites.length) fail('The hub wrote an original source slot.');
      if (record.fragmentCount !== state.count || record.structureCount !== state.count ||
        record.structurePieces !== state.count) fail('Geometry did not match earned fragments.');
      if (record.hero.godMode || record.hero.down || record.hero.health <= 0 ||
        record.settings.invulnerable || record.settings.challenge !== 'normal') fail('Ordinary live state was not retained.');
      if (!record.noCombatActors) fail('The hub contained combat actors.');
      if (record.walk.to.y >= record.walk.from.y - 20) fail('Real W input did not move Jon toward the centre.');
      if (record.preview.some(value => value.error)) fail('A live level preview reported an error.');
      save();
      console.log(`LIVE PALACE ${state.count}: ${record.wallSeconds.toFixed(2)}s, ` +
        `${record.structurePieces} pieces, ${record.preview.length} panes, original slots unchanged=${sourceUnchanged}`);
    } finally {
      await context.close();
    }
  }
  assert.equal(errors.length, 0, 'no browser or engine errors');
  assert.equal(failures.length, 0, 'all captures meet their declared live evidence conditions');
  console.log(`GLASS PALACE LIVE CAPTURE PASSED: ${records.length} views (${label}).`);
} catch (error) {
  report.error = String(error.stack || error);
  console.error(error);
  process.exitCode = 1;
} finally {
  save();
  await browser.close();
}
