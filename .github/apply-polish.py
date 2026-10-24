from pathlib import Path
import re
root = Path('.')
a = root / 'src/data/chapters/last-broadcast.js'
b = root / 'src/data/chapters/ninth-minute.js'
s = a.read_text()
t = b.read_text()
comp = s[s.index('  class Companion extends'):s.index('  function companions(')]
comp = comp.replace('constructor(x,y,who)', 'constructor(x,y,who,options={})')
comp = comp.replace('this.who=who;', 'this.who=who;this.options=options;this.holdPosition=false;this.showName=true;this.taskTarget=null;')
comp = comp.replace('if(w.ceasefire){', 'if(w.ceasefire||this.holdPosition||(this.options.holdPosition&&this.options.holdPosition(w))){')
comp = comp.replace('for(const e of w.entities)if', 'for(const e of this.taskTarget ? [] : w.entities)if')
comp = comp.replace("let tx=p.x+(this.who==='niteowl'?-65:65),ty=p.y+75;", "let tx=this.taskTarget?this.taskTarget.x:p.x+(this.who==='niteowl'?-65:65);let ty=this.taskTarget?this.taskTarget.y:p.y+75;")
comp = comp.replace('if(near(w,this,210))', 'if(this.showName&&(!this.options.showName||this.options.showName(w))&&withinRange(w,this,210))')
comp = comp.replace('smallBurst(', 'burst(').replace('this.bonusLight', 'this.light')
mask_start = s.index('  // Add only the two new masks')
mask_end = s.index('  DM.MusicTracks.bonus_noir')
s = s[:mask_start] + s[mask_end:]
for name in ['niteowl', 'rorschach']:
    s = re.sub(r'^    ' + name + r': \{[^\n]+\},\n', '', s, flags=re.M)
s = s[:s.index('  // Small label plates')] + '''  const { label, ring, burst: smallBurst, withinRange: near, Sign, Terminal: Console, Companion } = DM.BonusKit;

''' + s[s.index('  class Evidence extends'):]
start = s.index('  class Companion extends')
end = s.index('  function companions(', start)
s = s[:start] + s[end:]
start = t.index('  function circle(')
end = t.index('  function clock(', start)
t = t[:start] + '''  const { ring: circle, label: plate, burst, Sign, Terminal, Companion } = DM.BonusKit;

''' + t[end:]
start = t.index('  class Sign extends')
end = t.index('  class LostMoment extends', start)
t = t[:start] + t[end:]
start = t.index('    const owl=ctx.add(new DM.LastBroadcast.Companion')
end = t.index('    ctx.flags.owl=owl;', start)
t = t[:start] + '''    const owl = ctx.add(new Companion(x - 65, y + 40, 'niteowl', {
      holdPosition: () => !!ctx.flags.operators,
      showName: world => !world.boss,
    }));
''' + t[end:]
start = t.index("    // This adventure's longer teamwork hints")
end = t.index('  function drones(', start)
t = t[:start] + '  }\n' + t[end:]
t = t.replace("const lamp=ctx.add(new Sign(xx,y+245,'',GOLD));lamp.renderEmissive=()=>{};lamp.bonusLight=()=>({r:190,i:.6,color:GOLD,k:.14});", "ctx.add(new DM.BonusKit.Lamp(xx, y + 245, { r: 190, i: 0.6, color: GOLD, k: 0.14 }));")
s = s.replace('bonusLight', 'light')
t = t.replace('bonusLight', 'light')
hints_a = [
    'All six powers are ready. Cross the bridge or teleport. E interacts; H recalls this hint.',
    'Lift each coil into its matching dock and release gently. E frees an engineer.',
    'Break the pylons, then attack the core. Catch missiles to return them. F slows danger.',
    'Gold sends the evidence and brings interceptors. Blue shuts down quietly. E chooses.',
]
hints_b = [
    'E cycles the signal: choose SERVICE. Amber rails warn before firing. F slows them.',
    'E calls Laurie to a carriage. Clear nearby enemies while she opens it. Escort people out.',
    'Dodge the clock hands. Strike the open teal core or return a missile. F slows the cycle.',
    'Blue releases the loop. Gold saves the record: hold F in the teal ring. E chooses.',
]
for text, values in [(s, hints_a), (t, hints_b)]:
    assert len(re.findall(r"ctx.tutorial\('[^']*',\d+\)", text)) == len(values)
for name, values in [('s', hints_a), ('t', hints_b)]:
    it = iter(values)
    text = s if name == 's' else t
    text = re.sub(r"ctx.tutorial\('[^']*',(\d+)\)", lambda m: "ctx.tutorial('" + next(it) + "'," + m[1] + ")", text)
    if name == 's':
        s = text
    else:
        t = text
