// Expansion Wars — unit battle engine: Each unit decides what to do this step; routing units retreat; units keep their footprint.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};

  function decide(st, u, dt, hits) {
    var U = C.UNIT[u.type];
    u.fireT -= dt;
    u.ambushT = Math.max(0, u.ambushT - dt);
    u.chargeT = Math.max(0, u.chargeT - dt);
    u.revealT = Math.max(0, u.revealT - dt);

    var en = K.visibleEnemy(st, u);

    // A column walking into an enemy in cover is ambushed once, on first sight.
    if (en && !u.ambushSeen && u.formation === 'column' && en.d <= C.AMBUSH.range && K.tileCode(st, en.e.x, en.e.y) === 'w') {
      u.ambushSeen = true;
      u.ambushT = C.AMBUSH.duration * (u.strategy === 'slow' ? C.STRATEGY.slow.ambushMul : 1);
      K.log(st, K.name(u.side) + ' column is caught in an ambush.');
    }

    // Orders come first.
    var o = u.order;
    if (o) {
      if (o.kind === 'route') {
        K.followRoute(st, u, o, en, dt, hits);
        return;
      } else if (o.kind === 'hold') {
        if (en && en.d <= U.range && en.d >= U.minRange) K.fire(st, u, en.e, en.d, hits);
        return;
      } else if (o.kind === 'attack') {
        var t = K.findUnit(st, o.target);
        if (!t || t.state !== 'active') {
          u.order = null;
        } else {
          var d = K.dist(u.x, u.y, t.x, t.y);
          if (d <= U.range) {
            if (d >= U.minRange) K.fire(st, u, t, d, hits);
            return;
          }
          K.goTo(st, u, t.x, t.y, 1, dt);
          if (U.mounted) u.chargeT = C.CHARGE.window;
          return;
        }
      }
    }

    // A stationed unit (a defender's line) fights within its leash and otherwise stays put.
    if (u.station) {
      var nearStation = en && K.dist(en.e.x, en.e.y, u.station.x, u.station.y) <= C.AI.leash;
      if (!nearStation) {
        if (K.dist(u.x, u.y, u.station.x, u.station.y) > 0.3) K.goTo(st, u, u.station.x, u.station.y, 1, dt);
        return;
      }
    }

    if (!en) {
      // An ambush waits in cover and does not move up. Everyone else walks on to their approach point.
      if (u.strategy === 'ambush' && !u.sprung) { u.strikePrompt = false; return; }
      if (u.approach && K.dist(u.x, u.y, u.approach.x, u.approach.y) > 0.5) {
        K.goTo(st, u, u.approach.x, u.approach.y, C.STRATEGY[u.strategy].speed, dt);
      }
      return;
    }

    // An ambush waits in cover until an enemy is close. Then the player is asked to strike (the computer strikes at once).
    if (u.strategy === 'ambush' && !u.sprung) {
      var near = K.nearestAny(st, u);
      if (!near || near.d > C.STRATEGY.ambush.trigger) { u.strikePrompt = false; return; }
      if (!K.isPlayer(st, u) || st.gen.ambush === 'auto' || u.strikeOrdered) { K.strike(st, u, hits); return; }
      u.strikePrompt = true;
      return;
    }
    var strat = u.strategy === 'ambush' ? 'rush' : u.strategy;

    if (strat === 'kite' && (U.mounted || !U.melee) && en.d < C.STRATEGY.kite.retreat) {
      K.backAway(st, u, en, dt);
      return;
    }

    // Reading the ground: a default unit outnumbered nearby falls back if it is cavalry or ranged,
    // and a melee unit waits for friends to come up before it closes.
    if (strat === 'engage') {
      var local = K.localCount(st, u);
      if (local.foes > (local.friends + u.people) * C.LOCAL.outnumbered) {
        if ((U.mounted || !U.melee) && en.d < 3) { K.backAway(st, u, en, dt); return; }
        if (U.melee && en.d > U.range + 0.5 && local.friends > 0) { K.face(st, u, en.e); return; }
      }
    }
    K.engage(st, u, en, dt, hits, C.STRATEGY[strat].speed);
  }

  function retreat(st, u, dt) {
    // A routing unit runs for its own edge until it rallies.
    var tx = u.side === 1 ? st.cols : 0;
    var T = K.terrainAt(st, u.x, u.y);
    var step = C.MORALE.routSpeed * T.speed * dt;
    var nx = u.x + (tx > u.x ? step : -step);
    if (K.passableAt(st, nx, u.y)) u.x = nx;
    if ((tx === 0 && u.x <= 0.05) || (tx > 0 && u.x >= st.cols - 0.05)) u.state = 'gone';
  }

  // Units take room. Units of one side inside a walled settlement beyond its capacity step out, and any two units
  // closer than their footprint are pushed apart (onto passable ground only). Runs in a fixed order, so it is deterministic.
  function separate(st) {
    var act = st.units.filter(function (u) { return u.state === 'active'; });
    act.sort(function (a, b) { return a.id - b.id; });
    var R2 = 2 * C.FOOTPRINT;
    for (var i = 0; i < act.length; i++) {
      for (var j = i + 1; j < act.length; j++) {
        var a = act[i], b = act[j];
        var d = K.dist(a.x, a.y, b.x, b.y);
        if (d >= R2) continue;
        // Units on exactly the same spot are pushed apart along x, by their order.
        var ux = d < 1e-6 ? 1 : (a.x - b.x) / d, uy = d < 1e-6 ? 0 : (a.y - b.y) / d;
        var push = (R2 - d) / 2;
        var ax = a.x + ux * push, ay = a.y + uy * push, bx = b.x - ux * push, by = b.y - uy * push;
        if (K.passableAt(st, ax, ay)) { a.x = ax; a.y = ay; }
        if (K.passableAt(st, bx, by)) { b.x = bx; b.y = by; }
      }
    }
    // Last: a settlement holds only its capacity, so any extra that the pushing put back inside steps out.
    if (st.field.interior) {
      var inside = act.filter(function (u) { return K.insideWalls(st, u.x, u.y); });
      var cap = st.field.interior.cap;
      if (inside.length > cap) {
        inside.slice(cap).forEach(function (u) {
          var o = K.nearestOutside(st, u.x, u.y);
          if (o) { u.x = o.x; u.y = o.y; }
        });
      }
    }
  }

  K.decide = decide;
  K.retreat = retreat;
  K.separate = separate;
})();
