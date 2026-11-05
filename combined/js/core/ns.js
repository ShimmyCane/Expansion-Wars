// Expansion Wars (combined) — the one global, XW. Every module hangs off it, so a file only needs this loaded first.
//   XW.core      small helpers with no game rules (random, geometry, events, DOM)
//   XW.world     the single source of truth: the world state, its clock, saving and the family database
//   XW.country   country rules (turns, economy, diplomacy, war) and the country view
//   XW.province  province rules (real-time spots and marches on the world's provinces) and the province view
//   XW.unit      the bridge to the unit battle engine (window.V4) and the battle view
//   XW.app       the scale switcher, the frame loop, settings and start-up
(function (root) {
  'use strict';
  var XW = root.XW = root.XW || {};
  ['core', 'world', 'country', 'province', 'unit', 'app'].forEach(function (k) { XW[k] = XW[k] || {}; });
})(typeof window !== 'undefined' ? window : this);
