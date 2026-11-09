// Expansion Wars — the game modes. The campaign is the whole game: all three scales in one world. The three battle modes
// are the same rules and views, each showing one scale only, with a world and a save of their own:
//   unit      one battle at a time. Next battle starts a new one.
//   province  province play as a progression of levels: a small map and two opponents first, then more provinces and
//             more opponents. Like the first draft of the game: provinces grow their own soldiers, drag or tap to send them,
//             fights settle themselves. No field army to manage, no country turns, no battles to join.
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
      key: 'xw-province-battles-world', app: 'combined-province', rings: 99, seconds: 1, pool: false, hops: 99, countdown: 3 },
    country: { id: 'country', title: 'Country battles', scales: ['country'], start: 'country', turns: true,
      key: 'xw-country-battles-world', app: 'combined-country' }
  };

  // The mode for a page address. Anything unknown is the campaign.
  A.modeFor = function (search) {
    var m = /[?&]mode=([a-z]+)/.exec(search || '');
    return MODES[m && MODES[m[1]] ? m[1] : 'campaign'];
  };

  // The province battle levels. Each is a new map: nations (you and the opponents), provinces for each nation (the
  // rest of its land is neutral), and what you hold at the start. Past the last, the last repeats.
  // free: the neutral towns, cities and fortresses on the map (as in the first draft). teams: nations allied from the
  // start (you are nation 0); everyone else is at war with everyone. There is no diplomacy in province battles.
  var LEVELS = [
    { nations: 3, provs: 5, villages: 1, towns: 1, free: { t: 1 } },
    { nations: 3, provs: 7, villages: 2, towns: 1, free: { t: 1, c: 1 } },
    { nations: 4, provs: 7, villages: 2, towns: 1, free: { t: 2, c: 1 } },
    { nations: 4, provs: 9, villages: 2, towns: 1, free: { t: 2, c: 1, f: 1 } },
    { nations: 4, provs: 9, villages: 2, towns: 1, free: { t: 2, c: 2, f: 1 }, teams: [[0, 1], [2, 3]] },
    { nations: 5, provs: 11, villages: 2, towns: 1, free: { t: 3, c: 2, f: 2 } },
    { nations: 6, provs: 15, villages: 2, towns: 1, free: { t: 3, c: 3, f: 2 }, teams: [[0, 1], [2, 3], [4, 5]] }
  ];
  function teamOf(L, id) {
    var t = (L.teams || []).filter(function (team) { return team.indexOf(id) >= 0; })[0];
    return t || [id];
  }
  var BEST_KEY = 'xw-province-battles-best';
  function levelConfig(n) { return LEVELS[Math.min(Math.max(1, n), LEVELS.length) - 1]; }

  // The whole map is the window in province battles (the maps are small); the campaign shows two steps around a province.
  var DEFAULT_RINGS = W.CONFIG.RINGS, DEFAULT_HOPS = W.CONFIG.MOVE_HOPS, DEFAULT_SECONDS = W.CONFIG.FIGHT_SECONDS;

  // Sets the mode: its saves and its database tag (world/config.js holds the defaults the campaign uses).
  A.useMode = function (id) {
    A.mode = MODES[id] || MODES.campaign;
    W.CONFIG.SAVE_KEY = A.mode.key;
    W.CONFIG.APP = A.mode.app;
    W.CONFIG.RINGS = A.mode.rings || DEFAULT_RINGS;
    W.CONFIG.FIGHT_MODEL = A.mode.fights || 'waves';           // every mode fights in waves
    W.CONFIG.FIGHT_SECONDS = A.mode.seconds || DEFAULT_SECONDS; // ... a round every 3 real seconds, or 1 in province battles
    W.CONFIG.POOL = A.mode.pool !== false;                // province battles: no field army, provinces grow their own soldiers
    W.CONFIG.MOVE_HOPS = A.mode.hops || DEFAULT_HOPS;     // ... and soldiers go as far as your roads reach
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

  // The province battle level n: its own map, every opponent at war with you, and you holding a few provinces.
  function levelWorld(seed, n) {
    var L = levelConfig(n);
    // The lakes, woods and mountains shrink with the map, or a small level would be cut into islands.
    var share = Math.min(1, (L.nations * L.provs) / (C.CONFIG.COUNT * C.CONFIG.PROVS)), base = C.CONFIG.TERRAIN, terrain = {};
    Object.keys(base).forEach(function (kind) {
      terrain[kind] = {};
      Object.keys(base[kind]).forEach(function (key) { terrain[kind][key] = base[kind][key]; });
      terrain[kind].n = Math.round(base[kind].n * share);
    });
    var w = C.newWorld(seed, { COUNT: L.nations, PROVS: L.provs, START_VILLAGES: L.villages, START_TOWNS: L.towns, NEUTRAL_FROM: 99, TERRAIN: terrain });
    w.level = n;
    w.countdown = A.mode.countdown || 0;                  // 3, 2, 1, Go before the level starts
    // Neutral towns, cities and fortresses, on empty land, with garrisons of about a third of their cap.
    var rnd = D.rng(w.seed + 17), empty = w.provs.filter(function (p) { return p.kind === 'province' && p.owner < 0; });
    ['f', 'c', 't'].forEach(function (tier) {
      for (var i = 0; i < ((L.free || {})[tier] || 0) && empty.length; i++) {
        var p = empty.splice(Math.floor(rnd() * empty.length), 1)[0];
        p.tier = p.origTier = tier;
        p.gar = Math.round(P.stat('CAP', W.TIERS[tier].rank) * 0.3);
      }
    });
    P.splitProvinces(w);
    // Teams: allies from the start; everyone else is at war with everyone.
    w.nations.forEach(function (a) {
      w.nations.forEach(function (b) {
        if (a.id >= b.id) return;
        var r = W.rel(w, a.id, b.id), same = teamOf(L, a.id).indexOf(b.id) >= 0;
        r.ally = same; r.war = !same; r.warSince = same ? 0 : 1;
      });
    });
    w.view.prov = ownProvince(w);
    var foes = L.nations - teamOf(L, w.you).length;
    W.log(w, 'Level ' + n + ': ' + foes + ' opponent' + (foes === 1 ? '' : 's') + (L.teams ? ', and an ally at your side' : '') + '. Take every opponent province to win.');
    return w;
  }

  // What the window (the land reachable from your province) covers: ok when every opponent province is on it (or the
  // level could not be won), all when every province is, so none is cut off by lakes and mountains.
  function reach(w) {
    var win = w.view.prov === null ? null : P.window(w, w.view.prov), ok = !!win, all = !!win;
    if (win) w.provs.forEach(function (p) {
      if (p.kind !== 'province' || win.inside[p.id]) return;
      all = false;
      if (p.owner >= 0 && p.owner !== w.you) ok = false;
    });
    return { ok: ok, all: all };
  }

  // Surrender (province battles): off unless turned on in ⚙️, as in the first draft. Kept on this device.
  var SURRENDER_KEY = 'xw-province-battles-surrender';
  A.surrenderOn = function () { try { return localStorage.getItem(SURRENDER_KEY) === '1'; } catch (e) { return false; } };
  A.setSurrender = function (on) { try { localStorage.setItem(SURRENDER_KEY, on ? '1' : '0'); } catch (e) { /* no storage */ } };

  // The furthest province battle level you have reached, kept on this device.
  function best() {
    try { return Math.max(1, parseInt(localStorage.getItem(BEST_KEY), 10) || 1); } catch (e) { return 1; }
  }
  function unlock(n) {
    try { if (n > best()) localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* no storage: the level still plays */ }
  }

  // A new world for the mode (seed optional). Retries with other seeds in the rare case the map has no fight to start.
  // level: the province battle level (the current one when left out).
  A.modes = {
    fresh: function (seed, level) {
      var m = A.mode, w = null, tries = 0, ok = false;
      var n = level || (W.get() && W.get().level) || 1;
      var spare = null;
      while (!ok && tries < (m.id === 'province' ? 16 : 8)) {
        var s = tries === 0 ? seed : undefined;
        tries++;
        if (m.id === 'province') {
          w = levelWorld(s, n);
          var r = reach(w);
          if (r.ok && !spare) spare = w;
          ok = r.ok && r.all;
          if (!ok && tries === 16 && spare) w = spare;   // no map was whole: take one where every opponent can be reached
          continue;
        }
        w = C.newWorld(s);
        if (m.id === 'unit') ok = startBattle(w);
        else ok = true;
      }
      if (m.id === 'province') unlock(n);
      w.view.scale = m.start;
      return w;
    },

    // Province battle levels you may start, and the line that says which one you are on.
    unlocked: best,
    levelLine: function (w) {
      var L = levelConfig(w.level || 1), foes = L.nations - teamOf(L, 0).length;
      return 'Level ' + (w.level || 1) + ' · ' + foes + ' opponent' + (foes === 1 ? '' : 's') + (L.teams ? ' · with an ally' : '') + ' · ' + L.provs + ' provinces each';
    },
    level: function (n) {
      var w = A.modes.fresh(undefined, n);
      W.set(w);
      A.scales.open(w, w.view.scale);
      A.saveNow('button');
    },

    // A world loaded from this mode's save, made ready for the mode (a unit battle needs a battle, a province needs a province).
    ensure: function (w) {
      if (!w) return A.modes.fresh();
      if (A.mode.id === 'unit' && !w.battle) return A.modes.fresh();
      if (A.mode.id === 'province') {
        var p = W.prov(w, w.view.prov);
        if (!w.level || !p || p.kind !== 'province') return A.modes.fresh(undefined, w.level || 1);
      }
      if (!A.can(w.view.scale)) w.view.scale = A.mode.start;
      return w;
    },

    // The next battle (unit battles), or the next level after a win and the same level again after a loss (province
    // battles). A new world, shown at once.
    next: function () {
      var cur = W.get();
      if (A.mode.id === 'province' && cur) { A.modes.level((cur.level || 1) + (cur.over === 'won' ? 1 : 0)); return; }
      var w = A.modes.fresh();
      W.set(w);
      A.scales.open(w, w.view.scale);
      A.saveNow('battle');
    }
  };

  // Difficulty (the campaign and country battles): asked once when a new world starts. Easy, medium or hard sets the
  // starting stocks and how the computer plays (country/config.js DIFFICULTY).
  A.modes.pickDifficulty = function (w) {
    if (!A.mode.turns || typeof document === 'undefined' || w.difficulty) return;
    var D = C.CONFIG.DIFFICULTY, box = D_el('div', 'overlay'), card = D_el('div', 'overlay-card');
    card.appendChild(D_el('h2', '', 'Choose a difficulty'));
    Object.keys(D).forEach(function (level) {
      var b = XW.core.button(D[level].label, function () {
        C.applyDifficulty(w, level);
        box.parentNode.removeChild(box);
        W.changed('difficulty');
        A.saveNow('button');
      }, { cls: 'big' });
      card.appendChild(b);
      card.appendChild(D_el('p', 'small', D[level].note));
    });
    box.appendChild(card);
    document.body.appendChild(box);
  };
  function D_el(tag, cls, text) { return XW.core.el(tag, cls, text); }

  // The line in ⚙️ and the notes page name.
  A.describeMode = function () { return 'Expansion Wars ' + A.VERSION + ' · ' + A.mode.title; };
})();
