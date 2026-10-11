// macOS: give the app an ad-hoc signature so it runs on Apple Silicon without a paid
// Apple Developer certificate (Gatekeeper still asks once — see README).
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin' || process.platform !== 'darwin') return; // codesign exists only on macOS
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
