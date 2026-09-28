import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`package:release:win refused: ${message}`);
  process.exit(1);
}

const backend = process.env.UNVIBE_BACKEND?.trim();
const trialToken = process.env.UNVIBE_TRIAL_TOKEN?.trim();
const certificate = process.env.WIN_CSC_LINK?.trim() || process.env.CSC_LINK?.trim();
const certificatePassword = process.env.WIN_CSC_KEY_PASSWORD?.trim() || process.env.CSC_KEY_PASSWORD?.trim();
if (process.env.APP_ENV !== 'production') fail('set APP_ENV=production for a public release.');
if (!backend || !trialToken || trialToken.length < 24) fail('set an approved HTTPS UNVIBE_BACKEND and a long opaque UNVIBE_TRIAL_TOKEN.');
let backendUrl;
try { backendUrl = new URL(backend); } catch { fail('UNVIBE_BACKEND must be an absolute URL.'); }
if (backendUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(backendUrl.hostname)) fail('UNVIBE_BACKEND must be a non-local HTTPS URL.');
if (!certificate || !certificatePassword) fail('configure WIN_CSC_LINK (or CSC_LINK) and its certificate password before a public Windows build.');
if (!existsSync('build/icon.png')) fail('tracked build/icon.png is missing.');

const env = { ...process.env, UNVIBE_BACKEND: backend, UNVIBE_TRIAL_TOKEN: trialToken };
for (const [command, args] of [
  [process.execPath, ['scripts/build.mjs']],
  [join('node_modules', '.bin', 'electron-builder'), ['--win', 'nsis', 'portable', '--x64']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const artifacts = readdirSync('release').filter((name) => name.endsWith('.exe'));
if (artifacts.length === 0) fail('electron-builder completed without a Windows executable.');
for (const artifact of artifacts) {
  const checksum = spawnSync('shasum', ['-a', '256', join('release', artifact)], { encoding: 'utf8' });
  if (checksum.status !== 0) fail(`could not generate SHA-256 checksum for ${artifact}.`);
  writeFileSync(join('release', `${artifact}.sha256`), checksum.stdout, { mode: 0o600 });
}
console.log(`Signed Windows release artifacts prepared for ${backendUrl.origin}. Verify Authenticode on a clean Windows machine before publishing.`);
