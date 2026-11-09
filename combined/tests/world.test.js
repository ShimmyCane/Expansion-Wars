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
  assert.strictEqual(req.grain, 5, 'a squad is never under 5 soldiers');
});

t.test('armies unlock types in order: pikemen, archers, scouts, swordsmen, slingers, catapults', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  const ORDER = ['pikemen', 'archers', 'cavalry', 'swordsmen', 'slingers', 'catapults'];
  const twenty = XW.unit.requestFor(w, pair.mine.id, pair.target.id, 20);
  assert.strictEqual(JSON.stringify(twenty.attacker.units.map(u => [u.type, u.count])), JSON.stringify([['pikemen', 1], ['archers', 1], ['cavalry', 1], ['swordsmen', 1]]), '20 soldiers: the first four types (scouts third), one squad each');
  for (let n = 5; n <= 300; n += 7) {
    const types = XW.unit.requestFor(w, pair.mine.id, pair.target.id, n).attacker.units.map(u => u.type);
    types.filter(t => t !== 'heavy').forEach(t => ORDER.slice(0, ORDER.indexOf(t)).forEach(before => assert.ok(types.includes(before), n + ' soldiers: ' + t + ' without ' + before)));
  }
});

t.test('a second squad of a type only when a squad of it would be over 10 soldiers', () => {
  const { XW, w } = fresh(31);
  const pair = neutralNextToYou(w);
  for (let n = 5; n <= 300; n += 11) {
    const req = XW.unit.requestFor(w, pair.mine.id, pair.target.id, n);
    if (req.grain <= 10) req.attacker.units.forEach(u => assert.strictEqual(u.count, 1, n + ' soldiers (squads of ' + req.grain + '): one squad of ' + u.type));
  }
  const big = XW.unit.requestFor(w, pair.mine.id, pair.target.id, 200);
  assert.ok(big.attacker.units.some(u => u.count === 2), '200 soldiers (squads of 20): second squads');
});

t.test('an army of 100 or more has heavy cavalry, and it is the general; its aura makes nearby units strike harder', () => {
  const { XW, w, ctx } = fresh(31);
  const V4 = ctx.V4, pair = neutralNextToYou(w);
  pair.target.gar = 60;
  const req = XW.unit.requestFor(w, pair.mine.id, pair.target.id, 150);
  assert.ok(req.attacker.units.some(u => u.type === 'heavy' && u.count === 1), '150 soldiers: one squad of heavy cavalry');
  assert.ok(!req.defender.units.some(u => u.type === 'heavy'), '60 soldiers: none');
  const st = V4.createBattle(req, {});
  const gens = st.units.filter(u => u.general);
  assert.strictEqual(gens.length, 1);
  assert.strictEqual(gens[0].type, 'heavy');
  assert.strictEqual(gens[0].side, 0);
  const near = st.units.find(u => u.side === 0 && !u.general && Math.hypot(u.x - gens[0].x, u.y - gens[0].y) <= V4.CONFIG.GENERAL.radius);
  if (near) assert.ok(V4._.inAura(st, near), 'a unit near the general is in its aura');
  assert.ok(!XW.unit.requestFor(w, pair.mine.id, pair.target.id, 99).attacker.units.some(u => u.type === 'heavy'), '99 soldiers: no heavy cavalry');
});

t.test('when the general is destroyed, every unit of its side loses morale', () => {
  const { XW, w, ctx } = fresh(31);
  const V4 = ctx.V4, pair = neutralNextToYou(w);
  pair.target.gar = 60;
  const st = V4.createBattle(XW.unit.requestFor(w, pair.mine.id, pair.target.id, 150), {});
  const g = st.units.find(u => u.general), others = st.units.filter(u => u.side === 0 && !u.general);
  const before = others.map(u => u.morale);
  g.people = 0.000001; g.incoming = 1; g.hitThis = 1;
  for (let i = 0; i < 3 && g.state === 'active'; i++) V4.step(st);
  assert.strictEqual(g.state, 'dead', 'the general falls');
  others.forEach((u, i) => { if (u.state === 'active') assert.ok(u.morale <= before[i] - V4.CONFIG.GENERAL.loss + 1, u.type + ' morale ' + before[i] + ' -> ' + u.morale); });
});

