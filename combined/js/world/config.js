// Expansion Wars (combined) — numbers that tie the three scales together: time dilation, saving, and the links.
// Each scale's own numbers live in its own config (country/config.js, province/config.js, unit/engine/config.js).
(function () {
  'use strict';
  window.XW.world.CONFIG = {
    // Time dilation. The world has one clock, in world seconds. A country turn is TURN world seconds.
    // RATE is how many world seconds pass for each real second while you look at a scale:
    // on the country map time runs at full speed; in a province it slows; in a battle it nearly stops.
    // With these values a country turn lasts 120 s on the country map, 10 minutes in a province, and 20 minutes in a battle.
    TURN: 60,
    RATE: { country: 0.5, province: 0.1, unit: 0.05 },
    // ×2 fast-forward on the country and province scales (the button in the top bar).
    FAST: 2,
    // While a fortress is in the province window, province time runs at this share again (more time to react).
    FORT_DILATION: 0.5,
    // A risk-style fight on a province is fought in rounds of this many world seconds (see province/rules.js). Every soldier
    // rolls each round, so a fight takes a few rounds: about 20 s each in a province, 4 s on the country map.
    FIGHT_ROUND: 2,
    // How a province fight is settled: 'risk' (every soldier rolls, round after round: the campaign) or 'phased' (three turns
    // of waves with morale and routing: province battles; its numbers are PHASED in province/config.js). app/modes.js sets it.
    FIGHT_MODEL: 'risk',
    // An army moves up to this many provinces in one order.
    MOVE_HOPS: 3,

    // Saving. The world is kept on this device after every turn, every scale change, and every AUTOSAVE real seconds.
    // It goes to the family database (table xw_worlds) when signed in, at most every CLOUD_EVERY real seconds,
    // and at once after a turn or a battle.
    AUTOSAVE: 10,
    CLOUD_EVERY: 60,
    SAVE_KEY: 'xw-combined-world',
    // The family database tag of the world (app/modes.js sets it for each battle mode).
    APP: 'combined',

    // The province window: the province you zoom into, and the provinces up to RINGS steps from it.
    RINGS: 2,

    // Soldiers stationed in a province (its garrison). A nation's field army is separate (nation.soldiers).
    // START_GAR: the garrison of each province a nation starts with.
    START_GAR: 20,

    // A finished battle is kept in world.battles. The list is trimmed to this many.
    BATTLES_KEPT: 40,
    LOG_KEPT: 80
  };
})();
