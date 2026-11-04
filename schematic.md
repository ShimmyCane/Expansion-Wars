# Expansion Wars — Schematic

**Status:** MVP (not yet device-tested)
**Owner:** Jimmy
**Platform:** iPad web app (plain HTML/CSS/JS, no build step, GitHub Pages later)
**Conversation:** `convo/convo v0.1.md`

## Purpose

A simple expansion game, the first step toward bigger games. Flags are players. Fabrication centers (mushroom factories) and cities are the map. Each owned spot makes soldiers over time. Send soldiers from your spot to a connected spot to take it. Capture the whole map to win.

Inspiration: Mushroom Wars (simple tap-and-send expansion). This is our own build.

## MVP scope (v0.1)

- One grid-style map, generated fresh each game.
- Terrain:
  - **Fabrication center** (🍄): makes 1 soldier per second when owned. Garrison 4–7 when neutral.
  - **City** (🏰): makes 1.5 soldiers per second when owned. Garrison 13–16 when neutral.
  - **Lake** (blue): soldiers cannot cross it.
- **Flags:** each player starts on a fabrication center with 10 soldiers. Starts are spread out.
- **Roads:** two spots are linked when they are close enough and no lake is in between. Dashed lines show the roads.
- **Sending:** drag from one of your spots to a linked spot. Half the soldiers (rounded down) march.
- **Fighting:** soldiers reduce the defenders. Whatever is left over takes the spot.
- **Computer players:** Easy or Normal. They send half of their soldiers to the weakest nearby target.
- **Win:** own every spot and have no soldiers still marching. **Lose:** lose every spot and every soldier.
- **Settings (⚙️, lower right):** players (2–4), computer level, sound on/off, show errors on/off, new map.
- **Errors:** shown at the bottom of the page, only when "Show errors" is on.

## Not in MVP (later increments)

- Speed, strength and defense boosts on regions; towers that shoot.
- Spells, map hazards, buildings.
- Quick Game option (smaller map).
- Saved progress or saved maps (no database needed yet).
- Story and maps that grow levels.

## Files

- `index.html`: the page.
- `css/style.css`: pastel look, large touch targets.
- `js/map.js`: map generation and road checks (`window.ExpansionMap`).
- `js/sound.js`: Web Audio tones (no sound files).
- `js/game.js`: game rules, computer players, drawing, input.

## Open

- See `convo/convo v0.1.md` for the questions. Defaults above can be changed there.
