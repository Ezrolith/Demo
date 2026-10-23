/* A disposable, save-isolated review build. Run tools/build.mjs first.
 * This adds only a scene chooser; the production game is not modified. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'dist/dr-manhattan.html');
const marker = '<script>/* src/main.js */';
let html = readFileSync(source, 'utf8');
if (!html.includes(marker)) throw new Error('Build marker missing; rebuild the game first.');
const preview = `
<style>
#story-chooser{position:fixed;inset:0;z-index:20;background:rgba(3,8,17,.96);display:grid;place-items:center;padding:24px;overflow:auto;font:16px/1.5 system-ui,sans-serif;color:#e6f6ff}
#story-chooser[hidden]{display:none}#story-chooser section{max-width:850px;width:100%}#story-chooser h1{font-size:clamp(32px,5vw,56px);line-height:1.08;margin:12px 0 20px;letter-spacing:-.04em}
#story-chooser .eyebrow{letter-spacing:.24em;color:#74d7f3;font-size:12px}#story-chooser p{color:#9fb5c7;max-width:670px}#story-chooser .choices{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:28px 0 20px}
#story-chooser button{border:1px solid #28465a;background:#0b1b2b;color:#e6f6ff;border-radius:12px;padding:20px;text-align:left;cursor:pointer;font:inherit}#story-chooser button:hover,#story-chooser button:focus-visible{border-color:#6de0ff;background:#123049;outline:2px solid #6de0ff;outline-offset:2px}
#story-chooser button:disabled{opacity:.4;cursor:wait}#story-chooser button b{display:block;font-size:19px;margin-bottom:8px}#story-chooser button span{font-size:13px;color:#b2c8d7}#story-chooser .endings{display:flex;gap:10px;flex-wrap:wrap}#story-chooser .endings button{padding:10px 16px}
#story-chooser footer{border-top:1px solid #253849;margin-top:26px;padding-top:16px;color:#9fb5c7;font-size:13px}#preview-open{position:fixed;z-index:21;left:12px;bottom:10px;padding:9px 12px;border:1px solid #456579;border-radius:7px;background:#08131eed;color:#d5f4ff;font:12px system-ui;cursor:pointer}#preview-open[hidden]{display:none}
@media(max-width:650px){#story-chooser .choices{grid-template-columns:1fr}#story-chooser{place-items:start center}#story-chooser button{padding:12px}}
</style>
<div id="story-chooser" role="dialog" aria-modal="true" aria-labelledby="preview-title">
<section><div class="eyebrow">THE WATCHMAKER'S SON · STORY UPDATE PREVIEW</div>
<h1 id="preview-title">See what changed.<br>Make a different choice.</h1>
<p>Jump straight to the new story moments. This preview does not read or change your saved game. Use a keyboard and mouse; touch gameplay is not supported yet.</p>
<div class="choices">
<button type="button" data-sample="pier" disabled><b>01 · Pier 9 raid</b><span>Protect the officers, stop the presses and chase Moloch.</span></button>
<button type="button" data-sample="getaway" disabled><b>02 · The getaway</b><span>Catch the car, disintegrate it, or let the driver escape.</span></button>
<button type="button" data-sample="lockdown" disabled><b>03 · Sixteen seconds</b><span>Try the intercom and override. Choose to hold Janey's watch.</span></button>
</div><p>Compare the consequences:</p><div class="endings">
<button type="button" data-sample="gentle" disabled>Gentle ending</button><button type="button" data-sample="mixed" disabled>Mixed ending</button><button type="button" data-sample="detached" disabled>Detached ending</button>
</div><footer>WASD / arrows: move · E: interact · Hold C / left click: lift; release slowly: set down · Q: disintegrate.<br><span id="preview-status">Preparing scenes…</span></footer></section></div>
<button id="preview-open" type="button" hidden>STORY PREVIEW · Choose scene</button>
<script>
(function(){
  'use strict';
  const D=window.DM, chooser=document.getElementById('story-chooser'), open=document.getElementById('preview-open');
  // Install BEFORE main.js boots: no production save reads or writes, even on reset.
  D.Save.load=function(){ this.data=this.defaults(); this.data.settings.focusPause=false; return this.data; };
  D.Save.write=function(){};
  const buttons=[...chooser.querySelectorAll('[data-sample]')];
  chooser.addEventListener('keydown',e=>e.stopPropagation());
  open.addEventListener('keydown',e=>e.stopPropagation());
  function reset(){ D.Input.clearAll();D.Save.load();D.Engine.fade.dir=0;D.Engine.fade.a=0;D.Engine.fade.cb=null; }
  function start(name){
    reset();D.Audio.unlock();
    const targets={pier:['superman','yard'],getaway:['superman','getaway'],lockdown:['prologue','accident']};
    if(targets[name]){
      const [ch,id]=targets[name];const stage=D.Chapters.get(ch).stages.findIndex(s=>s.id===id);
      D.dev.start(ch,stage);
    }else{
      const counts={gentle:[0,12],mixed:[5,7],detached:[12,0]};const [k,s]=counts[name];
      D.Save.data.completed.superman={disintegrated:k,spared:s,memories:0,time:180,flags:{heldWatch:true,pressesDown:2,molochArrested:k===0,molochGone:k>0}};
      D.Engine.set(new D.Scenes.Ending());
    }
    chooser.hidden=true;open.hidden=false;D.Engine.canvas.focus({preventScroll:true});
  }
  buttons.forEach(b=>b.addEventListener('click',()=>start(b.dataset.sample)));
  open.addEventListener('click',()=>{D.Input.clearAll();D.Engine.push({opaque:false,update(){},render(){}});chooser.hidden=false;open.hidden=true;buttons[0].focus();});
  function ready(){
    if(!D.dev){requestAnimationFrame(ready);return;}
    buttons.forEach(b=>b.disabled=false);document.getElementById('preview-status').textContent='Preview progress is temporary. Choose scene to try another outcome.';
    buttons[0].focus();
  }
  ready();
})();
</script>
`;
html = html.replace(marker, preview + marker).replace('<title>Dr. Manhattan</title>', '<title>Dr. Manhattan · Story Update Preview</title>');
const out = path.join(root, 'dist/story-preview.html');
writeFileSync(out, html);
console.log('Built save-isolated preview -> ' + path.relative(root, out));
