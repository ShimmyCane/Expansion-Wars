// Expansion Wars (combined) — generals. An army of ONE soldiers or more has a general, and TWO or more has two. An army
// is a garrison (province.gens), a march (march.gens), the attackers of a fight (fight.gens) or a nation's field army
// (nation.gens); each holds the ids of its generals, and world.generals holds the generals themselves.
//   - A general, once formed, stays with its army as it shrinks, until the army is under KEEP: then the general is lost.
//   - A march with a general moves SPEED times as fast.
//   - Every fight a general is in counts: a win +1, a loss -1. Stars come at 2^n: a score of 2 is one star, 4 two, 8 three.
//   - Each star adds UNIT_STAR to the general's strength and aura in a unit battle, and BATTLE_STAR in province and
//     country battles.
//   - When armies merge, their generals pool; the strongest leads, and the army keeps as many as its size allows.
(function () {
  'use strict';
  var XW = window.XW, W = XW.world;

  W.GEN = { ONE: 100, TWO: 500, KEEP: 25, SPEED: 1.15, UNIT_STAR: 0.15, BATTLE_STAR: 0.05 };
  var NAMES = ['Ash', 'Birch', 'Cedar', 'Dale', 'Elm', 'Fern', 'Glen', 'Heath', 'Iris', 'Juniper', 'Kestrel', 'Linden',
    'Moss', 'North', 'Oak', 'Pike', 'Quill', 'Reed', 'Sage', 'Thorn', 'Umber', 'Vale', 'Wren', 'Yew'];

  function all(w) { return (w.generals = w.generals || {}); }
  W.general = function (w, id) { return all(w)[id] || null; };

  // How many generals an army of n soldiers has room for.
  W.genCount = function (n) { return n >= W.GEN.TWO ? 2 : n >= W.GEN.ONE ? 1 : 0; };
  // A general's score (wins less losses, never below 0) and its stars: one at 2, two at 4, three at 8, four at 16.
  W.genScore = function (g) { return Math.max(0, (g.wins || 0) - (g.losses || 0)); };
  W.stars = function (g) { var s = g ? W.genScore(g) : 0; return s >= 2 ? Math.floor(Math.log(s) / Math.LN2 + 1e-9) : 0; };
  function stronger(a, b) { return W.stars(b) - W.stars(a) || W.genScore(b) - W.genScore(a) || a.id - b.id; }
  // The generals of a list, strongest first; the first one leads.
  W.ranked = function (w, ids) { return (ids || []).map(function (id) { return W.general(w, id); }).filter(Boolean).sort(stronger); };
  W.lead = function (w, ids) { return W.ranked(w, ids)[0] || null; };
  // The bonus a side's lead general gives in a battle: base (none without a general) times one more perStar for each star.
  W.genMul = function (w, ids, base, perStar) {
    var g = W.lead(w, ids);
    return g ? base * (1 + perStar * W.stars(g)) : 1;
  };

  function make(w, owner) {
    var n = (w.nextGeneral = (w.nextGeneral || 0) + 1);
    var g = { id: n, owner: owner, name: 'General ' + NAMES[(n - 1) % NAMES.length] + (n > NAMES.length ? ' ' + (Math.floor((n - 1) / NAMES.length) + 1) : ''), wins: 0, losses: 0 };
    all(w)[n] = g;
    W.log(w, W.ownerName(w, owner) + ' has a new general: ' + g.name + '.');
    return n;
  }
  function lose(w, ids, why) {
    (ids || []).forEach(function (id) {
      var g = W.general(w, id);
      if (!g) return;
      W.log(w, g.name + ' of ' + W.ownerName(w, g.owner) + ' is lost' + (why ? ' (' + why + ')' : '') + '.');
      delete all(w)[id];
    });
    return [];
  }
  W.loseGenerals = lose;

  // An army of n soldiers of owner, with generals ids: generals form when it is big enough, and are lost when it is too
  // small to keep them. Returns the new list.
  W.fitGenerals = function (w, owner, ids, n) {
    ids = (ids || []).filter(function (id) { return W.general(w, id); });
    if (owner < 0) return lose(w, ids, 'the army is gone');
    if (n < W.GEN.KEEP) return ids.length ? lose(w, ids, 'the army is under ' + W.GEN.KEEP) : [];
    while (ids.length < W.genCount(n)) ids.push(make(w, owner));
    return ids;
  };
  // Two armies become one of n soldiers: the generals pool, strongest first, and the army keeps as many as its size
  // allows (at least one). The rest are lost.
  W.mergeGenerals = function (w, a, b, n) {
    var ranked = W.ranked(w, (a || []).concat(b || []));
    var keep = Math.max(1, W.genCount(n));
    if (ranked.length > keep) lose(w, ranked.slice(keep).map(function (g) { return g.id; }), 'two armies joined; ' + ranked[0].name + ' leads');
    return ranked.slice(0, keep).map(function (g) { return g.id; });
  };
  // A fight is over: the winners' generals +1, the losers' -1.
  W.recordFight = function (w, winners, losers) {
    (winners || []).forEach(function (id) { var g = W.general(w, id); if (g) g.wins = (g.wins || 0) + 1; });
    (losers || []).forEach(function (id) { var g = W.general(w, id); if (g) g.losses = (g.losses || 0) + 1; });
  };

  // Every army in the world gets the generals its size calls for, and loses those it is too small to keep. Run now and
  // then (app/loop.js), at every scale.
  W.tendGenerals = function (w) {
    var held = w.battle ? w.battle.to : -1;          // a province under battle: its generals are in the battle
    w.provs.forEach(function (p) {
      if (p.kind !== 'province' || p.id === held) return;
      if (p.owner < 0) { if (p.gens && p.gens.length) p.gens = lose(w, p.gens, 'the province is empty'); return; }
      p.gens = W.fitGenerals(w, p.owner, p.gens, p.gar || 0);
    });
    w.marches.forEach(function (m) { if (!m.done) m.gens = W.fitGenerals(w, m.owner, m.gens, m.count); });
    w.nations.forEach(function (n) { n.gens = n.alive ? W.fitGenerals(w, n.id, n.gens, n.soldiers || 0) : lose(w, n.gens, 'the nation has fallen'); });
  };

  // A line for a list of generals: ⭐ and its stars, for each.
  W.genText = function (w, ids) {
    return W.ranked(w, ids).map(function (g) { return '⭐' + (W.stars(g) ? '★'.repeat(W.stars(g)) : ''); }).join('');
  };
})();
