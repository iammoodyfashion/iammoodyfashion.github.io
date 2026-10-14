/* IAmMoody press release: print button, and today's date in the dateline when the release has no fixed `date`. */
(function () {
  'use strict';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var now = new Date();
  Array.prototype.forEach.call(document.querySelectorAll('[data-today]'), function (el) {
    el.textContent = MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  });
  var btn = document.querySelector('[data-print]');
  if (btn) btn.addEventListener('click', function () { window.print(); });
})();
