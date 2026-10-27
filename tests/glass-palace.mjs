/* Glass Palace acceptance: controlled save/completion fixtures, real engine,
 * keyboard and menu input. Completion checks use the actual Play completion
 * methods, not synthetic achievement events. This is not natural-play balance
 * evidence; failure screenshots are diagnostics, not delivered live captures.
 * node tests/glass-palace.mjs [index.html|dist/dr-manhattan.html]
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
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');
const build = target.startsWith('dist/') || target.includes('/dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/glass-palace', engine, build);
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const checks = [], errors = [], completions = [], structures = [], variants = [];
page.on('pageerror', error => errors.push(String(error)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const check = (name, pass) => {
  assert.ok(pass, name);
  checks.push(name);
  console.log('PASS ' + name);
};
const step = seconds => ev(seconds => T.step(seconds), seconds);
const key = async name => {
  await page.keyboard.down(name);
  await step(0.05);
  await page.keyboard.up(name);
  await step(0.07);
};
const click = async (x, y) => {
  await page.mouse.click(x, y);
  await step(0.1);
};
const action = async prefix => {
  const rect = await ev(prefix => {
    const menu = DM.Engine.top().menu;
    const index = menu.items.findIndex(item => item.label.startsWith(prefix));
    if (index < 0) throw new Error('Menu action missing: ' + prefix);
    return menu.rowRect(index);
  }, prefix);
  await click(rect.x + rect.w / 2, rect.y + rect.h / 2);
};
const oldKeys = ['dr-manhattan.save', 'dr-manhattan.bonus.v1', 'dr-manhattan.after-midnight.v1'];
const empty = () => ({
  campaign: {
    version: 2, reached: 0, completed: {}, checkpoint: null, checkpoints: {},
    seen: { unlocks: {} }, totals: { spared: 0, disintegrated: 0, memories: 0, decoherences: 0 },
    settings: { focusPause: false, textSpeed: 'instant', challenge: 'normal', invulnerable: false },
  },
  bonus: { version: 1, completed: {}, checkpoints: {}, deaths: 0 },
  afterMidnight: {
    version: 1, selection: { hero: 'niteowl', mode: 'story', case: 'dead_air', theme: 'rooftops' },
    checkpoints: {}, records: {}, deaths: 0,
  },
});
const seed = fixtures => ev(fixtures => T.seed(fixtures), fixtures);
const slots = () => ev(() => T.slots());
const unchanged = before => ev(before => {
  const source = Object.values(DM.GlassPalace.sourceKeys);
  return JSON.stringify(T.slots()) === JSON.stringify(before) &&
    window.__storageWrites.every(key => !source.includes(key));
}, before);
const hub = () => ev(() => T.hub());
const structure = async label => {
  await hub();
  const result = await ev(() => {
    const scene = DM.Engine.top();
    return {
      count: scene.structureCount,
      pieces: scene.structurePieces.length,
      worldPieces: scene.structurePieces.every(piece => scene.world.entities.includes(piece)),
      fragments: DM.GlassPalace.fragmentCount(),
      world: { walls: scene.world.walls.length, entities: scene.world.entities.length },
    };
  });
  structures.push({ label, ...result });
  return result;
};

try {
  await page.addInitScript(({ fixtures, keys }) => {
    window.requestAnimationFrame = () => 0;
    window.__blockPalace = false;
    window.__storageWrites = [];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dr-manhattan.glass-palace.v1' && window.__blockPalace) {
        throw new DOMException('Storage blocked', 'QuotaExceededError');
      }
      window.__storageWrites.push(key);
      return set.call(this, key, value);
    };
    if (keys.every(key => localStorage.getItem(key) === null)) {
      for (const [index, group] of ['campaign', 'bonus', 'afterMidnight'].entries()) {
        localStorage.setItem(keys[index], JSON.stringify(fixtures[group]));
      }
    }
  }, { fixtures: empty(), keys: oldKeys });
  await page.goto(pathToFileURL(path.resolve(root, target)).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.dev && DM.GlassPalace?.observeCompletion &&
    DM.Scenes.GlassPalace && DM.Scenes.GlassPalaceEpilogue, null, { polling: 100 });
  await ev(() => {
    DM.Save.settings.focusPause = false;
    DM.Save.settings.textSpeed = 'instant';
    DM.Engine.governor.enabled = false;
    window.T = {
      step(seconds = 0.1) {
        const engine = DM.Engine, render = engine.render;
        engine.render = () => {};
        try {
          for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
            engine.frame(engine.last + 1000 / 60);
            if (engine.error) throw engine.error;
          }
        } finally { engine.render = render; }
        engine.render();
        if (engine.error) throw engine.error;
      },
      slots() {
        return Object.fromEntries(Object.values(DM.GlassPalace.sourceKeys)
          .map(key => [key, localStorage.getItem(key)]));
      },
      seed(fixtures) {
        for (const [group, key] of Object.entries(DM.GlassPalace.sourceKeys)) {
          localStorage.setItem(key, JSON.stringify(fixtures[group]));
        }
        DM.Save.available = true;
        DM.Save.readOnly = false;
        DM.Save.load();
        DM.Save.settings.focusPause = false;
        DM.Bonus.data = null;
        DM.Bonus.available = true;
        DM.AfterMidnight.data = null;
        DM.AfterMidnight.available = true;
        DM.AfterMidnight.readOnly = false;
      },
      hub() {
        window.__storageWrites = [];
        DM.Input.clearAll();
        DM.Engine.fade.dir = 0;
        DM.Engine.fade.a = 0;
        DM.Engine.set(new DM.Scenes.GlassPalace());
        this.step(0.15);
      },
      finish(id, options = {}) {
        const AM = DM.AfterMidnight;
        if (id.startsWith('am_')) AM.run = AM.config({ hero: 'niteowl' }, DM.Chapters.get(id));
        DM.Input.clearAll();
        DM.Engine.fade.dir = 0;
        DM.Engine.fade.a = 0;
        DM.Engine.set(new DM.Scenes.Play(), { chapter: id, stage: 0 });
        this.step(0.05);
        const play = DM.dev.play();
        play.ctx.stats = { time: options.time ?? 1, spared: 4, disintegrated: options.unmade ?? 0, memories: 6 };
        Object.assign(play.ctx.flags, {
          repaired: true, calibrated: true, reassembled: true,
          evidence: 7, engineers: 7, passengers: 6, rescued: 6, heat: 10,
          clues: 7, downloaded: true, departed: true,
          ledger: true, surveyorCaptured: true, archiveReturned: true,
        });
        if (options.detail === false) {
          play.ctx.flags.repaired = false;
          play.ctx.flags.calibrated = false;
        }
        play.ctx.refs.emitters = [{ dead: true }, { neutralized: true }, { dead: true }, { dead: true }];
        play.player.setForm(id === 'reassembly' ? 'manhattan' : play.player.form);
        play.player.coherence = play.player.maxCoherence;
        play.failed = !!options.failed;
        play.player.down = !!options.down;
        play.completeChapter();
        this.lastCompletion = play;
        this.step(0.05);
        return { id, fragments: DM.GlassPalace.fragmentCount(), status: DM.GlassPalace.status(id) };
      },
      texts() {
        const text = DM.Gfx.text, words = [];
        DM.Gfx.text = (g, value, x, y, options) => {
          words.push(String(value));
          return text(g, value, x, y, options);
        };
        try { DM.Engine.render(); }
        finally { DM.Gfx.text = text; }
        return words;
      },
    };
    window.__storageWrites = [];
  });
  check('hub is additive to the original six chapters, three adventures and three cases', await ev(() =>
    DM.Chapters.list.length === 6 && DM.Bonus.list.length === 3 &&
    DM.AfterMidnight.cases.filter(chapter => chapter.kind === 'story').length === 3 &&
    DM.GlassPalace.moments().length === 12));
  check('every moment defines exactly three distinct data-driven challenges', await ev(() =>
    DM.GlassPalace.moments().every(moment => {
      const definitions = DM.GlassPalace.challengeDefs(moment.id);
      return definitions.length === 3 && new Set(definitions.map(def => def.id)).size === 3 &&
        definitions.every(def => typeof def.test === 'function' && def.label && def.description);
    }) && DM.GlassPalace.maxFragments() === 36));
  check('Karnak detail uses the actual four-emitter map and rejects an incomplete shutdown', await ev(() => {
    const GP = DM.GlassPalace;
    const preview = new GP.MomentPreview(GP.find('karnak'));
    preview.build();
    const emitters = preview.context?.refs.emitters;
    const definition = GP.challengeDefs('karnak').find(value => value.id === 'detail');
    if (!emitters || emitters.length !== 4) { preview.dispose(); return false; }
    for (let i = 0; i < 3; i++) emitters[i].dead = true;
    const incomplete = definition.test({ refs: { emitters } });
    const truncated = definition.test({ refs: { emitters: emitters.slice(0, 3) } });
    emitters[3].dead = true;
    const complete = definition.test({ refs: { emitters } });
    preview.dispose();
    return !incomplete && !truncated && complete;
  }));
  const original = await slots();
  check('fresh saves unlock the first campaign pane and the existing optional content only', await ev(() => {
    const moments = DM.GlassPalace.moments();
    return moments.filter(moment => moment.group === 'campaign' && moment.unlocked).length === 1 &&
      moments.filter(moment => moment.group !== 'campaign').every(moment => moment.unlocked);
  }));
  await click(640, 360);
  check('title places THE GLASS PALACE immediately after NEW GAME and keeps the existing menus', await ev(() => {
    const labels = DM.Engine.top().menu.items.map(item => item.label);
    const newGame = labels.indexOf('NEW GAME');
    return labels[newGame + 1] === 'THE GLASS PALACE' &&
      ['CHAPTERS', 'BONUS LEVELS', 'AFTER MIDNIGHT', 'SETTINGS', 'CONTROLS'].every(label => labels.includes(label));
  }));
  check('the longest Continue title menu fits above the footer without losing its last action', await ev(() => {
    const title = DM.Engine.top(), saved = DM.Save.data.checkpoint;
    DM.Save.data.checkpoint = { chapter: 'prologue', stage: 1, carry: null };
    title.buildMenu();
    const menu = title.menu;
    const hasContinue = menu.items.some(item => item.label.startsWith('CONTINUE'));
    const last = menu.rowRect(menu.items.length - 1);
    const fits = last.y + last.h <= DM.H - 52 && menu.items.at(-1).label === 'CONTROLS';
    DM.Save.data.checkpoint = saved;
    title.buildMenu();
    return hasContinue && fits;
  }));
  await action('THE GLASS PALACE');
  await step(0.3);
  check('actual title input opens a walkable noncombat palace without changing original slots', await ev(before => {
    const scene = DM.Engine.top();
    return scene instanceof DM.Scenes.GlassPalace && scene.world.player === scene.player &&
      scene.world.entities.every(entity => entity.team !== 'enemy') &&
      !scene.player.canUsePowers && Object.keys(scene.player.powers).length === 0 &&
      JSON.stringify(T.slots()) === JSON.stringify(before);
  }, original));
  check('only normally unlocked moments have visible panes', await ev(() => {
    const scene = DM.Engine.top(), GP = DM.GlassPalace;
    return scene.panes.length === GP.moments().filter(moment => moment.unlocked).length &&
      scene.panes.every(pane => GP.find(pane.moment.id).unlocked);
  }));
  const x0 = await ev(() => DM.Engine.top().player.x);
  await page.keyboard.down('d'); await step(0.4); await page.keyboard.up('d'); await step(0.1);
  check('real movement input moves Jon freely through the hub', await ev(x0 => DM.Engine.top().player.x > x0 + 15, x0));
  await key('c'); await key('q'); await key('Space');
  check('combat inputs cannot produce combat actors or consume hub health', await ev(() => {
    const scene = DM.Engine.top();
    return scene.world.entities.every(entity => entity.team !== 'enemy' && !entity.isProjectile) &&
      scene.player.coherence === scene.player.maxCoherence;
  }));
  check('viewing, walking and combat-key input leave all three original slots byte-identical', await unchanged(original));
  const zero = await structure('zero');
  check('zero fragments produce zero earned structure pieces in the actual hub world',
    zero.count === 0 && zero.pieces === 0 && zero.fragments === 0 && zero.worldPieces);
  await ev(() => {
    const scene = DM.Engine.top();
    for (const pane of scene.panes) {
      scene.player.x = pane.x;
      scene.player.y = pane.y + 60;
      scene.player.vx = scene.player.vy = 0;
      T.step(1.5);
    }
  });
  check('unlocked panes use their level map renderers and have live drawing activity', await ev(() => {
    const panes = DM.Engine.top().panes;
    return panes.length > 0 && panes.every(pane => pane.preview && !pane.preview.error &&
      pane.preview.world instanceof DM.World && pane.preview.renders > 0 &&
      pane.preview.sourceBuilder === pane.moment.chapter.maps[pane.preview.sourceMap]);
  }));
  check('live vignette rendering does not write any original progress slot', await unchanged(original));

  const reach = empty(); reach.campaign.reached = 2;
  await seed(reach);
  check('campaign pane visibility follows the saved reached index', await ev(() => {
    const rows = DM.GlassPalace.moments().filter(moment => moment.group === 'campaign');
    return rows.every((row, index) => row.unlocked === (index <= 2));
  }));

  const ledgerFixture = empty();
  ledgerFixture.campaign.totals.spared = 7;
  ledgerFixture.campaign.totals.disintegrated = 3;
  ledgerFixture.campaign.completed.prologue = { spared: 999, disintegrated: 999, time: 10, memories: 0 };
  ledgerFixture.bonus.completed.last_broadcast = { stats: { spared: 11, disintegrated: 2, time: 20, memories: 0 }, flags: {} };
  const amRecord = (caseId, hero, theme, spared, disintegrated) => ({
    caseId, run: { hero, theme, mode: caseId === 'patrol' ? 'patrol' : 'story', upgrades: {} },
    stats: { spared, disintegrated, memories: 0, time: 30 }, completed: false, everCompleted: true, flags: {},
  });
  ledgerFixture.afterMidnight.records['dead_air:niteowl:rooftops'] = amRecord('dead_air', 'niteowl', 'rooftops', 13, 5);
  ledgerFixture.afterMidnight.records['patrol:rorschach:museum'] = amRecord('patrol', 'rorschach', 'museum', 4, 1);
  ledgerFixture.afterMidnight.records.invalid = amRecord('dead_air', 'niteowl', 'rooftops', 999, 999);
  await seed(ledgerFixture);
  const ledgerBytes = await slots();
  await ev(() => { window.__storageWrites = []; });
  check('combined ledger sums retained sources without double-counting campaign completed records', await ev(() => {
    const tally = DM.GlassPalace.ledger();
    return tally.spared === 35 && tally.unmade === 11 && tally.disintegrated === 11 &&
      tally.sources.campaign.spared === 7 && tally.sources.bonus.spared === 11 && tally.sources.afterMidnight.spared === 17;
  }));
  check('ledger and moment reads never rewrite source formats or bytes', await unchanged(ledgerBytes));
  check('four original reflection tiers distinguish unwritten, mercy, balance and detachment', await ev(() => {
    const GP = DM.GlassPalace;
    const rows = [{ spared: 0, unmade: 0 }, { spared: 30, unmade: 1 }, { spared: 10, unmade: 10 }, { spared: 0, unmade: 30 }];
    const tiers = rows.map(row => GP.reflectionTier(row));
    return new Set(tiers.map(tier => tier.id)).size === 4 && new Set(tiers.map(tier => tier.text)).size === 4 &&
      tiers.every(tier => GP.reflection(rows[tiers.indexOf(tier)]) === tier.text);
  }));

  await hub();
  await ev(() => {
    const scene = DM.Engine.top();
    scene.player.x = scene.slab.x;
    scene.player.y = scene.slab.y + 70;
    scene.player.vx = scene.player.vy = 0;
    T.step(0.1);
  });
  await key('e');
  check('the central glass slab opens the combined ledger and its reflection', await ev(() => {
    const text = T.texts();
    return DM.Engine.top() instanceof DM.GlassPalace.LedgerPanel &&
      text.includes('SPARED') && text.includes('UNMADE') && text.includes('35') && text.includes('11');
  }));
  await key('Escape');
  check('reading the slab leaves all old progress slots byte-identical', await unchanged(ledgerBytes));
  await ev(() => {
    const scene = DM.Engine.top(), pane = scene.panes.find(value => value.moment.id === 'prologue');
    scene.player.x = pane.x; scene.player.y = pane.y + 60;
    T.step(0.1);
  });
  await key('e');
  check('walking to a pane and pressing E offers play, resume and challenges', await ev(() => {
    const labels = DM.Engine.top().menu.items.map(item => item.label);
    return ['PLAY THIS MOMENT', 'RESUME CHECKPOINT', 'CHALLENGES'].every(label => labels.includes(label));
  }));
  await action('CHALLENGES');
  check('challenge panel shows three definitions and current earned status', await ev(() => {
    const scene = DM.Engine.top();
    return scene instanceof DM.GlassPalace.ChallengesPanel && scene.moment.id === 'prologue' &&
      DM.GlassPalace.status('prologue').challenges.length === 3;
  }));
  await key('Escape'); await key('Escape');
  check('pane and challenge views preserve all original save bytes', await unchanged(ledgerBytes));

  const resumeFixture = empty();
  const carry = { stats: { time: 30, spared: 1, disintegrated: 0, memories: 0 }, found: [], flags: {} };
  resumeFixture.campaign.reached = 4;
  resumeFixture.campaign.checkpoints.mars = { stage: 2, carry };
  resumeFixture.bonus.checkpoints.ninth_minute = { stage: 1, carry };
  resumeFixture.afterMidnight.selection.hero = 'silkspectre';
  resumeFixture.afterMidnight.checkpoints['undertow:silkspectre:harbour'] = {
    caseId: 'undertow', stage: 1,
    run: { hero: 'silkspectre', theme: 'harbour', mode: 'story', upgrades: {} },
    carry: { ...carry, flags: { power: 3 } },
  };
  await seed(resumeFixture);
  const resumeBytes = await slots();
  await ev(() => { window.__storageWrites = []; });
  check('moment resume metadata reads matching checkpoints and the selected After Midnight hero', await ev(() => {
    const GP = DM.GlassPalace;
    return GP.find('mars').checkpoint.stage === 2 && GP.find('ninth_minute').checkpoint.stage === 1 &&
      GP.find('am_undertow').checkpoint.stage === 1 && GP.find('am_undertow').hero === 'silkspectre';
  }));
  check('reading resume metadata leaves all original bytes untouched', await unchanged(resumeBytes));
  check('campaign Resume normalizes legacy numeric-string carry without rewriting its source', await ev(() => {
    const GP = DM.GlassPalace, key = GP.sourceKeys.campaign;
    const original = localStorage.getItem(key), raw = JSON.parse(original);
    raw.checkpoints.mars.stage = '2';
    raw.checkpoints.mars.carry.stats = { time: '120', spared: '4', disintegrated: '0', memories: '2' };
    const external = JSON.stringify(raw);
    localStorage.setItem(key, external);
    window.__storageWrites = [];
    const moment = GP.find('mars');
    const ctx = new DM.ChapterContext({}, moment.chapter);
    ctx.applyCarry(moment.checkpoint.carry);
    const correct = moment.checkpoint.stage === 2 && ctx.stats.time === 120 &&
      ctx.stats.spared === 4 && ctx.stats.memories === 2;
    const unchanged = localStorage.getItem(key) === external && window.__storageWrites.length === 0;
    localStorage.setItem(key, original);
    window.__storageWrites = [];
    return correct && unchanged;
  }));
  for (const [id, stage] of [['mars', 2], ['ninth_minute', 1], ['am_undertow', 1]]) {
    await hub();
    await ev(id => {
      const scene = DM.Engine.top(), pane = scene.panes.find(value => value.moment.id === id);
      scene.player.x = pane.x; scene.player.y = pane.y + 60;
      scene.player.vx = scene.player.vy = 0;
      T.step(0.1);
    }, id);
    await key('e'); await action('RESUME CHECKPOINT'); await step(1.8);
    check(id + ': actual pane Resume enters the existing level checkpoint', await ev(([id, stage]) => {
      const play = DM.dev.play();
      return play?.chapter.id === id && play.ctx.stageIndex === stage &&
        (id !== 'am_undertow' || play.player.profile?.id === 'silkspectre');
    }, [id, stage]));
  }

  const fresh = empty();
  await seed(fresh);
  await ev(() => {
    const GP = DM.GlassPalace;
    GP.data = { version: 1, challenges: {}, epilogueSeen: {}, visits: 0 };
    GP.available = true; GP.readOnly = false; GP.warning = '';
    GP.write();
  });
  check('failed and downed completions cannot grant fragments', await ev(() => {
    T.finish('prologue', { failed: true });
    T.finish('reassembly', { down: true });
    return DM.GlassPalace.fragmentCount() === 0;
  }));
  await seed(fresh);
  const partial = await ev(() => T.finish('prologue', { detail: false }));
  completions.push(partial);
  check('real campaign completion grants only the two fulfilled challenges', partial.status.earned === 2 && partial.fragments === 2);
  check('actual level-end rendering shows the two-of-three moment status', await ev(() =>
    T.texts().some(text => /2\s*\/\s*3.*moments|moments.*2\s*\/\s*3/i.test(text))));
  const first = await ev(() => T.finish('prologue'));
  completions.push(first);
  check('a later real completion can earn the missing level-specific fragment', first.status.earned === 3 && first.fragments === 3);
  check('repeated completion callbacks cannot duplicate already earned fragments', await ev(() => {
    const GP = DM.GlassPalace, count = GP.fragmentCount();
    T.lastCompletion.completeChapter();
    return GP.fragmentCount() === count;
  }));
  for (const id of ['reassembly', 'superman', 'deterrent', 'mars', 'karnak']) {
    const result = await ev(id => T.finish(id), id);
    completions.push(result);
    check(id + ': the actual campaign completion path awards its three fulfilled challenges', result.status.earned === 3);
  }
  const halfBytes = await slots();
  const half = await structure('half');
  check('eighteen earned fragments rebuild eighteen real central structure pieces',
    half.fragments === 18 && half.count === 18 && half.pieces === 18 && half.worldPieces);
  check('hub rebuild at half progress leaves original save slots untouched', await unchanged(halfBytes));
  check('campaign completion alone does not unlock the epilogue', await ev(() =>
    !DM.GlassPalace.epilogueReady() && !DM.Engine.top().epilogueTerminal));
  for (const id of ['last_broadcast', 'ninth_minute', 'long_summer']) {
    const result = await ev(id => T.finish(id), id);
    completions.push(result);
    check(id + ': the actual bonus completion path awards its level-specific challenges', result.status.earned === 3);
    if (id !== 'long_summer') check(id + ': missing bonus completion still prevents the epilogue', await ev(() =>
      !DM.GlassPalace.epilogueReady()));
  }
  check('all six campaign and three bonus completions unlock the epilogue without requiring After Midnight', await ev(() =>
    DM.GlassPalace.epilogueReady() && DM.AfterMidnight.cases.filter(chapter => chapter.kind === 'story')
      .every(chapter => !DM.GlassPalace.find(chapter.id).completed)));
  for (const id of ['am_dead_air', 'am_undertow', 'am_glass_archive']) {
    const result = await ev(id => T.finish(id), id);
    completions.push(result);
    check(id + ': the actual After Midnight completion hook grants its three challenge fragments', result.status.earned === 3);
  }
  const fullBytes = await slots();
  const full = await structure('full');
  check('all thirty-six fragments assemble all thirty-six central pieces',
    full.fragments === 36 && full.count === 36 && full.pieces === 36 && full.worldPieces);
  check('central geometry visibly grows between zero, half and full progress',
    zero.pieces < half.pieces && half.pieces < full.pieces && zero.world.entities < full.world.entities);
  check('viewing the complete palace keeps every old slot byte-for-byte unchanged', await unchanged(fullBytes));
  check('completed panes display their three-of-three challenge status', await ev(() => {
    const scene = DM.Engine.top();
    return scene.panes.every(pane => DM.GlassPalace.status(pane.moment.id).earned === 3) &&
      T.texts().some(text => /3\s*\/\s*3/.test(text));
  }));
  check('each missing campaign or bonus completion independently blocks the epilogue', await ev(() => {
    const GP = DM.GlassPalace, initial = T.slots();
    const groups = [['campaign', DM.Chapters.list], ['bonus', DM.Bonus.list]];
    let safe = true;
    for (const [group, chapters] of groups) {
      const key = GP.sourceKeys[group];
      for (const chapter of chapters) {
        const data = JSON.parse(initial[key]);
        delete data.completed[chapter.id];
        localStorage.setItem(key, JSON.stringify(data));
        safe = safe && !GP.epilogueReady();
        localStorage.setItem(key, initial[key]);
      }
    }
    return safe && GP.epilogueReady() && JSON.stringify(initial) === JSON.stringify(T.slots());
  }));

  for (const [spared, unmade, expected] of [[100, 0, 'return'], [10, 10, 'observe'], [0, 100, 'depart']]) {
    await ev(([spared, unmade]) => {
      const GP = DM.GlassPalace;
      const main = JSON.parse(localStorage.getItem(GP.sourceKeys.campaign));
      main.totals.spared = spared; main.totals.disintegrated = unmade;
      localStorage.setItem(GP.sourceKeys.campaign, JSON.stringify(main));
      for (const group of ['bonus', 'afterMidnight']) {
        const data = JSON.parse(localStorage.getItem(GP.sourceKeys[group]));
        for (const record of Object.values(data.completed || data.records || {})) {
          if (record.stats) { record.stats.spared = 0; record.stats.disintegrated = 0; }
        }
        localStorage.setItem(GP.sourceKeys[group], JSON.stringify(data));
      }
    }, [spared, unmade]);
    const before = await slots();
    await ev(() => { window.__storageWrites = []; });
    const result = await ev(() => {
      DM.Engine.set(new DM.Scenes.GlassPalaceEpilogue()); T.step(0.1);
      const scene = DM.Engine.top();
      return { variant: scene.variant, duration: scene.totalDuration, segments: scene.segments.length };
    });
    variants.push(result);
    check(expected + ': combined ledger selects its distinct ninety-second epilogue',
      result.variant === expected && result.duration === 90 && result.segments >= 5);
    await step(84);
    check(expected + ': timed narration does not finish or record its ending early', await ev(expected =>
      DM.Engine.top() instanceof DM.Scenes.GlassPalaceEpilogue && DM.Engine.top().t >= 84 &&
      !DM.Engine.top().complete && !DM.GlassPalace.load().epilogueSeen[expected], expected));
    await step(8);
    if (await ev(() => DM.Engine.top() instanceof DM.Scenes.GlassPalaceEpilogue)) await key('Enter');
    await step(1);
    check(expected + ': epilogue returns to the hub and records only its new-slot ending flag', await ev(expected =>
      DM.Engine.top() instanceof DM.Scenes.GlassPalace && DM.GlassPalace.load().epilogueSeen[expected] === true, expected));
    check(expected + ': epilogue playback leaves all three original save bytes unchanged', await unchanged(before));
  }
  check('all three epilogue variants are distinct', new Set(variants.map(result => result.variant)).size === 3);

  const finalBytes = await slots();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DM?.GlassPalace?.fragmentCount && DM.dev, null, { polling: 100 });
  check('new-slot challenge and epilogue progress survives a real page reload', await ev(() => {
    const GP = DM.GlassPalace;
    return GP.fragmentCount() === 36 && ['return', 'observe', 'depart'].every(id => GP.load().epilogueSeen[id]);
  }));
  check('reloading the game retains original save bytes', await ev(before => {
    const keys = Object.values(DM.GlassPalace.sourceKeys);
    return keys.every(key => localStorage.getItem(key) === before[key]);
  }, finalBytes));
  const storage = await ev(() => {
    const GP = DM.GlassPalace, raw = localStorage.getItem(GP.key), old = Object.fromEntries(
      Object.values(GP.sourceKeys).map(key => [key, localStorage.getItem(key)]));
    window.__blockPalace = true;
    const previousVisits = GP.load().visits;
    const wrote = GP.visit();
    const blocked = !wrote && !GP.available && GP.data.visits === previousVisits + 1 &&
      localStorage.getItem(GP.key) === raw && GP.fragmentCount() === 36 && GP.warning.length > 0;
    window.__blockPalace = false;
    const recovered = GP.write() && GP.available;
    return { blocked, recovered, oldUnchanged: Object.keys(old).every(key => localStorage.getItem(key) === old[key]) };
  });
  check('blocked hub persistence retains session progress and warns honestly', storage.blocked);
  check('a successful hub-only write recovers persistence without touching old slots', storage.recovered && storage.oldUnchanged);
  check('corrupt and newer hub saves are preserved rather than overwritten', await ev(() => {
    const GP = DM.GlassPalace, good = localStorage.getItem(GP.key);
    const probe = raw => {
      localStorage.setItem(GP.key, raw);
      GP.data = null; GP.readOnly = false; GP.available = true; GP.warning = '';
      GP.load();
      const safe = GP.readOnly && !GP.write() && localStorage.getItem(GP.key) === raw && GP.warning.length > 0;
      return safe;
    };
    const corrupt = probe('{invalid JSON');
    const newer = probe(JSON.stringify({ version: 99, future: 'preserve me' }));
    localStorage.setItem(GP.key, good);
    GP.data = null; GP.readOnly = false; GP.available = true; GP.warning = '';
    return corrupt && newer && GP.fragmentCount() === 36;
  }));
  check('all former save bytes remain unchanged through hub storage recovery probes', await ev(before =>
    Object.values(DM.GlassPalace.sourceKeys).every(key => localStorage.getItem(key) === before[key]), finalBytes));
  check('hub tests produce no browser or engine errors', errors.length === 0 && await ev(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({
    target, engine, browser: browser.version(), checks, errors, completions, structures, variants,
    method: 'Controlled source-save and completion fixtures; actual completion hooks, real keys/menu controls, stepped engine.',
    screenshotLimit: 'Any failure PNG is a diagnostic fixture view, not live screenshot evidence.',
  }, null, 2));
  console.log(`GLASS PALACE PASSED: ${checks.length} checks (${engine}, ${target}).`);
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure-diagnostic.png') });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
