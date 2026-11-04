# Expansion Wars — V4 Schematic (battle view)

**Status:** Sandbox built (phases 0 to 4). Not linked from V2: phase 5 is not started. Balance is a first pass.
**Owner:** Jimmy
**Platform:** Same as V2: plain HTML/CSS/JS in `V4/`, no build step. Opens from `V4/index.html`.
**Relationship:** Separate from V2 (root `index.html`, `js/country.js`). V2 keeps changing. V4 does not edit V2 files until the contract below is agreed.
**Conversation:** None yet. Decisions are recorded at the end of this file; items still to confirm are listed there too.

## Purpose

The battle scale. When one nation's army crosses a border into another nation's land, the fight is played on a terrain field. Units move, fight, hold and break. The result goes back to the country layer (V2): which spots change hands, and which soldiers are lost.

The scales of play:

| Scale | Where | What a dot is | Clock |
|---|---|---|---|
| Country | V2 map (`index.html`, `js/country.js`) | a nation (region) | 60 s turns |
| Province | V2 zoom (dots), V1 spot map | a population centre or spot | paused during a battle |
| Battle | V4 (this file) | depends on the battle's scale (below) | battle clock: pause, real time |

**Naming:** in V2's zoom a dot is a population centre. In V4 a dot is a unit (a person, a squad or a battalion, depending on scale). Use "unit" in code and text.

## Scales of battle

The same engine plays three sizes of fight. Each has its own grain (how many people one dot stands for) and its own ground.

| Battle scale | Fight | One dot = | Ground | One tile covers (default, to confirm) |
|---|---|---|---|---|
| Village | a village and the one or two provinces around it | one person | one or two provinces, close view | about 5 m |
| Fortress | a fortress, town or border crossing and its province | a squad of about 20 | one province and the border | about 20 m |
| Country | a war front across several provinces | a battalion of about 100 or more | three or more provinces, scaled down | about 100 m |

The scale is set by the fight: a village skirmish is village scale, an attack on a fortress is fortress scale, and a country campaign battle is country scale. Head counts and damage are per person, so a dot's strength is its number of people, up to its grain. Grain is 1, 20 and 100 for now.

## Goals

1. Units of different types fight on terrain built from the provinces where the fight takes place.
2. **Speed differs by unit type and by formation.** A column moves fast; a loose blob moves slowly and covers ground.
3. **Units read at a glance.** Each type has an insignia in a medieval style (animals for now). Ranged units animate their volleys, and catapults animate their shots.
4. Strategy matters: each unit starts with a plan, and formations change the trade-offs of speed, defence and flanking.
5. The defence is more than the garrison: a town or fortress raises levies from its people.
6. Time runs in real time. Pause lets the player give orders; no slow motion.
7. The result returns to V2 through one small contract, so V2 works with or without V4.

## Non-goals (first version)

- Multiplayer battles, saved battles, database writes (Supabase).
- Sound and detailed art. Insignia are simple vector shapes, and animation is simple motion.
- Morale and fatigue for each person. Morale is per dot.
- Line of sight beyond one simple rule, and facing beyond front and rear.
- Slow motion of any kind, including automatic slow motion at first contact.
- Changing V2's battle code. That is a separate, later change (phase 5).

## Units (the dots)

- One dot = one unit of one type. At village scale the unit is a person; at fortress scale a squad of about 20; at country scale a battalion of about 100 or more.
- **Strength** = people in the unit, up to its grain for that scale. Strength starts from the province's soldier pool when the unit is sent. Survivors go back to the pool at the end of the battle.
- A unit has a type, strength, morale (0 to 100), a position, a facing (toward the enemy edge), a formation, a strategy and current orders.

Unit types (first pass, six types, confirmed; every number is my default, to check). Speed is a foot pace in tiles per second; the scale sets how far a tile is.

| Type | Insignia (placeholder, medieval style) | Speed (tiles/s) | Strong against | Weak against |
|---|---|---|---|---|
| Cavalry | horse | 2.0 | archers, slingers, catapults (charge on open ground) | pikemen; woods and town streets |
| Pikemen | boar | 0.8 | cavalry | archers, who shoot while pikes close the gap |
| Swordsmen | wolf | 1.0 | pikemen inside the pike line; anyone in woods or towns | archers at range; cavalry on open ground |
| Archers | hare | 1.0 | swordsmen and cavalry at range | any melee contact |
| Slingers | fox | 1.2 | catapult crews; archers at short range | cavalry; anything armoured |
| Catapults | bear (crewing a throwing arm) | 0.4 | walls, gates, clumped units | anything in melee range (minimum range) |

