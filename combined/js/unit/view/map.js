// Expansion Wars (combined) — drawing a battle from the engine's state. The ground once per battle; the units every
// frame. Each side wears its nation's colour, the same as on the country and province maps.
(function () {
  'use strict';
  var XW = window.XW, U = XW.unit, D = XW.core;
  U.view = U.view || {};
  var TILE_COLOUR = {
    g: '#cfe6a0', w: '#5f8f4e', h: '#b9c76a', d: '#c8a46a', r: '#8fc6e8', v: '#4a86b8', b: '#a0764a',
    f: '#c9e7f5', t: '#dcc7a0', x: '#8d857c', y: '#b48c55'
  };

  // Tiles, in runs of the same ground along each row (far fewer shapes than one per tile).
  U.view.drawField = function (layer, st) {
    var T = window.V4.CONFIG.TILE;
    D.clear(layer);
    for (var r = 0; r < st.rows; r++) {
      var c = 0;
      while (c < st.cols) {
        var code = st.field.tiles[r * st.cols + c], end = c;
        while (end + 1 < st.cols && st.field.tiles[r * st.cols + end + 1] === code) end++;
        D.svg('rect', { x: c * T, y: r * T, width: (end - c + 1) * T + 0.5, height: T + 0.5, fill: TILE_COLOUR[code] || TILE_COLOUR.g }, layer);
        c = end + 1;
      }
    }
    st.field.objectives.forEach(function (o) {
      D.svg('circle', { cx: o.x * T, cy: o.y * T, r: window.V4.CONFIG.HOLD_RADIUS * T, 'class': 'objective' }, layer);
    });
  };

  // Enemies you cannot see are not drawn; your units and allies always are; everything once the battle is over.
  function shown(st, u) {
    if (st.done || st.you === null || window.V4.sim.allied(st, u.side, st.you)) return true;
    return !!st.seen[st.you][u.id];
  }

  // colours: the CSS owner class for each side ('o0' ... or 'neutral').
  U.view.drawUnits = function (layer, st, ui, colours) {
    var T = window.V4.CONFIG.TILE, I = window.V4.INSIGNIA;
    D.clear(layer);
    st.units.forEach(function (u) {
      if (u.state === 'dead' || u.state === 'gone' || !shown(st, u)) return;
      var g = D.svg('g', { 'class': 'unit' + (u.state === 'routing' ? ' routing' : '') + (ui.sel === u.id ? ' sel' : ''), 'data-id': u.id,
        transform: 'translate(' + (u.x * T).toFixed(1) + ',' + (u.y * T).toFixed(1) + ')' }, layer);
      D.svg('circle', { r: 17, 'class': 'ring ' + colours[u.side], stroke: '#fff' }, g);
      D.svgText(g, 0, -1, I.animal[u.type], { 'font-size': 19 });
      D.svgText(g, 0, 24, String(Math.ceil(u.people - 0.001)), { 'class': 'people' });
      if (u.general) D.svgText(g, 14, -14, '⭐', { 'font-size': 11 });
      if (ui.sel === u.id && u.order && u.order.kind === 'route') {
        var p = u.order.points[u.order.points.length - 1];
        D.svg('line', { x1: 0, y1: 0, x2: (p.x - u.x) * T, y2: (p.y - u.y) * T, 'class': 'order' }, g);
      }
    });
  };
})();
