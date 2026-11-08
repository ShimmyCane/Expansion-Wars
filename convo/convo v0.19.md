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

## Round 2 (same version)

- **Province merged back from the archive.** The archived province copy is the original spot game, so its province rules were compared with the campaign's. Most already came across (clash on roads, send steps, computer caps, towers, routing). The one missing was **dragging from several provinces** at once, which the spot game had. Now built in the shared province view, so the campaign and province battles both have it.
- **Not brought back:** the countdown, the population bar, the 10:1 surrender toggle and team avatars. Reasons are in `todo.md`.
- **Supabase notes:** none open that need building. The one open note is a test note.

## Round 3 (same version): province battles as a progression

Direction: the freestanding province mode should still be a progression, with a small start, an opponent, and fights that resolve themselves, with nothing pulling you into the unit scale. Risk fights should scale up: every soldier goes once.

- **Risk rounds.** Every soldier rolls a die each round; dice pair highest to lowest; each pair costs the loser one soldier (ties to the defender). Big fights end in a few rounds. Rounds are 2 world seconds (about 20 s in a province).
- **Levels.** Seven, then the last repeats: 1 opponent and 5 provinces each, 1 and 7, 2 and 7, 2 and 9, 3 and 9, 4 and 11, 5 and 15. Everyone is at war with you. Win by taking every opponent province. ⚙️ lists the levels you have reached.
- **Whole map, no turns.** The computer plays everywhere. Soldiers are recruited at 0.5 a second for each province you hold, up to the army cap.
- **No red dashes.** A fight has a thin quiet ring in this mode and no join button. The campaign keeps the red dashes and the join button.
- The campaign shares the new dice, the faster rounds, and the instant win when the last opponent falls.

## Questions

1. **Version number.** 3.0 is a guess for "major". Should the campaign's version be 3.0, or should the version follow the old numbers some other way?

   > **Answer:**

2. **Unit battles.** Each battle is a fresh map between two of your provinces, from a seed. Would you rather pick the two sides yourself, as the old unit scale's custom battle did?

   > **Answer:**

3. **Province battles without a country.** Your neighbours stay at the peace or war they started with, and do not change while you play. Is that right, or should this mode run country turns too?

   > **Answer:**

4. **Level ladder.** Is the start (you and one opponent, 5 provinces each) the right beginning, and is the climb (more provinces first, then more opponents) the right order?

   > **Answer:**

5. **Fight pace and the computer.** A round is about 20 s in a province, and the computer attacks only with a lead of about 1.7 to 1. Too fast, too slow, too cautious?

   > **Answer:**

6. **Recruiting.** 0.5 soldiers a second for each province held. Should provinces of higher tiers recruit faster?

   > **Answer:**

## Still open

- Convo v0.14 to v0.18 questions are unanswered. See `convo/convo v0.18.md` for food and the land cap.

---

_Answers go inline above. Once a round is complete, the next version starts a new file._
