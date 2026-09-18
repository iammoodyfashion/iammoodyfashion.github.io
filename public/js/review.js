/* Review tables for the old WordPress content. Config comes from window.REVIEW = { kind: 'posts' | 'media' }.
   Decisions are saved to the server (site/data/decisions.json) as you go. */
(function () {
  'use strict';
  var KIND = window.REVIEW.kind;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var bytes = function (n) { return !n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; };
  var debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };

  var STATUSES = KIND === 'posts'
    ? [{ v: '', l: 'Unreviewed' }, { v: 'archive', l: 'Archive' }, { v: 'mine', l: 'Mine for content' }]
    : [{ v: '', l: 'Unreviewed' }, { v: 'use', l: 'Use' }, { v: 'discard', l: 'Discard' }];
  var HOTKEYS = KIND === 'posts' ? { a: 'archive', m: 'mine', u: '' } : { u: 'use', d: 'discard', r: '' };

  var state = { rows: [], dec: { posts: {}, media: {} }, q: '', f: {}, sort: KIND === 'posts' ? { k: 'date', d: -1 } : { k: 'year', d: -1 }, page: 1, size: 50, view: [], open: null, expanded: {} };
  var idOf = function (r) { return KIND === 'posts' ? String(r.id) : r.rel; };
  var decOf = function (r) { return state.dec[KIND][idOf(r)] || { status: '', note: '' }; };

  // ---------- data ----------
  Promise.all([fetch('/api/review/' + KIND).then(function (r) { return r.json(); }), fetch('/api/decisions').then(function (r) { return r.json(); })])
    .then(function (res) { state.rows = res[0].rows; state.dec = res[1]; state.dec.posts = state.dec.posts || {}; state.dec.media = state.dec.media || {}; setup(); refresh(); })
    .catch(function (e) { $('#table-wrap').innerHTML = '<p class="err">Could not load data: ' + esc(e.message) + '</p>'; });

  function save(id, patch) {
    var cur = state.dec[KIND][id] || { status: '', note: '' };
    if (patch.status !== undefined) cur.status = patch.status;
    if (patch.note !== undefined) cur.note = patch.note;
    if (!cur.status && !cur.note) delete state.dec[KIND][id]; else state.dec[KIND][id] = cur;
    flash('Saving…');
    return fetch('/api/decisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ kind: KIND, id: id }, patch)) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); flash('Saved'); })
      .catch(function () { flash('SAVE FAILED, is the server running?', true); });
  }
  var flashT;
  function flash(msg, bad) { var el = $('#flash'); el.textContent = msg; el.className = bad ? 'bad' : ''; clearTimeout(flashT); flashT = setTimeout(function () { el.textContent = ''; }, 2500); }

  // ---------- filters ----------
  function opts(values, all) { return '<option value="">' + all + '</option>' + values.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join(''); }
  function setup() {
    var f = $('#filters');
    var uniq = function (fn) { var s = {}; state.rows.forEach(function (r) { [].concat(fn(r)).forEach(function (v) { if (v) s[v] = (s[v] || 0) + 1; }); }); return Object.keys(s).sort(); };
    var decOpts = '<option value="">Any decision</option>' + STATUSES.map(function (s) { return '<option value="' + (s.v || '_none') + '">' + s.l + '</option>'; }).join('');
    if (KIND === 'posts') {
      f.innerHTML = sel('year', opts(uniq(function (r) { return r.year; }).reverse(), 'All years')) + sel('cat', opts(uniq(function (r) { return r.categories; }), 'All categories')) +
        sel('words', '<option value="">Any length</option><option value="50">50+ words</option><option value="150">150+ words</option><option value="400">400+ words</option>') +
        sel('imgs', '<option value="">Any images</option><option value="1">Has images</option><option value="0">No images</option>') + sel('dec', decOpts);
    } else {
      f.innerHTML = sel('year', opts(uniq(function (r) { return r.year; }).reverse(), 'All years')) +
        sel('status', '<option value="">Any availability</option><option value="local">Downloaded</option><option value="gone">404 on old site</option><option value="missing">Not downloaded</option>') +
        sel('use', '<option value="">Used or unused</option><option value="used">Used in posts/pages</option><option value="unused">Not used anywhere</option>') +
        sel('kind', '<option value="">All files</option><option value="orig">Originals only</option><option value="variant">Resized variants only</option><option value="img">Images only</option><option value="other">Non-images</option>') +
        sel('size', '<option value="">Any size</option><option value="600">Wider than 600px</option><option value="1200">Wider than 1200px</option><option value="small">Under 600px</option>') + sel('dec', decOpts);
    }
    f.addEventListener('change', function (e) { var k = e.target.getAttribute('data-f'); if (k) { state.f[k] = e.target.value; state.page = 1; refresh(); } });
    $('#q').addEventListener('input', debounce(function (e) { state.q = e.target.value.trim().toLowerCase(); state.page = 1; refresh(); }, 180));
    $('#size').addEventListener('change', function (e) { state.size = +e.target.value; state.page = 1; refresh(); });
    $('#reset').addEventListener('click', function () { state.q = ''; state.f = {}; state.page = 1; $('#q').value = ''; f.querySelectorAll('select').forEach(function (s) { s.value = ''; }); refresh(); });
    $('#export').addEventListener('click', exportCsv);
    $('#bulk-apply').addEventListener('click', bulkApply);
    $('#bulk-status').innerHTML = STATUSES.map(function (s) { return '<option value="' + s.v + '">' + s.l + '</option>'; }).join('');
    $('#table-wrap').addEventListener('click', onTableClick);
    $('#table-wrap').addEventListener('change', onTableChange);
    document.addEventListener('keydown', onKey);
    document.querySelectorAll('.pager').forEach(function (p) { p.addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (!b) return; state.page = Math.max(1, Math.min(pages(), +b.getAttribute('data-p'))); render(); window.scrollTo({ top: $('#table-wrap').offsetTop - 120 }); }); });
  }
  function sel(k, html) { return '<select data-f="' + k + '">' + html + '</select>'; }

  function matches(r) {
    var f = state.f, d = decOf(r).status;
    if (f.year && r.year !== f.year) return false;
    if (f.dec && (f.dec === '_none' ? d !== '' : d !== f.dec)) return false;
    if (KIND === 'posts') {
      if (f.cat && r.categories.indexOf(f.cat) < 0) return false;
      if (f.words && r.words < +f.words) return false;
      if (f.imgs === '1' && !r.images) return false;
      if (f.imgs === '0' && r.images) return false;
      if (state.q && (r.title + ' ' + r.excerpt + ' ' + r.tags.join(' ') + ' ' + r.categories.join(' ')).toLowerCase().indexOf(state.q) < 0) return false;
    } else {
      if (f.status && r.status !== f.status) return false;
      if (f.use === 'used' && !r.used) return false;
      if (f.use === 'unused' && r.used) return false;
      var isImg = /^image\//.test(r.mime);
      if (f.kind === 'orig' && r.variant) return false;
      if (f.kind === 'variant' && !r.variant) return false;
      if (f.kind === 'img' && !isImg) return false;
      if (f.kind === 'other' && isImg) return false;
      if (f.size === 'small' && !(r.w && r.w < 600)) return false;
      if (f.size && f.size !== 'small' && !(r.w && r.w > +f.size)) return false;
      if (state.q) {
        var hay = (r.rel + ' ' + r.alt + ' ' + r.title + ' ' + (r.parent ? r.parent.title : '') + ' ' + r.usedBy.map(function (u) { return u.title; }).join(' ') + ' ' + decOf(r).note).toLowerCase();
        if (hay.indexOf(state.q) < 0) return false;
      }
    }
    return true;
  }
  var SORTERS = {
    date: function (r) { return r.date; }, title: function (r) { return r.title.toLowerCase(); }, words: function (r) { return r.words; }, images: function (r) { return r.images; },
    year: function (r) { return (r.year || '0000') + '/' + r.rel; }, rel: function (r) { return r.rel; }, size: function (r) { return r.size; }, used: function (r) { return r.used; }, w: function (r) { return r.w || 0; }, status: function (r) { return r.status; },
    dec: function (r) { return decOf(r).status || 'zzz'; }
  };
  function refresh() {
    var k = state.sort.k, d = state.sort.d, fn = SORTERS[k];
    state.view = state.rows.filter(matches).sort(function (a, b) { var x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * d; });
    render();
  }
  var pages = function () { return Math.max(1, Math.ceil(state.view.length / state.size)); };

  // ---------- render ----------
  function statusSelect(r) {
    var cur = decOf(r).status;
    return '<select class="st st-' + (cur || 'none') + '" data-act="status">' + STATUSES.map(function (s) { return '<option value="' + s.v + '"' + (s.v === cur ? ' selected' : '') + '>' + s.l + '</option>'; }).join('') + '</select>';
  }
  function head() {
    var cols = KIND === 'posts'
      ? [['dec', 'Decision'], ['date', 'Date'], ['title', 'Title'], [null, 'Category'], [null, 'Tags'], ['words', 'Words'], ['images', 'Imgs'], [null, 'Links'], [null, 'Notes']]
      : [['dec', 'Decision'], [null, 'Preview'], ['rel', 'File'], ['year', 'Year'], ['w', 'Size'], ['status', 'Availability'], ['used', 'Used in'], [null, 'Details'], [null, 'Notes']];
    return '<thead><tr>' + cols.map(function (c) {
      if (!c[0]) return '<th>' + c[1] + '</th>';
      var on = state.sort.k === c[0];
      return '<th class="sortable' + (on ? ' on' : '') + '" data-sort="' + c[0] + '">' + c[1] + (on ? (state.sort.d > 0 ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('') + '</tr></thead>';
  }
  function rowPost(r, i) {
    var d = decOf(r), base = r.dir ? '/export/posts/' + encodeURIComponent(r.dir) : null;
    return '<tr data-i="' + i + '" class="row-' + (d.status || 'none') + '"><td>' + statusSelect(r) + '</td><td class="nowrap">' + esc(r.date) + '</td>' +
      '<td class="title"><a href="#" data-act="open">' + esc(r.title) + '</a><div class="sub">' + esc(r.excerpt.slice(0, 140)) + '</div></td>' +
      '<td>' + esc(r.categories.join(', ')) + '</td><td class="tags">' + r.tags.slice(0, 5).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</td>' +
      '<td class="num">' + r.words + '</td><td class="num">' + r.images + '</td>' +
      '<td class="nowrap"><a href="' + esc(r.url) + '" target="_blank" rel="noopener">original ↗</a>' + (base ? ' · <a href="' + base + '/index.html" target="_blank">html</a> · <a href="' + base + '/index.md" target="_blank">md</a>' : '') + '</td>' +
      '<td><input class="note" data-act="note" value="' + esc(d.note) + '" placeholder="note…" maxlength="2000"></td></tr>';
  }
  var STATUS_LABEL = { local: 'Downloaded', gone: '404 on old site', missing: 'Not downloaded' };
  function rowMedia(r, i) {
    var d = decOf(r), isImg = /^image\//.test(r.mime), id = r.rel;
    var thumb = r.status === 'gone' ? '<div class="ph">404</div>' : isImg ? '<img loading="lazy" decoding="async" src="/media/' + r.rel.split('/').map(encodeURIComponent).join('/') + '" alt="">' : '<div class="ph">' + esc((r.mime.split('/')[1] || 'file').toUpperCase()) + '</div>';
    var used = r.used ? '<button class="linklike" data-act="used">' + r.used + ' ▾</button>' : '<span class="muted">unused</span>';
    var details = [r.title && r.title !== r.name.replace(/\.[^.]+$/, '') ? esc(r.title) : '', r.alt ? '<em>alt:</em> ' + esc(r.alt) : '', r.parent ? '<em>uploaded to:</em> ' + esc(r.parent.title) : '', r.variant ? '<span class="badge">resized variant</span>' : '', !r.inLibrary ? '<span class="badge">referenced only</span>' : ''].filter(Boolean).join('<br>');
    var html = '<tr data-i="' + i + '" class="row-' + (d.status || 'none') + '"><td>' + statusSelect(r) + '</td><td class="thumb"><a href="#" data-act="open" class="thumb-link">' + thumb + '</a></td>' +
      '<td class="file"><a href="#" data-act="open"><b>' + esc(r.name) + '</b></a><div class="sub">' + esc(r.rel.replace(r.name, '')) + '</div></td><td>' + esc(r.year) + '</td>' +
      '<td class="nowrap">' + (r.w ? r.w + '×' + r.h + '<br>' : '') + bytes(r.size) + '</td><td><span class="avail avail-' + r.status + '">' + STATUS_LABEL[r.status] + '</span></td>' +
      '<td>' + used + '</td><td class="details">' + details + '</td><td><input class="note" data-act="note" value="' + esc(d.note) + '" placeholder="e.g. hero, gallery, logo…" maxlength="2000"></td></tr>';
    if (state.expanded[id] && r.used) {
      html += '<tr class="subrow"><td></td><td colspan="8"><b>Used in:</b> ' + r.usedBy.map(function (u) {
        var href = u.dir ? '/export/' + u.dir.split('/').map(encodeURIComponent).join('/') + (u.dir.indexOf('/') < 0 ? '' : '') + '/index.html' : '#';
        return '<a href="' + (u.t === 'post' && u.dir ? '/export/posts/' + encodeURIComponent(u.dir) + '/index.html' : href) + '" target="_blank">' + esc(u.title) + '</a> <span class="badge">' + u.t + '</span>';
      }).join(' · ') + (r.used > r.usedBy.length ? ' · … and ' + (r.used - r.usedBy.length) + ' more' : '') + '</td></tr>';
    }
    return html;
  }
  function render() {
    var total = state.view.length, p = Math.min(state.page, pages()); state.page = p;
    var slice = state.view.slice((p - 1) * state.size, p * state.size);
    $('#table-wrap').innerHTML = '<table class="rt">' + head() + '<tbody>' + (slice.length ? slice.map(function (r, j) { var i = (p - 1) * state.size + j; return KIND === 'posts' ? rowPost(r, i) : rowMedia(r, i); }).join('') : '<tr><td colspan="9" class="empty">Nothing matches these filters.</td></tr>') + '</tbody></table>';
    var pager = '<button data-p="1"' + (p === 1 ? ' disabled' : '') + '>«</button><button data-p="' + (p - 1) + '"' + (p === 1 ? ' disabled' : '') + '>‹ Prev</button><span>Page ' + p + ' of ' + pages() + '</span><button data-p="' + (p + 1) + '"' + (p === pages() ? ' disabled' : '') + '>Next ›</button><button data-p="' + pages() + '"' + (p === pages() ? ' disabled' : '') + '>»</button>';
    document.querySelectorAll('.pager').forEach(function (el) { el.innerHTML = pager; });
    $('#bulk-count').textContent = total;
    stats();
  }
  function stats() {
    var c = { '': 0 }; STATUSES.forEach(function (s) { c[s.v] = 0; });
    state.rows.forEach(function (r) { c[decOf(r).status]++; });
    var reviewed = state.rows.length - c[''];
    $('#stats').innerHTML = '<b>' + state.rows.length.toLocaleString() + '</b> ' + KIND + ' · showing <b>' + state.view.length.toLocaleString() + '</b> · ' +
      STATUSES.slice(1).map(function (s) { return s.l + ': <b>' + c[s.v] + '</b>'; }).join(' · ') + ' · Reviewed <b>' + reviewed + '</b> (' + Math.round(reviewed / state.rows.length * 100) + '%)';
    $('#bar').style.width = (reviewed / state.rows.length * 100) + '%';
  }

  // ---------- interaction ----------
  function rowFromEl(el) { var tr = el.closest('tr[data-i]'); return tr ? state.view[+tr.getAttribute('data-i')] : null; }
  function onTableClick(e) {
    var th = e.target.closest('th[data-sort]');
    if (th) { var k = th.getAttribute('data-sort'); state.sort = { k: k, d: state.sort.k === k ? -state.sort.d : (k === 'title' || k === 'rel' ? 1 : -1) }; return refresh(); }
    var a = e.target.closest('[data-act]'); if (!a) return;
    var act = a.getAttribute('data-act'), r = rowFromEl(a);
    if (act === 'open' && r) { e.preventDefault(); openViewer(state.view.indexOf(r)); }
    if (act === 'used' && r) { state.expanded[idOf(r)] = !state.expanded[idOf(r)]; render(); }
  }
  function onTableChange(e) {
    var a = e.target.closest('[data-act]'); if (!a) return;
    var r = rowFromEl(a); if (!r) return;
    if (a.getAttribute('data-act') === 'status') { save(idOf(r), { status: a.value }).then(function () { if (state.f.dec) refresh(); else { a.className = 'st st-' + (a.value || 'none'); a.closest('tr').className = 'row-' + (a.value || 'none'); stats(); } }); }
    if (a.getAttribute('data-act') === 'note') save(idOf(r), { note: a.value });
  }
  function bulkApply() {
    var status = $('#bulk-status').value, n = state.view.length, label = STATUSES.filter(function (s) { return s.v === status; })[0].l;
    if (!n) return;
    if (!confirm('Set ' + n + ' filtered ' + KIND + ' to "' + label + '"?\nThis overwrites any existing decision on those rows (notes are kept).')) return;
    var ids = state.view.map(idOf);
    fetch('/api/decisions/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: KIND, ids: ids, status: status }) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function () { ids.forEach(function (id) { var c = state.dec[KIND][id] || { status: '', note: '' }; c.status = status; if (!c.status && !c.note) delete state.dec[KIND][id]; else state.dec[KIND][id] = c; }); flash(n + ' updated'); refresh(); })
      .catch(function () { flash('Bulk update failed', true); });
  }
  function exportCsv() {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var head, lines;
    if (KIND === 'posts') { head = ['decision', 'note', 'id', 'date', 'title', 'categories', 'tags', 'words', 'images', 'original_url', 'export_folder']; lines = state.view.map(function (r) { var d = decOf(r); return [d.status, d.note, r.id, r.date, r.title, r.categories.join('; '), r.tags.join('; '), r.words, r.images, r.url, r.dir ? 'posts/' + r.dir : ''].map(q).join(','); }); }
    else { head = ['decision', 'note', 'file', 'year', 'width', 'height', 'bytes', 'availability', 'used_in_count', 'alt', 'uploaded_to', 'live_url']; lines = state.view.map(function (r) { var d = decOf(r); return [d.status, d.note, r.rel, r.year, r.w, r.h, r.size, r.status, r.used, r.alt, r.parent ? r.parent.title : '', r.url].map(q).join(','); }); }
    var blob = new Blob([head.join(',') + '\n' + lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'iammoody-' + KIND + '-review.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- viewer (posts: preview pane, media: large image) ----------
  function openViewer(i) {
    if (i < 0 || i >= state.view.length) return;
    state.open = i;
    var r = state.view[i], v = $('#viewer'), d = decOf(r);
    var body;
    if (KIND === 'posts') {
      body = r.dir ? '<iframe title="preview" src="/export/posts/' + encodeURIComponent(r.dir) + '/index.html"></iframe>' : '<p class="empty">No exported copy found.</p>';
    } else {
      body = /^image\//.test(r.mime) && r.status !== 'gone' ? '<div class="imgwrap"><img src="/media/' + r.rel.split('/').map(encodeURIComponent).join('/') + '" alt=""></div>' : '<p class="empty">' + (r.status === 'gone' ? 'This file returns 404 on the old site and was not recovered.' : 'No preview available.') + '</p>';
    }
    var title = KIND === 'posts' ? r.title : r.rel;
    var meta = KIND === 'posts' ? r.date + ' · ' + r.words + ' words · ' + r.images + ' images' : (r.w ? r.w + '×' + r.h + ' · ' : '') + bytes(r.size) + ' · used in ' + r.used;
    var hint = Object.keys(HOTKEYS).map(function (k) { return '<kbd>' + k.toUpperCase() + '</kbd> ' + (STATUSES.filter(function (s) { return s.v === HOTKEYS[k]; })[0].l); }).join('  ');
    v.innerHTML = '<div class="v-head"><div><b>' + esc(title) + '</b><div class="sub">' + esc(meta) + ' · ' + (i + 1) + ' of ' + state.view.length + '</div></div><button data-v="close" aria-label="Close">✕</button></div>' +
      '<div class="v-body">' + body + '</div>' +
      '<div class="v-foot"><div class="v-btns">' + STATUSES.map(function (s) { return '<button data-v="set" data-s="' + s.v + '" class="' + (d.status === s.v ? 'on ' : '') + 'st-' + (s.v || 'none') + '">' + s.l + '</button>'; }).join('') + '</div>' +
      '<input id="v-note" placeholder="note…" value="' + esc(d.note) + '" maxlength="2000"><div class="v-nav"><button data-v="prev">← Prev</button><button data-v="next">Next →</button></div><div class="hint">' + hint + ' · <kbd>←</kbd><kbd>→</kbd> navigate · <kbd>Esc</kbd> close</div></div>';
    v.hidden = false; document.body.classList.add('viewing');
    $('#v-note').addEventListener('change', function (e) { save(idOf(r), { note: e.target.value }); });
  }
  function syncViewer() { // update decision buttons without reloading the preview
    var cur = decOf(state.view[state.open]).status;
    document.querySelectorAll('#viewer .v-btns button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === cur); });
  }
  function closeViewer() { $('#viewer').hidden = true; document.body.classList.remove('viewing'); state.open = null; render(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]'); if (!b) return;
    var act = b.getAttribute('data-v');
    if (act === 'close') closeViewer();
    if (act === 'prev') openViewer(state.open - 1);
    if (act === 'next') openViewer(state.open + 1);
    if (act === 'set') { var r = state.view[state.open]; save(idOf(r), { status: b.getAttribute('data-s') }).then(syncViewer); }
  });
  function onKey(e) {
    if (state.open == null || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Escape') return closeViewer();
    if (e.key === 'ArrowRight' || e.key === 'j') return openViewer(state.open + 1);
    if (e.key === 'ArrowLeft' || e.key === 'k') return openViewer(state.open - 1);
    var k = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(HOTKEYS, k) && !e.metaKey && !e.ctrlKey) { var r = state.view[state.open]; save(idOf(r), { status: HOTKEYS[k] }).then(syncViewer); }
  }
})();
