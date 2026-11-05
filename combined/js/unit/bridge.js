// Expansion Wars (combined) — the bridge between the world and the unit battle engine (window.V4).
// A fight between two provinces in the window becomes a battle request; the battle's result goes back into the world.
// world.battle holds the request and every order given, never the engine's live state, so the battle is plain JSON and
// can be rebuilt after a reload by replaying the orders (V4 battles are deterministic for the same request and orders).
(function () {
  'use strict';
  var XW = window.XW, U = XW.unit, W = XW.world;
  var V4 = window.V4;

  // The army a side brings: soldiers become dots of up to two of each type, in the side's preferred order.
  var MIX = {
    attacker: ['swordsmen', 'pikemen', 'archers', 'cavalry', 'slingers', 'catapults'],
    defender: ['pikemen', 'archers', 'swordsmen', 'slingers', 'cavalry', 'catapults']
  };
  var MAX_DOTS = 10;   // dots a side may field at most (each type at most V4.CONFIG.MAX_PER_TYPE)

  // People in one dot for a battle of these sizes: the bigger side fields MAX_DOTS dots.
  U.grainFor = function (a, d) { return Math.max(1, Math.ceil(Math.max(a, d, 1) / MAX_DOTS)); };

  function army(side, soldiers, grain, strategy) {
    var left = soldiers, per = {}, units = [], order = MIX[side], guard = 0;
    while (guard++ < 40) {
      var placed = false;
      for (var i = 0; i < order.length; i++) {
        var t = order[i], need = V4.sim.peopleFor(grain, t);
        if ((per[t] || 0) >= V4.CONFIG.MAX_PER_TYPE || left < need) continue;
        per[t] = (per[t] || 0) + 1; left -= need; placed = true;
      }
      if (!placed) break;
    }
    Object.keys(per).forEach(function (t) {
      units.push({ type: t, count: per[t], strategy: t === 'archers' || t === 'slingers' ? 'kite' : strategy, formation: 'line' });
    });
    return units;
  }

  // A small hash, so each battle in a world has its own seed.
  function seedFor(w, n) { return ((w.seed * 2654435761) ^ (n * 40503)) >>> 0 || 1; }

  // The battle request for `count` soldiers from province `from` attacking province `to`.
  U.requestFor = function (w, from, to, count) {
    var a = w.provs[from], d = w.provs[to], def = Math.floor(d.gar || 0);
    var grain = U.grainFor(count, def);
    var you = a.owner === w.you ? 0 : d.owner === w.you ? 1 : null;
    var woods = d.adj.some(function (q) { return w.provs[q].terrain === 'forest'; });
    return {
      seed: seedFor(w, w.battles.length + 1), scale: 'fortress', grain: grain, mode: you === null ? 'auto' : 'play', you: you === null ? undefined : you,
      attacker: { nation: W.ownerName(w, a.owner), provinces: [from], pool: count, units: army('attacker', count, grain, 'engage'), reserve: [] },
      defender: {
        nation: W.ownerName(w, d.owner), province: to, pool: def, population: 0,
        settlement: W.TIERS[d.tier].settlement, units: army('defender', def, grain, 'engage')
      },
      border: { river: XW.province.riverBetween(w, from, to), road: true },
      gen: {
        size: 'small', river: XW.province.riverBetween(w, from, to) ? 'fords' : 'none', roads: true, grass: true,
        woods: woods, walls: d.tier !== 'e', fatigue: true, facing: true, ambush: 'auto', approach: 'mixed', gates: 3
      }
    };
  };

  // Starts a battle: the attackers leave their province, and the fight waits in world.battle until it is played out.
  // Returns a message when it cannot start, or null.
  U.start = function (w, win, from, to, pct) {
    if (w.battle) return 'A battle is already being fought.';
    var a = w.provs[from], d = w.provs[to];
    if (!a || a.owner !== w.you) return 'Attack from one of your own provinces.';
    if (!d || d.owner === w.you) return 'Pick a province you do not hold.';
    if (XW.province.links(w, win, from).indexOf(to) < 0) return 'A battle is fought between neighbours: pick a province next to yours.';
    var why = W.whyNot(w, w.you, d);
    if (why) return why;
    var have = Math.floor(a.gar || 0), count = Math.min(have, Math.max(2, Math.floor(have * pct / 100)));
    if (count < 2) return 'Muster soldiers into that province first (at least 2).';
    var req = U.requestFor(w, from, to, count);
    var bad = V4.validateRequest(req);
    if (bad.length) return 'The battle could not be set up: ' + bad[0];
    a.gar -= count;
    w.battle = { id: XW.core.uuid(), from: from, to: to, attacker: a.owner, defender: d.owner, count: count, defCount: Math.floor(d.gar || 0),
      tier: d.tier, request: req, commands: [], tick: 0, started: w.time.t };
    W.log(w, 'Battle: ' + count + ' soldiers attack ' + W.aLabel(d.tier) + ' held by ' + W.ownerName(w, d.owner) + '.');
    return null;
  };

  // The engine's live battle for world.battle: made from the request, with the orders given so far replayed.
  U.rebuild = function (w) {
    var b = w.battle;
    if (!b) return null;
    var st = V4.createBattle(b.request, { animate: true });
    var list = b.commands.slice(), i = 0;
    while (st.tick < b.tick && !st.done) {
      while (i < list.length && list[i].tick === st.tick) { V4.issue(st, list[i].cmd); i++; }
      V4.step(st);
    }
    st.commands = list.slice(0, i);
    return st;
  };

  // Keeps world.battle in step with the live battle: the tick reached and the orders given.
  U.record = function (w, st) {
    if (!w.battle || !st) return;
    w.battle.tick = st.tick;
    w.battle.commands = st.commands.slice();
  };

  // Plays the rest of a battle with no drawing (when you leave it, or a computer battle).
  U.finishAuto = function (st) {
    var guard = Math.ceil((V4.CONFIG.CAP[st.scale] || 120) / V4.CONFIG.TICK) + 10;
    while (!st.done && guard-- > 0) V4.step(st);
    return V4.result(st);
  };

  // The result goes back into the world: the winner holds the province with what it has left; the losing attackers that
  // are left go back to the province they came from (or to the field army if it has been lost meanwhile).
  U.apply = function (w, result) {
    var b = w.battle;
    if (!b) return null;
    var a = w.provs[b.from], d = w.provs[b.to];
    var attLeft = Math.max(0, Math.round(result.pool.attacker)), defLeft = Math.max(0, Math.round(result.pool.defender));
    var won = result.winner === 'attacker' && d.owner === b.defender;
    if (won) {
      W.capture(w, d, b.attacker, attLeft);
      W.log(w, W.ownerName(w, b.attacker) + ' wins the battle and takes the ' + W.label(d.tier) + ' (' + attLeft + ' soldiers hold it).');
    } else {
      d.gar = defLeft;
      if (a.owner === b.attacker) a.gar = (a.gar || 0) + attLeft;
      else w.nations[b.attacker].soldiers += attLeft;
      W.log(w, W.ownerName(w, b.defender) + ' holds the ' + W.label(d.tier) + ' (' + defLeft + ' left). ' + attLeft + ' attackers fall back.');
    }
    w.battles.push({
      id: b.id, turn: w.time.turn, from: b.from, prov: b.to, attacker: b.attacker, defender: b.defender,
      count: b.count, defCount: b.defCount, winner: result.winner, how: result.how, seconds: result.seconds,
      left: { attacker: attLeft, defender: defLeft }, seed: b.request.seed, orders: b.commands.length
    });
    while (w.battles.length > W.CONFIG.BATTLES_KEPT) w.battles.shift();
    w.battle = null;
    XW.country.checkFallen(w);
    XW.country.updateNeighbours(w);
    return won;
  };
})();
