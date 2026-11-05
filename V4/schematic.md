# Expansion Wars — V4 Schematic (battle view)

**Status:** Custom battle built (V4). Round 2: vision, defender plan, attack and rush moves, rally, fixed-step replay. Round 4 (V4.2): battlefield generator, 2 × 2 field with mini map, walled settlements, roads and bridges, hiding and ambush strikes, fronts, fatigue. Round 5 (V4.3): planned routes you edit, formations of up to two groups, a third team and allies, defending, geography seed, collapsible panels. Not linked from V2: phase 5 is not started. Balance is a first pass.
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

## Round 2 (V4): what changed and why

Decisions from Jimmy, recorded here.

- **Single mode.** One custom battle, set up like Total War: armies, ground, seed, then the player places their units inside a deployment strip, then Begin.
- **Replay fixed.** The battle runs in fixed steps of `C.TICK` seconds. Real time is turned into whole steps, so the battle depends only on the seed and the orders. Every accepted order is recorded with its tick. "Copy replay" gives the request, the orders and the result, and `V4.replay` reproduces the result exactly (checked in the browser run).
- **Vision and fog.** Each side sees what any of its units can see. Defenders see four tiles further. Enemies you cannot see are not drawn. An ambusher in woods is hidden from the attacker until it is three tiles away.
- **Defender plan.** A third of the infantry ambush in the woods nearest the attack, and the rest hold a station around the first objective, fighting within eight tiles of it. Cavalry hold the flanks.
- **Orders.** A click on ground is an attack move: the unit fights what it sees on the way, then carries on. A rush move ignores enemies on the way (rush speed). Attack and hold are as before.
- **Morale and rally.** Morale recovers slowly over time out of contact (0.5 a second). A unit that has stood still for three seconds recovers faster (+1 a second). A steady friend within three tiles adds to it. A captured objective lifts friends near it (+15). An enemy that dies lifts friends near it (+8). An enemy that routs lifts friends near it (+6). A routed unit rallies at 25 morale, when no enemy is within six tiles.
- **Surrender with reserves.** The 1-in-20 check counts reinforcements on their way, and the bell's levies not yet raised.

### Interpretations to confirm

- "Taking pause" is read as a unit that has stood still for three seconds.
- "Or die" is read as an enemy dying near a unit.
- "Slow recovery with time" is 0.5 a second out of contact.

### Balance notes (round 2 first run)

- With the defender planned, the defender has a clear edge: a pikemen mirror is won by the defender about 83% of the time over six seeds. The causes are the sight bonus, the stations, and the ambush. Decide whether that is the intent before tuning.
- Catapults win most matchups at range, as before.
- Samples are small (six seeds). Use `node V4/tests/balance.js 40` for steadier numbers.


## Replays to the family database (round 3)

- Each finished custom battle is saved on the device first (`xw4-replays` in local storage, the last 50), then written to the Family table `xw_replays` once the family account is signed in. The sign-in session is shared with V2 (same origin).
- A row holds the request, every order with its tick, and the result. `V4.replay(request, commands)` reproduces the battle.
- Rows are only added, never edited or deleted, in line with `xw_maps` and `xw_notes`. Anonymous access is refused.
- Migration: `supabase/003_xw_replays.sql`, with the rollback test in `supabase/test_003_xw_replays_rollback.sql`. The rollback test passed. The migration has not been applied to the Family project yet.
- If a push fails (table missing, offline, or refused), the replay stays on the device and the result screen says so. "Send waiting replays" retries from the setup screen.

## Round 4 (V4.2): battlefield generator, ground and command

Decisions from Jimmy, recorded here. Built in one pass; the choices where the request was open are listed under "Interpretations" below.

