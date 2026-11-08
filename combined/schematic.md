# Expansion Wars — Campaign (schematic)

**Status:** version 3.0. Not device-tested. Numbers are carried over from the three scales and not rebalanced.
**Files:** see `README.md` for the file map and where to change what.

## Goal

One game in three zoom levels. Zoom in from the country to a province, and from a province to a battle. What you do at any level changes the same world, so it shows at every other level. Each level runs at its own speed (time dilation).

## Modes (version 3.0)

The campaign is the whole game: all three scales in one world. Three battle modes use the same rules and views, each showing one scale, with a world and a save of their own (`js/app/modes.js`):

| Mode | Page | Shows | Country turns |
|---|---|---|---|
| Campaign | `index.html` | country, province, unit | yes |
| Unit battles | `index.html?mode=unit` | unit: a new battle between two of your provinces each time | no |
| Province battles | `index.html?mode=province` | province, as a ladder of levels (a small map and one opponent first); the whole map; fights in rounds, no battles to join | no |
| Country battles | `index.html?mode=country` | country: turns, diplomacy, war, fights in rounds | yes |

Province fights have two models, set by the mode (`FIGHT_MODEL` in `js/world/config.js`): the campaign and the country mode use **risk rounds** (every soldier rolls, round after round); province battles use **three phased turns** (waves of 20%, 50% and 30%, with morale and routing; `PHASED` in `js/province/config.js`).

## One world (single source of truth)

Everything that matters lives in one plain JSON object, the world (`js/world/state.js` documents every field). The country map, the province close-up and the battle all read it and write it. Views keep only their drawing; reload the page and the world brings you back to the same scale, province and battle.

What the world holds:

- **Nations:** stocks, research, direction, and the **field army** (`soldiers`), as at country scale.
- **Provinces:** the country map's cells, each with an owner, a tier (empty dot, village, town, city, fortress) and a **garrison** (`gar`): the soldiers stationed there. New.
- **Marches:** soldiers on the road at province scale.
- **The battle being fought:** its request and every order given, with the step it was given on. The engine is deterministic, so the battle is rebuilt exactly from these after a reload.
- **Finished battles, relations, the order queue, the log, the clock, and where you are looking.**

A soldier is always in exactly one place: a field army, a garrison, a march, or a battle. The tests check that province play neither makes nor loses soldiers.

## The three scales

| Scale | What you see | Time | What you do |
|---|---|---|---|
| Country | the whole map | turns of 60 world seconds | diplomacy, economy, research, claims and attacks (resolved at the end of the turn) |
| Province | the province you zoomed into and the provinces up to two steps from it | real time | station soldiers (muster from the field army), send them along roads, take neutral land or land of a nation you are at war with |
| Unit | one battle between two neighbouring provinces | the engine's fixed steps | order your units; pause; 1×, 2×, 4× |

The province close-up is the same map as the country, zoomed in, so they cannot disagree. Roads run between provinces that share a border. Lakes, forests and mountains are drawn but have no roads at province scale.

## Links between the scales

- **Country → province.** A province's garrison grows in real time while you watch, drawn from its nation's field army up to the tier's cap. Peace and war come from the country: you can only march into neutral land, or land of a nation you are at war with.
- **Province → country.** A capture at province scale changes the owner at once, through the one capture rule (`world/rules.js`): taking a nation's land drops it one grade and leaves it occupied, as at country scale. Garrisons join the defence when a country attack reaches that province; survivors of a lost garrison fall back to the field army.
- **Province → unit.** Select one of your provinces and a neighbour, then **⚔️ Battle**. The soldiers sent and the defending garrison become the two armies: at most 10 dots a side, up to two of each type, so one dot stands for several soldiers (the battle's grain). The settlement is the province's tier. There is no town bell: no defenders appear from outside the garrison.
- **Unit → province.** The winner holds the province with what it has left. Losing attackers go back to the province they came from. Leaving a battle early lets the computer fight the rest, and the result is applied the same way.
- **Leaving a province.** Every march lands at once, so no soldiers are left on a road the country map cannot show.

## Time dilation

One world clock, in world seconds (`js/world/clock.js`). Each real second adds the rate of the scale on screen (`js/world/config.js` RATE):

| Scale | Rate | A country turn takes |
|---|---|---|
| Country | ×1 | 60 s |
| Province | ×0.2 | 5 min |
| Unit | ×0.05 | 20 min |

So the country waits while you fight. Province time runs only for the window you look at; the rest of the world moves on country turns. Ready (country map) ends the turn at once.

## Saving

- **This device:** after every turn, scale change and battle, every 10 s, and when the page is hidden.
- **Family database:** the whole world as one row in `xw_worlds` (migration `supabase/004_xw_worlds.sql`), written whole each time, at once after a turn or a battle and otherwise at most once a minute. Sign in from ⚙️ (the shared notes sign-in). ⚙️ also loads the latest world from the database. Not signed in, or the table not there yet: the game carries on, saved on the device, and ⚙️ says so.

## Open decisions

1. **Time dilation values.** ×1, ×0.2 and ×0.05 are first guesses.
2. **Where soldiers live.** Field army and garrisons are separate pools. Should country attacks also draw on garrisons, or should recruits go straight to garrisons?
3. **Country attacks as battles.** Attacks queued on the country map still resolve at once at the end of the turn. Should you be able to zoom into one and fight it?
4. **Province scale outside the window.** Garrisons grow only in the province you are looking at. Should they also grow a little each turn everywhere?
5. **Battle size.** 10 dots a side at most, with grain set by the bigger army. Bigger battles (the large field) are possible.
6. **The database migration** is written and has a rollback test, but is not applied to the Family project.
7. **Rebalance** everything once played: the numbers come from three games built separately.

## Not carried over

The province scale's level ladder, shop, high scores and saved-map records; the unit scale's custom battle setup screen and replays to `xw_replays`. They stay in the original scales.
