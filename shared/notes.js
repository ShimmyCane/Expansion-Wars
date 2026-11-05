// Expansion Wars — notes from any screen. Each note goes to the Family database (table xw_notes) with the screen it was
// written on (page) and what was showing (label). A note written while signed out is kept on this device and sent on
// the next sign-in. The sign-in session is shared by every page on this origin, so signing in once covers all of them.
window.XWNotes = (function () {
  'use strict';
  var cfg = window.XW_CONFIG || {};
  var QUEUE = 'xw-notes-queue';
  var TABLE = 'xw_notes';
  var sb = null, session = null, panels = [];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the database library')); };
      document.head.appendChild(s);
    });
  }

  function client() {
    if (sb) return Promise.resolve(sb);
    if (!cfg.url || !cfg.key) return Promise.reject(new Error('No database settings'));
    var lib = window.supabase ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    return lib.then(function () {
      sb = window.supabase.createClient(cfg.url, cfg.key);
      return sb;
    });
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch (e) { return []; }
  }
  function writeQueue(list) {
    try { localStorage.setItem(QUEUE, JSON.stringify(list.slice(-200))); } catch (e) { /* no storage: the note is still on screen */ }
  }

  function say(msg) { panels.forEach(function (p) { p.status.textContent = msg; }); }

  function refreshSession() {
    return client().then(function (c) { return c.auth.getSession(); }).then(function (res) {
      session = res.data && res.data.session ? res.data.session : null;
      panels.forEach(render);
      return session;
    }).catch(function () { session = null; panels.forEach(render); });
  }

  // Sends one note. Returns a promise that resolves to a message for the panel.
  function send(row) {
    return client().then(function (c) {
      return c.from(TABLE).insert(row).then(function (res) {
        if (res.error) throw res.error;
        return 'Saved to the family database.';
      });
    });
  }

  function flush() {
    var q = readQueue();
    if (!q.length || !session) return Promise.resolve();
    var left = [];
    return q.reduce(function (p, row) {
      return p.then(function () {
        return send(row).catch(function () { left.push(row); });
      });
    }, Promise.resolve()).then(function () {
      writeQueue(left);
      if (left.length === 0) say('All waiting notes are sent.');
    });
  }

  function render(p) {
    var signedIn = !!session;
    p.form.hidden = signedIn;
    p.account.hidden = !signedIn;
    if (signedIn) p.account.querySelector('[data-who]').textContent = session.user.email || 'signed in';
    var waiting = readQueue().length;
    p.waiting.textContent = waiting ? waiting + ' note' + (waiting === 1 ? '' : 's') + ' waiting on this device.' : '';
  }

  function viewLabel(p) {
    var text = '';
    try { text = p.context ? p.context() : ''; } catch (e) { text = ''; }
    return (text || document.title || '').slice(0, 120);
  }

  // Adds the notes and family sign-in to a settings panel. context() describes what is on screen right now.
  function attach(opts) {
    var root = opts.panel;
    var box = document.createElement('div');
    box.className = 'xw-notes';
    box.innerHTML =
      '<h3>Notes</h3>' +
      '<p class="muted small">Notes go to the family database, with the screen they were written on.</p>' +
      '<p class="xw-view muted small"></p>' +
      '<textarea rows="3" maxlength="500" placeholder="What should change here?"></textarea>' +
      '<button type="button" class="xw-save">Save note</button>' +
      '<p class="xw-status muted small" aria-live="polite"></p>' +
      '<h3>Family database</h3>' +
      '<form class="xw-form" hidden>' +
        '<input type="email" autocomplete="username" placeholder="Family email">' +
        '<input type="password" autocomplete="current-password" placeholder="Password">' +
        '<button type="submit">Sign in</button>' +
      '</form>' +
      '<div class="xw-account" hidden><p class="muted small">Signed in as <span data-who></span>.</p>' +
        '<button type="button" class="xw-signout">Sign out</button></div>' +
      '<p class="xw-waiting muted small"></p>';
    root.appendChild(box);
    var p = {
      page: opts.page || document.title, context: opts.context,
      box: box, view: box.querySelector('.xw-view'), text: box.querySelector('textarea'),
      status: box.querySelector('.xw-status'), form: box.querySelector('.xw-form'),
      account: box.querySelector('.xw-account'), waiting: box.querySelector('.xw-waiting')
    };
    panels.push(p);

    box.querySelector('.xw-save').addEventListener('click', function () {
      var text = p.text.value.trim();
      if (!text) { p.status.textContent = 'Write a note first.'; return; }
      var row = { at: new Date().toISOString(), text: text, status: 'open', page: String(p.page).slice(0, 80), label: viewLabel(p), version: '' };
      p.status.textContent = 'Saving…';
      refreshSession().then(function () {
        if (!session) {
          var q = readQueue(); q.push(row); writeQueue(q);
          p.text.value = '';
          say('Saved on this device. Sign in to send it to the family database.');
          render(p);
          return;
        }
        return send(row).then(function (msg) { p.text.value = ''; say(msg); }, function () {
          var q = readQueue(); q.push(row); writeQueue(q);
          p.text.value = '';
          say('Could not reach the database. The note is kept on this device and will be sent later.');
        }).then(function () { render(p); });
      });
    });

    p.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var inputs = p.form.querySelectorAll('input');
      say('Signing in…');
      client().then(function (c) {
        return c.auth.signInWithPassword({ email: inputs[0].value.trim(), password: inputs[1].value });
      }).then(function (res) {
        if (res.error) throw res.error;
        inputs[1].value = '';
        session = res.data.session;
        say('Signed in.');
        panels.forEach(render);
        return flush();
      }).catch(function (err) { say('Could not sign in: ' + (err && err.message ? err.message : 'unknown error')); });
    });
    box.querySelector('.xw-signout').addEventListener('click', function () {
      client().then(function (c) { return c.auth.signOut(); }).then(function () { session = null; say('Signed out.'); panels.forEach(render); });
    });

    // Keep the "this note is for" line current whenever the panel opens.
    root.addEventListener('toggle', function () { p.view.textContent = 'This note is for: ' + viewLabel(p); });
    p.view.textContent = 'This note is for: ' + viewLabel(p);
    root.addEventListener('click', function () { p.view.textContent = 'This note is for: ' + viewLabel(p); });
    refreshSession().then(flush);
    return p;
  }

  return { attach: attach, refresh: refreshSession, flush: flush };
})();
