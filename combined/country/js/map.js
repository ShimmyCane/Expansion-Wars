// Expansion Wars — Voronoi map generation.
// Each spot is a seed point; its region is the Voronoi cell around it.
// Two land regions share a road when their cells share an edge. Lakes are
// regions with no roads, so soldiers cannot pass them.
// Coordinates are in a 1000 x 640 base space. Bigger levels use a larger field
// (scale times the base), and the board scrolls over it.
(function (global) {
  'use strict';

  var W = 1000, H = 640;   // one screen, in map units
  var NODE_R = 34;         // tap/hit radius used by the game (map units)

  // rate = soldiers per second when owned; garrison = [min, max] when neutral
  var TYPES = {
    factory:  { rate: 1.0, garrison: [4, 7] },
    city:     { rate: 1.5, garrison: [13, 16] },
    fortress: { rate: 0.5, garrison: [18, 22] },
    lake:     { rate: 0,   garrison: [0, 0] }
  };

  // teams = number of teams (0 for none); a team has players / teams members.
  // scale = size of the field compared with one screen.
  var LEVELS = [
    { level: 1, name: 'Meadow',    spots: 4,  players: 2, teams: 0, lakes: 0, cities: 1, forts: 0, scale: 1 },
    { level: 2, name: 'Pond',      spots: 6,  players: 2, teams: 0, lakes: 1, cities: 2, forts: 0, scale: 1 },
    { level: 3, name: 'Creek',     spots: 8,  players: 3, teams: 0, lakes: 1, cities: 2, forts: 0, scale: 1 },
    { level: 4, name: 'Valley',    spots: 10, players: 4, teams: 2, lakes: 2, cities: 3, forts: 0, scale: 1 },
    { level: 5, name: 'Hills',     spots: 12, players: 4, teams: 0, lakes: 1, cities: 3, forts: 1, scale: 1.5 },
    { level: 6, name: 'Forest',    spots: 14, players: 4, teams: 2, lakes: 2, cities: 4, forts: 1, scale: 1.5 },
    { level: 7, name: 'Marsh',     spots: 16, players: 4, teams: 0, lakes: 2, cities: 4, forts: 2, scale: 1.5 },
    { level: 8, name: 'Canyon',    spots: 18, players: 6, teams: 3, lakes: 2, cities: 5, forts: 2, scale: 1.5 },
    { level: 9, name: 'Highlands', spots: 20, players: 6, teams: 0, lakes: 3, cities: 5, forts: 3, scale: 1.5 },
    // Levels 10 to 15: multiplayer only, denser maps on a field two screens wide.
    { level: 10, name: 'Lagoon', spots: 30, players: 4, teams: 0, lakes: 3, cities: 5,  forts: 2, scale: 2 },
    { level: 11, name: 'Tundra', spots: 34, players: 6, teams: 3, lakes: 3, cities: 6,  forts: 3, scale: 2 },
    { level: 12, name: 'Jungle', spots: 38, players: 4, teams: 2, lakes: 4, cities: 7,  forts: 3, scale: 2 },
    { level: 13, name: 'Desert', spots: 42, players: 6, teams: 0, lakes: 4, cities: 8,  forts: 4, scale: 2 },
    { level: 14, name: 'Island', spots: 46, players: 6, teams: 3, lakes: 5, cities: 9,  forts: 4, scale: 2 },
    { level: 15, name: 'Kingdom', spots: 52, players: 6, teams: 2, lakes: 6, cities: 10, forts: 5, scale: 2 }
  ];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Keep the part of polygon `poly` that is closer to a than to b.
  function clipPoly(poly, a, b) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var nx = b.x - a.x, ny = b.y - a.y;
    function side(p) { return (p.x - mx) * nx + (p.y - my) * ny; }
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var sp = side(p), sq = side(q);
      if (sp <= 0) out.push(p);
      if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
        var t = sp / (sp - sq);
        out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    return out;
  }

  function voronoi(pts, fw, fh) {
    return pts.map(function (a, i) {
      var poly = [{ x: 0, y: 0 }, { x: fw, y: 0 }, { x: fw, y: fh }, { x: 0, y: fh }];
      pts.forEach(function (b, j) { if (j !== i) poly = clipPoly(poly, a, b); });
      return poly;
    });
  }

  // Two cells share an edge when at least two of cell a's corners lie on
  // the line exactly between seeds a and b.
  function sharesEdge(poly, a, b) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var nx = b.x - a.x, ny = b.y - a.y;
    var len = Math.hypot(nx, ny) || 1;
    var on = 0;
    poly.forEach(function (p) {
      if (Math.abs(((p.x - mx) * nx + (p.y - my) * ny) / len) < 0.5) on++;
    });
    return on >= 2;
  }

  function landConnected(nodes) {
    var land = nodes.filter(function (n) { return n.type !== 'lake'; });
    if (!land.length) return false;
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    var seen = {}; seen[land[0].id] = true;
    var stack = [land[0]], count = 1;
    while (stack.length) {
      var n = stack.pop();
      n.links.forEach(function (id) {
        if (!seen[id]) { seen[id] = true; count++; stack.push(byId[id]); }
      });
    }
    return count === land.length;
  }

  // Returns { nodes, width, height } for one attempt, or null when the layout fails.
  function build(cfg) {
    var fw = W * cfg.scale, fh = H * cfg.scale;   // the whole field for this level
    var n = cfg.spots;
    var minD = 0.55 * Math.sqrt(fw * fh / n);
    var pts = [];
    for (var t = 0; pts.length < n && t < 4000; t++) {
      var p = { x: rnd(70, fw - 70), y: rnd(70, fh - 70) };
      if (pts.every(function (q) { return dist(p, q) >= minD; })) pts.push(p);
    }
    if (pts.length < n) return null;

    var polys = voronoi(pts, fw, fh);

    // Assign types at random: lakes first, then cities, then fortresses, the rest are factories.
    var order = pts.map(function (_, i) { return i; })
      .sort(function () { return Math.random() - 0.5; });
    var type = new Array(n);
    var at = 0;
    order.slice(at, at += cfg.lakes).forEach(function (i) { type[i] = 'lake'; });
    order.slice(at, at += cfg.cities).forEach(function (i) { type[i] = 'city'; });
    order.slice(at, at += cfg.forts).forEach(function (i) { type[i] = 'fortress'; });
    for (var k = 0; k < n; k++) if (!type[k]) type[k] = 'factory';

    var nodes = pts.map(function (pt, i) {
      var tp = type[i];
      var garrison = Math.round(rnd(TYPES[tp].garrison[0], TYPES[tp].garrison[1]));
      return {
        id: i, x: pt.x, y: pt.y, type: tp, poly: polys[i], links: [],
        owner: tp === 'lake' ? -2 : -1,   // -2 lake, -1 neutral, 0+ player
        count: garrison, rate: TYPES[tp].rate
      };
    });

    for (var a = 0; a < n; a++) {
      for (var b = a + 1; b < n; b++) {
        if (type[a] === 'lake' || type[b] === 'lake') continue;
        if (sharesEdge(polys[a], pts[a], pts[b])) {
          nodes[a].links.push(b);
          nodes[b].links.push(a);
        }
      }
    }

    if (!landConnected(nodes)) return null;

    var factories = nodes.filter(function (f) { return f.type === 'factory'; });
    if (factories.length < cfg.players) return null;

    // Spread the flags: each new start is as far as possible from the others.
    var starts = [factories[Math.floor(Math.random() * factories.length)]];
    while (starts.length < cfg.players) {
      var best = null, bestD = -1;
      factories.forEach(function (f) {
        if (starts.indexOf(f) !== -1) return;
        var d = Math.min.apply(null, starts.map(function (s) { return dist(s, f); }));
        if (d > bestD) { bestD = d; best = f; }
      });
      starts.push(best);
    }
    starts.forEach(function (s, owner) { s.owner = owner; s.count = 10; s.start = true; });

    return { nodes: nodes, width: fw, height: fh };
  }

  function features(cfg, nodes) {
    var roads = 0;
    nodes.forEach(function (n) { roads += n.links.length; });
    roads /= 2;
    var count = function (t) { return nodes.filter(function (n) { return n.type === t; }).length; };
    var list = [
      cfg.spots + ' spots',
      count('factory') + ' fabrication centers',
      count('city') + ' cities'
    ];
    if (cfg.forts) list.push(count('fortress') + (cfg.forts === 1 ? ' fortress' : ' fortresses'));
    list.push(cfg.lakes + (cfg.lakes === 1 ? ' lake' : ' lakes'));
    list.push(roads + ' roads');
    if (cfg.teams) list.push(cfg.teams + ' teams of ' + (cfg.players / cfg.teams));
    else list.push('up to ' + (cfg.players - 1) + (cfg.players - 1 === 1 ? ' opponent' : ' opponents'));
    return list;
  }

  // Returns a complete map for a level: geometry, title, description, features.
  function generate(level) {
    var cfg = typeof level === 'number' ? LEVELS[level - 1] : level;
    if (!cfg) throw new Error('Unknown level: ' + level);
    for (var t = 0; t < 300; t++) {
      var built = build(cfg);
      if (built) {
        var nodes = built.nodes;
        var lakesText = cfg.lakes ? cfg.lakes + (cfg.lakes === 1 ? ' lake' : ' lakes') : 'no lakes';
        var teamsText = cfg.teams ? ', ' + cfg.teams + ' teams' : '';
        return {
          level: cfg.level,
          players: cfg.players,
          teams: cfg.teams,
          maxOpponents: cfg.players - 1,
          width: built.width,
          height: built.height,
          title: 'Level ' + cfg.level + ' · ' + cfg.name,
          description: cfg.name + ': ' + cfg.spots + ' spots, ' + cfg.players + ' flags, ' + lakesText + teamsText + '.',
          features: features(cfg, nodes),
          nodes: nodes
        };
      }
    }
    throw new Error('Could not make a connected map. Try New map.');
  }

  global.ExpansionMap = {
    W: W,
    H: H,
    NODE_R: NODE_R,
    TYPES: TYPES,
    LEVELS: LEVELS,
    generate: generate,
    dist: dist
  };
})(window);
