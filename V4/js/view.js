// Expansion Wars — V4 custom battle view. Setup, placement, the battle on an SVG field, orders, pause, and the result.
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

  var st = null, sel = null, phase = 'setup', paused = false, countT = 0, lastTs = null, acc = 0;
  var svg, layers = {}, unitEls = {}, objEls = [], fxList = [], lastSelected;
  var cam = { x: 0, y: 0 }, mini = null, popKey = '';
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
        '<label>You <input type="number" min="0" max="30" data-side="a" data-type="' + t + '" value="' + (DEFAULT_A[t] || 0) + '"></label>' +
        '<label>Them <input type="number" min="0" max="30" data-side="d" data-type="' + t + '" value="' + (DEFAULT_D[t] || 0) + '"></label>';
      rows.appendChild(row);
    });
    var strategies = options(Object.keys(C.STRATEGY), function (k) { return C.STRATEGY[k].label; });
    var formations = options(Object.keys(C.FORMATION), function (k) { return C.FORMATION[k].label; });
    fillSelect($('sc-strat-a'), strategies, 'engage');
    fillSelect($('sc-form-a'), formations, 'line');
    fillSelect($('sc-scale'), [['village', 'Village (one person a dot)'], ['fortress', 'Fortress (squads of about 20)'], ['country', 'Country (battalions)']], 'fortress');
    fillSelect($('sc-settle'), [['fortress', 'Fortress'], ['town', 'Town'], ['village', 'Village'], ['none', 'Open field (a flag)']], 'fortress');

    // The battlefield generator. Every option here is also in the request, so a replay gets the same ground.
    var G = C.GEN;
    fillSelect($('sc-size'), [['large', 'Large: 2 × 2 screens, with a mini map'], ['small', 'Small: one screen']], G.size);
    fillSelect($('sc-gates'), [['2', '2 openings'], ['3', '3 openings'], ['4', '4 openings']], String(G.gates));
    fillSelect($('sc-river'), [['bridges', 'Deep river, bridges only (chokepoints)'], ['fords', 'Shallow river with fords'], ['none', 'No river']], G.river);
    fillSelect($('sc-ambush'), [['prompt', 'I choose when hidden units strike'], ['auto', 'Hidden units strike on their own']], G.ambush);
    fillSelect($('sc-approach'), [['mixed', 'Mixed: flank, middle or base'], ['flank', 'The flank'], ['centre', 'The middle'], ['base', 'The enemy base'], ['none', 'Stay put until ordered']], G.approach);
    $('sc-roads').checked = G.roads;
    $('sc-grass').checked = G.grass;
    $('sc-fatigue').checked = G.fatigue;
    $('sc-facing').checked = G.facing;

    $('sc-balance').addEventListener('click', randomTeams);
    $('sc-start').addEventListener('click', startFromSetup);
  }

  // Deals a random army to each side, one dot at a time to the weaker side, so the teams come out close in strength.
  function randomTeams() {
    var dots = 14 + Math.floor(Math.random() * 5);
    var t = V4.balanceTeams(dots, V4.rng(Math.floor(Math.random() * 1e9) + 1));
    document.querySelectorAll('input[data-side]').forEach(function (inp) {
      var side = inp.getAttribute('data-side') === 'a' ? t.a : t.b;
      inp.value = side[inp.getAttribute('data-type')] || 0;
    });
    $('sc-balance-note').textContent = 'Balanced. You ' + Math.round(t.power[0]) + ' power, them ' + Math.round(t.power[1]) + '.';
  }

  function readCounts(side) {
    var out = [];
    document.querySelectorAll('input[data-side="' + side + '"]').forEach(function (inp) {
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
    var scale = $('sc-scale').value, settle = $('sc-settle').value;
    var woods = $('sc-woods').checked ? ['grass', 'woods'] : ['grass'];
    var gen = readGenerator();
    var req = {
      seed: seed,
      scale: scale,
      attacker: {
        nation: 'You', provinces: [1], pool: 600, terrain: woods,
        units: readCounts('a').map(function (r) { return { type: r.type, count: r.count, strategy: $('sc-strat-a').value, formation: $('sc-form-a').value }; })
      },
      defender: {
        nation: 'Them', province: 2, pool: 600, population: settle === 'none' ? 0 : 60, settlement: settle,
        terrain: woods, ai: true,
        // The defender is planned by the computer: about a third ambush in woods, the rest hold a station.
        units: readCounts('d').map(function (r) { return { type: r.type, count: r.count, strategy: 'engage', formation: 'line' }; })
      },
      border: { river: gen.river !== 'none', road: gen.roads },
      gen: gen,
      mode: 'play'
    };
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
    layers.units = svgEl('g', {}, svg);
    layers.fx = svgEl('g', {}, svg);
    for (var r = 0; r < st.rows; r++) {
      for (var c = 0; c < st.cols; c++) {
        var code = st.field.tiles[r * st.cols + c];
        svgEl('rect', { x: c * TILE_PX, y: r * TILE_PX, width: TILE_PX + 0.5, height: TILE_PX + 0.5, fill: TILE_COLOUR[code] || '#cfe6a0' }, layers.tiles);
      }
    }
    svgEl('rect', { x: 0, y: 0, width: (st.deployX + 0.5) * TILE_PX, height: st.rows * TILE_PX, fill: 'rgba(74,123,208,0.18)', 'pointer-events': 'none' }, layers.deploy);
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
      svgEl('circle', { cx: u.x, cy: u.y, r: u.side === 0 ? 1.4 : 1.2, fill: FRAME[u.side] }, mini.units);
    });
  }

  var FRAME = { 0: '#4a7bd0', 1: '#d05a4a' };
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

  // Enemies you cannot see are not drawn. Once the battle is over, everything is shown.
  function isShown(u) {
    if (u.side === 0 || st.done) return true;
    return !!st.seen[0][u.id];
  }

  function facingOn() { return !!st.gen.facing && st.scale !== 'village'; }

  function renderUnits() {
    var seen = {}, fo = facingOn();
    st.units.forEach(function (u) {
      if (u.state === 'dead' || u.state === 'gone') return;
      var el = ensureUnit(u);
      seen[u.id] = true;
      el.g.setAttribute('transform', 'translate(' + (u.x * TILE_PX) + ',' + (u.y * TILE_PX) + ')');
      el.g.setAttribute('opacity', u.state === 'routing' ? '0.45' : (u.hidden && u.side === 0 ? '0.55' : '1'));
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

  // A hidden unit with an enemy in reach offers a strike. The player taps it; the computer strikes on its own.
  function renderPops() {
    var pop = $('bf-pops');
    var list = st.units.filter(function (u) { return u.side === 0 && u.state === 'active' && u.strikePrompt; });
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
      oe.circle.setAttribute('fill', owner === 0 ? 'rgba(74,123,208,0.35)' : owner === 1 ? 'rgba(208,90,74,0.35)' : 'rgba(255,255,255,0.25)');
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

  function hud() {
    var mine = 0, theirs = 0, objMine = 0, prompts = 0;
    st.units.forEach(function (u) {
      if (u.strikePrompt && u.side === 0) prompts++;
      if (u.state !== 'active' && u.state !== 'routing') return;
      if (u.side === 0) mine += people(u.people);
      else if (isShown(u)) theirs += people(u.people);
    });
    st.field.objectives.forEach(function (o) { if (o.owner === 0) objMine++; });
    $('bf-time').textContent = fmtTime(st.t);
    $('bf-seed').textContent = 'Seed ' + st.seed;
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
      var ORDER_WORDS = { attackMove: 'attack move', rush: 'rush move', hold: 'holding', attack: 'attacking a unit' };
      var doing = u.state === 'routing' ? 'routing' : (u.order ? ORDER_WORDS[u.order.kind] : (u.station ? 'holding station' : (u.hidden ? 'hidden in cover' : 'following orders')));
      var extra = st.gen.fatigue && u.fat >= 50 ? ' · tired' : '';
      $('bf-unit-info').textContent = people(u.people) + ' people · morale ' + Math.max(0, Math.round(u.morale)) + ' · ' + doing + extra;
      if (lastSelected !== u.id) {
        fillSelect($('bf-unit-strategy'), options(Object.keys(C.STRATEGY), function (k) { return C.STRATEGY[k].label; }), u.strategy);
        fillSelect($('bf-unit-formation'), options(Object.keys(C.FORMATION), function (k) { return C.FORMATION[k].label; }), u.formation);
        lastSelected = u.id;
      }
      $('bf-unit-strategy').disabled = u.side !== 0 || phase === 'over';
      $('bf-unit-formation').disabled = u.side !== 0 || phase === 'over';
    }
    if (phase === 'deploy') {
      $('bf-hint').textContent = 'Deploy: tap one of your units, then tap ground inside the blue strip to place it. Begin when ready.';
    } else if (prompts) {
      $('bf-hint').textContent = 'A hidden unit has an enemy in reach. Tap ⚔ Strike! to hit, or wait.';
    } else if (sel === null) {
      $('bf-hint').textContent = 'Tap one of your units to select it. Then tap ground to move it, or an enemy to attack.';
    } else {
      $('bf-hint').textContent = $('bf-click-mode').value === 'rush'
        ? 'Rush move: the unit runs to the point and ignores enemies on the way.'
        : 'Attack move: the unit fights what it meets on the way.';
    }
  }

  function toMap(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x / TILE_PX, y: p.y / TILE_PX };
  }

  // Once a unit has its order, it is deselected: the player taps it again to give the next one.
  function onMapClick(evt) {
    if (!st || phase === 'over' || phase === 'setup') return;
    var g = evt.target && evt.target.closest ? evt.target.closest('[data-id]') : null;
    if (g) {
      var id = parseInt(g.getAttribute('data-id'), 10);
      var target = V4.sim.findUnit(st, id);
      if (!target || !isShown(target)) return;
      if (target.side === 0) { sel = id; lastSelected = undefined; }
      else if (sel !== null && phase === 'battle') { V4.issue(st, { kind: 'attack', unit: sel, target: id }); deselect(); }
      return;
    }
    if (sel === null) return;
    var p = toMap(evt);
    if (phase === 'deploy') {
      V4.issue(st, { kind: 'place', unit: sel, x: p.x, y: p.y });
    } else if (phase === 'battle') {
      V4.issue(st, { kind: $('bf-click-mode').value, unit: sel, x: p.x, y: p.y });
      deselect();
    }
  }

  function deselect() { sel = null; lastSelected = undefined; }

  function startBattle(req) {
    st = V4.createBattle(req, { animate: true });
    st.req = req;
    sel = null; lastSelected = undefined; paused = false; acc = 0; popKey = '';
    phase = 'deploy'; lastTs = null;
    $('screen-setup').hidden = true;
    $('screen-battle').hidden = false;
    $('bf-result').hidden = true;
    $('bf-unit').hidden = true;
    $('bf-count').hidden = true;
    $('bf-pops').innerHTML = '';
    buildMap();
    renderObjectives();
    renderUnits();
    hud();
  }

  function beginBattle() {
    if (phase !== 'deploy') return;
    phase = 'countdown';
    countT = COUNTDOWN;
    deselect();
  }

  function showResult() {
    var r = V4.result(st);
    var youWin = r.winner === 'attacker';
    var how = {
      objectives: 'by holding the objectives',
      rout: 'because the other side had no units left',
      surrender: 'because the other side gave up',
      time: 'because the time ran out with the objectives not all held'
    }[r.how] || r.how;
    $('bf-result-title').textContent = youWin ? 'You win ' + how + '.' : 'They win ' + how + '.';
    var lossList = function (side) {
      return C.TYPES.filter(function (t) { return side[t] > 0.5; })
        .map(function (t) { return Math.round(side[t]) + ' ' + label(t).toLowerCase(); }).join(', ') || 'none';
    };
    $('bf-result-body').textContent =
      'Battle lasted ' + r.seconds + ' s. Your losses: ' + lossList(r.losses.attacker) + '. ' +
      'Their losses: ' + lossList(r.losses.defender) + '. ' +
      (r.captured ? 'The settlement is yours.' : '') + (r.levies ? ' Levies raised: ' + r.levies + '.' : '') +
      ' Seed ' + r.seed + '.';
    $('bf-result-json').value = JSON.stringify(r, null, 2);
    $('bf-result').hidden = false;
    $('bf-save-status').textContent = 'Saving the replay…';
    // Each finished battle is saved on this device, then to the family database if signed in.
    V4.replays.save(st.req, st.commands, r).then(function (msg) { $('bf-save-status').textContent = msg; });
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
      if (st.done && phase !== 'over') { phase = 'over'; showResult(); }
      drainEvents();
      renderUnits();
      renderObjectives();
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
    $('bf-toggle').addEventListener('click', function () { if (phase === 'battle' && st && !st.done) paused = !paused; });
    $('bf-surrender').addEventListener('click', function () { if (st && phase === 'battle' && !st.done) V4.issue(st, { kind: 'surrender', side: 0 }); });
    $('bf-hold').addEventListener('click', function () { if (sel !== null && phase === 'battle') { V4.issue(st, { kind: 'hold', unit: sel }); deselect(); } });
    $('bf-proceed').addEventListener('click', function () { if (sel !== null && phase === 'battle') { V4.issue(st, { kind: 'proceed', unit: sel }); deselect(); } });
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
