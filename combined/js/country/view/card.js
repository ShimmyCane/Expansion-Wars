// Expansion Wars (combined) — the country card: the province you tapped, and the nation that holds it.
// Your nation: direction, guns or butter, research, food, villages, releasing soldiers. Another nation: relations,
// the route there, and the diplomacy buttons. Neutral land: a claim. Every button changes the world and then calls
// done(message), which logs it and redraws.
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world, D = XW.core;
  C.view = C.view || {};
  function K() { return C.CONFIG; }
  var el = D.el, button = D.button;

  function sendSlider(w, label) {
    var box = el('div'), line = el('p'), range = el('input'), me = w.nations[w.you];
    function show() { line.textContent = 'Send ' + w.view.sendPct + '% of your field army (' + Math.floor(me.soldiers * w.view.sendPct / 100) + ' soldiers) ' + label + '.'; }
    range.type = 'range'; range.min = 5; range.max = 100; range.step = 5; range.value = w.view.sendPct;
    range.setAttribute('aria-label', 'Share of your field army to send');
    range.addEventListener('input', function () { w.view.sendPct = Number(range.value); show(); });
    show();
    box.appendChild(line); box.appendChild(range);
    return box;
  }

  function sendShare(w) { return w.view.sendPct; }

  function routeText(w, R, i) {
    if (!R) return 'Route: no land route.';
    var F = C.attackFactors(w, i, R);
    var t = 'Route: ' + R.hops + ' step' + (R.hops === 1 ? '' : 's') + ', ' + R.rivers + ' river border' + (R.rivers === 1 ? '' : 's') + '.';
    if (R.crossed.length) t += ' Through ' + R.crossed.join(', ') + '.';
    if (R.hostile) t += ' ' + R.hostile + ' hostile province' + (R.hostile === 1 ? '' : 's') + ' on the way.';
    if (F.chip) t += ' The army loses ' + Math.round(F.chip * 100) + '% on the way.';
    if (F.far) t += ' Far away: strength −' + Math.round(F.far * 100) + '%.';
    if (F.tail > 1) t += ' Retaking recently lost land: strength +25%.';
    if (R.dist > K().MAX_DIST) t += ' Too far away (the limit is ' + K().MAX_DIST + ' steps).';
    return t;
  }

  // The province you tapped: what it is, and the way into it.
  C.view.provinceCard = function (card, w, p, ui, done) {
    var me = w.nations[w.you];
    card.appendChild(el('h3', '', cap(W.label(p.tier)) + (p.owner >= 0 ? ' of ' + w.nations[p.owner].name : ' (neutral land)')));
    card.appendChild(el('p', '', Math.floor(p.gar || 0) + ' soldiers stationed · defence ' + C.featureDef(w, p) + ' · ' + K().FEATURE_NAME[C.feature(w, p)] +
      (p.mount ? ' · mountain slope' : '') + (p.river ? ' · river border' : '') + (p.occ > 0 ? ' · occupied ' + p.occ + ' more turns' : '')));
    card.appendChild(button('🔍 Zoom into this province (real time)', function () { XW.app.scales.go('province', p.id); }, { cls: 'big' }));
    if (p.owner === w.you) {
      var row = el('div', 'row');
      // Garrison moves: pick this province, then tap another of yours (up to MOVE_HOPS away) on the map.
      if (ui.moveFrom === p.id) {
        row.appendChild(button('Cancel the move', function () { ui.moveFrom = null; done(); }));
        card.appendChild(el('p', 'muted small', 'Tap one of your provinces, up to ' + W.CONFIG.MOVE_HOPS + ' away, to move ' + sendShare(w) + '% of this garrison there.'));
      } else if (p.gar >= 1) {
        row.appendChild(button('Move the garrison from here', function () { ui.moveFrom = p.id; done(); }));
      }
      if (p.tier === 'f') {
        row.appendChild(button(p.tower === 2 ? 'Tower upgraded (range doubled)' : 'Upgrade the tower (' + K().TOWER_COST.gold + ' gold, ' + K().TOWER_COST.stone + ' stone)',
          function () { done(C.upgradeTower(w, me, p)); }, { disabled: p.tower === 2 || !!C.shortfall(me, K().TOWER_COST) }));
      }
      if (p.tier === 'e') {
        var vc = C.villageCost(w, me);
        row.appendChild(button('Build a village (' + vc.gold + ' gold, ' + vc.food + ' food)', function () {
          done(C.buildAt(w, me, p) || 'A new village was built.');
        }, { disabled: !!C.shortfall(me, vc) }));
      } else if (K().GROW[p.tier]) {
        var gc = C.growCost(w, me, p.tier);
        row.appendChild(button('Upgrade to a ' + W.label(K().GROW[p.tier].to) + ' (' + gc.gold + ' gold, ' + gc.food + ' food' + (gc.stone ? ', ' + gc.stone + ' stone' : '') + ')', function () {
          var from = p.tier;
          done(C.growAt(w, me, p, from) || 'You upgraded a ' + W.label(from) + ' to a ' + W.label(p.tier) + '.');
        }, { disabled: !!C.shortfall(me, gc) }));
      }
      card.appendChild(row);
    }
    if (p.owner < 0) claimCard(card, w, p, done);
  };

  function claimCard(card, w, p, done) {
    var R = C.routeProv(w, w.you, p.id);
    var t = routeText(w, R, w.you);
    if (R && R.dist <= K().MAX_DIST) { var cc = C.claimCost(R); t += ' The survey costs ' + cc.gold + ' gold and ' + cc.food + ' food.'; }
    card.appendChild(el('p', 'muted small', t));
    card.appendChild(sendSlider(w, 'to claim it at the end of the turn'));
    var q = w.queue.filter(function (x) { return x.type === 'claim' && x.from === w.you && x.prov === p.id; })[0];
    var err = C.canClaim(w, w.you, p.id);
    if (q) card.appendChild(button('Queued: claim (' + q.pct + '%) · tap to cancel', function () { C.removeClaim(w, p.id); done('Cancelled.'); }));
    else card.appendChild(button('Claim this land (send ' + w.view.sendPct + '%)', function () { done(C.queueClaim(w, p.id, w.view.sendPct)); }, { disabled: !!err }));
    if (err && !q) card.appendChild(el('p', 'muted small', err));
  }

  // A nation: yours, with the controls; another, with relations and diplomacy.
  C.view.nationCard = function (card, w, n, ui, done) {
    card.appendChild(el('h3', '', n.name + (n.id === w.you ? ' (you)' : '') + (n.alive ? '' : ' (fallen)')));
    if (!n.alive) return;
    var t = C.tiers(w, n), R = C.ratio(w, n);
    card.appendChild(el('p', '', 'Villages ' + t.v + ' · Towns ' + t.t + ' · Cities ' + t.c + ' · Fortresses ' + t.f + ' · Empty dots ' + t.e));
    card.appendChild(el('p', '', 'Field army ' + Math.floor(n.soldiers) + ' · Garrisons ' + Math.floor(C.garrisons(w, n)) + ' · Power ' + Math.round(C.power(w, n)) + ' · ' + C.stage(R)));
    card.appendChild(el('p', '', 'Population ' + C.population(w, n).toFixed(1) + ' · Army cap ' + C.armyCap(w, n) + ' · Unrest ' + Math.round(n.unrest) + ' · Occupied ' + C.occupied(w, n).length));
    if (n.id === w.you) yourCard(card, w, n, done);
    else otherCard(card, w, n, done);
  };

  function yourCard(card, w, n, done) {
    // Direction: the north star the autopilot plays towards each turn.
    card.appendChild(el('p', 'small', 'Direction: ' + K().AIM[n.aim].name + '. ' + K().AIM[n.aim].text));
    var seg = el('div', 'direction-seg');
    K().AIM_KEYS.forEach(function (k) {
      seg.appendChild(button(K().AIM[k].icon + ' ' + K().AIM[k].name, function () {
        n.aim = k;
        done('Direction set to ' + K().AIM[k].name + '. The autopilot plans towards it at the end of each turn.');
      }, { pressed: n.aim === k }));
    });
    card.appendChild(seg);
    // Guns or butter.
    var line = el('p', 'small'), range = el('input');
    function show() { line.textContent = 'Guns ' + Math.round(n.guns * 100) + '% · Butter ' + Math.round((1 - n.guns) * 100) + '%. Guns raise soldiers; butter raises food.'; }
    range.type = 'range'; range.min = 0; range.max = 100; range.step = 10; range.value = Math.round(n.guns * 100);
    range.setAttribute('aria-label', 'Guns or butter');
    range.addEventListener('input', function () { n.guns = Number(range.value) / 100; show(); });
    range.addEventListener('change', function () { done(); });
    show();
    card.appendChild(line); card.appendChild(range);
    // Research and food.
    card.appendChild(el('p', 'muted small', 'Science ' + Math.floor(n.science) + '. Levels: Agriculture ' + n.research.agri + ', Civics ' + n.research.civic + ', Arms ' + n.research.arms + '.'));
    var rs = el('div', 'row');
    K().TRACK_KEYS.forEach(function (k) {
      var c = C.trackCost(n, k);
      rs.appendChild(button(K().TRACK[k].icon + ' ' + K().TRACK[k].name + ' ' + (n.research[k] + 1) + ' (' + c + ')', function () {
        done(C.investAt(n, k) || 'Research: ' + K().TRACK[k].name + ' is now level ' + n.research[k] + '.');
      }, { disabled: n.science < c }));
    });
    [['gold', 'Buy 10 food (20 gold)'], ['stone', 'Buy 10 food (30 stone)']].forEach(function (pair) {
      rs.appendChild(button(pair[1], function () { done(C.buyFood(n, pair[0]) || 'You bought 10 food with ' + pair[0] + '.'); }, { disabled: n[pair[0]] < K().BUY[pair[0]] }));
    });
    card.appendChild(rs);
    // Soldiers can leave for gold.
    var free = el('div', 'row');
    [['buyout', 'Buy out contracts'], ['disband', 'Disband']].forEach(function (pair) {
      var o = C.releaseOffer(n, pair[0]);
      free.appendChild(button(pair[1] + ' (' + o.count + ' → ' + o.gold + ' gold)', function () { done(C.release(w, n, pair[0])); }, { disabled: o.count < 1 }));
    });
    card.appendChild(free);
    card.appendChild(el('p', 'muted small', 'Tap one of your provinces to build or upgrade it, or zoom in to station soldiers there.'));
  }

  function otherCard(card, w, n, done) {
    var r = W.rel(w, w.you, n.id);
    card.appendChild(el('p', '', 'With you: ' + (r.war ? 'At war' : r.ally ? 'Allied' : r.trade ? 'Trading' : 'At peace') +
      ' · reputation ' + Math.round(r.rep) + (r.truce > 0 ? ' · truce ' + r.truce + ' turns' : '') + ' · direction ' + K().AIM[n.aim].name));
    var R = C.route(w, w.you, n.id), t = routeText(w, R, w.you);
    var J = R ? C.joiners(w, w.you, n.id) : [];
    if (J.length) t += ' Allies join the attack: ' + J.map(function (id) { return w.nations[id].name; }).join(', ') + '.';
    card.appendChild(el('p', 'muted small', t));
    card.appendChild(sendSlider(w, 'when you attack'));
    var q = w.queue.filter(function (x) { return x.from === w.you && x.to === n.id; })[0];
    var row = el('div', 'row'), notes = [];
    K().DIPLO.forEach(function (d) {
      var err = C.canDo(w, d.type, w.you, n.id);
      if (q && q.type === d.type) {
        row.appendChild(button('Queued: ' + d.text + ' · tap to cancel', function () { C.removeQueued(w, w.you, n.id); done('Cancelled.'); }));
        return;
      }
      row.appendChild(button(d.type === 'attack' ? 'Attack (send ' + w.view.sendPct + '%)' : d.text, function () {
        done(C.queueOrder(w, d.type, n.id, w.view.sendPct));
      }, { disabled: !!err || !!q }));
      if (err) notes.push(d.text + ': ' + err);
    });
    card.appendChild(row);
    notes.forEach(function (s) { card.appendChild(el('p', 'muted small', s)); });
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
})();
