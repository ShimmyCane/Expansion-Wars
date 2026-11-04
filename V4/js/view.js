// Expansion Wars — V4 custom battle view. Setup, placement, the battle on an SVG field, orders, pause, and the result.
// The rules are in sim.js. This file draws, takes input, and calls V4.issue and V4.step in fixed steps.
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, I = V4.INSIGNIA;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TILE_COLOUR = { g: '#cfe6a0', w: '#5f8f4e', r: '#8fc6e8', f: '#c9e7f5', t: '#dcc7a0', x: '#8d857c', y: '#b48c55' };
  var TILE_PX = C.TILE;
  var COUNTDOWN = 3.6;     // 3, 2, 1, Go (the last 0.6 s show Go)
  var MAX_STEPS = 20;      // most fixed steps in one frame, so a slow device cannot spiral

  var st = null, sel = null, phase = 'setup', paused = false, countT = 0, lastTs = null, acc = 0;
  var svg, layers = {}, unitEls = {}, objEls = [], fxList = [], lastSelected;
  var $ = function (id) { return document.getElementById(id); };

  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function label(type) { return C.UNIT[type].label; }
  function people(n) { return Math.ceil(n - 0.001); }
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
      if (it[0] === current) o.selected = true;
      sel.appendChild(o);
    });
  }

  // ---- Setup -----------------------------------------------------------------

  function buildSetup() {
    var rows = $('sc-types');
    rows.innerHTML = '';
    var defaults = { a: { pikemen: 4, swordsmen: 3, archers: 2, cavalry: 1 }, d: { pikemen: 3, archers: 2 } };
    C.TYPES.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'type-row';
      row.innerHTML = '<span class="animal">' + I.animal[t] + '</span><span class="tname">' + label(t) + '</span>' +
        '<label>You <input type="number" min="0" max="20" data-side="a" data-type="' + t + '" value="' + (defaults.a[t] || 0) + '"></label>' +
        '<label>Them <input type="number" min="0" max="20" data-side="d" data-type="' + t + '" value="' + (defaults.d[t] || 0) + '"></label>';
      rows.appendChild(row);
    });
    var strategies = options(Object.keys(C.STRATEGY), function (k) { return C.STRATEGY[k].label; });
    var formations = options(Object.keys(C.FORMATION), function (k) { return C.FORMATION[k].label; });
    fillSelect($('sc-strat-a'), strategies, 'engage');
    fillSelect($('sc-form-a'), formations, 'line');
    fillSelect($('sc-scale'), [['village', 'Village (one person a dot)'], ['fortress', 'Fortress (squads of about 20)'], ['country', 'Country (battalions)']], 'fortress');
    fillSelect($('sc-settle'), [['fortress', 'Fortress'], ['town', 'Town'], ['village', 'Village'], ['none', 'Open field (a flag)']], 'fortress');
    $('sc-start').addEventListener('click', startFromSetup);
  }

  function readCounts(side) {
    var out = [];
    document.querySelectorAll('input[data-side="' + side + '"]').forEach(function (inp) {
      var n = parseInt(inp.value, 10) || 0;
      if (n > 0) out.push({ type: inp.getAttribute('data-type'), count: n });
    });
    return out;
  }

  function startFromSetup() {
    var typed = parseInt($('sc-seed').value, 10);
    var seed = typed > 0 ? typed : Math.floor(Math.random() * 1e9) + 1;
    var scale = $('sc-scale').value, settle = $('sc-settle').value;
    var woods = $('sc-woods').checked ? ['grass', 'woods'] : ['grass'];
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
      border: { river: $('sc-river').checked, road: true },
      mode: 'play'
    };
    var problems = V4.validateRequest(req);
    if (problems.length) { alert(problems.join('\n')); return; }
    startBattle(req);
  }

  // ---- Battle screen ---------------------------------------------------------

  function buildMap() {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + (C.COLS * TILE_PX) + ' ' + (C.ROWS * TILE_PX));
    layers.tiles = svgEl('g', {}, svg);
    layers.obj = svgEl('g', {}, svg);
    layers.deploy = svgEl('g', {}, svg);
    layers.units = svgEl('g', {}, svg);
    layers.fx = svgEl('g', {}, svg);
    for (var r = 0; r < C.ROWS; r++) {
      for (var c = 0; c < C.COLS; c++) {
        var code = st.field.tiles[r * C.COLS + c];
        svgEl('rect', { x: c * TILE_PX, y: r * TILE_PX, width: TILE_PX + 0.5, height: TILE_PX + 0.5, fill: TILE_COLOUR[code] || '#cfe6a0' }, layers.tiles);
      }
    }
    svgEl('rect', { x: 0, y: 0, width: (C.DEPLOY_X + 0.5) * TILE_PX, height: C.ROWS * TILE_PX, fill: 'rgba(74,123,208,0.18)', 'pointer-events': 'none' }, layers.deploy);
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
  }

  var FRAME = { 0: '#4a7bd0', 1: '#d05a4a' };
  var SHAPE = {
    line: function (g) { svgEl('rect', { x: -18, y: -5, width: 36, height: 10, rx: 4, fill: 'none', stroke: '#222', 'stroke-width': 2 }, g); },
    column: function (g) { svgEl('rect', { x: -5, y: -22, width: 10, height: 44, rx: 4, fill: 'none', stroke: '#222', 'stroke-width': 2 }, g); },
    scatter: function (g) { svgEl('circle', { cx: 0, cy: 0, r: 24, fill: 'none', stroke: '#222', 'stroke-width': 2, 'stroke-dasharray': '3 4' }, g); },
    shield: function (g) { svgEl('rect', { x: -15, y: -13, width: 30, height: 26, rx: 8, fill: 'none', stroke: '#222', 'stroke-width': 3 }, g); }
  };

  function ensureUnit(u) {
    if (unitEls[u.id]) return unitEls[u.id];
    var g = svgEl('g', { 'data-id': u.id, class: 'unit' }, layers.units);
    var ring = svgEl('circle', { cx: 0, cy: 0, r: 28, fill: 'none', stroke: '#ffd24a', 'stroke-width': 3, visibility: 'hidden' }, g);
    var shape = svgEl('g', {}, g);
    svgEl('circle', { cx: 0, cy: 0, r: 11, fill: FRAME[u.side], stroke: '#fff', 'stroke-width': 1.5 }, g);
    var animal = svgEl('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 14 }, g);
    animal.textContent = I.animal[u.type];
    var count = svgEl('text', { x: 0, y: 24, 'text-anchor': 'middle', 'font-size': 11, fill: '#222', 'font-weight': 700 }, g);
    unitEls[u.id] = { g: g, ring: ring, shape: shape, shapeName: null, count: count };
    return unitEls[u.id];
  }

  // Enemies you cannot see are not drawn. Once the battle is over, everything is shown.
  function isShown(u) {
    if (u.side === 0 || st.done) return true;
    return !!st.seen[0][u.id];
  }

  function renderUnits() {
    var seen = {};
    st.units.forEach(function (u) {
      if (u.state === 'dead' || u.state === 'gone') return;
      var el = ensureUnit(u);
      seen[u.id] = true;
      el.g.setAttribute('transform', 'translate(' + (u.x * TILE_PX) + ',' + (u.y * TILE_PX) + ')');
      el.g.setAttribute('opacity', u.state === 'routing' ? '0.45' : '1');
      el.g.setAttribute('visibility', isShown(u) ? 'visible' : 'hidden');
      if (el.shapeName !== u.formation) {
        el.shape.innerHTML = '';
        SHAPE[u.formation](el.shape);
        el.shapeName = u.formation;
      }
      el.ring.setAttribute('visibility', sel === u.id ? 'visible' : 'hidden');
      el.count.textContent = String(people(u.people));
    });
    Object.keys(unitEls).forEach(function (id) {
      if (!seen[id]) { layers.units.removeChild(unitEls[id].g); delete unitEls[id]; }
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
    var mine = 0, theirs = 0, objMine = 0;
    st.units.forEach(function (u) {
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
      var doing = u.state === 'routing' ? 'routing' : (u.order ? ORDER_WORDS[u.order.kind] : (u.station ? 'holding station' : 'following orders'));
      $('bf-unit-info').textContent = people(u.people) + ' people · morale ' + Math.max(0, Math.round(u.morale)) + ' · ' + doing;
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

  function onMapClick(evt) {
    if (!st || phase === 'over' || phase === 'setup') return;
    var g = evt.target && evt.target.closest ? evt.target.closest('[data-id]') : null;
    if (g) {
      var id = parseInt(g.getAttribute('data-id'), 10);
      var target = V4.sim.findUnit(st, id);
      if (!target || !isShown(target)) return;
      if (target.side === 0) { sel = id; lastSelected = undefined; }
      else if (sel !== null && phase === 'battle') V4.issue(st, { kind: 'attack', unit: sel, target: id });
      return;
    }
    if (sel === null) return;
    var p = toMap(evt);
    if (phase === 'deploy') {
      V4.issue(st, { kind: 'place', unit: sel, x: p.x, y: p.y });
    } else if (phase === 'battle') {
      V4.issue(st, { kind: $('bf-click-mode').value, unit: sel, x: p.x, y: p.y });
    }
  }

  function startBattle(req) {
    st = V4.createBattle(req, { animate: true });
    st.req = req;
    sel = null; lastSelected = undefined; paused = false; acc = 0;
    phase = 'deploy'; lastTs = null;
    $('screen-setup').hidden = true;
    $('screen-battle').hidden = false;
    $('bf-result').hidden = true;
    $('bf-unit').hidden = true;
    $('bf-count').hidden = true;
    buildMap();
    renderObjectives();
    renderUnits();
    hud();
  }

  function beginBattle() {
    if (phase !== 'deploy') return;
    phase = 'countdown';
    countT = COUNTDOWN;
    sel = null;
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
      updateFx(performance.now());
      hud();
    }
    requestAnimationFrame(frame);
  }

  // ---- Wiring -------------------------------------------------------------------

  function wire() {
    buildSetup();
    svg = $('bf-svg');
    svg.addEventListener('click', onMapClick);
    $('bf-begin').addEventListener('click', beginBattle);
    $('bf-toggle').addEventListener('click', function () { if (phase === 'battle' && st && !st.done) paused = !paused; });
    $('bf-surrender').addEventListener('click', function () { if (st && phase === 'battle' && !st.done) V4.issue(st, { kind: 'surrender', side: 0 }); });
    $('bf-hold').addEventListener('click', function () { if (sel !== null && phase === 'battle') V4.issue(st, { kind: 'hold', unit: sel }); });
    $('bf-proceed').addEventListener('click', function () { if (sel !== null && phase === 'battle') { V4.issue(st, { kind: 'proceed', unit: sel }); lastSelected = undefined; } });
    $('bf-unit-strategy').addEventListener('change', function (e) { if (sel !== null) V4.issue(st, { kind: 'strategy', unit: sel, value: e.target.value }); });
    $('bf-unit-formation').addEventListener('change', function (e) { if (sel !== null) V4.issue(st, { kind: 'formation', unit: sel, value: e.target.value }); });
    $('bf-copy').addEventListener('click', copyReplay);
    $('bf-again').addEventListener('click', backToSetup);
    $('bf-back-setup').addEventListener('click', backToSetup);
    requestAnimationFrame(frame);
  }

  V4.view = { start: startBattle };
  document.addEventListener('DOMContentLoaded', wire);
})();
