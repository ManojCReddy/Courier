const path = require('path');

// electron-builder's own icon step needs symlink rights Windows may not grant, so stamp the exe directly.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const { rcedit } = await import('rcedit');
  const { productFilename, version } = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);

  await rcedit(exePath, {
    icon: path.join(context.packager.projectDir, 'assets', 'courier-icon.ico'),
    'file-version': version,
    'product-version': version,
    'version-string': {
      ProductName: 'Courier',
      FileDescription: 'Courier',
      OriginalFilename: `${productFilename}.exe`,
    },
  });
};
