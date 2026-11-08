# Expansion Wars — Convo v0.20 (version 3.0: province battles fight in three phased turns)

**Round:** version 3.0, round 4. Direction is the answers to `convo/convo v0.19.md`, built with the defaults below for you to check.

## Answers to v0.19

| # | Question | Your answer | What I did |
|---|---|---|---|
| 1 | Version number | not answered | still 3.0. Asked again below. |
| 2 | Unit battle sides | not answered | unchanged. Asked again below. |
| 3 | Province battles with no country turns | "Yes" | read as: that is right, no turns. Asked again below, as the question offered two options. |
| 4 | Level ladder | Yes | unchanged: 7 levels, 1 opponent and 5 provinces each first. |
| 5 | Fight pace | 3-second rounds, three phased turns like Torn Wars, 20% / 50% / 30%, morale and routing | built, for province battles only. See below. |
| 6 | Recruiting | high tiers recruit faster, "2 /s at village level to .5/s at the fortress level" | built the other way round, see below. Asked again. |

## What is built (defaults I picked, to check)

- **Province battles fight in three turns, 3 real seconds each.** Only in this mode. The campaign, country battles and unit battles keep the earlier risk rounds.
  - **Waves.** Turn 1: the first 20% of each army fights. Turn 2: the next 50%. Turn 3: the last 30%. Survivors of a wave go back into the army; a wave is never bigger than what is left. Reinforcements that arrive mid-fight join the waves.
  - **Morale.** Both sides start at 70. The defender gets 3 more for each point of defence (ground, slope, fortress).
  - **Formation.** At the start of each turn an army is *in formation* (morale 50 or more), *wavering* (25 to 49) or *routing* (under 25). The fight ticker shows it.
  - **A turn.** Each soldier in a wave kills 0.5 of the enemy wave at morale 50, times (0.5 + morale / 100), give or take 35% at random. So morale 100 kills one and a half times as fast as morale 50, and morale 0 half as fast. A routing wave kills nobody and loses 35% of itself as it runs.
  - **Morale moves** after each turn by the difference in losses: 60 points for a whole-wave difference in turns 1 and 3, and 120 in turn 2. The middle turn, with half the army in it, is where a battle tilts.
  - **The end.** If one side is wiped out, the other wins at once. After turn 3 the side with more left, weighted by morale, wins. Winning attackers take the province with what is left. Losing attackers who are still alive **withdraw** to the province they came from (or the field army), where before they were lost.
- **Growth by tier.** Soldiers a second each province grows by itself: empty dot 0.25, village 0.5, town 1, city 1.5, fortress 2, up to the tier's cap (80 village, 160 town, 240 city, 480 fortress). (You wrote "2 /s at village level to .5/s at the fortress level", which runs the other way from "high tiers recruit faster". I took "higher tiers recruit faster" as the intent.)

## What the simulation showed

- **Phased fights, 3000 runs each, village ground:** 100 against 100: the attacker wins about 33%. 104 against 100: 53%. 116 against 100: 92%. 150 or more: always, with the defender routing in most of them. 70 against 100: the attacker never wins and routs in nearly every run. So morale and routing show up in the lopsided fights, and the middle turn is where they happen.
- **First tries with dice were wrong.** With many soldiers rolling sorted dice, the k-th best die of each army is almost always equal, so any small morale gap won every pair and each fight snowballed. The phased fight uses kill rates instead.
- **The campaign's all-roll rounds have that problem too.** 100 against 100: the attacker wins 1%. 110 against 100: 16%. 120 against 100: 55%. 150 against 100: always. So the break-even is about 1.2 to 1 and there is little luck. I have not changed it (you asked for this mode to be individualized).
- **Idle player, province battles, 8 seeds each:** most idle runs last an hour, but at level 1 three of eight lost within 4.5 minutes, because the computer sometimes picks a fight early. That is just how the computer's 1.7 to 1 rule landed, and nothing is tuned for it.

## Direction since: play like the first draft

"In general I'd like the province level battle to still function like the very first draft of game, where the gameplay flows easily." Built, in province battles only:

- **No field army.** Each province grows its own soldiers (the rates above), as every spot did in the first draft. The muster buttons and the field army are gone from this mode, and the top bar shows the first draft's population line (a chip for each nation with its provinces and soldiers) in place of food, gold and science.
- **Tap, tap, go.** Tap one of your provinces, then a target, and the soldiers go at once. Dragging works as before, from several provinces at a time. There are no Send or Cancel buttons, only the share buttons (10, 25, 50 and 100%).
- **No move limit.** Soldiers go as far as your roads reach, through your own provinces (the campaign keeps its limit of three provinces).
- **3, 2, 1, Go.** Each new level starts with a countdown over the map, and nothing moves until it is over.
- **Shorter card.** One short line of what to do, then who holds what.
- **Kept from your earlier answers, which are richer than the first draft:** the three-turn phased fights (9 seconds in all) and the level ladder.
- **Idle player, 8 seeds a level:** the computer now plays. Every idle run loses, in about 5 to 30 minutes (a first number, nothing tuned).

## Questions

1. **Version number.** (From v0.19, unanswered.) 3.0 is a guess for "major". Keep it?

   > **Answer:** Yes v3.

