// Expansion Wars (combined) — every tuned number of the province scale. Ported from the province scale's spot game
// (province/js/game.js), with distances in country map units, since the province window is a close-up of the country map.
(function () {
  'use strict';
  window.XW.province.CONFIG = {
    SPEED: 30,              // map units a real second for marching soldiers (the window shows about a fifth of the map)
    RIVER_SLOW: 0.5,        // crossing a river border marches at this share of the speed
    // Garrisons grow in real time, drawn from the owner's field army (nation.soldiers): soldiers a second, and the cap.
    GROW: { e: 1.2, v: 4.0, t: 6.0, c: 8.0, f: 2.0 },   // 4x the first version
    CAP: { e: 40, v: 80, t: 160, c: 240, f: 480 },
    // Fortress towers: an enemy march in range is slowed to SLOW of its speed and shot at DMG soldiers a second.
    // A tower upgraded to 2 (country card) has its range multiplied by UPGRADED_MUL.
    FORT: { range: 40, dmg: 2, slow: 0.5, upgradedMul: 2 },
    SEND_STEPS: [10, 25, 50, 100],   // % of a province's garrison sent by one order
    MUSTER: 10,             // soldiers moved between the field army and a garrison with one tap
    RECRUIT: 0.5,           // province battles only: soldiers a second joining the field army for each province held
    // Computer players in the window: how often they think, the share they send, the least garrison that moves,
    // and the most moves a minute.
    AI: { every: 1.8, fraction: 0.6, threshold: 7, perMinute: 10 },
    SETTLE_STEP: 0.5        // seconds per step when marches finish at once (on leaving the province)
  };
})();
