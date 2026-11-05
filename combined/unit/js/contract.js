// Expansion Wars — V4 contract with V2: request checks, auto mode and sample requests. No DOM.
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG;
  var SCALES = ['village', 'fortress', 'country'];
  var SETTLEMENTS = ['none', 'village', 'town', 'city', 'fortress'];

  // Returns a list of problems. An empty list means the request can be played.
  V4.validateRequest = function (req) {
    var bad = [];
    if (!req || typeof req !== 'object') return ['request is not an object'];
    if (SCALES.indexOf(req.scale) < 0) bad.push('scale must be village, fortress or country');
    ['attacker', 'defender', 'third'].forEach(function (side) {
      var s = req[side];
      if (!s) { if (side !== 'third') bad.push(side + ' is missing'); return; }
      // No more than MAX_PER_TYPE of one type on a side.
      var per = {};
      (s.units || []).forEach(function (u) { per[u.type] = (per[u.type] || 0) + (u.count || 0); });
      Object.keys(per).forEach(function (t) {
        if (per[t] > C.MAX_PER_TYPE) bad.push(side + ' can have at most ' + C.MAX_PER_TYPE + ' ' + t + ' (has ' + per[t] + ')');
      });
      if (!(s.pool >= 0)) bad.push(side + '.pool must be a number of 0 or more');
      if (!Array.isArray(s.units)) bad.push(side + '.units must be a list');
      else s.units.forEach(function (u) {
        if (C.TYPES.indexOf(u.type) < 0) bad.push(side + ' has an unknown type: ' + u.type);
        if (!(u.count >= 0)) bad.push(side + ' unit count must be 0 or more');
        if (u.strategy && !C.STRATEGY[u.strategy]) bad.push(side + ' unknown strategy: ' + u.strategy);
        if (u.formation && !C.FORMATION[u.formation]) bad.push(side + ' unknown formation: ' + u.formation);
      });
    });
    if (req.defender && SETTLEMENTS.indexOf(req.defender.settlement || 'none') < 0) bad.push('defender.settlement is not recognised');
    if (req.third) {
      if (!Array.isArray(req.third.units)) bad.push('third.units must be a list');
      else req.third.units.forEach(function (u) {
        if (C.TYPES.indexOf(u.type) < 0) bad.push('third has an unknown type: ' + u.type);
      });
      if (!(req.third.pool >= 0)) bad.push('third.pool must be a number of 0 or more');
    }
    var teams = req.third ? 3 : 2;
    if (req.you !== undefined && (req.you === null ? false : (req.you < 0 || req.you >= teams || req.you % 1 !== 0))) {
      bad.push('you must be the attacker, the defender' + (teams === 3 ? ' or the third team' : ''));
    }
    (req.alliances || []).forEach(function (pair) {
      if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] ||
          [pair[0], pair[1]].some(function (t) { return t < 0 || t >= teams || t % 1 !== 0; })) {
        bad.push('an alliance must join two different teams that are in the battle');
      }
    });
    if (req.geoSeed !== undefined && !(req.geoSeed >= 0)) bad.push('geoSeed must be a number');
    if (req.gen) {
      Object.keys(req.gen).forEach(function (k) {
        if (!(k in C.GEN)) bad.push('generator has an unknown option: ' + k);
        else if (C.GEN_OPTIONS[k] && C.GEN_OPTIONS[k].indexOf(req.gen[k]) < 0) bad.push('generator ' + k + ' cannot be ' + req.gen[k]);
      });
      if (req.gen.facing !== undefined && typeof req.gen.facing !== 'boolean') bad.push('generator facing must be on or off');
      if (req.gen.roads !== undefined && typeof req.gen.roads !== 'boolean') bad.push('generator roads must be on or off');
      if (req.gen.grass !== undefined && typeof req.gen.grass !== 'boolean') bad.push('generator grass must be on or off');
      if (req.gen.fatigue !== undefined && typeof req.gen.fatigue !== 'boolean') bad.push('generator fatigue must be on or off');
      if (req.gen.woods !== undefined && typeof req.gen.woods !== 'boolean') bad.push('generator woods must be on or off');
      if (req.gen.walls !== undefined && typeof req.gen.walls !== 'boolean') bad.push('generator walls must be on or off');
    }
    return bad;
  };

  // Plays a battle with no drawing, in the same fixed steps as the game. Used by balance runs and V2's computer battles.
  // Both sides are planned by the computer (mode 'auto').
  V4.runAuto = function (req) {
    var r = Object.assign({}, req, { mode: 'auto' });
    var st = V4.createBattle(r, {});
    var maxTicks = Math.ceil((C.CAP[r.scale] || 120) / C.TICK) + 10;
    while (!st.done && maxTicks-- > 0) V4.step(st);
    return V4.result(st);
  };

  // Replays a battle from its request and the commands recorded during play. The same inputs give the same result.
  V4.replay = function (req, commands) {
    var st = V4.createBattle(req, {});
    var list = (commands || []).slice().sort(function (a, b) { return a.tick - b.tick; });
    var i = 0, maxTicks = Math.ceil((C.CAP[req.scale] || 120) / C.TICK) + 10;
    while (maxTicks-- > 0) {
      while (i < list.length && list[i].tick === st.tick) { V4.issue(st, list[i].cmd); i++; }
      if (st.done) break;
      V4.step(st);
    }
    return V4.result(st);
  };

  // Deals `dots` random dots between `teams` sides (2 or 3). Each dot goes to the side with least strength,
  // so the sides come out close. Returns the counts per side (sides), the strength of each (power), and for two
  // sides the same as a and b.
  V4.balanceTeams = function (dots, rng, teams) {
    var n = teams || 2, sides = [], power = [], i, t;
    for (i = 0; i < n; i++) { sides.push(V4.sim.zeroTypes()); power.push(0); }
    for (i = 0; i < dots; i++) {
      // The weakest side that still has room for some type gets the next dot. A side holds at most MAX_PER_TYPE of each type.
      var room = [];
      for (t = 0; t < n; t++) {
        if (C.TYPES.some(function (ty) { return sides[t][ty] < C.MAX_PER_TYPE; })) room.push(t);
      }
      if (!room.length) break;
      var least = [];
      room.forEach(function (k) {
        if (least.length === 0 || power[k] < power[least[0]] - 1e-9) least = [k];
        else if (Math.abs(power[k] - power[least[0]]) < 1e-9) least.push(k);
      });
      var side = least[Math.floor(rng() * least.length)];
      var open = C.TYPES.filter(function (ty) { return sides[side][ty] < C.MAX_PER_TYPE; });
      var type = open[Math.floor(rng() * open.length)];
      sides[side][type]++;
      power[side] += C.POWER[type];
    }
    return { sides: sides, power: power, a: sides[0], b: sides[1] };
  };

  // A small fortress battle, the default in the sandbox.
  V4.sampleRequest = function (overrides) {
    var o = overrides || {};
    return {
      seed: o.seed || 7,
      scale: o.scale || 'fortress',
      attacker: {
        nation: 'Attacker', provinces: [1], pool: 400,
        terrain: o.attackerWoods ? ['grass', 'woods'] : ['grass'],
        units: o.attackerUnits || [
          { type: 'pikemen', count: 4, strategy: 'engage', formation: 'line' },
          { type: 'swordsmen', count: 3, strategy: 'engage', formation: 'line' },
          { type: 'archers', count: 2, strategy: 'kite', formation: 'line' },
          { type: 'cavalry', count: 1, strategy: 'rush', formation: 'line' }
        ],
        reserve: o.reserve || []
      },
      defender: {
        nation: 'Defender', province: 2, pool: 400,
        population: o.population == null ? 40 : o.population,
        settlement: o.settlement || 'fortress',
        terrain: o.defenderWoods ? ['grass', 'woods'] : ['grass'],
        units: o.defenderUnits || [
          { type: 'pikemen', count: 3, strategy: 'engage', formation: 'line' },
          { type: 'archers', count: 2, strategy: 'engage', formation: 'line' }
        ]
      },
      border: { river: !!o.river, road: true },
      // The small field with no extras: the old one-screen battle, so tests and balance runs stay comparable.
      gen: Object.assign({ size: 'small', river: o.river ? 'fords' : 'none', roads: false, grass: false, fatigue: false, facing: false, ambush: 'auto', approach: 'none', gates: 3 }, o.gen || {}),
      mode: o.mode || 'play'
    };
  };
})();
