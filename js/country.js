// Expansion Wars — version 2: the country layer.
// Each population centre is a province: a point on the map with its own cell. A nation holds provinces,
// and the border between two nations is the edge between their provinces, so it moves when a province changes hands.
// Nations keep their regions. Rivers and lakes make the ground harder to cross; mountains are strong ground.
// A turn lasts 60 seconds. Everyone queues actions, and they play out together when the turn ends or on Ready.
(function () {
  'use strict';

  var W = 1000, H = 640, TURN = 60, COUNT = 6, SVG_NS = 'http://www.w3.org/2000/svg';
  var NAMES = ['Your nation', 'Oakfield', 'Riverton', 'Stonevale', 'Mirewood', 'Highmoor'];
  var MIN_REP = { trade: -20, ally: 20, ceasefire: -40 };
  var TRADE_SETUP = 20;   // gold paid once by the nation that opens a trade route; the route then pays gold each turn
  var TRIBUTE = 10, SEND = 0.5, DEFENDER = 1.2, FORT_BONUS = 0.2;
  // Growing a province: village to town and town to city cost gold, city to fortress costs stone.
  var GROW = { v: { to: 't', gold: 10 }, t: { to: 'c', gold: 20 }, c: { to: 'f', stone: 15 } };
  var LABEL = { e: 'empty dot', v: 'village', t: 'town', c: 'city', f: 'fortress' };
  var DIPLO = [
    { type: 'trade', text: 'Trade route (' + TRADE_SETUP + ' gold to set up)' },
    { type: 'ally', text: 'Neutral alliance' },
    { type: 'ceasefire', text: 'Ceasefire' },
    { type: 'tribute', text: 'Send tribute (' + TRIBUTE + ' gold)' },
    { type: 'declare', text: 'Declare war' },
    { type: 'attack', text: 'Attack' }
  ];
  // Culture comes only from battle victories. The spot fought over sets the amount: a fortress gives 4, anything smaller 1.
  var CULTURE = { v: 1, t: 1, c: 1, f: 4 };
  // Conquered provinces: their production drops by OCC_PENALTY (as a share of the nation) and recovers after RESTORE_TURNS.
  var OCC_PENALTY = 0.4, RESTORE_TURNS = 10;
  // Battles: three waves; overpowered at twice the defence means surrender.
  var WAVES = 3, SURRENDER = 2;
  // Distance: an attack reaches MAX_DIST (steps, with a river or a mountain counting one extra). Far away costs strength,
  // hostile provinces on the way wear the army down, and allied land is free passage.
  var MAX_DIST = 4;
  var FAR_PER_STEP = 0.1, FAR_PER_RIVER = 0.08, FAR_MAX = 0.5;
  var CHIP_PER_HOSTILE = 0.05, CHIP_MAX = 0.4;
  // Retaking land lost recently is a tailwind.
  var TAILWIND = 1.25, TAILWIND_TURNS = 10;
  // Unrest: a spot may revolt from 70 (certain at 90).
  var REVOLT_AT = 70, REVOLT_CERTAIN = 90;
  var PROV_GAP = 45;   // least distance between two provinces
  var TIER_RANK = { e: 0, v: 1, t: 2, c: 3, f: 4 };
  var DOWN = { e: 'e', v: 'v', t: 'v', c: 't', f: 'c' };   // a captured province drops one grade

  var st = null, timer = null, selected = 0;
  var PCT_KEY = 'expansion-wars-send-pct';
  function loadPct() {
    try { var v = Number(localStorage.getItem(PCT_KEY)); if (v >= 5 && v <= 100) return v; } catch (e) { /* no storage */ }
    return 50;
  }
  function savePct(v) {
    try { localStorage.setItem(PCT_KEY, String(v)); } catch (e) { /* no storage */ }
  }
  var sendPct = loadPct();   // the share of your army (in %) you last chose to send; remembered between battles

  var els = {};
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function svgEl(name, attrs) {
    var e = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Voronoi cells (same method as the province maps).
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
  function voronoi(pts) {
    return pts.map(function (a, i) {
      var poly = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
      pts.forEach(function (b, j) { if (j !== i) poly = clipPoly(poly, a, b); });
      return poly;
    });
  }
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
  // Area of a region (shoelace formula) and whether a point is inside one.
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

  // ---------- terrain: lakes, rivers and mountains ----------

  function segPointDist(c, p, q) {
    var dx = q.x - p.x, dy = q.y - p.y;
    var t = ((c.x - p.x) * dx + (c.y - p.y) * dy) / ((dx * dx + dy * dy) || 1);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x + dx * t - c.x, p.y + dy * t - c.y);
  }
  function lakeAt(p, pad) {
    return st.lakes.some(function (L) { return Math.hypot(L.x - p.x, L.y - p.y) < L.r + pad; });
  }
  // A lake between two provinces stops them touching.
  function lakeBetween(p, q) {
    return st.lakes.some(function (L) { return segPointDist(L, p, q) < L.r; });
  }
  function ccw(p, q, r) { return (r.y - p.y) * (q.x - p.x) > (q.y - p.y) * (r.x - p.x); }
  function segCross(a, b, c, d) { return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d); }
  // A river between two provinces: the line between them crosses the river.
  function riverBetween(p, q) {
    for (var r = 0; r < st.rivers.length; r++) {
      var R = st.rivers[r];
      for (var k = 0; k < R.length - 1; k++) if (segCross(p, q, R[k], R[k + 1])) return true;
    }
    return false;
  }

  function makeTerrain(seeds) {
    st.lakes = [];
    for (var t = 0; st.lakes.length < 2 && t < 2000; t++) {
      var c = { x: rnd(60, W - 60), y: rnd(60, H - 60), r: rnd(30, 46) };
      if (seeds.every(function (q) { return dist(c, q) > c.r + 60; })) st.lakes.push(c);
    }
    st.rivers = [];
    for (var k = 0; k < 2; k++) {
      var left = Math.random() < 0.5;
      st.rivers.push([
        { x: left ? 0 : W, y: rnd(40, H - 40) },
        { x: W * rnd(0.3, 0.4), y: rnd(60, H - 60) },
        { x: W * rnd(0.6, 0.7), y: rnd(60, H - 60) },
        { x: left ? W : 0, y: rnd(40, H - 40) }
      ]);
    }
    st.mountains = [];
    for (var m = 0; st.mountains.length < 8 && m < 2000; m++) {
      var mp = { x: rnd(60, W - 60), y: rnd(60, H - 60) };
      if (!lakeAt(mp, 20) && seeds.every(function (q) { return dist(mp, q) > 70; })) st.mountains.push(mp);
    }
  }

  // ---------- nations and provinces ----------

  function ownedBy(n) { return st.provs.filter(function (p) { return p.owner === n.id; }); }
  function tierCount(n, k) { return st.provs.filter(function (p) { return p.owner === n.id && p.tier === k; }).length; }
  function provs(n) { return ownedBy(n).length; }
  function spots(n) { return n.v + n.t + n.c + n.f; }   // promoted provinces (not empty dots)
  function occupiedOf(n) { return ownedBy(n).filter(function (p) { return p.occ > 0; }); }

  function makeNation(i, p, poly) {
    var n = {
      id: i, name: NAMES[i], x: p.x, y: p.y, alive: true, neutral: i >= 3, area: polyArea(poly), nb: [],
      soldiers: 40, tech: 10, morale: 50, happy: 50, guns: 0.5, food: 20, gold: 30, stone: 10,
      magic: 0, culture: 0, unrest: 0, warTurns: 0
    };
    // Tier counts come from the provinces the nation holds.
    ['v', 't', 'c', 'f', 'e'].forEach(function (k) {
      Object.defineProperty(n, k, { get: function () { return tierCount(n, k); }, enumerable: true });
    });
    return n;
  }

  function quality(n) { return 1 + (n.tech + n.morale + n.happy) / 300; }
  // Power = population density (weighted by spot type) x quality x soldiers.
  function power(n) {
    var sp = spots(n);
    if (!sp) return 0;
    var density = (n.v + 2 * n.t + 3 * n.c + 5 * n.f) / sp;
    return density * quality(n) * n.soldiers;
  }
  function median() {
    var p = alive().map(power).sort(function (a, b) { return a - b; });
    if (!p.length) return 1;
    var m = p[Math.floor(p.length / 2)];
    return m > 0 ? m : 1;
  }
  function ratio(n) { return power(n) / median(); }
  function stage(R) {
    if (R < 0.7) return 'Early';
    if (R < 1.3) return 'Growing';
    if (R < 2) return 'Strong';
    return 'Veteran';
  }
  function alive() { return st.n.filter(function (n) { return n.alive; }); }
  function key(i, j) { return i < j ? i + '-' + j : j + '-' + i; }
  function rel(i, j) {
    var k = key(i, j);
    if (!st.rel[k]) st.rel[k] = { war: false, trade: false, ally: false, truce: 0, rep: 0 };
    return st.rel[k];
  }
  function atWar(i) {
    return st.n.some(function (j) { return j.id !== i && j.alive && rel(i, j.id).war; });
  }
  function tradeCount(i) {
    return st.n.filter(function (j) { return j.id !== i && j.alive && rel(i, j.id).trade; }).length;
  }
  function weakestGrade(n) { return n.v > 0 ? 'v' : n.t > 0 ? 't' : n.c > 0 ? 'c' : 'f'; }

  // The land route from one nation to another, over provinces. Each step costs 1; a river or a mountain costs one more.
  // Returns the cost (dist), the steps (hops), river crossings, hostile provinces on the way (at war with the attacker),
  // and the province reached in the target nation (entry). Allied and peaceful land is free passage.
  function route(i, j) {
    var P = st.provs, d = {}, prev = {}, changed = true;
    P.forEach(function (p) { d[p.id] = p.owner === i ? 0 : Infinity; prev[p.id] = -1; });
    while (changed) {
      changed = false;
      P.forEach(function (p) {
        if (d[p.id] === Infinity) return;
        p.adj.forEach(function (q, k) {
          var Q = P[q];
          var w = 1 + (p.adjRiver[k] ? 1 : 0) + (Q.terrain === 'mountain' ? 1 : 0);
          if (d[p.id] + w < d[Q.id]) { d[Q.id] = d[p.id] + w; prev[Q.id] = p.id; changed = true; }
        });
      });
    }
    var best = null;
    P.forEach(function (p) {
      if (p.owner === j && d[p.id] < Infinity && (!best || d[p.id] < best.d)) best = { id: p.id, d: d[p.id] };
    });
    if (!best) return null;
    var path = [best.id], cur = best.id;
    while (prev[cur] !== -1) { cur = prev[cur]; path.unshift(cur); }
    var rivers = 0, hostile = 0;
    for (var s = 0; s < path.length - 1; s++) {
      var a = P[path[s]], k = a.adj.indexOf(path[s + 1]);
      if (k >= 0 && a.adjRiver[k]) rivers++;
    }
    for (var h = 1; h < path.length - 1; h++) {
      var o = P[path[h]].owner;
      if (o !== i && o >= 0 && rel(i, o).war) hostile++;
    }
    return { dist: Math.round(best.d), hops: path.length - 1, rivers: rivers, hostile: hostile, entry: best.id };
  }

  // The effects of the route on an attack: far away, hostile chip, and the tailwind for land recently lost.
  function attackFactors(i, R) {
    var entry = st.provs[R.entry];
    return {
      far: Math.min(FAR_MAX, FAR_PER_STEP * Math.max(0, R.hops - 1) + FAR_PER_RIVER * R.rivers),
      chip: Math.min(CHIP_MAX, CHIP_PER_HOSTILE * R.hostile),
      tail: (entry.lostFrom === i && st.turn - entry.lostTurn <= TAILWIND_TURNS) ? TAILWIND : 1
    };
  }

  // Take one province from its owner. A captured province drops one grade and is occupied for a while.
  function takeProvince(p, to) {
    var previous = p.owner;
    if (p.occ === 0) { p.home = previous; p.origTier = p.tier; }
    p.lostFrom = previous;
    p.lostTurn = st.turn;
    p.tier = DOWN[p.tier];
    p.owner = to.id;
    p.occ = RESTORE_TURNS;
    return LABEL[p.tier];
  }

  // Take up to count provinces, starting at the entry province and then the weakest ones touching the attacker's land.
  // This keeps the captured land in one piece.
  function captureMany(from, to, entryId, count) {
    var taken = [];
    var first = st.provs[entryId];
    if (first && first.owner === from.id && count > 0) { taken.push(takeProvince(first, to)); count--; }
    while (count > 0) {
      var cands = ownedBy(from).filter(function (p) {
        return p.adj.some(function (q) { return st.provs[q].owner === to.id; });
      });
      if (!cands.length) cands = ownedBy(from);
      if (!cands.length) break;
      cands.sort(function (p, q) { return TIER_RANK[p.tier] - TIER_RANK[q.tier]; });
      taken.push(takeProvince(cands[0], to));
      count--;
    }
    return taken;
  }

  // ---------- actions ----------

  // Why an action cannot happen now (a message), or null when it can.
  function canDo(type, i, j) {
    var a = st.n[i], b = st.n[j], r = rel(i, j);
    if (i === j || !a.alive || !b.alive) return 'That nation has fallen.';
    if (type === 'trade') {
      if (r.war) return 'You are at war.';
      if (r.trade) return 'Already trading.';
      if (r.rep < MIN_REP.trade) return 'They do not trust you enough yet.';
      if (a.gold < TRADE_SETUP) return 'Not enough gold (' + TRADE_SETUP + ') to open a trade route.';
    }
    if (type === 'ally') {
      if (r.war) return 'You are at war.';
      if (r.ally) return 'Already allied.';
      if (r.rep < MIN_REP.ally) return 'Not enough reputation for an alliance.';
    }
    if (type === 'ceasefire') {
      if (!r.war) return 'You are not at war.';
      if (r.rep < MIN_REP.ceasefire) return 'They will not talk yet.';
    }
    if (type === 'tribute' && a.gold < TRIBUTE) return 'Not enough gold (' + TRIBUTE + ').';
    if (type === 'declare' && r.war) return 'Already at war.';
    if (type === 'attack') {
      if (!r.war) return 'Declare war first.';
      if (a.soldiers < 2) return 'No soldiers to send.';
      var R = route(i, j);
      if (!R) return 'No land route: lakes are in the way.';
      if (R.dist > MAX_DIST) return 'Too far away: ' + R.dist + ' steps (the limit is ' + MAX_DIST + ').';
    }
    return null;
  }

  // Upgrades get dearer as a nation holds more spots: each spot adds 10% to the base cost.
  function growCost(n, from) {
    var m = GROW[from], f = 1 + 0.1 * spots(n);
    return { gold: m.gold ? Math.ceil(m.gold * f) : 0, stone: m.stone ? Math.ceil(m.stone * f) : 0 };
  }

  // Villages are built by hand, paid in food or culture, on an empty dot. 40 at five spots, rising by 4 for each spot beyond five.
  function villageCost(n) { return Math.ceil(40 * (1 + 0.1 * (spots(n) - 5))); }

  // Build a village on a chosen empty dot of yours.
  function buildAt(n, p, pay) {
    var c = villageCost(n);
    if (!p || p.owner !== n.id) return 'Pick an empty dot on your land.';
    if (p.tier !== 'e') return 'Pick an empty dot, not a ' + LABEL[p.tier] + '.';
    if (n[pay] < c) return 'Not enough ' + pay + ' (' + c + ').';
    n[pay] -= c;
    p.tier = 'v';
    return null;
  }
  // Computer nations: the best empty dot for their needs (farmland when food is short, otherwise trade).
  function buildVillage(n, pay) {
    var list = ownedBy(n).filter(function (q) { return q.tier === 'e'; });
    if (!list.length) return 'No empty dot left to build on.';
    var want = n.food < 50 ? 'farm' : 'trade';
    list.sort(function (p, q) { return score(q, want) - score(p, want); });
    return buildAt(n, list[0], pay);
  }

  // Promote a chosen spot of yours one grade.
  function growAt(n, p, from) {
    var m = GROW[from];
    if (!m) return 'That cannot grow.';
    if (!p || p.owner !== n.id || p.tier !== from) return 'Pick a ' + LABEL[from] + ' on your land.';
    var c = growCost(n, from);
    if (c.gold && n.gold < c.gold) return 'Not enough gold (' + c.gold + ').';
    if (c.stone && n.stone < c.stone) return 'Not enough stone (' + c.stone + ').';
    n.gold -= c.gold;
    n.stone -= c.stone;
    p.tier = m.to;
    return null;
  }
  // Computer nations: fortresses go on defensive ground, towns and cities on trade ground.
  function grow(n, from) {
    if (!GROW[from]) return 'That cannot grow.';
    var list = ownedBy(n).filter(function (q) { return q.tier === from; });
    if (!list.length) return 'No ' + LABEL[from] + ' to grow.';
    var want = from === 'c' ? 'defence' : 'trade';
    list.sort(function (p, q) { return score(q, want) - score(p, want); });
    return growAt(n, list[0], from);
  }

  function queue(type, to) {
    var err = canDo(type, 0, to);
    if (err) { addLog(err); return; }
    removeQueued(0, to);
    var item = { type: type, from: 0, to: to };
    if (type === 'attack') item.pct = sendPct;   // the share chosen when the attack was queued
    st.queue.push(item);
    addLog('Queued: ' + type + ' with ' + st.n[to].name + '. It plays out when the turn ends.');
  }
  function removeQueued(from, to) {
    st.queue = st.queue.filter(function (x) { return !(x.from === from && x.to === to); });
  }

  // Apply one diplomatic action.
  function applyDiplomacy(x) {
    var i = x.from, j = x.to, r = rel(i, j), a = st.n[i], b = st.n[j];
    var err = canDo(x.type, i, j);
    if (err) { addLog(a.name + ' could not ' + x.type + ' with ' + b.name + ': ' + err); return; }
    if (x.type === 'trade') {
      r.trade = true;
      a.gold -= TRADE_SETUP;
      addLog(a.name + ' and ' + b.name + ' open a trade route.');
    } else if (x.type === 'ally') {
      r.ally = true;
      addLog(a.name + ' and ' + b.name + ' agree a neutral alliance.');
    } else if (x.type === 'ceasefire') {
      r.war = false; r.truce = 10;
      addLog(a.name + ' and ' + b.name + ' agree a ceasefire for 10 turns.');
    } else if (x.type === 'tribute') {
      a.gold -= TRIBUTE; b.gold += TRIBUTE; r.rep = Math.min(100, r.rep + 8);
      addLog(a.name + ' sends ' + TRIBUTE + ' gold to ' + b.name + '.');
    } else if (x.type === 'declare') {
      r.war = true; r.trade = false; r.ally = false; r.rep -= 20;
      st.n.forEach(function (k) {
        if (k.id !== i && k.id !== j && k.alive) rel(k.id, i).rep -= 5;   // everyone who saw it
      });
      addLog(a.name + ' declares war on ' + b.name + '.');
    }
  }

  // A country battle runs in three waves. The chosen share of the attacker's soldiers is split across them.
  // Each wave is a fight: the defenders have an advantage, so casualties split by strength, not all or nothing.
  // The defence is the province the attack reaches (its defence value). Overpowered (twice the defence) means surrender:
  // the attacker takes one province for each whole point of power over the defence.
  function battle(x) {
    var i = x.from, j = x.to, a = st.n[i], b = st.n[j];
    if (!rel(i, j).war || !a.alive || !b.alive) return;
    var R = route(i, j);
    if (!R || R.dist > MAX_DIST) { addLog(a.name + ' could not reach ' + b.name + '.'); return; }
    var sent0 = Math.floor(a.soldiers * (x.pct || SEND * 100) / 100);
    if (sent0 < 1) return;
    // Unrest costs one soldier in every 20 unrest before the march. Hostile land on the way and distance wear the army down.
    var flat = Math.min(sent0 - 1, Math.ceil(a.unrest / 20));
    var F = attackFactors(i, R);
    var sent = Math.floor((sent0 - flat) * (1 - F.chip));
    a.soldiers -= sent0;
    if (sent < 1) { addLog(a.name + "'s army is worn away on the way to " + b.name + '.'); return; }
    // Magic is used up by the attack; unrest and distance cut the strength of the attack; retaking recent land helps.
    var bonus = (1 + a.magic / 100) / (1 + a.unrest / 200) * (1 - F.far) * F.tail;
    a.magic = 0;
    var entry = st.provs[R.entry];
    var front = featureDef(entry) / 2;
    var power = sent * quality(a) * bonus;
    var defence = b.soldiers * quality(b) * (1 + FORT_BONUS * b.f) * DEFENDER * front;
    var grade = weakestGrade(b);
    var pool = sent, d = b.soldiers;
    for (var k = 0; k < WAVES && pool >= 1 && d > 0; k++) {
      var w = pool / (WAVES - k);                     // this wave's share of the attackers still standing
      var A = w * quality(a) * bonus;
      var D = d * quality(b) * (1 + FORT_BONUS * b.f) * DEFENDER * front;
      pool -= w * D / (A + D);                        // attackers lost, in proportion to the defence
      d -= d * A / (A + D);                           // defenders lost, in proportion to the attack
    }
    var ratio = power / defence;
    var taken = [];
    if (ratio >= SURRENDER) {
      taken = captureMany(b, a, R.entry, Math.min(provs(b), Math.floor(ratio)));
      a.soldiers += pool + Math.max(0, d);            // the defenders who are left surrender to you
      b.soldiers = 0;
      addLog(b.name + ' surrenders to ' + a.name + (taken.length ? ', giving up ' + taken.length + ' province' + (taken.length === 1 ? '' : 's') + ' (' + taken.join(', ') + ').' : '.'));
    } else if (pool * quality(a) * bonus > d * quality(b) * (1 + FORT_BONUS * b.f) * DEFENDER * front && pool > 0) {
      taken = captureMany(b, a, R.entry, 1);
      b.soldiers = Math.max(0, d);
      a.soldiers += pool;                              // survivors come home
      addLog(a.name + ' wins against ' + b.name + (taken.length ? ' and takes a ' + taken[0] + '.' : '.'));
    } else {
      b.soldiers = Math.max(0, d);
      a.soldiers += Math.max(0, pool);
      addLog(b.name + ' holds against ' + a.name + '.');
    }
    if (taken.length) {
      var gainA = CULTURE[grade] * foodMult(a);
      a.culture += gainA;
      addLog(a.name + ' earns culture +' + gainA.toFixed(1) + '.');
    } else {
      var gainB = CULTURE[grade] * foodMult(b);
      b.culture += gainB;
      addLog(b.name + ' earns culture +' + gainB.toFixed(1) + ' for holding.');
    }
  }

  // The computer nations choose their moves. They are planned from the same state as yours.
  function planAI() {
    alive().forEach(function (a) {
      if (a.id === 0) return;
      var foes = alive().filter(function (b) { return b.id !== a.id && rel(a.id, b.id).war; });
      if (foes.length && !a.neutral) {
        // Scheme: choose the foe worth the most for the distance, that the army can beat. Not every turn.
        var best = null;
        foes.forEach(function (b) {
          if (canDo('attack', a.id, b.id)) return;
          var R = route(a.id, b.id);
          var value = targetValue(b) / (1 + R.dist);
          if (!best || value > best.value) best = { b: b, value: value };
        });
        if (best && a.soldiers * quality(a) >= 0.9 * best.b.soldiers * quality(best.b) && Math.random() < 0.6) {
          st.queue.push({ type: 'attack', from: a.id, to: best.b.id });
        }
        // Sue for peace when badly outmatched.
        foes.forEach(function (b) {
          if (b.soldiers > 2.5 * a.soldiers && rel(a.id, b.id).rep >= MIN_REP.ceasefire && Math.random() < 0.3) {
            st.queue.push({ type: 'ceasefire', from: a.id, to: b.id });
          }
        });
      } else if (!a.neutral && Math.random() < 0.2) {
        // A stronger neighbour declares war: a 20% lead is enough.
        var prey = a.nb.map(function (id) { return st.n[id]; }).filter(function (b) {
          return b.alive && !rel(a.id, b.id).war && power(a) >= 1.2 * power(b);
        });
        if (prey.length) st.queue.push({ type: 'declare', from: a.id, to: prey[0].id });
      }
      // Gang up: befriend a neighbour that is already at peace and well regarded, to stand together against a stronger one.
      if (!a.neutral && Math.random() < 0.15) {
        var pals = a.nb.map(function (id) { return st.n[id]; }).filter(function (b) {
          var r = rel(a.id, b.id);
          return b.alive && !r.war && !r.ally && r.rep >= MIN_REP.ally;
        });
        if (pals.length) st.queue.push({ type: 'ally', from: a.id, to: pals[0].id });
      }
      if (Math.random() < 0.25) {
        var friends = a.nb.map(function (id) { return st.n[id]; }).filter(function (b) {
          var r = rel(a.id, b.id);
          return b.alive && !r.war && !r.trade && r.rep >= -10 && a.gold >= TRADE_SETUP;
        });
        if (friends.length) st.queue.push({ type: 'trade', from: a.id, to: friends[0].id });
      }
      if (Math.random() < 0.3) {
        ['v', 't', 'c'].sort(function () { return Math.random() - 0.5; }).some(function (k) { return !grow(a, k); });
      }
      if (Math.random() < 0.2) {
        ['food', 'culture'].some(function (pay) { return !buildVillage(a, pay); });
      }
    });
  }

  // Gun or butter: guns (0 to 1) is the share of effort put into soldiers. Recruiting runs at 0.5 + guns,
  // and food production at 1.5 - guns, so the two always add up to 2 (the even split is 1 and 1).
  // Food stock also helps culture: each battle earns up to double culture at 100 food.
  function foodMult(n) { return 1 + Math.min(n.food, 100) / 100; }

  // Each province's feature follows the land around it: ground on a war front or a mountain or lake shore is defensive;
  // ground touching an ally or a river is a trade route; the rest is farmland. Alliances and wars change it over time.
  var FEATURE_NAME = { farm: 'farmland', trade: 'trade route', defence: 'defensive ground' };
  var VALUE = { e: 0.5, v: 1, t: 2, c: 3, f: 4 };
  function riverNear(p) {
    return st.rivers.some(function (R) {
      for (var k = 0; k < R.length - 1; k++) if (segPointDist(p, R[k], R[k + 1]) < 40) return true;
      return false;
    });
  }
  function lakeNear(p) {
    return st.lakes.some(function (L) { return Math.hypot(L.x - p.x, L.y - p.y) < L.r + 40; });
  }
  function feature(p) {
    if (p.terrain === 'mountain' || lakeNear(p)) return 'defence';
    var P = st.provs;
    if (p.owner >= 0 && p.adj.some(function (q) { var o = P[q].owner; return o >= 0 && o !== p.owner && rel(p.owner, o).war; })) return 'defence';
    if (p.owner >= 0 && p.adj.some(function (q) { var o = P[q].owner; return o >= 0 && o !== p.owner && rel(p.owner, o).ally; })) return 'trade';
    if (riverNear(p)) return 'trade';
    return 'farm';
  }
  // Defence of a province: its value, plus one for defensive ground that has been built on.
  function featureDef(p) { return p.def + (feature(p) === 'defence' && p.tier !== 'e' ? 1 : 0); }
  // How well a province suits a purpose (farm, trade, defence): the match, with a little chance to break ties.
  function score(p, want) { return (feature(p) === want ? 2 : 0) + Math.random() * 0.5; }
  function targetValue(b) {
    return ownedBy(b).reduce(function (sum, p) { return sum + VALUE[p.tier] + (feature(p) === 'defence' ? 0.5 : 0); }, 0);
  }

  // A revolt returns an occupied province to its old owner, or to neutral if that owner has fallen.
  function revolt(n) {
    var list = occupiedOf(n);
    if (!list.length) return;
    var p = list[Math.floor(Math.random() * list.length)];
    var home = st.n[p.home];
    var back = home && home.alive;
    p.owner = back ? home.id : -1;
    p.tier = p.origTier;
    p.occ = 0;
    addLog(n.name + ' revolts: a ' + LABEL[p.tier] + (back ? ' goes back to ' + home.name + '.' : ' goes neutral.'));
    n.unrest = Math.max(0, n.unrest - 15);
  }

  function prodFactor(n) {
    var occ = occupiedOf(n).length / Math.max(1, provs(n));
    return 1 - OCC_PENALTY * Math.min(1, occ);
  }

  function economy(n) {
    ownedBy(n).forEach(function (p) { if (p.occ > 0) p.occ--; });
    var pf = prodFactor(n);
    var farm = ownedBy(n).filter(function (p) { return p.tier !== 'e' && feature(p) === 'farm'; }).length;
    var tradeP = ownedBy(n).filter(function (p) { return p.tier !== 'e' && feature(p) === 'trade'; }).length;
    var produced = (2 * n.v + 3 * n.t + 3 * n.c + 2 * n.f) * (1.5 - n.guns) * pf + 0.5 * farm;
    var upkeep = n.soldiers * 0.02;
    var foodNet = produced - upkeep;
    n.food += foodNet;
    if (n.food < 0) { n.soldiers *= 0.97; n.food = 0; }
    n.gold += (0.5 * n.v + n.t + 2 * n.c) * pf + 3 * tradeCount(n.id) + 0.5 * tradeP;
    // Stone comes from cities (1 a turn each) and from trade routes (1 a turn each).
    n.stone += n.c + tradeCount(n.id);
    // Magic is gathered from every spot: village 0.05, town 0.1, city 0.2, fortress 0.4 a turn, plus the technology trickle.
    var magicIn = 0.1 + n.tech / 200 + 0.05 * n.v + 0.1 * n.t + 0.2 * n.c + 0.4 * n.f;
    n.magic += magicIn;
    // Culture draws in soldiers: up to +50% at 100 culture.
    n.soldiers += (n.v + 1.5 * n.t + 2 * n.c + 2.5 * n.f) * (1 + n.morale / 200) * (1 + Math.min(n.culture, 100) / 200) * (0.5 + n.guns) * pf;
    if (atWar(n.id)) {
      n.morale = Math.max(0, n.morale - 0.5);
    } else {
      n.happy = Math.min(100, n.happy + 1);
      n.morale = Math.min(100, n.morale + 0.5);
    }
    // Unrest: long wars, several wars, too little food, no trade and allies at war push it up. Peace with food brings it down.
    var wars = st.n.filter(function (j) { return j.id !== n.id && j.alive && rel(n.id, j.id).war; }).length;
    n.warTurns = wars ? n.warTurns + 1 : 0;
    var allyAtWar = st.n.filter(function (j) { return j.id !== n.id && j.alive && rel(n.id, j.id).ally && atWar(j.id); }).length;
    var up = (n.warTurns > 10 ? 1.5 : wars ? 0.5 : 0) + 0.5 * Math.max(0, wars - 1) + (n.food < 20 ? 1 : 0) +
      (tradeCount(n.id) === 0 ? 0.5 : 0) + 0.5 * allyAtWar;
    var down = wars === 0 && n.food >= 20 ? 1 : 0;
    n.unrest = Math.max(0, Math.min(100, n.unrest + up - down));
    if (n.unrest >= REVOLT_AT && occupiedOf(n).length && Math.random() < (n.unrest >= REVOLT_CERTAIN ? 1 : 0.3)) revolt(n);
    n.tech = Math.min(100, n.tech + 0.5 + 0.1 * (n.c + n.f));
  }

  // Which nations touch which: a nation's neighbours are the owners of provinces next to its own.
  function updateNeighbours() {
    st.n.forEach(function (n) { n.nb = []; });
    st.provs.forEach(function (p) {
      p.adj.forEach(function (q) {
        var o = st.provs[q].owner;
        if (p.owner >= 0 && o >= 0 && o !== p.owner && st.n[p.owner].nb.indexOf(o) < 0) st.n[p.owner].nb.push(o);
      });
    });
  }

  function resolveTurn() {
    if (!st || st.over) return;
    planAI();
    var q = st.queue;
    st.queue = [];
    q.filter(function (x) { return x.type !== 'attack'; }).forEach(applyDiplomacy);
    q.filter(function (x) { return x.type === 'attack'; })
      .sort(function () { return Math.random() - 0.5; })
      .forEach(battle);
    alive().forEach(economy);
    updateNeighbours();
    // Trade and alliances build reputation. A ceasefire counts down.
    Object.keys(st.rel).forEach(function (k) {
      var r = st.rel[k];
      if (r.trade) r.rep = Math.min(100, r.rep + 1);
      if (r.ally) r.rep = Math.min(100, r.rep + 1);
      if (r.truce > 0) r.truce--;
    });
    // A nation with no provinces left has fallen; its wars and treaties end.
    st.n.forEach(function (n) {
      if (n.alive && provs(n) === 0) {
        n.alive = false;
        st.n.forEach(function (k) {
          if (k.id !== n.id) { var r = rel(n.id, k.id); r.war = false; r.trade = false; r.ally = false; }
        });
        addLog(n.name + ' has fallen.');
      }
    });
    checkWin();
    st.turn++;
    st.clock = TURN;
    render();
  }

  function checkWin() {
    if (!st.n[0].alive) { st.over = 'lost'; addLog('Your nation has fallen.'); return; }
    var others = alive().filter(function (n) { return n.id !== 0; });
    if (!others.length) { st.over = 'won'; addLog('Every other nation has fallen. You win!'); }
  }

  function addLog(text) {
    st.log.push('Turn ' + st.turn + ': ' + text);
    if (st.log.length > 60) st.log.shift();
  }

  // ---------- starting a game ----------

  // Cell geometry for every province, and which provinces touch. A lake between two provinces stops them touching.
  function geometry() {
    var P = st.provs, pts = P.map(function (p) { return { x: p.x, y: p.y }; });
    var cells = voronoi(pts);
    P.forEach(function (p, i) { p.cell = cells[i]; p.adj = []; p.adjRiver = []; });
    for (var a = 0; a < P.length; a++) {
      for (var b = a + 1; b < P.length; b++) {
        if (sharesEdge(cells[a], pts[a], pts[b]) && !lakeBetween(pts[a], pts[b])) {
          var rv = riverBetween(pts[a], pts[b]);
          P[a].adj.push(b); P[a].adjRiver.push(rv);
          P[b].adj.push(a); P[b].adjRiver.push(rv);
        }
      }
    }
  }

  function newGame() {
    var seeds = [], minD = 0.55 * Math.sqrt(W * H / COUNT);
    for (var t = 0; seeds.length < COUNT && t < 4000; t++) {
      var p = { x: rnd(80, W - 80), y: rnd(80, H - 80) };
      if (seeds.every(function (q) { return dist(p, q) >= minD; })) seeds.push(p);
    }
    // The nations' regions are fixed. The provinces inside them are the population centres.
    var regions = voronoi(seeds);
    st = { turn: 1, clock: TURN, rel: {}, n: [], queue: [], log: [], over: null, scale: 1, focus: null, provs: [], pick: null };
    seeds.forEach(function (sp, i) { st.n.push(makeNation(i, sp, regions[i])); });
    makeTerrain(seeds);
    var avg = W * H / COUNT;
    st.n.forEach(function (n) {
      var region = regions[n.id];
      var want = Math.max(4, Math.min(12, Math.round(n.area / avg * 7)));
      var pts = [];
      for (var t = 0; pts.length < want && t < 4000; t++) {
        var c = { x: rnd(0, W), y: rnd(0, H) };
        if (!inPoly(c, region) || lakeAt(c, 8)) continue;
        if (pts.every(function (q) { return dist(c, q) >= PROV_GAP; })) pts.push(c);
      }
      // Start with a few villages, one town, and empty dots for the rest: each empty dot can be promoted later.
      var k = Math.max(2, Math.min(7, Math.round(4 * n.area / avg)));
      pts.forEach(function (c, idx) {
        var tier = idx < k ? 'v' : idx === k ? 't' : 'e';
        var mountain = st.mountains.some(function (M) { return dist(M, c) < 40; });
        st.provs.push({
          id: st.provs.length, owner: n.id, home: n.id, x: c.x, y: c.y, tier: tier, origTier: tier,
          def: 1 + Math.floor(Math.random() * 3) + (mountain ? 1 : 0), terrain: mountain ? 'mountain' : 'plain',
          occ: 0, lostTurn: -99, lostFrom: -1, cell: null, adj: [], adjRiver: []
        });
      });
    });
    geometry();
    updateNeighbours();
    rel(1, 2).war = true;
    addLog('The country is at peace, except ' + NAMES[1] + ' and ' + NAMES[2] + ', who are at war.');
    addLog('Each turn is 60 seconds. Pick a nation to act, then press Ready.');
    selected = 0;
    buildMap();
    render();
  }

  // ---------- drawing ----------

  // The centre of a nation's land (or its seed if it holds nothing).
  function centre(n) {
    var list = ownedBy(n);
    if (!list.length) return { x: n.x, y: n.y };
    var x = 0, y = 0;
    list.forEach(function (p) { x += p.x; y += p.y; });
    return { x: x / list.length, y: y / list.length };
  }
  function pts(poly) { return poly.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '); }

  // The shared edge of two cells, if they share one.
  function sharedEdge(A, B) {
    var common = [];
    A.forEach(function (u) {
      B.forEach(function (v) { if (Math.hypot(u.x - v.x, u.y - v.y) < 1) common.push(u); });
    });
    return common.length >= 2 ? { a: common[0], b: common[1] } : null;
  }

  function dotShape(p) {
    var cls = 'dot dot-' + p.tier + (p.owner < 0 ? ' dot-neutral' : '');
    if (p.tier === 'f') return svgEl('rect', { x: p.x - 9, y: p.y - 9, width: 18, height: 18, 'class': cls });
    var r = { e: 4, v: 5, t: 8, c: 11 }[p.tier];
    return svgEl('circle', { cx: p.x, cy: p.y, r: r, 'class': cls });
  }

  function buildMap() {
    els.svg.innerHTML = '';
    var gCells = svgEl('g'), gTerrain = svgEl('g'), gBorders = svgEl('g');
    var gLines = svgEl('g'), gDots = svgEl('g'), gLabels = svgEl('g');
    st.gBorders = gBorders; st.gDots = gDots;
    st.provs.forEach(function (p) {
      p.el = svgEl('polygon', { points: pts(p.cell) });
      p.el.addEventListener('click', function () {
        if (st.pick && p.owner === 0) pickProvince(p);
        else if (p.owner >= 0) select(p.owner);
      });
      p.titleEl = svgEl('title');
      p.el.appendChild(p.titleEl);
      gCells.appendChild(p.el);
    });
    st.lakes.forEach(function (L) { gTerrain.appendChild(svgEl('circle', { cx: L.x, cy: L.y, r: L.r, 'class': 'lake' })); });
    st.rivers.forEach(function (R) {
      gTerrain.appendChild(svgEl('polyline', { points: R.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '), 'class': 'river' }));
    });
    st.mountains.forEach(function (M) {
      var s = 13;
      var pts3 = (M.x).toFixed(1) + ',' + (M.y - s).toFixed(1) + ' ' + (M.x - s).toFixed(1) + ',' + (M.y + s * 0.7).toFixed(1) +
        ' ' + (M.x + s).toFixed(1) + ',' + (M.y + s * 0.7).toFixed(1);
      gTerrain.appendChild(svgEl('polygon', { points: pts3, 'class': 'mountain' }));
    });
    st.n.forEach(function (n) {
      n.labelEl = svgEl('text', { 'text-anchor': 'middle', 'class': 'nation-label' });
      n.nameEl = svgEl('tspan', { 'font-weight': '800' });
      n.infoEl = svgEl('tspan', { 'dy': '1.3em' });
      n.labelEl.appendChild(n.nameEl);
      n.labelEl.appendChild(n.infoEl);
      gLabels.appendChild(n.labelEl);
    });
    st.lineEls = [];
    for (var i = 0; i < st.n.length; i++) {
      for (var j = i + 1; j < st.n.length; j++) {
        var ln = svgEl('line', { 'class': 'rel' });
        ln.style.display = 'none';
        gLines.appendChild(ln);
        st.lineEls.push({ i: i, j: j, el: ln });
      }
    }
    els.svg.appendChild(gCells);
    els.svg.appendChild(gTerrain);
    els.svg.appendChild(gBorders);
    els.svg.appendChild(gLines);
    els.svg.appendChild(gDots);
    els.svg.appendChild(gLabels);
  }

  // Zoomed in far enough, the province dots and names show. Zoom is continuous: pinch, wheel, or the buttons.
  var DOTS_FROM = 1.6, SCALE_MIN = 1, SCALE_MAX = 4;
  function zoomed() { return st.scale >= DOTS_FROM; }
  function setScale(k, fx, fy) {
    st.scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, k));
    if (fx !== undefined) st.focus = { x: fx, y: fy };
    if (st.scale <= SCALE_MIN) st.focus = null;
  }
  // The view: the whole map at scale 1, or a part of it when zoomed in (the focus is the centre of the view).
  function setView() {
    var w = W / st.scale, h = H / st.scale;
    var fx = st.focus ? st.focus.x : W / 2, fy = st.focus ? st.focus.y : H / 2;
    var vx = Math.max(0, Math.min(W - w, fx - w / 2)), vy = Math.max(0, Math.min(H - h, fy - h / 2));
    st.view = { x: vx, y: vy, w: w, h: h };
    els.svg.setAttribute('viewBox', [vx, vy, w, h].join(' '));
  }

  function drawMap() {
    setView();
    var P = st.provs;
    P.forEach(function (p) {
      p.titleEl.textContent = (p.owner >= 0 ? st.n[p.owner].name + ' · ' : '') + LABEL[p.tier] + ' · ' + FEATURE_NAME[feature(p)] +
        (p.terrain === 'mountain' ? ' · mountain' : '') + ' · defence ' + featureDef(p);
      p.el.setAttribute('class', 'cell ' + (p.owner >= 0 ? 'o' + p.owner : 'neutral') + (p.owner === selected ? ' sel' : ''));
    });
    // Borders: where two provinces of different owners touch, the shared edge is drawn thicker.
    st.gBorders.innerHTML = '';
    P.forEach(function (p) {
      p.adj.forEach(function (q) {
        var Q = P[q];
        if (q < p.id || Q.owner === p.owner) return;
        var e = sharedEdge(p.cell, Q.cell);
        if (e) st.gBorders.appendChild(svgEl('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, 'class': 'border' }));
      });
    });
    st.n.forEach(function (n) {
      var c = centre(n);
      n.cx = c.x; n.cy = c.y;
      n.labelEl.setAttribute('x', c.x);
      n.labelEl.setAttribute('y', c.y);
      n.nameEl.setAttribute('x', c.x);
      n.infoEl.setAttribute('x', c.x);
      n.nameEl.textContent = n.name;
      n.infoEl.textContent = n.alive ? Math.floor(n.soldiers) + ' · ' + stage(ratio(n)) : 'fallen';
    });
    st.lineEls.forEach(function (L) {
      var a = st.n[L.i], b = st.n[L.j], r = rel(L.i, L.j);
      var cls = 'rel', show = false;
      if (a.alive && b.alive) {
        if (r.war) { cls = 'rel war'; show = true; }
        else if (r.ally) { cls = 'rel ally'; show = true; }
        else if (r.trade) { cls = 'rel trade'; show = true; }
      }
      L.el.setAttribute('class', cls);
      L.el.setAttribute('x1', a.cx); L.el.setAttribute('y1', a.cy);
      L.el.setAttribute('x2', b.cx); L.el.setAttribute('y2', b.cy);
      L.el.style.display = show ? '' : 'none';
    });
    // Zoomed in: every province is a dot: an empty dot, a village, a town, a city or a fortress.
    st.gDots.innerHTML = '';
    if (zoomed()) P.forEach(function (p) { st.gDots.appendChild(dotShape(p)); });
    els.zoom.textContent = zoomed() ? '🌍 Back to countries' : '🔍 Zoom in';
    drawMini();
  }

  // The mini map: the whole country map, with a box for the part you are looking at. Tap it to move there.
  function drawMini() {
    els.mini.innerHTML = '';
    st.provs.forEach(function (p) {
      els.mini.appendChild(svgEl('polygon', { points: pts(p.cell), 'class': 'cell mini-cell ' + (p.owner >= 0 ? 'o' + p.owner : 'neutral') }));
    });
    var v = st.view;
    els.mini.appendChild(svgEl('rect', { x: v.x, y: v.y, width: v.w, height: v.h, 'class': 'mini-view' }));
  }

  function drawRes() {
    var p = st.n[0];
    els.res.innerHTML = '';
    [
      ['Soldiers', Math.floor(p.soldiers)], ['Food', Math.floor(p.food)], ['Gold', Math.floor(p.gold)],
      ['Stone', Math.floor(p.stone)], ['Magic', Math.floor(p.magic)], ['Culture', Math.floor(p.culture)],
      ['Unrest', Math.round(p.unrest)], ['Power', Math.round(power(p))], ['Stage', stage(ratio(p)) + ' (' + ratio(p).toFixed(2) + ')']
    ].forEach(function (pair) {
      var c = el('span', 'res-item');
      c.appendChild(el('b', '', pair[0] + ' '));
      c.appendChild(document.createTextNode(String(pair[1])));
      els.res.appendChild(c);
    });
  }

  function drawCard() {
    var n = st.n[selected];
    els.card.innerHTML = '';
    if (!n) { els.card.hidden = true; return; }
    els.card.hidden = false;
    els.card.appendChild(el('h3', '', n.name + (n.id === 0 ? ' (you)' : '') + (n.alive ? '' : ' (fallen)')));
    if (!n.alive) return;
    var R = ratio(n);
    els.card.appendChild(el('p', '', 'Villages ' + n.v + ' · Towns ' + n.t + ' · Cities ' + n.c + ' · Fortresses ' + n.f + ' · Empty dots ' + n.e));
    els.card.appendChild(el('p', '', 'Soldiers ' + Math.floor(n.soldiers) + ' · Power ' + Math.round(power(n)) + ' · ' + stage(R) + ' (ratio ' + R.toFixed(2) + ')'));
    els.card.appendChild(el('p', '', 'Unrest ' + Math.round(n.unrest) + ' · Occupied provinces ' + occupiedOf(n).length));
    if (n.id === 0) {
      var gb = el('div', 'gun-butter');
      var gunLine = el('p', '', '');
      var gunRange = el('input');
      function showGuns() {
        gunLine.textContent = 'Guns ' + Math.round(n.guns * 100) + '% · Butter ' + Math.round((1 - n.guns) * 100) + '%. Guns raise soldiers; butter raises food, which helps culture and population.';
      }
      gunRange.type = 'range'; gunRange.min = 0; gunRange.max = 100; gunRange.step = 10; gunRange.value = Math.round(n.guns * 100);
      gunRange.setAttribute('aria-label', 'Guns or butter');
      gunRange.addEventListener('input', function () { n.guns = Number(gunRange.value) / 100; showGuns(); });
      gunRange.addEventListener('change', function () { render(); });
      showGuns();
      gb.appendChild(gunLine);
      gb.appendChild(gunRange);
      els.card.appendChild(gb);
      if (st.pick) {
        var pk = st.pick;
        var hint = pk.kind === 'build'
          ? 'Tap an empty dot on your land to build a village (' + villageCost(n) + ' ' + pk.pay + ').'
          : 'Tap a ' + LABEL[pk.from] + ' on your land to promote it to a ' + LABEL[GROW[pk.from].to] + '.';
        var hintRow = el('div', 'card-buttons');
        hintRow.appendChild(el('p', 'muted', hint));
        var stop = el('button', 'big', 'Cancel');
        stop.addEventListener('click', function () { st.pick = null; render(); });
        hintRow.appendChild(stop);
        els.card.appendChild(hintRow);
      }
      var vill = el('div', 'card-buttons');
      var vc = villageCost(n);
      var hasEmpty = ownedBy(n).some(function (p) { return p.tier === 'e'; });
      ['food', 'culture'].forEach(function (pay) {
        var vb = el('button', 'big', 'Build a village (' + vc + ' ' + pay + ')');
        vb.disabled = n[pay] < vc || !hasEmpty;
        vb.addEventListener('click', function () { startPick({ kind: 'build', pay: pay }); });
        vill.appendChild(vb);
      });
      els.card.appendChild(vill);
      var grows = el('div', 'card-buttons');
      Object.keys(GROW).forEach(function (k) {
        var m = GROW[k], c = growCost(n, k);
        var cost = c.gold ? c.gold + ' gold' : c.stone + ' stone';
        var b = el('button', 'big', LABEL[k] + ' → ' + LABEL[m.to] + ' (' + cost + ')');
        b.disabled = n[k] < 1;
        b.addEventListener('click', function () { startPick({ kind: 'grow', from: k }); });
        grows.appendChild(b);
      });
      els.card.appendChild(grows);
      return;
    }
    var r = rel(0, n.id);
    var status = r.war ? 'At war' : r.ally ? 'Allied' : r.trade ? 'Trading' : 'At peace';
    els.card.appendChild(el('p', '', 'With you: ' + status + ' · reputation ' + Math.round(r.rep) + (r.truce > 0 ? ' · truce ' + r.truce + ' turns' : '')));
    // The route to them: how far, the rivers, the hostile land on the way, and the tailwind.
    var RT = route(0, selected);
    var rtext;
    if (!RT) rtext = 'Route: no land route (lakes are in the way).';
    else {
      var F = attackFactors(0, RT);
      rtext = 'Route: ' + RT.hops + ' step' + (RT.hops === 1 ? '' : 's') + ', ' + RT.rivers + ' river crossing' + (RT.rivers === 1 ? '' : 's') + '.';
      if (RT.hostile) rtext += ' ' + RT.hostile + ' hostile province' + (RT.hostile === 1 ? '' : 's') + ' on the way (army −' + Math.round(F.chip * 100) + '%).';
      if (F.far) rtext += ' Far away: strength −' + Math.round(F.far * 100) + '%.';
      if (F.tail > 1) rtext += ' Retaking recently lost land: strength +25%.';
      if (RT.dist > MAX_DIST) rtext += ' Too far away to attack (the limit is ' + MAX_DIST + ' steps).';
    }
    els.card.appendChild(el('p', 'muted small', rtext));
    // The send slider: the share of your army an attack will use. The last value is remembered.
    var pick = el('div', 'send-pick');
    var sendLine = el('p', '', '');
    var range = el('input');
    function showSend() {
      sendLine.textContent = 'Send ' + sendPct + '% of your army (' + Math.floor(st.n[0].soldiers * sendPct / 100) + ' soldiers) when you attack.';
    }
    range.type = 'range'; range.min = 5; range.max = 100; range.step = 5; range.value = sendPct;
    range.setAttribute('aria-label', 'Share of your army to send');
    range.addEventListener('input', function () { sendPct = Number(range.value); showSend(); });
    range.addEventListener('change', function () { savePct(sendPct); render(); });
    showSend();
    pick.appendChild(sendLine);
    pick.appendChild(range);
    els.card.appendChild(pick);
    var q = st.queue.filter(function (x) { return x.from === 0 && x.to === selected; })[0];
    var row = el('div', 'card-buttons');
    var notes = [];
    DIPLO.forEach(function (d) {
      var err = canDo(d.type, 0, selected);
      if (q && q.type === d.type) {
        var cancel = el('button', 'big', 'Queued: ' + d.text + (d.type === 'attack' ? ' (' + q.pct + '%)' : '') + ' (tap to cancel)');
        cancel.addEventListener('click', function () { removeQueued(0, selected); addLog('Cancelled.'); render(); });
        row.appendChild(cancel);
        return;
      }
      var b = el('button', 'big', d.type === 'attack' ? 'Attack (send ' + sendPct + '%)' : d.text);
      b.disabled = !!err || !!q;
      if (err) notes.push(d.text + ': ' + err);
      b.addEventListener('click', function () { queue(d.type, selected); render(); });
      row.appendChild(b);
    });
    els.card.appendChild(row);
    notes.forEach(function (t) { els.card.appendChild(el('p', 'muted small', t)); });
  }

  function drawLog() {
    els.log.innerHTML = '';
    st.log.slice(-8).reverse().forEach(function (t) { els.log.appendChild(el('li', '', t)); });
  }

  function render() {
    if (!st) return;
    var queued = st.queue.filter(function (x) { return x.from === 0; }).length;
    els.status.textContent = st.over === 'won' ? 'You win!'
      : st.over === 'lost' ? 'Your nation has fallen.'
      : 'Turn ' + st.turn + ' · ' + queued + ' action' + (queued === 1 ? '' : 's') + ' queued';
    els.clock.textContent = st.over ? '—' : Math.max(0, Math.ceil(st.clock)) + 's';
    els.ready.disabled = !!st.over;
    drawRes();
    drawMap();
    drawCard();
    drawLog();
  }

  function select(id) { selected = id; render(); }

  // Choosing which province to build on or promote: the map is zoomed in on your land, and the next province tapped is used.
  function startPick(pk) {
    st.pick = pk;
    if (!zoomed()) setScale(2.4, centre(st.n[0]).x, centre(st.n[0]).y);
    addLog('Tap a province on your land on the map.');
    render();
  }
  function pickProvince(p) {
    var pk = st.pick, n = st.n[0];
    var err = pk.kind === 'build' ? buildAt(n, p, pk.pay) : growAt(n, p, pk.from);
    if (err) { addLog(err); render(); return; }
    addLog(pk.kind === 'build' ? 'A new village was built on that dot.' : 'A ' + LABEL[pk.from] + ' was promoted to a ' + LABEL[GROW[pk.from].to] + '.');
    st.pick = null;
    render();
  }

  // ---------- screens and timer ----------

  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (!st || st.over) return;
      st.clock -= 1;
      if (st.clock <= 0) resolveTurn();
      else render();
    }, 1000);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function openCountry() {
    document.querySelectorAll('.screen').forEach(function (s) { s.hidden = s.id !== 'screen-country'; });
    if (!st) newGame();
    render();
    startTimer();
    window.scrollTo(0, 0);
  }
  function backHome() {
    stopTimer();
    document.querySelectorAll('.screen').forEach(function (s) { s.hidden = s.id !== 'screen-home'; });
  }

  els.svg = $('country-svg');
  els.res = $('country-res');
  els.card = $('country-card');
  els.log = $('country-log');
  els.status = $('country-status');
  els.clock = $('country-clock');
  els.ready = $('country-ready');
  els.zoom = $('country-zoom');
  els.mini = $('country-mini');

  $('btn-country').addEventListener('click', openCountry);
  $('country-back').addEventListener('click', backHome);
  $('country-new').addEventListener('click', function () { newGame(); render(); startTimer(); });
  els.ready.addEventListener('click', resolveTurn);
  // Zoom in on the selected nation's land (or back out to the whole country).
  els.zoom.addEventListener('click', function () {
    if (zoomed()) setScale(1);
    else if (st.n[selected] && st.n[selected].alive) { var c = centre(st.n[selected]); setScale(2.4, c.x, c.y); }
    else setScale(2.4, W / 2, H / 2);
    render();
  });
  // The mini map: tap a place to look at it, zoomed in.
  els.mini.addEventListener('click', function (e) {
    var rect = els.mini.getBoundingClientRect();
    setScale(Math.max(st.scale, 2.4), (e.clientX - rect.left) / rect.width * W, (e.clientY - rect.top) / rect.height * H);
    render();
  });
  // The floating ⚙️ reset: back to the country view.
  document.addEventListener('ew:reset-zoom', function () { if (st) { setScale(1); render(); } });

  // Zoom inside the canvas: two fingers pinch, the wheel zooms, and the page itself does not zoom.
  var pinch = null;
  function touchPoint(t) {
    var rect = els.svg.getBoundingClientRect();
    return { x: (t.clientX - rect.left) / rect.width * W, y: (t.clientY - rect.top) / rect.height * H };
  }
  els.svg.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      var a = e.touches[0], b = e.touches[1];
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, k: st.scale };
    }
  }, { passive: true });
  els.svg.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    var a = e.touches[0], b = e.touches[1];
    var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    var mid = touchPoint({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
    setScale(pinch.k * d / pinch.d, mid.x, mid.y);
    render();
  }, { passive: false });
  els.svg.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
  els.svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var m = touchPoint(e);
    setScale(st.scale * Math.exp(-e.deltaY * 0.0015), m.x, m.y);
    render();
  }, { passive: false });
})();