"Schwarzenegger" in your note is read as **swordsmen**, confirmed.

**Insignia.** Each unit shows its type's animal on a banner or shield, framed in its nation's colour. The animal is the same at every scale: at village scale it is a small mark on each person's shield, at fortress and country scale it is the unit's standard. Animals are simple vector shapes drawn in `js/insignia.js`. The style will change later, so the animal set should live in one file.

**Counters:** a strong pairing deals ×1.5 damage, a weak pairing ×0.6, anything else ×1. The table lives in `js/config.js` so it can be tuned in one place.

## Strategy: the plan a unit starts with

Before the countdown, each unit is given a **strategy**. This is its opening plan, and it runs until the player gives it a new command. Strategies are chosen per unit, the same way as the formation.

| Strategy | What the unit does | Best for |
|---|---|---|
| **Slow march** | advances at 0.6× speed in its formation; ambush penalty halved, and it spots enemies in cover earlier | moving through woods or toward a waiting enemy |
| **Ambush** | holds in cover (woods, town buildings, behind a rise) until an enemy comes within three tiles, then rushes. With no cover it behaves as Hold | surprise on a route the enemy must take |
| **Rush** | full speed (formation speed ×1.3), charges on contact, takes extra morale loss on heavy casualties | a quick strike before levies arrive |
| **Engage** (default) | advances to the nearest enemy and fights there | a straight fight |
| **Kite** | ranged and cavalry: shoots or harasses from range, falls back when an enemy comes within two tiles | archers, slingers and cavalry against a melee line |

Strategy is the plan; formation is the shape. A unit can be in a column while on a Slow march, or in a scatter while on Kite.

## Formations

A formation is an order given to a unit, at any scale. It changes speed, defence, flank damage and area damage. All four formations are part of v1 (question 12, confirmed).

| Formation | Look | Speed | Melee defence | Flanked damage taken | Area and volley damage taken | Trade-off |
|---|---|---|---|---|---|---|
| **Line** (default) | a front of units, even spacing | ×1.0 | 1.0 | ×1.5 | ×1.0 | balanced; no special risk |
| **March column** | a tight file | ×1.5 | 0.8 | ×2.0 | ×1.3 | fast, but **ambush-prone**: an enemy in cover within three tiles can spring an ambush on first contact (own damage taken ×1.5 for 5 s) |
| **Scatter** | an amorphous blob over a wider area | ×0.8 | 1.0 | ×0.7 | ×0.5 | covers twice the ground and is hard to rout as a block; charges at ×0.8; weak in shock |
| **Shield wall** | a locked front of shields | ×0.5 | 1.2 | ×2.0 | ×0.5 | holds against archers; very slow; a flank breaks it |

Formations take a few seconds to change, and the change shows as the unit reshapes. A column that stops to form a line loses those seconds.

**Animation.** Ranged units animate their volleys: a bunch of arrows arcs from the archers to the target, timed by the battle events. Catapults animate their shots: a stone arcs and lands with a dust puff. Animations are cosmetic. They happen when the sim fires, so a replay and the log match what the player saw.

## Terrain (from the province)

Each province has terrain tags (grassland, woods, river, town, fortress) and a settlement tier (none, village, town, city, fortress). The battlefield is built from them.

| Terrain | Effect on units |
|---|---|
| Grassland | Open ground. Cavalry charge bonus (×1.3) on first contact. Normal speed. |
| Woods / trees | Cover: melee defence ×1.2 for units inside. Cavalry move at half speed and cannot charge. Archers cannot see inside beyond two tiles. Ambush possible. |
| River | Crossing takes twice as long, and a unit in the water loses 20% defence. Fords and bridges are the quick crossings. |
| Town | Streets and buildings. Cavalry cannot charge. Defenders inside buildings ×1.2. Levies appear here. |
| Fortress | Walls. Archers on the wall ×1.5 damage against units below. Units pass the walls only at the gate, or once catapults have broken it. |
| Lake (V1 rule) | Impassable. |

**Field size.** Tiles are 20 units, so the field for v1 is 50 × 32 tiles, the same 1000 × 640 space that V1 and V2 use. For v1 the whole field fits the screen, with no panning. Units move in continuous positions on that grid.

