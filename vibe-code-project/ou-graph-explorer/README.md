# OU Campus Graph Explorer

An interactive graph of the publicly reachable websites under `ou.edu.vn`. The centre node is the main university site; every other node is a sub-domain that responds publicly and may be crawled. Pan, zoom, search, and click any node to open it.

Everything is static: no build step, no CDN, no third-party fonts or scripts. Serve the directory over HTTP (the page uses an ES module, which browsers refuse to load from `file://`), and every link is also present as plain HTML so the directory is readable with JavaScript disabled.

## Run locally

From this directory, run `python -m http.server 8080`, then open <http://localhost:8080>. Run the checks with `node --test`.

The test suite runs with Node's built-in `node:test` and `node:assert` only — there are no development dependencies to install.

## GitHub Pages

In repository Settings → Pages, select **Deploy from a branch**, branch **main**, folder **/(root)**. After committing and pushing, the explorer is served at:

<https://JuniorThanhBQ.github.io/Course-Projects-From-OU-Students/vibe-code-project/ou-graph-explorer/>

This URL is the intended deployment address; GitHub Pages publishes the whole repository, so the path mirrors the directory above.

## Interaction

| Action | Result |
| --- | --- |
| Drag | Pan the canvas |
| Wheel / pinch | Zoom around the pointer |
| Hover or focus a node | Dim everything outside its neighbourhood |
| Click or <kbd>Enter</kbd> | Open the site in a new tab and show its details |
| Search box | Filter by name, host, or description; matching nodes stay lit |
| Reset view | Restore the initial transform and clear the search |

Search and hover dimming are independent styles, so hovering during a search does not cancel the filter.

## Layout

`layout.js` is a deterministic force simulation with no DOM access, which is why it is unit tested.

A plain Fruchterman–Reingold pass with `d²/k` attraction collapses a star graph: every leaf is dragged onto the centre. Each edge is therefore a spring with a rest length instead, and a radial term pins leaves to a ring. Labels are rotated along their own outward radius, so neighbours on the ring can only collide by angular span. "Special Training" needs roughly twice the angular room of "IT", so the collision pass is width-aware rather than using a uniform gap; `layout.test.js` asserts no two labels overlap.

The simulation is seeded, so the drawing is identical on every load and the geometry tests are stable.

## Content and inclusion rules

Sub-domains were collected from the university homepage and its sitemap, then each host was probed for HTTP status, title, `robots.txt`, and TLS validity. A host is included only if it serves a public page and permits crawling.

Deliberately excluded:

- `tcnh.ou.edu.vn` — `robots.txt` disallows every path, so it is omitted entirely, including from the link list.
- Hosts returning HTTP 500 (`nhatro.ou.edu.vn`) or no response.
- Hosts with expired TLS certificates (`alumni`, `cpa`, `khoaluat`, `ktqlc`, `vi2`).
- Login portals whose only public surface is an authentication form; `quanlydaotao.ou.edu.vn` is kept because it also serves public information.

`ce`, `congdoan`, and `dtn` do not answer on HTTPS at all. They are linked over plain HTTP and marked "HTTP only" in the interface. Links are never rewritten to `https://` and the Content-Security-Policy deliberately omits `upgrade-insecure-requests`, which would break those three hosts.

## Security and privacy

The page declares a strict CSP: `default-src 'none'`, scripts and styles from `'self'` only, and no `'unsafe-inline'`. There are no inline `style` attributes, inline event handlers, or inline scripts; category colours live in `.cat-*` classes. Outbound links use `rel="noopener noreferrer"`.

The site sets no cookies, makes no analytics or third-party requests, and collects no personal data. `data.test.js` enforces these properties, including that the static directory in `index.html` matches `data.js` exactly.

## Independence

This is an unofficial, non-commercial student project. It is not affiliated with, endorsed by, or operated by Ho Chi Minh City Open University. All linked content, trade marks, and logos belong to their respective owners; links are provided for reference only.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup, CSP, static link directory |
| `style.css` | Theme and category colours |
| `app.js` | Rendering, pan/zoom, search, highlighting |
| `data.js` | Node, link, and exclusion records |
| `layout.js` | Deterministic force layout |
| `data.test.js` | Data, CSP, and synchronisation checks |
| `layout.test.js` | Geometry and label-collision checks |

## LLM Model Usage

DeepSeek (`deepseek-flash`)

