// Expansion Wars — Family database sync for saved maps (table xw_maps).
// This device keeps every map and note first (see store.js). When the family
// account is signed in, maps and notes are also written to Supabase, and maps
// from other devices are pulled in. The game works fully without it.
window.XWCloud = (function () {
  'use strict';

  var cfg = window.XW_CONFIG || {};
  var sb = null;
  var session = null;
  var state = 'device';            // 'device' | 'busy' | 'ok' | 'error'
  var message = 'Saved on this device.';
  var listeners = [];
  var onError = function () {};
  var queueTimer = null;
  var pending = {};                // map ids waiting to be pushed

  function setState(s, msg) {
    state = s;
    message = msg;
    listeners.forEach(function (fn) { fn({ state: state, message: message, signedIn: !!session }); });
  }

  function fail(prefix, err) {
    var text = prefix + (err && err.message ? err.message : String(err));
    setState('error', text);
    onError(text);
    return new Error(text);
  }

  function withTimeout(p) {
    return Promise.race([
      p,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('Timed out')); }, cfg.timeoutMs || 8000);
      })
    ]);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the database library')); };
      document.head.appendChild(s);
    });
  }

  function ensureSb() {
    if (sb) return Promise.resolve(sb);
    var lib = window.supabase
      ? Promise.resolve()
      : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    return lib.then(function () {
      sb = window.supabase.createClient(cfg.url, cfg.key);
      return sb;
    });
  }

  // Local record <-> table row. Column names match supabase/001_xw_maps.sql.
  function toRow(r) {
    return {
      id: r.id,
      created_at: r.created_at,
      updated_at: r.updated_at || r.created_at,
      level: r.level,
      players: r.players,
      max_opponents: r.max_opponents,
      title: r.title,
      description: r.description || '',
      rank: r.rank || null,
      features: r.features || [],
      notes: r.notes || [],
      times_played: r.times_played || 0,
      wins: r.wins || 0,
      losses: r.losses || 0,
      map: r.map
    };
  }

  function fromRow(row) {
    return {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      level: row.level,
      players: row.players,
      max_opponents: row.max_opponents,
      title: row.title,
      description: row.description || '',
      rank: row.rank,
      features: row.features || [],
      notes: row.notes || [],
      times_played: row.times_played,
      wins: row.wins,
      losses: row.losses,
      map: row.map
    };
  }

  // Write the given local records to the table, one batch.
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // One bad id would fail the whole batch, so records without a UUID are skipped and reported.
  function pushRecords(records) {
    if (!session || !records.length) return Promise.resolve();
    var good = records.filter(function (r) { return UUID.test(r.id); });
    var skipped = records.length - good.length;
    if (skipped) onError('Not sent: ' + skipped + (skipped === 1 ? ' map has' : ' maps have') + ' an old id on this device.');
    if (!good.length) return Promise.resolve();
    return ensureSb().then(function (client) {
      return withTimeout(client.from('xw_maps').upsert(good.map(toRow), { onConflict: 'id' }));
    }).then(function (res) {
      if (res.error) throw res.error;
    });
  }

  // Maps from other devices are pulled in; the newer copy of each map wins.
  function mergeRemote(rows, store) {
    var local = store.list();
    var byId = {};
    local.forEach(function (r) { byId[r.id] = r; });
    rows.forEach(function (row) {
      var r = fromRow(row);
      var mine = byId[r.id];
      if (!mine) store.add(r, true);
      else if ((r.updated_at || '') > (mine.updated_at || '')) store.replace(r);
    });
  }

  // Pull everything, then push everything this device has.
  function syncAll(store) {
    if (!session) return Promise.resolve();
    setState('busy', 'Syncing…');
    return ensureSb().then(function (client) {
      return withTimeout(client.from('xw_maps').select('*'));
    }).then(function (res) {
      if (res.error) throw res.error;
      mergeRemote(res.data || [], store);
      return pushRecords(store.list());
    }).then(function () {
      pending = {};
      setState('ok', 'Synced ' + new Date().toLocaleTimeString() + '.');
    }).catch(function (err) {
      throw fail('Sync: ', err);
    });
  }

  // Changes are pushed a moment after they happen, so a burst of taps sends once.
  function queue(store, id) {
    if (!session) return;
    pending[id] = true;
    clearTimeout(queueTimer);
    queueTimer = setTimeout(function () {
      var ids = Object.keys(pending);
      pending = {};
      var records = store.list().filter(function (r) { return ids.indexOf(r.id) !== -1; });
      setState('busy', 'Saving…');
      pushRecords(records).then(function () {
        setState('ok', 'Saved to Family ' + new Date().toLocaleTimeString() + '.');
      }).catch(function (err) { fail('Save: ', err); });
    }, 600);
  }

  function getSession() {
    return ensureSb().then(function (client) {
      return withTimeout(client.auth.getSession());
    }).then(function (res) {
      session = res.data && res.data.session ? res.data.session : null;
      return session;
    });
  }

  // Start-up: if a family session is saved on this device, sync quietly.
  // Offline is normal, so a failure here only changes the status pill.
  function init(store, errorHandler) {
    onError = errorHandler || onError;
    return getSession().then(function (s) {
      if (!s) { setState('device', 'Not signed in. Saved on this device.'); return; }
      return syncAll(store);
    }).catch(function () {
      session = null;
      setState('device', 'Database not reachable. Saved on this device.');
    });
  }

  function signIn(store, email, password) {
    return ensureSb().then(function (client) {
      return withTimeout(client.auth.signInWithPassword({ email: email, password: password }));
    }).then(function (res) {
      if (res.error) throw res.error;
      session = res.data.session;
      return syncAll(store);
    }).catch(function (err) {
      throw fail('Sign in: ', err);
    });
  }

  function signOut() {
    return ensureSb().then(function (client) {
      return client.auth.signOut();
    }).catch(function () { /* signing out locally is enough */ }).then(function () {
      session = null;
      setState('device', 'Signed out. Saved on this device.');
    });
  }

  // Counts rows in the table; used by the database check in ⚙️.
  function dbCheck() {
    return ensureSb().then(function (client) {
      return withTimeout(client.from('xw_maps').select('*', { count: 'exact', head: true }));
    }).then(function (res) {
      if (res.error) throw res.error;
      return '✅ xw_maps reachable, ' + res.count + ' maps in the family table.';
    }).catch(function (err) {
      throw fail('Database check: ', err);
    });
  }

  return {
    init: init,
    signIn: signIn,
    signOut: signOut,
    syncAll: syncAll,
    queue: queue,
    dbCheck: dbCheck,
    isSignedIn: function () { return !!session; },
    onState: function (fn) { listeners.push(fn); fn({ state: state, message: message, signedIn: !!session }); }
  };
})();
