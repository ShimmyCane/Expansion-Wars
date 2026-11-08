// Expansion Wars — the floating ⚙️: settings, notes and reset zoom, on every screen except the game.
(function () {
  'use strict';

  // The page does not zoom (iPhone and iPad): pinches and double taps belong to the canvas, not the page.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  var gear = document.getElementById('float-gear');
  var panel = document.getElementById('float-panel');
  var reset = document.getElementById('float-reset-zoom');
  var note = document.getElementById('float-note');
  // Notes go to the family database from this panel, with the screen they were written on.
  if (window.XWNotes) {
    XWNotes.attach({
      panel: panel, page: 'Country scale',
      context: function () {
        var screen = document.querySelector('.screen:not([hidden])');
        return 'Country scale' + (screen && screen.id ? ': ' + screen.id.replace(/^screen-/, '') : '');
      }
    });
  }

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
