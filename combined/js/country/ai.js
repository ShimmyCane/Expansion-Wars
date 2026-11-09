// Expansion Wars (combined) — country scale: the computer nations' orders, and every nation's autopilot (its direction).
(function () {
  'use strict';
  var XW = window.XW, C = XW.country, W = XW.world;
  function K() { return C.CONFIG; }

  // Difficulty: the starting stocks of the level chosen (once, when a campaign starts), and the level kept in the world.
  C.applyDifficulty = function (w, level) {
    var D = K().DIFFICULTY[level];
    if (!D) return 'No such difficulty.';
    w.difficulty = level;
    w.nations.forEach(function (n) {
      var add = n.id === w.you ? D.you : D.ai;
      Object.keys(add).forEach(function (k) { n[k] = (n[k] || 0) + add[k]; });
    });
    W.log(w, 'Difficulty: ' + D.label + '. ' + D.note);
    return null;
  };
  function isHard(w) { var D = K().DIFFICULTY[w.difficulty]; return !!(D && D.hard); }

  // Hard: once nothing is left to claim, war on the neighbour this nation outmatches most, but not one that is already
  // fighting two or more nations. Returns that neighbour, or null.
  function hardPrey(w, a) {
    var best = null;
    a.nb.forEach(function (id) {
      var b = w.nations[id];
      if (!b.alive || W.rel(w, a.id, id).war || W.rel(w, a.id, id).ally) return;
      var fighting = C.alive(w).filter(function (k) { return k.id !== b.id && W.rel(w, k.id, b.id).war; }).length;
      if (fighting >= 2) return;
      var ratio = C.power(w, a) / Math.max(1, C.power(w, b));
      if (ratio >= K().HARD_RATIO && (!best || ratio > best.ratio)) best = { b: b, ratio: ratio };
    });
    return best ? best.b : null;
  }

  // The computer nations plan their orders from the same world as yours.
  C.planAI = function (w) {
    var hard = isHard(w);
    C.alive(w).forEach(function (a) {
      if (a.id === w.you) return;
      // Hard: claim neutral land every turn while there is any; once there is none, go to war strategically.
      if (hard && !a.neutral) {
        var land = C.claimTarget(w, a);
        if (land !== null) { a.aim = 'growth'; w.queue.push({ type: 'claim', from: a.id, to: -1, prov: land, pct: 50 }); }
        else {
          a.aim = 'war';
          if (!C.atWar(w, a.id)) { var prey = hardPrey(w, a); if (prey) w.queue.push({ type: 'declare', from: a.id, to: prey.id }); }
        }
      }
      var foes = C.alive(w).filter(function (b) { return b.id !== a.id && W.rel(w, a.id, b.id).war; });
      if (foes.length) {
        // Attack the foe worth the most for the distance, when the army can beat it. Not every turn.
        var best = null;
        foes.forEach(function (b) {
          if (C.canDo(w, 'attack', a.id, b.id)) return;
          var value = C.targetValue(w, b) / (1 + C.route(w, a.id, b.id).dist);
          if (!best || value > best.value) best = { b: b, value: value };
        });
        var attackP = hard && !a.neutral ? 1 : (a.neutral ? 0.3 : 0.6) * (a.aim === 'war' ? 1.3 : a.aim === 'wealth' ? 0.5 : 1);
        // At war the computer commits everything: the whole army, not half.
        if (best && a.soldiers * C.quality(a) >= (a.neutral ? 1.5 : 0.9) * best.b.soldiers * C.quality(best.b) && Math.random() < attackP) {
          w.queue.push({ type: 'attack', from: a.id, to: best.b.id, pct: 100 });
        }
        // Sue for peace when badly outmatched.
        foes.forEach(function (b) {
          var r = W.rel(w, a.id, b.id);
          if (b.soldiers > 2.5 * a.soldiers && r.rep >= K().MIN_REP.ceasefire && w.time.turn - r.warSince >= K().MIN_WAR_TURNS && Math.random() < 0.3) {
            // Peace is offered, not declared: you decide on your card, and the war goes on until you accept.
            if (b.id === w.you) C.offerCeasefire(w, a.id, b.id);
            else w.queue.push({ type: 'ceasefire', from: a.id, to: b.id });
          }
        });
      } else if (Math.random() < (a.neutral ? 0.03 : 0.2)) {
        // Build up, then strike: a neighbour is attacked only when this nation is well ahead (DECLARE_RATIO) and the
        // neighbour's power has been falling over the last turn (a weak opponent in decline). Neutrals need double.
        var prey = a.nb.map(function (id) { return w.nations[id]; }).filter(function (b) {
          var falling = b.powerOld !== undefined && b.powerNow < b.powerOld;
          return b.alive && !W.rel(w, a.id, b.id).war && falling &&
            C.power(w, a) >= (a.neutral ? 2 : K().DECLARE_RATIO) * C.power(w, b);
        });
        if (prey.length) w.queue.push({ type: 'declare', from: a.id, to: prey[0].id });
      }
      if (Math.random() < (a.neutral ? 0.03 : 0.15)) {
        var pals = a.nb.map(function (id) { return w.nations[id]; }).filter(function (b) {
          var r = W.rel(w, a.id, b.id);
          return b.alive && !r.war && !r.ally && r.rep >= K().MIN_REP.ally;
        });
        if (pals.length) w.queue.push({ type: 'ally', from: a.id, to: pals[0].id });
      }
      if (Math.random() < 0.25) {
        var friends = a.nb.map(function (id) { return w.nations[id]; }).filter(function (b) {
          var r = W.rel(w, a.id, b.id);
          return b.alive && !r.war && !r.trade && r.rep >= -10 && a.gold >= K().TRADE_SETUP;
        });
        if (friends.length) w.queue.push({ type: 'trade', from: a.id, to: friends[0].id });
      }
      // At war a nation fights its enemy rather than claim neutral land, so it claims less.
      var claimP = hard && !a.neutral ? 0 : (a.neutral ? 0.15 : 0.45) * (a.aim === 'growth' ? 1.5 : a.aim === 'wealth' ? 0.5 : 1) * (C.atWar(w, a.id) ? 0.5 : 1);   // hard claimed above
      if (Math.random() < claimP) {
        var pid = C.claimTarget(w, a);
        if (pid !== null) w.queue.push({ type: 'claim', from: a.id, to: -1, prov: pid, pct: 50 });
      }
    });
  };

  // The War plan strikes with half the army, only when that half clearly beats the defenders.
  function strikes(n, b) { return n.soldiers * 0.5 * C.quality(n) >= 1.3 * K().DEFENDER * b.soldiers * C.quality(b); }

  // Every nation plays towards its direction at the end of each turn: builds and upgrades (within the reserve),
  // research, training for War, and for you one claim or attack when you have none queued.
  C.autopilot = function (w, n) {
    if (!n.alive) return;
    var k = K(), aim = n.aim, keep = k.RESERVE[aim], mine = n.id === w.you, done = 0;
    if (!mine) n.guns = k.GUNS_FOR[aim];
    k.PLAN[aim].some(function (step) {
      if (done >= k.AUTO_ACTIONS) return true;
      var err = step === 'build' ? C.buildVillage(w, n, keep) : C.grow(w, n, step, keep);
      if (err) return false;
      done++;
      if (mine) W.log(w, k.AIM[aim].name + ' plan: ' + (step === 'build' ? 'built a village on an empty dot.' : 'upgraded a ' + W.label(step) + ' to a ' + W.label(k.GROW[step].to) + '.'));
      return false;
    });
    k.RESEARCH_ORDER[aim].some(function (t) {
      if (n.science < C.trackCost(n, t) * (aim === 'wealth' ? 2 : 1)) return false;
      C.investAt(n, t);
      if (mine) W.log(w, k.AIM[aim].name + ' plan: research ' + k.TRACK[t].name + ' to level ' + n.research[t] + '.');
      return true;
    });
    if (!mine && n.food < 5) {
      if (n.gold >= k.BUY.gold) C.buyFood(n, 'gold');
      else if (n.stone >= k.BUY.stone) C.buyFood(n, 'stone');
    }
    if (aim === 'war' && n.food - k.TRAIN.food >= keep.food + 20 && n.gold - k.TRAIN.gold >= keep.gold + 20) {
      C.spend(n, { food: k.TRAIN.food, gold: k.TRAIN.gold });
      n.tech = Math.min(100, n.tech + k.TRAIN.tech);
      if (mine) W.log(w, 'War plan: the army trained (' + k.TRAIN.food + ' food, ' + k.TRAIN.gold + ' gold).');
    }
    if (!mine || w.queue.some(function (x) { return x.from === w.you && (x.type === 'claim' || x.type === 'attack'); })) return;
    var surplus = aim !== 'wealth' || (n.gold >= 80 && n.food >= 40);
    if (aim === 'growth' || (aim === 'wealth' && surplus)) {
      var pid = C.claimTarget(w, n);
      if (pid !== null) {
        w.queue.push({ type: 'claim', from: n.id, to: -1, prov: pid, pct: 50 });
        W.log(w, k.AIM[aim].name + ' plan: claim neutral land with half your army.');
      }
    } else if (aim === 'war') {
      var best = null;
      w.nations.forEach(function (b) {
        if (b.id === n.id || !b.alive || C.canDo(w, 'attack', n.id, b.id) || !strikes(n, b)) return;
        if (!best || b.soldiers < best.soldiers) best = b;
      });
      if (best) {
        w.queue.push({ type: 'attack', from: n.id, to: best.id, pct: 50 });
        W.log(w, 'War plan: attack ' + best.name + ' with half your army.');
        return;
      }
      // No one to fight yet: declare war on the weakest neighbour the army clearly outmatches. One war at a time.
      var prey = null;
      n.nb.forEach(function (id) {
        var b = w.nations[id];
        if (!b.alive || W.rel(w, n.id, id).war || !strikes(n, b)) return;
        if (!prey || b.soldiers < prey.soldiers) prey = b;
      });
      if (prey && !C.atWar(w, n.id)) {
        w.queue.push({ type: 'declare', from: n.id, to: prey.id });
        W.log(w, 'War plan: declare war on ' + prey.name + '.');
      }
    }
  };
})();
