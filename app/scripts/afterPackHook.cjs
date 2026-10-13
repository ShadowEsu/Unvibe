// Apple silicon Macs refuse to launch an app whose bundle signature is broken ("Unvibe is
// damaged and can't be opened"). electron-builder renames Electron and edits Info.plist, which
// invalidates Electron's original ad-hoc signature, and without a Developer ID it signs nothing.
// So when no Developer ID is configured, seal the whole bundle with an ad-hoc signature and
// verify it. With a Developer ID, electron-builder signs after this and replaces it.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

module.exports = async function afterPack(context) {
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
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
  console.log(`  • ${identity ? `signed with ${identity}` : 'ad-hoc signed'} and verified  ${appPath}`);
};
