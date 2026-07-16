import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (process.env.APP_ENV === 'production') throw new Error('verify:beta refuses APP_ENV=production.');
mkdirSync(resolve(root, '.release'), { recursive: true });
const checks = [
  ['repository safety', 'node', ['scripts/repository-safety-check.mjs'], '.'],
  ['desktop typecheck/test/build', 'npm', ['run', 'typecheck'], 'app'],
  ['desktop tests', 'npm', ['test'], 'app'],
  ['desktop build', 'npm', ['run', 'build'], 'app'],
  ['backend typecheck', 'npm', ['run', 'typecheck'], 'web'],
  ['backend tests', 'npm', ['test'], 'web'],
  ['backend build', 'npm', ['run', 'build'], 'web'],
  ['extension typecheck', 'npm', ['run', 'typecheck'], 'extension'],
  ['extension tests', 'npm', ['test'], 'extension'],
  ['extension build', 'npm', ['run', 'build'], 'extension'],
  ['legacy server typecheck', 'npm', ['run', 'typecheck'], 'server'],
  ['marketing typecheck', 'npm', ['run', 'typecheck'], 'marketing'],
  ['marketing tests', 'npm', ['test'], 'marketing'],
  ['marketing build', 'npm', ['run', 'build'], 'marketing'],
  ...['app', 'web', 'extension', 'server', 'marketing'].map((workspace) => [`${workspace} dependency audit`, 'node', ['scripts/audit-check.mjs', workspace], '.']),
  ['local API smoke', 'node', ['scripts/local-api-smoke.mjs'], '.'],
  ['unsigned staging package', 'npm', ['run', 'package:local'], 'app', { APP_ENV: 'staging', UNVIBE_BACKEND: 'https://staging.example.test' }],
  ['package verification', 'npm', ['run', 'verify:package'], 'app'],
];
const results = [];
let failed = false;
for (const [name, command, args, cwd, extraEnv = {}] of checks) {
  const started = Date.now();
  console.log(`\n[verify:beta] ${name}`);
  const result = spawnSync(command, args, {
    cwd: resolve(root, cwd), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnv, ANTHROPIC_API_KEY: '', STRIPE_SECRET_KEY: '' },
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  const item = { name, ok: result.status === 0, elapsedMs: Date.now() - started, exitCode: result.status };
  results.push(item);
  if (!item.ok) { failed = true; break; }
}
const report = { generatedAt: new Date().toISOString(), branch: 'codex/beta-core', productionContacted: false, ok: !failed, results };
writeFileSync(resolve(root, '.release/verify-beta.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = ['# Beta verification', '', `Generated: ${report.generatedAt}`, '', `Result: **${report.ok ? 'PASS' : 'FAIL'}**`, '', '| Check | Result | Time |', '| --- | --- | ---: |', ...results.map((item) => `| ${item.name} | ${item.ok ? 'PASS' : 'FAIL'} | ${(item.elapsedMs / 1000).toFixed(2)} s |`), '', 'No production endpoint, paid AI provider, billing system, Apple credential, or signing identity was used.', ''].join('\n');
writeFileSync(resolve(root, '.release/verify-beta.md'), markdown);
console.log(`\nReports: .release/verify-beta.json and .release/verify-beta.md`);
if (failed) process.exit(1);
