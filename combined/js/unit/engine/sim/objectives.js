// Expansion Wars — unit battle engine: Objectives, the town bell, reinforcements and side strength.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};

  // ---- Objectives, bell and reinforcements ----------------------------------

  // The team that holds a point is the one team present there, or the team with most units when allies share it.
  // A point is contested (and no one gains) while two hostile teams stand on it.
  function updateObjectives(st, dt) {
    st.field.objectives.forEach(function (o) {
      var n = [];
      for (var t = 0; t < st.teams; t++) n[t] = 0;
      st.units.forEach(function (u) {
        if (u.state === 'active' && K.dist(u.x, u.y, o.x, o.y) <= o.r) n[u.side]++;
      });
      var present = [], s = null;
      for (var k = 0; k < st.teams; k++) if (n[k] > 0) present.push(k);
      var groupOf = present.length ? present[0] : null;
      var single = present.every(function (k) { return K.allied(st, k, groupOf); });
      if (present.length && single) {
        s = present[0];
        present.forEach(function (k) { if (n[k] > n[s]) s = k; });
      }
      if (s === null) return;
      for (var j = 0; j < st.teams; j++) {
        if (j === s) o.prog[j] = Math.min(C.HOLD, o.prog[j] + dt);
        else if (!K.allied(st, j, s)) o.prog[j] = Math.max(0, o.prog[j] - dt);
      }
      if (o.prog[s] >= C.HOLD && o.owner !== s) {
        o.owner = s;
        st.captures++;
        K.boostNear(st, s, o.x, o.y, o.r * 2, C.MORALE.capture, false);
        K.log(st, K.name(s) + ' takes ' + o.name + '.');
      }
    });
  }

  function levyPeople(st) { return Math.max(1, Math.round(st.grain / 4)); }

  function updateBell(st) {
    var bell = st.bell;
    if (!bell || bell.done || st.t < C.BELL.delay) return;
    bell.done = true;
    var count = Math.floor(bell.population / C.BELL.popPerLevy);
    var types = ['pikemen', 'slingers'], raised = 0;
    for (var i = 0; i < count; i++) {
      if (st.pool[1] < levyPeople(st)) break;
      st.pool[1] -= levyPeople(st);
      var p = st.field.bell;
      var x = p.x + (st.rng() - 0.5) * 2, y = p.y + (st.rng() - 0.5) * 2;
      if (!K.passableAt(st, x, y)) { x = p.x; y = p.y; }
      var u = K.newUnit(st, 1, types[i % 2], 'engage', 'line', x, y, levyPeople(st));
      u.morale = C.BELL.levyMorale;
      u.atkMul = C.BELL.levyAtk;
      u.levy = true;
      raised++;
    }
    st.levies += raised;
    K.log(st, raised ? 'The bell rings: ' + raised + ' levies take the field.' : 'The bell rings, but no one is left to answer.');
  }

  // Where a player unit heads when it has no order: the flank, the middle, or the enemy's base.
  function approachFor(st, mode) {
    var f = st.field, o = f.objectives[0];
    if (mode === 'mixed') mode = ['flank', 'centre', 'base'][Math.floor(st.rng() * 3)];
    if (mode === 'flank') return { x: Math.max(1, o.x - 6), y: f.flank[st.rng() < 0.5 ? 0 : 1] + 0.5 };
    if (mode === 'centre') return { x: st.cols / 2, y: st.rows / 2 };
    if (mode === 'base') return { x: f.settle.x, y: f.settle.y };
    return null;   // 'none': units stay where they are until ordered
  }

  // A computer-run team marches on the first objective.
  function marchOn(st, team) {
    var o = st.field.objectives[0];
    st.units.forEach(function (u) {
      if (u.side === team && !u.levy && u.state === 'active') u.order = { kind: 'route', points: [{ x: o.x, y: o.y }], i: 0, mode: 'move' };
    });
  }

  function updateReinforce(st, dt) {
    st.reinforceT -= dt;
    if (st.reinforceT > 0) return;
    st.reinforceT = C.REINFORCE_EVERY;
    while (st.reserve.length) {
      var d = st.reserve[0], need = K.peopleFor(st.grain, d.type);
      st.reserve.shift();
      if (st.pool[0] < need) {
        K.log(st, 'No more people at home for another wave.');
        continue;
      }
      st.pool[0] -= need;
      var edge = st.field.edge[0];
      var p = edge.length ? edge[Math.floor(st.rng() * edge.length)] : { x: 0.5, y: st.rows / 2 };
      var u = K.newUnit(st, 0, d.type, d.strategy, d.formation, p.x, p.y, need);
      if (K.isPlayer(st, u)) u.approach = approachFor(st, st.gen.approach);
      else u.order = { kind: 'route', points: [{ x: st.field.objectives[0].x, y: st.field.objectives[0].y }], i: 0, mode: 'move' };
      K.log(st, 'Reinforcements arrive: ' + C.UNIT[d.type].label.toLowerCase() + '.');
      break;
    }
  }

  // People a team can still bring: those on the field, plus what is on its way.
  function strength(st, team) {
    var n = 0;
    st.units.forEach(function (u) { if (u.side === team && u.state === 'active') n += u.people; });
    if (team === 0) st.reserve.forEach(function (d) { n += K.peopleFor(st.grain, d.type); });
    if (team === 1 && st.bell && !st.bell.done) {
      n += Math.min(Math.floor(st.bell.population / C.BELL.popPerLevy), Math.floor(st.pool[1] / levyPeople(st))) * levyPeople(st);
    }
    return n;
  }

  K.updateObjectives = updateObjectives;
  K.levyPeople = levyPeople;
  K.updateBell = updateBell;
  K.approachFor = approachFor;
  K.marchOn = marchOn;
  K.updateReinforce = updateReinforce;
  K.strength = strength;
})();
