# OU City Paths — Campus Route Explorer

A browser-based bidirectional **Contraction Hierarchies (CH)** route visualization between eight Ho Chi Minh City Open University (OU) campuses using live OpenStreetMap corridors, separate Vietnam-calibrated motorbike and car profiles, and a high-DPI 2D `<canvas>` search renderer. Zero backend, zero build step, and zero npm runtime dependencies.

## Attribution & Model Version History

- **Latest version (reviewed and improved — or potentially altered, results may vary!):** **Gemini 4 Neon (Extra, Swarm-enabled)**
- **Previous version:** **GPT-Sol 6.1 (High)** *(succeeding the earlier `GPT-6 Astra - Medium thinking` entry)*

## Run Locally

From this directory:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>. Run the automated verification suite with:

```bash
node --test
```

## GitHub Pages

In repository **Settings → Pages**, select **Deploy from a branch**, branch **main**, folder **/(root)**. The live page URL is:

<https://JuniorThanhBQ.github.io/Course-Projects-From-OU-Students/vibe-code-project/hcmc-ou-a-search/>

## What Changed in This Version

### 1. Contraction Hierarchies & Graph Engine (`hierarchy.js`, `routing.js`, `preprocess.js`)
- **Degree-2 OSM chain collapse (`routing.js`):** Collapses intermediate degree-2 geometry nodes into single edges while preserving full curved polyline coordinates (`edge.geom`), pinning closest raw nodes near campus entrances, splitting long highway chains every `500 m`, and splitting pure rings cleanly without self-loops.
- **Dynamic lazy CSR Contraction Hierarchies (`hierarchy.js`):** Replaces static degree sorting and O(N²) adjacency scans with Edge Difference + Contracted Neighbors + Hierarchy Level lazy ordering, active-adjacency detachment, O(1) parallel-edge deduplication, 1-hop witness fast path, zero-allocation typed-array witness search, immutable flat-pool iterative shortcut unpacking, Stall-on-Demand (safe with zero-weight edges and equal-rank partial cores), and zero-copy Transferable `ArrayBuffer` worker messaging.
- **Iterative Tarjan SCC endpoint snapping (`routing.js`):** Replaces recursive/naive nearest-node snapping with iterative Tarjan strongly connected components so campus pins snap onto the main bidirectional road network instead of one-way sinks, source-only traps, or disconnected parking islands.
- **Dynamic admissible A\* oracle (`routing.js`):** Computes an observed-edge admissible speed upper bound so A\* matches Dijkstra across high-speed motorways and synthetic test graphs.

### 2. Overpass Corridor Strategy & Resilience (`roads.js`)
- **Three-tier distance corridors (`<= 15 km` local, `15–100 km` metro, `> 100 km` regional):** Eliminates giant urban alley downloads on HCMC ↔ Đồng Nai trips and replaces slow `around:5000` queries with tight `±0.035°` endpoint boxes plus overlapping chained corridor bounding boxes (`0.55°` regional half-width covering coastal `QL1A`/`CT01` via Phan Thiết, Vĩnh Hảo, Phan Rang, and Cam Ranh while omitting rural interprovincial `tertiary` spam).
- **3-mirror failover & Cache API v4:** Rotates across `overpass-api.de`, `overpass.private.coffee`, and `maps.mail.ru` with cancellable backoff, guarded `response.text()` + `JSON.parse()` parsing, strict `validRoads()` validation, `AbortSignal` cancellation, and automatic cleanup of stale `ou-road-data-v1..v3` caches.

### 3. Cartographic UI, Accessibility & Canvas Rendering (`index.html`, `style.css`, `canvas-layer.js`, `app.js`)
- **Custom 2D `<canvas>` exploration layer (`canvas-layer.js`):** Replaces thousands of per-node `L.circleMarker` objects with O(1) batched `requestAnimationFrame` curved-street drawing, dual-encoded forward (solid terracotta) / backward (dashed cobalt) / meeting-node (concentric plum ring) visuals, and a cased emerald final route.
- **Full user control & non-blocking UX:** Adds **Stop** (`Escape`), **Reset**, **Swap**, **Normal / Fast / Instant** exploration speeds, **All 8 campuses** map chip, interactive `A`/`B`/idle campus markers with click-to-set popups, Leaflet 1.9.4 SRI + `cdn.jsdelivr.net` fallback, and a persisted Light/Dark theme toggle with anti-FOUC bootstrap.
- **Impeccable v4.10.0 & WCAG AA/AAA compliance:** Mobile-first map-above-the-fold layout (`<768px`), `16px` mobile selects, `44px` touch targets, `100dvh` desktop workspace without double scrollbars, `Be Vietnam Pro` typography, milestone-only `aria-live="polite"` announcements, `prefers-reduced-motion` auto-`Instant` speed, and mathematically verified light/dark contrast tokens.

