import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`package:beta:win refused: ${message}`);
  process.exit(1);
}

const backend = process.env.UNVIBE_BACKEND?.trim();
const trialToken = process.env.UNVIBE_TRIAL_TOKEN?.trim();
if (process.env.APP_ENV !== 'beta') fail('set APP_ENV=beta.');
if (!backend || !trialToken || trialToken.length < 24) fail('set an approved HTTPS UNVIBE_BACKEND and a long opaque UNVIBE_TRIAL_TOKEN.');
let url;
try { url = new URL(backend); } catch { fail('UNVIBE_BACKEND must be an absolute URL.'); }
if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) fail('UNVIBE_BACKEND must be a non-local HTTPS URL.');
if (!existsSync('build/icon.png')) fail('tracked build/icon.png is missing.');

const env = { ...process.env, UNVIBE_BACKEND: backend, UNVIBE_TRIAL_TOKEN: trialToken, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
for (const [command, args] of [
  [process.execPath, ['scripts/build.mjs']],
  [join('node_modules', '.bin', 'electron-builder'), ['--win', 'portable', '--x64']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const artifact = readdirSync('release').find((name) => name.endsWith('.exe'));
if (!artifact) fail('electron-builder completed without a Windows executable.');
const checksum = spawnSync('shasum', ['-a', '256', join('release', artifact)], { encoding: 'utf8' });
if (checksum.status !== 0) fail('could not generate SHA-256 checksum.');
writeFileSync(join('release', `${artifact}.sha256`), checksum.stdout, { mode: 0o600 });
console.log(`Private-beta Windows package: release/${artifact}`);
