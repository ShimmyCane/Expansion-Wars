// Expansion Wars (combined) — map geometry: Voronoi cells, shared edges, areas and points in polygons. No game rules.
(function () {
  'use strict';
  var core = window.XW.core;

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Keep the part of a polygon on a's side of the line halfway between a and b.
  function clipPoly(poly, a, b) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = b.x - a.x, ny = b.y - a.y;
    function side(p) { return (p.x - mx) * nx + (p.y - my) * ny; }
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
      if (sp <= 0) out.push(p);
      if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
        var t = sp / (sp - sq);
        out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    return out;
  }

  // One cell per point, inside the w x h box.
  function voronoi(pts, w, h) {
    return pts.map(function (a, i) {
      var poly = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
      pts.forEach(function (b, j) { if (j !== i) poly = clipPoly(poly, a, b); });
      return poly;
    });
  }

  // True when cell `poly` (around a) has an edge on the bisector between a and b: the two cells touch.
  function sharesEdge(poly, a, b) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = b.x - a.x, ny = b.y - a.y;
    var len = Math.hypot(nx, ny) || 1, on = 0;
    poly.forEach(function (p) { if (Math.abs(((p.x - mx) * nx + (p.y - my) * ny) / len) < 0.5) on++; });
    return on >= 2;
  }

  // Shoelace area, and ray-cast point-in-polygon.
  function polyArea(poly) {
    var s = 0;
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s) / 2;
  }
  function inPoly(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function cellCentre(poly) {
    var x = 0, y = 0;
    poly.forEach(function (p) { x += p.x; y += p.y; });
    return { x: x / poly.length, y: y / poly.length };
  }

  // The edge two cells share, if any.
  function sharedEdge(A, B) {
    var common = [];
    A.forEach(function (u) { B.forEach(function (v) { if (Math.hypot(u.x - v.x, u.y - v.y) < 1) common.push(u); }); });
    return common.length >= 2 ? { a: common[0], b: common[1] } : null;
  }

  // The corners of a cell from one shared edge to another, the shorter way round. Rivers follow borders this way.
  function borderArc(poly, e1, e2) {
    var n = poly.length, best = null;
    function index(u) {
      for (var i = 0; i < n; i++) if (Math.hypot(poly[i].x - u.x, poly[i].y - u.y) < 1) return i;
      return -1;
    }
    [e1.a, e1.b].forEach(function (u) {
      [e2.a, e2.b].forEach(function (v) {
        var i = index(u), j = index(v);
        if (i < 0 || j < 0) return;
        var f = (j - i + n) % n, d = Math.min(f, n - f);
        if (!best || d < best.d) best = { i: i, d: d, step: f <= n - f ? 1 : -1 };
      });
    });
    if (!best) return [];
    var out = [];
    for (var s = 0, idx = best.i; s <= best.d; s++, idx = (idx + best.step + n) % n) out.push(poly[idx]);
    return out;
  }

  // SVG points text for a polygon.
  function pts(poly) { return poly.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '); }

  core.geom = {
    dist: dist, voronoi: voronoi, sharesEdge: sharesEdge, polyArea: polyArea, inPoly: inPoly,
    cellCentre: cellCentre, sharedEdge: sharedEdge, borderArc: borderArc, pts: pts
  };
})();
