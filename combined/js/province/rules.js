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
    if (w.countdown > 0) return 'Wait for Go.';
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
    if (W.CONFIG.FIGHT_MODEL === 'risk') return riskRound(w, p);
    return waveFightRound(w, p);
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

  // ---- grades: how strong a province is ------------------------------------------------------------------------------
  // 0 empty dot, 1 village, 2 town, 3 city, 4 fortress, 5 fortress with an upgraded tower; a half upgrade adds 0.5.
  P.grade = function (w, p) {
    if (p.tier === 'f' && (p.tower === 2 || p.up)) return 5;
    return W.TIERS[p.tier].rank + (p.up ? 0.5 : 0);
  };
  // A number from the GRADE table, read between the two grades either side of g.
  P.stat = function (name, g) {
    var t = K().GRADE[name], lo = Math.max(0, Math.min(t.length - 1, Math.floor(g))), hi = Math.min(t.length - 1, lo + 1);
    return t[lo] + (t[hi] - t[lo]) * (g - lo);
  };
  // The grade a province defends at. A split of a bigger province defends at the bigger province's grade, but only for the
  // nation that holds the whole of it; whoever takes part of it gets that protection only once it has taken all of it.
  P.defGrade = function (w, p) {
    var g = P.grade(w, p), top = p.group !== undefined && p.group !== p.id ? w.provs[p.group] : null;
    if (top && top.holder === p.owner) g = Math.max(g, P.grade(w, top));
    return g;
  };
  P.cap = function (w, p) { return P.stat('CAP', P.grade(w, p)); };

  // A half upgrade, bought with the province's own soldiers: half the next grade's cap. Once per province. A fortress's
  // upgrade is its tower. Returns a message, or null.
  P.upgradeCost = function (w, p) { return Math.ceil(P.stat('CAP', Math.min(5, Math.floor(P.grade(w, p)) + 1)) / 2); };
  P.upgrade = function (w, owner, id) {
    var p = w.provs[id];
    if (!p || p.kind !== 'province' || p.owner !== owner) return 'Upgrade one of your own provinces.';
    if (p.up || P.grade(w, p) >= 5) return 'This province is already upgraded.';
    var cost = P.upgradeCost(w, p);
    if ((p.gar || 0) < cost) return 'An upgrade here costs ' + cost + ' soldiers from this province.';
    p.gar -= cost;
    p.up = true;
    if (p.tier === 'f') p.tower = 2;
    W.log(w, W.ownerName(w, owner) + ' upgrades ' + W.aLabel(p.tier) + ' (' + cost + ' soldiers).');
    return null;
  };

  // ---- wave fights -----------------------------------------------------------------------------------------------------
  // One round between the soldiers each side commits (a attackers, d defenders) on ground of protection def, see FIGHT in
  // config.js. shA and shD: how shaken each side is from earlier routs (1 is steady). Pure, so it can be tested on its own.
  P.waveRound = function (a, d, def, shA, shD, rnd) {
    var c = K().FIGHT, r = rnd || Math.random;
    var aliveA = a, aliveD = d, lostA = 0, lostD = 0, routA = false, routD = false;
    c.STRIKES.forEach(function (s) {
      if (aliveA <= 0 || aliveD <= 0) return;
      var noise = 1 + c.NOISE * (2 * r() - 1), k;
      if (s[0] === 'a') {
        k = Math.min(aliveD, Math.min(aliveA, s[1] * a) * c.KILL_A * (1 - def) * (shA || 1) * (routA ? c.ROUT_STRIKE : 1) * noise);
        aliveD -= k; lostD += k;
        if (lostD >= c.BREAK * d) routD = true;
      } else {
        k = Math.min(aliveA, Math.min(aliveD, s[1] * d) * c.KILL_D * (1 + def) * (shD || 1) * (routD ? c.ROUT_STRIKE : 1) * noise);
        aliveA -= k; lostA += k;
        if (lostA >= c.BREAK * a) routA = true;
      }
    });
    return { lostA: lostA, lostD: lostD, routA: routA, routD: routD };
  };

  function waveFightRound(w, p) {
    var c = K().FIGHT, f = p.fight;
    if (f.a0 === undefined) {                       // the first round: the armies, and how many rounds the ground gives
      f.a0 = f.count; f.d0 = p.gar || 0;
      f.n = Math.round(P.stat('ROUNDS', P.defGrade(w, p)));
      f.shA = 1; f.shD = 1;
    }
    var A = f.count, D = p.gar || 0;
    if (A < 1) return holdFight(w, p, f);
    if (D < 1) return takeFight(w, p);
    var last = (f.rounds || 0) >= f.n - 1;
    var ca = last ? A : Math.min(A, f.a0 / f.n), cd = last ? D : Math.min(D, f.d0 / f.n);   // the last round commits everyone
    var r = P.waveRound(ca, cd, P.stat('DEF', P.defGrade(w, p)), f.shA, f.shD);
    f.count = Math.max(0, A - r.lostA);
    p.gar = Math.max(0, D - r.lostD);
    if (r.routA) f.shA = Math.max(0.5, f.shA * c.SHAKEN);
    if (r.routD) f.shD = Math.max(0.5, f.shD * c.SHAKEN);
    f.routA = r.routA; f.routD = r.routD;
    f.rounds = (f.rounds || 0) + 1;
    if (f.count < 1) return holdFight(w, p, f);
    if (p.gar < 1) return takeFight(w, p);
    // A routed side that is hopelessly outnumbered breaks, and the fight is over now.
    var def = P.stat('DEF', P.defGrade(w, p)), strA = f.count * (1 - def), strD = p.gar * (1 + def);
    if (r.routD && strA >= c.OVERWHELM * strD) { W.log(w, 'The defenders of ' + W.aLabel(p.tier) + ' break and run.'); p.gar = 0; return takeFight(w, p); }
    if (r.routA && strD >= c.OVERWHELM * strA) return holdFight(w, p, f);
    if (last) holdFight(w, p, f);                   // everyone has fought and the defenders still stand: they hold
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

  // A province split into parts (province battles) has a holder: the nation that holds every part. Taking the last part
  // makes the taker the holder, and with it the protection of the whole.
  P.claimGroup = function (w, p) {
    if (p.group === undefined) return;
    var parts = w.provs.filter(function (q) { return q.group === p.group; });
    if (parts.every(function (q) { return q.owner === p.owner; })) w.provs[p.group].holder = p.owner;
  };

  // The attackers take the province with what is left of them.
  function takeFight(w, p) {
    var f = p.fight, before = p.owner;
    p.fight = null;
    W.capture(w, p, f.owner, f.count);
    P.claimGroup(w, p);
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
    var realClock = W.CONFIG.FIGHT_CLOCK === 'real';
    w.provs.forEach(function (p) {
      if (!p.fight) return;
      var len = realClock ? W.CONFIG.FIGHT_SECONDS : W.CONFIG.FIGHT_ROUND;
      p.fight.t = (p.fight.t || 0) + (realClock ? real : dt);
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
    if (W.CONFIG.FIGHT_MODEL === 'waves') {
      var len = W.CONFIG.FIGHT_CLOCK === 'real' ? W.CONFIG.FIGHT_SECONDS : W.CONFIG.FIGHT_ROUND;
      var secs = Math.max(0, (len - (f.t || 0)) / (W.CONFIG.FIGHT_CLOCK === 'real' ? 1 : W.rateFor(w, w.view.scale)));
      var n = f.n || Math.round(P.stat('ROUNDS', P.defGrade(w, p)));
      var mood = function (rout, sh) { return rout ? ' (routing)' : sh < 1 ? ' (shaken)' : ''; };
      return 'round ' + Math.min(n, (f.rounds || 0) + 1) + ' of ' + n + ' in ' + Math.ceil(secs) + ' s · attackers ' + Math.floor(f.count) + mood(f.routA, f.shA || 1) +
        ' · defenders ' + Math.floor(p.gar || 0) + mood(f.routD, f.shD || 1);
    }
    var rate = W.rateFor(w, w.view.scale);
    var next = Math.max(0, (W.CONFIG.FIGHT_ROUND - (f.t || 0)) / rate);
    return 'attackers ' + Math.floor(f.count) + ' · defenders ' + Math.floor(p.gar || 0) + ' · round ' + ((f.rounds || 0) + 1) + ' in ' + Math.ceil(next) + ' s';
  };

  // How far a fortress tower shoots. Upgraded, its range doubles; a fortress split into parts (province battles) with an
  // upgraded tower in the middle reaches every part of itself.
  P.towerRange = function (w, f) {
    var up = f.tower === 2 || f.up, range = K().FORT.range * (up ? K().FORT.upgradedMul : 1);
    if (up && f.group === f.id) {
      w.provs.forEach(function (q) { if (q.group === f.id) range = Math.max(range, Math.hypot(q.x - f.x, q.y - f.y) + 12); });
    }
    return range;
  };

  // Enemy fortress towers in range slow a march to SLOW of its speed and shoot it. Returns the speed factor.
  function towers(w, m, dt) {
    var at = P.marchAt(w, m), dmg = 0, slowed = false;
    w.provs.forEach(function (f) {
      if (f.kind !== 'province' || f.tier !== 'f' || f.owner < 0 || f.owner === m.owner || !W.rel(w, f.owner, m.owner).war) return;
      var range = P.towerRange(w, f);
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
      if (W.CONFIG.POOL === false) {                  // province battles: a province grows its own soldiers, by its grade
        var g = P.grade(w, p), top = P.stat('CAP', g);
        if ((p.gar || 0) < top) p.gar = Math.min(top, (p.gar || 0) + P.stat('GROW', g) * dt);
        return;
      }
      if ((p.gar || 0) >= cap || n.soldiers < 1) return;
      var add = Math.min(K().GROW[p.tier] * dt, cap - (p.gar || 0), n.soldiers);
      p.gar = (p.gar || 0) + add;
      n.soldiers -= add;
    });
  }

  // Surrender (province battles, when it is on in ⚙️, as in the first draft): a side outnumbered SURRENDER to one by the
  // strongest side gives up. Its provinces go neutral with the soldiers in them. A side is a nation and its allies.
  // Returns the nations that gave up.
  P.surrender = function (w) {
    var alive = w.nations.filter(function (n) { return n.alive; }), power = {};
    w.provs.forEach(function (p) {
      if (p.kind === 'province' && p.owner >= 0) power[p.owner] = (power[p.owner] || 0) + (p.gar || 0);
      if (p.fight) power[p.fight.owner] = (power[p.fight.owner] || 0) + p.fight.count;
    });
    w.marches.forEach(function (m) { power[m.owner] = (power[m.owner] || 0) + m.count; });
    var sides = [], seen = {};
    alive.forEach(function (n) {
      if (seen[n.id]) return;
      var side = alive.filter(function (k) { return k.id === n.id || W.rel(w, n.id, k.id).ally; }).map(function (k) { return k.id; });
      side.forEach(function (id) { seen[id] = true; });
      sides.push({ ids: side, power: side.reduce(function (s, id) { return s + (power[id] || 0); }, 0) });
    });
    var top = Math.max.apply(null, sides.map(function (s) { return s.power; }));
    var gave = [];
    sides.forEach(function (s) {
      if (sides.length < 2 || s.power * K().SURRENDER >= top) return;
      s.ids.forEach(function (id) {
        w.provs.forEach(function (p) {
          if (p.owner === id) p.owner = -1;
          if (p.fight && p.fight.owner === id) p.fight = null;
        });
        w.marches.forEach(function (m) { if (m.owner === id) m.done = true; });
        w.nations[id].alive = false;
        gave.push(id);
        W.log(w, w.nations[id].name + ' gives up, outnumbered ' + K().SURRENDER + ' to 1. Its provinces are neutral now.');
      });
    });
    if (gave.length) {
      w.marches = w.marches.filter(function (m) { return !m.done; });
      XW.country.checkWin(w);
    }
    return gave;
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
