// Expansion Wars (combined) — country scale: moving garrisons.
// A move order sends a share of one province's garrison to another of your provinces, up to MOVE_HOPS provinces away
// through your own land. It is queued and happens at the end of the turn. Every turn, garrisons also move on their own
// towards the border, first to a border province next to a hostile nation, then to any border province.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  // Your provinces reachable from `from` through your own land in at most `hops` steps: {provinceId: steps}.
  C.reachOwn = function (w, n, from, hops) {
    var dist = {}, queue = [from];
    dist[from] = 0;
    while (queue.length) {
      var id = queue.shift();
      if (dist[id] >= hops) continue;
      w.provs[id].adj.forEach(function (q) {
        var Q = w.provs[q];
        if (Q.kind !== 'province' || Q.owner !== n.id || dist[q] !== undefined) return;
        dist[q] = dist[id] + 1;
        queue.push(q);
      });
    }
    return dist;
  };

  // Queue a move of `pct` % of the garrison in `from` to `to`. Returns a message when it cannot, or null.
  C.queueMove = function (w, from, to, pct) {
    var a = w.provs[from], b = w.provs[to], me = w.nations[w.you];
    if (!a || !b || a.owner !== w.you || b.owner !== w.you || a.kind !== 'province' || b.kind !== 'province') return 'Move between two of your provinces.';
    if (from === to) return 'Pick another province of yours.';
    if (!(a.gar >= 1)) return 'No soldiers stationed there to move.';
    if (C.reachOwn(w, me, from, W.CONFIG.MOVE_HOPS)[to] === undefined) {
      return 'Too far: an army moves up to ' + W.CONFIG.MOVE_HOPS + ' provinces a turn, through your own land.';
    }
    w.queue = w.queue.filter(function (x) { return !(x.type === 'move' && x.src === from); });
    w.queue.push({ type: 'move', from: w.you, to: -1, src: from, dst: to, pct: pct });
    W.log(w, 'Queued: move ' + pct + '% of the garrison to another of your provinces. It moves at the end of the turn.');
    return null;
  };

  // Carry out the queued moves (list: the orders this turn). A move whose land has changed hands is cancelled.
  C.resolveMoves = function (w, list) {
    (list || []).filter(function (x) { return x.type === 'move'; }).forEach(function (x) {
      var a = w.provs[x.src], b = w.provs[x.dst];
      if (!a || !b || a.owner !== x.from || b.owner !== x.from) { W.log(w, 'A garrison move was cancelled: the land changed hands.'); return; }
      var have = Math.floor(a.gar || 0);
      var count = Math.min(have, Math.max(1, Math.floor(have * x.pct / 100)));
      if (count < 1) return;
      a.gar -= count;
      b.gar = (b.gar || 0) + count;
      if (x.from === w.you) W.log(w, count + ' soldiers moved from a ' + W.label(a.tier) + ' to a ' + W.label(b.tier) + '.');
    });
  };

  // A province on the border: one of its neighbours is land of another nation (or neutral).
  function isBorder(w, n, p) {
    return p.adj.some(function (q) { var Q = w.provs[q]; return Q.kind === 'province' && Q.owner !== n.id; });
  }
  // Garrisons move towards the border each turn, for every nation.
  C.autoMoves = function (w) {
    C.alive(w).forEach(function (n) {
      C.ownedBy(w, n).forEach(function (p) {
        if (!(p.gar > K().GAR_KEEP) || isBorder(w, n, p)) return;
        var best = null;
        p.adj.forEach(function (q) {
          var Q = w.provs[q];
          if (Q.kind !== 'province' || Q.owner !== n.id || !isBorder(w, n, Q)) return;
          var hostile = Q.adj.some(function (r) { var o = w.provs[r].owner; return o >= 0 && o !== n.id && W.rel(w, n.id, o).war; });
          var score = hostile ? 0 : 1;
          if (!best || score < best.score) best = { q: Q, score: score };
        });
        if (!best) return;
        var share = Math.floor((p.gar - K().GAR_KEEP) * K().AUTO_MOVE);
        if (share < 1) return;
        p.gar -= share;
        best.q.gar = (best.q.gar || 0) + share;
        if (n.id === w.you) W.log(w, 'Garrison moved towards the border.');
      });
    });
  };

  // Upgrade a fortress tower: its range doubles. Paid in gold and stone.
  C.upgradeTower = function (w, n, p) {
    if (!p || p.owner !== n.id || p.tier !== 'f') return 'Pick one of your fortresses.';
    if (p.tower === 2) return 'The tower is already upgraded.';
    var lack = C.shortfall(n, K().TOWER_COST);
    if (lack) return 'Not enough ' + lack + '.';
    C.spend(n, K().TOWER_COST);
    p.tower = 2;
    W.log(w, 'The tower of a fortress is upgraded: its range doubles.');
    return null;
  };
})();
