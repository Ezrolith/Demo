from pathlib import Path
import base64, gzip, hashlib, json, subprocess
parts = [Path('.github/step-five-' + str(i) + '.b64').read_text().strip() for i in range(1, 4)]
parts[1] = parts[1].replace('ftZp2tKE5cZ', 'ftZ2tKE5cZ').replace('V6dvsaL3uujX', 'V6dvsaL4uujX')
raw = gzip.decompress(base64.b64decode(''.join(parts)))
assert hashlib.sha256(raw).hexdigest() == '4e5c5280fa503378bd7b3783525948b8396237bd31dc13a318cd0d85c31f3c2a'
data = json.loads(raw)
subprocess.run(['git', 'apply', '--check', '-'], input=data['patch'].encode(), check=True)
for path, content in data['files'].items():
    assert path in ['src/data/chapters/last-broadcast.js', 'src/data/bonus-broadcast-atmosphere.js']
    Path(path).write_text(content)
subprocess.run(['git', 'apply', '-'], input=data['patch'].encode(), check=True)
for i in range(1, 4):
    path = '.github/step-five-' + str(i) + '.b64'
    subprocess.run(['git', 'rm', path], check=True)