s = s.replace("'And the coils. Two of them. He is using the building itself as an antenna.'", "'Two coils, two matching docks. Lift one into place and release it gently. Then free the engineers.'")
a.write_text(s)
b.write_text(t)
kit = '''/* Shared bonus-adventure helpers. No campaign behaviour is replaced. */
(function () {
  'use strict';
  const DM = window.DM;
  const G = DM.Gfx;
  const U = DM.U;
  const BLUE = '#80dcff';
  const GOLD = '#e5ba68';
  const active = entity => !entity.dead && !entity.ko;

  function withinRange(world, entity, distance = 250) {
    return !!world.player && U.dist(entity.x, entity.y, world.player.x, world.player.y) < distance;
  }

  function label(g, text, x, y, color = GOLD, size = 13) {
    if (!text) return;
    const width = G.measure(g, text, { size, font: DM.FONTS.display }) + 24;
    g.fillStyle = 'rgba(3,8,16,0.88)';
    G.rr(g, x - width / 2, y - 18, width, 26, 4);
    g.fill();
    G.text(g, text, x, y, { size, align: 'center', weight: 600, color, spacing: 0.6 });
  }

  function ring(g, x, y, radius, color, width = 2) {
    g.strokeStyle = color;
    g.lineWidth = width;
    G.circle(g, x, y, radius);
    g.stroke();
  }

  function burst(world, x, y, color = BLUE) {
    world.particles.burst(x, y, 20, {
      color: [color, '#ffffff'], speed: [35, 140], life: [0.3, 0.9], size: [1.5, 3], shape: 'spark',
    });
  }

  class Sign extends DM.Entity {
    constructor(x, y, text, color = GOLD, size = 16) {
      super({ x, y, body: false, solid: false, static: true, disintegratable: false });
      this.text = text;
      this.col = color;
      this.size = size;
      this.sceneryLabel = true;
    }
    render(g, world) {
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g) {
      label(g, this.text, this.x, this.y, this.col, this.size);
    }
  }

  class Lamp extends DM.Entity {
    constructor(x, y, profile) {
      super({ x, y, static: true, body: false, solid: false, disintegratable: false });
      this.profile = profile;
    }
    light() {
      return this.profile;
    }
  }

  class Terminal extends DM.Entity {
    constructor(x, y, text, action, enabled = () => true, color = BLUE) {
      super({ x, y, r: 20, body: false, static: true, disintegratable: false });
      this.text = text;
      this.color = color;
      this.col = color;
      this.on = false;
      this.interact = { label: text, range: 85, enabled, onInteract: action };
    }
    light() {
      return { r: 145, i: 0.6, color: this.color, k: 0.16 };
    }
    render(g, world) {
      g.fillStyle = '#374c56';
      g.fillRect(this.x - 22, this.y - 19, 44, 36);
      g.fillStyle = '#101d27';
      g.fillRect(this.x - 17, this.y - 14, 34, 19);
      g.fillStyle = this.color;
      g.fillRect(this.x - 14, this.y - 11, 28, 3);
      g.fillStyle = '#667b7f';
      g.fillRect(this.x - 14, this.y + 9, 18, 3);
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      if (this.interact.enabled && !this.interact.enabled()) return;
      ring(g, this.x, this.y, 32 + Math.sin(world.time * 2) * 2, this.color, 1);
      if (withinRange(world, this, 95)) label(g, this.interact.label, this.x, this.y - 42, this.color);
    }
  }

  function owlMask(g) {
    g.fillStyle = '#806239';
    g.beginPath();
    g.moveTo(28, 43);
    g.lineTo(29, 17);
    g.lineTo(43, 30);
    g.lineTo(57, 30);
    g.lineTo(71, 17);
    g.lineTo(72, 43);
    g.lineTo(66, 60);
    g.lineTo(50, 55);
    g.lineTo(34, 60);
    g.closePath();
    g.fill();
    for (const x of [40, 60]) {
      g.fillStyle = '#d9bb73';
      G.circle(g, x, 46, 11);
      g.fill();
      g.fillStyle = '#172938';
      G.circle(g, x, 46, 8);
      g.fill();
      g.fillStyle = '#91acac';
      G.ellipse(g, x - 2, 44, 3, 2);
      g.fill();
    }
    g.fillStyle = '#d3ad62';
    g.beginPath();
    g.moveTo(46, 49);
    g.lineTo(54, 49);
    g.lineTo(50, 58);
    g.fill();
  }

  function inkMask(g) {
    g.fillStyle = '#e9e4d4';
    G.ellipse(g, 50, 52, 18, 23);
    g.fill();
    g.fillStyle = '#242528';
    for (const side of [-1, 1]) {
      g.save();
      g.translate(50, 0);
      g.scale(side, 1);
      g.beginPath();
      g.moveTo(3, 40);
      g.bezierCurveTo(15, 35, 17, 44, 10, 49);
      g.bezierCurveTo(18, 56, 8, 62, 4, 53);
      g.lineTo(1, 48);
      g.closePath();
      g.fill();
      G.ellipse(g, 7, 65, 4, 3);
      g.fill();
      g.restore();
    }
  }

  DM.LOOKS.niteowl = {
    name: 'Nite Owl', skin: '#d2b483', hair: null, hairStyle: 'bald', hat: null,
    body: '#a98c55', sleeve: '#79603d', legs: '#443b30', cape: '#5c472e',
    collar: '#c2a46b', trim: '#d8bc71', glasses: true, bg: '#6e674c', color: GOLD, mask: owlMask,
  };
  DM.LOOKS.rorschach = {
    name: 'Rorschach', skin: '#e9e4d4', hair: null, hairStyle: 'bald', hat: '#68503c', hatBrim: '#392c23',
    body: '#806347', sleeve: '#806347', legs: '#382f2a', collar: '#b99b76', bg: '#5c5550', color: '#e9dfcd', mask: inkMask,
  };

''' + comp + '''
  DM.BonusKit = { label, ring, burst, withinRange, Sign, Terminal, Companion, Lamp };
})();
'''
(root / 'src/game/bonus-kit.js').write_text(kit)
p = root / 'src/core/gfx.js'
x = p.read_text()
old = "    if (look.manhattan) Gfx.hydrogen(ctx, 50, 33, 6.5, '#e8fbff', t * 0.8, 1.5);"
assert x.count(old) == 1
p.write_text(x.replace(old, "    // Optional character-local mask; campaign looks have no mask callback.\n    if (typeof look.mask === 'function') look.mask(ctx, t);\n" + old))
p = root / 'index.html'
x = p.read_text()
old = '<script src="src/game/bonus.js"></script>'
assert x.count(old) == 1
p.write_text(x.replace(old, old + '\n<script src="src/game/bonus-kit.js"></script>'))
p = root / 'tests/bonus.mjs'
x = p.read_text()
needle = 'try {\n  const init=()=>{'
check = '''try {
  const chapterFiles = ['last-broadcast.js', 'ninth-minute.js'];
  const hintTexts = chapterFiles.flatMap(name => {
    const source = readFileSync(path.join(root, 'src/data/chapters', name), 'utf8');
    return [...source.matchAll(/ctx\\.(?:tutorial|hint)\\('([^']*)'/g)].map(match => match[1]);
  });
  check('all bonus tutorials fit the original one-line HUD (95 characters)',
    hintTexts.length >= 8 && hintTexts.every(text => text.length <= 95));
  const init=()=>{'''
