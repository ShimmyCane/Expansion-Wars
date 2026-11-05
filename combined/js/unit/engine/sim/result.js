// Expansion Wars — unit battle engine: The result of a battle, and the helpers other files use.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};

  V4.result = function (st) {
    var d = st.done || { winner: null, how: 'running', t: st.t, winners: [] };
    var survivors = [], surv = [], t;
    for (t = 0; t < st.teams; t++) { survivors[t] = K.zeroTypes(); surv[t] = 0; }
    st.units.forEach(function (u) {
      if (u.state === 'dead') return;
      survivors[u.side][u.type] += u.people;
      surv[u.side] += u.people;
    });
    var captured = st.field.objectives.some(function (o) { return o.settlement && o.owner !== null && K.allied(st, o.owner, 0); });
    function round(obj) {
      var out = {};
      Object.keys(obj).forEach(function (k) { out[k] = Math.round(obj[k]); });
      return out;
    }
    var losses = {}, sv = {}, pool = {};
    for (t = 0; t < st.teams; t++) {
      losses[K.name(t)] = round(st.losses[t]);
      sv[K.name(t)] = round(survivors[t]);
      pool[K.name(t)] = Math.round(st.pool[t] + surv[t]);
    }
    return {
      seed: st.seed,
      winner: d.winner === null ? null : K.name(d.winner),
      winners: (d.winners || []).map(K.name),
      how: d.how,
      captured: captured && d.winner !== null && K.allied(st, d.winner, 0),
      losses: { attacker: losses.attacker, defender: losses.defender, third: losses.third || {} },
      survivors: { attacker: sv.attacker, defender: sv.defender, third: sv.third || {} },
      pool: { attacker: pool.attacker, defender: pool.defender, third: pool.third || 0 },
      // Kills by unit type: the people each side's units killed, credited to the type that killed them.
      killsBy: { attacker: round(st.kills[0]), defender: round(st.kills[1]), third: round(st.kills[2]) },
      levies: st.levies,
      seconds: Math.round(st.t)
    };
  };

  V4.sim = { newUnit: K.newUnit, peopleFor: K.peopleFor, findUnit: K.findUnit, visibleEnemy: K.visibleEnemy, zeroTypes: K.zeroTypes, localCount: K.localCount, allied: K.allied };
})();