- **The generator.** Every option is on the setup screen in the **Battlefield generator** card, and is saved in the request as `gen`, so a replay gets the same ground and rules. Defaults are in `C.GEN` (`js/config.js`). Options: field (large 2 × 2 or small one screen), settlement openings (2, 3 or 4), river (none, fords, or bridges), hidden units (you choose to strike, or they strike on their own), default approach (flank, middle, base, mixed, or stay put), roads, tall grass, fronts and flanks, and fatigue. Woods stay on the Woods checkbox in "The fight".
- **Random balanced teams.** "🎲 Random balanced teams" in Armies deals 14 to 18 random dots, one at a time to the weaker side, so the two sides come out close in strength (`V4.balanceTeams`, power per type in `C.POWER`).
- **2 × 2 field and mini map.** The large field is 100 × 64 tiles. The view is a camera of one screen. The mini map in the upper left shows the whole field, the camera window, and the units you can see. Tap the mini map to jump, or use the ◀ ▲ ▼ ▶ pad. The small field (50 × 32) is the old one-screen battle and is still used by the tests and the balance runs.
- **Settlements with openings.** Each settlement is walled, with 2 to 4 gates (west toward the attacker, then east, north, south). A settlement sits at about two thirds of the map, not at the far edge. Units walk to gates by a flow field (`goTo` in `sim.js`), so they go round walls and through openings rather than pushing into them.
- **Roads and rivers.** A road runs along the centre row from the attacker's edge to the settlement's west gate; it travels at 1.6 times the speed of grass. The river is deep water (impassable) with bridges only, or shallow with fords. Bridges and fords sit on the road's row, so the road crosses the river. Bridges are chokepoints.
- **Woods and tall grass hide units.** A unit in woods or tall grass can be seen only from 2.5 tiles away, until it fires or strikes (then it is revealed for 3 s). Woods and grass are both cover.
- **Ambush strike.** A unit with the Ambush strategy waits in cover. When an enemy comes within 3 tiles it does not attack on its own: a **⚔ Strike!** pop-up appears over it, and the player taps it (or the setting makes it automatic). A strike is a burst on every enemy within 3 tiles at 2.5 times normal damage, then the unit fights as a rush. The computer's ambushers strike at once. The pop-up goes when the enemy leaves reach.
- **Default approach.** A player unit with no order walks to its approach point, which the generator sets: the **flank** (in front of the settlement, a quarter of the way down or up), the **middle** of the field, the enemy **base** (the settlement), or **mixed** (each unit picks one at random). Units fight what they meet on the way.
- **Reading the ground.** Each unit counts friends and seen foes within 4 tiles. An engage-by-default unit that is outnumbered (foes more than 1.5 times its friends) falls back if it is cavalry or ranged, and a melee unit waits for friends to come up before it closes. Otherwise it attacks.
- **Fronts and flanks.** A unit has a facing: the way it last marched, or the enemy it last fought. Its front is an arc set by formation: a line has a wide front (120°), a column a narrow one (50°, with long exposed sides), a shield wall 150°, and scatter none. A hit from the side takes the formation's flank value; a hit from behind takes that times 1.3. On the map a line is drawn across its march and a column along it, with a short line showing its front.
- **Fatigue.** Marching tires a unit by ground: grass slowly, tall grass and woods faster, river and ford fastest, road hardly at all. Fighting in contact tires it fastest, and standing still out of contact gives it back. A tired unit is slower (up to 35 per cent at full fatigue) and hits softer (up to 30 per cent). A tired unit shows "tired" in its panel from half fatigue.
- **Deselect after an order.** After you give a move, rush, attack or hold, the unit is deselected. Tap it again to give the next order.

### Interpretations (to confirm)

- **Facing applies to squads and battalions only** (fortress and country scale). At village scale each dot is one person, so facing is off. "It shouldn't matter for smaller spots" is read as this.
- **Line and column.** The request said a line is perpendicular to the march and a column parallel. The shape is drawn that way, and the front is the way the unit marches. A line's broad front faces forward; a column's narrow front does, with its long sides exposed. That makes a column easy to flank.
- **"Waiting and hiding"** is read as units on the Ambush strategy. Other units hidden in cover fight normally.
- **"Outnumbered"** is more than 1.5 times the friends you can count within 4 tiles (you count yourself).
- **Mini map position.** Upper left, as asked. Move the view by tapping the mini map or the pad. There is no drag yet.

### Balance notes (round 4, first look)

- The matrix (`node V4/tests/balance.js 12`) is still polarized: most matchups go one way every time, and the mirror pikemen match favours the defender. Roads, walls, fronts and fatigue are new, so the numbers have not been tuned for them.
- Full battles on the large field with the default approach run 68 to 120 s, inside the caps.

### Still open

- The camera is pan by pad and tap only, with no drag or pinch.
- The team randomizer deals counts; it does not pick a nation's garrison or a province's pool.
- The strike pop-up is tested in a browser with a forced prompt. A real hidden-unit approach has not been played.


