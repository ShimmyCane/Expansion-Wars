// Expansion Wars (combined) — province scale: the computer nations in the window. Ported from the spot game's computer
// players: provinces away from the front reinforce the front; provinces on the front attack the weakest hostile neighbour.
// They only attack land they may enter (neutral land, or a nation they are at war with), and move a few times a minute.
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world;
  function K() { return P.CONFIG; }

  var clock = 0, moves = {};   // the time since the window opened, and each owner's recent move times

  P.aiReset = function () { clock = 0; moves = {}; };

  function hostileTo(w, owner, p) { return p.owner !== owner && W.mayEnter(w, owner, p); }
  function onFront(w, win, owner, id) {
    return P.links(w, win, id).some(function (q) { return hostileTo(w, owner, w.provs[q]) && w.provs[q].owner >= 0; });
  }

  P.aiThink = function (w, win, dt) {
    clock += dt;
    if (Math.floor((clock - dt) / K().AI.every) === Math.floor(clock / K().AI.every)) return;
    var owners = {};
    win.ids.forEach(function (id) { var o = w.provs[id].owner; if (o >= 0 && o !== w.you && w.nations[o].alive) owners[o] = true; });
    Object.keys(owners).forEach(function (key) {
      var o = Number(key), log = (moves[o] || []).filter(function (t) { return clock - t < 60; });
      moves[o] = log;
      win.ids.forEach(function (id) {
        var n = w.provs[id];
        if (n.owner !== o || (n.gar || 0) < K().AI.threshold || log.length >= K().AI.perMinute) return;
        var target = null;
        if (!onFront(w, win, o, id)) {
          P.links(w, win, id).forEach(function (q) {
            var t = w.provs[q];
            if (t.owner === o && onFront(w, win, o, q) && (!target || t.gar < target.gar)) target = t;
          });
        }
        if (!target) {
          var best = Infinity;
          P.links(w, win, id).forEach(function (q) {
            var t = w.provs[q];
            if (!hostileTo(w, o, t)) return;
            var score = (t.gar || 0) + Math.hypot(t.x - n.x, t.y - n.y) / 40;
            if ((t.gar || 0) < n.gar * K().AI.fraction && score < best) { best = score; target = t; }
          });
        }
        if (target && !P.send(w, win, o, id, target.id, K().AI.fraction * 100)) log.push(clock);
      });
    });
  };
})();
