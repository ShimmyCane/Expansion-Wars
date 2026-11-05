// Expansion Wars — saved maps, notes, progress and high scores.
// Maps and notes are kept on this device first, then written to the Family
// table (xw_maps, see supabase/001_xw_maps.sql) by cloud.js when signed in.
// Progress and high scores stay on this device.
window.XWStore = (function () {
  'use strict';

  var MAPS_KEY = 'xw_maps_v1';
  var PROGRESS_KEY = 'xw_progress_v1';
  var SCORES_KEY = 'xw_scores_v1';
  var LEVEL_COUNT = 15;
  var lastError = null;

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      lastError = 'Saved data could not be read: ' + e.message;
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      lastError = 'Saved data could not be written: ' + e.message;
      return false;
    }
  }

  // A UUID, because the table's id column is uuid.
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Every change to a map is queued for the family table once signed in.
  function queueCloud(id) {
    if (window.XWCloud) window.XWCloud.queue(api, id);
  }

  // ---------- saved maps ----------

  function list() { return readJSON(MAPS_KEY, []); }

  // fromCloud: the record came from the family table, so it is not sent back.
  function add(rec, fromCloud) {
    var maps = list();
    rec.id = rec.id || uid();
    rec.created_at = rec.created_at || new Date().toISOString();
    rec.updated_at = rec.updated_at || rec.created_at;
    maps.push(rec);
    writeJSON(MAPS_KEY, maps);
    if (!fromCloud) queueCloud(rec.id);
    return rec;
  }

  // Replace a record with a newer copy (used when pulling from the family table).
  function replace(rec) {
    var maps = list();
    for (var i = 0; i < maps.length; i++) {
      if (maps[i].id === rec.id) { maps[i] = rec; break; }
    }
    writeJSON(MAPS_KEY, maps);
    return rec;
  }

  // Apply fn to one record, save it and queue it. Returns the updated record or null.
  function update(id, fn) {
    var maps = list();
    for (var i = 0; i < maps.length; i++) {
      if (maps[i].id === id) {
        fn(maps[i]);
        maps[i].updated_at = new Date().toISOString();
        writeJSON(MAPS_KEY, maps);
        queueCloud(id);
        return maps[i];
      }
    }
    return null;
  }

  function recordGame(id, won) {
    return update(id, function (r) {
      r.times_played = (r.times_played || 0) + 1;
      if (won) r.wins = (r.wins || 0) + 1;
      else r.losses = (r.losses || 0) + 1;
    });
  }

  // A note is stored inside its map's notes list: { id, at, text, status }.
  // status: 'open' (new feedback) or 'done' (handled).
  function addNote(id, text) {
    return update(id, function (r) {
      r.notes = r.notes || [];
      r.notes.push({
        id: uid(),
        at: new Date().toISOString(),
        text: String(text).slice(0, 500),
        status: 'open'
      });
    });
  }

  // A note marked done gets the "Done- " prefix on its text, so it is not read again.
  function setNoteStatus(mapId, noteId, status) {
    return update(mapId, function (r) {
      (r.notes || []).forEach(function (n) {
        if (n.id !== noteId) return;
        n.status = status;
        if (status === 'done' && n.text.indexOf('Done- ') !== 0) n.text = 'Done- ' + n.text;
      });
    });
  }

  function setRank(id, stars) {
    return update(id, function (r) { r.rank = stars; });
  }

  function winRate(r) {
    return r.times_played ? Math.round(100 * r.wins / r.times_played) : null;
  }

  // ---------- progression (device only) ----------
  // progress = { completed: { "1": { stars, bestScore, bestSeconds, wins } } }

  function progress() { return readJSON(PROGRESS_KEY, { completed: {} }); }

  function levelStatus(level) {
    var p = progress();
    if (p.completed[String(level)]) return 'done';
    if (level === 1) return 'open';
    return p.completed[String(level - 1)] ? 'open' : 'locked';
  }

  // Highest level the player may start now.
  function highestOpen() {
    var best = 1;
    for (var lvl = 1; lvl <= LEVEL_COUNT; lvl++) {
      if (levelStatus(lvl) !== 'locked') best = lvl;
    }
    return best;
  }

  function starsFor(seconds) {
    if (seconds <= 90) return 3;
    if (seconds <= 180) return 2;
    return 1;
  }

  // Record a win on a level. Returns the level entry.
  function completeLevel(level, seconds, score) {
    var p = progress();
    var key = String(level);
    var prev = p.completed[key] || { stars: 0, bestScore: 0, bestSeconds: null, wins: 0 };
    var stars = starsFor(seconds);
    p.completed[key] = {
      stars: Math.max(prev.stars, stars),
      bestScore: Math.max(prev.bestScore, score),
      bestSeconds: prev.bestSeconds === null ? seconds : Math.min(prev.bestSeconds, seconds),
      wins: prev.wins + 1
    };
    writeJSON(PROGRESS_KEY, p);
    return p.completed[key];
  }

  // ---------- high scores (device only) ----------

  function scores() { return readJSON(SCORES_KEY, []); }

  function addScore(entry) {
    var list = scores();
    list.push({ score: entry.score, level: entry.level, seconds: entry.seconds, at: new Date().toISOString() });
    list.sort(function (a, b) { return b.score - a.score; });
    list = list.slice(0, 10);
    writeJSON(SCORES_KEY, list);
    return list;
  }

  function lastErr() { return lastError; }

  // Notes written before ids and statuses existed get them once, so they can be marked done.
  function fixOldNotes() {
    var maps = readJSON(MAPS_KEY, null);
    if (!maps) return;
    var changed = false;
    maps.forEach(function (r) {
      (r.notes || []).forEach(function (n) {
        if (!n.id) { n.id = uid(); changed = true; }
        if (!n.status) { n.status = 'open'; changed = true; }
      });
    });
    if (changed) writeJSON(MAPS_KEY, maps);
  }

  var api = {
    LEVEL_COUNT: LEVEL_COUNT,
    list: list,
    add: add,
    replace: replace,
    update: update,
    recordGame: recordGame,
    addNote: addNote,
    setNoteStatus: setNoteStatus,
    setRank: setRank,
    winRate: winRate,
    uid: uid,
    progress: progress,
    levelStatus: levelStatus,
    highestOpen: highestOpen,
    starsFor: starsFor,
    completeLevel: completeLevel,
    scores: scores,
    addScore: addScore,
    lastError: lastErr
  };
  fixOldNotes();
  return api;
})();
