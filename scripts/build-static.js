'use strict';
// Renders every public page to plain HTML files in dist/, optimizes the photos they use, copies css/js,
// and adds the files GitHub Pages wants. Settings (all optional, via environment variables):
//
//   SITE_URL=https://www.iammoody.com   the public address. Enables absolute social-preview images,
//                                 canonical links, sitemap.xml and robots.txt.
//   BASE_PATH=/repo-name          site lives in a sub-folder (a GitHub "project site": user.github.io/repo-name/).
//                                 Leave empty for a user site (<user>.github.io) or a custom domain.
//   OPTIMIZE_IMAGES=0             skip image optimization and copy the original photos (much bigger site).
//   CNAME file in site/           custom domain name (one line, e.g. www.iammoody.com); copied into dist/.
//
//   SITE_URL=https://www.iammoody.com npm run build
//
// Photos: every raster image the pages use is converted to WebP at up to three widths (640/1280/1920, never
// upscaled) by scripts/optimize_images.py (needs Python 3 + Pillow), cached in .cache/, and each <img> gets a
// srcset so phones download the small file and large screens the big one. Originals are never modified.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const D = require('../lib/data');
const R = require('../lib/render');

const DIST = path.join(D.ROOT, 'dist');
const CACHE = path.join(D.ROOT, '.cache');
const BASE = (() => { const b = (process.env.BASE_PATH || '').trim(); return !b || b === '/' ? '' : '/' + b.replace(/^\/+|\/+$/g, ''); })();
const SITE = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (SITE && !/^https?:\/\/[^/\s]+$/.test(SITE)) { console.error(`SITE_URL must look like https://www.example.com (no path); got "${SITE}". Use BASE_PATH for a sub-folder.`); process.exit(1); }

// How wide each kind of image is displayed (hints set by lib/render.js via data-ctx), so the browser picks a sensible file.
const CARD = '(max-width: 600px) 92vw, (max-width: 960px) 46vw, 380px';
const SIZES = { card: CARD, thumb: CARD, split: '(max-width: 960px) 100vw, 50vw', prose: '(max-width: 820px) 92vw, 780px' };

// Empty dist/ but keep a .git folder if someone made dist/ its own repository.
fs.mkdirSync(DIST, { recursive: true });
for (const entry of fs.readdirSync(DIST)) if (entry !== '.git') fs.rmSync(path.join(DIST, entry), { recursive: true, force: true });

// ---- 1. render every page (in memory) and note which media files they use --------------------------------------
const used = new Set();
const collectMedia = (html) => { for (const m of html.matchAll(/(?:src|href|content)="(\/media\/[^"]+)"|url\('(\/media\/[^']+)'\)/g)) used.add(decodeURIComponent(m[1] || m[2]).replace(/^\/media\//, '')); };
const pages = [];
for (const route of R.allRoutes()) {
  const out = R.render(route);
  if (!out) { console.warn('skipped', route); continue; }
  collectMedia(out.html);
  pages.push({ route, file: route === '/' ? 'index.html' : path.join(route.slice(1), 'index.html'), html: out.html });
}
const notFoundHtml = R.notFound().html; collectMedia(notFoundHtml);
pages.push({ route: null, file: '404.html', html: notFoundHtml });

// ---- 2. optimize the photos ------------------------------------------------------------------------------------
const exists = (rel) => fs.existsSync(path.join(D.MEDIA_DIR, rel));
const rasters = [...used].filter((rel) => /\.(jpe?g|png|webp)$/i.test(rel) && exists(rel)).sort();
function optimizeImages(rels) {
  if (process.env.OPTIMIZE_IMAGES === '0' || !rels.length) return {};
  fs.mkdirSync(CACHE, { recursive: true });
  const input = path.join(CACHE, 'input.json'), manifest = path.join(CACHE, 'manifest.json');
  fs.writeFileSync(input, JSON.stringify(rels.map((rel) => ({ rel, src: path.join(D.MEDIA_DIR, rel) }))));
  console.log(`Optimizing ${rels.length} images (cached after the first build)...`);
  try {
    execFileSync('python3', [path.join(__dirname, 'optimize_images.py'), '--input', input, '--out', path.join(CACHE, 'images'), '--manifest', manifest], { stdio: ['ignore', 'inherit', 'inherit'] });
    return JSON.parse(fs.readFileSync(manifest, 'utf8'));
  } catch (e) {
    console.warn('\n!! IMAGE OPTIMIZATION FAILED, so the ORIGINAL full-size photos will be published (about 30 MB, slow on phones).');
    console.warn('!! It needs Python 3 with Pillow:  pip install pillow      Reason: ' + String(e.message).split('\n')[0] + '\n');
    return {};
  }
}
const manifest = optimizeImages(rasters);

// Name the published files: <folder>/<photo>-<width>.webp (a photo.jpg and photo.png in one folder get the extension added).
const taken = new Set();
const mediaUrl = (name) => '/media/' + name.split('/').map(encodeURIComponent).join('/');
for (const rel of Object.keys(manifest).sort()) {
  const dir = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel) + '/';
  const ext = path.posix.extname(rel), stem = path.posix.basename(rel, ext);
  for (const v of manifest[rel].variants) {
    let name = `${dir}${stem}-${v.w}.webp`;
    if (taken.has(name.toLowerCase())) name = `${dir}${stem}-${ext.slice(1)}-${v.w}.webp`;
    taken.add(name.toLowerCase());
    v.dist = name;
  }
}

