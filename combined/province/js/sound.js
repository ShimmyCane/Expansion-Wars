// Expansion Wars — sound effects made with Web Audio (no sound files).
var Sound = (function () {
  'use strict';

  var ctx = null;
  var enabled = true;

  // Created on the first tap, because iPad Safari needs a user gesture.
  function audio() {
    try {
      if (!ctx) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function tone(freq, startIn, dur, type, vol) {
    if (!enabled) return;
    var c = audio();
    if (!c) return;
    try {
      var t0 = c.currentTime + startIn;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) {
      // Sound is a nicety; never let it break play.
    }
  }

  return {
    setEnabled: function (v) { enabled = !!v; },
    tap: function () { tone(660, 0, 0.08, 'triangle', 0.15); },
    send: function () { tone(520, 0, 0.1, 'sine', 0.12); },
    capture: function () {
      [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.08, 0.25, 'triangle', 0.18); });
    },
    lost: function () { tone(300, 0, 0.3, 'sawtooth', 0.08); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.14, 0.4, 'triangle', 0.2); });
    }
  };
})();
