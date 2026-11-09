// Expansion Wars — unit battle engine: Computer plans and arranging an army: defender plan, placement, groups, planned paths.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};

  // ---- Computer plans --------------------------------------------------------

  // The defender (computer): a share of the infantry ambushes in the woods nearest the attack, the rest hold a station by the objective.
  function planDefender(st) {
    var units = st.units.filter(function (u) { return u.side === 1 && !u.levy; });
    var c = st.field.objectives[0];
    var woods = st.field.woodTiles.filter(function (p) { return p.x >= c.x - 2 && p.x <= c.x + 20; });   // woods on the defender's side of the objective
    var want = woods.length ? Math.floor(units.length * C.AI.ambushShare) : 0;
    var ambushers = 0, stations = 0;
    units.forEach(function (u) {
      if (ambushers < want && u.type !== 'cavalry' && u.type !== 'heavy' && u.type !== 'catapults') {
        var w = woods[ambushers % woods.length];
        u.x = w.x; u.y = w.y;
        u.strategy = 'ambush'; u.plan.strategy = 'ambush';
        ambushers++;
      } else if (u.type === 'cavalry' || u.type === 'heavy') {
        u.station = { x: c.x - 4, y: stations % 2 ? st.rows / 2 - 5 : st.rows / 2 + 5 };
        stations++;
      } else {
        u.station = { x: c.x - 2.5 + (stations % 4) * 1.5, y: c.y - 3 + Math.floor(stations / 4) * 2 };
        stations++;
      }
    });
  }

  // ---- Arranging the army -------------------------------------------------------

  // Where each role stands in a team's spawn box: front line toward the enemy, archers in the middle, cavalry on the flanks.
  function arrangeArmy(st, team, dots) {
    var bb = st.field.bbox[team], zone = st.field.spawn[team];
    var cx = 0, cy = 0;
    zone.forEach(function (p) { cx += p.x; cy += p.y; });
    cx /= zone.length; cy /= zone.length;
    var o = st.field.objectives[0];
    var ox = o.x - cx, oy = o.y - cy;
    var depthX = Math.abs(ox) >= Math.abs(oy);   // the army faces along the longer side of the way to the objective
    var front = depthX ? (ox > 0 ? bb.x1 - 1.5 : bb.x0 + 1.5) : (oy > 0 ? bb.y1 - 1.5 : bb.y0 + 1.5);
    var sgn = depthX ? (ox > 0 ? -1 : 1) : (oy > 0 ? -1 : 1);
    var lo = depthX ? bb.y0 + 1 : bb.x0 + 1, hi = depthX ? bb.y1 - 1 : bb.x1 - 1, mid = (lo + hi) / 2;
    var roles = { front: [], centre: [], flank: [] };
    dots.forEach(function (d) { roles[C.ROLE[d.type] || 'front'].push(d); });
    function place(list, depth, lateral) {
      list.forEach(function (d, i) {
        var lat = list.length === 1 ? lateral(0.5) : lateral(i / (list.length - 1));
        var x = depthX ? front + sgn * depth : lat, y = depthX ? lat : front + sgn * depth;
        var u = d.unit;
        var px = K.clamp(x, 0.5, st.cols - 0.5), py = K.clamp(y, 0.5, st.rows - 0.5);
        if (!K.passableAt(st, px, py)) { px = cx; py = cy; }
        u.x = px; u.y = py;
      });
    }
    // Each entry carries its unit so the placement can be set after the unit exists.
    var lateralSpan = function (a, b) { return function (f) { return a + (b - a) * f; }; };
    place(roles.front.map(function (d) { return { unit: d.unit }; }), 1.5, lateralSpan(lo, hi));
    place(roles.centre.map(function (d) { return { unit: d.unit }; }), 4, lateralSpan(mid - 3, mid + 3));
    place(roles.flank.map(function (d) { return { unit: d.unit }; }), 1.5, function (f) { return f < 0.5 ? lo + 0.5 : hi - 0.5; });
  }

  // Players' units placed in deployment: by role when the army is arranged, otherwise spread along the zone.
  function placeArmy(st, side, specs, arranged) {
    var dots = [];
    specs.forEach(function (s) { K.expand(s).forEach(function (d) { dots.push(d); }); });
    var zone = st.field.spawn[side], n = dots.length;
    if (!zone || !zone.length) return;
    var created = [];
    for (var i = 0; i < n; i++) {
      var d = dots[i], need = K.peopleFor(st.grain, d.type);
      if (st.pool[side] < need) break;
      st.pool[side] -= need;
      var p = zone[Math.floor((i + 0.5) * zone.length / n)];
      var x = p.x + (st.rng() - 0.5) * 0.6, y = p.y + (st.rng() - 0.5) * 0.6;
      if (!K.passableAt(st, x, y)) { x = p.x; y = p.y; }
      created.push({ type: d.type, strategy: d.strategy, formation: d.formation, need: need, x: x, y: y });
    }
    if (arranged && created.length) {
      var units = created.map(function (c) { return { type: c.type, unit: null, c: c }; });
      // Make the units first, at their spread positions, then move them into their arranged places.
      created.forEach(function (c) { c.unit = K.newUnit(st, side, c.type, c.strategy, c.formation, c.x, c.y, c.need); });
      arrangeArmy(st, side, created.map(function (c) { return { type: c.type, unit: c.unit }; }));
      return;
    }
    created.forEach(function (c) { K.newUnit(st, side, c.type, c.strategy, c.formation, c.x, c.y, c.need); });
  }

  // Groups: each player unit is in group 1 or 2. Each group's offsets from its centre are kept, so a group moves as one.
  function setGroupOffsets(st, team) {
    var groups = {};
    st.units.forEach(function (u) {
      if (u.side !== team || u.state !== 'active') return;
      (groups[u.group] = groups[u.group] || []).push(u);
    });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g], cx = 0, cy = 0;
      list.forEach(function (u) { cx += u.x; cy += u.y; });
      cx /= list.length; cy /= list.length;
      list.forEach(function (u) { u.offset = { x: u.x - cx, y: u.y - cy }; });
    });
  }

  // A group's approach: one point for the group, with every member keeping its place in the formation.
  function setGroupApproach(st, team, mode) {
    var groups = {};
    st.units.forEach(function (u) {
      if (u.side !== team || u.state !== 'active') return;
      (groups[u.group] = groups[u.group] || []).push(u);
    });
    Object.keys(groups).forEach(function (g) {
      var anchor = K.approachFor(st, mode);
      groups[g].forEach(function (u) {
        if (!anchor) { u.approach = null; return; }
        u.approach = { x: K.clamp(anchor.x + (u.offset ? u.offset.x : 0), 0.5, st.cols - 0.5), y: K.clamp(anchor.y + (u.offset ? u.offset.y : 0), 0.5, st.rows - 0.5) };
      });
    });
  }

  // The planned march of a unit, as points (for drawing). A stopped unit has no march: its future spot is its station or current spot.
  V4.plannedPath = function (st, u) {
    if (!u || u.state !== 'active') return null;
    var o = u.order;
    if (o && o.kind === 'route') {
      var pts = [{ x: u.x, y: u.y }], px = u.x, py = u.y;
      for (var i = o.i; i < o.points.length; i++) {
        var seg = K.pathTo(st, px, py, o.points[i].x, o.points[i].y);
        pts = pts.concat(seg.slice(1));
        px = o.points[i].x; py = o.points[i].y;
      }
      return { kind: 'march', points: pts, stop: null };
    }
    if (o && o.kind === 'hold') return { kind: 'stop', points: [], stop: { x: u.x, y: u.y } };
    if (u.station) return { kind: 'stop', points: [], stop: { x: u.station.x, y: u.station.y } };
    if (u.strategy === 'ambush' && !u.sprung) return { kind: 'stop', points: [], stop: { x: u.x, y: u.y } };
    if (u.approach && K.dist(u.x, u.y, u.approach.x, u.approach.y) > 0.5) {
      return { kind: 'march', points: K.pathTo(st, u.x, u.y, u.approach.x, u.approach.y), stop: null };
    }
    return null;
  };

  K.planDefender = planDefender;
  K.arrangeArmy = arrangeArmy;
  K.placeArmy = placeArmy;
  K.setGroupOffsets = setGroupOffsets;
  K.setGroupApproach = setGroupApproach;
})();
