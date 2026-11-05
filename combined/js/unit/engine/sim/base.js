// Expansion Wars — unit battle engine: Shared helpers: tiles and terrain, counters, walls, people per dot, units.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};
  var PI = Math.PI;

  function zeroTypes() { var o = {}; C.TYPES.forEach(function (t) { o[t] = 0; }); return o; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function wrap(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
  function name(t) { return C.TEAM_NAME[t]; }

  function tileCode(st, x, y) {
    var c = Math.floor(x), r = Math.floor(y);
    if (c < 0 || r < 0 || c >= st.cols || r >= st.rows) return null;
    return st.field.tiles[r * st.cols + c];
  }
  function terrainAt(st, x, y) { return C.TERRAIN[tileCode(st, x, y) || 'g'] || C.TERRAIN.g; }
  function passableAt(st, x, y) {
    var code = tileCode(st, x, y);
    return code !== null && !C.TERRAIN[code].impassable;
  }
  function counter(a, b) {
    if (C.STRONG[a].indexOf(b) >= 0) return C.COUNTER.up;
    if (C.WEAK[a].indexOf(b) >= 0) return C.COUNTER.down;
    return 1;
  }
  function facingOn(st) { return !!st.gen.facing && st.scale !== 'village'; }
  function fatigueOn(st) { return !!st.gen.fatigue; }

  // Teams that are allied with each other (a team is allied with itself).
  function allied(st, a, b) { return a === b || !!st.allied[a][b]; }
  function isPlayer(st, u) { return st.you !== null && u.side === st.you; }

  // Inside a walled settlement (the interior box), and the nearest passable spot outside it.
  function insideWalls(st, x, y) {
    var I = st.field.interior;
    return !!I && x > I.x0 && x < I.x1 && y > I.y0 && y < I.y1;
  }
  function nearestOutside(st, x, y) {
    var best = null, bd = Infinity;
    for (var r = 1; r <= 8; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var px = Math.floor(x) + dx + 0.5, py = Math.floor(y) + dy + 0.5;
          if (insideWalls(st, px, py) || !passableAt(st, px, py)) continue;
          var d = dist(x, y, px, py);
          if (d < bd) { bd = d; best = { x: px, y: py }; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // People in one dot: a scale name (its C.GRAIN) or a grain number (a battle's own, see req.grain).
  // Cavalry are half a grain, catapults a crew of up to four.
  function peopleFor(scale, type) {
    var g = typeof scale === 'number' ? scale : C.GRAIN[scale];
    if (type === 'cavalry') return Math.max(1, Math.round(g / 2));
    if (type === 'catapults') return Math.max(1, Math.min(4, g));
    return g;
  }

  function log(st, text) { st.log.push({ t: Math.round(st.t * 10) / 10, text: text }); }

  function expand(spec) {
    var out = [];
    for (var i = 0; i < (spec.count || 0); i++) {
      out.push({ type: spec.type, strategy: spec.strategy || 'engage', formation: spec.formation || 'line' });
    }
    return out;
  }

  function findUnit(st, id) {
    for (var i = 0; i < st.units.length; i++) if (st.units[i].id === id) return st.units[i];
    return null;
  }

  function newUnit(st, side, type, strategy, formation, x, y, people) {
    var u = {
      id: st.nextId++, side: side, type: type, people: people, start: people, morale: 100,
      x: x, y: y, facing: side === 0 ? 1 : -1, dir: side === 0 ? 0 : (side === 1 ? PI : PI / 2),
      formation: formation || 'line', strategy: strategy || 'engage',
      plan: { strategy: strategy || 'engage', formation: formation || 'line' },
      group: C.DEFAULT_GROUP[type] || 1, offset: null,
      order: null, station: null, approach: null, state: 'active',
      ambushT: 0, ambushSeen: false, sprung: false, hidden: false,
      strikePrompt: false, strikeOrdered: false, revealT: 0,
      chargeT: 0, fireT: 0, atkMul: 1, hitThis: 0, incoming: 0, levy: false,
      moved: false, still: 0, fat: 0, lastHitTick: -1000
    };
    st.units.push(u);
    return u;
  }

  K.zeroTypes = zeroTypes;
  K.clamp = clamp;
  K.dist = dist;
  K.wrap = wrap;
  K.name = name;
  K.tileCode = tileCode;
  K.terrainAt = terrainAt;
  K.passableAt = passableAt;
  K.counter = counter;
  K.facingOn = facingOn;
  K.fatigueOn = fatigueOn;
  K.allied = allied;
  K.isPlayer = isPlayer;
  K.insideWalls = insideWalls;
  K.nearestOutside = nearestOutside;
  K.peopleFor = peopleFor;
  K.log = log;
  K.expand = expand;
  K.findUnit = findUnit;
  K.newUnit = newUnit;
})();
