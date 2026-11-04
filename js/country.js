// Expansion Wars — version 2: the country layer.
// Nations are regions on a country map. Each nation holds provinces: villages, towns, cities and fortresses.
// A turn lasts 60 seconds. Everyone queues actions, and they play out together when the turn ends or on Ready.
// Country battles are resolved here. Linking them to the province game is a later step.
(function () {
  'use strict';

  var W = 1000, H = 640, TURN = 60, COUNT = 6, SVG_NS = 'http://www.w3.org/2000/svg';
  var NAMES = ['Your nation', 'Oakfield', 'Riverton', 'Stonevale', 'Mirewood', 'Highmoor'];
  var MIN_REP = { trade: -20, ally: 20, ceasefire: -40 };
  var TRADE_SETUP = 20;   // gold paid once by the nation that opens a trade route; the route then pays gold each turn
  var TRIBUTE = 10, SEND = 0.5, DEFENDER = 1.2, FORT_BONUS = 0.2;
  // Growing a spot: village to town and town to city cost gold, city to fortress costs stone.
  var GROW = { v: { to: 't', gold: 10 }, t: { to: 'c', gold: 20 }, c: { to: 'f', stone: 15 } };
  var LABEL = { v: 'village', t: 'town', c: 'city', f: 'fortress' };
  var DIPLO = [
    { type: 'trade', text: 'Trade route (' + TRADE_SETUP + ' gold to set up)' },
    { type: 'ally', text: 'Neutral alliance' },
    { type: 'ceasefire', text: 'Ceasefire' },
    { type: 'tribute', text: 'Send tribute (' + TRIBUTE + ' gold)' },
    { type: 'declare', text: 'Declare war' },
    { type: 'attack', text: 'Attack' }
  ];

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

  // Voronoi regions for the nations (same method as the province maps).
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

  // ---------- nations, relations and power ----------

  function key(i, j) { return i < j ? i + '-' + j : j + '-' + i; }
  function rel(i, j) {
    var k = key(i, j);
    if (!st.rel[k]) st.rel[k] = { war: false, trade: false, ally: false, truce: 0, rep: 0 };
    return st.rel[k];
  }
  function alive() { return st.n.filter(function (n) { return n.alive; }); }
  function spots(n) { return n.v + n.t + n.c + n.f; }
  function quality(n) { return 1 + (n.tech + n.morale + n.happy) / 300; }
  // Power = population density (weighted by spot type) x quality x soldiers. See convo v0.8.
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
  function atWar(i) {
    return st.n.some(function (j) { return j.id !== i && j.alive && rel(i, j.id).war; });
  }
  function tradeCount(i) {
    return st.n.filter(function (j) { return j.id !== i && j.alive && rel(i, j.id).trade; }).length;
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
    }
    return null;
  }

  // Upgrades get dearer as a nation holds more spots: each spot adds 10% to the base cost.
  function growCost(n, from) {
    var m = GROW[from], f = 1 + 0.1 * spots(n);
    return { gold: m.gold ? Math.ceil(m.gold * f) : 0, stone: m.stone ? Math.ceil(m.stone * f) : 0 };
  }

  // Villages are built by hand, paid in food or culture. 40 at five spots, rising by 4 for each spot beyond five.
  function villageCost(n) { return Math.ceil(40 * (1 + 0.1 * (spots(n) - 5))); }

  function buildVillage(n, pay) {
    var c = villageCost(n);
    if (n[pay] < c) return 'Not enough ' + pay + ' (' + c + ').';
    n[pay] -= c;
    n.v++;
    return null;
  }

  // Spend resources to grow one of your spots. Happens at once.
  function grow(n, from) {
    var m = GROW[from];
    if (!m) return 'That cannot grow.';
    if (n[from] < 1) return 'No ' + LABEL[from] + ' to grow.';
    var c = growCost(n, from);
    if (c.gold && n.gold < c.gold) return 'Not enough gold (' + c.gold + ').';
    if (c.stone && n.stone < c.stone) return 'Not enough stone (' + c.stone + ').';
    n.gold -= c.gold;
    n.stone -= c.stone;
    n[from]--;
    n[m.to]++;
    var dd = (n.dots || []).filter(function (d) { return d.k === from; })[0];
    if (dd) dd.k = m.to;   // the centre on the map becomes a town or city
    return null;
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

  // Take one spot from the loser. A captured spot drops one grade (fortress to city, city to town, town to village).
  // Villages fall first and fortresses last, so a fortress holds out the longest.
  function takeSpot(from, to) {
    var g0, key2;
    if (from.v > 0) { from.v--; g0 = 'v'; key2 = 'v'; }
    else if (from.t > 0) { from.t--; g0 = 't'; key2 = 'v'; }
    else if (from.c > 0) { from.c--; g0 = 'c'; key2 = 't'; }
    else if (from.f > 0) { from.f--; g0 = 'f'; key2 = 'c'; }
    else return null;
    to[key2]++;
    // A conquered spot produces less until it is re-incorporated. It remembers its old owner, for a revolt.
    to.occupied.push({ t: RESTORE_TURNS, from: from.id, g: g0, k: key2 });
    return LABEL[key2];
  }

  // Culture comes only from battle victories. The spot fought over sets the amount: a fortress gives 4, anything smaller 1.
  var CULTURE = { v: 1, t: 1, c: 1, f: 4 };
  // Conquered spots: their production drops by OCC_PENALTY (as a share of the nation) and recovers after RESTORE_TURNS.
  var OCC_PENALTY = 0.4, RESTORE_TURNS = 10;
  function prodFactor(n) {
    var occ = n.occupied.length / Math.max(1, spots(n));
    return 1 - OCC_PENALTY * Math.min(1, occ);
  }
  // The highest grade a nation holds: the spot a battle is fought over.
  // The grade of the spot a battle would take first (the weakest one), which sets the culture earned.
  function weakestGrade(n) { return n.v > 0 ? 'v' : n.t > 0 ? 't' : n.c > 0 ? 'c' : 'f'; }

  // A country battle runs in three waves. The chosen share of the attacker's soldiers is split across them.
  // Each wave is a fight: the defenders have an advantage, so casualties split by strength, not all or nothing.
  // After the waves, if the attacker's power is at least 10 times the defence, the defenders capitulate at once.
  // Otherwise the spot falls only if the attackers still standing are stronger than the defenders still standing.
  // Overpowered: at twice the defence, the defenders surrender. The attacker takes one spot for each whole point of
  // power over the defence, up to all of them (so 10 to 1 takes everything).
  var WAVES = 3, SURRENDER = 2;
  var SPOT_COST = 10;   // soldiers an attacker spends per population centre; spent soldiers move the border
  function battle(x) {
    var i = x.from, j = x.to, a = st.n[i], b = st.n[j];
    if (!rel(i, j).war || !a.alive || !b.alive) return;
    var sent0 = Math.floor(a.soldiers * (x.pct || SEND * 100) / 100);
    if (sent0 < 1) return;
    // Unrest costs both ways: one soldier in every 20 unrest is lost before the march, and unrest cuts the strength of the attack.
    var flat = Math.min(sent0 - 1, Math.ceil(a.unrest / 20));
    var sent = sent0 - flat;
    // Magic is used up by the attack: each point adds 1% to its strength, then the magic is gone.
    var bonus = (1 + a.magic / 100) / (1 + a.unrest / 200);
    a.magic = 0;
    var spotsBefore = spots(b);
    var power = sent * quality(a) * bonus;
    var defence = b.soldiers * quality(b) * (1 + FORT_BONUS * b.f) * DEFENDER;
    var grade = weakestGrade(b);
    var pool = sent, d = b.soldiers;
    a.soldiers -= sent0;
    for (var k = 0; k < WAVES && pool >= 1 && d > 0; k++) {
      var w = pool / (WAVES - k);                     // this wave's share of the attackers still standing
      var A = w * quality(a) * bonus;
      var D = d * quality(b) * (1 + FORT_BONUS * b.f) * DEFENDER;
      pool -= w * D / (A + D);                        // attackers lost, in proportion to the defence
      d -= d * A / (A + D);                           // defenders lost, in proportion to the attack
    }
    var ratio = power / defence;
    var got = null;
    if (ratio >= SURRENDER) {
      var take = Math.min(spots(b), Math.floor(ratio));
      var taken = [];
      for (var s = 0; s < take; s++) {
        var g = takeSpot(b, a);
        if (g) taken.push(g);
      }
      got = taken.length ? taken.join(', ') : null;
      a.soldiers += pool + Math.max(0, d);            // the defenders who are left surrender to you
      b.soldiers = 0;
      addLog(b.name + ' surrenders to ' + a.name + (got ? ', giving up ' + taken.length + ' spot' + (taken.length === 1 ? '' : 's') + ' (' + got + ').' : '.'));
    } else if (pool * quality(a) * bonus > d * quality(b) * (1 + FORT_BONUS * b.f) * DEFENDER && pool > 0) {
      got = takeSpot(b, a);
      b.soldiers = Math.max(0, d);
      a.soldiers += pool;                              // survivors come home
      addLog(a.name + ' wins against ' + b.name + (got ? ' and takes a ' + got + '.' : '.'));
    } else {
      b.soldiers = Math.max(0, d);
      a.soldiers += Math.max(0, pool);
      addLog(b.name + ' holds against ' + a.name + '.');
    }
    // The border moves toward the defeated nation. Soldiers spent on spots move it, up to a third of the attacking force.
    var lost = spotsBefore - spots(b);
    var spent = Math.min(sent - pool, sent / 3);
    var share = Math.min(0.5, Math.floor(spent / SPOT_COST) * 0.08 + (lost > 0 ? 0.02 : 0));
    if (share > 0) moveCentre(a, b, share);
    if (got) {
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
        // Attack the weakest foe, neighbours first, as soon as the army is at least level with it.
        var near = foes.filter(function (b) { return a.nb.indexOf(b.id) >= 0; });
        var pool2 = near.length ? near : foes;
        var weakest = pool2.slice().sort(function (p, q) { return p.soldiers * quality(p) - q.soldiers * quality(q); })[0];
        if (a.soldiers >= weakest.soldiers) st.queue.push({ type: 'attack', from: a.id, to: weakest.id });
      } else if (!a.neutral && Math.random() < 0.25) {
        // A stronger neighbour declares war: a 20% lead is enough now (it was 80%).
        var prey = a.nb.map(function (id) { return st.n[id]; }).filter(function (b) {
          return b.alive && !rel(a.id, b.id).war && power(a) >= 1.2 * power(b);
        });
        if (prey.length) st.queue.push({ type: 'declare', from: a.id, to: prey[0].id });
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

  function economy(n) {
    n.occupied = n.occupied.map(function (e) { return { from: e.from, g: e.g, k: e.k, t: e.t - 1 }; })
      .filter(function (e) { return e.t > 0; });
    var pf = prodFactor(n);
    var produced = (2 * n.v + 3 * n.t + 3 * n.c + 2 * n.f) * (1.5 - n.guns) * pf;
    var upkeep = n.soldiers * 0.02;
    var foodNet = produced - upkeep;
    n.food += foodNet;
    if (n.food < 0) { n.soldiers *= 0.97; n.food = 0; }
    n.gold += (0.5 * n.v + n.t + 2 * n.c) * pf + 3 * tradeCount(n.id);
    // Stone comes from cities (1 a turn each) and from trade routes (1 a turn each).
    n.stone += n.c + tradeCount(n.id);
    // Magic is gathered from every spot, and higher tiers gather more: village 0.05, town 0.1, city 0.2, fortress 0.4 a turn.
    // The base trickle from technology stays as before.
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
    // Unrest: long wars, several wars, too little butter (food), no trade and allies that are at war push it up.
    // Peace with food brings it down. At 70 or more a spot may revolt (certain at 90).
    var wars = st.n.filter(function (j) { return j.id !== n.id && j.alive && rel(n.id, j.id).war; }).length;
    n.warTurns = wars ? n.warTurns + 1 : 0;
    var allyAtWar = st.n.filter(function (j) { return j.id !== n.id && j.alive && rel(n.id, j.id).ally && atWar(j.id); }).length;
    var up = (n.warTurns > 10 ? 1.5 : wars ? 0.5 : 0) + 0.5 * Math.max(0, wars - 1) + (n.food < 20 ? 1 : 0) +
      (tradeCount(n.id) === 0 ? 0.5 : 0) + 0.5 * allyAtWar;
    var down = wars === 0 && n.food >= 20 ? 1 : 0;
    n.unrest = Math.max(0, Math.min(100, n.unrest + up - down));
    if (n.unrest >= 70 && n.occupied.length && Math.random() < (n.unrest >= 90 ? 1 : 0.3)) revolt(n);
    n.tech = Math.min(100, n.tech + 0.5 + 0.1 * (n.c + n.f));
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
    drift();
    // Trade and alliances build reputation. A ceasefire counts down.
    Object.keys(st.rel).forEach(function (k) {
      var r = st.rel[k];
      if (r.trade) r.rep = Math.min(100, r.rep + 1);
      if (r.ally) r.rep = Math.min(100, r.rep + 1);
      if (r.truce > 0) r.truce--;
    });
    // A nation with no spots left has fallen; its wars and treaties end.
    st.n.forEach(function (n) {
      if (n.alive && spots(n) === 0) {
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

  // Area of a region (shoelace formula).
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

  // A random point inside a region.
  function randomIn(poly) {
    var xs = poly.map(function (p) { return p.x; }), ys = poly.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    for (var t = 0; t < 200; t++) {
      var p = { x: rnd(x0, x1), y: rnd(y0, y1) };
      if (inPoly(p, poly)) return p;
    }
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  }

  // One dot per population centre: keep each nation's dots in step with its villages, towns, cities and fortresses.
  function syncDots(n) {
    if (!n.dots) n.dots = [];
    ['v', 't', 'c', 'f'].forEach(function (k) {
      var have = n.dots.filter(function (d) { return d.k === k; });
      while (have.length > n[k]) {
        var gone = have.pop();
        n.dots.splice(n.dots.indexOf(gone), 1);
      }
      while (have.length < n[k]) {
        var p = randomIn(n.poly), d = { k: k, x: p.x, y: p.y };
        n.dots.push(d);
        have.push(d);
      }
    });
    // A dot left outside its nation's land (after the border moved) moves inside it.
    n.dots.forEach(function (d) {
      if (!inPoly(d, n.poly)) {
        var p = randomIn(n.poly);
        d.x = p.x;
        d.y = p.y;
      }
    });
  }

  // Regions come from the nations' centres; the same centres give who borders whom.
  function geometry() {
    var polys = voronoi(st.n.map(function (n) { return { x: n.x, y: n.y }; }));
    st.n.forEach(function (n, i) { n.poly = polys[i]; n.nb = []; });
    for (var a = 0; a < st.n.length; a++) {
      for (var b = a + 1; b < st.n.length; b++) {
        if (sharesEdge(polys[a], st.n[a], st.n[b])) {
          st.n[a].nb.push(b);
          st.n[b].nb.push(a);
        }
      }
    }
  }

  // The border moves: a nation's centre moves toward another's by a share of the distance between them.
  function moveCentre(a, b, share) {
    a.x += (b.x - a.x) * share;
    a.y += (b.y - a.y) * share;
  }

  // Borders drift every turn, faster at war. Centres keep a minimum distance from each other.
  function drift() {
    alive().forEach(function (n) {
      var step = atWar(n.id) ? 10 : 4;
      var ang = Math.random() * Math.PI * 2;
      var nx = Math.max(60, Math.min(W - 60, n.x + Math.cos(ang) * step));
      var ny = Math.max(60, Math.min(H - 60, n.y + Math.sin(ang) * step));
      var clear = st.n.every(function (k) { return k.id === n.id || Math.hypot(k.x - nx, k.y - ny) >= 50; });
      if (clear) { n.x = nx; n.y = ny; }
    });
    geometry();
  }

  // A revolt returns a conquered spot to its old owner, or to neutral if that owner has fallen.
  function revolt(n) {
    var e = n.occupied.splice(Math.floor(Math.random() * n.occupied.length), 1)[0];
    if (n[e.k] > 0) n[e.k]--;
    var old = st.n[e.from];
    if (old.alive) {
      old[e.g]++;
      addLog(n.name + ' revolts: a ' + LABEL[e.g] + ' goes back to ' + old.name + '.');
    } else {
      addLog(n.name + ' revolts: a spot goes neutral.');
    }
    n.unrest = Math.max(0, n.unrest - 15);
  }

  function newGame() {
    var seeds = [], minD = 0.55 * Math.sqrt(W * H / COUNT);
    for (var t = 0; seeds.length < COUNT && t < 4000; t++) {
      var p = { x: rnd(80, W - 80), y: rnd(80, H - 80) };
      if (seeds.every(function (q) { return dist(p, q) >= minD; })) seeds.push(p);
    }
    st = { turn: 1, clock: TURN, rel: {}, n: [], queue: [], log: [], over: null, zoomed: false };
    seeds.forEach(function (p, i) {
      st.n.push({
        id: i, name: NAMES[i], x: p.x, y: p.y, poly: [], nb: [], alive: true,
        neutral: i >= 3,   // the last three start neutral: they defend, but do not start wars
        v: 4, t: 1, c: 0, f: 0, soldiers: 40, tech: 10, morale: 50, happy: 50, guns: 0.5, occupied: [],
        food: 20, gold: 30, stone: 10, magic: 0, culture: 0, unrest: 0, warTurns: 0, dots: []
      });
    });
    geometry();
    // Start counts depend on size: a bigger region starts with more villages (2 to 7), a smaller one with fewer.
    st.n.forEach(function (n) {
      n.v = Math.max(2, Math.min(7, Math.round(4 * polyArea(n.poly) / (W * H / COUNT))));
      syncDots(n);
    });
    rel(1, 2).war = true;
    addLog('The country is at peace, except ' + NAMES[1] + ' and ' + NAMES[2] + ', who are at war.');
    addLog('Each turn is 60 seconds. Pick a nation to act, then press Ready.');
    selected = 0;
    buildMap();
    render();
  }

  // ---------- drawing ----------

  function buildMap() {
    els.svg.innerHTML = '';
    var gRegions = svgEl('g'), gLines = svgEl('g'), gDots = svgEl('g'), gLabels = svgEl('g');
    st.gDots = gDots;
    st.n.forEach(function (n) {
      n.polyEl = svgEl('polygon', {
        points: n.poly.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ')
      });
      n.polyEl.addEventListener('click', function () { select(n.id); });
      gRegions.appendChild(n.polyEl);
      n.labelEl = svgEl('text', { x: n.x, y: n.y, 'text-anchor': 'middle', 'class': 'nation-label' });
      n.nameEl = svgEl('tspan', { x: n.x, dy: '-0.3em', 'font-weight': '800' });
      n.infoEl = svgEl('tspan', { x: n.x, dy: '1.3em' });
      n.labelEl.appendChild(n.nameEl);
      n.labelEl.appendChild(n.infoEl);
      gLabels.appendChild(n.labelEl);
    });
    st.lineEls = [];
    for (var i = 0; i < st.n.length; i++) {
      for (var j = i + 1; j < st.n.length; j++) {
        var ln = svgEl('line', {
          x1: st.n[i].x, y1: st.n[i].y, x2: st.n[j].x, y2: st.n[j].y, 'class': 'rel'
        });
        ln.style.display = 'none';
        gLines.appendChild(ln);
        st.lineEls.push({ i: i, j: j, el: ln });
      }
    }
    els.svg.appendChild(gRegions);
    els.svg.appendChild(gLines);
    els.svg.appendChild(gDots);
    els.svg.appendChild(gLabels);
  }

  // A population centre on the zoomed map: villages are small dots, towns and cities bigger, fortresses squares.
  function dotShape(d) {
    if (d.k === 'f') return svgEl('rect', { x: d.x - 9, y: d.y - 9, width: 18, height: 18, 'class': 'dot dot-f' });
    var r = { v: 4, t: 7, c: 10 }[d.k];
    return svgEl('circle', { cx: d.x, cy: d.y, r: r, 'class': 'dot dot-' + d.k });
  }

  function drawMap() {
    st.n.forEach(function (n) {
      n.polyEl.setAttribute('points', n.poly.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '));
      n.polyEl.setAttribute('class', 'cell ' + (n.alive ? 'o' + n.id : 'neutral') + (n.id === selected ? ' sel' : ''));
      n.labelEl.setAttribute('x', n.x);
      n.labelEl.setAttribute('y', n.y);
      n.nameEl.setAttribute('x', n.x);
      n.infoEl.setAttribute('x', n.x);
      n.nameEl.textContent = n.name;
      n.infoEl.textContent = n.alive ? Math.floor(n.soldiers) + ' · ' + stage(ratio(n)) : 'fallen';
    });
    st.gDots.innerHTML = '';
    st.n.forEach(function (n) {
      if (!n.alive) return;
      syncDots(n);
      if (st.zoomed) n.dots.forEach(function (d) { st.gDots.appendChild(dotShape(d)); });
    });
    els.zoom.textContent = st.zoomed ? '🌍 Back to countries' : '🔍 Zoom in';
    st.lineEls.forEach(function (L) {
      var a = st.n[L.i], b = st.n[L.j], r = rel(L.i, L.j);
      L.el.setAttribute('x1', a.x); L.el.setAttribute('y1', a.y);
      L.el.setAttribute('x2', b.x); L.el.setAttribute('y2', b.y);
      var cls = 'rel', show = false;
      if (a.alive && b.alive) {
        if (r.war) { cls = 'rel war'; show = true; }
        else if (r.ally) { cls = 'rel ally'; show = true; }
        else if (r.trade) { cls = 'rel trade'; show = true; }
      }
      L.el.setAttribute('class', cls);
      L.el.style.display = show ? '' : 'none';
    });
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
    els.card.appendChild(el('p', '', 'Villages ' + n.v + ' · Towns ' + n.t + ' · Cities ' + n.c + ' · Fortresses ' + n.f));
    els.card.appendChild(el('p', '', 'Soldiers ' + Math.floor(n.soldiers) + ' · Power ' + Math.round(power(n)) + ' · ' + stage(R) + ' (ratio ' + R.toFixed(2) + ')'));
    els.card.appendChild(el('p', '', 'Unrest ' + Math.round(n.unrest) + ' · Occupied spots ' + n.occupied.length));
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
      var vill = el('div', 'card-buttons');
      var vc = villageCost(n);
      ['food', 'culture'].forEach(function (pay) {
        var vb = el('button', 'big', 'Build a village (' + vc + ' ' + pay + ')');
        vb.disabled = n[pay] < vc;
        vb.addEventListener('click', function () {
          var err = buildVillage(n, pay);
          addLog(err || 'A new village was built with ' + pay + '.');
          render();
        });
        vill.appendChild(vb);
      });
      els.card.appendChild(vill);
      var grows = el('div', 'card-buttons');
      Object.keys(GROW).forEach(function (k) {
        var m = GROW[k], c = growCost(n, k);
        var cost = c.gold ? c.gold + ' gold' : c.stone + ' stone';
        var b = el('button', 'big', LABEL[k] + ' → ' + LABEL[m.to] + ' (' + cost + ')');
        b.disabled = n[k] < 1;
        b.addEventListener('click', function () {
          var err = grow(n, k);
          addLog(err || 'A ' + LABEL[k] + ' grew into a ' + LABEL[m.to] + '.');
          render();
        });
        grows.appendChild(b);
      });
      els.card.appendChild(grows);
      return;
    }
    var r = rel(0, n.id);
    var status = r.war ? 'At war' : r.ally ? 'Allied' : r.trade ? 'Trading' : 'At peace';
    els.card.appendChild(el('p', '', 'With you: ' + status + ' · reputation ' + Math.round(r.rep) + (r.truce > 0 ? ' · truce ' + r.truce + ' turns' : '')));
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

  $('btn-country').addEventListener('click', openCountry);
  $('country-back').addEventListener('click', backHome);
  $('country-new').addEventListener('click', function () { newGame(); render(); startTimer(); });
  els.ready.addEventListener('click', resolveTurn);
  els.zoom.addEventListener('click', function () { st.zoomed = !st.zoomed; render(); });
  // The floating ⚙️ reset: back to the country view.
  document.addEventListener('ew:reset-zoom', function () { if (st) { st.zoomed = false; render(); } });
})();
