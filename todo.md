# Expansion Wars — todo

Built from the feedback notes (round 2). Each item says whether it is done, and what decision it still needs.

## Done in this round

- [x] Send 10 / 25 / 50 / 100%, default 25%, minimum two soldiers. Button in the top-left corner of the board.
- [x] Drag from several of your spots: moving over your own regions adds them; a drop on another region sends each one that has a road to it.
- [x] A drop anywhere inside a region counts, not only on the spot's centre.
- [x] The game ends as soon as the other players are gone; neutral spots may remain.
- [x] Soldiers marching toward each other on the same road fight when they meet (the larger force keeps the difference).
- [x] Population bar across the top: each player's share of soldiers.
- [x] Hard computer level. Computers are capped at moves per minute: Easy 6, Normal 10, Hard 16.
- [x] Computers move reinforcements from spots away from the front to their front line.
- [x] Feedback notes sync to the family table once signed in (see PR notes).

## Built in round 3 (from all open notes), with the decisions taken

- Routes: a drop on a region without a direct road sends soldiers through your own spots, one hop at a time. Soldiers pass through without joining the garrison.
- Reinforce: a drop on one of your own spots moves the dragged soldiers there, by road or through your spots.
- City upgrades: tap your city to upgrade. Level 2 costs 15 soldiers (growth 2.0/s, cap 30); level 3 costs 30 (growth 2.6/s, cap 45). Cities stop growing at their cap. Stars show the level. Taking a city resets it to level 1. The tier ladder and unlocks are set in round 4 below.
- Countdown: 3, 2, 1, Go before soldiers move.
- Population line: territories:soldiers per player (per team in team mode), with the send % button above it.
- Team mode: Level 4 with Teams on. Players 0 and 1 are one team, 2 and 3 the other. A red divider separates them. The win is for the last team standing. Computers never attack their teammates and gang up on a player with more than half the soldiers.
- Avatars: 🐥 🦆 🐻 🐿️ 🐭 🦡 for the players, shown on the population line. Map icons are unchanged.
- "Mark done" in the game adds the `Done- ` prefix, as the skill does.

## Needs a decision first (see convo v0.2 and v0.3)

- [x] **Cities: tiers.** Built: village 20, town 40, city 60, metropolis 100 (round 4 below, final caps in round 6). Still open: what each tier unlocks beyond growth and the cap.
- [x] **Team mode by level.** Built: Levels 4, 6 and 8 have fair teams, up to 3 here (round 4 below). Each team shares one colour.
- [ ] **Baby-animal avatars** instead of the fungi for each team. Decide: which animals, and whether the avatars replace the map icons or appear only on the team card.
- [x] **Dragon drop through unlinked spots.** Decided yes: a drop routes along roads through your own spots. Built, and Jimmy confirmed it works well (2026-11-03).
- [ ] **AI strategy in team games.** Decide after team mode exists.

## Round 4: notes read 2026-11-03 (18 open notes on 13 map records)

Checked against `js/game.js` and `js/store.js`. Notes stay `open` in the table until Jimmy confirms which are handled (convo v0.3).

Built in round 3 and confirmed in code: drop anywhere on a region, multi-drag, routes through own spots, reinforce, the 3-2-1-Go countdown, the population line with send %, team mode with a red divider, hard level and move caps, the Done- prefix.

Built from convo v0.3 answers. The defaults I picked are listed in convo v0.3 for Jimmy to check.

- [x] **Five more maps.** Levels 5 to 9: 12, 14, 16, 18 and 20 spots, with 3 to 5 cities and 1 to 3 fortresses. Each field is 1.5 screens wide and pans (drag on empty ground, or the mouse wheel). Level list in `js/map.js`.
- [x] **Fortresses.** New spot type (🏯). Neutral garrison 18 to 22, grows 0.5 a second once owned, stops at 40. Players reinforce them like any spot.
- [x] **City tiers.** Village 20, town 40, city 60, metropolis 80 garrison caps. Upgrade costs 50% of the next tier's cap: 20, 30 and 40 soldiers. Rates 1.5, 2.0, 2.6 and 3.2 a second (3.2 is my pick). Capture resets a city to village.
- [x] **Teams by level.** Level 4 and Level 6: 4 players in 2 teams of 2. Level 8: 6 players in 3 teams of 2. Each team shares one colour; no badges. The Teams setting is gone.
- [ ] **Zoom.** Inward zoom at level 10. Not built: Jimmy said he is still planning it.
- [ ] **Test note** (`Test note 1`, Level 4 Valley). Nothing to build. Mark done when Jimmy confirms.

## Round 5: notes read 2026-11-03 (9 open notes, 6 of them on Level 5)

Checked against `js/game.js` on `main`. Notes stay `open` in the table until Jimmy confirms which are handled (convo v0.4). The app had already marked the round 3 notes `Done- `.

