# Expansion Wars — V3 Schematic (battle view)

**Status:** Design only. No code yet.
**Owner:** Jimmy
**Platform:** Same as V2: plain HTML/CSS/JS in `V3/`, no build step. Opens from `V3/index.html`.
**Relationship:** Separate from V2 (root `index.html`, `js/country.js`). V2 keeps changing. V3 does not edit V2 files until the contract below is agreed.
**Conversation:** None yet. Open questions are at the end of this file.

## Purpose

The battle scale. When one nation's army crosses a border into another nation's land, the fight is played on a terrain field. Units move, fight, hold and break. The result goes back to the country layer (V2): which spots change hands, and which soldiers are lost.

The scales of play:

| Scale | Where | What a dot is | Clock |
|---|---|---|---|
| Country | V2 map (`index.html`, `js/country.js`) | a nation (region) | 60 s turns |
| Province | V2 zoom (dots), V1 spot map | a population centre or spot | paused during a battle |
| Battle | V3 (this file) | depends on the battle's scale (below) | battle clock: pause, slow, normal |

**Naming:** in V2's zoom a dot is a population centre. In V3 a dot is a unit (a person, a squad or a battalion, depending on scale). Use "unit" in code and text (question 2).

## Scales of battle

The same engine plays three sizes of fight. Each has its own grain (how many people one dot stands for) and its own ground.

| Battle scale | Fight | One dot = | Ground | Tile means (default, to check) |
|---|---|---|---|---|
| Village | a village and the one or two provinces around it | one person | one or two provinces, close view | about 5 m |
| Fortress | a fortress, town or border crossing and its province | a squad of about 20 | one province and the border (the design so far) | about 20 m |
| Country | a war front across several provinces | a battalion of about 100 or more | three or more provinces, scaled down | about 100 m |

The scale is set by the fight: a village skirmish is village scale, an attack on a fortress is fortress scale, and a country campaign battle is country scale. Head counts and damage are per person, so a dot's strength is its number of people, up to its grain.

## Goals

1. Units of different types fight on terrain built from the provinces where the fight takes place.
2. **Speed differs by unit type and by formation.** A column moves fast; a loose blob moves slowly and covers ground.
3. **Units read at a glance.** Each type has a traditional campaign insignia. Ranged units animate their volleys, and catapults animate their shots.
4. Strategy matters: flanking, feints, choice of ground, formation choice (ambush risk against speed), timing of reinforcements, pulling the garrison out.
5. The defence is more than the garrison: a town or fortress raises levies from its people.
6. Time can be controlled: pause, slow, normal. Orders can be given while paused.
7. The result returns to V2 through one small contract, so V2 works with or without V3.

## Non-goals (first version)

- Multiplayer battles, saved battles, database writes (Supabase).
- Sound and detailed art. Insignia are simple vector shapes, and animation is simple motion.
- Morale and fatigue for each person. Morale is per dot.
- Line of sight beyond one simple rule, and facing beyond front and rear.
- Changing V2's battle code. That is a separate, later change (phase 5).

## Units (the dots)

- One dot = one unit of one type. At village scale the unit is a person; at fortress scale a squad of about 20; at country scale a battalion of about 100 or more.
- **Strength** = people in the unit, up to its grain for that scale. Strength starts from the province's soldier pool when the unit is sent. Survivors go back to the pool at the end of the battle.
- A unit has a type, strength, morale (0 to 100), a position, a facing (toward the enemy edge), a formation and current orders.

Unit types (first pass; every number is my default, to check). The speed is per person's pace on foot; the scale sets how far a tile is.

| Type | Insignia (traditional device) | Speed (tiles/s) | Strong against | Weak against |
|---|---|---|---|---|
| Cavalry | horse and rider; lance pennon | 2.0 | archers, slingers, catapults (charge on open ground) | pikemen; woods and town streets |
| Pikemen | a long pike with a square banner | 0.8 | cavalry | archers, who shoot while pikes close the gap |
| Swordsmen | crossed swords | 1.0 | pikemen inside the pike line; anyone in woods or towns | archers at range; cavalry on open ground |
| Archers | bow and arrow | 1.0 | swordsmen and cavalry at range | any melee contact |
| Slingers | sling and stone | 1.2 | catapult crews; archers at short range | cavalry; anything armoured |
| Catapults | a throwing arm on a wheel | 0.4 | walls, gates, clumped units | anything in melee range (minimum range) |

Your note says "Schwarzenegger" for the third type. I have read it as **swordsmen** (question 1).

