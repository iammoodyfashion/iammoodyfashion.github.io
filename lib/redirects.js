'use strict';
// Forwarding for the old WordPress addresses (listed in the export's sitemaps), so links from other sites and
// old search results land on the new site. Hand-picked destinations live in data/redirects.json; the rest:
//   /calendar/<slug>/          -> /events/<slug>/ when that event page exists, else /events/
//   /calendar/category/...     -> /events/
//   a post about an event series (title matches a series in curated.json) -> /events/<series>/
//   anything else (old lifestyle posts, tags, categories) -> /
const fs = require('fs');
const path = require('path');
const D = require('./data');

const SITEMAPS = path.join(D.EXPORT, 'sitemaps');

/** Every old address as a path with a trailing slash ("/home/about/"). */
function oldPaths() {
  if (!fs.existsSync(SITEMAPS)) return [];
  const out = new Set();
  for (const f of fs.readdirSync(SITEMAPS).filter((f) => f.endsWith('.xml'))) {
    for (const m of fs.readFileSync(path.join(SITEMAPS, f), 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      let p;
      try { p = new URL(m[1]).pathname; } catch { continue; }
      if (/^\/wp-content\//.test(p) || /\.[a-z0-9]+$/i.test(p)) continue;   // images and files, not pages
      out.add(decodeURIComponent(p).replace(/\/*$/, '/'));
    }
  }
  return [...out].sort();
}

/**
 * [{ from, to }] for every old address that is not also a page on the new site.
 * `routes` are the new site's routes ("/", "/events/foo"). Throws if a hand-picked destination is not one of them.
 */
function redirects(routes) {
  const live = new Set(routes.map((r) => (r === '/' ? '/' : r + '/')));
  const manual = JSON.parse(fs.readFileSync(path.join(D.ROOT, 'data', 'redirects.json'), 'utf8'));
  const picked = { ...manual.pages, ...manual.posts };
  const bad = Object.entries(picked).filter(([, to]) => !live.has(to));
  if (bad.length) throw new Error('data/redirects.json points at pages that do not exist:\n' + bad.map(([f, t]) => `  ${f} -> ${t}`).join('\n'));

  const postsFile = path.join(D.EXPORT, 'raw', 'posts.json');
  const postTitle = new Map(fs.existsSync(postsFile) ? JSON.parse(fs.readFileSync(postsFile, 'utf8')).map((p) => [p.slug, D.stripTags(p.title.rendered)]) : []);

  const to = (from) => {
    if (picked[from]) return picked[from];
    let m;
    if ((m = /^\/calendar\/([^/]+)\/$/.exec(from)) && m[1] !== 'category') return live.has(`/events/${m[1]}/`) ? `/events/${m[1]}/` : '/events/';
    if (from.startsWith('/calendar/')) return '/events/';
    if ((m = /^\/([^/]+)\/$/.exec(from)) && postTitle.has(m[1])) {
      const series = D.seriesFor(postTitle.get(m[1]));
      if (series && live.has(`/events/${series}/`)) return `/events/${series}/`;
    }
    return '/';
  };
  return oldPaths().filter((from) => !live.has(from)).map((from) => ({ from, to: to(from) }));
}

module.exports = { oldPaths, redirects };
