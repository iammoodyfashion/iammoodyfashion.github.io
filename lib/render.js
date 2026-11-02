'use strict';
// Route -> HTML for the public marketing pages. Used by server.js and scripts/build-static.js.
const fs = require('fs');
const path = require('path');
const D = require('./data');
const { curated, esc, mediaUrl } = D;

const read = (...p) => fs.readFileSync(path.join(D.ROOT, ...p), 'utf8');
const NAV = [['/services', 'Services'], ['/events', 'Events'], /* ['/be-there', 'Be There'], parked until there are more events */ ['/work', 'Work'], ['/about', 'About'], ['/contact', 'Contact']];

// `ctx` is a hint for the static build (see scripts/build-static.js) about how large the image is shown,
// so it can pick the right file size: card | split | thumb | prose. Backgrounds: card (small) or none (full-width hero).
const img = (rel, alt = '', cls = '', ctx = '') => `<img${cls ? ` class="${cls}"` : ''} src="${mediaUrl(rel)}" alt="${esc(alt)}" loading="lazy"${ctx ? ` data-ctx="${ctx}"` : ''}>`;
const bg = (rel, ctx = '') => `style="--img:url('${mediaUrl(rel)}')"${ctx ? ` data-bg="${ctx}"` : ''}`;
const cta = (h = 'Planning a fashion show or event?', p = 'Tell us the date, the vision and the audience. We will come back with ideas and a quote.') => `
<section class="cta-band">
  <div class="container">
    <h2>${esc(h)}</h2>
    <p>${esc(p)}</p>
    <a class="btn btn-primary" href="/contact">Plan your event</a>
  </div>
</section>`;

