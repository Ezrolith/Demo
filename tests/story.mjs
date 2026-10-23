/* Package H acceptance checks. Real chapter scripts and controls, driven at
 * 60 Hz like encounters.mjs; no stage skipping. Placement shortcuts travel,
 * never the outcome being checked. Run: node tests/story.mjs [index-or-dist]. */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/out/story');
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const ev = (fn, arg) => page.evaluate(fn, arg);
let checks = 0, failures = 0;
function assert(label, ok, detail = '') {
  checks++;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ': ' + detail : ''}`);
  if (!ok) failures++;
}
async function scenario(label, fn) {
  console.log(`\n${label}`);
  try { await fn(); }
  catch (e) { assert(label + ' completed', false, String(e.stack || e)); }
}
try {
  const target = process.argv[2] || path.join(root, 'index.html');
  const url = new URL(/^https?:/.test(target) ? target : pathToFileURL(target).href);
  url.searchParams.set('dev', '');
  await page.goto(url.href);
  await page.waitForFunction(() => window.DM?.dev, null, { timeout: 15000 });
  await page.mouse.click(640, 360);
  await ev(() => {
    const D = window.DM, E = D.Engine, frame = E.frame;
    const T = window.__story = { t: performance.now(), captions: [] };
    E.frame = () => requestAnimationFrame(t => E.frame(t));
    window.__step = (seconds, render = false) => {
      const raf = window.requestAnimationFrame, draw = E.render;
      window.requestAnimationFrame = () => 0;
      try {
        for (let i = 0, n = Math.max(1, Math.round(seconds * 60)); i < n; i++) {
          T.t += 1000 / 60;
          E.render = render && i === n - 1 ? draw : () => {};
          frame.call(E, T.t);
          if (E.error) throw E.error;
        }
      } finally { window.requestAnimationFrame = raf; E.render = draw; }
    };
    window.__tap = (key) => {
      D.Input.simulate(key, true); window.__step(1 / 60);
      D.Input.simulate(key, false); window.__step(1 / 60);
    };
    window.__aim = (x, y) => {
      const s = D.dev.play().world.camera.toScreen(x, y);
      D.Input.mouse.x = s.x; D.Input.mouse.y = s.y;
    };
    const caption = D.HUD.prototype.caption;
    D.HUD.prototype.caption = function(text, ...args) {
      T.captions.push(text); return caption.call(this, text, ...args);
    };
    D.Save.settings.focusPause = false;
    D.Save.settings.textSpeed = 'instant';
  });
  const step = (s, render = false) => ev(([s, r]) => window.__step(s, r), [s, render]);
  const tap = k => ev(k => window.__tap(k), k);
  async function until(label, fn, seconds = 35, talk = true) {
    for (let t = 0; t < seconds; t += .15) {
      if (await ev(fn)) return;
      if (talk && await ev(() => window.DM.dev.play()?.dialog.active || window.DM.Engine.top()?.constructor.name === 'PowerUnlock')) await tap('KeyE');
      await step(.15);
    }
    throw new Error(label + ' timed out; ' + JSON.stringify(await ev(() => window.DM.dev.state())));
  }
  async function start(ch, stage, carry = null) {
    await ev(([ch, stage, carry]) => {
      const D = window.DM, E = D.Engine;
      D.Input.clearAll(); E.error = null; E.fade.dir = 0; E.fade.a = 0; E.fade.cb = null;
      const i = D.Chapters.get(ch).stages.findIndex(s => s.id === stage);
      if (i < 0) throw new Error('Unknown stage: ' + stage);
      E.set(new D.Scenes.Play(), { chapter: ch, stage: i, carry });
    }, [ch, stage, carry]);
    await until('control in ' + ch + '/' + stage, () => {
      const D = window.DM, p = D.dev.play();
      return p && D.Engine.top() === p && !D.Engine.fading && !p.dialog.active && !p.ctx.locked && !p.player.locked && !!p.hud.objective;
    });
  }
  async function shot(name) { await step(1 / 60, true); await page.screenshot({ path: path.join(out, name + '.png') }); }
  async function place(x, y) {
    await ev(([x,y]) => {
      const p = window.DM.dev.play().player;
      p.x = x; p.y = y; p.vx = p.vy = 0;
    }, [x,y]);
    await step(.1);
  }
  async function power(key, target, duration = .8) {
    await ev(([key, at]) => { window.__aim(at.x, at.y); window.DM.Input.simulate(key, true); }, [key, target]);
    await step(.05);
    await ev(key => window.DM.Input.simulate(key, false), key);
    await step(duration);
  }

  await scenario('Ending tones, payoff flags and declared memory totals', async () => {
    const data = await ev(() => {
      const D = window.DM, E = D.EndingData;
      const runs = [[0,0], [0,12], [5,7], [12,0]].map(([k,s]) => {
        const run = E.run({ completed: { superman: { disintegrated:k, spared:s, memories:0, time:1 } } });
        return { tone:run.tone, pages:E.build(run) };
      });
      const witnesses = ['heard','free','silenced'].map(witness => E.build(E.run({completed:{karnak:{flags:{witness}}}})).join('\n'));
      const total = E.memoryTotal();
      D.Chapters.list.push({id:'__story_memory', memories:4});
      const dynamic = E.memoryTotal(); D.Chapters.list.pop();
      return { runs, witnesses, total, dynamic };
    });
    assert('fresh save has neutral tone and no zero-person sentence', data.runs[0].tone === 'unknown' && !/0 people|no one people/.test(data.runs[0].pages.join(' ')));
    assert('gentle, mixed and detached runs have distinct pages', data.runs.map(r=>r.tone).join(',') === 'unknown,gentle,mixed,detached' && new Set(data.runs.map(r=>r.pages.join('\n'))).size === 4);
    assert('all three witness flags have different payoff pages', new Set(data.witnesses).size === 3);
    assert('stopping both presses earns its own ending page', await ev(()=>{const E=window.DM.EndingData;return E.build(E.run({completed:{superman:{flags:{pressesDown:2}}}})).some(p=>p.includes('two printing presses'));}));
    assert('memory total follows chapter data', data.total > 0 && data.dynamic === data.total + 4, JSON.stringify({total:data.total,dynamic:data.dynamic}));
    for (const [k,s] of [[0,12],[5,7],[12,0]]) {
      await ev(([k,s]) => {
        const D = window.DM; D.Save.data = D.Save.defaults();
        D.Save.data.completed.superman = { disintegrated:k, spared:s, memories:0, time:60, flags:{molochArrested:k===0, heldWatch:true} };
        const end = new D.Scenes.Ending(); D.Engine.set(end);
        end.page = end.pages.findIndex(p => /down gently|came apart at my touch/.test(p));
        D.Save.settings.textSpeed = 'instant'; end.pageT = 2;
      }, [k,s]);
      await shot(`ending-${k}-${s}`);
    }
  });

  await scenario('Pier officers, presses, lighting and checkpoint restoration', async () => {
    await start('superman','yard');
    const initial = await ev(() => {
      const p = window.DM.dev.play(), R = p.ctx.refs;
      return { cops:R.cops.length, targetable:R.cops.every(c=>c.targetable&&c.hp===30), presses:R.presses.length, hp:R.presses.map(p=>p.hp), objective:p.hud.objective.text };
    });
    assert('three targetable officers and two 220-HP presses are present', initial.cops===3 && initial.targetable && initial.presses===2 && initial.hp.every(h=>h===220), JSON.stringify(initial));
    await place(610,1110); await shot('pier-officers-and-billboard');
    const carry = await ev(() => {
      const D=window.DM,p=D.dev.play(),R=p.ctx.refs;
      R.cops[2].damage(1000,null,'bullet');
      R.presses[1].damage(1000,p.player,'impact');
      return p.ctx.snapshot();
    });
    assert('wounding and disabling the press set story flags', carry.flags.officersSafe===2 && carry.flags.pressesDown===1, JSON.stringify(carry.flags));
    await start('superman','office',carry);
    const restored = await ev(() => {
      const p=window.DM.dev.play(),R=p.ctx.refs;
      return {safe:R.cops.filter(c=>!c.down).length, presses:R.presses.filter(p=>p.stopped).length, cops:R.cops.map(c=>c.down), machines:R.presses.map(p=>p.stopped), stats:p.ctx.stats};
    });
    assert('checkpoint restores officer and press outcomes without awarding kills', restored.safe===2 && restored.presses===1 && restored.stats.disintegrated===0, JSON.stringify(restored));
    assert('checkpoint restores the same individual officer and press', restored.cops.join(',') === 'false,false,true' && restored.machines.join(',') === 'false,true', JSON.stringify(restored));
    await start('superman','warehouse',carry);
    assert('press stopped during the yard stays stopped at warehouse checkpoint', await ev(()=>window.DM.dev.play().ctx.refs.presses[1].stopped));
    await start('superman','office',{stats:{time:0,disintegrated:0,spared:0,memories:0},found:[],flags:{officersSafe:2,pressesDown:1}});
    assert('older count-only story saves remain compatible', await ev(()=>{const R=window.DM.dev.play().ctx.refs;return R.cops.filter(c=>c.down).length===1&&R.presses.filter(p=>p.stopped).length===1;}));
    await start('superman','warehouse');
    await place(1590,620);
    const press = await ev(()=>{ const p=window.DM.dev.play();p.player.godMode=true;return {x:p.ctx.refs.presses[0].x,y:p.ctx.refs.presses[0].y}; });
    for(let i=0;i<4;i++) { await ev(()=>window.DM.dev.play().player.energy=100); await power('KeyQ',press,1.1); }
    assert('four real Q presses stop the printing press once', await ev(()=>{const p=window.DM.dev.play();return p.ctx.refs.presses[0].stopped && p.ctx.flags.pressesDown===1 && p.ctx.stats.disintegrated===0;}));
    await shot('warehouse-disabled-press');
  });

  await scenario('Getaway: catch with C and set down, then save the arrest', async () => {
    await start('superman','getaway');
    await ev(()=>{const p=window.DM.dev.play();p.player.x=1370;p.player.y=980;p.player.vx=p.player.vy=0;p.player.energy=100;});
    await step(.05);
    await ev(()=>{const D=window.DM,c=D.dev.play().ctx.refs.getaway;window.__aim(c.x,c.y);D.Input.simulate('KeyC',true);});
    await step(.7);
    assert('C actually grabs the car and stops its engine', await ev(()=>{const p=window.DM.dev.play(),c=p.ctx.refs.getaway;return c.state==='caught' && c.heldBy===p.player;}));
    await ev(()=>window.DM.Input.simulate('KeyC',false));
    await until('Moloch arrest',()=>!!window.DM.dev.play().ctx.flags.molochArrested,12);
    assert('arrest counts one spared person and no kills', await ev(()=>{const s=window.DM.dev.play().ctx.stats;return s.spared===1&&s.disintegrated===0;}));
    await shot('moloch-arrest');
    await until('chapter completion',()=>window.DM.Engine.top().constructor.name==='ChapterComplete',60);
    const saved = await ev(()=>{const D=window.DM;D.Save.write();D.Save.load();return {done:D.Save.data.completed.superman,pages:D.EndingData.build(D.EndingData.run(D.Save.data))};});
    assert('arrest survives saving/reloading and appears in ending', saved.done.flags.molochArrested===true && saved.pages.some(p=>p.includes('stood trial')));
  });

  await scenario('Getaway: disintegrate with Q', async () => {
    await start('superman','getaway');
    await ev(()=>{const p=window.DM.dev.play();p.player.x=1355;p.player.y=970;p.player.energy=100;});
    await step(.05);
    const c=await ev(()=>{const c=window.DM.dev.play().ctx.refs.getaway;return{x:c.x,y:c.y};});
    await power('KeyQ',c,.8);
    await until('Moloch gone',()=>!!window.DM.dev.play().ctx.flags.molochGone,5);
    assert('Q kills the driver once, without marking an arrest', await ev(()=>{const p=window.DM.dev.play();return p.ctx.stats.disintegrated===1&&p.ctx.stats.spared===0&&!p.ctx.flags.molochArrested;}));
    await step(1);
    assert('lethal result cannot count twice', await ev(()=>window.DM.dev.play().ctx.stats.disintegrated===1));
    await shot('moloch-disintegrated');
  });

  await scenario('Getaway: unimpeded escape follows the actual route', async () => {
    await start('superman','getaway');
    await until('Moloch escapes',()=>!!window.DM.dev.play().ctx.flags.molochEscaped,30);
    assert('escape counts neither a kill nor a rescue', await ev(()=>{const p=window.DM.dev.play();return p.ctx.stats.disintegrated===0&&p.ctx.stats.spared===0;}));
  });

  await scenario('River: thrown gangster is rescued, crate sinks', async () => {
    await start('superman','yard');
    await ev(()=>{
      const D=window.DM,p=D.dev.play();p.player.godMode=true;
      const g=p.world.entities.find(e=>e.human&&e.team==='enemy');
      g.x=1050;g.y=1265;g.vx=0;g.vy=650;g.thrown=2;g.stun=3;
      window.__riverGuy=g;
      window.__riverCrate=p.world.add(new D.Props.Crate(1160,1265));
      Object.assign(window.__riverCrate,{vx:0,vy:650,thrown:2});
    });
    await step(3.5);
    const river=await ev(()=>{const p=window.DM.dev.play(),g=window.__riverGuy;return{ko:g.ko,dead:g.dead,sinking:g.sinking,y:g.y,spared:p.ctx.stats.spared,killed:p.ctx.stats.disintegrated,fished:p.ctx.flags.fished,crateDead:window.__riverCrate.dead};});
    assert('gangster is fished out alive and counted once',river.ko&&!river.dead&&!river.sinking&&river.y<1300&&river.spared===1&&river.killed===0&&river.fished===1,JSON.stringify(river));
    assert('thrown crate sinks',river.crateDead);
  });

  await scenario('Prologue: five active prompts and the watch choice', async () => {
    await start('prologue','accident');
    const interactables=await ev(()=>{const R=window.DM.dev.play().ctx.refs;return R.lockdown.map(e=>({label:e.interact.label,enabled:e.interact.enabled()}));});
    assert('five lockdown prompts are active',interactables.length===5&&interactables.every(i=>i.enabled),JSON.stringify(interactables));
    await tap('KeyE');
    await until('watch in hand',()=>!!window.DM.dev.play().ctx.flags.heldWatch,2);
    assert('E chooses to hold the watch',await ev(()=>window.DM.dev.play().ctx.flags.heldWatch===true));
    await shot('prologue-held-watch');
    await until('flash',()=>window.DM.dev.play().ctx.flags.flashed,30);
    await until('prologue completion',()=>window.DM.Engine.top().constructor.name==='ChapterComplete',40);
    const result=await ev(()=>({flags:window.DM.Save.data.completed.prologue.flags,captions:window.__story.captions}));
    assert('holding the watch changes post-flash narration and persists',result.flags.heldWatch&&result.captions.some(s=>s.includes('no hand to let go with')));
  });
  assert('no uncaught browser errors',errors.length===0,errors.join('\n'));
} finally {
  await browser.close();
}
console.log(`\nStory acceptance: ${checks-failures}/${checks} checks passed.`);
process.exitCode = failures ? 1 : 0;
