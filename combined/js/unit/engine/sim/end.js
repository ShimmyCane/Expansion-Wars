// Expansion Wars — unit battle engine: The end of a battle: alliances, winners, surrender.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};
  var TICK = C.TICK;

  // ---- End of battle ---------------------------------------------------------

  // The teams allied with t, in order.
  function alliance(st, t) {
    var out = [];
    for (var k = 0; k < st.teams; k++) if (K.allied(st, k, t)) out.push(k);
    return out;
  }

  function finish(st, winner, how) {
    var members = alliance(st, winner);
    st.done = { winner: winner, how: how, t: Math.round(st.t * 10) / 10, winners: members };
    K.log(st, K.name(winner) + (members.length > 1 ? ' and allies' : '') + ' win (' + how + ').');
  }

  // The team to credit when team t gives up: the strongest team hostile to it.
  function opponentOf(st, t, alive) {
    var best = null, bs = -1;
    alive.forEach(function (k) {
      if (K.allied(st, k, t)) return;
      var s = K.strength(st, k);
      if (s > bs) { bs = s; best = k; }
    });
    return best === null ? (t === 0 ? 1 : 0) : best;
  }

  function checkEnd(st) {
    if (st.done) return;
    var act = [], routed = [], pend = [], t, u;
    for (t = 0; t < st.teams; t++) { act[t] = 0; routed[t] = 0; pend[t] = 0; }
    st.units.forEach(function (x) {
      if (x.state === 'active') act[x.side]++;
      else if (x.state === 'routing') routed[x.side]++;
    });
    pend[0] = st.reserve.length;
    if (st.bell && !st.bell.done) pend[1] = 1;
    var alive = [];
    for (t = 0; t < st.teams; t++) if (act[t] + pend[t] > 0) alive.push(t);

    if (st.manual !== null) return finish(st, opponentOf(st, st.manual, alive.length ? alive : [0, 1]), 'surrender');

    // Objectives: all of them held by one alliance, after a capture (so a defender holding its settlement at the start does not end it).
    var obj = st.field.objectives;
    if (st.captures > 0 && obj.length && obj[0].owner !== null) {
      var holders = alliance(st, obj[0].owner);
      if (obj.every(function (o) { return o.owner !== null && holders.indexOf(o.owner) >= 0; })) return finish(st, obj[0].owner, 'objectives');
    }

    if (alive.length === 0) return finish(st, 1, 'rout');   // no units at all: a rout
    // Teams that are still in play, grouped by alliance. One group left means the battle is over.
    var groups = [];
    alive.forEach(function (k) {
      var g = alliance(st, k);
      if (!groups.some(function (h) { return h.indexOf(k) >= 0; })) groups.push(g);
    });
    if (groups.length === 1) {
      var anyRouted = [];
      for (t = 0; t < st.teams; t++) if (alive.indexOf(t) < 0 && routed[t] > 0) anyRouted.push(t);
      return finish(st, alive[0], anyRouted.length ? 'surrender' : 'rout');
    }

    // A team that is down to a twentieth of its enemies' strength gives up.
    var str = [];
    for (t = 0; t < st.teams; t++) str[t] = K.strength(st, t);
    for (var i = 0; i < alive.length; i++) {
      var a = alive[i], foes = 0;
      alive.forEach(function (k) { if (!K.allied(st, k, a)) foes += str[k]; });
      if (foes > 0 && str[a] * C.SURRENDER_RATIO <= foes) return finish(st, opponentOf(st, a, alive), 'surrender');
    }

    if (st.tick * TICK >= st.cap) {
      var attackerHolds = st.captures > 0 && obj.length && obj.every(function (o) { return o.owner !== null && K.allied(st, o.owner, 0); });
      return attackerHolds ? finish(st, 0, 'objectives') : finish(st, 1, 'time');
    }
  }

  K.alliance = alliance;
  K.finish = finish;
  K.opponentOf = opponentOf;
  K.checkEnd = checkEnd;
})();