assert needle in x
p.write_text(x.replace(needle, check))

def format_js(source):
    tokens = re.findall(r"(?:'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|`(?:\\.|[^`\\])*`|//[^\n]*|/\*[\s\S]*?\*/|[^'\"`/{};,]+|/(?![/*])|[{};,])", source)
    lines, current = [], ''
    indent = 0
    def flush():
        nonlocal current
        if current.strip():
            lines.append('  ' * indent + current.strip())
        current = ''
    for token in tokens:
        if token.startswith('//') or token.startswith('/*'):
            flush()
            for line in token.splitlines():
                lines.append('  ' * indent + line.strip())
        elif token == '{':
            current += token
            flush()
            indent += 1
        elif token == '}':
            flush()
            indent = max(0, indent - 1)
            current = '}'
        elif token == ';':
            current += token
            flush()
        elif token == ',':
            current += ', '
            if len(current) + indent * 2 > 100:
                flush()
        elif token.startswith(('"', "'", '`')):
            current += token
        else:
            parts = token.splitlines()
            for i, part in enumerate(parts):
                current += re.sub(r'\s+', ' ', part)
                if i < len(parts) - 1:
                    flush()
    flush()
    return '\n'.join(lines) + '\n'

for name in ['src/game/bonus-kit.js', 'src/game/bonus.js', 'src/data/chapters/last-broadcast.js', 'src/data/chapters/ninth-minute.js']:
    p = Path(name)
    p.write_text(format_js(p.read_text()))
