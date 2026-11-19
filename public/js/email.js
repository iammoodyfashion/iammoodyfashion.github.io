/* IAmMoody email invitation (lib/render.js emailPage): copy the subject, the email (for pasting into Gmail)
   or its HTML code (for Mailchimp's "Paste in code"). Images get their full public address (data-abs) in the copy. */
(function () {
  'use strict';
  var status = document.querySelector('.em-status');
  var src = document.getElementById('em-email');
  var timer;
  function say(msg) {
    status.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(function () { status.textContent = ''; }, 4000);
  }
  // A copy of the email with absolute image addresses and no helper attributes.
  function emailHtml() {
    var clone = src.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('img[data-abs]'), function (img) {
      img.setAttribute('src', img.getAttribute('data-abs'));
      img.removeAttribute('data-abs');
    });
    return clone.innerHTML.trim();
  }
  function fullDocument(body) {
    var title = document.getElementById('em-subject').textContent;
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>'
      + title.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</title>\n</head>\n<body style="margin:0;padding:0;background:#f6f2ea;">\n' + body + '\n</body>\n</html>\n';
  }
  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackText(text, done); });
    } else fallbackText(text, done);
  }
  function fallbackText(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    ok ? done() : say('Copy did not work. Select the text and copy it by hand.');
  }
  // Rich copy: Gmail keeps the layout when it receives text/html.
  function copyRich(done) {
    var html = emailHtml();
    var text = src.innerText;
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]).then(done, function () { fallbackRich(html, done); });
    } else fallbackRich(html, done);
  }
  // Older browsers: render the absolute-image copy off screen, select it and copy the selection.
  function fallbackRich(html, done) {
    var box = document.createElement('div');
    box.innerHTML = html; box.style.position = 'fixed'; box.style.left = '-10000px';
    document.body.appendChild(box);
    var range = document.createRange(); range.selectNodeContents(box);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
    sel.removeAllRanges(); document.body.removeChild(box);
    ok ? done() : say('Copy did not work. Select the email below and copy it by hand.');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () {
      var what = btn.getAttribute('data-copy');
      if (what === 'subject') copyText(document.getElementById('em-subject').textContent, function () { say('Subject copied.'); });
      else if (what === 'html') copyText(fullDocument(emailHtml()), function () { say('HTML copied. Paste it into Mailchimp.'); });
      else copyRich(function () { say('Email copied. Paste it into a new Gmail message.'); });
    });
  });
})();
