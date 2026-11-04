# Expansion Wars — Convo v0.3

**Project:** Expansion Wars
**Round:** 4 — unbuilt feedback only. Read from the family table on 2026-11-03. Answers from Jimmy go inline under each question.

## What is still unbuilt

- Five more maps with increasing density and more cities, scrollable on the field (question 1).
- "Castles" in the reinforce note, now confirmed as fortresses (question 2).
- City upgrades: tiers and what each unlocks (question 3).
- Team setup: how teams are picked, and team colours (question 4).
- Village and country zoom, at level 10 (question 5).

Everything else in the notes is built and checked in the code. Notes marked `Done- ` are skipped.

## Questions

1. **Five more maps.** Should they be Levels 5 to 9, with more spots and cities each time? What spot counts do you want (for example 12, 14, 16, 18, 20)? Should the field be a bigger map you pan around, or should it stay one screen and shrink the spots?

   > **Jimmy:** Yes.
   >
   > **Still open:** the spot counts, and whether the field pans or shrinks.

2. **Castles.** Your note says to reinforce "cities and castles". The game has no castle yet. Is a castle a new spot type (for example, a tougher stone spot that does not grow), or do you mean cities? If a new type, what does it do?

   > **Jimmy:** Those were the fortresses.
   >
   > **Still open:** what a fortress does besides being reinforced.

3. **City upgrades: what each level unlocks.** Levels 2 and 3 now raise growth and the garrison cap (cost 15 and 30 soldiers). What should the extra functionality be, if anything? Options: a stronger defence, faster sending, or nothing beyond growth.

   > **Jimmy:** Start like this: village 20, town 40, city 60, metropolis 80. Each upgrade costs 50% of the next level's max.
   >
   > **My reading:** the four tiers are the garrison caps. Upgrade costs would be 20, 30 and 40 soldiers (50% of 40, 60 and 80). Please confirm.
   >
   > **Still open:** what each tier unlocks beyond growth and the cap.

4. **Team setup.** Teams are fixed now: players 1 and 2 against players 3 and 4. Should they be picked before a game, or assigned at random? Should teammates share one colour, or keep their own colour with a team badge?

   > **Jimmy:** Some levels will give you teams. Fair teams. Up to 5 teams.
   >
   > **Still open:** how the fair teams are made (I will assume balanced, automatic teams unless you say otherwise), and whether teammates share a colour.

5. **Zoom.** Village and country zoom is still on the todo list. Should it come after the five new maps, or wait until you have played them?

   > **Jimmy:** Zoom inward at level 10. Still planning in my head.

## Built in this round: defaults I picked

These are built. Please check them and say what to change.

- **Maps 5 to 9:** 12, 14, 16, 18 and 20 spots. Each field is 1.5 screens wide and pans (drag on empty ground, or the mouse wheel). Pan, not shrink, because the note said scrollable.
- **Fortresses:** neutral garrison 18 to 22, grows 0.5 a second once owned, stops growing at 40. They can be reinforced like any spot.
- **City tiers:** village 20, town 40, city 60, metropolis 80. Upgrade costs 20, 30 and 40 soldiers. Growth rates 1.5, 2.0, 2.6 and 3.2 a second (3.2 is my pick).
- **Teams:** Levels 4, 6 and 8 always have teams: 2 teams of 2 on Levels 4 and 6, 3 teams of 2 on Level 8. The Teams setting in ⚙️ is gone. Each team shares one colour.
- **Zoom at level 10:** not built, since you said you are still planning it.

Still open for you: what each city tier unlocks, what a fortress does beyond being reinforced, and whether teams should be assigned differently from the fixed pairs.

---

_Answers go in `convo/convo v0.4.md` once this round is complete._
