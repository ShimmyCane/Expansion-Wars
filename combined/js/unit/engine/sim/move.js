// Expansion Wars — unit battle engine: Movement: flow fields, steps, routes and paths.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // ---- Movement --------------------------------------------------------------

  // Walking distances on the tile grid (4-way, ignoring terrain cost). One field per target, cached.
  function flowField(st, tx, ty) {
    var c0 = K.clamp(Math.floor(tx), 0, st.cols - 1), r0 = K.clamp(Math.floor(ty), 0, st.rows - 1);
    var key = c0 + ',' + r0;
    if (st.flows[key]) return st.flows[key];
    var d = new Int32Array(st.cols * st.rows).fill(-1), q = [r0 * st.cols + c0];
    d[q[0]] = 0;
    for (var i = 0; i < q.length; i++) {
      var cur = q[i], c = cur % st.cols, r = (cur - c) / st.cols;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var nc = c + o[0], nr = r + o[1];
        if (nc < 0 || nr < 0 || nc >= st.cols || nr >= st.rows) return;
        var n = nr * st.cols + nc;
        if (d[n] >= 0 || C.TERRAIN[st.field.tiles[n]].impassable) return;
        d[n] = d[cur] + 1;
        q.push(n);
      });
    }
    st.flows[key] = d;
    return d;
  }

  // mul is the speed factor for the order or strategy. The unit's own speed, formation, terrain and fatigue apply here.
  function moveUnit(st, u, tx, ty, mul, dt) {
    var U = C.UNIT[u.type], F = C.FORMATION[u.formation];
    var dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    var T = K.terrainAt(st, u.x, u.y);
    var m = T.speed;
    if (U.mounted && T.cavSpeed) m *= T.cavSpeed;
    if (K.fatigueOn(st)) m *= 1 - C.FATIGUE.speedLoss * u.fat / 100;
    var step = Math.min(d, U.speed * F.speed * mul * m * dt);
    var nx = u.x + dx / d * step, ny = u.y + dy / d * step;
    var before = u.x + ',' + u.y;
    if (K.passableAt(st, nx, ny)) { u.x = nx; u.y = ny; }
    else if (K.passableAt(st, nx, u.y)) { u.x = nx; }
    else if (K.passableAt(st, u.x, ny)) { u.y = ny; }
    if ((u.x + ',' + u.y) !== before) {
      u.moved = true;
      if (K.facingOn(st)) u.dir = Math.atan2(dy, dx);   // a unit faces the way it marches
    }
  }

  // The next tile on the way to a target: the neighbour with the smallest walking distance, or null if there is none.
  function nextStep(st, x, y, tx, ty) {
    var f = flowField(st, tx, ty);
    var c = K.clamp(Math.floor(x), 0, st.cols - 1), r = K.clamp(Math.floor(y), 0, st.rows - 1);
    var cur = f[r * st.cols + c];
    if (cur <= 0) return null;
    var best = null, bestD = cur;
    DIRS.forEach(function (o) {
      var nc = c + o[0], nr = r + o[1];
      if (nc < 0 || nr < 0 || nc >= st.cols || nr >= st.rows) return;
      var nd = f[nr * st.cols + nc];
      if (nd >= 0 && nd < bestD) { bestD = nd; best = { x: nc + 0.5, y: nr + 0.5 }; }
    });
    return best;
  }

  // Walks toward a point by the flow field, so units go round walls and through gates and bridges.
  function goTo(st, u, tx, ty, mul, dt) {
    var f = flowField(st, tx, ty);
    var c = K.clamp(Math.floor(u.x), 0, st.cols - 1), r = K.clamp(Math.floor(u.y), 0, st.rows - 1);
    var cur = f[r * st.cols + c];
    if (cur <= 0) return moveUnit(st, u, tx, ty, mul, dt);   // no way found, or in the target tile: go straight at it
    var n = nextStep(st, u.x, u.y, tx, ty);
    if (n) moveUnit(st, u, n.x, n.y, mul, dt);
  }

  // The route a unit will take to a point, as points on the tile grid (for drawing the planned march).
  function pathTo(st, x0, y0, x1, y1) {
    var pts = [{ x: x0, y: y0 }], x = x0, y = y0, guard = 0;
    var f = flowField(st, x1, y1);
    if (f[K.clamp(Math.floor(y), 0, st.rows - 1) * st.cols + K.clamp(Math.floor(x), 0, st.cols - 1)] < 0) {
      pts.push({ x: x1, y: y1 });
      return pts;
    }
    while (guard++ < 2000) {
      var n = nextStep(st, x, y, x1, y1);
      if (!n) break;
      pts.push(n); x = n.x; y = n.y;
    }
    pts.push({ x: x1, y: y1 });
    return pts;
  }

  K.flowField = flowField;
  K.moveUnit = moveUnit;
  K.nextStep = nextStep;
  K.goTo = goTo;
  K.pathTo = pathTo;
})();
