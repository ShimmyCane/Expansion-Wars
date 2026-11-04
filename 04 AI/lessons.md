# Expansion Wars — Lessons

- Start with the smallest playable rules (spots, soldiers, sending, capture). Keep special mechanics for later increments.
- Keep map coordinates in one fixed space (1000 × 640) and scale the board with CSS. Node positions, roads and soldiers then stay aligned on any screen.
- Use pointer events on the board element with `setPointerCapture`, so drags keep working when the finger leaves a spot.
- Create Web Audio contexts on the first tap; iPad Safari suspends audio until a user gesture.
