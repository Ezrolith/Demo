from pathlib import Path
import hashlib

def replace(name, old, new):
    p = Path(name)
    s = p.read_text()
    assert s.count(old) == 1, (name, old)
    p.write_text(s.replace(old, new, 1))

replace('src/game/bonus-portability.js', '      let pending = null;', '      let pending = null;\n      let selection = 0;')
replace('src/game/bonus-portability.js', "      input.addEventListener('change', async () => {\n        pending = null;", "      input.addEventListener('change', async () => {\n        const request = ++selection;\n        pending = null;")
replace('src/game/bonus-portability.js', '          if (!root.isConnected) return;', '          if (!root.isConnected || request !== selection) return;')
replace('src/game/bonus-portability.js', '        } catch (error) {\n          status.textContent = error.message;\n        }\n      });\n      const close = () => {', '        } catch (error) {\n          if (!root.isConnected || request !== selection) return;\n          status.textContent = error.message;\n        }\n      });\n      const close = () => {')
replace('tests/bonus-portability.mjs', '  await page.evaluate(() => {\n    delete DM.Bonus.data.checkpoints.long_summer;', """  await page.evaluate(() => {
    window.__fileText = File.prototype.text;
    File.prototype.text = function () {
      const result = window.__fileText.call(this);
      return this.name === 'slow.json' ? new Promise(resolve => setTimeout(() => resolve(result), 350)) : result;
    };
  });
  await page.locator('#bonus-backup-file').setInputFiles({
    name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from(text)
  });
  await page.locator('#bonus-backup-file').setInputFiles({
    name: 'latest-invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad')
  });
  await page.waitForTimeout(650);
  check('an older slow file cannot replace the latest invalid selection',
    await page.getByRole('button', { name: 'RESTORE THIS BACKUP' }).isDisabled() &&
    await page.locator('#bonus-backup-status').textContent().then(t => t.includes('not a valid')));
  await page.evaluate(() => { File.prototype.text = window.__fileText; delete window.__fileText; });
  await page.evaluate(() => {
    delete DM.Bonus.data.checkpoints.long_summer;""")
replace('tests/bonus-portability.mjs', "  check('no browser errors', errors.length === 0);", r"""  const fresh = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  fresh.on('pageerror', e => errors.push(String(e)));
  const otherTarget = target.startsWith('dist/') ? 'index.html' : 'dist/dr-manhattan.html';
  if (offline) {
    await fresh.evaluate(() => {
      const store = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = String(v), removeItem: k => delete store[k]
      } });
    });
    let otherHtml = readFileSync(path.join(root, otherTarget), 'utf8');
    otherHtml = otherHtml.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
      '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
    await fresh.setContent(otherHtml.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
  } else await fresh.goto(pathToFileURL(path.join(root, otherTarget)).href, { waitUntil: 'domcontentloaded' });
  await fresh.waitForFunction(() => window.DM?.BonusBackup);
  const initial = await fresh.evaluate(() => ({ bonus: DM.Bonus.load(), campaign: localStorage.getItem('dr-manhattan.save') }));
  assert.equal(Object.keys(initial.bonus.checkpoints).length, 0, 'new browser profile must start empty');
  await fresh.evaluate(() => { DM.Engine.set(new DM.Scenes.BonusMenu()); DM.BonusBackup.open(); });
  await fresh.locator('#bonus-backup-file').setInputFiles({
    name: 'exported-on-other-copy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(downloaded))
  });
  await fresh.getByRole('button', { name: 'RESTORE THIS BACKUP', exact: true }).click();
  const restored = await fresh.evaluate(() => ({
    checkpoint: DM.Bonus.load().checkpoints.long_summer,
    raw: localStorage.getItem('dr-manhattan.bonus.v1'), campaign: localStorage.getItem('dr-manhattan.save')
  }));
  assert.deepEqual(restored.checkpoint, downloaded.bonus.checkpoints.long_summer);
  check('downloaded backup transfers to a different game copy in an empty browser profile',
    restored.campaign === initial.campaign);
  if (!offline) {
    await fresh.reload({ waitUntil: 'domcontentloaded' });
    await fresh.waitForFunction(() => window.DM?.BonusBackup);
    check('transferred progress persists after reloading the other copy', restored.raw ===
      await fresh.evaluate(() => localStorage.getItem('dr-manhattan.bonus.v1')));
  }
  await fresh.close();
  check('no browser errors', errors.length === 0);""")
assert hashlib.sha256(Path('src/game/bonus-portability.js').read_bytes()).hexdigest() == '9cebb6ab3d0378b52de661176f7437af609d3dfaa014685a07123422e1d0fded'
assert hashlib.sha256(Path('tests/bonus-portability.mjs').read_bytes()).hexdigest() == 'f32586563bba7356f67d17c9ef2e6c470e4442b0fd6ed29b68bd3ff59770c7f5'
