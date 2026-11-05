// Expansion Wars — screens, game rules, computer players, drawing, input,
// progression, scoring, notes, the family sync panel and the saved-maps list.
(function () {
  'use strict';

  var M = window.ExpansionMap;
  var S = window.XWStore;
  var SPEED = 120;   // map units per second for marching soldiers
  var HIT = 46;      // tap radius around a spot (map units)
  var SEND_STEPS = [0.1, 0.25, 0.5, 1];   // share of a spot's soldiers sent per drop
  var LEVELS_AI = {
    easy:   { every: 3.0, fraction: 0.4, threshold: 10, perMinute: 6 },
    normal: { every: 1.8, fraction: 0.6, threshold: 7,  perMinute: 10 },
    hard:   { every: 1.0, fraction: 0.7, threshold: 5,  perMinute: 16 }
  };
  // City tiers: growth rate (soldiers per second), garrison cap, and the soldiers it costs to reach the tier.
  // Each cost is 50% of that tier's cap.
  // secs = how long the upgrade to this tier takes. The spot's army does not grow meanwhile.
  var CITY_LEVELS = [
    { name: 'village',    rate: 1.5, cap: 20, cost: 0,  secs: 0 },
    { name: 'town',       rate: 2.0, cap: 40, cost: 20, secs: 5 },
    { name: 'city',       rate: 2.6, cap: 60, cost: 30, secs: 10 },
    { name: 'metropolis', rate: 3.2, cap: 100, cost: 50, secs: 20 }
  ];
  var FORT_CONVERT_SECS = 40;   // a metropolis takes this long to become a fortress
  var SURRENDER_RATIO = 10;     // outnumbered this many to one, a team gives up (when Surrender is on)
  var MAX_ZOOM = 2.5;
  var ZOOM_STEP = 1.25;
  // Fortress levels: garrison cap, range (map units), and damage (soldiers a second to enemies in range).
  // cost = 50% of the next level's cap; secs = how long the step takes.
  var FORT_LEVELS = [
    { cap: 120, range: 120, dmg: 2, cost: 0,   secs: 0 },
    { cap: 160, range: 140, dmg: 4, cost: 80,  secs: 80 },
    { cap: 200, range: 160, dmg: 6, cost: 100, secs: 160 }
  ];
  var MUSH_CAP = 20;   // a mushroom is the smallest village: it stops growing at this garrison
  var FORT_CONVERT_COST = 60;   // soldiers to turn a metropolis into a fortress (50% of the first fortress cap)
  var AVATARS = ['🐥', '🦆', '🐻', '🐿️', '🐭', '🦡'];   // one per player: chick, duckling, bear, gopher, mouse, badger
  var ICON = { factory: '🍄', city: '🏰', fortress: '🏯' };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var SHOP = [
    { name: 'Cities 🏰', desc: 'Bigger garrisons and faster soldiers. Found from Level 1.', status: 'in' },
    { name: 'City upgrades', desc: 'Tap your city to upgrade it: village, town, city, metropolis. Each tier grows faster and holds more.', status: 'in' },
    { name: 'Fortresses 🏯', desc: 'Strong stone spots. Reinforce them from your other spots.', status: 'in' },
    { name: 'Five more maps', desc: 'Levels 5 to 9: bigger fields you scroll over, with more spots and cities.', status: 'in' },
    { name: 'Levels 10 to 15', desc: 'Multiplayer only: 4 to 6 flags on denser maps, with zoom and a minimap.', status: 'in' },
    { name: 'Zoom and minimap', desc: 'Zoom with + and −, Fit, or two fingers. The minimap shows where you are when the field scrolls.', status: 'in' },
    { name: 'Surrender', desc: 'Turn it on in ⚙️. A side outnumbered 10 to 1 gives up.', status: 'in' },
    { name: 'Lakes 💧', desc: 'Water that soldiers cannot cross. Found from Level 2.', status: 'in' },
    { name: 'Voronoi maps', desc: 'Every map is a new layout of regions.', status: 'in' },
    { name: 'Send 10 to 100%', desc: 'Choose how much of a spot sends at once.', status: 'in' },
    { name: 'Routes through your own spots', desc: 'Soldiers march through your spots to reach a far target or reinforce one.', status: 'in' },
    { name: 'Fights on the road', desc: 'Soldiers marching toward each other fight when they meet.', status: 'in' },
    { name: 'Team mode', desc: 'Some levels play in fair teams: Levels 4, 6 and 8.', status: 'in' },
    { name: 'Speed boosts', desc: 'Regions that send soldiers faster.', status: 'soon' },
    { name: 'Defense boosts', desc: 'Regions with stronger garrisons.', status: 'soon' },
    { name: 'Towers that shoot', desc: 'Defenders that hit marching soldiers.', status: 'soon' },
    { name: 'Spells', desc: 'One-time powers for a sudden push.', status: 'soon' },
    { name: 'Quick Game', desc: 'A smaller map for a short game.', status: 'soon' }
  ];

  function $(id) { return document.getElementById(id); }

  var els = {
    board: $('board'), roads: $('roads'), nodes: $('nodes'), armies: $('armies'),
    status: $('status'), overlay: $('overlay'), winTitle: $('win-title'), winText: $('win-text'),
    winStars: $('win-stars'), winNext: $('win-next'), winRetry: $('win-retry'), winMap: $('win-map'),
    panel: $('panel'), gear: $('gear'), errors: $('errors'), errorsToggle: $('errors-toggle'),
    sound: $('sound'), newmap: $('newmap'), segAi: $('seg-ai'),
    noteText: $('note-text'), noteSave: $('note-save'), noteStatus: $('note-status'),
    openMaps: $('open-maps'), maps: $('maps'), mapsList: $('maps-list'), mapsClose: $('maps-close'),
    btnPlay: $('btn-play'), btnMap: $('btn-map'), btnShop: $('btn-shop'), btnScores: $('btn-scores'),
    btnHome: $('btn-home'), path: $('path'), mapNote: $('map-note'),
    shopList: $('shop-list'), bestLevels: $('best-levels'), scoreList: $('score-list'),
    syncPill: $('sync-pill'), syncMsg: $('sync-msg'), familyForm: $('family-form'),
    familyEmail: $('family-email'), familyPass: $('family-pass'), familySync: $('family-sync'),
    familyCheck: $('family-check'), familySignout: $('family-signout'), familyResult: $('family-result'),
    pctBtn: $('pct-btn'), popBar: $('pop-bar'), countdown: $('countdown'),
    minimap: $('minimap'), mmSvg: $('mm-svg'), mmView: $('mm-view'), surrenderToggle: $('surrender-toggle')
  };

  var g = {
    level: 1,
    ai: 'normal',
    teamMode: false,   // on for levels that have teams
    teamCount: 0,      // number of teams in this game
    teamSize: 1,       // players per team (players / teams)
    W: M.W, H: M.H,    // size of the field in map units (bigger on the scrolling levels)
    cam: { x: 0, y: 0 },   // how far the field is panned, in screen pixels
    pan: null,         // a pan in progress: where the finger started
    touches: {},       // pointers on the board, by id, with their screen positions
    pinch: null,       // a two-finger zoom in progress
    zoom: 1,           // zoom of the field (1 = the field at the screen's scale; bigger zooms in)
    scale: 1,          // size of the field compared with one screen
    surrenderOn: false,   // the Surrender setting (⚙️)
    surrendered: {},   // players who have given up in this game
    players: 2,
    screen: 'home',
    nodes: [],
    armies: [],
    drag: null,        // { sources: [spot, ...], start, pointer, target, moved }
    dragLines: [],
    sendPct: 0.25,     // share of a spot's soldiers sent per drop (10, 25, 50 or 100%)
    over: false,
    paused: true,
    elapsed: 0,        // seconds of play in this game
    countdown: 0,      // 3, 2, 1 before the soldiers move
    goT: 0,            // time the countdown reached zero (for the "Go!" flash)
    cdText: '',
    aiClock: 0,
    aiLog: {},         // per computer player: game times of its recent moves
    recordId: null,    // saved map record for the current game
    statusTimer: null
  };

  var popKey = '';

  // ---------- helpers ----------

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Team of a player. Without team mode every player is their own team.
  function teamOf(owner) {
    if (!g.teamMode) return owner;
    return Math.floor(owner / g.teamSize);
  }

  // Pan the field. The field can be bigger than the screen; the view stays inside it.
  function setCam(x, y) {
    var wrap = els.board.parentElement;
    var minX = Math.min(0, wrap.clientWidth - els.board.clientWidth);
    var minY = Math.min(0, wrap.clientHeight - els.board.clientHeight);
    g.cam.x = Math.max(minX, Math.min(0, x));
    g.cam.y = Math.max(minY, Math.min(0, y));
    els.board.style.transform = 'translate(' + g.cam.x + 'px,' + g.cam.y + 'px)';
  }

  // Start with the middle of the field in view.
  function centreCam() {
    var wrap = els.board.parentElement;
    setCam((wrap.clientWidth - els.board.clientWidth) / 2, (wrap.clientHeight - els.board.clientHeight) / 2);
  }

  // Colour class for a spot or army: per player, or per team in team mode.
  function colourClass(owner) {
    if (owner === -2) return 'lake';
    if (owner < 0) return 'neutral';
    // Every player keeps their own colour, in teams too. The team shows on the population line and by the red divider.
    return 'o' + owner;
  }

  function linked(a, b) { return a.links.indexOf(b.id) !== -1; }

  function mmss(sec) {
    var s = Math.max(0, Math.round(sec));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function starText(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

  function starsFor(seconds) {
    if (seconds <= 90) return 3;
    if (seconds <= 180) return 2;
    return 1;
  }

  function setStatus(msg, temp) {
    els.status.textContent = msg;
    clearTimeout(g.statusTimer);
    if (temp) g.statusTimer = setTimeout(restoreStatus, 1800);
  }

  function restoreStatus() {
    var rec = currentRecord();
    els.status.textContent = rec
      ? rec.title + ' · up to ' + rec.max_opponents + (rec.max_opponents === 1 ? ' opponent' : ' opponents')
      : 'Drag from your mushroom to a connected one';
  }

  function currentRecord() {
    if (!g.recordId) return null;
    var list = S.list();
    for (var i = 0; i < list.length; i++) if (list[i].id === g.recordId) return list[i];
    return null;
  }

  // Errors are shown only when "Show errors" is on (see the ⚙️ panel).
  function logError(msg) {
    els.errors.appendChild(el('div', '', String(msg)));
    while (els.errors.children.length > 20) els.errors.removeChild(els.errors.firstChild);
  }

  function toMap(e) {
    var r = els.board.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * g.W,
      y: (e.clientY - r.top) / r.height * g.H
    };
  }

  // Nearest land spot within the tap radius (lakes cannot be tapped).
  function hit(p) {
    var best = null, bestD = HIT;
    g.nodes.forEach(function (n) {
      if (n.type === 'lake') return;
      var d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestD) { bestD = d; best = n; }
    });
    return best;
  }

  // Point-in-polygon (ray casting), used to find the region under a drop.
  function inPoly(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // The land region (Voronoi cell) under a point. A drop anywhere inside a region counts.
  function regionAt(p) {
    for (var i = 0; i < g.nodes.length; i++) {
      var n = g.nodes[i];
      if (n.type !== 'lake' && inPoly(p, n.poly)) return n;
    }
    return null;
  }

  // How many soldiers a spot sends in one drop: a share of its soldiers, at least two when it has them.
  function amountFor(s) {
    var c = Math.floor(s.count);
    if (c < 1) return 0;
    return Math.min(c, Math.max(2, Math.floor(c * g.sendPct)));
  }

  // Shortest route from one spot to another through your own spots. Returns the spots
  // after `from`, ending with `to`, or null when there is no such route.
  function routeTo(from, to) {
    if (from === to) return null;
    var prev = {};
    prev[from.id] = null;
    var queue = [from];
    var found = false;
    while (queue.length && !found) {
      var n = queue.shift();
      n.links.forEach(function (id) {
        if (found) return;
        var t = g.nodes[id];
        if (prev[t.id] !== undefined) return;
        if (t !== to && t.owner !== 0) return;   // a route may pass only through your own spots
        prev[t.id] = n;
        if (t === to) { found = true; return; }
        queue.push(t);
      });
    }
    if (!found) return null;
    var path = [];
    for (var c = to; c !== from; c = prev[c.id]) path.unshift(c);
    return path;
  }

  // ---------- screens ----------

  function show(name) {
    g.screen = name;
    ['home', 'map', 'shop', 'scores', 'game'].forEach(function (s) {
      $('screen-' + s).hidden = (s !== name);
    });
    g.paused = name !== 'game';
    els.overlay.hidden = true;
    els.maps.hidden = true;
    if (name !== 'game') els.panel.hidden = true;
    if (name === 'map') renderPath();
    if (name === 'shop') renderShop();
    if (name === 'scores') renderScores();
    window.scrollTo(0, 0);
  }

  function startLevel(n) {
    g.level = n;
    show('game');
    newGame();
  }

  // ---------- building the board ----------

  function buildBoard() {
    els.nodes.innerHTML = '';
    els.roads.innerHTML = '';
    els.armies.innerHTML = '';
    g.dragLines = [];

    // The field may be bigger than one screen: the board is that many screens wide.
    var scale = g.W / M.W;
    g.scale = scale;
    els.board.style.setProperty('--scale', String(scale));
    els.roads.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
    els.armies.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);

    // Regions (Voronoi cells). Lakes are drawn as water.
    g.nodes.forEach(function (n) {
      n.polyEl = svgEl('polygon', {
        points: n.poly.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ')
      });
      n.shownOwner = undefined;
      n.rangeEl = null;
      n.shownType = undefined;
      els.roads.appendChild(n.polyEl);
    });

    // Roads between neighbouring land spots (each pair once)
    g.nodes.forEach(function (a) {
      if (a.type === 'lake') return;
      a.links.forEach(function (id) {
        if (id <= a.id) return;
        var b = g.nodes[id];
        els.roads.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'class': 'road' }));
      });
    });

    // Spot labels (land only). Cities also show their level as stars.
    g.nodes.forEach(function (n) {
      if (n.type === 'lake') return;
      var d = el('div', 'node');
      d.style.left = (n.x / g.W * 100) + '%';
      d.style.top = (n.y / g.H * 100) + '%';
      var num = el('span', 'num');
      d.appendChild(el('span', 'ico', ICON[n.type]));
      d.appendChild(num);
      n.lvlEl = el('span', 'lvl', '');
      d.appendChild(n.lvlEl);
      n.el = d;
      n.num = num;
      n.shownCount = null;
      n.shownLevel = null;
      if (n.type === 'city') d.classList.add('city');
      els.nodes.appendChild(d);
    });
  }

  // ---------- starting a game ----------

  function newGame() {
    var map;
    try {
      map = M.generate(g.level);
    } catch (err) {
      logError(err.message);
      setStatus('Could not make a map. Try again.');
      return;
    }

    // Save every generated map, with its features and description.
    var rec = S.add({
      level: map.level,
      players: map.players,
      max_opponents: map.maxOpponents,
      title: map.title,
      description: map.description,
      features: map.features,
      rank: null,
      notes: [],
      times_played: 0,
      wins: 0,
      losses: 0,
      map: {
        width: map.width,
        height: map.height,
        nodes: map.nodes.map(function (n) {
          return { id: n.id, x: n.x, y: n.y, type: n.type, links: n.links, poly: n.poly };
        })
      }
    });
    if (S.lastError()) logError(S.lastError());

    map.nodes.forEach(function (n) {
      if (n.type === 'city') {
        n.level = 1;
        n.rate = CITY_LEVELS[0].rate;
        n.cap = CITY_LEVELS[0].cap;
      } else {
        n.level = 0;
        if (n.type === 'fortress') n.fl = 1;
        n.cap = n.type === 'fortress' ? FORT_LEVELS[0].cap : n.type === 'factory' ? MUSH_CAP : Infinity;
      }
    });

    g.recordId = rec.id;
    g.players = map.players;
    g.teamMode = map.teams > 0;
    g.teamCount = map.teams;
    g.teamSize = map.teams ? map.players / map.teams : 1;
    g.W = map.width;
    g.H = map.height;
    g.nodes = map.nodes;
    g.armies = [];
    g.drag = null;
    g.aiLog = {};
    g.over = false;
    g.paused = false;
    g.elapsed = 0;
    g.aiClock = 0;
    g.countdown = 3;
    g.goT = 0;
    g.cdText = '';
    popKey = '';
    els.overlay.hidden = true;
    buildBoard();
    buildMinimap();
    g.surrendered = {};
    g.touches = {};
    g.pinch = null;
    g.zoom = 1;
    els.board.style.setProperty('--zoom', '1');
    centreCam();
    restoreStatus();
  }

  // ---------- the rules ----------

  // Create a marching army. Soldiers do not leave `from` (used for passing through your own spots).
  function spawn(from, to, count, owner) {
    var a = {
      from: from,
      to: to,
      owner: owner,
      count: count,
      len: Math.max(1, Math.hypot(to.x - from.x, to.y - from.y)),
      p: 0,
      done: false,
      route: null,   // spots still to pass through, for a longer march
      el: null
    };
    a.el = svgEl('g', { 'class': 'army ' + colourClass(owner) });
    a.el.appendChild(svgEl('circle', { r: 13 }));
    var label = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    label.textContent = String(count);
    a.el.appendChild(label);
    els.armies.appendChild(a.el);
    g.armies.push(a);
    return a;
  }

  function launch(from, to, count, owner) {
    count = Math.min(Math.floor(count), Math.floor(from.count));
    if (count <= 0) return null;
    from.count -= count;
    var a = spawn(from, to, count, owner);
    if (owner === 0) Sound.send();
    return a;
  }

  // Send soldiers along a route of your spots, ending at path[last].
  function sendAlong(from, path, count) {
    var a = launch(from, path[0], count, 0);
    if (!a) return false;
    a.route = path.slice(1);
    return true;
  }

  function setArmyCount(a, c) {
    a.count = c;
    var t = a.el && a.el.querySelector('text');
    if (t) t.textContent = String(c);
  }

  // Soldiers marching toward each other on the same road fight when they meet.
  // The larger force survives with the difference.
  function clashOnRoads() {
    var live = g.armies.filter(function (a) { return !a.done; });
    for (var i = 0; i < live.length; i++) {
      for (var j = i + 1; j < live.length; j++) {
        var a = live[i], b = live[j];
        if (a.done || b.done || a.owner === b.owner) continue;
        if (a.from !== b.to || a.to !== b.from) continue;   // must be on the same road, facing each other
        if (a.p + b.p < 1) continue;                         // not met yet
        var diff = a.count - b.count;
        if (diff > 0) { setArmyCount(a, diff); b.done = true; }
        else if (diff < 0) { setArmyCount(b, -diff); a.done = true; }
        else { a.done = true; b.done = true; }
      }
    }
  }

  function arrive(a) {
    var n = a.to;
    a.done = true;
    // Passing through one of your own spots on a longer march: keep going, the garrison is unchanged.
    if (a.route && a.route.length && n.owner === a.owner) {
      var next = spawn(n, a.route[0], a.count, a.owner);
      next.route = a.route.slice(1);
      return;
    }
    if (n.owner === a.owner) {
      n.count += a.count;
      return;
    }
    n.count -= a.count;
    if (n.count < 0) {
      var before = n.owner;
      n.owner = a.owner;
      n.count = -n.count;
      n.upgrade = null;   // a spot taken mid-upgrade loses the upgrade
      // A captured city drops one grade (never below village).
      if (n.type === 'city') {
        var lv = Math.max(1, (n.level || 1) - 1);
        n.level = lv; n.rate = CITY_LEVELS[lv - 1].rate; n.cap = CITY_LEVELS[lv - 1].cap;
      }
      // A captured fortress drops one level (never below level 1), like a city drops one grade.
      if (n.type === 'fortress') {
        n.fl = Math.max(1, (n.fl || 1) - 1);
        n.cap = FORT_LEVELS[n.fl - 1].cap;
      }
      if (n.type === 'factory') n.cap = MUSH_CAP;
      if (a.owner === 0) Sound.capture();
      else if (before === 0) Sound.lost();
    }
  }

  // Finish an upgrade: the spot takes its new type, level, rate and cap.
  function applyUpgrade(n, u) {
    if (u.kind === 'mush') {
      var t = CITY_LEVELS[1];
      n.type = 'city'; n.level = 2; n.rate = t.rate; n.cap = t.cap;
    } else if (u.kind === 'city') {
      var c = CITY_LEVELS[u.to - 1];
      n.level = u.to; n.rate = c.rate; n.cap = c.cap;
    } else if (u.kind === 'fort') {
      n.type = 'fortress'; n.fl = 1; n.level = 0; n.rate = M.TYPES.fortress.rate; n.cap = FORT_LEVELS[0].cap;
    } else {
      n.fl = u.to; n.cap = FORT_LEVELS[u.to - 1].cap;   // a fortress step
    }
    n.upgrade = null;
    if (n.owner === 0) setStatus('Your spot grew into ' + u.label + '!', true);
  }

  // Spend soldiers to start growing one of your spots. A mushroom becomes a town-tier city. A city goes up
  // one tier, and a metropolis becomes a fortress. The spot does not grow its army while it upgrades.
  function tryUpgrade(n) {
    if (n.owner !== 0 || (n.type !== 'city' && n.type !== 'factory' && n.type !== 'fortress')) return;
    if (n.upgrade) { setStatus('This spot is already growing.', true); return; }
    var have = Math.floor(n.count), u, cost, secs, label;
    if (n.type === 'fortress') {
      var fl = n.fl || 1;
      if (fl >= FORT_LEVELS.length) { setStatus('This fortress is fully grown.', true); return; }
      u = { kind: 'fortstep', to: fl + 1 };
      cost = FORT_LEVELS[fl].cost; secs = FORT_LEVELS[fl].secs; label = 'a stronger fortress';
    } else if (n.type === 'factory') {
      u = { kind: 'mush' };
      cost = CITY_LEVELS[1].cost; secs = CITY_LEVELS[1].secs; label = 'a town';
    } else if ((n.level || 1) >= CITY_LEVELS.length) {
      u = { kind: 'fort' };
      cost = FORT_CONVERT_COST; secs = FORT_CONVERT_SECS; label = 'a fortress';
    } else {
      var lvl = n.level || 1;
      u = { kind: 'city', to: lvl + 1 };
      cost = CITY_LEVELS[lvl].cost; secs = CITY_LEVELS[lvl].secs; label = 'a ' + CITY_LEVELS[lvl].name;
    }
    if (have < cost) {
      setStatus('Growing into ' + label + ' needs ' + cost + ' soldiers in the spot.', true);
      return;
    }
    n.count -= cost;
    u.label = label;
    u.until = g.elapsed + secs;
    n.upgrade = u;
    Sound.tap();
    setStatus('Growing into ' + label + '...', true);
  }

  // Enemy soldiers inside a fortress's range stop and lose soldiers each second.
  // Returns true when the army is stopped there this frame.
  function underFire(a, dt) {
    var x = a.from.x + (a.to.x - a.from.x) * a.p;
    var y = a.from.y + (a.to.y - a.from.y) * a.p;
    // Each fortress in range adds its damage for its level.
    var dmg = 0;
    g.nodes.forEach(function (f) {
      if (f.type !== 'fortress' || f.owner < 0 || teamOf(f.owner) === teamOf(a.owner)) return;
      var lv = FORT_LEVELS[(f.fl || 1) - 1];
      if (Math.hypot(f.x - x, f.y - y) <= lv.range) dmg += lv.dmg;
    });
    if (dmg === 0) return false;
    a.count -= dmg * dt;
    if (a.count <= 0) { a.done = true; return true; }
    setArmyCount(a, Math.ceil(a.count));
    return true;
  }

  function step(dt) {
    if (g.over || g.paused || !g.nodes.length) return;

    if (g.countdown > 0) {
      g.countdown -= dt;
      if (g.countdown <= 0) { g.countdown = 0; g.goT = performance.now(); }
      return;
    }
    g.elapsed += dt;

    g.nodes.forEach(function (n) {
      if (n.upgrade && g.elapsed >= n.upgrade.until) applyUpgrade(n, n.upgrade);
      if (n.owner < 0) return;
      if (n.upgrade) return;          // a spot growing into a new tier keeps its army as it is
      if (n.count >= n.cap) return;   // cities stop growing at their garrison cap
      n.count += n.rate * dt;
      if (n.count > n.cap) n.count = n.cap;
    });

    g.armies.forEach(function (a) {
      if (a.done) return;
      if (underFire(a, dt)) return;   // a fortress stops enemy soldiers and shoots them
      a.p += SPEED * dt / a.len;
    });
    clashOnRoads();
    g.armies.forEach(function (a) {
      if (!a.done && a.p >= 1) arrive(a);
    });
    g.armies = g.armies.filter(function (a) {
      if (a.done) {
        if (a.el.parentNode) a.el.parentNode.removeChild(a.el);
        return false;
      }
      return true;
    });

    g.aiClock -= dt;
    if (g.aiClock <= 0) {
      for (var p = 1; p < g.players; p++) aiThink(LEVELS_AI[g.ai], p);
      g.aiClock = LEVELS_AI[g.ai].every;
    }

    checkSurrender();
    checkWin();
  }

  // Soldiers and spots per player, with armies in flight counted as soldiers.
  function totals() {
    var t = [];
    for (var p = 0; p < g.players; p++) t[p] = { spots: 0, soldiers: 0 };
    g.nodes.forEach(function (n) {
      if (n.owner >= 0) { t[n.owner].spots++; t[n.owner].soldiers += Math.floor(n.count); }
    });
    g.armies.forEach(function (a) { if (!a.done) t[a.owner].soldiers += a.count; });
    return t;
  }

  // True when a spot touches a spot of another team (a front line).
  function borders(n, p) {
    return n.links.some(function (id) {
      var t = g.nodes[id];
      return t.owner >= 0 && teamOf(t.owner) !== teamOf(p);
    });
  }

  // Computer players: spots away from the front send reinforcements to the front;
  // spots on the front attack the best linked neighbour from another team.
  // A player with more than half the soldiers is ganged up on. Moves per minute are capped by level.
  function aiThink(level, p) {
    if (g.surrendered[p]) return;
    var log = (g.aiLog[p] || []).filter(function (t) { return g.elapsed - t < 60; });
    g.aiLog[p] = log;

    var tot = totals();
    var sum = tot.reduce(function (x, t) { return x + t.soldiers; }, 0);
    var leaderTeam = -1;
    tot.forEach(function (t, o) {
      if (sum && t.soldiers / sum > 0.5 && teamOf(o) !== teamOf(p)) leaderTeam = teamOf(o);
    });

    var ready = g.nodes.filter(function (n) {
      return n.type !== 'lake' && n.owner === p && n.count >= level.threshold;
    });
    ready.forEach(function (n) {
      if (log.length >= level.perMinute) return;
      var target = null;
      if (!borders(n, p)) {
        n.links.forEach(function (id) {
          var t = g.nodes[id];
          if (t.owner === p && borders(t, p) && (!target || t.count < target.count)) target = t;
        });
      }
      if (!target) {
        var bestScore = Infinity;
        n.links.forEach(function (id) {
          var t = g.nodes[id];
          if (t.owner >= 0 && teamOf(t.owner) === teamOf(p)) return;   // never attack a teammate
          var score = t.count + M.dist(n, t) / 40;
          if (leaderTeam !== -1 && t.owner >= 0 && teamOf(t.owner) === leaderTeam) score -= 8;
          if (score < bestScore) { bestScore = score; target = t; }
        });
      }
      if (target && launch(n, target, Math.floor(n.count * level.fraction), p)) log.push(g.elapsed);
    });
  }

  // A team outnumbered 10 to 1 by the other teams gives up. Only when Surrender is on in ⚙️.
  function checkSurrender() {
    if (!g.surrenderOn) return;
    var tot = totals();
    var teams = [];
    for (var p = 0; p < g.players; p++) {
      var k = teamOf(p);
      if (!teams[k]) teams[k] = { members: [], soldiers: 0 };
      teams[k].members.push(p);
      if (!g.surrendered[p]) teams[k].soldiers += tot[p].soldiers;
    }
    var sum = 0;
    teams.forEach(function (t) { sum += t.soldiers; });
    teams.forEach(function (t) {
      if (t.members.every(function (m) { return g.surrendered[m]; })) return;
      var others = sum - t.soldiers;
      if (others > 0 && others >= SURRENDER_RATIO * t.soldiers) surrender(t.members);
    });
  }

  // Give up: the side's spots go neutral with their soldiers, and its soldiers on the march are lost.
  function surrender(members) {
    members.forEach(function (m) { g.surrendered[m] = true; });
    g.nodes.forEach(function (n) {
      if (n.owner >= 0 && members.indexOf(n.owner) !== -1) { n.owner = -1; n.upgrade = null; }
    });
    g.armies.forEach(function (a) { if (members.indexOf(a.owner) !== -1) a.done = true; });
    var me = members.indexOf(0) !== -1;
    setStatus(me ? 'You surrendered.' : 'A rival gave up!', true);
  }

  // The game is won when only one team is left with spots or soldiers. Neutral spots may remain.
  function checkWin() {
    var alive = {};
    g.nodes.forEach(function (n) { if (n.type !== 'lake' && n.owner >= 0) alive[teamOf(n.owner)] = true; });
    g.armies.forEach(function (a) { if (!a.done) alive[teamOf(a.owner)] = true; });

    if (!alive[teamOf(0)]) return endGame(false);
    if (Object.keys(alive).length === 1) endGame(true);
  }

  function endGame(won) {
    if (g.over) return;
    g.over = true;
    g.drag = null;
    if (won) Sound.win(); else Sound.lost();

    var secs = Math.round(g.elapsed);
    var mine = g.nodes.filter(function (n) { return n.type !== 'lake' && n.owner === 0; });
    var soldiers = 0;
    mine.forEach(function (n) { soldiers += Math.floor(n.count); });
    var score = won ? Math.round(1000 + Math.max(0, 600 - secs) * 2 + mine.length * 50 + soldiers) : 0;

    var rec = S.recordGame(g.recordId, won);
    if (S.lastError()) logError(S.lastError());
    var rate = rec ? S.winRate(rec) : null;
    var mapStats = rec ? 'Map played ' + rec.times_played + ' · win rate ' + (rate === null ? '—' : rate + '%') : '';

    var stars = 0;
    var hasNext = g.level < S.LEVEL_COUNT;
    if (won) {
      stars = starsFor(secs);
      S.completeLevel(g.level, secs, score);
      S.addScore({ score: score, level: g.level, seconds: secs });
      if (S.lastError()) logError(S.lastError());
      els.winTitle.textContent = hasNext ? 'You grew the whole meadow! 🎉' : 'All levels done! 🏆';
      els.winText.textContent = 'Time ' + mmss(secs) + ' · Score ' + score + '. ' + mapStats;
      els.winStars.textContent = starText(stars);
    } else {
      els.winTitle.textContent = 'The other mushrooms won this time 🍄';
      els.winText.textContent = 'Try again, you can do it! ' + mapStats;
      els.winStars.textContent = '';
    }
    els.winNext.hidden = !(won && hasNext);
    els.winRetry.textContent = won ? 'Play again' : 'Try again';
    els.overlay.hidden = false;
  }

  // ---------- drawing ----------

  // Lines from each dragged spot to the pointer, or to the target region when over one.
  function renderDrag() {
    var d = g.drag;
    var want = d ? d.sources.length : 0;
    while (g.dragLines.length < want) {
      var ln = svgEl('line', { 'class': 'drag' });
      els.armies.insertBefore(ln, els.armies.firstChild);
      g.dragLines.push(ln);
    }
    while (g.dragLines.length > want) {
      var old = g.dragLines.pop();
      if (old.parentNode) old.parentNode.removeChild(old);
    }
    var end = d && (d.target || d.pointer);
    g.dragLines.forEach(function (ln, i) {
      if (!end) { ln.style.display = 'none'; return; }
      var s = d.sources[i];
      var ok = d.target && routeTo(s, d.target);
      ln.setAttribute('x1', s.x);
      ln.setAttribute('y1', s.y);
      ln.setAttribute('x2', end.x);
      ln.setAttribute('y2', end.y);
      ln.setAttribute('class', 'drag' + (d.target ? (ok ? ' ok' : ' bad') : ''));
      ln.style.display = '';
    });
  }

  // The population line: territories:soldiers for each player, or for each team in team mode.
  // A red divider separates the two teams.
  function renderPop() {
    var tot = totals();
    var groups = [];
    if (g.teamMode) {
      for (var t = 0; t < g.teamCount; t++) {
        var members = [];
        for (var m = t * g.teamSize; m < (t + 1) * g.teamSize; m++) members.push(m);
        groups.push(members);
      }
    } else {
      for (var p = 0; p < g.players; p++) groups.push([p]);
    }
    var stats = groups.map(function (members) {
      var s = { members: members, spots: 0, soldiers: 0 };
      members.forEach(function (m) {
        if (m < g.players) { s.spots += tot[m].spots; s.soldiers += tot[m].soldiers; }
      });
      return s;
    });

    var key = stats.map(function (s) { return s.spots + ':' + s.soldiers; }).join('|');
    if (key === popKey) return;
    popKey = key;

    var sum = stats.reduce(function (x, s) { return x + s.soldiers; }, 0);
    els.popBar.innerHTML = '';
    stats.forEach(function (s, i) {
      if (g.teamMode && i > 0) els.popBar.appendChild(el('div', 'pop-div'));
      if (!s.spots && !s.soldiers) return;
      var share = sum ? s.soldiers / sum * 100 : 100 / stats.length;
      var label = s.members.map(function (m) { return AVATARS[m]; }).join('') + ' ' + s.spots + ':' + s.soldiers;
      var seg = el('div', 'pop-seg ' + (g.teamMode ? 't' + i : 'o' + s.members[0]), label);
      seg.style.width = share + '%';
      seg.title = (g.teamMode ? (i === 0 ? 'Your team' : 'Team ' + (i + 1)) : (s.members[0] === 0 ? 'You' : 'Player ' + (s.members[0] + 1))) +
        ': ' + s.spots + ' territories, ' + s.soldiers + ' soldiers';
      els.popBar.appendChild(seg);
    });
  }

  // The "Go!" countdown in the middle of the board.
  function renderCountdown() {
    var txt = '';
    if (g.countdown > 0) txt = String(Math.ceil(g.countdown));
    else if (g.goT && performance.now() - g.goT < 700) txt = 'Go!';
    if (txt !== g.cdText) {
      g.cdText = txt;
      els.countdown.textContent = txt;
      els.countdown.hidden = !txt;
    }
  }

  function render() {
    g.nodes.forEach(function (n) {
      if (n.polyEl && n.shownOwner !== n.owner) {
        n.polyEl.setAttribute('class', 'cell ' + colourClass(n.owner));
        n.shownOwner = n.owner;
      }
      if (n.type === 'lake' || !n.el) return;

      // A spot that changed type (mushroom to city, city to fortress) gets its new icon.
      if (n.shownType !== n.type) {
        n.el.querySelector('.ico').textContent = ICON[n.type];
        if (n.type !== 'city') n.lvlEl.textContent = '';
        n.shownType = n.type;
        n.shownLevel = null;
      }
      // A fortress shows its range as a ring while it is yours.
      if (n.type === 'fortress') {
        if (!n.rangeEl) {
          n.rangeEl = svgEl('circle', { 'class': 'fort-range', cx: n.x, cy: n.y, r: FORT_LEVELS[0].range });
          els.roads.appendChild(n.rangeEl);
        }
        n.rangeEl.setAttribute('class', 'fort-range' + (n.owner >= 0 ? ' on' : ''));
        n.rangeEl.setAttribute('r', FORT_LEVELS[(n.fl || 1) - 1].range);
        // Stars show the fortress level (level 2 and 3 get one and two stars).
        if (n.shownLevel !== n.fl) {
          n.lvlEl.textContent = (n.fl || 1) > 1 ? '★'.repeat((n.fl || 1) - 1) : '';
          n.shownLevel = n.fl;
        }
      }

      var label = Math.floor(n.count);
      var cls = 'node' + (n.type === 'city' ? ' city' : '') + ' ' + colourClass(n.owner);
      if (g.drag && g.drag.sources.indexOf(n) !== -1) cls += ' source';
      if (g.drag && g.drag.target === n) cls += ' target';
      if (n.upgrade) cls += ' upgrading';   // dust while the spot grows
      n.el.className = cls;
      if (n.shownCount !== label) {
        n.num.textContent = String(label);
        n.shownCount = label;
      }
      if (n.type === 'city' && n.shownLevel !== n.level) {
        n.lvlEl.textContent = n.level > 1 ? '★'.repeat(n.level - 1) : '';
        n.shownLevel = n.level;
      }
    });

    g.armies.forEach(function (a) {
      var x = a.from.x + (a.to.x - a.from.x) * a.p;
      var y = a.from.y + (a.to.y - a.from.y) * a.p;
      a.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
    });

    renderDrag();
    renderPop();
    renderMinimap();
    renderCountdown();
    els.pctBtn.textContent = 'Send ' + Math.round(g.sendPct * 100) + '%';
  }

  // ---------- zoom, pinch and the minimap ----------

  // Zoom the field. The point at (ax, ay) in the window stays where it is. Default: the middle of the window.
  function setZoom(z, ax, ay) {
    var wrap = els.board.parentElement;
    z = Math.max(1 / g.scale, Math.min(MAX_ZOOM, z));   // 1 / scale: the whole field fits the window
    if (ax === undefined) { ax = wrap.clientWidth / 2; ay = wrap.clientHeight / 2; }
    var fx = (ax - g.cam.x) / els.board.clientWidth;
    var fy = (ay - g.cam.y) / els.board.clientHeight;
    g.zoom = z;
    els.board.style.setProperty('--zoom', String(z));
    setCam(ax - fx * els.board.clientWidth, ay - fy * els.board.clientHeight);
  }

  function startPinch() {
    var ids = Object.keys(g.touches);
    var a = g.touches[ids[0]], b = g.touches[ids[1]];
    g.drag = null;
    g.pan = null;
    g.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: g.zoom };
  }

  function pinchMove() {
    var ids = Object.keys(g.touches);
    if (ids.length < 2) return;
    var a = g.touches[ids[0]], b = g.touches[ids[1]];
    var r = els.board.parentElement.getBoundingClientRect();
    var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    setZoom(g.pinch.z0 * d / g.pinch.d0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
  }

  // The minimap: the whole field, each spot as a dot, and a frame for what is on screen.
  function buildMinimap() {
    els.mmSvg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
    els.mmSvg.innerHTML = '';
    els.minimap.style.aspectRatio = g.W + ' / ' + g.H;
    g.nodes.forEach(function (n) {
      n.mmEl = svgEl('circle', { cx: n.x, cy: n.y, r: n.type === 'fortress' ? 46 : (n.type === 'city' ? 40 : 30) });
      n.shownMm = undefined;
      els.mmSvg.appendChild(n.mmEl);
    });
  }

  // Show the minimap only when the field scrolls, and move its frame with the view.
  function renderMinimap() {
    var wrap = els.board.parentElement;
    var bw = els.board.clientWidth, bh = els.board.clientHeight;
    var scrolls = g.zoom * g.scale > 1.01;   // the field is bigger than the window
    els.minimap.hidden = !scrolls;
    if (!scrolls) return;
    els.mmView.style.left = (-g.cam.x / bw * 100) + '%';
    els.mmView.style.top = (-g.cam.y / bh * 100) + '%';
    els.mmView.style.width = (wrap.clientWidth / bw * 100) + '%';
    els.mmView.style.height = (wrap.clientHeight / bh * 100) + '%';
    g.nodes.forEach(function (n) {
      if (!n.mmEl || n.shownMm === n.owner) return;
      n.mmEl.setAttribute('class', colourClass(n.owner));
      n.shownMm = n.owner;
    });
  }

  // A tap or drag on the minimap moves the view there.
  function panToMini(e) {
    var r = els.minimap.getBoundingClientRect();
    var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    var wrap = els.board.parentElement;
    setCam(wrap.clientWidth / 2 - fx * els.board.clientWidth, wrap.clientHeight / 2 - fy * els.board.clientHeight);
  }

  els.minimap.addEventListener('pointerdown', function (e) {
    els.minimap.setPointerCapture(e.pointerId);
    g.miniDrag = true;
    panToMini(e);
  });
  els.minimap.addEventListener('pointermove', function (e) { if (g.miniDrag) panToMini(e); });
  els.minimap.addEventListener('pointerup', function () { g.miniDrag = false; });
  els.minimap.addEventListener('pointercancel', function () { g.miniDrag = false; });

  $('zoom-in').addEventListener('click', function () { setZoom(g.zoom * ZOOM_STEP); });
  $('zoom-out').addEventListener('click', function () { setZoom(g.zoom / ZOOM_STEP); });
  $('zoom-fit').addEventListener('click', function () { setZoom(1 / g.scale); centreCam(); });
  document.addEventListener('ew:reset-zoom', function () { setZoom(1 / g.scale); centreCam(); });

  // ---------- input ----------

  els.board.addEventListener('pointerdown', function (e) {
    if (g.over || g.paused) return;
    e.preventDefault();
    els.board.setPointerCapture(e.pointerId);
    g.touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(g.touches).length === 2) { startPinch(); return; }   // two fingers: zoom
    if (Object.keys(g.touches).length > 2) return;
    var p = toMap(e);
    var n = hit(p);
    if (n && n.owner === 0 && n.count >= 1 && g.countdown <= 0) {
      g.drag = { sources: [n], start: p, pointer: p, target: null, moved: false };
      Sound.tap();
      return;
    }
    // Anywhere else, dragging pans the field (the bigger levels scroll).
    g.pan = { x: e.clientX, y: e.clientY, camX: g.cam.x, camY: g.cam.y };
  });

  // Mouse wheel and trackpad pan the field too.
  els.board.addEventListener('wheel', function (e) {
    e.preventDefault();
    setCam(g.cam.x - e.deltaX, g.cam.y - e.deltaY);
  }, { passive: false });

  // Moving over your own regions adds them to the group; over another region it targets it.
  els.board.addEventListener('pointermove', function (e) {
    if (g.touches[e.pointerId]) g.touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (g.pinch) { pinchMove(); return; }
    if (g.pan && !g.drag) {
      setCam(g.pan.camX + e.clientX - g.pan.x, g.pan.camY + e.clientY - g.pan.y);
      return;
    }
    if (!g.drag) return;
    var p = toMap(e);
    var d = g.drag;
    d.pointer = p;
    if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 12) d.moved = true;
    var r = regionAt(p) || hit(p);
    if (r && r.owner === 0 && r.count >= 1 && d.sources.indexOf(r) === -1) d.sources.push(r);
    d.target = (r && d.sources.indexOf(r) === -1 && r.type !== 'lake') ? r : null;
  });

  // Release: a tap on a city upgrades it. A drop on a region sends every dragged spot that can
  // reach it, by road or through your own spots. A drop on your own spot reinforces it.
  function endDrag(e) {
    delete g.touches[e.pointerId];
    if (g.pinch) {
      if (Object.keys(g.touches).length < 2) g.pinch = null;
      g.pan = null;
      return;
    }
    g.pan = null;
    var d = g.drag;
    if (!d) return;
    g.drag = null;
    var p = toMap(e);
    if (!d.moved && d.sources.length === 1 && (d.sources[0].type === 'city' || d.sources[0].type === 'factory')) {
      tryUpgrade(d.sources[0]);
      return;
    }
    var t = regionAt(p) || hit(p);
    if (!t) return;
    var group = d.sources.filter(function (s) { return s !== t; });
    var sent = 0, blocked = 0;
    group.forEach(function (s) {
      var path = routeTo(s, t);
      if (!path) { blocked++; return; }
      var amt = amountFor(s);
      if (amt > 0 && sendAlong(s, path, amt)) sent++;
    });
    if (!group.length) return;
    if (sent) {
      var reinforce = t.owner === 0;
      setStatus(reinforce ? 'Reinforcements sent.' : (sent === 1 ? 'Sent soldiers!' : 'Sent from ' + sent + ' spots!'), true);
    } else if (blocked) {
      setStatus('No route. Your spots must be connected by roads.', true);
    }
  }

  els.board.addEventListener('pointerup', endDrag);
  els.board.addEventListener('pointercancel', function (e) {
    delete g.touches[e.pointerId];
    g.drag = null; g.pan = null; g.pinch = null;
  });

  els.surrenderToggle.addEventListener('click', function () {
    var on = els.surrenderToggle.getAttribute('aria-pressed') !== 'true';
    els.surrenderToggle.setAttribute('aria-pressed', String(on));
    els.surrenderToggle.textContent = on ? 'On' : 'Off';
    g.surrenderOn = on;
    setStatus(on ? 'Surrender is on: outnumbered 10 to 1 means giving up.' : 'Surrender is off.', true);
  });

  els.pctBtn.addEventListener('click', function () {
    var i = SEND_STEPS.indexOf(g.sendPct);
    g.sendPct = SEND_STEPS[(i + 1) % SEND_STEPS.length];
    els.pctBtn.textContent = 'Send ' + Math.round(g.sendPct * 100) + '%';
  });

  // ---------- home, progress, shop, scores ----------

  function markSeg(container, attr, value) {
    container.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value)));
    });
  }

  $('btn-play').addEventListener('click', function () { startLevel(S.highestOpen()); });
  $('btn-map').addEventListener('click', function () { show('map'); });
  $('btn-shop').addEventListener('click', function () { show('shop'); });
  $('btn-scores').addEventListener('click', function () { show('scores'); });
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.go); });
  });
  els.btnHome.addEventListener('click', function () { show('map'); });

  function renderPath() {
    els.path.innerHTML = '';
    var prog = S.progress();
    M.LEVELS.forEach(function (cfg) {
      if (cfg.level > S.LEVEL_COUNT) return;
      var status = S.levelStatus(cfg.level);
      var entry = prog.completed[String(cfg.level)];
      var btn = el('button', 'lvl-node ' + status);
      btn.appendChild(el('span', 'lvl-num', String(cfg.level)));
      btn.appendChild(el('span', 'lvl-name', cfg.name));
      var state;
      if (status === 'locked') state = '🔒 Win level ' + (cfg.level - 1) + ' to unlock';
      else if (status === 'done') state = starText(entry.stars) + ' · best ' + entry.bestScore;
      else state = 'Tap to play';
      btn.appendChild(el('span', 'lvl-state', state));
      btn.disabled = status === 'locked';
      btn.addEventListener('click', function () { startLevel(cfg.level); });
      els.path.appendChild(btn);
      els.path.appendChild(el('div', 'lvl-link'));
    });
    var soon = el('div', 'lvl-node soon');
    soon.appendChild(el('span', 'lvl-num', '🌱'));
    soon.appendChild(el('span', 'lvl-name', 'More levels'));
    soon.appendChild(el('span', 'lvl-state', 'Coming soon'));
    els.path.appendChild(soon);

    var done = Object.keys(prog.completed).length;
    els.mapNote.textContent = done + ' of ' + S.LEVEL_COUNT + ' levels won.';
  }

  function renderShop() {
    els.shopList.innerHTML = '';
    SHOP.forEach(function (item) {
      var li = el('li', 'card-item ' + item.status);
      var head = el('div', 'card-head');
      head.appendChild(el('h3', '', item.name));
      head.appendChild(el('span', 'tag-pill ' + item.status, item.status === 'in' ? 'In game' : 'Coming soon'));
      li.appendChild(head);
      li.appendChild(el('p', '', item.desc));
      els.shopList.appendChild(li);
    });
  }

  function renderScores() {
    var prog = S.progress();
    els.bestLevels.innerHTML = '';
    M.LEVELS.forEach(function (cfg) {
      if (cfg.level > S.LEVEL_COUNT) return;
      var entry = prog.completed[String(cfg.level)];
      var card = el('div', 'card-item ' + (entry ? 'in' : 'soon'));
      var head = el('div', 'card-head');
      head.appendChild(el('h3', '', 'Level ' + cfg.level + ' · ' + cfg.name));
      head.appendChild(el('span', 'tag-pill ' + (entry ? 'in' : 'soon'), entry ? starText(entry.stars) : 'Not won'));
      card.appendChild(head);
      card.appendChild(el('p', '', entry ? 'Best score ' + entry.bestScore + ' · best time ' + mmss(entry.bestSeconds) : 'Win this level to set a score.'));
      els.bestLevels.appendChild(card);
    });

    els.scoreList.innerHTML = '';
    var top = S.scores();
    if (!top.length) {
      els.scoreList.appendChild(el('li', 'muted', 'No wins yet.'));
      return;
    }
    top.forEach(function (s) {
      var li = el('li', 'score-row');
      li.appendChild(el('span', 'score-num', String(s.score)));
      li.appendChild(el('span', '', 'Level ' + s.level + ' · ' + mmss(s.seconds)));
      els.scoreList.appendChild(li);
    });
  }

  // ---------- win / lose buttons ----------

  els.winNext.addEventListener('click', function () { startLevel(g.level + 1); });
  els.winRetry.addEventListener('click', function () { startLevel(g.level); });
  els.winMap.addEventListener('click', function () { show('map'); });

  // ---------- settings (⚙️) ----------

  els.gear.addEventListener('click', function () {
    els.panel.hidden = !els.panel.hidden;
  });

  els.segAi.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    g.ai = b.dataset.ai;
    markSeg(els.segAi, 'ai', g.ai);
  });

  els.sound.addEventListener('click', function () {
    var on = els.sound.getAttribute('aria-pressed') !== 'true';
    els.sound.setAttribute('aria-pressed', String(on));
    els.sound.textContent = on ? 'On' : 'Off';
    Sound.setEnabled(on);
  });

  els.errorsToggle.addEventListener('click', function () {
    var on = els.errorsToggle.getAttribute('aria-pressed') !== 'true';
    els.errorsToggle.setAttribute('aria-pressed', String(on));
    els.errorsToggle.textContent = on ? 'On' : 'Off';
    els.errors.hidden = !on;
  });

  els.noteSave.addEventListener('click', function () {
    var text = els.noteText.value.trim();
    if (!g.recordId) return;
    if (!text) {
      els.noteStatus.textContent = 'Write a note first.';
      return;
    }
    var rec = S.addNote(g.recordId, text);
    if (!rec) {
      els.noteStatus.textContent = 'Could not save the note.';
      logError(S.lastError() || 'Note not saved');
      return;
    }
    els.noteText.value = '';
    els.noteStatus.textContent = 'Note saved for this map.';
  });

  els.newmap.addEventListener('click', function () { newGame(); });

  // ---------- saved maps list (description, features, ranking, win rate, notes) ----------

  function renderMaps() {
    var list = S.list().slice().sort(function (a, b) {
      var ra = a.rank || 0, rb = b.rank || 0;
      if (rb !== ra) return rb - ra;
      var wa = S.winRate(a) || 0, wb = S.winRate(b) || 0;
      if (wb !== wa) return wb - wa;
      return (b.times_played || 0) - (a.times_played || 0);
    });

    els.mapsList.innerHTML = '';
    if (!list.length) {
      els.mapsList.appendChild(el('p', 'muted', 'No maps yet.'));
      return;
    }

    list.forEach(function (r) {
      var row = el('div', 'map-row');
      row.appendChild(el('h3', '', r.title));
      row.appendChild(el('p', 'desc', r.description || ''));

      var chips = el('div', 'chips');
      (r.features || []).forEach(function (f) { chips.appendChild(el('span', 'chip', f)); });
      row.appendChild(chips);

      var rate = S.winRate(r);
      row.appendChild(el('p', 'stats',
        'Played ' + (r.times_played || 0) + ' · wins ' + (r.wins || 0) +
        ' · win rate ' + (rate === null ? '—' : rate + '%') +
        ' · opponents ' + r.max_opponents));

      var stars = el('div', 'stars');
      for (var s = 1; s <= 5; s++) {
        var b = el('button', 'star', s <= (r.rank || 0) ? '★' : '☆');
        b.setAttribute('aria-label', 'Rate ' + s + ' star' + (s > 1 ? 's' : ''));
        b.addEventListener('click', (function (id, n) {
          return function () {
            S.setRank(id, n);
            if (S.lastError()) logError(S.lastError());
            renderMaps();
          };
        })(r.id, s));
        stars.appendChild(b);
      }
      row.appendChild(stars);

      // Every note, with its status. "Mark done" moves it between open and done.
      (r.notes || []).forEach(function (note) {
        var box = el('div', 'note-row ' + (note.status === 'done' ? 'done' : 'open'));
        box.appendChild(el('p', 'note', '📝 ' + note.text));
        box.appendChild(el('span', 'chip', note.status === 'done' ? 'done' : 'open'));
        if (note.id) {
          var next = note.status === 'done' ? 'open' : 'done';
          var nb = el('button', 'note-toggle', next === 'done' ? 'Mark done' : 'Reopen');
          nb.addEventListener('click', (function (mapId, noteId, status) {
            return function () {
              S.setNoteStatus(mapId, noteId, status);
              renderMaps();
            };
          })(r.id, note.id, next));
          box.appendChild(nb);
        }
        row.appendChild(box);
      });

      els.mapsList.appendChild(row);
    });
  }

  els.openMaps.addEventListener('click', function () {
    renderMaps();
    els.maps.hidden = false;
  });
  els.mapsClose.addEventListener('click', function () { els.maps.hidden = true; });

  // ---------- family database: sync pill, ⚙️ Family section ----------

  function renderCloud(s) {
    var label = s.state === 'busy' ? '☁️ …' : s.state === 'ok' ? '☁️ synced' : s.state === 'error' ? '⚠️ sync' : '💾 device';
    els.syncPill.textContent = label;
    els.syncPill.classList.toggle('mint', s.state === 'ok');
    els.syncPill.classList.toggle('warn', s.state === 'error');
    els.syncMsg.textContent = s.message;
    els.familyForm.hidden = s.signedIn;
    els.familySignout.hidden = !s.signedIn;
  }

  els.syncPill.addEventListener('click', function () { els.panel.hidden = false; });

  els.familyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = els.familyEmail.value.trim();
    var pass = els.familyPass.value;
    if (!email || !pass) {
      els.familyResult.textContent = 'Enter the family email and password.';
      return;
    }
    els.familyResult.textContent = 'Signing in…';
    XWCloud.signIn(S, email, pass).then(function () {
      els.familyPass.value = '';
      els.familyResult.textContent = 'Signed in. Maps and notes are synced.';
    }).catch(function () {
      els.familyResult.textContent = 'Could not sign in. Check the email and password.';
    });
  });

  els.familySync.addEventListener('click', function () {
    if (!XWCloud.isSignedIn()) {
      els.familyResult.textContent = 'Sign in first, then the maps and notes can be sent.';
      return;
    }
    var count = S.list().length;
    XWCloud.syncAll(S).then(function () {
      els.familyResult.textContent = 'Sent ' + count + (count === 1 ? ' map' : ' maps') + ' with their notes.';
    }).catch(function () {
      els.familyResult.textContent = 'Not sent. See the sync message, or turn on Show errors.';
    });
  });

  els.familyCheck.addEventListener('click', function () {
    els.familyResult.textContent = 'Checking…';
    XWCloud.dbCheck().then(function (text) {
      els.familyResult.textContent = text;
    }).catch(function () {
      els.familyResult.textContent = '❌ Database check failed. Turn on Show errors for details.';
    });
  });

  els.familySignout.addEventListener('click', function () {
    XWCloud.signOut().then(function () {
      els.familyResult.textContent = 'Signed out. Maps stay on this device.';
    });
  });

  // Errors are logged quietly; they only show when "Show errors" is on.
  window.addEventListener('error', function (e) { logError(e.message || e.error); });
  window.addEventListener('unhandledrejection', function (e) { logError(e.reason); });

  // ---------- frame loop ----------

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      step(dt);
      render();
    } catch (err) {
      logError(err.message);
    }
    requestAnimationFrame(frame);
  }

  // Start-up: the landing page is shown; the game starts when Play is tapped.
  XWCloud.onState(renderCloud);
  XWCloud.init(S, logError);

  markSeg(els.segAi, 'ai', g.ai);
  show('home');
  requestAnimationFrame(frame);
})();
