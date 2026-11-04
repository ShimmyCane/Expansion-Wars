# Expansion Wars — V3 Schematic (battle view)

**Status:** Design only. No code yet.
**Owner:** Jimmy
**Platform:** Same as V2: plain HTML/CSS/JS in `V3/`, no build step. Opens from `V3/index.html`.
**Relationship:** Separate from V2 (root `index.html`, `js/country.js`). V2 keeps changing. V3 does not edit V2 files until the contract below is agreed.
**Conversation:** None yet. Open questions are at the end of this file.

## Purpose

The battle scale. When one nation's army crosses a border into another nation's province, the fight is played on a terrain field. Squads move, fight, hold and break. The result goes back to the country layer (V2): which spots change hands, and which soldiers are lost.

The three scales:

| Scale | Where | What a dot is | Clock |
|---|---|---|---|
| Country | V2 map (`index.html`, `js/country.js`) | a nation (region) | 60 s turns |
| Province | V2 zoom (dots), V1 spot map | a population centre or spot | paused during a battle |
| Battle | V3 (this file) | a squad | battle clock: pause, slow, normal |

**Naming:** in V2's zoom a dot is a population centre. In V3 a dot is a squad. Use "squad" in code and text so the two do not mix (question 2).

## Goals

1. Squads of different types fight on a terrain field built from the province.
2. Strategy matters: flanking, feints, choice of ground, timing of reinforcements, pulling the garrison out.
3. The defence is more than the garrison: a town or fortress raises levies from its people.
4. Time can be controlled: pause, slow, normal. Orders can be given while paused.
5. The result returns to V2 through one small contract, so V2 works with or without V3.

## Non-goals (first version)

- Multiplayer battles, saved battles, database writes (Supabase).
- Sound and art polish. Dots, icons and plain shapes are enough.
- Individual men. Each squad is one dot with a strength number.
- Formations, line of sight beyond one simple rule, facing beyond front and rear.
- Changing V2's battle code. That is a separate, later change (phase 5).

## Squads (the dots)

- One dot = one squad of one unit type.
- **Strength** = men in the squad, from 1 up to the type's maximum (table below). The men come out of the province's soldier pool when the squad is sent. Survivors go back to the pool at the end of the battle.
- A squad has a type, men, morale (0 to 100), a position, a facing (toward the enemy edge) and current orders.

Unit types (first pass; every number is my default, to check):

| Type | Max men | Speed (tiles/s) | Strong against | Weak against |
|---|---|---|---|---|
| Cavalry | 10 | 2.0 | archers, slingers, catapults (charge on open ground) | pikemen; woods and town streets |
| Pikemen | 20 | 0.8 | cavalry | archers, who shoot while pikes close the gap |
| Swordsmen | 15 | 1.0 | pikemen inside the pike line; anyone in woods or towns | archers at range; cavalry on open ground |
| Archers | 15 | 1.0 | swordsmen and cavalry at range | any melee contact |
| Slingers | 15 | 1.2 | catapult crews; archers at short range | cavalry; anything armoured |
| Catapults | 4 (crew) | 0.4 | walls, gates, clumped squads | anything in melee range (minimum range) |

Your note says "Schwarzenegger" for the third type. I have read it as **swordsmen** (question 1).

**Counters:** a strong pairing deals ×1.5 damage, a weak pairing ×0.6, anything else ×1. The table lives in `js/config.js` so it can be tuned in one place.

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

**Field:** 50 × 32 tiles of 20 units, which is the same 1000 × 640 space that V1 and V2 use. Terrain is drawn as tiles. Squads move in continuous positions on that grid.

**Generation:** a battle is always between two provinces that share a border. The border becomes the centre line. The attacker enters from its own edge, the road side. The defender holds its side, and its settlement (if any) sits behind the centre line. The defender's terrain tags fill its half, the attacker's fill its half, and a river crosses the centre if the border has one. The random seed comes from both province ids and the turn, so the same battle can be replayed and logged.

## Orders and control

- Tap a squad, then tap a target tile or enemy squad. Orders: **move**, **attack** (engage a target), **hold** (stand and defend).
- Orders can be given while the battle is paused. Planned moves show as dashed lines until the battle resumes.
- Once in contact, squads fight on their own, following their orders. There is no micro-control of men.

## Battle clock and time dilation

- The country clock **stops** while a battle runs (rule from convo v0.8). The battle has its own clock.
- Speed buttons: **Pause**, **Slow** (0.5×), **Normal** (1×). Default: Normal, with pause always available.
- Optional: automatic slow motion at first contact. Off until you decide (question 5).
- **Length:** the battle clock caps at 120 seconds, the "under two minutes" check from convo v0.8. At the cap, the attacker has to be holding the objective to win. Otherwise the defender holds.

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
  js/config.js      unit types, counters, terrain effects and every tuned number
  js/field.js       battlefield from province data; seeded random (no DOM)
  js/sim.js         squads, movement, combat, morale, waves, win check (no DOM)
  js/view.js        drawing (SVG on the 1000 × 640 space), input, speed buttons
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
  attacker: { nation, province, pool, squads: [{ type, men }] },
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
  losses:    { attacker: { type: men }, defender: { type: men } },
  survivors: { attacker: { type: men } },
  levies:    n,
  seconds:   n
}
```

V2 applies the result: pool and survivor changes, the spot taken (`takeSpot`), culture and the log. Until phase 5, V2 keeps its instant `battle()` in `js/country.js`. V3 changes no V2 file.

**Auto mode:** `contract.js` runs the same `sim.js` at maximum speed with no drawing. The result matches what a played battle would give for the same seed. This serves V2's computer battles later, and balance runs now.

## Build approach

| Phase | What is built | Check |
|---|---|---|
| 0. Sandbox | `V3/index.html`, scenario picker, squads placed and moved, fights on contact, win when an army is broken. Plain grass only. | 10 pikemen against 10 swordsmen gives a believable result. The same seed gives the same result. |
| 1. Types and terrain | Six types and counters, woods, river, town, fortress effects, morale and rout. | Each counter in the table shows in a test battle. |
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
2. **Naming.** Should battle units be called squads, keeping "dot" for V2's population centres? [Squads.]
3. **Squad size.** Fixed maximum men per type, as in the table? Or up to 20 for every type? [Fixed per type.]
4. **Control.** Real time with pause and queued orders, or turn-based battle moves? [Real time with pause.]
5. **Time dilation.** Speed buttons only, or automatic slow motion at first contact? [Speed buttons only; slow motion as an option.]
6. **Winning.** Rout, objective, or both? [Both.]
7. **Attack side.** Does the attack always enter from the same side, or from the road the army used? [From the road side.]
8. **Levies.** Raised automatically at the bell, or only when the defender taps? [Automatic.]
9. **Country clock.** Does the country clock stop for the whole battle, and is 120 s the right cap? [Yes, and 120 s.]
10. **Surrender.** Keep V2's two-times-power rule as an instant end of the battle? [Yes.]
