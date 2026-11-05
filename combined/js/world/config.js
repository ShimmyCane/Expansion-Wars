// Expansion Wars (combined) — numbers that tie the three scales together: time dilation, saving, and the links.
// Each scale's own numbers live in its own config (country/config.js, province/config.js, unit/engine/config.js).
(function () {
  'use strict';
  window.XW.world.CONFIG = {
    // Time dilation. The world has one clock, in world seconds. A country turn is TURN world seconds.
    // RATE is how many world seconds pass for each real second while you look at a scale:
    // on the country map time runs at full speed; in a province it slows; in a battle it nearly stops.
    // With these values a country turn lasts 60 s on the country map, 5 minutes in a province, and 20 minutes in a battle.
    TURN: 60,
    RATE: { country: 1, province: 0.2, unit: 0.05 },

    // Saving. The world is kept on this device after every turn, every scale change, and every AUTOSAVE real seconds.
    // It goes to the family database (table xw_worlds) when signed in, at most every CLOUD_EVERY real seconds,
    // and at once after a turn or a battle.
    AUTOSAVE: 10,
    CLOUD_EVERY: 60,
    SAVE_KEY: 'xw-combined-world',

    // The province window: the province you zoom into, and the provinces up to RINGS steps from it.
    RINGS: 2,

    // Soldiers stationed in a province (its garrison). A nation's field army is separate (nation.soldiers).
    // START_GAR: the garrison of each province a nation starts with.
    START_GAR: 5,

    // A finished battle is kept in world.battles. The list is trimmed to this many.
    BATTLES_KEPT: 40,
    LOG_KEPT: 80
  };
})();
