// Expansion Wars (combined) — country scale: building and growing provinces, research, buying food, releasing soldiers.
// Each returns a message when it cannot happen, or null when it did.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country;
  function K() { return C.CONFIG; }

  C.growCost = function (w, n, from) {
    var m = K().GROW[from], f = C.costScale(w, n);
    return { gold: Math.ceil(m.gold * f), food: Math.ceil(m.food * f), stone: m.stone ? Math.ceil(m.stone * f) : 0 };
  };
  C.villageCost = function (w, n) {
    var f = C.costScale(w, n);
    return { gold: Math.ceil(K().VILLAGE.gold * f), food: Math.ceil(K().VILLAGE.food * f) };
  };
  C.canGrow = function (w, n, from) { return C.count(w, n, from) > 0 && !C.shortfall(n, C.growCost(w, n, from)); };

  // A village on a chosen empty dot of yours.
  C.buildAt = function (w, n, p) {
    var c = C.villageCost(w, n);
    if (!p || p.owner !== n.id) return 'Pick an empty dot on your land.';
    if (p.tier !== 'e') return 'Pick an empty dot, not a ' + XW.world.label(p.tier) + '.';
    var lack = C.shortfall(n, c);
    if (lack) return 'Not enough ' + lack + '.';
    C.spend(n, c);
    p.tier = 'v';
    return null;
  };
  // The best empty dot for the nation's needs (farmland when food is short, otherwise trade), keeping back a reserve.
  C.buildVillage = function (w, n, keep) {
    var list = C.ownedBy(w, n).filter(function (q) { return q.tier === 'e'; });
    if (!list.length) return 'No empty dot left to build on.';
    var want = n.food < 50 ? 'farm' : 'trade';
    list.sort(function (p, q) { return C.score(w, q, want) - C.score(w, p, want); });
    var lack = C.shortfall(n, C.villageCost(w, n), keep);
    if (lack) return 'Not enough ' + lack + ' for a village.';
    return C.buildAt(w, n, list[0]);
  };

  // Promote a chosen province one grade, keeping back a reserve.
  C.growAt = function (w, n, p, from, keep) {
    var m = K().GROW[from];
    if (!m) return 'That cannot grow.';
    if (!p || p.owner !== n.id || p.tier !== from) return 'Pick a ' + XW.world.label(from) + ' on your land.';
    var c = C.growCost(w, n, from), lack = C.shortfall(n, c, keep);
    if (lack) return 'Not enough ' + lack + '.';
    C.spend(n, c);
    p.tier = m.to;
    return null;
  };
  // Fortresses go on the front (defensive ground); towns and cities on trade ground.
  C.grow = function (w, n, from, keep) {
    if (!K().GROW[from]) return 'That cannot grow.';
    var list = C.ownedBy(w, n).filter(function (q) { return q.tier === from; });
    if (!list.length) return 'No ' + XW.world.label(from) + ' to grow.';
    var want = from === 'c' ? 'defence' : 'trade';
    list.sort(function (p, q) { return C.score(w, q, want) - C.score(w, p, want); });
    return C.growAt(w, n, list[0], from, keep);
  };

  C.investAt = function (n, k) {
    var c = C.trackCost(n, k);
    if (n.science < c) return 'Not enough science (' + c + ').';
    n.science -= c;
    n.research[k]++;
    return null;
  };
  // 10 food for 20 gold, or for 30 stone.
  C.buyFood = function (n, pay) {
    var c = pay === 'stone' ? K().BUY.stone : K().BUY.gold;
    if (n[pay] < c) return 'Not enough ' + pay + ' (' + c + ').';
    n[pay] -= c;
    n.food += K().BUY.food;
    return null;
  };

  // Soldiers leave for gold: buying out their contracts pays more than disbanding them.
  C.releaseOffer = function (n, how) {
    var count = Math.max(0, Math.min(K().RELEASE_CHUNK, Math.floor(n.soldiers) - K().RELEASE_MIN));
    return { count: count, gold: Math.floor(count * (how === 'buyout' ? K().BUYOUT_GOLD : K().DISBAND_GOLD)) };
  };
  C.release = function (w, n, how) {
    var o = C.releaseOffer(n, how);
    if (o.count < 1) return 'Not enough soldiers to release.';
    n.soldiers -= o.count;
    n.gold += o.gold;
    XW.world.log(w, (how === 'buyout' ? 'Contracts bought out' : 'Soldiers disbanded') + ': ' + o.count + ' soldiers leave for ' + o.gold + ' gold.');
    return null;
  };
})();
