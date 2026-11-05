// Expansion Wars (combined) — start-up: load the world saved on this device (or make a new one), show the scale it was
// left on, and start the frame loop.
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, W = XW.world, C = XW.country, D = XW.core;

  var w = W.loadLocal();
  if (!w) w = C.newWorld();
  W.set(w);
  A.settings.init();
  D.$('ready').addEventListener('click', function () {
    var cur = W.get();
    if (cur && !cur.over) W.skipToTurnEnd(cur);
  });
  A.scales.open(w, w.view.scale);
  W.saveLocal(w);
  A.start();
})();
