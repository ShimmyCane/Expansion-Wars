// Expansion Wars — V4 custom battle view. Setup, the battle on an SVG field, routes, formations, orders, pause, and the result.
// The rules are in sim.js. This file draws, takes input, and calls V4.issue and V4.step in fixed steps.
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, I = V4.INSIGNIA;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TILE_COLOUR = {
    g: '#cfe6a0', w: '#5f8f4e', h: '#b9c76a', d: '#c8a46a', r: '#8fc6e8', v: '#4a86b8', b: '#a0764a',
    f: '#c9e7f5', t: '#dcc7a0', x: '#8d857c', y: '#b48c55'
  };
  var TILE_PX = C.TILE;
  var VIEW_W = 1000, VIEW_H = 640;   // the camera window, in map units (50 x 32 tiles)
  var PAN = 10;                      // tiles per press of a pan button
  var COUNTDOWN = 3.6;               // 3, 2, 1, Go (the last 0.6 s show Go)
  var MAX_STEPS = 20;                // most fixed steps in one frame, so a slow device cannot spiral
  var DEG = 180 / Math.PI;
  var FRAME = ['#4a7bd0', '#d05a4a', '#4aa86b'];
  var FRAME_FILL = ['rgba(74,123,208,0.35)', 'rgba(208,90,74,0.35)', 'rgba(74,168,107,0.35)'];
  var SIDE_COL = ['a', 'd', 't'];

  var st = null, sel = null, selGroup = null, phase = 'setup', paused = false, countT = 0, lastTs = null, acc = 0;
  var replay = null;   // while a replay is watched: the live battle, the replay state, its orders and speed
  var svg, layers = {}, unitEls = {}, objEls = [], fxList = [], lastSelected;
  var cam = { x: 0, y: 0 }, mini = null, popKey = '', drag = null, skipClick = false, groupKey = '';
  var $ = function (id) { return document.getElementById(id); };

  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function label(type) { return C.UNIT[type].label; }
  function people(n) { return Math.ceil(n - 0.001); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fmtTime(t) {
    var s = Math.floor(t), m = Math.floor(s / 60);
    return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function options(keys, labelOf) { return keys.map(function (k) { return [k, labelOf(k)]; }); }
  function isPlayer(u) { return st && u.side === st.you; }
  function isAlly(u) { return st && V4.sim.allied(st, u.side, st.you); }
  function planning() { return phase === 'deploy' || (phase === 'battle' && paused && !st.done); }

  function fillSelect(sel, items, current) {
    sel.innerHTML = '';
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it[0]; o.textContent = it[1];
      if (String(it[0]) === String(current)) o.selected = true;
      sel.appendChild(o);
    });
  }

  // ---- Setup -----------------------------------------------------------------

  var DEFAULT_A = { pikemen: 4, swordsmen: 3, archers: 2, cavalry: 1 }, DEFAULT_D = { pikemen: 3, archers: 2 };

  function buildSetup() {
    var rows = $('sc-types');
    rows.innerHTML = '';
    C.TYPES.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'type-row';
      row.innerHTML = '<span class="animal">' + I.animal[t] + '</span><span class="tname">' + label(t) + '</span>' +
        '<label class="col-a"><input type="number" min="0" max="60" data-side="a" data-type="' + t + '" value="' + (DEFAULT_A[t] || 0) + '"></label>' +
        '<label class="col-d"><input type="number" min="0" max="60" data-side="d" data-type="' + t + '" value="' + (DEFAULT_D[t] || 0) + '"></label>' +
        '<label class="col-t"><input type="number" min="0" max="60" data-side="t" data-type="' + t + '" value="0"></label>';
      rows.appendChild(row);
    });
    var strategies = options(Object.keys(C.STRATEGY), function (k) { return C.STRATEGY[k].label; });
    var formations = options(Object.keys(C.FORMATION), function (k) { return C.FORMATION[k].label; });
    fillSelect($('sc-strat-a'), strategies, 'engage');
    fillSelect($('sc-form-a'), formations, 'line');
    fillSelect($('sc-scale'), [['village', 'Village (one person a dot)'], ['fortress', 'Fortress (squads of about 20)'], ['country', 'Country (battalions)']], 'fortress');
    fillSelect($('sc-settle'), [['fortress', 'Fortress'], ['town', 'Town'], ['village', 'Village'], ['none', 'Open field (a flag)']], 'fortress');
    fillYou();
    fillSelect($('sc-third-ally'), [['hostile', 'Hostile to both'], ['attacker', 'Allied with the attacker'], ['defender', 'Allied with the defender']], 'hostile');

    // The battlefield generator. Every option here is also in the request, so a replay gets the same ground and rules.
    var G = C.GEN;
    fillSelect($('sc-size'), [['large', 'Large: 2 × 2 screens, with a mini map'], ['small', 'Small: one screen']], G.size);
    fillSelect($('sc-gates'), [['2', '2 openings'], ['3', '3 openings'], ['4', '4 openings']], String(G.gates));
    fillSelect($('sc-river'), [['bridges', 'Deep river, bridges only (chokepoints)'], ['fords', 'Shallow river with fords'], ['none', 'No river']], G.river);
    fillSelect($('sc-ambush'), [['prompt', 'I choose when hidden units strike'], ['auto', 'Hidden units strike on their own']], G.ambush);
    fillSelect($('sc-approach'), [['mixed', 'Mixed: flank, middle or base'], ['flank', 'The flank'], ['centre', 'The middle'], ['base', 'The enemy base'], ['none', 'Stay put until ordered']], G.approach);
    $('sc-woods').checked = G.woods;
    $('sc-roads').checked = G.roads;
    $('sc-grass').checked = G.grass;
    $('sc-walls').checked = G.walls;
    $('sc-fatigue').checked = G.fatigue;
    $('sc-facing').checked = G.facing;

    $('sc-third').addEventListener('change', function () { toggleThird(); fillYou(); });
    $('sc-balance').addEventListener('click', randomTeams);
    $('sc-geo-new').addEventListener('click', function () { $('sc-geo').value = String(Math.floor(Math.random() * 999999) + 1); });
    $('sc-start').addEventListener('click', startFromSetup);
    toggleThird();

    // A number field takes the scroll wheel once it has been tapped: scroll down to lower it, up to raise it.
    document.addEventListener('wheel', function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'INPUT' || el.type !== 'number' || document.activeElement !== el) return;
      e.preventDefault();
      var min = el.min === '' ? 0 : parseFloat(el.min), max = el.max === '' ? Infinity : parseFloat(el.max);
      el.value = String(clamp((parseInt(el.value, 10) || 0) + (e.deltaY < 0 ? 1 : -1), min, max));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { passive: false });
  }

  function toggleThird() {
    var on = $('sc-third').checked;
    document.querySelectorAll('.col-t').forEach(function (el) { el.hidden = !on; });
    $('sc-third-ally').closest('label').hidden = !on;
  }

  // "You are" lists the teams in the battle: the attacker and defender, and the third team when there is one.
  function fillYou() {
    var keep = $('sc-you').value;
    var items = [['0', 'You are the attacker'], ['1', 'You are the defender']];
    if ($('sc-third').checked) items.push(['2', 'You are the third team']);
    fillSelect($('sc-you'), items, keep || '0');
  }

  // Deals a random army to each team, one dot at a time to the weakest, and picks who you are and who the third team allies with.
  function randomTeams() {
    var third = $('sc-third').checked, teams = third ? 3 : 2;
    var dots = third ? 18 + Math.floor(Math.random() * 6) : 14 + Math.floor(Math.random() * 5);
    var t = V4.balanceTeams(dots, V4.rng(Math.floor(Math.random() * 1e9) + 1), teams);
    document.querySelectorAll('input[data-side]').forEach(function (inp) {
      var side = t.sides[SIDE_COL.indexOf(inp.getAttribute('data-side'))];
      inp.value = side ? (side[inp.getAttribute('data-type')] || 0) : 0;
    });
    var you = Math.random() < 0.5 ? '0' : '1';
    $('sc-you').value = you;
    var note = 'Balanced. Attacker ' + Math.round(t.power[0]) + ' power, defender ' + Math.round(t.power[1]);
    if (third) {
      var allies = ['hostile', 'attacker', 'defender'];
      $('sc-third-ally').value = allies[Math.floor(Math.random() * allies.length)];
      note += ', third ' + Math.round(t.power[2]);
    }
    note += '. You are the ' + (you === '0' ? 'attacker' : 'defender') + '.';
    $('sc-balance-note').textContent = note;
  }

  function readCounts(side) {
    var out = [];
    document.querySelectorAll('input[data-side="' + SIDE_COL[side] + '"]').forEach(function (inp) {
      var n = parseInt(inp.value, 10) || 0;
      if (n > 0) out.push({ type: inp.getAttribute('data-type'), count: n });
    });
    return out;
  }

  function readGenerator() {
    return {
      size: $('sc-size').value,
      gates: parseInt($('sc-gates').value, 10),
      river: $('sc-river').value,
      woods: $('sc-woods').checked,
      walls: $('sc-walls').checked,
      roads: $('sc-roads').checked,
      grass: $('sc-grass').checked,
      fatigue: $('sc-fatigue').checked,
      facing: $('sc-facing').checked,
      ambush: $('sc-ambush').value,
      approach: $('sc-approach').value
    };
  }

  function startFromSetup() {
    var typed = parseInt($('sc-seed').value, 10);
    var seed = typed > 0 ? typed : Math.floor(Math.random() * 1e9) + 1;
    var geoTyped = parseInt($('sc-geo').value, 10);
    var geoSeed = geoTyped > 0 ? geoTyped : Math.floor(Math.random() * 999999) + 1;
    $('sc-geo').value = String(geoSeed);
    var scale = $('sc-scale').value, settle = $('sc-settle').value;
    var third = $('sc-third').checked;
    var you = parseInt($('sc-you').value, 10) || 0;
    var gen = readGenerator();
    var woods = gen.woods ? ['grass', 'woods'] : ['grass'];
    var strat = $('sc-strat-a').value, form = $('sc-form-a').value;
    function army(team) {
      return readCounts(team).map(function (r) {
        return { type: r.type, count: r.count, strategy: team === you ? strat : 'engage', formation: team === you ? form : 'line' };
      });
    }
    var alliances = [];
    if (third) {
      var ally = $('sc-third-ally').value;
      if (ally === 'attacker') alliances.push([0, 2]);
      if (ally === 'defender') alliances.push([1, 2]);
    }
    var req = {
      seed: seed,
      geoSeed: geoSeed,
      scale: scale,
      you: you,
      attacker: { nation: 'Attacker', provinces: [1], pool: 600, terrain: woods, units: army(0) },
      defender: {
        nation: 'Defender', province: 2, pool: 600, population: settle === 'none' ? 0 : 60, settlement: settle,
        terrain: woods, ai: true, units: army(1)
      },
      border: { river: gen.river !== 'none', road: gen.roads },
      gen: gen,
      alliances: alliances,
      mode: 'play'
    };
    if (third) req.third = { nation: 'Third team', pool: 600, units: army(2) };
    var problems = V4.validateRequest(req);
    if (problems.length) { alert(problems.join('\n')); return; }
    startBattle(req);
  }

  // ---- Battle screen ---------------------------------------------------------

  function clampCam() {
    cam.x = clamp(cam.x, 0, Math.max(0, st.cols * TILE_PX - VIEW_W));
    cam.y = clamp(cam.y, 0, Math.max(0, st.rows * TILE_PX - VIEW_H));
  }
  function centreCam(px, py) { cam.x = px - VIEW_W / 2; cam.y = py - VIEW_H / 2; clampCam(); }
  function renderCam() {
    svg.setAttribute('viewBox', cam.x + ' ' + cam.y + ' ' + VIEW_W + ' ' + VIEW_H);
    if (mini) {
      mini.view.setAttribute('x', cam.x / TILE_PX);
      mini.view.setAttribute('y', cam.y / TILE_PX);
    }
  }

  function buildMap() {
    svg.innerHTML = '';
    cam = { x: 0, y: 0 };
    layers.tiles = svgEl('g', {}, svg);
    layers.obj = svgEl('g', {}, svg);
    layers.deploy = svgEl('g', {}, svg);
    layers.paths = svgEl('g', {}, svg);
    layers.units = svgEl('g', {}, svg);
    layers.fx = svgEl('g', {}, svg);
    for (var r = 0; r < st.rows; r++) {
      for (var c = 0; c < st.cols; c++) {
        var code = st.field.tiles[r * st.cols + c];
        svgEl('rect', { x: c * TILE_PX, y: r * TILE_PX, width: TILE_PX + 0.5, height: TILE_PX + 0.5, fill: TILE_COLOUR[code] || '#cfe6a0' }, layers.tiles);
      }
    }
    // The deployment strip: the box where your army is placed.
    var b = st.field.bbox[st.you];
    if (b) svgEl('rect', { x: b.x0 * TILE_PX, y: b.y0 * TILE_PX, width: (b.x1 - b.x0) * TILE_PX, height: (b.y1 - b.y0) * TILE_PX, fill: 'rgba(74,123,208,0.18)', 'pointer-events': 'none' }, layers.deploy);
    objEls = st.field.objectives.map(function (o) {
      var g = svgEl('g', {}, layers.obj);
      svgEl('circle', { cx: o.x * TILE_PX, cy: o.y * TILE_PX, r: o.r * TILE_PX, fill: 'rgba(255,255,255,0.25)', 'stroke-dasharray': '6 5', 'stroke-width': 3 }, g);
      var t = svgEl('text', { x: o.x * TILE_PX, y: o.y * TILE_PX - o.r * TILE_PX - 6, 'text-anchor': 'middle', 'font-size': 13, fill: '#333' }, g);
      t.textContent = o.name;
      return { circle: g.firstChild, o: o };
    });
    unitEls = {};
    layers.units.innerHTML = '';
    layers.fx.innerHTML = '';
    fxList = [];
    buildMini();
    renderCam();
  }

  // The mini map: the whole field, the camera window, and the units you can see.
  function buildMini() {
    var m = $('bf-mini');
    m.innerHTML = '';
    m.setAttribute('viewBox', '0 0 ' + st.cols + ' ' + st.rows);
    svgEl('rect', { x: 0, y: 0, width: st.cols, height: st.rows, fill: '#7fa566' }, m);
    for (var r = 0; r < st.rows; r++) {
      for (var c = 0; c < st.cols; c++) {
        var code = st.field.tiles[r * st.cols + c];
        if (code !== 'g') svgEl('rect', { x: c, y: r, width: 1, height: 1, fill: TILE_COLOUR[code] }, m);
      }
    }
    mini = {
      units: svgEl('g', {}, m),
      view: svgEl('rect', { x: 0, y: 0, width: VIEW_W / TILE_PX, height: VIEW_H / TILE_PX, fill: 'rgba(255,255,255,0.15)', stroke: '#fff', 'stroke-width': 0.5 }, m)
    };
    // The mini map is an SVG element, so the hidden state is set as an attribute.
    if (st.cols > C.COLS) m.removeAttribute('hidden'); else m.setAttribute('hidden', '');
  }

  function renderMini() {
    if (!mini || $('bf-mini').hasAttribute('hidden')) return;
    mini.units.innerHTML = '';
    st.units.forEach(function (u) {
      if (u.state === 'dead' || u.state === 'gone' || !isShown(u)) return;
      svgEl('circle', { cx: u.x, cy: u.y, r: isPlayer(u) ? 1.4 : 1.2, fill: FRAME[u.side] }, mini.units);
    });
  }

  // Shapes run along +x, the direction of travel. A column is long along its march; a line is long across it.
  var SHAPE = {
    line: function (g) { svgEl('rect', { x: -5, y: -18, width: 10, height: 36, rx: 4, fill: 'none', stroke: '#222', 'stroke-width': 2 }, g); },
    column: function (g) { svgEl('rect', { x: -22, y: -5, width: 44, height: 10, rx: 4, fill: 'none', stroke: '#222', 'stroke-width': 2 }, g); },
    scatter: function (g) { svgEl('circle', { cx: 0, cy: 0, r: 24, fill: 'none', stroke: '#222', 'stroke-width': 2, 'stroke-dasharray': '3 4' }, g); },
    shield: function (g) { svgEl('rect', { x: -15, y: -13, width: 30, height: 26, rx: 8, fill: 'none', stroke: '#222', 'stroke-width': 3 }, g); }
  };

  function ensureUnit(u) {
    if (unitEls[u.id]) return unitEls[u.id];
    var g = svgEl('g', { 'data-id': u.id, class: 'unit' }, layers.units);
    var ring = svgEl('circle', { cx: 0, cy: 0, r: 28, fill: 'none', stroke: '#ffd24a', 'stroke-width': 3, visibility: 'hidden' }, g);
    var shape = svgEl('g', {}, g);
    var front = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: '#222', 'stroke-width': 3, 'stroke-linecap': 'round', visibility: 'hidden' }, g);
    svgEl('circle', { cx: 0, cy: 0, r: 11, fill: FRAME[u.side], stroke: '#fff', 'stroke-width': 1.5 }, g);
    var animal = svgEl('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 14 }, g);
    animal.textContent = I.animal[u.type];
    var count = svgEl('text', { x: 0, y: 24, 'text-anchor': 'middle', 'font-size': 11, fill: '#222', 'font-weight': 700 }, g);
    unitEls[u.id] = { g: g, ring: ring, shape: shape, front: front, shapeName: null, count: count };
    return unitEls[u.id];
  }

  // Enemies you cannot see are not drawn. Your side and allies are always shown. Once the battle is over, everything is.
  function isShown(u) {
    if (st.done || isAlly(u)) return true;
    return !!st.seen[st.you][u.id];
  }

  function facingOn() { return !!st.gen.facing && st.scale !== 'village'; }

  function renderUnits() {
    var seen = {}, fo = facingOn();
    st.units.forEach(function (u) {
      if (u.state === 'dead' || u.state === 'gone') return;
      var el = ensureUnit(u);
      seen[u.id] = true;
      el.g.setAttribute('transform', 'translate(' + (u.x * TILE_PX) + ',' + (u.y * TILE_PX) + ')');
      el.g.setAttribute('opacity', u.state === 'routing' ? '0.45' : (u.hidden && isPlayer(u) ? '0.55' : '1'));
      el.g.setAttribute('visibility', isShown(u) ? 'visible' : 'hidden');
      if (el.shapeName !== u.formation) {
        el.shape.innerHTML = '';
        SHAPE[u.formation](el.shape);
        el.shapeName = u.formation;
      }
      el.shape.setAttribute('transform', fo ? 'rotate(' + (u.dir * DEG) + ')' : '');
      el.front.setAttribute('visibility', fo && isShown(u) ? 'visible' : 'hidden');
      if (fo) {
        el.front.setAttribute('x2', Math.cos(u.dir) * 26);
        el.front.setAttribute('y2', Math.sin(u.dir) * 26);
      }
      el.ring.setAttribute('visibility', sel === u.id ? 'visible' : 'hidden');
      el.count.textContent = String(people(u.people));
    });
    Object.keys(unitEls).forEach(function (id) {
      if (!seen[id]) { layers.units.removeChild(unitEls[id].g); delete unitEls[id]; }
    });
  }

  // The route being edited: the drag preview while a point is dragged, otherwise the unit's own route.
  function routePoints(u) {
    if (drag && u && drag.unit === u.id) return drag.points;
    return u && u.order && u.order.kind === 'route' ? u.order.points : [];
  }

  function pts(list) { return list.map(function (p) { return (p.x * TILE_PX) + ',' + (p.y * TILE_PX); }).join(' '); }

  // Planned marches are dashed lines; a unit that will stop has a dashed ring where it will stand.
  // The selected unit's route can be edited: points are handles, and the lines between them are tapped to add a point.
  var pathKey = '';
  function renderPaths() {
    var mode = $('bf-paths').value;
    var group = selGroup !== null ? st.units.filter(function (u) { return u.side === st.you && u.group === selGroup; }) : [];
    var specs = [];
    st.units.forEach(function (u) {
      if (u.state !== 'active' || !isPlayer(u) || mode === 'none') return;
      if (mode === 'selected' && u.id !== sel && group.indexOf(u) < 0) return;
      var path = V4.plannedPath(st, u);
      if (!path) return;
      if (path.kind === 'march' && path.points.length > 1) specs.push({ k: 'march', c: FRAME[u.side], p: pts(path.points) });
      else if (path.kind === 'stop' && path.stop) specs.push({ k: 'stop', c: FRAME[u.side], x: path.stop.x, y: path.stop.y });
    });
    var su = sel !== null ? V4.sim.findUnit(st, sel) : null;
    if (su && planning() && isPlayer(su) && su.state === 'active') {
      var list = routePoints(su);
      specs.push({ k: 'edit', c: FRAME[su.side], from: [su.x, su.y], pts: list.map(function (p) { return [p.x, p.y]; }) });
    }
    // Rebuild only when something shown has changed, so the handles under the pointer stay put while dragging.
    var key = JSON.stringify(specs);
    if (key === pathKey) return;
    pathKey = key;
    layers.paths.innerHTML = '';
    specs.forEach(function (sp) {
      if (sp.k === 'march') {
        svgEl('polyline', { points: sp.p, fill: 'none', stroke: sp.c, 'stroke-width': 3, 'stroke-dasharray': '10 7', opacity: 0.85, 'pointer-events': 'none' }, layers.paths);
      } else if (sp.k === 'stop') {
        svgEl('circle', { cx: sp.x * TILE_PX, cy: sp.y * TILE_PX, r: 1.2 * TILE_PX, fill: 'none', stroke: sp.c, 'stroke-width': 2.5, 'stroke-dasharray': '5 4', opacity: 0.85, 'pointer-events': 'none' }, layers.paths);
      } else if (sp.k === 'edit') {
        var prev = { x: sp.from[0], y: sp.from[1] };
        sp.pts.forEach(function (p, i) {
          // The line into point i: tap it to insert a point there.
          svgEl('line', { x1: prev.x * TILE_PX, y1: prev.y * TILE_PX, x2: p[0] * TILE_PX, y2: p[1] * TILE_PX, stroke: 'rgba(0,0,0,0)', 'stroke-width': 16, 'data-seg': i, class: 'seg' }, layers.paths);
          prev = { x: p[0], y: p[1] };
        });
        sp.pts.forEach(function (p, i) {
          svgEl('circle', { cx: p[0] * TILE_PX, cy: p[1] * TILE_PX, r: 8, fill: '#fff', stroke: sp.c, 'stroke-width': 3, 'data-h': i, class: 'handle' }, layers.paths);
          var t = svgEl('text', { x: p[0] * TILE_PX, y: p[1] * TILE_PX + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#222', 'pointer-events': 'none' }, layers.paths);
          t.textContent = String(i + 1);
        });
      }
    });
  }

  // A hidden unit with an enemy in reach offers a strike. The player taps it; the computer strikes on its own.
  function renderPops() {
    var pop = $('bf-pops');
    var list = st.units.filter(function (u) { return isPlayer(u) && u.state === 'active' && u.strikePrompt; });
    var key = list.map(function (u) { return u.id; }).join(',');
    if (key !== popKey) {
      pop.innerHTML = '';
      list.forEach(function (u) {
        var b = document.createElement('button');
        b.className = 'strike-pop';
        b.type = 'button';
        b.setAttribute('data-id', u.id);
        b.textContent = '⚔ Strike!';
        pop.appendChild(b);
      });
      popKey = key;
    }
    Array.prototype.forEach.call(pop.children, function (b) {
      var u = V4.sim.findUnit(st, parseInt(b.getAttribute('data-id'), 10));
      if (!u) { b.hidden = true; return; }
      var px = u.x * TILE_PX - cam.x, py = u.y * TILE_PX - cam.y;
      b.hidden = px < 0 || py < 0 || px > VIEW_W || py > VIEW_H;
      b.style.left = (px / VIEW_W * 100) + '%';
      b.style.top = (py / VIEW_H * 100) + '%';
    });
  }

  function renderObjectives() {
    objEls.forEach(function (oe) {
      var owner = oe.o.owner;
      oe.circle.setAttribute('fill', owner === null ? 'rgba(255,255,255,0.25)' : FRAME_FILL[owner]);
      oe.circle.setAttribute('stroke', owner === null ? '#666' : FRAME[owner]);
    });
  }

  // Volleys are short-lived arrows, shots are stones on an arc. Both come from the sim's events.
  function drainEvents() {
    st.events.forEach(function (e) {
      if (!st.animate) return;
      if (e.kind === 'volley') {
        var l = svgEl('line', { x1: e.x1 * TILE_PX, y1: e.y1 * TILE_PX, x2: e.x2 * TILE_PX, y2: e.y2 * TILE_PX, stroke: '#3b3b3b', 'stroke-width': 2, 'stroke-dasharray': '10 6' }, layers.fx);
        fxList.push({ el: l, kind: 'volley', born: performance.now(), life: 450 });
      } else if (e.kind === 'shot') {
        var c = svgEl('circle', { cx: e.x1 * TILE_PX, cy: e.y1 * TILE_PX, r: 5, fill: '#6b5a3a' }, layers.fx);
        fxList.push({ el: c, kind: 'shot', born: performance.now(), life: 800, x1: e.x1 * TILE_PX, y1: e.y1 * TILE_PX, x2: e.x2 * TILE_PX, y2: e.y2 * TILE_PX });
      }
    });
    st.events = [];
  }

  function updateFx(now) {
    fxList = fxList.filter(function (f) {
      var k = (now - f.born) / f.life;
      if (k >= 1) { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); return false; }
      if (f.kind === 'shot') {
        var x = f.x1 + (f.x2 - f.x1) * k, y = f.y1 + (f.y2 - f.y1) * k - Math.sin(k * Math.PI) * 60;
        f.el.setAttribute('cx', x); f.el.setAttribute('cy', y);
      } else {
        f.el.setAttribute('opacity', String(1 - k));
      }
      return true;
    });
  }

  // The formation panel: one row per formation, with its size, its selection, and its shared commands.
  function buildGroups() {
    var box = $('bf-groups');
    box.innerHTML = '';
    [1, 2].forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'group-row';
      row.setAttribute('data-group-row', String(g));
      row.innerHTML = '<strong class="gname">' + C.GROUP_NAME[g] + '</strong> <span class="gcount muted small"></span>' +
        '<div class="row">' +
        '<button type="button" class="ghost" data-group-select="' + g + '">Select formation</button>' +
        '<button type="button" class="ghost" data-group-hold="' + g + '">Hold formation</button>' +
        '<label>Strategy <select data-group-strategy="' + g + '"></select></label>' +
        '<label>Shape <select data-group-formation="' + g + '"></select></label>' +
        '</div>';
      box.appendChild(row);
      fillSelect(row.querySelector('[data-group-strategy]'), options(Object.keys(C.STRATEGY), function (k) { return C.STRATEGY[k].label; }), 'engage');
      fillSelect(row.querySelector('[data-group-formation]'), options(Object.keys(C.FORMATION), function (k) { return C.FORMATION[k].label; }), 'line');
    });
    $('bf-groups').addEventListener('click', onGroupClick);
    $('bf-groups').addEventListener('change', onGroupChange);
  }

  function groupMembers(g) { return st.units.filter(function (u) { return isPlayer(u) && u.group === g && u.state === 'active'; }); }

  function renderGroups() {
    [1, 2].forEach(function (g) {
      var row = document.querySelector('[data-group-row="' + g + '"]');
      if (!row) return;
      var n = groupMembers(g).length;
      row.querySelector('.gcount').textContent = n + (n === 1 ? ' unit' : ' units') + (selGroup === g ? ' · selected: tap ground to march it' : '');
      row.querySelector('[data-group-select]').textContent = selGroup === g ? 'Deselect' : 'Select formation';
      row.classList.toggle('selected', selGroup === g);
    });
  }

  function onGroupClick(e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b || !st) return;
    if (b.hasAttribute('data-group-select')) {
      var g = parseInt(b.getAttribute('data-group-select'), 10);
      selGroup = selGroup === g ? null : g;
      sel = null; lastSelected = undefined;
    } else if (b.hasAttribute('data-group-hold')) {
      V4.issue(st, { kind: 'group', group: parseInt(b.getAttribute('data-group-hold'), 10), action: 'hold' });
    }
  }

  function onGroupChange(e) {
    var s = e.target;
    if (!st || !s.tagName || s.tagName !== 'SELECT') return;
    if (s.hasAttribute('data-group-strategy')) V4.issue(st, { kind: 'group', group: parseInt(s.getAttribute('data-group-strategy'), 10), action: 'strategy', value: s.value });
    if (s.hasAttribute('data-group-formation')) V4.issue(st, { kind: 'group', group: parseInt(s.getAttribute('data-group-formation'), 10), action: 'formation', value: s.value });
  }

  function hud() {
    var mine = 0, theirs = 0, objMine = 0, prompts = 0;
    st.units.forEach(function (u) {
      if (u.strikePrompt && isPlayer(u)) prompts++;
      if (u.state !== 'active' && u.state !== 'routing') return;
      if (isAlly(u)) mine += people(u.people);
      else if (isShown(u)) theirs += people(u.people);
    });
    st.field.objectives.forEach(function (o) { if (o.owner !== null && V4.sim.allied(st, o.owner, st.you)) objMine++; });
    $('bf-time').textContent = fmtTime(st.t);
    $('bf-seed').textContent = 'Seed ' + st.seed + ' · ground ' + (st.req.geoSeed || st.seed);
    $('bf-score').textContent = 'Your people ' + mine + ' · theirs ' + theirs + ' seen · objectives ' + objMine + '/' + st.field.objectives.length;
    $('bf-toggle').textContent = paused ? '▶ Real time' : '❚❚ Pause';
    $('bf-toggle').disabled = phase !== 'battle' || st.done;
    $('bf-begin').hidden = phase !== 'deploy';
    $('bf-surrender').disabled = phase === 'deploy' || !!st.done;
    $('bf-deploy-note').hidden = phase !== 'deploy';
    layers.deploy.setAttribute('visibility', phase === 'deploy' ? 'visible' : 'hidden');

    var u = sel !== null ? V4.sim.findUnit(st, sel) : null;
    var panel = $('bf-unit');
    if (!u || u.state === 'dead' || u.state === 'gone') {
      sel = null;
      panel.hidden = true;
    } else {
      panel.hidden = false;
      $('bf-unit-name').textContent = I.animal[u.type] + ' ' + label(u.type) + (u.levy ? ' (levy)' : '');
      var ORDER_WORDS = { route: 'marching', hold: 'holding', attack: 'attacking a unit' };
      var doing = u.state === 'routing' ? 'routing' : (u.order ? ORDER_WORDS[u.order.kind] : (u.station ? 'holding station' : (u.hidden ? 'hidden in cover' : 'following orders')));
      var extra = st.gen.fatigue && u.fat >= 50 ? ' · tired' : '';
      $('bf-unit-info').textContent = people(u.people) + ' people · morale ' + Math.max(0, Math.round(u.morale)) + ' · ' + doing + extra;
      var pts = routePoints(u).length;
      $('bf-route-info').textContent = pts ? 'Route: ' + pts + ' point' + (pts === 1 ? '' : 's') + '. Drag a numbered point to move it; tap a dashed line to add one.' : 'No route. Tap ground to start one.';
      if (lastSelected !== u.id) {
        fillSelect($('bf-unit-group'), [['1', C.GROUP_NAME[1]], ['2', C.GROUP_NAME[2]]], u.group);
        fillSelect($('bf-unit-strategy'), options(Object.keys(C.STRATEGY), function (k) { return C.STRATEGY[k].label; }), u.strategy);
        fillSelect($('bf-unit-formation'), options(Object.keys(C.FORMATION), function (k) { return C.FORMATION[k].label; }), u.formation);
        lastSelected = u.id;
      }
      $('bf-unit-group').disabled = phase === 'over';
      $('bf-unit-strategy').disabled = phase === 'over';
      $('bf-unit-formation').disabled = phase === 'over';
    }
    renderGroups();
    if (phase === 'deploy') {
      $('bf-hint').textContent = 'Deploy: tap one of your units, then tap ground inside the blue strip to place it. Begin when ready.';
    } else if (prompts) {
      $('bf-hint').textContent = 'A hidden unit has an enemy in reach. Tap ⚔ Strike! to hit, or wait.';
    } else if (selGroup !== null) {
      $('bf-hint').textContent = 'Tap ground to march the formation. Each unit keeps its place in it.';
    } else if (sel !== null && planning()) {
      $('bf-hint').textContent = 'Planning: tap ground to add a point to this route, drag a point to move it, or tap a dashed line to add one between. Tap Done when you have finished.';
    } else if (sel !== null) {
      $('bf-hint').textContent = $('bf-click-mode').value === 'rush'
        ? 'Rush move: the unit runs to the point and ignores enemies on the way.'
        : 'Attack move: the unit fights what it meets on the way.';
    } else {
      $('bf-hint').textContent = 'Tap one of your units, or a formation above, to give orders. Pause to plan routes.';
    }
  }

  function toMap(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x / TILE_PX, y: p.y / TILE_PX };
  }

  function deselectAll() { sel = null; selGroup = null; lastSelected = undefined; }

  // The route for the selected unit, with its points as the sim now holds them.
  function sendRoute(u, points) {
    if (!points.length) { V4.issue(st, { kind: 'hold', unit: u.id }); return; }
    V4.issue(st, { kind: 'route', unit: u.id, points: points, mode: $('bf-click-mode').value === 'rush' ? 'rush' : 'move' });
  }

  // Taps on the map: pick a unit, add a point to a route (planning), move or attack (real time), or march a formation.
  function onMapClick(evt) {
    if (!st || phase === 'over' || phase === 'setup' || phase === 'replay') return;
    if (skipClick) { skipClick = false; return; }
    var t = evt.target;
    if (t && t.getAttribute && t.getAttribute('data-h') !== null) return;   // a handle: dragging, not a tap
    if (t && t.getAttribute && t.getAttribute('data-seg') !== null && sel !== null) {
      var su = V4.sim.findUnit(st, sel), i = parseInt(t.getAttribute('data-seg'), 10), p = toMap(evt);
      if (su && isPlayer(su) && planning()) {
        var list = routePoints(su).slice();
        list.splice(i, 0, { x: p.x, y: p.y });
        sendRoute(su, list);
      }
      return;
    }
    var g = t && t.closest ? t.closest('[data-id]') : null;
    if (g) {
      var id = parseInt(g.getAttribute('data-id'), 10);
      var target = V4.sim.findUnit(st, id);
      if (!target || !isShown(target)) return;
      if (isPlayer(target)) { sel = id; selGroup = null; lastSelected = undefined; return; }
      if (sel !== null && phase === 'battle') { V4.issue(st, { kind: 'attack', unit: sel, target: id }); sel = null; lastSelected = undefined; }
      return;
    }
    var p2 = toMap(evt);
    if (phase === 'deploy') {
      if (sel !== null) V4.issue(st, { kind: 'place', unit: sel, x: p2.x, y: p2.y });
      return;
    }
    if (phase !== 'battle') return;
    if (selGroup !== null) {
      V4.issue(st, { kind: 'group', group: selGroup, action: $('bf-click-mode').value === 'rush' ? 'rush' : 'move', x: p2.x, y: p2.y });
      selGroup = null; sel = null; lastSelected = undefined;
      return;
    }
    if (sel === null) return;
    var u = V4.sim.findUnit(st, sel);
    if (!u) return;
    if (planning()) {
      sendRoute(u, routePoints(u).concat([{ x: p2.x, y: p2.y }]));
      return;
    }
    // Real time: a single move or rush, then the unit is deselected.
    V4.issue(st, { kind: $('bf-click-mode').value, unit: sel, x: p2.x, y: p2.y });
    sel = null; lastSelected = undefined;
  }

  // Dragging a route point: the point follows the pointer and the route is sent when it is let go.
  function onPointerDown(evt) {
    skipClick = false;   // every press starts fresh: a tap after an earlier drag is a new tap
    var t = evt.target;
    if (!t || !t.getAttribute || t.getAttribute('data-h') === null || sel === null || !planning()) return;
    var su = V4.sim.findUnit(st, sel);
    if (!su) return;
    drag = { unit: sel, index: parseInt(t.getAttribute('data-h'), 10), points: routePoints(su).map(function (p) { return { x: p.x, y: p.y }; }), moved: false, start: null };
    if (svg.setPointerCapture) { try { svg.setPointerCapture(evt.pointerId); } catch (e) { /* not needed */ } }
    evt.preventDefault();
  }
  function onPointerMove(evt) {
    if (!drag) return;
    var p = toMap(evt);
    if (!drag.moved) {
      if (drag.start && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 0.2) return;   // a small wobble is not a drag
      drag.start = drag.start || p;
      drag.moved = true;
    }
    drag.points[drag.index] = { x: clamp(p.x, 0.5, st.cols - 0.5), y: clamp(p.y, 0.5, st.rows - 0.5) };
  }
  function onPointerUp() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!d.moved) return;          // a tap on a handle: the click that follows is ignored by the handle check
    skipClick = true;              // a drag: the click that ends it is not a new tap
    var su = V4.sim.findUnit(st, d.unit);
    if (su) sendRoute(su, d.points);
  }

  function startBattle(req) {
    st = V4.createBattle(req, { animate: true });
    st.req = req;
    replay = null;
    $('bf-replay-bar').hidden = true;
    deselectAll(); paused = false; acc = 0; popKey = ''; drag = null; skipClick = false;
    phase = 'deploy'; lastTs = null;
    $('screen-setup').hidden = true;
    $('screen-battle').hidden = false;
    $('bf-result').hidden = true;
    $('bf-watch').hidden = true;
    $('bf-unit').hidden = true;
    $('bf-count').hidden = true;
    $('bf-pops').innerHTML = '';
    buildMap();
    buildGroups();
    renderObjectives();
    renderUnits();
    hud();
  }

  function beginBattle() {
    if (phase !== 'deploy') return;
    phase = 'countdown';
    countT = COUNTDOWN;
    deselectAll();
  }

  function showResult() {
    var r = V4.result(st);
    var mine = ['attacker', 'defender', 'third'][st.you];
    var youWin = r.winners.indexOf(mine) >= 0;
    var how = {
      objectives: 'by holding the objectives',
      rout: 'because the other side had no units left',
      surrender: 'because the other side gave up',
      time: 'because the time ran out with the objectives not all held'
    }[r.how] || r.how;
    $('bf-result-title').textContent = youWin ? 'You win ' + how + '.' : (r.winner ? r.winner.charAt(0).toUpperCase() + r.winner.slice(1) + ' wins ' + how + '.' : 'No one wins.');
    var killList = function (side) {
      return C.TYPES.filter(function (t) { return side[t] > 0.5; })
        .map(function (t) { return Math.round(side[t]) + ' by ' + label(t).toLowerCase(); }).join(', ') || 'none';
    };
    var lossList = function (side) {
      return C.TYPES.filter(function (t) { return side[t] > 0.5; })
        .map(function (t) { return Math.round(side[t]) + ' ' + label(t).toLowerCase(); }).join(', ') || 'none';
    };
    $('bf-result-body').textContent =
      'Battle lasted ' + r.seconds + ' s. Attacker losses: ' + lossList(r.losses.attacker) + '. ' +
      'Defender losses: ' + lossList(r.losses.defender) + '.' +
      (st.teams > 2 ? ' Third team losses: ' + lossList(r.losses.third) + '.' : '') +
      ' Kills by the attacker: ' + killList(r.killsBy.attacker) + '. Kills by the defender: ' + killList(r.killsBy.defender) + '.' +
      (r.captured ? ' The settlement is held by the attacker.' : '') + (r.levies ? ' Levies raised: ' + r.levies + '.' : '') +
      ' Seed ' + r.seed + '.';
    $('bf-result-json').value = JSON.stringify(r, null, 2);
    $('bf-watch').hidden = !youWin;   // upon victory, the battle can be watched again at a chosen speed
    $('bf-result').hidden = false;
    $('bf-save-status').textContent = 'Saving the replay…';
    // Each finished battle is saved on this device, then to the family database if signed in.
    V4.replays.save(st.req, st.commands, r).then(function (msg) { $('bf-save-status').textContent = msg; });
  }

  // Upon victory: the same battle again, drawn step by step at the chosen speed. The orders are the ones given in play,
  // each on its tick, so the replay is the same battle. Orders are blocked while it plays.
  function startReplay() {
    if (!st || !st.req || !st.done) return;
    var live = st;
    var rs = V4.createBattle(st.req, { animate: true });
    rs.req = st.req;
    replay = {
      live: live, st: rs, i: 0, acc: 0, speed: Number($('bf-speed').value) || 1,
      cmds: (live.commands || []).slice().sort(function (a, b) { return a.tick - b.tick; })
    };
    st = rs; phase = 'replay'; paused = false; acc = 0; popKey = '';
    deselectAll();
    $('bf-result').hidden = true;
    $('bf-replay-bar').hidden = false;
    buildMap();
    buildGroups();
    renderObjectives();
    renderUnits();
    hud();
  }
  // One frame of a replay: the fixed steps at the chosen speed, with each order put back on its tick.
  function stepReplay(real) {
    var R = replay, rs = R.st;
    if (paused) return;
    R.acc += real * R.speed;
    var n = 0;
    while (R.acc >= C.TICK && n < MAX_STEPS && !rs.done) {
      while (R.i < R.cmds.length && R.cmds[R.i].tick === rs.tick) { V4.issue(rs, R.cmds[R.i].cmd); R.i++; }
      V4.step(rs); R.acc -= C.TICK; n++;
    }
    if (n === MAX_STEPS) R.acc = 0;
    if (rs.done) endReplay();
  }
  function endReplay() {
    if (!replay) return;
    st = replay.live; replay = null;
    phase = 'over'; paused = false;
    $('bf-replay-bar').hidden = true;
    $('bf-result').hidden = false;
    buildMap();
    buildGroups();
    renderObjectives();
    renderUnits();
    hud();
  }

  // The replay is the request plus every order given, with the tick it was given on.
  function copyReplay() {
    var text = JSON.stringify({ request: st.req, commands: st.commands, result: V4.result(st) }, null, 2);
    var box = $('bf-result-json');
    box.value = text;
    box.select();
    try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () { /* refused: the text is selected to copy */ }); } catch (e) { /* no clipboard API */ }
  }

  function backToSetup() {
    $('screen-battle').hidden = true;
    $('screen-setup').hidden = false;
    phase = 'setup';
    st = null;
  }

  // ---- Frame loop -------------------------------------------------------------

  function frame(ts) {
    if (lastTs === null) lastTs = ts;
    var real = Math.min(0.25, (ts - lastTs) / 1000);
    lastTs = ts;
    if (st) {
      if (phase === 'countdown') {
        countT -= real;
        $('bf-count').hidden = false;
        $('bf-count').textContent = countT > 0.6 ? String(Math.ceil(countT - 0.6)) : (countT > 0 ? 'Go!' : '');
        if (countT <= 0) { phase = 'battle'; $('bf-count').hidden = true; }
      } else if (phase === 'battle' && !paused && !st.done) {
        // Real time is turned into whole fixed steps, so the battle depends only on the seed and the orders.
        acc += real;
        var n = 0;
        while (acc >= C.TICK && n < MAX_STEPS && !st.done) { V4.step(st); acc -= C.TICK; n++; }
        if (n === MAX_STEPS) acc = 0;
      }
      if (phase === 'replay') stepReplay(real);
      else if (st.done && phase !== 'over') { phase = 'over'; showResult(); }
      drainEvents();
      renderUnits();
      renderObjectives();
      renderPaths();
      renderPops();
      renderMini();
      renderCam();
      updateFx(performance.now());
      hud();
    }
    requestAnimationFrame(frame);
  }

  function wire() {
    buildSetup();
    svg = $('bf-svg');
    svg.addEventListener('click', onMapClick);
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    $('bf-pops').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.strike-pop') : null;
      if (!b || !st || phase !== 'battle') return;
      V4.issue(st, { kind: 'strike', unit: parseInt(b.getAttribute('data-id'), 10) });
    });
    $('bf-mini').addEventListener('click', function (e) {
      var r = $('bf-mini').getBoundingClientRect();
      centreCam(((e.clientX - r.left) / r.width) * st.cols * TILE_PX, ((e.clientY - r.top) / r.height) * st.rows * TILE_PX);
    });
    var pan = { 'cam-l': [-PAN, 0], 'cam-r': [PAN, 0], 'cam-u': [0, -PAN], 'cam-d': [0, PAN] };
    Object.keys(pan).forEach(function (id) {
      $(id).addEventListener('click', function () {
        cam.x += pan[id][0] * TILE_PX; cam.y += pan[id][1] * TILE_PX; clampCam();
      });
    });
    $('bf-begin').addEventListener('click', beginBattle);
    $('bf-toggle').addEventListener('click', function () { if ((phase === 'battle' || phase === 'replay') && st && !st.done) paused = !paused; });
    $('bf-watch').addEventListener('click', startReplay);
    $('bf-speed').addEventListener('change', function (e) { if (replay) replay.speed = Number(e.target.value) || 1; });
    $('bf-replay-stop').addEventListener('click', endReplay);
    $('bf-surrender').addEventListener('click', function () { if (st && phase === 'battle' && !st.done) V4.issue(st, { kind: 'surrender', side: st.you }); });
    $('bf-hold').addEventListener('click', function () { if (sel !== null && phase === 'battle') { V4.issue(st, { kind: 'hold', unit: sel }); sel = null; lastSelected = undefined; } });
    $('bf-stop').addEventListener('click', function () { if (sel !== null && phase !== 'over') { V4.issue(st, { kind: 'hold', unit: sel }); } });
    $('bf-remove-point').addEventListener('click', function () {
      var su = sel !== null ? V4.sim.findUnit(st, sel) : null;
      if (!su || !planning()) return;
      var list = routePoints(su).slice(0, -1);
      if (list.length) sendRoute(su, list); else V4.issue(st, { kind: 'hold', unit: su.id });
    });
    $('bf-proceed').addEventListener('click', function () { if (sel !== null && phase === 'battle') { V4.issue(st, { kind: 'proceed', unit: sel }); sel = null; lastSelected = undefined; } });
    $('bf-done').addEventListener('click', function () { deselectAll(); });
    $('bf-unit-group').addEventListener('change', function (e) { if (sel !== null) V4.issue(st, { kind: 'assign', unit: sel, group: parseInt(e.target.value, 10) }); });
    $('bf-unit-strategy').addEventListener('change', function (e) { if (sel !== null) V4.issue(st, { kind: 'strategy', unit: sel, value: e.target.value }); });
    $('bf-unit-formation').addEventListener('change', function (e) { if (sel !== null) V4.issue(st, { kind: 'formation', unit: sel, value: e.target.value }); });
    $('bf-copy').addEventListener('click', copyReplay);
    $('bf-again').addEventListener('click', backToSetup);
    $('bf-back-setup').addEventListener('click', backToSetup);
    requestAnimationFrame(frame);
  }

  // state() gives the running battle, so a test can look at it. The game itself does not need it.
  V4.view = { start: startBattle, state: function () { return st; } };
  document.addEventListener('DOMContentLoaded', wire);
})();
