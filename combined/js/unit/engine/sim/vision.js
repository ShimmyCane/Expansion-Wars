// Expansion Wars — unit battle engine: Vision: what each side can see, and the nearest enemies and friends.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};

  // ---- Vision ----------------------------------------------------------------

  function sightOf(st, u) {
    var base = C.SIGHT[u.type] + (u.side === 1 ? C.DEFENDER_SIGHT_BONUS : 0);
    return K.insideWalls(st, u.x, u.y) ? base + C.WALL.sight : base;
  }

  // Each team sees what any of its units, or any ally's unit, can see. A unit in woods or tall grass is seen only from
  // close by, until it fires or strikes (then it is revealed for a few seconds).
  function computeVision(st) {
    st.seen = st.allied.map(function () { return {}; });
    st.units.forEach(function (u) {
      u.hidden = u.state === 'active' && !!C.TERRAIN[K.tileCode(st, u.x, u.y) || 'g'].hides && u.revealT <= 0;
    });
    st.units.forEach(function (v) {
      if (v.state !== 'active') return;
      st.units.forEach(function (e) {
        if (K.allied(st, e.side, v.side) || (e.state !== 'active' && e.state !== 'routing')) return;
        var range = e.hidden ? C.HIDE.range : sightOf(st, v);
        // A unit inside the walls can be seen from outside only up close.
        if (K.insideWalls(st, e.x, e.y) && !K.insideWalls(st, v.x, v.y)) range = Math.min(range, C.WALL.hide);
        if (K.dist(v.x, v.y, e.x, e.y) <= range) {
          for (var t = 0; t < st.teams; t++) if (K.allied(st, t, v.side)) st.seen[t][e.id] = true;
        }
      });
    });
  }

  function visibleEnemy(st, u) {
    var best = null, bd = Infinity, seen = st.seen[u.side];
    st.units.forEach(function (v) {
      if (K.allied(st, v.side, u.side) || v.state !== 'active' || !seen[v.id]) return;
      var d = K.dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v; }
    });
    return best ? { e: best, d: bd } : null;
  }

  // The nearest active enemy whether or not it is seen (used for the ambush trigger).
  function nearestAny(st, u) {
    var best = null, bd = Infinity;
    st.units.forEach(function (v) {
      if (K.allied(st, v.side, u.side) || v.state !== 'active') return;
      var d = K.dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v; }
    });
    return best ? { e: best, d: bd } : null;
  }

  function seenWithin(st, u, range) {
    var seen = st.seen[u.side];
    return st.units.some(function (v) {
      return !K.allied(st, v.side, u.side) && v.state === 'active' && seen[v.id] && K.dist(u.x, u.y, v.x, v.y) <= range;
    });
  }

  // Friends and seen foes within LOCAL.range: how the unit reads the ground around it.
  function localCount(st, u) {
    var friends = 0, foes = 0, seen = st.seen[u.side], r = C.LOCAL.range;
    st.units.forEach(function (v) {
      if (v === u || v.state !== 'active') return;
      if (K.dist(u.x, u.y, v.x, v.y) > r) return;
      if (K.allied(st, v.side, u.side)) friends += v.people; else if (seen[v.id]) foes += v.people;
    });
    return { friends: friends, foes: foes };
  }

  K.sightOf = sightOf;
  K.computeVision = computeVision;
  K.visibleEnemy = visibleEnemy;
  K.nearestAny = nearestAny;
  K.seenWithin = seenWithin;
  K.localCount = localCount;
})();