- [x] **Soldiers fight when they collide en route** (Level 2, note `31eec771`). Built: `clashOnRoads`. Roads only meet at spots, so armies can only meet head-on on one road.
- [x] **Race-track countdown on every start** (Level 4, note `4e91a3a2`). Built in round 3 (3, 2, 1, Go).
- [x] **Assistant marks tasks done** (Level 5, note `f1f02147`). Process note, not a game feature. Done when built: todo items are ticked in the same change, and notes are marked done after Jimmy confirms. Recorded in the brief.
- [x] **All territories can be upgraded; capture drops the grade** (Level 5, note `598aba02`). Built with my defaults: a mushroom upgrades to a town-tier city (20 soldiers); a metropolis becomes a fortress (40 soldiers); a captured city drops one grade. Question 1 in convo v0.4 has the defaults to check.
- [x] **Fortress levels** (convo v0.6, question 7). Built: three levels, cap 120 / 160 / 200, range 120 / 140 / 160, shooting 2 / 4 / 6 a second. Tap a fortress to grow it. Costs 80 and 100 for the steps, 60 to convert a metropolis. Times 80 s and 160 s. A captured fortress drops one level.
- [x] **Final tiers** (Jimmy, convo v0.6). Village 20, town 40, city 60, metropolis 100; fortress 120, 160, 200. Costs half the next cap; each upgrade takes double the previous time, from 5 s for the town.
- [x] **Fortresses shoot** (from convo v0.4, question 1). Built: enemy soldiers inside 120 map units of an owned fortress stop and lose 2 a second. The ring shows while you own it. Range and damage are my defaults, to check.
- [x] **Simple mushrooms are villages** (Level 5, note `bed5a34f`). Built: mushrooms are the smallest village, capped at 20. Upgrading one makes it a town-tier city.
- [x] **Surrender for AI and user, with a toggle in settings** (Level 5, note `62214856`). Built: outnumbered 10 to 1 gives up, when Surrender is on in ⚙️ (off by default). Spots go neutral with their soldiers. Still open: default on or off, and neutral versus strongest rival.
- [x] **Upgrades take longer each tier, pause army growth, and show dust** (Level 5, note `ca529eea`). Built: each upgrade takes double the time of the one before, from 5 s for the town (town 5 s, city 10 s, metropolis 20 s, fortress 40 s, then 80 s and 160 s for the fortress steps). Costs are half the next tier's cap. No army growth meanwhile. Cost paid at the start; capture cancels. A dust puff shows the upgrade.
- [x] **Levels 10 to 15: multiplayer, denser maps** (Jimmy, convo v0.4). Built: 4 to 6 flags, 30 to 52 spots, on a field two screens wide.
- [x] **Zoom and minimap** (Jimmy, convo v0.4; round 4 zoom item). Built: + and − buttons, Fit, two-finger pinch. The minimap appears when the zoomed view scrolls; tap or drag it to move the view.
- [ ] **Zoom out to fit a bigger map, spots keep their size** (Level 5, note `ee7f`). Partly built: Fit shows the whole field. Open: spots shrink with zoom (44 px minimum), so they overlap on dense maps. Question 5.
- [ ] **Test note** (`4a1aa905`, Level 4 Valley). Nothing to build. Mark done when Jimmy confirms.

## Round 6: notes read 2026-11-04 (3 open notes)

Checked against `js/game.js` on `main`. Notes stay `open` in the table until Jimmy confirms (convo v0.6). Nothing here is built yet.

- [x] **Team members keep their own colour** (Level 4, note `bc30ae86`, 2026-11-04). Built: every player keeps their player colour on territories, cities, armies and the minimap, in teams too. The team shows on the population line (team segment colour and avatars) and by the red divider. Default chosen; convo v0.6 question 1 asks you to confirm.
- [x] **Zoom out to fit, spots keep their size** (Level 5, note `ee7f`). Built: spots keep the same size on screen at any zoom, so they overlap on dense maps when zoomed out. The 44 px minimum is no longer needed. Confirmed by Jimmy (convo v0.6, question 2).
- [ ] **Test note** (`4a1aa905`, Level 4 Valley). Nothing to build. Mark done when Jimmy confirms (convo v0.6 question 3).

## Round 7 (version 2.14): provinces, terrain, rivers, upgrades (convo v0.13)

Built with the defaults listed in convo v0.13 for Jimmy to check.

- [x] **15 provinces per nation.** Every nation is split into exactly 15 provinces (convo v0.13).
- [x] **Neutral terrain between provinces.** Lakes (3), dense forests (6) and mountains (6) are neutral Voronoi cells. Troops cross them at a cost: lake 2 steps and 10% of the army, forest 1 step and 5%, mountain 1 step (and +1 defence on the slope).
- [x] **Rivers along the province borders.** Two rivers, drawn along the borders they follow; crossing one costs a step, as before.
- [x] **Zoomed in looks like version 1.** The 🍄 🏘️ 🏰 🏯 icons, with terrain icons when zoomed.
- [x] **AI chooses the province to upgrade** (card buttons), and zooming in lets you tap a pop centre or its ⬆ arrow to upgrade it by hand, paid in gold.
- [x] **Soldiers buy out their contracts or are disbanded for gold,** which pays for upgrades.
- [ ] **Soldiers per province.** Soldiers are still one pool for the nation. Each province holding its own soldiers is open (convo v0.13 question 2).
- [ ] **City to fortress in gold.** Still paid in stone (convo v0.13 question 3).

## Later

- [ ] **Village and country zoom.** Zoom and minimap are built (round 5). The country view beyond Fit is unplanned.
- [ ] **Balance pass.** Hard mode beat a player who did nothing in about 20 seconds in testing. Play a few full games and tune the rates, garrisons and move caps.
- [ ] **Speed and defense boosts, towers, spells, Quick Game** (already listed on the Shop page as coming soon).
