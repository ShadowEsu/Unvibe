// Two jobs, in this order, before anything is signed or uploaded.
//
// 1. Electron fuses (https://www.electronjs.org/docs/latest/tutorial/fuses) are bits in the
// Electron binary. Unvibe never runs Electron as plain Node, never reads NODE_OPTIONS and never
// takes --inspect, so those three are turned off: left on, any local script could run its own
// code as Unvibe, with Unvibe's Accessibility permission. They are flipped before signing so the
// signature covers them, on Mac and Windows, and read back: a build with any of them still on
// throws here and is never signed or shipped.
//
// 2. Apple silicon Macs refuse to launch an app whose bundle signature is broken ("Unvibe is
// damaged and can't be opened"). electron-builder renames Electron and edits Info.plist, which
// invalidates Electron's original ad-hoc signature, and without a Developer ID it signs nothing.
// So when no Developer ID is configured, seal the whole bundle with an ad-hoc signature and
// verify it. With a Developer ID, electron-builder signs after this and replaces it.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Same value as MAC_SIGNING_REQUIREMENT in src/main/updater.ts; test/updaterVerify.test.ts pins both.
const MAC_SIGNING_REQUIREMENT =
  'identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"';

const DISABLED_FUSES = ['RunAsNode', 'EnableNodeOptionsEnvironmentVariable', 'EnableNodeCliInspectArguments'];

async function disableNodeFuses(context) {
  // @electron/fuses is ESM-only, so a CommonJS hook imports it.
  const { flipFuses, getCurrentFuseWire, FuseVersion, FuseV1Options, FuseState } = await import('@electron/fuses');
  const name = context.packager.appInfo.productFilename;
  const platform = context.electronPlatformName;
  if (platform !== 'darwin' && platform !== 'win32') throw new Error(`No fuse settings for ${platform} builds.`);
  const electron = path.join(context.appOutDir, platform === 'darwin' ? `${name}.app` : `${name}.exe`);
  const config = { version: FuseVersion.V1 };
  for (const fuse of DISABLED_FUSES) config[FuseV1Options[fuse]] = false;
  await flipFuses(electron, config);
  const wire = await getCurrentFuseWire(electron);
  const stillOn = DISABLED_FUSES.filter((fuse) => wire[FuseV1Options[fuse]] !== FuseState.DISABLE);
  if (stillOn.length) throw new Error(`Electron fuses still on in ${electron}: ${stillOn.join(', ')}`);
  console.log(`  • fuses off (${DISABLED_FUSES.join(', ')})  ${electron}`);
}

module.exports = async function afterPack(context) {
  await disableNodeFuses(context);
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME?.startsWith('Developer ID Application:')) return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const entitlements = path.join(context.packager.info?.projectDir ?? context.packager.projectDir ?? process.cwd(), 'build', 'entitlements.mac.plist');
  // A stable self-signed identity (set up by the release workflow) keeps the same signature
  // across versions, so macOS keeps Accessibility and keychain access after updates.
  const identity = process.env.UNVIBE_SIGN_IDENTITY;
  const keychain = process.env.UNVIBE_SIGN_KEYCHAIN;
  const sign = identity ? identity : '-';
  const args = ['--force', '--deep', '--sign', sign, '--entitlements', entitlements];
  if (identity) args.push('--options', 'runtime', '--timestamp=none');
  if (identity && keychain) args.push('--keychain', keychain);
  execFileSync('codesign', [...args, appPath], { stdio: 'inherit' });
  // With the stable identity, check the requirement the app's updater and install.sh pin, so a
  // build they would refuse fails here, before anything is uploaded.
  const verify = ['--verify', '--deep', '--strict', '--verbose=2'];
  if (identity) verify.push(`-R=${MAC_SIGNING_REQUIREMENT}`);
  execFileSync('codesign', [...verify, appPath], { stdio: 'inherit' });
  console.log(`  • ${identity ? `signed with ${identity}` : 'ad-hoc signed'} and verified  ${appPath}`);
};