**Insignia.** Each unit shows its type's device on a banner or shield, framed in its nation's colour. The device is the same at every scale: at village scale it is a small mark on each person's shield, at fortress and country scale it is the unit's standard. Insignia are simple vector shapes drawn in `js/insignia.js`, so they can be read at a glance on an iPad.

**Counters:** a strong pairing deals ×1.5 damage, a weak pairing ×0.6, anything else ×1. The table lives in `js/config.js` so it can be tuned in one place.

## Formations

A formation is an order given to a unit, at any scale. It changes speed, spread, and how the unit takes damage. The choice is the strategy: speed against ambush risk, spread against area attacks.

| Formation | Look | Speed | Spread and damage taken | Trade-off |
|---|---|---|---|---|
| **Line** (default) | a front of units, even spacing | ×1.0 | normal | balanced; no special risk |
| **March column** | a tight file, close together | ×1.5 | tight, so area fire hits it harder (×1.3) | fast to move, but **ambush-prone**: an enemy in cover within three tiles can spring an ambush on first contact (own damage taken ×1.5 for 5 s) |
| **Scatter** | an amorphous blob, dots spread over a wider area | ×0.8 | covers twice the ground; area fire (catapult shots, volleys) hits it at ×0.5 per person; cavalry charges at ×0.8 | hard to hit and hard to rout as a block, but slow and weak in shock |
| **Shield wall** (later) | a locked front of shields | ×0.5 | ranged damage ×0.5; melee defence ×1.2 | very slow; holds against archers |

Formations are part of the battle's clock: changing formation takes a few seconds, and the change shows as the unit reshapes. A column that stops to form a line loses those seconds.

**Animation.** Ranged units animate their volleys: a bunch of arrows arcs from the archers to the target, timed by the battle events. Catapults animate their shots: a stone arcs and lands with a dust puff. Animations are cosmetic. They happen when the sim fires, so a replay and the log match what the player saw.

## Terrain (from the province)

Each province has terrain tags (grassland, woods, river, town, fortress) and a settlement tier (none, village, town, city, fortress). The battlefield is built from them.

| Terrain | Effect on squads |
|---|---|
| Grassland | Open ground. Cavalry charge bonus (×1.3) on first contact. Normal speed. |
| Woods / trees | Cover: defence ×1.2 for squads inside. Cavalry move at half speed and cannot charge. Archers cannot see inside beyond two tiles. Ambush possible. |
| River | Crossing takes twice as long, and a squad in the water loses 20% defence. Fords and bridges are the quick crossings. |
| Town | Streets and buildings. Cavalry cannot charge. Defenders inside buildings ×1.2. Levies appear here. |
| Fortress | Walls. Archers on the wall ×1.5 damage against squads below. Squads pass the walls only at the gate, or once catapults have broken it. |
| Lake (V1 rule) | Impassable. |

**Field:** 50 × 32 tiles of 20 units, which is the same 1000 × 640 space that V1 and V2 use. Terrain is drawn as tiles. Units move in continuous positions on that grid. The tiles stay the same size on screen at every scale; what changes is how much land they cover.

**Ground by scale**
- **Village:** the village and one or two provinces around it. Fields, hedges, a well, the village houses, and the road in. The terrain is closer in, so there are more tags per tile.
- **Fortress:** one province and the border, as set out below.
- **Country:** three or more provinces along the front, joined by their roads and rivers. The map is the same kind of field, scaled down: each tile covers more land, and the provinces show as zones with their own terrain.

**Generation (fortress scale):** a battle is between two provinces that share a border. The border becomes the centre line. The attacker enters from its own edge, the road side. The defender holds its side, and its settlement (if any) sits behind the centre line. The defender's terrain tags fill its half, the attacker's fill its half, and a river crosses the centre if the border has one. Village and country scale use the same method with more provinces on the field. The random seed comes from the province ids and the turn, so the same battle can be replayed and logged.

## Orders and control

- Tap a unit, then tap a target tile or enemy unit. Orders: **move**, **attack** (engage a target), **hold** (stand and defend).
- Each unit also has a formation (above). Tap the formation button, then pick one. The formation applies on the way, so a column can be set before a march.
- Orders can be given while the battle is paused. Planned moves show as dashed lines until the battle resumes.
- Once in contact, units fight on their own, following their orders. There is no micro-control of people.

## Battle clock and time dilation

