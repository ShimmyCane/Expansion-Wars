# Expansion Wars — Convo v0.11 (version 2: drifting borders, zoom, revolts)

**Project:** Expansion Wars
**Round:** 12. Answers from Jimmy go inline under each question.

## Jimmy's direction (this round)

- **No missiles or SAM sites.** Those were a reference only. They are not part of the plan.
- **Drifting borders.** Country boundaries move over time, and the move changes who owns the land. Ownership shifts are part of the game.
- **Zoom.** Countries can be zoomed into. At zoom you see the population centres inside each country as dots (or Voronoi cells) that pop up.
- **Population centres at start.** Each country starts with a maximum number of possible villages, shown as dots. A dot improves as its centre is promoted (village, town, city, fortress).
- **Revolts.** A revolt returns a spot to its old owner, or to neutral. Revolts make attacks cost more.

## What this means

- Drift is a real game effect, not only a visual one. The speed of drift depends on the state of the world: slow at peace, faster at war, and faster when a war is going badly.
- A captured spot keeps its identity (tier, occupation timer, unrest) as the border moves, so the drifting map and the fighting stay in step.
- Unrest is a number per nation. It rises with long wars, occupied spots and alliances that drag a nation into fights. It falls with peace and food. Above a threshold, a spot revolts.
- Revolting spots go back to their old owner if it still exists, otherwise to neutral.
- While unrest is high, sending troops costs more: more soldiers are needed for the same capture.
- Zoom has two levels: the country (today's map) and the country zoomed in (its dots or cells). Captures happen on the country map and show up inside the zoom.

## Questions

1. **Drift speed.** How far does a border move per turn at peace, at war and when a war is going badly? Should it be a set number of spots per turn, or a share of the border?

   > **Jimmy:**

2. **Start counts.** How many dots should each country start with, and how many should the largest country have? Should the start count depend on the country's size, or be the same for all?

   > **Jimmy:**

3. **Unrest threshold.** At what unrest level should a spot revolt? Should a revolt be certain at the threshold, or chance-based?

   > **Jimmy:**

4. **Cost of attacks under unrest.** Should unrest add a percentage to the soldiers needed for a capture, a flat number, or both?

   > **Jimmy:**

5. **Zoom.** Should zoom show dots (one per centre) or Voronoi cells (the area each centre holds)? Should it open on tap, or from a button?

   > **Jimmy:**

---

_Answers go in `convo/convo v0.12.md` once this round is complete._
