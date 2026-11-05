// Expansion Wars (combined) — province scale rules: real-time garrisons and marches on the world's provinces.
// Garrisons (p.gar) grow from the owner's field army, soldiers march along roads (world.marches), fight on arrival, and
// a capture goes through the shared rule (world/rules.js capture), so the country map changes at once.
// Province time runs only for the window you are looking at; the rest of the world moves on country turns.
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world;
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

  // Send pct % of a province's garrison to another province, along roads through your own provinces.
  // Returns a message when it cannot, or null when the soldiers are on their way.
  P.send = function (w, win, owner, from, to, pct) {
    var a = w.provs[from], b = w.provs[to];
    if (!a || a.owner !== owner) return 'Send from one of your own provinces.';
    var why = W.whyNot(w, owner, b);
    if (why) return why;
    var path = P.routeTo(w, win, from, to, owner);
    if (!path) return 'No road there through your own provinces.';
    var have = Math.floor(a.gar || 0);
    var count = Math.min(have, Math.max(2, Math.floor(have * pct / 100)));
    if (count < 1) return 'No soldiers in that province. Muster some from the field army first.';
    a.gar -= count;
    spawn(w, owner, from, path[0], count, path.slice(1));
    return null;
  };

  // Move soldiers between the field army (nation.soldiers) and one of your garrisons. amount > 0 musters, < 0 releases.
  P.muster = function (w, owner, id, amount) {
    var p = w.provs[id], n = w.nations[owner];
    if (!p || p.owner !== owner) return 'Pick one of your own provinces.';
    if (amount > 0) {
      var take = Math.min(amount, Math.floor(n.soldiers));
      if (take < 1) return 'The field army is empty.';
      n.soldiers -= take; p.gar = (p.gar || 0) + take;
    } else {
      var back = Math.min(-amount, Math.floor(p.gar || 0));
      if (back < 1) return 'No soldiers in that province.';
      p.gar -= back; n.soldiers += back;
    }
    return null;
  };

  // Soldiers arrive. Through your own province on a longer march: keep going. Your own: join the garrison.
  // Hostile: fight, and take the province if they outnumber the garrison. No longer hostile (a ceasefire): go home.
  function arrive(w, m) {
    var p = w.provs[m.to];
    m.done = true;
    if (p.owner === m.owner) {
      if (m.route.length) { spawn(w, m.owner, p.id, m.route[0], m.count, m.route.slice(1)); return; }
      p.gar = (p.gar || 0) + m.count;
      return;
    }
    if (!W.mayEnter(w, m.owner, p)) { w.nations[m.owner].soldiers += m.count; return; }
    p.gar = (p.gar || 0) - m.count;
    if (p.gar < 0) {
      var before = p.owner;
      W.capture(w, p, m.owner, -p.gar);
      W.log(w, w.nations[m.owner].name + ' takes ' + W.aLabel(p.tier) + ' from ' + W.ownerName(w, before) + ' at province scale.');
      XW.country.checkFallen(w);
      XW.country.updateNeighbours(w);
      m.captured = true;
    }
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

  // Enemy soldiers within a fortress's range stop and lose soldiers. True when the march is held this step.
  function underFire(w, win, m, dt) {
    var at = P.marchAt(w, m), dmg = 0;
    win.ids.forEach(function (id) {
      var f = w.provs[id];
      if (f.tier !== 'f' || f.owner < 0 || f.owner === m.owner || !W.rel(w, f.owner, m.owner).war) return;
      if (Math.hypot(f.x - at.x, f.y - at.y) <= K().FORT.range) dmg += K().FORT.dmg;
    });
    if (!dmg) return false;
    m.count -= dmg * dt;
    if (m.count <= 0) m.done = true;
    return true;
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

  // One step of province time (dt real seconds). opts.grow false: marches only (used when settling).
  P.step = function (w, win, dt, opts) {
    if (!win) return;
    if (!opts || opts.grow !== false) grow(w, win, dt);
    w.marches.forEach(function (m) {
      if (m.done) return;
      if (underFire(w, win, m, dt)) return;
      var speed = K().SPEED * (P.riverBetween(w, m.from, m.to) ? K().RIVER_SLOW : 1);
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
