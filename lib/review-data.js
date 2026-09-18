'use strict';
// Builds the datasets behind /review/posts and /review/media from the WordPress export,
// and stores reviewer decisions in data/decisions.json.
const fs = require('fs');
const path = require('path');
const { ROOT, EXPORT, MEDIA_DIR, decode, stripTags } = require('./data');

const RAW = path.join(EXPORT, 'raw');
const DECISIONS_FILE = path.join(ROOT, 'data', 'decisions.json');
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };

const UPLOAD_RE = /wp-content\/uploads\/([^\s"'<>)\]\\?#]+)/gi;
const SIZE_RE = /-\d+x\d+(?=\.[A-Za-z0-9]+$)/;
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime', mp3: 'audio/mpeg' };
const uploadRel = (url) => { const m = /wp-content\/uploads\/([^?#]+)/.exec(url || ''); return m ? decodeURIComponent(m[1]) : null; };

/** id -> export folder, read from each item's front matter. */
function dirById(kind) {
  const base = path.join(EXPORT, kind);
  const out = {};
  if (!fs.existsSync(base)) return out;
  for (const d of fs.readdirSync(base)) {
    const f = path.join(base, d, 'index.md');
    if (!fs.existsSync(f)) continue;
    const head = fs.readFileSync(f, 'utf8').slice(0, 1500);
    const m = /^id: (\d+)/m.exec(head);
    if (m) out[m[1]] = d;
  }
  return out;
}

let cache;
function build() {
  if (cache) return cache;
  const postsRaw = readJson(path.join(RAW, 'posts.json'), []);
  const pagesRaw = readJson(path.join(RAW, 'pages.json'), []);
  const eventsRaw = readJson(path.join(RAW, 'events.json'), []);
  const mediaRaw = readJson(path.join(RAW, 'media.json'), []);
  const urls = readJson(path.join(RAW, 'media_urls.json'), { library: {}, extra: {} });
  const failures = new Set((readJson(path.join(EXPORT, 'logs', 'download_failures.json'), [])).map((f) => f[0]));
  const catNames = Object.fromEntries(readJson(path.join(RAW, 'categories.json'), []).map((c) => [c.id, decode(c.name)]));
  const tagNames = Object.fromEntries(readJson(path.join(RAW, 'tags.json'), []).map((t) => [t.id, decode(t.name)]));

  const postDirs = dirById('posts');
  const eventDirs = dirById('events');

  // ---- posts ----
  const posts = postsRaw.map((p) => {
    const html = p.content.rendered || '';
    const text = stripTags(html);
    const feat = (mediaRaw.find((m) => m.id === p.featured_media) || {}).source_url;
    return {
      id: p.id, slug: p.slug, dir: postDirs[p.id] || null,
      title: stripTags(p.title.rendered) || '(untitled)',
      date: p.date.slice(0, 10), year: p.date.slice(0, 4),
      categories: p.categories.map((c) => catNames[c] || String(c)),
      tags: p.tags.map((t) => tagNames[t] || String(t)),
      words: text ? text.split(' ').length : 0,
      images: (html.match(/<img\b/gi) || []).length,
      url: p.link, excerpt: text.slice(0, 220), featured: uploadRel(feat),
    };
  });

  // ---- media rows (one per full-size file) ----
  const rows = new Map();
  const ext = (rel) => (rel.split('.').pop() || '').toLowerCase();
  const addRow = (rel, url, lib) => {
    if (!rel || rows.has(rel)) return rows.get(rel);
    const parts = rel.split('/');
    const r = {
      rel, name: parts[parts.length - 1], year: /^\d{4}$/.test(parts[0]) ? parts[0] : '', month: /^\d{2}$/.test(parts[1]) ? parts[1] : '',
      url: url || 'https://www.iammoody.com/wp-content/uploads/' + rel.split('/').map(encodeURIComponent).join('/'),
      inLibrary: !!lib, libId: lib ? lib.id : null, title: lib ? stripTags((lib.title || {}).rendered || '') : '',
      alt: lib ? decode(lib.alt_text || '') : '', caption: lib ? stripTags((lib.caption || {}).rendered || '') : '',
      mime: (lib && lib.mime_type) || MIME[ext(rel)] || '', w: null, h: null, date: lib ? (lib.date || '').slice(0, 10) : '',
      parent: null, variant: SIZE_RE.test(rel), used: 0, usedBy: [], size: 0,
    };
    if (lib && lib.media_details) { r.w = lib.media_details.width || null; r.h = lib.media_details.height || null; }
    if (lib && lib.post) { const pp = posts.find((x) => x.id === lib.post); if (pp) r.parent = { id: pp.id, title: pp.title, dir: pp.dir }; }
    rows.set(rel, r);
    return r;
  };
  for (const m of mediaRaw) addRow(uploadRel(m.source_url), m.source_url, m);
  for (const rel of Object.keys(urls.library)) addRow(rel, urls.library[rel]);
  for (const rel of Object.keys(urls.extra)) addRow(rel, urls.extra[rel]);

  // ---- references from posts / pages / events ----
  const resolve = (rel) => rows.has(rel) ? rel : rows.has(rel.replace(SIZE_RE, '')) ? rel.replace(SIZE_RE, '') : null;
  const scan = (type, id, title, dir, item) => {
    const blob = JSON.stringify(item, (k, v) => (k === '_links' ? undefined : v)).replace(/\\\//g, '/');
    const seen = new Set();
    let m; UPLOAD_RE.lastIndex = 0;
    while ((m = UPLOAD_RE.exec(blob))) {
      const rel = resolve(decodeURIComponent(m[1]));
      if (!rel || seen.has(rel)) continue;
      seen.add(rel);
      const r = rows.get(rel); r.used++;
      if (r.usedBy.length < 8) r.usedBy.push({ t: type, id, title, dir });
    }
  };
  postsRaw.forEach((p, i) => scan('post', p.id, posts[i].title, posts[i].dir, p));
  pagesRaw.forEach((p) => scan('page', p.id, stripTags(p.title.rendered), 'pages/' + (new URL(p.link).pathname.replace(/^\/|\/$/g, '') || 'front-page'), p));
  eventsRaw.forEach((e) => scan('event', e.id, stripTags(e.title), eventDirs[e.id] ? 'events/' + eventDirs[e.id] : null, e));

  // ---- local file status ----
  for (const r of rows.values()) {
    const f = path.join(MEDIA_DIR, r.rel);
    if (fs.existsSync(f)) { r.status = 'local'; r.size = fs.statSync(f).size; }
    else r.status = failures.has(r.rel) ? 'gone' : 'missing';
  }
  const media = [...rows.values()].sort((a, b) => (a.rel < b.rel ? 1 : -1));
  cache = { posts, media, builtAt: new Date().toISOString() };
  return cache;
}

// ---- decisions ---------------------------------------------------------------
let decisions;
function loadDecisions() {
  if (!decisions) decisions = readJson(DECISIONS_FILE, { posts: {}, media: {} });
  decisions.posts = decisions.posts || {}; decisions.media = decisions.media || {};
  return decisions;
}
function saveDecisions() {
  fs.mkdirSync(path.dirname(DECISIONS_FILE), { recursive: true });
  const tmp = DECISIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(decisions, null, 1));
  fs.renameSync(tmp, DECISIONS_FILE);
}
const KINDS = { posts: ['', 'archive', 'mine'], media: ['', 'use', 'discard'] };
function setDecision(kind, id, patch) {
  if (!KINDS[kind]) throw new Error('bad kind');
  const d = loadDecisions();
  const cur = d[kind][id] || { status: '', note: '' };
  if (patch.status !== undefined) { if (!KINDS[kind].includes(patch.status)) throw new Error('bad status'); cur.status = patch.status; }
  if (patch.note !== undefined) cur.note = String(patch.note).slice(0, 2000);
  cur.ts = new Date().toISOString();
  if (!cur.status && !cur.note) delete d[kind][id]; else d[kind][id] = cur;
  saveDecisions();
  return cur;
}
function bulkDecision(kind, ids, status) {
  if (!KINDS[kind] || !KINDS[kind].includes(status)) throw new Error('bad request');
  const d = loadDecisions();
  for (const id of ids) {
    const cur = d[kind][id] || { status: '', note: '' };
    cur.status = status; cur.ts = new Date().toISOString();
    if (!cur.status && !cur.note) delete d[kind][id]; else d[kind][id] = cur;
  }
  saveDecisions();
  return ids.length;
}

module.exports = { build, loadDecisions, setDecision, bulkDecision };
