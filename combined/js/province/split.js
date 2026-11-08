// Expansion Wars (combined) — province battles: big provinces split into parts. Zoomed in, a town is two provinces, a
// city three and a fortress five (SPLITS in config.js): the settlement itself in the middle and villages around it. Every
// part defends at the settlement's grade for the nation that holds all of it (P.defGrade), so a big place cannot be taken
// in one go. An upgraded fortress tower in the middle reaches every part (P.towerRange).
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world, G = XW.core.geom;
  function K() { return P.CONFIG; }

  P.splitProvinces = function (w) {
    var rnd = XW.core.rng((w.seed || 1) + 31), base = w.provs.slice(), added = 0;
    base.forEach(function (p) {
      var k = (K().SPLITS[p.tier] || 1) - 1;
      if (p.kind !== 'province' || k < 1 || p.group !== undefined || !p.cell) return;
      var near = Infinity;
      base.forEach(function (q) { if (q !== p) near = Math.min(near, Math.hypot(q.x - p.x, q.y - p.y)); });
      var a0 = rnd() * Math.PI * 2;
      p.group = p.id;
      p.holder = p.owner;
      for (var j = 0; j < k; j++) {
        var ang = a0 + 2 * Math.PI * j / k, r = near * 0.42, spot = null;
        for (var t = 0; t < 4 && !spot; t++, r *= 0.7) {
          var c = { x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r };
          if (G.inPoly(c, p.cell)) spot = c;
        }
        if (!spot) continue;
        w.provs.push({
          id: 0, kind: 'province', owner: p.owner, home: p.home, x: Math.round(spot.x * 10) / 10, y: Math.round(spot.y * 10) / 10,
          tier: 'v', origTier: 'v', def: p.def, gar: p.owner >= 0 ? 10 : 8 + Math.floor(rnd() * 8),
          occ: 0, lostTurn: -99, lostFrom: -1, cell: null, adj: [], adjRiver: [], mount: false, river: false, group: p.id
        });
        added++;
      }
    });
    if (added) XW.country.reshape(w);
    return added;
  };
})();
