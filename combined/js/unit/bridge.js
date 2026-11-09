// Expansion Wars (combined) — the bridge between the world and the unit battle engine (window.V4).
// A fight between two provinces becomes a battle request; the battle's result goes back into the world. Two kinds:
//   - an attack you start from the province window (U.start), and
//   - a fight already on a province, joined from the red Join battle button (U.startFight).
// world.battle holds the request and every order given, never the engine's live state, so the battle is plain JSON and
// can be rebuilt after a reload by replaying the orders (V4 battles are deterministic for the same request and orders).
(function () {
  'use strict';
  var XW = window.XW, U = XW.unit, W = XW.world;
  var V4 = window.V4;

  // The army a side brings. Soldiers become squads (dots) of at least MIN_SQUAD soldiers, in the unlock order: a type
  // joins only once every type before it is in (pikemen, archers, swordsmen, slingers, cavalry, catapults). A second squad
  // of a type comes only when a squad of it would be more than SPLIT_OVER soldiers; otherwise there is just one.
  var ORDER = ['pikemen', 'archers', 'swordsmen', 'slingers', 'cavalry', 'catapults'];
  var MAX_DOTS = 10, MIN_SQUAD = 5, SPLIT_OVER = 10;

  // People in one squad for a battle of these sizes: the bigger side fields MAX_DOTS squads, and a squad is never under MIN_SQUAD.
  U.grainFor = function (a, d) { return Math.max(MIN_SQUAD, Math.ceil(Math.max(a, d, 1) / MAX_DOTS)); };

  function army(side, soldiers, grain, strategy) {
    var left = soldiers, per = {}, units = [], dots = 0;
    for (var pass = 0; pass < 2; pass++) {
      if (pass === 1 && grain <= SPLIT_OVER) break;
      for (var i = 0; i < ORDER.length && dots < MAX_DOTS; i++) {
        var t = ORDER[i], need = V4.sim.peopleFor(grain, t);
        if (left < need) break;                                   // the next type stays locked
        if ((per[t] || 0) >= V4.CONFIG.MAX_PER_TYPE) continue;
        per[t] = (per[t] || 0) + 1; left -= need; dots++;
      }
    }
    ORDER.forEach(function (t) {
      if (per[t]) units.push({ type: t, count: per[t], strategy: t === 'archers' || t === 'slingers' ? 'kite' : strategy, formation: 'line' });
    });
    return units;
  }

  // A small hash, so each battle in a world has its own seed.
  function seedFor(w, n) { return ((w.seed * 2654435761) ^ (n * 40503)) >>> 0 || 1; }

  // The battle request for `count` soldiers from province `from` attacking province `to`. attOwner is who attacks (it is
  // the owner of `from` unless a fight says otherwise); the defender is whoever holds `to` now, with its garrison.
  U.requestFor = function (w, from, to, count, attOwner) {
    var a = w.provs[from], d = w.provs[to], def = Math.floor(d.gar || 0);
    var att = attOwner === undefined ? a.owner : attOwner;
    var grain = U.grainFor(count, def);
    var you = att === w.you ? 0 : d.owner === w.you ? 1 : null;
    var woods = d.adj.some(function (q) { return w.provs[q].terrain === 'forest'; });
    var river = XW.province.riverBetween(w, from, to);
    var walls = ['t', 'c', 'f'].indexOf(d.tier) >= 0;   // towns, cities and fortresses have walls; villages do not
    return {
      seed: seedFor(w, w.battles.length + 1), scale: 'fortress', grain: grain, mode: you === null ? 'auto' : 'play', you: you === null ? undefined : you,
      attacker: { nation: W.ownerName(w, att), provinces: [from], pool: count, units: army('attacker', count, grain, 'engage'), reserve: [] },
      defender: {
        nation: W.ownerName(w, d.owner), province: to, pool: def, population: 0,
        settlement: W.TIERS[d.tier].settlement, units: army('defender', def, grain, 'engage')
      },
      border: { river: river, road: true },
      gen: {
        size: 'small', river: river ? 'fords' : 'none', roads: true, grass: true,
        woods: woods, walls: walls, fatigue: true, facing: true, ambush: 'auto', approach: 'mixed', gates: 3
      }
    };
  };

  // Starts a battle you order: your soldiers leave their province, and the fight waits in world.battle until it is played.
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
      tier: d.tier, request: req, commands: [], tick: 0, started: w.time.t, fight: false };
    W.log(w, 'Battle: ' + count + ' soldiers attack ' + W.aLabel(d.tier) + ' held by ' + W.ownerName(w, d.owner) + '.');
    return null;
  };

  // Joins a fight already on province p (its attackers are waiting there). Either side may join. The garrison fights in
  // the battle, so it leaves the province until the battle is over. Returns a message when it cannot start, or null.
  U.startFight = function (w, p) {
    var f = p && p.fight;
    if (!f) return 'No fight here.';
    if (w.battle) return 'A battle is already being fought.';
    if (f.owner !== w.you && p.owner !== w.you) return 'You are not in this fight.';
    if (f.from === undefined || f.from < 0 || w.provs[f.from].adj.indexOf(p.id) < 0) return 'The attackers are not next to this province.';
    var count = Math.max(1, Math.floor(f.count)), def = Math.floor(p.gar || 0);
    var req = U.requestFor(w, f.from, p.id, count, f.owner);
    var bad = V4.validateRequest(req);
    if (bad.length) return 'The battle could not be set up: ' + bad[0];
    w.battle = { id: XW.core.uuid(), from: f.from, to: p.id, attacker: f.owner, defender: p.owner, count: count, defCount: def,
      tier: p.tier, request: req, commands: [], tick: 0, started: w.time.t, fight: true };
    p.fight = null;
    p.gar = 0;
    W.log(w, 'Joined the fight at ' + W.aLabel(p.tier) + ': ' + count + ' attacking, ' + def + ' defending.');
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

  // The result goes back into the world. A winning attacker takes the province with what it has left. Otherwise the
  // defenders keep what is left, and the attackers that are left go home: to the province they came from (a battle you
  // ordered), or to their nation's field army (a fight that was already on the province).
  U.apply = function (w, result) {
    var b = w.battle;
    if (!b) return null;
    var a = w.provs[b.from], d = w.provs[b.to];
    var attLeft = Math.max(0, Math.round(result.pool.attacker)), defLeft = Math.max(0, Math.round(result.pool.defender));
    var won = result.winner === 'attacker' && d.owner === b.defender;
    if (won) {
      W.capture(w, d, b.attacker, attLeft);
      W.log(w, W.ownerName(w, b.attacker) + ' wins the battle and takes ' + W.aLabel(d.tier) + ' (' + attLeft + ' soldiers hold it).');
    } else {
      d.gar = defLeft;
      if (!b.fight && a.owner === b.attacker) a.gar = (a.gar || 0) + attLeft;
      else w.nations[b.attacker].soldiers += attLeft;
      W.log(w, W.ownerName(w, b.defender) + ' holds ' + W.aLabel(d.tier) + ' (' + defLeft + ' left). ' + attLeft + ' attackers fall back.');
    }
    w.battles.push({
      id: b.id, turn: w.time.turn, from: b.from, prov: b.to, attacker: b.attacker, defender: b.defender,
      count: b.count, defCount: b.defCount, winner: result.winner, how: result.how, seconds: result.seconds,
      left: { attacker: attLeft, defender: defLeft }, seed: b.request.seed, orders: b.commands.length, fight: !!b.fight
    });
    while (w.battles.length > W.CONFIG.BATTLES_KEPT) w.battles.shift();
    w.battle = null;
    XW.country.checkFallen(w);
    XW.country.updateNeighbours(w);
    return won;
  };
})();
