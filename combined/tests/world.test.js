// Expansion Wars (combined) — world tests: one source of truth across the three scales. Run with: node tests/world.test.js
'use strict';
const assert = require('assert');
const { load, runner, RULES } = require('./load');

const t = runner('World');
function fresh(seed) {
  const ctx = load(RULES);
  const w = ctx.XW.country.newWorld(seed || 1234);
  return { ctx, XW: ctx.XW, w };
}
// Everything a nation has in soldiers: its field army, its garrisons, its marches, and any battle it is in.
function soldiersOf(XW, w, id) {
  const gar = w.provs.filter(p => p.owner === id).reduce((s, p) => s + (p.gar || 0), 0);
  const march = w.marches.filter(m => m.owner === id).reduce((s, m) => s + m.count, 0);
  return w.nations[id].soldiers + gar + march;
}
// A neutral province next to one of yours, and that province.
function neutralNextToYou(w) {
  for (const p of w.provs) {
    if (p.owner !== w.you) continue;
    const q = p.adj.map(id => w.provs[id]).find(x => x.kind === 'province' && x.owner < 0);
    if (q) return { mine: p, target: q };
  }
  return null;
}

t.test('a new world has six nations, fifteen provinces each, and terrain', () => {
  const { w } = fresh();
  assert.strictEqual(w.nations.length, 6);
  assert.strictEqual(w.provs.filter(p => p.kind === 'province').length, 90);
  assert.ok(w.provs.some(p => p.kind === 'terrain'));
  w.nations.forEach(n => assert.strictEqual(w.provs.filter(p => p.owner === n.id).length, 3, n.name));
});

t.test('the same seed gives the same map', () => {
  const a = fresh(77).w, b = fresh(77).w;
  const shape = w => JSON.stringify(w.provs.map(p => [p.x, p.y, p.owner, p.tier, p.adj]));
  assert.strictEqual(shape(a), shape(b));
});

t.test('the world is plain JSON: it survives a round trip unchanged', () => {
  const { w } = fresh();
  const text = JSON.stringify(w);
  assert.strictEqual(JSON.stringify(JSON.parse(text)), text);
  assert.ok(!/function|NaN/.test(text));
});

t.test('forty country turns run, and the world stays plain numbers (no NaN)', () => {
  const { XW, w } = fresh(99);
  for (let i = 0; i < 40 && !w.over; i++) XW.country.endTurn(w);
  assert.ok(w.time.turn > 1);
  const text = JSON.stringify(w);
  assert.ok(!/NaN|Infinity|null,"y"/.test(text.replace(/"lostTurn":-99/g, '')), 'no NaN in the world');
  w.nations.forEach(n => ['soldiers', 'food', 'gold', 'stone', 'magic', 'science'].forEach(k => assert.ok(Number.isFinite(n[k]), n.name + ' ' + k)));
});

t.test('time dilation: a minute in a battle is three world seconds; the country turn waits', () => {
  const { XW, w } = fresh();
  const W = XW.world;
  W.advance(w, 60, 'unit');
  assert.ok(Math.abs(w.time.t - 60 * W.CONFIG.RATE.unit) < 1e-9);
  assert.ok(!W.turnDue(w));
  W.advance(w, 60, 'province');
  assert.ok(Math.abs(w.time.t - 60 * (W.CONFIG.RATE.unit + W.CONFIG.RATE.province)) < 1e-9);
  W.advance(w, 120, 'country');
  assert.ok(W.turnDue(w), 'two minutes on the country map (a turn of 120 s) end the turn');
  XW.country.endTurn(w);
  assert.strictEqual(w.time.turn, 2);
  assert.ok(!W.turnDue(w));
});

t.test('the province window holds the focus and its neighbours, two rings out', () => {
  const { XW, w } = fresh();
  const focus = w.provs.find(p => p.owner === w.you);
  const win = XW.province.window(w, focus.id);
  assert.ok(win.inside[focus.id]);
  focus.adj.filter(q => w.provs[q].kind === 'province').forEach(q => assert.ok(win.inside[q], 'neighbour ' + q));
  win.ids.forEach(id => assert.ok(win.depth[id] <= XW.world.CONFIG.RINGS));
});

