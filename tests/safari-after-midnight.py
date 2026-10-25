"""Native Safari CI probes for After Midnight, via an existing W3C driver.

Requires an already running loopback server on 8765 and safaridriver on 4444.
This file never enables Remote Automation or changes any Safari/system setting.
Run it only in the managed macOS Actions job configured by the owning workflow.

Both source and standalone: real menu selection, then all 3 heroes in all 3
story openings and both replay modes. Stage entries, injected nonlethal foes and
small applied test damage are controlled setup, not a natural playthrough.
"""
from pathlib import Path
import base64
import json
import math
import sys
import time
import traceback
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/out/native-safari-after-midnight'
OUT.mkdir(parents=True, exist_ok=True)
DRIVER = 'http://127.0.0.1:4444'
SITE = 'http://127.0.0.1:8765/'
session = None
report = {
    'checks': [], 'scenes': [],
    'method': 'Native Safari, existing loopback HTTP/W3C setup, real key/pointer input. '
              'Controlled case entries, spawned test foes and applied test damage; not a natural playthrough.',
    'limitations': ['Does not certify downloaded HTML opened through Finder/file://.',
                    'Does not establish first-time pacing, subjective audio or real slow-device performance.'],
}


def call(method, endpoint, data=None):
    raw = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(DRIVER + endpoint, data=raw, method=method,
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


def wait(script, seconds=15):
    deadline, last = time.monotonic() + seconds, None
    while time.monotonic() < deadline:
        try:
            last = js(script)
            if last:
                return last
        except RuntimeError:
            pass
        time.sleep(0.1)
    raise AssertionError('Condition not met: ' + script + '; last=' + str(last))


def check(label, passed):
    assert passed, label
    report['checks'].append(label)
    print('PASS ' + label, flush=True)


def key(value, duration=100):
    command('/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
        {'type': 'keyDown', 'value': value}, {'type': 'pause', 'duration': duration},
        {'type': 'keyUp', 'value': value}]}]})


def shifted_tab():
    command('/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
        {'type': 'keyDown', 'value': '\ue008'}, {'type': 'keyDown', 'value': '\ue004'},
        {'type': 'keyUp', 'value': '\ue004'}, {'type': 'keyUp', 'value': '\ue008'}]}]})


def pointer(x, y, click=False):
    actions = [{'type': 'pointerMove', 'origin': 'viewport', 'x': int(round(x)),
                'y': int(round(y)), 'duration': 0}]
    if click:
        actions += [{'type': 'pointerDown', 'button': 0}, {'type': 'pointerUp', 'button': 0}]
    command('/actions', {'actions': [{'type': 'pointer', 'id': 'mouse',
        'parameters': {'pointerType': 'mouse'}, 'actions': actions}]})


def logical_point(script, *args):
    return js("""const point=(()=>{""" + script + """})();
        const e=DM.Engine,r=e.canvas.getBoundingClientRect();
        return {x:Math.round(r.left+e.offX+point.x*e.scale),
                y:Math.round(r.top+e.offY+point.y*e.scale)};""", *args)


def click_logical(script, *args):
    point = logical_point(script, *args)
    pointer(point['x'], point['y'], True)


def state():
    return js("""const p=DM.dev.play();return {chapter:p?.chapter.id,hero:p?.player.profile?.id,
        form:p?.player.form,hp:p?.player.coherence,maxHp:p?.player.maxCoherence,energy:p?.player.energy,
        x:p?.player.x,y:p?.player.y,time:p?.world.realTime,failed:p?.failed,locked:p?.ctx.locked,
        dialog:p?.dialog.active,paused:!!p&&DM.Engine.top()!==p,god:!!p?.player.godMode,
        gear:p?Object.keys(p.player.powers).length:0,error:DM.Engine.error?String(DM.Engine.error):null};""")


