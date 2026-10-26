/* Case-board input, character-bound persistence and portable progress.
 * Controlled engine stepping and checkpoint fixtures; not a full human playthrough.
 * node tests/after-midnight-integration.mjs [index.html|dist/dr-manhattan.html]
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(arg => arg.endsWith('.html')) || 'index.html';
const engine = process.env.QA_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const out = path.join(root, 'tests/out/after-midnight-integration', engine, target.startsWith('dist/') ? 'standalone' : 'source');
mkdirSync(out, { recursive: true });
const browser = await pw[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [], checks = [];
page.on('pageerror', e => errors.push(String(e)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = sec => ev(sec => T.step(sec), sec);
const check = (name, pass) => { assert.ok(pass, name); checks.push(name); console.log('PASS ' + name); };
const key = async name => { await page.keyboard.down(name); await step(0.04); await page.keyboard.up(name); await step(0.06); };
const click = async (x, y) => { await page.mouse.click(x, y); await step(0.08); };
const boardAction = async label => {
  const rect = await ev(label => {
    const menu = DM.Engine.top().menu;
    const index = menu.items.findIndex(item => item.label === label);
    if (index < 0) throw new Error('Board action missing: ' + label);
    return menu.rowRect(index);
  }, label);
  await click(rect.x + rect.w / 2, rect.y + rect.h / 2);
};
const boardCard = async (kind, index) => {
  const rect = await ev(([kind, index]) => DM.Engine.top()[kind + 'Rect'](index), [kind, index]);
  await click(rect.x + rect.w / 2, rect.y + rect.h / 2);
};
const menuTextSizes = () => ev(() => {
  const G = DM.Gfx, sizes = [];
  const originalText = G.text, paragraph = G.paragraph;
  const backdrop = DM.Scenes.backdrop, city = DM.Bonus?.city;
  G.text = (g, text, x, y, options = {}) => {
    sizes.push(options.size || 20);
    return originalText(g, text, x, y, options);
  };
  G.paragraph = (g, text, x, y, width, leading, options = {}) => {
    sizes.push(options.size || 20);
    return paragraph(g, text, x, y, width, leading, options);
  };
  // This isolates UI font declarations, not gameplay-image evidence.
  DM.Scenes.backdrop = () => {};
  if (DM.Bonus) DM.Bonus.city = () => {};
  try { DM.Engine.top().render(DM.Engine.ctx); }
  finally {
    G.text = originalText;
    G.paragraph = paragraph;
    DM.Scenes.backdrop = backdrop;
    if (DM.Bonus) DM.Bonus.city = city;
  }
  return sizes;
});
const boot = async () => {
  await page.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.heroes?.length === 3, null, { polling: 100 });
  await ev(() => {
    window.T = {
      play: () => DM.dev.play(),
      step(seconds = 0.1) {
        const E = DM.Engine, render = E.render; E.render = () => {};
        try { for (let i = 0; i < Math.ceil(seconds * 60); i++) { E.frame(E.last + 1000 / 60); if (E.error) throw E.error; } }
        finally { E.render = render; }
        E.render(); if (E.error) throw E.error;
      },
      dialog() { for (let i = 0; i < 30 && this.play()?.dialog.active; i++) this.play().dialog.advance(); this.step(0.1); },
    };
    DM.Save.settings.focusPause = false;
    DM.Save.settings.textSpeed = 'instant';
    DM.Save.settings.challenge = 'normal';
    DM.Save.settings.invulnerable = false;
    DM.Engine.governor.enabled = false;
  });
};
try {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.__blockAM = false;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dr-manhattan.after-midnight.v1' && __blockAM) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await page.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await boot();
  const original = await ev(() => ({ campaign: localStorage.getItem('dr-manhattan.save'), bonus: localStorage.getItem('dr-manhattan.bonus.v1') }));
  check('original six chapters and three bonus cards are preserved', await ev(() =>
    DM.Chapters.list.length === 6 && DM.Bonus.list.length === 3));
  check('title exposes After Midnight alongside the existing campaign and bonus menu', await ev(() =>
    ['NEW GAME', 'CHAPTERS', 'BONUS LEVELS', 'AFTER MIDNIGHT'].every(label => DM.Engine.top().menu.items.some(item => item.label === label))));
  await click(640, 360); // Sound gate only.
  const titleRow = await ev(() => {
    const scene = DM.Engine.top(), i = scene.menu.items.findIndex(item => item.label === 'AFTER MIDNIGHT');
    return scene.menu.rowRect(i);
  });
  await click(titleRow.x + 90, titleRow.y + 20);
  check('actual title click opens the character/case board', await ev(() =>
    DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu && DM.Engine.top().step === 'hero'));
  check('hero choice has large portraits and no case-start action before continuing', await ev(() => {
    const board = DM.Engine.top();
    return board.heroRect(0).w >= 300 && board.heroRect(0).h >= 340 &&
      board.menu.items.some(item => item.label === 'CHOOSE A CASE OR MODE') &&
      !board.menu.items.some(item => item.label === 'OPEN CASE FILE' || item.label.startsWith('RESUME'));
  }));
  check('hero-choice text is at least thirteen logical pixels', Math.min(...await menuTextSizes()) >= 13);
  await click(960, 170);
  check('hero card selects Rorschach without starting a game', await ev(() =>
    DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu && DM.AfterMidnight.data.selection.hero === 'rorschach' && !DM.dev.play()));
  await key('ArrowLeft');
  check('keyboard hero selection chooses Silk Spectre and persists it', await ev(() =>
    DM.AfterMidnight.data.selection.hero === 'silkspectre' && JSON.parse(localStorage.getItem('dr-manhattan.after-midnight.v1')).selection.hero === 'silkspectre'));
  await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter');
  await page.locator('#after-midnight-backup').waitFor();
  check('keyboard navigation reaches progress backup directly from hero choice', await ev(() =>
    document.getElementById('after-midnight-backup')?.getAttribute('role') === 'dialog'));
  await key('Escape'); await page.locator('#after-midnight-backup').waitFor({ state: 'detached' });
  await boardCard('hero', 1); await key('Enter');
  check('Enter continues from hero choice to a separate case/mode screen', await ev(() =>
    DM.Engine.top().step === 'cases' && DM.Engine.top().selected().hero.id === 'silkspectre'));
  check('case/mode text is at least thirteen logical pixels', Math.min(...await menuTextSizes()) >= 13);
  await boardCard('mode', 1);
  await boardCard('case', 2);
  check('mode and location cards select a museum Patrol', await ev(() => {
    const s = DM.Engine.top().selected();
    return s.ch.amId === 'patrol' && s.run.theme === 'museum' && s.hero.id === 'silkspectre';
  }));
  await boardAction('HERO CONTROLS & TACTICS');
  check('field manual opens for the selected hero with six actual gear abilities', await ev(() =>
    DM.Engine.top() instanceof DM.AfterMidnight.GearScreen && DM.Engine.top().hero.id === 'silkspectre' && DM.Engine.top().hero.abilities.length === 6));
  await page.screenshot({ path: path.join(out, 'hero-manual.png') });
  await key('Escape');
  await boardCard('mode', 0);
  await boardCard('case', 2);
  await boardAction('OPEN CASE FILE');
  await step(1.5);
  check('a fresh selected case starts its original-style comic interlude', await ev(() =>
    DM.Engine.top() instanceof DM.Scenes.Interlude && DM.Engine.top().ch.amId === 'glass_archive'));
  await key('Space'); await key('Space'); await step(1.5); await ev(() => T.dialog());
  check('the selected hero enters the new case as a vulnerable player with her own six gear powers', await ev(() => {
    const p = T.play();
    return p.chapter.amId === 'glass_archive' && p.player.profile.id === 'silkspectre' &&
      p.player.form === 'vigilante' && !p.player.godMode && Object.keys(p.player.powers).length === 6 && p.player.maxCoherence === 90;
  }));
  await page.screenshot({ path: path.join(out, 'selected-hero-live.png') });
  check('new case stage entry writes only its separate progress slot', await ev(() => {
    const AM = DM.AfterMidnight, cp = AM.data.checkpoints[AM.slot('glass_archive', AM.run)];
    return cp && cp.caseId === 'glass_archive' && cp.run.hero === 'silkspectre' && cp.stage === 0;
  }));

  await ev(() => {
    const AM = DM.AfterMidnight, p = T.play(), carry = p.ctx.snapshot();
    carry.flags.circuits = 7; carry.stats.spared = 4;
    AM.progress.checkpointAt(p.chapter.id, 1, carry);
    DM.Engine.set(new DM.Scenes.AfterMidnightMenu()); T.step(0.1);
  });
  await boardAction('CHOOSE A CASE OR MODE');
  check('board names a real resume point for the matching hero/case', await ev(() => DM.Engine.top().menu.items[0].label.startsWith('RESUME')));
  await boardAction('CHANGE HERO');
  await boardCard('hero', 0);
  await boardAction('CHOOSE A CASE OR MODE');
  check('choosing another hero does not offer the first hero checkpoint', await ev(() =>
    !DM.Engine.top().menu.items.some(item => item.label.startsWith('RESUME'))));
  await boardAction('CHANGE HERO');
  await boardCard('hero', 1);
  await boardAction('CHOOSE A CASE OR MODE');
  const restartRow = await ev(() => { const m = DM.Engine.top().menu; return m.rowRect(m.items.findIndex(i => i.label === 'RESTART CASE')); });
  await click(restartRow.x + 90, restartRow.y + 15);
  check('restarting a checkpoint requires a safe-default confirmation', await ev(() => DM.Engine.top().menu.items[0].label === 'KEEP MY CHECKPOINT' && DM.Engine.top().menu.sel === 0));
  await key('Enter');
  check('cancel keeps the same saved stage and four earlier spares', await ev(() => {
    const AM = DM.AfterMidnight, cp = AM.data.checkpoints[AM.slot('glass_archive', { hero: 'silkspectre', theme: 'museum' })];
    return cp.stage === 1 && cp.carry.stats.spared === 4;
  }));
  await page.reload({ waitUntil: 'domcontentloaded' }); await boot();
  await ev(() => { DM.Engine.set(new DM.Scenes.AfterMidnightMenu()); T.step(0.1); });
  check('real reload retains the selected hero, case and checkpoint', await ev(() => {
    const s = DM.Engine.top().selected(); return s.hero.id === 'silkspectre' && s.ch.amId === 'glass_archive' && s.checkpoint.stage === 1;
  }));
  await boardAction('CHOOSE A CASE OR MODE');
  const resumeRow = await ev(() => DM.Engine.top().menu.rowRect(0));
  await click(resumeRow.x + 90, resumeRow.y + 15); await step(1.5); await ev(() => T.dialog());
  check('actual Resume restores hero identity and earned checkpoint state', await ev(() =>
    T.play().player.profile.id === 'silkspectre' && T.play().ctx.stageIndex === 1 && T.play().ctx.flags.circuits === 7 && T.play().ctx.stats.spared === 4));

  const backup = await ev(() => DM.AfterMidnight.encode());
  check('backup contains After Midnight progress without campaign or bonus data', (() => {
    const p = JSON.parse(backup); return p.format === 'dr-manhattan-after-midnight' && !p.campaign && !p.bonus && Object.keys(p.data.checkpoints).length === 1;
  })());
  check('wrong-format, future-version, unsafe and oversized backups are rejected', await ev(text => {
    const AM = DM.AfterMidnight, packet = JSON.parse(text), future = JSON.parse(text);
    future.version = 99;
    return ['{}', JSON.stringify(future), text.replace('"version": 1', '"__proto__": {}, "version": 1'), 'x'.repeat(256 * 1024 + 1)]
      .every(value => { try { AM.restore(value); return false; } catch (_) { return true; } });
  }, backup));
  check('blocked saving retains session progress, warns once, and failed restore is atomic', await ev(text => {
    const AM = DM.AfterMidnight; window.__blockAM = true;
    AM.write(); AM.write();
    const before = JSON.stringify(AM.data); let rejected = false;
    try { AM.restore(text); } catch (_) { rejected = true; }
    return rejected && !AM.available && JSON.stringify(AM.data) === before &&
      T.play().hud.toasts.filter(t => t.text.includes('AFTER MIDNIGHT IS SESSION ONLY')).length === 1;
  }, backup));
  check('successful writes recover persistence without altering retained state', await ev(() => {
    const AM = DM.AfterMidnight; __blockAM = false;
    return AM.write() && AM.available && JSON.stringify(AM.data) === localStorage.getItem('dr-manhattan.after-midnight.v1');
  }));
  await ev(() => { DM.Engine.set(new DM.Scenes.AfterMidnightMenu()); T.step(0.1); });
  const backupRow = await ev(() => { const m = DM.Engine.top().menu; return m.rowRect(m.items.findIndex(i => i.label === 'BACK UP / RESTORE PROGRESS')); });
  await click(backupRow.x + 90, backupRow.y + 15);
  await page.locator('#after-midnight-backup').waitFor();
  await ev(() => document.activeElement.blur());
  await page.keyboard.press('Tab');
  const forwardFocus = await ev(() => document.activeElement.textContent === 'EXPORT PROGRESS');
  await ev(() => document.activeElement.blur());
  await page.keyboard.press('Shift+Tab');
  check('modal Tab and Shift-Tab recover focus even when the body was focused', forwardFocus &&
    await ev(() => document.activeElement.textContent === 'BACK TO THE CASE BOARD'));
  const downloadPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT PROGRESS', exact: true }).click();
  const download = await downloadPending;
  const text = readFileSync(await download.path(), 'utf8');
  check('the visible export button produces a usable progress file', JSON.parse(text).data.checkpoints['glass_archive:silkspectre:museum'].stage === 1);
  await page.locator('#after-midnight-backup input').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction(() => {
    const button = document.querySelector('#after-midnight-backup button:nth-of-type(2)');
    return button && !button.disabled;
  }, null, { polling: 100 });
  check('file selection only previews; explicit restore is required', await ev(() => document.querySelector('#after-midnight-backup').textContent.includes('ready. Press Restore')));
  await page.getByRole('button', { name: 'RESTORE THIS PROGRESS', exact: true }).click();
  check('explicit restore reports success', await page.getByRole('status').textContent().then(t => /Restored 1 case record/.test(t)));
  await page.keyboard.press('Escape'); await page.locator('#after-midnight-backup').waitFor({ state: 'detached' });
  await step(0.1);
  const freshContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const freshPage = await freshContext.newPage();
  await freshPage.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await freshPage.goto(pathToFileURL(path.join(root, target)).href, { waitUntil: 'domcontentloaded' });
  await freshPage.waitForFunction(() => window.DM?.dev && DM.AfterMidnight?.BackupScreen, null, { polling: 100 });
  check('a fresh browser profile starts with no After Midnight checkpoints', await freshPage.evaluate(() =>
    Object.keys(DM.AfterMidnight.load().checkpoints).length === 0));
  await freshPage.evaluate(() => {
    DM.Engine.set(new DM.Scenes.AfterMidnightMenu());
    DM.Engine.push(new DM.AfterMidnight.BackupScreen());
  });
  await freshPage.locator('#after-midnight-backup input').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await freshPage.waitForFunction(() => {
    const button = document.querySelector('#after-midnight-backup button:nth-of-type(2)');
    return button && !button.disabled;
  }, null, { polling: 100 });
  await freshPage.getByRole('button', { name: 'RESTORE THIS PROGRESS', exact: true }).click();
  await freshPage.reload({ waitUntil: 'domcontentloaded' });
  await freshPage.waitForFunction(() => window.DM?.dev && DM.AfterMidnight, null, { polling: 100 });
  check('real file restore in a fresh profile survives reload with the correct hero/state', await freshPage.evaluate(() => {
    const cp = DM.AfterMidnight.load().checkpoints['glass_archive:silkspectre:museum'];
    return cp.stage === 1 && cp.run.hero === 'silkspectre' && cp.carry.stats.spared === 4 &&
      localStorage.getItem('dr-manhattan.save') === null && localStorage.getItem('dr-manhattan.bonus.v1') === null;
  }));
  await freshContext.close();
  check('original campaign and bonus save bytes are unchanged after selection, play, failure and restore', await ev(old =>
    localStorage.getItem('dr-manhattan.save') === old.campaign && localStorage.getItem('dr-manhattan.bonus.v1') === old.bonus, original));
  // Controlled Results fixture: advancing from an earlier case must respect
  // a later case checkpoint instead of silently overwriting it with stage zero.
  await ev(() => {
    const AM = DM.AfterMidnight;
    AM.start('undertow', { hero: 'silkspectre', instant: true }); T.step(0.1); T.dialog();
    const p = T.play(), carry = p.ctx.snapshot();
    carry.flags.power = 3; carry.flags.winchOpen = true; carry.stats.spared = 2;
    AM.progress.checkpointAt(p.chapter.id, 1, carry);
    AM.start('dead_air', { hero: 'silkspectre', instant: true }); T.step(0.1); T.dialog();
    AM.progress.complete(T.play()); T.step(0.8);
  });
  const nextCaseRow = await ev(() => DM.Engine.top().menu.rowRect(0));
  await click(nextCaseRow.x + 100, nextCaseRow.y + 20); await step(1.5); await ev(() => T.dialog());
  check('Results Next Case preserves an existing later-case checkpoint for this hero', await ev(() =>
    T.play().chapter.amId === 'undertow' && T.play().player.profile.id === 'silkspectre' &&
    T.play().ctx.stageIndex === 1 && T.play().ctx.flags.power === 3 && T.play().ctx.flags.winchOpen && T.play().ctx.stats.spared === 2 &&
    DM.AfterMidnight.data.selection.case === 'undertow' && DM.AfterMidnight.data.selection.hero === 'silkspectre'));
  const downed = await ev(() => {
    const AM = DM.AfterMidnight, p = T.play(), slot = AM.slot(p.chapter.amId, AM.run);
    const checkpoint = JSON.stringify(AM.data.checkpoints[slot]);
    const audio = DM.Audio.play, sounds = [];
    DM.Audio.play = function (name, ...args) { sounds.push(name); return audio.call(this, name, ...args); };
    p.player.invuln = 0; p.player.locked = false; p.player.damage(999, null, 'test');
    AM.progress.complete(p); T.step(2.7); DM.Audio.play = audio;
    return { checkpointPreserved: checkpoint === JSON.stringify(AM.data.checkpoints[slot]),
      down: p.player.down, hidden: p.player.hidden, gameOver: DM.Engine.top() instanceof DM.Scenes.GameOver,
      impact: sounds.includes('impact'), disintegrate: sounds.includes('disintegrate') };
  });
  check('a fallen human remains visible, keeps the checkpoint and cannot falsely complete the story',
    downed.checkpointPreserved && downed.down && !downed.hidden && downed.gameOver && downed.impact && !downed.disintegrate);
  await page.screenshot({ path: path.join(out, 'human-defeat.png') });
  await key('Enter'); await step(0.55);
  check('human retry grants brief checkpoint grace without Manhattan atom reassembly', await ev(() => {
    const p = T.play();
    return p.player.profile.id === 'silkspectre' && !p.player.down && !p.player.hidden && p.player.invuln > 0 &&
      p.ctx.stageIndex === 1 && !p.world.entities.some(e => e instanceof DM.FX.Reassembly);
  }));
  check('all new case-board flows remain free of page/engine errors', errors.length === 0 && await ev(() => !DM.Engine.error));
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ target, engine, checks, errors, method: 'Normal file loading, real browser input/storage/downloads; controlled checkpoint and engine stepping.' }, null, 2));
  console.log(`AFTER MIDNIGHT INTEGRATION PASSED: ${checks.length} checks (${target}).`);
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') });
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
