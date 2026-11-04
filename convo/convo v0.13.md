# Expansion Wars — Convo v0.13 (version 2: provinces, terrain, rivers, upgrades)

**Project:** Expansion Wars
**Round:** 14. Direction from Jimmy, built in version 2.14 with the defaults below for you to check. Answers go inline under the questions.

## Direction from Jimmy

- Each country is split into **15 provinces**.
- **Rivers flow between the province borders.**
- **Mountains, dense forests and lakes** form borders too: neutral Voronoi cells between provinces. Troops can go through them, with caveats.
- **Upgrades:** the AI chooses which province to upgrade. You can also zoom in, tap a population centre or its up arrow to upgrade it by hand, paid in gold.
- **Zoomed in** looks like version 1 (the same icons).
- **Soldiers** can buy out their contracts, or be disbanded, and the gold pays for upgrades.

## What is built (defaults I picked, to check)

- **15 provinces per nation**, all six nations. Each nation starts with 2 to 7 villages, one town and empty dots.
- **Terrain:** 3 lakes, 6 dense forests and 6 mountains, each a neutral cell. Provinces keep clear of them.
  - Lake: crossing costs 2 extra steps and 10% of the army.
  - Dense forest: 1 extra step and 5% of the army.
  - Mountain: 1 extra step, and provinces on the slope defend +1.
- **Rivers:** two rivers, each a walk through neighbouring provinces from one edge of the map to the other. They are drawn along the borders they follow. Crossing one costs 1 extra step (as before).
- **Zoomed in:** version 1 icons (🍄 village, 🏘️ town, 🏰 city, 🏯 fortress), an empty dot is a circle, and terrain shows its icon. Tapping an icon, or the ⬆ arrow beside it, upgrades that province by hand.
- **AI upgrades:** the card's upgrade buttons let the AI pick the province. Hand upgrades are on the zoomed map.
- **Soldiers for gold:** buy out contracts gives 2 gold per soldier; disbanding gives 0.5. Ten soldiers at a time, and at least two are kept.

## Questions

1. **Terrain caveats.** Are a 2-step lake crossing, a 1-step forest and a 1-step mountain about right? Should the lake cost soldiers or stop them?

   > **Jimmy:**

2. **Soldiers for gold.** Is 2 gold a soldier for a buy-out and 0.5 for a disband the right split? Should soldiers belong to each province (so a province has its own soldiers to release), or is the nation pool right for now?

   > **Jimmy:**

3. **Upgrade costs.** A city to fortress still costs stone. Should it cost gold too, so every hand upgrade is paid in gold?

   > **Jimmy:**

4. **Rivers.** Two rivers, one left to right and one top to bottom. Is that enough, and should a river ever block a crossing rather than cost a step?

   > **Jimmy:**

---

_Answers go in `convo/convo v0.14.md` once this round is complete._
