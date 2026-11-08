// Expansion Wars (combined) — province scale rules: real-time garrisons and marches on the world's provinces.
// Garrisons (p.gar) grow from the owner's field army, and soldiers march along roads (world.marches). Marches are
// slowed and shot at by enemy fortress towers. An army that reaches an enemy province starts a fight (p.fight): it is
// fought in risk-style dice rounds (world seconds, see P.fights). You can join that fight at any time as a battle at
// unit scale (unit/bridge.js startFight). A capture goes through the shared rule (world/rules.js capture).
// Soldiers that reach an ally are a donation to that ally's garrison.
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world, bus = XW.core.bus;
  function K() { return P.CONFIG; }

  function marchLen(w, m) {
    var a = w.provs[m.from], b = w.provs[m.to];
    return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  }
  // Where a march is now, in map units.
  P.marchAt = function (w, m) {
    var a = w.provs[m.from], b = w.provs[m.to];
    return { x: a.x + (b.x - a.x) * m.p, y: a.y + (b.y - a.y) * m.p };
  };

  function spawn(w, owner, from, to, count, route) {
    var m = { id: (w.nextMarch = (w.nextMarch || 0) + 1), owner: owner, from: from, to: to, count: count, p: 0, route: route || [] };
    w.marches.push(m);
    return m;
  }

  // Send pct % of a province's garrison to another province, along roads through your own provinces, at most MOVE_HOPS.
  // Returns a message when it cannot, or null when the soldiers are on their way.
  P.send = function (w, win, owner, from, to, pct) {
    var a = w.provs[from], b = w.provs[to];
    if (!a || a.owner !== owner) return 'Send from one of your own provinces.';
    var why = W.whyNot(w, owner, b);
    if (why) return why;
    var path = P.routeTo(w, win, from, to, owner);
    if (!path) return 'No road there through your own provinces.';
    if (path.length > W.CONFIG.MOVE_HOPS) return 'Too far: an army moves up to ' + W.CONFIG.MOVE_HOPS + ' provinces a turn.';
    var have = Math.floor(a.gar || 0);
    var count = Math.min(have, Math.max(2, Math.floor(have * pct / 100)));
    if (count < 1) return 'No soldiers in that province. Muster some from the field army first.';
    a.gar -= count;
    spawn(w, owner, from, path[0], count, path.slice(1));
    return null;
  };

  // Move soldiers between the field army (nation.soldiers) and one of your garrisons. amount > 0 musters (once per
  // province per turn), < 0 releases.
  P.muster = function (w, owner, id, amount) {
    var p = w.provs[id], n = w.nations[owner];
    if (!p || p.owner !== owner) return 'Pick one of your own provinces.';
    if (amount > 0) {
      if (p.musterTurn === w.time.turn) return 'You can muster into this province once a turn.';
      var take = Math.min(amount, Math.floor(n.soldiers));
      if (take < 1) return 'The field army is empty.';
      n.soldiers -= take; p.gar = (p.gar || 0) + take; p.musterTurn = w.time.turn;
    } else {
      var back = Math.min(-amount, Math.floor(p.gar || 0));
      if (back < 1) return 'No soldiers in that province.';
      p.gar -= back; n.soldiers += back;
    }
    return null;
  };

  // Soldiers arrive. Own land or an ally's: join the garrison (on, if the march has further to go). Enemy or neutral land:
  // they start a fight. Land you may no longer enter (a ceasefire): they go home.
  function arrive(w, m) {
    var p = w.provs[m.to];
    m.done = true;
    var friendly = p.owner === m.owner || (p.owner >= 0 && W.rel(w, m.owner, p.owner).ally);
    if (friendly) {
      if (m.route.length) { spawn(w, m.owner, p.id, m.route[0], m.count, m.route.slice(1)); return; }
      p.gar = (p.gar || 0) + m.count;
      if (p.owner !== m.owner) W.log(w, 'Soldiers of ' + W.ownerName(w, m.owner) + ' join the garrison of ' + W.ownerName(w, p.owner) + ' (a gift to an ally).');
      return;
    }
    if (!W.mayEnter(w, m.owner, p)) { w.nations[m.owner].soldiers += m.count; return; }
    startFight(w, p, m);
  }

  // Attackers reach a province: they join a fight already there, or start one. Fights resolve in rounds (P.fights).
  function startFight(w, p, m) {
    if (p.fight) {
      p.fight.count += m.count;
      if (p.fight.a0 !== undefined) p.fight.a0 += m.count;    // a phased fight already under way: the waves grow too
      W.log(w, m.count + ' more soldiers of ' + W.ownerName(w, m.owner) + ' join the fight at ' + W.aLabel(p.tier) + '.');
      return;
    }
    p.fight = { owner: m.owner, count: m.count, from: m.from, t: 0, rounds: 0 };
    W.log(w, W.ownerName(w, m.owner) + ' attacks ' + W.aLabel(p.tier) + ' of ' + W.ownerName(w, p.owner) + ' with ' + Math.floor(m.count) + ' soldiers.');
    bus.emit('fight:new', { prov: p.id, you: p.owner === w.you || m.owner === w.you });
  }

  // ---- risk-style fights --------------------------------------------------------------------------------------------
  // Each round every soldier goes once: each attacker and each defender rolls a die. The dice are paired from the
  // highest down, as many pairs as the smaller side has. A pair the attacker wins costs the defender one soldier, and a
  // pair the defender wins (ties too) costs the attacker one. So a round costs as many soldiers as there are pairs, and
  // a big fight is settled in a few rounds, not one soldier at a time.
  function roll(n, bonus) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(1 + Math.floor(Math.random() * 6) + (bonus || 0));
    return out.sort(function (a, b) { return b - a; });
  }
  function round(w, p) {
    if (W.CONFIG.FIGHT_MODEL === 'phased') return phasedRound(w, p);
    return riskRound(w, p);
  }
  function riskRound(w, p) {
    var f = p.fight, A = f.count, D = p.gar || 0;
    var na = Math.floor(A), nd = Math.floor(D);
    if (nd === 0) return takeFight(w, p);
    var ra = roll(na), rd = roll(nd);
    for (var i = 0; i < Math.min(na, nd); i++) {
      if (ra[i] > rd[i]) D -= 1; else A -= 1;
    }
    f.count = Math.max(0, A);
    p.gar = Math.max(0, D);
    f.rounds = (f.rounds || 0) + 1;
    if (f.count < 1) {
      p.fight = null;
      W.log(w, W.ownerName(w, p.owner) + ' holds ' + W.aLabel(p.tier) + ' against ' + W.ownerName(w, f.owner) + '.');
      return;
    }
    if (p.gar < 1) takeFight(w, p);
  }
  // ---- phased fights (province battles) -----------------------------------------------------------------------------
  // See PHASED in config.js. Each turn the next wave of each army fights, its dice helped or hurt by morale; the casualties
  // move morale, which decides how the next turn goes.
  function PH() { return K().PHASED; }
  function status(m) { return m >= PH().FORM ? 'formed' : m >= PH().ROUT ? 'wavering' : 'routing'; }
  var WORD = { formed: 'in formation', wavering: 'wavering', routing: 'routing' };
  function clamp(m) { return Math.max(0, Math.min(100, m)); }

  function phasedRound(w, p) {
    var c = PH(), f = p.fight, i = Math.min(f.phase || 0, c.WAVES.length - 1), last = i === c.WAVES.length - 1;
    if (f.a0 === undefined) {                       // the first turn: the armies and their morale are fixed
      f.a0 = f.count; f.d0 = p.gar || 0;
      f.mA = c.START; f.mD = clamp(c.START + c.DEF_BONUS * XW.country.featureDef(w, p));
    }
    var A = Math.floor(f.count), D = Math.floor(p.gar || 0);
    if (A < 1) return holdFight(w, p, f);
    if (D < 1) return takeFight(w, p);
    var ea = Math.min(A, Math.ceil(c.WAVES[i] * f.a0)), ed = Math.min(D, Math.ceil(c.WAVES[i] * f.d0));
    var sa = status(f.mA), sd = status(f.mD), lostA = 0, lostD = 0;
    // Each soldier in a wave kills KILL of the enemy wave, more with morale and a little at random. A routing wave kills
    // none and is cut down as it runs. Both sides strike at once, and neither can lose more than its wave.
    function strike(n, m, mood) { return mood === 'routing' ? 0 : n * c.KILL * (c.EFF_BASE + m / 100) * (1 + c.NOISE * (2 * Math.random() - 1)); }
    lostD = Math.round(strike(ea, f.mA, sa));
    lostA = Math.round(strike(ed, f.mD, sd));
    if (sa === 'routing' && sd !== 'routing') lostA += Math.ceil(c.ROUT_LOSS * ea);
    if (sd === 'routing' && sa !== 'routing') lostD += Math.ceil(c.ROUT_LOSS * ed);
    lostA = Math.min(lostA, ea); lostD = Math.min(lostD, ed);
    f.count = Math.max(0, f.count - lostA);
    p.gar = Math.max(0, (p.gar || 0) - lostD);
    var cA = ea ? lostA / ea : 0, cD = ed ? lostD / ed : 0;
    f.mA = clamp(f.mA + c.SWING[i] * (cD - cA));
    f.mD = clamp(f.mD + c.SWING[i] * (cA - cD));
    f.phase = i + 1;
    f.rounds = (f.rounds || 0) + 1;
    if (f.count < 1) return holdFight(w, p, f);
    if (p.gar < 1) return takeFight(w, p);
    if (last) {                                     // three turns done: the side with more left, weighted by morale, wins
      if (f.count * (f.mA + 50) > (p.gar || 0) * (f.mD + 50)) takeFight(w, p); else holdFight(w, p, f);
    }
  }

  // The defenders hold. Attackers still alive withdraw to the province they came from (or their field army).
  function holdFight(w, p, f) {
    p.fight = null;
    var left = Math.floor(f.count);
    if (left >= 1) {
      var src = w.provs[f.from];
      if (src && src.owner === f.owner) src.gar = (src.gar || 0) + left; else w.nations[f.owner].soldiers += left;
    }
    W.log(w, W.ownerName(w, p.owner) + ' holds ' + W.aLabel(p.tier) + ' against ' + W.ownerName(w, f.owner) + (left >= 1 ? ' (' + left + ' attackers withdraw).' : '.'));
  }

  // The attackers take the province with what is left of them.
  function takeFight(w, p) {
    var f = p.fight, before = p.owner;
    p.fight = null;
    W.capture(w, p, f.owner, f.count);
    W.log(w, W.ownerName(w, f.owner) + ' takes ' + W.aLabel(p.tier) + ' from ' + W.ownerName(w, before) + '.');
    XW.country.checkFallen(w);
    XW.country.checkWin(w);
    XW.country.updateNeighbours(w);
  }

  // Runs the fights for `dt` world seconds (the caller passes real time times the scale's rate) and `real` real seconds
  // (phased fights keep real time). Runs in every scale, so a fight resolves whether or not you are looking at it.
  P.fights = function (w, dt, real) {
    if (real === undefined) real = dt;
    if (!(dt > 0) && !(real > 0)) return;
    var phased = W.CONFIG.FIGHT_MODEL === 'phased';
    w.provs.forEach(function (p) {
      if (!p.fight) return;
      var len = phased ? PH().ROUND : W.CONFIG.FIGHT_ROUND;
      p.fight.t = (p.fight.t || 0) + (phased ? real : dt);
      while (p.fight && p.fight.t >= len) {
        p.fight.t -= len;
        round(w, p);
      }
    });
  };

  // One line for a fight, read live: the two sides, the round, and the real seconds to the next round.
  P.fightLine = function (w, p) {
    var f = p.fight;
    if (!f) return '';
    if (W.CONFIG.FIGHT_MODEL === 'phased') {
      var left = Math.max(0, PH().ROUND - (f.t || 0)), turn = Math.min(f.phase || 0, PH().WAVES.length - 1) + 1;
      var mood = function (m) { return m === undefined ? '' : ' (' + WORD[status(m)] + ')'; };
      return 'turn ' + turn + ' of ' + PH().WAVES.length + ' in ' + Math.ceil(left) + ' s · attackers ' + Math.floor(f.count) + mood(f.mA) +
        ' · defenders ' + Math.floor(p.gar || 0) + mood(f.mD);
    }
    var rate = W.rateFor(w, w.view.scale);
    var next = Math.max(0, (W.CONFIG.FIGHT_ROUND - (f.t || 0)) / rate);
    return 'attackers ' + Math.floor(f.count) + ' · defenders ' + Math.floor(p.gar || 0) + ' · round ' + ((f.rounds || 0) + 1) + ' in ' + Math.ceil(next) + ' s';
  };

  // Enemy fortress towers in range slow a march to SLOW of its speed and shoot it. Returns the speed factor.
  function towers(w, m, dt) {
    var at = P.marchAt(w, m), dmg = 0, slowed = false;
    w.provs.forEach(function (f) {
      if (f.kind !== 'province' || f.tier !== 'f' || f.owner < 0 || f.owner === m.owner || !W.rel(w, f.owner, m.owner).war) return;
      var range = K().FORT.range * (f.tower === 2 ? K().FORT.upgradedMul : 1);
      if (Math.hypot(f.x - at.x, f.y - at.y) <= range) { slowed = true; dmg += K().FORT.dmg; }
    });
    if (dmg) m.count -= dmg * dt;
    if (m.count <= 0) m.done = true;
    return slowed ? K().FORT.slow : 1;
  }

  // Two marches facing each other on the same road fight when they meet; the larger keeps the difference.
  function clashOnRoads(w) {
    var live = w.marches.filter(function (m) { return !m.done; });
    for (var i = 0; i < live.length; i++) {
      for (var j = i + 1; j < live.length; j++) {
        var a = live[i], b = live[j];
        if (a.done || b.done || a.owner === b.owner) continue;
        if (a.from !== b.to || a.to !== b.from || a.p + b.p < 1) continue;
        var diff = a.count - b.count;
        if (diff > 0) { a.count = diff; b.done = true; }
        else if (diff < 0) { b.count = -diff; a.done = true; }
        else { a.done = true; b.done = true; }
      }
    }
  }

  // Garrisons grow from the field army, up to the tier's cap. Neutral land does not grow at province scale.
  function grow(w, win, dt) {
    win.ids.forEach(function (id) {
      var p = w.provs[id];
      if (p.owner < 0) return;
      var n = w.nations[p.owner], cap = K().CAP[p.tier] || 10;
      if ((p.gar || 0) >= cap || n.soldiers < 1) return;
      var add = Math.min(K().GROW[p.tier] * dt, cap - (p.gar || 0), n.soldiers);
      p.gar = (p.gar || 0) + add;
      n.soldiers -= add;
    });
  }

  // Province battles have no country turns, so soldiers join each nation's field army here instead: RECRUIT a second for
  // each province it holds, by its tier, up to its army cap. (In the campaign the country turn does this.)
  P.recruit = function (w, dt) {
    var C = XW.country, rate = {};
    w.provs.forEach(function (p) { if (p.kind === 'province' && p.owner >= 0) rate[p.owner] = (rate[p.owner] || 0) + (K().RECRUIT[p.tier] || 0); });
    w.nations.forEach(function (n) {
      if (!n.alive) return;
      var room = C.armyCap(w, n) - C.garrisons(w, n) - n.soldiers;
      if (room > 0) n.soldiers += Math.min(room, (rate[n.id] || 0) * dt);
    });
  };

  // One step of province time (dt real seconds) inside the window. opts.grow false: marches only (used when settling).
  P.step = function (w, win, dt, opts) {
    if (!win) return;
    if (!opts || opts.grow !== false) grow(w, win, dt);
    w.marches.forEach(function (m) {
      if (m.done) return;
      var slow = towers(w, m, dt);
      if (m.done) return;
      var speed = K().SPEED * slow * (P.riverBetween(w, m.from, m.to) ? K().RIVER_SLOW : 1);
      m.p += speed * dt / marchLen(w, m);
    });
    clashOnRoads(w);
    w.marches.slice().forEach(function (m) { if (!m.done && m.p >= 1) arrive(w, m); });
    w.marches = w.marches.filter(function (m) { return !m.done; });
  };

  // Leaving the province: every march finishes at once, so no soldiers are left on a road the country map cannot show.
  P.settle = function (w, win) {
    for (var i = 0; i < 2000 && w.marches.length; i++) P.step(w, win, K().SETTLE_STEP, { grow: false });
    w.marches.forEach(function (m) { w.nations[m.owner].soldiers += m.count; });   // anything still out goes home
    w.marches = [];
  };

  // Soldiers on the road, by owner (for the population line).
  P.marching = function (w, owner) {
    return w.marches.reduce(function (s, m) { return s + (m.owner === owner ? m.count : 0); }, 0);
  };
})();
