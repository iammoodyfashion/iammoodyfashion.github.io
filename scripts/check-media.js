'use strict';
// Verifies every image referenced by data/curated.json and pages/*.html exists in iammoody-export/media.
const fs = require('fs'); const path = require('path');
const D = require('../lib/data');
const refs = new Set();
const walk = (o) => { if (typeof o === 'string') { if (/^\d{4}\/\d{2}\/.+\.(jpe?g|png|webp|gif)$/i.test(o)) refs.add(o); } else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
walk(D.curated);
for (const f of fs.readdirSync(path.join(D.ROOT, 'pages'), { recursive: true })) {
  if (!String(f).endsWith('.html')) continue;
  const s = fs.readFileSync(path.join(D.ROOT, 'pages', f), 'utf8');
  for (const m of s.matchAll(/\{\{(?:img|bg):([^|}]+)/g)) refs.add(m[1]);
}
const missing = [...refs].filter((r) => !D.mediaExists(r));
console.log(`${refs.size} curated images referenced, ${missing.length} missing`);
missing.forEach((m) => console.log('  MISSING', m));
process.exit(missing.length ? 1 : 0);
