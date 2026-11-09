// Expansion Wars — unit battle engine: Damage, morale and routing; fatigue.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};
  var EPS = 0.01;
  var TICK = C.TICK;
  var PI = Math.PI;

  // ---- Damage, morale and routing -------------------------------------------

  // Which part of the target a hit comes from: 0 front, 1 side, 2 rear. With facing off, only front and side.
  function hitZone(st, a, b) {
    if (!K.facingOn(st)) return (a.x - b.x) * b.facing > 0 ? 0 : 1;
    var rel = Math.abs(K.wrap(Math.atan2(a.y - b.y, a.x - b.x) - b.dir));   // 0 straight ahead, PI behind
    var half = C.FORMATION[b.formation].arc * PI / 360;
    if (rel <= half) return 0;
    return rel <= 0.75 * PI ? 1 : 2;
  }

  // Lifts or lowers the morale of units near a point: friends (allied teams) or foes.
  function boostNear(st, side, x, y, range, amount, foes) {
    st.units.forEach(function (u) {
      var friend = K.allied(st, u.side, side);
      if (foes ? friend : !friend) return;
      if (u.state !== 'active' && u.state !== 'routing') return;
      if (K.dist(u.x, u.y, x, y) <= range) u.morale = Math.min(100, u.morale + amount);
    });
  }

  function rout(st, u) {
    u.state = 'routing';
    u.order = null;
    K.log(st, K.name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' break and run.');
    st.units.forEach(function (v) {
      if (v.side === u.side && v.state === 'active' && K.dist(v.x, v.y, u.x, u.y) <= C.MORALE.neighbourRange) {
        v.morale -= C.MORALE.neighbourHit;
      }
    });
    // Enemies who see a unit break are encouraged.
    boostNear(st, u.side, u.x, u.y, C.MORALE.enemyFleeRange, C.MORALE.enemyFlee, true);
  }

  // Damage is worked out for every hit first, then applied together, so the order of hits does not favour a side.
  // The strongest aura of its side's generals that unit a stands in (the general's own unit included), or 1 for none.
  function auraMul(st, a) {
    var best = 1;
    for (var i = 0; i < st.units.length; i++) {
      var g = st.units[i];
      if (g.general && g.side === a.side && g.state === 'active' && K.dist(g.x, g.y, a.x, a.y) <= C.GENERAL.radius) {
        best = Math.max(best, C.GENERAL.mul + C.GENERAL.star * (g.stars || 0));
      }
    }
    return best;
  }
  K.auraMul = auraMul;
  K.inAura = function (st, a) { return auraMul(st, a) > 1; };

  function applyHits(st, hits) {
    var pending = [];
    hits.forEach(function (h) {
      var a = h.a, b = h.b;
      if (a.people <= EPS || b.state !== 'active') return;
      a.lastHitTick = st.tick; b.lastHitTick = st.tick;
      var U = C.UNIT[a.type], Fb = C.FORMATION[b.formation], Tb = K.terrainAt(st, b.x, b.y);
      var code = K.tileCode(st, b.x, b.y);

      var base = U.atk * a.atkMul;
      base *= auraMul(st, a);
      if (h.burst) base *= C.STRIKE.mul;
      if (K.fatigueOn(st)) base *= 1 - C.FATIGUE.atkLoss * a.fat / 100;
      if (!U.melee && h.d < 1.2) base *= C.RANGED_IN_MELEE;
      var mul = K.counter(a.type, b.type);
      if (a.type === 'catapults' && (code === 't' || code === 'x' || code === 'y')) mul *= C.CATAPULT_WALLS;

      var charge = 1;
      if (U.mounted && a.chargeT > 0 && h.d <= 1.2 && !K.terrainAt(st, a.x, a.y).noCharge) {
        charge = C.CHARGE.mul * C.FORMATION[a.formation].charge;
      }

      // Front hits are normal. Side hits use the formation's flank value; rear hits a little more.
      var zone = hitZone(st, a, b);
      var taken = zone === 0 ? 1 : Fb.flank * (zone === 2 ? C.REAR_MUL : 1);
      taken /= U.melee ? (Fb.melee * Tb.def) : Tb.def;
      if (!U.melee) taken *= Fb.area;
      if (b.ambushT > 0) taken *= C.AMBUSH.dmgMul;
      if (!U.melee && K.insideWalls(st, b.x, b.y) && !K.insideWalls(st, a.x, a.y)) taken *= C.WALL.arrow;

      var morale = K.clamp(a.morale / 100, C.MORALE.floor, 1);
      pending.push({ b: b, a: a, dmg: a.people * base * mul * charge * morale * C.DAMAGE_K * taken });
    });

    var targets = [];
    pending.forEach(function (p) {
      if (targets.indexOf(p.b) < 0) targets.push(p.b);
      p.b.incoming += p.dmg;
    });
    targets.forEach(function (b) {
      var total = b.incoming, lost = Math.min(b.people, total);
      // Kills are credited to the unit types that dealt the damage, in proportion to what each dealt.
      if (total > 0) {
        pending.forEach(function (p) {
          if (p.b === b) st.kills[p.a.side][p.a.type] += lost * p.dmg / total;
        });
      }
      b.incoming = 0;
      b.people -= lost;
      b.hitThis += lost;
      st.losses[b.side][b.type] += lost;
    });

    st.units.forEach(function (u) {
      if (u.state === 'dead' || u.state === 'gone') return;
      if (u.hitThis > 0) {
        u.morale -= (u.hitThis / u.start) * C.MORALE.perLoss;
        u.hitThis = 0;
      }
      if (u.people <= EPS) {
        u.people = 0;
        u.state = 'dead';
        K.log(st, K.name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' is destroyed.');
        if (u.general) {                            // the general has fallen: the whole side is shaken
          st.units.forEach(function (v) { if (v.side === u.side && v.state === 'active') v.morale = Math.max(0, v.morale - C.GENERAL.loss); });
          K.log(st, K.name(u.side) + ' general has fallen.');
        }
        boostNear(st, u.side, u.x, u.y, C.MORALE.enemyFleeRange, C.MORALE.death, true);
      }
    });
    st.units.forEach(function (u) {
      if (u.state === 'active' && u.morale <= 0) rout(st, u);
    });
  }

  // Marching and fighting tire a unit; standing still out of contact lets it recover.
  function updateFatigue(st) {
    if (!K.fatigueOn(st)) return;
    var F = C.FATIGUE;
    st.units.forEach(function (u) {
      if (u.state !== 'active') return;
      var code = K.tileCode(st, u.x, u.y) || 'g', form = C.FORMATION[u.formation].fatigue;
      var contact = st.tick - u.lastHitTick < F.contactWindow;
      if (u.moved) u.fat += (F.move[code] || F.move.g) * form * TICK;
      if (contact) u.fat += F.contact * form * TICK;
      else if (!u.moved) u.fat -= F.rest * TICK;
      u.fat = K.clamp(u.fat, 0, 100);
    });
  }

  // Calm, rest and friends restore morale. A routed unit rallies once it is steady and no enemy threatens it.
  function updateMorale(st) {
    st.units.forEach(function (u) {
      if (u.state !== 'active' && u.state !== 'routing') return;
      if (!K.seenWithin(st, u, C.MORALE.contactRange)) {
        u.morale += C.MORALE.calm * TICK;
        if (u.still > C.MORALE.pauseAfter) u.morale += C.MORALE.pause * TICK;
      }
      var steady = st.units.some(function (v) {
        return v !== u && K.allied(st, v.side, u.side) && v.state === 'active' && v.morale >= C.MORALE.allyMorale &&
          K.dist(u.x, u.y, v.x, v.y) <= C.MORALE.allyRange;
      });
      if (steady) u.morale += C.MORALE.allies * TICK;
      u.morale = Math.min(100, u.morale);

      if (u.state === 'routing' && u.morale >= C.MORALE.rallyAt && !K.seenWithin(st, u, C.MORALE.threatRange)) {
        u.state = 'active';
        u.order = null;
        K.log(st, K.name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' rally.');
      }
    });
  }

  K.hitZone = hitZone;
  K.boostNear = boostNear;
  K.rout = rout;
  K.applyHits = applyHits;
  K.updateFatigue = updateFatigue;
  K.updateMorale = updateMorale;
})();
