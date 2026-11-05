// Expansion Wars (combined) — country scale: what a nation makes and spends each turn, unrest and revolts, neighbours.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  // A revolt returns an occupied province to its old owner, or to neutral if that owner has fallen.
  C.revolt = function (w, n) {
    var list = C.occupied(w, n);
    if (!list.length) return;
    var p = list[Math.floor(Math.random() * list.length)], home = w.nations[p.home], back = home && home.alive;
    p.owner = back ? home.id : -1;
    p.tier = p.origTier;
    p.occ = 0;
    W.log(w, n.name + ' revolts: a ' + W.label(p.tier) + (back ? ' goes back to ' + home.name + '.' : ' goes neutral.'));
    n.unrest = Math.max(0, n.unrest - 15);
  };

  // One turn of a nation's economy.
  C.economy = function (w, n) {
    var k = K(), mine = C.ownedBy(w, n), t = C.tiers(w, n);
    mine.forEach(function (p) { if (p.occ > 0) p.occ--; });
    var pf = C.prodFactor(w, n);
    var farm = mine.filter(function (p) { return p.tier !== 'e' && C.feature(w, p) === 'farm'; }).length;
    var tradeP = mine.filter(function (p) { return p.tier !== 'e' && C.feature(w, p) === 'trade'; }).length;
    var trades = C.tradeCount(w, n.id);
    // Gun or butter: recruiting runs at 0.5 + guns, food at 1.5 - guns.
    var produced = (k.FOOD.v * t.v + k.FOOD.t * t.t + k.FOOD.c * t.c + k.FOOD.f * t.f) * (1.5 - n.guns) * pf * C.agriMult(n) + 0.5 * farm;
    // Food goes first to the army (field army and garrisons), then to the people. An army the land cannot feed starves.
    var eat = (n.soldiers + C.garrisons(w, n)) * k.UPKEEP * (n.aim === 'war' ? k.WAR_UPKEEP : 1);
    n.food += produced - eat;
    if (n.food < 0) { n.soldiers *= 0.97; n.food = 0; }
    n.food -= C.population(w, n) * k.POP_EAT;
    if (n.food < 0) { n.food = 0; n.unrest = Math.min(100, n.unrest + 2); }
    // Gold is taxed from the people (fortresses pay no tax), plus trade.
    n.gold += (k.POP.v * t.v + k.POP.t * t.t + k.POP.c * t.c) * C.civMult(n) * pf + 3 * trades + 0.5 * tradeP;
    n.science += k.SCIENCE.v * t.v + k.SCIENCE.t * t.t + k.SCIENCE.c * t.c + k.SCIENCE.f * t.f;
    n.stone += t.c + trades;
    n.magic = Math.min(n.magic + k.MAGIC_PER_FORT * t.f, k.MAGIC_CAP * n.soldiers);
    // Recruiting: culture and morale draw soldiers in; thin food slows it; the army cap is hard for new recruits.
    var cover = Math.min(1, n.food / Math.max(1, n.soldiers * k.RATION));
    var recruits = (t.v + 1.5 * t.t + 2 * t.c + 2.5 * t.f) * (1 + n.morale / 200) * (1 + Math.min(n.culture, 100) / 200) * (0.5 + n.guns) * pf * cover;
    // The army cap counts the field army and the garrisons together.
    var roomForRecruits = C.armyCap(w, n) - C.garrisons(w, n);
    n.soldiers = Math.max(n.soldiers, Math.min(roomForRecruits, n.soldiers + recruits));
    if (C.atWar(w, n.id)) n.morale = Math.max(0, n.morale - 0.5);
    else { n.happy = Math.min(100, n.happy + 1); n.morale = Math.min(100, n.morale + 0.5); }
    // Unrest: long or many wars, little food, no trade and allies at war push it up. Peace with food brings it down.
    var wars = w.nations.filter(function (j) { return j.id !== n.id && j.alive && W.rel(w, n.id, j.id).war; }).length;
    n.warTurns = wars ? n.warTurns + 1 : 0;
    var allyAtWar = w.nations.filter(function (j) { return j.id !== n.id && j.alive && W.rel(w, n.id, j.id).ally && C.atWar(w, j.id); }).length;
    var up = (n.warTurns > 10 ? 1.5 : wars ? 0.5 : 0) + 0.5 * Math.max(0, wars - 1) + (n.food < 20 ? 1 : 0) + (trades === 0 ? 0.5 : 0) + 0.5 * allyAtWar;
    var down = wars === 0 && n.food >= 20 ? 1 : 0;
    n.unrest = Math.max(0, Math.min(100, n.unrest + up - down));
    if (n.unrest >= k.REVOLT_AT && C.occupied(w, n).length && Math.random() < (n.unrest >= k.REVOLT_CERTAIN ? 1 : 0.3)) C.revolt(w, n);
    n.tech = Math.min(100, n.tech + 0.5 + 0.1 * (t.c + t.f));
  };

  // A nation's neighbours are the owners of provinces next to its own.
  C.updateNeighbours = function (w) {
    w.nations.forEach(function (n) { n.nb = []; });
    w.provs.forEach(function (p) {
      p.adj.forEach(function (q) {
        var o = w.provs[q].owner;
        if (p.owner >= 0 && o >= 0 && o !== p.owner && w.nations[p.owner].nb.indexOf(o) < 0) w.nations[p.owner].nb.push(o);
      });
    });
  };
})();
