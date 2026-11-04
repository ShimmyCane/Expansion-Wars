// Expansion Wars — V4 settings (⚙️, lower right): family database sign-in, and the version.
// Sign-in and saving are in replays.js. This file only shows the status and takes the clicks.
(function () {
  'use strict';
  var V4 = window.V4;
  var $ = function (id) { return document.getElementById(id); };

  function open(on) {
    $('settings-panel').hidden = !on;
    $('gear').setAttribute('aria-expanded', String(on));
  }

  function render(status, signedIn) {
    var waiting = V4.replays.waiting();
    var text = status.message;
    if (!signedIn && waiting) text += ' ' + waiting + ' replay' + (waiting === 1 ? '' : 's') + ' waiting on this device.';
    $('fam-status').textContent = text;
    $('fam-form').hidden = !!signedIn;
    $('fam-send').hidden = !signedIn || !waiting;
    $('fam-signout').hidden = !signedIn;
  }

  function wire() {
    $('gear').addEventListener('click', function () { open($('settings-panel').hidden); });
    $('settings-close').addEventListener('click', function () { open(false); });
    V4.replays.onStatus(render);
    V4.replays.getSession();
    $('fam-form').addEventListener('submit', function (e) {
      e.preventDefault();
      $('fam-result').textContent = 'Signing in…';
      V4.replays.signIn($('fam-email').value.trim(), $('fam-pass').value).then(function (msg) {
        $('fam-pass').value = '';
        $('fam-result').textContent = msg;
      }).catch(function (err) {
        $('fam-result').textContent = 'Sign in failed: ' + (err && err.message ? err.message : err);
      });
    });
    $('fam-send').addEventListener('click', function () {
      $('fam-result').textContent = 'Sending…';
      V4.replays.sendPending().then(function (msg) { $('fam-result').textContent = msg; });
    });
    $('fam-signout').addEventListener('click', function () {
      V4.replays.signOut().then(function () { $('fam-result').textContent = ''; });
    });
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
