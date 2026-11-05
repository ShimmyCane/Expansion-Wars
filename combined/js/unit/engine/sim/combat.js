// Expansion Wars — unit battle engine: Contact: facing, firing, engaging, backing away, striking from hiding, following a route.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};

  function face(st, u, e) { if (K.facingOn(st)) u.dir = Math.atan2(e.y - u.y, e.x - u.x); }

  function fire(st, u, target, d, hits) {
    hits.push({ a: u, b: target, d: d });
    u.revealT = C.HIDE.reveal;   // firing gives the unit away
    face(st, u, target);
    var U = C.UNIT[u.type];
    // Volleys and shots are drawn when the unit reloads. Damage itself is continuous.
    if (!U.melee && U.reload && u.fireT <= 0) {
      u.fireT = U.reload;
      if (st.animate) {
        st.events.push({
          kind: u.type === 'catapults' ? 'shot' : 'volley', side: u.side,
          x1: u.x, y1: u.y, x2: target.x, y2: target.y, t: st.t
        });
      }
    }
  }

  // Fight or close in on a target the unit can see.
  function engage(st, u, en, dt, hits, mul) {
    var U = C.UNIT[u.type];
    if (en.d <= U.range && en.d >= U.minRange) { fire(st, u, en.e, en.d, hits); return true; }
    if (en.d < U.minRange) { face(st, u, en.e); return true; }   // too close to fire: the unit stands
    K.goTo(st, u, en.e.x, en.e.y, mul, dt);
    if (U.mounted) u.chargeT = C.CHARGE.window;
    return true;
  }

  // Steps straight back from an enemy.
  function backAway(st, u, en, dt) {
    K.moveUnit(st, u, u.x + (u.x - en.e.x), u.y + (u.y - en.e.y), 1, dt);
  }

  // A hidden unit strikes: a burst on every enemy within reach, then it fights as a rush.
  function strike(st, u, hits) {
    u.sprung = true;
    u.strikePrompt = false;
    u.strikeOrdered = false;
    u.revealT = C.HIDE.reveal;
    var hit = 0;
    st.units.forEach(function (v) {
      if (K.allied(st, v.side, u.side) || v.state !== 'active') return;
      var d = K.dist(u.x, u.y, v.x, v.y);
      if (d <= C.STRIKE.range) { hits.push({ a: u, b: v, d: d, burst: true }); hit++; }
    });
    K.log(st, K.name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' strike from cover' + (hit ? '.' : ' at nothing.'));
  }

  // Walks a route: each point in turn. Fights what it meets on the way unless it is a rush.
  function followRoute(st, u, o, en, dt, hits) {
    var target = o.points[o.i];
    if (o.mode === 'move' && en) { engage(st, u, en, dt, hits, 1); return true; }
    if (K.dist(u.x, u.y, target.x, target.y) > 0.3) {
      K.goTo(st, u, target.x, target.y, o.mode === 'rush' ? C.RUSH_MOVE : 1, dt);
      return true;
    }
    o.i++;
    if (o.i >= o.points.length) u.order = null;
    return true;
  }

  K.face = face;
  K.fire = fire;
  K.engage = engage;
  K.backAway = backAway;
  K.strike = strike;
  K.followRoute = followRoute;
})();
