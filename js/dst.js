/* Diverse spanning trees: a basic heuristic (greedy start + edge-swap local search + restarts).
   Objective, compared lexicographically: maximize the smallest pairwise distance |Ti \ Tj|,
   then the total pairwise distance. Works in the browser (window.DST) and in Node (module.exports). */
(function (root) {
  "use strict";

  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function dsu(n) {
    var p = []; for (var i = 0; i < n; i++) p.push(i);
    function f(x) { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }
    return { find: f, union: function (a, b) { a = f(a); b = f(b); if (a === b) return false; p[a] = b; return true; } };
  }

  function connected(n, edges) {
    if (n === 0) return false;
    var d = dsu(n), c = n;
    edges.forEach(function (e) { if (d.union(e[0], e[1])) c--; });
    return c === 1;
  }

  // Kruskal with the given edge costs; returns a boolean membership array of length m.
  function kruskal(n, edges, cost) {
    var order = edges.map(function (_, i) { return i; }).sort(function (a, b) { return cost[a] - cost[b]; });
    var d = dsu(n), sel = new Array(edges.length).fill(false), k = 0;
    for (var j = 0; j < order.length && k < n - 1; j++) {
      var e = edges[order[j]];
      if (d.union(e[0], e[1])) { sel[order[j]] = true; k++; }
    }
    return sel;
  }

  function isSpanningTree(n, edges, sel) {
    var d = dsu(n), k = 0;
    for (var i = 0; i < edges.length; i++) if (sel[i]) { if (!d.union(edges[i][0], edges[i][1])) return false; k++; }
    return k === n - 1 && connected(n, edges.filter(function (_, i) { return sel[i]; }));
  }

  function distances(n, trees) {
    var out = [];
    for (var a = 0; a < trees.length; a++) for (var b = a + 1; b < trees.length; b++) {
      var common = 0; for (var i = 0; i < trees[a].length; i++) if (trees[a][i] && trees[b][i]) common++;
      out.push(n - 1 - common);
    }
    return out;
  }

  function score(n, trees) {
    var d = distances(n, trees);
    return [Math.min.apply(null, d), d.reduce(function (s, x) { return s + x; }, 0)];
  }
  function better(s, t) { return s[0] > t[0] || (s[0] === t[0] && s[1] > t[1]); }

  function sharedEdges(trees) {
    var c = 0;
    for (var i = 0; i < trees[0].length; i++) { var k = 0; trees.forEach(function (t) { if (t[i]) k++; }); if (k >= 2) c++; }
    return c;
  }

  // Edge indices on the tree path between u and v.
  function treePath(n, edges, sel, u, v) {
    var adj = []; for (var i = 0; i < n; i++) adj.push([]);
    sel.forEach(function (on, i) { if (on) { adj[edges[i][0]].push([edges[i][1], i]); adj[edges[i][1]].push([edges[i][0], i]); } });
    var prev = new Array(n).fill(-1), via = new Array(n).fill(-1), q = [u]; prev[u] = u;
    while (q.length) { var x = q.shift(); if (x === v) break; adj[x].forEach(function (y) { if (prev[y[0]] < 0) { prev[y[0]] = x; via[y[0]] = y[1]; q.push(y[0]); } }); }
    var path = []; for (var w = v; w !== u; w = prev[w]) path.push(via[w]);
    return path;
  }

  function shuffled(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function localSearch(n, edges, trees, r) {
    var cur = score(n, trees), improved = true, m = edges.length;
    while (improved) {
      improved = false;
      for (var t = 0; t < trees.length && !improved; t++) {
        var T = trees[t], outside = shuffled(edges.map(function (_, i) { return i; }).filter(function (i) { return !T[i]; }), r);
        for (var a = 0; a < outside.length && !improved; a++) {
          var e = outside[a], cyc = treePath(n, edges, T, edges[e][0], edges[e][1]);
          for (var b = 0; b < cyc.length; b++) {
            var f = cyc[b]; T[e] = true; T[f] = false;
            var s = score(n, trees);
            if (better(s, cur)) { cur = s; improved = true; break; }
            T[e] = false; T[f] = true;
          }
        }
      }
    }
    return cur;
  }

  function solve(n, edges, opts) {
    opts = opts || {};
    var k = opts.k || 3, restarts = opts.restarts || 20, r = rng(opts.seed == null ? 1 : opts.seed);
    if (!connected(n, edges)) return null;
    var best = null, bestScore = null;
    for (var it = 0; it < restarts; it++) {
      var use = new Array(edges.length).fill(0), trees = [];
      for (var t = 0; t < k; t++) {
        var cost = use.map(function (u) { return (t === 0 ? 0 : u) + r() * 0.9; });
        var T = kruskal(n, edges, cost); trees.push(T);
        T.forEach(function (on, i) { if (on) use[i]++; });
      }
      var s = localSearch(n, edges, trees, r);
      if (!best || better(s, bestScore)) { best = trees.map(function (T) { return T.slice(); }); bestScore = s; }
    }
    return { trees: best, minDist: bestScore[0], sumDist: bestScore[1], distances: distances(n, best), shared: sharedEdges(best) };
  }

  // Random planar-looking graph: jittered points, shortest non-crossing edges first.
  function randomGraph(seed, n, density) {
    var r = rng(seed), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), pts = [], cells = [];
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) cells.push([x, y]);
    cells = shuffled(cells, r).slice(0, n);
    cells.forEach(function (c) { pts.push([(c[0] + 0.5 + (r() - 0.5) * 0.55) / cols, (c[1] + 0.5 + (r() - 0.5) * 0.55) / rows]); });
    var cand = [];
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) cand.push([i, j, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])]);
    cand.sort(function (a, b) { return a[2] - b[2]; });
    var edges = [], target = Math.round(n * (density || 2.1));
    cand.forEach(function (c) {
      if (edges.length >= target) return;
      for (var q = 0; q < edges.length; q++) if (crosses(pts, edges[q], c)) return;
      edges.push([c[0], c[1]]);
    });
    if (!connected(n, edges)) return randomGraph(seed + 7919, n, density);
    // stretch to fill the unit square (keeps the drawing from looking squashed)
    [0, 1].forEach(function (k) {
      var lo = Math.min.apply(null, pts.map(function (p) { return p[k]; })), hi = Math.max.apply(null, pts.map(function (p) { return p[k]; }));
      pts.forEach(function (p) { p[k] = hi > lo ? 0.04 + 0.92 * (p[k] - lo) / (hi - lo) : 0.5; });
    });
    return { pts: pts, edges: edges };
  }
  function crosses(p, e, f) {
    if (e[0] === f[0] || e[0] === f[1] || e[1] === f[0] || e[1] === f[1]) return false;
    function o(a, b, c) { return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); }
    var a = p[e[0]], b = p[e[1]], c = p[f[0]], d = p[f[1]];
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  }

  var api = { solve: solve, randomGraph: randomGraph, isSpanningTree: isSpanningTree, distances: distances, sharedEdges: sharedEdges, score: score, connected: connected, crosses: crosses, rng: rng };
  if (typeof module === "object" && module.exports) module.exports = api; else root.DST = api;
})(this);
