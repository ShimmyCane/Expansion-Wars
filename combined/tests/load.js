// Expansion Wars (combined) — loads the game's scripts into a Node sandbox for the tests. No DOM.
// The file lists below are the same order as index.html. Keep the two in step.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'js');

// The unit battle engine: no DOM, no world. Runs on its own.
const ENGINE = [
  'unit/engine/config', 'unit/engine/field',
  'unit/engine/sim/base', 'unit/engine/sim/vision', 'unit/engine/sim/move', 'unit/engine/sim/combat',
  'unit/engine/sim/decide', 'unit/engine/sim/damage', 'unit/engine/sim/objectives', 'unit/engine/sim/end',
  'unit/engine/sim/plan', 'unit/engine/sim/api', 'unit/engine/sim/commands', 'unit/engine/sim/result',
  'unit/engine/insignia', 'unit/engine/contract'
];

// The world and the rules of each scale: everything except drawing and input.
const RULES = [
  'core/ns', 'core/rng', 'core/geom', 'core/bus',
  'world/config', 'world/state', 'world/rules', 'world/clock', 'world/save',
  'country/config', 'country/query', 'country/route', 'country/build', 'country/diplomacy',
  'country/war', 'country/economy', 'country/move', 'country/ai', 'country/turn', 'country/mapgen',
  'province/config', 'province/scene', 'province/rules', 'province/split', 'province/ai'
].concat(ENGINE).concat(['unit/bridge']);

// A fresh sandbox with the listed files loaded. localStorage is a plain in-memory stand-in.
function load(files) {
  const store = {};
  const ctx = {
    console, Math, JSON, Date,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  files.forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  });
  return ctx;
}

// A tiny test runner: plain asserts, a summary line, exit code 1 on failure.
function runner(title) {
  let passed = 0, failed = 0;
  return {
    test(name, fn) {
      try { fn(); passed++; console.log('ok   ' + name); }
      catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e)); }
    },
    done() {
      console.log('\n' + title + ': ' + passed + ' passed, ' + failed + ' failed');
      if (failed) process.exitCode = 1;
    }
  };
}

module.exports = { load, runner, ENGINE, RULES };