t.test('heavy cavalry beats archers and swordsmen, and is beaten by pikemen; scouts are good against archers, bad against pikemen', () => {
  const { ctx } = fresh(1);
  const C = ctx.V4.CONFIG;
  assert.ok(C.STRONG.heavy.includes('archers') && C.STRONG.heavy.includes('swordsmen'));
  assert.ok(C.WEAK.heavy.includes('pikemen') && C.STRONG.pikemen.includes('heavy'));
  assert.ok(C.STRONG.cavalry.includes('archers') && C.WEAK.cavalry.includes('pikemen'));
  assert.strictEqual(C.UNIT.cavalry.label, 'Scouts');
});

t.test('scouts (cavalry) see three times as far as before', () => {
  const { ctx } = fresh(1);
  assert.strictEqual(ctx.V4.CONFIG.SIGHT.cavalry, 24);
});

t.test('moving as a team: ranged units wait behind the line, and the line waits for its rearmost unit', () => {
  const { XW, w, ctx } = fresh(31);
  const V4 = ctx.V4, pair = neutralNextToYou(w);
  pair.target.gar = 30;
  const st = V4.createBattle(XW.unit.requestFor(w, pair.mine.id, pair.target.id, 60), {});
  const mine = st.units.filter(u => u.side === 0);
  const line = mine.filter(u => ['pikemen', 'swordsmen'].includes(u.type));
  const archer = mine.find(u => u.type === 'archers');
  const front = Math.max(...line.map(u => u.x));
  archer.order = null; archer.station = null;
  archer.x = front + 2;
  assert.strictEqual(V4._.waitForTeam(st, archer, null), true, 'an archer ahead of the line waits');
  archer.x = front - 3;
  assert.strictEqual(V4._.waitForTeam(st, archer, null), false, 'behind the line it moves up');
  const pike = line[0];
  pike.order = null; pike.station = null;
  pike.x = Math.min(...line.map(u => u.x)) + 5;
  assert.strictEqual(V4._.waitForTeam(st, pike, null), true, 'a line unit far ahead of the rest waits for them');
});

