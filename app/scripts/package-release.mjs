import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

function fail(message) {
  console.error(`package:release refused: ${message}`);
  process.exit(1);
}

const backend = process.env.UNVIBE_BACKEND?.trim();
const trialToken = process.env.UNVIBE_TRIAL_TOKEN?.trim();
const identity = process.env.CSC_NAME?.trim();
const notaryProfile = process.env.APPLE_NOTARY_PROFILE?.trim();
if (process.env.APP_ENV !== 'production') fail('set APP_ENV=production for a public release.');
if (!backend) fail('set UNVIBE_BACKEND to the approved production HTTPS backend.');
let backendUrl;
try { backendUrl = new URL(backend); } catch { fail('UNVIBE_BACKEND must be an absolute URL.'); }
if (backendUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(backendUrl.hostname)) {
  fail('UNVIBE_BACKEND must be a non-local HTTPS URL.');
}
if (!trialToken || trialToken.length < 24) fail('set a long opaque UNVIBE_TRIAL_TOKEN; never use a provider API key.');
if (!identity?.startsWith('Developer ID Application:')) fail('set CSC_NAME to your Developer ID Application identity.');
if (!notaryProfile) fail('set APPLE_NOTARY_PROFILE to a notarytool keychain profile.');

const identities = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
if (identities.status !== 0 || !identities.stdout.includes(identity)) fail('the requested Developer ID certificate is not installed in this keychain.');
if (!existsSync('build/icon.icns') || !existsSync('build/entitlements.mac.plist')) fail('release signing resources are missing.');

rmSync('release', { recursive: true, force: true });
const env = { ...process.env, UNVIBE_BACKEND: backend, UNVIBE_TRIAL_TOKEN: trialToken, CSC_IDENTITY_AUTO_DISCOVERY: 'true' };
for (const [command, args] of [
  [process.execPath, ['scripts/build.mjs']],
  [join('node_modules', '.bin', 'electron-builder'), [
    '--mac', 'dmg', '--arm64',
    `--config.mac.identity=${identity}`,
    '--config.dmg.sign=true',
    '--config.dmg.artifactName=Unvibe-\${version}-\${arch}.\${ext}',
  ]],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const dmg = readdirSync('release').find((name) => name.endsWith('.dmg'));
if (!dmg) fail('electron-builder completed without a DMG.');
const dmgPath = join('release', dmg);
const submit = spawnSync('xcrun', ['notarytool', 'submit', dmgPath, '--keychain-profile', notaryProfile, '--wait'], { stdio: 'inherit' });
if (submit.status !== 0) fail('Apple rejected or could not notarize the DMG. Read the notary log before retrying.');
for (const args of [['stapler', 'staple', dmgPath], ['stapler', 'validate', dmgPath]]) {
  const result = spawnSync('xcrun', args, { stdio: 'inherit' });
  if (result.status !== 0) fail(`xcrun ${args[0]} failed.`);
}
const assess = spawnSync('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=4', dmgPath], { stdio: 'inherit' });
if (assess.status !== 0) fail('Gatekeeper assessment failed after notarization.');
console.log(`Developer ID signed, notarized, stapled, and Gatekeeper-assessed: ${dmgPath}`);
