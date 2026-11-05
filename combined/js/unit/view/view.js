// Expansion Wars (combined) — the unit scale on screen: one battle from world.battle, played in the engine's fixed steps.
// Orders go through the engine (V4.issue) and are recorded in world.battle, so the battle can be rebuilt after a reload.
// Leaving the battle (or its end) writes the result into the world (unit/bridge.js apply).
(function () {
  'use strict';
  var XW = window.XW, U = XW.unit, W = XW.world, A = XW.app, D = XW.core;
  var MAX_STEPS = 20;   // fixed steps in one frame at most, so a slow device cannot spiral
  var ui = { sel: null, paused: false, speed: 1, result: null, finished: null };
  var st = null, svgEl, field, units, bar, card, mini, acc = 0, recordT = 0, cardT = 0, bound = false;

  function colours(w) {
    var b = w.battle || ui.finished;
    return [b.attacker >= 0 ? 'o' + b.attacker : 'neutral', b.defender >= 0 ? 'o' + b.defender : 'neutral', 'neutral'];
  }

  function redraw() {
    var w = W.get();
    if (!st) return;
    U.view.drawUnits(units, st, ui, colours(w));
    U.view.drawBar(bar, w, st, ui, act);
    U.view.drawCard(card, w, st, ui);
    A.mini.draw(mini, w, XW.province.window(w, w.view.prov));
  }

  var act = {
    redraw: redraw,
    order: function (cmd) {
      if (!st || !window.V4.issue(st, cmd)) { A.toast('That order cannot be given now.'); return; }
      U.record(W.get(), st);
      if (st.done) finish();
      redraw();
    }
  };

  // The battle is over: keep the result on screen; the world gets it when you leave (or at once, see hide).
  function finish() {
    var w = W.get();
    if (ui.result || !w.battle) return;
    ui.result = window.V4.result(st);
    ui.finished = w.battle;
    U.record(w, st);
    U.apply(w, ui.result);
    W.changed('battle');
    XW.app.saveNow('battle');
  }

  function bind() {
    if (bound) return;
    bound = true;
    svgEl.addEventListener('click', function (e) {
      if (!st || st.done || st.you === null) return;
      var T = window.V4.CONFIG.TILE, hit = e.target.closest ? e.target.closest('[data-id]') : null;
      if (hit) {
        var u = window.V4.sim.findUnit(st, Number(hit.getAttribute('data-id')));
        if (u && u.side === st.you) { ui.sel = ui.sel === u.id ? null : u.id; redraw(); return; }
        if (u && ui.sel !== null) { act.order({ kind: 'attack', unit: ui.sel, target: u.id }); return; }
      }
      if (ui.sel === null) return;
      var p = D.svgPoint(svgEl, e);
      act.order({ kind: 'move', unit: ui.sel, x: p.x / T, y: p.y / T });
    });
    A.mini.bind(mini);
  }

  A.views = A.views || {};
  A.views.unit = {
    section: 'scale-unit',
    show: function (w) {
      svgEl = D.$('unit-map'); bar = D.$('unit-bar'); card = D.$('unit-card'); mini = D.$('unit-mini');
      st = U.rebuild(w);
      if (!st) return false;
      ui.sel = null; ui.paused = false; ui.result = null; ui.finished = null; acc = 0;
      var T = window.V4.CONFIG.TILE;
      svgEl.setAttribute('viewBox', [0, 0, st.cols * T, st.rows * T].join(' '));
      D.clear(svgEl);
      field = D.svg('g', {}, svgEl); units = D.svg('g', {}, svgEl);
      U.view.drawField(field, st);
      bind();
      if (st.done) finish();
      redraw();
      return true;
    },
    // Leaving before the end: the computer fights the rest, and the result goes into the world.
    hide: function (w) {
      if (st && w.battle && !ui.result) {
        var b = w.battle, r = U.finishAuto(st);
        U.record(w, st);
        U.apply(w, r);
        A.toast((r.winner === 'attacker' ? W.ownerName(w, b.attacker) + ' won' : W.ownerName(w, b.defender) + ' held') + ' the battle (the computer fought the rest).');
      }
      st = null;
    },
    render: function () { redraw(); },
    tick: function (w, dt) {
      if (!st || st.done || ui.paused) return;
      acc += dt * ui.speed;
      var TICK = window.V4.CONFIG.TICK, steps = 0;
      while (acc >= TICK && steps < MAX_STEPS && !st.done) { window.V4.step(st); acc -= TICK; steps++; }
      if (steps >= MAX_STEPS) acc = 0;
      recordT += dt;
      if (recordT > 1) { recordT = 0; U.record(w, st); }
      if (st.done) { finish(); redraw(); return; }
      U.view.drawUnits(units, st, ui, colours(w));
      cardT += dt;
      if (cardT > 0.5) { cardT = 0; U.view.drawCard(card, w, st, ui); }
    }
  };
})();