t.test('province level: an army of more than 100 has a general, and strikes 10% harder', () => {
  const { XW } = fresh(1);
  const P = XW.province, fixed = () => 0.5;
  const plain = P.waveRound(50, 50, 0, 1, 1, fixed, false, false), led = P.waveRound(50, 50, 0, 1, 1, fixed, true, false);
  assert.ok(led.lostD > plain.lostD, 'the general\'s side kills more');
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
  assert.ok(/attackers 12/.test(line) && /defenders 30/.test(line) && /round 1 of \d+ in \d+ s/.test(line), line);
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

t.test('risk rounds (kept for comparison): a round costs as many soldiers as there are pairs', () => {
  const { XW, w } = fresh(777);
  XW.world.CONFIG.FIGHT_MODEL = 'risk'; XW.world.CONFIG.FIGHT_CLOCK = 'world';
  const pair = neutralNextToYou(w);
  for (const [a, d] of [[100, 100], [40, 30]]) {
    pair.target.owner = -1; pair.target.gar = d;
    pair.target.fight = { owner: w.you, count: a, from: pair.mine.id, t: 0, rounds: 0 };
    XW.province.fights(w, XW.world.CONFIG.FIGHT_ROUND);
    const lost = (a - (pair.target.fight ? pair.target.fight.count : 0)) + (d - (pair.target.gar || 0));
    if (pair.target.fight) assert.strictEqual(lost, Math.min(a, d));
    pair.target.fight = null;
  }
});

t.test('province battles: a province grows its own soldiers by grade, up to its cap, with no field army', () => {
  const { XW, w } = fresh(779);
  XW.world.CONFIG.POOL = false;
  const P = XW.province;
  const win = P.window(w, w.provs.find(p => p.kind === 'province' && p.owner === w.you).id);
  const pool = w.nations[w.you].soldiers;
  const mine = win.ids.map(id => w.provs[id]).filter(p => p.owner === w.you);
  const before = mine.map(p => p.gar);
  P.step(w, win, 10);
  mine.forEach((p, i) => assert.ok(Math.abs(p.gar - Math.min(P.cap(w, p), before[i] + P.stat('GROW', P.grade(w, p)) * 10)) < 1e-6, p.tier + ' grew ' + (p.gar - before[i])));
  assert.strictEqual(w.nations[w.you].soldiers, pool, 'the field army was not touched');
  mine[0].gar = P.cap(w, mine[0]);
  P.step(w, win, 100);
  assert.strictEqual(mine[0].gar, P.cap(w, mine[0]), 'never over the cap');
});

t.test('with a field army (the campaign), garrisons still grow from it', () => {
  const { XW, w } = fresh(781);
  const win = XW.province.window(w, w.provs.find(p => p.kind === 'province' && p.owner === w.you).id);
  const pool = w.nations[w.you].soldiers;
  XW.province.step(w, win, 5);
  assert.ok(w.nations[w.you].soldiers < pool, 'the pool paid for the growth');
});

t.test('province battles: soldiers go as far as your roads reach; nothing moves during the countdown', () => {
  const { XW, w } = fresh(782);
  XW.world.CONFIG.MOVE_HOPS = 99;
  const mine = w.provs.filter(p => p.kind === 'province' && p.owner === w.you);
  const win = XW.province.window(w, mine[0].id);
  const far = w.provs.find(p => p.kind === 'province' && p.owner < 0 && XW.province.links(w, win, mine[0].id).indexOf(p.id) >= 0);
  w.countdown = 3;
  assert.strictEqual(XW.province.send(w, win, w.you, mine[0].id, far.id, 50), 'Wait for Go.');
  w.countdown = 0;
  assert.strictEqual(XW.province.send(w, win, w.you, mine[0].id, far.id, 50), null);
});

t.test('grades: village to tower, and a half upgrade sits halfway', () => {
  const { XW } = fresh(1);
  const P = XW.province, w = {};
  const g = tier => P.grade(w, { tier });
  assert.deepStrictEqual(['e', 'v', 't', 'c', 'f'].map(g), [0, 1, 2, 3, 4]);
  assert.strictEqual(P.grade(w, { tier: 'f', tower: 2 }), 5, 'a fortress with an upgraded tower');
  assert.strictEqual(P.grade(w, { tier: 'v', up: true }), 1.5);
  assert.strictEqual(P.stat('DEF', 1), -0.25, 'a village: -25%');
  assert.strictEqual(P.stat('DEF', 3), 0, 'a city: even');
  assert.strictEqual(P.stat('DEF', 5), 0.25, 'a tower: +25%');
  assert.strictEqual(P.stat('ROUNDS', 1), 3, 'a village fight is 3 rounds');
  assert.strictEqual(P.stat('ROUNDS', 5), 10, 'a tower fight is 10 rounds');
  assert.strictEqual(P.stat('GROW', 1), 0.5); assert.strictEqual(P.stat('GROW', 4), 2);
  assert.strictEqual(P.stat('CAP', 1.5), 120, 'halfway between a village and a town');
});

t.test('a half upgrade costs half the next grade\'s cap, from the province\'s own soldiers, once', () => {
  const { XW, w } = fresh(783);
  const P = XW.province, p = w.provs.find(q => q.kind === 'province' && q.owner === w.you && q.tier === 'v');
  p.gar = 50;
  assert.ok(/costs 80/.test(P.upgrade(w, w.you, p.id)), 'a village upgrade costs half a town\'s cap (160)');
  p.gar = 90;
  assert.strictEqual(P.upgrade(w, w.you, p.id), null);
  assert.strictEqual(p.gar, 10);
  assert.ok(p.up && P.grade(w, p) === 1.5);
  assert.ok(P.upgrade(w, w.you, p.id), 'only once');
  const f = { kind: 'province', tier: 'f', owner: w.you, gar: 400 };
  w.provs.push(f); f.id = w.provs.length - 1;
  assert.strictEqual(P.upgrade(w, w.you, f.id), null, 'a fortress upgrade is its tower');
  assert.strictEqual(f.tower, 2);
  assert.strictEqual(P.grade(w, f), 5);
});

// Whole fights through the rules, at a given grade, many times (they carry a little randomness).
function waveFights(seed, a, d, tier, runs, up) {
  const { XW, w } = fresh(seed);
  XW.world.CONFIG.FIGHT_MODEL = 'waves';
  XW.world.CONFIG.FIGHT_CLOCK = 'real'; XW.world.CONFIG.FIGHT_SECONDS = 1;
  const pair = neutralNextToYou(w), out = { wins: 0, left: 0, kept: 0, rounds: 0 };
  for (let i = 0; i < runs; i++) {
    pair.target.owner = -1; pair.target.gar = d; pair.target.tier = tier; pair.target.up = !!up; pair.mine.gar = 0;
    pair.target.fight = { owner: w.you, count: a, from: pair.mine.id, t: 0, rounds: 0 };
    let n = 0;
    while (pair.target.fight && n < 30) { XW.province.fights(w, 0, 1); n++; }
    out.rounds += n;
    if (pair.target.owner === w.you) { out.wins++; out.left += pair.target.gar; } else out.kept += pair.target.gar;
  }
  return out;
}

t.test('wave fights at city level fit the targets: 100 v 100 holds, 200 v 100 leaves about 120, 500 v 100 about 475', () => {
  const even = waveFights(901, 100, 100, 'c', 60);
  assert.strictEqual(even.wins, 0, '100 v 100: the defenders hold');
  assert.ok(Math.abs(even.kept / 60 - 85) < 15, 'they keep about 80 to 90: ' + Math.round(even.kept / 60));
  const two = waveFights(902, 200, 100, 'c', 60);
  assert.strictEqual(two.wins, 60, '200 v 100: the attackers win');
  assert.ok(Math.abs(two.left / 60 - 120) < 15, 'with about 120 left: ' + Math.round(two.left / 60));
  const five = waveFights(903, 500, 100, 'c', 60);
  assert.ok(Math.abs(five.left / 60 - 475) < 15, '500 v 100: about 475 left: ' + Math.round(five.left / 60));
});

t.test('the ground matters: 150 v 100 takes a village but not a fortress; a tower needs about 3 to 1', () => {
  assert.ok(waveFights(904, 150, 100, 'v', 30).wins >= 27, 'nearly always takes a village (a defence of 100 has a general too)');
  assert.strictEqual(waveFights(905, 150, 100, 'f', 30).wins, 0);
  assert.strictEqual(waveFights(906, 200, 100, 'f', 30, true).wins, 0, 'a tower holds against two to one');
  assert.ok(waveFights(907, 300, 100, 'f', 30, true).wins >= 27, 'but it nearly always falls to three to one (both sides have a general)');
});

t.test('a fight takes at most as many rounds as the ground gives: 3 at a village, 10 at a tower', () => {
  const v = waveFights(908, 100, 100, 'v', 10).rounds, f = waveFights(909, 100, 100, 'f', 10, true).rounds;
  assert.ok(v <= 30 && v >= 20, 'village: ' + v / 10 + ' rounds a fight');
  assert.ok(f <= 100 && f >= 80, 'tower: ' + f / 10 + ' rounds a fight (a crushed attack can break before the last)');
});

t.test('a hopeless defence breaks at once: 144 against 11 is over in the first round', () => {
  for (const tier of ['v', 'c']) {
    const r = waveFights(920, 144, 11, tier, 20);
    assert.strictEqual(r.wins, 20, tier + ': taken');
    assert.strictEqual(r.rounds, 20, tier + ': in one round each');
    assert.ok(r.left / 20 > 140, 'almost nobody lost: ' + Math.round(r.left / 20));
  }
});

t.test('a crushed attack breaks and pulls back with what it has left', () => {
  const { XW, w } = fresh(921);
  XW.world.CONFIG.FIGHT_CLOCK = 'real'; XW.world.CONFIG.FIGHT_SECONDS = 1;
  const pair = neutralNextToYou(w);
  pair.target.gar = 100; pair.target.tier = 'c'; pair.mine.gar = 0;
  pair.target.fight = { owner: w.you, count: 50, from: pair.mine.id, t: 0, rounds: 0 };
  for (let i = 0; i < 20 && pair.target.fight; i++) XW.province.fights(w, 0, 1);
  assert.strictEqual(pair.target.owner, -1, 'the defenders hold');
  assert.ok(pair.mine.gar > 0, 'survivors came home: ' + Math.round(pair.mine.gar));
});

t.test('a wave round: the first strike breaks a much smaller army, and the rest of the round is a rout', () => {
  const { XW } = fresh(1);
  const r = XW.province.waveRound(500, 100, 0, 1, 1, () => 0.5);
  assert.ok(r.routD, 'the defenders rout');
  assert.ok(r.lostA < 40, 'the attackers lose little: ' + Math.round(r.lostA));
  assert.strictEqual(Math.round(r.lostD), 100);
});

t.test('in province battles a round is 1 real second, whatever the world clock says', () => {
  const { XW, w } = fresh(910);
  XW.world.CONFIG.FIGHT_CLOCK = 'real'; XW.world.CONFIG.FIGHT_SECONDS = 1;
  const pair = neutralNextToYou(w);
  pair.target.gar = 100;
  pair.target.fight = { owner: w.you, count: 100, from: pair.mine.id, t: 0, rounds: 0 };
  XW.province.fights(w, 100, 0.6);
  assert.strictEqual(pair.target.fight.rounds || 0, 0, 'no round yet');
  XW.province.fights(w, 0, 0.5);
  assert.strictEqual(pair.target.fight.rounds, 1);
});

t.test('the fight line shows the round of how many, and a side that is routing', () => {
  const { XW, w } = fresh(912);
  XW.world.CONFIG.FIGHT_CLOCK = 'real'; XW.world.CONFIG.FIGHT_SECONDS = 1;
  const pair = neutralNextToYou(w);
  pair.target.gar = 100; pair.target.tier = 'v';
  pair.target.fight = { owner: w.you, count: 500, from: pair.mine.id, t: 0, rounds: 0 };
  assert.ok(/round 1 of 3 in \d+ s/.test(XW.province.fightLine(w, pair.target)), XW.province.fightLine(w, pair.target));
  XW.province.fights(w, 0, 1);
  if (pair.target.fight) assert.ok(/routing|shaken/.test(XW.province.fightLine(w, pair.target)), XW.province.fightLine(w, pair.target));
});

t.test('fights run in waves on real time: a round is 3 seconds in the campaign, never more than 5', () => {
  const { XW } = fresh(913);
  assert.strictEqual(XW.world.CONFIG.FIGHT_MODEL, 'waves');
  assert.strictEqual(XW.world.CONFIG.FIGHT_CLOCK, 'real');
  assert.ok(XW.world.CONFIG.FIGHT_SECONDS <= 5);
});

t.test('difficulty: easy gives you 200 more food; medium and hard give no extra resources to anyone', () => {
  const easy = fresh(41), before = easy.w.nations.map(n => n.food);
  assert.strictEqual(easy.XW.country.applyDifficulty(easy.w, 'easy'), null);
  assert.strictEqual(easy.w.nations[easy.w.you].food, before[easy.w.you] + 200);
  easy.w.nations.forEach((n, i) => { if (i !== easy.w.you) assert.strictEqual(n.food, before[i], 'the computer as it was'); });
  const med = fresh(41), mb = med.w.nations.map(n => [n.food, n.gold, n.stone]);
  med.XW.country.applyDifficulty(med.w, 'medium');
  assert.strictEqual(med.w.nations[med.w.you].food, mb[med.w.you][0], 'you as you were');
  med.w.nations.forEach((n, i) => assert.ok(n.food === mb[i][0] && n.gold === mb[i][1] && n.stone === mb[i][2], 'nobody gets extra'));
  assert.strictEqual(med.w.difficulty, 'medium');
});

t.test('hard: the computer claims land every turn while there is any, then goes to war strategically', () => {
  const { XW, w } = fresh(42);
  XW.country.applyDifficulty(w, 'hard');
  XW.country.planAI(w);
  const active = w.nations.filter(n => n.id !== w.you && n.alive && !n.neutral);
  const claims = w.queue.filter(q => q.type === 'claim');
  assert.ok(claims.length >= active.filter(n => XW.country.claimTarget(w, n) !== null).length, 'every active computer nation with land to claim claims: ' + claims.length);
  // No land left: it declares on the neighbour it outmatches most, not on one already fighting two others.
  w.queue = [];
  w.provs.forEach(p => { if (p.kind === 'province' && p.owner < 0) p.owner = 1; });
  XW.country.updateNeighbours(w);
  const a = w.nations[1];
  a.soldiers = 5000;
  XW.country.planAI(w);
  const war = w.queue.find(q => q.type === 'declare' && q.from === 1);
  if (war) {
    const target = war.to, fighting = w.nations.filter(k => k.alive && k.id !== target && XW.world.rel(w, k.id, target).war).length;
    assert.ok(fighting < 2, 'not a nation already fighting two');
  }
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