const ICONS = {
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.5c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.8v8h3.2z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.3l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.2 4.7H5.4l11.3 14.5z"/></svg>',
  email: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 6.5 12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// Public address used in share links (the build's SITE_URL + BASE_PATH; the live domain when previewing locally).
const PUBLIC_URL = (process.env.SITE_URL || 'https://www.iammoody.com').trim().replace(/\/+$/, '')
  + (() => { const b = (process.env.BASE_PATH || '').trim(); return !b || b === '/' ? '' : '/' + b.replace(/^\/+|\/+$/g, ''); })();

/** Share buttons: plain links (no third-party scripts or cookies until a visitor clicks one).
 *  site.js adds the phone's own share sheet where available and makes "Copy link" copy instead of navigating. */
function shareLinks(route, title, when) {
  const url = PUBLIC_URL + route + '/';
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  const mail = `mailto:?subject=${t}&body=${encodeURIComponent([title, when, url].filter(Boolean).join('\n'))}`;
  const ext = (href, icon, label) => `<a class="share-btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${label} (opens in a new tab)" title="${label}">${ICONS[icon]}</a>`;
  return `<div class="share" data-share data-url="${esc(url)}" data-title="${esc(title)}" data-text="${esc(when || '')}">
    <p class="share-label">Share</p>
    <div class="share-row">
      <button class="share-btn" type="button" data-share-native hidden aria-label="Share" title="Share">${ICONS.share}</button>
      ${ext(`https://www.facebook.com/sharer/sharer.php?u=${u}`, 'facebook', 'Share on Facebook')}
      ${ext(`https://x.com/intent/post?url=${u}&text=${t}`, 'x', 'Share on X')}
      <a class="share-btn" href="${esc(mail)}" aria-label="Share by email" title="Share by email">${ICONS.email}</a>
      <a class="share-btn" href="${esc(url)}" data-share-copy aria-label="Copy link" title="Copy link">${ICONS.link}</a>
    </div>
    <p class="share-status small muted" role="status" aria-live="polite"></p>
  </div>`;
}
const social = () => `<div class="social">
  <a class="social-link" href="${esc(curated.site.facebook)}" target="_blank" rel="noopener noreferrer" aria-label="IAmMoody on Facebook (opens in a new tab)">${ICONS.facebook}<span>Facebook</span></a>
  <a class="social-link" href="${esc(curated.site.instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Richard Moody on Instagram (opens in a new tab)">${ICONS.instagram}<span>Instagram</span></a>
</div>`;
// Invitation list signup (Mailchimp). A plain form POST to Mailchimp, so it works without JavaScript;
// site.js upgrades it to an in-page submit. Hidden when site.mailchimpForm is not set.
// Shown in the footer of every page, or as a band via {{partial:signup}} (which then replaces the footer one).
const signup = (band = false) => {
  const action = curated.site.mailchimpForm;
  if (!action) return '';
  const q = new URL(action).searchParams;
  const inner = `<div class="container signup">
      <div class="signup-copy">
        ${band ? '<p class="eyebrow light">Invitation list</p>' : ''}<h2 class="h3">${band ? 'Want to be at the next one?' : 'Get the invitation.'}</h2>
        <p class="muted">Holiday Charity Party, All Black Attire, runway nights: hear about them first. A few emails a year; unsubscribe anytime.</p>
      </div>
      <form class="signup-form" action="${esc(action)}" method="post" target="_blank">
        <label><span class="sr">First name</span><input name="FNAME" placeholder="First name" autocomplete="given-name"></label>
        <label><span class="sr">Email address</span><input type="email" name="EMAIL" placeholder="Email address" required autocomplete="email"></label>
        <div aria-hidden="true" class="hp"><input name="b_${esc(q.get('u'))}_${esc(q.get('id'))}" tabindex="-1" value="" autocomplete="off"></div>
        <button class="btn btn-primary" type="submit">Get invites</button>
        <p class="signup-status" role="status" aria-live="polite"></p>
      </form>
    </div>`;
  return band ? `<section class="signup-band">\n  ${inner}\n</section>` : inner;
};
const extLink = (href, text) => `<a class="mail-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;

// ---- partials -----------------------------------------------------------------
const partials = {
  signup: () => signup(true),

  stats: () => `<div class="stat-strip">${curated.stats.map((s) => `
    <div class="stat"><span class="stat-value">${esc(s.value)}</span><span class="stat-label">${esc(s.label)}</span>${s.note ? `<span class="stat-note">${esc(s.note)}</span>` : ''}</div>`).join('')}</div>`,

  'services-cards': () => `<div class="grid grid-3">${curated.services.map((s) => `
    <a class="card service-card${s.lead ? ' lead' : ''}" href="${s.slug === 'fashion-show-production' ? '/services/fashion-show-production' : '/services#' + s.slug}">
      ${img(s.image, s.title, '', 'card')}
      <div class="card-body"><h3>${esc(s.title)}</h3><p>${esc(s.blurb)}</p><span class="link-arrow">${s.lead ? 'Explore fashion shows' : 'Learn more'}</span></div>
    </a>`).join('')}</div>`,

  'services-detail': () => curated.services.map((s, i) => `
    <section class="split${i % 2 ? ' reverse' : ''}" id="${s.slug}">
      <div class="split-media">${img(s.image, s.title, '', 'split')}</div>
      <div class="split-copy">
        <p class="eyebrow">${s.lead ? 'Our specialty' : 'Also'}</p>
        <h2>${esc(s.title)}</h2>
        <p class="lead-text">${esc(s.blurb)}</p>
        <ul class="ticks">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        ${s.lead ? '<a class="btn btn-primary" href="/services/fashion-show-production">Fashion show production</a>' : '<a class="btn btn-ghost" href="/contact">Ask about this</a>'}
      </div>
    </section>`).join(''),

  'series-cards': () => `<div class="grid grid-3">${curated.series.map((s) => `
    <a class="card series-card" href="/events/${s.slug}" ${bg(s.image, 'card')}>
      <div class="series-card-body"><p class="eyebrow light">${esc(s.kicker)}</p><h3>${esc(s.short)}</h3><span class="link-arrow light">See the series</span></div>
    </a>`).join('')}</div>`,

  'case-grid': (limit) => {
    const list = limit ? curated.caseStudies.slice(0, +limit) : curated.caseStudies;
    return `<div class="grid grid-3">${list.map((c) => `
    <a class="card case-card" href="/work/${c.slug}">
      ${img(c.image, c.title, '', 'card')}
      <div class="card-body"><p class="tag">${esc(c.service)}</p><h3>${esc(c.title)}</h3><p class="muted">${esc(c.client)} · ${esc(c.year)}</p><p>${esc(c.summary)}</p></div>
    </a>`).join('')}</div>`;
  },

  clients: () => `<ul class="clients">${curated.clients.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`,

  // Rendered only when curated.json has testimonials: [{ "quote": "…", "name": "…", "role": "…" }]
  testimonials: () => testimonials(false),
  'testimonials-alt': () => testimonials(true),

  faq: () => `<div class="faq">${curated.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a).replace('{email}', `<a class="mail-link" href="mailto:${esc(curated.site.email)}">${esc(curated.site.email)}</a>`)}</p></details>`).join('')}</div>`,

  process: () => `<ol class="process">${curated.process.map((s, i) => `<li><span class="step">0${i + 1}</span><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p></li>`).join('')}</ol>`,

  milestones: () => `<ul class="milestones">${curated.milestones.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`,

  social,
  'events-index': () => eventsIndex(),
  'be-there': () => timeline(),
};

// ---- Be There: upcoming timeline ---------------------------------------------------
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const lastDay = (y, m) => `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;

/** What's coming, soonest first. Three sources:
 *  - upcoming events (exact date, filled dot);
 *  - series with `recurs: { month, label }` (next edition's month, hollow dot), until an event for that month is added;
 *  - `plans` in curated.json for one-offs known only roughly: { title, month: "2027-03", image, href?, note? }. */
function timelineItems() {
  const today = new Date().toISOString().slice(0, 10);
  const [ty, tm] = today.split('-').map(Number);
  const all = D.events();
  const recursLabel = (slug) => { const s = curated.series.find((x) => x.slug === slug); return (s && s.recurs && s.recurs.label) || ''; };
  const items = all.filter(D.isUpcoming).map((e) => {
    const [date, time] = e.when.split(' · ');
    return { sort: e.start, until: e.start.slice(0, 10), exact: true, when: date, sub: time || '', title: e.title, image: e.image, href: '/events/' + e.slug, place: e.venue, recurs: recursLabel(e.series) };
  });
  for (const s of curated.series.filter((x) => x.recurs)) {
    const m = s.recurs.month;
    let y = m >= tm ? ty : ty + 1;
    const held = (yy) => all.some((e) => e.series === s.slug && e.start.slice(0, 7) === `${yy}-${String(m).padStart(2, '0')}`);
    if (y === ty && m === tm && held(y) && !all.some((e) => e.series === s.slug && D.isUpcoming(e))) y++; // this month's edition already happened
    if (held(y)) continue; // the real event is on the calendar (and on the timeline above)
    items.push({ sort: `${y}-${String(m).padStart(2, '0')}`, until: lastDay(y, m), exact: false, when: `${MONTH_NAMES[m - 1]} ${y}`, sub: '', title: s.short, image: s.image, href: '/events/' + s.slug, place: '', recurs: s.recurs.label });
  }
  for (const p of curated.plans || []) {
    const [y, m] = (p.month || '').split('-').map(Number);
    if (!y || !m || lastDay(y, m) < today) continue;
    items.push({ sort: p.month, until: lastDay(y, m), exact: false, when: `${MONTH_NAMES[m - 1]} ${y}`, sub: p.note || '', title: p.title, image: p.image, href: p.href || '', place: '', recurs: '' });
  }
  return items.sort((a, b) => (a.sort < b.sort ? -1 : 1));
}

const RECUR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.6M20 4v4.6h-4.6M20 12a8 8 0 0 1-13.7 5.7L4 15.4M4 20v-4.6h4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Horizontal timeline: a dot per item on one line, the photo card hanging from it. Scrolls sideways when it
 *  runs out of room; site.js adds arrow buttons then, and hides items whose date passed since the last build. */
function timeline() {
  const items = timelineItems();
  if (!items.length) return '';
  const tag = (i, inner) => i.href ? `<a class="tl-card" href="${esc(i.href)}">${inner}</a>` : `<div class="tl-card">${inner}</div>`;
  return `<div class="tl" data-tl>
    <ol class="tl-track" data-tl-track>
      <li class="tl-now" aria-hidden="true"><span class="tl-dot"></span><span class="tl-now-label">Now</span></li>
      ${items.map((i) => `<li class="tl-item ${i.exact ? 'exact' : 'approx'}" data-until="${i.until}">
        <p class="tl-when"><span class="tl-date">${esc(i.when)}</span><span class="tl-sub">${esc(i.sub)}</span></p>
        <span class="tl-dot" aria-hidden="true"></span>
        ${tag(i, `${i.image ? img(i.image, '', '', 'card') : '<span class="tl-noimg"></span>'}
          <span class="tl-body">${i.recurs ? `<span class="tl-recurs">${RECUR_ICON}${esc(i.recurs)}</span>` : ''}<span class="tl-title">${esc(i.title)}</span>${i.place ? `<span class="tl-place">${esc(i.place)}</span>` : ''}</span>`)}
      </li>`).join('')}
    </ol>
    <div class="tl-foot">
      <p class="tl-legend"><span><i class="tl-key exact"></i>Date set</span><span><i class="tl-key approx"></i>Expected month</span><span class="tl-recurs">${RECUR_ICON}Every year</span></p>
      <div class="tl-nav" data-tl-nav hidden><button type="button" data-tl-prev aria-label="Earlier events">←</button><button type="button" data-tl-next aria-label="Later events">→</button></div>
    </div>
  </div>`;
}

function testimonials(alt) {
  const list = curated.testimonials || [];
  if (!list.length) return '';
  return `<section class="section${alt ? ' alt' : ''}"><div class="container">
    <p class="eyebrow">Kind words</p><h2 class="h3">What clients say.</h2>
    <div class="grid grid-3">${list.map((t) => `<figure class="quote"><blockquote>${esc(t.quote)}</blockquote><figcaption>${esc([t.name, t.role].filter(Boolean).join(', '))}</figcaption></figure>`).join('')}</div>
  </div></section>`;
}

function eventRow(e) {
  return `<li class="event-row" data-cats="${esc(e.categories.join('|'))}" data-series="${esc(e.series || '')}">
    <a href="/events/${esc(e.slug)}">
      <span class="event-date">${esc(e.when.replace(/ · .*/, ''))}</span>
      <span class="event-title">${esc(e.title)}</span>
      <span class="event-meta">${esc([e.venue, e.categories[0]].filter(Boolean).join(' · '))}</span>
    </a>
  </li>`;
}

function eventsIndex() {
  const all = D.events();
  const upcoming = all.filter(D.isUpcoming).reverse();
  const past = all.filter((e) => !D.isUpcoming(e));
  const cats = [...new Set(past.concat(upcoming).flatMap((e) => e.categories))].sort();
  const years = [...new Set(past.map((e) => e.year))];
  return `
  <section class="section" id="upcoming">
    <div class="container">
      <p class="eyebrow">Coming up</p>
      <h2>Upcoming events</h2>
      ${upcoming.length ? `<ul class="event-list">${upcoming.map(eventRow).join('')}</ul>` : `
      <div class="empty">
        <p>Our next event will be announced soon. Want to be invited? Email Richard at <a class="mail-link" href="mailto:${esc(curated.site.email)}">${esc(curated.site.email)}</a>, or follow along on ${extLink(curated.site.facebook, 'Facebook')} and ${extLink(curated.site.instagram, 'Instagram')}.</p>
      </div>`}
    </div>
  </section>
  <section class="section alt">
    <div class="container"><p class="eyebrow">Signature series</p><h2>Events with a history</h2>${partials['series-cards']()}</div>
  </section>
  <section class="section" id="archive">
    <div class="container">
      <p class="eyebrow">Archive</p>
      <h2>Past events</h2>
      <div class="chips" role="group" aria-label="Filter events" data-filter-chips>
        <button class="chip on" data-cat="">All</button>
        ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      ${years.map((y) => `<h3 class="year-h" data-year="${y}">${y}</h3><ul class="event-list" data-year-list="${y}">${past.filter((e) => e.year === y).map(eventRow).join('')}</ul>`).join('')}
    </div>
  </section>`;
}

// ---- dynamic pages --------------------------------------------------------------
const gallery = (list, credit) => list && list.length ? `
  <section class="section"><div class="container"><h2>Gallery</h2>
    <div class="masonry">${list.map((r) => `<a href="${mediaUrl(r)}" class="masonry-item" data-lightbox>${img(r, '', '', 'thumb')}</a>`).join('')}</div>
    ${credit ? `<p class="muted small">${esc(credit)}</p>` : ''}</div></section>` : '';

// Self-hosted clip (no third-party player). preload="none": nothing downloads until the visitor presses play.
const video = (src, poster) => src ? `
  <section class="section"><div class="container"><h2>Video</h2>
    <video class="event-video" controls playsinline preload="none"${poster ? ` poster="${esc(poster)}"` : ''}><source src="${esc(src)}" type="video/mp4"></video>
  </div></section>` : '';

function seriesPage(s) {
  const evs = D.events().filter((e) => e.series === s.slug);
  const body = `
  <section class="page-hero tall" ${bg(s.image)}>
    <div class="container"><p class="eyebrow light">${esc(s.kicker)}</p><h1>${esc(s.name)}</h1><p class="hero-sub">${esc(s.tagline)}</p></div>
  </section>
  <section class="section"><div class="container narrow">
    ${s.story.map((p) => `<p class="lead-text">${esc(p)}</p>`).join('')}
    <div class="facts">${s.facts.map((f) => `<div><span class="stat-value sm">${esc(f.value)}</span><span class="stat-label">${esc(f.label)}</span></div>`).join('')}</div>
  </div></section>
  ${gallery(s.gallery, s.galleryCredit)}
  ${evs.length ? `<section class="section alt"><div class="container"><h2>Every edition</h2><ul class="event-list">${evs.map(eventRow).join('')}</ul></div></section>` : ''}
  ${cta('Want an event like this?', 'We produce branded runway shows, charity galas and community celebrations.')}`;
  return { title: `${s.name} | IAmMoody`, description: s.tagline, ogImage: s.image, bodyClass: 'over-hero', content: body };
}

function casePage(c) {
  const series = c.series && curated.series.find((s) => s.slug === c.series);
  const idx = curated.caseStudies.indexOf(c);
  const next = curated.caseStudies[(idx + 1) % curated.caseStudies.length];
  const body = `
  <section class="page-hero ${c.heroPlain ? 'plain' : 'tall'}" ${c.heroPlain ? '' : bg(c.image)}>
    <div class="container"><p class="eyebrow light">${esc(c.service)}</p><h1>${esc(c.title)}</h1><p class="hero-sub">${esc(c.summary)}</p></div>
  </section>
  <section class="section"><div class="container case-layout">
    <aside class="case-meta">
      <dl><dt>Client</dt><dd>${esc(c.client)}</dd><dt>Service</dt><dd>${esc(c.service)}</dd><dt>When</dt><dd>${esc(c.year)}</dd><dt>Where</dt><dd>${esc(c.location)}</dd></dl>
      ${series ? `<a class="btn btn-ghost btn-sm" href="/events/${series.slug}">See the full series</a>` : ''}
    </aside>
    <div class="case-body">
      ${c.sections.map((s) => `<h2 class="h3">${esc(s.h)}</h2><p class="lead-text">${esc(s.p)}</p>`).join('')}
      <div class="facts">${c.stats.map((f) => `<div><span class="stat-value sm">${esc(f.value)}</span><span class="stat-label">${esc(f.label)}</span></div>`).join('')}</div>
    </div>
  </div></section>
  ${gallery(c.gallery)}
  <section class="section alt"><div class="container"><p class="eyebrow">Next case study</p><h2><a href="/work/${next.slug}">${esc(next.title)} →</a></h2></div></section>
  ${cta()}`;
  return { title: `${c.title} | IAmMoody`, description: c.summary, ogImage: c.image, bodyClass: 'over-hero', content: body };
}

function eventPage(e) {
  const related = D.events().filter((x) => e.series && x.series === e.series && x.id !== e.id).slice(0, 5);
  const series = e.series && curated.series.find((s) => s.slug === e.series);
  const body = `
  <section class="page-hero ${e.image ? 'tall' : 'plain'}" ${e.image ? `style="--img:url('${e.image}')"` : ''}>
    <div class="container"><p class="eyebrow light">${esc(e.categories.join(' · ') || 'Event')}</p><h1>${esc(e.title)}</h1><p class="hero-sub">${esc(e.when)}${e.venue ? ' · ' + esc(e.venue) : ''}</p></div>
  </section>
  <section class="section"><div class="container case-layout">
    <aside class="case-meta"><dl>
      <dt>When</dt><dd>${esc(e.when)}</dd>
      ${e.venue ? `<dt>Where</dt><dd>${esc(e.venue)}${e.address ? '<br>' + esc(e.address) : ''}</dd>` : ''}
      ${e.cost && !/^tbd$/i.test(e.cost.trim()) ? `<dt>Cost</dt><dd>${esc(e.cost)}</dd>` : ''}
    </dl>
    ${D.isUpcoming(e) && e.ticketUrl ? `<a class="btn btn-primary btn-sm" href="${esc(e.ticketUrl)}">${esc(e.linkLabel || 'Get tickets')}</a>` : ''}
    ${series ? `<a class="btn btn-ghost btn-sm" href="/events/${series.slug}">More: ${esc(series.short)}</a>` : ''}
    ${shareLinks('/events/' + e.slug, e.title, e.when)}
    ${D.isUpcoming(e) ? `<a class="btn btn-ghost btn-sm" href="/events/${esc(e.slug)}/card">Social card</a><p class="small muted">A phone-sized version of this event to screenshot for Instagram.</p>` : ''}${e.pressRelease ? `<a class="btn btn-ghost btn-sm" href="/events/${esc(e.slug)}/press">Press release</a><p class="small muted">A printable press release for this event. Print it, or save it as a PDF.</p>` : ''}
    </aside>
    <div class="case-body prose">${e.html || '<p class="muted">Details for this event are in our archive.</p>'}</div>
  </div></section>
  ${video(e.video, e.poster)}
  ${gallery(e.gallery)}
  ${related.length ? `<section class="section alt"><div class="container"><h2>Other editions</h2><ul class="event-list">${related.map(eventRow).join('')}</ul></div></section>` : ''}
  ${cta()}`;
  return { title: `${e.title} | IAmMoody`, description: e.excerpt, ogImage: e.image || curated.site.heroImage, bodyClass: 'over-hero', content: body };
}

/** Social card: the event as a phone-sized poster to screenshot and post (Instagram story or feed).
 *  A standalone page (no header/footer), so the screenshot holds only the card. */
function cardPage(e) {
  const [date, time] = e.when.split(' · ');
  const dateNoYear = (date || '').replace(/, \d{4}$/, '');
  const firstSentence = (/^[^.!?]{12,130}[.!?]/.exec(e.excerpt || '') || [''])[0];
  const line = e.tagline || firstSentence;
  const cost = e.cost && !/^tbd$/i.test(e.cost.trim()) ? e.cost : '';
  const host = PUBLIC_URL.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#0e0d0c">
  <title>${esc(e.title)} | Social card | IAmMoody</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/card.css">
</head>
<body class="card-page story">
  <article class="ad" aria-label="Event card">
    <div class="ad-media">${e.image ? `<img class="ad-photo" src="${e.image}" alt="">` : ''}</div>
    <p class="ad-mark">IAm<b>Moody</b></p>
    <div class="ad-body">
      <p class="ad-eyebrow">${esc(e.categories[0] || 'Event')}</p>
      <h1 class="ad-title">${esc(e.title)}</h1>
      <p class="ad-date">${esc(dateNoYear)}</p>
      ${time ? `<p class="ad-time">${esc(time)}</p>` : ''}
      ${e.venue ? `<p class="ad-venue">${esc(e.venue)}${e.address ? `<span>${esc(e.address)}</span>` : ''}</p>` : ''}
      ${line ? `<p class="ad-line">${esc(line)}</p>` : ''}
      <p class="ad-foot">${cost ? `<span class="ad-cost">${esc(cost)}</span>` : ''}<span class="ad-url">${esc(host)}</span></p>
    </div>
  </article>
  <div class="card-tools">
    <p>Take a screenshot of the card above and post it. <b>Story</b> fills the screen; <b>Feed</b> is the 4:5 shape for a regular post.</p>
    <div class="card-switch" role="group" aria-label="Card shape">
      <button type="button" data-shape="story" aria-pressed="true">Story</button>
      <button type="button" data-shape="feed" aria-pressed="false">Feed</button>
    </div>
    <p><a href="/events/${esc(e.slug)}">← Back to the event</a></p>
  </div>
  <script src="/assets/js/card.js"></script>
</body>
</html>
`;
}

/** Press release: the event's `pressRelease` text plus its details, laid out as a one- or two-page US Letter
 *  document. A standalone page (no header/footer); the visitor prints it or saves it as a PDF from the print dialog.
 *  Fields (all optional except headline and body): release, date, dateline, headline, subhead, body[], image, contact{name,email,phone}, about[]. */
function pressPage(e) {
  const pr = e.pressRelease, press = curated.site.press || {};
  const contact = { name: 'Richard Moody', email: curated.site.email, ...(press.contact || {}), ...(pr.contact || {}) };
  const about = pr.about || press.about || [];
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pr.date || '');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // No `date` set: press.js fills in the day it is opened (printed), so a fresh copy is always current.
  const date = d ? esc(`${MONTHS[+d[2] - 1]} ${+d[3]}, ${d[1]}`) : '';
  const dateline = `<b class="pr-dateline">${esc((pr.dateline || press.dateline || 'Minneapolis, MN').toUpperCase())}, <span${d ? '' : ' data-today'}>${date}</span> —</b> `;
  const image = pr.image === false ? null : pr.image || e.image;
  const bare = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const eventUrl = PUBLIC_URL + '/events/' + e.slug + '/';
  const cost = e.cost && !/^tbd$/i.test(e.cost.trim()) ? e.cost : '';
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${esc(e.title)} | Press release | IAmMoody</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/press.css">
</head>
<body class="press-page">
  <div class="pr-tools">
    <a href="/events/${esc(e.slug)}">← Back to the event</a>
    <button type="button" data-print>Print or save as PDF</button>
    <p>In the print dialog, choose <b>Save as PDF</b> as the printer to get a file you can email.</p>
  </div>
  <article class="sheet">
    <header class="pr-head">
      <p class="pr-mark">IAm<b>Moody</b></p>
      <dl class="pr-contact">
        <dt>Media contact</dt>
        <dd>${esc(contact.name)}</dd>
        ${contact.phone ? `<dd>${esc(contact.phone)}</dd>` : ''}
        <dd>${esc(contact.email)}</dd>
        <dd>${esc(bare(PUBLIC_URL))}</dd>
      </dl>
    </header>
    <p class="pr-release">${esc(pr.release || 'For immediate release')}</p>
    <h1 class="pr-headline">${esc(pr.headline || e.title)}</h1>
    ${pr.subhead ? `<p class="pr-subhead">${esc(pr.subhead)}</p>` : ''}
    ${image ? `<img class="pr-photo" src="${esc(image)}" alt="">` : ''}
    <div class="pr-body">${(pr.body || []).map((p, i) => `<p>${i === 0 ? dateline : ''}${esc(p)}</p>`).join('')}</div>
    <section class="pr-facts">
      <h2>Event details</h2>
      <dl>
        ${row('Event', esc(e.title))}
        ${row('When', esc(e.when))}
        ${row('Where', e.venue ? esc(e.venue) + (e.address ? '<br>' + esc(e.address) : '') : '')}
        ${row('Admission', esc(cost))}
        ${row(esc(e.linkLabel || 'Tickets'), e.ticketUrl ? esc(bare(e.ticketUrl)) : '')}
        ${row('Photos', esc(bare(eventUrl)))}
      </dl>
    </section>
    ${about.length ? `<section class="pr-about"><h2>About IAmMoody</h2>${about.map((p) => `<p>${esc(p)}</p>`).join('')}</section>` : ''}
    <p class="pr-end">###</p>
  </article>
  <script src="/assets/js/press.js"></script>
</body>
</html>
`;
}

/** Invoice maker at /invoice: not linked anywhere, noindex, left out of the sitemap. Everything happens in the
 *  browser (public/js/invoice.js): invoices are saved in that browser's localStorage and never leave the computer;
 *  "Print or save as PDF" produces the file. The defaults below only prefill the "From" block and service list. */
function invoicePage() {
  const defaults = {
    business: curated.site.name || 'IAmMoody', contact: (curated.site.press && curated.site.press.contact && curated.site.press.contact.name) || 'Richard Moody',
    email: curated.site.email, website: PUBLIC_URL.replace(/^https?:\/\//, ''), address: curated.site.location || '',
    services: curated.services.map((s) => s.title),
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Invoice | IAmMoody</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/invoice.css">
</head>
<body class="invoice-page">
  <script type="application/json" id="invoice-defaults">${JSON.stringify(defaults).replace(/</g, '\\u003c')}</script>
  <div class="iv-app">
    <form class="iv-editor" autocomplete="off" novalidate>
      <div class="iv-bar">
        <h1>Invoices</h1>
        <button type="button" class="iv-primary" data-act="print">Print or save as PDF</button>
        <p class="iv-hint">In the print dialog, choose <b>Save as PDF</b> as the printer. Changes save automatically in this browser only.</p>
      </div>

      <fieldset class="iv-files">
        <legend>Saved invoices</legend>
        <label>Open <select data-k="__open"></select></label>
        <div class="iv-row-btns">
          <button type="button" data-act="new">New</button>
          <button type="button" data-act="duplicate">Duplicate</button>
          <button type="button" data-act="delete">Delete</button>
        </div>
        <div class="iv-row-btns">
          <button type="button" data-act="export">Back up all (.json)</button>
          <button type="button" data-act="import">Restore from backup</button>
          <input type="file" accept="application/json,.json" data-import hidden>
        </div>
      </fieldset>

      <fieldset>
        <legend>Invoice</legend>
        <div class="iv-grid">
          <label>Invoice no. <input data-k="number"></label>
          <label>Status
            <select data-k="status"><option value="">Unpaid</option><option value="paid">Paid</option><option value="draft">Draft</option></select>
          </label>
          <label>Issue date <input type="date" data-k="issued"></label>
          <label>Payment terms
            <select data-k="terms">
              <option value="0">Due on receipt</option><option value="7">Net 7</option><option value="15">Net 15</option>
              <option value="30">Net 30</option><option value="45">Net 45</option><option value="custom">Pick a date</option>
            </select>
          </label>
          <label data-show="terms=custom">Due date <input type="date" data-k="due"></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Event / project</legend>
        <label>Name <input data-k="project" placeholder="e.g. Spring Runway Showcase"></label>
        <div class="iv-grid">
          <label>Start date <input type="date" data-k="eventStart"></label>
          <label>End date <input type="date" data-k="eventEnd"></label>
        </div>
        <label>Venue / location <input data-k="venue"></label>
        <label>Summary <textarea data-k="summary" rows="2" placeholder="Optional: one or two lines about the work"></textarea></label>
      </fieldset>

      <fieldset>
        <legend>Bill to</legend>
        <div class="iv-grid">
          <label>Contact name <input data-k="client.name"></label>
          <label>Company <input data-k="client.company"></label>
          <label>Email <input type="email" data-k="client.email"></label>
          <label>Phone <input type="tel" data-k="client.phone"></label>
        </div>
        <label>Address <textarea data-k="client.address" rows="2"></textarea></label>
      </fieldset>

      <fieldset>
        <legend>Services</legend>
        <div class="iv-items" data-items></div>
        <button type="button" data-act="add-item">+ Add a line</button>
        <datalist id="iv-services"></datalist>
      </fieldset>

      <fieldset>
        <legend>Totals</legend>
        <div class="iv-grid">
          <label>Discount
            <span class="iv-pair"><input type="number" step="0.01" min="0" data-k="discount" inputmode="decimal">
            <select data-k="discountType" aria-label="Discount type"><option value="amount">$</option><option value="percent">%</option></select></span>
          </label>
          <label>Sales tax % <input type="number" step="0.001" min="0" data-k="taxRate" inputmode="decimal"></label>
          <label>Deposit / already paid ($) <input type="number" step="0.01" min="0" data-k="paid" inputmode="decimal"></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Payment and notes</legend>
        <label>How to pay <textarea data-k="payment" rows="3" placeholder="e.g. Zelle to richard@iammoody.com, or check payable to IAmMoody"></textarea></label>
        <label>Notes / terms <textarea data-k="notes" rows="3" placeholder="e.g. Thank you for your business."></textarea></label>
        <p class="iv-hint">"How to pay" and "Notes" carry over to new invoices.</p>
      </fieldset>

      <fieldset>
        <legend>From (your details)</legend>
        <div class="iv-grid">
          <label>Business <input data-k="from.business"></label>
          <label>Name <input data-k="from.contact"></label>
          <label>Email <input type="email" data-k="from.email"></label>
          <label>Phone <input type="tel" data-k="from.phone"></label>
          <label>Website <input data-k="from.website"></label>
        </div>
        <label>Address <textarea data-k="from.address" rows="2"></textarea></label>
        <p class="iv-hint">Remembered for every new invoice.</p>
      </fieldset>
    </form>

    <article class="sheet" data-sheet aria-live="polite"></article>
  </div>
  <script src="/assets/js/invoice.js"></script>
</body>
</html>
`;
}

// ---- static page fragments ---------------------------------------------------------
function staticPage(file) {
  if (!fs.existsSync(file)) return null;
  let src = fs.readFileSync(file, 'utf8');
  let meta = {};
  src = src.replace(/^<!--meta (\{[\s\S]*?\}) -->\s*/, (_, j) => { meta = JSON.parse(j); return ''; });
  src = src.replace(/<!--[\s\S]*?-->\s*/g, ''); // authoring notes and commented-out sections are never published
  src = src.replace(/\{\{partial:([\w-]+)(?::(\d+))?\}\}/g, (_, name, arg) => (partials[name] ? partials[name](arg) : `<!-- missing partial ${name} -->`));
  src = src.replace(/\{\{cta(?::([^}]*))?\}\}/g, (_, a) => { const [h, p] = (a || '').split('|'); return cta(h || undefined, p || undefined); });
  src = src.replace(/\{\{img:([^|}]+)(?:\|([^}]*))?\}\}/g, (_, rel, alt) => img(rel, alt || '', '', 'split'));
  src = src.replace(/\{\{bg:([^}]+)\}\}/g, (_, rel) => bg(rel));
  src = src.replace(/\{\{site\.(\w+)\}\}/g, (_, k) => esc(curated.site[k] || ''));
  return { ...meta, content: src };
}

function nav(pathname) {
  return NAV.map(([href, label]) => `<a href="${href}"${pathname === href || pathname.startsWith(href + '/') ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('');
}

function wrap(page, pathname) {
  const layout = read('layout.html');
  const ogImage = page.ogImage ? mediaUrl(page.ogImage) : mediaUrl(curated.site.heroImage);
  const vals = {
    title: esc(page.title || 'IAmMoody | Fashion Show & Event Production, Minneapolis'),
    description: esc(page.description || curated.site.tagline),
    ogImage, email: esc(curated.site.email), social: social(), bodyClass: page.bodyClass || '', nav: nav(pathname), year: String(new Date().getFullYear()),
    signup: page.content.includes('signup-form') ? '' : signup(), // one signup form per page
  };
  // single pass, function replacer: every token everywhere, and '$' in content can't be misread
  return layout.replace(/\{\{(title|description|ogImage|email|social|bodyClass|nav|year|signup)\}\}/g, (_, k) => vals[k])
    .replace('{{content}}', () => page.content);
}

const STATIC = { '/': 'index', '/services': 'services', '/services/fashion-show-production': 'services/fashion-show-production', '/events': 'events', /* '/be-there': 'be-there', parked */ '/work': 'work', '/about': 'about', '/contact': 'contact', '/privacy': 'privacy' };

/** Returns { status, html } or null when the path is not a public page. */
function render(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  let page = null;
  if (STATIC[p]) page = staticPage(path.join(D.ROOT, 'pages', STATIC[p] + '.html'));
  else {
    let m;
    if ((m = /^\/events\/([^/]+)\/card$/.exec(p))) {
      const e = D.events().find((x) => x.slug === m[1]);
      return e ? { status: 200, html: cardPage(e) } : null;
    } else if (p === '/invoice') {
      return { status: 200, html: invoicePage() };
    } else if ((m = /^\/events\/([^/]+)\/press$/.exec(p))) {
      const e = D.events().find((x) => x.slug === m[1] && x.pressRelease);
      return e ? { status: 200, html: pressPage(e) } : null;
    } else if ((m = /^\/events\/([^/]+)$/.exec(p))) {
      const s = curated.series.find((x) => x.slug === m[1]);
      const e = !s && D.events().find((x) => x.slug === m[1]);
      page = s ? seriesPage(s) : e ? eventPage(e) : null;
    } else if ((m = /^\/work\/([^/]+)$/.exec(p))) {
      const c = curated.caseStudies.find((x) => x.slug === m[1]);
      page = c ? casePage(c) : null;
    }
  }
  if (!page) return null;
  return { status: 200, html: wrap(page, p) };
}

function notFound() {
  const page = staticPage(path.join(D.ROOT, 'pages', '404.html'));
  return { status: 404, html: wrap(page, '/404') };
}

/** Every public route, for the static build. */
function allRoutes() {
  return [...Object.keys(STATIC), ...curated.series.map((s) => '/events/' + s.slug), ...curated.caseStudies.map((c) => '/work/' + c.slug), ...D.events().map((e) => '/events/' + e.slug),
    ...D.events().filter(D.isUpcoming).map((e) => '/events/' + e.slug + '/card'),
    ...D.events().filter((e) => e.pressRelease).map((e) => '/events/' + e.slug + '/press'), '/invoice'];
}

module.exports = { render, notFound, allRoutes, partials };
