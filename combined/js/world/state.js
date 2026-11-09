// Expansion Wars (combined) — the world: the single source of truth for every scale.
// The country map, the province window and the battle all read and write this one object. Nothing else holds game
// state that has to survive: views keep only their DOM, and rebuild it from the world.
//
// The world is plain JSON (no functions, no DOM), so it saves, loads and syncs as it is:
//   level, countdown                  province battles only: the level you are on, and the seconds left of 3, 2, 1, Go
//   v, id, seed, created, updated     version, world id (also the database row id), map seed, timestamps
//   time: { t, turn }                 world seconds, and the country turn number (see world/clock.js)
//   you                               the player's nation id (0)
//   nations[]                         id, name, alive, neutral, soldiers (field army), food, gold, stone, magic,
//                                     science, research, culture, tech, morale, happy, unrest, guns, aim, nb ...
//   provs[]                           every map cell: provinces (kind 'province') and neutral terrain (kind 'terrain').
//                                     owner (-1 neutral), tier (e v t c f), gar (garrison), def, occ, cell, adj ...
//   rivers[]                          the province ids each river runs between
//   rel{ 'i-j' }                      war, trade, ally, truce, rep between two nations
//   queue[]                           country orders waiting for the end of the turn
//   marches[]                         soldiers on the road at province scale (owner, from, to, count, p, route, gens)
//   generals{ id }                    every general (owner, name, wins, losses); armies hold their ids in .gens (world/generals.js)
//   battle                            the battle being fought at unit scale, or null (see unit/bridge.js)
//   battles[]                         finished battles (who, where, the result)
//   view: { scale, prov, sendPct,     where the player was looking, so a reload comes back there, and the share of an
//           marchPct }                army a country order sends (sendPct) or a province order sends (marchPct)
//   log[]                             what happened, newest last
//   over                              null, 'won' or 'lost'
(function () {
  'use strict';
  var XW = window.XW, W = XW.world, bus = XW.core.bus;
  var VERSION = 1;
  var current = null;

  // An empty world. country/mapgen.js fills in the map.
  W.blank = function (seed) {
    var now = new Date().toISOString();
    return {
      v: VERSION, id: XW.core.uuid(), seed: seed, created: now, updated: now,
      time: { t: 0, turn: 1 }, you: 0,
      nations: [], provs: [], rivers: [], rel: {}, queue: [], used: {},
      marches: [], battle: null, battles: [], offers: [],
      view: { scale: 'country', prov: null, sendPct: 50, marchPct: 25 },
      log: [], over: null, nextMarch: 0
    };
  };

  // Brings an older saved world up to this version. Returns null when it cannot be used.
  W.migrate = function (w) {
    if (!w || typeof w !== 'object' || !Array.isArray(w.provs) || !Array.isArray(w.nations)) return null;
    if (!w.v) w.v = 1;
    w.marches = w.marches || [];
    w.battles = w.battles || [];
    w.view = w.view || { scale: 'country', prov: null };
    if (!w.view.sendPct) w.view.sendPct = 50;
    if (!w.view.marchPct) w.view.marchPct = 25;
    w.used = w.used || {};
    w.offers = w.offers || [];
    if (w.v > VERSION) return null;
    return w;
  };

  W.VERSION = VERSION;
  W.get = function () { return current; };
  W.set = function (w) { current = w; bus.emit('world:new', w); bus.emit('world:changed', w, 'new'); };

  // Call after any change, with a few words on what changed. Views redraw; the saver notes the world is dirty.
  W.changed = function (reason) {
    if (!current) return;
    current.updated = new Date().toISOString();
    bus.emit('world:changed', current, reason || '');
  };

  // The world log: one line per event, with the turn it happened in.
  W.log = function (w, text) {
    w.log.push('Turn ' + w.time.turn + ': ' + text);
    while (w.log.length > W.CONFIG.LOG_KEPT) w.log.shift();
  };

  // Small lookups every scale uses.
  W.nation = function (w, id) { return id >= 0 ? w.nations[id] : null; };
  W.prov = function (w, id) { return id === null || id === undefined ? null : w.provs[id]; };
  W.relKey = function (i, j) { return i < j ? i + '-' + j : j + '-' + i; };
  W.rel = function (w, i, j) {
    var k = W.relKey(i, j);
    if (!w.rel[k]) w.rel[k] = { war: false, trade: false, ally: false, truce: 0, rep: 0, warSince: 0 };
    return w.rel[k];
  };
  W.ownerName = function (w, owner) { return owner >= 0 ? w.nations[owner].name : 'Neutral'; };
})();
