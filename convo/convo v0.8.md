# Expansion Wars — Convo v0.8 (power score and how to judge a game)

**Project:** Expansion Wars
**Round:** 9 — a first power score and a way to judge games, so you can play a few and we can tune from what happens. Answers from Jimmy go inline under each question.

## Power score, version 0 (a starting point, to be tuned)

For each nation (or, in today's games, each player):

- **Density D** = (villages + 2 × towns + 3 × cities + 5 × fortresses) ÷ provinces. It is how many weighted spots a nation holds for each province.
- **Quality Q** = 1 + (technology + morale + happiness) ÷ 300. Each is 0 to 100. From the first game onward these are set at 0, so Q = 1. They come in with the country layer.
- **Power PS** = D × Q × soldiers. Soldiers are the total on the nation's spots and armies in flight.

In today's games, a province is one map, so D is the spots weighted by type, divided by the number of players' starting spots. The number is only meant to compare players inside one game.

**Ladder stage.** A nation's stage comes from its ratio R = PS ÷ median PS of all nations:

| Ratio R | Stage | What the provinces look like |
|---|---|---|
| under 0.7 | Early | Villages, one or two towns |
| 0.7 to 1.3 | Growing | Towns and cities |
| 1.3 to 2.0 | Strong | Cities, some fortresses |
| over 2.0 | Veteran | Fortresses past the 200 cap; the cap rises with the veteran tier |

The thresholds are guesses. The table above is what we tune after you play.

## How a game counts as a success

A game is working if most of these hold. Each one is a number the log can show.

1. **Length.** A 4-player game ends in 15 to 30 minutes.
2. **Lead changes.** The top nation changes at least once before the end.
3. **No dead nations.** No nation sits under R = 0.3 for more than 5 minutes unless it chose to surrender.
4. **Peace early.** At least half the time in the first 10 minutes has no active war between nations. (Applies once the country layer is in; for now, count the time before the first attack.)
5. **Cross-border first.** The first attack of each war is across a province border.
6. **Battles are short.** A battle lasts under 2 minutes. (Battles pause the country clock; see below.)
7. **No runaway.** The top nation's R stays under 3 for the first 2/3 of the game.

## What the log records

Every 60 seconds of country time (once there is one), and at each event:

- **Per nation:** villages, towns, cities, fortresses, soldiers, the power score PS and the ratio R, the stage, and the number of wars.
- **Events:** a battle starts or ends (who, where, how long, who won), a capture, an upgrade, a surrender, a war declared, a ceasefire, a trade route.
- **Game:** the duration, the winner, the lead changes, and the success checks above.

For the games you play now, a "nation" is a player, and the country clock is the battle clock. The log is saved on the device, and ⚙️ gets a "Copy game log" button so you can share it with me.

## Questions

1. **Power formula.** Is D × Q × soldiers the right shape, or should soldiers count less (or more) than the land they hold?

   > **Jimmy:**

2. **Stage thresholds.** Are 0.7, 1.3, 2.0 and 3.0 the right breaks for early, growing, strong and veteran?

   > **Jimmy:**

3. **Success checks.** Which of the seven checks matter most to you, and is 15 to 30 minutes the right length?

   > **Jimmy:**

4. **Logging.** Should I build the game log and the "Copy game log" button now, so you can play a few games and send the logs back? Or wait until the country layer exists?

   > **Jimmy:**

5. **Which games.** Play a 2-player and a 4-player game on Level 4 and Level 8 (the team levels), and one on Level 10 (multiplayer)? Or a different set?

   > **Jimmy:**

---

_Answers go in `convo/convo v0.9.md` once this round is complete._
