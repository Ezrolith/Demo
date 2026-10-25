from pathlib import Path

def replace(name, old, new, count=1):
    p = Path(name)
    s = p.read_text()
    assert s.count(old) == count, (name, old[:80], s.count(old))
    p.write_text(s.replace(old, new))

replace('src/game/long-summer-kit.js', '''      const minX = Math.max(hw, b.x + e.right - (DM.W / 2 - 38) / zoom, p.x + p.r - (DM.W / 2 - 38) / zoom);
      const maxX = Math.min(w.w - hw, b.x - e.left + (DM.W / 2 - 38) / zoom, p.x - p.r + (DM.W / 2 - 38) / zoom);
      const minY = Math.max(hh, b.y + e.bottom - (DM.H / 2 - 135) / zoom,
        p.y + p.r + 32 - (DM.H / 2 - HUD_BOTTOM) / zoom);
      const maxY = Math.min(w.h - hh, b.y - e.top + (DM.H / 2 - 125) / zoom, p.y - p.r + (DM.H / 2 - 112) / zoom);
''', '''      // A view wider than the arena must be centred, not given impossible edge bounds.
      const minX = Math.max(w.w <= 2 * hw ? w.w / 2 : hw,
        b.x + e.right - (DM.W / 2 - 38) / zoom, p.x + p.r - (DM.W / 2 - 38) / zoom);
      const maxX = Math.min(w.w <= 2 * hw ? w.w / 2 : w.w - hw,
        b.x - e.left + (DM.W / 2 - 38) / zoom, p.x - p.r + (DM.W / 2 - 38) / zoom);
      const minY = Math.max(w.h <= 2 * hh ? w.h / 2 : hh, b.y + e.bottom - (DM.H / 2 - 135) / zoom,
        p.y + p.r + 32 - (DM.H / 2 - HUD_BOTTOM) / zoom);
      const maxY = Math.min(w.h <= 2 * hh ? w.h / 2 : w.h - hh,
        b.y - e.top + (DM.H / 2 - 125) / zoom, p.y - p.r + (DM.H / 2 - 112) / zoom);
''')
anchor = "  check('truck framing includes the machine at all four arena corners', await page.evaluate(() => {"
checks = '''  check('a viewport wider than the truck arena has a feasible centred camera', await page.evaluate(() => {
    const p = T.p();
    const t = p.ctx.flags.truck;
    const old = { px: p.player.x, py: p.player.y, bx: t.x, by: t.y };
    try {
      // Controlled reproduction of the positions observed in the real-input approach.
      Object.assign(p.player, { x: 587, y: 1040 });
      Object.assign(t, { x: 1179, y: 658 });
      const point = t.cameraFrame.target(0.6);
      return point.feasible && Math.abs(point.x - p.world.w / 2) < 0.01 &&
        t.cameraFrame.projectionSafe(0.6, point.x, point.y);
    } finally {
      Object.assign(p.player, { x: old.px, y: old.py });
      Object.assign(t, { x: old.bx, y: old.by });
    }
  }));
  check('truck approach framing stays readable rather than collapsing to minimum zoom', await page.evaluate(() => {
    const p = T.p();
    const t = p.ctx.flags.truck;
    const c = p.world.camera;
    const old = { px: p.player.x, py: p.player.y, bx: t.x, by: t.y,
      cx: c.x, cy: c.y, zoom: c.zoom, targetZoom: c.targetZoom };
    try {
      Object.assign(p.player, { x: 587, y: 1040 });
      Object.assign(t, { x: 1179, y: 658 });
      c.zoom = p.world.baseZoom;
      t.cameraFrame.update();
      return c.targetZoom >= 0.5 && c.zoom >= 0.5 &&
        t.cameraFrame.projectionSafe(c.zoom, c.x, c.y);
    } finally {
      Object.assign(p.player, { x: old.px, y: old.py });
      Object.assign(t, { x: old.bx, y: old.by });
      Object.assign(c, { x: old.cx, y: old.cy, zoom: old.zoom, targetZoom: old.targetZoom });
      t.cameraFrame.update();
    }
  }));
'''
replace('tests/long-summer.mjs', anchor, checks + anchor)
replace('tests/bonus-portability.mjs', 'await fresh.waitForFunction(() => window.DM?.BonusBackup);',
        'await fresh.waitForFunction(() => window.DM?.BonusBackup && DM.dev);', 2)

# Native Safari: loopback HTTP preserves its file sandbox; pair held keys in one action sequence.
name = 'tests/safari-platform.py'
replace(name, "command('/url', {'url': (ROOT / target).as_uri()})",
        "command('/url', {'url': 'http://127.0.0.1:8765/' + target})")
replace(name, "isinstance(value, dict) and 'error' in value",
        "isinstance(value, dict) and value.get('error') and 'message' in value")
replace(name, "key('\\ue007')", "key('\\ue006')  # Primary Return, not numeric-keypad Enter.")
replace(name, 'native Safari, file navigation and W3C input',
        'native Safari, loopback HTTP and W3C input; file sandbox unchanged')
replace(name, '''                command('/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
                    {'type': 'keyDown', 'value': 'f'}]}]})
                time.sleep(0.35)
                slow = js('return DM.dev.play().world.timeScale')
                command('/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
                    {'type': 'keyUp', 'value': 'f'}]}]})
                check(f'{label} {chapter}/{index}: Temporal Sight responds', slow < 0.9)
''', '''                # Read-only telemetry during one genuine hold/release action sequence.
                js("""window.__qaSightMin=1; const deadline=performance.now()+1200;
                    function sample(){const p=DM.dev.play(); if(p) window.__qaSightMin=Math.min(window.__qaSightMin,p.world.timeScale);
                        if(performance.now()<deadline) requestAnimationFrame(sample);}
                    requestAnimationFrame(sample);""")
                key('f', 450)
                wait("return !DM.Input.down('timesight') && !DM.dev.play().world.timesight")
                slow = js('return window.__qaSightMin')
                check(f'{label} {chapter}/{index}: Temporal Sight activates and releases', slow < 0.9)
''')
