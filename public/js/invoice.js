/* IAmMoody invoice maker (/invoice). Everything stays in this browser: invoices live in localStorage under
   "iammoody-invoices"; "Back up all" downloads them as a .json file and "Restore from backup" reads one back.
   The sheet on the right is redrawn on every keystroke; printing shows only the sheet (see invoice.css). */
(function () {
  'use strict';
  var KEY = 'iammoody-invoices';
  var DEFAULTS = JSON.parse(document.getElementById('invoice-defaults').textContent);
  var form = document.querySelector('.iv-editor');
  var sheet = document.querySelector('[data-sheet]');
  var itemsBox = document.querySelector('[data-items]');
  var openSel = form.querySelector('[data-k="__open"]');
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ---- helpers ----
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function cents(n) { return Math.round(n * 100) / 100; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmt(s) { var d = parse(s); return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() : ''; }
  function range(a, b) {
    var x = parse(a), y = parse(b);
    if (!x) return fmt(b);
    if (!y || a === b) return fmt(a);
    if (x.getFullYear() === y.getFullYear()) {
      if (x.getMonth() === y.getMonth()) return MONTHS[x.getMonth()] + ' ' + x.getDate() + '–' + y.getDate() + ', ' + y.getFullYear();
      return MONTHS[x.getMonth()] + ' ' + x.getDate() + ' – ' + fmt(b);
    }
    return fmt(a) + ' – ' + fmt(b);
  }
  function get(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split('.'), last = ks.pop(); ks.forEach(function (k) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[last] = v; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---- storage ----
  var canSave = true, store;
  try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { canSave = false; }
  if (!store || typeof store !== 'object' || !store.invoices) store = { v: 1, settings: {}, invoices: {}, current: null };
  if (!store.settings.from) store.settings.from = { business: DEFAULTS.business, contact: DEFAULTS.contact, email: DEFAULTS.email, phone: '', website: DEFAULTS.website, address: DEFAULTS.address };
  if (!store.settings.services) store.settings.services = [];
  function save() {
    if (!canSave) return;
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { canSave = false; warn('This browser is not saving invoices (private window or storage full). Use "Back up all" before closing.'); }
  }
  function warn(msg) { var h = form.querySelector('.iv-bar .iv-hint'); h.textContent = msg; h.style.color = 'var(--red)'; }
  if (!canSave) warn('This browser is not saving invoices (private window?). Use "Back up all" before closing.');

  function nextNumber() {
    var y = new Date().getFullYear(), max = 0, re = new RegExp('^' + y + '-(\\d+)$');
    Object.keys(store.invoices).forEach(function (id) { var m = re.exec(store.invoices[id].number || ''); if (m) max = Math.max(max, +m[1]); });
    var n = String(max + 1); while (n.length < 3) n = '0' + n;
    return y + '-' + n;
  }
  function blankItem() { return { date: '', service: '', desc: '', qty: 1, rate: '' }; }
  function newInvoice(base) {
    var inv = base ? clone(base) : {
      status: '', terms: '30', due: '', project: '', eventStart: '', eventEnd: '', venue: '', summary: '',
      client: { name: '', company: '', email: '', phone: '', address: '' },
      items: [blankItem()], discount: '', discountType: 'amount', taxRate: '', paid: '',
      payment: store.settings.payment || '', notes: store.settings.notes || '', from: clone(store.settings.from),
    };
    inv.id = uid(); inv.number = nextNumber(); inv.issued = iso(new Date()); inv.updated = Date.now();
    if (base) inv.status = '';
    store.invoices[inv.id] = inv; store.current = inv.id; save();
    return inv;
  }
  function cur() { return store.invoices[store.current]; }
  if (!cur()) { var ids = Object.keys(store.invoices); if (ids.length) store.current = sorted()[0].id; else newInvoice(); }

  function sorted() { return Object.keys(store.invoices).map(function (id) { return store.invoices[id]; }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }); }

  // ---- maths ----
  function totals(inv) {
    var sub = cents(inv.items.reduce(function (s, it) { return s + num(it.qty) * num(it.rate); }, 0));
    var disc = inv.discountType === 'percent' ? cents(sub * num(inv.discount) / 100) : cents(num(inv.discount));
    disc = Math.min(Math.max(disc, 0), sub);
    var tax = cents((sub - disc) * num(inv.taxRate) / 100);
    var total = cents(sub - disc + tax), paid = cents(num(inv.paid));
    return { sub: sub, disc: disc, tax: tax, total: total, paid: paid, balance: cents(total - paid) };
  }
  function dueDate(inv) {
    if (inv.terms === 'custom') return inv.due;
    var d = parse(inv.issued); if (!d) return '';
    d.setDate(d.getDate() + num(inv.terms)); return iso(d);
  }

  // ---- editor ----
  function fillForm() {
    var inv = cur();
    Array.prototype.forEach.call(form.querySelectorAll('[data-k]'), function (el) {
      var k = el.getAttribute('data-k'); if (k === '__open') return;
      var v = get(inv, k); el.value = v == null ? '' : v;
    });
    if (inv.terms !== 'custom' && !inv.due) form.querySelector('[data-k="due"]').value = dueDate(inv);
    fillItems(); fillOpen(); fillServices(); toggles();
  }
  function fillOpen() {
    openSel.innerHTML = sorted().map(function (inv) {
      var who = (inv.client && (inv.client.company || inv.client.name)) || 'No client yet';
      return '<option value="' + esc(inv.id) + '"' + (inv.id === store.current ? ' selected' : '') + '>' + esc(inv.number + ' · ' + who + ' · ' + money.format(totals(inv).total)) + '</option>';
    }).join('');
  }
  function fillServices() {
    var seen = {}, list = [];
    DEFAULTS.services.concat(store.settings.services).forEach(function (s) { var k = s.toLowerCase(); if (s && !seen[k]) { seen[k] = 1; list.push(s); } });
    document.getElementById('iv-services').innerHTML = list.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('');
  }
  function fillItems() {
    var inv = cur(), n = inv.items.length;
    itemsBox.innerHTML = inv.items.map(function (it, i) {
      var f = function (name, type, extra) { return '<input ' + (type ? 'type="' + type + '" ' : '') + 'data-i="' + i + '" data-f="' + name + '" value="' + esc(it[name]) + '"' + (extra || '') + '>'; };
      return '<div class="iv-item">' +
        '<div class="iv-item-tools"><b>Line ' + (i + 1) + '</b>' +
        '<button type="button" data-act="up" data-i="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="Move line ' + (i + 1) + ' up">↑</button>' +
        '<button type="button" data-act="down" data-i="' + i + '"' + (i < n - 1 ? '' : ' disabled') + ' aria-label="Move line ' + (i + 1) + ' down">↓</button>' +
        '<button type="button" data-act="remove" data-i="' + i + '" aria-label="Remove line ' + (i + 1) + '">Remove</button></div>' +
        '<label>Service ' + f('service', '', ' list="iv-services" placeholder="Pick or type a service"') + '</label>' +
        '<label>Description <textarea rows="2" data-i="' + i + '" data-f="desc" placeholder="Optional details">' + esc(it.desc) + '</textarea></label>' +
        '<div class="iv-item-3">' +
        '<label>Date ' + f('date', 'date') + '</label>' +
        '<label>Qty / hrs ' + f('qty', 'number', ' step="any" min="0" inputmode="decimal"') + '</label>' +
        '<label>Rate ($) ' + f('rate', 'number', ' step="0.01" min="0" inputmode="decimal"') + '</label>' +
        '</div></div>';
    }).join('');
  }
  function toggles() {
    Array.prototype.forEach.call(form.querySelectorAll('[data-show]'), function (el) {
      var p = el.getAttribute('data-show').split('='); el.hidden = form.querySelector('[data-k="' + p[0] + '"]').value !== p[1];
    });
  }

  function touch() { cur().updated = Date.now(); save(); renderSheet(); fillOpen(); }

  form.addEventListener('input', function (e) {
    var el = e.target, inv = cur();
    if (el.hasAttribute('data-f')) { inv.items[+el.getAttribute('data-i')][el.getAttribute('data-f')] = el.value; return touch(); }
    var k = el.getAttribute('data-k'); if (!k || k === '__open') return;
    set(inv, k, el.value);
    // Your own details, payment instructions and notes carry over to the next new invoice.
    if (k.indexOf('from.') === 0) set(store.settings, k, el.value);
    if (k === 'payment' || k === 'notes') store.settings[k] = el.value;
    if (k === 'terms' || k === 'issued') {
      if (inv.terms === 'custom') { if (!inv.due) inv.due = dueDate(Object.assign({}, inv, { terms: '30' })); }
      else inv.due = '';
      form.querySelector('[data-k="due"]').value = inv.due || dueDate(inv);
      toggles();
    }
    touch();
  });
  // Remember typed service names for the suggestion list once a line is finished.
  form.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-f') === 'service' && el.value.trim()) {
      var v = el.value.trim();
      if (!store.settings.services.some(function (s) { return s.toLowerCase() === v.toLowerCase(); })) { store.settings.services.push(v); save(); fillServices(); }
    }
    if (el === openSel) { store.current = el.value; save(); fillForm(); renderSheet(); }
  });

  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), inv = cur(), i = +b.getAttribute('data-i');
    if (act === 'print') return printIt();
    if (act === 'new') { newInvoice(); fillForm(); renderSheet(); form.querySelector('[data-k="client.name"]').focus(); return; }
    if (act === 'duplicate') { newInvoice(inv); fillForm(); renderSheet(); return; }
    if (act === 'delete') {
      if (!confirm('Delete invoice ' + inv.number + '? This cannot be undone (unless you have a backup).')) return;
      delete store.invoices[inv.id];
      var rest = sorted(); if (rest.length) { store.current = rest[0].id; save(); } else newInvoice();
      fillForm(); renderSheet(); return;
    }
    if (act === 'export') return exportAll();
    if (act === 'import') return form.querySelector('[data-import]').click();
    if (act === 'add-item') {
      var last = inv.items[inv.items.length - 1], it = blankItem();
      if (last && last.date) it.date = last.date;
      inv.items.push(it); fillItems(); touch();
      var boxes = itemsBox.querySelectorAll('[data-f="service"]'); boxes[boxes.length - 1].focus(); return;
    }
    if (act === 'remove') { inv.items.splice(i, 1); if (!inv.items.length) inv.items.push(blankItem()); fillItems(); return touch(); }
    if (act === 'up' || act === 'down') {
      var j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= inv.items.length) return;
      var t = inv.items[i]; inv.items[i] = inv.items[j]; inv.items[j] = t; fillItems(); touch();
      var btn = itemsBox.querySelector('[data-act="' + act + '"][data-i="' + j + '"]'); if (btn && !btn.disabled) btn.focus();
    }
  });

  // ---- backup / restore ----
  function exportAll() {
    var blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'iammoody-invoices-' + iso(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  form.querySelector('[data-import]').addEventListener('change', function (e) {
    var file = e.target.files[0]; e.target.value = ''; if (!file) return;
    file.text().then(function (txt) {
      var data = JSON.parse(txt);
      if (!data || typeof data.invoices !== 'object') throw new Error('not an invoice backup');
      var n = Object.keys(data.invoices).length;
      if (!confirm('Restore ' + n + ' invoice' + (n === 1 ? '' : 's') + ' from this backup? Invoices with the same ID are replaced; others are kept.')) return;
      Object.keys(data.invoices).forEach(function (id) { var inv = data.invoices[id]; if (inv && Array.isArray(inv.items)) { inv.id = id; store.invoices[id] = inv; } });
      if (data.settings) { store.settings = Object.assign({}, store.settings, data.settings); if (!store.settings.services) store.settings.services = []; }
      if (!cur()) store.current = sorted()[0].id;
      save(); fillForm(); renderSheet();
    }).catch(function (err) { alert('Could not read that file: ' + err.message); });
  });

  // ---- the sheet ----
  function lines(arr) { return arr.filter(function (s) { return s && String(s).trim(); }).map(esc).join('\n'); }
  function renderSheet() {
    var inv = cur(), t = totals(inv), from = inv.from || {}, c = inv.client || {};
    var biz = from.business || 'IAmMoody';
    var mark = /^IAmMoody$/i.test(biz.trim()) ? 'IAm<b>Moody</b>' : esc(biz);
    var due = dueDate(inv), when = range(inv.eventStart, inv.eventEnd);
    var meta = [['Invoice no.', inv.number], ['Issued', fmt(inv.issued)], ['Due', inv.terms === '0' ? 'On receipt' : fmt(due)]]
      .filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    var items = inv.items.filter(function (it) { return it.service || it.desc || num(it.rate) || it.date; });
    var anyDate = items.some(function (it) { return it.date; });
    var rows = items.map(function (it) {
      return '<tr>' + (anyDate ? '<td class="date">' + esc(fmt(it.date)) + '</td>' : '') +
        '<td>' + (it.service ? '<div class="in-svc">' + esc(it.service) + '</div>' : '') + (it.desc ? '<div class="in-desc">' + esc(it.desc) + '</div>' : '') + '</td>' +
        '<td class="num">' + esc(String(num(it.qty))) + '</td><td class="num">' + money.format(num(it.rate)) + '</td><td class="num">' + money.format(cents(num(it.qty) * num(it.rate))) + '</td></tr>';
    }).join('') || '<tr class="in-screen"><td class="in-empty" colspan="' + (anyDate ? 5 : 4) + '">Add a service under "Services".</td></tr>';
    var tot = '<dt>Subtotal</dt><dd>' + money.format(t.sub) + '</dd>';
    if (t.disc) tot += '<dt>Discount' + (inv.discountType === 'percent' ? ' (' + esc(String(num(inv.discount))) + '%)' : '') + '</dt><dd>−' + money.format(t.disc) + '</dd>';
    if (num(inv.taxRate)) tot += '<dt>Sales tax (' + esc(String(num(inv.taxRate))) + '%)</dt><dd>' + money.format(t.tax) + '</dd>';
    if (t.paid) tot += '<dt>Total</dt><dd>' + money.format(t.total) + '</dd><dt>Paid</dt><dd>−' + money.format(t.paid) + '</dd>';
    var dueLabel = inv.status === 'paid' && t.balance <= 0 ? 'Balance' : 'Amount due';
    tot += '<dt class="in-due">' + dueLabel + '</dt><dd class="in-due">' + money.format(t.balance) + '</dd>';

    var project = '';
    if (inv.project || when || inv.venue || inv.summary) {
      project = '<div><h2>Event / project</h2>' +
        (inv.project ? '<p class="in-strong">' + esc(inv.project) + '</p>' : '') +
        '<p>' + lines([when, inv.venue]) + '</p>' +
        (inv.summary ? '<p class="in-summary">' + esc(inv.summary) + '</p>' : '') + '</div>';
    }

    sheet.innerHTML =
      '<header class="in-head"><div><p class="in-mark">' + mark + '</p>' +
      '<p class="in-from">' + lines([from.contact, from.address, from.phone, from.email, from.website]) + '</p></div>' +
      '<div class="in-title"><h1>Invoice</h1><dl class="in-meta">' + meta + '</dl></div></header>' +
      '<section class="in-parties"><div><h2>Bill to</h2>' +
      ((c.company || c.name) ? '<p class="in-strong">' + esc(c.company || c.name) + '</p>' : '<p class="in-summary in-screen">Add the client under "Bill to".</p>') +
      '<p>' + lines([c.company ? c.name : '', c.address, c.phone, c.email]) + '</p></div>' + project + '</section>' +
      '<table class="in-table"><thead><tr>' + (anyDate ? '<th>Date</th>' : '') + '<th>Service</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="in-sum">' + (inv.status ? '<div class="in-stamp ' + esc(inv.status) + '">' + esc(inv.status) + '</div>' : '') +
      '<dl class="in-totals">' + tot + '</dl></div>' +
      (inv.payment ? '<section class="in-block in-pay"><h2>How to pay</h2><p>' + esc(inv.payment) + '</p></section>' : '') +
      (inv.notes ? '<section class="in-block"><h2>Notes</h2><p>' + esc(inv.notes) + '</p></section>' : '') +
      '<p class="in-foot">Thank you.</p>';
  }

  // The PDF's default file name comes from the page title, so set it to something useful while printing.
  function printIt() {
    var inv = cur(), c = inv.client || {}, who = c.company || c.name, old = document.title;
    document.title = ('Invoice ' + inv.number + (who ? ' - ' + who : '')).replace(/[\\/:*?"<>|]+/g, '-');
    window.addEventListener('afterprint', function restore() { document.title = old; window.removeEventListener('afterprint', restore); });
    window.print();
  }

  fillForm(); renderSheet();
})();
