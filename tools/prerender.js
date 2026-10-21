// Writes the hero demo's first frame into index.html so it paints without JavaScript.
// Run after changing js/dst.js, js/demo.js or the hero seed: node tools/prerender.js
"use strict";
const fs = require("fs"), path = require("path");
const DST = require("../js/dst.js"), Demo = require("../js/demo.js");
const file = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(file, "utf8");
const seed = +(/id="hero-demo" data-seed="(\d+)"/.exec(html) || [0, 1])[1];
const g = DST.randomGraph(seed, 9, 2.1);
const res = DST.solve(g.pts.length, g.edges, { seed: 7, restarts: 20 });
html = html.replace(/<!--dst:svg-->[\s\S]*?<!--\/dst:svg-->/, "<!--dst:svg-->" + Demo.render(g, res, -1) + "<!--/dst:svg-->")
           .replace(/<!--dst:out-->[\s\S]*?<!--\/dst:out-->/, "<!--dst:out-->" + Demo.readout(g, res, false) + "<!--/dst:out-->");
fs.writeFileSync(file, html);
console.log("prerendered seed", seed, "distances", res.distances.join(","), "shared", res.shared);
