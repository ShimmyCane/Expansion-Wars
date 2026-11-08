# Expansion Wars — Convo v0.21 (version 3.0: wave fights by grade, half upgrades, split provinces, teams)

**Round:** version 3.0, round 6. Direction is the answers to `convo/convo v0.20.md`, built with the defaults below for you to check.

## Answers to v0.20

| # | Question | Your answer | What I did |
|---|---|---|---|
| 1 | Version number | Yes, v3 | 3.0 stays. |
| 2 | Unit battle sides | Defer; without the campaign it could be a random province map | Nothing yet. |
| 3 | Province battles without turns | Several players, all opponents unless allied from the start, no diplomacy | Team levels; everyone else at war with everyone. |
| 4 | Growth rates | Yes | Kept, as part of the grade table. |
| 5 | Fight numbers | A new fight: waves against the whole defence, ground from -25% to +25%, target outcomes at city level | Built and fitted. |
| 6 | The campaign's fights | Yes, in rounds by place size (village about 3, tower 10), each round running the waves | Built: every mode fights this way. |
| 7, 8 | Pace | Province fights in about three seconds | A round is 1 second, so a village fight takes 3 (see question 1 below). |
| 9 | Upgrades | Half upgrades for half the next cap; big provinces split into parts that share the defence | Built. |
| 10 | The first draft | All of it | Team games and the surrender setting added; the rest was in. |

## What is built (defaults I picked, to check)

### Grades

A province has a grade: 0 empty dot, 1 village, 2 town, 3 city, 4 fortress, 5 fortress with an upgraded tower. A half upgrade adds 0.5, and everything is read halfway between grades.

| Grade | Ground | Rounds | Grows a second (province battles) | Cap |
|---|---|---|---|---|
| empty dot | -25% | 3 | 0.25 | 40 |
| village | -25% | 3 | 0.5 | 80 |
| town | -12.5% | 4 | 1 | 160 |
| city | 0 | 6 | 1.5 | 240 |
| fortress | +12.5% | 8 | 2 | 480 |
| tower | +25% | 10 | 2.5 | 600 |

"Ground" cuts the attackers' kills by that share and raises the defenders' by the same share.

### The fight (every mode)

- A fight is as many rounds as the ground gives (3 at a village up to 10 at a tower). Each round each side commits that share of its army (a third at a village, a tenth at a tower); the last round commits everyone left.
- In a round, the committed soldiers strike in turn, as you described: the attackers' first 20% (against the whole committed defence), the defenders' first 50%, the attackers' next 50%, the defenders' other 50%, then the attackers' last 30%.
- A strike kills 0.6 for each attacker in it, or 1.8 for each defender, give or take 10%.
- **Routing.** A side that has lost half of what it committed in a round routs: its strikes for the rest of the round hit at half, and every later round it starts shaken (its strikes at 0.9 for each rout so far, never under half). So when the first wave crashes the defenders, the rest of the round is a rout.
- **Fitted at city level** (400 runs each): 100 against 100, the defenders hold with about 89; 200 against 100, the attackers win with about 121; 500 against 100, the attackers win with about 475.
- **The ground matters:** 150 against 100 takes a village but not a town, a city or a fortress; 200 against 100 takes a city but not a fortress; a tower holds against 2 to 1 and falls to 3 to 1.
- **Time.** Province battles: a round a second, so a village fight is 3 seconds and a tower fight 10. The campaign: a round every 2 world seconds, so there is time to press Join.

### Half upgrades (province scale, both modes)

- Select one of your provinces: the bar offers **Upgrade**, paid with that province's own soldiers, half the next grade's cap (a village 80, a town 120, a city 240, a fortress 300). Once per province. The province moves halfway to the next grade: ground, rounds, growth and cap. A fortress's upgrade is its tower.
- An upgraded province shows a small green arrow.

### Split provinces (province battles)

- Zoomed in, a town is 2 provinces, a city 3 and a fortress 5: the settlement in the middle and villages around it.
- Every part defends at the settlement's grade, but only for the nation that holds the whole of it. Whoever takes a part fights from it as a plain village until it has taken every part; then the protection is theirs.
- An upgraded tower in the middle of a split fortress reaches every part of it.

### Levels

- Neutral towns, cities and fortresses on the map, as in the first draft, with about a third of their cap: level 1 one town; level 2 a town and a city; level 3 two towns and a city; level 4 adds a fortress; up to three towns, three cities and two fortresses at level 7.
- **Teams.** Level 5: you and an ally against two. Level 7: three teams of two. Everyone else is at war with everyone, the computer players with each other too. You win when every opponent has fallen, with your ally still standing. Your ally is marked 🤝 on the population line.
- **Surrender** (⚙️, off by default, as in the first draft): a side outnumbered 10 to 1 gives up, and its provinces go neutral with their soldiers. You too.

### What the simulation showed

- Every level's land is still connected after the splits (12 of 12 seeds each).
- **Idle player:** gentler than before. At level 1 seven of eight idle runs lasted the hour. At level 3 three of eight lost within 32 minutes. The computer still waits for a lead of 1.7 to 1, and the new fight favours the defender.

## Questions

1. **Round time.** You wrote "each round will take two seconds" and also that a province fight "should only take three seconds". I made a round 1 second, so a village fight (3 rounds) takes 3 seconds and a tower fight (10 rounds) 10. Two seconds a round would make them 6 and 20 seconds. Which?

   > **Answer:**

2. **The even case.** I read "the defenders would have 80 remaining" as 100 against 100 (the model gives 89). If you meant something else, such as 50 attackers against 100 defenders (the model leaves the defenders 95), say which.

   > **Answer:**

3. **Ground both ways.** The ground cuts the attackers' kills and raises the defenders' by the same share. Is that right, or should it only protect the defenders?

   > **Answer:**

4. **Withdrawals.** With these numbers one side is always wiped out by the last round, so a beaten attack no longer comes home with survivors. Fine, or should a losing attack pull back before it is destroyed?

   > **Answer:**

5. **The parts of a split province.** They are villages around the settlement. You wrote "little towns": should they be towns instead (stronger, and they grow faster)?

   > **Answer:**

6. **Upgrades.** An upgrade is instant and the computer never upgrades. Should it take time (the first draft did: 5 seconds for a town, doubling each step) and should the computer upgrade too?

   > **Answer:**

7. **The computer's boldness.** The computer attacks only with a lead of about 1.7 to 1, whatever the ground, so it seldom takes a town or better and an idle player lasts long at the first levels. Should it weigh the ground (2 to 1 against a city, 3 to 1 against a tower), and be bolder against villages?

   > **Answer:**

8. **Teams.** Level 5 is two against two, level 7 three teams of two. Are those the right levels, and should any team level be you and an ally against three?

   > **Answer:**

9. **Surrender.** Off by default, 10 to 1, and the provinces go neutral. Keep those, or should the provinces go to the strongest side (an open question from the first draft)?

   > **Answer:**

10. **The campaign's pace.** The campaign now fights in waves too, a round every 2 world seconds: a village fight is about a minute in a province and 12 seconds on the country map; a tower fight is 3 minutes 20 seconds in a province and 40 seconds on the country map. Too slow, too fast?

   > **Answer:**

## Notes

- One campaign test, "the computer offers peace; the war goes on until you accept", fails about one run in six. It did so before this round too (the computer's choice is random), so it is not caused by these changes. It needs a seeded computer to be steady.
- Convo v0.14 to v0.18 questions are still unanswered. See `convo/convo v0.18.md` for food and the land cap.

---

_Answers go inline above. Once a round is complete, the next version starts a new file._
