import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * electron-builder afterSign hook (build.afterSign in package.json).
 *
 * Bug: a plain `npm run dist` / `npm run dist:dmg` — the exact command in README's quick
 * start — asks electron-builder to sign under the hardened runtime with no Developer ID
 * identity available. electron-builder falls back to an ad-hoc signature but does not
 * disable library validation, so hardened-runtime + ad-hoc-signed + library-validation-on
 * is a combination macOS kills at launch before the process ever reaches the Dock or menu
 * bar. Nothing visibly happens; there is no crash dialog. `package:local` already worked
 * around this with a manual re-sign step — this hook makes every packaging path (dist,
 * dist:dmg, package:local, package:release) launchable without duplicating that logic.
 *
 * A real Developer ID signature (package:release, CSC_NAME set) does not have this problem
 * and must be left untouched, so this only repairs signatures with no Team Identifier.
 */
export default async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin' || process.platform !== 'darwin') return;

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const info = spawnSync('codesign', ['--display', '--verbose=4', appPath], { encoding: 'utf8' });
  const details = `${info.stdout}\n${info.stderr}`;
  if (/TeamIdentifier=(?!not set)\S+/.test(details)) return; // Developer ID (or other real-identity) — leave it alone.

  const entitlements = 'build/entitlements.local.plist';
  if (!existsSync(entitlements)) {
    throw new Error('after-sign: build/entitlements.local.plist is missing; cannot repair the ad-hoc signature.');
  }

  const sign = spawnSync('codesign', [
    '--force', '--deep', '--options', 'runtime', '--timestamp=none',
    '--entitlements', entitlements, '--sign', '-', appPath,
  ], { stdio: 'inherit' });
  if (sign.status !== 0) throw new Error('after-sign: ad-hoc re-sign failed.');
}
