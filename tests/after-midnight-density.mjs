/* Part A3 layout acceptance. Real map builders; controlled entry, no screenshots.
 * Checks every critical sliding 400 logical-pixel window against baked props,
 * plus collision/art agreement, safe spawn paths and both replay presets.
 * node tests/after-midnight-density.mjs [index.html|dist/dr-manhattan.html]
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
const out = path.join(root, 'tests/out/after-midnight-density', target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const checks = [];
const errors = [];
const layouts = [];
page.on('pageerror', error => errors.push(String(error)));
function check(name, pass) {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS ' + name);
}

try {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.AfterMidnight?.CaseArt?.layout && DM.dev, null, { polling: 100 });
  const original = await page.evaluate(() => ({
    campaign: localStorage.getItem('dr-manhattan.save'),
    bonus: localStorage.getItem('dr-manhattan.bonus.v1'),
  }));
  const cases = [
    { id: 'dead_air', theme: 'rooftops' },
    { id: 'undertow', theme: 'harbour' },
    { id: 'glass_archive', theme: 'museum' },
  ];
  const entries = [...cases.map(entry => ({ ...entry, attempt: 0 }))];
  for (const id of ['patrol', 'rescue_clock']) {
    for (const theme of ['rooftops', 'harbour', 'museum']) {
      for (const attempt of [0, 1]) entries.push({ id, theme, attempt });
    }
  }
  for (const entry of entries) {
    const result = await page.evaluate(entry => {
      const DM = window.DM;
      const AM = DM.AfterMidnight;
      const data = AM.load();
      const chapter = AM.byId[entry.id];
      const run = AM.config({ hero: 'niteowl', theme: entry.theme }, chapter);
      const key = AM.slot(entry.id, run);
      if (chapter.kind !== 'story') data.records[key] = { attempts: entry.attempt };
      DM.Input.clearAll();
      DM.Engine.fade.a = 0;
      DM.Engine.fade.dir = 0;
      AM.start(entry.id, { hero: 'niteowl', theme: entry.theme, instant: true });
      const play = DM.dev.play();
      const world = play.world;
      const props = world.amDressing;
      const bounds = world.amPlayableBounds;
      const span = 400 / world.baseZoom;
      // A window can become empty only after crossing a prop centre or the
      // centre minus the span. Test both sides of every such boundary.
      function critical(axis, length) {
        const start = bounds[axis];
        const end = start + bounds[length] - span;
        const positions = new Set([start, end]);
        for (const prop of props) {
          const centre = prop[axis] + prop[length] / 2;
          for (const position of [centre, centre - span]) {
            for (const offset of [-0.001, 0.001]) {
              positions.add(Math.max(start, Math.min(end, position + offset)));
            }
          }
        }
        return [...positions];
      }
      const xs = critical('x', 'w');
      const ys = critical('y', 'h');
      let empty = null;
      let windows = 0;
      for (const x of xs) {
        for (const y of ys) {
          windows++;
          const populated = props.some(prop => {
            const cx = prop.x + prop.w / 2;
            const cy = prop.y + prop.h / 2;
            return cx >= x && cx <= x + span && cy >= y && cy <= y + span;
          });
          if (!populated && !empty) empty = { x, y, w: span, h: span };
        }
      }
      const validProps = props.every(prop => {
        const values = [prop.x, prop.y, prop.w, prop.h];
        return values.every(Number.isFinite) && prop.w >= 24 && prop.h >= 24 && prop.w * prop.h >= 1000;
      });
      const artMatchesWalls = props.filter(prop => prop.solid).every(prop => world.walls.some(wall =>
        wall.kind === 'low' && ['x', 'y', 'w', 'h'].every(key => wall[key] === prop[key])));
      const points = [...world.amSpawnPoints, ...world.amRescueSpawns, world.amSafePoint];
      const safeSeeds = points.every(point => world.isFree(point.x, point.y, 18));
      const connected = points.every(point => AM.findCasePath(world, world.spawn, point).length > 0);
      const clearArrival = props.filter(prop => !['tower', 'crane'].includes(prop.kind)).every(prop => {
        const x = Math.max(prop.x, Math.min(world.spawn.x, prop.x + prop.w));
        const y = Math.max(prop.y, Math.min(world.spawn.y, prop.y + prop.h));
        return Math.hypot(x - world.spawn.x, y - world.spawn.y) >= 80;
      });
      const mapLights = [];
      world.atmosphere.light.lights(world, (x, y, r, options) => {
        mapLights.push({ x, y, r, color: options.color, intensity: options.i });
      });
      return {
        ...entry,
        variant: world.amVariant,
        lighting: world.amLightingState,
        mapLights: mapLights.slice(0, 4),
        covers: world.amCoverLayout,
        kinds: [...new Set(props.map(prop => prop.kind))],
        props: props.length,
        floorBaked: !!world.floorCanvas,
        windows,
        empty,
        validProps,
        artMatchesWalls,
        safeSeeds,
        connected,
        clearArrival,
        error: DM.Engine.error ? String(DM.Engine.error) : null,
      };
    }, entry);
    layouts.push(result);
    const name = entry.id + '/' + entry.theme + '/' + entry.attempt;
    check(name + ': baked real set dressing covers every critical 400px window',
      result.floorBaked && result.props >= 28 && result.validProps && !result.empty && result.windows > 100);
    check(name + ': visible cover matches actual collision and leaves arrival/path seeds clear',
      result.artMatchesWalls && result.safeSeeds && result.connected && result.clearArrival && !result.error);
    const required = entry.theme === 'rooftops' ? ['tower', 'aerial', 'skylight', 'puddle', 'neon']
      : entry.theme === 'harbour' ? ['crate', 'bollards', 'rope', 'crane', 'bell']
        : ['cover', 'plinth', 'barrier', 'painting', 'rug'];
    check(name + ': contains the requested themed furniture', required.every(kind => result.kinds.includes(kind)));
  }
  for (const id of ['patrol', 'rescue_clock']) {
    for (const theme of ['rooftops', 'harbour', 'museum']) {
      const variants = layouts.filter(entry => entry.id === id && entry.theme === theme);
      const [a, b] = variants;
      check(id + '/' + theme + ': both presets change cover and real lighting state',
        a.variant !== b.variant && JSON.stringify(a.covers) !== JSON.stringify(b.covers) &&
        JSON.stringify(a.lighting) !== JSON.stringify(b.lighting) &&
        JSON.stringify(a.mapLights) !== JSON.stringify(b.mapLights));
    }
  }
  check('density and variant entry leave both existing save slots byte-for-byte unchanged',
    await page.evaluate(original => localStorage.getItem('dr-manhattan.save') === original.campaign &&
      localStorage.getItem('dr-manhattan.bonus.v1') === original.bonus, original));
  check('no browser errors during real map construction', errors.length === 0);
  console.log(`AFTER MIDNIGHT DENSITY PASSED: ${checks.length} checks (${target}).`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, checks, layouts, errors }, null, 2));
  await browser.close();
}
