// Expansion Wars — unit battle engine: Public API: createBattle, step and issue.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};
  var TICK = C.TICK;

  // ---- Public API ------------------------------------------------------------

  V4.createBattle = function (req, opts) {
    opts = opts || {};
    var scale = req.scale || 'fortress';
    var gen = V4.genOf(req);
    var field = V4.buildField(req);
    var teams = req.third ? 3 : 2;
    var allied = [];
    for (var a = 0; a < 3; a++) { allied[a] = [false, false, false]; allied[a][a] = true; }
    (req.alliances || []).forEach(function (pair) { allied[pair[0]][pair[1]] = true; allied[pair[1]][pair[0]] = true; });
    var you = req.mode === 'auto' ? null : (req.you === undefined ? 0 : req.you);
    var rng = V4.rng(req.seed || 1);
    var st = {
      seed: req.seed || 1, mode: req.mode || 'play', gen: gen, you: you, teams: teams, allied: allied,
      t: 0, tick: 0, scale: scale, grain: req.grain || C.GRAIN[scale], cap: C.CAP[scale],
      cols: field.cols, rows: field.rows, deployX: field.deployX,
      field: field, rng: rng, units: [], nextId: 1, flows: {},
      animate: !!opts.animate, events: [], log: [], commands: [],
      pool: [req.attacker.pool || 0, req.defender.pool || 0, req.third ? (req.third.pool || 0) : 0],
      losses: [K.zeroTypes(), K.zeroTypes(), K.zeroTypes()], kills: [K.zeroTypes(), K.zeroTypes(), K.zeroTypes()], levies: 0,
      done: null, manual: null, captures: 0,
      reserve: [], bell: null, reinforceT: C.REINFORCE_EVERY,
      seen: []
    };
    var attackerDots = [];
    (req.attacker.reserve || []).forEach(function (s) { K.expand(s).forEach(function (d) { attackerDots.push(d); }); });
    st.reserve = attackerDots;

    var tiers = ['village', 'town', 'city', 'fortress'];
    if (tiers.indexOf(req.defender.settlement) >= 0 && (req.defender.population || 0) > 0) {
      st.bell = { done: false, population: req.defender.population };
    }

    var specs = [req.attacker.units || [], req.defender.units || [], req.third ? (req.third.units || []) : []];
    for (var t = 0; t < teams; t++) K.placeArmy(st, t, specs[t], t === you);
    // A big army has a general, with its first line unit (or its first unit).
    [req.attacker, req.defender, req.third].forEach(function (side, i) {
      if (!side || i >= teams || !((side.pool || 0) > C.GENERAL.pool)) return;
      var mine = st.units.filter(function (u) { return u.side === i; });
      var g = mine.filter(function (u) { return C.TEAM.line.indexOf(u.type) >= 0; })[0] || mine[0];
      if (g) g.general = true;
    });

    // Groups: the player's army is in up to two groups, with a place in the formation.
    if (you !== null) {
      K.setGroupOffsets(st, you);
      if (gen.approach !== 'none') K.setGroupApproach(st, you, gen.approach);
    }
    // The computer plays every team that is not the player's.
    for (t = 0; t < teams; t++) {
      if (t === you) continue;
      if (t === 1) { if (req.defender.ai !== false) K.planDefender(st); else K.marchOn(st, 1); }
      else K.marchOn(st, t);
    }
    K.computeVision(st);
    K.checkEnd(st);
    return st;
  };

  V4.step = function (st) {
    if (st.done) return;
    st.t += TICK;
    st.tick++;
    if (st.animate) st.events = st.events.filter(function (e) { return st.t - e.t < 1; });
    K.updateBell(st);
    K.updateReinforce(st, TICK);
    K.computeVision(st);   // what each side can see now, before anyone acts

    // Units act in a random order each tick (seeded), so no side always moves first.
    var order = st.units.slice();
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(st.rng() * (i + 1)), tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    st.units.forEach(function (u) { u.moved = false; });
    var hits = [];
    order.forEach(function (u) {
      if (u.state === 'active') K.decide(st, u, TICK, hits);
      else if (u.state === 'routing') K.retreat(st, u, TICK);
    });
    st.units.forEach(function (u) { u.still = u.moved ? 0 : u.still + TICK; });
    K.applyHits(st, hits);
    K.separate(st);
    K.updateFatigue(st);
    K.updateObjectives(st, TICK);
    K.updateMorale(st);
    K.computeVision(st);
    K.checkEnd(st);
  };

  // Player commands. Each accepted command is recorded with the tick it was given on, so a replay can apply it at the same moment.
  //   place      (before the battle) move one of your units within your deployment box
  //   move       attack move to a point (a route of one point)
  //   rush       rush move to a point, ignoring enemies on the way
  //   route      a route through several points: { points, mode: 'move' | 'rush' }
  //   attack     attack a named enemy unit
  //   strike     a hidden unit strikes now (only when it has offered the strike)
  //   hold, strategy, formation, proceed, surrender
  //   assign     put one of your units in group 1 or 2
  //   group      give one order to a whole group: { group, action: move | rush | hold | strategy | formation, x, y or value }
  V4.issue = function (st, cmd) {
    if (st.done) return false;
    var ok = K.apply(st, cmd);
    if (ok) st.commands.push({ tick: st.tick, cmd: cmd });
    return ok;
  };
})();
