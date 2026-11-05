# Combined — round 2 plan (from the first playthrough)

**Source:** 14 notes in the Family database (`xw_notes`, page `Combined`), written 2026-11-05 between 05:02 and 05:18 UTC on turn 160, after one playthrough. All 14 are copied below, with the plan for each. Marked `done` in the database on 2026-11-05 as read. The status column only allows `open` and `done`; `done` means read, not built.

**Status:** plan only. No code changed. Numbers are first defaults to check.

## What the notes say, grouped

### 1. Time (you asked for slower country and province play, and fast-forward)

| Note | What you asked | Plan |
|---|---|---|
| "the turn at the country level to be half as fast" | Country turn twice as long | `RATE.country` 1 → 0.5: a country turn takes 120 s on the country map. |
| "province level attacks to be half as fast" | Province time slower | `RATE.province` 0.2 → 0.1. |
| "a fortress would have … double time dilation" | More time when a fortress is fought over | While a fortress battle or fortress window is on screen, province time is halved again (×0.05). |
| "fast-forward double speed at the province and the country level" | ×2 button | A ×2 control on the country and province bars, like the unit scale's. Doubles the clock rate while held on. |

### 2. Province view controls

| Note | What you asked | Plan |
|---|---|---|
| "I should not be selecting individual population centers, but instead the provinces … click and drag to move troops" | Select provinces, drag to move | Tap or drag from a province onto a neighbour. The current spot-by-spot tap sends stay as a fallback. |
| "I won't be able to drag and move" (overall) | Same | Same item. |

### 3. Country controls

| Note | What you asked | Plan |
|---|---|---|
| "click on the source … through neighbors and then click the target and it will pick up everybody and move them to the target … at the percentage already indicated" | One route order | Tap a source, then a target. The path runs through your own provinces (as the current road routing does). The send share sets how many move. |
| "+10 from field army … only used once every turn" | Muster once a turn | Muster is allowed once per nation per turn. Question 2 below. |

### 4. Food, army and garrisons

| Note | What you asked | Plan |
|---|---|---|
| "Garrison and the field army should be eating a lot of food as well as War should consume a lot" | Upkeep on all soldiers; War is costly | Upkeep counts field army + garrisons. War direction adds a food cost per turn (default +50% upkeep). |
| "standing army plus the garrison army should fall under the army cap" | One cap for both | The army cap counts field army + garrisons together. Recruits stop at the cap, as now. |
| "gradually move your Garrison towards the borders, prioritizing hostile borders, then at least half of neutral or all border" | Move garrisons to the edge | A garrison order: move a share of a province's garrison toward the border, hostile borders first, then neutral borders. Question 4 below. |

### 5. Fortresses and walls

| Note | What you asked | Plan |
|---|---|---|
| "The fortress Towers should not immediately stop the attackers … slow them down to 50% speed and continue to shoot them" | Slow, not stop | A fortress in range halves an enemy march's speed and keeps shooting (it no longer holds them still). |
| "If upgraded the tower range should double" | Upgrade doubles range | Range 40 → 80 map units on upgrade (per fortress). |
| "anything less than a town should not have a settlement wall" | Walls from town up | Villages get no settlement wall. Towns, cities and fortresses keep theirs. The unit bridge sets `walls` only for those tiers. |

### 6. Allies and marches

| Note | What you asked | Plan |
|---|---|---|
| "when I move unit to my allies, they disappear … they should be folded into allies, troop count" | Soldiers join the ally | Found in the code: a march that arrives in a province you may no longer enter sends its soldiers back to the field army and they vanish from the map. Change: a march into an ally's province adds the soldiers to that ally's garrison. |

### 7. Province fights and the field army

| Note | What you asked | Plan |
|---|---|---|
| "I'm not getting any results that match … attack and take out defenders one-to-one … more like risk and it's 5 to 2" | Risk-like fights | Question 1 below. |
| "I should be able to zoom in directly at the province level … enough time to prepare defenses and ambushes" | Time to react when zoomed in | Covered by the time items (section 1). |
| "I wonder if I should be using risk rules … and using unit battles to really push" | Use the battle screen for fights | Question 1 below. |
| "The field army is a set number of trips you can deploy per turn and can be used to fight" (you liked this) | Trips per turn | Question 3 below. |

## Decisions (answered 2026-11-05)

1. **Fights: risk-style, with a join button.** When an enemy enters one of your provinces, a red pop-up button appears: **Join battle** (opens the unit scale). If you don't join, the fight resolves in the background with risk-style dice rounds. There is enough time to join partway through. Dice rounds default to 3 attacking dice against 2 defending dice per round; the loser of each round loses one soldier. Joining at any point opens the unit battle from where the fight stands.
2. **Muster: once per province per turn.**
3. **Movement: distance, not trips.** Each army can move up to **3 provinces per turn**. Starting value; tune after play.
4. **Garrisons.** A garrison can be moved by command and then acts as a field army. In the province and country views, garrisons move automatically toward the border provinces (hostile borders first, then neutral).
5. **Allies: a donation.** Soldiers that march into an ally's province become part of that ally's garrison.
6. **Status.** Mark each note `done` once it is built. No `read` status is added.

## Order of work (after you answer)

1. Time (section 1) and the ×2 control. Small, and it changes how everything else feels.
2. Walls, tower and army cap (sections 4 and 5). Rules only, with tests.
3. Allies folding in (section 6). Fixes a real bug.
4. Movement limit of 3 provinces, once-a-turn muster, and garrison move (sections 3 and 4).
5. Risk-style fights with the Join battle button (section 7).
6. Province drag and route orders (sections 2 and 3). Mostly UI.
