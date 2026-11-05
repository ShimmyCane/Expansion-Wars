// Expansion Wars — V4 settings (⚙️, lower right): family database sign-in, and the version.
// Sign-in and saving are in replays.js. This file only shows the status and takes the clicks.
(function () {
  'use strict';
  var V4 = window.V4;
  var VERSION = '4.3';
  var LOG = [
    ['4.3', 'Planned marches with editable routes (tap, drag, insert); two formations that arrange by role and take one command; a third team with allies that win together; defending; geography seed and site toggles; collapsible panels; random teams for everyone; numbers scroll to adjust'],
    ['4.2', 'Battlefield generator: 2 × 2 field with mini map, walled settlements with 2 to 4 openings, roads, rivers with bridges, tall grass hiding, fronts and flanks, fatigue, default approaches, random balanced teams, hidden units strike on your word, outnumbered units fall back'],
    ['4.1', 'Version number in settings; family sign-in in a ⚙️ panel; replays saved to the family database'],
    ['4.0', 'Custom battle: deployment, fog and vision, defender plan, attack and rush moves, morale rally, fixed-step replays']
  ];
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

  function showVersion() {
    $('app-version').textContent = VERSION;
    var list = $('version-log');
    LOG.forEach(function (row) {
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.textContent = row[0] + ' ';
      li.appendChild(b);
      li.appendChild(document.createTextNode(row[1]));
      list.appendChild(li);
    });
  }

  function wire() {
    showVersion();
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
