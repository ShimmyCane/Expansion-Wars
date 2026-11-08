// Expansion Wars — the game modes. The campaign is the whole game: all three scales in one world. The three battle modes
// are the same rules and views, each showing one scale only, with a world and a save of their own:
//   unit      one battle at a time. Next battle starts a new one.
//   province  province play: marches, garrisons and risk-style fights. No country turns, no battles to join.
//   country   country play: turns, diplomacy and war. Fights resolve on the map; none to join.
// The mode is read from the page address (?mode=unit, ?mode=province, ?mode=country). The campaign is the default, and
// keeps the save it always had. The version is shown in ⚙️.
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, W = XW.world, C = XW.country, P = XW.province, U = XW.unit, D = XW.core;

  A.VERSION = '3.0';

  var MODES = {
    campaign: { id: 'campaign', title: 'Campaign', scales: ['country', 'province', 'unit'], start: 'country', turns: true,
      key: 'xw-combined-world', app: 'combined' },
    unit: { id: 'unit', title: 'Unit battles', scales: ['unit'], start: 'unit', turns: false,
      key: 'xw-unit-battles-world', app: 'combined-unit' },
    province: { id: 'province', title: 'Province battles', scales: ['province'], start: 'province', turns: false,
      key: 'xw-province-battles-world', app: 'combined-province' },
    country: { id: 'country', title: 'Country battles', scales: ['country'], start: 'country', turns: true,
      key: 'xw-country-battles-world', app: 'combined-country' }
  };

  // The mode for a page address. Anything unknown is the campaign.
  A.modeFor = function (search) {
    var m = /[?&]mode=([a-z]+)/.exec(search || '');
    return MODES[m && MODES[m[1]] ? m[1] : 'campaign'];
  };

  // Sets the mode: its saves and its database tag (world/config.js holds the defaults the campaign uses).
  A.useMode = function (id) {
    A.mode = MODES[id] || MODES.campaign;
    W.CONFIG.SAVE_KEY = A.mode.key;
    W.CONFIG.APP = A.mode.app;
    return A.mode;
  };
  A.useMode(A.modeFor(typeof location !== 'undefined' ? location.search : '').id);

  // Whether this mode shows a scale.
  A.can = function (scale) { return A.mode.scales.indexOf(scale) >= 0; };

  // Country turns happen only in the modes that have a country. Elsewhere the clock stands still at the end of a turn.
  var turnDueBase = W.turnDue;
  W.turnDue = function (w) { return A.mode.turns && turnDueBase(w); };

  // A province of yours to stand in (the province mode starts there).
  function ownProvince(w) {
    var list = w.provs.filter(function (p) { return p.kind === 'province' && p.owner === w.you; });
    return list.length ? list[0].id : null;
  }

  // Starts a battle between one of your provinces and a neighbour it can attack, in a seeded order. Returns true when one started.
  function startBattle(w) {
    var rnd = D.rng(w.seed + 7), pairs = [];
    w.provs.forEach(function (p) {
      if (p.kind !== 'province' || p.owner !== w.you || !(p.gar >= 2)) return;
      p.adj.forEach(function (q) {
        if (w.provs[q].kind === 'province' && w.provs[q].owner !== w.you) pairs.push([p.id, q]);
      });
    });
    for (var i = pairs.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = pairs[i];
      pairs[i] = pairs[j]; pairs[j] = t;
    }
    for (var k = 0; k < pairs.length; k++) {
      if (!U.start(w, P.window(w, pairs[k][0]), pairs[k][0], pairs[k][1], 100)) return true;
    }
    return false;
  }

  // A new world for the mode (seed optional). Retries with other seeds in the rare case the map has no fight to start.
  A.modes = {
    fresh: function (seed) {
      var m = A.mode, w = null, tries = 0, ok = false;
      while (!ok && tries < 8) {
        w = C.newWorld(tries === 0 ? seed : undefined);
        tries++;
        if (m.id === 'unit') ok = startBattle(w);
        else if (m.id === 'province') { w.view.prov = ownProvince(w); ok = w.view.prov !== null; }
        else ok = true;
      }
      w.view.scale = m.start;
      return w;
    },

    // A world loaded from this mode's save, made ready for the mode (a unit battle needs a battle, a province needs a province).
    ensure: function (w) {
      if (!w) return A.modes.fresh();
      if (A.mode.id === 'unit' && !w.battle) return A.modes.fresh();
      if (A.mode.id === 'province') {
        var p = W.prov(w, w.view.prov);
        if (!p || p.kind !== 'province') w.view.prov = ownProvince(w);
        if (w.view.prov === null) return A.modes.fresh();
      }
      if (!A.can(w.view.scale)) w.view.scale = A.mode.start;
      return w;
    },

    // The unit battle mode's next battle: a new world with a new battle, shown at once.
    next: function () {
      var w = A.modes.fresh();
      W.set(w);
      A.scales.open(w, w.view.scale);
      A.saveNow('battle');
    }
  };

  // The line in ⚙️ and the notes page name.
  A.describeMode = function () { return 'Expansion Wars ' + A.VERSION + ' · ' + A.mode.title; };
})();
