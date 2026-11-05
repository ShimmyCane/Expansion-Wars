// Expansion Wars — the floating ⚙️: settings, version and reset zoom, on every screen except the game.
(function () {
  'use strict';

  // The page does not zoom (iPhone and iPad): pinches and double taps belong to the canvas, not the page.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  var VERSION = '2.19';
  // One version for each change merged since the country layer began (2.0). Newest first.
  var LOG = [
    ['2.19', 'Science from cities and fortresses, spent on Agriculture, Civics and Arms (Arms is the hard army cap); people eat food; food tops up from gold and stone so armies can always move (convo v0.17)'],
    ['2.18', 'Fortresses make magic (25 a turn each), spent on an attack or a defence at one point per four soldiers (up to a quarter of the army); the stock holds a quarter of the army. Food: cities feed the army most, soldiers eat more, and thin food slows recruiting (convo v0.15)'],
    ['2.17', 'Allies attack together: every ally at war with the target joins one army, each paying its own march, with 5% less strength for each extra nation (convo v0.15)'],
    ['2.16', 'Directions: Growth, War or Wealth, and an autopilot that spends towards it each turn. Population is made by cities; upgrades, villages, claims and marches cost gold and food; magic is spent per soldier sent; fortresses hold the ground (convo v0.14)'],
    ['2.15', 'Maps from a seed (type one to make that map again). Start with two villages and a town; neutral land to claim; cautious neutral nations'],
    ['2.14','Provinces: 15 per nation; neutral lakes, forests and mountains; rivers along borders; zoom shows the version 1 icons, with upgrade arrows; AI upgrades; soldiers bought out or disbanded for gold'],
    ['2.13', 'Drifting borders, zoom to population centres, unrest and revolts, attacks cost more under unrest'],
    ['2.12', 'Answers to the drifting-borders design round (convo v0.12)'],
    ['2.11', 'Overpowered attacks overrun several spots; defenders surrender'],
    ['2.10', 'Notes table for the family database (xw_notes), with a rolled-back test'],
    ['2.9', 'Floating ⚙️ on every screen: version and reset zoom'],
    ['2.8', 'Design round on drifting borders, zoom and revolts (convo v0.11)'],
    ['2.7', 'Fortresses hold out longest: spots fall weakest first'],
    ['2.6', 'Conquered spots pay less for a while; computer nations attack and declare war more'],
    ['2.5', 'Attacks fight in three waves; overwhelming power capitulates'],
    ['2.4', 'Guns or butter slider; food helps culture; villages built by hand'],
    ['2.3', 'Trade routes also gather stone'],
    ['2.2', 'Stone from cities; culture draws soldiers; magic from tiers and spent per attack; trade costs gold; upgrades scale'],
    ['2.1', 'Send slider for attacks, remembered between battles; culture only from battles'],
    ['2.0', 'Country layer: first playable version (six nations, turns of 60 seconds, diplomacy, battles)']
  ];
  var gear = document.getElementById('float-gear');
  var panel = document.getElementById('float-panel');
  var reset = document.getElementById('float-reset-zoom');
  var note = document.getElementById('float-note');
  document.getElementById('app-version').textContent = VERSION;
  var list = document.getElementById('version-log');
  LOG.forEach(function (row) {
    var li = document.createElement('li');
    var b = document.createElement('b');
    b.textContent = row[0] + ' ';
    li.appendChild(b);
    li.appendChild(document.createTextNode(row[1]));
    list.appendChild(li);
  });

  function setOpen(open) {
    panel.hidden = !open;
    gear.setAttribute('aria-expanded', String(open));
  }

  gear.addEventListener('click', function () { setOpen(panel.hidden); });

  // Each screen with zoom listens for this event and resets its own zoom (the game does so now).
  reset.addEventListener('click', function () {
    document.dispatchEvent(new CustomEvent('ew:reset-zoom'));
    note.textContent = 'Zoom reset.';
  });
})();
