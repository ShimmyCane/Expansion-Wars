// Expansion Wars (combined) — the top bar at every scale: where you are (Country › Province › Battle), the world clock
// with the time dilation of the scale you are on, and your nation at a glance. All of it is read from the world.
(function () {
  'use strict';
  var XW = window.XW, A = XW.app, W = XW.world, C = XW.country, D = XW.core;

  function crumbs(w) {
    var nav = D.$('crumbs'), scale = w.view.scale, p = W.prov(w, w.view.prov);
    D.clear(nav);
    function crumb(text, target, here) {
      var b = D.button(text, function () { if (!here) A.scales.go(target); }, { cls: here ? 'here' : '' });
      nav.appendChild(b);
    }
    function sep() { if (nav.childNodes.length) nav.appendChild(D.el('span', 'sep', '›')); }
    if (A.can('country')) crumb('🌍 Country', 'country', scale === 'country');
    if (p && A.can('province') && scale !== 'country') {
      sep();
      crumb('🗺️ ' + cap(W.label(p.tier)) + ' · ' + W.ownerName(w, p.owner), 'province', scale === 'province');
    }
    if (w.battle && scale === 'unit') {
      sep();
      crumb('⚔️ Battle', 'unit', true);
    }
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function clock(w) {
    var scale = w.view.scale, rate = W.rateFor(w, scale), base = W.CONFIG.RATE[scale];
    var fast = D.$('fast');
    if (fast) {
      fast.hidden = scale === 'unit';
      fast.setAttribute('aria-pressed', String(!!w.view.fast));
      fast.textContent = w.view.fast ? '×2 on' : '×2';
    }
    var left = W.turnLeft(w) / rate;   // real seconds left at this scale
    var text = w.over === 'won' ? 'You win!' : w.over === 'lost' ? 'Your nation has fallen.'
      : A.mode.turns ? 'Turn ' + w.time.turn + ' · ' + fmt(left) + ' left' + (base < 1 || w.view.fast ? ' · time ×' + +(rate / 1).toFixed(3) : '')
      : scale === 'unit' ? '⚔️ One battle · time ×' + +(rate / 1).toFixed(3)
      : A.modes.levelLine(w) + (w.view.fast ? ' · ×2' : '');
    D.$('clock').textContent = text;
    var ready = D.$('ready');
    ready.hidden = scale !== 'country' || !A.mode.turns;
    ready.disabled = !!w.over;
  }
  function fmt(s) {
    s = Math.ceil(s);
    return s >= 60 ? Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + s % 60 + ' s' : '') : s + ' s';
  }

  // Province battles: the first draft's population line, a chip for each nation with its provinces and soldiers.
  function population(w, box) {
    w.nations.forEach(function (n) {
      if (!n.alive) return;
      var mine = w.provs.filter(function (p) { return p.kind === 'province' && p.owner === n.id; }), soldiers = XW.province.marching(w, n.id);
      mine.forEach(function (p) { soldiers += p.gar || 0; });
      var s = D.el('span', '');
      s.appendChild(D.el('i', 'swatch o' + n.id));
      s.appendChild(D.el('b', '', ' ' + n.name + (n.id !== w.you && W.rel(w, w.you, n.id).ally ? ' 🤝' : '') + ' '));
      s.appendChild(document.createTextNode(mine.length + ' province' + (mine.length === 1 ? '' : 's') + ' · ' + Math.floor(soldiers) + ' soldiers'));
      box.appendChild(s);
    });
  }

  function glance(w) {
    var n = w.nations[w.you], box = D.$('glance');
    D.clear(box);
    if (A.mode.id === 'province') { population(w, box); return; }
    var mine = C.ownedBy(w, n);
    var queued = w.queue.filter(function (x) { return x.from === w.you; }).length;
    [
      ['Field army', Math.floor(n.soldiers)], ['Garrisons', Math.floor(C.garrisons(w, n))], ['Provinces', mine.length],
      ['Food', Math.floor(n.food)], ['Gold', Math.floor(n.gold)], ['Stone', Math.floor(n.stone)], ['Magic', Math.floor(n.magic)],
      ['Science', Math.floor(n.science)], ['Unrest', Math.round(n.unrest), n.unrest >= 50], ['Orders', queued]
    ].forEach(function (r) {
      var s = D.el('span', r[2] ? 'warn' : '');
      s.appendChild(D.el('b', '', r[0] + ' '));
      s.appendChild(document.createTextNode(String(r[1])));
      box.appendChild(s);
    });
  }

  A.glance = {
    render: function (w) { crumbs(w); clock(w); glance(w); },
    clock: clock,
    numbers: glance
  };

  // A short message at the bottom of the screen.
  var toastTimer = null;
  A.toast = function (text) {
    if (!text) return;
    var t = document.querySelector('.toast');
    if (!t) { t = D.el('div', 'toast'); document.body.appendChild(t); }
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  };
})();
