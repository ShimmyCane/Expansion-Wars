// Expansion Wars — the game modes (campaign, unit battles, province battles, country battles). Run with: node tests/modes.test.js
'use strict';
const assert = require('assert');
const { load, runner, RULES } = require('./load');

const t = runner('Modes');
const FILES = RULES.concat(['app/modes']);

// A fresh sandbox per mode: the mode is chosen at load, as the page does from its address.
function inMode(id) {
  const ctx = load(FILES);
  const XW = ctx.XW;
  XW.app.useMode(id);
  return { ctx, XW };
}

t.test('the address picks the mode, and anything else is the campaign', () => {
  const { XW } = inMode('campaign');
  assert.strictEqual(XW.app.modeFor('').id, 'campaign');
  assert.strictEqual(XW.app.modeFor('?mode=unit').id, 'unit');
  assert.strictEqual(XW.app.modeFor('?x=1&mode=province').id, 'province');
  assert.strictEqual(XW.app.modeFor('?mode=country').id, 'country');
  assert.strictEqual(XW.app.modeFor('?mode=nonsense').id, 'campaign');
});

t.test('each mode has its own save and database tag; the campaign keeps its old save', () => {
  const keys = ['campaign', 'unit', 'province', 'country'].map(id => inMode(id).XW.world.CONFIG.SAVE_KEY);
  assert.strictEqual(new Set(keys).size, 4);
  assert.strictEqual(keys[0], 'xw-combined-world');
  const apps = ['campaign', 'unit', 'province', 'country'].map(id => { const { XW } = inMode(id); return XW.world.CONFIG.APP; });
  assert.strictEqual(new Set(apps).size, 4);
});

t.test('the campaign shows all three scales; each battle mode shows one', () => {
  assert.strictEqual(JSON.stringify(inMode('campaign').XW.app.mode.scales), JSON.stringify(['country', 'province', 'unit']));
  assert.strictEqual(JSON.stringify(inMode('unit').XW.app.mode.scales), JSON.stringify(['unit']));
  assert.strictEqual(JSON.stringify(inMode('province').XW.app.mode.scales), JSON.stringify(['province']));
  assert.strictEqual(JSON.stringify(inMode('country').XW.app.mode.scales), JSON.stringify(['country']));
  const { XW } = inMode('unit');
  assert.strictEqual(XW.app.can('country'), false);
  assert.strictEqual(XW.app.can('unit'), true);
});

t.test('only the campaign and country battles have country turns', () => {
  for (const id of ['unit', 'province']) {
    const { XW } = inMode(id);
    const w = XW.country.newWorld(4321);
    w.time.t = w.time.turn * XW.world.CONFIG.TURN + 5;   // past the end of the turn
    assert.strictEqual(XW.world.turnDue(w), false, id + ' has no turns');
  }
  for (const id of ['campaign', 'country']) {
    const { XW } = inMode(id);
    const w = XW.country.newWorld(4321);
    w.time.t = w.time.turn * XW.world.CONFIG.TURN + 5;
    assert.strictEqual(XW.world.turnDue(w), true, id + ' has turns');
  }
});

t.test('a unit battle mode world starts with a battle between two neighbours', () => {
  const { XW } = inMode('unit');
  const w = XW.app.modes.fresh(777);
  assert.strictEqual(w.view.scale, 'unit');
  assert.ok(w.battle, 'there is a battle');
  const from = w.provs[w.battle.from], to = w.provs[w.battle.to];
  assert.strictEqual(from.owner, w.you);
  assert.notStrictEqual(to.owner, w.you);
  assert.ok(from.adj.indexOf(to.id) >= 0, 'the two provinces are neighbours');
  assert.ok(XW.unit.rebuild(w), 'the battle can be rebuilt for the screen');
});

t.test('a unit battle plays to its end and the result goes into the world', () => {
  const { XW } = inMode('unit');
  const w = XW.app.modes.fresh(777);
  const st = XW.unit.rebuild(w);
  const r = XW.unit.finishAuto(st);
  XW.unit.apply(w, r);
  assert.strictEqual(w.battle, null);
  assert.strictEqual(w.battles.length, 1);
  assert.ok(r.winner === 'attacker' || r.winner === 'defender');
});

t.test('a unit battle mode with no battle saved gets a new one', () => {
  const { XW } = inMode('unit');
  const w = XW.app.modes.fresh(777);
  w.battle = null;
  const fixed = XW.app.modes.ensure(w);
  assert.ok(fixed.battle, 'a battle is made');
  assert.strictEqual(fixed.view.scale, 'unit');
});

