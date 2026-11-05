// Expansion Wars (combined) — DOM helpers for the views. No game rules.
(function () {
  'use strict';
  var core = window.XW.core;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  core.$ = function (id) { return document.getElementById(id); };

  // An element with a class and text.
  core.el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // An SVG element with attributes, added to parent when one is given.
  core.svg = function (name, attrs, parent) {
    var e = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  };

  // SVG text, centred on a point.
  core.svgText = function (parent, x, y, text, attrs) {
    var a = { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'central' };
    Object.keys(attrs || {}).forEach(function (k) { a[k] = attrs[k]; });
    var t = core.svg('text', a, parent);
    t.textContent = text;
    return t;
  };

  core.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); };

  // A button that runs fn on click. disabled: true greys it out.
  core.button = function (text, fn, opts) {
    var b = core.el('button', (opts && opts.cls) || '', text);
    b.type = 'button';
    if (opts && opts.disabled) b.disabled = true;
    if (opts && opts.pressed !== undefined) b.setAttribute('aria-pressed', String(!!opts.pressed));
    b.addEventListener('click', fn);
    return b;
  };

  // A point on an SVG in its own (viewBox) units, from a pointer event.
  core.svgPoint = function (svgEl, e) {
    var pt = svgEl.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var m = svgEl.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
})();
