# Expansion Wars — Convo v0.9 (version 2: first playable slice)

**Project:** Expansion Wars
**Round:** 10 — the first build of version 2, the country layer. Answers from Jimmy go inline under each question.

## What is built

- **Country map** (🌍 Country on the home screen): six nations on a map of regions. Two start at war, and the other three are neutral. Each nation shows its soldiers and stage.
- **Your nation:** villages, towns, cities, fortresses, soldiers, food, gold, stone, magic, culture, tech, morale, happiness, power and stage, all shown along the top.
- **Turns of 60 seconds:** queue actions, then Ready, or let the clock run out. Queued actions play out together at the end of the turn.
- **Diplomacy:** tap a nation to get its card: trade route, neutral alliance, ceasefire, send tribute, declare war, attack (send half). A reason shows when an action is not possible yet.
- **Growing:** on your own card, villages become towns (10 gold), towns become cities (20 gold), and cities become fortresses (15 stone).
- **Power and stage:** power = density × quality × soldiers (convo v0.8). Stage comes from the ratio to the median nation.
- **AI nations** declare war, trade, and grow on their own. The neutral nations only defend.
- **Battles on the country map:** half the attacker's soldiers against the defender, who gets a bonus, and fortresses add to the defence. A win takes one spot, which drops one grade.
- **Reputation:** rises with trade and alliances, falls with war declarations (everyone who saw it).

## Defaults I picked, to check

- Trade needs reputation of −20 or better. An alliance needs 20. A ceasefire needs −40.
- Tribute is 10 gold.
- The defender bonus is 1.2, and each fortress adds 20% to the defence.
- Ready or the 60-second clock ends the turn.

## Not built yet

- **Province battles** are not linked to the game screen. Battles on the country map resolve at once, so the time-pause rule has nothing to pause yet.
- **Upgrade times** on the country map are instant. The times from version 1 are not carried over.
- **Veteran upgrades** happen automatically over time: not built.
- **Magic and culture** are counted but do nothing yet.
- **Quality** from technology, morale and happiness: it moves slowly, but has no other effect yet.
- **The game log** and "Copy game log" from convo v0.8: not built.
- **Tutorial levels 16 to 20:** not built.
- **Pop-ups:** the diplomacy shows on the card under the map, not as separate pop-ups.

## Questions

1. **First play.** Does the feel of the turns work? Is 60 seconds the right length, and is the Ready button where you expect it?

   > **Jimmy:**

2. **Battles on the country map.** Should a country battle play out on a province map (as the cross-border fights should), or stay instant for now?

   > **Jimmy:**

3. **Diplomacy pop-ups.** Are the buttons on the card close to what you meant by pop-ups, or should each one open its own small panel?

   > **Jimmy:**

4. **Reputation thresholds.** Are −20 (trade), 20 (alliance) and −40 (ceasefire) about right?

   > **Jimmy:**

5. **Tutorials.** Should levels 16 to 20 be built next, or should the balance come first?

   > **Jimmy:**

---

_Answers go in `convo/convo v0.10.md` once this round is complete._