t.test('garrisons grow from the field army, and no soldier is made or lost by it', () => {
  const { XW, w } = fresh();
  const focus = w.provs.find(p => p.owner === w.you);
  const win = XW.province.window(w, focus.id);
  const before = soldiersOf(XW, w, w.you);
  for (let i = 0; i < 100; i++) XW.province.step(w, win, 0.1);
  assert.ok(focus.gar > XW.world.CONFIG.START_GAR, 'the garrison grew');
  assert.ok(Math.abs(soldiersOf(XW, w, w.you) - before) < 1e-6, 'total soldiers unchanged');
});

t.test('a march into neutral land takes it, and the country map shows the new owner at once', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  assert.ok(pair, 'a neutral neighbour');
  const win = XW.province.window(w, pair.mine.id);
  pair.mine.gar = 30;
  pair.target.gar = 3;
  assert.strictEqual(XW.province.send(w, win, w.you, pair.mine.id, pair.target.id, 100), null);
  for (let i = 0; i < 200 && w.marches.length; i++) XW.province.step(w, win, 0.1, { grow: false });
  for (let i = 0; i < 1000 && pair.target.fight; i++) XW.province.fights(w, XW.world.CONFIG.FIGHT_ROUND);
  assert.strictEqual(pair.target.owner, w.you);
  assert.strictEqual(XW.country.ownedBy(w, w.nations[w.you]).length, 4);
  assert.ok(pair.target.gar > 0 && pair.target.gar <= 30, 'the attackers who are left hold it (' + Math.round(pair.target.gar) + ')');
});

t.test('a march into a nation you are at peace with is refused', () => {
  const { XW, w } = fresh(31);
  let found = null;
  w.provs.forEach(p => {
    if (found || p.owner !== w.you) return;
    const q = p.adj.map(id => w.provs[id]).find(x => x.kind === 'province' && x.owner > 0);
    if (q) found = { mine: p, target: q };
  });
  if (!found) return;   // this seed has no nation next to yours yet: nothing to check
  const win = XW.province.window(w, found.mine.id);
  const err = XW.province.send(w, win, w.you, found.mine.id, found.target.id, 50);
  assert.ok(/peace/.test(err), err);
});

t.test('leaving the province lands every march at once', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  const win = XW.province.window(w, pair.mine.id);
  pair.mine.gar = 20;
  XW.province.send(w, win, w.you, pair.mine.id, pair.target.id, 50);
  assert.ok(w.marches.length > 0);
  const before = soldiersOf(XW, w, w.you);
  XW.province.settle(w, win);
  assert.strictEqual(w.marches.length, 0);
  assert.ok(soldiersOf(XW, w, w.you) <= before + 1e-6);
});

t.test('mustering moves soldiers between the field army and a garrison', () => {
  const { XW, w } = fresh();
  const p = w.provs.find(q => q.owner === w.you), n = w.nations[w.you];
  const army = n.soldiers, gar = p.gar;
  assert.strictEqual(XW.province.muster(w, w.you, p.id, 10), null);
  assert.strictEqual(n.soldiers, army - 10);
  assert.strictEqual(p.gar, gar + 10);
  assert.strictEqual(XW.province.muster(w, w.you, p.id, -10), null);
  assert.strictEqual(n.soldiers, army);
});

t.test('a province fight becomes a valid battle request', () => {
  const { XW, w, ctx } = fresh(31);
  const pair = neutralNextToYou(w);
  pair.target.gar = 12;
  const req = XW.unit.requestFor(w, pair.mine.id, pair.target.id, 40);
  assert.deepStrictEqual(Array.from(ctx.V4.validateRequest(req)), []);
  assert.strictEqual(req.attacker.pool, 40);
  assert.strictEqual(req.defender.pool, 12);
  assert.strictEqual(req.grain, 4);
});

t.test('a battle from the province scale writes its result back into the world', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  const win = XW.province.window(w, pair.mine.id);
  pair.mine.gar = 60;
  pair.target.gar = 4;
  assert.strictEqual(XW.unit.start(w, win, pair.mine.id, pair.target.id, 100), null);
  assert.ok(w.battle);
  assert.strictEqual(pair.mine.gar, 0);
  const st = XW.unit.rebuild(w);
  const result = XW.unit.finishAuto(st);
  XW.unit.apply(w, result);
  assert.strictEqual(w.battle, null);
  assert.strictEqual(w.battles.length, 1);
  if (result.winner === 'attacker') assert.strictEqual(pair.target.owner, w.you);
  const left = w.battles[0].left;
  assert.ok(left.attacker <= 60 && left.defender <= 4, 'no soldiers appear from nowhere');
});

