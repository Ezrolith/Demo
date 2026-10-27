/* Run the requested eighteen suites sequentially and retain real exits/logs. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || 'index.html';
if (!['index.html', 'dist/dr-manhattan.html'].includes(target)) {
  throw new Error('Choose index.html or dist/dr-manhattan.html.');
}
const build = target.startsWith('dist/') ? 'standalone' : 'source';
const out = path.join(root, 'tests/out/glass-palace/final-' + build);
mkdirSync(out, { recursive: true });
const suites = [
  'smoke', 'visual', 'audio', 'powers', 'saves', 'settings', 'ledger',
  'encounters', 'flows', 'bonus', 'ninth-minute', 'long-summer',
  'vigilantes', 'after-midnight-cases', 'after-midnight-modes',
  'after-midnight-integration', 'surveyor-gear', 'glass-palace',
];
const digest = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const scripts = [...readFileSync(path.join(root, 'index.html'), 'utf8')
  .matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
const sourceHash = createHash('sha256');
for (const file of scripts) sourceHash.update(file + '\0' + readFileSync(path.join(root, file)));
const report = {
  startedAtUtc: new Date().toISOString(),
  target,
  method: 'One child process at a time; stdout/stderr retained together; real process exit codes.',
  sourceScriptsSha256: sourceHash.digest('hex'),
  standaloneSha256: digest('dist/dr-manhattan.html'),
  suites: [],
};
const save = () => writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
save();
for (const suite of suites) {
  const log = path.join(out, suite + '.log');
  const fd = openSync(log, 'w');
  const started = Date.now();
  const outcome = await new Promise(resolve => {
    const child = spawn(process.execPath, ['tests/' + suite + '.mjs', target], {
      cwd: root,
      env: process.env,
      stdio: ['ignore', fd, fd],
    });
    child.once('error', error => resolve({ code: -1, error: String(error) }));
    child.once('close', (code, signal) => resolve({ code: code ?? -1, signal }));
  });
  closeSync(fd);
  const lines = readFileSync(log, 'utf8').trimEnd().split('\n');
  const result = {
    suite,
    exitCode: outcome.code,
    signal: outcome.signal || null,
    error: outcome.error || null,
    seconds: +((Date.now() - started) / 1000).toFixed(2),
    finalLine: lines.at(-1) || '',
    log: path.relative(root, log),
  };
  report.suites.push(result);
  save();
  console.log(`${build}-${suite} exit=${result.exitCode} | ${result.finalLine}`);
}
report.finishedAtUtc = new Date().toISOString();
report.passed = report.suites.length === 18 && report.suites.every(result => result.exitCode === 0);
save();
console.log(`GLASS PALACE ${build.toUpperCase()} ${report.passed ? 'PASSED' : 'FAILED'}: 18 suites.`);
if (!report.passed) process.exitCode = 1;
