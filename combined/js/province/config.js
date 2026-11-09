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
    // A province's grade: 0 empty dot, 1 village, 2 town, 3 city, 4 fortress, 5 fortress with an upgraded tower. A half
    // upgrade (province scale, paid in soldiers) adds 0.5, and every number below is read halfway between the two grades.
    //   DEF     the ground: the attackers' kills are cut by this share and the defenders' raised by it (a village: -25%)
    //   ROUNDS  how many rounds a fight there takes; each round each side commits 1/ROUNDS of its army
    //   GROW    soldiers a second the province grows by itself (province battles, where there is no field army)
    //   CAP     the most soldiers it grows to
    // Province battles: how many provinces a town, city and fortress become when zoomed in (the settlement and villages).
    SPLITS: { t: 2, c: 3, f: 5 },
    SURRENDER: 10,          // province battles, when Surrender is on in ⚙️: a side outnumbered this many to one gives up
    GRADE: {
      DEF: [-0.25, -0.25, -0.125, 0, 0.125, 0.25],
      ROUNDS: [3, 3, 4, 6, 8, 10],
      GROW: [0.25, 0.5, 1, 1.5, 2, 2.5],
      CAP: [40, 80, 160, 240, 480, 600]
    },
    // A fight is a few rounds (ROUNDS above). In each round the soldiers each side commits strike in turn: the attackers'
    // first 20%, then the defenders' first 50%, the attackers' next 50%, the defenders' other 50%, and the attackers' last
    // 30%. A strike kills KILL_A (attackers) or KILL_D (defenders) for each soldier in it, give or take NOISE. A side that has
    // lost BREAK of what it committed this round routs: its strikes for the rest of the round hit at ROUT_STRIKE, and it
    // starts every later round shaken (its strikes times SHAKEN for each rout, no lower than half).
    // Fitted at city level: 100 against 100 the defenders hold with about 89; 200 against 100 the attackers win with about
    // 121; 500 against 100 the attackers win with about 475.
    FIGHT: {
      STRIKES: [['a', 0.2], ['d', 0.5], ['a', 0.5], ['d', 0.5], ['a', 0.3]],
      KILL_A: 0.6, KILL_D: 1.8,
      BREAK: 0.5, ROUT_STRIKE: 0.5, SHAKEN: 0.9,
      // At the end of a round, a side that routed and is outnumbered OVERWHELM to one (counting the ground) breaks: the rest
      // of the defenders give up the province at once, or the rest of the attackers pull back with what they have left.
      OVERWHELM: 10,
      NOISE: 0.1
    },
    // Computer players in the window: how often they think, the share they send, the least garrison that moves,
    // and the most moves a minute.
    AI: { every: 1.8, fraction: 0.6, threshold: 7, perMinute: 10 },
    SETTLE_STEP: 0.5        // seconds per step when marches finish at once (on leaving the province)
  };
})();
