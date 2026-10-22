/*
 * Build a single, self-contained HTML file: every <script src> listed in
 * index.html is inlined in order. No dependencies; needs only Node 18+.
 *
 *   node tools/build.mjs            ->  dist/dr-manhattan.html
 *
 * The result runs from anywhere (double-click it, email it, host it). Web
 * fonts still load from Google Fonts when online and fall back to system
 * fonts when offline.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

let count = 0;
const built = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  count++;
  const code = readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${src} */\n${code}</script>`;
});

const out = path.join(root, 'dist', 'dr-manhattan.html');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, built);
console.log(`Inlined ${count} scripts -> ${path.relative(root, out)} (${Math.round(built.length / 1024)} KB)`);
