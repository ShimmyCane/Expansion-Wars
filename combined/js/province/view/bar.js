// Expansion Wars (combined) — the province action bar and card. Tap one of your provinces, then a neighbour:
// send soldiers (resolved at once on arrival) or fight it as a battle at unit scale. Muster soldiers from the field army.
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world, U = XW.unit, A = XW.app, D = XW.core;
  P.view = P.view || {};
  var button = D.button, el = D.el;

  function share(w, id) {
    var have = Math.floor(w.provs[id].gar || 0);
    return Math.min(have, Math.max(2, Math.floor(have * w.view.marchPct / 100)));
  }

  P.view.drawBar = function (bar, w, win, ui, act) {
    D.clear(bar);
    // A province battles level that has ended: win to go on to the next level, lose to try the same one again.
    if (w.over && !A.mode.turns) {
      bar.appendChild(el('span', 'note', w.over === 'won' ? 'Level won: every opponent has fallen.' : 'Your nation has fallen.'));
      bar.appendChild(button(w.over === 'won' ? '🏆 Next level' : '🔁 Try the level again', function () { A.modes.next(); }, { cls: 'big' }));
      return;
    }
    var sel = W.prov(w, ui.sel), target = W.prov(w, ui.target);
    P.CONFIG.SEND_STEPS.forEach(function (pct) {
      bar.appendChild(button(pct + '%', function () { w.view.marchPct = pct; act.redraw(); }, { pressed: w.view.marchPct === pct }));
    });
    if (!sel) { bar.appendChild(el('span', 'note', 'Drag from your provinces onto another to send soldiers, or tap one of yours and then a target.')); return; }
    var n = share(w, sel.id), M = P.CONFIG.MUSTER;
    // A half upgrade, paid with this province's soldiers: halfway to the next grade (a fortress gets its tower).
    function upgradeButton() {
      if (sel.up || P.grade(w, sel) >= 5) return;
      var cost = P.upgradeCost(w, sel);
      bar.appendChild(button('⬆ Upgrade (' + cost + ' soldiers)', function () { act.done(P.upgrade(w, w.you, sel.id)); }, { disabled: (sel.gar || 0) < cost }));
    }
    // Province battles: no field army to muster from. Tapping the target sends.
    if (!A.mode.turns) {
      upgradeButton();
      bar.appendChild(el('span', 'note', 'Now tap a province to send ' + n + ', or drag onto it.'));
      return;
    }
    upgradeButton();
    // A fight on a province in this window that you are part of: join it as a battle.
    win.ids.forEach(function (id) {
      var f = w.provs[id];
      if (!A.can('unit') || !f.fight || (f.owner !== w.you && f.fight.owner !== w.you)) return;
      bar.appendChild(button('⚔️ Join the fight at ' + W.aLabel(f.tier) + ' · ' + P.fightLine(w, f), function () {
        var err = U.startFight(w, f);
        if (err) { act.done(err); return; }
        A.scales.go('unit');
      }, { cls: 'join' }));
    });
    bar.appendChild(button('+' + M + ' from the field army', function () { act.done(P.muster(w, w.you, sel.id, M)); },
      { disabled: sel.musterTurn === w.time.turn }));
    bar.appendChild(button('−' + M + ' to the field army', function () { act.done(P.muster(w, w.you, sel.id, -M)); }));
    if (!target) { bar.appendChild(el('span', 'note', 'Now tap a neighbour to send ' + n + '.')); return; }
    bar.appendChild(button('Send ' + n, function () {
      var err = P.send(w, win, w.you, sel.id, target.id, w.view.marchPct);
      ui.target = null;
      act.done(err);
    }, { disabled: n < 1 }));
    if (target.owner !== w.you && A.can('unit')) {
      bar.appendChild(button('⚔️ Battle with ' + n, function () {
        var err = U.start(w, win, sel.id, target.id, w.view.marchPct);
        if (err) { act.done(err); return; }
        ui.target = null;
        A.scales.go('unit');
      }, { disabled: n < 2 }));
    }
    bar.appendChild(button('Cancel', function () { ui.sel = null; ui.target = null; act.redraw(); }));
  };

  // The card: the province you zoomed into, who holds the land around it, and the last battles here.
  P.view.drawCard = function (card, w, win, ui) {
    D.clear(card);
    var f = w.provs[win.focus];
    card.appendChild(el('h3', '', 'Province: ' + W.label(f.tier) + ' of ' + W.ownerName(w, f.owner)));
    card.appendChild(el('p', 'small', A.mode.turns
      ? 'Real time, on the provinces around it. Time here runs at ×' + W.CONFIG.RATE.province +
        ': a country turn takes ' + Math.round(W.realTurn('province') / 60) + ' minutes. Garrisons grow from each nation\'s field army.'
      : 'Each province grows its own soldiers, faster the higher its grade. Send them to take land; fights settle themselves in rounds, more of them at stronger places. Upgrade a province with its own soldiers. Take every opponent province to win.'));
    var held = {};
    win.ids.forEach(function (id) {
      var p = w.provs[id], k = p.owner;
      held[k] = held[k] || { provs: 0, gar: 0 };
      held[k].provs++; held[k].gar += p.gar || 0;
    });
    Object.keys(held).sort().forEach(function (k) {
      var o = Number(k), line = el('p', 'small'), sw = el('span', 'swatch ' + (o >= 0 ? 'o' + o : 'neutral'));
      line.appendChild(sw);
      var war = o >= 0 && o !== w.you && W.rel(w, w.you, o).war;
      line.appendChild(document.createTextNode(W.ownerName(w, o) + (o === w.you ? ' (you)' : '') + ': ' + held[k].provs + ' provinces, ' +
        Math.floor(held[k].gar) + ' stationed' + (war ? ' · at war with you' : o >= 0 && o !== w.you ? ' · at peace' : '')));
      card.appendChild(line);
    });
    var info = W.prov(w, ui.target !== null ? ui.target : ui.sel);
    if (info) {
      card.appendChild(el('p', 'small', 'Selected: ' + W.label(info.tier) + ' of ' + W.ownerName(w, info.owner) + ', ' + Math.floor(info.gar || 0) + ' stationed.' +
        (info.owner !== w.you && W.whyNot(w, w.you, info) ? ' ' + W.whyNot(w, w.you, info) : '')));
    }
    win.ids.forEach(function (id) {
      var f = w.provs[id];
      if (!f.fight) return;
      card.appendChild(el('p', 'small fight-line', '⚔️ ' + W.ownerName(w, f.fight.owner) + ' attack ' + W.aLabel(f.tier) + ' of ' + W.ownerName(w, f.owner) + ': ' + P.fightLine(w, f)));
    });
    var here = w.battles.filter(function (b) { return win.inside[b.prov]; }).slice(-3).reverse();
    if (here.length) {
      card.appendChild(el('p', 'muted small', 'Battles here: ' + here.map(function (b) {
        return 'turn ' + b.turn + ', ' + (b.winner === 'attacker' ? W.ownerName(w, b.attacker) + ' won' : W.ownerName(w, b.defender) + ' held');
      }).join('; ') + '.'));
    }
    if (A.can('country')) card.appendChild(button('🌍 Back to the country', function () { A.scales.go('country'); }));
  };
})();
