'use strict';
// Loads curated site content plus events mined from the WordPress export.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPORT = process.env.EXPORT_DIR || path.resolve(ROOT, '..', 'iammoody-export');
const MEDIA_DIR = path.join(EXPORT, 'media');
const curated = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curated.json'), 'utf8'));

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
const decode = (s = '') => String(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const stripTags = (s = '') => decode(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- media helpers -----------------------------------------------------------
const UPLOAD_RE = /https?:\/\/(?:www\.)?iammoody\.com\/wp-content\/uploads\/([^\s"'<>)\]\\]+)/gi;
const SIZE_RE = /-\d+x\d+(?=\.[A-Za-z0-9]+$)/;
const mediaExists = (rel) => fs.existsSync(path.join(MEDIA_DIR, rel));
const mediaUrl = (rel) => (rel.startsWith('/') ? rel : '/media/' + rel.split('/').map(encodeURIComponent).join('/')); // '/assets/...' = derived site asset

/** URL from the old site -> local /media URL (prefers the full-size original if we have it). */
function rewriteUpload(url) {
  const m = /wp-content\/uploads\/([^?#]+)/.exec(url);
  if (!m) return url;
  let rel = decodeURIComponent(m[1]);
  const orig = rel.replace(SIZE_RE, '');
  if (orig !== rel && mediaExists(orig)) rel = orig;
  return mediaUrl(rel);
}

/** Clean legacy WordPress HTML: un-lazy-load images, drop scripts/embeds/shortcodes, localize media. */
function cleanHtml(html = '') {
  let h = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|iframe|object)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|embed|object)\b[^>]*\/?>/gi, '')
    .replace(/\[(?:gravityform|caption|\/caption|gallery|embed|nggallery)[^\]]*\]/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const real = /\sdata-(?:lazy-)?src="([^"]+)"/i.exec(tag);
      let t = tag.replace(/\s(?:data-)?(?:srcset|sizes|lazy-srcset|lazy-src)="[^"]*"/gi, '').replace(/\sstyle="[^"]*"/gi, '');
      if (real) t = t.replace(/\ssrc="[^"]*"/i, '').replace(/\sdata-src="[^"]*"/i, '').replace(/<img/i, `<img src="${real[1]}"`);
      else if (/\ssrc="data:/i.test(t)) return '';
      return t.replace(/\sclass="[^"]*"/i, '').replace(/\s(?:width|height)="[^"]*"/gi, '').replace(/<img/i, '<img loading="lazy" data-ctx="prose"');
    });
  h = h.replace(UPLOAD_RE, (u) => rewriteUpload(u));
  // legacy links that open a new tab: never let the destination page reach back into ours
  h = h.replace(/<a\b[^>]*\btarget="_blank"[^>]*>/gi, (tag) => {
    if (!/\brel=/i.test(tag)) return tag.replace(/<a\b/i, '<a rel="noopener noreferrer"');
    return tag.replace(/\brel="([^"]*)"/i, (_, v) => `rel="${(v.replace(/\b(noopener|noreferrer)\b/gi, '') + ' noopener noreferrer').trim().replace(/\s+/g, ' ')}"`);
  });
  return h;
}


// Old event pages contain placeholders that were never filled in ("Special performances by: TBD").
// Remove only those, subtractively, and tidy whatever they leave empty. Everything else is untouched.
const PLACEHOLDER_RULES = [
  [/<li>(?:<strong>)?[^<]*\bTBD\b[^<]*(?:<\/strong>)?<\/li>\s*/gi, ''],                          // <li>Special guest by TBD</li>
  [/<p>\s*(?:<strong>[^<]*<\/strong>)?\s*(?:<br \/>)?\s*TBD\s*<\/p>\s*/gi, ''],                  // <p><strong>Performers:</strong><br />TBD</p>
  [/<br \/>\s*More TBD/gi, ''],                                                                       // "...Jamison Murphy<br />More TBD"
  [/\s+at TBD(?=\s*<\/p>)/gi, ''],                                                                    // "Afterparty: 7:00 PM at TBD"
  [/\s*The evening will crescendo with a special finale featuring exclusive collections by:/gi, ''],   // sentence that introduced an empty list
  [/<(ul|ol)>\s*<\/\1>\s*/gi, ''],                                                                    // lists left empty
  [/<h3>[^<]*<\/h3>\s*(?=<h3>|$)/gi, ''],                                                             // headings left with nothing under them
];
const dropPlaceholders = (h) => PLACEHOLDER_RULES.reduce((acc, [re, to]) => acc.replace(re, to), h);

// ---- events ------------------------------------------------------------------
const seriesList = curated.series.map((s) => ({ ...s, re: new RegExp(s.match, 'i') }));
const seriesFor = (title) => (seriesList.find((s) => s.re.test(title)) || {}).slug || null;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function parseLocal(s) { // "2026-09-16 17:00:00" (site-local time; parse as-is, no timezone shift)
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s || '');
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: m[4] ? +m[4] : null, mi: m[5] ? +m[5] : 0 };
}
const time12 = (t) => (t && t.h != null ? `${((t.h + 11) % 12) + 1}:${String(t.mi).padStart(2, '0')} ${t.h < 12 ? 'AM' : 'PM'}` : '');
function formatWhen(start, end, allDay) {
  const a = parseLocal(start); if (!a) return '';
  const dow = DAYS[new Date(Date.UTC(a.y, a.mo - 1, a.d)).getUTCDay()];
  let out = `${dow}, ${MONTHS[a.mo - 1]} ${a.d}, ${a.y}`;
  if (!allDay && a.h != null) {
    out += ` · ${time12(a)}`;
    const b = parseLocal(end);
    if (b && b.h != null && b.d === a.d) out += ` – ${time12(b)}`;
  }
  return out;
}

let _events;
function events() {
  if (_events) return _events;
  const file = path.join(EXPORT, 'raw', 'events.json');
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  _events = raw
    .filter((e) => !(e.categories || []).some((c) => /recommended/i.test(c.name)))
    .map((e) => {
      const v = e.venue && !Array.isArray(e.venue) ? e.venue : {};
      const img = e.image && e.image.url ? rewriteUpload(e.image.url) : null;
      const title = stripTags(e.title);
      return {
        id: e.id, slug: e.slug || String(e.id), title,
        start: e.start_date, end: e.end_date, allDay: !!e.all_day,
        when: formatWhen(e.start_date, e.end_date, e.all_day),
        year: (e.start_date || '').slice(0, 4),
        venue: decode(v.venue || ''),
        address: [v.address, v.city, v.stateprovince].filter(Boolean).map(decode).join(', '),
        cost: decode(e.cost || ''), ticketUrl: e.website || '',
        categories: (e.categories || []).map((c) => decode(c.name)),
        image: img && (mediaExists(decodeURIComponent(img.replace('/media/', ''))) ? img : null),
        html: dropPlaceholders(cleanHtml(e.description || '')),
        excerpt: stripTags(e.description || '').slice(0, 180),
        series: seriesFor(title),
      };
    })
    .sort((a, b) => (a.start < b.start ? 1 : -1));
  return _events;
}

const today = () => new Date().toISOString().slice(0, 10);
const isUpcoming = (e) => (e.start || '').slice(0, 10) >= today();

module.exports = { ROOT, EXPORT, MEDIA_DIR, curated, decode, stripTags, esc, mediaUrl, mediaExists, cleanHtml, rewriteUpload, events, isUpcoming, formatWhen, seriesFor };
