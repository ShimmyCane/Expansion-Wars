// Expansion Wars (combined) — the world clock and time dilation.
// One clock for the whole world, in world seconds. Real time is turned into world time at the rate of the scale you are
// looking at (world/config.js RATE), so a battle slows the country down. A country turn ends every TURN world seconds:
// the clock only says a turn is due; country/turn.js resolves it and moves the turn number on.
(function () {
  'use strict';
  var W = window.XW.world;

  function cfg() { return W.CONFIG; }
  function turnEnd(w) { return w.time.turn * cfg().TURN; }

  // World seconds left in this turn.
  W.turnLeft = function (w) { return Math.max(0, turnEnd(w) - w.time.t); };

  // True when the clock has reached the end of the current turn.
  W.turnDue = function (w) { return !w.over && w.time.t >= turnEnd(w); };

  // Moves the world clock on by `real` real seconds at `scale`. A long pause (a tab asleep) ends one turn at most.
  W.advance = function (w, real, scale) {
    if (w.over) return;
    var rate = cfg().RATE[scale] !== undefined ? cfg().RATE[scale] : 1;
    w.time.t = Math.min(w.time.t + Math.max(0, real) * rate, turnEnd(w));
  };

  // Ends the turn now (the Ready button): the clock jumps to the end of the turn.
  W.skipToTurnEnd = function (w) { w.time.t = Math.max(w.time.t, turnEnd(w)); };

  // How long a whole turn takes in real seconds at a scale (for the screen).
  W.realTurn = function (scale) { return cfg().TURN / (cfg().RATE[scale] || 1); };
})();
