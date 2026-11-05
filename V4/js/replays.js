// Expansion Wars — V4 replays. Each battle is kept on this device first, then written to the Family database
// (table xw_replays) once the family account is signed in. The connection settings are the same as V2's
// (js/config.js), and the sign-in session is shared with V2 because both pages are on the same origin.
window.V4.replays = (function () {
  'use strict';

  var cfg = window.XW_CONFIG || {};
  var KEY = 'xw4-replays';          // this device's copies
  var MAX_LOCAL = 50;
  var TABLE = 'xw_replays';
  var sb = null, session = null, listeners = [];
  var status = { state: 'device', message: 'Not signed in. Replays are saved on this device.' };

  function setStatus(state, message) {
    status = { state: state, message: message };
    listeners.forEach(function (fn) { fn(status, !!session); });
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
    if (!cfg.url || !cfg.key) return Promise.reject(new Error('No database settings'));
    var lib = window.supabase
      ? Promise.resolve()
      : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    return lib.then(function () {
      sb = window.supabase.createClient(cfg.url, cfg.key);
      return sb;
    });
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // Fallback for browsers or file pages where randomUUID is not available.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ---- This device -----------------------------------------------------------

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function writeLocal(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_LOCAL))); } catch (e) { /* no storage: the replay is still on screen */ }
  }

  // ---- Family database -------------------------------------------------------

  // One replay becomes one row. Rows are only ever added, never edited (see supabase/003_xw_replays.sql).
  function toRow(r) {
    return {
      id: r.id,
      created_at: r.created_at,
      app: 'v4',
      scale: r.scale,
      seed: r.seed,
      mode: r.mode,
      request: r.request,
      commands: r.commands,
      result: r.result,
      winner: r.result.winner,
      how: r.result.how || '',
      seconds: r.result.seconds || 0
    };
  }

  // Writes one replay. Returns a promise: true if it is in the family database now.
  function push(record) {
    if (!session) return Promise.resolve(false);
    return ensureSb().then(function (client) {
      return withTimeout(client.from(TABLE).insert(toRow(record)));
    }).then(function (res) {
      if (res.error) {
        // A row with this id already exists: the replay is already in the family database.
        if (res.error.code === '23505') return true;
        throw res.error;
      }
      return true;
    });
  }

  function markSent(id, sent) {
    var list = readLocal();
    list.forEach(function (r) { if (r.id === id) r.sent = sent; });
    writeLocal(list);
  }

  // Save a finished battle: on this device first, then to the family database if signed in.
  // Returns a promise that resolves to a short message for the screen.
  function save(req, commands, result) {
    var record = {
      id: uuid(),
      created_at: new Date().toISOString(),
      scale: req.scale,
      seed: req.seed,
      mode: req.mode || 'play',
      request: req,
      commands: commands,
      result: result,
      sent: false
    };
    var list = readLocal();
    list.push(record);
    writeLocal(list);

    if (!session) {
      setStatus('device', 'Not signed in. Replay saved on this device.');
      return Promise.resolve('Saved on this device. Sign in to send it to the family database.');
    }
    return push(record).then(function () {
      markSent(record.id, true);
      setStatus('ok', 'Saved to the family database ' + new Date().toLocaleTimeString() + '.');
      return 'Saved to the family database.';
    }).catch(function (err) {
      var msg = err && err.message ? err.message : String(err);
      setStatus('error', 'Replay saved on this device. Not sent: ' + msg);
      return 'Saved on this device. Not sent to the family database: ' + msg;
    });
  }

  // Sends every replay on this device that has not been sent yet.
  function sendPending() {
    if (!session) return Promise.resolve('Sign in first.');
    var pending = readLocal().filter(function (r) { return !r.sent; });
    if (!pending.length) return Promise.resolve('Nothing waiting on this device.');
    setStatus('busy', 'Sending ' + pending.length + ' replay' + (pending.length === 1 ? '' : 's') + '…');
    var done = 0;
    return pending.reduce(function (chain, record) {
      return chain.then(function () {
        return push(record).then(function () { markSent(record.id, true); done++; }).catch(function () { /* left for next time */ });
      });
    }, Promise.resolve()).then(function () {
      var left = pending.length - done;
      setStatus(left ? 'error' : 'ok', left ? done + ' sent, ' + left + ' still waiting on this device.' : 'All ' + done + ' sent.');
      return done + ' sent' + (left ? ', ' + left + ' still waiting.' : '.');
    });
  }

  function getSession() {
    return ensureSb().then(function (client) {
      return withTimeout(client.auth.getSession());
    }).then(function (res) {
      session = res.data && res.data.session ? res.data.session : null;
      if (session) setStatus('ok', 'Signed in to the family database.');
      return session;
    }).catch(function () {
      session = null;
      setStatus('device', 'Database not reachable. Replays are saved on this device.');
    });
  }

  function signIn(email, password) {
    return ensureSb().then(function (client) {
      return withTimeout(client.auth.signInWithPassword({ email: email, password: password }));
    }).then(function (res) {
      if (res.error) throw res.error;
      session = res.data.session;
      setStatus('ok', 'Signed in to the family database.');
      return sendPending();
    });
  }

  function signOut() {
    return ensureSb().then(function (client) {
      return client.auth.signOut();
    }).catch(function () { /* signing out locally is enough */ }).then(function () {
      session = null;
      setStatus('device', 'Signed out. Replays are saved on this device.');
    });
  }

  function onStatus(fn) {
    listeners.push(fn);
    fn(status, !!session);
  }

  return {
    save: save,
    sendPending: sendPending,
    getSession: getSession,
    signIn: signIn,
    signOut: signOut,
    onStatus: onStatus,
    waiting: function () { return readLocal().filter(function (r) { return !r.sent; }).length; },
    // The battles kept on this device, oldest first (each has its request, orders and result).
    local: function () { return readLocal(); },
    isSignedIn: function () { return !!session; },
    // The table name and row shape are in one place, so a change to the migration shows up here.
    TABLE: TABLE
  };
})();
