// Expansion Wars (combined) — the province window: which provinces of the world the province scale shows.
// The window is the province you zoomed into and every province up to RINGS steps from it. It is worked out from the
// world each time (only the focus id is stored, in world.view.prov), so it can never disagree with the country map.
// Roads run between provinces that share a border. Terrain cells are drawn but have no roads.
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world;

  P.window = function (w, focus) {
    var f = w.provs[focus];
    if (!f || f.kind !== 'province') return null;
    var depth = {}, list = [focus];
    depth[focus] = 0;
    for (var i = 0; i < list.length; i++) {
      var p = w.provs[list[i]];
      if (depth[p.id] >= W.CONFIG.RINGS) continue;
      p.adj.forEach(function (q) {
        if (depth[q] !== undefined || w.provs[q].kind !== 'province') return;
        depth[q] = depth[p.id] + 1;
        list.push(q);
      });
    }
    var inside = {};
    list.forEach(function (id) { inside[id] = true; });
    // Terrain cells that touch the window are drawn too, so the close-up has its lakes, woods and mountains.
    var terrain = [];
    list.forEach(function (id) {
      w.provs[id].adj.forEach(function (q) {
        if (w.provs[q].kind === 'terrain' && terrain.indexOf(q) < 0) terrain.push(q);
      });
    });
    // The box around the window, padded, in map units.
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (id) {
      var p = w.provs[id];
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    });
    var pad = 45;
    return {
      focus: focus, ids: list, depth: depth, inside: inside, terrain: terrain,
      box: { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad }
    };
  };

  // Roads from a province to the provinces next to it inside the window.
  P.links = function (w, win, id) {
    return w.provs[id].adj.filter(function (q) { return win.inside[q]; });
  };

  // True when the border between a and b is a river (marching across it is slower).
  P.riverBetween = function (w, a, b) {
    var p = w.provs[a], k = p.adj.indexOf(b);
    return k >= 0 && !!p.adjRiver[k];
  };

  // The shortest route from one province to another through provinces you own, inside the window.
  // Returns the provinces after `from`, ending with `to`, or null.
  P.routeTo = function (w, win, from, to, owner) {
    if (from === to) return null;
    var prev = {}, queue = [from], found = false;
    prev[from] = null;
    while (queue.length && !found) {
      var n = queue.shift();
      P.links(w, win, n).forEach(function (t) {
        if (found || prev[t] !== undefined) return;
        if (t !== to && w.provs[t].owner !== owner) return;
        prev[t] = n;
        if (t === to) found = true; else queue.push(t);
      });
    }
    if (!found) return null;
    var path = [];
    for (var c = to; c !== from; c = prev[c]) path.unshift(c);
    return path;
  };
})();
