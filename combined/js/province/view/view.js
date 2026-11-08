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

  // The countdown at the start of a province battles level: the number big over the map, then Go. True while it runs.
  var goT = 0;
  function countdown(w, dt) {
    var el = D.$('province-count');
    if (!el) return false;
    if (w.countdown > 0) {
      w.countdown = Math.max(0, w.countdown - dt);
      el.hidden = false;
      el.textContent = w.countdown > 0 ? String(Math.ceil(w.countdown)) : 'Go!';
      goT = 0.7;
      return w.countdown > 0;
    }
    if (goT > 0) { goT -= dt; if (goT <= 0) el.hidden = true; }
    return false;
  }

  function tap(id) {
    var w = W.get(), p = w.provs[id];
    if (!p || p.kind !== 'province' || !win.inside[id]) { ui.sel = null; ui.target = null; return redraw(); }
    if (ui.sel === null) {                       // nothing selected: select yours, or just look at another
      ui.sel = p.owner === w.you ? id : null;
      ui.target = p.owner === w.you ? null : id;
    } else if (id === ui.sel) {                  // the selected one again: clear
      ui.sel = null; ui.target = null;
    } else if (!A.mode.turns) {                  // province battles: tap a source, then a target, and the soldiers go
      var err = P.send(w, win, w.you, ui.sel, id, w.view.marchPct);
      ui.sel = null; ui.target = null;
      act.done(err);
      return;
    } else {                                     // anything else is the target: the bar offers Send (and Battle)
      ui.target = id;
    }
    redraw();
  }

  // Drag: press on one of your provinces and let go on another (in this window). The garrisons move there, at the share
  // chosen on the bar, along your roads. Passing over your other provinces on the way adds them to the group (as in the
  // spot game): a drop sends each one that has a route to the target, and a drop on your own province reinforces it.
  // A drag is not a tap.
  var drag = null, dragged = false, dragLayer = null;
  function idAt(e) { var t = e.target.closest ? e.target.closest('[data-id]') : null; return t ? Number(t.getAttribute('data-id')) : null; }
  function idUnder(e) { var hit = document.elementFromPoint(e.clientX, e.clientY); var v = hit && hit.getAttribute ? hit.getAttribute('data-id') : null; return v === null ? null : Number(v); }
  function ownSource(w, id) { var p = w.provs[id]; return !!p && p.kind === 'province' && p.owner === w.you && p.gar >= 1; }

  // The drag lines: from each dragged province to the pointer, green where the target can be reached by road.
  function drawDrag(e) {
    if (!dragLayer) return;
    D.clear(dragLayer);
    if (!drag || !drag.moved || !e) return;
    var w = W.get(), end = D.svgPoint(svgEl, e), target = drag.target;
    drag.sources.forEach(function (s) {
      var p = w.provs[s], ok = target !== null && target !== s && P.routeTo(w, win, s, target, w.you);
      D.svg('line', { x1: p.x, y1: p.y, x2: end.x, y2: end.y, 'class': 'drag' + (target === null ? '' : ok ? ' ok' : ' bad') }, dragLayer);
    });
  }

  function bind() {
    if (bound) return;
    bound = true;
    svgEl.addEventListener('pointerdown', function (e) {
      var w = W.get(), id = idAt(e);
      dragged = false;
      drag = (id !== null && ownSource(w, id)) ? { sources: [id], x: e.clientX, y: e.clientY, moved: false, target: null } : null;
    });
    svgEl.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var w = W.get();
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
      drag.target = idUnder(e);
      if (drag.moved && drag.target !== null && ownSource(w, drag.target) && drag.sources.indexOf(drag.target) < 0) drag.sources.push(drag.target);
      drawDrag(e);
    });
    svgEl.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      drawDrag(null);
      if (!d.moved) return;
      dragged = true;
      var to = idUnder(e);
      if (to === null) return;
      var w = W.get(), group = d.sources.filter(function (s) { return s !== to; });
      if (!group.length) return;
      var sent = 0, first = null;
      group.forEach(function (s) {
        var err = P.send(w, win, w.you, s, to, w.view.marchPct);
        if (err) { if (first === null) first = err; } else sent++;
      });
      ui.sel = null; ui.target = null;
      act.done(sent ? (sent === 1 ? 'Soldiers sent.' : 'Sent from ' + sent + ' provinces.') : first);
    });
    svgEl.addEventListener('pointercancel', function () { drag = null; drawDrag(null); });
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
      ground = D.svg('g', {}, svgEl); live = D.svg('g', {}, svgEl); dragLayer = D.svg('g', {}, svgEl);
      groundKey = '';
      goT = 0;
      if (D.$('province-count')) D.$('province-count').hidden = !(w.countdown > 0);
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
      // 3, 2, 1, Go: nothing moves until it is over. A level that has ended stands still.
      if (countdown(w, dt)) return;
      if (!w.over) {
        P.step(w, win, dt);
        P.aiThink(w, win, dt);
      }
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
