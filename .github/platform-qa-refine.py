from pathlib import Path
p = Path('tests/platform-qa.mjs')
s = p.read_text()
a = "  await page.waitForFunction(() => DM.Audio.ctx?.state === 'running', null, { timeout: 10000 });\n  check('audio unlocks from an actual user gesture', await page.evaluate(() => DM.Audio.ctx.state === 'running'));"
b = """  await page.waitForTimeout(200);
  report.audioAfterFirstClick = await page.evaluate(() => ({
    state: DM.Audio.ctx?.state, time: DM.Audio.ctx?.currentTime, rate: DM.Audio.ctx?.sampleRate,
    active: navigator.userActivation?.isActive, hidden: document.hidden,
  }));
  if (report.audioAfterFirstClick.state !== 'running') await page.keyboard.press('z');
  await page.waitForFunction(() => DM.Audio.ctx?.state === 'running', null, { timeout: 10000 });
  check('audio unlocks from actual user input', await page.evaluate(() => DM.Audio.ctx.state === 'running'));"""
assert s.count(a) == 1
s = s.replace(a, b)
a = "  await page.keyboard.press('ArrowRight');\n  await page.keyboard.press('Enter');\n  await page.waitForTimeout(400);"
b = """  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => DM.Bonus.selectedId === 'long_summer');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.Interlude ||
    DM.dev.play()?.chapter.id === 'long_summer', null, { timeout: 5000 });"""
assert s.count(a) == 1
s = s.replace(a, b)
s = s.replace("page.on('pageerror', e => errors.push(String(e)));", """page.on('pageerror', e => errors.push(String(e)));
report.console = [];
page.on('console', m => {
  if (['warning', 'error'].includes(m.type())) report.console.push(m.text());
});""")
s = s.replace("  report.failure = String(error.stack || error);", """  report.failure = String(error.stack || error);
  try {
    report.lastState = await read();
    report.lastAudio = await page.evaluate(() => ({ state: DM.Audio.ctx?.state,
      time: DM.Audio.ctx?.currentTime, rate: DM.Audio.ctx?.sampleRate }));
  } catch (_) {}""")
p.write_text(s)
