// Expansion Wars (combined) — country scale: attacks between nations and claims on neutral land, resolved at once at the
// end of a turn. A province's garrison (p.gar, the soldiers the province scale stations there) joins its defence, so
// what you do in a province changes how the country war goes.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  // Take up to `count` provinces from `from`: the entry province first, then the weakest ones touching the winner's land.
  C.captureMany = function (w, from, to, entryId, count) {
    var taken = [], first = w.provs[entryId];
    function take(p) { W.capture(w, p, to.id, 0); taken.push(W.label(p.tier)); }
    if (first && first.owner === from.id && count > 0) { take(first); count--; }
    while (count > 0) {
      var cands = C.ownedBy(w, from).filter(function (p) {
        return p.adj.some(function (q) { return w.provs[q].owner === to.id; });
      });
      if (!cands.length) cands = C.ownedBy(w, from);
      if (!cands.length) break;
      cands.sort(function (p, q) { return W.TIERS[p.tier].rank - W.TIERS[q.tier].rank; });
      take(cands[0]);
      count--;
    }
    return taken;
  };

  // One nation's part of an attack: its share leaves home, is worn on the way, pays the march and spends magic.
  function sendPart(w, i, j, R, pct) {
    var a = w.nations[i], sent0 = Math.floor(a.soldiers * pct / 100);
    if (sent0 < 1) return null;
    var flat = Math.min(sent0 - 1, Math.ceil(a.unrest / 20));   // unrest costs a soldier in every 20 before the march
    var F = C.attackFactors(w, i, R);
    var sent = Math.floor((sent0 - flat) * (1 - F.chip));
    a.soldiers -= sent0;
    if (sent < 1) { W.log(w, a.name + "'s army is worn away on the way to " + w.nations[j].name + '.'); return null; }
    a.food = Math.max(0, a.food - Math.ceil(sent * K().MARCH.food));
    a.gold = Math.max(0, a.gold - (K().MARCH.gold + R.hops));
    var spent = Math.min(a.magic, sent * K().MAGIC_PER_SOLDIER);
    a.magic -= spent;
    var bonus = (1 + spent / sent) / (1 + a.unrest / 200) * (1 - F.far) * F.tail;
    return { id: i, sent: sent, strength: sent * C.quality(a) * bonus };
  }

  // An attack in three waves. Casualties split by strength. The defence is the nation's field army plus the garrison of
  // the province the attack reaches. Twice the defence means surrender: one province for each whole point of power over it.
  C.battle = function (w, x) {
    var i = x.from, j = x.to, a = w.nations[i], b = w.nations[j];
    if (!W.rel(w, i, j).war || !a.alive || !b.alive) return;
    var R = C.route(w, i, j);
    if (!R || R.dist > K().MAX_DIST) { W.log(w, a.name + ' could not reach ' + b.name + '.'); return; }
    if (w.used[i]) { W.log(w, a.name + ' is already attacking this turn.'); return; }
    var pct = x.pct || K().SEND * 100;
    var parts = [i].concat(C.joiners(w, i, j).filter(function (id) { return !w.used[id]; })).map(function (id) {
      var RR = C.route(w, id, j);
      return RR && RR.dist <= K().MAX_DIST ? sendPart(w, id, j, RR, pct) : null;
    }).filter(Boolean);
    if (!parts.length) return;
    parts.forEach(function (p) { w.used[p.id] = true; });
    var sent = parts.reduce(function (s, p) { return s + p.sent; }, 0);
    var coord = C.coordFactor(parts.length);
    // Generals of the field armies: each star of the lead general adds 5% (world/generals.js).
    var genA = W.genMul(w, a.gens, 1, W.GEN.BATTLE_STAR);
    var strength = parts.reduce(function (s, p) { return s + p.strength; }, 0) * coord * genA;
    var qa = strength / sent;
    var entry = w.provs[R.entry], front = C.featureDef(w, entry) / 2;
    var field = b.soldiers, gar = entry.gar || 0, d0 = field + gar;
    var dSpent = Math.min(b.magic, d0 * K().MAGIC_PER_SOLDIER);
    b.magic -= dSpent;
    var defBonus = 1 + (d0 > 0 ? dSpent / d0 : 0);
    if (dSpent >= 1) W.log(w, b.name + ' spends ' + Math.floor(dSpent) + ' magic on the defence.');
    var defGens = (b.gens || []).concat(entry.gens || []);
    var perDef = C.quality(b) * (1 + K().FORT_BONUS * C.count(w, b, 'f')) * K().DEFENDER * front * defBonus * W.genMul(w, defGens, 1, W.GEN.BATTLE_STAR);
    var defence = d0 * perDef, grade = C.weakestGrade(w, b);
    var pool = sent, d = d0;
    for (var k = 0; k < K().WAVES && pool >= 1 && d > 0; k++) {
      var wave = pool / (K().WAVES - k), A = wave * qa, D = d * perDef;
      pool -= wave * D / (A + D);
      d -= d * A / (A + D);
    }
    // Defenders left are shared between the field army and the garrison, as they started.
    function defendersLeft(left) {
      var f = d0 > 0 ? Math.max(0, left) / d0 : 0;
      b.soldiers = field * f;
      entry.gar = gar * f;
    }
    function home(total) { parts.forEach(function (p) { w.nations[p.id].soldiers += total * p.sent / sent; }); }
    if (parts.length > 1) {
      W.log(w, parts.map(function (p) { return w.nations[p.id].name; }).join(' and ') + ' attack ' + b.name +
        ' together, ' + Math.round((1 - coord) * 100) + '% less strength for separate command.');
    }
    var ratio = strength / Math.max(1e-9, defence), taken = [];
    if (ratio >= K().SURRENDER) {
      defendersLeft(0);
      taken = C.captureMany(w, b, a, R.entry, Math.min(C.provCount(w, b), Math.floor(ratio)));
      home(pool + Math.max(0, d));                      // the defenders who are left surrender to the winner
      W.log(w, b.name + ' surrenders to ' + a.name + (taken.length ? ', giving up ' + taken.length + ' province' + (taken.length === 1 ? '' : 's') + ' (' + taken.join(', ') + ').' : '.'));
    } else if (pool > 0 && pool * qa > d * perDef) {
      defendersLeft(d);
      b.soldiers += entry.gar;                          // the garrison's survivors fall back to the field army
      taken = C.captureMany(w, b, a, R.entry, 1);
      home(pool);
      W.log(w, a.name + ' wins against ' + b.name + (taken.length ? ' and takes a ' + taken[0] + '.' : '.'));
    } else {
      defendersLeft(d);
      home(Math.max(0, pool));
      W.log(w, b.name + ' holds against ' + a.name + '.');
    }
    if (taken.length || ratio >= K().SURRENDER) W.recordFight(w, a.gens, defGens); else W.recordFight(w, defGens, a.gens);
    var winner = taken.length ? a : b, gain = K().CULTURE[grade] * C.foodMult(winner);
    winner.culture += gain;
    W.log(w, winner.name + ' earns culture +' + gain.toFixed(1) + (taken.length ? '.' : ' for holding.'));
  };

  // A claim: the sent share fights the neutral garrison. Winning takes the province; the survivors come home.
  C.claimLand = function (w, x) {
    var i = x.from, a = w.nations[i], p = w.provs[x.prov];
    if (!a.alive || !p || p.owner >= 0) { W.log(w, a.name + ' could not claim that land: it is taken.'); return; }
    var R = C.routeProv(w, i, p.id);
    if (!R || R.dist > K().MAX_DIST) { W.log(w, a.name + ' could not reach that land.'); return; }
    var cost = C.claimCost(R);
    if (C.shortfall(a, cost)) { W.log(w, a.name + ' could not pay for the survey of that land.'); return; }
    C.spend(a, cost);
    var sent0 = Math.floor(a.soldiers * (x.pct || 50) / 100);
    if (sent0 < 1) return;
    var F = C.attackFactors(w, i, R), sent = Math.floor(sent0 * (1 - F.chip));
    a.soldiers -= sent0;
    var front = C.featureDef(w, p) / 2;
    var A = sent * C.quality(a) * (1 - F.far) * F.tail, D = p.gar * front * K().DEFENDER;
    var what = p.tier === 'e' ? 'an empty dot' : 'a ' + W.label(p.tier);
    if (A > D) {
      a.soldiers += sent * (A - D) / A;
      W.capture(w, p, i, 0);
      W.log(w, a.name + ' claims ' + what + ' from the neutral land.');
    } else {
      p.gar = Math.max(0, (D - A) / (front * K().DEFENDER));
      W.log(w, a.name + "'s claim on the neutral land fails.");
    }
  };

  // The neutral province nearest a nation's land that its army clearly beats (neutral nations need twice the strength).
  C.claimTarget = function (w, a) {
    var best = null, need = a.neutral ? 2 : 1.3;
    w.provs.forEach(function (p) {
      if (p.kind !== 'province' || p.owner >= 0) return;
      if (a.soldiers * 0.5 < need * p.gar) return;
      var R = C.routeProv(w, a.id, p.id);
      if (!R || R.dist > K().MAX_DIST || C.shortfall(a, C.claimCost(R))) return;
      var v = R.dist + p.gar / 10;
      if (!best || v < best.v) best = { id: p.id, v: v };
    });
    return best ? best.id : null;
  };
})();
