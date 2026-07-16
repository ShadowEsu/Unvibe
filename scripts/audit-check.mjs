import { spawnSync } from 'node:child_process';

const cwd = process.argv[2];
if (!cwd) throw new Error('Usage: node scripts/audit-check.mjs <workspace>');
const allowedSources = new Set([
  1102341,
  1109842, 1112593, 1112653, 1114897, 1114940, 1116376, 1117015, 1117931,
  1118942, 1118944, 1118946, 1118948, 1118952, 1118954, 1118958, 1118962,
  1112659, 1113300, 1113375, 1114200, 1114302, 1114680,
  1116041, 1116045, 1116049, 1116053, 1116057, 1116060, 1116064, 1116068,
  1116072, 1116076, 1116084, 1116088, 1116092, 1116111, 1116259, 1116320,
  1117459, 1120680, 1120782,
]);
const result = spawnSync('npm', ['audit', '--json'], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
let report;
try { report = JSON.parse(result.stdout); } catch { throw new Error(`${cwd}: npm audit did not return JSON.`); }
const unexpected = [];
const acknowledged = [];
for (const [dependency, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via !== 'object') continue;
    const entry = { dependency, source: via.source, severity: via.severity, title: via.title };
    if (!allowedSources.has(via.source) || via.severity === 'critical') unexpected.push(entry);
    else acknowledged.push(entry);
  }
}
if (unexpected.length) {
  console.error(JSON.stringify({ workspace: cwd, unexpected }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ workspace: cwd, ok: true, acknowledged, counts: report.metadata?.vulnerabilities ?? {} }, null, 2));