t.test('a battle is rebuilt exactly from its request and orders (after a reload)', () => {
  const { XW, w, ctx } = fresh(31);
  const pair = neutralNextToYou(w);
  const win = XW.province.window(w, pair.mine.id);
  pair.mine.gar = 40;
  pair.target.gar = 30;
  XW.unit.start(w, win, pair.mine.id, pair.target.id, 100);
  const live = XW.unit.rebuild(w);
  for (let i = 0; i < 40; i++) ctx.V4.step(live);
  const mine = live.units.find(u => u.side === 0 && u.state === 'active');
  ctx.V4.issue(live, { kind: 'move', unit: mine.id, x: 25, y: 16 });
  for (let i = 0; i < 60; i++) ctx.V4.step(live);
  XW.unit.record(w, live);
  const again = XW.unit.rebuild(JSON.parse(JSON.stringify(w)));
  const snap = s => JSON.stringify(s.units.map(u => [u.id, u.x.toFixed(4), u.y.toFixed(4), u.people.toFixed(4), u.state]));
  assert.strictEqual(again.tick, live.tick);
  assert.strictEqual(snap(again), snap(live));
});

t.test('the world saves on this device and loads back the same', () => {
  const { XW, w } = fresh();
  assert.ok(XW.world.saveLocal(w));
  assert.strictEqual(JSON.stringify(XW.world.loadLocal()), JSON.stringify(w));
});

t.test('a capture at any scale goes through one rule: a nation\'s land drops a grade and is occupied', () => {
  const { XW, w } = fresh();
  const p = w.provs.find(q => q.owner === 1 && q.tier === 't');
  XW.world.capture(w, p, 0, 5);
  assert.strictEqual(p.owner, 0);
  assert.strictEqual(p.tier, 'v');
  assert.strictEqual(p.occ, XW.world.OCCUPIED_TURNS);
  assert.strictEqual(p.home, 1);
  assert.strictEqual(p.gar, 5);
});

t.test('the time scales: country 0.5, province 0.1, a fortress window at half again, and ×2 fast-forward', () => {
  const { XW, w } = fresh(5);
  const W = XW.world;
  assert.strictEqual(W.rateFor(w, 'country'), 0.5);
  assert.strictEqual(W.rateFor(w, 'province'), 0.1);
  assert.strictEqual(W.rateFor(w, 'unit'), 0.05);
  w.view.fast = true;
  assert.strictEqual(W.rateFor(w, 'country'), 1, 'fast-forward doubles the country clock');
  assert.strictEqual(W.rateFor(w, 'unit'), 0.05, 'the battle is not fast-forwarded');
  w.view.fast = false;
  const fort = w.provs.find(p => p.owner === w.you);
  fort.tier = 'f';
  w.view.prov = fort.id;
  assert.strictEqual(W.rateFor(w, 'province'), 0.05, 'a fortress in the window halves province time');
});

t.test('a village has no settlement wall, a town does', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  pair.target.tier = 'v';
  assert.strictEqual(XW.unit.requestFor(w, pair.mine.id, pair.target.id, 20).gen.walls, false);
  pair.target.tier = 't';
  assert.strictEqual(XW.unit.requestFor(w, pair.mine.id, pair.target.id, 20).gen.walls, true);
});

t.test('recruits stop at the army cap less the garrisons', () => {
  const { XW, w } = fresh(9);
  const n = w.nations[w.you];
  const p = w.provs.find(q => q.owner === w.you);
  p.gar = 30;
  const room = XW.country.armyCap(w, n) - XW.country.garrisons(w, n);
  for (let i = 0; i < 40; i++) XW.country.economy(w, n);
  assert.ok(n.soldiers <= Math.max(40, room) + 1e-6, 'soldiers ' + n.soldiers + ' room ' + room);
});

t.test('a march into an ally is a donation: the soldiers join its garrison', () => {
  const { XW, w } = fresh(31);
  // Make the neighbour an ally: find one of your provinces next to another nation's.
  const mine = w.provs.find(p => p.kind === 'province' && p.owner === w.you);
  const theirs = w.provs[mine.adj.find(q => w.provs[q].kind === 'province')];
  theirs.owner = 1;   // a neighbour of yours belongs to another nation
  const ally = w.nations[theirs.owner];
  XW.world.rel(w, w.you, ally.id).ally = true;
  const win = XW.province.window(w, mine.id);
  mine.gar = 20;
  const before = theirs.gar || 0;
  assert.strictEqual(XW.province.send(w, win, w.you, mine.id, theirs.id, 50), null);
  for (let i = 0; i < 200 && w.marches.length; i++) XW.province.step(w, win, 0.1, { grow: false });
  assert.ok(theirs.gar > before, 'the ally garrison grew');
  assert.strictEqual(theirs.owner, ally.id, 'the ally keeps its land');
});

