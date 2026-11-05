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
- [x] **City to fortress in gold.** Built in round 9: gold, food and stone (convo v0.14, from Jimmy's direction).

## Round 8 (version 2.15): seeded maps, a small start, neutral land

- [x] **Maps from a seed.** Type a map seed next to New country to make that map again; blank is random. The seed is shown in the log.
- [x] **Start small.** Each nation starts with two villages and a town near its capital. The other 12 provinces in its region are neutral.
- [x] **Claim neutral land.** Tap a neutral province to claim it with a share of your army. Its garrison (2 to 6 soldiers, growing back slowly) defends it.
- [x] **Cautious neutral nations.** Neutrals claim, attack and declare less often than the other computer nations, need a bigger lead, and rarely ally.
- [ ] **Balance.** Claim and garrison numbers are first guesses. Play full games and tune them.

## Round 9 (version 2.16): directions, costs, population (convo v0.14)

Built from Jimmy's direction, with the defaults listed in convo v0.14 for you to check.

- [x] **Directions: Growth, War, Wealth.** One picker on the nation card replaces the AI upgrade buttons. An autopilot spends each turn towards the direction (for every nation; yours logs each action).
- [x] **Population from cities.** Village 1, town 2, city 3, fortress 3. Shown on the bar and card; power uses it.
- [x] **Costs use several stocks.** Upgrades and villages cost gold and food (fortresses also stone). Neutral claims cost troops, gold and food. Attacks cost mainly troops and magic, plus gold and food for the march.
- [x] **Magic spent per soldier sent** (up to 0.5 a soldier), not all at once.
- [x] **Gold follows population** (village 1, town 2, city 3 a turn). Fixed Growth stalling on gold.
- [x] **Fortress province defence +2.** Holding ground is what fortresses are for.
- [ ] **Food under Growth piles up** (several hundred by turn 40). Doubling soldier upkeep starved War, so it is reverted. Open: convo v0.14 question 2.
- [ ] **War is the risky direction.** Played with no hand moves, one map in 30 falls to counter-attacks. Open: is that fair, once you play it by hand (convo v0.14 question 5).
- [ ] **Guns under War.** Your slider stays yours; War sets only the computers' guns. Open: convo v0.14 question 1.
- [ ] **Wealth stock sits unused** once the reserve is full. Open: convo v0.14 question 3.
- [ ] **Balance pass.** Six maps, 40 turns, no hand moves: the three directions now differ (see convo v0.14). Play real games before tuning again.

## Round 10 (version 2.17): allies attack together (convo v0.15)

- [x] **Allies join one attack.** Every ally at war with the target, and able to reach it, joins a lead nation's attack as one army. Each sends the lead's share and pays its own march and magic.
- [x] **No friendly fire.** Allies are not at war, so they never fight each other.
- [x] **Slight penalty.** 5% less strength for each nation beyond the first, at most 20%.
- [x] **One joint attack a turn.** A nation that has already attacked does not join a second order.
- [x] **The card shows who joins** and the penalty.
- [ ] **Open:** the penalty size, who joins (at peace, or pulled in by a declaration), and how a joint capture is split (convo v0.15, questions 1 to 3).
- [ ] **Open:** the War plan counts the lead nation alone when choosing an attack, not its allies.

## Round 11 (country 2.18, V4 4.3): magic, food, replay speed (convo v0.16)

- [x] **Replay after a victory, with speed** (V4 4.3). Watch the replay at 0.5×, 1×, 2× or 4×, with Pause and Stop. Orders are blocked during the replay.
- [x] **Fortresses make magic:** 25 a turn each. Only fortresses; villages, towns and cities no longer make magic.
- [x] **Magic spent on attack or defence:** up to one per four soldiers, adding one soldier's worth of strength each. The stock holds a quarter of the army.
- [x] **Food from cities:** village 2, town 4, city 6, fortress 3 a turn. Soldiers eat 0.05 each. Thin food slows recruiting.
- [ ] **Open:** the "100%" in the magic rate, fortress food upkeep, magic decay, and army size tied to population (convo v0.16 questions 1 to 3).
- [ ] **Open:** check the army size over full games (about 10,000 soldiers near the end).

## Round 12 (country 2.19): science, research, food (convo v0.17)

- [x] **Science** from cities (2), towns (1), villages (0.5) and fortresses (1.5). No cap.
- [x] **Research tracks:** Agriculture (+8% food a level), Civics (+5% population a level), Arms (+60 army cap a level). Costs rise each level.
- [x] **Army hard cap** from Arms. Recruiting stops at the cap.
- [x] **People eat** 0.5 food a turn each. Population has no cap.
- [x] **Food top-up is manual** (version 2.20): Buy 10 food with gold or stone. Computer nations buy food themselves when short.
- [x] **Soldiers eat first** (the top line), then people. Hunger raises unrest.
- [x] **The land caps the army:** 14 soldiers a province, and the Arms track can lift the cap only as far as the land allows.
- [ ] **Open:** Growth still has a food surplus (convo v0.17 question 1). Science curve and Arms cost (question 2). Auto or manual top-up (question 3).

## V4 round 4 (version 4.2): battlefield generator

- [x] **Battlefield generator** on the setup screen: field size, settlement openings, river, hidden units, default approach, roads, tall grass, fronts and flanks, fatigue. Saved in the request.
- [x] **Random balanced teams** (🎲 in Armies).
- [x] **2 × 2 field** with a camera, a mini map in the upper left, and pad controls.
- [x] **Walled settlements** with 2 to 4 openings, sited at two thirds of the map. Units path to gates.
- [x] **Roads** (faster travel) and **rivers** with bridges (chokepoints) or fords.
- [x] **Hiding in woods and tall grass**, and an ambush **⚔ Strike!** pop-up (or automatic) with a burst.
- [x] **Default approach** to the flank, the middle, or the enemy base.
- [x] **Reading the ground**: outnumbered cavalry and ranged units fall back; melee waits for friends.
- [x] **Fronts and flanks** for squads and battalions, and **fatigue** from terrain and fighting.
- [x] **Deselect after an order.**
- [ ] **V4 balance pass, round 4.** The matrix is still polarized and the new features are not tuned. See "Balance notes (round 4)" in `V4/schematic.md`.
- [ ] **V4 camera drag and pinch.** Pan is by the pad and the mini map only.

## V4 round 5 (version 4.3): routes, formations, third team, defending

- [x] **Planned marches** as dashed lines, and a dashed ring where a stopped unit will stand.
- [x] **Editable routes.** Tap to add points, drag to move them, tap a line to insert one. Planning only (deploy or paused).
- [x] **Two formations** per side, arranged by role (front, archers in the middle, cavalry on the flanks). A formation takes one command, and its units keep their places.
- [x] **Third team and allies.** Allied teams share vision and win together.
- [x] **Defending.** You can be the attacker, the defender or the third team. Random teams sets it too.
- [x] **Random teams** for every team, with numbers that scroll to adjust.
- [x] **Geography button** with its own seed, and toggles for woods, grass, roads, walls and the river.
- [x] **Collapsible panels** on the setup and battle screens.
- [x] **Kills by unit type** in the result and replay report (V4.4).
- [x] **Archer nerf** (damage 0.5 to 0.35; V4.4). Archers still beat most types at range; revisit after play.
- [ ] **V4 balance, round 5.** The third team, the formations and defending are not tuned.
- [ ] **Multi-point formation routes.** A formation takes one point; each unit's route is its own.

## Home and scales (hub round)

- [x] **Home screen: three scales and an archive.** Unit scale (the battle), province scale, country scale. Archive holds the original spot game.
- [x] **Version labels removed** from the screens. Scales are named by what they are.
- [x] **Notes on every scale.** The ⚙️ panel saves a note to the family database (`xw_notes`) with the screen it was written on. Notes written while signed out wait on the device and send on sign-in.
- [x] **Unit scale: two of each type per side.** Set-up, the random teams and the validator all enforce it.
- [x] **Units take room.** They keep a footprint clear of each other.
- [x] **Walled settlements hold a set number.** Village 4, town and city 8, fortress 12. Units beyond that stand outside, with no shelter or wall sight.
- [x] **Walls shelter the inside.** Arrows from outside do half damage, and the inside is seen from outside only up close.
- [x] **Unit icons are three times larger** to tap.
- [ ] **Province scale: port the current rules.** It is a copy of the original spot game for now. The current country rules (soldiers pool, garrisons, upgrades, the turn clock) still need to come across.
- [ ] **Balance after footprints.** The matrix changed (pikemen mirror now to the attacker; cavalry weaker against pikemen). Not re-tuned.

## Later

- [ ] **Village and country zoom.** Zoom and minimap are built (round 5). The country view beyond Fit is unplanned.
- [ ] **Balance pass.** Hard mode beat a player who did nothing in about 20 seconds in testing. Play a few full games and tune the rates, garrisons and move caps.
- [ ] **Speed and defense boosts, towers, spells, Quick Game** (already listed on the Shop page as coming soon).
- [x] **V4 battle view: sandbox built** (phases 0 to 4): `V4/`, with rule tests in `V4/tests/sim.test.js`. Not linked from V2.
- [ ] **V4 phase 5: link battles into V2.** Needs the contract agreed and one change in `js/country.js` behind a setting. Not started.
- [x] **V4 round 2: custom battle.** Replay fixed by fixed steps. Vision and fog, defender plan, attack and rush moves, morale rally. Tests: `node V4/tests/sim.test.js` (19 checks).
- [ ] **V4 balance pass.** With the defender planned, the defender has a clear edge (pikemen mirror about 83% to the defender). Catapults and archers look strong. See "Balance notes" in `V4/schematic.md`.
- [ ] **V4 replays to the family database.** Each finished battle is saved on the device, then pushed to table `xw_replays` once signed in (`V4/js/replays.js`, migration `supabase/003_xw_replays.sql`). The rollback test passed. The migration is NOT in the Family project: the apply call timed out waiting for a server-side confirmation, and a later check found no `xw_replays` table. Re-run `supabase/003_xw_replays.sql` in the Family project, then check a sign-in push. V4 sign-in is in the ⚙️ panel.
- [ ] **V4: confirm the morale reads** ("taking pause" as standing still, "or die" as an enemy dying nearby, 0.5 a second recovery).
- [ ] **V4: confirm after first games.** Battle caps (120 s, and 5 min at country scale), tile distances per scale, the 20 to 1 surrender ratio, and the country grain (100 or more). See "To confirm later" in `V4/schematic.md`.

## Combined scale (in progress)

- [x] **Combined folder.** `combined/` is its own game, rebuilt as small files (largest under 200 lines). The original scales are untouched. File map: `combined/README.md`; design: `combined/schematic.md`.
- [x] **One world.** A single JSON world holds nations, provinces with garrisons, marches, the battle being fought, and the clock. Every scale reads and writes it; a reload comes back to the same scale and battle.
- [x] **Zoom chain.** Country → province (the button on a province's card, or wheel or pinch in) → battle (⚔️ between two neighbouring provinces), and back up by the crumbs, the minimap, or wheel or pinch out. Each transition hands its state back to the world.
- [x] **Time dilation.** One world clock: ×1 on the country map, ×0.2 in a province, ×0.05 in a battle. Set in `combined/js/world/config.js`.
- [x] **Battle engine split** into 12 files. It gives the same results as `V4/` on 160 test battles; its 51 tests pass.
- [x] **Saving.** On this device after every turn, scale change and battle; to the family database as one row per world (`xw_worlds`).
- [ ] **Apply `supabase/004_xw_worlds.sql`** to the Family project (rollback test: `supabase/test_004_xw_worlds_rollback.sql`). Until then ⚙️ says the world is saved on this device only.
- [ ] **Decide** the open questions in `combined/schematic.md`: dilation values, where soldiers live, country attacks as battles, growth outside the window, battle size.
- [ ] **Rebalance** after real games on the iPad.

## Combined round 2: first-playthrough notes (read 2026-11-05)

Copied from the Family database (`xw_notes`, page Combined, 14 notes, turn 160). Marked `done` in the database on 2026-11-05, as read (the status column only allows `open` and `done`). Plan and questions: `combined/plan-round-2.md`.

- [ ] **Time.** Country turn half as fast (120 s). Province time half as fast. Fortress fights get double dilation. ×2 fast-forward at country and province.
- [ ] **Province view.** Select provinces, not population centres. Click and drag to move troops.
- [ ] **Country route orders.** Tap a source, then a target, through neighbours. Moves the chosen share.
- [ ] **Muster once a turn.** The +10 from the field army button is limited (question 2).
- [ ] **Food.** Garrisons and the field army eat. War uses much more food.
- [ ] **One army cap.** Field army and garrisons count together.
- [ ] **Garrisons to the border.** Move garrisons toward hostile borders first, then neutral (question 4).
- [ ] **Towers.** Slow attackers to 50% and keep shooting. Upgrade doubles the range.
- [ ] **Walls from town up.** Villages get no settlement wall.
- [ ] **Allies fold in.** Soldiers marching into an ally's province join its garrison instead of vanishing (bug).
- [ ] **Province fights.** Risk-like dice, or unit battles for fights (question 1).
- [ ] **Field army trips.** A set number of trips per turn (question 3).
