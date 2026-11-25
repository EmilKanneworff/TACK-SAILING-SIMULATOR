'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { stampHtml } = require('./revision');
const { bakeFields } = require('./bake-fields');

const root = path.resolve(__dirname, '..');
const dist = path.resolve(root, process.env.TACK_BUILD_DIR || 'dist');
const assets = path.join(dist, 'assets');
const realtime = (process.env.VITE_REALTIME_URL || '').trim();
if (realtime) {
  const url = new URL(realtime);
  if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
    throw Error('VITE_REALTIME_URL must be a public wss:// URL.');
  }
}

if (process.env.TACK_BUILD_DIR) fs.mkdirSync(dist);
else {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
}
fs.cpSync(path.join(root, 'assets'), assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'config.js'), 'window.FRI_VIND_REALTIME_URL=' + JSON.stringify(realtime) + ';\n');
const fields = bakeFields();
fs.writeFileSync(path.join(assets, 'archipelago-fields.bin'), fields.packed);
fs.writeFileSync(path.join(assets, 'archipelago-fields.js'), fields.loader);
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(
  '<!-- TACK_ARCHIPELAGO_FIELDS -->', '<script>globalThis.TackRequireArchipelagoFields=true;</script>\n<script src="assets/archipelago-fields.js"></script>');
const { html, revision } = stampHtml(source, dist);

// Keep legacy asset URLs for open tabs and the two standalone chart pages.
// The game entry point and its worker stay within the same immutable release.
const release = 'releases/' + revision + '/assets/';
fs.cpSync(assets, path.join(dist, release), { recursive: true });
const entry = html.replace(/\b(src|href)="assets\/([^"]+)"/g, (match, attr, file) =>
  file.endsWith('.html') ? match : attr + '="' + release + file + '"');
fs.writeFileSync(path.join(dist, 'index.html'), entry);
console.log('Frontend built in ' + path.relative(root, dist) + '/ · ' + revision);