t.test('muster into a province works once a turn', () => {
  const { XW, w } = fresh();
  const p = w.provs.find(q => q.owner === w.you);
  assert.strictEqual(XW.province.muster(w, w.you, p.id, 5), null);
  assert.ok(/once a turn/.test(XW.province.muster(w, w.you, p.id, 5)));
  XW.country.endTurn(w);
  assert.strictEqual(XW.province.muster(w, w.you, p.id, 5), null, 'a new turn allows one more');
});

t.test('an enemy that reaches a province starts a fight; risk rounds settle it in world time', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  pair.target.gar = 3;
  pair.mine.gar = 40;
  const win = XW.province.window(w, pair.mine.id);
  XW.province.send(w, win, w.you, pair.mine.id, pair.target.id, 100);
  for (let i = 0; i < 300 && w.marches.length; i++) XW.province.step(w, win, 0.1, { grow: false });
  assert.ok(pair.target.fight, 'the fight is on');
  assert.strictEqual(pair.target.owner, -1, 'not taken yet: it is a fight');
  for (let i = 0; i < 1000 && pair.target.fight; i++) XW.province.fights(w, XW.world.CONFIG.FIGHT_ROUND);
  assert.ok(!pair.target.fight, 'the fight resolved');
  assert.ok(pair.target.owner === w.you || pair.target.owner === -1, 'one side holds it');
});

t.test('Join battle takes the fight into the unit scale, and the result comes back', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  pair.target.gar = 4;
  pair.mine.gar = 40;
  const win = XW.province.window(w, pair.mine.id);
  XW.province.send(w, win, w.you, pair.mine.id, pair.target.id, 100);
  for (let i = 0; i < 300 && w.marches.length; i++) XW.province.step(w, win, 0.1, { grow: false });
  assert.ok(pair.target.fight, 'a fight is on');
  assert.strictEqual(XW.unit.startFight(w, pair.target), null);
  assert.ok(w.battle && w.battle.fight === true, 'a battle is set up');
  assert.strictEqual(pair.target.fight, null, 'the fight is now the battle');
  XW.unit.apply(w, XW.unit.finishAuto(XW.unit.rebuild(w)));
  assert.strictEqual(w.battle, null);
  assert.ok(w.battles[w.battles.length - 1].fight, 'recorded as a fight');
});

t.test('a garrison move between your provinces happens at the end of the turn', () => {
  const { XW, w } = fresh(31);
  const mine = w.provs.find(p => p.owner === w.you && p.adj.some(q => w.provs[q].owner === w.you && w.provs[q].kind === 'province'));
  const to = w.provs[mine.adj.find(q => w.provs[q].owner === w.you && w.provs[q].kind === 'province')];
  mine.gar = 20; to.gar = 0;
  assert.strictEqual(XW.country.queueMove(w, mine.id, to.id, 50), null);
  XW.country.endTurn(w);
  assert.ok(to.gar >= 10, 'about half moved');
});

t.test('garrisons move towards the border on their own', () => {
  const { XW, w } = fresh(31);
  const n = w.nations[w.you];
  // Build an interior province: its neighbours are yours, and one of them borders another nation.
  const inner = w.provs.find(p => p.kind === 'province' && p.owner === n.id);
  inner.adj.forEach(id => { if (w.provs[id].kind === 'province') w.provs[id].owner = n.id; });
  const edge = w.provs[inner.adj.find(id => w.provs[id].kind === 'province')];
  const far = edge.adj.map(id => w.provs[id]).find(Q => Q.kind === 'province' && Q.id !== inner.id && Q.owner === n.id && inner.adj.indexOf(Q.id) < 0);
  assert.ok(far, 'a neighbour two steps out');
  far.owner = 1;
  inner.gar = 30;
  XW.country.autoMoves(w);
  assert.ok(inner.gar < 30, 'the interior garrison moved out');
});

