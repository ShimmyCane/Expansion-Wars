// Expansion Wars — V4 battlefield. Builds the tiles, objectives and spawn zones from a battle request.
// Seeded random, no DOM.
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG;

  // Mulberry32: a small seeded generator, so the same seed gives the same field and battle.
  V4.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  V4.buildField = function (req, rng) {
    var COLS = C.COLS, ROWS = C.ROWS, tiles = [], x, y, i;
    for (i = 0; i < COLS * ROWS; i++) tiles.push('g');

    function get(xx, yy) {
      return (xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS) ? tiles[yy * COLS + xx] : null;
    }
    function put(xx, yy, code) {
      if (xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS) tiles[yy * COLS + xx] = code;
    }
    function woods(x0, x1, patches) {
      for (var k = 0; k < patches; k++) {
        var cx = x0 + rng() * (x1 - x0), cy = 2 + rng() * (ROWS - 4), r = 2 + rng() * 2.5;
        for (var yy = Math.floor(cy - r); yy <= cy + r; yy++) {
          for (var xx = Math.floor(cx - r); xx <= cx + r; xx++) {
            if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) < r && rng() > 0.2 && get(xx, yy) === 'g') put(xx, yy, 'w');
          }
        }
      }
    }

    var attackerTerrain = (req.attacker && req.attacker.terrain) || [];
    var defenderTerrain = (req.defender && req.defender.terrain) || [];
    var border = req.border || {};
    if (attackerTerrain.indexOf('woods') >= 0) woods(3, 21, 3);
    if (defenderTerrain.indexOf('woods') >= 0) woods(29, 46, 3);

    // The river runs down the centre line, with fords at two points.
    if (border.river) {
      for (y = 0; y < ROWS; y++) {
        var ford = (y >= 5 && y <= 7) || (y >= 24 && y <= 26);
        put(24, y, ford ? 'f' : 'r');
        put(25, y, ford ? 'f' : 'r');
      }
    }

    var settlement = (req.defender && req.defender.settlement) || 'none';
    var cx = 42, cy = 16, zoneDef;
    if (settlement === 'village') {
      [[40, 14], [41, 14], [40, 15], [41, 15], [42, 17], [43, 17], [42, 18], [43, 18]].forEach(function (p) { put(p[0], p[1], 't'); });
      zoneDef = { x0: 37, x1: 46, y0: 5, y1: 27 };
    } else if (settlement === 'town' || settlement === 'city') {
      for (y = 13; y <= 19; y++) for (x = 40; x <= 44; x++) put(x, y, 't');
      zoneDef = { x0: 38, x1: 46, y0: 6, y1: 26 };
    } else if (settlement === 'fortress') {
      for (x = 38; x <= 46; x++) { put(x, 10, 'x'); put(x, 22, 'x'); }
      for (y = 10; y <= 22; y++) { put(38, y, 'x'); put(46, y, 'x'); }
      put(38, 16, 'y');
      for (y = 11; y <= 21; y++) for (x = 39; x <= 45; x++) put(x, y, 't');
      zoneDef = { x0: 39, x1: 45, y0: 11, y1: 21 };
    } else {
      zoneDef = { x0: 44, x1: 48, y0: 3, y1: 28 };   // mirror of the attacker's zone, so open-field fights are fair
    }

    function zone(z) {
      var pts = [];
      for (var yy = z.y0; yy <= z.y1; yy++) {
        for (var xx = z.x0; xx <= z.x1; xx++) {
          var code = get(xx, yy);
          if (code !== null && !C.TERRAIN[code].impassable) pts.push({ x: xx + 0.5, y: yy + 0.5 });
        }
      }
      return pts;
    }

    // Objectives. A settlement is held by the defender at the start. Otherwise a flag sits on the centre line.
    var objectives = [];
    if (settlement !== 'none') {
      objectives.push({ id: 'settlement', name: 'the settlement', x: cx + 0.5, y: cy + 0.5, r: C.HOLD_RADIUS, settlement: true, owner: 1, prog: [0, C.HOLD] });
    } else {
      objectives.push({ id: 'flag', name: 'the flag', x: 25, y: 16, r: C.HOLD_RADIUS, settlement: false, owner: null, prog: [0, 0] });
    }
    if (req.scale === 'country') {
      objectives.push({ id: 'flag-n', name: 'the north flag', x: 25, y: 7, r: C.HOLD_RADIUS, settlement: false, owner: null, prog: [0, 0] });
      objectives.push({ id: 'flag-s', name: 'the south flag', x: 25, y: 25, r: C.HOLD_RADIUS, settlement: false, owner: null, prog: [0, 0] });
    }

    var edgeA = [], edgeB = [];
    for (y = 0; y < ROWS; y++) {
      if (get(0, y) !== null && !C.TERRAIN[get(0, y)].impassable) edgeA.push({ x: 0.5, y: y + 0.5 });
      if (get(COLS - 1, y) !== null && !C.TERRAIN[get(COLS - 1, y)].impassable) edgeB.push({ x: COLS - 0.5, y: y + 0.5 });
    }

    var woodTiles = [];
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (tiles[y * COLS + x] === 'w') woodTiles.push({ x: x + 0.5, y: y + 0.5 });

    return {
      tiles: tiles,
      woodTiles: woodTiles,
      objectives: objectives,
      spawn: { 0: zone({ x0: 1, x1: 5, y0: 3, y1: 28 }), 1: zone(zoneDef) },
      edge: { 0: edgeA, 1: edgeB },
      bell: { x: cx + 0.5, y: cy + 0.5 }
    };
  };
})();
