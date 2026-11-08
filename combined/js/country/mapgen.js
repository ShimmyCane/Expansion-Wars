// Expansion Wars (combined) — a new world: six nations, fifteen provinces each, neutral terrain between them, and rivers
// along province borders. The same seed gives the same map (the computer players are not seeded).
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world, G = XW.core.geom;
  function K() { return C.CONFIG; }

  function makeNation(i, p, poly) {
    return {
      id: i, name: K().NAMES[i], x: p.x, y: p.y, alive: true, neutral: i >= K().NEUTRAL_FROM, area: G.polyArea(poly), nb: [],
      soldiers: 160, tech: 10, morale: 50, happy: 50, guns: 0.5, food: 20, gold: 30, stone: 10,
      magic: 0, culture: 0, unrest: 0, warTurns: 0, aim: 'growth', science: 0, research: { agri: 0, civic: 0, arms: 0 }
    };
  }

  function provinceNode(rnd, owner, c, tier) {
    return {
      id: 0, kind: 'province', owner: owner, home: owner, x: c.x, y: c.y, tier: tier, origTier: tier,
      def: 1 + Math.floor(rnd() * 3), gar: owner < 0 ? 8 + Math.floor(rnd() * 12) : W.CONFIG.START_GAR,
      occ: 0, lostTurn: -99, lostFrom: -1, cell: null, adj: [], adjRiver: [], mount: false, river: false
    };
  }
  function terrainNode(T) {
    return {
      id: 0, kind: 'terrain', terrain: T.kind, owner: -1, home: -1, x: T.x, y: T.y, tier: 'x', origTier: 'x',
      def: 0, gar: 0, occ: 0, lostTurn: -99, lostFrom: -1, cell: null, adj: [], adjRiver: [], mount: false, river: false
    };
  }

  // Terrain seeds first; provinces keep clear of them, so every terrain cell is a patch of its own.
  function makeTerrain(range, seeds) {
    var out = [];
    Object.keys(K().TERRAIN).forEach(function (kind) {
      var T = K().TERRAIN[kind], placed = 0;
      for (var t = 0; placed < T.n && t < 4000; t++) {
        var c = { x: range(60, K().W - 60), y: range(60, K().H - 60) };
        var clear = seeds.every(function (q) { return G.dist(c, q) > 90; }) && out.every(function (q) { return G.dist(c, q) > 110; });
        if (clear) { out.push({ x: c.x, y: c.y, kind: kind, r: T.r }); placed++; }
      }
    });
    return out;
  }

  // Fifteen provinces inside a nation's region, apart from each other and clear of the terrain.
  function placeProvinces(range, region, terrain) {
    var pts = [], gap = K().PROV_GAP;
    for (var t = 0; pts.length < K().PROVS && t < 60000; t++) {
      if (t > 0 && t % 2000 === 0) gap = Math.max(20, gap * 0.9);
      var c = { x: range(0, K().W), y: range(0, K().H) };
      if (!G.inPoly(c, region)) continue;
      if (terrain.some(function (T) { return G.dist(c, T) < T.r + 10; })) continue;
      if (pts.every(function (q) { return G.dist(c, q) >= gap; })) pts.push(c);
    }
    return pts;
  }

  // Cells for every node, and which nodes touch. A province touching a mountain is on its slope.
  function geometry(w) {
    var P = w.provs, pts = P.map(function (p) { return { x: p.x, y: p.y }; });
    var cells = G.voronoi(pts, K().W, K().H);
    P.forEach(function (p, i) {
      p.cell = cells[i].map(function (q) { return { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }; });
      p.adj = []; p.adjRiver = [];
    });
    for (var a = 0; a < P.length; a++) {
      for (var b = a + 1; b < P.length; b++) {
        if (G.sharesEdge(cells[a], pts[a], pts[b])) {
          P[a].adj.push(b); P[a].adjRiver.push(false);
          P[b].adj.push(a); P[b].adjRiver.push(false);
        }
      }
    }
    P.forEach(function (p) { p.mount = p.kind === 'province' && p.adj.some(function (q) { return P[q].terrain === 'mountain'; }); });
  }

  // A river is a walk through neighbouring provinces from one edge of the map to the other.
  function riverWalk(w, rnd, range, horizontal) {
    var P = w.provs, c = horizontal ? 'x' : 'y', L = horizontal ? K().W : K().H;
    var starts = P.filter(function (p) { return p.kind === 'province' && p[c] < 140; });
    for (var tries = 0; tries < 60 && starts.length; tries++) {
      var cur = starts[Math.floor(rnd() * starts.length)], path = [cur.id], seen = {};
      seen[cur.id] = true;
      for (var s = 0; s < 40 && cur[c] < L - 140; s++) {
        var next = cur.adj.filter(function (q) { return P[q].kind === 'province' && !seen[q]; });
        if (!next.length) break;
        var pick = next.map(function (q) { return { q: q, v: P[q][c] + range(-60, 120) }; })
          .sort(function (a, b) { return b.v - a.v; })[0].q;
        seen[pick] = true; path.push(pick); cur = P[pick];
      }
      if (cur[c] >= L - 140) return path;
    }
    return null;
  }
  function makeRivers(w, rnd, range) {
    var P = w.provs;
    w.rivers = [];
    [true, false].forEach(function (horizontal) {
      var path = riverWalk(w, rnd, range, horizontal);
      if (!path) return;
      w.rivers.push(path);
      for (var s = 0; s < path.length - 1; s++) {
        var a = P[path[s]], b = P[path[s + 1]];
        a.adjRiver[a.adj.indexOf(b.id)] = true;
        b.adjRiver[b.adj.indexOf(a.id)] = true;
      }
    });
    P.forEach(function (p) { p.river = p.adjRiver.some(Boolean); });
  }

  // Works out the cells, roads and rivers again after provinces were added (province battles split big provinces).
  C.reshape = function (w) {
    var rnd = XW.core.rng((w.seed || 1) + 7919);
    function range(a, b) { return a + rnd() * (b - a); }
    w.provs.forEach(function (q, i) { q.id = i; });
    geometry(w);
    makeRivers(w, rnd, range);
    C.updateNeighbours(w);
  };

  // A complete new world, from a seed (random when none is given). opts overrides the size for the battle modes:
  // {COUNT, PROVS, START_VILLAGES, START_TOWNS, NEUTRAL_FROM}. The defaults are the campaign's.
  C.newWorld = function (seedIn, opts) {
    var k = K(), saved = {};
    Object.keys(opts || {}).forEach(function (key) { saved[key] = k[key]; k[key] = opts[key]; });
    try { return make(seedIn, !!opts); } finally { Object.keys(saved).forEach(function (key) { k[key] = saved[key]; }); }
  };

  function make(seedIn, custom) {
    var seed = seedIn || XW.core.randomSeed(), rnd = XW.core.rng(seed);
    function range(a, b) { return a + rnd() * (b - a); }
    var k = K(), seeds = [], minD = 0.55 * Math.sqrt(k.W * k.H / k.COUNT);
    for (var t = 0; seeds.length < k.COUNT && t < 4000; t++) {
      var p = { x: range(80, k.W - 80), y: range(80, k.H - 80) };
      if (seeds.every(function (q) { return G.dist(p, q) >= minD; })) seeds.push(p);
    }
    var regions = G.voronoi(seeds, k.W, k.H);
    var w = W.blank(seed);
    seeds.forEach(function (sp, i) { w.nations.push(makeNation(i, sp, regions[i])); });
    w.nations.forEach(function (n) { if (n.id !== w.you) n.aim = k.AIM_KEYS[Math.floor(Math.random() * k.AIM_KEYS.length)]; });
    var terrain = makeTerrain(range, seeds);
    w.nations.forEach(function (n) {
      var pts = placeProvinces(range, regions[n.id], terrain);
      pts.sort(function (a, b) { return G.dist(a, n) - G.dist(b, n); });
      pts.forEach(function (c, idx) {
        var held = idx < k.START_VILLAGES + k.START_TOWNS;
        var tier = idx < k.START_VILLAGES ? 'v' : held ? 't' : 'e';
        w.provs.push(provinceNode(rnd, held ? n.id : -1, c, tier));
      });
    });
    terrain.forEach(function (T) { w.provs.push(terrainNode(T)); });
    w.provs.forEach(function (q, i) { q.id = i; q.x = Math.round(q.x * 10) / 10; q.y = Math.round(q.y * 10) / 10; });
    geometry(w);
    makeRivers(w, rnd, range);
    C.updateNeighbours(w);
    if (!custom) {
      W.rel(w, 1, 2).war = true;
      W.rel(w, 1, 2).warSince = 1;
      W.log(w, 'Map seed ' + seed + '. Each nation holds two villages and a town; the rest of the land is neutral.');
      W.log(w, 'The country is at peace, except ' + k.NAMES[1] + ' and ' + k.NAMES[2] + ', who are at war.');
      W.log(w, 'Zoom into a province to fight for it in real time, and into a fight to command the battle.');
    }
    return w;
  }
})();