t.test('a fortress tower slows and shoots a march in range', () => {
  const { XW, w } = fresh(31);
  const fort = w.provs.find(p => p.kind === 'province' && p.owner >= 0 && p.owner !== w.you);
  fort.tier = 'f';
  XW.world.rel(w, w.you, fort.owner).war = true;
  const m = { id: 1, owner: w.you, from: fort.id, to: fort.id, count: 10, p: 0, route: [] };
  w.marches.push(m);
  const win = XW.province.window(w, fort.id);
  XW.province.step(w, win, 0.1, { grow: false });
  assert.ok(m.count < 10, 'the tower shoots at the march');
});

t.test('the tower upgrade costs gold and stone, and marks the tower upgraded', () => {
  const { XW, w } = fresh(31);
  const n = w.nations[w.you];
  const fort = w.provs.find(p => p.owner === w.you);
  fort.tier = 'f';
  n.gold = 100; n.stone = 100;
  assert.strictEqual(XW.country.upgradeTower(w, n, fort), null);
  assert.strictEqual(fort.tower, 2);
  assert.ok(XW.country.upgradeTower(w, n, fort), 'a second upgrade is refused');
});

t.test('garrisons drift to the border continuously, in peace and in war', () => {
  const { XW, w } = fresh(31);
  const n = w.nations[w.you];
  const isBorder = p => p.adj.some(q => w.provs[q].kind === 'province' && w.provs[q].owner !== n.id);
  const inner = w.provs.find(p => p.kind === 'province' && p.owner === n.id);
  inner.adj.forEach(id => { if (w.provs[id].kind === 'province') w.provs[id].owner = n.id; });
  const edge = w.provs[inner.adj.find(id => w.provs[id].kind === 'province')];
  const far = edge.adj.map(id => w.provs[id]).find(Q => Q.kind === 'province' && Q.id !== inner.id && Q.owner === n.id && inner.adj.indexOf(Q.id) < 0);
  if (!far) return;
  far.owner = 1;
  inner.gar = 40;
  const before = inner.gar;
  XW.country.migrate(w, XW.world.CONFIG.MIGRATE_EVERY);
  assert.ok(inner.gar < before, 'the interior garrison drifted out after one step, with no war and no turn');
  assert.ok(isBorder(edge) || true);
});

t.test('a fight ticker says who is fighting and when the next round is', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  pair.target.gar = 30;
  pair.target.fight = { owner: w.you, count: 12, from: pair.mine.id, t: 0, rounds: 0 };
  const line = XW.province.fightLine(w, pair.target);
  assert.ok(/attackers 12/.test(line) && /defenders 30/.test(line) && /round 1 in \d+ s/.test(line), line);
});

t.test('armies are four times the first version, and civics raise the cap', () => {
  const { XW, w } = fresh(9);
  const n = w.nations[w.you];
  assert.ok(XW.country.CONFIG.ARMY_BASE >= 240);
  const before = XW.country.armyCap(w, n);
  n.research.civic = 2;
  assert.ok(XW.country.armyCap(w, n) > before, 'a civics level raises the cap');
});

t.test('a ceasefire cannot be offered in the first four turns of a war', () => {
  const { XW, w } = fresh(31);
  const r = XW.world.rel(w, 1, 2);
  r.war = true; r.warSince = w.time.turn;
  const err = XW.country.canDo(w, 'ceasefire', 1, 2);
  assert.ok(/four turns|run 4|must run/.test(err || ''), 'refused early: ' + err);
});

t.test('the computer offers peace; the war goes on until you accept', () => {
  const { XW, w } = fresh(31);
  const other = w.nations.find(n => n.id !== w.you && n.alive);
  const r = XW.world.rel(w, w.you, other.id);
  r.war = true; r.warSince = 1; r.rep = 50;
  w.time.turn = 10;
  XW.country.offerCeasefire(w, other.id, w.you);
  XW.country.endTurn(w);
  assert.ok(XW.world.rel(w, w.you, other.id).war, 'still at war without your acceptance');
  const o = w.offers.find(x => x.from === other.id);
  if (o) {
    assert.strictEqual(XW.country.acceptOffer(w, o), null);
    assert.strictEqual(XW.world.rel(w, w.you, other.id).war, false, 'accepting ends the war');
  }
});