2. **Unit battles.** (From v0.19, unanswered.) Each battle is a fresh map between two of your provinces, from a seed. Would you rather pick the two sides yourself, as the old unit scale's custom battle did?

   > **Answer:** We will defer this to the future, but yes, in general if you're playing without campaign mode then it could be a randomized province map.

3. **Province battles with no country turns.** (From v0.19; "Yes" was ambiguous.) Neighbours stay at the peace or war they started with, and in this mode everyone is at war with you and nothing changes. Is that right, or should this mode run country turns too?

   > **Answer:** There are multiple players in the province battles and they are all opponents, unless predetermined to be allies, no diplomacy here. (Later: in general yes, already answered.)

4. **Growth rates.** Built as empty dot 0.25, village 0.5, town 1, city 1.5, fortress 2 soldiers a second. Is that the direction you meant (fortresses grow fastest), and are the values right?

   > **Answer:** Yes, I like this approach. I think this could be tweaked in the future as needed. (Later: same, already answered, in general yes.)

5. **Phased fight numbers.** Morale starts at 70, a wave kills 0.5 of the enemy wave at morale 50, and the swings are 60, 120 and 60. The attacker needs about 1.04 to 1 to win half the time (104 against 100 wins 53%), and the same ratios hold for small armies. Do the odds feel right, and should morale carry between fights (a beaten army starts the next one shaken)?

   > **Answer:** The point of this in a way is that waves always ran, so that perhaps generals or leaders have an impact, but still oversized armies will eventually prevail. If the first wave crashes the defenders, then the second and the third will be full routs. In these battles the scale of the population centre should also be a factor: a fortress offers more protection, so its first wave, even if small, could defend against a much larger army. The first 20% should not attack just 20% of the defenders: it attacks the entire defence, then the defenders strike with 50% of their initial strength, then the attackers' next 50%, then the defenders' remaining 50%. Example, 100 against 100: the attackers' 20 kill 20, the defenders' 50 kill 50, the attackers' 50 kill 50, the defenders' second 50 kill 50; the attackers are exhausted and the defenders have 30 left. The ratios need tweaking so that 200 against 100 the attackers win with about 120 left, 100 against 100 the defenders win, and 500 against 100 the attackers win with about 475 left; and in an even-ish case the defenders would have about 80 left. These numbers are at the city level. Towers should give about 25% defence and villages -25%, scaled in between. (Later: the explanation above is the better one for how the fight works.) _(Built in v0.21.)_

6. **The campaign's fights.** The campaign still uses the all-roll rounds, where an attacker needs about 1.2 to 1 and there is little luck. Should the campaign get the phased fights too, or stay as it is?

   > **Answer:** Yes, but the full attack should resolve in less than 10 rounds. The larger the population centre, the more rounds: a village takes about 3 rounds, each round two seconds and 33% of the initial army; a fully upgraded tower takes 10 rounds, each side committing 10% of its army a round. Each round, the committed army goes through the three-wave evaluation above. _(Built in v0.21; see its question 1 on the round time.)_

7. **Pace and the computer.** A phased fight is 9 seconds in all (three turns of 3). Is that the speed you want, and should the computer be bolder than its 1.7 to 1 rule, since a lead of 1.2 to 1 now wins almost every time?

   > **Answer:** I don't know what you are talking about; if it is country I don't know yet, but if it is the province level, the fight should only take three seconds to solve.

8. **First-draft feel.** Fights are the one thing that is not like the first draft, where soldiers simply reduced the defenders on arrival. I kept the 9-second phased fights because you asked for them. Do they fit, or should this mode settle a fight on arrival after all?

   > **Answer:** Yes, this is true. Let's try three seconds first.

9. **Upgrades.** The first draft let you tap a city to upgrade it. Province battles have none: a province stays the tier it started as, or drops one when captured. Should upgrades come back, and if so, by tapping the province and paying soldiers, as in the first draft?

   > **Answer:** I really liked the upgrade capabilities. To keep these amounts in step with the campaign, you cannot upgrade a city into the next tier here; what you can upgrade is its capabilities, halfway between the current level and the next, still using the half-soldier requirement. Also, at the province level each bigger province should split into parts: zoomed in near a fortress there will be about five splits, a city three, a town two, a village none. A tower (an upgraded fortress) also has five, with the tower in the middle and a shooting range covering as much of the province as possible, so the heavier places are harder to take all at once. Every part has the same defensive bonus, and only when the whole province is taken over does that bonus pass to the new owner. _(Built in v0.21.)_

10. **What else from the first draft?** The first draft also had team games, fortresses that shoot, a surrender setting, and a "game over when the other players are gone" rule. The last two of those and the shooting fortresses are already in. Is anything else from the first draft missing from how this mode plays?

   > **Answer:** Yes, I would like to incorporate all of these elements from the first draft. _(Built in v0.21: team games, surrender setting; shooting fortresses and game over when the others are gone were already in.)_

## Still open

Convo v0.14 to v0.18 questions are unanswered. See `convo/convo v0.18.md` for food and the land cap.

---

_Answers go inline above. Once a round is complete, the next version starts a new file._