t.test('a province battle mode world starts on one of your provinces, with no country scale', () => {
  const { XW } = inMode('province');
  const w = XW.app.modes.fresh(777);
  assert.strictEqual(w.view.scale, 'province');
  const p = w.provs[w.view.prov];
  assert.strictEqual(p.kind, 'province');
  assert.strictEqual(p.owner, w.you);
});

t.test('a country battle mode world starts on the country scale', () => {
  const { XW } = inMode('country');
  const w = XW.app.modes.fresh(777);
  assert.strictEqual(w.view.scale, 'country');
  assert.strictEqual(w.battle, null);
});

t.test('a save from a scale the mode does not show is brought back to the mode', () => {
  const { XW } = inMode('country');
  const w = XW.country.newWorld(99);
  w.view.scale = 'unit';
  XW.app.modes.ensure(w);
  assert.strictEqual(w.view.scale, 'country');
});

t.test('province battles start small and grow: more provinces and opponents each level', () => {
  const { XW } = inMode('province');
  let lastProvs = 0, lastNations = 0;
  for (let n = 1; n <= 8; n++) {
    const w = XW.app.modes.fresh(900 + n, n);
    const provs = w.provs.filter(p => p.kind === 'province').length;
    assert.strictEqual(w.level, n);
    assert.ok(provs >= lastProvs, 'level ' + n + ' has at least as many provinces (' + provs + ')');
    assert.ok(w.nations.length >= lastNations, 'level ' + n + ' has at least as many nations');
    lastProvs = provs; lastNations = w.nations.length;
    // Everyone is at war with everyone, except allies set by the level; none is left out of the window.
    w.nations.forEach(a => w.nations.forEach(b => {
      if (a.id >= b.id) return;
      const r = XW.world.rel(w, a.id, b.id);
      assert.ok(r.war !== r.ally, a.name + ' and ' + b.name + ' are either at war or allies');
    }));
    const win = XW.province.window(w, w.view.prov);
    w.provs.forEach(p => { if (p.kind === 'province' && p.owner >= 0) assert.ok(win.inside[p.id], 'province ' + p.id + ' is on the map'); });
  }
  assert.strictEqual(XW.app.modes.levelLine(XW.app.modes.fresh(1, 1)), 'Level 1 · 1 opponent · 5 provinces each');
});

t.test('team levels: you start with an ally, and everyone else is at war with everyone', () => {
  const { XW } = inMode('province');
  const w = XW.app.modes.fresh(77, 5);
  assert.ok(XW.world.rel(w, 0, 1).ally && !XW.world.rel(w, 0, 1).war, 'nation 1 is your ally');
  assert.ok(XW.world.rel(w, 2, 3).ally, 'the other two are a team');
  assert.ok(XW.world.rel(w, 0, 2).war && XW.world.rel(w, 1, 3).war, 'the teams are at war');
  const w1 = XW.app.modes.fresh(78, 3);
  assert.ok(XW.world.rel(w1, 1, 2).war, 'without teams, the computer players fight each other too');
});

t.test('you win when every opponent has fallen, even with your ally still standing', () => {
  const { XW } = inMode('province');
  const w = XW.app.modes.fresh(79, 5);
  [2, 3].forEach(id => { w.nations[id].alive = false; w.provs.forEach(p => { if (p.owner === id) p.owner = -1; }); });
  XW.country.checkWin(w);
  assert.strictEqual(w.over, 'won');
});

t.test('towns, cities and fortresses split into 2, 3 and 5 provinces; each part defends at the whole one\'s grade', () => {
  const { XW } = inMode('province');
  const P = XW.province;
  const w = XW.app.modes.fresh(80, 4);
  const groups = {};
  w.provs.forEach(p => { if (p.group !== undefined) (groups[p.group] = groups[p.group] || []).push(p); });
  const sizes = Object.keys(groups).map(g => [w.provs[g].tier, groups[g].length]);
  sizes.forEach(([tier, n]) => assert.ok(n <= P.CONFIG.SPLITS[tier] && n >= 2, tier + ' split into ' + n));
  assert.ok(sizes.some(([t]) => t === 'f'), 'level 4 has a fortress');
  const fort = w.provs.find(p => p.tier === 'f' && p.group === p.id);
  const part = groups[fort.id].find(p => p.id !== fort.id);
  assert.strictEqual(P.defGrade(w, part), 4, 'a part of a neutral fortress defends like the fortress');
  part.owner = w.you;                                                 // taken by you, but the fortress is not yours
  assert.strictEqual(P.defGrade(w, part), 1, 'whoever takes a part does not get the fortress\'s protection');
  groups[fort.id].forEach(p => { p.owner = w.you; });
  P.claimGroup(w, fort);
  assert.strictEqual(P.defGrade(w, part), 4, 'once all of it is yours, the protection is yours');
});

