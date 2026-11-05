// Expansion Wars (combined) — seeded random numbers. The same seed gives the same map.
(function () {
  'use strict';
  var core = window.XW.core;

  // Mulberry32: a small seeded generator. Returns a function giving numbers in [0, 1).
  core.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  // A whole-number seed typed by a person, or null for a blank or invalid one.
  core.parseSeed = function (text) {
    var s = String(text || '').trim(), n = Number(s);
    return s && Number.isInteger(n) && n > 0 ? n : null;
  };

  core.randomSeed = function () { return 1 + Math.floor(Math.random() * 999999); };

  // An id for a world or a battle. Uses the browser's UUID when it has one.
  core.uuid = function () {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && c.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
      var r = Math.random() * 16 | 0, v = ch === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
})();
