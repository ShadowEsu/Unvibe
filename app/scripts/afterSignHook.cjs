// electron-builder afterSign hook. We ship without an Apple Developer
// identity (private beta, no paid signing account yet), so electron-builder
// skips code signing entirely. On Apple Silicon that leaves the app bundle
// with only the linker's automatic per-executable ad-hoc signature, which
// does not cover Contents/Resources — macOS then reports the whole bundle
// as "damaged" because the seal claims resources are present but the
// bundle-level signature never covered them. Deep ad-hoc signing the full
// bundle after packaging fixes that: users still see the normal "unknown
// developer" Gatekeeper prompt (right click, Open), not a damaged/corrupt
// error with no way to proceed.
const { execFileSync } = require('node:child_process');

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
