// Expansion Wars (combined) — country scale: the end of a turn. Called by the app when the world clock says a turn is due
// (world/clock.js), or when you press Ready. Everything queued plays out together, then the economy runs.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  C.endTurn = function (w) {
    if (!w || w.over) return;
    C.alive(w).forEach(function (n) { C.autopilot(w, n); });
    C.planAI(w);
    var q = w.queue;
    w.queue = [];
    q.filter(function (x) { return x.type !== 'attack' && x.type !== 'claim' && x.type !== 'move'; }).forEach(function (x) { C.applyDiplomacy(w, x); });
    // Garrison moves: the orders you queued, then the garrisons that move to the border on their own.
    C.resolveMoves(w, q);
    w.used = {};
    q.filter(function (x) { return x.type === 'attack'; }).sort(function () { return Math.random() - 0.5; })
      .forEach(function (x) { C.battle(w, x); });
    q.filter(function (x) { return x.type === 'claim'; }).sort(function () { return Math.random() - 0.5; })
      .forEach(function (x) { C.claimLand(w, x); });
    // Neutral garrisons grow back slowly.
    w.provs.forEach(function (p) {
      if (p.kind === 'province' && p.owner < 0) p.gar = Math.min(K().NEUTRAL_MAX, (p.gar || 0) + K().NEUTRAL_GROW);
    });
    C.alive(w).forEach(function (n) { C.economy(w, n); });
    C.updateNeighbours(w);
    Object.keys(w.rel).forEach(function (k) {
      var r = w.rel[k];
      if (r.trade) r.rep = Math.min(100, r.rep + 1);
      if (r.ally) r.rep = Math.min(100, r.rep + 1);
      if (r.truce > 0) r.truce--;
    });
    C.checkFallen(w);
    C.checkWin(w);
    w.time.turn++;
  };

  // A nation with no provinces left has fallen; its wars and treaties end. Also called after a capture at province scale.
  C.checkFallen = function (w) {
    w.nations.forEach(function (n) {
      if (!n.alive || C.provCount(w, n) > 0) return;
      n.alive = false;
      w.nations.forEach(function (k) {
        if (k.id !== n.id) { var r = W.rel(w, n.id, k.id); r.war = false; r.trade = false; r.ally = false; }
      });
      W.log(w, n.name + ' has fallen.');
    });
  };

  C.checkWin = function (w) {
    if (!w.nations[w.you].alive) { w.over = 'lost'; W.log(w, 'Your nation has fallen.'); return; }
    if (!C.alive(w).some(function (n) { return n.id !== w.you; })) { w.over = 'won'; W.log(w, 'Every other nation has fallen. You win!'); }
  };
})();
