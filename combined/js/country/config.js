// Expansion Wars (combined) — every tuned number of the country scale. Ported from the country scale (country/js/country.js).
// Tiers and the capture rule are shared by all scales: see world/rules.js.
(function () {
  'use strict';
  window.XW.country.CONFIG = {
    W: 1000, H: 640,                 // the map, in map units
    COUNT: 6,                        // nations
    NAMES: ['Your nation', 'Oakfield', 'Riverton', 'Stonevale', 'Mirewood', 'Highmoor'],
    NEUTRAL_FROM: 3,                 // nations from this id on are cautious neutrals
    MIN_REP: { trade: -20, ally: 20, ceasefire: -40 },
    TRADE_SETUP: 20,                 // gold paid once to open a trade route
    TRIBUTE: 10,
    SEND: 0.5,                       // default share of the army an attack sends
    DEFENDER: 1.2,                   // defenders' advantage
    FORT_BONUS: 0.2,                 // each fortress adds this to a nation's defence
    // Growing a province costs gold and food; city to fortress also needs stone. Scaled by costScale (spots held).
    GROW: { v: { to: 't', gold: 10, food: 8 }, t: { to: 'c', gold: 20, food: 12 }, c: { to: 'f', gold: 20, food: 10, stone: 15 } },
    VILLAGE: { gold: 8, food: 6 },   // a village on an empty dot
    CLAIM: { gold: 12, food: 8 },    // a claim on neutral land (its garrison is held by soldiers), per step of the route (plus one)
    MIN_WAR_TURNS: 4,                // a war runs at least this many turns before peace can be offered
    ACCEPT_RATIO: 0.7,               // a nation accepts a ceasefire when its power is at most this share of the other's
    DECLARE_RATIO: 1.5,              // the computer declares war only with this lead, on a neighbour whose power is falling
    // Difficulty, chosen when a campaign starts. you / ai: added to the starting stocks. hard: the computer expands as
    // fast as it can, and once there is no land left to claim it goes to war, picking the neighbour it outmatches most
    // (HARD_RATIO) and leaving alone one that is already fighting two or more (no ganging up).
    DIFFICULTY: {
      easy: { label: 'Easy', you: { food: 200 }, ai: {}, hard: false, note: 'You start with 200 more food. The computer plays as it always has.' },
      medium: { label: 'Medium', you: {}, ai: {}, hard: false, note: 'No extra resources for anyone. The computer plays as it always has.' },
      hard: { label: 'Hard', you: {}, ai: {}, hard: true, note: 'No extra resources. The computer expands as fast as it can, then goes to war strategically.' }
    },
    HARD_RATIO: 1.3,
    OFFER_TURNS: 2,                  // a ceasefire offered to you stands for this many turns, then lapses
    MARCH: { food: 0.05, gold: 1 },  // an attack: food per soldier sent, gold per step plus one
    // Magic: made by fortresses only. An attack or defence spends up to one per four soldiers; each adds a soldier's strength.
    MAGIC_PER_SOLDIER: 0.25, MAGIC_PER_FORT: 25, MAGIC_CAP: 0.25,
    FOOD: { v: 2, t: 4, c: 6, f: 3 },
    UPKEEP: 0.05,            // food a soldier eats a turn: field army and garrisons alike
    WAR_UPKEEP: 1.5,         // the War direction eats this much more
    GAR_KEEP: 2,             // a garrison this small stays put when it moves towards the border
    AUTO_MOVE: 0.25,         // share of the spare garrison a border-bound province sends each step
    MIGRATE_EVERY: 3,        // world seconds between garrison migrations: garrisons drift to the border all the time, peace or war
    TOWER_COST: { gold: 30, stone: 20 },   // upgrading a fortress tower (its range doubles)
    SCIENCE: { v: 0.5, t: 1, c: 2, f: 1.5 },
    TRACK: {
      agri: { name: 'Agriculture', icon: '🌾', per: 0.08, text: '+8% food a level' },
      civic: { name: 'Civics', icon: '🏛️', per: 0.05, text: '+5% population a level (gold follows it)' },
      arms: { name: 'Arms', icon: '🛡️', per: 240, text: '+240 to the army cap a level' }
    },
    TRACK_KEYS: ['agri', 'civic', 'arms'],
    TRACK_COST: { base: 10, growth: 1.15 },
    ARMY_BASE: 240,                  // the army cap before any Arms research (4x the first version)
    LAND_SOLDIERS: 56,               // soldiers one province can feed (4x)
    POP_EAT: 0.5,                    // food a point of population eats a turn
    RATION: 0.5,                     // recruiting runs at full pace with this much food per soldier in store
    POP: { v: 1, t: 2, c: 3, f: 3 },
    TRAIN: { food: 10, gold: 5, tech: 2 },
    FORT_PROVINCE: 2,                // a fortress province adds this to its defence
    BUY: { food: 10, gold: 20, stone: 30 },
    AIM: {
      growth: { name: 'Growth', icon: '🌱', text: 'Claim neutral land, build villages, and upgrade towns and villages to cities. Cities are the population.' },
      war: { name: 'War', icon: '⚔️', text: 'Fortify the front with fortresses, train the army, and attack the weakest neighbour in reach. Uses troops and magic. Your guns slider sets the soldiers.' },
      wealth: { name: 'Wealth', icon: '💰', text: 'Stockpile food, gold and stone for future growth or war. Builds and upgrades only from a surplus.' }
    },
    AIM_KEYS: ['growth', 'war', 'wealth'],
    RESERVE: { growth: { gold: 0, food: 5, stone: 0 }, war: { gold: 5, food: 10, stone: 0 }, wealth: { gold: 40, food: 20, stone: 10 } },
    AUTO_ACTIONS: 2,                 // the most builds and upgrades the autopilot makes in a turn
    PLAN: { growth: ['build', 'v', 't'], war: ['c', 't'], wealth: ['t', 'v', 'build'] },
    RESEARCH_ORDER: { growth: ['civic', 'agri', 'arms'], war: ['arms', 'agri', 'civic'], wealth: ['agri', 'civic', 'arms'] },
    GUNS_FOR: { growth: 0.5, war: 0.8, wealth: 0.2 },
    DIPLO: [
      { type: 'trade', text: 'Trade route (20 gold to set up)' },
      { type: 'ally', text: 'Neutral alliance' },
      { type: 'ceasefire', text: 'Ceasefire' },
      { type: 'tribute', text: 'Send tribute (10 gold)' },
      { type: 'declare', text: 'Declare war' },
      { type: 'attack', text: 'Attack' }
    ],
    CULTURE: { v: 1, t: 1, c: 1, f: 4 },
    OCC_PENALTY: 0.4,                // occupied provinces cut production by this share of the nation
    WAVES: 3, SURRENDER: 2,          // battles: three waves; twice the defence means surrender
    MAX_DIST: 4,                     // an attack reaches this many steps
    FAR_PER_STEP: 0.1, FAR_PER_RIVER: 0.08, FAR_MAX: 0.5,
    CHIP_PER_HOSTILE: 0.05, CHIP_MAX: 0.4,
    TAILWIND: 1.25, TAILWIND_TURNS: 10,
    COORD: 0.05, COORD_MIN: 0.8,     // allies attacking together: 5% less strength for each extra nation
    REVOLT_AT: 70, REVOLT_CERTAIN: 90,
    PROVS: 15,                       // provinces per nation
    PROV_GAP: 45,
    TERRAIN: {
      lake: { n: 3, r: 40, step: 2, wear: 0.1, icon: '🌊', name: 'Lake', note: 'boats only: crossing costs 2 extra steps and 10% of the army' },
      forest: { n: 6, r: 26, step: 1, wear: 0.05, icon: '🌲', name: 'Dense forest', note: 'crossing costs 1 extra step and 5% of the army in the trees' },
      mountain: { n: 6, r: 22, step: 1, wear: 0, icon: '⛰️', name: 'Mountain', note: 'crossing costs 1 extra step; provinces on the slope defend better' }
    },
    RELEASE_CHUNK: 10, BUYOUT_GOLD: 2, DISBAND_GOLD: 0.5, RELEASE_MIN: 2,
    START_VILLAGES: 2, START_TOWNS: 1,
    NEUTRAL_MAX: 24, NEUTRAL_GROW: 2,   // neutral garrisons 4x
    FEATURE_NAME: { farm: 'farmland', trade: 'trade route', defence: 'defensive ground' },
    VALUE: { e: 0.5, v: 1, t: 2, c: 3, f: 4 }
  };
})();
