import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function fail(message) {
  console.error(`package:local refused: ${message}`);
  process.exit(1);
}

const appEnv = process.env.APP_ENV?.trim();
const backend = process.env.UNVIBE_BACKEND?.trim();
const trialToken = process.env.UNVIBE_TRIAL_TOKEN?.trim();
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const channel = appEnv === 'beta' ? '-beta' : '';
const betaZipName = 'Unvibe Private Beta v0.1.0.zip';
if (appEnv !== 'staging' && appEnv !== 'beta') fail('set APP_ENV=staging or APP_ENV=beta (production packaging is intentionally excluded).');
if (!backend) fail('set UNVIBE_BACKEND to the approved HTTPS staging backend.');
if (!trialToken || trialToken.length < 24) fail('set UNVIBE_TRIAL_TOKEN to a long opaque trial secret (not a provider API key).');
let url;
try { url = new URL(backend); } catch { fail('UNVIBE_BACKEND must be an absolute URL.'); }
if (url.protocol !== 'https:') fail('UNVIBE_BACKEND must use HTTPS.');
if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) fail('development backends cannot be embedded in a package.');
if (!existsSync('build/icon.icns')) fail('tracked build/icon.icns is missing.');
if (!existsSync('build/entitlements.local.plist')) fail('local hardened-runtime entitlements are missing.');

rmSync('release', { recursive: true, force: true });
const toolDirectory = mkdtempSync(join(tmpdir(), 'unvibe-package-'));
const discoveredPython = spawnSync('which', ['python3'], { encoding: 'utf8' }).stdout.trim();
const python = ['/usr/bin/python3', discoveredPython].find((candidate) => {
  if (!candidate || !existsSync(candidate)) return false;
  return spawnSync(candidate, ['-c', 'import plistlib, xml.parsers.expat']).status === 0;
});
if (!python) fail('a working python3 with plistlib/expat is required to create an APFS DMG.');
const pythonShim = join(toolDirectory, 'python');
writeFileSync(pythonShim, `#!/bin/sh\nexec "${python}" "$@"\n`);
chmodSync(pythonShim, 0o700);
try {
  for (const [command, args] of [
    [process.execPath, ['scripts/build.mjs']],
    [join('node_modules', '.bin', 'electron-builder'), ['--mac', 'dir', '--arm64']],
  ]) {
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        PATH: `${toolDirectory}:${process.env.PATH ?? ''}`,
        UNVIBE_BACKEND: backend,
        UNVIBE_TRIAL_TOKEN: trialToken,
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      },
    });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
    if (process.exitCode) break;
  }

  // electron-builder intentionally skips signing when identity is null. Re-sign the
  // local tester bundle ad hoc so macOS can verify its sealed resources. This is
  // not a substitute for Developer ID signing or Apple notarization.
  if (!process.exitCode) {
    const appPath = join('release', 'mac-arm64', 'Unvibe.app');
    const sign = spawnSync('codesign', [
      '--force', '--deep', '--options', 'runtime', '--timestamp=none',
      '--entitlements', join('build', 'entitlements.local.plist'), '--sign', '-', appPath,
    ], { stdio: 'inherit' });
    if (sign.status !== 0) process.exitCode = sign.status ?? 1;
  }

  if (!process.exitCode) {
    const result = spawnSync(process.execPath, [
      'scripts/create-custom-dmg.mjs',
      join('release', 'mac-arm64', 'Unvibe.app'),
      join('release', `Unvibe-${version}${channel}-arm64-unsigned.dmg`),
      join('build', 'dmg-background.png'),
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PATH: `${toolDirectory}:${process.env.PATH ?? ''}`,
        UNVIBE_BACKEND: backend,
        UNVIBE_TRIAL_TOKEN: trialToken,
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      },
    });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  }

  // Private-beta distribution channels sometimes accept ZIP files but not DMGs.
  // This archives the exact app bundle that was just integrity-sealed above.
  if (!process.exitCode && appEnv === 'beta') {
    const result = spawnSync('ditto', [
      '-c', '-k', '--sequesterRsrc', '--keepParent',
      join('release', 'mac-arm64', 'Unvibe.app'),
      join('release', betaZipName),
    ], { stdio: 'inherit' });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  }
} finally {
  rmSync(toolDirectory, { recursive: true, force: true });
}
if (process.exitCode) process.exit(process.exitCode);

const artifact = readdirSync('release').find((name) => name.endsWith('.dmg'));
if (!artifact) fail('electron-builder completed without a DMG artifact.');
const checksum = spawnSync('shasum', ['-a', '256', join('release', artifact)], { encoding: 'utf8' });
if (checksum.status !== 0) fail('could not generate SHA-256 checksum.');
writeFileSync(join('release', `${artifact}.sha256`), checksum.stdout, { mode: 0o600 });
if (appEnv === 'beta') {
  const betaZip = readdirSync('release').find((name) => name === betaZipName);
  if (!betaZip) fail('private-beta ZIP artifact is missing.');
  const zipChecksum = spawnSync('shasum', ['-a', '256', join('release', betaZip)], { encoding: 'utf8' });
  if (zipChecksum.status !== 0) fail('could not generate private-beta ZIP checksum.');
  writeFileSync(join('release', `${betaZip}.sha256`), zipChecksum.stdout, { mode: 0o600 });
}
console.log(`Ad-hoc-signed ${appEnv} package: release/${artifact}`);
console.log(`Checksum: release/${artifact}.sha256`);