def settled():
    # StageIndex/form exist one frame before a chapter's opening generator runs.
    # Wait for its actual objective, cleared dialogue/locks and stable control.
    time.sleep(0.4)
    calm = 0
    for _ in range(100):
        s = state()
        if s.get('dialog') or s.get('locked') or s.get('paused'):
            calm = 0
            key('e')
        elif js("return !!DM.dev.play()?.hud.objective"):
            calm += 1
            if calm >= 4:
                return
        time.sleep(0.1)
    raise AssertionError('The live case opening never gave stable control: ' + str(state()))


def stage(case_id, hero, theme):
    js("""DM.Save.settings.focusPause=false;DM.Save.settings.textSpeed='instant';
        DM.Save.settings.challenge='normal';DM.Save.settings.invulnerable=false;
        DM.AfterMidnight.start(arguments[0],{hero:arguments[1],theme:arguments[2],instant:true});""",
        case_id, hero, theme)
    settled()


def spawn_target(distance):
    # Find an actually clear line beside the existing spawn, not a point in a wall.
    return js("""const p=DM.dev.play(),w=p.world;const d=arguments[0];
        const directions=[0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4];
        let point=null;
        for(const radius of [d,Math.max(42,d*.7),42]){
          for(const a of directions){const x=p.player.x+Math.cos(a)*radius,y=p.player.y+Math.sin(a)*radius;
            if(w.isFree(x,y,15)&&w.los(p.player.x,p.player.y,x,y)){point={x,y};break;}}
          if(point)break;
        }
        if(!point)throw new Error('No clear test target position');
        const e=w.add(new DM.Enemies.Gangster({...point,alerted:false}));
        e.stun=100;e.fireCd=100;e.onAlert=()=>{};window.__amSafariTarget=e;
        return {x:e.x,y:e.y,hp:e.hp};""", distance)


