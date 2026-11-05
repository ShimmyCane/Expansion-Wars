// Expansion Wars — the unit scale's ⚙️: notes for the family database, with the screen they were written on.
(function () {
  'use strict';
  var V4 = window.V4;
  var $ = function (id) { return document.getElementById(id); };

  function open(on) {
    $('settings-panel').hidden = !on;
    $('gear').setAttribute('aria-expanded', String(on));
  }

  // What is on screen right now, for the note.
  function view() {
    if (!$('screen-setup').hidden) return 'Unit scale: set-up';
    var st = V4.view && V4.view.state ? V4.view.state() : null;
    if (!st) return 'Unit scale';
    var s = Math.floor(st.t), m = Math.floor(s / 60);
    return 'Unit scale: battle, seed ' + st.seed + ', ' + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60) + (st.done ? ', over' : '');
  }

  $('gear').addEventListener('click', function () { open($('settings-panel').hidden); });
  $('settings-close').addEventListener('click', function () { open(false); });
  if (window.XWNotes) XWNotes.attach({ panel: $('settings-panel'), page: 'Unit scale', context: view });
  // Battle replays go to the family database when signed in; load that session once, as the settings used to.
  if (V4.replays) V4.replays.getSession();
})();
