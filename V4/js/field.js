// Expansion Wars — V4 battlefield. Builds the tiles, objectives and spawn zones from a battle request.
// Seeded random, no DOM. The generator options come from req.gen (see C.GEN); missing ones use the defaults.
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

  // The generator options for a request: the request's own choices, with the defaults for anything it leaves out.
  V4.genOf = function (req) {
    var g = {}, given = (req && req.gen) || {};
    Object.keys(C.GEN).forEach(function (k) { g[k] = given[k] !== undefined ? given[k] : C.GEN[k]; });
    return g;
  };

  // The ground has its own seed (req.geoSeed), so a new geography keeps the armies and orders.
  V4.buildField = function (req) {
    var rng = V4.rng(req.geoSeed || req.seed || 1);
    var gen = V4.genOf(req);
    var size = C.SIZE[gen.size] || C.SIZE.small;
    var COLS = size.cols, ROWS = size.rows, k = COLS / C.COLS, big = k > 1;
    var tiles = [], x, y, i;
    for (i = 0; i < COLS * ROWS; i++) tiles.push('g');

    function get(xx, yy) {
      return (xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS) ? tiles[yy * COLS + xx] : null;
    }
    function put(xx, yy, code) {
      if (xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS) tiles[yy * COLS + xx] = code;
    }
    // Scatters patches of one cover type over the grass of a band of columns.
    function patches(x0, x1, count, code, rmin, rmax) {
      for (var n = 0; n < count; n++) {
        var cx = x0 + rng() * (x1 - x0), cy = 2 + rng() * (ROWS - 4);
        var r = (rmin + rng() * (rmax - rmin)) * (big ? 1.5 : 1);
        for (var yy = Math.floor(cy - r); yy <= cy + r; yy++) {
          for (var xx = Math.floor(cx - r); xx <= cx + r; xx++) {
            if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) < r && rng() > 0.2 && get(xx, yy) === 'g') put(xx, yy, code);
          }
        }
      }
    }

    var attackerTerrain = (req.attacker && req.attacker.terrain) || [];
    var defenderTerrain = (req.defender && req.defender.terrain) || [];
    if (gen.woods && attackerTerrain.indexOf('woods') >= 0) patches(3 * k, 21 * k, 3 * k, 'w', 2, 4.5);
    if (gen.woods && defenderTerrain.indexOf('woods') >= 0) patches(29 * k, 46 * k, 3 * k, 'w', 2, 4.5);
    if (gen.grass) {
      patches(3 * k, 21 * k, 2 * k, 'h', 1.5, 3);
      patches(29 * k, 46 * k, 2 * k, 'h', 1.5, 3);
    }

    // Settlement: not at the far edge. Walls with gates, the number of gates from the generator.
    var settlement = (req.defender && req.defender.settlement) || 'none';
    var sx = Math.round(COLS * (big ? 0.64 : 0.84)), sy = Math.round(ROWS / 2);
    var hx = 0, hy = 0, zoneDef;
    if (settlement === 'village') { hx = 4; hy = 4; }
    else if (settlement === 'town' || settlement === 'city') { hx = 5; hy = 5; }
    else if (settlement === 'fortress') { hx = 5; hy = 7; }

    // River: down the middle, one pair of crossings through the centre row and one each side of it.
    var rx = Math.floor(COLS / 2) - 1;
    var pairs = [sy - 1, Math.floor(ROWS * 0.25), Math.floor(ROWS * 0.75)];
    if (gen.river !== 'none') {
      for (y = 0; y < ROWS; y++) {
        var crossing = pairs.some(function (p) { return y === p || y === p + 1; });
        var code = gen.river === 'bridges' ? (crossing ? 'b' : 'v') : (crossing ? 'f' : 'r');
        put(rx, y, code);
        put(rx + 1, y, code);
      }
    }

    // Road: straight along the centre row from the attacker's edge to the settlement's west gate (or the flag).
    var flagX = Math.floor(COLS / 2), flagY = Math.floor(ROWS / 2);
    var roadEnd = settlement === 'none' ? flagX - 2 : sx - hx;
    if (gen.roads) {
      for (x = 0; x <= roadEnd; x++) {
        var c = get(x, sy);
        if (c === 'g' || c === 'w' || c === 'h') put(x, sy, 'd');
      }
    }

    // Settlement walls and gates. Gates are the openings: west (the attacker's side), east, north, south.
    if (settlement !== 'none') {
      if (settlement === 'village') {
        [[sx - 2, sy - 2], [sx - 1, sy - 2], [sx - 2, sy - 1], [sx - 1, sy - 1],
         [sx, sy + 1], [sx + 1, sy + 1], [sx, sy + 2], [sx + 1, sy + 2]].forEach(function (p) { put(p[0], p[1], 't'); });
        zoneDef = { x0: sx - hx + 1, x1: sx + hx - 1, y0: sy - hy + 1, y1: sy + hy - 1 };
      } else {
        for (y = sy - hy + 1; y <= sy + hy - 1; y++) for (x = sx - hx + 1; x <= sx + hx - 1; x++) put(x, y, 't');
        zoneDef = { x0: sx - hx + 1, x1: sx + hx - 1, y0: sy - hy + 1, y1: sy + hy - 1 };
      }
      if (gen.walls) {
        for (x = sx - hx; x <= sx + hx; x++) { put(x, sy - hy, 'x'); put(x, sy + hy, 'x'); }
        for (y = sy - hy; y <= sy + hy; y++) { put(sx - hx, y, 'x'); put(sx + hx, y, 'x'); }
        var gates = [[sx - hx, sy], [sx + hx, sy], [sx, sy - hy], [sx, sy + hy]];
        for (i = 0; i < gen.gates && i < gates.length; i++) put(gates[i][0], gates[i][1], 'y');
      }
    } else {
      zoneDef = { x0: COLS - 6, x1: COLS - 2, y0: 3, y1: ROWS - 4 };   // mirror of the attacker's zone, so open-field fights are fair
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
      objectives.push({ id: 'settlement', name: 'the settlement', x: sx + 0.5, y: sy + 0.5, r: C.HOLD_RADIUS, settlement: true, owner: 1, prog: [0, C.HOLD] });
    } else {
      objectives.push({ id: 'flag', name: 'the flag', x: flagX, y: flagY, r: C.HOLD_RADIUS, settlement: false, owner: null, prog: [0, 0] });
    }
    if (req.scale === 'country') {
      objectives.push({ id: 'flag-n', name: 'the north flag', x: flagX, y: Math.round(ROWS * 0.22), r: C.HOLD_RADIUS, settlement: false, owner: null, prog: [0, 0] });
      objectives.push({ id: 'flag-s', name: 'the south flag', x: flagX, y: Math.round(ROWS * 0.78), r: C.HOLD_RADIUS, settlement: false, owner: null, prog: [0, 0] });
    }

    // A third team (if the request has one) comes down from the north edge, by the middle.
    var spawn = { 0: zone({ x0: 1, x1: 5 * k, y0: 3 * k, y1: ROWS - 4 }), 1: zone(zoneDef) };
    if (req.third) spawn[2] = zone({ x0: flagX - 4 * k, x1: flagX + 4 * k, y0: 1, y1: 4 * k });

    // Where each team may place its units by hand: its spawn area, one tile wider.
    var bbox = {};
    [0, 1, 2].forEach(function (t) {
      var pts = spawn[t] || [];
      if (!pts.length) { bbox[t] = null; return; }
      bbox[t] = {
        x0: Math.max(0, Math.min.apply(null, pts.map(function (p) { return p.x; })) - 1.5),
        x1: Math.min(COLS, Math.max.apply(null, pts.map(function (p) { return p.x; })) + 1.5),
        y0: Math.max(0, Math.min.apply(null, pts.map(function (p) { return p.y; })) - 1.5),
        y1: Math.min(ROWS, Math.max.apply(null, pts.map(function (p) { return p.y; })) + 1.5)
      };
    });

    var edgeA = [], edgeB = [];
    for (y = 0; y < ROWS; y++) {
      if (get(0, y) !== null && !C.TERRAIN[get(0, y)].impassable) edgeA.push({ x: 0.5, y: y + 0.5 });
      if (get(COLS - 1, y) !== null && !C.TERRAIN[get(COLS - 1, y)].impassable) edgeB.push({ x: COLS - 0.5, y: y + 0.5 });
    }

    var woodTiles = [];
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (tiles[y * COLS + x] === 'w') woodTiles.push({ x: x + 0.5, y: y + 0.5 });

    return {
      cols: COLS,
      rows: ROWS,
      deployX: C.DEPLOY_X + (k - 1) * 3,
      tiles: tiles,
      woodTiles: woodTiles,
      objectives: objectives,
      spawn: spawn,
      bbox: bbox,
      edge: { 0: edgeA, 1: edgeB },
      bell: { x: sx + 0.5, y: sy + 0.5 },
      settle: { x: sx + 0.5, y: sy + 0.5 },
      flank: [Math.round(ROWS * 0.25), Math.round(ROWS * 0.75)]
    };
  };
})();
