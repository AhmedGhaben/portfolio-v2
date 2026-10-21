/* Monte Carlo panel: 1,000 equity paths for a fixed-fraction bettor, the max-drawdown histogram,
   and the Kelly fraction f* = p - (1 - p) / b. Loaded only when the panel nears the viewport. */
(function () {
  "use strict";
  var root = document.getElementById("mc"); if (!root) return;
  var PATHS = 1000, TRADES = 250, BINS = 20;
  var cv = root.querySelector("canvas"), hist = root.querySelector(".mc-hist"), sum = root.querySelector(".mc-sum"),
      hover = root.querySelector(".mc-hover"), kellyBtn = root.querySelector("[data-act=kelly]");
  var inp = { p: root.querySelector("#mc-p"), b: root.querySelector("#mc-b"), f: root.querySelector("#mc-f") };

  // Common random numbers: the same uniforms for every setting, so curves move smoothly with the sliders.
  var U = new Float32Array(PATHS * TRADES), a = 20251212;
  for (var i = 0; i < U.length; i++) { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); U[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

  function simulate(p, b, f) {
    var eq = new Float32Array(PATHS * (TRADES + 1)), dd = new Float32Array(PATHS);
    var up = 1 + f * b, down = 1 - f;
    for (var k = 0; k < PATHS; k++) {
      var e = 1, peak = 1, worst = 0, o = k * (TRADES + 1); eq[o] = 1;
      for (var s = 0; s < TRADES; s++) {
        e *= U[k * TRADES + s] < p ? up : down; eq[o + s + 1] = e;
        if (e > peak) peak = e; else { var d = 1 - e / peak; if (d > worst) worst = d; }
      }
      dd[k] = worst;
    }
    return { eq: eq, dd: dd };
  }
  function median(arr) { var c = Array.prototype.slice.call(arr).sort(function (x, y) { return x - y; }); var m = c.length >> 1; return c.length % 2 ? c[m] : (c[m - 1] + c[m]) / 2; }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function mult(x) { if (x < 0.01) return "under 0.01×"; return x >= 10 ? Math.round(x) + "×" : x >= 1 ? x.toFixed(1) + "×" : x.toFixed(2) + "×"; }

  var state = {};
  function run() {
    var p = +inp.p.value / 100, b = +inp.b.value / 100, f = +inp.f.value / 100;
    root.querySelector("[for=mc-p] output").textContent = Math.round(p * 100) + "%";
    root.querySelector("[for=mc-b] output").textContent = b.toFixed(2) + "×";
    root.querySelector("[for=mc-f] output").textContent = Math.round(f * 100) + "%";
    var kelly = p - (1 - p) / b;
    var sim = simulate(p, b, f), med = new Float32Array(TRADES + 1), col = new Float32Array(PATHS);
    for (var s = 0; s <= TRADES; s++) { for (var k = 0; k < PATHS; k++) col[k] = sim.eq[k * (TRADES + 1) + s]; med[s] = median(col); }
    var ks = kelly > 0 ? simulate(p, b, kelly) : null;
    var below = 0; for (var q = 0; q < PATHS; q++) if (sim.eq[q * (TRADES + 1) + TRADES] < 1) below++;
    state = { p: p, b: b, f: f, kelly: kelly, sim: sim, med: med, kellyDD: ks ? median(ks.dd) : null, medDD: median(sim.dd) };
    kellyBtn.disabled = !(kelly > 0); kellyBtn.textContent = kelly > 0 ? "Set f to Kelly (" + pct(kelly) + ")" : "No edge: Kelly bets nothing";
    sum.textContent = "Betting " + pct(f) + " of equity per trade: the median path ends at " + mult(med[TRADES]) + " starting capital, " +
      pct(below / PATHS) + " of paths finish below where they started, and the median worst drop is " + pct(state.medDD) + "." +
      (kelly > 0 ? " Kelly says " + pct(kelly) + "." : " With these odds there is no edge, so Kelly says not to bet.");
    drawCurves(); drawHist();
  }

  // ---- equity curves (canvas, log y) ----
  var geo;
  function drawCurves() {
    var W = cv.clientWidth, H = cv.clientHeight, r = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * r; cv.height = H * r; var g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
    var L = 60, R = 10, T = 10, B = 40, pw = W - L - R, ph = H - T - B;
    var e = state.sim.eq, all = [];
    for (var k = 0; k < PATHS; k += 4) for (var s = 0; s <= TRADES; s += 5) all.push(e[k * (TRADES + 1) + s]);
    all.sort(function (x, y) { return x - y; });
    var lo = Math.min(0.5, all[Math.floor(all.length * 0.01)]), hi = Math.max(2, all[Math.floor(all.length * 0.99)]);
    var y0 = Math.log(lo), y1 = Math.log(hi);
    function X(s) { return L + s / TRADES * pw; } function Y(v) { return T + (1 - (Math.log(Math.max(v, lo / 4)) - y0) / (y1 - y0)) * ph; }
    geo = { L: L, pw: pw, X: X, Y: Y };
    var ink = css("--ink"), muted = css("--muted"), rule = css("--rule"), acc = css("--accent");
    g.font = "12px " + css("--font"); g.fillStyle = muted; g.textAlign = "right"; g.textBaseline = "middle";
    // y ticks at powers of two
    var e0 = Math.ceil(Math.log2(lo)), e1 = Math.floor(Math.log2(hi)), st = Math.max(1, Math.ceil((e1 - e0 + 1) / 6));
    for (var pw2 = e0; pw2 <= e1; pw2++) {
      if (pw2 % st !== 0) continue;
      var v = Math.pow(2, pw2), yy = Math.round(Y(v)) + 0.5;
      g.strokeStyle = rule; g.lineWidth = v === 1 ? 1 : 0.5; g.beginPath(); g.moveTo(L, yy); g.lineTo(L + pw, yy); g.stroke();
      g.fillText(v >= 1 ? v + "×" : "1/" + (1 / v) + "×", L - 6, yy);
    }
    g.textAlign = "center"; g.textBaseline = "top";
    for (var tt = 0; tt <= TRADES; tt += 50) g.fillText(String(tt), X(tt), T + ph + 6);
    g.fillText("Trade number", L + pw / 2, T + ph + 22);
    g.save(); g.translate(10, T + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText("Equity (× starting capital, log scale)", 0, 0); g.restore();
    // paths
    g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
    g.strokeStyle = ink; g.globalAlpha = 0.03; g.lineWidth = 0.75;
    for (k = 0; k < PATHS; k++) { g.beginPath(); var o = k * (TRADES + 1); g.moveTo(X(0), Y(e[o])); for (s = 1; s <= TRADES; s++) g.lineTo(X(s), Y(e[o + s])); g.stroke(); }
    g.globalAlpha = 1; g.strokeStyle = acc; g.lineWidth = 2.25; g.beginPath(); g.moveTo(X(0), Y(state.med[0]));
    for (s = 1; s <= TRADES; s++) g.lineTo(X(s), Y(state.med[s])); g.stroke(); g.restore();
    // direct label for the median
    g.fillStyle = ink; g.textAlign = "right"; g.textBaseline = "bottom"; g.font = "600 12px " + css("--font");
    var my = Y(state.med[TRADES]); g.strokeStyle = css("--sheet"); g.lineWidth = 4; g.lineJoin = "round";
    g.strokeText("Median " + mult(state.med[TRADES]), L + pw - 2, Math.max(T + 14, Math.min(T + ph - 4, my - 6))); g.fillText("Median " + mult(state.med[TRADES]), L + pw - 2, Math.max(T + 14, Math.min(T + ph - 4, my - 6)));
  }

  cv.addEventListener("pointermove", function (ev) {
    if (!geo) return; var rect = cv.getBoundingClientRect(), x = ev.clientX - rect.left;
    var s = Math.round((x - geo.L) / geo.pw * TRADES); if (s < 0 || s > TRADES) { hover.textContent = ""; return; }
    hover.textContent = "Trade " + s + ": median " + mult(state.med[s]);
  });
  cv.addEventListener("pointerleave", function () { hover.textContent = ""; });

  // ---- max drawdown histogram (SVG) ----
  function drawHist() {
    var counts = new Array(BINS).fill(0), dd = state.sim.dd;
    for (var k = 0; k < PATHS; k++) counts[Math.min(BINS - 1, Math.floor(dd[k] * BINS))]++;
    var max = Math.max.apply(null, counts), W = 320, H = 240, L = 38, R = 16, T = 34, B = 40, pw = W - L - R, ph = H - T - B, bw = pw / BINS;
    function X(v) { return L + v * pw; } function Y(c) { return T + ph - c / max * ph; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Histogram of the largest peak-to-trough drop in each of ' + PATHS + ' paths. Median ' + pct(state.medDD) + '.">';
    var yt = niceStep(max);
    for (var c = 0; c <= max; c += yt) s += '<line class="g" x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(c) + '" y2="' + Y(c) + '"/><text class="ax" x="' + (L - 6) + '" y="' + Y(c) + '" dy=".32em" text-anchor="end">' + c + "</text>";
    counts.forEach(function (n, i) {
      if (!n) return; var h = n / max * ph;
      s += '<rect class="bar" x="' + (X(i / BINS) + 1).toFixed(1) + '" y="' + (T + ph - h).toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '"><title>' + (i * 5) + "–" + (i * 5 + 5) + "% drawdown: " + n + " paths</title></rect>";
    });
    s += '<line class="base" x1="' + L + '" x2="' + (L + pw) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '"/>';
    for (var v = 0; v <= 100; v += 25) s += '<text class="ax" x="' + X(v / 100) + '" y="' + (T + ph + 16) + '" text-anchor="middle">' + v + "%</text>";
    s += '<text class="ax" x="' + (L + pw / 2) + '" y="' + (H - 4) + '" text-anchor="middle">Max drawdown (% below the running peak)</text>';
    s += '<text class="ax" transform="translate(10 ' + (T + ph / 2) + ') rotate(-90)" text-anchor="middle">Paths</text>';
    if (state.kellyDD != null) {
      var kx = X(state.kellyDD), right = kx > L + pw * 0.6;
      s += '<line class="kelly" x1="' + kx + '" x2="' + kx + '" y1="' + (T - 6) + '" y2="' + (T + ph) + '"/>';
      s += '<text class="lab" x="' + (right ? kx - 5 : kx + 5) + '" y="' + (T - 18) + '" text-anchor="' + (right ? "end" : "start") + '">Kelly f* = ' + pct(state.kelly) + '</text>';
      s += '<text class="ax" x="' + (right ? kx - 5 : kx + 5) + '" y="' + (T - 5) + '" text-anchor="' + (right ? "end" : "start") + '">median at f*: ' + pct(state.kellyDD) + "</text>";
    } else {
      s += '<text class="lab" x="' + L + '" y="' + (T - 18) + '">No edge: Kelly f* ≤ 0</text>';
    }
    hist.innerHTML = s + "</svg>";
  }
  function niceStep(max) { var raw = max / 4, m = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / m; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * m; }

  var pend; function schedule() { cancelAnimationFrame(pend); pend = requestAnimationFrame(run); }
  Object.keys(inp).forEach(function (k) { inp[k].addEventListener("input", schedule); });
  kellyBtn.addEventListener("click", function () { if (state.kelly > 0) { inp.f.value = Math.round(state.kelly * 100); schedule(); } });
  window.addEventListener("resize", function () { if (state.sim) requestAnimationFrame(drawCurves); });
  root.classList.add("live");
  run();
})();
