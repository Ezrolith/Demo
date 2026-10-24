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
const out=path.join(root,'tests/out/ninth-minute');mkdirSync(out,{recursive:true});
const browser=await pw.chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('✓ '+name);};
try {
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
    DM.Bonus.load().completed.last_broadcast={stats:{time:456,spared:12,disintegrated:0,memories:0},flags:{choice:'broadcast',evidence:7}};
    DM.Bonus.checkpointAt('last_broadcast',1,{stats:{time:12,spared:2,disintegrated:0,memories:0},flags:{evidence:1}});
    window.__first=JSON.stringify(DM.Bonus.data.completed.last_broadcast);
    window.__firstCP=JSON.stringify(DM.Bonus.data.checkpoints.last_broadcast);
    window.T={
      play:()=>DM.dev.play(), aimPoint:null,
      step(sec=.1){const E=DM.Engine,render=E.render;E.render=()=>{};
        try{for(let i=0;i<Math.ceil(sec*60);i++){if(this.aimPoint&&this.play()){const q=this.play().world.camera.toScreen(this.aimPoint.x,this.aimPoint.y);DM.Input.mouse.x=q.x;DM.Input.mouse.y=q.y;}E.frame(E.last+1000/60);if(E.error)throw E.error;}}
        finally{E.render=render;}E.render();if(E.error)throw E.error;
      },
      start(stage=0){DM.Input.clearAll();this.aimPoint=null;DM.Engine.fade.dir=0;DM.Engine.fade.a=0;DM.Engine.set(new DM.Scenes.Play(),{chapter:'ninth_minute',stage});this.step(.1);},
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
  check('main campaign still has exactly six chapters and the original final chapter',await page.evaluate(()=>DM.Chapters.list.length===6&&DM.Chapters.next('karnak')===null));
  check('both bonus adventures are independently registered',await page.evaluate(()=>DM.Bonus.list.map(c=>c.id).join(',')==='last_broadcast,ninth_minute'));
  await page.evaluate(()=>{DM.Engine.set(new DM.Scenes.BonusMenu());T.step(.3);});
  check('new adventure is selected by default in the two-level menu',await page.evaluate(()=>DM.Engine.top().chapter.id==='ninth_minute'));
  await page.screenshot({path:path.join(out,'01-bonus-menu.png')});
  await page.evaluate(()=>T.key('ArrowLeft'));
  check('left/right selection still exposes the original adventure and its own resume button',await page.evaluate(()=>DM.Engine.top().chapter.id==='last_broadcast'&&DM.Engine.top().menu.items[0].label==='RESUME ADVENTURE'));
  await page.evaluate(()=>T.key('ArrowRight'));
  check('second adventure does not inherit the first adventure checkpoint',await page.evaluate(()=>DM.Engine.top().chapter.id==='ninth_minute'&&DM.Engine.top().menu.items[0].label==='PLAY THE NINTH MINUTE'));
  await page.evaluate(()=>{T.key('Enter');T.step(1.1);});
  check('PLAY THE NINTH MINUTE opens its real story introduction',await page.evaluate(()=>DM.Engine.top() instanceof DM.Scenes.Interlude&&DM.Engine.top().ch.id==='ninth_minute'));
  await page.evaluate(()=>{T.key('Space');T.step(.2);T.key('Space');T.step(1.6);});
  check('the actual menu and introduction lead into the new playable station',await page.evaluate(()=>DM.dev.state().chapter==='ninth_minute'&&DM.dev.state().scene==='Play'));
  await page.evaluate(()=>{T.start();T.dialog();T.play().player.godMode=true;});
  check('new station boots with all six original powers',await page.evaluate(()=>T.play().world.mapId==='ninth_platform'&&Object.keys(T.play().player.powers).length===6));
  const paused=await page.evaluate(()=>{const a=T.play().ctx.flags.arcs[0];T.key('Escape');const before=a.phase;T.step(2);const frozen=a.phase===before;T.key('Escape');T.step(.2);return frozen;});
  check('pausing genuinely freezes the new time hazards',paused);
  const move=await page.evaluate(()=>{const p=T.play().player,x=p.x;T.key('KeyD',.5);return p.x-x;});check('normal movement works in the new station',move>30);
  await page.evaluate(()=>{T.place(370,980);T.aim(650,820);T.key('Space');T.step(.4);});
  check('teleport crosses the station using the existing controls',await page.evaluate(()=>T.play().player.x>560));
  await page.evaluate(()=>T.interact(T.console('SERVICE TUNNEL')));
  check('tunnel cannot bypass the platform encounter or track routing',await page.evaluate(()=>!T.play().ctx.flags.enterTrain));
  await page.evaluate(()=>{T.place(700,970);T.step(5);});
  check('Silk Spectre or Nite Owl attacks security drones',await page.evaluate(()=>T.play().ctx.flags.laurie.strikes+T.play().ctx.flags.owl.strikes>0));
  await page.evaluate(()=>{T.clear(T.play().ctx.flags.platformFoes);});
  check('security drones can all be defeated with normal power input',await page.evaluate(()=>T.play().ctx.flags.platformFoes.every(e=>e.dead)));
  await page.evaluate(()=>T.interact(T.play().ctx.flags.switch));
  check('E cycles the signal to the SERVICE route',await page.evaluate(()=>T.play().ctx.flags.route===1));
  await page.evaluate(()=>{const m=T.play().world.entities.find(e=>e instanceof DM.NinthMinute.LostMoment);T.interact(m);});
  check('lost moment is not readable without Temporal Sight',await page.evaluate(()=>!T.play().ctx.flags.moments));
  await page.evaluate(()=>{T.play().player.energy=100;DM.Input.simulate('KeyF',true);T.step(.3);T.key('KeyE');DM.Input.simulate('KeyF',false);T.dialog();});
  check('holding F and pressing E discovers an optional passenger memory',await page.evaluate(()=>T.play().ctx.flags.moments===1));
  // Inspect deterministic timing properties, not just their prose labels.
  const arc=await page.evaluate(()=>{const a=T.play().ctx.flags.arcs[0];a.phase=0;T.step(1);const full=a.phase;T.play().player.energy=100;DM.Input.simulate('KeyF',true);T.step(.8);const start=a.phase;T.step(1);const slow=a.phase-start;DM.Input.simulate('KeyF',false);T.step(.2);return {full,slow};});
  check('Temporal Sight actually slows the rail-hazard clock',arc.slow<arc.full*.6);
  await page.evaluate(()=>{T.place(985,750);T.aim(985,700);T.step(.5);});await page.screenshot({path:path.join(out,'02-platform.png')});
  await page.evaluate(()=>{T.interact(T.console('SERVICE TUNNEL'));T.transition();});
  check('normal gate interaction advances into the train rescue',await page.evaluate(()=>DM.dev.state().stageId==='rescue'&&T.play().ctx.flags.moments===1));
  await page.evaluate(()=>{T.interact(T.console('CLOCK CHAMBER'));});
  check('clock chamber stays locked until every passenger is safe',await page.evaluate(()=>!T.play().ctx.flags.enterEngine));
  await page.evaluate(()=>{T.clear(T.play().ctx.flags.rescueFoes);T.interact(T.play().ctx.flags.doors[0]);});
  check('carriage interaction assigns Laurie an actual rescue task',await page.evaluate(()=>T.play().ctx.flags.activeDoor===T.play().ctx.flags.doors[0]&&T.play().ctx.flags.doors[0].working));
  await page.evaluate(()=>{T.interact(T.play().ctx.flags.doors[1]);});
  check('one companion cannot be assigned two carriage doors simultaneously',await page.evaluate(()=>!T.play().ctx.flags.doors[1].working));
  await page.evaluate(()=>{const f=T.play().ctx.flags,d=f.doors[0];const enemy=f.rescueFoes.find(e=>!e.dead);enemy.x=d.x;enemy.y=d.y+90;T.step(.05);});
  check('nearby security machines interrupt the door-opening task',await page.evaluate(()=>T.play().ctx.flags.doors[0].blocked));
  for(let i=0;i<3;i++){
    await page.evaluate(index=>{const f=T.play().ctx.flags;T.interact(f.doors[index]);T.clear(f.rescueFoes);T.place(f.doors[index].x+85,f.doors[index].y+130);T.step(12);},i);
    check(`carriage ${i+1} opens after being defended, without changing its progress in test code`,await page.evaluate(index=>T.play().ctx.flags.doors[index].open,i));
  }
  await page.evaluate(()=>{T.step(22);});
  check('six visible passengers walk to the exit and are counted once each',await page.evaluate(()=>T.play().ctx.flags.passengers===6&&T.play().ctx.flags.opened===7));
  await page.evaluate(()=>{const m=T.play().world.entities.find(e=>e instanceof DM.NinthMinute.LostMoment);T.place(m.x,m.y+40);T.play().player.energy=100;DM.Input.simulate('KeyF',true);T.step(.2);T.key('KeyE');DM.Input.simulate('KeyF',false);T.dialog();});
  check('the second memory carries forward without overwriting the first',await page.evaluate(()=>T.play().ctx.flags.moments===3));
  await page.evaluate(()=>{T.place(1150,875);T.aim(1150,650);T.step(.4);});await page.screenshot({path:path.join(out,'03-train.png')});
  await page.evaluate(()=>{T.interact(T.console('CLOCK CHAMBER'));T.transition();});
  check('passenger rescue naturally unlocks the clock chamber',await page.evaluate(()=>DM.dev.state().stageId==='pendulum'&&T.play().ctx.flags.passengers===6));
  await page.evaluate(()=>{T.clear(T.play().ctx.flags.engineFoes);});
  const shield=await page.evaluate(()=>{const b=T.play().ctx.flags.pendulum;b.cycle=.2;b.exposed=0;const hp=b.hp;T.shoot(b);return b.hp===hp;});
  check('Pendulum cannot be damaged through its closed shield',shield);
  const open=await page.evaluate(()=>{const b=T.play().ctx.flags.pendulum;T.play().player.energy=100;while(b.cycle<6.2)T.step(.05);const hp=b.hp;T.shoot(b);return b.hp<hp;});
  check('the timed teal-core window accepts an ordinary Q attack',open);
  const returned=await page.evaluate(()=>{const b=T.play().ctx.flags.pendulum;b.cycle=.3;const hp=b.hp;const m=T.play().world.add(new DM.Proj.Missile({x:b.x,y:b.y,angle:0}));m.onGrab();m.boom(T.play().world);return b.hp<hp&&b.exposed>0;});
  check('a returned missile disrupts the shield early (collision-level check)',returned);
  await page.evaluate(()=>{const m=T.play().world.entities.find(e=>e instanceof DM.NinthMinute.LostMoment);T.place(m.x,m.y+40);T.play().player.energy=100;DM.Input.simulate('KeyF',true);T.step(.2);T.key('KeyE');DM.Input.simulate('KeyF',false);T.dialog();});
  check('all three lost moments are independently discoverable',await page.evaluate(()=>T.play().ctx.flags.moments===7));
  await page.evaluate(()=>{T.place(960,925);T.aim(950,660);T.step(.25);});await page.screenshot({path:path.join(out,'04-pendulum.png')});
  await page.evaluate(()=>{
    const b=T.play().ctx.flags.pendulum;
    for(let j=0;j<60&&!b.dead;j++){
      while((!b.open||T.play().player.energy<21)&&!b.dead)T.step(.1);
      if(!b.dead)T.shoot(b);
    }
    if(!b.dead)throw Error('boss survived 60 open-window attacks');
    T.dialog();T.step(.6);T.dialog();
  });
  check('defeating the timed boss opens the final playable decision',await page.evaluate(()=>DM.dev.state().stageId==='decision'&&T.play().ctx.flags.deciding));
  await page.evaluate(()=>{T.place(950,760);T.aim(950,500);T.step(.2);});await page.screenshot({path:path.join(out,'05-choice.png')});
  await page.evaluate(()=>{T.interact(T.console('PRESERVE THE RECORD'));T.dialog();T.step(.2);});
  check('gold console activates a new stabilisation objective, not an instant ending',await page.evaluate(()=>T.play().ctx.flags.choice==='preserve'&&!T.play().ctx.flags.stable));
  await page.evaluate(()=>{T.place(500,1080);T.play().player.energy=100;DM.Input.simulate('KeyF',true);T.step(.8);DM.Input.simulate('KeyF',false);T.step(.1);});
  check('Temporal Sight outside the anchor cannot complete the final task',await page.evaluate(()=>T.play().ctx.flags.anchor.charge===0));
  await page.evaluate(()=>{T.place(950,935);T.play().player.energy=100;DM.Input.simulate('KeyF',true);T.step(2.2);});
  check('holding F in the marked ring visibly builds stabilisation',await page.evaluate(()=>T.play().ctx.flags.anchor.charge>1&&T.play().ctx.flags.anchor.charge<4));
  await page.screenshot({path:path.join(out,'06-anchor.png')});
  await page.evaluate(()=>{T.step(3.2);DM.Input.simulate('KeyF',false);T.dialog();T.step(.2);});
  check('holding the field completes the preserved-record route',await page.evaluate(()=>T.play().ctx.flags.stable&&DM.dev.state().stageId==='departure'));
  await page.evaluate(()=>{T.interact(T.console('RETURN TO THE PLATFORM'));T.dialog();T.step(6);});
  check('the complete preserved-record route reaches its own new ending screen',await page.evaluate(()=>DM.Engine.top().constructor.name==='NinthComplete'));
  check('completed second-level record contains the actual rescue and optional memories',await page.evaluate(()=>{const f=DM.Bonus.data.completed.ninth_minute.flags;return f.passengers===6&&f.moments===7&&f.choice==='preserve';}));
  await page.screenshot({path:path.join(out,'07-preserve-complete.png')});
  check('main campaign save bytes are unchanged by the new adventure',await page.evaluate(()=>localStorage.getItem('dr-manhattan.save')===window.__before));
  check('first bonus completion and checkpoint survive the new adventure unchanged',await page.evaluate(()=>JSON.stringify(DM.Bonus.data.completed.last_broadcast)===window.__first&&JSON.stringify(DM.Bonus.data.checkpoints.last_broadcast)===window.__firstCP));
  await page.evaluate(()=>{T.start(3);T.dialog();T.interact(T.console('RELEASE THE LOOP'));T.dialog();T.step(.3);});
  check('blue console offers a genuinely shorter alternate conclusion',await page.evaluate(()=>T.play().ctx.flags.choice==='release'&&T.play().ctx.flags.stable&&DM.dev.state().stageId==='departure'));
  await page.evaluate(()=>{T.interact(T.console('RETURN TO THE PLATFORM'));T.dialog();T.step(6);});
  check('release route also completes with a distinct saved outcome',await page.evaluate(()=>DM.Engine.top().constructor.name==='NinthComplete'&&DM.Bonus.data.completed.ninth_minute.flags.choice==='release'));
  await page.screenshot({path:path.join(out,'08-release-complete.png')});
  await page.evaluate(()=>{T.start(1);T.dialog();const p=T.play().player;p.godMode=false;p.invuln=0;p.locked=false;p.damage(999,null,'test');T.step(3);});
  check('death opens the original retry screen inside bonus two',await page.evaluate(()=>DM.Engine.top() instanceof DM.Scenes.GameOver));
  await page.evaluate(()=>{T.play().retry();T.step(1.3);});
  check('retry restores the correct second-level rescue checkpoint',await page.evaluate(()=>DM.dev.state().chapter==='ninth_minute'&&DM.dev.state().stage===1&&T.play().ctx.flags.passengers===0));
  check('second-level death does not alter campaign totals',await page.evaluate(()=>DM.Save.data.totals.decoherences===0&&localStorage.getItem('dr-manhattan.save')===window.__before));
  check('independent checkpoints round-trip in the bonus storage slot',await page.evaluate(()=>{DM.Bonus.data=null;const d=DM.Bonus.load();return d.checkpoints.ninth_minute.stage===1&&d.checkpoints.last_broadcast.stage===1;}));
  for(let i=0;i<4;i++){await page.evaluate(index=>{T.start(index);T.dialog();T.step(.2);},i);check(`checkpoint ${i} loads independently without an engine error`,await page.evaluate(()=>!DM.Engine.error));}
  const recipeCheck=await page.evaluate(()=>['gear','memory','success','zap','impact'].every(id=>DM.Audio.has(id)));
  check('every new direct sound call has an existing audio recipe',recipeCheck);
  await page.evaluate(async()=>{await DM.Audio.unlock();DM.Audio.music.play('ninth_platform');T.step(.2);DM.Audio.music.play('ninth_pendulum');T.step(.2);DM.Audio.music.play('ninth_dawn');T.step(.2);});
  check('all three additive music arrangements start without errors',errors.length===0&&await page.evaluate(()=>!DM.Engine.error&&!DM.AudioDirector.lastError));
  // Every original campaign checkpoint still constructs cleanly. This is a smoke
  // check, not an unassisted campaign playthrough or all nine legacy test suites.
  const cps=await page.evaluate(()=>DM.Chapters.list.flatMap(ch=>ch.stages.map((s,i)=>s.checkpoint?[ch.id,i]:null).filter(Boolean)));
  for(const [id,stage] of cps){await page.evaluate(([id,stage])=>{DM.Engine.set(new DM.Scenes.Play(),{chapter:id,stage});T.step(.1);},[id,stage]);}
  check(`all ${cps.length} original campaign checkpoints still load`,await page.evaluate(()=>!DM.Engine.error));
  check('no browser or engine errors during all exercised routes',errors.length===0&&await page.evaluate(()=>!DM.Engine.error));
  writeFileSync(path.join(out,'results.json'),JSON.stringify({target,mode:offline?'offline-content harness; in-memory storage':'normal file navigation and browser storage',checks,errors},null,2));
  console.log(`NINTH MINUTE PASSED: ${checks.length} checks (${offline?'offline harness':'normal file loading'}).`);
}catch(e){await page.screenshot({path:path.join(out,'failure.png')});console.error(e);process.exitCode=1;}
finally{await browser.close();}
