# Expansion Wars — Convo v0.16 (version 2.18 and V4 4.3: magic, food, and replay speed)

**Project:** Expansion Wars
**Round:** 17. Direction from Jimmy, built with the defaults below for you to check. Answers go inline under the questions.

## Direction from Jimmy

- **Replay after a victory** with a playback speed, so the battle can be watched again.
- **Fortresses make magic**, usable to attack or to defend. Magic adds to the army's strength at a rate of **one to four**: with 100 soldiers, up to 25 magic gives 125% strength.
- **Magic rate:** near the endgame (about 10,000 soldiers), the stock should fill in about 10 turns to 2,500 magic, which is 250 a turn. With about 10 fortresses, each fortress makes about 25 a turn.
- **Food** should come more from cities, and food should be a bigger limit on how big the army can be.

## What is built (defaults I picked, to check)

**Replay (V4 4.3).** After a victory, a **▶ Watch the replay** button replays the same battle from its request and orders, at **0.5×, 1×, 2× or 4×**, with Pause and ■ Stop. Orders are blocked during the replay. Tested headless: at 4× the battle runs 80 ticks a second, at 0.5× 10, and it ends on the live battle's tick and returns to the result. The replay is V4 only: country battles resolve at once and have no animation.

**Magic (version 2.18).**
- Only fortresses make magic: **25 a turn each**. Villages, towns, cities and the tech trickle no longer make magic.
- A stock holds at most **a quarter of the army**. At 10,000 soldiers that is 2,500.
- An attack or a defence spends **up to one magic for every four soldiers** (a quarter of the army), and each point adds one soldier's worth of strength. 100 soldiers with 25 magic fight as 125.
- Defenders spend their magic on the same rule. The log says when.

**Food (version 2.18).**
- Food per turn: village 2, town 4, city 6, fortress 3 (was 2, 3, 3, 2). Cities feed the army most.
- Each soldier eats **0.05 food a turn** (was 0.02).
- **Thin food slows recruiting:** a nation recruits at full pace only while its food stock is at least half a food a soldier. Below that, recruiting slows in step.

## What the simulation showed

Six maps, 40 turns, no hand moves, after the changes:

- **Growth:** about 41 population, about 35 provinces, about 850 soldiers. Food is around 450. The army now levels off where food covers it.
- **War:** about 10 population, about 10 provinces, about 1 fortress, about 215 soldiers, no falls.
- **Wealth:** about 28 population, about 11 provinces, food about 310.
- No negative stocks, no page errors.

Forty turns is far short of 10,000 soldiers, so the endgame numbers are still to be checked in full games.

## Does the magic rate make sense?

Yes, on your numbers. 10 fortresses at 25 each is 250 a turn, so a quarter of a 10,000 army (2,500) fills in 10 turns, as you described. Two things to check:

- **The stock cap is a quarter of the army.** Magic made beyond the cap is lost, so a player with more fortresses than the army can use wastes some. That is a choice: it rewards keeping the army and the fortresses in step.
- **The "100%" in your note.** I read "one to four" as one magic for every four soldiers, which gives your 125% example. If you meant something else by the 100% part (for example, a rate that doubles the strength at some point), tell me and I will change it.

## Other tweaks I would consider

1. **Fortresses could cost food upkeep** like soldiers do. Then a fortress is a real trade: magic and defence against food.
2. **Magic could decay** a little each turn, so hoarding is not free. Without it, the 25% cap is the only limit.
3. **Army size could track population,** not just food stock, so a big army needs cities as well as farmland.

## Questions

1. **Magic rate.** Is one magic for every four soldiers (25% at a quarter of the army) the rate you meant? See the note above on "100%".

   > **Jimmy:**

2. **Food upkeep.** Should fortresses also eat, and should the other tweaks above be built now?

   > **Jimmy:**

3. **Replay.** Should the replay button also show after a defeat, or only after a victory as asked?

   > **Jimmy:**

## Still open

Convo v0.14 and v0.15 questions are unanswered. Food under Growth now levels off at a food buffer of about half a point a soldier, which is the recruiting rule, not a bug.

---

_Answers go inline above. Once a round is complete, the next version starts a new file._
