// Expansion Wars — V3 simulation tests. Run with: node V3/tests/sim.test.js
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
const V3 = ctx.V3, C = V3.CONFIG, S = V3.sim;

// An empty field. A battle with no units ends at once (no army left), so the tests clear that and place their own units.
function blank(req) {
  const st = V3.createBattle(req, {});
  st.done = null;
  return st;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

test('same seed gives the same battle', () => {
  const req = V3.sampleRequest({ seed: 42 });
  assert.deepStrictEqual(V3.runAuto(req), V3.runAuto(req));
});

test('a sample fortress battle ends and reports the result shape', () => {
  const r = V3.runAuto(V3.sampleRequest({ seed: 7 }));
  assert.ok(['attacker', 'defender'].includes(r.winner), 'winner: ' + r.winner);
  assert.ok(['rout', 'objectives', 'time', 'surrender'].includes(r.how), 'how: ' + r.how);
  ['losses', 'survivors', 'pool'].forEach(k => assert.ok(r[k] && r[k].attacker && r[k].defender, k));
  assert.ok(r.seconds <= C.CAP.fortress, 'battle within the cap');
});

test('validation rejects an unknown unit type and strategy', () => {
  const req = V3.sampleRequest();
  req.attacker.units.push({ type: 'dragons', count: 1 });
  req.defender.units[0].strategy = 'charge-wildly';
  const problems = V3.validateRequest(req);
  assert.ok(problems.some(p => p.includes('dragons')), 'type');
  assert.ok(problems.some(p => p.includes('charge-wildly')), 'strategy');
});

test('a defender who holds the settlement at the start does not end the battle', () => {
  const st = V3.createBattle(V3.sampleRequest({ seed: 3, settlement: 'town', population: 0, attackerUnits: [{ type: 'pikemen', count: 1 }], defenderUnits: [{ type: 'pikemen', count: 1 }] }), {});
  assert.strictEqual(st.done, null, 'battle should still be running');
});

test('surrender when one side has under a twentieth of the other side\'s people', () => {
  // Village scale: one person a dot. 1 attacker against 25 defenders is 1 x 20 <= 25.
  const req = V3.sampleRequest({ seed: 5, scale: 'village', settlement: 'none', attackerUnits: [{ type: 'pikemen', count: 1 }], defenderUnits: [{ type: 'pikemen', count: 25 }] });
  const r = V3.runAuto(req);
  assert.strictEqual(r.winner, 'defender');
  assert.strictEqual(r.how, 'surrender');
});

test('a column in woods is ambushed when an enemy hides within three tiles', () => {
  const st = blank(V3.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  st.field.tiles[10 * C.COLS + 12] = 'w';   // woods at tile (12, 10)
  const col = S.newUnit(st, 0, 'pikemen', 'engage', 'column', 10, 10, 20);
  S.newUnit(st, 1, 'pikemen', 'engage', 'line', 12.5, 10.5, 20);
  V3.step(st, 0.1);
  assert.strictEqual(col.ambushSeen, true);
  assert.ok(col.ambushT > 0, 'ambush penalty is running');
});

test('an Ambush unit holds in cover until an enemy comes near', () => {
  const st = blank(V3.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const waiting = S.newUnit(st, 0, 'swordsmen', 'ambush', 'line', 10, 10, 20);
  S.newUnit(st, 1, 'swordsmen', 'engage', 'line', 25, 10.5, 20);
  for (let i = 0; i < 20; i++) V3.step(st, 0.1);
  assert.strictEqual(waiting.x, 10, 'did not move toward a distant enemy');
});

test('a hold order keeps a unit still while the enemy is out of reach', () => {
  const st = blank(V3.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const u = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 5, 10, 20);
  S.newUnit(st, 1, 'pikemen', 'engage', 'line', 40, 10.5, 20);
  assert.strictEqual(V3.issue(st, { kind: 'hold', unit: u.id }), true);
  for (let i = 0; i < 20; i++) V3.step(st, 0.1);
  assert.strictEqual(u.x, 5);
});

test('proceed restores the original plan after a new command', () => {
  const st = blank(V3.sampleRequest({ seed: 9, settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  S.newUnit(st, 0, 'cavalry', 'rush', 'column', 5, 10, 10);
  const u = st.units.find(x => x.side === 0);
  V3.issue(st, { kind: 'strategy', unit: u.id, value: 'kite' });
  V3.issue(st, { kind: 'formation', unit: u.id, value: 'scatter' });
  assert.strictEqual(u.strategy, 'kite');
  V3.issue(st, { kind: 'proceed', unit: u.id });
  assert.strictEqual(u.strategy, 'rush');
  assert.strictEqual(u.formation, 'column');
});

test('the bell raises levies at the start, one per 20 population', () => {
  const st = V3.createBattle(V3.sampleRequest({ seed: 4, settlement: 'town', population: 60, attackerUnits: [{ type: 'pikemen', count: 1 }], defenderUnits: [{ type: 'pikemen', count: 1 }] }), {});
  for (let i = 0; i < 240 && !st.done; i++) V3.step(st, 0.1);   // 24 seconds
  assert.ok(st.done || st.levies === 3, 'three levies for population 60 (or the battle already ended)');
});

test('a battle with no winner stops at the cap, and the defender wins on time', () => {
  const st = blank(V3.sampleRequest({ seed: 2, scale: 'village', settlement: 'none', attackerUnits: [], defenderUnits: [] }));
  const a = S.newUnit(st, 0, 'pikemen', 'engage', 'line', 3, 10, 1);
  const d = S.newUnit(st, 1, 'pikemen', 'engage', 'line', 45, 10, 1);
  V3.issue(st, { kind: 'hold', unit: a.id });
  V3.issue(st, { kind: 'hold', unit: d.id });
  const steps = Math.ceil(C.CAP.village / 0.5) + 2;
  for (let i = 0; i < steps && !st.done; i++) V3.step(st, 0.5);
  assert.strictEqual(st.done && st.done.how, 'time');
  assert.strictEqual(st.done.winner, 1);
});

test('pool accounting: what leaves home comes back as survivors', () => {
  const req = V3.sampleRequest({ seed: 11, attackerUnits: [{ type: 'swordsmen', count: 3 }], defenderUnits: [{ type: 'pikemen', count: 2 }] });
  req.attacker.pool = 200;
  const st = V3.createBattle(req, {});
  const deployed = st.units.filter(u => u.side === 0).reduce((n, u) => n + u.start, 0);
  for (let i = 0; i < 2000 && !st.done; i++) V3.step(st, 0.25);
  const r = V3.result(st);
  const survivingPeople = Object.values(r.survivors.attacker).reduce((a, b) => a + b, 0);
  assert.strictEqual(r.pool.attacker, Math.round(200 - deployed + survivingPeople));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
