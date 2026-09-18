'use strict';
// Serves dist/ the way GitHub Pages will: under BASE_PATH, directory URLs get a trailing slash,
// and unknown URLs return 404.html with a 404 status.
//   npm run build && npm run preview            (site root)
//   BASE_PATH=/repo-name npm run build && BASE_PATH=/repo-name npm run preview
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
const BASE = (() => { const b = (process.env.BASE_PATH || '').trim(); return !b || b === '/' ? '' : '/' + b.replace(/^\/+|\/+$/g, ''); })();
const PORT = +process.env.PORT || 4000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  const notFound = () => send(res, 404, path.join(DIST, '404.html'));
  if (BASE && p === BASE) { res.writeHead(301, { Location: BASE + '/' }); return res.end(); }
  if (BASE && !p.startsWith(BASE + '/')) return notFound();
  const rel = p.slice(BASE.length).replace(/^\/+/, '');
  const file = path.resolve(DIST, rel);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return notFound();
  let st; try { st = fs.statSync(file); } catch { return notFound(); }
  if (st.isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); } // like GitHub Pages
    const idx = path.join(file, 'index.html');
    return fs.existsSync(idx) ? send(res, 200, idx) : notFound();
  }
  send(res, 200, file);
}).listen(PORT, '127.0.0.1', () => console.log(`Preview of dist/  http://localhost:${PORT}${BASE}/`));
