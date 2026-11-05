// Expansion Wars (combined) — the frame loop and saving. Each frame: the world clock moves on at the rate of the scale
// on screen (time dilation), any country turn that is due is resolved, the scale on screen runs its own time, and the
// world is saved now and then. Whatever the scale, the same world is the one being changed.
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, W = XW.world, C = XW.country, bus = XW.core.bus;
  var last = null, saveT = 0, glanceT = 0, dirty = false, pendingRender = false, running = false;

  // Save on this device at once, and to the family database (at once for a turn or a battle, otherwise when due).
  A.saveNow = function (reason) {
    var w = W.get();
    if (!w) return;
    W.saveLocal(w);
    W.cloud.sync(w, reason === 'turn' || reason === 'battle' || reason === 'button');
    dirty = false;
    saveT = 0;
  };

  function frame(now) {
    var w = W.get();
    var dt = last === null ? 0 : Math.min(0.25, (now - last) / 1000);
    last = now;
    if (w) {
      var scale = w.view.scale;
      W.advance(w, dt, scale);
      var turned = false;
      while (W.turnDue(w)) { C.endTurn(w); turned = true; }
      if (turned) { bus.emit('world:turn', w); W.changed('turn'); A.saveNow('turn'); }
      A.views[w.view.scale].tick(w, dt);
      glanceT += dt;
      if (glanceT > 0.25) { glanceT = 0; A.glance.clock(w); A.glance.numbers(w); }
      saveT += dt;
      if (saveT > W.CONFIG.AUTOSAVE) { saveT = 0; W.saveLocal(w); W.cloud.sync(w, false); }
    }
    requestAnimationFrame(frame);
  }

  // A change redraws the scale on screen once, on the next frame, however many changes there were.
  bus.on('world:changed', function () {
    dirty = true;
    if (pendingRender) return;
    pendingRender = true;
    requestAnimationFrame(function () {
      pendingRender = false;
      var w = W.get();
      if (!w) return;
      A.views[w.view.scale].render(w);
      A.glance.render(w);
    });
  });

  // Leaving the page or hiding the tab saves the world first.
  function flush() { if (W.get()) W.saveLocal(W.get()); }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); else last = null; });

  A.start = function () {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  };
  A.isDirty = function () { return dirty; };
})();
