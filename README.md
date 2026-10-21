# portfolio-v2

Preview of a redesigned version of [ahmedghaben.github.io](https://ahmedghaben.github.io), published at
[ahmedghaben.github.io/portfolio-v2](https://ahmedghaben.github.io/portfolio-v2/) for comparison. The page carries
a `noindex` tag so search engines don't index this copy.

- `index.html`: the whole page (inline CSS, no build step)
- `js/dst.js`, `js/demo.js`: the diverse spanning trees demo; `node tools/prerender.js` refreshes its first frame in `index.html`
- `js/mc.js`: the Monte Carlo panel, loaded when it scrolls into view
- `tests/dst.test.js`: checks the demo's solver against brute force on small graphs (`node tests/dst.test.js`)
