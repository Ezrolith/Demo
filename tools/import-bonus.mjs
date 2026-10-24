/* One-time, hash-guarded materialisation of the three small existing-file changes.
 * New level/menu/test files are already stored as Git blobs from the supplied source.
 * Removed by the publication commit. Never patches a file with an unexpected hash.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const blob = s => { const b = Buffer.from(s); return createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex'); };
const patches = [
  {path:'src/core/save.js',before:'91bffcfe16a3eced72b9658814bc69ce80db96cd',after:'a562a526afaf60e00646762f12ec9c194e081a8a',changes:[
    ['    checkpointAt(chapterId, stage, carry) {\n','    checkpointAt(chapterId, stage, carry) {\n      if (DM.Chapters.get(chapterId)?.bonus) return DM.Bonus.checkpointAt(chapterId, stage, carry);\n']
  ]},
  {path:'src/game/scenes/play.js',before:'23d57803f9ce91ba10e7342a5949e4c1286b49c0',after:'79eb121e5dd426a636f77c20197b34d0dae6a403',changes:[
    ['for (const id of DM.Chapters.powersBefore(ch.index)) this.player.unlock(id);','for (const id of (ch.startPowers || DM.Chapters.powersBefore(ch.index))) this.player.unlock(id);'],
    ['        Save.data.totals.decoherences++;\n        Save.write();','        if (this.chapter.bonus) DM.Bonus.death();\n        else { Save.data.totals.decoherences++; Save.write(); }'],
    ['    completeChapter() {\n','    completeChapter() {\n      if (this.chapter.bonus) return DM.Bonus.complete(this);\n']
  ]},
  {path:'src/game/scenes/title.js',before:'063384eb3bb5b29b91b4426c8903f3d2455f74fd',after:'b925543fb95a5645eb29245fb3aabde9f9db10ac',changes:[
    ["      items.push({ label: 'SETTINGS', action: () => Engine.push(new Scenes.Settings()) });","      if (DM.Bonus) items.push({ label: 'BONUS LEVELS', action: () => Engine.set(new Scenes.BonusMenu()) });\n      items.push({ label: 'SETTINGS', action: () => Engine.push(new Scenes.Settings()) });"],
    ['this.menu = new TitleMenu(items, { x: 84, y: 340, w: 360, itemH: 50, size: 25 });','this.menu = new TitleMenu(items, { x: 84, y: 330, w: 400, itemH: 44, size: 24 });']
  ]}
];
for (const p of patches) {
  let text = readFileSync(p.path, 'utf8');
  if (blob(text) === p.after) continue;
  if (blob(text) !== p.before) throw new Error(`Unexpected base: ${p.path}`);
  for (const [a,b] of p.changes) {
    if (text.split(a).length !== 2) throw new Error(`Ambiguous patch: ${p.path}`);
    text = text.replace(a,b);
  }
  if (blob(text) !== p.after) throw new Error(`Unexpected result: ${p.path}`);
  writeFileSync(p.path,text);
}
for (const file of ['README.md','HANDOVER.md']) {
  const text = readFileSync(file, 'utf8');
  const note = '\n> **Bonus adventures update — 24 October 2026:** This branch includes The Last Broadcast and The Ninth Minute. Open `dist/dr-manhattan.html` and choose BONUS LEVELS. See [BONUS-README.md](BONUS-README.md), [THE-NINTH-MINUTE.md](THE-NINTH-MINUTE.md) and [CHANGELOG.md](CHANGELOG.md). The original campaign remains unchanged; earlier Story H work is on its separate branch. Older roadmap/status notes below are retained as history.\n';
  const end = text.indexOf('\n');
  writeFileSync(file,text.slice(0,end+1)+note+text.slice(end+1));
}
