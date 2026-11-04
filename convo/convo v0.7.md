# Expansion Wars — Convo v0.7 (version 2: country layer)

**Project:** Expansion Wars
**Round:** 8 — archive of version 1, and a first proposal for version 2 with a country layer. Answers from Jimmy go inline under each question.

## Done this round

- **Version 1 archived** in `V1/` (a copy of the game as it stood). The ⚙️ settings have a "Play version 1 (archive)" link. Checked: the link opens the archived game.

## Version 2 proposal: a country layer

**The idea.** Two zoom levels, one game. Zoomed out, you see the country: nations, their provinces, trade routes and borders, and the diplomacy. Zoomed in on a province, you play the battle we have now (villages, cities, fortresses, soldiers, roads). Peace is the usual state; war is a choice that costs something.

**Provinces.** A nation is a group of provinces. A province is one of today's maps (its regions are the villages, cities and fortresses). Zoom out and the provinces join up into nations.

**Four things to track.**
- **Food** comes from villages (the mushrooms are the farms). Armies eat it. Without food, soldiers leave.
- **Gold** comes from cities and trade routes. It pays for trade deals, tribute and alliances.
- **Stone** comes from fortresses. It pays for building and for upgrades.
- **Reputation** is a trust score between each pair of nations. It is not spent. It sets trade prices and whether a nation will accept an alliance or a ceasefire.

> **Jimmy:** I think all of these values get used up as part of a **power score**. Power is partly a reflection of population density: how many cities and fortresses a nation has. Over time, the provinces are automatically upgraded to **veteran population centres**, which produce troops faster and faster, for invasion, for more population, or for more scientific discovery. So on the country scale, it is no longer about the number of troops, but the power of troops, with **technology, morale and happiness** all together. That power is what decides a cross-border attack.
>
> **My reading:** the four values feed the power score. Power = population density, weighted by veteran upgrades, and then by technology, morale and happiness. Cross-border attacks are decided by power, not by head count.

**Diplomacy.** ~~Propose trade, propose a ceasefire, propose an alliance, ask for tribute. The other nation accepts when reputation and its needs match.~~ Breaking a treaty, or attacking an ally, lowers reputation with everyone who saw it.

> **Jimmy:** I don't think there should be a menu. You just click on the country, and a couple of pop-ups appear: trade routes, neutral alliance, ceasefire, tribute, and so on.
>
> **My reading:** tap a nation on the country map, and its pop-ups offer the diplomacy options directly. No separate menu.

**War.** Declaring war costs reputation. Fights happen in provinces, as now. Allies join the fight, which gives the team battles you described.

> **Jimmy:** Yes. But the first salvo is always a cross-border fight. There is a higher chance of fortresses built around the province boundaries.
>
> **My reading:** every war opens with cross-border fighting, and fortresses are more likely along province borders.

**Pace.** The country layer ticks every 10 seconds (trade, food, reputation). Province battles stay real-time.

> **Jimmy:** I don't know yet. Time will have to be a little trickier. There may be time dilation: when you go into battle, time slows down, versus longer trade ticks on the country map.
>
> **Still open:** how the battle and country clocks relate.

## Questions

1. **Zoom model.** Zoomed out, the whole country; tap a province to zoom in and play it. Is that the right model? Should a battle always happen in a province, or can nations fight on the country map?

   > **Jimmy:** I think there should be the ability to fight on a country map. But those battles are less precise, and more likely to favour the defenders than if we went zoomed in.

2. **Resources.** Food, gold and stone, plus reputation. Is that the right list? Anything missing (for example soldiers as a resource, or wood)?

   > **Jimmy:** Yes, let's start with those. I think we should also do **magic** and **culture**.
   >
   > **My reading:** the list is food, gold, stone, reputation, plus magic and culture, which are added to the power score too.

3. **Who negotiates.** Only computer nations, or can players in a multiplayer level negotiate with each other?

   > **Jimmy:** Everyone negotiates with everyone. Reputation goes a long way. There are plenty of neutral countries at the beginning, but, like Total War, there is a set number of combatants.

4. **Reputation.** What raises it and what lowers it? My proposal: honouring a trade or ceasefire raises it; breaking a treaty or attacking an ally lowers it.

   > **Jimmy:** Raised by trading well, growing well, attracting population to the European borders, winning battles in general, and being trustworthy.

5. **Pace.** Real-time, with the country ticking every 10 seconds, or turn-based on the country map?

   > **Jimmy:** Turn-based, actually. It could be a mad dash: everybody makes simultaneous moves within **60 seconds**, and then the moves are played out simultaneously.
   >
   > **My reading:** the country map is turn-based. Each turn gives 60 seconds of simultaneous choices, then the moves play out together. This replaces the 10-second tick. Province battles are a separate question (see the pace note above).

6. **Levels.** Does version 2 replace levels 10 to 15, or sit beside them as its own set?

   > **Jimmy:** There are already 15 levels, so just add five more beyond them. Think of the beginning of tutorials.
   >
   > **My reading:** five more levels after 15 (16 to 20), that start as tutorials for version 2.

7. **Settings.** Is the "Play version 1 (archive)" link in ⚙️ what you meant by archiving it in the settings?

   > **Jimmy:** Version 2 builds on the early version, but I want to be able to go back and play version 1 without any interaction with this.
   >
   > **My reading:** version 1 stays a separate, untouched copy. Version 2 builds on the current game, and the V1 link stays in ⚙️ as it is.

---

## Decisions so far

- Power score = population density (cities and fortresses), grown by veteran population upgrades, weighted by technology, morale and happiness. Cross-border attacks use power, not head count.
- Food, gold, stone, reputation, magic and culture. The first four feed the power score, and magic and culture are added to it.
- Diplomacy is tapping a nation, with pop-ups for trade routes, neutral alliance, ceasefire, tribute and similar. No menu.
- Everyone negotiates with everyone. Neutral countries at the start, then a set number of combatants.
- Reputation rises from trade, growth, population drawn to the European borders, battles won, and trustworthiness.
- The country map is turn-based: 60 seconds of simultaneous moves, then played out together.
- Every war starts with cross-border fighting, and fortresses are more likely along province borders.
- Fights can happen on the country map, but they are less precise and favour the defenders.
- Five new levels (16 to 20) after level 15, starting as tutorials for version 2.
- Version 2 builds on the current game. Version 1 stays untouched and playable from ⚙️.

## Answered in the follow-up

- **Time during battle:** the country clock pauses, more or less, while a battle runs. Simple for now; time dilation can come later.
- **Power ladder:** as a country's power score grows, its look changes. Early on, its provinces are all villages with a town or two. Later, they are cities with some fortresses. Further on, its fortresses go beyond the 200-soldier cap. This is a ratio of power scores, so the stage depends on how strong a nation is compared with the others.

## Still open

- Exact values: the power score formula, how often veteran upgrades happen, and how reputation moves.
- The score thresholds for each ladder stage (villages, then towns, cities, fortresses, past 200).

---

_Answers go in `convo/convo v0.8.md` once this round is complete._
