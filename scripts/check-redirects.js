'use strict';
// Requests every old WordPress address and confirms it forwards to a page that loads.
//   npm run check-redirects                               the live site (https://www.iammoody.com)
//   npm run check-redirects -- http://localhost:4000      a local preview (npm run preview)
// Forwarding targets are absolute live URLs; when checking elsewhere they are followed on that host instead.
const { oldPaths } = require('../lib/redirects');

const LIVE = 'https://www.iammoody.com';
const HOST = (process.argv[2] || LIVE).replace(/\/+$/, '');
const local = (u) => u.replace(LIVE, HOST);

async function check(from) {
  const res = await fetch(HOST + from, { redirect: 'follow' });
  if (res.status !== 200) return `${res.status} ${from}`;
  const html = await res.text();
  const m = /<meta http-equiv="refresh" content="0; url=([^"]+)"/.exec(html);
  if (!m) return /<link rel="canonical" href="[^"]*"/.test(html) && !/This page has moved/.test(html) ? null : `no forward ${from}`;   // a real page on the new site is fine too
  const target = await fetch(local(m[1].replace(/&amp;/g, '&')), { redirect: 'follow' });
  return target.status === 200 ? null : `${from} -> ${m[1]} returned ${target.status}`;
}

(async () => {
  const paths = oldPaths(), problems = [];
  let i = 0;
  const worker = async () => { while (i < paths.length) { const p = paths[i++]; try { const e = await check(p); if (e) problems.push(e); } catch (err) { problems.push(`${p} failed: ${err.message}`); } } };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`${paths.length} old addresses checked on ${HOST}: ${paths.length - problems.length} ok, ${problems.length} problems`);
  problems.sort().forEach((p) => console.log('  ' + p));
  process.exit(problems.length ? 1 : 0);
})();