## Round 5 (V4.3): routes, formations, third team and allies, defending

Decisions from Jimmy, recorded here.

- **Planned marches.** Each unit's march is a dashed line along the route it will really take (the same flow field the units use, so it goes round walls and over bridges). A unit that will stop (hold, station, ambush) has a dashed ring where it will stand. "Show" chooses mine (default), the selected unit or its formation, or none.
- **Routes you adjust.** With a unit selected and the battle in planning (deployment, or paused), tap ground to add a point to its route. Drag a numbered point to move it. Tap a dashed line to insert a point there. "Remove last point" and "Stop here" are in the unit panel; "Done" deselects. The route is sent to the battle as a command at each change, so replays keep it. In real time a tap is a single move, as before.
- **Arranging the army.** At set-up your army is placed by role across its spawn box: infantry in front, toward the enemy; archers in the middle; cavalry on the flanks. Units with a formation keep their places in it when it marches.
- **Two formations.** Each unit is in group 1 (Line) or group 2 (Horse). Cavalry start in group 2 and everything else in group 1. A formation can be selected: tap ground and the whole group marches, each unit keeping its offset from the group's centre. Hold, strategy and shape also apply to a whole formation. The unit panel moves a unit to the other formation.
- **Approach as a formation.** The default approach is one point per formation, with each unit keeping its place. A formation approaches the flank, the middle or the base as one.
- **Third team and allies.** A third team comes in from the north edge. Its allegiance is hostile to both, allied with the attacker, or allied with the defender. Allies share what they see and win or lose together: a battle ends when only one alliance is left standing, or when one alliance holds every objective. A team gives up when it is down to a twentieth of its hostile teams' strength.
- **Defending.** "You are" chooses the attacker, the defender or (with a third team) the third team. The computer plays every other team. The random-teams button chooses attacker or defender at random too.
- **Random teams** sets the numbers for every team, and the third team's allegiance when there is one. Numbers can be changed afterwards: tap a number, then scroll the wheel to change it by one. The wheel only works once the number has been tapped, so the page still scrolls elsewhere.
- **Geography.** The ground has its own seed (`geoSeed`), so 🗺️ New geography changes the map and keeps the armies and orders. The battle seed is kept separate.
- **Site toggles.** Woods, tall grass, roads, settlement walls, the river (none, fords or bridges) and the openings each have a control in the generator. Turning walls off leaves the settlement as open ground.
- **Panels fold.** Every panel on the setup and battle screens opens and closes from its heading.

### Interpretations (to confirm)

- **Route editing is for planning only**: during deployment or while paused. In real time a tap gives a single move or attack, as before.
- **Formations take one point.** A formation's march is one point with offsets, not a multi-point route. Routes are per unit.
- **The third team is run by the computer** and marches on the first objective. It has no formation or plan of its own.
- **Result shape.** `winner` is `attacker`, `defender` or `third`. `winners` lists the whole winning alliance, so an allied win is visible to V2. `pool`, `losses` and `survivors` gain a `third` entry when there is a third team.

### Tests and checks

- `node V4/tests/sim.test.js`: 45 checks pass (15 new for this round, covering routes, groups, arrangement, allies, defending, geography and site toggles).
- Headless Chromium: setup with the third team, the number wheel, random teams, geography button, a battle with routes (tap, drag, insert on a line), a formation march, the strike pop-up, and the camera. No page errors. Defending and an allied win were checked by unit test only, not played in the browser.

### Still open

- The balance is not tuned for the third team, the formations, or defending.
- Formations march to one point; there are no multi-point formation routes.
- The third team has no plan of its own.


## Round 6 (V4.4): kills report and an archer nerf

- **Kills by unit type.** The result (and so the replay JSON) gains `killsBy`: for each side, the people its units killed, credited to the unit type that dealt the damage, in proportion to each unit's share of the damage on the target. Shown on the result screen too.
- **Archers nerfed.** Damage per person 0.5 to 0.35. Before: archers beat cavalry, pikemen, swordsmen, slingers and catapults in the matrix (`node V4/tests/balance.js 12`). After: they still beat cavalry, pikemen, swordsmen and catapults, lose to slingers, and the archer mirror now favours the attacker (83%). This is one step; further change is a judgement call.
