import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`verify:package failed: ${message}`);
  process.exit(1);
}

if (!existsSync('release')) fail('run npm run package:local first.');
const dmg = readdirSync('release').find((name) => name.endsWith('.dmg'));
if (!dmg) fail('no DMG found in release/.');
const checksumFile = join('release', `${dmg}.sha256`);
if (!existsSync(checksumFile)) fail('checksum file is missing.');
const checksum = spawnSync('shasum', ['-a', '256', '-c', checksumFile], { encoding: 'utf8' });
if (checksum.status !== 0) fail(checksum.stderr || checksum.stdout || 'checksum mismatch.');

const appPath = ['release/mac-arm64/Unvibe.app', 'release/mac/Unvibe.app'].find(existsSync);
if (!appPath) fail('packaged .app bundle is missing.');
const asar = join(appPath, 'Contents', 'Resources', 'app.asar');
if (!existsSync(asar)) fail('packaged app.asar is missing.');
const strings = spawnSync('strings', [asar], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const bakedBackend = /BAKED_RELEASE_BACKEND = "([^"]+)"/.exec(strings.stdout)?.[1];
if (!bakedBackend) fail('no baked release backend was found in app.asar.');
const backendUrl = new URL(bakedBackend);
if (backendUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(backendUrl.hostname)) {
  fail(`unsafe baked backend: ${backendUrl.origin}.`);
}
const plist = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', join(appPath, 'Contents', 'Info.plist')], { encoding: 'utf8' });
if (plist.stdout.trim() !== 'com.unvibe.app') fail(`unexpected bundle id: ${plist.stdout.trim() || 'missing'}.`);
console.log(checksum.stdout.trim());
console.log(`Package checks passed: artifact, checksum, app bundle, bundle id, and HTTPS backend ${backendUrl.origin}.`);
console.log('Signing and notarization are intentionally not asserted by this unsigned-package check.');
