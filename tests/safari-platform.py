"""Native macOS Safari probes. Controlled stage entries, not a human playthrough."""
from pathlib import Path
import base64
import json
import sys
import time
import traceback
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/out/native-safari'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:4444'
session = None
report = {'checks': [], 'scenes': [], 'method': 'native Safari, loopback HTTP and W3C input; file sandbox unchanged'}


def call(method, endpoint, data=None):
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(BASE + endpoint, data=body, method=method,
                                     headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            value = json.load(response).get('value')
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    if isinstance(value, dict) and value.get('error') and 'message' in value:
        raise RuntimeError(str(value))
    return value


def command(endpoint, data=None, method='POST'):
    return call(method, '/session/' + session + endpoint, data)


def js(script, *args):
    return command('/execute/sync', {'script': script, 'args': list(args)})


def wait(script, seconds=12):
    until = time.monotonic() + seconds
    last = None
    while time.monotonic() < until:
        try:
            last = js(script)
            if last:
                return last
        except RuntimeError:
            pass
        time.sleep(0.1)
    raise AssertionError('Condition not met: ' + script + '; last=' + str(last))


def check(name, value):
    assert value, name
    report['checks'].append(name)
    print('PASS ' + name, flush=True)


def key(value, duration=120):
    command('/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
        {'type': 'keyDown', 'value': value}, {'type': 'pause', 'duration': duration},
        {'type': 'keyUp', 'value': value}]}]})


def click(x, y):
    command('/actions', {'actions': [{'type': 'pointer', 'id': 'mouse',
        'parameters': {'pointerType': 'mouse'}, 'actions': [
            {'type': 'pointerMove', 'origin': 'viewport', 'x': x, 'y': y, 'duration': 0},
            {'type': 'pointerDown', 'button': 0}, {'type': 'pointerUp', 'button': 0}]}]})


def state():
    return js("""const p=DM.dev.play(); return {hp:p?.player.coherence, x:p?.player.x, y:p?.player.y,
        failed:p?.failed, time:p?.world.realTime, dialog:p?.dialog.active, locked:p?.ctx.locked,
        paused:p && DM.Engine.top()!==p, error:DM.Engine.error?String(DM.Engine.error):null};""")


def stage(chapter, index):
    js("""DM.Save.settings.focusPause=false; DM.Save.settings.textSpeed='instant';
        DM.Save.settings.invulnerable=false; DM.Save.settings.challenge='normal';
        DM.Engine.set(new DM.Scenes.Play(),{chapter:arguments[0],stage:arguments[1]});""", chapter, index)
    time.sleep(0.6)
    calm = 0
    for _ in range(80):
        s = state()
        if s.get('dialog') or s.get('locked') or s.get('paused'):
            calm = 0
            key('e')
        else:
            calm += 1
            if calm >= 5:
                return
        time.sleep(0.12)
    raise AssertionError('Dialogue did not finish')


def shot(name):
    data = command('/screenshot', method='GET')
    (OUT / (name + '.png')).write_bytes(base64.b64decode(data))


