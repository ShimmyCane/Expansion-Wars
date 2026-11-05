// Expansion Wars (combined) — a tiny event bus. Modules announce what changed; the views and the saver listen.
// Events used:
//   world:new      a new world was made or loaded          (world)
//   world:changed  the world changed (redraw)              (world, reason)
//   world:turn     a country turn ended                     (world)
//   world:saved    a save finished                          ({ where, ok, message })
//   scale:enter    the player moved to another scale       ({ scale, prov })
(function () {
  'use strict';
  var core = window.XW.core;
  var handlers = {};

  core.bus = {
    on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    off: function (name, fn) { handlers[name] = (handlers[name] || []).filter(function (h) { return h !== fn; }); },
    emit: function (name, a, b) {
      (handlers[name] || []).slice().forEach(function (fn) {
        try { fn(a, b); } catch (e) { if (typeof console !== 'undefined') console.error(name, e); }
      });
    }
  };
})();
