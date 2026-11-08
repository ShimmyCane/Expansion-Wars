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
- **Recruiting by tier.** Soldiers a second joining the field army from each province held: empty dot 0.25, village 0.5, town 1, city 1.5, fortress 2. (You wrote "2 /s at village level to .5/s at the fortress level", which runs the other way from "high tiers recruit faster". I took "higher tiers recruit faster" as the intent.)

## What the simulation showed

- **Phased fights, 3000 runs each, village ground:** 100 against 100: the attacker wins about 33%. 104 against 100: 53%. 116 against 100: 92%. 150 or more: always, with the defender routing in most of them. 70 against 100: the attacker never wins and routs in nearly every run. So morale and routing show up in the lopsided fights, and the middle turn is where they happen.
- **First tries with dice were wrong.** With many soldiers rolling sorted dice, the k-th best die of each army is almost always equal, so any small morale gap won every pair and each fight snowballed. The phased fight uses kill rates instead.
- **The campaign's all-roll rounds have that problem too.** 100 against 100: the attacker wins 1%. 110 against 100: 16%. 120 against 100: 55%. 150 against 100: always. So the break-even is about 1.2 to 1 and there is little luck. I have not changed it (you asked for this mode to be individualized).
- **Idle player, province battles, 8 seeds each:** most idle runs last an hour, but at level 1 three of eight lost within 4.5 minutes, because the computer sometimes picks a fight early. That is just how the computer's 1.7 to 1 rule landed, and nothing is tuned for it.

## Questions

1. **Version number.** (From v0.19, unanswered.) 3.0 is a guess for "major". Keep it?

   > **Answer:**

2. **Unit battles.** (From v0.19, unanswered.) Each battle is a fresh map between two of your provinces, from a seed. Would you rather pick the two sides yourself, as the old unit scale's custom battle did?

   > **Answer:**

3. **Province battles with no country turns.** (From v0.19; "Yes" was ambiguous.) Neighbours stay at the peace or war they started with, and in this mode everyone is at war with you and nothing changes. Is that right, or should this mode run country turns too?

   > **Answer:**

4. **Recruiting rates.** Built as empty dot 0.25, village 0.5, town 1, city 1.5, fortress 2 a second. Is that the direction you meant (fortresses recruit most), and are the values right?

   > **Answer:**

5. **Phased fight numbers.** Morale starts at 70, a wave kills 0.5 of the enemy wave at morale 50, and the swings are 60, 120 and 60. The attacker needs about 1.04 to 1 to win half the time (104 against 100 wins 53%), and the same ratios hold for small armies. Do the odds feel right, and should morale carry between fights (a beaten army starts the next one shaken)?

   > **Answer:**

6. **The campaign's fights.** The campaign still uses the all-roll rounds, where an attacker needs about 1.2 to 1 and there is little luck. Should the campaign get the phased fights too, or stay as it is?

   > **Answer:**

7. **Pace and the computer.** A phased fight is 9 seconds in all (three turns of 3). Is that the speed you want, and should the computer be bolder than its 1.7 to 1 rule, since a lead of 1.2 to 1 now wins almost every time?

   > **Answer:**

## Still open

Convo v0.14 to v0.18 questions are unanswered. See `convo/convo v0.18.md` for food and the land cap.

---

_Answers go inline above. Once a round is complete, the next version starts a new file._
