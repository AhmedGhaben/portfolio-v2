// Checks the demo's heuristic against brute force on small graphs.
// Run: node tests/dst.test.js
"use strict";
const DST = require("../js/dst.js");

const pop = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

// Every spanning tree as an edge bitmask (edges <= 31).
function allSpanningTrees(n, edges) {
  const out = [];
  const m = edges.length;
  (function rec(i, mask, count) {
    if (count === n - 1) {
      const sel = edges.map((_, j) => !!(mask & (1 << j)));
      if (DST.isSpanningTree(n, edges, sel)) out.push(mask);
      return;
    }
    if (i === m || m - i < n - 1 - count) return;
    rec(i + 1, mask | (1 << i), count + 1);
    rec(i + 1, mask, count);
  })(0, 0, 0);
  return out;
}

// Exact optimum of (min pairwise distance, total distance) over all triples (repeats allowed).
function bruteForce(n, edges) {
  const T = allSpanningTrees(n, edges), L = n - 1;
  let best = [-1, -1];
  for (let a = 0; a < T.length; a++)
    for (let b = a; b < T.length; b++) {
      const dab = L - pop(T[a] & T[b]);
      if (dab < best[0]) continue;
      for (let c = b; c < T.length; c++) {
        const d2 = L - pop(T[a] & T[c]), d3 = L - pop(T[b] & T[c]);
        const mn = Math.min(dab, d2, d3), sm = dab + d2 + d3;
        if (mn > best[0] || (mn === best[0] && sm > best[1])) best = [mn, sm];
      }
    }
  return { best, count: T.length };
}

function randomConnected(r, n, p) {
  for (;;) {
    const e = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (r() < p) e.push([i, j]);
    if (e.length <= 16 && DST.connected(n, e)) return e;
  }
}

const complete = (n) => { const e = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e.push([i, j]); return e; };
const cases = [
  ["K4", 4, complete(4)], ["K5", 5, complete(5)],
  ["path P5 (one tree)", 5, [[0, 1], [1, 2], [2, 3], [3, 4]]],
  ["cycle C6", 6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]],
  ["wheel W6", 6, [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1]]],
];
const r = DST.rng(2026);
for (let i = 0; i < 300; i++) { const n = 4 + Math.floor(r() * 4); cases.push(["G(n,p) #" + i, n, randomConnected(r, n, 0.35 + r() * 0.5)]); }
for (let s = 1; s <= 60; s++) { const g = DST.randomGraph(s, 5 + (s % 3), 2.1); cases.push(["demo generator seed " + s, g.pts.length, g.edges]); }

let fails = 0, misses = 0, checked = 0;
for (const [name, n, edges] of cases) {
  const res = DST.solve(n, edges, { seed: 7, restarts: 20 });
  // 1. Each output is a spanning tree.
  res.trees.forEach((t, k) => { if (!DST.isSpanningTree(n, edges, t)) { fails++; console.log("NOT A TREE", name, k); } });
  // 2. Reported distances and shared count agree with an independent bitmask recount.
  const masks = res.trees.map((t) => t.reduce((m, on, j) => (on ? m | (1 << j) : m), 0));
  const d = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => n - 1 - pop(masks[a] & masks[b]));
  let shared = 0; for (let j = 0; j < edges.length; j++) if (masks.filter((m) => m & (1 << j)).length >= 2) shared++;
  if (d.join() !== res.distances.join() || shared !== res.shared || Math.min(...d) !== res.minDist) { fails++; console.log("BAD COUNT", name); }
  // 3. Optimal value matches brute force.
  const bf = bruteForce(n, edges);
  if (bf.best[0] !== res.minDist || bf.best[1] !== res.sumDist) { misses++; console.log("SUBOPTIMAL", name, "heuristic", [res.minDist, res.sumDist], "optimum", bf.best, "trees", bf.count); }
  checked++;
}
console.log(`${checked} graphs: ${fails} invalid outputs, ${misses} below the brute-force optimum`);
process.exit(fails || misses ? 1 : 0);