**Growing the field later.** The field starts at 1× the canvas. Later, a battle field can grow to 5 to 20× the canvas, with zoom and panning, so that the country scale and large village fights have room. This is not in v1. Tile size on screen then depends on the zoom, and the scale table sets the real distance per tile.

**Ground by scale**
- **Village:** the village and one or two provinces around it. Fields, hedges, a well, the village houses, and the road in. The terrain is closer in, so there are more tags per tile.
- **Fortress:** one province and the border, as set out below.
- **Country:** three or more provinces along the front, joined by their roads and rivers. The map is the same kind of field, scaled down: each tile covers more land, and the provinces show as zones with their own terrain.

**Generation (fortress scale):** a battle is between two provinces that share a border. The border becomes the centre line. The attacker enters from its own side of the map, which is the attacking province's side (zoomed out one level where that exists, and otherwise imagined). The defender holds its side, and its settlement (if any) sits behind the centre line. The defender's terrain tags fill its half, the attacker's fill its half, and a river crosses the centre if the border has one. Village and country scale use the same method with more provinces on the field. The random seed comes from the province ids and the turn, so the same battle can be replayed and logged.

## Objectives and winning

- **Objectives** are points to hold. At village scale the objective is the village centre. At fortress scale it is the gate (fortress), the square (town), or a flag at the crossing (open field). At country scale, a region's flag in the middle of it. Large battles can have several objectives.
- **Holding an objective:** a unit standing on it for 10 seconds takes it. A side that holds every objective wins.
- **Rout:** a unit whose morale reaches 0 flees to its own edge. Units next to a routing unit lose 10 morale.
- **Army broken:** a side with no units on the field and no wave still to come loses.
- **Surrender** (replaces V2's two-times-power rule, question 10). The losing side gives up at once when any of these holds:
  - all its units have routed;
  - it has lost every objective;
  - its strength is at most one twentieth of the other side's (a 20 to 1 ratio);
  - the player taps surrender (manual).

## Orders and control

- **Real time.** After deployment the countdown runs 3, 2, 1, Go, as in V2, and the battle runs in real time.
- **Starting strategy.** Before Go, each unit is given a strategy (above) and a formation.
- **New commands.** During the battle, tap a unit, then tap a target tile or enemy unit, or pick a new strategy or formation. The new command replaces the current one.
- **Proceed.** A unit given a new command can be told to **proceed** with its original plan, which resumes the strategy and formation it started with.
- **Pause.** The battle can be paused at any time, and orders are given while paused. Planned moves show as dashed lines until the battle resumes.
- Once in contact, units fight on their own, following their current orders. There is no micro-control of people.

## Battle clock

- The country clock **stops** while a battle runs (rule from convo v0.8). The battle has its own clock.
- Speed: **Pause** and **Real time** only. There is no slow motion.
- **Length:** the battle clock caps at 120 seconds at village and fortress scale, the "under two minutes" check from convo v0.8. Country-scale battles get a longer cap, 5 minutes. At the cap, the defender holds unless the attacker holds every objective. These caps are to confirm later (see below).

## Waves (attack and defence)

**Attacker**
- Wave 1: the units sent from V2 (the chosen share of the army, as now), each with its strategy and formation.
- Wave 2: reinforcements from the attacker's home province, one unit every 30 seconds, while that province still has people and the road from it is open.

**Defender**
- Wave 1: the garrison units on the field at the start (from the province pool).
- **The bell (levies):** at the start of the battle, a town or fortress raises levies after a 20-second delay. Levies are pikemen or slingers with 4 to 6 people, lower morale, and attack ×0.8. One levy per 20 population, taken from the province pool, and never more than the pool holds.
- Wave 3 (later): reinforcements from a neighbouring province, only when V2 says it is an ally.

Levies are drawn from the same pool that V2 uses for garrisons. A long battle costs the defender twice: people lost on the field and people called up from home.

## Strategy: what a player can out-play

- **Choice of ground:** go through woods to flank, or cross at the ford instead of the open river.
- **Opening plan:** an ambush in the woods on the route the enemy must take, or a rush before the bell's levies arrive.
- **Formation risk:** a column crosses the field in half the time, but walks into an ambush if the woods hold enemies. A scatter blob covers the ground and survives the volleys, but it is slow to strike.
- **Flanking:** a unit hit from the side or rear takes the flanked damage in the table, which is high for lines and columns and low for scatter.
- **Feint:** cavalry at one gate, infantry at the other. The bell calls the levies toward the first.
- **Siege:** catapults break a gate, but need pikes in front of them.
- **Raid:** a cavalry unit that gets behind the line can kill catapults and slingers before they fire.
- **Hold or chase:** take the objective, or chase the enemy army.

**Balance target:** no single type wins alone. A pure cavalry rush, a pure pike wall and a pure catapult push should all lose to a sensible mix. Test this with auto battles (below) before it is tuned by feel.

## Architecture (inside `V4/`)

```
V4/
  index.html        battle sandbox page: scenario picker, then the battle
  css/style.css
  js/config.js      unit types, counters, strategies, formations, scales (grain, tile size, caps) and every tuned number
  js/field.js       battlefield from province data, at each scale; seeded random (no DOM)
  js/sim.js         units, strategies, formations, movement, combat, morale, objectives, waves, surrender (no DOM)
  js/insignia.js    the type animals as SVG shapes (drawing only, no game rules)
  js/view.js        drawing (SVG on the 1000 × 640 space), volley and shot animation, input, pause and orders
  js/contract.js    battle request and result shapes; auto mode (no DOM)
  schematic.md      this file
```

- `config.js`, `field.js`, `sim.js` and `contract.js` do not touch the DOM. They can run in Node for tests and auto battles. Same plain-JS, no-build rule as V2.
- Storage: V4 keys start with `xw4-`. No Supabase in the first version. A battle log copies to the clipboard, like V2's game log.
- Entry: `V4/index.html` starts as a sandbox with a scenario picker. Later, V2 can open a battle with a link that carries the request, in the URL hash or in localStorage under `xw4-battle` (same origin, so it can be read there).

## The contract with V2

Request (V2 to V4):

```
{
  seed, turn,
  scale: 'village' | 'fortress' | 'country',
  attacker: { nation, provinces: [id], pool, terrain: ['grass', 'woods', ...],
              units: [{ type, count, strategy, formation }], reserve: [...] },
  defender: { nation, province, pool, population,
              settlement: 'none' | 'village' | 'town' | 'city' | 'fortress',
              terrain: ['grass', 'woods', 'river', ...] },
  border:   { river: bool, road: bool },
  mode:     'play' | 'auto'
}
```

Result (V4 to V2):

```
{
  winner:    'attacker' | 'defender',
  how:       'rout' | 'objectives' | 'time' | 'surrender',
  captured:  bool,
  losses:    { attacker: { type: people }, defender: { type: people } },
  survivors: { attacker: { type: people } },
  pool:      { attacker: n, defender: n },   // people at home after the battle: pool left plus survivors
  levies:    n,
  seconds:   n
}
```

V2 applies the result: pool and survivor changes, the spot taken (`takeSpot`), culture and the log. Until phase 5, V2 keeps its instant `battle()` in `js/country.js`. V4 changes no V2 file.

**Auto mode:** `contract.js` runs the same `sim.js` at maximum speed with no drawing. The result matches what a played battle would give for the same seed. This serves V2's computer battles later, and balance runs now.

## Build approach

| Phase | What is built | Check |
|---|---|---|
| 0. Sandbox | `V4/index.html`, scenario picker, units placed and moved, fights on contact, win when an army is broken. Plain grass only, fortress scale only. | 10 pikemen against 10 swordsmen gives a believable result. The same seed gives the same result. |
| 1. Types and terrain | Six types with insignia, counters, woods, river, town, fortress effects, morale and rout. Line and march column formations. | Each counter in the table shows in a test battle. A column is faster and loses more to an ambush in woods. |
| 1b. Strategies, scatter, shield wall, animation | Five strategies (slow march, ambush, rush, engage, kite). Scatter and shield wall formations. Volley and catapult animation driven by the sim's events. | An ambush in woods lands its first strike. Scatter takes less area damage per person. The animation matches the sim's log. |
| 1c. Village and country scales | Village grain (one person a dot) and the country grain (battalions), with their own ground and caps. | Same engine at all three scales; the speeds on screen match the tile sizes in the table. |
| 2. Objectives, surrender and time | Objective points, surrender rules, 120 s cap (5 min at country scale), Pause and Real time, orders while paused, Proceed. | A battle ends by rout, objectives, surrender and time, each in a test. |
| 3. Waves and levies | Attacker reinforcements, the bell at the start, levies drawn from the province pool. | Pool counts go down by the right amounts. |
| 4. Contract and auto | Result shape, auto mode, balance runs, battle log. | 200 seeded battles per matchup; battles under the cap. |
| 5. Link to V2 | One change in V2 behind a setting ("Play battles in V4" in ⚙️), after the contract is agreed. | First time V2's files change. |
| Later | Field growing to 5 to 20× the canvas with zoom and panning. Wave 3 from allied provinces. | Not in v1. |

Each phase gets an entry in `todo.md` that is ticked when built, as now.

**Test plan**
- Node script in `V4/tests/` for `sim.js` and auto battles. Run by hand, no build tool.
- Headless Chromium at 1024 × 768 for the sandbox, as in earlier rounds.
- Balance matrix from auto mode: each type against each type, and mixed armies against single types. Check win rates and battle length.

**Risks**
- Six types, five strategies and four formations make balance hard. Keep the tables in one file and tune with the matrix.
- Battles must read clearly on an iPad screen. The field fits the screen in v1, with no panning.
- A battle that is too slow to play loses the feel of V2's turns. The caps protect this.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Unit list, "Schwarzenegger" | Swordsmen. Six types. |
| 2 | Naming | Dots are **units**. "Dot" stays for V2's population centres. |
| 3 | Grain by scale | Keep 1, 20 and 100 for now. |
| 4 | Control | Each unit gets a starting strategy and formation. Then real time. Units can be given new commands, or told to proceed with their original plan. |
| 5 | Time | **No slow motion.** Pause and real time only. Read as no slow motion at all, including the 0.5× button. |
| 6 | Winning | Holding objectives: a village centre at village scale, a gate, square or crossing at fortress scale, a region's flag at country scale. Several objectives in large battles. Rout still removes a side's units. |
| 7 | Attack side | The attacker enters from its own side of the map: the attacking province's side, zoomed out one level where that exists, otherwise imagined. |
| 8 | Levies | Automatic, at the start of the battle. Read from "At the beginning of", whose end was cut off in the answer. |
| 9 | Country clock | Stops for the whole battle. Caps: 120 s at village and fortress scale, 5 min at country scale. **To confirm later.** |
| 10 | Surrender | Replaces V2's two-times-power rule. The side gives up when all its units have routed, it has lost every objective, its strength is at most a twentieth of the other side's (20 to 1), or the player surrenders. |
| 11 | Insignia | Medieval style, animals for now (placeholder mapping in the table). The style will change later. |
| 12 | Formations | All four in v1: line, column, scatter and shield wall. Each has its own effect on speed, defence and flanking. |
| 13 | Tile size | The field starts at 1× the canvas. Later it grows to 5 to 20× the canvas. Tile distances stay as the table, to confirm. |

## Built (sandbox, first pass)

- Files: `V4/index.html`, `V4/css/style.css`, `V4/js/config.js` (every tuned number), `V4/js/field.js`, `V4/js/sim.js`, `V4/js/insignia.js`, `V4/js/contract.js`, `V4/js/view.js`.
- Tests: `node V4/tests/sim.test.js` (12 rule checks, all pass). `node V4/tests/balance.js 12` (the type matchup matrix, equal people on each side).
- Verified in headless Chromium at 1024 × 768: setup, deployment countdown, selecting and ordering a unit, pause, surrender and the result screen, the village and country scales. No console errors.
- Damage is worked out for all hits together, and units act in a seeded random order each tick, so no side moves first.
- A catapult attack on a unit on a town, wall or gate tile is multiplied (×1.5). A battle with no units at all ends at once.

## Balance notes (first run, to tune)

- Mirror matches lean slightly to the defender (about 25% to 50% for the attacker over 8 seeds). The cause is not found yet. More seeds, then a look at the first contact.
- Catapults beat most infantry at range, and pikes do not get close enough to answer them. Cavalry beats catapults. Catapults may need a minimum-range rule that is stricter, or less damage per crew person.
- Archers beat swordsmen at range (88%), and cavalry and archers each beat the other in turn, because both are listed as strong against the other. Check whether that is the intent.
- Battles run 28 to 107 seconds, inside the 120 second cap.

## To confirm later

- The battle caps (120 s and 5 min) once games are played.
- The tile distances in the scales table (about 5 m, 20 m and 100 m).
- The animal mapping for insignia, once the style is chosen.
- Grain at country scale (100 or more).
- The 20 to 1 surrender ratio, and whether surrender means losing every objective or just the main one.
