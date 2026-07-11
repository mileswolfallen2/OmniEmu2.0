const { execSync } = require('child_process');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  console.log(`Ad-hoc signing macOS app at: ${appPath}`);

  try {
    execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: 'inherit' });
    console.log('Ad-hoc signing complete');
  } catch {
    console.warn('Ad-hoc signing failed (may already be signed or codesign unavailable)');
  }
};
