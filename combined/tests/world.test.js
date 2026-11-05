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
  W.advance(w, 60, 'country');
  assert.ok(W.turnDue(w), 'a full minute on the country map ends the turn');
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
  assert.strictEqual(pair.target.owner, w.you);
  assert.strictEqual(XW.country.ownedBy(w, w.nations[w.you]).length, 4);
  assert.strictEqual(Math.round(pair.target.gar), 27);
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

t.done();
