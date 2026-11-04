# Expansion Wars — Convo v0.6

**Project:** Expansion Wars
**Round:** 7 — notes read from the family table on 2026-11-04 (3 open notes), plus the questions still open from convo v0.5. Answers from Jimmy go inline under each question.

## New notes

- **Teams keep their own colour** (Level 4, 2026-11-04). "The different teams, even though they're different teams should still retain their own color in their own maps." Right now every member of a team shares the team colour, so they look alike.

## Questions

1. **Team colours.** Built: each player keeps their own colour (mint, coral, sun, lavender, peach, pink) on territories, cities, armies and the minimap, in teams too. The team shows on the population line and by the red divider. Is that what you mean?

   > **Jimmy:** Yes.

2. **Spot size when zoomed out** (note from Level 5). "The elements should stay same size." Built: spots keep the same size on screen at any zoom, so on dense maps they overlap when zoomed out. Is that right, or should they shrink?

   > **Jimmy:** Spots should keep their size when zoomed out. As built.

3. **Test note.** The note "Test note 1" (Level 4 Valley) is a test. Mark it done, or keep it open?

   > **Jimmy:**

## Still open from convo v0.5

4. **Surrender default.** Should the Surrender setting start on or off? Default is off.

   > **Jimmy:** Good. Off by default, as built.

5. **Spots when surrendering.** When a side surrenders, do its spots go neutral (as built), or go to the strongest rival?

   > **Jimmy:** Neutral, with the soldier count kept. As built.

6. **Capture mid-upgrade.** The upgrade is cancelled and its cost is lost (as built). Should the soldiers be kept instead?

   > **Jimmy:** Good. Cancelled, cost lost, as built.

7. **Fortress numbers.** Range 120 map units, 2 soldiers a second to enemies in range, and enemies stop in range. Are those right? Should a fortress shoot its own team? (It does not, as built.)

   > **Jimmy:** It only shoots enemies, as built. It should grow all the way up to 200 soldiers. Each growth adds two more and adds 20 range.
   >
   > **My reading:** a fortress grows in steps, up to a cap of 200 soldiers. Each step adds 2 to its damage a second and 20 to its range. Proposed: four steps, cap 40, 80, 120, 160, 200, each step costing 40 soldiers. Base fortress: 2 damage a second, 120 range.
   >
   > **Still open:** confirm the four steps and the 40-soldier cost, and whether "two more" means damage a second.
   >
   > **Jimmy (later):** The fortress goes from 120 to 160 and then to 200.
   >
   > **Jimmy (confirmed):** They are soldiers. Cap 100, then 160, then 200. Range 120, +20 a step. Shooting 2, +2 a step.
   >
   > **Built, with my defaults to check:** three fortress levels. Level 2 costs 80 soldiers and takes 80 seconds; level 3 costs 100 and takes 160 seconds (each cost is 50% of the next cap). Converting a metropolis costs 50 (50% of 100). A captured fortress drops one level. Stars show the level.
   >
   > **Jimmy (later):** Each cost is half of the next, and each upgrade takes double the previous time, starting at 5 seconds for the town. Built: town 5 s, city 10 s, metropolis 20 s, fortress conversion 40 s, fortress level 2 80 s, level 3 160 s.
   >
   > **Jimmy (final tiers):** village 20, town 40, city 60, metropolis 100, then fortress 120, level two 160, level three 200. Built: metropolis cap 100 (cost 50), fortress base cap 120 (conversion cost 60), fortress steps 160 (cost 80) and 200 (cost 100).

---

_Answers go in `convo/convo v0.7.md` once this round is complete._
