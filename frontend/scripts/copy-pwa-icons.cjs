#!/usr/bin/env node
/** Копирует иконки для PWA из src-tauri/icons в public */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const tauriIcons = path.join(root, 'src-tauri', 'icons');
const publicIcons = path.join(root, 'public', 'icons');
const publicDir = path.join(root, 'public');

fs.mkdirSync(publicIcons, { recursive: true });

const copies = [
  [path.join(tauriIcons, '128x128.png'), path.join(publicIcons, 'icon-192.png')],
  [path.join(tauriIcons, 'icon.png'), path.join(publicIcons, 'icon-512.png')],
  [path.join(tauriIcons, 'ios', 'AppIcon-60x60@3x.png'), path.join(publicDir, 'apple-touch-icon.png')],
  [path.join(root, 'OS_LOGO.png'), path.join(publicDir, 'OS_LOGO.png')],
];

for (const [src, dest] of copies) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Copied:', path.basename(src), '->', path.relative(root, dest));
  } else {
    console.warn('Source not found:', src);
  }
}
