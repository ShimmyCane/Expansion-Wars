// Expansion Wars — V4 battle simulation. No DOM: runs in the browser and in Node.
// Teams: 0 is the attacker, 1 the defender, 2 an optional third team. Allies share vision and win or lose together.
// Positions are in tiles. The battle runs in fixed steps of C.TICK seconds, so the same seed and orders give the same battle.
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG;
  var EPS = 0.01;
  var TICK = C.TICK;
  var PI = Math.PI;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function zeroTypes() { var o = {}; C.TYPES.forEach(function (t) { o[t] = 0; }); return o; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function wrap(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
  function name(t) { return C.TEAM_NAME[t]; }

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

  // Teams that are allied with each other (a team is allied with itself).
  function allied(st, a, b) { return a === b || !!st.allied[a][b]; }
  function isPlayer(st, u) { return st.you !== null && u.side === st.you; }

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
      x: x, y: y, facing: side === 0 ? 1 : -1, dir: side === 0 ? 0 : (side === 1 ? PI : PI / 2),
      formation: formation || 'line', strategy: strategy || 'engage',
      plan: { strategy: strategy || 'engage', formation: formation || 'line' },
      group: C.DEFAULT_GROUP[type] || 1, offset: null,
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

  // Each team sees what any of its units, or any ally's unit, can see. A unit in woods or tall grass is seen only from
  // close by, until it fires or strikes (then it is revealed for a few seconds).
  function computeVision(st) {
    st.seen = st.allied.map(function () { return {}; });
    st.units.forEach(function (u) {
      u.hidden = u.state === 'active' && !!C.TERRAIN[tileCode(st, u.x, u.y) || 'g'].hides && u.revealT <= 0;
    });
    st.units.forEach(function (v) {
      if (v.state !== 'active') return;
      st.units.forEach(function (e) {
        if (allied(st, e.side, v.side) || (e.state !== 'active' && e.state !== 'routing')) return;
        var range = e.hidden ? C.HIDE.range : sightOf(v);
        if (dist(v.x, v.y, e.x, e.y) <= range) {
          for (var t = 0; t < st.teams; t++) if (allied(st, t, v.side)) st.seen[t][e.id] = true;
        }
      });
    });
  }

  function visibleEnemy(st, u) {
    var best = null, bd = Infinity, seen = st.seen[u.side];
    st.units.forEach(function (v) {
      if (allied(st, v.side, u.side) || v.state !== 'active' || !seen[v.id]) return;
      var d = dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v; }
    });
    return best ? { e: best, d: bd } : null;
  }

  // The nearest active enemy whether or not it is seen (used for the ambush trigger).
  function nearestAny(st, u) {
    var best = null, bd = Infinity;
    st.units.forEach(function (v) {
      if (allied(st, v.side, u.side) || v.state !== 'active') return;
      var d = dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v; }
    });
    return best ? { e: best, d: bd } : null;
  }

  function seenWithin(st, u, range) {
    var seen = st.seen[u.side];
    return st.units.some(function (v) {
      return !allied(st, v.side, u.side) && v.state === 'active' && seen[v.id] && dist(u.x, u.y, v.x, v.y) <= range;
    });
  }

  // Friends and seen foes within LOCAL.range: how the unit reads the ground around it.
  function localCount(st, u) {
    var friends = 0, foes = 0, seen = st.seen[u.side], r = C.LOCAL.range;
    st.units.forEach(function (v) {
      if (v === u || v.state !== 'active') return;
      if (dist(u.x, u.y, v.x, v.y) > r) return;
      if (allied(st, v.side, u.side)) friends += v.people; else if (seen[v.id]) foes += v.people;
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

  // The next tile on the way to a target: the neighbour with the smallest walking distance, or null if there is none.
  function nextStep(st, x, y, tx, ty) {
    var f = flowField(st, tx, ty);
    var c = clamp(Math.floor(x), 0, st.cols - 1), r = clamp(Math.floor(y), 0, st.rows - 1);
    var cur = f[r * st.cols + c];
    if (cur <= 0) return null;
    var best = null, bestD = cur;
    DIRS.forEach(function (o) {
      var nc = c + o[0], nr = r + o[1];
      if (nc < 0 || nr < 0 || nc >= st.cols || nr >= st.rows) return;
      var nd = f[nr * st.cols + nc];
      if (nd >= 0 && nd < bestD) { bestD = nd; best = { x: nc + 0.5, y: nr + 0.5 }; }
    });
    return best;
  }

  // Walks toward a point by the flow field, so units go round walls and through gates and bridges.
  function goTo(st, u, tx, ty, mul, dt) {
    var f = flowField(st, tx, ty);
    var c = clamp(Math.floor(u.x), 0, st.cols - 1), r = clamp(Math.floor(u.y), 0, st.rows - 1);
    var cur = f[r * st.cols + c];
    if (cur <= 0) return moveUnit(st, u, tx, ty, mul, dt);   // no way found, or in the target tile: go straight at it
    var n = nextStep(st, u.x, u.y, tx, ty);
    if (n) moveUnit(st, u, n.x, n.y, mul, dt);
  }

  // The route a unit will take to a point, as points on the tile grid (for drawing the planned march).
  function pathTo(st, x0, y0, x1, y1) {
    var pts = [{ x: x0, y: y0 }], x = x0, y = y0, guard = 0;
    var f = flowField(st, x1, y1);
    if (f[clamp(Math.floor(y), 0, st.rows - 1) * st.cols + clamp(Math.floor(x), 0, st.cols - 1)] < 0) {
      pts.push({ x: x1, y: y1 });
      return pts;
    }
    while (guard++ < 2000) {
      var n = nextStep(st, x, y, x1, y1);
      if (!n) break;
      pts.push(n); x = n.x; y = n.y;
    }
    pts.push({ x: x1, y: y1 });
    return pts;
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

  // Fight or close in on a target the unit can see.
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
      if (allied(st, v.side, u.side) || v.state !== 'active') return;
      var d = dist(u.x, u.y, v.x, v.y);
      if (d <= C.STRIKE.range) { hits.push({ a: u, b: v, d: d, burst: true }); hit++; }
    });
    log(st, name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' strike from cover' + (hit ? '.' : ' at nothing.'));
  }

  // Walks a route: each point in turn. Fights what it meets on the way unless it is a rush.
  function followRoute(st, u, o, en, dt, hits) {
    var target = o.points[o.i];
    if (o.mode === 'move' && en) { engage(st, u, en, dt, hits, 1); return true; }
    if (dist(u.x, u.y, target.x, target.y) > 0.3) {
      goTo(st, u, target.x, target.y, o.mode === 'rush' ? C.RUSH_MOVE : 1, dt);
      return true;
    }
    o.i++;
    if (o.i >= o.points.length) u.order = null;
    return true;
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
      log(st, name(u.side) + ' column is caught in an ambush.');
    }

    // Orders come first.
    var o = u.order;
    if (o) {
      if (o.kind === 'route') {
        followRoute(st, u, o, en, dt, hits);
        return;
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

    // A stationed unit (a defender's line) fights within its leash and otherwise stays put.
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
      if (!isPlayer(st, u) || st.gen.ambush === 'auto' || u.strikeOrdered) { strike(st, u, hits); return; }
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
    var tx = u.side === 1 ? st.cols : 0;
    var T = terrainAt(st, u.x, u.y);
    var step = C.MORALE.routSpeed * T.speed * dt;
    var nx = u.x + (tx > u.x ? step : -step);
    if (passableAt(st, nx, u.y)) u.x = nx;
    if ((tx === 0 && u.x <= 0.05) || (tx > 0 && u.x >= st.cols - 0.05)) u.state = 'gone';
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

  // Lifts or lowers the morale of units near a point: friends (allied teams) or foes.
  function boostNear(st, side, x, y, range, amount, foes) {
    st.units.forEach(function (u) {
      var friend = allied(st, u.side, side);
      if (foes ? friend : !friend) return;
      if (u.state !== 'active' && u.state !== 'routing') return;
      if (dist(u.x, u.y, x, y) <= range) u.morale = Math.min(100, u.morale + amount);
    });
  }

  function rout(st, u) {
    u.state = 'routing';
    u.order = null;
    log(st, name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' break and run.');
    st.units.forEach(function (v) {
      if (v.side === u.side && v.state === 'active' && dist(v.x, v.y, u.x, u.y) <= C.MORALE.neighbourRange) {
        v.morale -= C.MORALE.neighbourHit;
      }
    });
    // Enemies who see a unit break are encouraged.
    boostNear(st, u.side, u.x, u.y, C.MORALE.enemyFleeRange, C.MORALE.enemyFlee, true);
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
        log(st, name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' is destroyed.');
        boostNear(st, u.side, u.x, u.y, C.MORALE.enemyFleeRange, C.MORALE.death, true);
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
        return v !== u && allied(st, v.side, u.side) && v.state === 'active' && v.morale >= C.MORALE.allyMorale &&
          dist(u.x, u.y, v.x, v.y) <= C.MORALE.allyRange;
      });
      if (steady) u.morale += C.MORALE.allies * TICK;
      u.morale = Math.min(100, u.morale);

      if (u.state === 'routing' && u.morale >= C.MORALE.rallyAt && !seenWithin(st, u, C.MORALE.threatRange)) {
        u.state = 'active';
        u.order = null;
        log(st, name(u.side) + ' ' + C.UNIT[u.type].label.toLowerCase() + ' rally.');
      }
    });
  }

  // ---- Objectives, bell and reinforcements ----------------------------------

  // The team that holds a point is the one team present there, or the team with most units when allies share it.
  // A point is contested (and no one gains) while two hostile teams stand on it.
  function updateObjectives(st, dt) {
    st.field.objectives.forEach(function (o) {
      var n = [];
      for (var t = 0; t < st.teams; t++) n[t] = 0;
      st.units.forEach(function (u) {
        if (u.state === 'active' && dist(u.x, u.y, o.x, o.y) <= o.r) n[u.side]++;
      });
      var present = [], s = null;
      for (var k = 0; k < st.teams; k++) if (n[k] > 0) present.push(k);
      var groupOf = present.length ? present[0] : null;
      var single = present.every(function (k) { return allied(st, k, groupOf); });
      if (present.length && single) {
        s = present[0];
        present.forEach(function (k) { if (n[k] > n[s]) s = k; });
      }
      if (s === null) return;
      for (var j = 0; j < st.teams; j++) {
        if (j === s) o.prog[j] = Math.min(C.HOLD, o.prog[j] + dt);
        else if (!allied(st, j, s)) o.prog[j] = Math.max(0, o.prog[j] - dt);
      }
      if (o.prog[s] >= C.HOLD && o.owner !== s) {
        o.owner = s;
        st.captures++;
        boostNear(st, s, o.x, o.y, o.r * 2, C.MORALE.capture, false);
        log(st, name(s) + ' takes ' + o.name + '.');
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
      if (isPlayer(st, u)) u.approach = approachFor(st, st.gen.approach);
      else u.order = { kind: 'route', points: [{ x: st.field.objectives[0].x, y: st.field.objectives[0].y }], i: 0, mode: 'move' };
      log(st, 'Reinforcements arrive: ' + C.UNIT[d.type].label.toLowerCase() + '.');
      break;
    }
  }

  // People a team can still bring: those on the field, plus what is on its way.
  function strength(st, team) {
    var n = 0;
    st.units.forEach(function (u) { if (u.side === team && u.state === 'active') n += u.people; });
    if (team === 0) st.reserve.forEach(function (d) { n += peopleFor(st.scale, d.type); });
    if (team === 1 && st.bell && !st.bell.done) {
      n += Math.min(Math.floor(st.bell.population / C.BELL.popPerLevy), Math.floor(st.pool[1] / levyPeople(st))) * levyPeople(st);
    }
    return n;
  }

  // ---- End of battle ---------------------------------------------------------

  // The teams allied with t, in order.
  function alliance(st, t) {
    var out = [];
    for (var k = 0; k < st.teams; k++) if (allied(st, k, t)) out.push(k);
    return out;
  }

  function finish(st, winner, how) {
    var members = alliance(st, winner);
    st.done = { winner: winner, how: how, t: Math.round(st.t * 10) / 10, winners: members };
    log(st, name(winner) + (members.length > 1 ? ' and allies' : '') + ' win (' + how + ').');
  }

  // The team to credit when team t gives up: the strongest team hostile to it.
  function opponentOf(st, t, alive) {
    var best = null, bs = -1;
    alive.forEach(function (k) {
      if (allied(st, k, t)) return;
      var s = strength(st, k);
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
    for (t = 0; t < st.teams; t++) str[t] = strength(st, t);
    for (var i = 0; i < alive.length; i++) {
      var a = alive[i], foes = 0;
      alive.forEach(function (k) { if (!allied(st, k, a)) foes += str[k]; });
      if (foes > 0 && str[a] * C.SURRENDER_RATIO <= foes) return finish(st, opponentOf(st, a, alive), 'surrender');
    }

    if (st.tick * TICK >= st.cap) {
      var attackerHolds = st.captures > 0 && obj.length && obj.every(function (o) { return o.owner !== null && allied(st, o.owner, 0); });
      return attackerHolds ? finish(st, 0, 'objectives') : finish(st, 1, 'time');
    }
  }

  // ---- Computer plans --------------------------------------------------------

  // The defender (computer): a share of the infantry ambushes in the woods nearest the attack, the rest hold a station by the objective.
  function planDefender(st) {
    var units = st.units.filter(function (u) { return u.side === 1 && !u.levy; });
    var c = st.field.objectives[0];
    var woods = st.field.woodTiles.filter(function (p) { return p.x >= c.x - 2 && p.x <= c.x + 20; });   // woods on the defender's side of the objective
    var want = woods.length ? Math.floor(units.length * C.AI.ambushShare) : 0;
    var ambushers = 0, stations = 0;
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

  // ---- Arranging the army -------------------------------------------------------

  // Where each role stands in a team's spawn box: front line toward the enemy, archers in the middle, cavalry on the flanks.
  function arrangeArmy(st, team, dots) {
    var bb = st.field.bbox[team], zone = st.field.spawn[team];
    var cx = 0, cy = 0;
    zone.forEach(function (p) { cx += p.x; cy += p.y; });
    cx /= zone.length; cy /= zone.length;
    var o = st.field.objectives[0];
    var ox = o.x - cx, oy = o.y - cy;
    var depthX = Math.abs(ox) >= Math.abs(oy);   // the army faces along the longer side of the way to the objective
    var front = depthX ? (ox > 0 ? bb.x1 - 1.5 : bb.x0 + 1.5) : (oy > 0 ? bb.y1 - 1.5 : bb.y0 + 1.5);
    var sgn = depthX ? (ox > 0 ? -1 : 1) : (oy > 0 ? -1 : 1);
    var lo = depthX ? bb.y0 + 1 : bb.x0 + 1, hi = depthX ? bb.y1 - 1 : bb.x1 - 1, mid = (lo + hi) / 2;
    var roles = { front: [], centre: [], flank: [] };
    dots.forEach(function (d) { roles[C.ROLE[d.type] || 'front'].push(d); });
    function place(list, depth, lateral) {
      list.forEach(function (d, i) {
        var lat = list.length === 1 ? lateral(0.5) : lateral(i / (list.length - 1));
        var x = depthX ? front + sgn * depth : lat, y = depthX ? lat : front + sgn * depth;
        var u = d.unit;
        var px = clamp(x, 0.5, st.cols - 0.5), py = clamp(y, 0.5, st.rows - 0.5);
        if (!passableAt(st, px, py)) { px = cx; py = cy; }
        u.x = px; u.y = py;
      });
    }
    // Each entry carries its unit so the placement can be set after the unit exists.
    var lateralSpan = function (a, b) { return function (f) { return a + (b - a) * f; }; };
    place(roles.front.map(function (d) { return { unit: d.unit }; }), 1.5, lateralSpan(lo, hi));
    place(roles.centre.map(function (d) { return { unit: d.unit }; }), 4, lateralSpan(mid - 3, mid + 3));
    place(roles.flank.map(function (d) { return { unit: d.unit }; }), 1.5, function (f) { return f < 0.5 ? lo + 0.5 : hi - 0.5; });
  }

  // Players' units placed in deployment: by role when the army is arranged, otherwise spread along the zone.
  function placeArmy(st, side, specs, arranged) {
    var dots = [];
    specs.forEach(function (s) { expand(s).forEach(function (d) { dots.push(d); }); });
    var zone = st.field.spawn[side], n = dots.length;
    if (!zone || !zone.length) return;
    var created = [];
    for (var i = 0; i < n; i++) {
      var d = dots[i], need = peopleFor(st.scale, d.type);
      if (st.pool[side] < need) break;
      st.pool[side] -= need;
      var p = zone[Math.floor((i + 0.5) * zone.length / n)];
      var x = p.x + (st.rng() - 0.5) * 0.6, y = p.y + (st.rng() - 0.5) * 0.6;
      if (!passableAt(st, x, y)) { x = p.x; y = p.y; }
      created.push({ type: d.type, strategy: d.strategy, formation: d.formation, need: need, x: x, y: y });
    }
    if (arranged && created.length) {
      var units = created.map(function (c) { return { type: c.type, unit: null, c: c }; });
      // Make the units first, at their spread positions, then move them into their arranged places.
      created.forEach(function (c) { c.unit = newUnit(st, side, c.type, c.strategy, c.formation, c.x, c.y, c.need); });
      arrangeArmy(st, side, created.map(function (c) { return { type: c.type, unit: c.unit }; }));
      return;
    }
    created.forEach(function (c) { newUnit(st, side, c.type, c.strategy, c.formation, c.x, c.y, c.need); });
  }

  // Groups: each player unit is in group 1 or 2. Each group's offsets from its centre are kept, so a group moves as one.
  function setGroupOffsets(st, team) {
    var groups = {};
    st.units.forEach(function (u) {
      if (u.side !== team || u.state !== 'active') return;
      (groups[u.group] = groups[u.group] || []).push(u);
    });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g], cx = 0, cy = 0;
      list.forEach(function (u) { cx += u.x; cy += u.y; });
      cx /= list.length; cy /= list.length;
      list.forEach(function (u) { u.offset = { x: u.x - cx, y: u.y - cy }; });
    });
  }

  // A group's approach: one point for the group, with every member keeping its place in the formation.
  function setGroupApproach(st, team, mode) {
    var groups = {};
    st.units.forEach(function (u) {
      if (u.side !== team || u.state !== 'active') return;
      (groups[u.group] = groups[u.group] || []).push(u);
    });
    Object.keys(groups).forEach(function (g) {
      var anchor = approachFor(st, mode);
      groups[g].forEach(function (u) {
        if (!anchor) { u.approach = null; return; }
        u.approach = { x: clamp(anchor.x + (u.offset ? u.offset.x : 0), 0.5, st.cols - 0.5), y: clamp(anchor.y + (u.offset ? u.offset.y : 0), 0.5, st.rows - 0.5) };
      });
    });
  }

  // The planned march of a unit, as points (for drawing). A stopped unit has no march: its future spot is its station or current spot.
  V4.plannedPath = function (st, u) {
    if (!u || u.state !== 'active') return null;
    var o = u.order;
    if (o && o.kind === 'route') {
      var pts = [{ x: u.x, y: u.y }], px = u.x, py = u.y;
      for (var i = o.i; i < o.points.length; i++) {
        var seg = pathTo(st, px, py, o.points[i].x, o.points[i].y);
        pts = pts.concat(seg.slice(1));
        px = o.points[i].x; py = o.points[i].y;
      }
      return { kind: 'march', points: pts, stop: null };
    }
    if (o && o.kind === 'hold') return { kind: 'stop', points: [], stop: { x: u.x, y: u.y } };
    if (u.station) return { kind: 'stop', points: [], stop: { x: u.station.x, y: u.station.y } };
    if (u.strategy === 'ambush' && !u.sprung) return { kind: 'stop', points: [], stop: { x: u.x, y: u.y } };
    if (u.approach && dist(u.x, u.y, u.approach.x, u.approach.y) > 0.5) {
      return { kind: 'march', points: pathTo(st, u.x, u.y, u.approach.x, u.approach.y), stop: null };
    }
    return null;
  };

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
      t: 0, tick: 0, scale: scale, grain: C.GRAIN[scale], cap: C.CAP[scale],
      cols: field.cols, rows: field.rows, deployX: field.deployX,
      field: field, rng: rng, units: [], nextId: 1, flows: {},
      animate: !!opts.animate, events: [], log: [], commands: [],
      pool: [req.attacker.pool || 0, req.defender.pool || 0, req.third ? (req.third.pool || 0) : 0],
      losses: [zeroTypes(), zeroTypes(), zeroTypes()], kills: [zeroTypes(), zeroTypes(), zeroTypes()], levies: 0,
      done: null, manual: null, captures: 0,
      reserve: [], bell: null, reinforceT: C.REINFORCE_EVERY,
      seen: []
    };
    var attackerDots = [];
    (req.attacker.reserve || []).forEach(function (s) { expand(s).forEach(function (d) { attackerDots.push(d); }); });
    st.reserve = attackerDots;

    var tiers = ['village', 'town', 'city', 'fortress'];
    if (tiers.indexOf(req.defender.settlement) >= 0 && (req.defender.population || 0) > 0) {
      st.bell = { done: false, population: req.defender.population };
    }

    var specs = [req.attacker.units || [], req.defender.units || [], req.third ? (req.third.units || []) : []];
    for (var t = 0; t < teams; t++) placeArmy(st, t, specs[t], t === you);

    // Groups: the player's army is in up to two groups, with a place in the formation.
    if (you !== null) {
      setGroupOffsets(st, you);
      if (gen.approach !== 'none') setGroupApproach(st, you, gen.approach);
    }
    // The computer plays every team that is not the player's.
    for (t = 0; t < teams; t++) {
      if (t === you) continue;
      if (t === 1) { if (req.defender.ai !== false) planDefender(st); else marchOn(st, 1); }
      else marchOn(st, t);
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
    var ok = apply(st, cmd);
    if (ok) st.commands.push({ tick: st.tick, cmd: cmd });
    return ok;
  };

  function validPoint(p) { return p && isFinite(p.x) && isFinite(p.y); }

  function apply(st, cmd) {
    if (cmd.kind === 'surrender') {
      if (cmd.side === undefined || cmd.side === null || cmd.side < 0 || cmd.side >= st.teams) return false;
      st.manual = cmd.side; checkEnd(st); return true;
    }
    if (cmd.kind === 'group') return applyGroup(st, cmd);
    var u = findUnit(st, cmd.unit);
    if (!u || u.state !== 'active' || !isPlayer(st, u)) return false;   // you only give orders to your own units
    switch (cmd.kind) {
      case 'place':
        if (st.tick !== 0 || !inBox(st, u.side, cmd.x, cmd.y) || !passableAt(st, cmd.x, cmd.y)) return false;
        u.x = cmd.x; u.y = cmd.y; return true;
      case 'move': u.order = { kind: 'route', points: [{ x: cmd.x, y: cmd.y }], i: 0, mode: 'move' }; return true;
      case 'rush': u.order = { kind: 'route', points: [{ x: cmd.x, y: cmd.y }], i: 0, mode: 'rush' }; return true;
      case 'route':
        if (!Array.isArray(cmd.points) || !cmd.points.length || !cmd.points.every(validPoint)) return false;
        u.order = { kind: 'route', points: cmd.points.map(function (p) { return { x: p.x, y: p.y }; }), i: 0, mode: cmd.mode === 'rush' ? 'rush' : 'move' };
        return true;
      case 'attack':
        var t = findUnit(st, cmd.target);
        if (!t || allied(st, t.side, u.side)) return false;
        u.order = { kind: 'attack', target: t.id }; return true;
      case 'hold': u.order = { kind: 'hold' }; return true;
      case 'strike':
        if (!u.strikePrompt) return false;
        u.strikeOrdered = true; return true;
      case 'assign':
        if (cmd.group !== 1 && cmd.group !== 2) return false;
        u.group = cmd.group; return true;
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

  // A group command gives every member of a group the same order. A move keeps each member's place in the group.
  function applyGroup(st, cmd) {
    if (st.you === null || (cmd.group !== 1 && cmd.group !== 2)) return false;
    var members = st.units.filter(function (u) { return u.side === st.you && u.group === cmd.group && u.state === 'active'; });
    if (!members.length) return false;
    var cx = 0, cy = 0;
    members.forEach(function (u) { cx += u.x; cy += u.y; });
    cx /= members.length; cy /= members.length;
    switch (cmd.action) {
      case 'move':
      case 'rush':
        if (!validPoint(cmd)) return false;
        members.forEach(function (u) {
          var px = clamp(cmd.x + (u.x - cx), 0.5, st.cols - 0.5), py = clamp(cmd.y + (u.y - cy), 0.5, st.rows - 0.5);
          u.order = { kind: 'route', points: [{ x: px, y: py }], i: 0, mode: cmd.action === 'rush' ? 'rush' : 'move' };
        });
        return true;
      case 'hold':
        members.forEach(function (u) { u.order = { kind: 'hold' }; });
        return true;
      case 'strategy':
        if (!C.STRATEGY[cmd.value]) return false;
        members.forEach(function (u) { u.strategy = cmd.value; u.order = null; u.sprung = false; u.strikePrompt = false; });
        return true;
      case 'formation':
        if (!C.FORMATION[cmd.value]) return false;
        members.forEach(function (u) { u.formation = cmd.value; });
        return true;
    }
    return false;
  }

  function inBox(st, team, x, y) {
    var b = st.field.bbox[team];
    return !!b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  }

  // The result that goes back to V2. Pool is what each side has at home after the battle.
  V4.result = function (st) {
    var d = st.done || { winner: null, how: 'running', t: st.t, winners: [] };
    var survivors = [], surv = [], t;
    for (t = 0; t < st.teams; t++) { survivors[t] = zeroTypes(); surv[t] = 0; }
    st.units.forEach(function (u) {
      if (u.state === 'dead') return;
      survivors[u.side][u.type] += u.people;
      surv[u.side] += u.people;
    });
    var captured = st.field.objectives.some(function (o) { return o.settlement && o.owner !== null && allied(st, o.owner, 0); });
    function round(obj) {
      var out = {};
      Object.keys(obj).forEach(function (k) { out[k] = Math.round(obj[k]); });
      return out;
    }
    var losses = {}, sv = {}, pool = {};
    for (t = 0; t < st.teams; t++) {
      losses[name(t)] = round(st.losses[t]);
      sv[name(t)] = round(survivors[t]);
      pool[name(t)] = Math.round(st.pool[t] + surv[t]);
    }
    return {
      seed: st.seed,
      winner: d.winner === null ? null : name(d.winner),
      winners: (d.winners || []).map(name),
      how: d.how,
      captured: captured && d.winner !== null && allied(st, d.winner, 0),
      losses: { attacker: losses.attacker, defender: losses.defender, third: losses.third || {} },
      survivors: { attacker: sv.attacker, defender: sv.defender, third: sv.third || {} },
      pool: { attacker: pool.attacker, defender: pool.defender, third: pool.third || 0 },
      // Kills by unit type: the people each side's units killed, credited to the type that killed them.
      killsBy: { attacker: round(st.kills[0]), defender: round(st.kills[1]), third: round(st.kills[2]) },
      levies: st.levies,
      seconds: Math.round(st.t)
    };
  };

  V4.sim = { newUnit: newUnit, peopleFor: peopleFor, findUnit: findUnit, visibleEnemy: visibleEnemy, zeroTypes: zeroTypes, localCount: localCount, allied: allied };
})();
