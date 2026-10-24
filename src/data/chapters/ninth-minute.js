/* BONUS II: THE NINTH MINUTE.
* An original optional fan story. Uses the shipped drawing, music, input,
* combat, dialogue and save systems. No original campaign files are changed.
*/
(function () {
  'use strict';
  const DM = window.DM,  G = DM.Gfx,  U = DM.U;
  const TEAL = '#93ddd2',  GOLD = '#e7bd77',  BLUE = '#80dcff',  RED = '#ed897c';
  const alive = e => e && !e.dead && !e.ko;
  const bits = n => [1,  2,  4].filter(b => (n || 0) & b).length;
  const reduced = () => DM.SettingsSchema.reducedFlashing();
  DM.LOOKS.silkspectre = Object.assign({
  },  DM.LOOKS.laurie,  {
    name:'Silk Spectre', body:'#c4a64d', sleeve:'#252129', legs:'#26242b', trim:'#edce76', bg:'#5b5a57',
    color:GOLD
  });
  DM.LOOKS.vale = {
    name:'Dr. Mara Vale', skin:'#b78f71', hair:'#302d2a', hairStyle:'short', glasses:true, body:'#6c8d87',
    sleeve:'#6c8d87', legs:'#273b3b', collar:'#d0c6ab', bg:'#375c60', color:TEAL
  };
  DM.LOOKS.commuter = {
    name:'Passenger', skin:'#cda786', hair:'#534235', hairStyle:'short', body:'#97745d', sleeve:'#97745d',
    legs:'#313c44', bg:'#59686d', color:'#d5d0b8'
  };
  // Additive arrangements: the original tracks and synthesizer remain untouched.
  DM.MusicTracks.ninth_platform = {
    bpm:66, level:0.5, barsPerChord:2, echo:.48,
    prog:[[52, 59, 62, 66], [48, 55, 59, 62], [50, 57, 60, 64], [47, 54, 59, 62]],
    layers:[{
      kind:'pad', wave:'sine', gain:.027, attack:2.2
    },
    {
      kind:'arp', wave:'triangle', gain:.024, every:3, pattern:[0, -1, 2, 3, -1, 1, 2, -1], oct:12, cutoff:1650,
      len:3.5
    },
    {
      kind:'bass', wave:'sine', gain:.048, oct:-12, every:8
    }, {
      kind:'tick', gain:.035, every:4
    },
    {
      kind:'kick', gain:.1, pattern:[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0], min:.65
    }]
  };
  DM.MusicTracks.ninth_pendulum = {
    bpm:100, level:-2, barsPerChord:1, echo:.34,
    prog:[[52, 59, 62, 66], [52, 58, 62, 65], [48, 55, 59, 62], [47, 54, 58, 62]],
    layers:[{
      kind:'pad', wave:'sine', gain:.025, attack:.9
    },
    {
      kind:'arp', wave:'triangle', gain:.026, every:1, pattern:[0, 2, 1, 3, 2, 0, 4, 1], oct:12, cutoff:2000,
      len:1.6
    },
    {
      kind:'bass', wave:'sawtooth', gain:.03, oct:-12, every:4, cutoff:300
    },
    {
      kind:'tick', gain:.034, every:2
    }, {
      kind:'kick', gain:.14, pattern:[1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0], min:.2
    },
    {
      kind:'snare', gain:.035, pattern:[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], min:.6
    }]
  };
  DM.MusicTracks.ninth_dawn = {
    bpm:70, level:4, barsPerChord:2, echo:.5,
    prog:[[52, 59, 64, 68], [50, 57, 61, 66], [48, 55, 60, 64], [47, 54, 59, 64]],
    layers:[{
      kind:'pad', wave:'sine', gain:.025, attack:2.5
    },
    {
      kind:'arp', wave:'triangle', gain:.023, every:4, pattern:[0, 2, -1, 3, 1, -1, 2, 4], oct:12, cutoff:1800,
      len:4
    },
    {
      kind:'bass', wave:'sine', gain:.04, oct:-12, every:8
    }]
  };
  for (const id of ['ninth_platform', 'ninth_train', 'ninth_engine']) DM.Ambience.maps[id] = {
    bed:'ninth_tunnel', surface:'concrete'
  };
  Object.assign(DM.Ambience.cues, {
    'ninth_minute.platform':'ninth_platform', 'ninth_minute.rescue':'ninth_pendulum',
    'ninth_minute.pendulum':'ninth_pendulum', 'ninth_minute.decision':'ninth_platform', 'ninth_minute.departure':'ninth_dawn'
  });
  const {
    ring: circle,  label: plate,  burst,  Sign,  Terminal,  Companion
  } = DM.BonusKit;
  function clock(g, x, y, r, t=0, stopped=true) {
    g.save();
    g.translate(x, y);
    g.fillStyle='#111d22';
    G.circle(g, 0, 0, r+8);
    g.fill();
    g.fillStyle='#d6cbaa';
    G.circle(g, 0, 0, r);
    g.fill();
    circle(g, 0, 0, r, GOLD, 3);
    for(let i=0;
    i<60;
    i++){
      const a=i*Math.PI/30-Math.PI/2;
      g.strokeStyle=i%5?'#847e6e':'#384447';
      g.lineWidth=i%5?1:2.5;
      G.line(g, Math.cos(a)*r*.8, Math.sin(a)*r*.8, Math.cos(a)*r*(i%5?.87:.94), Math.sin(a)*r*(i%5?.87:.94));
    }
    const a=(stopped?-.62:t*.12)-Math.PI/2;
    g.strokeStyle='#263a40';
    g.lineWidth=4;
    G.line(g, 0, 0, Math.cos(a)*r*.65, Math.sin(a)*r*.65);
    g.lineWidth=6;
    G.line(g, 0, 0, -r*.27, -r*.31);
    const s=stopped?Math.PI*.3:t*.8;
    g.strokeStyle='#b66149';
    g.lineWidth=1.5;
    G.line(g, 0, 0, Math.cos(s)*r*.76, Math.sin(s)*r*.76);
    g.fillStyle=GOLD;
    G.circle(g, 0, 0, 5);
    g.fill();
    g.restore();
  }
  function stationBackdrop(g, t) {
    const grad=g.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, '#051217');
    grad.addColorStop(.65, '#213b3d');
    grad.addColorStop(1, '#0b1018');
    g.fillStyle=grad;
    g.fillRect(0, 0, 1280, 720);
    for(let x=-100;
    x<1380;
    x+=160){
      g.strokeStyle='rgba(147,198,182,.2)';
      g.lineWidth=15;
      g.beginPath();
      g.ellipse(x, 440, 150, 360, 0, Math.PI, Math.PI*2);
      g.stroke();
    }
    for(let y=590;
    y<720;
    y+=35){
      g.strokeStyle='#375351';
      g.lineWidth=2;
      G.line(g, 0, y, 1280, y);
    }
    for(let i=0;
    i<12;
    i++)G.glow(g, i*120, 500, 40, GOLD, .15);
  }
  function lights(w, add) {
    for(const e of w.entities) if(!e.dead&&e.light){
      const l=e.light(w);
      if(l)add(l.x == null ? e.x : l.x, l.y == null ? e.y : l.y, l.r||180, l);
    }
    const stations=w.mapId==='ninth_platform'?[[290, 300], [650, 950], [1070, 300], [1490, 950], [1680,
    300]]:
    w.mapId==='ninth_train'?[[300, 1020], [800, 890], [1320, 890], [1860, 890], [2020, 350]]:[[430,
    400], [1460, 400], [420, 1140], [1480, 1120], [950, 400]];
    for(const [x, y] of stations)add(x, y, 340, {
      i:.77, color:TEAL, k:.12
    });
  }
  for(const id of ['ninth_platform', 'ninth_train', 'ninth_engine'])DM.Atmosphere.register(id, {
    shadow:'rgba(3,14,20,.5)', light:{
      ambient:'rgba(3,17,23,.52)', lights
    },
    weather:[{
      type:'haze', n:26, alpha:.035
    }],
    walls:{
      wall:{
        pattern:'brick', height:1.15
      }, low:{
        pattern:'concrete', height:.5
      }, rib:{
        pattern:'ribbed', height:1.05
      }
    }
  });
  class LostMoment extends Terminal {
    constructor(ctx, x, y, bit, text){
      super(x, y, 'E · LISTEN TO THE LOST MOMENT', ()=>{
        ctx.flags.moments=(ctx.flags.moments||0)|bit;
        DM.Audio.play('memory');
        burst(ctx.world, x, y, GOLD);
        ctx.scene.dialog.open([['manhattan', text], ['silkspectre', 'Then we make sure they get another one.']]);
      }, ()=>!((ctx.flags.moments||0)&bit)&&ctx.world.timesight, GOLD);
      this.ctx=ctx;
      this.bit=bit;
      this.timeless=true;
      this.light=()=>({
        r:140, i:.5, color:GOLD, k:.09
      });
    }
    render(g, w){
      if((this.ctx.flags.moments||0)&this.bit)return;
      g.save();
      g.globalAlpha=w.timesight?.75:.2;
      G.figure(g, Object.assign({
      }, DM.LOOKS.commuter, {
        x:this.x, y:this.y, angle:0, walk:0, moving:false
      }));
      g.restore();
      if(!w.lit)this.renderEmissive(g, w);
    }
    renderEmissive(g, w){
      if((this.ctx.flags.moments||0)&this.bit)return;
      circle(g, this.x, this.y, 22, GOLD, 1);
      if(U.dist(this.x, this.y, w.player.x, w.player.y)<85)plate(g, w.timesight?'E · LISTEN':'HOLD F · A LOST MOMENT',
      this.x, this.y-38, GOLD, 12);
    }
  }
  class SilkSpectre extends DM.NPC {
    constructor(ctx, x, y){
      super({
        x, y, look:'silkspectre', lookAtPlayer:false, speed:220
      });
      this.ctx=ctx;
      this.team='player';
      this.body=false;
      this.cool=.7;
      this.strikes=0;
      this.catchUp=0;
      this.light=()=>({
        r:100, i:.55, color:GOLD, k:.09
      });
    }
    update(dt, w){
      if(w.ceasefire||this.ctx.flags.operators){
        this.vx=this.vy=0;
        return;
      }
      this.cool-=dt;
      this.catchUp-=dt;
      const job=this.ctx.flags.activeDoor;
      let target=null;
      if(!job)for(const e of w.entities)if(e.team==='enemy'&&alive(e)&&!e.isProjectile&&!e.bonusBoss&&e.hp!=null&&U.dist(e.x,
      e.y, this.x, this.y)<210&&w.los(this.x, this.y, e.x, e.y)){
        target=e;
        break;
      }
      const tx=job?job.x:target?target.x:w.player.x+70, ty=job?job.y+58:target?target.y:w.player.y+60;
      let d=U.dist(this.x, this.y, tx, ty);
      if(d>600&&this.catchUp<=0){
        if(w.isFree(tx, ty, 14)){
          burst(w, this.x, this.y, GOLD);
          this.x=tx;
          this.y=ty;
          this.catchUp=4;
          d=0;
        }
      }
      const goal=job?18:target?36:78;
      if(d>goal){
        const a=U.angleTo(this.x, this.y, tx, ty);
        let best=null, score=Infinity;
        for(const off of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.2, -2.2]){
          const b=a+off, nx=this.x+Math.cos(b)*48, ny=this.y+Math.sin(b)*48;
          if(w.isFree(nx, ny, 14)&&U.dist(nx, ny, tx, ty)<score){
            score=U.dist(nx, ny, tx, ty);
            best=b;
          }
        }
        if(best!==null){
          this.vx=U.damp(this.vx, Math.cos(best)*215, 10, dt);
          this.vy=U.damp(this.vy, Math.sin(best)*215, 10, dt);
          this.facing=best;
        }
      }else{
        this.vx=U.damp(this.vx, 0, 10, dt);
        this.vy=U.damp(this.vy, 0, 10, dt);
      }
      if(target&&d<65&&this.cool<=0){
        target.damage(21, this, 'impact');
        target.stun=Math.max(target.stun, .65);
        burst(w, target.x, target.y, GOLD);
        DM.Audio.play('impact');
        this.cool=1;
        this.strikes++;
      }
      this.moving=this.speed>15;
      if(this.moving)this.walk+=dt*this.speed*.09;
    }
    render(g, w){
      super.render(g, w);
      if(!w.lit)this.renderEmissive(g, w);
    }
    renderEmissive(g, w){

    }
  }
  function cast(ctx, x, y){
    const owl = ctx.add(new Companion(x - 65,  y + 40,  'niteowl',  {
      holdPosition: () => !!ctx.flags.operators,
      showName: () => false,
    }));
    ctx.flags.owl=owl;
    ctx.flags.laurie=ctx.add(new SilkSpectre(ctx, x+65, y+45));
  }
  function ready(ctx){
    ctx.lock(false);
    ctx.player.energy=100;
    ctx.player.coherence=100;
    ctx.player.regenDelay=0;
  }
  function drones(ctx, points){
    return points.map(([x, y])=>ctx.add(new DM.Enemies.Drone({
      x, y, alerted:true
    })));
  }
  function floor(w, seed, platform=true){
    w.bake((g, width, height)=>{
      const rnd=U.seeded(seed);
      g.fillStyle='#142428';
      g.fillRect(0, 0, width, height);
      g.fillStyle='#344d4c';
      g.fillRect(80, 160, width-160, height-230);
      for(let y=160;
      y<height-70;
      y+=42)for(let x=80;
      x<width-80;
      x+=42){
        g.fillStyle=rnd()>.6?'#3a514f':'#334947';
        g.fillRect(x+1, y+1, 40, 40);
      }
      g.fillStyle='#c1bca3';
      g.fillRect(81, 161, width-162, 72);
      g.fillStyle='#1b3b3b';
      g.fillRect(81, 230, width-162, 19);
      for(let x=85;
      x<width-85;
      x+=42){
        g.strokeStyle='rgba(72,82,70,.32)';
        g.lineWidth=1;
        G.line(g, x, 161, x, 230);
      }
      for(let y=180;
      y<228;
      y+=22){
        g.strokeStyle='rgba(65,82,72,.3)';
        G.line(g, 81, y, width-82, y);
      }
      for(let i=0;
      i<2100;
      i++){
        g.fillStyle=rnd()>.5?'rgba(207,220,199,.04)':'rgba(0,10,12,.08)';
        g.fillRect(85+rnd()*(width-170), 250+rnd()*(height-340), 1+rnd()*6, 1+rnd()*4);
      }
      for(let i=0;
      i<9;
      i++){
        g.fillStyle='rgba(104,166,163,.09)';
        G.ellipse(g, 100+rnd()*(width-200), 300+rnd()*(height-400), 20+rnd()*70, 6+rnd()*15);
        g.fill();
      }
    });
    w.room(80, 160, w.w-160, w.h-230, {
      t:17, kind:'wall'
    });
  }
  function track(g, x, y, len){
    g.fillStyle='#101d22';
    g.fillRect(x, y, len, 190);
    for(let s=x;
    s<x+len;
    s+=35){
      g.fillStyle='#334341';
      g.fillRect(s, y+20, 11, 150);
    }
    for(const off of [42, 145]){
      g.strokeStyle='#718681';
      g.lineWidth=6;
      G.line(g, x, y+off, x+len, y+off);
      g.strokeStyle='#b2bcb0';
      g.lineWidth=1;
      G.line(g, x, y+off-2, x+len, y+off-2);
    }
    g.fillStyle='#c6a764';
    g.fillRect(x, y-9, len, 6);
    g.fillRect(x, y+194, len, 6);
    for(let xx=x;
    xx<x+len;
    xx+=30){
      g.fillStyle='#535c4d';
      g.fillRect(xx, y-9, 14, 6);
      g.fillRect(xx, y+194, 14, 6);
    }
  }
  function column(ctx, x, y){
    ctx.world.wall(x-22, y-65, 44, 130, 'low');
    ctx.world.overlays.push(g=>{
      g.fillStyle='#243d3d';
      g.fillRect(x-21, y-64, 42, 128);
      g.fillStyle='#709386';
      g.fillRect(x-16, y-64, 6, 128);
      g.fillStyle='#b4b191';
      g.fillRect(x-26, y-69, 52, 12);
      g.fillRect(x-26, y+57, 52, 12);
      for(const yy of [-35, 0, 35]){
        g.fillStyle='#111e20';
        G.circle(g, x+10, y+yy, 3);
        g.fill();
      }
    });
  }
  class RailArc extends DM.Entity {
    constructor(x, y, width, height, offset=0){
      super({
        x, y, body:false, solid:false, static:true, disintegratable:false
      });
      this.width=width;
      this.height=height;
      this.offset=offset;
      this.r=Math.hypot(width, height)/2;
      this.hazard=true;
      this._phase=0;
      this.hit=-1;
      this.enabled=true;
    }
    get phase() {
      return this.world ? this.world.cycleT : this._phase;
    }
    set phase(value) {
      if (this.world) this.world.cycleT = value;
      else this._phase = value;
    }
    update(dt, w){
      if(w.ceasefire||!this.enabled)return;
      const t=(this.phase+this.offset)%9;
      if(t>=6.9&&t<7.9&&this.hit!==w.cycleNumber){
        const p=w.player;
        if(Math.abs(p.x-this.x)<this.width/2+p.r&&Math.abs(p.y-this.y)<this.height/2+p.r){
          p.damage(12, this, 'time arc');
          this.hit=w.cycleNumber;
        }
      }
    }
    render(g, w){
      if(!w.lit)this.renderEmissive(g, w);
    }
    renderEmissive(g, w){
      if(!this.enabled)return;
      const t=(this.phase+this.offset)%9;
      if(t<5.3||t>7.9)return;
      g.fillStyle=t<6.9?'rgba(231,189,119,.1)':'rgba(128,220,255,.22)';
      g.fillRect(this.x-this.width/2, this.y-this.height/2, this.width, this.height);
      g.strokeStyle=t<6.9?GOLD:BLUE;
      g.lineWidth=2;
      g.setLineDash(t<6.9?[8, 7]:[]);
      g.strokeRect(this.x-this.width/2, this.y-this.height/2, this.width, this.height);
      g.setLineDash([]);

    }
  }
  class RouteSwitch extends Terminal {
    constructor(ctx, x, y){
      super(x, y, 'E · CHANGE THE TRACK ROUTE', ()=>{
        ctx.flags.route=((ctx.flags.route||0)+1)%3;
        ctx.toast(['LOOP LINE', 'SERVICE PLATFORM · SAFE ROUTE', 'EXPRESS TUNNEL'][ctx.flags.route],
        ctx.flags.route===1?TEAL:GOLD);
        DM.Audio.play('gear');
      });
      this.ctx=ctx;
    }
    renderEmissive(g, w){
      super.renderEmissive(g, w);
      const n=this.ctx.flags.route||0;

      for(let i=0;
      i<3;
      i++){
        g.fillStyle=i===n?(n===1?TEAL:GOLD):'#2a4546';
        G.circle(g, this.x-24+i*24, this.y-25, 5);
        g.fill();
      }
    }
  }
  function platform(ctx){
    const w=ctx.newWorld({
      w:1960, h:1260, zoom:1.06
    });
    w.spawn={
      x:250, y:1020
    };
    floor(w, 1977);
    ctx.flags.stationCycle = DM.NinthAtmosphere.decorate(ctx, 'platform');
    w.decals.push(g=>{
      track(g, 99, 500, 1762);
      clock(g, 970, 335, 68, w.cycleT, false);
      G.text(g, '', 980, 209, {
        size:31, align:'center', spacing:7, color:'#263a36', weight:700
      });
      for(const [x, y]of[[320, 870], [1370, 870], [510, 350]]){
        g.fillStyle='#1c302e';
        g.fillRect(x-80, y, 160, 32);
        g.strokeStyle='#ae9c74';
        g.lineWidth=4;
        for(let i=0;
        i<5;
        i++)G.line(g, x-77, y+3+i*5, x+77, y+3+i*5);
      }
      for(let i=0;
      i<14;
      i++){
        g.fillStyle=i%2?'#435958':'#809287';
        g.fillRect(135, 970+i*11, 170, 10);
      }
      g.fillStyle='#8d5343';
      g.fillRect(1550, 277, 110, 150);
      G.text(g, 'TOMORROW', 1605, 325, {
        size:15, align:'center', color:'#e3c89f'
      });
      G.text(g, 'ON TIME', 1605, 350, {
        size:16, align:'center', color:'#e3c89f'
      });
      for(const xx of [290, 650, 1070, 1500]){
        g.fillStyle='#bec1aa';
        g.fillRect(xx-45, 260, 90, 8);
        G.glow(g, xx, 270, 65, TEAL, .13);
      }
    });
    for(const x of [580, 1100, 1530])column(ctx, x, 940);
    ctx.flags.arcs=[ctx.add(new RailArc(670, 596, 160, 196, 0)), ctx.add(new RailArc(1390, 596, 170,
    196, 4))];
    cast(ctx, 270, 1000);
    ctx.flags.platformFoes=drones(ctx, [[660, 1000], [1050, 810], [1470, 750], [1580, 360], [1200, 330]]);


    ctx.flags.switch=ctx.add(new RouteSwitch(ctx, 1690, 955));
    ctx.add(new LostMoment(ctx, 455, 350, 1, 'A man on this bench is remembering the number of his first apartment. He has forgotten that he remembers it. In a moment, he will stand up. Again.'));
    const e=ctx.add(new Terminal(1730, 330, 'E · ENTER THE SERVICE TUNNEL', ()=>{
      if(ctx.flags.platformFoes.some(alive))return ctx.toast('CLEAR THE SECURITY DRONES BEFORE ENTERING',
      GOLD);
      if(ctx.flags.route!==1)return ctx.toast('SET THE SIGNAL BOX TO SERVICE · THE TEAL ROUTE', GOLD);
      ctx.flags.enterTrain=true;
    }));
    ctx.flags.exit=e;
    ctx.add(new Sign(1730, 270, 'SERVICE →', TEAL, 14));
    return w;
  }
  class Evacuee extends DM.NPC {
    constructor(ctx, x, y, index){
      super({
        x, y, look:Object.assign({
        }, DM.LOOKS.commuter, {
          body:['#b89067', '#678e8b', '#a38499', '#8d9b6a', '#ad7e67', '#708a9f'][index]
        }), speed:155, lookAtPlayer:false
      });
      this.ctx=ctx;
      this.body=false;
      this.friction=2;
      this.walkTo(215, 1150);
      this.counted=false;
      this.disintegratable=false;
    }
    update(dt, w){
      super.update(dt, w);
      if(!this.counted&&U.dist(this.x, this.y, 215, 1150)<35){
        this.counted=true;
        this.ctx.flags.passengers=(this.ctx.flags.passengers||0)+1;
        this.ctx.toast(`${this.ctx.flags.passengers} / 6 PASSENGERS SAFE`, TEAL);
        this.dead=true;
      }
    }
  }
  class CarriageDoor extends Terminal {
    constructor(ctx, x, y, index){
      super(x, y, `E · OPEN CARRIAGE ${index+1}`, ()=>this.begin(), ()=>!this.open);
      this.ctx=ctx;
      this.index=index;
      this.progress=0;
      this.open=false;
      this.working=false;
      this.blocked=false;
    }
    begin(){
      const f=this.ctx.flags;
      if(this.open)return;
      if(f.activeDoor&&f.activeDoor!==this)return this.ctx.toast('LAURIE IS OPENING ANOTHER CARRIAGE',
      GOLD);
      if(this.working)return;
      f.activeDoor=this;
      this.working=true;
      this.ctx.toast('KEEP LAURIE COVERED · CLEAR DRONES NEAR THE DOOR', GOLD);
      DM.Audio.play('gear');
      const x=this.x;
      f.rescueFoes.push(...drones(this.ctx, [[U.clamp(x-200, 380, 1980), 980], [U.clamp(x+280, 380,
      1980), 1100]]));
    }
    update(dt, w){
      if(w.ceasefire||!this.working||this.open)return;
      this.blocked=w.entities.some(e=>alive(e)&&e.team==='enemy'&&!e.isProjectile&&U.dist(e.x, e.y,
      this.x, this.y)<180);
      const l=this.ctx.flags.laurie;
      if(this.blocked||U.dist(l.x, l.y, this.x, this.y+58)>65)return;
      this.progress=Math.min(5.5, this.progress+dt);
      if(this.progress>=5.5){
        this.open=true;
        this.working=false;
        this.ctx.flags.activeDoor=null;
        this.ctx.flags.opened=(this.ctx.flags.opened||0)|(1<<this.index);
        burst(w, this.x, this.y);
        DM.Audio.play('success');
        for(let i=0;
        i<2;
        i++)w.add(new Evacuee(this.ctx, this.x-18+i*36, this.y+22, this.index*2+i));
        this.ctx.toast(`CARRIAGE ${this.index+1} OPEN · PASSENGERS EVACUATING`, TEAL);
      }
    }
    render(g, w){
      g.fillStyle=this.open?'#172728':'#748883';
      g.fillRect(this.x-38, this.y-38, 76, 61);
      if(!this.open){
        g.strokeStyle='#c2c3aa';
        g.lineWidth=2;
        G.line(g, this.x, this.y-38, this.x, this.y+23);
        g.fillStyle='#bd9b63';
        g.fillRect(this.x-24, this.y-9, 12, 6);
        g.fillRect(this.x+12, this.y-9, 12, 6);
      }
      if(!w.lit)this.renderEmissive(g, w);
    }
    renderEmissive(g, w){
      const col=this.open?TEAL:this.blocked?RED:GOLD;
      if(this.working){
        g.fillStyle='#14252b';
        g.fillRect(this.x-48, this.y+67, 96, 6);
        g.fillStyle=col;
        g.fillRect(this.x-48, this.y+67, 96*this.progress/5.5, 6);
      }
    }
  }
  function trainCar(g, x, y, index, open=false){
    g.fillStyle='rgba(0,0,0,.35)';
    G.rr(g, x-13, y+12, 479, 221, 35);
    g.fill();
    g.fillStyle='#4f7370';
    G.rr(g, x, y, 453, 205, 25);
    g.fill();
    g.strokeStyle='#9cae9c';
    g.lineWidth=3;
    G.rr(g, x, y, 453, 205, 25);
    g.stroke();
    g.fillStyle='#b7b899';
    g.fillRect(x+20, y+148, 413, 10);
    g.fillStyle='#253c3d';
    g.fillRect(x+13, y+35, 427, 14);
    for(let i=0;
    i<7;
    i++){
      const wx=x+28+i*59;
      g.fillStyle='#192c32';
      G.rr(g, wx, y+65, 44, 58, 6);
      g.fill();
      const a=g.createLinearGradient(wx, y+67, wx, y+120);
      a.addColorStop(0, '#b99e66');
      a.addColorStop(1, '#605b47');
      g.fillStyle=a;
      g.fillRect(wx+4, y+69, 36, 50);
      if(!open&&i%2===0){
        g.fillStyle='#293b3a';
        G.circle(g, wx+22, y+87, 7);
        g.fill();
        g.fillRect(wx+13, y+94, 18, 23);
      }g.strokeStyle='rgba(232,220,174,.4)';
      g.lineWidth=1;
      G.line(g, wx+6, y+73, wx+22, y+81);
    }
    for(let k=0;
    k<8;
    k++){
      g.strokeStyle='rgba(16,43,42,.4)';
      g.lineWidth=2;
      G.line(g, x+28, y+19+k*2, x+420, y+19+k*2);
    }
    G.text(g, 'M T A   /   0 9', x+335, y+183, {
      size:12, spacing:2, align:'center', color:'#d2c59e'
    });
    g.fillStyle='#d1c59f';
    G.circle(g, x+40, y+176, 12);
    g.fill();
    G.text(g, String(index+1), x+40, y+181, {
      size:14, align:'center', color:'#294446', weight:700
    });
  }
  function rescue(ctx){
    const w=ctx.newWorld({
      w:2340, h:1400, zoom:.98
    });
    w.spawn={
      x:240, y:1135
    };
    floor(w, 907);
    ctx.flags.stationCycle = DM.NinthAtmosphere.decorate(ctx, 'train');
    ctx.flags.passengers=0;
    ctx.flags.opened=0;
    ctx.flags.activeDoor=null;
    cast(ctx, 275, 1110);
    w.decals.push(g=>{
      track(g, 100, 516, 2140);
      G.text(g, '', 1170, 211, {
        size:27, align:'center', spacing:6, color:'#263c37', weight:700
      });
      g.strokeStyle='#a49d71';
      g.lineWidth=3;
      G.line(g, 150, 1210, 2180, 1210);
      for(let x=400;
      x<2180;
      x+=170){
        g.fillStyle='#b4b298';
        g.beginPath();
        g.moveTo(x, 1198);
        g.lineTo(x-17, 1210);
        g.lineTo(x, 1222);
        g.fill();
      }
      for(let i=0;
      i<14;
      i++){
        g.fillStyle=i%2?'#728d81':'#405d56';
        g.fillRect(135+i*11, 1040, 10, 200);
      }
    });
    ctx.flags.doors=[];
    for(let i=0;
    i<3;
    i++){
      const x=380+i*540, y=522;
      w.wall(x, y+5, 453, 182, 'low');
      const door=ctx.add(new CarriageDoor(ctx, x+220, y+205, i));
      ctx.flags.doors.push(door);
      w.overlays.push(g=>trainCar(g, x, y, i, door.open));
      for(const xx of [x+70, x+360]){
        ctx.add(new DM.BonusKit.Lamp(xx,  y + 245,  {
          r: 190,  i: 0.6,  color: GOLD,  k: 0.14
        }));
      }
    }
    for(const x of [570, 1140, 1730])column(ctx, x, 350);
    ctx.flags.rescueFoes=drones(ctx, [[740, 1060], [1300, 920], [1850, 1040]]);
    ctx.add(new Sign(240, 1250, '← EXIT TO THE STREET', TEAL, 16));

    ctx.add(new LostMoment(ctx, 2070, 365, 2, 'A girl counts the lamps outside the window. Eight. Nine. Eight. Nine. She has not reached ten for forty-three minutes.'));
    ctx.add(new Terminal(2120, 1140, 'E · ENTER THE CLOCK CHAMBER', ()=>{
      if(ctx.flags.passengers!==6)return ctx.toast('SIX PASSENGERS MUST REACH THE STAIRS FIRST', GOLD);
      if(ctx.flags.rescueFoes.some(alive))return ctx.toast('CLEAR THE REMAINING SECURITY DRONES', GOLD);
      ctx.flags.enterEngine=true;
    }));
    return w;
  }
  class Pendulum extends DM.Entity {
    constructor(ctx, x, y){
      super({
        x, y, r:85, hp:840, static:true, team:'enemy', grabbable:false, disintegratable:true
      });
      this.ctx=ctx;
      this.bonusBoss=true;
      this.hazard=true;
      this.human=false;
      this.name='THE PENDULUM · WAIT FOR THE TEAL CORE';
      this.phaseMarks=[.5];
      this.phase=1;
      this.cycle=0;
      this.angle=0;
      this.struck=false;
      this.fired=false;
      this.pulsed=false;
      this.aim=null;
      this.exposed=0;
      this.threatWeight=5;
      this.alerted=true;
      this.light=()=>({
        r:410, i:.82, color:this.open?TEAL:GOLD, k:.2
      });
    }
    get open(){
      return this.cycle>=6||this.exposed>0;
    }
    damage(n, source, kind){
      const returned=source&&source.isProjectile&&source.team==='player'&&kind==='explosion';
      if(returned){
        this.exposed=3.2;
        n*=2.2;
        this.ctx.toast('RETURNED MISSILE · CORE DISRUPTED', TEAL);
      }
      if(!this.open){
        if(!this.note||this.world.time>this.note){
          this.ctx.toast('CORE OPENS AT SEVEN · WATCH THE CLOCK', GOLD);
          this.note=this.world.time+4;
        }return false;
      }
      return super.damage(n, source, kind);
    }
    disintegrate(w, p){
      this.damage(70, p, 'disintegrate');
    }
    update(dt, w){
      if(w.ceasefire)return;
      this.exposed=Math.max(0, this.exposed-dt);
      this.cycle+=dt;
      if(this.cycle>=9){
        this.cycle-=9;
        this.struck=this.fired=this.pulsed=false;
        this.aim=null;
        this.angle=U.angleTo(this.x, this.y, w.player.x, w.player.y);
      }
      if(this.cycle<.1&&!this.struck)this.angle=U.angleTo(this.x, this.y, w.player.x, w.player.y);
      this.name=this.open?'THE PENDULUM · CORE OPEN · ATTACK':'THE PENDULUM · CORE OPENS AT SEVEN';
      if(this.hp<=420&&this.phase===1){
        this.phase=2;
        this.ctx.toast('THE LOOP IS BREAKING · WATCH BOTH CLOCK HANDS', GOLD);
        drones(this.ctx, [[420, 1040], [1480, 1040]]);
      }
      if(this.cycle>=1.8&&!this.struck){
        this.struck=true;
        for(const off of this.phase===2?[-.5, 0, .5]:[0]){
          const a=this.angle+off, p=w.player, dx=p.x-this.x, dy=p.y-this.y;
          const along=dx*Math.cos(a)+dy*Math.sin(a), across=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a));
          if(along>90&&along<700&&across<32+p.r)p.damage(16, this, 'clock sweep');
        }
        DM.Audio.play('zap');
      }
      if(this.cycle>=3&&!this.fired){
        this.fired=true;
        const a=U.angleTo(this.x, this.y, w.player.x, w.player.y);
        w.add(new DM.Proj.Missile({
          x:this.x+Math.cos(a)*95, y:this.y+Math.sin(a)*95, angle:a, speed:210
        }));
        this.aim={
          x:w.player.x, y:w.player.y
        };
      }
      if(this.cycle>=4.8&&!this.pulsed){
        this.pulsed=true;
        if(this.aim)w.explode(this.aim.x, this.aim.y, 100, 14, {
          source:this, team:'enemy', force:80, colors:[TEAL, GOLD]
        });
        this.aim=null;
      }
    }
    onDeath(){
      this.ctx.flags.pendulumDown=true;
      this.world.explode(this.x, this.y, 155, 0, {
        source:this, force:40, colors:[TEAL, GOLD, '#ffffff']
      });
      DM.Audio.play('success');
    }
    render(g, w){
      g.save();
      g.translate(this.x, this.y);
      g.fillStyle='#13272c';
      G.circle(g, 0, 0, 103);
      g.fill();
      circle(g, 0, 0, 99, '#6d897d', 5);
      circle(g, 0, 0, 86, '#c2a36a', 8);
      for(let i=0;
      i<12;
      i++){
        const a=i*Math.PI/6;
        g.fillStyle=i<Math.floor(this.cycle/9*12)?TEAL:'#59675b';
        G.circle(g, Math.cos(a)*92, Math.sin(a)*92, 5);
        g.fill();
        g.strokeStyle='#8d967f';
        g.lineWidth=5;
        G.line(g, Math.cos(a)*108, Math.sin(a)*108, Math.cos(a)*128, Math.sin(a)*128);
      }
      g.rotate(this.cycle/9*Math.PI*2);
      g.fillStyle='#637c72';
      for(let j=0;
      j<3;
      j++){
        g.rotate(Math.PI*2/3);
        g.fillRect(37, -10, 52, 20);
      }
      g.restore();
      g.fillStyle=this.open?'#d1efe4':'#605d48';
      G.circle(g, this.x, this.y, 44);
      g.fill();
      circle(g, this.x, this.y, 50, this.open?TEAL:GOLD, 3);
      if(!w.lit)this.renderEmissive(g, w);
    }
    renderEmissive(g, w){
      G.glow(g, this.x, this.y, this.open?115:65, this.open?TEAL:GOLD, reduced()?.22:.25+Math.sin(w.time*2)*.04);
      G.hydrogen(g, this.x, this.y, 29, this.open?'#ecfff3':'#c4b585', this.cycle, 2);
      if(this.cycle<2.3){
        for(const off of this.phase===2?[-.5, 0, .5]:[0]){
          const a=this.angle+off;
          g.save();
          g.strokeStyle=this.struck?'rgba(235,137,124,.55)':'rgba(231,189,119,.55)';
          g.lineWidth=this.struck?52:2;
          g.setLineDash(this.struck?[]:[12, 10]);
          G.line(g, this.x+Math.cos(a)*112, this.y+Math.sin(a)*112, this.x+Math.cos(a)*710, this.y+Math.sin(a)*710);
          g.restore();
        }
      }
      if(this.aim){
        circle(g, this.aim.x, this.aim.y, 100, RED, 2);
        circle(g, this.aim.x, this.aim.y, 100*U.clamp((this.cycle-3)/1.8, 0, 1), RED, 1);
      }
      plate(g, this.open?'CORE OPEN · Q':`${Math.floor(this.cycle)+1} / 9 · WAIT FOR TEAL`, this.x,
      this.y+147, this.open?TEAL:GOLD, 14);
    }
  }
  class TimeRing extends DM.Entity {
    constructor(x, y){
      super({
        x, y, r:1, body:false, solid:false, static:true, disintegratable:false
      });
      this.rad=20;
      this.hazard=true;
      this.hit=false;
    }
    update(dt, w){
      if(w.ceasefire)return;
      this.rad+=110*dt;
      this.r=this.rad;
      if(this.rad>660){
        this.dead=true;
        return;
      }
      if(!this.hit&&Math.abs(U.dist(this.x, this.y, w.player.x, w.player.y)-this.rad)<18){
        w.player.damage(10, this, 'temporal ring');
        this.hit=true;
      }
    }
    render(g, w){
      if(!w.lit)this.renderEmissive(g, w);
    }
    renderEmissive(g){
      circle(g, this.x, this.y, this.rad, 'rgba(231,189,119,.55)', 3);
    }
  }
  class Anchor extends DM.Entity {
    constructor(ctx, x, y){
      super({
        x, y, r:125, body:false, solid:false, static:true, disintegratable:false
      });
      this.ctx=ctx;
      this.charge=0;
      this.timeless=true;
      this.wave=4;
      this.light=()=>({
        r:230, i:.6, color:TEAL, k:.12
      });
    }
    update(dt, w){
      const f=this.ctx.flags;
      if(w.ceasefire||f.choice!=='preserve'||f.stable)return;
      if(w.timesight&&U.dist(w.player.x, w.player.y, this.x, this.y)<128){
        this.charge=Math.min(4, this.charge+dt);
      }
      this.wave-=dt;
      if(this.wave<=0){
        this.wave=5;
        w.add(new TimeRing(950, 660));
      }
      if(this.charge>=4){
        f.stable=true;
        burst(w, this.x, this.y);
        DM.Audio.play('success');
        this.ctx.toast('THE RECORD IS SAFE · TIME CAN MOVE AGAIN', TEAL);
      }
    }
    render(g, w){
      if(!w.lit)this.renderEmissive(g, w);
    }
    renderEmissive(g, w){
      const f=this.ctx.flags;
      if(f.choice!=='preserve'||f.stable)return;
      circle(g, this.x, this.y, 125, TEAL, 2);
      g.save();
      g.strokeStyle=GOLD;
      g.lineWidth=7;
      g.beginPath();
      g.arc(this.x, this.y, 132, -Math.PI/2, -Math.PI/2+Math.PI*2*this.charge/4);
      g.stroke();
      g.restore();
      if (DM.BonusKit.withinRange(w, this, 150)) {
        plate(g, `HOLD F · ${Math.round(this.charge / 4 * 100)}%`, this.x, this.y + 161, TEAL, 15);
      }
    }
  }
  function engine(ctx){
    const w=ctx.newWorld({
      w:1900, h:1450, zoom:.97
    });
    w.spawn={
      x:370, y:1170
    };
    floor(w, 9009, false);
    ctx.flags.stationCycle = DM.NinthAtmosphere.decorate(ctx, 'engine');
    w.decals.push(g=>{
      g.fillStyle='#273e3f';
      G.circle(g, 950, 700, 490);
      g.fill();
      circle(g, 950, 700, 488, '#a3946b', 6);
      circle(g, 950, 700, 438, '#536f64', 3);
      for(let i=0;
      i<60;
      i++){
        const a=i*Math.PI/30;
        g.strokeStyle=i%5?'#53716a':'#b5a77d';
        g.lineWidth=i%5?1:3;
        G.line(g, 950+Math.cos(a)*(i%5?458:444), 700+Math.sin(a)*(i%5?458:444), 950+Math.cos(a)*475,
        700+Math.sin(a)*475);
      }
      for(let i=0;
      i<12;
      i++){
        const a=i*Math.PI/6-Math.PI/2;
        G.text(g, i===0?'XII':String(i), 950+Math.cos(a)*410, 705+Math.sin(a)*410, {
          size:23, align:'center', color:'#839780', font:DM.FONTS.display
        });
      }
      G.text(g, 'THE MINUTE ENGINE', 950, 210, {
        size:29, align:'center', spacing:7, color:'#263c37', weight:700
      });
      for(let i=0;
      i<5;
      i++){
        g.strokeStyle=i%2?'#665c43':'#577a70';
        g.lineWidth=6;
        g.beginPath();
        g.moveTo(300+i*18, 300);
        g.lineTo(300+i*18, 480);
        g.lineTo(740, 480+i*14);
        g.stroke();
        g.beginPath();
        g.moveTo(1600-i*18, 300);
        g.lineTo(1600-i*18, 480);
        g.lineTo(1160, 480+i*14);
        g.stroke();
      }
      for(const [x, y]of[[540, 330], [1350, 330], [540, 1140], [1350, 1140]]){
        g.fillStyle='#3c5752';
        G.rr(g, x-60, y-36, 120, 72, 12);
        g.fill();
        circle(g, x, y, 26, '#aaa37d', 4);
        clock(g, x, y, 22, 0, true);
      }
    });
    for(const [x, y]of[[230, 600], [1660, 600], [230, 850], [1660, 850]])column(ctx, x, y);
    cast(ctx, 380, 1150);
    ctx.flags.pendulum=ctx.add(new Pendulum(ctx, 950, 660));
    w.boss=ctx.flags.pendulum;
    ctx.flags.engineFoes=drones(ctx, [[520, 880], [1400, 890]]);
    ctx.flags.anchor=ctx.add(new Anchor(ctx, 950, 935));
    w.overlays.push(g=>{
      if(!ctx.flags.operators)return;
      g.save();
      g.strokeStyle='rgba(147,221,210,.55)';
      g.lineWidth=2;
      for(const x of [635, 1265]){
        G.line(g, x, 555, 950, 660);
        G.glow(g, x, 555, 48, TEAL, .25);
      }g.restore();
    });
    ctx.add(new LostMoment(ctx, 1450, 370, 4, 'Mara signs the safety report. She leaves a space where her doubts should be. In all the versions of this moment, the space is the same size.'));
    ctx.flags.vale=ctx.add(new DM.NPC({
      x:950, y:365, look:'vale', facing:Math.PI/2, talk:()=>{
        ctx.scene.dialog.open([['vale', 'I kept the train from crashing. Then the machine would not let the next second happen.'],
        ['silkspectre', 'We have the passengers. You do not need to keep doing this alone.']]);
      }, enabled:()=>!!ctx.flags.pendulumDown, range:90
    }));
    ctx.add(new Terminal(625, 500, 'E · RELEASE THE LOOP', ()=>{
      ctx.flags.choice='release';
      ctx.flags.stable=true;
    }, ()=>ctx.flags.deciding&&!ctx.flags.choice, BLUE));
    ctx.add(new Terminal(1275, 500, 'E · PRESERVE THE RECORD', ()=>{
      ctx.flags.choice='preserve';
      ctx.player.energy=100;
    }, ()=>ctx.flags.deciding&&!ctx.flags.choice, GOLD));
    ctx.add(new Terminal(340, 1210, 'E · RETURN TO THE PLATFORM', ()=>{
      ctx.flags.departed=true;
    }, ()=>!!ctx.flags.stable, TEAL));
    return w;
  }
  function quiet(ctx){
    const f=ctx.flags;
    f.pendulumDown=true;
    ctx.clearHostiles();
    for(const e of ctx.world.entities)if(e.team==='enemy')e.dead=true;
    ctx.world.boss=null;
  }
  class NinthComplete {
    constructor(play, record){
      this.play=play;
      this.record=record;
      this.cursor='pointer';
      this.t=0;
    }
    enter(){
      DM.Audio.stopHums();
      DM.Audio.music.play('ninth_dawn');
      DM.Audio.play('success');
      this.menu=new DM.UI.Menu([{
        label:'RETURN TO BONUS LEVELS', action:()=>DM.Engine.fadeTo(()=>DM.Engine.set(new DM.Scenes.BonusMenu()))
      },
      {
        label:'PLAY AGAIN · TRY THE OTHER ROUTE', action:()=>DM.Bonus.start('ninth_minute', false)
      }], {
        x:640, y:556, w:660, align:'center', size:21, itemH:44
      });
    }
    update(dt){
      this.t+=dt;
      if(this.t>1)this.menu.update(dt);
    }
    render(g){
      stationBackdrop(g, this.t);
      g.fillStyle='rgba(4,14,20,.94)';
      g.fillRect(110, 52, 1060, 614);
      g.strokeStyle='rgba(147,221,210,.4)';
      g.strokeRect(110, 52, 1060, 614);
      const f=this.record.flags;
      G.text(g, 'BONUS II · ADVENTURE COMPLETE', 640, 111, {
        size:16, spacing:5, align:'center', color:TEAL
      });
      G.text(g, 'THE NINTH MINUTE', 640, 180, {
        size:48, weight:700, spacing:4, align:'center', color:'#eee4cb'
      });
      const text=f.choice==='preserve'?'Six people leave the station. The record leaves with them: proof of what the machine did, and who signed for it. For once, tomorrow has something useful to learn from yesterday.':'Six people leave the station. Behind them, the last repeated minute dissolves. There is no perfect record of what happened. There are people who will get to tell it.';
      G.paragraph(g, text, 244, 224, 792, 28, {
        size:21, font:DM.FONTS.type, color:'#deddd0'
      });
      const rows=[['PASSENGERS HOME', `${f.passengers||0} / 6`], ['LOST MOMENTS HEARD', `${bits(f.moments)} / 3`],
      ['YOUR CHOICE', f.choice==='preserve'?'THE RECORD PRESERVED':'THE LOOP RELEASED']];
      rows.forEach(([label, value], i)=>{
        G.text(g, label, 610, 386+i*42, {
          size:15, align:'right', spacing:2, color:'#a7bbb9'
        });
        G.text(g, value, 645, 386+i*42, {
          size:i===2?15:21, color:i===1?GOLD:TEAL
        });
      });
      G.text(g, 'The station clock reads 12:10. Nothing else needs to happen.', 640, 522, {
        size:15, align:'center', font:DM.FONTS.type, color:'#b4c6bf'
      });
      this.menu.render(g);
      G.postFx(g);
    }
  }
  const chapter=DM.Bonus.register({
    id:'ninth_minute', numeral:'BONUS II', title:'The Ninth Minute', date:'1977', place:'Harrow Street',
    clock:9, color:'#24494a', music:'ninth_platform', form:'manhattan',
    menuAccent:TEAL, menuTitle:['THE NINTH', 'MINUTE'], menuLocation:'NEW YORK · 1977', menuCast:['silkspectre',
    'niteowl'],
    menuSummary:'The same train arrives every nine seconds. Six passengers are trapped between one moment and the next.',
    menuBrief:'Join Silk Spectre and Nite Owl beneath the city. Break the loop. Bring the passengers home.',
    menuTagline:'LET THE NEXT SECOND HAPPEN.', menuBackdrop:stationBackdrop, menuEmblem:(g, x, y, t)=>clock(g,
    x, y, 65, t, false), bonusComplete:NinthComplete,
    persistFlags:['moments', 'route', 'passengers', 'opened', 'pendulumDown', 'choice', 'stable'],
    intro:[
    'It is February 1977. A train is arriving at Harrow Street. In nine seconds, it will arrive again.',
    'Laurie has heard a child counting through the emergency telephone. Eight. Nine. Eight. Nine. Dan has found a machine beneath the tracks that should not be there.',
    'I have come to a place where the future is only nine seconds long. For six people, it is already much too long.'
    ],
    maps:{
      ninth_platform:platform, ninth_train:rescue, ninth_engine:engine
    },
    stages:[
    {
      id:'platform', label:'A station out of time', map:'ninth_platform', checkpoint:true,
      run:function*(ctx){
        yield ctx.dialog([['silkspectre', 'That is the same train. Same windows, same faces. Jon, they have been arriving for forty-three minutes.'],
        ['niteowl', 'Security drones on the platform. The signal box still works, but someone routed the line back into itself.'],
        ['manhattan', 'The station has forgotten how to leave this moment.'], ['silkspectre', 'Then remind it. I will stay with you.']]);
        ready(ctx);
        ctx.objective('Clear the platform · Set the route to SERVICE', ()=>`${ctx.flags.platformFoes.filter(alive).length} drones · ${ctx.flags.route===1?'SERVICE selected':'signal box not set'}`);
        ctx.marker(1690, 955, 'SIGNAL BOX');
        ctx.tutorial('E cycles the signal: choose SERVICE. Amber rails warn before firing. F slows them.',
        16);
        ctx.fork(function*(c){
          yield c.until(()=>c.flags.route===1&&c.flags.platformFoes.every(e=>!alive(e)));
          c.marker(1730, 330, 'SERVICE TUNNEL');
          c.toast('SAFE ROUTE OPEN · CROSS TO THE SERVICE TUNNEL', TEAL);
        });
        yield ctx.until(()=>ctx.flags.enterTrain);
        ctx.objectiveDone();
        yield ctx.dialog([['niteowl', 'Service line selected. The train is no longer coming back here. It is stuck between stations instead.'],
        ['silkspectre', 'That sounds less like good news than you think it does.'], ['niteowl', 'It means we can reach the doors.']]);
      }, restore:ctx=>{
        ctx.flags.route=1;
      }
    },
    {
      id:'rescue', label:'The people between seconds', map:'ninth_train', checkpoint:true,
      run:function*(ctx){
        yield ctx.dialog([['silkspectre', 'Three carriages. I can force the shutters, but not while a drone is looking over my shoulder.'],
        ['niteowl', 'I will cover the platform. Jon, get Laurie to a door and keep the security machines off her.'],
        ['vale', 'Do not break the field. It is the only thing keeping the train from reaching the end of the line.'],
        ['manhattan', 'There are other ways to stop a train.'], ['silkspectre', 'And we will discuss them after these people are out.']]);
        ready(ctx);
        ctx.objective('Open all three carriages · Escort six passengers out', ()=>`${ctx.flags.passengers}/6 safe · ${bits(ctx.flags.opened)}/3 doors open`);
        ctx.marker(600, 727, 'FIRST CARRIAGE');
        ctx.tutorial('E calls Laurie to a carriage. Clear nearby enemies while she opens it. Escort people out.',
        16);
        ctx.fork(function*(c){
          let last=-1;
          while(!c.flags.enterEngine){
            const d=c.flags.doors.find(e=>!e.open);
            const ix=d?d.index:3;
            if(ix!==last){
              last=ix;
              c.marker(d?d.x:2120, d?d.y:1140, d?`CARRIAGE ${ix+1}`:'CLOCK CHAMBER');
            }yield c.wait(.25);
          }
        });
        yield ctx.until(()=>ctx.flags.enterEngine);
        ctx.objectiveDone();
        yield ctx.dialog([['silkspectre', 'Six at the stairs. The little girl got to ten.'], ['niteowl',
        'Mara Vale designed the transit control system. Her prototype is holding this whole tunnel inside a field.'],
        ['vale', 'The brake failed. I gave them nine seconds. Then I could not give them anything after it.'],
        ['manhattan', 'You have been repeating a rescue. Now we must finish it.']]);
      }, restore:ctx=>{
        ctx.flags.passengers=6;
        ctx.flags.opened=7;
      }
    },
    {
      id:'pendulum', label:'The minute engine', map:'ninth_engine', checkpoint:true,
      run:function*(ctx){
        yield ctx.dialog([['niteowl', 'The regulator is shielding itself in a nine-second cycle. It exposes the core for the final three.'],
        ['silkspectre', 'So wait for teal, then hit it. And do not stand where the clock hands are pointing.'],
        ['vale', 'If you can stop the regulator without rupturing the chamber, I can release the field.'],
        ['manhattan', 'I can see every second it is trying not to have.']]);
        ready(ctx);
        ctx.objective('Stop the Pendulum · Strike when the core turns teal');
        ctx.marker(950, 660, 'THE PENDULUM');
        ctx.tutorial('Dodge the clock hands. Strike the open teal core or return a missile. F slows the cycle.',
        17);
        yield ctx.until(()=>ctx.flags.pendulumDown);
        ctx.objectiveDone();
        quiet(ctx);
        yield ctx.dialog([['niteowl', 'Regulator is down. No more reset.'], ['silkspectre', 'The passengers are safe. Mara, come away from the machine.'],
        ['vale', 'There is a record in the field. Every warning they ignored. Every signature. Release it now and the record goes with it.']]);
      }, restore:quiet
    },
    {
      id:'decision', label:'What a moment is worth', checkpoint:true,
      run:function*(ctx){
        quiet(ctx);
        ready(ctx);
        ctx.flags.deciding=true;
        ctx.flags.choice=null;
        ctx.flags.stable=false;
        yield ctx.dialog([['niteowl', 'Blue console releases the loop immediately. Gold tries to save the record first. Laurie and I can take the side controls.'],
        ['silkspectre', 'Your call, Jon. We already saved the people.'], ['manhattan', 'A moment can contain an entire life. It can also contain the reason someone should have listened.']]);
        ctx.objective('Choose: release the loop, or preserve the record');
        ctx.marker(950, 500, 'TWO CONTROL CONSOLES');
        ctx.tutorial('Blue releases the loop. Gold saves the record: hold F in the teal ring. E chooses.',
        16);
        yield ctx.until(()=>!!ctx.flags.choice);
        if(ctx.flags.choice==='preserve'){
          ctx.objective('Hold F inside the teal ring · Preserve the record', ()=>`${Math.round(ctx.flags.anchor.charge/4*100)}% stabilised`);
          ctx.marker(950, 935, 'TEMPORAL ANCHOR');
          ctx.music('ninth_platform');
          yield ctx.dialog([['niteowl', 'I have the left control. Laurie, the other side. Jon, hold the field steady from that ring.'],
          ['silkspectre', 'Do not try to hold it forever. Just long enough.']]);
          ctx.flags.operators=true;
          ctx.flags.owl.x=635;
          ctx.flags.owl.y=555;
          ctx.flags.laurie.x=1265;
          ctx.flags.laurie.y=555;
          yield ctx.until(()=>ctx.flags.stable);
          ctx.flags.operators=false;
          yield ctx.dialog([['niteowl', 'Got it. The warnings, the reports, the signatures. All of it.'],
          ['vale', 'I thought if I could keep the moment from ending, it would not be a mistake.'], ['silkspectre',
          'Come upstairs. You still have to decide what happens next.']]);
        }else{
          yield ctx.dialog([['vale', 'The record is gone.'], ['silkspectre', 'You are not. You can tell them what happened.'],
          ['manhattan', 'We are not obliged to keep every moment. Only to let the next one arrive.']]);
        }
        ctx.objectiveDone();
        ctx.music('ninth_dawn');
      }
    },
    {
      id:'departure', label:'The tenth minute',
      run:function*(ctx){
        ready(ctx);
        ctx.objective('Return to the platform with your companions');
        ctx.marker(340, 1210, 'BACK TO THE CITY');
        ctx.flags.vale.walkTo(340, 1160);
        ctx.flags.vale.body=false;
        yield ctx.until(()=>ctx.flags.departed);
        ctx.objectiveDone();
        ctx.marker(null);
        ctx.lock(true);
        yield ctx.dialog([['niteowl', 'Surface clocks are moving. Dispatch says the line is clear.'],
        ['silkspectre', 'The girl is asking whether she still has to go to school tomorrow. I told her probably.'],
        ['manhattan', 'Above us, a traffic light changes. A cup falls from a table. The city is making new mistakes.'],
        ['silkspectre', 'Good. Let it.']]);
        yield ctx.narrate('The station clock reads 12:10. For the first time tonight, nobody is waiting for it.',
        {
          dur:4
        });
      }
    }
    ]
  });
  DM.NinthMinute={
    chapter, Pendulum, CarriageDoor, Evacuee, SilkSpectre, RouteSwitch, RailArc, LostMoment, Anchor,
    TimeRing
  };
})();
