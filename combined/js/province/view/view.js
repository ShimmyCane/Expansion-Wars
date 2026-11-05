// Expansion Wars (combined) — the province scale on screen. Runs province time for the window while you look at it:
// garrisons grow, soldiers march, computer nations move. Wheel out (or pinch in) to go back up to the country.
(function () {
  'use strict';
  var XW = window.XW, P = XW.province, W = XW.world, A = XW.app, D = XW.core;
  var ui = { sel: null, target: null };
  var win = null, svgEl, ground, live, bar, card, mini, groundKey = '', bound = false, cardT = 0;

  function redraw() {
    var w = W.get();
    if (!win) return;
    var key = P.view.groundKey(w, win, ui);
    if (key !== groundKey) { P.view.drawGround(ground, w, win, ui); groundKey = key; }
    P.view.drawLive(live, w, win, ui);
    P.view.drawBar(bar, w, win, ui, act);
    P.view.drawCard(card, w, win, ui);
    A.mini.draw(mini, w, win);
  }
  var act = {
    redraw: redraw,
    done: function (msg) { if (msg) A.toast(msg); W.changed('province'); }
  };

  function tap(id) {
    var w = W.get(), p = w.provs[id];
    if (!p || p.kind !== 'province' || !win.inside[id]) { ui.sel = null; ui.target = null; return redraw(); }
    if (ui.sel === null) {                       // nothing selected: select yours, or just look at another
      ui.sel = p.owner === w.you ? id : null;
      ui.target = p.owner === w.you ? null : id;
    } else if (id === ui.sel) {                  // the selected one again: clear
      ui.sel = null; ui.target = null;
    } else {                                     // anything else is the target: the bar offers Send (and Battle)
      ui.target = id;
    }
    redraw();
  }

  // Drag: press on one of your provinces and let go on another (in this window). The garrison moves there, at the share
  // chosen on the bar, along your roads. A drag is not a tap.
  var drag = null, dragged = false;
  function idAt(e) { var t = e.target.closest ? e.target.closest('[data-id]') : null; return t ? Number(t.getAttribute('data-id')) : null; }
  function bind() {
    if (bound) return;
    bound = true;
    svgEl.addEventListener('pointerdown', function (e) {
      var w = W.get(), id = idAt(e);
      dragged = false;
      drag = (id !== null && w.provs[id].owner === w.you && w.provs[id].gar >= 1) ? { from: id, x: e.clientX, y: e.clientY } : null;
    });
    svgEl.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var from = drag.from, moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8;
      drag = null;
      if (!moved) return;
      dragged = true;
      var hit = document.elementFromPoint(e.clientX, e.clientY), to = hit && hit.getAttribute ? hit.getAttribute('data-id') : null;
      if (to === null || Number(to) === from) return;
      var w = W.get();
      var err = P.send(w, win, w.you, from, Number(to), w.view.marchPct);
      ui.sel = null; ui.target = null;
      act.done(err);
    });
    svgEl.addEventListener('click', function (e) {
      if (dragged) { dragged = false; return; }
      tap(idAt(e) === null ? -1 : idAt(e));
    });
    svgEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.deltaY > 0) A.scales.go('country');
    }, { passive: false });
    var pinch = null;
    svgEl.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }, { passive: true });
    svgEl.addEventListener('touchmove', function (e) {
      if (pinch === null || e.touches.length !== 2) return;
      e.preventDefault();
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (d < pinch * 0.7) { pinch = null; A.scales.go('country'); }
    }, { passive: false });
    svgEl.addEventListener('touchend', function () { pinch = null; });
    A.mini.bind(mini);
  }

  A.views = A.views || {};
  A.views.province = {
    section: 'scale-province',
    show: function (w) {
      svgEl = D.$('province-map'); bar = D.$('province-bar'); card = D.$('province-card'); mini = D.$('province-mini');
      win = P.window(w, w.view.prov);
      var f = P.view.frame(win);
      svgEl.setAttribute('viewBox', [f.x, f.y, f.w, f.h].join(' '));
      D.clear(svgEl);
      ground = D.svg('g', {}, svgEl); live = D.svg('g', {}, svgEl);
      groundKey = '';
      ui.sel = w.provs[win.focus].owner === w.you ? win.focus : null;
      ui.target = null;
      P.aiReset();
      bind();
      redraw();
    },
    // Leaving: every march lands, so the country map shows where every soldier is.
    hide: function (w) { if (win) P.settle(w, win); win = null; },
    render: function () { redraw(); },
    tick: function (w, dt) {
      if (!win) return;
      P.step(w, win, dt);
      P.aiThink(w, win, dt);
      // The ground and spots every frame; the bar and card a few times a second.
      var key = P.view.groundKey(w, win, ui);
      if (key !== groundKey) { P.view.drawGround(ground, w, win, ui); groundKey = key; }
      P.view.drawLive(live, w, win, ui);
      cardT += dt;
      if (cardT > 0.5) { cardT = 0; P.view.drawCard(card, w, win, ui); P.view.drawBar(bar, w, win, ui, act); A.mini.draw(mini, w, win); }
    },
    window: function () { return win; }
  };
})();
