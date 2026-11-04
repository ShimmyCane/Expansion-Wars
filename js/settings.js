// Expansion Wars — the floating ⚙️: settings, version and reset zoom, on every screen except the game.
(function () {
  'use strict';

  var VERSION = '2.0 (country layer)';
  var gear = document.getElementById('float-gear');
  var panel = document.getElementById('float-panel');
  var reset = document.getElementById('float-reset-zoom');
  var note = document.getElementById('float-note');
  document.getElementById('app-version').textContent = VERSION;

  function setOpen(open) {
    panel.hidden = !open;
    gear.setAttribute('aria-expanded', String(open));
  }

  gear.addEventListener('click', function () { setOpen(panel.hidden); });

  // Each screen with zoom listens for this event and resets its own zoom (the game does so now).
  reset.addEventListener('click', function () {
    document.dispatchEvent(new CustomEvent('ew:reset-zoom'));
    note.textContent = 'Zoom reset.';
  });
})();
