// Production packaging must preserve the Developer ID signature that
// electron-builder applies. Earlier beta code deep-signed with "-" here,
// which silently replaced a valid Developer ID signature with an ad-hoc one.
const { execFileSync } = require('node:child_process');

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const identity = process.env.CSC_NAME?.trim();
  // Local/test builds are deliberately ad-hoc-signed later by package-local.
  if (!identity?.startsWith('Developer ID Application:')) return;

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
  const details = execFileSync('codesign', ['--display', '--verbose=4', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!details.includes(identity)) {
    throw new Error('The packaged app is not signed by the requested Developer ID identity.');
  }
};