### 4. Automated Test Coverage (`roads.test.js`, `routing.test.js`, `hierarchy.test.js`)
- 20 automated `node --test` suites covering Overpass corridor tiers, coastal waypoint coverage, mirror failover, cache pruning, abort cancellation, Vietnam road-access/speed/oneway/maxspeed parsing, degree-2 collapse, Tarjan SCC snapping, zero-weight/parallel-edge/Stall-on-Demand CH oracles across 25 seeds × 6 budgets, Transferable CSR wire format, and a 40×40 road-grid contraction-ratio & speedup regression test.

## Vietnam / HCMC Road-Speed Model (Illustrative)

These values are illustrative educational travel-time estimates capped by OpenStreetMap `maxspeed` tags (including `VN:urban`, `VN:rural`, `VN:motorway`, `mph`, and multi-value tags). They are **not** legal speed-limit claims or live traffic forecasts.

| OSM `highway` class | Car (km/h) | Motorbike (km/h) | Notes |
|---|---:|---:|---|
| `motorway` / `_link` | 75 | Blocked | Car-only under Vietnamese traffic law; tolls are not modeled |
| `trunk` / `_link` | 45 | 40 | National highways & express arterials (`QL1A`, `QL51`, etc.) |
| `primary` / `_link` | 35 | 32 | Major urban corridors |
| `secondary` / `_link` | 30 | 28 | District connectors |
| `tertiary` / `_link` | 25 | 25 | Sub-district collectors |
| `unclassified` | 20 | 22 | Minor connecting streets |
| `residential` | 18 | 22 | Neighborhood streets |
| `living_street` | 10 | 15 | Shared pedestrian-priority lanes |
| `service` | 12 | 15 | `parking_aisle`, `driveway`, `emergency_access`, `drive-through` excluded for both; `alley` & `width < 2.2 m` excluded for car |
| `path` (`motorcycle=yes/designated/permissive`) | Blocked | 14 | Saigon motorbike-only *hẻm* |

## Campus Coordinates & Pin Verification Status

Single source of truth: [`campuses.js`](./campuses.js). Official reference: [OU Campus Directory](https://ou.edu.vn/cac-co-so-dao-tao/).

| Campus | Area | Coordinates (`lat, lon`) | Pin Status | Notes |
|---|---|---|---|---|
| 97 Võ Văn Tần | District 3, HCMC | `10.7764, 106.6903` | Approximate | Approximate entrance pin |
| 35–37 Hồ Hảo Hớn | District 1, HCMC | `10.7618, 106.6922` | Approximate | Relocated north of Bến Nghé canal onto Hồ Hảo Hớn St (verify entrance on OSM) |
| Nhơn Đức · Hiệp Phước | Nhà Bè, HCMC | `10.676414, 106.690748` | **Verified** | From supplied [Google Maps pin](https://maps.app.goo.gl/gw9x2zzjDvZjN8hZ8) |
| 02 Mai Thị Lựu | District 1, HCMC | `10.79076, 106.69948` | Approximate | Approximate entrance pin |
| 311 Gia Phú | District 6, HCMC | `10.7482, 106.6442` | Approximate | Approximate entrance pin |
| 283 Lý Thường Kiệt | District 11, HCMC | `10.7797, 106.6533` | Approximate | Official OU directory lists 68 Lê Thị Trung instead |
| 259/29 Quốc lộ 51, P. Long Hưng | Tỉnh Đồng Nai | `10.9068441, 106.8552152` | **Verified** | From supplied [Google Maps pin](https://maps.app.goo.gl/1kDyWf7nB2wHBqVe8) |
| 04 đường Tân Định, P. Ninh Hòa | Tỉnh Khánh Hòa | `12.5063776, 109.146128` | **Verified** | From supplied [Google Maps pin](https://maps.app.goo.gl/v7KHpnatgpf1iz556) |

## Model Limitations & Credits

- Educational visualization only — **not** turn-by-turn navigation guidance.
- Routes are optimal strictly within the downloaded OpenStreetMap corridor and modeled travel times. No live traffic, traffic signals, turn restrictions, time-dependent bans, highway tolls, or campus driveway access connectors are modeled.
- Reference: [Geisberger et al., *Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks*](https://doi.org/10.1007/978-3-540-68552-4_24).
- Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Leaflet 1.9.4: BSD-2-Clause. Application code follows the repository MIT license.
