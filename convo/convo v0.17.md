# Expansion Wars — Convo v0.17 (version 2.19: science, research tracks, food)

**Project:** Expansion Wars
**Round:** 18. Direction from Jimmy, built with the defaults below for you to check.

## Direction from Jimmy

- **Food is scarce.** There should be a way to invest growing amounts into **science**, and science raises **population, food and military**.
- **Military strength has hard caps.** Population and science can grow without limit.
- **Science** comes mainly from cities, and also from fortresses.
- **Food should never leave a nation stuck.** Other resources can be turned into food, so an army can always move or declare war.

## What is built (defaults I picked, to check)

**Science.** Made each turn: village 0.5, town 1, city 2, fortress 1.5. It has no cap. It is shown on the bar and the card.

**Three research tracks**, each one level at a time. The cost of the next level is 10 × 1.15 to the power of the current level (so level 10 costs about 40, level 20 about 160, level 30 about 660).
- **Agriculture:** +8% food a level.
- **Civics:** +5% population a level. Gold follows population.
- **Arms:** +60 to the army's **hard cap** a level. The army starts with a cap of 60.

**Army cap.** Recruiting stops at the cap. Population and science have no cap; the army does.

**Population eats.** Each point of population needs 0.5 food a turn, so growing people needs food.

**Food top-up.** When food falls below 5, gold (2 for 1 food) and then stone (3 for 1) are turned into food. The player also has a **Buy 10 food (20 gold)** button. This keeps an army able to march and declare war.

**Directions** choose research: Growth takes Civics then Agriculture, War takes Arms then Agriculture, Wealth takes Agriculture then Civics and waits until it has twice the science. The autopilot researches one level a turn.

**Version 2.19** in ⚙️.

## What the simulation showed (six maps, 40 turns, no hand moves)

- **War:** food sits at the floor and the top-up buys food every turn. This is what "food is scarce" looks like.
- **Growth:** population about 71, army about 430, but food still builds to about 620. Its research and cities out-produce its people. Food is not yet scarce for Growth.
- **Wealth:** population about 43, army about 345, food about 460.
- No negative stocks, no page errors.

## Questions

1. **Food for Growth.** Growth still has a food surplus. Should cities produce less food (which goes against the last round), should people eat more, or should Growth spend food on something?

   > **Jimmy:**

2. **Science costs.** Is 10 × 1.15 to the power of the level the right curve? Should Arms cost more than the others, because it is a hard cap?

   > **Jimmy:**

3. **Food top-up.** Should gold and stone turn into food automatically (as now), or should only the Buy button do it, so the player decides?

   > **Jimmy:**

## Still open

Convo v0.14 to v0.16 questions are unanswered: directions and guns, food under Growth (again, see question 1), the Wealth stock, the risk of War, fortress strength, the "100%" in the magic rate, fortress food upkeep, magic decay, and army size over full games.

---

_Answers go inline above. Once a round is complete, the next version starts a new file._
