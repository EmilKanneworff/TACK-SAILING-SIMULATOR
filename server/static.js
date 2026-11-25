'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gzip } = require('node:zlib');
const { stampHtml } = require('./revision');

const root = path.resolve(__dirname, '..', process.env.FRONTEND_DIR || '.');
const port = Number(process.env.FRONTEND_PORT || 5173);
const built = Boolean(process.env.FRONTEND_DIR);
const types = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

http.createServer((req, res) => {
  let name;
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    name = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  } catch {
    return res.writeHead(400).end();
  }
  const file = path.resolve(root, name);
  const versioned = /^releases\/[a-f0-9]{12}\/assets\//.test(name);
  if (!file.startsWith(root + path.sep) || !(name === 'index.html' || name.startsWith('assets/') || versioned)) return res.writeHead(404).end();

  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    const headers = { 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' :
      built ? 'no-cache' : 'no-store',
      'Content-Type': types[path.extname(file)] || 'application/octet-stream' };
    let body = bytes;
    if (name === 'index.html') {
      const existing = built && bytes.toString().match(/<meta name="fri-vind-revision" content="([a-f0-9]{12})">/);
      const { html, revision } = existing ? { html: bytes, revision: existing[1] } : stampHtml(bytes, root);
      headers['X-Fri-Vind-Revision'] = revision;
      body = html;
    }
    if (!built) return res.writeHead(200, headers).end(body);
    headers.ETag = 'W/"' + createHash('sha256').update(body).digest('hex').slice(0, 24) + '"';
    headers.Vary = 'Accept-Encoding';
    if (req.headers['if-none-match'] === headers.ETag) return res.writeHead(304, headers).end();
    if (req.method === 'HEAD') return res.writeHead(200, headers).end();
    if (/^(text\/|application\/javascript)/.test(headers['Content-Type']) &&
        /(?:^|,\s*)gzip\s*(?:,|$)/i.test(req.headers['accept-encoding'] || '')) {
      return gzip(body, (error, compressed) => {
        if (error) return res.writeHead(200, headers).end(body);
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(200, headers).end(compressed);
      });
    }
    res.writeHead(200, headers).end(body);
  });
}).listen(port, () => console.log(`TACK http://localhost:${port} → ${root}`));
