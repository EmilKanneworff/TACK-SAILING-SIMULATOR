'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { stampHtml } = require('./revision');

const root = path.resolve(__dirname, '..', process.env.FRONTEND_DIR || '.');
const port = Number(process.env.FRONTEND_PORT || 5173);
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
  if (!file.startsWith(root + path.sep) || !(name === 'index.html' || name.startsWith('assets/'))) return res.writeHead(404).end();

  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': types[path.extname(file)] || 'application/octet-stream' };
    let body = bytes;
    if (name === 'index.html') {
      const { html, revision } = stampHtml(bytes, root);
      headers['X-Fri-Vind-Revision'] = revision;
      body = html;
    }
    res.writeHead(200, headers).end(body);
  });
}).listen(port, () => console.log(`TACK http://localhost:${port} → ${root}`));
