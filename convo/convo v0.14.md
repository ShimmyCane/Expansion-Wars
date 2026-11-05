# Expansion Wars — Convo v0.14 (version 2: directions, costs, population)

**Project:** Expansion Wars
**Round:** 15. Direction from Jimmy, built in version 2.16 with the defaults below for you to check. Answers go inline under the questions.

## Direction from Jimmy

- **One north star, not many buttons.** Instead of separate build and upgrade buttons, each nation picks a direction: **Growth, War or Wealth**. The AI anticipates and optimises what gets there.
- **Growth:** expansion and population. Population is made by having more and larger cities.
- **War:** fortresses where they are needed, a bigger army, and trained skills. Magic is consumed as a function of military strength. (This direction is called **War**.)
- **Wealth:** a stockpile of food, gold and stone, kept in anticipation of future growth or war.
- **Costs:** a neutral claim (survey or capture) costs troops, gold and food. A war attack costs mainly troops and magic. Growing costs food and money. Every resource is used somewhere, in smaller amounts.
- **Still by hand:** zoom in and upgrade any province from a dot to a fortress. A fortress mostly holds territory; it adds little population over a city.
- Review the rules and values, and tweak what does not make sense.

## What is built (defaults I picked, to check)

**Directions.** A picker on your nation card: 🌱 Growth, ⚔️ War, 💰 Wealth. Computer nations pick one at random, shown on their card. At the end of each turn the autopilot spends towards the direction, up to two builds or upgrades a turn. Your own moves still come first.

- **Growth:** builds villages on empty dots, then upgrades villages to towns and towns to cities. Claims neutral land with half the army when it can pay the survey. Keeps 5 food back.
- **War:** upgrades cities to fortresses on the front first, then towns to cities. Trains the army (10 food, 5 gold, +2 skill) from a surplus only. Declares war on the weakest neighbour your half-army clearly beats (1.3 times the defence), and attacks an enemy the same way. Keeps 10 food and 5 gold back. Computers set their guns to 80%. You set yours.
- **Wealth:** builds and upgrades only from a surplus (keeps 40 gold, 20 food and 10 stone back). Claims land only with 80 gold and 40 food spare. Computers set their guns to 20%.

**Population.** Village 1, town 2, city 3, fortress 3. A fortress adds no people over a city. Shown on the top bar and the card, and it feeds the power figure.

**Costs.** Each base cost rises 10% for each spot you hold.

| Action | Was | Now |
|---|---|---|
| Village on an empty dot | 40 food or culture | 8 gold and 6 food |
| Village to town | 10 gold | 10 gold and 8 food |
| Town to city | 20 gold | 20 gold and 12 food |
| City to fortress | 15 stone | 20 gold, 10 food and 15 stone |
| Neutral claim | troops only | troops, plus 3 gold and 2 food, and 1 more of each per route step (paid win or lose) |
| Attack | troops and all your magic | troops, plus 1 gold and 1 more per route step, plus 0.05 food per soldier sent |
| Magic in an attack | all of it, +1% strength per 1 magic | up to 0.5 per soldier sent; each point spent adds strength |

- **Gold income** now follows population: village 1, town 2, city 3 a turn (was 0.5, 1 and 2).
- **Fortress defence:** a province that is a fortress adds 2 to its defence, so holding ground is what fortresses are for.
- **Zoomed in:** upgrades by hand cost the same gold and food (and stone for a fortress).

**Version.** 2.16 in ⚙️ with the version log.

## What I tested and changed on review

I played 40 turns on six maps for each direction, with the player making no moves by hand (checked in headless Chromium, no page errors, no negative stocks). Along the way:

- **Growth stalled on gold while food piled up.** Gold was the bottleneck, so the gold income now follows population.
- **War built almost no fortresses.** Training drained food below the cost of a fortress. Training now comes from a surplus only.
- **War never attacked.** It only struck nations already at war with it. It now declares on a neighbour it clearly outmatches.
- **War attacked with half its army, but judged the odds with the whole army,** and lost. The check now uses the half that marches.
- **War piled up wars.** It declared on a second neighbour while the first was still on, and two of 30 maps fell to the counter-attacks. It now declares only when at peace with everyone. One of 30 still falls (seed 1 to 30, no hand moves), so War is the risky direction. Play it by hand to see whether that is fair.
- **Wealth hoarded gold with nothing to spend it on.** It now claims land from a surplus.
- **Doubling soldier food upkeep (0.02 to 0.04) starved War** (food under 10) while Growth still had food to spare. I reverted it. It is question 2 below.

Averages across six maps, 40 turns, no hand moves, after these changes:

- **Growth:** population about 42, about 33 provinces, a big army (about 800 soldiers), food piling up.
- **War:** population about 6, about 5 provinces, about 1 fortress, about 220 soldiers. One map in 30 falls.
- **Wealth:** population about 28, about 10 provinces, and a stock of roughly 105 gold and 175 stone.

## Questions

1. **Directions.** Are the three right, and is "War" the name you want for the military one? Should War also set your guns (the slider stays yours for now)?

   > **Jimmy:**

2. **Food under Growth.** Food piles up (several hundred by turn 40) because soldiers eat only 0.02 food each. Doubling that starves War. Should soldiers eat more with some other change, or should food production drop for everyone?

   > **Jimmy:**

3. **Wealth stock.** When the reserve is full and no growth is possible, the stock just sits. Should Wealth spend it on something (for example, buying a fortress), or is a big stock the point?

   > **Jimmy:**

4. **The autopilot.** It acts for you at the end of each turn, and logs every action. Is that right, or should it only suggest moves for you to press?

   > **Jimmy:**

5. **Fortresses.** A fortress province adds 2 to its defence. Is that enough for fortresses to be worth it, or should it be more?

   > **Jimmy:**

## Still open from convo v0.13

- **Terrain caveats** (v0.13, question 1): the lake, forest and mountain numbers are unchanged. Should the lake cost soldiers or stop them?
- **Soldiers per province** (v0.13, question 2): still one pool for the nation.
- **Rivers** (v0.13, question 4): still a one-step cost, never a block.
- **City to fortress in gold** (v0.13, question 3): answered by your direction. It now costs gold, food and stone.

---

_Answers go in `convo/convo v0.15.md` once this round is complete._
