// Expansion Wars — unit battle engine: every tuned number of a battle lives here.
// Plain script. Sets window.V4.CONFIG. No DOM. (The engine keeps the V4 name it had as the unit scale.)
(function () {
  'use strict';
  window.V4 = window.V4 || {};
  window.V4.CONFIG = {
    // Field sizes. 'small' is the old one-screen field (50 x 32 tiles of 20 units, the same space as V1 and V2).
    // 'large' is 2 x 2 screens (100 x 64 tiles) with a camera and a mini map.
    SIZE: {
      small: { cols: 50, rows: 32 },
      large: { cols: 100, rows: 64 }
    },
    COLS: 50,
    ROWS: 32,
    TILE: 20,

    // Fixed simulation step, in seconds. Replays depend on this being constant.
    TICK: 0.05,

    // 'cavalry' are the scouts (light horse). 'heavy' is heavy cavalry: an army of 100 or more has one squad, and it is the general.
    TYPES: ['cavalry', 'pikemen', 'swordsmen', 'archers', 'slingers', 'catapults', 'heavy'],

    // speed: tiles per second on foot. atk: damage per person per second (before counters).
    // range and minRange in tiles. reload: seconds between volleys (animation only).
    UNIT: {
      cavalry:   { label: 'Scouts',    speed: 2.0, atk: 0.9, range: 1.2, melee: true,  mounted: true,  minRange: 0, reload: 0 },
      pikemen:   { label: 'Pikemen',   speed: 0.8, atk: 0.6, range: 1.2, melee: true,  mounted: false, minRange: 0, reload: 0 },
      swordsmen: { label: 'Swordsmen', speed: 1.0, atk: 0.9, range: 1.2, melee: true,  mounted: false, minRange: 0, reload: 0 },
      archers:   { label: 'Archers',   speed: 1.0, atk: 0.35, range: 6,   melee: false, mounted: false, minRange: 0, reload: 1.5 },
      slingers:  { label: 'Slingers',  speed: 1.2, atk: 0.5, range: 4,   melee: false, mounted: false, minRange: 0, reload: 1.0 },
      catapults: { label: 'Catapults', speed: 0.4, atk: 0.6, range: 9,   melee: false, mounted: false, minRange: 2, reload: 2.5 },
      heavy:     { label: 'Heavy cavalry', speed: 1.5, atk: 1.4, range: 1.2, melee: true, mounted: true, minRange: 0, reload: 0 }
    },

    // Rough strength of one dot, used to balance random teams. Not used in battle.
    POWER: { cavalry: 3, pikemen: 2, swordsmen: 2.5, archers: 2, slingers: 1.5, catapults: 3.5, heavy: 4.5 },

    // How far a unit can see enemies, in tiles. Defenders see further (see DEFENDER_SIGHT_BONUS).
    // The scouts (cavalry) see three times as far as they used to (8 tiles).
    SIGHT: { cavalry: 24, pikemen: 6, swordsmen: 6, archers: 7, slingers: 6, catapults: 6, heavy: 8 },
    DEFENDER_SIGHT_BONUS: 4,

    // Counters: a strong pairing deals COUNTER.up, a weak pairing COUNTER.down, otherwise 1.
    STRONG: {
      cavalry: ['archers', 'slingers', 'catapults'],
      pikemen: ['cavalry', 'heavy'],
      swordsmen: ['pikemen'],
      archers: ['swordsmen', 'cavalry'],
      slingers: ['catapults', 'archers'],
      catapults: [],
      heavy: ['archers', 'slingers', 'catapults', 'swordsmen']
    },
    WEAK: {
      cavalry: ['pikemen'],
      pikemen: ['archers'],
      swordsmen: ['archers', 'cavalry', 'heavy'],
      archers: [],
      slingers: ['cavalry', 'heavy'],
      catapults: [],
      heavy: ['pikemen']
    },
    COUNTER: { up: 1.5, down: 0.6 },
    RANGED_IN_MELEE: 0.6,   // ranged units hitting at arm's length
    CATAPULT_WALLS: 1.5,    // catapults against units on town, wall or gate tiles
    REAR_MUL: 1.3,          // extra damage taken when hit from directly behind

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
    // flank: damage multiplier when hit from the side. area: multiplier on ranged damage taken.
    // charge: multiplier on a cavalry charge. arc: the front, in degrees, centred on the unit's facing.
    // A column is long along its march (narrow front, exposed sides); a line is wide across it.
    FORMATION: {
      line:    { label: 'Line',         speed: 1.0, melee: 1.0, flank: 1.5, area: 1.0, charge: 1.0, arc: 120, fatigue: 1.0 },
      column:  { label: 'March column', speed: 1.5, melee: 0.8, flank: 2.0, area: 1.3, charge: 1.0, arc: 50,  fatigue: 1.2 },
      scatter: { label: 'Scatter',      speed: 0.8, melee: 1.0, flank: 0.7, area: 0.5, charge: 0.8, arc: 360, fatigue: 0.9 },
      shield:  { label: 'Shield wall',  speed: 0.5, melee: 1.2, flank: 2.0, area: 0.5, charge: 1.0, arc: 150, fatigue: 1.3 }
    },

    // Terrain by tile code. def divides damage taken. cavSpeed: extra speed factor for cavalry.
    // hides: units in it cannot be seen beyond HIDE.range.
    TERRAIN: {
      g: { label: 'Grass',      speed: 1.0, def: 1.0, noCharge: false },
      w: { label: 'Woods',      speed: 0.7, def: 1.2, noCharge: true,  cavSpeed: 0.5, hides: true },
      h: { label: 'Tall grass', speed: 0.8, def: 1.0, noCharge: false, hides: true },
      d: { label: 'Road',       speed: 1.6, def: 1.0, noCharge: false },
      r: { label: 'River',      speed: 0.5, def: 0.8, noCharge: false },
      v: { label: 'Deep river', speed: 0,   def: 1.0, noCharge: true,  impassable: true },
      f: { label: 'Ford',       speed: 0.8, def: 1.0, noCharge: false },
      b: { label: 'Bridge',     speed: 1.2, def: 1.0, noCharge: true },
      t: { label: 'Town',       speed: 0.8, def: 1.2, noCharge: true },
      x: { label: 'Wall',       speed: 0,   def: 1.0, noCharge: true,  impassable: true },
      y: { label: 'Gate',       speed: 0.8, def: 1.2, noCharge: true }
    },

    // Fatigue, 0 (fresh) to 100 (spent). Marching costs more on rough ground; contact costs the most.
    // Resting (still and out of contact) gives it back. Tired units are slower and hit softer.
    FATIGUE: {
      move: { g: 0.25, h: 0.35, w: 0.4, r: 0.75, f: 0.5, d: 0.1, t: 0.25, y: 0.25, b: 0.2 },   // per second moving
      contact: 1.2,           // per second in contact
      rest: 3.0,              // per second recovered when still and out of contact
      contactWindow: 20,      // steps (1 second) that count as "in contact" after a hit
      speedLoss: 0.35,        // speed multiplier falls by this much at full fatigue
      atkLoss: 0.3            // damage multiplier falls by this much at full fatigue
    },

    DAMAGE_K: 0.02,            // overall scale of damage per second
    AMBUSH: { range: 3, duration: 5, dmgMul: 1.5 },
    // Hiding: a unit in woods or tall grass can only be seen from HIDE.range tiles away, until it fires.
    HIDE: { range: 2.5, reveal: 3 },
    // A strike from hiding: everything within range takes the burst at mul times the normal damage.
    STRIKE: { range: 3, mul: 2.5 },
    CHARGE: { window: 3, mul: 1.3 },
    RUSH_MOVE: 1.3,            // speed factor for a rush move (ignores enemies on the way)
    LOCAL: { range: 4, outnumbered: 1.5 },   // how far a unit looks for friends and foes, and when it counts as outnumbered

    // Morale is per unit, 0 to 100. Losses and rout are as before. Recovery and rally are new.
    MORALE: {
      perLoss: 60,             // morale lost for each full strength lost
      neighbourHit: 10,        // a routing unit knocks this off friends nearby
      neighbourRange: 3,
      floor: 0.3,              // a unit below this morale still deals at least this share of its attack
      routSpeed: 1.5,
      calm: 0.5,               // per second, out of contact
      pause: 1.0,              // extra per second for a unit that has stood still for a while
      pauseAfter: 3,           // seconds still before the pause bonus starts
      allies: 1.0,             // per second when a steady friend is close
      allyRange: 3,
      allyMorale: 60,          // a friend must be at least this steady
      contactRange: 4,         // an enemy this close stops calm recovery
      capture: 15,             // one-off, to friends near a captured objective
      death: 8,                // one-off, to friends near an enemy that dies
      enemyFlee: 6,            // one-off, to friends near an enemy that routs
      enemyFleeRange: 6,
      rallyAt: 25,             // a routed unit rallies at this morale, if no enemy is within threat range
      threatRange: 6
    },

    HOLD: 10,                  // seconds on an objective to take it
    HOLD_RADIUS: 2.5,          // tiles
    BELL: { delay: 20, popPerLevy: 20, levyMorale: 70, levyAtk: 0.8 },
    REINFORCE_EVERY: 30,       // seconds between attacker reinforcement dots
    SURRENDER_RATIO: 20,       // a side with 1/20 of the other side's strength gives up

    // Computer-planned defence. A share of the infantry ambushes from woods, the rest hold a station.
    AI: { ambushShare: 0.34, leash: 8 },
    // Moving as a team (units with no order): the line (pikemen and swordsmen) keeps within COHESION tiles of its rearmost
    // unit, and ranged units stay BEHIND tiles behind the front of the line until an enemy is in their range.
    TEAM: { line: ['pikemen', 'swordsmen'], cohesion: 2.5, behind: 1.5 },
    // The general is a side's heavy cavalry (an army of POOL or more has one squad of it). Its own units within RADIUS
    // tiles strike MUL times as hard. If the general is destroyed, every unit of its side loses LOSS morale.
    GENERAL: { pool: 100, radius: 4, mul: 1.5, loss: 25 },

    // Deployment: the player's units may be placed within this many tiles of their edge (small field).
    DEPLOY_X: 6,

    // Battlefield generator defaults. The setup screen starts from these; the request carries the chosen values.
    GEN: {
      size: 'large',        // small (one screen) or large (2 x 2 with a mini map)
      gates: 3,             // openings in each settlement wall: 2, 3 or 4
      river: 'bridges',     // none, fords (shallow crossings) or bridges (deep water, bridges only)
      roads: true,          // a road from the attacker's edge to the settlement
      grass: true,          // tall grass patches (hiding)
      fatigue: true,        // units tire on the march and in contact
      facing: true,         // units have a front; flanks and rear are exposed (battalions and squads)
      ambush: 'prompt',     // prompt: you choose when a hidden unit strikes. auto: it strikes on its own
      approach: 'mixed',    // where units head by default: flank, centre, base, or mixed ('none' keeps them still)
      woods: true,          // dark woods on both sides (the Woods option)
      walls: true           // settlement walls; off leaves the settlement as open ground with its buildings
    },
    GEN_OPTIONS: {
      size: ['small', 'large'],
      gates: [2, 3, 4],
      river: ['none', 'fords', 'bridges'],
      ambush: ['prompt', 'auto'],
      approach: ['flank', 'centre', 'base', 'mixed', 'none']
    },
    // Units. Each side has at most this many of one type. A unit takes room: it keeps this radius (in tiles) clear of others.
    MAX_PER_TYPE: 2,
    FOOTPRINT: 0.45,
    // Inside a walled settlement: how many units fit, by settlement. Units beyond that stand outside.
    CAPACITY: { village: 4, town: 8, city: 8, fortress: 12 },
    // Inside the walls, a unit is sheltered from arrows fired from outside, sees further, and is hidden from outside beyond HIDE.wall.
    WALL: { arrow: 0.5, sight: 3, hide: 2.5 },

    // Formations. Each side can arrange up to two groups. A unit's role sets where it stands when the army is arranged.
    GROUPS: 2,
    GROUP_NAME: { 1: 'Line', 2: 'Horse' },
    ROLE: { pikemen: 'front', swordsmen: 'front', archers: 'centre', slingers: 'centre', catapults: 'centre', cavalry: 'flank', heavy: 'flank' },
    DEFAULT_GROUP: { pikemen: 1, swordsmen: 1, archers: 1, slingers: 1, catapults: 1, cavalry: 2, heavy: 2 },
    TEAM_NAME: ['attacker', 'defender', 'third']
  };
})();
