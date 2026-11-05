// Expansion Wars — unit battle engine: Player commands, one at a time or for a whole group.
// Part of the battle simulation (no DOM). Functions shared between the parts live on V4._ (K).
(function () {
  'use strict';
  var V4 = window.V4, C = V4.CONFIG, K = V4._ = V4._ || {};

  function validPoint(p) { return p && isFinite(p.x) && isFinite(p.y); }

  function apply(st, cmd) {
    if (cmd.kind === 'surrender') {
      if (cmd.side === undefined || cmd.side === null || cmd.side < 0 || cmd.side >= st.teams) return false;
      st.manual = cmd.side; K.checkEnd(st); return true;
    }
    if (cmd.kind === 'group') return applyGroup(st, cmd);
    var u = K.findUnit(st, cmd.unit);
    if (!u || u.state !== 'active' || !K.isPlayer(st, u)) return false;   // you only give orders to your own units
    switch (cmd.kind) {
      case 'place':
        if (st.tick !== 0 || !inBox(st, u.side, cmd.x, cmd.y) || !K.passableAt(st, cmd.x, cmd.y)) return false;
        u.x = cmd.x; u.y = cmd.y; return true;
      case 'move': u.order = { kind: 'route', points: [{ x: cmd.x, y: cmd.y }], i: 0, mode: 'move' }; return true;
      case 'rush': u.order = { kind: 'route', points: [{ x: cmd.x, y: cmd.y }], i: 0, mode: 'rush' }; return true;
      case 'route':
        if (!Array.isArray(cmd.points) || !cmd.points.length || !cmd.points.every(validPoint)) return false;
        u.order = { kind: 'route', points: cmd.points.map(function (p) { return { x: p.x, y: p.y }; }), i: 0, mode: cmd.mode === 'rush' ? 'rush' : 'move' };
        return true;
      case 'attack':
        var t = K.findUnit(st, cmd.target);
        if (!t || K.allied(st, t.side, u.side)) return false;
        u.order = { kind: 'attack', target: t.id }; return true;
      case 'hold': u.order = { kind: 'hold' }; return true;
      case 'strike':
        if (!u.strikePrompt) return false;
        u.strikeOrdered = true; return true;
      case 'assign':
        if (cmd.group !== 1 && cmd.group !== 2) return false;
        u.group = cmd.group; return true;
      case 'strategy':
        if (!C.STRATEGY[cmd.value]) return false;
        u.strategy = cmd.value; u.order = null; u.sprung = false; u.strikePrompt = false; return true;
      case 'formation':
        if (!C.FORMATION[cmd.value]) return false;
        u.formation = cmd.value; return true;
      case 'proceed':
        u.order = null; u.station = null;
        u.strategy = u.plan.strategy; u.formation = u.plan.formation; return true;
    }
    return false;
  }

  // A group command gives every member of a group the same order. A move keeps each member's place in the group.
  function applyGroup(st, cmd) {
    if (st.you === null || (cmd.group !== 1 && cmd.group !== 2)) return false;
    var members = st.units.filter(function (u) { return u.side === st.you && u.group === cmd.group && u.state === 'active'; });
    if (!members.length) return false;
    var cx = 0, cy = 0;
    members.forEach(function (u) { cx += u.x; cy += u.y; });
    cx /= members.length; cy /= members.length;
    switch (cmd.action) {
      case 'move':
      case 'rush':
        if (!validPoint(cmd)) return false;
        members.forEach(function (u) {
          var px = K.clamp(cmd.x + (u.x - cx), 0.5, st.cols - 0.5), py = K.clamp(cmd.y + (u.y - cy), 0.5, st.rows - 0.5);
          u.order = { kind: 'route', points: [{ x: px, y: py }], i: 0, mode: cmd.action === 'rush' ? 'rush' : 'move' };
        });
        return true;
      case 'hold':
        members.forEach(function (u) { u.order = { kind: 'hold' }; });
        return true;
      case 'strategy':
        if (!C.STRATEGY[cmd.value]) return false;
        members.forEach(function (u) { u.strategy = cmd.value; u.order = null; u.sprung = false; u.strikePrompt = false; });
        return true;
      case 'formation':
        if (!C.FORMATION[cmd.value]) return false;
        members.forEach(function (u) { u.formation = cmd.value; });
        return true;
    }
    return false;
  }

  function inBox(st, team, x, y) {
    var b = st.field.bbox[team];
    return !!b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  }

  // The result that goes back to V2. Pool is what each side has at home after the battle.

  K.validPoint = validPoint;
  K.apply = apply;
  K.applyGroup = applyGroup;
  K.inBox = inBox;
})();
