/* Ten complete tracking-suite runs per build, never concurrent. Each child has
 * a fresh browser context and its own evidence directory, including the full
 * storage-fault and UI sequence preceding the real reload assertion.
 * node tests/glass-palace-reload.mjs [index.html|dist/dr-manhattan.html]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chosen = process.argv.find(value => value.endsWith('.html'));
const targets = chosen ? [chosen] : ['index.html', 'dist/dr-manhattan.html'];
if (targets.some(value => !['index.html', 'dist/dr-manhattan.html'].includes(value)))
  throw new Error('Choose index.html or dist/dr-manhattan.html.');
const engine = process.env.QA_BROWSER || 'chromium';
const label = new Date().toISOString().replaceAll(/[:.]/g, '-');
const out = path.join(root, 'tests/out/glass-palace-reload', engine, label);
mkdirSync(out, { recursive: true });
const digest = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const testSha256 = digest('tests/glass-palace-tracking.mjs');
const report = {
  startedAtUtc: new Date().toISOString(),
  engine,
  targets,
  runsPerBuild: 10,
  testSha256,
  standaloneSha256: digest('dist/dr-manhattan.html'),
  method: 'One full tracking-suite child at a time, fresh browser per child, actual process exits and unique evidence paths.',
  runs: [],
};
const save = () => writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
save();
for (const target of targets) {
  const build = target.startsWith('dist/') ? 'standalone' : 'source';
  for (let run = 1; run <= 10; run++) {
    const directory = path.join(out, build, 'run-' + String(run).padStart(2, '0'));
    mkdirSync(directory, { recursive: true });
    const log = path.join(directory, 'process.log');
    const fd = openSync(log, 'w');
    const started = Date.now();
    const child = spawnSync(process.execPath, ['tests/glass-palace-tracking.mjs', target], {
      cwd: root,
      env: { ...process.env, TRACKING_OUT: directory },
      stdio: ['ignore', fd, fd],
    });
    closeSync(fd);
    const lines = readFileSync(log, 'utf8').trimEnd().split('\n');
    const result = {
      target,
      build,
      run,
      exitCode: child.status ?? -1,
      signal: child.signal,
      error: child.error ? String(child.error) : null,
      seconds: (Date.now() - started) / 1000,
      finalLine: lines.at(-1) || '',
      evidence: path.relative(root, directory),
    };
    report.runs.push(result);
    save();
    console.log(`${build} run=${run}/10 exit=${result.exitCode} | ${result.finalLine}`);
  }
}
if (testSha256 !== digest('tests/glass-palace-tracking.mjs')) throw new Error('The tracking test changed during stress verification.');
report.finishedAtUtc = new Date().toISOString();
report.passed = report.runs.length === targets.length * 10 && report.runs.every(row => row.exitCode === 0);
save();
console.log(`GLASS PALACE RELOAD ${report.passed ? 'PASSED' : 'FAILED'}: ${report.runs.filter(row => row.exitCode === 0).length}` +
  ` / ${report.runs.length} full tracking-suite runs; evidence ${path.relative(root, out)}.`);
if (!report.passed) process.exitCode = 1;
