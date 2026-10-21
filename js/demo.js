/* Hero demo: draw a graph and three diverse spanning trees; let the visitor edit the graph.
   render() is shared with tools/prerender.js so the first frame ships as inline SVG. */
(function (root) {
  "use strict";
  var PAD = 7, SPAN = 100 - 2 * PAD, NAMES = ["A", "B", "C"], MAX_V = 14;

  function xy(p) { return [PAD + p[0] * SPAN, PAD + p[1] * SPAN]; }
  function f(x) { return Math.round(x * 100) / 100; }

  function render(g, res, sel) {
    var s = '<svg class="dst" viewBox="0 0 100 100" role="img" aria-label="' + label(g, res) + '">';
    s += '<g class="base">';
    g.edges.forEach(function (e, i) {
      var a = xy(g.pts[e[0]]), b = xy(g.pts[e[1]]);
      s += '<line data-e="' + i + '" x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(b[0]) + '" y2="' + f(b[1]) + '"/>';
    });
    s += "</g>";
    if (res) {
      var on = g.edges.map(function (_, i) { return res.trees.map(function (t, k) { return t[i] ? k : -1; }).filter(function (k) { return k >= 0; }); });
      res.trees.forEach(function (t, k) {
        s += '<g class="tree t' + k + '">';
        g.edges.forEach(function (e, i) {
          if (!t[i]) return;
          var a = xy(g.pts[e[0]]), b = xy(g.pts[e[1]]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
          var slot = on[i].indexOf(k) - (on[i].length - 1) / 2, ox = -dy / L * slot * 1.15, oy = dx / L * slot * 1.15;
          s += '<line x1="' + f(a[0] + ox) + '" y1="' + f(a[1] + oy) + '" x2="' + f(b[0] + ox) + '" y2="' + f(b[1] + oy) + '"/>';
        });
        s += "</g>";
      });
    }
    s += '<g class="hit">';
    g.edges.forEach(function (e, i) {
      var a = xy(g.pts[e[0]]), b = xy(g.pts[e[1]]);
      s += '<line data-e="' + i + '" x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(b[0]) + '" y2="' + f(b[1]) + '"/>';
    });
    s += '</g><g class="nodes">';
    g.pts.forEach(function (p, i) { var c = xy(p); s += '<circle data-v="' + i + '" cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" r="2"' + (i === sel ? ' class="sel"' : "") + "/>"; });
    return s + "</g></svg>";
  }

  function label(g, res) {
    if (!res) return "A graph with " + g.pts.length + " vertices that is not connected.";
    return "A graph with " + g.pts.length + " vertices and " + g.edges.length + " edges, and three spanning trees drawn over it. " + readout(g, res, true);
  }

  function readout(g, res, plain) {
    if (!res) return plain ? "" : "This graph isn't connected, so it has no spanning tree. Join the pieces with an edge.";
    var d = res.distances, pairs = ["A and B", "A and C", "B and C"];
    if (plain) return res.shared + " of " + g.edges.length + " edges are shared. Distances: " + pairs.map(function (p, i) { return p + " " + d[i]; }).join(", ") + ".";
    return '<span class="big">' + res.shared + '</span> shared edge' + (res.shared === 1 ? "" : "s") + ' <span class="of">of ' + g.edges.length + "</span>" +
      '<span class="pairs">' + ["A–B", "A–C", "B–C"].map(function (p, i) { return "<span>" + p + " differ by <b>" + d[i] + "</b></span>"; }).join("") + "</span>";
  }

  function mount(el, DST, seed) {
    var g = DST.randomGraph(seed, 9, 2.1), sel = -1, res, figure = el.querySelector(".dst-fig"), out = el.querySelector(".dst-out");
    function solve() { res = DST.solve(g.pts.length, g.edges, { seed: 7, restarts: g.pts.length > 10 ? 12 : 20 }); }
    function draw() { figure.innerHTML = render(g, res, sel); out.innerHTML = readout(g, res, false); el.classList.add("live", "edited"); }
    function update() { solve(); draw(); }
    solve();
    if (figure.querySelector("svg")) el.classList.add("live"); else draw(); // keep the prerendered first frame

    figure.addEventListener("click", function (ev) {
      var t = ev.target, svg = figure.querySelector("svg");
      if (t.dataset.v != null) {
        var v = +t.dataset.v;
        if (sel < 0) { sel = v; draw(); return; }
        if (sel === v) { sel = -1; draw(); return; }
        var a = Math.min(sel, v), b = Math.max(sel, v), idx = -1;
        g.edges.forEach(function (e, i) { if (e[0] === a && e[1] === b) idx = i; });
        if (idx >= 0) g.edges.splice(idx, 1); else g.edges.push([a, b]);
        sel = -1; update(); return;
      }
      if (t.dataset.e != null) { g.edges.splice(+t.dataset.e, 1); sel = -1; update(); return; }
      if (g.pts.length >= MAX_V) return;
      var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      var q = pt.matrixTransform(svg.getScreenCTM().inverse());
      var p = [Math.min(1, Math.max(0, (q.x - PAD) / SPAN)), Math.min(1, Math.max(0, (q.y - PAD) / SPAN))];
      g.pts.push(p); var nv = g.pts.length - 1;
      if (sel >= 0) { g.edges.push([sel, nv]); sel = -1; }
      else { sel = nv; }
      update();
    });
    el.querySelector("[data-act=new]").addEventListener("click", function () { seed += 1; g = DST.randomGraph(seed, 8 + (seed % 3), 2.1); sel = -1; update(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sel >= 0) { sel = -1; draw(); } });
  }

  var api = { render: render, readout: readout, mount: mount };
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.DSTDemo = api;
    var el = document.getElementById("hero-demo");
    if (el && root.DST) mount(el, root.DST, +el.dataset.seed || 1);
  }
})(this);