try:
    response = call('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})
    session = response['sessionId']
    report['capabilities'] = response.get('capabilities')
    command('/window/rect', {'width': 1400, 'height': 900})
    for target in ['index.html', 'dist/dr-manhattan.html']:
        label = 'source' if target == 'index.html' else 'dist'
        command('/url', {'url': 'http://127.0.0.1:8765/' + target})
        wait('return !!window.DM?.dev')
        js("window.__qaErrors=[]; window.addEventListener('error', e=>window.__qaErrors.push(e.message));")
        check(label + ': boots without engine error', not state().get('error'))
        canvas = js("const r=DM.Engine.canvas.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};")
        click(canvas['x'], canvas['y'])
        time.sleep(0.3)
        key('z')
        wait("return DM.Audio.ctx?.state==='running'")
        check(label + ': native Safari audio unlocks from actual input', True)
        js('DM.Save.settings.focusPause=false; DM.Engine.set(new DM.Scenes.BonusMenu());')
        check(label + ': all three bonus cards registered', js('return DM.Bonus.list.length===3'))
        key('\ue012')
        wait("return DM.Bonus.selectedId==='ninth_minute'")
        key('\ue014')
        wait("return DM.Bonus.selectedId==='long_summer'")
        key('\ue006')  # Primary Return, not numeric-keypad Enter.
        wait("return DM.Engine.top() instanceof DM.Scenes.Interlude || DM.dev.play()?.chapter.id==='long_summer'")
        check(label + ': real menu navigation starts the selected adventure', True)
        for chapter in ['last_broadcast', 'ninth_minute', 'long_summer']:
            for index in range(3):
                stage(chapter, index)
                before = state()
                key('d', 500)
                after = state()
                check(f'{label} {chapter}/{index}: movement works', abs(after['x']-before['x']) > 5)
                key('\ue00c')
                wait('return DM.Engine.top() instanceof DM.Scenes.Pause')
                t = state()['time']
                time.sleep(0.3)
                check(f'{label} {chapter}/{index}: pause freezes simulation', state()['time'] == t)
                key('\ue00c')
                wait('return DM.Engine.top()===DM.dev.play()')
                # Read-only telemetry during one genuine hold/release action sequence.
                js("""window.__qaSightMin=1; const deadline=performance.now()+1200;
                    function sample(){const p=DM.dev.play(); if(p) window.__qaSightMin=Math.min(window.__qaSightMin,p.world.timeScale);
                        if(performance.now()<deadline) requestAnimationFrame(sample);}
                    requestAnimationFrame(sample);""")
                key('f', 450)
                wait("return !DM.Input.down('timesight') && !DM.dev.play().world.timesight")
                slow = js('return window.__qaSightMin')
                check(f'{label} {chapter}/{index}: Temporal Sight activates and releases', slow < 0.9)
                key('h')
                time.sleep(2)
                current = state()
                check(f'{label} {chapter}/{index}: live stage remains healthy', not current['failed'] and not current['error'])
                report['scenes'].append({'target': target, 'chapter': chapter, 'index': index, **current})
                shot(f'{label}-{chapter}-{index}')
        key('m')
        wait('return DM.Audio.muted')
        time.sleep(2.6)
        check(label + ': mute reaches music and ambience buses', js('return DM.Audio.musicBus.gain.value<0.0001 && DM.Audio.ambBus.gain.value<0.001'))
        key('m')
        wait('return !DM.Audio.muted')
        check(label + ': no uncaught page errors', js('return window.__qaErrors.length===0'))
        raw = js("return localStorage.getItem('dr-manhattan.bonus.v1')")
        check(label + ': saved checkpoint exists', bool(raw))
        command('/refresh', {})
        wait('return !!window.DM?.dev')
        check(label + ': reload preserves bonus saves', raw == js("return localStorage.getItem('dr-manhattan.bonus.v1')"))
        js('DM.Engine.set(new DM.Scenes.BonusMenu());')
        # A controlled dialog-render check, not a canvas-menu click assertion.
        if js('return !!DM.BonusBackup'):
            js('DM.BonusBackup.open();')
            check(label + ': portable backup dialog renders', js("return !!document.getElementById('bonus-backup')"))
            shot(label + '-backup')
            key('\ue00c')
            wait("return !document.getElementById('bonus-backup')")
        report.setdefault('saveRecords', {})[label] = json.loads(raw)
    report['status'] = 'passed'
    print(f"NATIVE SAFARI PASSED: {len(report['checks'])} checks.", flush=True)
except Exception:
    report['status'] = 'failed'
    report['failure'] = traceback.format_exc()
    print(report['failure'], file=sys.stderr, flush=True)
    if session:
        try:
            shot('failure')
            report['lastState'] = state()
        except Exception:
            pass
finally:
    (OUT / 'results.json').write_text(json.dumps(report, indent=2))
    if session:
        try:
            call('DELETE', '/session/' + session)
        except Exception:
            pass
if report.get('status') != 'passed':
    sys.exit(1)
