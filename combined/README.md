# Expansion Wars — Combined: file map

One game in three zoom levels (country, province, unit) sharing one world. Open `index.html` in a browser (no build step, no server). Design and open decisions: `schematic.md`.

Every file is small and does one job. Rules files take the world as an argument and never touch the page; view files draw from the world and never hold game state.

## Where to change what

| To change… | Edit |
|---|---|
| Time dilation, autosave, the province window size | `js/world/config.js` |
| Country numbers (costs, food, war, AI odds) | `js/country/config.js` |
| Province numbers (march speed, garrison growth and caps, AI) | `js/province/config.js` |
| Battle numbers (unit types, damage, morale) | `js/unit/engine/config.js` |
| How soldiers become a battle army, and the result goes back | `js/unit/bridge.js` |
| What happens when a province changes hands (all scales) | `js/world/rules.js` (`capture`) |
| What a transition between scales does | `js/app/scales.js` |

## Files

```
index.html                 the page; the script order is the load order (tests/load.js mirrors it)
css/                       base.css (shared look, nation colours), country.css, province.css, unit.css
js/core/                   no game rules
  ns.js                    the one global, XW, and its parts
  rng.js  geom.js          seeded random; Voronoi cells, edges, areas
  bus.js  dom.js           events between modules; DOM helpers
js/world/                  the single source of truth
  config.js                time dilation, saving, province window, starting garrison
  state.js                 the world's shape (documented at the top), get/set, changed(), log, lookups
  rules.js                 province tiers, who may attack whom, capture() used by every scale
  clock.js                 one world clock; real time × the scale's rate; when a turn is due
  save.js                  this device (localStorage)
  cloud.js                 the family database (table xw_worlds), via the shared sign-in
js/country/                country scale: turns, economy, diplomacy, war
  config.js  query.js  route.js  build.js  diplomacy.js  war.js  economy.js  move.js (garrison moves)  ai.js  turn.js  mapgen.js
  view/map.js  view/card.js  view/view.js
js/province/               province scale: real time on the world's provinces
  config.js  scene.js (the window)  rules.js (growth, marches, towers, risk-style fights, donations)  ai.js
  view/map.js  view/bar.js  view/view.js
js/unit/                   unit scale
  engine/                  the battle engine (window.V4), split from V4/js/sim.js; same results, seed for seed
    config.js  field.js  insignia.js  contract.js
    sim/base.js vision.js move.js combat.js decide.js damage.js objectives.js end.js plan.js api.js commands.js result.js
  bridge.js                world ↔ battle: request from a province fight, result back into the world
  view/map.js  view/bar.js  view/view.js
js/app/                    glance.js (top bar), mini.js (country minimap), scales.js (transitions),
                           loop.js (frame loop, turns, saving), settings.js (⚙️), main.js (start-up)
tests/                     node tests/world.test.js · node tests/unit-engine.test.js · node tests/unit-balance.js [seeds]
```

## Tests

```
node tests/world.test.js        # the world across scales: turns, dilation, captures, soldiers kept, battles, saving
node tests/unit-engine.test.js  # the battle engine (the V4 tests, on the split files)
node tests/unit-balance.js 12   # the battle balance matrix
```
