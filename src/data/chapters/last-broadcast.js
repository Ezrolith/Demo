/* THE LAST BROADCAST — an original, optional Watchmen-inspired side adventure.
 * Uses the existing engine, power registry, procedural figures and synthesizer.
 * No original campaign stages, dialogue, music tracks or endings are replaced.
 */
(function () {
  'use strict';
  const DM = window.DM, U = DM.U, G = DM.Gfx;
  const BLUE = '#80dcff', GOLD = '#e5ba68', RED = '#f17f70';
  const countBits = (n) => [1, 2, 4].filter(b => (n || 0) & b).length;
  const active = e => !e.dead && !e.ko;

  Object.assign(DM.LOOKS, {
    niteowl: { name: 'Nite Owl', skin: '#d2b483', hair: null, hairStyle: 'bald', hat: null, body: '#a98c55', sleeve: '#79603d', legs: '#443b30', cape: '#5c472e', collar: '#c2a46b', trim: '#d8bc71', glasses: true, bg: '#6e674c', color: GOLD },
    rorschach: { name: 'Rorschach', skin: '#e9e4d4', hair: null, hairStyle: 'bald', hat: '#68503c', hatBrim: '#392c23', body: '#806347', sleeve: '#806347', legs: '#382f2a', collar: '#b99b76', bg: '#5c5550', color: '#e9dfcd' },
    switchman: { name: 'The Switchman', skin: '#cfb393', hair: '#393a3c', hairStyle: 'short', glasses: true, body: '#313d4d', sleeve: '#313d4d', legs: '#222b37', collar: '#da904b', bg: '#4c3541', color: RED },
    radioengineer: { name: 'Radio Engineer', skin: '#deb694', hair: '#504236', hairStyle: 'short', body: '#7a918f', sleeve: '#7a918f', legs: '#364549', bg: '#455b62', color: '#a3d3cd' },
  });


  // Add only the two new masks to the existing portrait style. All campaign portraits are unchanged.
  const portrait = G.portrait;
  G.portrait = function(g, x, y, size, look, t, talking) {
    portrait(g, x, y, size, look, t, talking);
    if (look !== DM.LOOKS.niteowl && look !== DM.LOOKS.rorschach) return;
    g.save(); g.translate(x,y); g.scale(size/100,size/100);
    if (look === DM.LOOKS.rorschach) {
      g.fillStyle='#e9e4d4'; G.ellipse(g,50,52,18,23); g.fill();
      g.fillStyle='#242528';
      for (const side of [-1,1]) {
        g.save();g.translate(50,0);g.scale(side,1);
        g.beginPath();g.moveTo(3,40);g.bezierCurveTo(15,35,17,44,10,49);g.bezierCurveTo(18,56,8,62,4,53);g.lineTo(1,48);g.closePath();g.fill();
        G.ellipse(g,7,65,4,3);g.fill();g.restore();
      }
    } else {
      g.fillStyle='#806239';
      g.beginPath();g.moveTo(28,43);g.lineTo(29,17);g.lineTo(43,30);g.lineTo(57,30);g.lineTo(71,17);g.lineTo(72,43);g.lineTo(66,60);g.lineTo(50,55);g.lineTo(34,60);g.closePath();g.fill();
      for(const xx of [40,60]){g.fillStyle='#d9bb73';G.circle(g,xx,46,11);g.fill();g.fillStyle='#172938';G.circle(g,xx,46,8);g.fill();g.fillStyle='#91acac';G.ellipse(g,xx-2,44,3,2);g.fill();}
      g.fillStyle='#d3ad62';g.beginPath();g.moveTo(46,49);g.lineTo(54,49);g.lineTo(50,58);g.fill();
    }
    g.restore();
  };

  DM.MusicTracks.bonus_noir = {
    bpm: 74, level: 3, barsPerChord: 2, echo: 0.43,
    prog: [[50, 57, 60, 64], [46, 53, 57, 60], [48, 55, 58, 62], [45, 52, 57, 61]],
    layers: [
      { kind: 'pad', wave: 'sine', gain: 0.026, attack: 1.8 },
      { kind: 'arp', wave: 'triangle', gain: 0.025, every: 3, pattern: [0, 2, -1, 3, 1, -1, 2, 4], oct: 12, cutoff: 1900, len: 3 },
      { kind: 'bass', wave: 'sine', gain: 0.055, oct: -12, every: 8 },
      { kind: 'tick', gain: 0.035, every: 4 },
      { kind: 'kick', gain: 0.13, pattern: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0], min: 0.5 },
    ],
  };
  DM.MusicTracks.bonus_carrier = {
    bpm: 108, level: -2, barsPerChord: 1, echo: 0.28,
    prog: [[50,57,60,64], [50,57,60,65], [46,53,57,60], [45,52,56,60]],
    layers: [
      { kind: 'pad', wave: 'sine', gain: 0.022, attack: 0.8 },
      { kind: 'arp', wave: 'triangle', gain: 0.028, every: 1, pattern: [0,2,1,3,0,2,4,2], oct: 12, cutoff: 2300, len: 1.4 },
      { kind: 'bass', wave: 'sawtooth', gain: 0.033, oct: -12, every: 4, cutoff: 350 },
      { kind: 'kick', gain: 0.16, pattern: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0], min: 0.2 },
      { kind: 'snare', gain: 0.04, pattern: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], min: 0.6 },
    ],
  };
  for (const map of ['broadcast_roofs', 'broadcast_tower']) DM.Ambience.maps[map] = { bed: 'pier', surface: 'concrete' };
  DM.Ambience.maps.broadcast_relay = { bed: 'sanctum', surface: 'concrete' };
  Object.assign(DM.Ambience.cues, {
    'last_broadcast.arrival': 'bonus_noir', 'last_broadcast.relay': 'bonus_noir',
    'last_broadcast.carrier': 'bonus_carrier', 'last_broadcast.choice': 'bonus_noir',
  });

  // Lights use the map profile, so this works on the shipped iteration-1 engine.
  function lights(world, add) {
    for (const e of world.entities) {
      if (e.dead || !e.bonusLight) continue;
      const l = e.bonusLight(world); if (l) add(e.x, e.y, l.r || 150, l);
    }
    if (world.mapId === 'broadcast_roofs') {
      for (const [x,y] of [[250,760],[640,420],[1170,660],[1700,320]]) add(x,y,260,{i:0.76,color:GOLD,k:0.17});
      add(1490,210,320,{i:0.65,color:'#bd6380',k:0.19});
    } else if (world.mapId === 'broadcast_relay') {
      for (const [x,y] of [[300,280],[820,260],[1440,280],[360,840],[920,870],[1510,830]]) add(x,y,300,{i:0.8,color:'#aad9d6',k:0.1});
    } else {
      for (const [x,y] of [[250,830],[1340,850],[330,270],[1400,290]]) add(x,y,280,{i:0.72,color:GOLD,k:0.18});
    }
  }
  for (const map of ['broadcast_roofs','broadcast_relay','broadcast_tower']) DM.Atmosphere.register(map, {
    shadow: 'rgba(5,10,23,0.6)',
    light: { ambient: map === 'broadcast_relay' ? 'rgba(6,15,24,0.53)' : 'rgba(8,13,30,0.57)', lights },
    weather: map === 'broadcast_relay' ? [{type:'haze',n:35,alpha:0.035}] : [{type:'drizzle',puddles:[]}],
    walls: { wall: {pattern:'concrete',height:1}, low:{pattern:'concrete',height:0.5}, brick:{pattern:'brick',height:1.2}, rib:{pattern:'ribbed',height:1.1} },
  });

  // Small label plates are emissive: readable under both darkness and Sight.
  function label(g, text, x, y, col = GOLD, size = 13) {
    const width = G.measure(g, text, {size,font:DM.FONTS.display}) + 22;
    g.fillStyle = 'rgba(3,8,16,0.88)'; G.rr(g,x-width/2,y-18,width,25,4); g.fill();
    G.text(g,text,x,y,{size,align:'center',weight:600,color:col,spacing:0.6});
  }
  function ring(g,x,y,r,col,w=2) { g.strokeStyle=col;g.lineWidth=w;G.circle(g,x,y,r);g.stroke(); }
  function near(world,e,d=250) { return world.player && U.dist(e.x,e.y,world.player.x,world.player.y)<d; }
  function smallBurst(w,x,y,col=BLUE) { w.particles.burst(x,y,20,{color:[col,'#ffffff'],speed:[35,140],life:[0.3,0.9],size:[1.5,3],shape:'spark'}); }

  class Sign extends DM.Entity {
    constructor(x,y,text,col=GOLD,size=16) { super({x,y,body:false,solid:false,static:true,disintegratable:false});Object.assign(this,{text,col,size}); }
    render(g,w) { if(!w.lit) this.renderEmissive(g,w); }
    renderEmissive(g) { label(g,this.text,this.x,this.y,this.col,this.size); }
  }
  class Console extends DM.Entity {
    constructor(x,y,text,fn,enabled=()=>true,col=BLUE) {
      super({x,y,r:19,body:false,static:true,disintegratable:false});this.text=text;this.col=col;this.on=false;
      this.interact={label:text,range:85,enabled,onInteract:fn};this.bonusLight=()=>({r:145,i:0.6,color:this.col,k:0.16});
    }
    render(g,w) {
      g.fillStyle='#374c56';g.fillRect(this.x-22,this.y-19,44,36);g.fillStyle='#101d27';g.fillRect(this.x-17,this.y-14,34,19);
      g.fillStyle=this.col;g.fillRect(this.x-14,this.y-11,28,3);g.fillStyle='#667b7f';g.fillRect(this.x-14,this.y+9,18,3);
      if(!w.lit)this.renderEmissive(g,w);
    }
    renderEmissive(g,w) { if(this.interact.enabled && !this.interact.enabled())return; ring(g,this.x,this.y,32+Math.sin(w.time*2)*2,this.col,1);if(near(w,this,300))label(g,this.text,this.x,this.y-42,this.col); }
  }
  class Evidence extends Console {
    constructor(ctx,x,y,bit,text) {
      super(x,y,'E · RECOVER EVIDENCE',()=>{
        ctx.flags.evidence=(ctx.flags.evidence||0)|bit;
        ctx.scene.dialog.open([['rorschach',text],['niteowl',`That's ${countBits(ctx.flags.evidence)} of three records. We can put names behind this.`]]);
        DM.Audio.play('success');smallBurst(ctx.world,x,y,GOLD);
      },()=>!((ctx.flags.evidence||0)&bit),GOLD);
      this.ctx=ctx;this.bit=bit;
    }
    render(g,w) { if(!((this.ctx.flags.evidence||0)&this.bit))super.render(g,w); }
    renderEmissive(g,w) { if(!((this.ctx.flags.evidence||0)&this.bit))super.renderEmissive(g,w); }
  }
  class Owlship extends DM.Entity {
    constructor(x,y) {super({x,y,r:100,body:false,solid:false,static:true,disintegratable:false,layer:0});this.bonusLight=()=>({r:290,i:0.6,color:GOLD,k:0.14});}
    render(g,w) {
      g.save();g.translate(this.x,this.y);g.fillStyle='rgba(0,0,0,0.4)';G.ellipse(g,10,19,150,91);g.fill();
      const grad=g.createLinearGradient(-140,-80,130,75);grad.addColorStop(0,'#ac925c');grad.addColorStop(0.5,'#6c644e');grad.addColorStop(1,'#383e3d');
      g.fillStyle=grad;G.ellipse(g,0,0,144,80);g.fill();g.strokeStyle='#bba56d';g.lineWidth=2;g.stroke();
      g.fillStyle='#151e25';G.ellipse(g,0,-18,85,43);g.fill();g.strokeStyle='#988753';g.lineWidth=4;g.stroke();
      for(const sx of [-1,1]){g.fillStyle='#bda66d';G.circle(g,sx*43,-20,29);g.fill();g.fillStyle='#21313c';G.circle(g,sx*43,-20,22);g.fill();g.fillStyle='rgba(139,199,216,0.5)';G.ellipse(g,sx*43-5,-25,9,6);g.fill();}
      g.fillStyle='#ab8b4c';g.beginPath();g.moveTo(-15,0);g.lineTo(15,0);g.lineTo(0,30);g.closePath();g.fill();
      for(const sx of [-1,1]){g.strokeStyle='#333c3e';g.lineWidth=5;for(let i=0;i<4;i++)G.line(g,sx*(85+i*10),13,sx*(75+i*10),37);}
      g.fillStyle='#6a6e62';g.fillRect(-30,66,60,55);g.strokeStyle='#bcb295';g.lineWidth=2;for(let i=0;i<5;i++)G.line(g,-27,71+i*10,27,71+i*10);
      g.restore();if(!w.lit)this.renderEmissive(g,w);
    }
    renderEmissive(g) {for(const s of [-1,1])G.glow(g,this.x+s*124,this.y+18,28,GOLD,0.4);}
  }
  class Companion extends DM.NPC {
    constructor(x,y,who) {super({x,y,look:who,lookAtPlayer:false,speed:195});this.who=who;this.team='player';this.body=false;this.cool=1;this.grapple=0;this.strikes=0;this.bonusLight=()=>({r:80,i:0.44,color:who==='niteowl'?GOLD:'#d9e1dd',k:0.04});}
    update(dt,w) {
      if(w.ceasefire){this.vx=this.vy=0;return;}
      this.cool-=dt;this.grapple=Math.max(0,this.grapple-dt);
      const p=w.player;let foe=null,bd=this.who==='niteowl'?430:210;
      for(const e of w.entities)if(e.team==='enemy'&&active(e)&&!e.isProjectile&&!e.bonusBoss&&e.hp!=null&&w.los(this.x,this.y,e.x,e.y)){const d=U.dist(this.x,this.y,e.x,e.y);if(d<bd){bd=d;foe=e;}}
      let tx=p.x+(this.who==='niteowl'?-65:65),ty=p.y+75;
      if(foe){this.facing=U.angleTo(this.x,this.y,foe.x,foe.y);if(this.who==='rorschach'){tx=foe.x;ty=foe.y;}}
      const d=U.dist(this.x,this.y,tx,ty);
      if(d>650&&this.grapple<=0){
        // A visible grapple catches companions up across rooftops; never blocks progression.
        const nx=p.x+(this.who==='niteowl'?-85:85),ny=p.y+65;
        if(w.isFree(nx,ny,14)){smallBurst(w,this.x,this.y,GOLD);this.x=nx;this.y=ny;this.grapple=4;}
      } else if(d>85 || (foe&&this.who==='rorschach'&&bd>42)) {
        const angle=U.angleTo(this.x,this.y,tx,ty);let best=angle,score=Infinity;
        for(const off of [0,0.5,-0.5,1,-1,1.5,-1.5,2,-2]){const a=angle+off,nx=this.x+Math.cos(a)*55,ny=this.y+Math.sin(a)*55;if(!w.isFree(nx,ny,14))continue;const s=U.dist(nx,ny,tx,ty);if(s<score){score=s;best=a;}}
        if(score<Infinity){this.vx=U.damp(this.vx,Math.cos(best)*190,10,dt);this.vy=U.damp(this.vy,Math.sin(best)*190,10,dt);if(!foe)this.facing=best;}
      } else {this.vx=U.damp(this.vx,0,10,dt);this.vy=U.damp(this.vy,0,10,dt);}
      if(foe&&this.cool<=0){
        if(this.who==='niteowl') {const a=this.facing;w.add(new DM.Proj.Bolt({x:this.x+Math.cos(a)*20,y:this.y+Math.sin(a)*20,vx:Math.cos(a)*490,vy:Math.sin(a)*490,dmg:11,color:GOLD}));this.cool=1.5;DM.Audio.play('zap');this.strikes++;}
        else if(bd<62){foe.damage(15,this,'impact');foe.stun=Math.max(foe.stun,0.8);smallBurst(w,foe.x,foe.y,'#ddd6c6');this.cool=1.3;DM.Audio.play('impact');this.strikes++;}
      }
      this.moving=this.speed>15;if(this.moving)this.walk+=dt*this.speed*0.09;
    }
    render(g,w){super.render(g,w);if(this.who==='rorschach'){g.save();g.translate(this.x,this.y);g.rotate(this.facing);g.fillStyle='#23242a';G.ellipse(g,7,-3,3,2);g.fill();G.ellipse(g,6,3,2,3);g.fill();g.restore();}if(!w.lit)this.renderEmissive(g,w);}
    renderEmissive(g,w){if(near(w,this,210))label(g,this.who==='niteowl'?'NITE OWL':'RORSCHACH',this.x,this.y-35,GOLD,11);}
  }
  function companions(ctx,x,y){ctx.flags.owl=ctx.add(new Companion(x-60,y+45,'niteowl'));ctx.flags.rorschach=ctx.add(new Companion(x+65,y+40,'rorschach'));}
  function guards(ctx,pts){return pts.map(([x,y,gun])=>ctx.add(new DM.Enemies.Gangster({x,y,gun:gun||'pistol',alerted:true,sight:680,look:{name:'Signal Guard',skin:'#cba98b',hat:'#293944',hatBrim:'#162029',body:'#415766',sleeve:'#415766',legs:'#26353e',bg:'#38444d'}})));}
  function dressing(w, seed, floor='#303d49') {
    w.bake((g,width,height)=>{
      const rnd=U.seeded(seed);g.fillStyle='#0b1522';g.fillRect(0,0,width,height);
      DM.Bonus.city(g,0,0,0,width,210);
      g.fillStyle=floor;g.fillRect(65,210,width-130,height-270);
      g.strokeStyle='rgba(143,166,177,0.08)';g.lineWidth=1;
      for(let x=65;x<width-65;x+=60)G.line(g,x,210,x,height-60);
      for(let y=210;y<height-60;y+=60)G.line(g,65,y,width-65,y);
      for(let i=0;i<2400;i++){g.fillStyle=rnd()>.5?'rgba(255,255,255,0.035)':'rgba(0,0,0,0.07)';g.fillRect(65+rnd()*(width-130),210+rnd()*(height-270),1+rnd()*5,1+rnd()*3);}
      for(let i=0;i<16;i++){g.fillStyle='rgba(125,159,176,0.08)';G.ellipse(g,130+rnd()*(width-260),260+rnd()*(height-360),30+rnd()*55,8+rnd()*15);g.fill();}
    });
    w.room(65,210,w.w-130,w.h-270,{t:16,kind:'low'});
  }

  function buildRoofs(ctx){
    const w=ctx.newWorld({w:2000,h:1160,zoom:1.12});w.spawn={x:360,y:890};dressing(w,1976);
    w.wall(815,210,170,330,'wall');w.wall(815,710,170,390,'wall');
    w.decals.push((g)=>{g.fillStyle='#111c28';g.fillRect(815,210,170,330);g.fillRect(815,710,170,390);g.fillStyle='#64727b';g.fillRect(815,540,170,170);g.strokeStyle='#a29a73';g.lineWidth=2;for(let x=825;x<980;x+=20)G.line(g,x,545,x,704);});
    for(const [x,y]of[[535,400],[1090,770],[1400,540]]){w.wall(x,y,155,100,'low');ctx.add(new Sign(x+77,y+53,'VENTILATION','#8eacbd',11));}
    for(const [x,y]of[[500,755],[710,565],[1190,400],[1550,820]])ctx.add(new DM.Props.Crate(x,y,{style:'metal'}));
    ctx.add(new Owlship(310,865));companions(ctx,405,875);
    ctx.add(new Sign(1480,220,'W B Y N   /   8 8 . 6   F M','#d38d9f',25));
    ctx.add(new Sign(900,618,'SERVICE BRIDGE','#d8c596',14));
    ctx.flags.roofGuards=guards(ctx,[[670,720],[640,540],[1190,660],[1460,710,'tommy'],[1710,420],[1580,310]]);
    ctx.add(new Evidence(ctx,1150,350,1,'Dispatch log. Same truck. Same hour. Three nights. They took people, not equipment.'));
    ctx.add(new Console(1760,300,'E · ENTER THE RELAY',()=>{if(ctx.flags.roofGuards.some(active))return ctx.toast('THE ROOFTOP GUARDS STILL CONTROL THE STAIRS',GOLD);ctx.flags.enterRelay=true;},()=>true));
    return w;
  }

  class Coil extends DM.Props.Crate {
    constructor(x,y,n){super(x,y,{r:22,mass:3,hp:null,style:'metal'});this.hp=this.maxHp=null;this.disintegratable=false;this.n=n;this.docked=false;this.colors=[BLUE,GOLD];this.bonusLight=()=>({r:130,i:.6,color:n===1?BLUE:GOLD,k:.15});}
    render(g,w){g.save();g.translate(this.x,this.y);g.rotate(this.rot);g.fillStyle='#283d49';g.fillRect(-23,-20,46,40);g.strokeStyle=this.n===1?BLUE:GOLD;g.lineWidth=3;for(let x=-14;x<=14;x+=7)G.line(g,x,-13,x,13);g.restore();if(!w.lit)this.renderEmissive(g,w);}
    renderEmissive(g,w){label(g,this.docked?'CONNECTED':`COIL ${this.n}`,this.x,this.y-34,this.n===1?BLUE:GOLD,12);}
  }
  class Dock extends DM.Entity {
    constructor(ctx,x,y,coil){super({x,y,r:35,body:false,solid:false,static:true,disintegratable:false,layer:0});this.coil=coil;this.ctx=ctx;this.bonusLight=()=>({r:160,i:.65,color:coil.n===1?BLUE:GOLD,k:.12});}
    update(dt,w){const c=this.coil;if(c.docked||c.heldBy)return;if(U.dist(c.x,c.y,this.x,this.y)<70&&c.speed<130){c.docked=true;c.static=true;c.body=false;c.grabbable=false;c.x=this.x;c.y=this.y;c.vx=c.vy=0;this.ctx.flags.coils=(this.ctx.flags.coils||0)|(1<<(c.n-1));smallBurst(w,this.x,this.y,c.n===1?BLUE:GOLD);DM.Audio.play('success');this.ctx.toast(`COIL ${c.n} CONNECTED · SIGNAL GROUNDING`,BLUE);}}
    render(g,w){g.fillStyle='#13222b';g.fillRect(this.x-42,this.y-38,84,76);g.strokeStyle=this.coil.n===1?BLUE:GOLD;g.lineWidth=2;g.setLineDash([6,5]);g.strokeRect(this.x-42,this.y-38,84,76);g.setLineDash([]);if(!w.lit)this.renderEmissive(g,w);}
    renderEmissive(g){label(g,`DOCK ${this.coil.n}`,this.x,this.y+61,this.coil.n===1?BLUE:GOLD,13);}
  }
  function buildRelay(ctx){
    const w=ctx.newWorld({w:1780,h:1160,zoom:1.08});w.spawn={x:230,y:940};dressing(w,886,'#354248');
    w.decals.push(g=>{g.strokeStyle='#a5864f';g.lineWidth=5;for(const y of [490,690]){g.beginPath();g.moveTo(910,y);g.lineTo(1150,y);g.lineTo(1150,900);g.lineTo(1500,900);g.stroke();}});
    for(const x of [430,710,1160]){w.wall(x,380,85,200,'low');w.decals.push(g=>{g.fillStyle='#506d71';g.fillRect(x+8,390,69,178);for(let y=407;y<555;y+=22){g.fillStyle='#9eb7a5';g.fillRect(x+17,y,21,5);g.fillStyle='#bf925c';g.fillRect(x+49,y,12,5);}});}
    w.overlays.push((g)=>{ for(const x of [430,710,1160]){g.fillStyle='#253a43';g.fillRect(x+7,389,71,178);for(let yy=405;yy<558;yy+=32){g.fillStyle='#0b2029';g.fillRect(x+13,yy,58,23);g.strokeStyle='#76aaa5';g.lineWidth=1;g.beginPath();for(let j=0;j<49;j++){const px=x+17+j,py=yy+12+Math.sin(j*.32+w.time)*4;if(j===0)g.moveTo(px,py);else g.lineTo(px,py);}g.stroke();g.fillStyle=GOLD;g.fillRect(x+63,yy+5,3,3);}} });
    ctx.add(new Sign(850,255,'RELAY FLOOR / EMERGENCY CARRIER',GOLD,22));
    companions(ctx,260,950);ctx.flags.relayGuards=guards(ctx,[[600,820],[850,950],[1040,420],[1380,560,'tommy'],[1480,840],[350,330]]);
    ctx.flags.engineers=0;ctx.flags.coils=0;
    const spots=[[280,280],[960,300],[1490,320]];
    spots.forEach(([x,y],i)=>{
      w.wall(x-70,y-15,16,100,'low');w.wall(x+54,y-15,16,100,'low');
      const npc=ctx.add(new DM.NPC({x,y,look:'radioengineer',talk:()=>{
        if(ctx.flags.relayGuards.some(e=>active(e)&&U.dist(e.x,e.y,x,y)<160))return ctx.toast('CLEAR THE GUARD NEAR THE ENGINEER',GOLD);
        ctx.flags.engineers|=(1<<i);npc.interact=null;npc.walkTo(240,940);npc.solid=false;npc.body=false;
        ctx.scene.dialog.open([['radioengineer',[
          'He calls himself the Switchman. He is feeding stolen panic recordings into every emergency channel.',
          'Ground the carrier with both coils. Lift them into the numbered docks, then let go. The lift cannot run while the signal is live.',
          'The rooftop amplifier has three shield pylons. Break those first. The man behind it is only a voice.'
        ][i]],['niteowl','I have you. Stay behind us. We will get you out.']]);DM.Audio.play('success');
      },label:'Free the engineer',range:82}));
      npc.bonusLight=()=>({r:120,i:.65,color:'#b3ded4',k:.08});
      ctx.add(new Sign(x,y-46,`ENGINEER ${i+1}`,BLUE,13));
    });
    const a=ctx.add(new Coil(600,700,1)),b=ctx.add(new Coil(1290,700,2));
    ctx.flags.coilObjects=[a,b];ctx.add(new Dock(ctx,900,490,a));ctx.add(new Dock(ctx,900,690,b));
    ctx.add(new Evidence(ctx,1500,980,2,'Payment ledger. Shell companies paying shell companies. People hiding inside the paperwork. Not very well.'));
    ctx.add(new Console(1520,900,'E · ROOFTOP LIFT',()=>{if(ctx.flags.engineers!==7||ctx.flags.coils!==3)return ctx.toast('RESCUE ALL THREE ENGINEERS AND CONNECT BOTH COILS',GOLD);ctx.flags.enterTower=true;},()=>true));
    return w;
  }

  class Pylon extends DM.Entity {
    constructor(x,y,n){super({x,y,r:26,hp:120,static:true,team:'enemy',grabbable:false,disintegratable:true});this.n=n;this.bonusPylon=true;this.hazard=true;this.bonusLight=()=>({r:210,i:.7,color:'#b597e5',k:.22});}
    render(g,w){g.fillStyle='#393c52';g.fillRect(this.x-25,this.y-23,50,46);g.strokeStyle='#8b79b8';g.lineWidth=3;g.strokeRect(this.x-25,this.y-23,50,46);if(!w.lit)this.renderEmissive(g,w);}
    renderEmissive(g,w){ring(g,this.x,this.y,19+Math.sin(w.time*3)*3,'#c9b3ff',3);label(g,`SHIELD ${this.n}`,this.x,this.y-43,'#d8c6fa',12);g.fillStyle='#171b28';g.fillRect(this.x-26,this.y+32,52,5);g.fillStyle='#bd9ce9';g.fillRect(this.x-26,this.y+32,52*this.hp/this.maxHp,5);}
    onDeath(){const w=this.world;smallBurst(w,this.x,this.y,'#bca5ff');DM.Audio.play('impact');w.camera.shake(.17);}
  }
  class Carrier extends DM.Entity {
    constructor(ctx,x,y,pylons){super({x,y,r:62,hp:700,static:true,team:'enemy',disintegratable:true});this.ctx=ctx;this.pylons=pylons;this.bonusBoss=true;this.human=false;this.name='THE CARRIER · BREAK THE THREE SHIELD PYLONS';this.phaseMarks=[.5];this.phase=1;this.hazard=true;this.alerted=true;this.threatWeight=6;this.cd=2;this.pulse=5;this.warning=0;this.bonusLight=()=>({r:350,i:.82,color:this.shielded?'#a48bcf':BLUE,k:.25});}
    get shielded(){return this.pylons.some(e=>!e.dead);}
    damage(n,s,k){if(this.shielded){if(!this.blockNote||this.world.time>this.blockNote){this.ctx.toast('THE THREE PYLONS ARE SHIELDING THE CARRIER',GOLD);this.blockNote=this.world.time+3;}return false;}return super.damage(n,s,k);}
    disintegrate(w,p){if(this.shielded)return this.damage(0,p,'disintegrate');super.disintegrate(w,p);}
    update(dt,w){
      if(w.ceasefire)return;
      this.name=this.shielded?'THE CARRIER · BREAK THE THREE SHIELD PYLONS':'THE CARRIER · CORE EXPOSED';
      if(!this.shielded&&this.phase===1){this.phase=2;this.ctx.toast('SHIELD DOWN · THE CORE IS EXPOSED',BLUE);DM.Audio.play('success');}
      const p=w.player;this.cd-=dt;this.pulse-=dt;
      if(this.cd<=0){this.cd=this.hp<350?2.0:2.7;const a=U.angleTo(this.x,this.y,p.x,p.y);w.add(new DM.Proj.Missile({x:this.x+Math.cos(a)*75,y:this.y+Math.sin(a)*75,angle:a,target:p,team:'enemy',dmg:15}));DM.Audio.play('shot');}
      if(this.pulse<=0&&!this.warning){this.warning=1.3;this.pulse=7;this.aimAt={x:p.x,y:p.y};}
      if(this.warning>0){this.warning-=dt;if(this.warning<=0&&this.aimAt){const t=this.aimAt;w.explode(t.x,t.y,110,17,{source:this,force:100,colors:['#b6a2e9','#7fdcff','#ffffff']});this.aimAt=null;}}
      if(this.hp<350&&!this.reinforced){this.reinforced=true;this.ctx.toast('INTERCEPTOR DRONES INBOUND',GOLD);for(const [x,y]of[[400,500],[1400,520]])w.add(new DM.Enemies.Drone({x,y,alerted:true}));}
    }
    onDeath(){const w=this.world;this.ctx.flags.carrierDown=true;w.explode(this.x,this.y,120,0,{source:this,force:60,colors:[BLUE,'#d9c796','#ffffff']});DM.Audio.play('success');}
    render(g,w){g.save();g.translate(this.x,this.y);g.fillStyle='#28394b';G.circle(g,0,0,70);g.fill();g.strokeStyle='#768598';g.lineWidth=8;g.stroke();for(let i=0;i<6;i++){g.save();g.rotate(i*Math.PI/3+w.time*.2);g.fillStyle='#788590';g.fillRect(43,-7,44,14);g.restore();}g.fillStyle='#0e202e';G.circle(g,0,0,43);g.fill();g.restore();if(!w.lit)this.renderEmissive(g,w);}
    renderEmissive(g,w){G.hydrogen(g,this.x,this.y,33,this.shielded?'#c8acf3':BLUE,w.time,3);if(this.shielded){ring(g,this.x,this.y,96,'rgba(190,155,245,0.55)',3);for(const e of this.pylons)if(!e.dead){g.strokeStyle='rgba(179,143,226,0.48)';g.lineWidth=2;G.line(g,this.x,this.y,e.x,e.y);}}if(this.aimAt){ring(g,this.aimAt.x,this.aimAt.y,110,RED,3);label(g,'MOVE · INCOMING PULSE',this.aimAt.x,this.aimAt.y-126,RED,13);}}
  }

  function buildTower(ctx){
    const w=ctx.newWorld({w:1760,h:1200,zoom:1.02});w.spawn={x:290,y:960};dressing(w,1985,'#343c49');
    companions(ctx,300,945);ctx.add(new Sign(870,255,'EMERGENCY TRANSMITTER / AUTHORIZED PERSONNEL ONLY',GOLD,19));
    for(const [x,y]of[[440,740],[1170,750],[380,370],[1320,390]])w.wall(x,y,140,66,'low');
    ctx.add(new Owlship(1430,975));ctx.flags.pylons=[[610,430],[1190,430],[895,790]].map(([x,y],i)=>ctx.add(new Pylon(x,y,i+1)));
    const boss=ctx.add(new Carrier(ctx,895,480,ctx.flags.pylons));w.boss=boss;ctx.flags.carrier=boss;
    ctx.flags.towerGuards=guards(ctx,[[410,580],[1330,610,'tommy'],[1160,940]]);
    for(const [x,y]of[[590,870],[1100,680],[380,660]])ctx.add(new DM.Props.Crate(x,y,{style:'metal',hp:200}));
    ctx.add(new Evidence(ctx,1450,300,4,'Master tape. A list of targets. His employers planned the panic, then sold the city a cure.'));
    ctx.add(new Console(680,400,'E · BROADCAST THE EVIDENCE',()=>{ctx.flags.choice='broadcast';},()=>ctx.flags.decision&&!ctx.flags.choice,GOLD));
    ctx.add(new Console(1110,400,'E · SHUT IT DOWN SILENTLY',()=>{ctx.flags.choice='silence';},()=>ctx.flags.decision&&!ctx.flags.choice,BLUE));
    const exit=ctx.add(new Console(1430,1100,'E · BOARD THE OWLSHIP',()=>{if((ctx.flags.interceptors||[]).some(active))return ctx.toast('CLEAR THE INTERCEPTORS BEFORE TAKEOFF',GOLD);ctx.flags.departed=true;},()=>!!ctx.flags.choice));
    ctx.flags.exit=exit;
    w.decals.push(g=>{g.strokeStyle='#7a6a56';g.lineWidth=4;for(const e of ctx.flags.pylons)G.line(g,895,480,e.x,e.y);g.strokeStyle='rgba(228,199,133,0.25)';g.lineWidth=3;G.circle(g,895,480,260);g.stroke();});
    return w;
  }
  function pacifyTower(ctx){const f=ctx.flags;f.carrierDown=true;if(f.carrier){f.carrier.dead=true;f.carrier.hp=0;}for(const e of f.pylons||[])e.dead=true;for(const e of f.towerGuards||[])e.dead=true;ctx.world.boss=null;ctx.clearHostiles();}
  function ready(ctx){ctx.player.energy=100;ctx.player.coherence=100;ctx.player.regenDelay=0;ctx.lock(false);}

  const chapter=DM.Bonus.register({
    id:'last_broadcast',numeral:'BONUS I',title:'The Last Broadcast',date:'November 1976',place:'New York City',clock:4,color:'#283c4d',music:'bonus_noir',form:'manhattan',
    persistFlags:['evidence','engineers','coils','carrierDown','choice'],
    intro:[
      'It is 1976. Above Manhattan, an aircraft shaped like an owl waits in the rain.',
      'Dan asks for my help. Three radio engineers have vanished. At midnight, a stolen transmitter will speak through every emergency channel in the city.',
      'Walter has followed the men who took them. I have followed the sound of a voice that has not spoken yet.'
    ],
    maps:{broadcast_roofs:buildRoofs,broadcast_relay:buildRelay,broadcast_tower:buildTower},
    stages:[
      {id:'arrival',label:'Rain on the rooftops',map:'broadcast_roofs',checkpoint:true,
        run:function*(ctx){
          yield ctx.dialog([['niteowl','Jon. Thanks for coming. Walter traced the kidnappers to this relay station. We need the engineers alive.'],['rorschach','Six men on the roof. More inside. Their employer is a voice on a radio. Calls himself the Switchman.'],['manhattan','In nine minutes, that voice is speaking from a hundred thousand rooms.'],['niteowl','Then let us make those nine minutes count. I have stun darts. Walter has his own approach.']]);
          ready(ctx);ctx.objective('Reach the relay entrance',()=>`${ctx.flags.roofGuards.filter(active).length} guards remaining`);ctx.marker(1760,300,'RELAY ENTRANCE');
          ctx.tutorial('ALL SIX POWERS ARE READY. Your companions help in combat. Cross the service bridge, or SPACE to teleport across. E interacts; H recalls this hint.',14);
          yield ctx.until(()=>ctx.flags.enterRelay);ctx.objectiveDone();
          yield ctx.dialog([['rorschach','A hired gun is still a man who chose to take the money.'],['niteowl','And three people downstairs did not get a choice. Come on.']]);
        },restore:function(ctx){ctx.flags.enterRelay=true;}
      },
      {id:'relay',label:'The voices below',map:'broadcast_relay',checkpoint:true,
        run:function*(ctx){
          yield ctx.dialog([['switchman','You brought a god to a radio station. How flattering. Let us see if he knows which voices to save.'],['niteowl','The engineers are behind those equipment cages. I can get them out once you clear the floor.'],['rorschach','And the coils. Two of them. He is using the building itself as an antenna.']]);
          ready(ctx);ctx.objective('Rescue the engineers · Ground the carrier',()=>`${countBits(ctx.flags.engineers)}/3 people · ${[1,2].filter(b=>ctx.flags.coils&b).length}/2 coils`);
          ctx.marker(1520,900,'ROOFTOP LIFT');ctx.tutorial('Hold LEFT CLICK on a coil, move it to the matching numbered dock, then release gently. Press E beside each engineer. Required coils cannot be destroyed.',16);
          yield ctx.until(()=>ctx.flags.enterTower);ctx.objectiveDone();
          yield ctx.dialog([['radioengineer','He never showed his face. Just that voice. I thought if I kept working he would let us go.'],['rorschach','He did not. We did.'],['niteowl','The three of you, down the stairs. I will bring Archie around to the roof. Jon, the transmitter is still running on its own supply.']]);
        },restore:function(ctx){ctx.flags.engineers=7;ctx.flags.coils=3;}
      },
      {id:'carrier',label:'The carrier wave',map:'broadcast_tower',checkpoint:true,
        run:function*(ctx){
          yield ctx.dialog([['switchman','Do you know what frightened people will believe? Anything, if enough speakers say it at once.'],['niteowl','Three pylons are shielding that core. Break them, then hit the transmitter. Watch the red pulse markers.'],['manhattan','The signal is not inevitable. It is only very loud.']]);
          ready(ctx);ctx.objective('Break the three shield pylons · Disable the carrier');ctx.marker(895,480,'THE CARRIER');
          ctx.tutorial('Q breaks the pylons, then damages the exposed core. F slows incoming danger. You can catch missiles with LEFT CLICK and throw them back. Move out of red circles.',16);
          yield ctx.until(()=>ctx.flags.carrierDown);ctx.objectiveDone();ctx.clearHostiles();
          for(const e of ctx.world.entities)if(e.team==='enemy'&&active(e)&&!e.isProjectile)e.die('impact');
          ctx.world.boss=null;
          yield ctx.dialog([['switchman','You have broken a machine. There will be another. The people paying me can afford a great many machines.'],['rorschach','Then we give them something they cannot buy back. Their names.']]);
        },restore:pacifyTower
      },
      {id:'choice',label:'What the city hears',checkpoint:true,
        run:function*(ctx){
          pacifyTower(ctx);ready(ctx);ctx.flags.decision=true;ctx.flags.choice=null;
          yield ctx.dialog([['niteowl','There is still enough power for one transmission. Send the records and his people will know exactly where we are. Kill the carrier, and we leave quietly.'],['rorschach','Quiet is how they got this far.'],['manhattan','I can end the noise. I cannot decide what it means for you.']]);
          ctx.objective('Choose what the city hears');ctx.marker(895,400,'TWO CONSOLES');
          ctx.tutorial('E at the GOLD console broadcasts your evidence and brings interceptors. E at the BLUE console shuts everything down quietly. Optional evidence improves the broadcast.',15);
          yield ctx.until(()=>!!ctx.flags.choice);ctx.objectiveDone();ctx.marker(null);
          if(ctx.flags.choice==='broadcast'){
            yield ctx.dialog([['niteowl',countBits(ctx.flags.evidence)===3?'All three records. Names, payments, target lists. I am sending it to every newsroom I can reach.':'We did not recover every record. I will send what we have. It is enough to start an investigation.'],['switchman','You think a city will thank you for making it afraid?'],['rorschach','Not asking for thanks.']]);
            ctx.flags.interceptors=[[450,450],[1300,400],[750,850],[1200,760]].map(([x,y])=>ctx.add(new DM.Enemies.Drone({x,y,alerted:true})));
            ctx.music('bonus_carrier');
          } else {
            yield ctx.dialog([['niteowl','Carrier is down. The emergency channels are clear. The engineers are safe.'],['rorschach','And somebody walks away with clean hands and dirty money.'],['manhattan','There is a difference between silence and peace. Tonight, we have made one of them.']]);
            ctx.flags.interceptors=[];
          }
        }
      },
      {id:'departure',label:'A city still awake',
        run:function*(ctx){
          ready(ctx);ctx.music(ctx.flags.choice==='broadcast'?'bonus_carrier':'reflect');ctx.objective('Return to the owlship',()=>{const n=(ctx.flags.interceptors||[]).filter(active).length;return n?`${n} interceptors remain`: 'E to board';});ctx.marker(1430,1100,'OWLSHIP');
          yield ctx.until(()=>(ctx.flags.interceptors||[]).every(e=>!active(e)));ctx.music('reflect');
          yield ctx.until(()=>ctx.flags.departed);ctx.objectiveDone();ctx.marker(null);ctx.lock(true);ctx.clearHostiles();
          yield ctx.dialog([['niteowl','Three people are going home tonight. Whatever else happened, that part is real.'],['rorschach',ctx.flags.choice==='broadcast'?'The truth is out there now. Let them try to put it back.':'This is not finished. I kept a name. One is enough to start.'],['manhattan','Below us, a woman switches on her radio. She hears the weather. She will never know how much effort that required.']]);
          ctx.music('reflect');yield ctx.narrate('For a moment, the only voice above the city is the rain.',{dur:4});
        }
      },
    ],
  });
  // Public constructors only for focused acceptance tests and later adventures.
  DM.LastBroadcast={chapter,Companion,Coil,Dock,Pylon,Carrier,countBits};
})();
