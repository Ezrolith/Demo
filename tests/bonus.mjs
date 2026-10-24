/* Focused browser acceptance. Setup can position Jon and protect him while scripted
 * objectives are exercised; this is not an unassisted playthrough or a frame-rate benchmark.
 * node tests/bonus.mjs [index.html|dist/dr-manhattan.html] [--offline]
 * Offline mode only: inline scripts into about:blank, with in-memory browser storage.
 */
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require(process.env.PLAYWRIGHT_PATH||'playwright');}catch{pw=require('/opt/pyvenv/lib/python3.13/site-packages/playwright/driver/package');}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=process.argv.find(a=>a.endsWith('.html'))||'index.html';
const offline=process.argv.includes('--offline');
const out=path.join(root,'tests/out/bonus');mkdirSync(out,{recursive:true});
const browser=await pw.chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('✓ '+name);};
try {
  const chapterFiles = ['last-broadcast.js', 'ninth-minute.js'];
  const hintTexts = chapterFiles.flatMap(name => {
    const source = readFileSync(path.join(root, 'src/data/chapters', name), 'utf8');
    return [...source.matchAll(/ctx\.(?:tutorial|hint)\('([^']*)'/g)].map(match => match[1]);
  });
  check('all bonus tutorials fit the original one-line HUD (95 characters)',
    hintTexts.length >= 8 && hintTexts.every(text => text.length <= 95));
  const init=()=>{
    window.requestAnimationFrame=()=>0;
    window.__campaign=JSON.stringify({version:2,reached:6,completed:{karnak:{time:123,spared:5,disintegrated:0,memories:2}},settings:{},checkpoint:null});
  };
  if(offline){
    await page.evaluate(init);
    await page.evaluate(()=>{window.__store={'dr-manhattan.save':window.__campaign};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__store[k]||null,setItem:(k,v)=>window.__store[k]=String(v),removeItem:k=>delete window.__store[k]},configurable:true});});
    let html=readFileSync(path.join(root,target),'utf8');
    html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>\n'+readFileSync(path.join(root,src),'utf8').replace(/<\/script/gi,'<\\/script')+'<\/script>');
    html=html.replace(/<link[^>]*>/g,'');
    await page.setContent(html,{waitUntil:'domcontentloaded'});
  }else{
    await page.addInitScript(init);
    await page.addInitScript(()=>localStorage.setItem('dr-manhattan.save',window.__campaign));
    await page.goto(pathToFileURL(path.join(root,target)).href,{waitUntil:'domcontentloaded'});
  }
  await page.waitForFunction(()=>window.DM&&DM.dev,null,{polling:100,timeout:12000});
  await page.evaluate(()=>{
    DM.Engine.governor.enabled=false;DM.Save.settings.focusPause=false;DM.Save.settings.textSpeed='instant';
    window.__before=localStorage.getItem('dr-manhattan.save');
    window.T={
      play:()=>DM.dev.play(), aimPoint:null,
      step(sec=.1){const E=DM.Engine,render=E.render;E.render=()=>{};
        try{for(let i=0;i<Math.ceil(sec*60);i++){if(this.aimPoint&&this.play()){const q=this.play().world.camera.toScreen(this.aimPoint.x,this.aimPoint.y);DM.Input.mouse.x=q.x;DM.Input.mouse.y=q.y;}E.frame(E.last+1000/60);if(E.error)throw E.error;}}
        finally{E.render=render;}E.render();if(E.error)throw E.error;
      },
      start(stage=0){DM.Input.clearAll();this.aimPoint=null;DM.Engine.fade.dir=0;DM.Engine.fade.a=0;DM.Engine.set(new DM.Scenes.Play(),{chapter:'last_broadcast',stage});this.step(.1);},
      dialog(){const p=this.play();for(let j=0;j<25&&p.dialog.active;j++)p.dialog.advance();this.step(.1);},
      key(code,sec=.04){DM.Input.simulate(code,true);this.step(sec);DM.Input.simulate(code,false);this.step(.06);},
      place(x,y){this.play().ctx.place(x,y);this.step(.02);},
      aim(x,y){this.aimPoint={x,y};this.step(.02);},
      interact(e){const w=this.play().world;this.place(e.x,e.y+(w.isFree(e.x,e.y+40,14)?40:-45));this.key('KeyE');},
      shoot(e){this.place(e.x-110,e.y+65);this.aim(e.x,e.y);this.key('KeyQ');this.step(1.2);},
      clear(foes){this.play().player.godMode=true;for(const e of foes){for(let j=0;j<20&&!e.dead&&!e.ko;j++)this.shoot(e);}this.step(.3);},
      console(text){return this.play().world.entities.find(e=>e.interact&&e.interact.label.includes(text));},
      evidence(bit){return this.play().world.entities.find(e=>e.bit===bit);},
      transition(){this.dialog();this.step(1.4);this.dialog();this.play().player.godMode=true;this.step(.1);},
    };
  });
  check('original six chapters and final ending order are unchanged',await page.evaluate(()=>DM.Chapters.list.length===6&&DM.Chapters.next('karnak')===null));
  check('BONUS LEVELS exists in the actual title menu',await page.evaluate(()=>DM.Engine.top().menu.items.some(i=>i.label==='BONUS LEVELS')));
  await page.evaluate(()=>{DM.Engine.set(new DM.Scenes.BonusMenu());T.step(.7);});
  await page.screenshot({path:path.join(out,'01-bonus-menu.png')});
  await page.evaluate(()=>{T.start(0);T.dialog();T.play().player.godMode=true;});
  check('all six existing powers are ready without changing campaign unlocks',await page.evaluate(()=>Object.keys(T.play().player.powers).length===6&&DM.Save.data.reached===6));
  const movement=await page.evaluate(()=>{const p=T.play().player,x=p.x;T.key('KeyD',.5);return p.x-x;});check('normal movement input works',movement>30);
  await page.evaluate(()=>{T.place(350,800);T.aim(650,700);T.key('Space');T.step(.5);});
  check('normal teleport input works',await page.evaluate(()=>T.play().player.x>550));
  await page.evaluate(()=>{T.interact(T.console('ENTER THE RELAY'));});
  check('stairs cannot skip the opening encounter',await page.evaluate(()=>!T.play().ctx.flags.enterRelay));
  await page.evaluate(()=>{T.place(650,650);T.step(4);});
  check('companions actually attack, rather than being decorative NPCs',await page.evaluate(()=>T.play().ctx.flags.owl.strikes+T.play().ctx.flags.rorschach.strikes>0));
  await page.evaluate(()=>{
    const p=T.play(), guard=p.ctx.flags.roofGuards[0];
    guard.damage(999,p.player,'impact');
    p.ctx.flags.testGuard=guard;
    const gone=p.ctx.flags.roofGuards[1];T.shoot(gone);p.ctx.flags.testGone=gone;
    T.clear(p.ctx.flags.roofGuards);
  });
  check('disintegrated guards cannot be interrogated; a KO guard remains available', await page.evaluate(()=>{
    const f=T.play().ctx.flags;return f.testGone.dead&&!f.testGone.interact&&!!f.testGuard.interact;
  }));
  check('roof evidence cannot be collected before the interrogation', await page.evaluate(()=>!T.evidence(1).interact.enabled()));
  await page.evaluate(()=>{T.interact(T.play().ctx.flags.testGuard);T.step(7);T.dialog();});
  check('E sends Rorschach to the spared guard and reveals the dispatch evidence', await page.evaluate(()=>
    T.play().ctx.flags.interrogated&&T.evidence(1).interact.enabled()&&T.play().ctx.stats.spared>=1));
  await page.evaluate(()=>{T.interact(T.evidence(1));T.dialog();});
  check('first evidence record is recovered through interact input',await page.evaluate(()=>T.play().ctx.flags.evidence===1));
  await page.screenshot({path:path.join(out,'02-rooftops.png')});
  await page.evaluate(()=>{T.interact(T.console('ENTER THE RELAY'));T.transition();});
  check('opening encounter naturally advances to the relay map',await page.evaluate(()=>DM.dev.state().stageId==='relay'&&T.play().world.mapId==='broadcast_relay'));
  await page.evaluate(()=>{T.clear(T.play().ctx.flags.relayGuards);});
  await page.evaluate(()=>{for(let i=0;i<3;i++){const e=T.play().world.entities.find(e=>e.interact&&e.interact.label==='Free the engineer');T.interact(e);T.dialog();}});
  check('all three engineers are freed through normal E interactions',await page.evaluate(()=>T.play().ctx.flags.engineers===7));
  await page.evaluate(()=>{const c=T.play().ctx.flags.coilObjects[0];T.shoot(c);});
  check('required puzzle coils cannot be accidentally disintegrated',await page.evaluate(()=>T.play().ctx.flags.coilObjects.every(e=>!e.dead)));
  const docks=await page.evaluate(()=>{
    const p=T.play();
    return p.ctx.flags.coilObjects.map(c=>{
      const d=p.world.entities.find(e=>e instanceof DM.LastBroadcast.Dock&&e.coil===c);
      T.place((c.x+d.x)/2,(c.y+d.y)/2+100);T.aim(c.x,c.y);DM.Input.simulate('Mouse0',true);T.step(.3);
      const grabbed=c.heldBy===p.player;T.aim(d.x,d.y);T.step(2.5);DM.Input.simulate('Mouse0',false);T.step(1.1);
      return {grabbed,docked:c.docked,x:c.x,y:c.y};
    });
  });
  check('both coils can be grabbed, carried and gently docked with the existing telekinesis controls',docks.every(d=>d.grabbed&&d.docked));
  check('supervisor evidence is locked until Nite Owl opens the booth', await page.evaluate(()=>!T.evidence(2).interact.enabled()));
  await page.evaluate(()=>{T.place(1260,650);T.key('KeyE');T.dialog();T.step(10);});
  check('Nite Owl reaches the lock and spends four uninterrupted seconds opening the real gate', await page.evaluate(()=>{
    const d=T.play().ctx.flags.boothDoor;return d.opened&&d.progress>=4&&!T.play().world.walls.includes(d.gate);
  }));
  await page.evaluate(()=>{T.interact(T.evidence(2));T.dialog();T.place(850,650);});
  await page.screenshot({path:path.join(out,'03-relay.png')});
  await page.evaluate(()=>{T.interact(T.console('ROOFTOP LIFT'));T.transition();});
  check('rescue and coil objectives unlock the rooftop encounter naturally',await page.evaluate(()=>DM.dev.state().stageId==='carrier'&&T.play().ctx.flags.engineers===7&&T.play().ctx.flags.evidence===3));
  const shield=await page.evaluate(()=>{const boss=T.play().ctx.flags.carrier;const hp=boss.hp;T.shoot(boss);return boss.hp===hp;});check('carrier shield prevents bypassing the pylon objective',shield);
  await page.evaluate(()=>{T.clear(T.play().ctx.flags.towerGuards);T.interact(T.evidence(4));T.dialog();T.place(870,670);});
  await page.screenshot({path:path.join(out,'04-carrier.png')});
  await page.evaluate(()=>{T.clear(T.play().ctx.flags.pylons);});
  check('normal power attacks disable all three shield pylons',await page.evaluate(()=>T.play().ctx.flags.pylons.every(e=>e.dead)&&!T.play().ctx.flags.carrier.shielded));
  await page.evaluate(()=>{const b=T.play().ctx.flags.carrier;T.clear([b]);T.dialog();T.step(.8);T.dialog();});
  check('defeating the new boss advances to the playable choice',await page.evaluate(()=>DM.dev.state().stageId==='choice'&&T.play().ctx.flags.decision));
  await page.evaluate(()=>{T.place(895,580);T.step(.2);});await page.screenshot({path:path.join(out,'05-choice.png')});
  await page.evaluate(()=>{T.interact(T.console('BROADCAST THE EVIDENCE'));T.dialog();T.step(.3);});
  check('broadcast choice creates a distinct interceptor encounter',await page.evaluate(()=>T.play().ctx.flags.choice==='broadcast'&&T.play().ctx.flags.interceptors.length===4));
  await page.evaluate(()=>T.interact(T.console('BOARD THE OWLSHIP')));
  check('cannot board while interceptors are still active',await page.evaluate(()=>!T.play().ctx.flags.departed));
  await page.evaluate(()=>{T.clear(T.play().ctx.flags.interceptors);T.interact(T.console('BOARD THE OWLSHIP'));T.dialog();T.step(6);});
  check('full broadcast route reaches the bonus completion screen',await page.evaluate(()=>DM.Engine.top() instanceof DM.Scenes.BonusComplete));
  check('all optional evidence reaches the distinct broadcast outcome',await page.evaluate(()=>DM.Bonus.data.completed.last_broadcast.flags.evidence===7));
  await page.screenshot({path:path.join(out,'06-broadcast-complete.png')});
  check('complete adventure leaves the campaign save bytes untouched',await page.evaluate(()=>localStorage.getItem('dr-manhattan.save')===window.__before));
  await page.evaluate(()=>{T.start(3);T.dialog();T.interact(T.console('SHUT IT DOWN SILENTLY'));T.dialog();T.step(.3);});
  check('silent choice has no interceptor wave',await page.evaluate(()=>T.play().ctx.flags.choice==='silence'&&T.play().ctx.flags.interceptors.length===0));
  await page.evaluate(()=>{T.interact(T.console('BOARD THE OWLSHIP'));T.dialog();T.step(6);});
  check('silent route also completes, with a different persisted outcome',await page.evaluate(()=>DM.Engine.top() instanceof DM.Scenes.BonusComplete&&DM.Bonus.data.completed.last_broadcast.flags.choice==='silence'));
  await page.evaluate(()=>{T.start(1);T.dialog();const p=T.play().player;p.godMode=false;p.invuln=0;p.locked=false;p.damage(999,null,'test');T.step(3);});
  check('bonus death opens the existing retry screen',await page.evaluate(()=>DM.Engine.top() instanceof DM.Scenes.GameOver));
  await page.evaluate(()=>{T.play().retry();T.step(1.3);});
  check('retry restores the bonus checkpoint, not the main campaign',await page.evaluate(()=>DM.dev.state().chapter==='last_broadcast'&&DM.dev.state().stage===1));
  check('bonus death does not change main-story death totals or save bytes',await page.evaluate(()=>DM.Save.data.totals.decoherences===0&&localStorage.getItem('dr-manhattan.save')===window.__before));
  check('bonus checkpoint round-trips through its separate storage slot',await page.evaluate(()=>{DM.Bonus.data=null;return DM.Bonus.load().checkpoints.last_broadcast.stage===1;}));
  await page.evaluate(()=>{DM.Engine.set(new DM.Scenes.Title());T.step(.5);});
  check('returning to the main game preserves its completed state',await page.evaluate(()=>DM.Save.finished&&DM.Save.continueTarget()===null));
  await page.screenshot({path:path.join(out,'07-main-title.png')});
  check('three ledger tiers produce different Last Broadcast endings',await page.evaluate(()=>{
    const K=DM.BonusKit;
    const lines=[{spared:6,disintegrated:0},{spared:4,disintegrated:2},{spared:1,disintegrated:5}]
      .map(stats=>{
        const scene=new DM.Scenes.BonusComplete(T.play(),{flags:{choice:'broadcast',evidence:7},stats});
        scene.enter();scene.render(DM.Engine.ctx);return scene.ledgerText;
      });
    return new Set(lines).size===3;
  }));
  await page.evaluate(()=>{T.start(1);T.dialog();T.play().player.godMode=true;T.clear(T.play().ctx.flags.relayGuards);
    const d=T.play().ctx.flags.boothDoor,owl=T.play().ctx.flags.owl;
    T.place(1260,650);T.key('KeyE');T.dialog();owl.x=1275;owl.y=650;d.progress=3;
    const e=T.play().world.add(new DM.Enemies.Gangster({x:1210,y:650,alerted:true}));
    T.step(.2);window.__interrupted=d.progress===0;e.die('impact');T.step(4.2);
  });
  check('enemy fire threat resets the four-second hack; clearing it allows completion',await page.evaluate(()=>
    window.__interrupted&&T.play().ctx.flags.boothDoor.opened));
  await page.evaluate(()=>{T.start(2);T.dialog();T.play().player.godMode=true;T.clear(T.play().ctx.flags.towerGuards);});
  check('Carrier beam telegraph is harmless, then its hit test follows the visible beam',await page.evaluate(()=>{
    const b=T.play().ctx.flags.carrier,d=b.dishes()[0];b.beamAim=1.5;b.beamT=.5;
    const a=b.beamAngle(d,2),point={x:d.x+Math.cos(a)*350,y:d.y+Math.sin(a)*350,r:14};
    const outside={x:point.x+Math.cos(a+Math.PI/2)*80,y:point.y+Math.sin(a+Math.PI/2)*80,r:14};
    return !b.beamHit(point,.4,.5)&&b.beamHit(point,1.99,2)&&!b.beamHit(outside,1.99,2);
  }));
  check('shield collapse opens the casing; half health detaches two sweeping dishes',await page.evaluate(()=>{
    const p=T.play(),b=p.ctx.flags.carrier;for(const e of b.pylons)e.die('disintegrate',p.player);
    T.step(.8);const open=b.shutter>.7&&!b.shieldWasUp;b.damage(360,p.player,'impact');T.step(.4);
    return open&&b.phase===2&&b.dishes().every(d=>Math.abs(d.x-b.x)>=150);
  }));
  check('Carrier framing keeps its body and detached dishes below the HUD at arena corners',await page.evaluate(()=>{
    const p=T.play(),b=p.ctx.flags.carrier;
    return [[130,280],[1630,280],[130,1050],[1630,1050]].every(([x,y])=>{
      p.player.x=x;p.player.y=y;b.cameraFrame.update();T.step(1.5);
      return b.cameraFrame.projectionSafe(p.world.camera.zoom,p.world.camera.x,p.world.camera.y);
    });
  }));
  check('Carrier death restores ordinary camera follow and stops its positional static',await page.evaluate(()=>{
    const p=T.play(),b=p.ctx.flags.carrier;b.die('disintegrate',p.player);T.step(.3);
    return !b.cameraFrame.active&&p.ctx.camTarget!==b.cameraFrame.point&&!DM.Audio.hums['broadcast-carrier'];
  }));
  check('broadcast map labels stay sparse and each map uses its dedicated sound bed',await page.evaluate(()=>{
    return [0,1,2].every(stage=>{T.start(stage);T.dialog();const w=T.play().world;
      return w.entities.filter(e=>e.sceneryLabel).length<=3&&
        DM.Ambience.maps[w.mapId].bed===(stage===1?'broadcast_hum':'broadcast_rain');
    });
  }));
  check('no browser or game-engine errors during both routes',errors.length===0&&await page.evaluate(()=>!DM.Engine.error));
  writeFileSync(path.join(out,'results.json'),JSON.stringify({target,mode:offline?'offline-content harness; in-memory storage':'normal file navigation and browser storage',checks,errors},null,2));
  console.log(`BONUS ACCEPTANCE PASSED: ${checks.length} checks (${offline?'offline harness':'normal file loading'}).`);
}catch(e){await page.screenshot({path:path.join(out,'failure.png')});console.error(e);process.exitCode=1;}
finally{await browser.close();}