- The country clock **stops** while a battle runs (rule from convo v0.8). The battle has its own clock.
- Speed buttons: **Pause**, **Slow** (0.5×), **Normal** (1×). Default: Normal, with pause always available.
- Optional: automatic slow motion at first contact. Off until you decide (question 5).
- **Length:** the battle clock caps at 120 seconds at village and fortress scale, the "under two minutes" check from convo v0.8. Country-scale battles get a longer cap, 5 minutes by default (question 9). At the cap, the attacker has to be holding the objective to win. Otherwise the defender holds.
- Country-scale battles move at battalion pace, so the speed buttons matter more there: Slow is the default for a battle that is more than a few minutes long.

## Waves (attack and defence)

**Attacker**
- Wave 1: the squads sent from V2 (the chosen share of the army, as now).
- Wave 2: reinforcements from the attacker's home province, one squad every 30 seconds, while that province still has men and the road from it is open.

**Defender**
- Wave 1: the garrison squads on the field at the start (from the province pool).
- **The bell (levies):** when the attacker reaches the centre line, a town or fortress raises levies after a 20-second delay. Levies are pikemen or slingers with 4 to 6 men, lower morale, and attack ×0.8. One levy per 20 population, taken from the province pool, and never more than the pool holds.
- Wave 3 (later): reinforcements from a neighbouring province, only when V2 says it is an ally.

Levies are drawn from the same pool that V2 uses for garrisons. A long battle costs the defender twice: men lost on the field and men called up from home.

## Winning and losing

- **Rout:** a squad whose morale reaches 0 flees to its own edge. Squads next to a routing squad lose 10 morale.
- **Army broken:** a side with no squads on the field and no wave still to come loses.
- **Objective:** the gate (fortress), the square (town), or the crossing (open field). One squad holding it for 10 seconds takes the settlement.
- **Overwhelming:** as in V2 (power at least twice the defence), the garrison surrenders at once. The battle ends and the province falls without a full fight.

## Strategy: what a player can out-play

- **Choice of ground:** go through woods to flank, or cross at the ford instead of the open river.
- **Formation risk:** a column crosses the field in half the time, but walks into an ambush if the woods hold enemies. A scatter blob covers the ground and survives the volleys, but it is slow to strike.
- **Feint:** cavalry at one gate, infantry at the other. The bell calls the levies toward the first.
- **Timing:** strike before the levies arrive, or wait and rout them as they come through the gate.
- **Siege:** catapults break a gate, but need pikes in front of them.
- **Raid:** a cavalry squad that gets behind the line can kill catapults and slingers before they fire.
- **Hold or chase:** take the objective, or chase the enemy army.

**Balance target:** no single type wins alone. A pure cavalry rush, a pure pike wall and a pure catapult push should all lose to a sensible mix. Test this with auto battles (below) before it is tuned by feel.

## Architecture (inside `V3/`)

```
V3/
  index.html        battle sandbox page: scenario picker, then the battle
  css/style.css
  js/config.js      unit types, counters, formations, scales (grain, tile size, caps) and every tuned number
  js/field.js       battlefield from province data, at each scale; seeded random (no DOM)
  js/sim.js         units, formations, movement, combat, morale, waves, win check (no DOM)
  js/insignia.js    the type devices as SVG shapes (drawing only, no game rules)
  js/view.js        drawing (SVG on the 1000 × 640 space), animation of volleys and shots, input, speed buttons
  js/contract.js    battle request and result shapes; auto mode (no DOM)
  schematic.md      this file
```

- `config.js`, `field.js`, `sim.js` and `contract.js` do not touch the DOM. They can run in Node for tests and auto battles. Same plain-JS, no-build rule as V2.
- Storage: V3 keys start with `xw3-`. No Supabase in the first version. A battle log copies to the clipboard, like V2's game log.
- Entry: `V3/index.html` starts as a sandbox with a scenario picker. Later, V2 can open a battle with a link that carries the request, in the URL hash or in localStorage under `xw3-battle` (same origin, so it can be read there).

## The contract with V2

Request (V2 to V3):

```
{
  seed, turn,
  scale: 'village' | 'fortress' | 'country',
  attacker: { nation, provinces: [id], pool, units: [{ type, count, formation }] },
  defender: { nation, province, pool, population,
              settlement: 'none' | 'village' | 'town' | 'city' | 'fortress',
              terrain: ['grass', 'woods', 'river', ...] },
  border:   { river: bool, road: bool },
  mode:     'play' | 'auto'
}
```

Result (V3 to V2):

