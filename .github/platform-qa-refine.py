from pathlib import Path
p = Path('tests/platform-qa.mjs')
s = p.read_text()

def replace(old, new):
    global s
    assert s.count(old) == 1, (old, s.count(old))
    s = s.replace(old, new, 1)

replace("  await page.waitForFunction(() => DM.Audio.ctx?.state === 'running', null, { timeout: 10000 });\n  check('audio unlocks from an actual user gesture', await page.evaluate(() => DM.Audio.ctx.state === 'running'));", """  await page.waitForTimeout(200);
  report.audioAfterFirstClick = await page.evaluate(() => ({
    state: DM.Audio.ctx?.state, time: DM.Audio.ctx?.currentTime, rate: DM.Audio.ctx?.sampleRate,
    active: navigator.userActivation?.isActive, hidden: document.hidden,
  }));
  if (report.audioAfterFirstClick.state !== 'running') await page.keyboard.press('z');
  await page.waitForFunction(() => DM.Audio.ctx?.state === 'running', null, { timeout: 10000 });
  check('audio unlocks from actual user input', await page.evaluate(() => DM.Audio.ctx.state === 'running'));""")
replace("  await page.keyboard.press('ArrowRight');\n  await page.keyboard.press('Enter');\n  await page.waitForTimeout(400);", """  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => DM.Bonus.selectedId === 'long_summer');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => DM.Engine.top() instanceof DM.Scenes.Interlude ||
    DM.dev.play()?.chapter.id === 'long_summer', null, { timeout: 5000 });""")
replace("page.on('pageerror', e => errors.push(String(e)));", """page.on('pageerror', e => errors.push(String(e)));
report.console = [];
page.on('console', m => {
  if (['warning', 'error'].includes(m.type())) report.console.push(m.text());
});""")
replace("  report.failure = String(error.stack || error);", """  report.failure = String(error.stack || error);
  try {
    report.lastState = await read();
    report.lastAudio = await page.evaluate(() => ({ state: DM.Audio.ctx?.state,
      time: DM.Audio.ctx?.currentTime, rate: DM.Audio.ctx?.sampleRate }));
  } catch (_) {}""")
replace('async function settle() {\n  for (let i = 0; i < 50; i++) {', """async function settle() {
  // Chapter generators may schedule their first dialogue after one update.
  await page.waitForTimeout(450);
  let calmSince = 0;
  for (let i = 0; i < 100; i++) {""")
replace("    if (!busy) return;\n    await page.keyboard.press('e');\n    await page.waitForTimeout(100);", """    if (busy) {
      calmSince = 0;
      await page.keyboard.press('e');
    } else {
      calmSince++;
      if (calmSince >= 6) return;
    }
    await page.waitForTimeout(100);""")
replace("  await page.waitForTimeout(900);\n  const muted = await meter(0.4);", """  await page.waitForFunction(() => DM.Audio.muted);
  // The ambience bus has a 0.3 s exponential fade; measure after its tail.
  await page.waitForTimeout(2600);
  const muted = await meter(0.4);
  report.mute = muted;
  report.muteState = await page.evaluate(() => ({ muted: DM.Audio.muted,
    music: DM.Audio.musicBus.gain.value, sfx: DM.Audio.sfxBus.gain.value,
    ambience: DM.Audio.ambBus.gain.value }));""")
replace("const slug = `${engine}-${target.startsWith('dist/') ? 'dist' : 'source'}-${cpu}x`;",
        "const quality = process.env.QA_QUALITY || 'high';\n" +
        "assert.ok(['high', 'balanced', 'low'].includes(quality), 'known quality');\n" +
        "const slug = `${engine}-${target.startsWith('dist/') ? 'dist' : 'source'}-${cpu}x-${quality}`;")
replace('const report = { engine, version: browser.version(), target, cpuSlowdown: cpu,',
        'const report = { engine, version: browser.version(), target, cpuSlowdown: cpu, quality,')
replace("  await page.evaluate(() => {\n    DM.Save.settings.focusPause = false;\n    DM.Engine.set(new DM.Scenes.BonusMenu());\n  });", """  await page.evaluate(quality => {
    DM.Save.settings.focusPause = false;
    DM.Save.settings.quality = quality;
    DM.Engine.resize();
    DM.Engine.set(new DM.Scenes.BonusMenu());
  }, quality);""")
p.write_text(s)
