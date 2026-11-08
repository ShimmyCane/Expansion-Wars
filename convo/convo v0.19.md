# Expansion Wars — Convo v0.19 (version 3.0: campaign and battle modes)

**Round:** major revision. Direction: the combined game is the campaign, and the three scales become battle modes; the individual games move to the archive.

## Direction

- **Major revision, so bump the numbers.** The game is version 3.0. Shown in ⚙️.
- **Move the individual versions into the archive.** Unit scale (version 4.5), country scale (version 2.20) and the province scale copy now live in `archive/`, linked from the Archive page.
- **The combined game is the campaign.** Extract the unit battles, province battles and country battles from it, and put those in the home page's links 2, 3 and 4.

## What is built (defaults I picked, to check)

- **Campaign.** `combined/` with all three scales in one world, as before. Its save and its family database rows are unchanged, so a campaign in progress carries on.
- **Unit battles.** Only the battle view. A new world each time: one of your provinces attacks a neighbour, with all its garrison. When the battle ends, **Next battle** starts another. No country, no turns.
- **Province battles.** Only the province view: marches, garrisons, and risk-style fights that resolve in rounds on their own. No ⚔️ Battle and no Join button, so no battles to pick. No country turns.
- **Country battles.** Only the country view: turns, diplomacy, war and claims. Fights resolve on the map in rounds, with no Join button and no zoom.
- **Each battle mode has its own save** on this device (`xw-unit-battles-world`, `xw-province-battles-world`, `xw-country-battles-world`) and its own family database tag, so they never overwrite the campaign.
- **Version 3.0** in ⚙️ and in the notes panel's page name.

## Questions

1. **Version number.** 3.0 is a guess for "major". Should the campaign's version be 3.0, or should the version follow the old numbers some other way?

   > **Answer:**

2. **Unit battles.** Each battle is a fresh map between two of your provinces, from a seed. Would you rather pick the two sides yourself, as the old unit scale's custom battle did?

   > **Answer:**

3. **Province battles without a country.** Your neighbours stay at the peace or war they started with, and do not change while you play. Is that right, or should this mode run country turns too?

   > **Answer:**

## Still open

- Convo v0.14 to v0.18 questions are unanswered. See `convo/convo v0.18.md` for food and the land cap.

---

_Answers go inline above. Once a round is complete, the next version starts a new file._
