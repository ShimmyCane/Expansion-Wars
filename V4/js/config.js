// Expansion Wars — V4 battle view. Every tuned number lives here.
// Plain script. Sets window.V4.CONFIG. No DOM.
(function () {
  'use strict';
  window.V4 = window.V4 || {};
  window.V4.CONFIG = {
    // Field: 50 x 32 tiles of 20 units = 1000 x 640, the same space as V1 and V2.
    COLS: 50,
    ROWS: 32,
    TILE: 20,

    TYPES: ['cavalry', 'pikemen', 'swordsmen', 'archers', 'slingers', 'catapults'],

    // speed: tiles per second on foot. atk: damage per person per second (before counters).
    // range and minRange in tiles. reload: seconds between volleys (animation only).
    UNIT: {
      cavalry:   { label: 'Cavalry',   speed: 2.0, atk: 0.9, range: 1.2, melee: true,  mounted: true,  minRange: 0, reload: 0 },
      pikemen:   { label: 'Pikemen',   speed: 0.8, atk: 0.6, range: 1.2, melee: true,  mounted: false, minRange: 0, reload: 0 },
      swordsmen: { label: 'Swordsmen', speed: 1.0, atk: 0.9, range: 1.2, melee: true,  mounted: false, minRange: 0, reload: 0 },
      archers:   { label: 'Archers',   speed: 1.0, atk: 0.5, range: 6,   melee: false, mounted: false, minRange: 0, reload: 1.5 },
      slingers:  { label: 'Slingers',  speed: 1.2, atk: 0.5, range: 4,   melee: false, mounted: false, minRange: 0, reload: 1.0 },
      catapults: { label: 'Catapults', speed: 0.4, atk: 0.6, range: 9,   melee: false, mounted: false, minRange: 2, reload: 2.5 }
    },

    // Counters: a strong pairing deals COUNTER.up, a weak pairing COUNTER.down, otherwise 1.
    STRONG: {
      cavalry: ['archers', 'slingers', 'catapults'],
      pikemen: ['cavalry'],
      swordsmen: ['pikemen'],
      archers: ['swordsmen', 'cavalry'],
      slingers: ['catapults', 'archers'],
      catapults: []
    },
    WEAK: {
      cavalry: ['pikemen'],
      pikemen: ['archers'],
      swordsmen: ['archers', 'cavalry'],
      archers: [],
      slingers: ['cavalry'],
      catapults: []
    },
    COUNTER: { up: 1.5, down: 0.6 },
    RANGED_IN_MELEE: 0.6,   // ranged units hitting at arm's length
    CATAPULT_WALLS: 1.5,    // catapults against units on town, wall or gate tiles

    // People per dot at each battle scale (cavalry and catapults are set in sim.js).
    GRAIN: { village: 1, fortress: 20, country: 100 },
    // Battle clock caps, in seconds. To confirm after first games.
    CAP: { village: 120, fortress: 120, country: 300 },

    // Opening strategies. speed multiplies the unit's own speed.
    STRATEGY: {
      engage: { label: 'Engage',     speed: 1.0 },
      slow:   { label: 'Slow march', speed: 0.6, ambushMul: 0.5 },
      rush:   { label: 'Rush',       speed: 1.3 },
      ambush: { label: 'Ambush',     speed: 1.3, trigger: 3 },
      kite:   { label: 'Kite',       speed: 1.0, retreat: 2 }
    },

    // Formations. melee: defence against melee (divides damage taken).
    // flank: damage multiplier when hit from the side or rear. area: multiplier on ranged damage taken.
    // charge: multiplier on a cavalry charge.
    FORMATION: {
      line:    { label: 'Line',         speed: 1.0, melee: 1.0, flank: 1.5, area: 1.0, charge: 1.0 },
      column:  { label: 'March column', speed: 1.5, melee: 0.8, flank: 2.0, area: 1.3, charge: 1.0 },
      scatter: { label: 'Scatter',      speed: 0.8, melee: 1.0, flank: 0.7, area: 0.5, charge: 0.8 },
      shield:  { label: 'Shield wall',  speed: 0.5, melee: 1.2, flank: 2.0, area: 0.5, charge: 1.0 }
    },

    // Terrain by tile code. def divides damage taken. cavSpeed: extra speed factor for cavalry.
    TERRAIN: {
      g: { label: 'Grass', speed: 1.0, def: 1.0, noCharge: false },
      w: { label: 'Woods', speed: 0.7, def: 1.2, noCharge: true,  cavSpeed: 0.5 },
      r: { label: 'River', speed: 0.5, def: 0.8, noCharge: false },
      f: { label: 'Ford',  speed: 0.8, def: 1.0, noCharge: false },
      t: { label: 'Town',  speed: 0.8, def: 1.2, noCharge: true },
      x: { label: 'Wall',  speed: 0,   def: 1.0, noCharge: true,  impassable: true },
      y: { label: 'Gate',  speed: 0.8, def: 1.2, noCharge: true }
    },

    DAMAGE_K: 0.02,            // overall scale of damage per second
    AMBUSH: { range: 3, duration: 5, dmgMul: 1.5 },
    CHARGE: { window: 3, mul: 1.3 },
    MORALE: { perLoss: 60, neighbourHit: 10, neighbourRange: 3, floor: 0.3, routSpeed: 1.5 },
    HOLD: 10,                  // seconds on an objective to take it
    HOLD_RADIUS: 2.5,          // tiles
    BELL: { delay: 20, popPerLevy: 20, levyMorale: 70, levyAtk: 0.8 },
    REINFORCE_EVERY: 30,       // seconds between attacker reinforcement dots
    SURRENDER_RATIO: 20        // a side with 1/20 of the other side's strength gives up
  };
})();
