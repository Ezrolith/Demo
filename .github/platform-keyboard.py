from pathlib import Path
import hashlib
p = Path('src/game/bonus-portability.js')
s = p.read_text()
old = "        event.stopImmediatePropagation();\n        if (event.key === 'Escape') {"
assert s.count(old) == 1
p.write_text(s.replace(old, "        event.stopImmediatePropagation();\n        if (event.type !== 'keydown') return;\n        if (event.key === 'Escape') {", 1))
p = Path('tests/bonus-portability.mjs')
s = p.read_text()
old = "  check('backup dialog opens from the actual menu', await page.locator('#bonus-backup').isVisible());"
assert s.count(old) == 1
new = old + """
  await page.keyboard.press('Tab');
  const fileFocused = await page.evaluate(() => document.activeElement.id === 'bonus-backup-file');
  await page.keyboard.press('Tab');
  const backFocused = await page.evaluate(() => document.activeElement.textContent === 'BACK TO BONUS LEVELS');
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => document.activeElement.textContent === 'EXPORT BONUS BACKUP');
  await page.keyboard.press('Shift+Tab');
  const reverseWrapped = await page.evaluate(() => document.activeElement.textContent === 'BACK TO BONUS LEVELS');
  check('Tab and Shift+Tab reach every enabled control and wrap once',
    fileFocused && backFocused && wrapped && reverseWrapped);
  await page.keyboard.press('Tab');
"""
p.write_text(s.replace(old, new, 1))
assert hashlib.sha256(Path('src/game/bonus-portability.js').read_bytes()).hexdigest() == '2635a3ea8815238a861c3d7f1f82e931e0b799007dbb414980955bf73666ab91'
assert hashlib.sha256(Path('tests/bonus-portability.mjs').read_bytes()).hexdigest() == '4b36dddc14ffe13401c991465106dafce28736617fd63a504ce9fd13f5d60572'
