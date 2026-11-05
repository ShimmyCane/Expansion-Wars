// Expansion Wars (combined) — country scale: land routes between nations, and what the road does to an army.
// Each step costs 1, a river border 1 more, and terrain its extra steps. Allied and peaceful land is free passage.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  // The cheapest route from nation i's land to a province that passes isTarget. Returns the cost (dist), the steps (hops),
  // river borders crossed, hostile provinces on the way, the share worn away by terrain, the terrain crossed, and the
  // province reached (entry). Null when there is no route.
  C.routeTo = function (w, i, isTarget) {
    var P = w.provs, d = {}, prev = {}, changed = true;
    P.forEach(function (p) { d[p.id] = p.owner === i ? 0 : Infinity; prev[p.id] = -1; });
    while (changed) {
      changed = false;
      P.forEach(function (p) {
        if (d[p.id] === Infinity) return;
        p.adj.forEach(function (q, k) {
          var Q = P[q];
          var cost = 1 + (p.adjRiver[k] ? 1 : 0) + (Q.kind === 'terrain' ? K().TERRAIN[Q.terrain].step : 0);
          if (d[p.id] + cost < d[Q.id]) { d[Q.id] = d[p.id] + cost; prev[Q.id] = p.id; changed = true; }
        });
      });
    }
    var best = null;
    P.forEach(function (p) {
      if (isTarget(p) && d[p.id] < Infinity && (!best || d[p.id] < best.d)) best = { id: p.id, d: d[p.id] };
    });
    if (!best) return null;
    var path = [best.id], cur = best.id;
    while (prev[cur] !== -1) { cur = prev[cur]; path.unshift(cur); }
    var rivers = 0, hostile = 0, wear = 0, crossed = [];
    for (var s = 0; s < path.length - 1; s++) {
      var a = P[path[s]], k = a.adj.indexOf(path[s + 1]);
      if (k >= 0 && a.adjRiver[k]) rivers++;
    }
    for (var h = 1; h < path.length - 1; h++) {
      var T = P[path[h]];
      if (T.kind === 'terrain') { wear += K().TERRAIN[T.terrain].wear; crossed.push(K().TERRAIN[T.terrain].name.toLowerCase()); continue; }
      if (T.owner !== i && T.owner >= 0 && W.rel(w, i, T.owner).war) hostile++;
    }
    return { dist: Math.round(best.d), hops: path.length - 1, rivers: rivers, hostile: hostile, wear: wear, crossed: crossed, entry: best.id };
  };
  C.route = function (w, i, j) { return C.routeTo(w, i, function (p) { return p.owner === j; }); };
  C.routeProv = function (w, i, pid) { return C.routeTo(w, i, function (p) { return p.id === pid; }); };

  // Far away costs strength; hostile land and terrain wear the army down; retaking land lost recently is a tailwind.
  C.attackFactors = function (w, i, R) {
    var entry = w.provs[R.entry];
    return {
      far: Math.min(K().FAR_MAX, K().FAR_PER_STEP * Math.max(0, R.hops - 1) + K().FAR_PER_RIVER * R.rivers),
      chip: Math.min(K().CHIP_MAX, K().CHIP_PER_HOSTILE * R.hostile + R.wear),
      tail: (entry.lostFrom === i && w.time.turn - entry.lostTurn <= K().TAILWIND_TURNS) ? K().TAILWIND : 1
    };
  };

  // Allies at war with the same target, that can reach it, join an attack as one army.
  C.joiners = function (w, i, j) {
    var out = [];
    w.nations.forEach(function (k) {
      if (k.id === i || k.id === j || !k.alive || !W.rel(w, i, k.id).ally) return;
      if (!W.rel(w, k.id, j).war) return;
      var R = C.route(w, k.id, j);
      if (R && R.dist <= K().MAX_DIST) out.push(k.id);
    });
    return out;
  };
  C.coordFactor = function (count) { return Math.max(K().COORD_MIN, 1 - K().COORD * (count - 1)); };
})();