def aim_target():
    point = logical_point("return DM.dev.play().world.camera.toScreen(__amSafariTarget.x,__amSafariTarget.y);")
    pointer(point['x'], point['y'])
    time.sleep(0.08)


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
        command('/url', {'url': SITE + target})
        wait('return !!window.DM?.dev && !!DM.AfterMidnight?.createPlayer && !!DM.Scenes.AfterMidnightMenu')
        js("window.__amSafariErrors=[];window.addEventListener('error',e=>{if(e.message)__amSafariErrors.push(e.message)});")
        check(label + ': expansion boots without an engine error', not state().get('error'))
        original = js("return {campaign:localStorage.getItem('dr-manhattan.save'),bonus:localStorage.getItem('dr-manhattan.bonus.v1')};")
        canvas = js("const r=DM.Engine.canvas.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};")
        pointer(canvas['x'], canvas['y'], True)
        key('z')
        wait("return DM.Audio.ctx?.state==='running'")
        check(label + ': actual native input unlocks audio', True)
        click_logical("const m=DM.Engine.top().menu;const i=m.items.findIndex(x=>x.label==='AFTER MIDNIGHT');if(i<0)throw new Error('Title entry missing');const r=m.rowRect(i);return {x:r.x+r.w/2,y:r.y+r.h/2};")
        wait('return DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu')
        check(label + ': actual title-menu click opens the case board', True)
        check(label + ': roster contains the three distinct six-ability heroes', js("return DM.AfterMidnight.heroes.length===3&&DM.AfterMidnight.heroes.every(h=>h.abilities.length===6)"))
        for i, hero in enumerate(['niteowl', 'silkspectre', 'rorschach']):
            click_logical("const r=DM.Engine.top().heroRect(arguments[0]);return {x:r.x+r.w/2,y:r.y+35};", i)
            wait("return DM.Engine.top().selected().hero.id==='" + hero + "'")
            check(label + ': actual character-card click chooses ' + hero, js('return DM.AfterMidnight.data.selection.hero===arguments[0]', hero))
        shot(label + '-case-board')
        click_logical("const r=DM.Engine.top().modeRect(0);return {x:r.x+r.w/2,y:r.y+r.h/2};")
        wait("return DM.Engine.top().modeIndex===0&&DM.Engine.top().selected().ch.kind==='story'")
        check(label + ': actual mode click selects story cases from the remembered mode', js("return DM.AfterMidnight.data.selection.mode==='story'"))
        click_logical("const r=DM.Engine.top().caseRect(0);return {x:r.x+r.w/2,y:r.y+25};")
        wait("return DM.Engine.top().selected().ch.amId==='dead_air'&&DM.Engine.top().selected().hero.id==='rorschach'")
        check(label + ': actual case click selects Dead Air before starting', js("return DM.AfterMidnight.data.selection.case==='dead_air'"))
        click_logical("const m=DM.Engine.top().menu;let i=m.items.findIndex(x=>x.label.startsWith('RESUME'));if(i<0)i=m.items.findIndex(x=>x.label==='OPEN CASE FILE');if(i<0)throw new Error('Case action missing');const r=m.rowRect(i);return {x:r.x+r.w/2,y:r.y+r.h/2};")
        wait("return DM.Engine.top() instanceof DM.Scenes.Interlude || DM.dev.play()?.chapter.id==='am_dead_air'")
        if js('return DM.Engine.top() instanceof DM.Scenes.Interlude'):
            # Fresh cases retain the game's comic-page intro. Give its initial
            # input grace time, then use real Return to skip text and begin.
            time.sleep(0.75)
            key('\ue006')
            time.sleep(0.2)
            key('\ue006')
            report.setdefault('interludesAdvancedWithRealReturn', []).append(label)
        wait("return DM.dev.play()?.chapter.id==='am_dead_air'&&DM.dev.play()?.player.profile?.id==='rorschach'")
        settled()
        check(label + ': selected hero enters the case through actual menu input', True)

        for hero_index, hero in enumerate(['niteowl', 'silkspectre', 'rorschach']):
            theme = ['rooftops', 'harbour', 'museum'][hero_index]
            for case_id, case_theme in [('dead_air', 'rooftops'), ('undertow', 'harbour'),
                                        ('glass_archive', 'museum'), ('patrol', theme), ('rescue_clock', theme)]:
                stage(case_id, hero, case_theme)
                tag = f'{label} {hero}/{case_id}'
                current = state()
                check(tag + ': correct case, six gear slots and normal human vulnerability', current['chapter'] == 'am_' + case_id and current['hero'] == hero and
                      current['form'] == 'vigilante' and current['gear'] == 6 and not current['god'] and current['hp'] > 0)
                damage = js("const p=DM.dev.play().player,before=p.coherence;p.invuln=0;const applied=p.damage(5,null,'bullet');return {applied,before,after:p.coherence};")
                check(tag + ': ordinary damage reduces health', damage['applied'] and damage['after'] < damage['before'])
                move = js("""const p=DM.dev.play().player,w=p.world;
                    for(const [key,dx,dy] of [['d',1,0],['s',0,1],['a',-1,0],['w',0,-1]])
                      if([20,40,60].every(d=>w.isFree(p.x+dx*d,p.y+dy*d,p.r)))return key;
                    throw new Error('No clear movement route beside spawn');""")
                before = state(); key(move, 350); after = state()
                check(tag + ': real movement changes the actor position', math.hypot(after['x'] - before['x'], after['y'] - before['y']) > 5)
                key('\ue00c')
                wait('return DM.Engine.top() instanceof DM.Scenes.Pause')
                paused_time = state()['time']; time.sleep(0.25)
                check(tag + ': pause freezes the live simulation', state()['time'] == paused_time)
                key('\ue00c'); wait('return DM.Engine.top()===DM.dev.play()')
                spawn_target(49); aim_target(); key('c', 1250)
                wait('return __amSafariTarget.ko || __amSafariTarget.dead', seconds=4)
                check(tag + ': actual primary input knocks a person out nonlethally', js('return __amSafariTarget.ko&&!__amSafariTarget.dead&&DM.dev.play().ctx.stats.disintegrated===0'))
                q_before = spawn_target(150); aim_target(); key('q', 120); time.sleep(0.55)
                check(tag + ': actual Q input affects its physical target', js('return __amSafariTarget.hp<arguments[0]||__amSafariTarget.ko', q_before['hp']))
                current = state()
                check(tag + ': live content remains healthy and error free', not current['failed'] and current['hp'] > 0 and not current['error'])
                report['scenes'].append({'target': target, 'case': case_id, 'theme': case_theme, **current})
                shot(label + '-' + hero + '-' + case_id)

        raw = js("return localStorage.getItem('dr-manhattan.after-midnight.v1')")
        check(label + ': new progress is saved separately from both existing games', bool(raw) and js("return localStorage.getItem('dr-manhattan.save')===arguments[0].campaign&&localStorage.getItem('dr-manhattan.bonus.v1')===arguments[0].bonus", original))
        errors_before_reload = js('return window.__amSafariErrors || []')
        command('/refresh', {}); wait('return !!window.DM?.dev&&!!DM.AfterMidnight?.createPlayer')
        js("window.__amSafariErrors=[];window.addEventListener('error',e=>{if(e.message)__amSafariErrors.push(e.message)});")
        check(label + ': reload retains real expansion progress', raw == js("return localStorage.getItem('dr-manhattan.after-midnight.v1')"))
        js('DM.Engine.set(new DM.Scenes.AfterMidnightMenu());')
        packet = js('return JSON.parse(DM.AfterMidnight.encode());')
        check(label + ': encoded backup contains the expansion records only', packet['format'] == 'dr-manhattan-after-midnight' and
              packet['version'] == 1 and bool(packet['data']['checkpoints']) and 'campaign' not in packet)
        click_logical("const m=DM.Engine.top().menu;const i=m.items.findIndex(x=>x.label==='BACK UP / RESTORE PROGRESS');const r=m.rowRect(i);return {x:r.x+r.w/2,y:r.y+r.h/2};")
        wait("return !!document.getElementById('after-midnight-backup')")
        check(label + ': actual backup-menu click opens the modal', js("return document.getElementById('after-midnight-backup').getAttribute('role')==='dialog'"))
        check(label + ': backup initially focuses Export', js("return document.activeElement.textContent==='EXPORT PROGRESS'"))
        shifted_tab()
        check(label + ': Shift-Tab traps focus at the modal end', js("return document.activeElement.textContent==='BACK TO THE CASE BOARD'"))
        key('\ue004')
        check(label + ': Tab wraps focus to Export', js("return document.activeElement.textContent==='EXPORT PROGRESS'"))
        shot(label + '-backup-focus')
        key('\ue00c'); wait("return !document.getElementById('after-midnight-backup')")
        check(label + ': Escape returns to the case board and focuses the canvas', js('return DM.Engine.top() instanceof DM.Scenes.AfterMidnightMenu && document.activeElement===DM.Engine.canvas'))
        check(label + ': expansion probes never modify the original campaign or bonus save', js("return localStorage.getItem('dr-manhattan.save')===arguments[0].campaign&&localStorage.getItem('dr-manhattan.bonus.v1')===arguments[0].bonus", original))
        check(label + ': no uncaught page or engine errors before or after reload', not errors_before_reload and
              js('return __amSafariErrors.length===0 && !DM.Engine.error'))
        report.setdefault('saveRecords', {})[label] = json.loads(raw)

    check('both builds cover all fifteen distinct hero/content combinations', len(report['scenes']) == 30 and
          len({(s['target'], s['hero'], s['case']) for s in report['scenes']}) == 30)
    report['status'] = 'passed'
    print(f"NATIVE SAFARI AFTER MIDNIGHT PASSED: {len(report['checks'])} checks.", flush=True)
except Exception:
    report['status'] = 'failed'; report['failure'] = traceback.format_exc()
    print(report['failure'], file=sys.stderr, flush=True)
    if session:
        try:
            shot('failure'); report['lastState'] = state()
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
