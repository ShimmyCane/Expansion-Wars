// Expansion Wars (combined) — country scale: what a nation may do to another, the order queue, and diplomacy.
// Orders wait in world.queue and play out together when the turn ends (country/turn.js).
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  // Why nation i cannot do `type` to nation j now (a message), or null when it can.
  C.canDo = function (w, type, i, j) {
    var a = w.nations[i], b = w.nations[j], r = W.rel(w, i, j);
    if (i === j || !a.alive || !b.alive) return 'That nation has fallen.';
    if (type === 'trade') {
      if (r.war) return 'You are at war.';
      if (r.trade) return 'Already trading.';
      if (r.rep < K().MIN_REP.trade) return 'They do not trust you enough yet.';
      if (a.gold < K().TRADE_SETUP) return 'Not enough gold (' + K().TRADE_SETUP + ') to open a trade route.';
    }
    if (type === 'ally') {
      if (r.war) return 'You are at war.';
      if (r.ally) return 'Already allied.';
      if (r.rep < K().MIN_REP.ally) return 'Not enough reputation for an alliance.';
    }
    if (type === 'ceasefire') {
      if (!r.war) return 'You are not at war.';
      if (r.rep < K().MIN_REP.ceasefire) return 'They will not talk yet.';
    }
    if (type === 'tribute' && a.gold < K().TRIBUTE) return 'Not enough gold (' + K().TRIBUTE + ').';
    if (type === 'declare' && r.war) return 'Already at war.';
    if (type === 'attack') {
      if (!r.war) return 'Declare war first.';
      if (a.soldiers < 2) return 'No soldiers to send.';
      var R = C.route(w, i, j);
      if (!R) return 'No land route.';
      if (R.dist > K().MAX_DIST) return 'Too far away: ' + R.dist + ' steps (the limit is ' + K().MAX_DIST + ').';
      var lack = C.shortfall(a, { gold: K().MARCH.gold + R.hops, food: 1 });
      if (lack) return 'Not enough ' + lack + ' for the march.';
    }
    return null;
  };

  // Claiming neutral land: the army attacks the province's garrison; winning takes it.
  C.claimCost = function (R) { return { gold: K().CLAIM.gold + R.hops, food: K().CLAIM.food + R.hops }; };
  C.canClaim = function (w, i, pid) {
    var p = w.provs[pid], a = w.nations[i];
    if (!p || p.kind !== 'province' || p.owner >= 0) return 'Already taken.';
    if (a.soldiers < 2) return 'No soldiers to send.';
    var R = C.routeProv(w, i, pid);
    if (!R) return 'No land route.';
    if (R.dist > K().MAX_DIST) return 'Too far away: ' + R.dist + ' steps (the limit is ' + K().MAX_DIST + ').';
    var lack = C.shortfall(a, C.claimCost(R));
    if (lack) return 'Not enough ' + lack + ' for the survey.';
    return null;
  };

  // The player's orders. pct is the share of the army an attack or claim sends.
  C.queueOrder = function (w, type, to, pct) {
    var err = C.canDo(w, type, w.you, to);
    if (err) return err;
    C.removeQueued(w, w.you, to);
    var item = { type: type, from: w.you, to: to };
    if (type === 'attack') item.pct = pct;
    w.queue.push(item);
    W.log(w, 'Queued: ' + type + ' with ' + w.nations[to].name + '. It plays out when the turn ends.');
    return null;
  };
  C.queueClaim = function (w, pid, pct) {
    var err = C.canClaim(w, w.you, pid);
    if (err) return err;
    if (w.queue.some(function (x) { return x.type === 'claim' && x.from === w.you && x.prov === pid; })) return null;
    w.queue.push({ type: 'claim', from: w.you, to: -1, prov: pid, pct: pct });
    W.log(w, 'Queued: claim neutral land. It plays out when the turn ends.');
    return null;
  };
  C.removeQueued = function (w, from, to) {
    w.queue = w.queue.filter(function (x) { return !(x.from === from && x.to === to); });
  };
  C.removeClaim = function (w, pid) {
    w.queue = w.queue.filter(function (x) { return !(x.type === 'claim' && x.from === w.you && x.prov === pid); });
  };

  // Apply one diplomatic order (everything but attacks and claims).
  C.applyDiplomacy = function (w, x) {
    var i = x.from, j = x.to, r = W.rel(w, i, j), a = w.nations[i], b = w.nations[j];
    var err = C.canDo(w, x.type, i, j);
    if (err) { W.log(w, a.name + ' could not ' + x.type + ' with ' + b.name + ': ' + err); return; }
    if (x.type === 'trade') {
      r.trade = true; a.gold -= K().TRADE_SETUP;
      W.log(w, a.name + ' and ' + b.name + ' open a trade route.');
    } else if (x.type === 'ally') {
      r.ally = true;
      W.log(w, a.name + ' and ' + b.name + ' agree a neutral alliance.');
    } else if (x.type === 'ceasefire') {
      r.war = false; r.truce = 10;
      W.log(w, a.name + ' and ' + b.name + ' agree a ceasefire for 10 turns.');
    } else if (x.type === 'tribute') {
      a.gold -= K().TRIBUTE; b.gold += K().TRIBUTE; r.rep = Math.min(100, r.rep + 8);
      W.log(w, a.name + ' sends ' + K().TRIBUTE + ' gold to ' + b.name + '.');
    } else if (x.type === 'declare') {
      r.war = true; r.trade = false; r.ally = false; r.rep -= 20;
      w.nations.forEach(function (k) { if (k.id !== i && k.id !== j && k.alive) W.rel(w, k.id, i).rep -= 5; });
      W.log(w, a.name + ' declares war on ' + b.name + '.');
    }
  };
})();
