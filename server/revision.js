'use strict';

const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

function stampHtml(html, root) {
  const marker = '<!-- FRI_VIND_REVISION -->';
  const source = html.toString('utf8').replace(/<meta name="fri-vind-revision" content="[a-f0-9]{12}">/, marker);
  const hash = createHash('sha256');
  hash.update(source);
  function hashAssets(relative) {
    const dir = path.join(root, relative);
    for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const asset = path.join(relative, item.name);
      if (item.isDirectory()) hashAssets(asset);
      if (item.isFile()) hash.update(asset).update('\0').update(readFileSync(path.join(root, asset))).update('\0');
    }
  }
  hashAssets('assets');
  const revision = hash.digest('hex').slice(0, 12);
  return { revision, html: source.replace(marker, `<meta name="fri-vind-revision" content="${revision}">`) };
}

module.exports = { stampHtml };
