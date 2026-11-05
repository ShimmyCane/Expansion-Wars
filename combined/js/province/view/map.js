// Expansion Wars (combined) — drawing the province close-up from the world. Two layers: the ground (cells, rivers,
// borders, roads), redrawn when an owner changes; and the spots and marches, redrawn every frame.
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world, D = XW.core, G = XW.core.geom;
  P.view = P.view || {};
  var R = 11;   // spot radius, in map units

  // The window's box widened to the country map's shape, so the close-up keeps the same frame.
  P.view.frame = function (win) {
    var b = win.box, aspect = 1000 / 640, w = b.w, h = b.h;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    var MW = XW.country.CONFIG.W, MH = XW.country.CONFIG.H;
    if (w > MW) { w = MW; h = MH; }
    var x = Math.max(0, Math.min(MW - w, b.x - (w - b.w) / 2)), y = Math.max(0, Math.min(MH - h, b.y - (h - b.h) / 2));
    return { x: x, y: y, w: w, h: h };
  };

  P.view.groundKey = function (w, win, ui) {
    return win.ids.map(function (id) { var p = w.provs[id]; return p.owner + p.tier; }).join('|') + '|' + ui.sel + '|' + ui.target;
  };

  P.view.drawGround = function (layer, w, win, ui) {
    D.clear(layer);
    w.provs.forEach(function (p) {
      var cls = 'cell ' + (p.kind === 'terrain' ? 't-' + p.terrain : p.owner >= 0 ? 'o' + p.owner : 'neutral');
      if (!win.inside[p.id] && win.terrain.indexOf(p.id) < 0) cls += ' outside';
      D.svg('polygon', { points: G.pts(p.cell), 'class': cls, 'data-id': p.id }, layer);
      if (p.kind === 'terrain' && win.terrain.indexOf(p.id) >= 0) {
        var c = G.cellCentre(p.cell);
        D.svgText(layer, c.x, c.y, XW.country.CONFIG.TERRAIN[p.terrain].icon, { 'class': 'terrain-icon', 'font-size': 16 });
      }
    });
    w.rivers.forEach(function (path) {
      for (var s = 0; s < path.length - 1; s++) {
        var e = G.sharedEdge(w.provs[path[s]].cell, w.provs[path[s + 1]].cell);
        if (e) D.svg('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, 'class': 'river' }, layer);
      }
    });
    win.ids.forEach(function (id) {
      var p = w.provs[id];
      p.adj.forEach(function (q) {
        var Q = w.provs[q];
        if (q < id || Q.kind === 'terrain' || Q.owner === p.owner) return;
        var e = G.sharedEdge(p.cell, Q.cell);
        if (e) D.svg('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, 'class': 'border' }, layer);
      });
    });
    // Roads, lit from the selected province.
    win.ids.forEach(function (id) {
      P.links(w, win, id).forEach(function (q) {
        if (q < id) return;
        var a = w.provs[id], b = w.provs[q], lit = ui.sel === id || ui.sel === q;
        D.svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'class': 'road' + (lit ? ' lit' : '') }, layer);
      });
    });
    // Fortress ranges.
    win.ids.forEach(function (id) {
      var p = w.provs[id];
      if (p.tier === 'f' && p.owner >= 0) D.svg('circle', { cx: p.x, cy: p.y, r: P.CONFIG.FORT.range, 'class': 'range' }, layer);
    });
  };

  P.view.drawLive = function (layer, w, win, ui) {
    D.clear(layer);
    win.ids.forEach(function (id) {
      var p = w.provs[id], cls = 'spot ' + (p.owner >= 0 ? 'o' + p.owner : 'neutral');
      if (id === win.focus) cls += ' focus';
      if (id === ui.sel) cls += ' sel';
      if (id === ui.target) cls += ' target';
      D.svg('circle', { cx: p.x, cy: p.y, r: R, 'class': cls, 'data-id': id }, layer);
      if (p.tier !== 'e') D.svgText(layer, p.x, p.y - 1, W.TIERS[p.tier].icon, { 'class': 'spot-icon', 'font-size': 12 });
      D.svgText(layer, p.x, p.y + R + 5, String(Math.floor(p.gar || 0)), { 'class': 'spot-count', 'font-size': 9 });
    });
    w.marches.forEach(function (m) {
      var at = P.marchAt(w, m), g = D.svg('g', { 'class': 'march' }, layer);
      D.svg('circle', { cx: at.x, cy: at.y, r: 6, 'class': 'o' + m.owner }, g);
      D.svgText(g, at.x, at.y, String(Math.ceil(m.count)), { 'font-size': 6 });
    });
  };
})();
