// Expansion Wars — V3 contract with V2: request checks, auto mode and sample requests. No DOM.
(function () {
  'use strict';
  var V3 = window.V3, C = V3.CONFIG;
  var SCALES = ['village', 'fortress', 'country'];
  var SETTLEMENTS = ['none', 'village', 'town', 'city', 'fortress'];

  // Returns a list of problems. An empty list means the request can be played.
  V3.validateRequest = function (req) {
    var bad = [];
    if (!req || typeof req !== 'object') return ['request is not an object'];
    if (SCALES.indexOf(req.scale) < 0) bad.push('scale must be village, fortress or country');
    ['attacker', 'defender'].forEach(function (side) {
      var s = req[side];
      if (!s) { bad.push(side + ' is missing'); return; }
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
    return bad;
  };

  // Plays a battle with no drawing, at the speed of the sim. Used by balance runs and V2's computer battles.
  V3.runAuto = function (req, opts) {
    var dt = (opts && opts.dt) || 0.25;
    var st = V3.createBattle(req, {});
    var guard = Math.ceil((C.CAP[req.scale] || 120) / dt) + 10;
    while (!st.done && guard-- > 0) V3.step(st, dt);
    return V3.result(st);
  };

  // A small fortress battle, the default in the sandbox.
  V3.sampleRequest = function (overrides) {
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
      mode: o.mode || 'play'
    };
  };
})();
