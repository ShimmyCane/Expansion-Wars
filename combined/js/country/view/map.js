// Expansion Wars (combined) — drawing the country map from the world. Redrawn whole on each change (about a hundred
// cells), so it never keeps a stale copy of anything. Taps are passed to onTap(province id).
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world, D = XW.core, G = XW.core.geom;
  C.view = C.view || {};

  C.view.drawMap = function (svgEl, w, ui) {
    var K = C.CONFIG;
    D.clear(svgEl);
    var gCells = D.svg('g', {}, svgEl), gRivers = D.svg('g', {}, svgEl), gBorders = D.svg('g', {}, svgEl);
    var gLines = D.svg('g', {}, svgEl), gIcons = D.svg('g', {}, svgEl), gLabels = D.svg('g', {}, svgEl);

    w.provs.forEach(function (p) {
      var cls = 'cell ' + (p.kind === 'terrain' ? 't-' + p.terrain : p.owner >= 0 ? 'o' + p.owner : 'neutral');
      if (ui.prov === p.id) cls += ' sel';
      var poly = D.svg('polygon', { points: G.pts(p.cell), 'class': cls, 'data-id': p.id }, gCells);
      var title = D.svg('title', {}, poly);
      if (p.kind === 'terrain') {
        title.textContent = K.TERRAIN[p.terrain].name + ': ' + K.TERRAIN[p.terrain].note;
        var c = G.cellCentre(p.cell);
        D.svgText(gIcons, c.x, c.y, K.TERRAIN[p.terrain].icon, { 'class': 'terrain-icon' });
        return;
      }
      title.textContent = W.ownerName(w, p.owner) + ' · ' + W.label(p.tier) + ' · ' + Math.floor(p.gar || 0) + ' stationed · ' +
        K.FEATURE_NAME[C.feature(w, p)] + ' · defence ' + C.featureDef(w, p);
      if (p.tier !== 'e') D.svgText(gIcons, p.x, p.y - 4, W.TIERS[p.tier].icon, { 'class': 'icon' });
      else D.svg('circle', { cx: p.x, cy: p.y - 4, r: 3, fill: '#7a705c' }, gIcons);
      if ((p.gar || 0) >= 1) D.svgText(gIcons, p.x, p.y + 11, String(Math.floor(p.gar)), { 'class': 'gar' });
      if (p.fight) D.svgText(gIcons, p.x + 14, p.y - 12, '⚔️', { 'class': 'fight-mark' });
    });

    // Rivers follow the borders between provinces.
    w.rivers.forEach(function (path) {
      var edges = [];
      for (var s = 0; s < path.length - 1; s++) {
        var e = G.sharedEdge(w.provs[path[s]].cell, w.provs[path[s + 1]].cell);
        edges.push(e);
        if (e) D.svg('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, 'class': 'river' }, gRivers);
      }
      for (var m = 1; m < path.length - 1; m++) {
        if (!edges[m - 1] || !edges[m]) continue;
        var arc = G.borderArc(w.provs[path[m]].cell, edges[m - 1], edges[m]);
        if (arc.length > 1) D.svg('polyline', { points: G.pts(arc), 'class': 'river' }, gRivers);
      }
    });

    // Borders between provinces of different owners.
    w.provs.forEach(function (p) {
      if (p.kind === 'terrain') return;
      p.adj.forEach(function (q) {
        var Q = w.provs[q];
        if (q < p.id || Q.kind === 'terrain' || Q.owner === p.owner) return;
        var e = G.sharedEdge(p.cell, Q.cell);
        if (e) D.svg('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, 'class': 'border' }, gBorders);
      });
    });

    // War, alliance and trade lines between the middles of two nations' land.
    var mid = w.nations.map(function (n) { return C.centre(w, n); });
    for (var i = 0; i < w.nations.length; i++) {
      for (var j = i + 1; j < w.nations.length; j++) {
        if (!w.nations[i].alive || !w.nations[j].alive) continue;
        var r = W.rel(w, i, j), kind = r.war ? 'war' : r.ally ? 'ally' : r.trade ? 'trade' : null;
        if (kind) D.svg('line', { x1: mid[i].x, y1: mid[i].y, x2: mid[j].x, y2: mid[j].y, 'class': 'rel ' + kind }, gLines);
      }
    }

    // Your queued claims are ringed.
    w.queue.forEach(function (x) {
      if (x.type === 'claim' && x.from === w.you) { var p = w.provs[x.prov]; D.svg('circle', { cx: p.x, cy: p.y, r: 16, 'class': 'queued' }, gIcons); }
    });

    w.nations.forEach(function (n) {
      var c = mid[n.id], t = D.svg('text', { x: c.x, y: c.y - 18, 'text-anchor': 'middle', 'class': 'label' }, gLabels);
      var a = D.svg('tspan', { x: c.x }, t);
      a.textContent = n.name;
      var b = D.svg('tspan', { x: c.x, dy: '1.2em', 'class': 'info' }, t);
      b.textContent = n.alive ? Math.floor(n.soldiers) + ' · ' + C.stage(C.ratio(w, n)) : 'fallen';
    });
  };
})();
