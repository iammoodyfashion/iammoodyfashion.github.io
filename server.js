'use strict';
// Zero-dependency Node server for the IAmMoody site (and the content review tools).
//   node server.js            -> http://localhost:3000
//   PORT=8080 node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const D = require('./lib/data');
const R = require('./lib/render');
const RV = require('./lib/review-data');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // local only: the review API has no auth
const PUBLIC = path.join(D.ROOT, 'public');
const REVIEW = path.join(D.ROOT, 'review');
const LIVE_UPLOADS = 'https://www.iammoody.com/wp-content/uploads/';
const MEDIA_FALLBACK = process.env.MEDIA_FALLBACK !== 'off'; // missing local file -> old live site

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': TYPES['.json'] });

/** Serve a file from `base`, refusing anything that resolves outside it. Returns false if not found. */
function serveFile(req, res, base, rel, extra = {}) {
  const file = path.resolve(base, '.' + path.sep + rel);
  if (file !== base && !file.startsWith(base + path.sep)) { send(res, 403, 'Forbidden'); return true; }
  let st; try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache', ...extra });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(file).pipe(res);
  return true;
}

function serveMedia(req, res, rel) {
  if (serveFile(req, res, D.MEDIA_DIR, rel)) return;
  if (MEDIA_FALLBACK && rel) {
    res.writeHead(302, { Location: LIVE_UPLOADS + rel.split('/').map(encodeURIComponent).join('/') });
    return res.end();
  }
  send(res, 404, 'Not found');
}

function readBody(req, limit = 200_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function api(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/review/posts') return json(res, 200, { rows: RV.build().posts });
    if (req.method === 'GET' && pathname === '/api/review/media') return json(res, 200, { rows: RV.build().media });
    if (req.method === 'GET' && pathname === '/api/decisions') return json(res, 200, RV.loadDecisions());
    if (req.method === 'POST' && pathname === '/api/decisions') {
      const b = await readBody(req);
      return json(res, 200, RV.setDecision(b.kind, String(b.id), { status: b.status, note: b.note }));
    }
    if (req.method === 'POST' && pathname === '/api/decisions/bulk') {
      const b = await readBody(req, 2_000_000);
      return json(res, 200, { updated: RV.bulkDecision(b.kind, (b.ids || []).map(String), b.status) });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 400, { error: String(e.message || e) });
  }
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'Bad request'); }
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) return send(res, 405, 'Method not allowed');
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');

  if (pathname.startsWith('/api/')) return api(req, res, pathname);
  if (req.method === 'POST') return send(res, 405, 'Method not allowed');

  if (pathname.startsWith('/media/')) return serveMedia(req, res, pathname.slice(7));
  if (pathname.startsWith('/export/media/')) return serveMedia(req, res, pathname.slice(14));
  if (pathname.startsWith('/export/')) { if (serveFile(req, res, D.EXPORT, pathname.slice(8))) return; return send(res, 404, 'Not found'); }
  if (pathname.startsWith('/assets/')) { if (serveFile(req, res, PUBLIC, pathname.slice(8))) return; return send(res, 404, 'Not found'); }
  if (pathname === '/favicon.ico') return send(res, 204, '');

  if (pathname === '/review' || pathname.startsWith('/review/')) {
    const name = pathname.replace(/^\/review\/?/, '').replace(/\/$/, '') || 'index';
    if (serveFile(req, res, REVIEW, name + '.html', { 'X-Robots-Tag': 'noindex' })) return;
    return send(res, 404, 'Not found');
  }

  const out = R.render(pathname) || R.notFound();
  return send(res, out.status, out.html, { 'Content-Type': TYPES['.html'] });
});

server.listen(PORT, HOST, () => {
  console.log(`IAmMoody site      http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Review tools      http://localhost:${PORT}/review   (posts: /review/posts, media: /review/media)`);
});
