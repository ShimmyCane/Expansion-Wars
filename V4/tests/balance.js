// Expansion Wars — V4 balance matrix. Run with: node V4/tests/balance.js [seeds]
// Each attacker type against each defender type, with equal people (80) on each side, on open ground.
// Prints the attacker's win rate and the mean battle length. A mirror match should sit near 50%.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'js');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
['config', 'field', 'sim', 'insignia', 'contract'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
});
const V4 = ctx.V4, T = V4.CONFIG.TYPES, PEOPLE = 80;
const dots = t => Math.round(PEOPLE / V4.sim.peopleFor('fortress', t));
const N = +(process.argv[2] || 12);

console.log('Row: attacker type. Column: defender type. Cell: attacker win % / mean seconds. ' + N + ' seeds each.');
console.log(''.padEnd(12) + T.map(t => t.slice(0, 6).padEnd(10)).join(''));
T.forEach(a => {
  let row = a.padEnd(12);
  T.forEach(b => {
    let wins = 0, secs = 0;
    for (let s = 1; s <= N; s++) {
      const r = V4.runAuto(V4.sampleRequest({
        seed: s, settlement: 'none',
        attackerUnits: [{ type: a, count: dots(a) }],
        defenderUnits: [{ type: b, count: dots(b) }]
      }));
      if (r.winner === 'attacker') wins++;
      secs += r.seconds;
    }
    row += (Math.round(100 * wins / N) + '%/' + Math.round(secs / N) + 's').padEnd(10);
  });
  console.log(row);
});
