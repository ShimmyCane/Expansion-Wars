// Expansion Wars — V4 battle simulation. No DOM: runs in the browser and in Node.
// Side 0 is the attacker, side 1 the defender. Positions are in tiles (1 tile = 20 units).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG;
  var WORD = ['Attacker', 'Defender'];
  var EPS = 0.01;

  function zeroTypes() { var o = {}; C.TYPES.forEach(function (t) { o[t] = 0; }); return o; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  function tileCode(st, x, y) {
    var c = Math.floor(x), r = Math.floor(y);
    if (c < 0 || r < 0 || c >= C.COLS || r >= C.ROWS) return null;
    return st.field.tiles[r * C.COLS + c];
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
      x: x, y: y, facing: side === 0 ? 1 : -1,
      formation: formation || 'line', strategy: strategy || 'engage',
      plan: { strategy: strategy || 'engage', formation: formation || 'line' },
      order: null, state: 'active',
      ambushT: 0, ambushSeen: false, chargeT: 0, fireT: 0,
      atkMul: 1, hitThis: 0, incoming: 0, levy: false
    };
    st.units.push(u);
    return u;
  }

  function nearestEnemy(st, u) {
    var best = null, bd = Infinity;
    for (var i = 0; i < st.units.length; i++) {
      var v = st.units[i];
      if (v.side === u.side || v.state !== 'active') continue;
      var d = dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v; }
    }
    return best ? { e: best, d: bd } : null;
  }

  function sumPeople(st, side) {
    var n = 0;
    st.units.forEach(function (u) { if (u.side === side && u.state === 'active') n += u.people; });
    return n;
  }

  // Place a list of unit specs on a side's spawn zone, spread along it. Pool people are taken as units are placed.
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
      var jx = (st.rng() - 0.5) * 0.6, jy = (st.rng() - 0.5) * 0.6;
      var x = p.x + jx, y = p.y + jy;
      if (!passableAt(st, x, y)) { x = p.x; y = p.y; }
      newUnit(st, side, d.type, d.strategy, d.formation, x, y, need);
    }
  }

  // ---- Movement and actions -------------------------------------------------

  // mul is the strategy's speed factor. The formation and terrain are applied here.
  function moveUnit(st, u, tx, ty, mul, dt) {
    var U = C.UNIT[u.type], F = C.FORMATION[u.formation];
    var dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    var T = terrainAt(st, u.x, u.y);
    var m = T.speed;
    if (U.mounted && T.cavSpeed) m *= T.cavSpeed;
    var step = Math.min(d, U.speed * F.speed * mul * m * dt);
    var nx = u.x + dx / d * step, ny = u.y + dy / d * step;
    if (passableAt(st, nx, ny)) { u.x = nx; u.y = ny; }
    else if (passableAt(st, nx, u.y)) { u.x = nx; }
    else if (passableAt(st, u.x, ny)) { u.y = ny; }
  }

  function fire(st, u, target, d, hits) {
    hits.push({ a: u, b: target, d: d });
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

  function decide(st, u, dt, hits) {
    var U = C.UNIT[u.type];
    u.fireT -= dt;
    u.ambushT = Math.max(0, u.ambushT - dt);
    u.chargeT = Math.max(0, u.chargeT - dt);

    var en = nearestEnemy(st, u);

    // A column walking into an enemy in cover is ambushed once, on first sight.
    if (en && !u.ambushSeen && u.formation === 'column' && en.d <= C.AMBUSH.range &&
        tileCode(st, en.e.x, en.e.y) === 'w') {
      u.ambushSeen = true;
      u.ambushT = C.AMBUSH.duration * (u.strategy === 'slow' ? C.STRATEGY.slow.ambushMul : 1);
      log(st, WORD[u.side] + ' column is caught in an ambush.');
    }

    // Player orders come first.
    var o = u.order;
    if (o) {
      if (o.kind === 'move') {
        if (dist(u.x, u.y, o.x, o.y) > 0.3) { moveUnit(st, u, o.x, o.y, 1, dt); return; }
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
          moveUnit(st, u, t.x, t.y, 1, dt);
          if (U.mounted) u.chargeT = C.CHARGE.window;
          return;
        }
      }
    }

    // Opening strategy when there is no order.
    if (!en) return;
    var strat = u.strategy;
    if (strat === 'ambush') {
      // Hold in cover until an enemy comes within the trigger distance, then rush.
      if (en.d > C.STRATEGY.ambush.trigger) {
        if (en.d <= U.range && en.d >= U.minRange) fire(st, u, en.e, en.d, hits);
        return;
      }
      strat = 'rush';
    }
    if (strat === 'kite' && (U.mounted || !U.melee) && en.d < C.STRATEGY.kite.retreat) {
      moveUnit(st, u, u.x + (u.x - en.e.x), u.y + (u.y - en.e.y), 1, dt);
      return;
    }
    if (en.d <= U.range && en.d >= U.minRange) { fire(st, u, en.e, en.d, hits); return; }
    if (en.d < U.minRange) return;
    moveUnit(st, u, en.e.x, en.e.y, C.STRATEGY[strat].speed, dt);
    if (U.mounted) u.chargeT = C.CHARGE.window;
  }

  function retreat(st, u, dt) {
    // A routing unit runs for its own edge.
    var tx = u.side === 0 ? 0 : C.COLS;
    var T = terrainAt(st, u.x, u.y);
    var step = C.MORALE.routSpeed * T.speed * dt;
    var nx = u.x + (tx > u.x ? step : -step);
    if (passableAt(st, nx, u.y)) u.x = nx;
    if ((u.side === 0 && u.x <= 0.05) || (u.side === 1 && u.x >= C.COLS - 0.05)) u.state = 'gone';
  }

  // ---- Damage, morale and routing -------------------------------------------

  function rout(st, u) {
    u.state = 'routing';
    u.order = null;
    log(st, WORD[u.side] + ' ' + C.UNIT[u.type].label.toLowerCase() + ' break and run.');
    st.units.forEach(function (v) {
      if (v.side === u.side && v.state === 'active' && dist(v.x, v.y, u.x, u.y) <= C.MORALE.neighbourRange) {
        v.morale -= C.MORALE.neighbourHit;
      }
    });
  }

  // Damage is worked out for every hit first, then applied together, so the order of hits does not favour a side.
  function applyHits(st, hits) {
    var pending = [];
    hits.forEach(function (h) {
      var a = h.a, b = h.b;
      if (a.people <= EPS || b.state !== 'active') return;
      var U = C.UNIT[a.type], Fb = C.FORMATION[b.formation], Tb = terrainAt(st, b.x, b.y);
      var code = tileCode(st, b.x, b.y);

      var base = U.atk * a.atkMul;
      if (!U.melee && h.d < 1.2) base *= C.RANGED_IN_MELEE;
      var mul = counter(a.type, b.type);
      if (a.type === 'catapults' && (code === 't' || code === 'x' || code === 'y')) mul *= C.CATAPULT_WALLS;

      var charge = 1;
      if (U.mounted && a.chargeT > 0 && h.d <= 1.2 && !terrainAt(st, a.x, a.y).noCharge) {
        charge = C.CHARGE.mul * C.FORMATION[a.formation].charge;
      }

      // Frontal hits are normal. Hits from the side or rear use the formation's flank value.
      var front = (a.x - b.x) * b.facing > 0;
      var taken = front ? 1 : Fb.flank;
      taken /= U.melee ? (Fb.melee * Tb.def) : Tb.def;
      if (!U.melee) taken *= Fb.area;
      if (b.ambushT > 0) taken *= C.AMBUSH.dmgMul;

      var morale = clamp(a.morale / 100, C.MORALE.floor, 1);
      pending.push({ b: b, dmg: a.people * base * mul * charge * morale * C.DAMAGE_K * taken });
    });

    var totals = [];
    pending.forEach(function (p) {
      if (totals.indexOf(p.b) < 0) totals.push(p.b);
      p.b.incoming = (p.b.incoming || 0) + p.dmg;
    });
    totals.forEach(function (b) {
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
      if (u.people <= EPS) { u.people = 0; u.state = 'dead'; return; }
    });
    st.units.forEach(function (u) {
      if (u.state === 'active' && u.morale <= 0) rout(st, u);
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
        log(st, WORD[s] + ' takes ' + o.name + '.');
      }
    });
  }

  function updateBell(st) {
    var bell = st.bell;
    if (!bell || bell.done || st.t < C.BELL.delay) return;
    bell.done = true;
    var levyPeople = Math.max(1, Math.round(st.grain / 4));
    var count = Math.floor(bell.population / C.BELL.popPerLevy);
    var types = ['pikemen', 'slingers'], raised = 0;
    for (var i = 0; i < count; i++) {
      if (st.pool[1] < levyPeople) break;
      st.pool[1] -= levyPeople;
      var p = st.field.bell;
      var x = p.x + (st.rng() - 0.5) * 2, y = p.y + (st.rng() - 0.5) * 2;
      if (!passableAt(st, x, y)) { x = p.x; y = p.y; }
      var u = newUnit(st, 1, types[i % 2], 'engage', 'line', x, y, levyPeople);
      u.morale = C.BELL.levyMorale;
      u.atkMul = C.BELL.levyAtk;
      u.levy = true;
      raised++;
    }
    st.levies += raised;
    log(st, raised ? 'The bell rings: ' + raised + ' levies take the field.' : 'The bell rings, but no one is left to answer.');
  }

  function updateReinforce(st, dt) {
    st.reinforceT -= dt;
    if (st.reinforceT > 0) return;
    st.reinforceT = C.REINFORCE_EVERY;
    while (st.reserve.length) {
      var d = st.reserve[0], need = peopleFor(st.scale, d.type);
      if (st.pool[0] < need) {
        st.reserve.shift();
        log(st, 'No more people at home for another wave.');
        continue;
      }
      st.reserve.shift();
      st.pool[0] -= need;
      var edge = st.field.edge[0];
      var p = edge.length ? edge[Math.floor(st.rng() * edge.length)] : { x: 0.5, y: 16 };
      newUnit(st, 0, d.type, d.strategy, d.formation, p.x, p.y, need);
      log(st, 'Reinforcements arrive: ' + C.UNIT[d.type].label.toLowerCase() + '.');
      break;
    }
  }

  // ---- End of battle ---------------------------------------------------------

  function finish(st, winner, how) {
    st.done = { winner: winner, how: how, t: Math.round(st.t * 10) / 10 };
    log(st, WORD[winner] + ' wins (' + how + ').');
  }

  function checkEnd(st) {
    if (st.done) return;
    var act = [0, 0], routed = [0, 0], people = [0, 0];
    st.units.forEach(function (u) {
      if (u.state === 'active') { act[u.side]++; people[u.side] += u.people; }
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
    if (people[0] * C.SURRENDER_RATIO <= people[1]) return finish(st, 1, 'surrender');
    if (people[1] * C.SURRENDER_RATIO <= people[0]) return finish(st, 0, 'surrender');

    if (st.t >= st.cap) {
      var attackerHolds = st.captures > 0 && obj.length && obj.every(function (o) { return o.owner === 0; });
      return attackerHolds ? finish(st, 0, 'objectives') : finish(st, 1, 'time');
    }
  }

  // ---- Public API ------------------------------------------------------------

  V4.createBattle = function (req, opts) {
    opts = opts || {};
    var scale = req.scale || 'fortress';
    var rng = V4.rng(req.seed || 1);
    var field = V4.buildField(req, rng);
    var st = {
      t: 0, scale: scale, grain: C.GRAIN[scale], cap: C.CAP[scale],
      field: field, rng: rng, units: [], nextId: 1,
      animate: !!opts.animate, events: [], log: [],
      pool: [req.attacker.pool || 0, req.defender.pool || 0],
      losses: [zeroTypes(), zeroTypes()], levies: 0,
      done: null, manual: null, captures: 0,
      reserve: [],
      bell: null,
      reinforceT: C.REINFORCE_EVERY
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
    checkEnd(st);
    return st;
  };

  V4.step = function (st, dt) {
    if (st.done) return;
    st.t += dt;
    if (st.animate) st.events = st.events.filter(function (e) { return st.t - e.t < 1; });
    updateBell(st);
    updateReinforce(st, dt);

    // Units act in a random order each tick (seeded), so no side always moves first.
    var order = st.units.slice();
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(st.rng() * (i + 1)), tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    var hits = [];
    order.forEach(function (u) {
      if (u.state === 'active') decide(st, u, dt, hits);
      else if (u.state === 'routing') retreat(st, u, dt);
    });
    applyHits(st, hits);
    updateObjectives(st, dt);
    checkEnd(st);
  };

  // Player commands: move, attack, hold, strategy, formation, proceed, surrender.
  V4.issue = function (st, cmd) {
    if (st.done) return false;
    if (cmd.kind === 'surrender') { st.manual = cmd.side; checkEnd(st); return true; }
    var u = findUnit(st, cmd.unit);
    if (!u || u.state !== 'active') return false;
    switch (cmd.kind) {
      case 'move': u.order = { kind: 'move', x: cmd.x, y: cmd.y }; return true;
      case 'attack':
        var t = findUnit(st, cmd.target);
        if (!t || t.side === u.side) return false;
        u.order = { kind: 'attack', target: t.id }; return true;
      case 'hold': u.order = { kind: 'hold' }; return true;
      case 'strategy': if (!C.STRATEGY[cmd.value]) return false; u.strategy = cmd.value; u.order = null; return true;
      case 'formation': if (!C.FORMATION[cmd.value]) return false; u.formation = cmd.value; return true;
      case 'proceed': u.order = null; u.strategy = u.plan.strategy; u.formation = u.plan.formation; return true;
    }
    return false;
  };

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
      winner: d.winner === null ? null : (d.winner === 0 ? 'attacker' : 'defender'),
      how: d.how === 'objectives' ? 'objectives' : d.how,
      captured: captured && d.winner === 0,
      losses: { attacker: round(st.losses[0]), defender: round(st.losses[1]) },
      survivors: { attacker: round(survivors[0]), defender: round(survivors[1]) },
      pool: { attacker: Math.round(st.pool[0] + surv[0]), defender: Math.round(st.pool[1] + surv[1]) },
      levies: st.levies,
      seconds: Math.round(st.t)
    };
  };

  V4.sim = { newUnit: newUnit, peopleFor: peopleFor, findUnit: findUnit, nearestEnemy: nearestEnemy, zeroTypes: zeroTypes };
})();
