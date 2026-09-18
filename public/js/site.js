/* IAmMoody: small progressive enhancements. Pages work without JavaScript. */
(function () {
  'use strict';
  var body = document.body;

  // mobile nav
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    var open = body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // header background after scroll (transparent over hero)
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 40); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  // reveal on scroll
  var targets = document.querySelectorAll('.section .card, .section h2, .stat, .split-copy, .masonry-item, .event-row, .quote');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  // event archive filter
  var chips = document.querySelector('[data-filter-chips]');
  if (chips) chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    chips.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
    var cat = b.getAttribute('data-cat');
    document.querySelectorAll('#archive .event-row').forEach(function (li) {
      var cats = (li.getAttribute('data-cats') || '').split('|');
      li.classList.toggle('hidden', !!cat && cats.indexOf(cat) === -1);
    });
    document.querySelectorAll('#archive [data-year-list]').forEach(function (ul) {
      var any = ul.querySelector('.event-row:not(.hidden)');
      ul.classList.toggle('hidden', !any);
      var h = document.querySelector('#archive [data-year="' + ul.getAttribute('data-year-list') + '"]');
      if (h) h.classList.toggle('hidden', !any);
    });
  });

  // lightbox
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lightbox]'); if (!a) return;
    e.preventDefault();
    var lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog');
    lb.innerHTML = '<img alt="" src="' + a.getAttribute('href') + '">';
    lb.addEventListener('click', function () { lb.remove(); });
    document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(lb);
  });

  // contact form: open the visitor's email app with the message filled in (mailto:).
  // Without JavaScript the form's own mailto: action still works, just with plainer formatting.
  var inquiry = document.getElementById('inquiry');
  if (inquiry) {
    var TO = (inquiry.getAttribute('action') || '').replace(/^mailto:/i, '').split('?')[0];
    var MAX_URL = 1900; // some email apps and browsers truncate longer mailto: links
    var LABELS = [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['organization', 'Organization'], ['eventType', 'Event type'],
                  ['date', 'Event date'], ['location', 'Location'], ['guests', 'Expected guests'], ['budget', 'Budget'], ['source', 'Heard about us via']];
    var clean = function (v) { return String(v || '').replace(/\r\n?/g, '\n').trim(); };
    var compose = function (d) {
      var details = LABELS.filter(function (l) { return clean(d[l[0]]); }).map(function (l) { return l[1] + ': ' + clean(d[l[0]]).replace(/\s*\n\s*/g, ' '); });
      var subject = 'Event inquiry' + (clean(d.eventType) ? ': ' + clean(d.eventType) : '') + ' - ' + clean(d.name).replace(/\s+/g, ' ');
      var text = 'Hello Richard,\n\n' + clean(d.message) + '\n\n---\n' + details.join('\n') + '\n';
      return { subject: subject, text: text };
    };
    var toUrl = function (m) { return 'mailto:' + TO + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.text.replace(/\n/g, '\r\n')); };

    var status = inquiry.querySelector('.form-status'), fallback = document.getElementById('mailto-fallback');
    var again = document.getElementById('mailto-again'), copyBtn = document.getElementById('copy-message'), copyStatus = document.getElementById('copy-status');
    var last = null;

    inquiry.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {}; new FormData(inquiry).forEach(function (v, k) { data[k] = v; });
      var full = clean(data.message), m = compose(data), url = toUrl(m), trimmed = false;
      last = compose(data); // the complete, untrimmed text, used by the "copy your message" button
      while (url.length > MAX_URL && full.length > 100) { // shorten the message until the link fits
        full = full.slice(0, Math.floor(full.length * 0.85)).trim();
        m = compose(Object.assign({}, data, { message: full + '\n[message shortened: use "copy your message" on the site to get all of it]' }));
        url = toUrl(m); trimmed = true;
      }
      inquiry.setAttribute('data-mailto', url);
      again.setAttribute('href', url);
      fallback.hidden = false; copyStatus.textContent = '';
      status.className = 'form-status ok';
      status.textContent = trimmed ? 'Opening your email app. Your message was long, so use "copy your message" below to paste all of it.' : 'Opening your email app…';
      window.location.href = url;
    });

    var copy = function (text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      return new Promise(function (resolve, reject) { // older browsers / plain http
        var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        try { document.execCommand('copy') ? resolve() : reject(); } catch (err) { reject(err); } finally { t.remove(); }
      });
    };
    copyBtn.addEventListener('click', function () {
      if (!last) return;
      copy('To: ' + TO + '\nSubject: ' + last.subject + '\n\n' + last.text)
        .then(function () { copyStatus.textContent = 'Copied. Paste it into a new email.'; })
        .catch(function () { copyStatus.textContent = 'Could not copy automatically. Please select your message in the form and copy it.'; });
    });
  }
})();
