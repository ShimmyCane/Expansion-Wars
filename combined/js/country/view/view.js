// Expansion Wars (combined) — the country scale on screen: the map, the card and the log. Tap a province to see it and
// its nation; zoom in on it (the button, the mouse wheel, or two fingers apart) to go down to the province scale.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world, A = XW.app, D = XW.core;
  var ui = { prov: null, nation: null, moveFrom: null };
  var svgEl, card, logEl, bound = false, tickT = 0;

  function done(msg) {
    if (msg) A.toast(msg);
    W.changed('country');
  }

  // Every fight on the map has a ticker: the two sides, the round and the time to it, updated as it runs. A red button
  // joins the fights you are in, as a battle at unit scale. Fights resolve by themselves in rounds if nobody joins.
  function fightCount(w) { return w.provs.filter(function (p) { return p.fight; }).length; }
  function fightText(w, p) {
    return '⚔️ ' + W.ownerName(w, p.fight.owner) + ' attack ' + W.aLabel(p.tier) + ' of ' + W.ownerName(w, p.owner) + ': ' + XW.province.fightLine(w, p);
  }
  function fightBoard(w) {
    w.provs.forEach(function (p) {
      if (!p.fight) return;
      var mine = p.owner === w.you || p.fight.owner === w.you;
      var box = D.el('div', 'fight-box');
      var line = D.el('p', 'small fight-line', fightText(w, p));
      line.setAttribute('data-prov', String(p.id));
      box.appendChild(line);
      if (mine) {
        box.appendChild(D.button('Join the fight at ' + W.aLabel(p.tier), function () {
          var err = XW.unit.startFight(w, p);
          if (err) { done(err); return; }
          A.scales.go('unit');
        }, { cls: 'join' }));
      }
      card.appendChild(box);
    });
  }

  // A ceasefire the computer offers you: it stands for a few turns. Nothing changes until you accept it.
  function offerBoard(w) {
    w.offers.forEach(function (o) {
      if (o.to !== w.you) return;
      var box = D.el('div', 'fight-box');
      var left = o.turn + C.CONFIG.OFFER_TURNS - w.time.turn;
      box.appendChild(D.el('p', 'small', W.ownerName(w, o.from) + ' offers a ceasefire. It stands for ' + left + ' more turn' + (left === 1 ? '' : 's') + '. Until you accept it, the war goes on.'));
      box.appendChild(D.button('Accept the ceasefire', function () { done(C.acceptOffer(w, o)); }));
      box.appendChild(D.button('Refuse', function () { C.refuseOffer(w, o); done(); }));
      card.appendChild(box);
    });
  }

  function render(w) {
    if (ui.nation === null) ui.nation = w.you;
    C.view.drawMap(svgEl, w, ui);
    D.clear(card);
    offerBoard(w);
    fightBoard(w);
    var p = W.prov(w, ui.prov);
    if (p && p.kind === 'province') {
      C.view.provinceCard(card, w, p, ui, done);
      if (p.owner >= 0) { card.appendChild(D.el('hr')); C.view.nationCard(card, w, w.nations[p.owner], ui, done); }
    } else {
      C.view.nationCard(card, w, w.nations[ui.nation], ui, done);
    }
    D.clear(logEl);
    w.log.slice(-8).reverse().forEach(function (t) { logEl.appendChild(D.el('li', '', t)); });
  }

  function provAt(e) {
    var t = e.target.closest ? e.target.closest('[data-id]') : null;
    return t ? Number(t.getAttribute('data-id')) : null;
  }

  function bind() {
    if (bound) return;
    bound = true;
    svgEl.addEventListener('click', function (e) {
      var w = W.get(), id = provAt(e);
      if (id === null || w.provs[id].kind !== 'province') return;
      if (ui.moveFrom !== null && w.provs[id].owner === w.you && id !== ui.moveFrom) {
        var err = C.queueMove(w, ui.moveFrom, id, w.view.sendPct);
        ui.moveFrom = null;
        done(err);
        return;
      }
      ui.prov = id;
      ui.nation = w.provs[id].owner >= 0 ? w.provs[id].owner : ui.nation;
      render(w);
    });
    // Zooming in on a province (wheel up) goes down to the province scale.
    svgEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.deltaY >= 0) return;
      var w = W.get(), id = provAt(e);
      if (id !== null && w.provs[id].kind === 'province') A.scales.go('province', id);
    }, { passive: false });
    // Two fingers moving apart on a province does the same.
    var pinch = null;
    svgEl.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 2) return;
      var a = e.touches[0], b = e.touches[1];
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    }, { passive: true });
    svgEl.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      var a = e.touches[0], b = e.touches[1];
      if (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) < pinch.d * 1.4) return;
      var hit = document.elementFromPoint(pinch.x, pinch.y), id = hit && hit.getAttribute ? hit.getAttribute('data-id') : null;
      pinch = null;
      if (id !== null && W.get().provs[Number(id)].kind === 'province') A.scales.go('province', Number(id));
    }, { passive: false });
    svgEl.addEventListener('touchend', function () { pinch = null; });
  }

  A.views = A.views || {};
  A.views.country = {
    section: 'scale-country',
    show: function (w) {
      svgEl = D.$('country-map'); card = D.$('country-card'); logEl = D.$('country-log');
      bind();
      if (w.view.prov !== null) { ui.prov = w.view.prov; var o = w.provs[w.view.prov].owner; if (o >= 0) ui.nation = o; }
      render(w);
    },
    hide: function () {},
    render: render,
    // The tickers update twice a second; the card is redrawn only when a fight starts or ends.
    tick: function (w, dt) {
      tickT += dt;
      if (tickT < 0.5) return;
      tickT = 0;
      if (fightCount(w) !== card.querySelectorAll('.fight-line').length) { render(w); return; }
      card.querySelectorAll('.fight-line').forEach(function (el) {
        var p = w.provs[Number(el.getAttribute('data-prov'))];
        if (p && p.fight) el.textContent = fightText(w, p);
      });
    }
  };
})();
