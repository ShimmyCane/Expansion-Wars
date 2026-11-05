// Expansion Wars (combined) — country scale: questions about the world that change nothing.
// Land held, population, power, features of a province, costs and stocks. Every function takes the world first.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  C.ownedBy = function (w, n) { return w.provs.filter(function (p) { return p.owner === n.id; }); };
  C.count = function (w, n, tier) { return w.provs.filter(function (p) { return p.owner === n.id && p.tier === tier; }).length; };
  C.provCount = function (w, n) { return C.ownedBy(w, n).length; };
  // Promoted provinces (not empty dots).
  C.spots = function (w, n) { return C.ownedBy(w, n).filter(function (p) { return p.tier !== 'e'; }).length; };
  C.occupied = function (w, n) { return C.ownedBy(w, n).filter(function (p) { return p.occ > 0; }); };
  C.tiers = function (w, n) {
    var t = { e: 0, v: 0, t: 0, c: 0, f: 0 };
    C.ownedBy(w, n).forEach(function (p) { t[p.tier]++; });
    return t;
  };
  C.alive = function (w) { return w.nations.filter(function (n) { return n.alive; }); };
  // Soldiers stationed in a nation's provinces (garrisons), on top of its field army.
  C.garrisons = function (w, n) { return C.ownedBy(w, n).reduce(function (s, p) { return s + (p.gar || 0); }, 0); };

  C.quality = function (n) { return 1 + (n.tech + n.morale + n.happy) / 300; };
  C.civMult = function (n) { return 1 + K().TRACK.civic.per * n.research.civic; };
  C.agriMult = function (n) { return 1 + K().TRACK.agri.per * n.research.agri; };
  C.popRaw = function (w, n) {
    var t = C.tiers(w, n), P = K().POP;
    return P.v * t.v + P.t * t.t + P.c * t.c + P.f * t.f;
  };
  C.population = function (w, n) { return C.popRaw(w, n) * C.civMult(n); };
  // The army is capped by the land (LAND_SOLDIERS a province) and by the Arms track.
  C.armyCap = function (w, n) {
    return Math.min(K().ARMY_BASE + K().TRACK.arms.per * n.research.arms, K().LAND_SOLDIERS * C.provCount(w, n));
  };
  C.trackCost = function (n, k) { return Math.ceil(K().TRACK_COST.base * Math.pow(K().TRACK_COST.growth, n.research[k])); };

  // Power = population per spot x quality x soldiers.
  C.power = function (w, n) {
    var sp = C.spots(w, n);
    if (!sp) return 0;
    return C.population(w, n) / sp * C.quality(n) * n.soldiers;
  };
  C.ratio = function (w, n) {
    var p = C.alive(w).map(function (m) { return C.power(w, m); }).sort(function (a, b) { return a - b; });
    var med = p.length ? p[Math.floor(p.length / 2)] : 1;
    return C.power(w, n) / (med > 0 ? med : 1);
  };
  C.stage = function (R) { return R < 0.7 ? 'Early' : R < 1.3 ? 'Growing' : R < 2 ? 'Strong' : 'Veteran'; };

  C.atWar = function (w, i) {
    return w.nations.some(function (j) { return j.id !== i && j.alive && W.rel(w, i, j.id).war; });
  };
  C.tradeCount = function (w, i) {
    return w.nations.filter(function (j) { return j.id !== i && j.alive && W.rel(w, i, j.id).trade; }).length;
  };
  C.weakestGrade = function (w, n) {
    var t = C.tiers(w, n);
    return t.v > 0 ? 'v' : t.t > 0 ? 't' : t.c > 0 ? 'c' : 'f';
  };

  // A province's feature follows the land around it: a war front or a mountain slope is defensive ground; touching an ally
  // or a river border is a trade route; the rest is farmland.
  C.feature = function (w, p) {
    if (p.mount) return 'defence';
    var P = w.provs;
    if (p.owner >= 0 && p.adj.some(function (q) { var o = P[q].owner; return o >= 0 && o !== p.owner && W.rel(w, p.owner, o).war; })) return 'defence';
    if (p.owner >= 0 && p.adj.some(function (q) { var o = P[q].owner; return o >= 0 && o !== p.owner && W.rel(w, p.owner, o).ally; })) return 'trade';
    if (p.river) return 'trade';
    return 'farm';
  };
  // Defence of a province: its value, +1 on a mountain slope, +1 for built-on defensive ground, more for a fortress.
  C.featureDef = function (w, p) {
    return p.def + (p.mount ? 1 : 0) + (C.feature(w, p) === 'defence' && p.tier !== 'e' ? 1 : 0) + (p.tier === 'f' ? K().FORT_PROVINCE : 0);
  };
  // How well a province suits a purpose, with a little chance to break ties.
  C.score = function (w, p, want) { return (C.feature(w, p) === want ? 2 : 0) + Math.random() * 0.5; };
  C.targetValue = function (w, b) {
    return C.ownedBy(w, b).reduce(function (sum, p) { return sum + K().VALUE[p.tier] + (C.feature(w, p) === 'defence' ? 0.5 : 0); }, 0);
  };
  // Food in store also helps culture: up to double at 100 food.
  C.foodMult = function (n) { return 1 + Math.min(n.food, 100) / 100; };
  C.prodFactor = function (w, n) {
    var occ = C.occupied(w, n).length / Math.max(1, C.provCount(w, n));
    return 1 - K().OCC_PENALTY * Math.min(1, occ);
  };

  // The middle of a nation's land (or its seed point if it holds nothing).
  C.centre = function (w, n) {
    var list = C.ownedBy(w, n);
    if (!list.length) return { x: n.x, y: n.y };
    var x = 0, y = 0;
    list.forEach(function (p) { x += p.x; y += p.y; });
    return { x: x / list.length, y: y / list.length };
  };

  // Costs get dearer as a nation holds more spots: each spot adds 10%.
  C.costScale = function (w, n) { return 1 + 0.1 * C.spots(w, n); };
  // The first stock a cost is short of (keeping back `keep`), or null when the nation can pay.
  C.shortfall = function (n, c, keep) {
    keep = keep || {};
    if (n.gold - (c.gold || 0) < (keep.gold || 0)) return 'gold (' + c.gold + ')';
    if (n.food - (c.food || 0) < (keep.food || 0)) return 'food (' + c.food + ')';
    if (n.stone - (c.stone || 0) < (keep.stone || 0)) return 'stone (' + c.stone + ')';
    return null;
  };
  C.spend = function (n, c) { n.gold -= c.gold || 0; n.food -= c.food || 0; n.stone -= c.stone || 0; };
})();
