// Expansion Wars (combined) — every tuned number of the province scale. Ported from the province scale's spot game
// (province/js/game.js), with distances in country map units, since the province window is a close-up of the country map.
(function () {
  'use strict';
  window.XW.province.CONFIG = {
    SPEED: 30,              // map units a real second for marching soldiers (the window shows about a fifth of the map)
    RIVER_SLOW: 0.5,        // crossing a river border marches at this share of the speed
    // Garrisons grow in real time, drawn from the owner's field army (nation.soldiers): soldiers a second, and the cap.
    GROW: { e: 0.3, v: 1.0, t: 1.5, c: 2.0, f: 0.5 },
    CAP: { e: 10, v: 20, t: 40, c: 60, f: 120 },
    // Fortresses shoot enemy soldiers marching within RANGE map units: DMG soldiers a second.
    FORT: { range: 40, dmg: 2 },
    SEND_STEPS: [10, 25, 50, 100],   // % of a province's garrison sent by one order
    MUSTER: 10,             // soldiers moved between the field army and a garrison with one tap
    // Computer players in the window: how often they think, the share they send, the least garrison that moves,
    // and the most moves a minute.
    AI: { every: 1.8, fraction: 0.6, threshold: 7, perMinute: 10 },
    SETTLE_STEP: 0.5        // seconds per step when marches finish at once (on leaving the province)
  };
})();