```
{
  winner:    'attacker' | 'defender',
  how:       'rout' | 'objective' | 'time' | 'surrender',
  captured:  bool,
  losses:    { attacker: { type: people }, defender: { type: people } },
  survivors: { attacker: { type: people } },
  levies:    n,
  seconds:   n
}
```

V2 applies the result: pool and survivor changes, the spot taken (`takeSpot`), culture and the log. Until phase 5, V2 keeps its instant `battle()` in `js/country.js`. V3 changes no V2 file.

**Auto mode:** `contract.js` runs the same `sim.js` at maximum speed with no drawing. The result matches what a played battle would give for the same seed. This serves V2's computer battles later, and balance runs now.

## Build approach

| Phase | What is built | Check |
|---|---|---|
| 0. Sandbox | `V3/index.html`, scenario picker, units placed and moved, fights on contact, win when an army is broken. Plain grass only, fortress scale only. | 10 pikemen against 10 swordsmen gives a believable result. The same seed gives the same result. |
| 1. Types and terrain | Six types with insignia, counters, woods, river, town, fortress effects, morale and rout. Line and march column formations. | Each counter in the table shows in a test battle. A column is faster and loses more to an ambush in woods. |
| 1b. Scatter and animation | Scatter formation, volley and catapult animation driven by the sim's events. | Scatter takes less damage per person from a volley, and the animation matches the sim's log. |
| 1c. Village and country scales | Village grain (one person a dot) and the country grain (battalions), with their own ground and caps. | Same engine at all three scales; the speeds on screen match the tile sizes in the table. |
| 2. Objective and time | Objective (gate, square, crossing), 120 s cap, speed buttons, pause with queued orders. | A battle ends by rout, objective and time, each in a test. |
| 3. Waves and levies | Attacker reinforcements, the bell, levies drawn from the province pool. | Pool counts go down by the right amounts. |
| 4. Contract and auto | Result shape, auto mode, balance runs, battle log. | 200 seeded battles per matchup; battles under 120 s. |
| 5. Link to V2 | One change in V2 behind a setting ("Play battles in V3" in ⚙️), after the contract is agreed. | First time V2's files change. |

Each phase gets an entry in `todo.md` that is ticked when built, as now.

**Test plan**
- Node script in `V3/tests/` for `sim.js` and auto battles. Run by hand, no build tool.
- Headless Chromium at 1024 × 768 for the sandbox, as in earlier rounds.
- Balance matrix from auto mode: each type against each type, and mixed armies against single types. Check win rates and battle length.

**Risks**
- Six types and a counter table can make balance hard. Keep the table in one file and tune with the matrix.
- Battles must read clearly on an iPad screen. The field fits the screen width in v1, with no panning.
- A battle that is too slow to play loses the feel of V2's turns. The 120 s cap protects this.

## Open questions

Answers can go in this file, or in `convo/convo v0.13.md` if you want the convo format. Each has my default in brackets.

1. **Unit list.** Is "Schwarzenegger" swordsmen? Are the six types right for v1? [Yes, swordsmen; six types.]
2. **Naming.** Should battle dots be called units (a person, squad or battalion), keeping "dot" for V2's population centres? [Units.]
3. **Grain by scale.** One person at village scale, about 20 at fortress scale, about 100 at country scale? Is the country battalion 100, or more? [1, 20, 100.]
4. **Control.** Real time with pause and queued orders, or turn-based battle moves? [Real time with pause.]
5. **Time dilation.** Speed buttons only, or automatic slow motion at first contact? [Speed buttons only; slow motion as an option.]
6. **Winning.** Rout, objective, or both? [Both.]
7. **Attack side.** Does the attack always enter from the same side, or from the road the army used? [From the road side.]
8. **Levies.** Raised automatically at the bell, or only when the defender taps? [Automatic.]
9. **Country clock.** Does the country clock stop for the whole battle? Is 120 s the right cap at village and fortress scale, and 5 minutes at country scale? [Yes; 120 s and 5 min.]
10. **Surrender.** Keep V2's two-times-power rule as an instant end of the battle? [Yes.]
11. **Insignia.** Which campaign style: a medieval-style heraldry, a classical (Roman-style) standard, or an invented house style? [Medieval-style heraldry.]
12. **Formations.** Four formations (line, column, scatter, shield wall), with shield wall later? Or line and column only in v1? [Line and column in v1; scatter in phase 1b; shield wall later.]
13. **Tile size by scale.** Are the tile distances in the table (about 5 m, 20 m, 100 m) the right ones? This sets how fast units look on screen. [Yes.]
