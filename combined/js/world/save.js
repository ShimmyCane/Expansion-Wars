// Expansion Wars (combined) — keeping the world on this device. One saved world (the one being played).
// The family database copy is in world/cloud.js; this file never talks to the network.
(function () {
  'use strict';
  var XW = window.XW, W = XW.world, bus = XW.core.bus;
  var lastError = null;

  W.saveLocal = function (w) {
    try {
      localStorage.setItem(W.CONFIG.SAVE_KEY, JSON.stringify(w));
      lastError = null;
      bus.emit('world:saved', { where: 'device', ok: true, message: 'Saved on this device.' });
      return true;
    } catch (e) {
      lastError = 'The world could not be saved on this device: ' + e.message;
      bus.emit('world:saved', { where: 'device', ok: false, message: lastError });
      return false;
    }
  };

  // The saved world, brought up to date (world/state.js migrate), or null if there is none or it cannot be read.
  W.loadLocal = function () {
    try {
      var raw = localStorage.getItem(W.CONFIG.SAVE_KEY);
      return raw ? W.migrate(JSON.parse(raw)) : null;
    } catch (e) {
      lastError = 'The saved world could not be read: ' + e.message;
      return null;
    }
  };

  W.clearLocal = function () {
    try { localStorage.removeItem(W.CONFIG.SAVE_KEY); } catch (e) { /* no storage */ }
  };

  W.saveError = function () { return lastError; };
})();
