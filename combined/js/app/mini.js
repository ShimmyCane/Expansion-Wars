// Expansion Wars (combined) — the whole country in the corner of the province and battle maps, so the world stays in
// view while you are zoomed in. Drawn from the world; the province window is boxed. Tap it to go back to the country.
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, D = XW.core, G = XW.core.geom;

  A.mini = {
    draw: function (svgEl, w, win) {
      D.clear(svgEl);
      w.provs.forEach(function (p) {
        var cls = p.kind === 'terrain' ? 't-' + p.terrain : p.owner >= 0 ? 'o' + p.owner : 'neutral';
        if (win && p.id === win.focus) cls += ' focus';
        D.svg('polygon', { points: G.pts(p.cell), 'class': cls }, svgEl);
      });
      if (win) D.svg('rect', { x: win.box.x, y: win.box.y, width: win.box.w, height: win.box.h, 'class': 'window' }, svgEl);
    },
    bind: function (svgEl) {
      svgEl.addEventListener('click', function () { A.scales.go('country'); });
    }
  };
})();
