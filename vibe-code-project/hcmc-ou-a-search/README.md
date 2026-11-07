# OU · City paths

A browser-based bidirectional CH visualization between eight OU locations in Ho Chi Minh City, with separate car and motorbike profiles. Travel times are estimates, clearly labeled in the interface.

## Run locally

From this directory, run `python -m http.server 8080`, then open <http://localhost:8080>. Run algorithm checks with `node --test`.

## GitHub Pages

In repository Settings → Pages, select **Deploy from a branch**, branch **main**, folder **/(root)**. After committing and pushing the demo, it will be available at:

<https://JuniorThanhBQ.github.io/Course-Projects-For-OU-Students/vibe-code-project/hcmc-ou-a-search/>

This URL is the intended deployment address; publication has not been verified. GitHub Markdown cannot execute the dropdowns or JavaScript, so the repository README links to this page.

## Algorithm and libraries

The runtime uses JavaScript, Leaflet 1.9.4, and a directed contraction hierarchy with bidirectional Dijkstra queries. C++ is installed locally but a WebAssembly compiler is not; native C++ and Go binaries cannot execute on GitHub Pages. No runtime speed claim is made without benchmarks.

A worker preprocesses each vehicle graph once per page session. Degree-based ordering, witness searches bounded to 200 settled nodes, and recursive shortcut references preserve shortest paths. The witness cap can add extra shortcuts but cannot discard required ones. Queries search upward ranks in both directions, retain the best meeting cost, and unpack shortcuts into original road segments. Each frontier stops only when its own lower bound exceeds the best route cost. Forward exploration is orange; reverse exploration is blue.

This is an educational CH implementation, not a claim about Google's current routing stack. Reference: [Geisberger et al., Contraction Hierarchies](https://doi.org/10.1007/978-3-540-68552-4_24). A* remains only as a test oracle with its heuristic disabled (Dijkstra).

The first request for a campus pair downloads only its road corridor from Overpass; successful data is cached for seven days. Begin and selectors remain locked through download, worker preprocessing, query animation, and route rendering. A three-minute worker timeout restores the controls after preprocessing failure. Hierarchies are cached independently by road corridor and vehicle mode. Full-city preprocessing performance has not been benchmarked.

## Model limitations

This is an educational simulation, not navigation guidance. It loads a corridor around the selected pair. Regional requests include trunk, primary, secondary and tertiary roads, plus local access streets within 5 km of each endpoint. Routes are optimal only within the downloaded graph and modeled costs. No live traffic, turn restrictions, conditional/time-dependent access, signal delay, or campus access travel is modeled. Motorways are excluded for both modes. OSM coverage and tags may be incomplete.

Illustrative car speeds (km/h): primary 35, secondary 30, tertiary 25, residential 18, service 12. Motorbike: 30, 28, 25, 22, 15 respectively. Other roads use 18. Numeric maxspeed tags cap these assumptions. These values are not legal speed-limit claims.

Nhơn Đức is set to **10.676414, 106.690748**, resolved from the [user-supplied Google Maps link](https://maps.app.goo.gl/gw9x2zzjDvZjN8hZ8). The other five pins remain approximate and need entrance-level verification. The official [OU directory](https://ou.edu.vn/cac-co-so-dao-tao/) confirms the four principal addresses and 311 Gia Phú; it does not confirm the supplied 283 Lý Thường Kiệt location. Routing snaps pins to outgoing road nodes within 1.5 km. Endpoint connectors are not included in distance/time.

Internet is required for Leaflet, fonts, map tiles, and the initial Overpass download. Overpass can be slow or rate-limited; failures show a retryable message. Data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Leaflet: BSD-2-Clause. Application code follows the repository MIT license.

## LLM Model Usage

GPT-6 Astra - Medium thinking

## Bounded preprocessing

Preprocessing builds a partial contraction hierarchy with an exact searchable core. Dense junctions (more than 64 incoming/outgoing pairs), nodes exceeding 20,000 witness edge scans, and nodes remaining after the 2,000,000-work budget stay uncontracted. Pending shortcuts are committed only after a node completes; interrupted contractions leave the original connectivity intact. Core nodes share the highest rank and queries may traverse equal-rank core edges. This trades some query speed for bounded contraction work without approximating route costs. Progress counts all processed nodes and separately displays core size. Parallel contraction candidates are reduced to the cheapest edge per directed pair.

## Eight campuses and faster loading

The Đồng Nai and Ninh Hòa addresses are included in both selectors, as confirmed by the [OU campus directory](https://ou.edu.vn/cac-co-so-dao-tao/). Both are enabled for routing. Đồng Nai uses **10.9068441, 106.8552152** from [the supplied map pin](https://maps.app.goo.gl/1kDyWf7nB2wHBqVe8); Ninh Hòa uses **12.5063776, 109.146128** from [the supplied map pin](https://maps.app.goo.gl/v7KHpnatgpf1iz556). Coordinates come from the destination fields in the resolved URLs, not the map camera center. Campus entrance access still depends on the nearby OpenStreetMap roads.

The old fixed HCMC download is replaced by a pair-specific request: local routes use a bounding box with 0.025-degree padding; routes over 60 km use main roads in a larger corridor plus local streets within 5 km of each endpoint. This reduces unnecessary transfer on the first request. Nodes use compact `out skel qt` output. The browser Cache API retains complete responses for seven days, shared across reverse journeys and vehicle modes. Cache failures are nonfatal. Partial responses are rejected. Repeated simultaneous requests share one promise. Hierarchy caches include the corridor key, preventing cross-route reuse of the wrong graph.

There is no guaranteed network latency: Overpass can still queue or time out, especially for regional requests. Cold-load timing has not been measured. A route is optimal only within the loaded corridor; regional minor-road alternatives outside endpoint areas are excluded. The client request timeout is 60 seconds, with retryable errors. Persistent caching requires a supported browser on HTTPS or localhost.
