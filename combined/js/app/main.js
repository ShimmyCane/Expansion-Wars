// Expansion Wars (combined) — start-up: load the world saved on this device (or make a new one), show the scale it was
// left on, and start the frame loop.
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, W = XW.world, C = XW.country, D = XW.core;

  var w = W.loadLocal();
  if (!w) w = C.newWorld();
  W.set(w);
  A.settings.init();
  // ×2 fast-forward: the country and province scales run at double time while it is on.
  D.$('fast').addEventListener('click', function () {
    var cur = W.get();
    if (!cur) return;
    cur.view.fast = !cur.view.fast;
    A.glance.clock(cur);
    W.changed('fast');
  });
  D.$('ready').addEventListener('click', function () {
    var cur = W.get();
    if (cur && !cur.over) W.skipToTurnEnd(cur);
  });
  A.scales.open(w, w.view.scale);
  W.saveLocal(w);
  A.start();
})();
