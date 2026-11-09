// Expansion Wars — the ⚙️ panel: the world (seed, new world), saving (this device and the family database),
// the time dilation of each scale, and notes with the family sign-in (shared/notes.js).
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, W = XW.world, C = XW.country, D = XW.core, bus = XW.core.bus;
  var el = D.el, button = D.button;
  var lines = { device: null, cloud: null, world: null };

  function describe() {
    var w = W.get();
    if (!w) return A.describeMode();
    var s = w.view.scale, p = W.prov(w, w.view.prov);
    return A.describeMode() + ' · ' + s + ' · turn ' + w.time.turn + (p && s !== 'country' ? ' · ' + W.label(p.tier) + ' of ' + W.ownerName(w, p.owner) : '');
  }

  // Province battles: a button for every level you have reached, with the one you are on pressed.
  function levelButtons() {
    var w = W.get();
    if (!lines.levels || !w) return;
    D.clear(lines.levels);
    for (var n = 1; n <= A.modes.unlocked(); n++) {
      (function (level) {
        lines.levels.appendChild(button('Level ' + level, function () {
          if (level !== (W.get() || {}).level && !window.confirm('Start level ' + level + '? The level you are on is not kept.')) return;
          A.modes.level(level);
          levelButtons();
          worldLine();
        }, { pressed: level === w.level }));
      })(n);
    }
  }

  function difficultyButtons() {
    var w = W.get();
    if (!lines.difficulty || !w) return;
    D.clear(lines.difficulty);
    var DD = C.CONFIG.DIFFICULTY;
    Object.keys(DD).forEach(function (level) {
      lines.difficulty.appendChild(button(DD[level].label, function () {
        var cur = W.get();
        cur.difficulty = level;
        W.log(cur, 'Difficulty changed to ' + DD[level].label + ' (the computer plays that way from now on).');
        difficultyButtons();
        W.changed('difficulty');
      }, { pressed: (w.difficulty || 'easy') === level }));
    });
  }

  function worldLine() {
    var w = W.get();
    levelButtons();
    difficultyButtons();
    if (!w || !lines.world) return;
    lines.world.textContent = 'Map seed ' + w.seed + ' · turn ' + w.time.turn + ' · world ' + w.id.slice(0, 8) + '.';
  }

  function build(body) {
    body.appendChild(el('p', 'small', A.describeMode() + '. The other modes are on the home page.'));
    if (A.mode.id === 'province') {
      body.appendChild(el('h3', '', 'Level'));
      lines.levels = el('div', 'row');
      body.appendChild(lines.levels);
      var sur = el('label', 'check'), box = el('input');
      box.type = 'checkbox'; box.checked = A.surrenderOn();
      box.addEventListener('change', function () { A.setSurrender(box.checked); });
      sur.appendChild(box);
      sur.appendChild(document.createTextNode(' Surrender: a side outnumbered ' + XW.province.CONFIG.SURRENDER + ' to 1 gives up (you too)'));
      body.appendChild(sur);
    }
    if (A.mode.turns) {
      // The difficulty of the world being played. Changing it here changes how the computer plays from now on;
      // the starting stocks were given when the world began.
      body.appendChild(el('h3', '', 'Difficulty'));
      lines.difficulty = el('div', 'row');
      body.appendChild(lines.difficulty);
    }
    body.appendChild(el('h3', '', 'World'));
    lines.world = el('p', 'small');
    body.appendChild(lines.world);
    var row = el('div', 'row'), seed = el('input');
    seed.type = 'number'; seed.min = 1; seed.placeholder = 'random seed';
    seed.setAttribute('aria-label', 'Map seed');
    row.appendChild(seed);
    row.appendChild(button('New world', function () {
      if (!window.confirm('Start a new world? This one stays in the family database if it was saved there, but not on this device.')) return;
      var w = A.modes.fresh(D.parseSeed(seed.value));
      W.set(w);
      A.scales.open(w, w.view.scale);
      A.saveNow('button');
      worldLine();
      A.modes.pickDifficulty(w);
    }));
    body.appendChild(row);

    body.appendChild(el('h3', '', 'Saving'));
    lines.device = el('p', 'small', 'Saved on this device after every turn, scale change and battle.');
    lines.cloud = el('p', 'small', W.cloud.status().message);
    body.appendChild(lines.device);
    body.appendChild(lines.cloud);
    var srow = el('div', 'row');
    srow.appendChild(button('Save now', function () { A.saveNow('button'); }));
    srow.appendChild(button('Load the latest from the family database', function () {
      lines.cloud.textContent = 'Loading…';
      W.cloud.latest().then(function (w) {
        if (!w) { lines.cloud.textContent = 'No world in the family database yet.'; return; }
        W.set(w);
        A.scales.open(w, w.view.scale);
        W.saveLocal(w);
        worldLine();
        lines.cloud.textContent = 'Loaded the world saved at turn ' + w.time.turn + '.';
      }).catch(function (err) { lines.cloud.textContent = 'Could not load: ' + (err && err.message ? err.message : err); });
    }));
    body.appendChild(srow);

    body.appendChild(el('h3', '', 'Time'));
    var R = W.CONFIG.RATE;
    body.appendChild(el('p', 'small', 'One world clock. A country turn is ' + W.CONFIG.TURN + ' world seconds. Time runs at ×' + R.country +
      ' on the country map (a turn takes ' + Math.round(W.realTurn('country')) + ' s), ×' + R.province + ' in a province (' +
      Math.round(W.realTurn('province') / 60) + ' min) and ×' + R.unit + ' in a battle (' + Math.round(W.realTurn('unit') / 60) + ' min). Set in js/world/config.js.'));
  }

  bus.on('world:saved', function (s) {
    var line = s.where === 'cloud' ? lines.cloud : lines.device;
    if (!line) return;
    line.textContent = s.message;
    line.className = 'small ' + (s.ok ? 'ok' : s.where === 'cloud' && /device/.test(s.message) ? '' : 'bad');
  });
  bus.on('world:turn', worldLine);
  bus.on('world:new', worldLine);

  A.settings = {
    init: function () {
      var gear = D.$('gear'), panel = D.$('settings-panel'), body = D.$('settings-body');
      function open(on) { panel.hidden = !on; gear.setAttribute('aria-expanded', String(on)); if (on) worldLine(); }
      gear.addEventListener('click', function () { open(panel.hidden); });
      D.$('settings-close').addEventListener('click', function () { open(false); });
      build(body);
      if (window.XWNotes) window.XWNotes.attach({ panel: body, page: A.mode.title, context: describe });
    }
  };
})();