t.test('an upgraded tower in the middle of a split fortress reaches every part of it', () => {
  const { XW } = inMode('province');
  const P = XW.province;
  const w = XW.app.modes.fresh(81, 4);
  const fort = w.provs.find(p => p.tier === 'f' && p.group === p.id);
  fort.tower = 2;
  const r = P.towerRange(w, fort);
  w.provs.filter(p => p.group === fort.id).forEach(p => assert.ok(Math.hypot(p.x - fort.x, p.y - fort.y) < r, 'part ' + p.id + ' is in range'));
});

t.test('surrender: a side outnumbered 10 to 1 gives up, and its provinces go neutral with their soldiers', () => {
  const { XW } = inMode('province');
  const w = XW.app.modes.fresh(82, 1);
  w.provs.forEach(p => { if (p.owner === 1) p.gar = 5; if (p.owner === w.you) p.gar = 400; });
  const theirs = w.provs.filter(p => p.owner === 1).map(p => p.id);
  assert.deepStrictEqual(Array.from(XW.province.surrender(w)), [1]);
  theirs.forEach(id => { assert.strictEqual(w.provs[id].owner, -1); assert.strictEqual(w.provs[id].gar, 5); });
  assert.strictEqual(w.over, 'won', 'the last opponent gave up');
});

t.test('level 1 is a small start: you and one opponent, a couple of provinces each', () => {
  const { XW } = inMode('province');
  const w = XW.app.modes.fresh(31, 1);
  assert.strictEqual(w.nations.length, 2);
  // A village and a town, and the town is two provinces when zoomed in.
  assert.strictEqual(w.provs.filter(p => p.owner === w.you).length, 3);
  assert.strictEqual(w.provs.filter(p => p.owner === 1).length, 3);
});

t.test('reaching a level unlocks it, and the record is kept', () => {
  const { XW } = inMode('province');
  assert.strictEqual(XW.app.modes.unlocked(), 1);
  XW.app.modes.fresh(1, 3);
  assert.strictEqual(XW.app.modes.unlocked(), 3);
  XW.app.modes.fresh(1, 2);
  assert.strictEqual(XW.app.modes.unlocked(), 3, 'going back does not lose it');
});

t.test('a province battle save with no level is replaced by level 1', () => {
  const { XW } = inMode('province');
  const old = XW.country.newWorld(5);
  old.view.prov = old.provs.find(p => p.kind === 'province' && p.owner === old.you).id;
  const w = XW.app.modes.ensure(old);
  assert.strictEqual(w.level, 1);
});

t.test('the province window is the whole map in province battles, two steps in the campaign', () => {
  assert.strictEqual(inMode('province').XW.world.CONFIG.RINGS, 99);
  assert.strictEqual(inMode('campaign').XW.world.CONFIG.RINGS, 2);
});

t.test('every mode fights in waves; province battles on a real-time clock, the others on the world clock', () => {
  for (const id of ['campaign', 'country', 'unit', 'province']) assert.strictEqual(inMode(id).XW.world.CONFIG.FIGHT_MODEL, 'waves', id);
  assert.strictEqual(inMode('province').XW.world.CONFIG.FIGHT_CLOCK, 'real');
  assert.strictEqual(inMode('campaign').XW.world.CONFIG.FIGHT_CLOCK, 'world');
});

t.test('province battles play like the first draft: no field army, no move limit, a countdown at the start', () => {
  const pb = inMode('province').XW;
  assert.strictEqual(pb.world.CONFIG.POOL, false);
  assert.strictEqual(pb.world.CONFIG.MOVE_HOPS, 99);
  assert.strictEqual(pb.app.modes.fresh(5, 1).countdown, 3);
  const camp = inMode('campaign').XW;
  assert.strictEqual(camp.world.CONFIG.POOL, true);
  assert.strictEqual(camp.world.CONFIG.MOVE_HOPS, 3);
});

t.test('the version is 3.0 and shown with the mode', () => {
  const { XW } = inMode('unit');
  assert.strictEqual(XW.app.VERSION, '3.0');
  assert.strictEqual(XW.app.describeMode(), 'Expansion Wars 3.0 · Unit battles');
});

t.done();
