from pathlib import Path
import base64, hashlib, json, lzma, runpy

raw = lzma.decompress(base64.b64decode(Path('.github/platform-package.b64').read_text()))
assert hashlib.sha256(raw).hexdigest() == '1c3a7ae7969b8a26a3217029a040dd9556ee409524c8a2ed6906b771ba5f076f'
files = json.loads(raw)
assert set(files) == {'src/game/bonus-portability.js', 'tests/bonus-portability.mjs'}
for name, text in files.items():
    p = Path(name)
    assert not p.exists(), name
    p.write_text(text)

def replace(name, old, new):
    p = Path(name)
    s = p.read_text()
    assert s.count(old) == 1, (name, old, s.count(old))
    p.write_text(s.replace(old, new, 1))

replace('index.html', '<script src="src/game/bonus-kit.js"></script>',
        '<script src="src/game/bonus-portability.js"></script>\n<script src="src/game/bonus-kit.js"></script>')
replace('src/game/bonus.js',
        "      items.push({\n        label: 'BACK TO THE MAIN GAME', action: () => E.set(new DM.Scenes.Title())\n      });",
        "      items.push({\n        label: 'BACK UP / RESTORE BONUS SAVES', action: () => DM.BonusBackup.open()\n      });\n" +
        "      items.push({\n        label: 'BACK TO THE MAIN GAME', action: () => E.set(new DM.Scenes.Title())\n      });")
replace('src/game/bonus.js', 'y: 480, w: 620, itemH: 40, size: 21', 'y: 480, w: 620, itemH: 33, size: 18')
replace('src/game/bonus.js', 'ALL POWERS AVAILABLE · EACH ADVENTURE SAVES SEPARATELY',
        'KEYBOARD + MOUSE · ALL POWERS · SEPARATE BONUS SAVES')
runpy.run_path('.github/platform-qa-refine.py')
runpy.run_path('.github/platform-hardening.py')
runpy.run_path('.github/platform-keyboard.py')

replace('tests/play-audit-followup.mjs',
        "const out = path.join(root, 'tests/out/audit-followup');",
        "const engine = process.env.QA_BROWSER || 'chromium';\n" +
        "assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'known browser engine');\n" +
        "const out = path.join(root, 'tests/out/audit-followup', engine);")
replace('tests/play-audit-followup.mjs',
        "const browser = await pw.chromium.launch({ headless: true,\n" +
        "  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),\n" +
        "  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });",
        "const browser = await pw[engine].launch({ headless: true,\n" +
        "  ...(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),\n" +
        "  ...(engine === 'chromium' ? { args: ['--no-sandbox'] } : {}) });")
