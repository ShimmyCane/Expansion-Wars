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
    // Province battles only: soldiers a second joining the field army from each province held, by tier. Higher tiers recruit more.
    RECRUIT: { e: 0.25, v: 0.5, t: 1.0, c: 1.5, f: 2.0 },
    // Province battles settle a fight in three turns (as in Torn Wars): the first 20% of each army fights, then 50%, then the
    // last 30%. Morale decides how it goes. At the start of each turn an army is in formation (morale at least FORM), wavering,
    // or routing (below ROUT). Each soldier in a wave kills KILL of the enemy wave, times (EFF_BASE + morale / 100), give or take NOISE,
    // and a routing wave kills none and loses ROUT_LOSS of itself as it runs. A turn moves morale by SWING times the difference in losses, so the middle turn,
    // with half the army in it, can tilt the whole battle. After the last turn the side with more left, weighted by morale, wins.
    PHASED: {
      ROUND: 3,                       // real seconds a turn takes
      WAVES: [0.2, 0.5, 0.3],         // the share of each army fighting in turns 1, 2 and 3
      SWING: [60, 120, 60],           // morale points moved by a turn for a 100% difference in losses
      KILL: 0.5,                      // enemy soldiers a soldier kills in a turn at morale 50
      EFF_BASE: 0.5,                  // the kill rate is KILL * (EFF_BASE + morale / 100): from half to one and a half times
      NOISE: 0.35,                    // each strike is scaled by 1 plus or minus this much, at random
      START: 70,                      // morale at the start
      DEF_BONUS: 3,                   // more morale to the defender for each point of defence (ground, slope, fortress)
      FORM: 50, ROUT: 25,             // in formation at or above FORM, routing below ROUT
      ROUT_LOSS: 0.35                 // the share of a routing wave cut down as it runs
    },
    // Computer players in the window: how often they think, the share they send, the least garrison that moves,
    // and the most moves a minute.
    AI: { every: 1.8, fraction: 0.6, threshold: 7, perMinute: 10 },
    SETTLE_STEP: 0.5        // seconds per step when marches finish at once (on leaving the province)
  };
})();