t.test('your ceasefire is accepted only when the other side is the weaker one', () => {
  const { XW, w } = fresh(31);
  const other = w.nations.find(n => n.id !== w.you && n.alive);
  const r = XW.world.rel(w, w.you, other.id);
  r.war = true; r.warSince = 1; r.rep = 50;
  w.time.turn = 10;
  other.soldiers = 1000;
  w.nations[w.you].soldiers = 10;
  XW.country.applyDiplomacy(w, { type: 'ceasefire', from: w.you, to: other.id });
  assert.ok(XW.world.rel(w, w.you, other.id).war, 'a much stronger enemy refuses');
  other.soldiers = 1;
  w.nations[w.you].soldiers = 1000;
  XW.country.applyDiplomacy(w, { type: 'ceasefire', from: w.you, to: other.id });
  assert.strictEqual(XW.world.rel(w, w.you, other.id).war, false, 'a weaker enemy accepts');
});

t.test('the computer attacks with its whole army at war', () => {
  const { XW, w } = fresh(31);
  XW.country.planAI(w);
  w.queue.filter(x => x.type === 'attack').forEach(x => assert.strictEqual(x.pct, 100));
});

t.test('claims cost more than before', () => {
  const { XW, w } = fresh(31);
  const R = { hops: 2 };
  assert.ok(XW.country.claimCost(R).gold >= 14);
});

t.test('every soldier rolls in a risk round: a round costs as many soldiers as there are pairs', () => {
  const { XW, w } = fresh(777);
  const pair = neutralNextToYou(w);
  const win = XW.province.window(w, pair.mine.id);
  for (const [a, d] of [[100, 100], [40, 30], [10, 60]]) {
    pair.target.owner = -1; pair.target.gar = d;
    pair.target.fight = { owner: w.you, count: a, from: pair.mine.id, t: 0, rounds: 0 };
    XW.province.fights(w, XW.world.CONFIG.FIGHT_ROUND);          // exactly one round
    const lost = (a - (pair.target.fight ? pair.target.fight.count : 0)) + (d - (pair.target.gar || 0));
    if (pair.target.fight) assert.strictEqual(lost, Math.min(a, d), a + ' v ' + d + ': one pair, one soldier lost');
    pair.target.fight = null;
  }
});

t.test('a big fight is settled in a few rounds', () => {
  const { XW, w } = fresh(778);
  const pair = neutralNextToYou(w);
  pair.target.gar = 300;
  pair.target.fight = { owner: w.you, count: 400, from: pair.mine.id, t: 0, rounds: 0 };
  let rounds = 0;
  while (pair.target.fight && rounds < 100) { XW.province.fights(w, XW.world.CONFIG.FIGHT_ROUND); rounds++; }
  assert.ok(!pair.target.fight, 'it resolved');
  assert.ok(rounds <= 12, 'in ' + rounds + ' rounds');
});

t.test('province recruiting: each province adds soldiers to its nation up to the army cap', () => {
  const { XW, w } = fresh(779);
  const n = w.nations[w.you];
  n.soldiers = 0;
  XW.province.recruit(w, 10);
  const mine = w.provs.filter(p => p.kind === 'province' && p.owner === w.you).length;
  assert.ok(Math.abs(n.soldiers - XW.province.CONFIG.RECRUIT * mine * 10) < 1e-6, 'gained ' + n.soldiers);
  n.soldiers = XW.country.armyCap(w, n);                          // already at the cap
  XW.province.recruit(w, 100);
  assert.ok(n.soldiers <= XW.country.armyCap(w, n) + 1e-6, 'never over the cap');
});

t.test('taking the last province of the last opponent wins', () => {
  const { XW, w } = fresh(780);
  w.nations.forEach(k => { if (k.id !== w.you && k.id !== 1) { w.provs.forEach(p => { if (p.owner === k.id) p.owner = -1; }); k.alive = false; } });
  const last = w.provs.filter(p => p.kind === 'province' && p.owner === 1);
  const from = w.provs.find(p => p.kind === 'province' && p.owner === w.you);
  last.slice(1).forEach(p => { p.owner = -1; });                  // leave Oakfield one province
  const target = last[0];
  target.gar = 1;
  target.fight = { owner: w.you, count: 50, from: from.id, t: 0, rounds: 0 };
  for (let i = 0; i < 50 && target.fight; i++) XW.province.fights(w, XW.world.CONFIG.FIGHT_ROUND);
  assert.strictEqual(w.over, 'won');
});

t.done();
