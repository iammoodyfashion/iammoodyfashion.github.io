/* IAmMoody social card: Story / Feed switch. Remembers the choice in the address (#feed) so a reload keeps it. */
(function () {
  'use strict';
  var body = document.body;
  var buttons = document.querySelectorAll('[data-shape]');
  function set(shape) {
    body.classList.remove('story', 'feed');
    body.classList.add(shape);
    Array.prototype.forEach.call(buttons, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-shape') === shape)); });
    history.replaceState(null, '', shape === 'feed' ? '#feed' : location.pathname + location.search);
  }
  Array.prototype.forEach.call(buttons, function (b) {
    b.addEventListener('click', function () { set(b.getAttribute('data-shape')); });
  });
  if (location.hash === '#feed') set('feed');
})();
