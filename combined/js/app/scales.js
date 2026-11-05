// Expansion Wars (combined) — moving between the three scales. Every transition goes through go(), which
//   1. lets the scale you leave hand its state back to the world (a province lands its marches; a battle is finished
//      by the computer if you leave it early, and its result applied),
//   2. records where you are in world.view (so a reload comes back there),
//   3. shows the new scale, which reads everything it needs from the world, and saves.
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, W = XW.world, D = XW.core, bus = XW.core.bus;
  var SCALES = ['country', 'province', 'unit'];

  function showSection(scale) {
    SCALES.forEach(function (s) { D.$(A.views[s].section).hidden = s !== scale; });
  }

  // Shows a scale without leaving another one first (at start-up). Falls back to a higher scale when it cannot be shown.
  function open(w, scale) {
    if (scale === 'unit' && !w.battle) scale = 'province';
    if (scale === 'province' && !(W.prov(w, w.view.prov) && w.provs[w.view.prov].kind === 'province')) scale = 'country';
    w.view.scale = scale;
    showSection(scale);
    if (A.views[scale].show(w) === false && scale === 'unit') return open(w, 'province');
    A.glance.render(w);
    bus.emit('scale:enter', { scale: scale, prov: w.view.prov });
    return scale;
  }

  A.scales = {
    current: function () { var w = W.get(); return w ? w.view.scale : 'country'; },
    open: open,
    // Go to a scale. prov: the province to zoom into (province scale); kept as it is when left out.
    go: function (scale, prov) {
      var w = W.get();
      if (!w || SCALES.indexOf(scale) < 0) return;
      var from = w.view.scale;
      if (from === scale && (prov === undefined || prov === w.view.prov)) { A.views[scale].render(w); return; }
      A.views[from].hide(w);
      if (prov !== undefined) w.view.prov = prov;
      open(w, scale);
      W.changed('scale');
      A.saveNow('scale');
      window.scrollTo(0, 0);
    }
  };
})();
