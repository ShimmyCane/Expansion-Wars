// Expansion Wars (combined) — the world in the family database (table xw_worlds, see supabase/004_xw_worlds.sql).
// One row per world: the whole world as JSON, plus a few columns to list them by. The world is written whole each time
// (an upsert on its id), so the row is always one consistent snapshot. Sign-in is the shared one in the ⚙️ notes panel.
// Not signed in, or the database not reachable: the game carries on, saved on this device, and says so.
(function () {
  'use strict';
  var XW = window.XW, W = XW.world, bus = XW.core.bus;
  var cfg = window.XW_CONFIG || {};
  var TABLE = 'xw_worlds';
  var sb = null, lastPush = 0, busy = false;
  var status = { state: 'device', message: 'Not signed in: the world is saved on this device.' };

  function setStatus(state, message) {
    status = { state: state, message: message };
    bus.emit('world:saved', { where: 'cloud', ok: state === 'ok', message: message });
  }

  function withTimeout(p) {
    return Promise.race([p, new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('Timed out')); }, cfg.timeoutMs || 8000);
    })]);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the database library')); };
      document.head.appendChild(s);
    });
  }

  function client() {
    if (sb) return Promise.resolve(sb);
    if (!cfg.url || !cfg.key) return Promise.reject(new Error('No database settings'));
    var lib = window.supabase ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    return lib.then(function () { sb = window.supabase.createClient(cfg.url, cfg.key); return sb; });
  }

  function session() {
    return client().then(function (c) { return withTimeout(c.auth.getSession()); })
      .then(function (res) { return res.data && res.data.session ? res.data.session : null; });
  }

  // The row for one world. data is the whole world; the other columns are for listing worlds.
  function toRow(w) {
    var me = w.nations[w.you];
    return {
      id: w.id, app: 'combined', version: w.v, seed: w.seed, turn: w.time.turn,
      scale: w.view.scale, provinces: w.provs.filter(function (p) { return p.owner === w.you; }).length,
      over: w.over || '', name: me ? me.name : '', updated_at: new Date().toISOString(), data: w
    };
  }

  // Writes the world now. Resolves to true when it is in the family database.
  function push(w) {
    if (busy) return Promise.resolve(false);
    busy = true;
    lastPush = Date.now();
    return session().then(function (s) {
      if (!s) { setStatus('device', 'Not signed in: the world is saved on this device.'); return false; }
      return client().then(function (c) {
        return withTimeout(c.from(TABLE).upsert(toRow(w), { onConflict: 'id' }));
      }).then(function (res) {
        if (res.error) throw res.error;
        setStatus('ok', 'Saved to the family database at ' + new Date().toLocaleTimeString() + ' (turn ' + w.time.turn + ').');
        return true;
      });
    }).catch(function (err) {
      setStatus('error', 'Saved on this device only. Family database: ' + (err && err.message ? err.message : String(err)));
      return false;
    }).then(function (ok) { busy = false; return ok; });
  }

  // Writes the world if it is due (CLOUD_EVERY seconds since the last write), or at once when forced.
  function sync(w, force) {
    if (!w) return Promise.resolve(false);
    if (!force && Date.now() - lastPush < W.CONFIG.CLOUD_EVERY * 1000) return Promise.resolve(false);
    return push(w);
  }

  // The most recently saved world in the family database, or null.
  function latest() {
    return session().then(function (s) {
      if (!s) throw new Error('Sign in first (⚙️, Family database).');
      return client().then(function (c) {
        return withTimeout(c.from(TABLE).select('data').eq('app', 'combined').order('updated_at', { ascending: false }).limit(1));
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      var row = res.data && res.data[0];
      return row ? W.migrate(row.data) : null;
    });
  }

  W.cloud = { sync: sync, push: push, latest: latest, status: function () { return status; }, TABLE: TABLE };
})();
