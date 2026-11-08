// Expansion Wars (combined) — the battle's action bar and card: pause and speed, orders for the selected unit, the
// state of the fight, and the result.
(function () {
  'use strict';
  var XW = window.XW, U = XW.unit, W = XW.world, A = XW.app, D = XW.core;
  U.view = U.view || {};
  var button = D.button, el = D.el;

  U.view.drawBar = function (bar, w, st, ui, act) {
    D.clear(bar);
    if (st.done) {
      if (A.can('province')) bar.appendChild(button('🗺️ Back to the province', function () { A.scales.go('province'); }, { cls: 'big' }));
      else bar.appendChild(button('⚔️ Next battle', function () { A.modes.next(); }, { cls: 'big' }));
      return;
    }
    bar.appendChild(button(ui.paused ? '▶ Play' : '⏸ Pause', function () { ui.paused = !ui.paused; act.redraw(); }));
    [1, 2, 4].forEach(function (s) { bar.appendChild(button(s + '×', function () { ui.speed = s; act.redraw(); }, { pressed: ui.speed === s })); });
    if (st.you !== null) {
      var u = ui.sel !== null ? window.V4.sim.findUnit(st, ui.sel) : null;
      if (u && u.state === 'active') {
        bar.appendChild(button('Hold', function () { act.order({ kind: 'hold', unit: u.id }); }));
        ['engage', 'rush', 'kite'].forEach(function (k) {
          bar.appendChild(button(window.V4.CONFIG.STRATEGY[k].label, function () { act.order({ kind: 'strategy', unit: u.id, value: k }); }, { pressed: u.strategy === k }));
        });
      } else {
        bar.appendChild(el('span', 'note', 'Tap one of your units, then the ground to move or an enemy to attack.'));
      }
      bar.appendChild(button('🏳️ Give up', function () { act.order({ kind: 'surrender', side: st.you }); }));
    }
  };

  U.view.drawCard = function (card, w, st, ui) {
    D.clear(card);
    var b = w.battle || ui.finished, att = W.ownerName(w, b.attacker), def = W.ownerName(w, b.defender);
    card.appendChild(el('h3', '', '⚔️ ' + att + ' attack ' + W.aLabel(b.tier) + ' of ' + def));
    var alive = [0, 0];
    st.units.forEach(function (u) { if (u.state !== 'dead' && u.state !== 'gone' && u.side < 2) alive[u.side] += u.people; });
    card.appendChild(el('p', '', att + ': ' + Math.round(alive[0]) + ' fighting of ' + b.count + ' · ' + def + ': ' + Math.round(alive[1]) + ' of ' + b.defCount));
    card.appendChild(el('p', 'small', 'One dot is about ' + st.grain + ' soldiers. ' + Math.floor(st.t) + ' s of ' + st.cap + ' s.' +
      ' Time here runs at ×' + W.CONFIG.RATE.unit + ': the country waits.'));
    if (st.done) {
      var r = ui.result;
      card.appendChild(el('p', 'result', r.winner === 'attacker' ? att + ' win (' + r.how + ').' : def + ' hold (' + r.how + ').'));
      card.appendChild(el('p', 'small', 'Left: ' + att + ' ' + r.pool.attacker + ', ' + def + ' ' + r.pool.defender + '. The result is in the world: go back to see the province.'));
    } else {
      card.appendChild(el('p', 'muted small', 'Leave the battle at any time (the crumbs above, or the mini map): the computer fights the rest, and the result goes into the world.'));
    }
  };
})();
