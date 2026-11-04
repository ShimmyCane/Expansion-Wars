// Expansion Wars — V4 simulation tests. Run with: node V4/tests/sim.test.js
// No build step and no test framework: plain asserts, exit code 1 on failure.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const jsDir = path.join(__dirname, '..', 'js');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
['config', 'field', 'sim', 'insignia', 'contract'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
});
const V4 = ctx.V4, C = V4.CONFIG, S = V4.sim;

// An empty field. A battle with no units ends at once (no army left), so the tests clear that and place their own units.
function blank(req) {
  const st = V4.createBattle(req, {});
  st.done = null;
  return st;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

test('same seed gives the same battle', () => {
  const req = V4.sampleRequest({ seed: 42 });
  assert.deepStrictEqual(V4.runAuto(req), V4.runAuto(req));
});

test('a sample fortress battle ends and reports the result shape', () => {
  const r = V4.runAuto(V4.sampleRequest({ seed: 7 }));
  assert.ok(['attacker', 'defender'].includes(r.winner), 'winner: ' + r.winner);
  assert.ok(['rout', 'objectives', 'time', 'surrender'].includes(r.how), 'how: ' + r.how);
  ['losses', 'survivors', 'pool'].forEach(k => assert.ok(r[k] && r[k].attacker && r[k].defender, k));
  assert.ok(r.seconds <= C.CAP.fortress, 'battle within the cap');
});

test('validation rejects an unknown unit type and strategy', () => {
  const req = V4.sampleRequest();
  req.attacker.units.push({ type: 'dragons', count: 1 });
  req.defender.units[0].strategy = 'charge-wildly';
  const problems = V4.validateRequest(req);
  assert.ok(problems.some(p => p.includes('dragons')), 'type');
  assert.ok(problems.some(p => p.includes('charge-wildly')), 'strategy');
});

test('a defender who holds the settlement at the start does not end the battle', () => {
  const st = V4.createBattle(V4.sampleRequest({ seed: 3, settlement: 'town', population: 0, attackerUnits: [{ type: 'pikemen', count: 1 }], defenderUnits: [{ type: 'pikemen', count: 1 }] }), {});
  assert.strictEqual(st.done, null, 'battle should still be running');
});

test('surrender when one side has under a twentieth of the other side\'s people', () => {
  // Village scale: one person a dot. 1 attacker against 25 defenders is 1 x 20 <= 25.
  const req = V4.sampleRequest({ seed: 5, scale: 'village', settlement: 'none', attackerUnits: [{ type: 'pikemen', count: 1 }], defenderUnits: [{ type: 'pikemen', count: 25 }] });
  const r = V4.runAuto(req);
  assert.strictEqual(r.winner, 'defender');
  assert.strictEqual(r.how, 'surrender');
});

test('a column in woods is ambushed when an enemy hides within three tiles', () => {
  const st = blank(V4.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  st.field.tiles[10 * C.COLS + 12] = 'w';   // woods at tile (12, 10)
  const col = S.newUnit(st, 0, 'pikemen', 'engage', 'column', 10, 10, 20);
  // Hidden in woods, the enemy is seen only within 2.5 tiles, so it stands 2.2 tiles away.
  S.newUnit(st, 1, 'pikemen', 'engage', 'line', 12.2, 10.5, 20);
  V4.step(st, 0.1);
  assert.strictEqual(col.ambushSeen, true);
  assert.ok(col.ambushT > 0, 'ambush penalty is running');
});

test('an Ambush unit holds in cover until an enemy comes near', () => {
  const st = blank(V4.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const waiting = S.newUnit(st, 0, 'swordsmen', 'ambush', 'line', 10, 10, 20);
  S.newUnit(st, 1, 'swordsmen', 'engage', 'line', 25, 10.5, 20);
  for (let i = 0; i < 20; i++) V4.step(st, 0.1);
  assert.strictEqual(waiting.x, 10, 'did not move toward a distant enemy');
});

test('a hold order keeps a unit still while the enemy is out of reach', () => {
  const st = blank(V4.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const u = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 5, 10, 20);
  S.newUnit(st, 1, 'pikemen', 'engage', 'line', 40, 10.5, 20);
  assert.strictEqual(V4.issue(st, { kind: 'hold', unit: u.id }), true);
  for (let i = 0; i < 20; i++) V4.step(st, 0.1);
  assert.strictEqual(u.x, 5);
});

test('proceed restores the original plan after a new command', () => {
  const st = blank(V4.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  S.newUnit(st, 0, 'cavalry', 'rush', 'column', 5, 10, 10);
  const u = st.units.find(x => x.side === 0);
  V4.issue(st, { kind: 'strategy', unit: u.id, value: 'kite' });
  V4.issue(st, { kind: 'formation', unit: u.id, value: 'scatter' });
  assert.strictEqual(u.strategy, 'kite');
  V4.issue(st, { kind: 'proceed', unit: u.id });
  assert.strictEqual(u.strategy, 'rush');
  assert.strictEqual(u.formation, 'column');
});

test('the bell raises levies at the start, one per 20 population', () => {
  const st = V4.createBattle(V4.sampleRequest({ seed: 4, settlement: 'town', population: 60, attackerUnits: [{ type: 'pikemen', count: 1 }], defenderUnits: [{ type: 'pikemen', count: 1 }] }), {});
  for (let i = 0; i < Math.ceil(21 / C.TICK) && !st.done; i++) V4.step(st);   // past the 20 second delay
  assert.ok(st.done || st.levies === 3, 'three levies for population 60 (or the battle already ended)');
});

test('a battle with no winner stops at the cap, and the defender wins on time', () => {
  const st = blank(V4.sampleRequest({ seed: 2, scale: 'village', settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const a = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 3, 10, 1);
  const d = S.newUnit(st, 1, 'pikemen', 'engage', 'line', 45, 10, 1);
  a.order = { kind: 'hold' };
  d.order = { kind: 'hold' };
  for (let i = 0; i < Math.ceil(C.CAP.village / C.TICK) + 5 && !st.done; i++) V4.step(st);
  assert.ok(st.done, 'battle ended');
  assert.strictEqual(st.done.how, 'time');
  assert.strictEqual(st.done.winner, 1);
});

test('replay: the same request and orders give the same battle', () => {
  const req = V4.sampleRequest({ seed: 21 });
  const st = V4.createBattle(req, {});
  const attacker = st.units.filter(u => u.side === 0);
  for (let i = 0; i < 4000 && !st.done; i++) {
    if (st.tick === 5) V4.issue(st, { kind: 'move', unit: attacker[0].id, x: 20, y: 12 });
    if (st.tick === 40) V4.issue(st, { kind: 'rush', unit: attacker[1].id, x: 30, y: 14 });
    if (st.tick === 90) V4.issue(st, { kind: 'strategy', unit: attacker[2].id, value: 'kite' });
    V4.step(st);
  }
  assert.ok(st.commands.length >= 3, 'orders were recorded');
  assert.deepStrictEqual(V4.replay(req, st.commands), V4.result(st));
});

test('fog: an ambusher in woods is hidden from the attacker until it is close', () => {
  const st = V4.createBattle(V4.sampleRequest({ seed: 8, defenderWoods: true, settlement: 'none', defenderUnits: [{ type: 'pikemen', count: 6 }] }), {});
  const amb = st.units.find(u => u.side === 1 && u.strategy === 'ambush');
  assert.ok(amb, 'the defender planned at least one ambush');
  assert.strictEqual(amb.hidden, true, 'it is hidden in woods');
  assert.ok(!st.seen[0][amb.id], 'the attacker cannot see it from far away');
});

test('rush move runs past an enemy without fighting it', () => {
  const st = blank(V4.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const runner = S.newUnit(st, 0, 'swordsmen', 'engage', 'line', 10, 10, 20);
  const target = S.newUnit(st, 1, 'pikemen', 'engage', 'line', 11.5, 10, 20);
  target.order = { kind: 'hold' };
  V4.issue(st, { kind: 'rush', unit: runner.id, x: 20, y: 10 });
  const before = target.people;
  for (let i = 0; i < 40; i++) V4.step(st);
  assert.strictEqual(target.people, before, 'the runner did not fight');
  assert.ok(runner.x > 11.5, 'and it went past');
});

test('attack move fights an enemy it meets on the way', () => {
  const st = blank(V4.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const mover = S.newUnit(st, 0, 'swordsmen', 'engage', 'line', 10, 10, 20);
  const target = S.newUnit(st, 1, 'pikemen', 'engage', 'line', 12, 10, 20);
  target.order = { kind: 'hold' };
  V4.issue(st, { kind: 'move', unit: mover.id, x: 20, y: 10 });
  for (let i = 0; i < 60; i++) V4.step(st);
  assert.ok(target.people < 20 || target.state !== 'active', 'the mover attacked the enemy on the way');
});

test('a routed unit rallies once its morale is back, with no enemy near', () => {
  const st = blank(V4.sampleRequest({ seed: 10, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const u = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 25, 10, 20);
  u.state = 'routing';
  u.morale = 10;
  // A second attacker, far away, keeps the attacking side in the battle while the first one runs.
  S.newUnit(st, 0, 'pikemen', 'engage', 'line', 3, 28, 20).order = { kind: 'hold' };
  S.newUnit(st, 1, 'pikemen', 'engage', 'line', 45, 10, 20).order = { kind: 'hold' };
  for (let i = 0; i < 2000 && u.state === 'routing'; i++) V4.step(st);
  assert.strictEqual(u.state, 'active', 'it rallied');
  assert.ok(u.morale >= C.MORALE.rallyAt, 'morale is back');
});

test('morale recovers slowly over time when nothing is in contact', () => {
  const st = blank(V4.sampleRequest({ seed: 10, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const u = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 25, 10, 20);
  u.morale = 50;
  for (let i = 0; i < Math.ceil(10 / C.TICK); i++) V4.step(st);
  assert.ok(u.morale > 50 && u.morale < 70, 'recovered some, not all: ' + u.morale.toFixed(1));
});

test('surrender counts reserves on their way, so a side with reinforcements queued does not give up', () => {
  const req = V4.sampleRequest({ seed: 12, scale: 'village', settlement: 'none', attackerUnits: [{ type: 'pikemen', count: 1 }], defenderUnits: [{ type: 'pikemen', count: 25 }] });
  req.attacker.reserve = [{ type: 'pikemen', count: 1 }];
  const st = V4.createBattle(req, {});
  assert.strictEqual(st.done, null, 'one on the field plus one on the way is 2 x 20 = 40, above 25');
});

test('pool accounting: what leaves home comes back as survivors', () => {
  const req = V4.sampleRequest({ seed: 11, attackerUnits: [{ type: 'swordsmen', count: 3 }], defenderUnits: [{ type: 'pikemen', count: 2 }] });
  req.attacker.pool = 200;
  const st = V4.createBattle(req, {});
  const deployed = st.units.filter(u => u.side === 0).reduce((n, u) => n + u.start, 0);
  for (let i = 0; i < 2000 && !st.done; i++) V4.step(st, 0.25);
  const r = V4.result(st);
  const survivingPeople = Object.values(r.survivors.attacker).reduce((a, b) => a + b, 0);
  assert.strictEqual(r.pool.attacker, Math.round(200 - deployed + survivingPeople));
});

// ---- Battlefield generator and the mechanics added in round 4 --------------

test('the large field is 2 x 2 screens, and the settlement is not at the far edge', () => {
  const st = V4.createBattle(V4.sampleRequest({ seed: 3, settlement: 'fortress', gen: { size: 'large', river: 'bridges', roads: true, grass: true } }), {});
  assert.strictEqual(st.cols, 100);
  assert.strictEqual(st.rows, 64);
  assert.ok(st.field.objectives[0].x < 0.75 * st.cols, 'settlement sits well inside the map');
});

test('a settlement has more than one opening, as set by the generator', () => {
  [2, 3, 4].forEach(n => {
    const st = V4.createBattle(V4.sampleRequest({ seed: 3, settlement: 'town', gen: { size: 'large', gates: n } }), {});
    const gates = st.field.tiles.filter(t => t === 'y').length;
    assert.strictEqual(gates, n, n + ' gates requested');
  });
});

test('bridges: deep river is impassable, so a crossing has to use a bridge', () => {
  const st = blank(V4.sampleRequest({ seed: 3, settlement: 'none', gen: { river: 'bridges' } }));
  const riverCol = Math.floor(st.cols / 2) - 1;
  const bridgeRows = [];
  for (let y = 0; y < st.rows; y++) if (st.field.tiles[y * st.cols + riverCol] === 'b') bridgeRows.push(y);
  assert.ok(bridgeRows.length > 0, 'the river has bridges');
  const u = S.newUnit(st, 0, 'swordsmen', 'engage', 'line', riverCol - 2, 0.5, 20);
  u.order = { kind: 'attackMove', x: riverCol + 4, y: 0.5 };
  let crossedAt = null;
  for (let i = 0; i < 400 && u.x < riverCol + 3; i++) {
    V4.step(st);
    if (crossedAt === null && u.x >= riverCol) crossedAt = Math.floor(u.y);   // the row it first reaches the river
  }
  assert.ok(u.x >= riverCol + 2, 'it got across');
  assert.ok(bridgeRows.includes(crossedAt), 'and it crossed on a bridge, at row ' + crossedAt);
});

test('a road is faster than open grass', () => {
  const st = blank(V4.sampleRequest({ seed: 3, settlement: 'none' }));
  st.field.tiles[10 * st.cols + 5] = 'd';
  st.field.tiles[20 * st.cols + 5] = 'g';
  const onRoad = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 5.5, 10.5, 20);
  const onGrass = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 5.5, 20.5, 20);
  onRoad.order = { kind: 'attackMove', x: 30, y: 10.5 };
  onGrass.order = { kind: 'attackMove', x: 30, y: 20.5 };
  for (let i = 0; i < 40; i++) V4.step(st);
  assert.ok(onRoad.x - 5.5 > onGrass.x - 5.5, 'the road unit got further');
});

test('fatigue: a long march tires a unit, and rest gives it back', () => {
  const st = blank(V4.sampleRequest({ seed: 3, settlement: 'none', gen: { fatigue: true } }));
  const u = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 3, 10, 20);
  u.order = { kind: 'attackMove', x: 40, y: 10.5 };
  for (let i = 0; i < 400; i++) V4.step(st);
  assert.ok(u.fat > 5, 'it is tired after marching: ' + u.fat.toFixed(1));
  u.order = null;
  const tired = u.fat;
  for (let i = 0; i < 200; i++) V4.step(st);
  assert.ok(u.fat < tired, 'resting lowers fatigue');
});

test('facing: a unit is hit hardest from behind, less from the side, least from the front', () => {
  // The target faces east (dir 0). Archers stand 3 tiles away: east of it (front), north (side), west (behind).
  const loss = (angle) => {
    const st = blank(V4.sampleRequest({ seed: 4, scale: 'fortress', settlement: 'none', gen: { facing: true, fatigue: false } }));
    const target = S.newUnit(st, 1, 'pikemen', 'engage', 'line', 20, 10, 20);
    target.dir = 0;
    target.order = { kind: 'hold' };
    const shooter = S.newUnit(st, 0, 'archers', 'engage', 'line', 20 + 3 * Math.cos(angle), 10 + 3 * Math.sin(angle), 20);
    shooter.order = { kind: 'hold' };
    const before = target.people;
    V4.step(st);
    return before - target.people;
  };
  const front = loss(0), side = loss(Math.PI / 2), rear = loss(Math.PI);
  assert.ok(front > 0 && side > 0 && rear > 0, 'all three hit: ' + front + ' ' + side + ' ' + rear);
  assert.ok(rear > side && side > front, 'rear > side > front: ' + rear.toFixed(3) + ' ' + side.toFixed(3) + ' ' + front.toFixed(3));
});

test('ambush: a hidden unit offers a strike when an enemy comes near, and does not strike on its own', () => {
  const st = blank(V4.sampleRequest({ seed: 5, settlement: 'none', gen: { ambush: 'prompt' } }));
  const waiting = S.newUnit(st, 0, 'swordsmen', 'ambush', 'line', 10, 10, 20);
  const enemy = S.newUnit(st, 1, 'pikemen', 'engage', 'line', 12.5, 10, 20);
  enemy.order = { kind: 'hold' };
  for (let i = 0; i < 10; i++) V4.step(st);
  assert.strictEqual(waiting.strikePrompt, true, 'the prompt is up');
  assert.strictEqual(enemy.people, 20, 'nothing was struck without the player');
  assert.strictEqual(V4.issue(st, { kind: 'strike', unit: waiting.id }), true, 'the strike is accepted');
  for (let i = 0; i < 2; i++) V4.step(st);
  assert.ok(enemy.people < 20, 'the strike burst hit the enemy');
});

test('a strike is refused when no enemy is close', () => {
  const st = blank(V4.sampleRequest({ seed: 5, settlement: 'none', gen: { ambush: 'prompt' } }));
  const waiting = S.newUnit(st, 0, 'swordsmen', 'ambush', 'line', 10, 10, 20);
  assert.strictEqual(V4.issue(st, { kind: 'strike', unit: waiting.id }), false);
});

test('approach: a unit with no order walks toward its approach point', () => {
  const st = blank(V4.sampleRequest({ seed: 5, settlement: 'none' }));
  const u = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 5, 10, 20);
  u.approach = { x: 30, y: 10 };
  for (let i = 0; i < 40; i++) V4.step(st);
  assert.ok(u.x > 5.5, 'it moved toward the approach point');
});

test('local odds: a cavalry unit outnumbered nearby falls back instead of charging', () => {
  const st = blank(V4.sampleRequest({ seed: 5, settlement: 'none' }));
  const horse = S.newUnit(st, 0, 'cavalry', 'engage', 'line', 10, 10, 10);
  S.newUnit(st, 1, 'pikemen', 'engage', 'line', 12.5, 10, 20).order = { kind: 'hold' };
  S.newUnit(st, 1, 'pikemen', 'engage', 'line', 12.5, 11, 20).order = { kind: 'hold' };
  S.newUnit(st, 1, 'swordsmen', 'engage', 'line', 13, 9.5, 20).order = { kind: 'hold' };
  S.newUnit(st, 1, 'swordsmen', 'engage', 'line', 13.5, 10.5, 20).order = { kind: 'hold' };
  S.newUnit(st, 0, 'pikemen', 'engage', 'line', 4, 10, 20).order = { kind: 'hold' };
  const before = horse.x;
  for (let i = 0; i < 10; i++) V4.step(st);
  assert.ok(horse.x < before, 'it backed away');
});

test('random teams: the balancer keeps the two sides close in strength', () => {
  const rng = V4.rng(77);
  for (let k = 0; k < 20; k++) {
    const t = V4.balanceTeams(16, rng);
    const total = t.a ? Object.values(t.a).reduce((n, v) => n + v, 0) + Object.values(t.b).reduce((n, v) => n + v, 0) : -1;
    assert.strictEqual(total, 16, 'every dot is dealt');
    assert.ok(Math.abs(t.power[0] - t.power[1]) <= Math.max(...Object.values(C.POWER)), 'strength within one dot: ' + t.power);
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
