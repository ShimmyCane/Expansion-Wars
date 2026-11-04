// Expansion Wars — V4 battle simulation. No DOM: runs in the browser and in Node.
// Side 0 is the attacker (the player in a custom battle), side 1 the defender. Positions are in tiles.
// The battle runs in fixed steps of C.TICK seconds, so the same seed and the same orders give the same battle.
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG;
  var WORD = ['Attacker', 'Defender'];
  var EPS = 0.01;
  var TICK = C.TICK;
  var PI = Math.PI;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function zeroTypes() { var o = {}; C.TYPES.forEach(function (t) { o[t] = 0; }); return o; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function wrap(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }

  function tileCode(st, x, y) {
    var c = Math.floor(x), r = Math.floor(y);
    if (c < 0 || r < 0 || c >= st.cols || r >= st.rows) return null;
    return st.field.tiles[r * st.cols + c];
  }
  function terrainAt(st, x, y) { return C.TERRAIN[tileCode(st, x, y) || 'g'] || C.TERRAIN.g; }
  function passableAt(st, x, y) {
    var code = tileCode(st, x, y);
    return code !== null && !C.TERRAIN[code].impassable;
  }
  function counter(a, b) {
    if (C.STRONG[a].indexOf(b) >= 0) return C.COUNTER.up;
    if (C.WEAK[a].indexOf(b) >= 0) return C.COUNTER.down;
    return 1;
  }
  function facingOn(st) { return !!st.gen.facing && st.scale !== 'village'; }
  function fatigueOn(st) { return !!st.gen.fatigue; }

  // People in one dot at a scale. Cavalry are half a grain, catapults a crew of up to four.
  function peopleFor(scale, type) {
    var g = C.GRAIN[scale];
    if (type === 'cavalry') return Math.max(1, Math.round(g / 2));
    if (type === 'catapults') return Math.max(1, Math.min(4, g));
    return g;
  }

  function log(st, text) { st.log.push({ t: Math.round(st.t * 10) / 10, text: text }); }

  function expand(spec) {
    var out = [];
    for (var i = 0; i < (spec.count || 0); i++) {
      out.push({ type: spec.type, strategy: spec.strategy || 'engage', formation: spec.formation || 'line' });
    }
    return out;
  }

  function findUnit(st, id) {
    for (var i = 0; i < st.units.length; i++) if (st.units[i].id === id) return st.units[i];
    return null;
  }

  function newUnit(st, side, type, strategy, formation, x, y, people) {
    var u = {
      id: st.nextId++, side: side, type: type, people: people, start: people, morale: 100,
      x: x, y: y, facing: side === 0 ? 1 : -1, dir: side === 0 ? 0 : PI,
      formation: formation || 'line', strategy: strategy || 'engage',
      plan: { strategy: strategy || 'engage', formation: formation || 'line' },
      order: null, station: null, approach: null, state: 'active',
      ambushT: 0, ambushSeen: false, sprung: false, hidden: false,
      strikePrompt: false, strikeOrdered: false, revealT: 0,
      chargeT: 0, fireT: 0, atkMul: 1, hitThis: 0, incoming: 0, levy: false,
      moved: false, still: 0, fat: 0, lastHitTick: -1000
    };
    st.units.push(u);
    return u;
  }

  // ---- Vision ----------------------------------------------------------------

  function sightOf(u) { return C.SIGHT[u.type] + (u.side === 1 ? C.DEFENDER_SIGHT_BONUS : 0); }

  // Each side sees what any of its units can see. A unit in woods or tall grass is seen only from close by,
  // until it fires or strikes (then it is revealed for a few seconds).
  function computeVision(st) {
    st.seen = [{}, {}];
    st.units.forEach(function (u) {
      u.hidden = u.state === 'active' && !!C.TERRAIN[tileCode(st, u.x, u.y) || 'g'].hides && u.revealT <= 0;
    });
    st.units.forEach(function (v) {
      if (v.state !== 'active') return;
      st.units.forEach(function (e) {
        if (e.side === v.side || (e.state !== 'active' && e.state !== 'routing')) return;
        var range = e.hidden ? C.HIDE.range : sightOf(v);
        if (dist(v.x, v.y, e.x, e.y) <= range) st.seen[v.side][e.id] = true;
      });
    });
  }

  function visibleEnemy(st, u) {
    var best = null, bd = Infinity, seen = st.seen[u.side];
    st.units.forEach(function (v) {
      if (v.side === u.side || v.state !== 'active' || !seen[v.id]) return;
      var d = dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v; }
    });
    return best ? { e: best, d: bd } : null;
  }

  // The nearest active enemy whether or not it is seen (used for the ambush trigger).
  function nearestAny(st, u) {
    var best = null, bd = Infinity;
    st.units.forEach(function (v) {
      if (v.side === u.side || v.state !== 'active') return;
      var d = dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v; }
    });
    return best ? { e: best, d: bd } : null;
  }

  function seenWithin(st, u, range) {
    var seen = st.seen[u.side];
    return st.units.some(function (v) {
      return v.side !== u.side && v.state === 'active' && seen[v.id] && dist(u.x, u.y, v.x, v.y) <= range;
    });
  }

  // Friends and seen foes within LOCAL.range: how the unit reads the ground around it.
  function localCount(st, u) {
    var friends = 0, foes = 0, seen = st.seen[u.side], r = C.LOCAL.range;
    st.units.forEach(function (v) {
      if (v === u || v.state !== 'active') return;
      if (dist(u.x, u.y, v.x, v.y) > r) return;
      if (v.side === u.side) friends += v.people; else if (seen[v.id]) foes += v.people;
    });
    return { friends: friends, foes: foes };
  }

  // ---- Movement --------------------------------------------------------------

  // Walking distances on the tile grid (4-way, ignoring terrain cost). One field per target, cached.
  function flowField(st, tx, ty) {
    var c0 = clamp(Math.floor(tx), 0, st.cols - 1), r0 = clamp(Math.floor(ty), 0, st.rows - 1);
    var key = c0 + ',' + r0;
    if (st.flows[key]) return st.flows[key];
    var d = new Int32Array(st.cols * st.rows).fill(-1), q = [r0 * st.cols + c0];
    d[q[0]] = 0;
    for (var i = 0; i < q.length; i++) {
      var cur = q[i], c = cur % st.cols, r = (cur - c) / st.cols;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var nc = c + o[0], nr = r + o[1];
        if (nc < 0 || nr < 0 || nc >= st.cols || nr >= st.rows) return;
        var n = nr * st.cols + nc;
        if (d[n] >= 0 || C.TERRAIN[st.field.tiles[n]].impassable) return;
        d[n] = d[cur] + 1;
        q.push(n);
      });
    }
    st.flows[key] = d;
    return d;
  }

  // mul is the speed factor for the order or strategy. The unit's own speed, formation, terrain and fatigue apply here.
  function moveUnit(st, u, tx, ty, mul, dt) {
    var U = C.UNIT[u.type], F = C.FORMATION[u.formation];
    var dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    var T = terrainAt(st, u.x, u.y);
    var m = T.speed;
    if (U.mounted && T.cavSpeed) m *= T.cavSpeed;
    if (fatigueOn(st)) m *= 1 - C.FATIGUE.speedLoss * u.fat / 100;
    var step = Math.min(d, U.speed * F.speed * mul * m * dt);
    var nx = u.x + dx / d * step, ny = u.y + dy / d * step;
    var before = u.x + ',' + u.y;
    if (passableAt(st, nx, ny)) { u.x = nx; u.y = ny; }
    else if (passableAt(st, nx, u.y)) { u.x = nx; }
    else if (passableAt(st, u.x, ny)) { u.y = ny; }
    if ((u.x + ',' + u.y) !== before) {
      u.moved = true;
      if (facingOn(st)) u.dir = Math.atan2(dy, dx);   // a unit faces the way it marches
    }
  }

  // Walks toward a point by the flow field, so units go round walls and through gates and bridges.
  function goTo(st, u, tx, ty, mul, dt) {
    var f = flowField(st, tx, ty);
    var c = clamp(Math.floor(u.x), 0, st.cols - 1), r = clamp(Math.floor(u.y), 0, st.rows - 1);
    var cur = f[r * st.cols + c];
    if (cur < 0) return moveUnit(st, u, tx, ty, mul, dt);   // cannot find a way: go straight at it
    if (cur === 0) return moveUnit(st, u, tx, ty, mul, dt);  // in the target tile: close in
    var best = null, bestD = cur;
    DIRS.forEach(function (o) {
      var nc = c + o[0], nr = r + o[1];
      if (nc < 0 || nr < 0 || nc >= st.cols || nr >= st.rows) return;
      var nd = f[nr * st.cols + nc];
      if (nd >= 0 && nd < bestD) { bestD = nd; best = { x: nc + 0.5, y: nr + 0.5 }; }
    });
    if (best) moveUnit(st, u, best.x, best.y, mul, dt);
  }

  function face(st, u, e) { if (facingOn(st)) u.dir = Math.atan2(e.y - u.y, e.x - u.x); }

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

  // Fight or close in on a target the unit can see. Returns true if the unit acted.
  function engage(st, u, en, dt, hits, mul) {
    var U = C.UNIT[u.type];
    if (en.d <= U.range && en.d >= U.minRange) { fire(st, u, en.e, en.d, hits); return true; }
    if (en.d < U.minRange) { face(st, u, en.e); return true; }   // too close to fire: the unit stands
    goTo(st, u, en.e.x, en.e.y, mul, dt);
    if (U.mounted) u.chargeT = C.CHARGE.window;
    return true;
  }

  // Steps straight back from an enemy.
  function backAway(st, u, en, dt) {
    moveUnit(st, u, u.x + (u.x - en.e.x), u.y + (u.y - en.e.y), 1, dt);
  }

  // A hidden unit strikes: a burst on every enemy within reach, then it fights as a rush.
  function strike(st, u, hits) {
    u.sprung = true;
    u.strikePrompt = false;
    u.strikeOrdered = false;
    u.revealT = C.HIDE.reveal;
    var hit = 0;
    st.units.forEach(function (v) {
      if (v.side === u.side || v.state !== 'active') return;
      var d = dist(u.x, u.y, v.x, v.y);
      if (d <= C.STRIKE.range) { hits.push({ a: u, b: v, d: d, burst: true }); hit++; }
    });
    log(st, WORD[u.side] + ' ' + C.UNIT[u.type].label.toLowerCase() + ' strike from cover' + (hit ? '.' : ' at nothing.'));
  }

  function decide(st, u, dt, hits) {
    var U = C.UNIT[u.type];
    u.fireT -= dt;
    u.ambushT = Math.max(0, u.ambushT - dt);
    u.chargeT = Math.max(0, u.chargeT - dt);
    u.revealT = Math.max(0, u.revealT - dt);

    var en = visibleEnemy(st, u);

    // A column walking into an enemy in cover is ambushed once, on first sight.
    if (en && !u.ambushSeen && u.formation === 'column' && en.d <= C.AMBUSH.range && tileCode(st, en.e.x, en.e.y) === 'w') {
      u.ambushSeen = true;
      u.ambushT = C.AMBUSH.duration * (u.strategy === 'slow' ? C.STRATEGY.slow.ambushMul : 1);
      log(st, WORD[u.side] + ' column is caught in an ambush.');
    }

    // Orders come first.
    var o = u.order;
    if (o) {
      if (o.kind === 'rush') {
        // Rush move: runs to the point and ignores enemies on the way.
        if (dist(u.x, u.y, o.x, o.y) > 0.3) { goTo(st, u, o.x, o.y, C.RUSH_MOVE, dt); return; }
        u.order = null;
      } else if (o.kind === 'attackMove') {
        // Attack move: fights anything it can see on the way, otherwise keeps going.
        if (en) { engage(st, u, en, dt, hits, 1); return; }
        if (dist(u.x, u.y, o.x, o.y) > 0.3) { goTo(st, u, o.x, o.y, 1, dt); return; }
        u.order = null;
      } else if (o.kind === 'hold') {
        if (en && en.d <= U.range && en.d >= U.minRange) fire(st, u, en.e, en.d, hits);
        return;
      } else if (o.kind === 'attack') {
        var t = findUnit(st, o.target);
        if (!t || t.state !== 'active') {
          u.order = null;
        } else {
          var d = dist(u.x, u.y, t.x, t.y);
          if (d <= U.range) {
            if (d >= U.minRange) fire(st, u, t, d, hits);
            return;
          }
          goTo(st, u, t.x, t.y, 1, dt);
          if (U.mounted) u.chargeT = C.CHARGE.window;
          return;
        }
      }
    }

    // A stationed unit (the defender's line) fights within its leash and otherwise stays put.
    if (u.station) {
      var nearStation = en && dist(en.e.x, en.e.y, u.station.x, u.station.y) <= C.AI.leash;
      if (!nearStation) {
        if (dist(u.x, u.y, u.station.x, u.station.y) > 0.3) goTo(st, u, u.station.x, u.station.y, 1, dt);
        return;
      }
    }

    if (!en) {
      // An ambush waits in cover and does not move up. Everyone else walks on to their approach point.
      if (u.strategy === 'ambush' && !u.sprung) { u.strikePrompt = false; return; }
      if (u.approach && dist(u.x, u.y, u.approach.x, u.approach.y) > 0.5) {
        goTo(st, u, u.approach.x, u.approach.y, C.STRATEGY[u.strategy].speed, dt);
      }
      return;
    }

    // An ambush waits in cover until an enemy is close. Then the player is asked to strike (the computer strikes at once).
    if (u.strategy === 'ambush' && !u.sprung) {
      var near = nearestAny(st, u);
      if (!near || near.d > C.STRATEGY.ambush.trigger) { u.strikePrompt = false; return; }
      if (u.side === 1 || st.gen.ambush === 'auto' || u.strikeOrdered) { strike(st, u, hits); return; }
      u.strikePrompt = true;
      return;
    }
    var strat = u.strategy === 'ambush' ? 'rush' : u.strategy;

    if (strat === 'kite' && (U.mounted || !U.melee) && en.d < C.STRATEGY.kite.retreat) {
      backAway(st, u, en, dt);
      return;
    }

    // Reading the ground: a default unit outnumbered nearby falls back if it is cavalry or ranged,
    // and a melee unit waits for friends to come up before it closes.
    if (strat === 'engage') {
      var local = localCount(st, u);
      if (local.foes > (local.friends + u.people) * C.LOCAL.outnumbered) {
        if ((U.mounted || !U.melee) && en.d < 3) { backAway(st, u, en, dt); return; }
        if (U.melee && en.d > U.range + 0.5 && local.friends > 0) { face(st, u, en.e); return; }
      }
    }
    engage(st, u, en, dt, hits, C.STRATEGY[strat].speed);
  }

  function retreat(st, u, dt) {
    // A routing unit runs for its own edge until it rallies.
    var tx = u.side === 0 ? 0 : st.cols;
    var T = terrainAt(st, u.x, u.y);
    var step = C.MORALE.routSpeed * T.speed * dt;
    var nx = u.x + (tx > u.x ? step : -step);
    if (passableAt(st, nx, u.y)) u.x = nx;
    if ((u.side === 0 && u.x <= 0.05) || (u.side === 1 && u.x >= st.cols - 0.05)) u.state = 'gone';
  }

  // ---- Damage, morale and routing -------------------------------------------

  // Which part of the target a hit comes from: 0 front, 1 side, 2 rear. With facing off, only front and side.
  function hitZone(st, a, b) {
    if (!facingOn(st)) return (a.x - b.x) * b.facing > 0 ? 0 : 1;
    var rel = Math.abs(wrap(Math.atan2(a.y - b.y, a.x - b.x) - b.dir));   // 0 straight ahead, PI behind
    var half = C.FORMATION[b.formation].arc * PI / 360;
    if (rel <= half) return 0;
    return rel <= 0.75 * PI ? 1 : 2;
  }

  function boostNear(st, side, x, y, range, amount) {
    st.units.forEach(function (u) {
      if (u.side !== side || (u.state !== 'active' && u.state !== 'routing')) return;
      if (dist(u.x, u.y, x, y) <= range) u.morale = Math.min(100, u.morale + amount);
    });
  }

  function rout(st, u) {
    u.state = 'routing';
    u.order = null;
    log(st, WORD[u.side] + ' ' + C.UNIT[u.type].label.toLowerCase() + ' break and run.');
    st.units.forEach(function (v) {
      if (v.side === u.side && v.state === 'active' && dist(v.x, v.y, u.x, u.y) <= C.MORALE.neighbourRange) {
        v.morale -= C.MORALE.neighbourHit;
      }
    });
    // Enemies who see a unit break are encouraged.
    boostNear(st, 1 - u.side, u.x, u.y, C.MORALE.enemyFleeRange, C.MORALE.enemyFlee);
  }

  // Damage is worked out for every hit first, then applied together, so the order of hits does not favour a side.
  function applyHits(st, hits) {
    var pending = [];
    hits.forEach(function (h) {
      var a = h.a, b = h.b;
      if (a.people <= EPS || b.state !== 'active') return;
      a.lastHitTick = st.tick; b.lastHitTick = st.tick;
      var U = C.UNIT[a.type], Fb = C.FORMATION[b.formation], Tb = terrainAt(st, b.x, b.y);
      var code = tileCode(st, b.x, b.y);

      var base = U.atk * a.atkMul;
      if (h.burst) base *= C.STRIKE.mul;
      if (fatigueOn(st)) base *= 1 - C.FATIGUE.atkLoss * a.fat / 100;
      if (!U.melee && h.d < 1.2) base *= C.RANGED_IN_MELEE;
      var mul = counter(a.type, b.type);
      if (a.type === 'catapults' && (code === 't' || code === 'x' || code === 'y')) mul *= C.CATAPULT_WALLS;

      var charge = 1;
      if (U.mounted && a.chargeT > 0 && h.d <= 1.2 && !terrainAt(st, a.x, a.y).noCharge) {
        charge = C.CHARGE.mul * C.FORMATION[a.formation].charge;
      }

      // Front hits are normal. Side hits use the formation's flank value; rear hits a little more.
      var zone = hitZone(st, a, b);
      var taken = zone === 0 ? 1 : Fb.flank * (zone === 2 ? C.REAR_MUL : 1);
      taken /= U.melee ? (Fb.melee * Tb.def) : Tb.def;
      if (!U.melee) taken *= Fb.area;
      if (b.ambushT > 0) taken *= C.AMBUSH.dmgMul;

      var morale = clamp(a.morale / 100, C.MORALE.floor, 1);
      pending.push({ b: b, dmg: a.people * base * mul * charge * morale * C.DAMAGE_K * taken });
    });

    var targets = [];
    pending.forEach(function (p) {
      if (targets.indexOf(p.b) < 0) targets.push(p.b);
      p.b.incoming += p.dmg;
    });
    targets.forEach(function (b) {
      var lost = Math.min(b.people, b.incoming);
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
        log(st, WORD[u.side] + ' ' + C.UNIT[u.type].label.toLowerCase() + ' is destroyed.');
        boostNear(st, 1 - u.side, u.x, u.y, C.MORALE.enemyFleeRange, C.MORALE.death);
      }
    });
    st.units.forEach(function (u) {
      if (u.state === 'active' && u.morale <= 0) rout(st, u);
    });
  }

  // Marching and fighting tire a unit; standing still out of contact lets it recover.
  function updateFatigue(st) {
    if (!fatigueOn(st)) return;
    var F = C.FATIGUE;
    st.units.forEach(function (u) {
      if (u.state !== 'active') return;
      var code = tileCode(st, u.x, u.y) || 'g', form = C.FORMATION[u.formation].fatigue;
      var contact = st.tick - u.lastHitTick < F.contactWindow;
      if (u.moved) u.fat += (F.move[code] || F.move.g) * form * TICK;
      if (contact) u.fat += F.contact * form * TICK;
      else if (!u.moved) u.fat -= F.rest * TICK;
      u.fat = clamp(u.fat, 0, 100);
    });
  }

  // Calm, rest and friends restore morale. A routed unit rallies once it is steady and no enemy threatens it.
  function updateMorale(st) {
    st.units.forEach(function (u) {
      if (u.state !== 'active' && u.state !== 'routing') return;
      if (!seenWithin(st, u, C.MORALE.contactRange)) {
        u.morale += C.MORALE.calm * TICK;
        if (u.still > C.MORALE.pauseAfter) u.morale += C.MORALE.pause * TICK;
      }
      var steady = st.units.some(function (v) {
        return v !== u && v.side === u.side && v.state === 'active' && v.morale >= C.MORALE.allyMorale &&
          dist(u.x, u.y, v.x, v.y) <= C.MORALE.allyRange;
      });
      if (steady) u.morale += C.MORALE.allies * TICK;
      u.morale = Math.min(100, u.morale);

      if (u.state === 'routing' && u.morale >= C.MORALE.rallyAt && !seenWithin(st, u, C.MORALE.threatRange)) {
        u.state = 'active';
        u.order = null;
        log(st, WORD[u.side] + ' ' + C.UNIT[u.type].label.toLowerCase() + ' rally.');
      }
    });
  }

  // ---- Objectives, bell and reinforcements ----------------------------------

  function updateObjectives(st, dt) {
    st.field.objectives.forEach(function (o) {
      var n = [0, 0];
      st.units.forEach(function (u) {
        if (u.state === 'active' && dist(u.x, u.y, o.x, o.y) <= o.r) n[u.side]++;
      });
      var s = null;
      if (n[0] > 0 && n[1] === 0) s = 0;
      else if (n[1] > 0 && n[0] === 0) s = 1;
      if (s === null) return;
      var other = 1 - s;
      o.prog[s] = Math.min(C.HOLD, o.prog[s] + dt);
      o.prog[other] = Math.max(0, o.prog[other] - dt);
      if (o.prog[s] >= C.HOLD && o.owner !== s) {
        o.owner = s;
        st.captures++;
        boostNear(st, s, o.x, o.y, o.r * 2, C.MORALE.capture);
        log(st, WORD[s] + ' takes ' + o.name + '.');
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
      if (!passableAt(st, x, y)) { x = p.x; y = p.y; }
      var u = newUnit(st, 1, types[i % 2], 'engage', 'line', x, y, levyPeople(st));
      u.morale = C.BELL.levyMorale;
      u.atkMul = C.BELL.levyAtk;
      u.levy = true;
      raised++;
    }
    st.levies += raised;
    log(st, raised ? 'The bell rings: ' + raised + ' levies take the field.' : 'The bell rings, but no one is left to answer.');
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

  function updateReinforce(st, dt) {
    st.reinforceT -= dt;
    if (st.reinforceT > 0) return;
    st.reinforceT = C.REINFORCE_EVERY;
    while (st.reserve.length) {
      var d = st.reserve[0], need = peopleFor(st.scale, d.type);
      st.reserve.shift();
      if (st.pool[0] < need) {
        log(st, 'No more people at home for another wave.');
        continue;
      }
      st.pool[0] -= need;
      var edge = st.field.edge[0];
      var p = edge.length ? edge[Math.floor(st.rng() * edge.length)] : { x: 0.5, y: st.rows / 2 };
      var u = newUnit(st, 0, d.type, d.strategy, d.formation, p.x, p.y, need);
      u.approach = approachFor(st, st.gen.approach);
      log(st, 'Reinforcements arrive: ' + C.UNIT[d.type].label.toLowerCase() + '.');
      break;
    }
  }

  // People a side can still bring: those on the field, plus what is on its way.
  function strength(st, side) {
    var n = 0;
    st.units.forEach(function (u) { if (u.side === side && u.state === 'active') n += u.people; });
    if (side === 0) st.reserve.forEach(function (d) { n += peopleFor(st.scale, d.type); });
    if (side === 1 && st.bell && !st.bell.done) {
      n += Math.min(Math.floor(st.bell.population / C.BELL.popPerLevy), Math.floor(st.pool[1] / levyPeople(st))) * levyPeople(st);
    }
    return n;
  }

  // ---- End of battle ---------------------------------------------------------

  function finish(st, winner, how) {
    st.done = { winner: winner, how: how, t: Math.round(st.t * 10) / 10 };
    log(st, WORD[winner] + ' wins (' + how + ').');
  }

  function checkEnd(st) {
    if (st.done) return;
    var act = [0, 0], routed = [0, 0];
    st.units.forEach(function (u) {
      if (u.state === 'active') act[u.side]++;
      else if (u.state === 'routing') routed[u.side]++;
    });
    var pending = [st.reserve.length, st.bell && !st.bell.done ? 1 : 0];

    if (st.manual !== null) return finish(st, 1 - st.manual, 'surrender');

    // Objective victories count only after a capture, so the defender holding its settlement at the start does not end the battle.
    var obj = st.field.objectives;
    if (st.captures > 0 && obj.length && obj.every(function (o) { return o.owner === 0; })) return finish(st, 0, 'objectives');
    if (st.captures > 0 && obj.length && obj.every(function (o) { return o.owner === 1; })) return finish(st, 1, 'objectives');

    for (var s = 0; s < 2; s++) {
      if (act[s] === 0 && pending[s] === 0) {
        // Every unit routed is a surrender. No units at all is a rout.
        return finish(st, 1 - s, routed[s] > 0 ? 'surrender' : 'rout');
      }
    }
    var s0 = strength(st, 0), s1 = strength(st, 1);
    if (s0 * C.SURRENDER_RATIO <= s1) return finish(st, 1, 'surrender');
    if (s1 * C.SURRENDER_RATIO <= s0) return finish(st, 0, 'surrender');

    if (st.tick * TICK >= st.cap) {
      var attackerHolds = st.captures > 0 && obj.length && obj.every(function (o) { return o.owner === 0; });
      return attackerHolds ? finish(st, 0, 'objectives') : finish(st, 1, 'time');
    }
  }

  // ---- Computer plans --------------------------------------------------------

  // The defender: a share of the infantry ambushes in the woods nearest the attack, the rest hold a station by the objective.
  function planDefender(st) {
    var units = st.units.filter(function (u) { return u.side === 1 && !u.levy; });
    var c = st.field.objectives[0];
    var woods = st.field.woodTiles.filter(function (p) { return p.x >= c.x - 2 && p.x <= c.x + 20; });   // woods on the defender's side of the objective
    var want = woods.length ? Math.floor(units.length * C.AI.ambushShare) : 0;
    var ambushers = 0, stations = 0;   // the defence centres on the first objective
    units.forEach(function (u) {
      if (ambushers < want && u.type !== 'cavalry' && u.type !== 'catapults') {
        var w = woods[ambushers % woods.length];
        u.x = w.x; u.y = w.y;
        u.strategy = 'ambush'; u.plan.strategy = 'ambush';
        ambushers++;
      } else if (u.type === 'cavalry') {
        u.station = { x: c.x - 4, y: stations % 2 ? st.rows / 2 - 5 : st.rows / 2 + 5 };
        stations++;
      } else {
        u.station = { x: c.x - 2.5 + (stations % 4) * 1.5, y: c.y - 3 + Math.floor(stations / 4) * 2 };
        stations++;
      }
    });
  }

  // The attacker when the computer plays both sides: every unit attack-moves on the first objective.
  function planAttacker(st) {
    var o = st.field.objectives[0];
    st.units.forEach(function (u) {
      if (u.side === 0 && !u.levy) u.order = { kind: 'attackMove', x: o.x, y: o.y };
    });
  }

  // ---- Public API ------------------------------------------------------------

  function placeArmy(st, side, specs) {
    var dots = [];
    specs.forEach(function (s) { expand(s).forEach(function (d) { dots.push(d); }); });
    var zone = st.field.spawn[side], n = dots.length;
    if (!zone.length) return;
    for (var i = 0; i < n; i++) {
      var d = dots[i], need = peopleFor(st.scale, d.type);
      if (st.pool[side] < need) break;
      st.pool[side] -= need;
      var p = zone[Math.floor((i + 0.5) * zone.length / n)];
      var x = p.x + (st.rng() - 0.5) * 0.6, y = p.y + (st.rng() - 0.5) * 0.6;
      if (!passableAt(st, x, y)) { x = p.x; y = p.y; }
      newUnit(st, side, d.type, d.strategy, d.formation, x, y, need);
    }
  }

  V4.createBattle = function (req, opts) {
    opts = opts || {};
    var scale = req.scale || 'fortress';
    var rng = V4.rng(req.seed || 1);
    var gen = V4.genOf(req);
    var field = V4.buildField(req, rng);
    var st = {
      seed: req.seed || 1, mode: req.mode || 'play', gen: gen,
      t: 0, tick: 0, scale: scale, grain: C.GRAIN[scale], cap: C.CAP[scale],
      cols: field.cols, rows: field.rows, deployX: field.deployX,
      field: field, rng: rng, units: [], nextId: 1, flows: {},
      animate: !!opts.animate, events: [], log: [], commands: [],
      pool: [req.attacker.pool || 0, req.defender.pool || 0],
      losses: [zeroTypes(), zeroTypes()], levies: 0,
      done: null, manual: null, captures: 0,
      reserve: [], bell: null, reinforceT: C.REINFORCE_EVERY,
      seen: [{}, {}]
    };
    var attackerDots = [];
    (req.attacker.reserve || []).forEach(function (s) { expand(s).forEach(function (d) { attackerDots.push(d); }); });
    st.reserve = attackerDots;

    var tiers = ['village', 'town', 'city', 'fortress'];
    if (tiers.indexOf(req.defender.settlement) >= 0 && (req.defender.population || 0) > 0) {
      st.bell = { done: false, population: req.defender.population };
    }

    placeArmy(st, 0, req.attacker.units || []);
    placeArmy(st, 1, req.defender.units || []);
    if (req.defender.ai !== false) planDefender(st);
    if (req.mode === 'auto') planAttacker(st);
    else if (gen.approach !== 'none') {
      st.units.forEach(function (u) {
        if (u.side === 0 && !u.levy) u.approach = approachFor(st, gen.approach);
      });
    }
    computeVision(st);
    checkEnd(st);
    return st;
  };

  V4.step = function (st) {
    if (st.done) return;
    st.t += TICK;
    st.tick++;
    if (st.animate) st.events = st.events.filter(function (e) { return st.t - e.t < 1; });
    updateBell(st);
    updateReinforce(st, TICK);
    computeVision(st);   // what each side can see now, before anyone acts

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
      if (u.state === 'active') decide(st, u, TICK, hits);
      else if (u.state === 'routing') retreat(st, u, TICK);
    });
    st.units.forEach(function (u) { u.still = u.moved ? 0 : u.still + TICK; });
    applyHits(st, hits);
    updateFatigue(st);
    updateObjectives(st, TICK);
    updateMorale(st);
    computeVision(st);
    checkEnd(st);
  };

  // Player commands. Each accepted command is recorded with the tick it was given on, so a replay can apply it at the same moment.
  //   place      (before the battle starts) move one of your units within your deployment zone
  //   move       attack move to a point (the default click)
  //   rush       rush move to a point, ignoring enemies on the way
  //   attack     attack a named enemy unit
  //   strike     a hidden unit strikes now (only when it has offered the strike)
  //   hold, strategy, formation, proceed, surrender
  V4.issue = function (st, cmd) {
    if (st.done) return false;
    var ok = apply(st, cmd);
    if (ok) st.commands.push({ tick: st.tick, cmd: cmd });
    return ok;
  };

  function apply(st, cmd) {
    if (cmd.kind === 'surrender') { st.manual = cmd.side; checkEnd(st); return true; }
    var u = findUnit(st, cmd.unit);
    if (!u || u.state !== 'active') return false;
    switch (cmd.kind) {
      case 'place':
        if (st.tick !== 0 || u.side !== 0 || cmd.x > st.deployX || cmd.x < 0.5 || !passableAt(st, cmd.x, cmd.y)) return false;
        u.x = cmd.x; u.y = cmd.y; return true;
      case 'move': u.order = { kind: 'attackMove', x: cmd.x, y: cmd.y }; return true;
      case 'rush': u.order = { kind: 'rush', x: cmd.x, y: cmd.y }; return true;
      case 'attack':
        var t = findUnit(st, cmd.target);
        if (!t || t.side === u.side) return false;
        u.order = { kind: 'attack', target: t.id }; return true;
      case 'hold': u.order = { kind: 'hold' }; return true;
      case 'strike':
        if (u.side !== 0 || !u.strikePrompt) return false;
        u.strikeOrdered = true; return true;
      case 'strategy':
        if (!C.STRATEGY[cmd.value]) return false;
        u.strategy = cmd.value; u.order = null; u.sprung = false; u.strikePrompt = false; return true;
      case 'formation':
        if (!C.FORMATION[cmd.value]) return false;
        u.formation = cmd.value; return true;
      case 'proceed':
        u.order = null; u.station = null;
        u.strategy = u.plan.strategy; u.formation = u.plan.formation; return true;
    }
    return false;
  }

  // The result that goes back to V2. Pool is what each side has at home after the battle.
  V4.result = function (st) {
    var d = st.done || { winner: null, how: 'running', t: st.t };
    var survivors = [zeroTypes(), zeroTypes()], surv = [0, 0];
    st.units.forEach(function (u) {
      if (u.state === 'dead') return;
      survivors[u.side][u.type] += u.people;
      surv[u.side] += u.people;
    });
    var captured = st.field.objectives.some(function (o) { return o.settlement && o.owner === 0; });
    function round(obj) {
      var out = {};
      Object.keys(obj).forEach(function (k) { out[k] = Math.round(obj[k]); });
      return out;
    }
    return {
      seed: st.seed,
      winner: d.winner === null ? null : (d.winner === 0 ? 'attacker' : 'defender'),
      how: d.how,
      captured: captured && d.winner === 0,
      losses: { attacker: round(st.losses[0]), defender: round(st.losses[1]) },
      survivors: { attacker: round(survivors[0]), defender: round(survivors[1]) },
      pool: { attacker: Math.round(st.pool[0] + surv[0]), defender: Math.round(st.pool[1] + surv[1]) },
      levies: st.levies,
      seconds: Math.round(st.t)
    };
  };

  V4.sim = { newUnit: newUnit, peopleFor: peopleFor, findUnit: findUnit, visibleEnemy: visibleEnemy, zeroTypes: zeroTypes, localCount: localCount };
})();