/** Swap original photo URLs for the optimized WebP files, with srcset/sizes/width/height on every <img>. */
function optimizeHtml(html) {
  const find = (u) => manifest[decodeURIComponent(u.replace(/^\/media\//, ''))];
  const url = (v) => mediaUrl(v.dist);
  const atLeast = (e, w) => e.variants.find((v) => v.w >= w) || e.variants[e.variants.length - 1];
  const largest = (e) => e.variants[e.variants.length - 1];

  html = html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = /\ssrc="(\/media\/[^"]+)"/.exec(tag), e = m && find(m[1]);
    const ctx = (/\sdata-ctx="([^"]*)"/.exec(tag) || [])[1];
    const bare = tag.replace(/\s(?:src|srcset|sizes|width|height|data-ctx)="[^"]*"/g, '');
    if (!e) return tag.replace(/\sdata-ctx="[^"]*"/, '');   // not optimized (external, GIF, failed): leave the tag alone
    const src = atLeast(e, 1000);
    const srcset = e.variants.map((v) => `${url(v)} ${v.w}w`).join(', ');
    return bare.replace(/<img\b/, `<img src="${url(src)}" srcset="${srcset}" sizes="${SIZES[ctx] || '100vw'}" width="${src.w}" height="${src.h}"`)
      .replace(/\s*\/?>$/, / decoding=/.test(bare) ? '>' : ' decoding="async">');
  });
  // hero / card backgrounds: --img (desktop) and --img-sm (phones, see site.css)
  html = html.replace(/style="--img:url\('(\/media\/[^']+)'\)"(\s+data-bg="(\w+)")?/g, (all, u, _a, ctx) => {
    const e = find(u);
    if (!e) return all.replace(/\s+data-bg="\w+"/, '');
    return ctx === 'card' ? `style="--img:url('${url(atLeast(e, 760))}')"` : `style="--img:url('${url(largest(e))}');--img-sm:url('${url(atLeast(e, 1280))}')"`;
  });
  html = html.replace(/href="(\/media\/[^"]+)"/g, (all, u) => { const e = find(u); return e ? `href="${url(largest(e))}"` : all; });                       // lightbox links
  html = html.replace(/(<meta property="og:image" content=")(\/media\/[^"]+)"/, (all, pre, u) => { const e = find(u); return e ? `${pre}${url(atLeast(e, 1200))}"` : all; }); // social preview
  return html;
}

/** Point root-relative URLs at BASE_PATH; make the social-preview image absolute; add canonical/OG tags. */
function finalize(html, route) {
  if (Object.keys(manifest).length) html = optimizeHtml(html);
  if (BASE) {
    html = html.replace(/\b(href|src|action|content)="\/(?!\/)/g, `$1="${BASE}/`).replace(/url\('\/(?!\/)/g, `url('${BASE}/`)
      .replace(/\bsrcset="([^"]*)"/g, (_, list) => `srcset="${list.split(',').map((s) => { s = s.trim(); return s.startsWith('/') ? BASE + s : s; }).join(', ')}"`);
  }
  if (SITE) {
    html = html.replace(/(<meta property="og:image" content=")(\/[^"]*)"/, `$1${SITE}$2"`);
    if (route) {
      const url = SITE + BASE + (route === '/' ? '/' : route + '/');
      html = html.replace('</head>', `  <link rel="canonical" href="${url}">\n  <meta property="og:url" content="${url}">\n  <meta property="og:type" content="website">\n  <meta name="twitter:card" content="summary_large_image">\n</head>`);
    }
  }
  return html;
}

// ---- 3. write pages, assets, media ------------------------------------------------------------------------------
for (const p of pages) {
  fs.mkdirSync(path.dirname(path.join(DIST, p.file)), { recursive: true });
  fs.writeFileSync(path.join(DIST, p.file), finalize(p.html, p.route));
}
// assets (site css/js/img); the review tools are intentionally not part of the public build
fs.cpSync(path.join(D.ROOT, 'public'), path.join(DIST, 'assets'), { recursive: true, filter: (s) => !/review\.(css|js)$/.test(s) });

let optimized = 0, copiedAsIs = 0, missing = 0, bytesIn = 0, bytesOut = 0;
for (const rel of used) {
  if (!exists(rel)) { missing++; continue; }
  const src = path.join(D.MEDIA_DIR, rel);
  bytesIn += fs.statSync(src).size;
  if (manifest[rel]) {
    for (const v of manifest[rel].variants) {
      const dest = path.join(DIST, 'media', v.dist);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(CACHE, 'images', v.file), dest); bytesOut += v.bytes;
    }
    optimized++;
  } else {
    const dest = path.join(DIST, 'media', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest); bytesOut += fs.statSync(src).size; copiedAsIs++;
  }
}

// GitHub Pages extras
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');                        // serve files as-is (skip Jekyll processing)
const cname = path.join(D.ROOT, 'CNAME');
if (fs.existsSync(cname)) fs.copyFileSync(cname, path.join(DIST, 'CNAME')); // custom domain
if (SITE) {
  const urls = pages.filter((p) => p.route).map((p) => `  <url><loc>${SITE}${BASE}${p.route === '/' ? '/' : p.route + '/'}</loc></url>`).join('\n');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}${BASE}/sitemap.xml\n`);
}

const mb = (n) => (n / 1e6).toFixed(1) + ' MB';
console.log(`${pages.filter((p) => p.route).length} pages | media: ${optimized} photos optimized, ${copiedAsIs} copied as-is, ${missing} missing | ${mb(bytesIn)} originals -> ${mb(bytesOut)} published`);
console.log(`base path: ${BASE || '(none: site root)'} | site url: ${SITE || '(not set: no sitemap/canonical/absolute preview image)'} | CNAME: ${fs.existsSync(cname) ? fs.readFileSync(cname, 'utf8').trim() : '(none)'}`);
