// Expansion Wars (combined) — the rules every scale shares: what a province tier is, who may attack whom, and what
// happens when a province changes hands. A capture at country, province or unit scale goes through capture() below,
// so the three scales cannot disagree about it.
(function () {
  'use strict';
  var W = window.XW.world;

  // Province tiers, from an empty dot to a fortress. down: the tier a captured province drops to.
  // settlement: the walled place a battle there is fought around (unit engine settlement names).
  W.TIERS = {
    e: { label: 'empty dot', icon: '', rank: 0, down: 'e', settlement: 'none' },
    v: { label: 'village', icon: '🍄', rank: 1, down: 'v', settlement: 'none' },   // villages have no settlement wall
    t: { label: 'town', icon: '🏘️', rank: 2, down: 'v', settlement: 'town' },
    c: { label: 'city', icon: '🏰', rank: 3, down: 't', settlement: 'city' },
    f: { label: 'fortress', icon: '🏯', rank: 4, down: 'c', settlement: 'fortress' }
  };
  // A captured province is occupied for this many turns: it produces less and may revolt back to its old owner.
  W.OCCUPIED_TURNS = 10;

  W.label = function (tier) { return (W.TIERS[tier] || W.TIERS.e).label; };
  // The label with 'a' or 'an': 'a village', 'an empty dot'.
  W.aLabel = function (tier) { var l = W.label(tier); return (/^[aeiou]/.test(l) ? 'an ' : 'a ') + l; };

  // May owner `a` send soldiers into province p? Into its own land, neutral land, and the land of a nation it is at war with.
  W.mayEnter = function (w, a, p) {
    if (!p || p.kind !== 'province') return false;
    if (p.owner === a || p.owner < 0) return true;
    var r = W.rel(w, a, p.owner);
    return r.war || r.ally;   // an ally's land takes soldiers as a donation to its garrison
  };
  // Why owner a may not attack province p, or null when it may.
  W.whyNot = function (w, a, p) {
    if (!p || p.kind !== 'province') return 'That is not a province.';
    if (p.owner === a) return null;
    if (p.owner < 0) return null;
    var r = W.rel(w, a, p.owner);
    if (r.ally) return null;   // allies take soldiers as a donation
    if (!r.war) return 'You are at peace with ' + w.nations[p.owner].name + '. Declare war on the country map first.';
    return null;
  };

  // The one capture rule. Province p goes to nation `to`, holding `gar` soldiers.
  // Taking neutral land keeps its grade. Taking a nation's land drops it one grade and leaves it occupied for a while.
  W.capture = function (w, p, to, gar) {
    var before = p.owner;
    if (before < 0) {
      p.home = to.id !== undefined ? to.id : to;
      p.origTier = p.tier;
      p.occ = 0;
    } else {
      if (!p.occ) { p.home = before; p.origTier = p.tier; }
      p.lostFrom = before;
      p.lostTurn = w.time.turn;
      p.tier = W.TIERS[p.tier].down;
      p.occ = W.OCCUPIED_TURNS;
    }
    p.owner = to.id !== undefined ? to.id : to;
    p.gar = Math.max(0, gar || 0);
    return before;
  };
})();
