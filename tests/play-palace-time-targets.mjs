/* Real-input, Normal-damage time-target audit. Only initial unlock/settings
 * fixtures are written before boot. Later browser evaluations read telemetry;
 * all gameplay changes come from real keyboard/mouse actions and normal RAF.
 * Failed/unsupported routes remain explicit and never become passing records.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = key => process.argv.find(value => value.startsWith('--' + key + '='))?.split('=').slice(1).join('=');
const target = process.argv.find(value => value.endsWith('.html')) || 'index.html';
const all = ['prologue', 'reassembly', 'superman', 'deterrent', 'mars', 'karnak',
  'last_broadcast', 'ninth_minute', 'long_summer', 'am_dead_air', 'am_undertow', 'am_glass_archive'];
const selected = option('moments')?.split(',') || all;
if (selected.some(id => !all.includes(id))) throw Error('Choose canonical moment IDs.');
const build = target.includes('dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/palace-time-targets', build, option('run') || 'all');
mkdirSync(out, { recursive: true });
async function loadRoutes() {
  const routes = {};
  for (const file of readdirSync(path.join(root, 'tests/helpers')).filter(name =>
    name.startsWith('palace-real-input-') && name.endsWith('.mjs')).sort()) {
    const filename = path.join(root, 'tests/helpers', file);
    const module = await import(pathToFileURL(filename).href + '?revision=' + statSync(filename).mtimeMs);
    Object.assign(routes, module.routes || module.bonusRoutes || {});
  }
  return routes;
}
const hash = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const sourceHash = () => {
  const scripts = [...readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  const digest = createHash('sha256');
  for (const file of scripts) digest.update(file + '\0' + readFileSync(path.join(root, file)));
  return { scripts: scripts.length, sha256: digest.digest('hex') };
};
const report = { target, startedAtUtc: new Date().toISOString(), runs: [],
  sourceIndexSha256: hash('index.html'), standaloneSha256: hash('dist/dr-manhattan.html'),
  method: 'Actual menus, keyboard/mouse, Normal damage, normal RAF and read-only telemetry. ' +
    'Only initial campaign unlock/settings and empty optional progress fixtures are written before boot.',
  limitations: 'A known-route automation run is not an unfamiliar human playtest. Route failures are not proof of an unwinnable level.',
};
const save = () => writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
const browser = await pw.chromium.launch({ headless: true });
report.browser = browser.version();
save();
async function entry(pilot, id) {
  const page = pilot.page;
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.Engine.top(), null, { polling: 100 });
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => DM.Engine.top().gate === false, null, { polling: 50 });
  if (id.startsWith('am_')) {
    await pilot.menu('AFTER MIDNIGHT');
    await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu);
    const hero = id === 'am_glass_archive' ? 'rorschach' : 'silkspectre';
    const heroPoint = await pilot.data(hero => {
      const board = DM.Engine.top();
      const index = DM.AfterMidnight.heroes.findIndex(value => value.id === hero);
      const rect = board.heroRect(index);
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    }, hero);
    await page.mouse.click(heroPoint.x, heroPoint.y);
    await page.waitForTimeout(100);
    await pilot.menu('CHOOSE A CASE OR MODE');
    const point = await pilot.data(id => {
      const board = DM.Engine.top();
      const index = board.choices().findIndex(value => value.id === id.slice(3));
      const rect = board.caseRect(index);
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    }, id);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(100);
    await pilot.menu('OPEN CASE FILE');
  } else if (['last_broadcast', 'ninth_minute', 'long_summer'].includes(id)) {
    await pilot.menu('BONUS LEVELS');
    await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.BonusMenu);
    const point = await pilot.data(id => {
      const menu = DM.Engine.top();
      const index = DM.Bonus.list.findIndex(chapter => chapter.id === id);
      const rect = menu.cardRect(index);
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    }, id);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(100);
    await pilot.menu('PLAY ');
  } else if (id === 'prologue') await pilot.menu('NEW GAME');
  else {
    await pilot.menu('CHAPTERS');
    await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.ChapterSelect);
    const point = await pilot.data(id => {
      const screen = DM.Engine.top();
      const index = screen.cards.findIndex(card => card.c.id === id);
      const rect = screen.rect(index);
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    }, id);
    await page.mouse.click(point.x, point.y);
  }
  await pilot.until('normal menu/interlude enters ' + id, state => state.chapter === id && state.onTop, 20000);
}
try {
  for (const id of selected) {
    const routes = await loadRoutes();
    if (!routes[id]) {
      report.runs.push({ momentId: id, status: 'unverified', reason: 'No admissible real-input route is implemented yet.' });
      save();
      continue;
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const pilotFile = path.join(root, 'tests/helpers/palace-real-input.mjs');
    const { RealInputPilot } = await import(pathToFileURL(pilotFile).href + '?revision=' + statSync(pilotFile).mtimeMs);
    const pilot = new RealInputPilot(page, id, { timeoutMs: Number(option('max-seconds') || 1200) * 1000 });
    const unlock = ['reassembly', 'superman', 'deterrent', 'mars', 'karnak'].includes(id) ? 5 : 0;
    const fixture = { campaign: { version: 2, reached: unlock, completed: {}, checkpoints: {}, checkpoint: null,
      seen: { unlocks: {} }, totals: { spared: 0, disintegrated: 0, memories: 0, decoherences: 0 },
      settings: { challenge: 'normal', invulnerable: false, focusPause: false, textSpeed: 'normal' } },
    bonus: { version: 1, completed: {}, checkpoints: {}, deaths: 0 },
    afterMidnight: { version: 1,
      selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
      checkpoints: {}, records: {}, deaths: 0 } };
    const row = { momentId: id, fixture, status: 'running', startedAtUtc: new Date().toISOString(),
      sourceScriptsBefore: sourceHash(), standaloneBefore: hash('dist/dr-manhattan.html'),
      pilotSha256: hash('tests/helpers/palace-real-input.mjs') };
    report.runs.push(row);
    save();
    let lastProgress = 0;
    let activeSince = null;
    pilot.onState = async state => {
      if (state.onTop && activeSince === null) activeSince = Date.now();
      if (process.argv.includes('--capture') && !row.capture && state.onTop && !state.locked && !state.dialog &&
        state.stats?.time >= 10 && activeSince !== null && Date.now() - activeSince >= 10000) {
        const view = await pilot.data(() => {
          const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
          if (DM.Engine.top() !== play || play.player.locked || play.dialog.active || play.failed || play.ctx.done ||
            play.world.realTime < 10) return null;
          return { png: DM.Engine.canvas.toDataURL('image/png'),
            fieldTime: play.ctx.stats.time, worldTime: play.world.realTime,
            x: play.player.x, y: play.player.y, health: play.player.coherence,
            invulnerable: DM.Save.settings.invulnerable, godMode: play.player.godMode,
            stage: play.ctx.stageIndex, chapter: play.chapter.id };
        });
        if (view) {
          const bytes = Buffer.from(view.png.split(',')[1], 'base64');
          const filename = id + '-natural-live.png';
          writeFileSync(path.join(out, filename), bytes);
          const { png, ...metadata } = view;
          row.capture = { filename, bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            elapsedWallSinceFirstPlay: (Date.now() - activeSince) / 1000, ...metadata,
            method: 'Raw canvas after ten wall/field seconds, during normal input and RAF. No actor/camera/state staging.' };
        }
      }
      if (Date.now() - lastProgress < 1000) return;
      lastProgress = Date.now();
      row.lastObserved = state;
      save();
    };
    await page.addInitScript(fixture => {
      localStorage.setItem('dr-manhattan.save', JSON.stringify(fixture.campaign));
      localStorage.setItem('dr-manhattan.bonus.v1', JSON.stringify(fixture.bonus));
      localStorage.setItem('dr-manhattan.after-midnight.v1', JSON.stringify(fixture.afterMidnight));
    }, fixture);
    try {
      await entry(pilot, id);
      await routes[id](pilot);
      await pilot.until('actual completion result', state =>
        ['ChapterComplete', 'BonusComplete', 'NinthComplete', 'SummerComplete', 'Results'].includes(state.scene), 20000);
      const completed = await pilot.data(id => {
        const top = DM.Engine.top();
        const play = DM.Engine.stack.find(scene => scene instanceof DM.Scenes.Play);
        const record = top.record || (DM.Bonus?.data?.completed?.[id]) || DM.Save.data.completed[id];
        const summary = top.glassPalaceSummary || play?.glassPalaceResult || null;
        const stats = record?.stats || top.stats || play?.ctx.stats || record;
        const time = stats?.time ?? record?.time;
        const definition = DM.GlassPalace.challengeDefs(id).find(row => row.id === 'swift' || row.type === 'time');
        return { scene: top.constructor.name, record, summary, stats, time,
          targetSeconds: definition?.targetSeconds, settings: { challenge: DM.Save.settings.challenge,
            invulnerable: DM.Save.settings.invulnerable }, engineError: DM.Engine.error ? String(DM.Engine.error) : null };
      }, id);
      if (!(completed.time > 0 && completed.targetSeconds > 0)) throw Error('Completion lacks an authoritative field time/target.');
      row.status = 'completed';
      row.completion = completed;
      row.headroomSeconds = completed.targetSeconds - completed.time;
      row.headroomPercent = row.headroomSeconds / completed.targetSeconds * 100;
      row.underTarget = completed.time < completed.targetSeconds;
      row.atLeast25PercentHeadroom = row.headroomPercent >= 25;
      console.log(id + ': completed in ' + completed.time.toFixed(2) + ' / ' + completed.targetSeconds +
        ' s; headroom ' + row.headroomPercent.toFixed(1) + '%');
    } catch (error) {
      row.status = 'route-failed';
      row.error = String(error.stack || error);
      row.lastState = await pilot.state().catch(failure => pilot.lastState || ({ readError: String(failure) }));
      if (row.lastState?.stats?.time >= 10) {
        await page.screenshot({ path: path.join(out, id + '-diagnostic-failure.png') });
      }
      console.error(id + ': route failed; ' + String(error));
    } finally {
      await pilot.release();
      row.minimumHealth = Number.isFinite(pilot.minimumHealth) ? pilot.minimumHealth : null;
      row.wallSeconds = (Date.now() - pilot.beganAt) / 1000;
      row.errors = pilot.errors;
      row.trace = pilot.trace;
      row.actions = pilot.actions;
      row.finishedAtUtc = new Date().toISOString();
      row.sourceScriptsAfter = sourceHash();
      row.standaloneAfter = hash('dist/dr-manhattan.html');
      row.runtimeFilesUnchanged = JSON.stringify(row.sourceScriptsBefore) === JSON.stringify(row.sourceScriptsAfter) &&
        row.standaloneBefore === row.standaloneAfter;
      save();
      await context.close();
    }
  }
} finally { await browser.close(); }
report.finishedAtUtc = new Date().toISOString();
report.allRequestedCompleted = report.runs.every(row => row.status === 'completed');
report.allRequestedHave25PercentHeadroom = report.runs.every(row => row.atLeast25PercentHeadroom);
save();
console.log('TIME TARGET REAL INPUT: ' + report.runs.filter(row => row.status === 'completed').length +
  ' / ' + report.runs.length + ' completed. Unsupported or failed routes remain explicit.');
if (!report.allRequestedCompleted || !report.allRequestedHave25PercentHeadroom) process.exitCode = 1;
