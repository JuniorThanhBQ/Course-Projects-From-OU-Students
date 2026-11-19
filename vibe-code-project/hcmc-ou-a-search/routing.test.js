import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPEED_PROFILES,
  computeSCC,
  distance,
  graphFromOSM,
  nearest,
  packGraph,
  parseMaxspeed,
  search,
} from "./routing.js";

function finish(iterator) {
  let s;
  do {
    s = iterator.next();
  } while (!s.done);
  return s.value;
}

test("A* agrees with Dijkstra on directed weighted graphs and high-speed motorways", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const graph = new Map();
    for (let i = 0; i < 30; i++) {
      graph.set(i, { ll: [10.7 + i * 0.0001, 106.7], edges: [] });
    }
    for (let i = 0; i < 29; i++) {
      graph.get(i).edges.push({ to: i + 1, seconds: 10, meters: 12 });
      if (i + 3 < 30) {
        graph.get(i).edges.push({
          to: i + 3,
          seconds: 20 + ((i * seed) % 20),
          meters: 40,
        });
      }
    }
    assert.equal(
      finish(search(graph, 0, 29)).seconds,
      finish(search(graph, 0, 29, { dijkstra: true })).seconds,
    );
    assert.equal(finish(search(graph, 29, 0)), null);
    assert.deepEqual(finish(search(graph, 0, 0)).route, [0]);
  }

  // Motorway (75 km/h) vs residential slower detour + arbitrary super-fast synthetic edge
  const osmMotorway = {
    elements: [
      { type: "node", id: 1, lat: 10.7, lon: 106.7 },
      { type: "node", id: 2, lat: 10.75, lon: 106.7 },
      { type: "node", id: 3, lat: 10.725, lon: 106.72 },
      { type: "way", id: 1, nodes: [1, 2], tags: { highway: "motorway" } },
      {
        type: "way",
        id: 2,
        nodes: [1, 3, 2],
        tags: { highway: "residential" },
      },
    ],
  };
  const carGraph = graphFromOSM(osmMotorway, "car");
  const astar = finish(search(carGraph, 1, 2));
  const dijk = finish(search(carGraph, 1, 2, { dijkstra: true }));
  assert.equal(astar.seconds, dijk.seconds);
  assert.deepEqual(astar.route, [1, 2]);

  // Synthetic arbitrary speed exceeding 1000 km/h still stays admissible
  const fastGraph = new Map([
    [0, { ll: [10.7, 106.7], edges: [{ to: 1, seconds: 1, meters: 5500 }, { to: 2, seconds: 3, meters: 5500 }] }],
    [1, { ll: [10.75, 106.7], edges: [{ to: 2, seconds: 1, meters: 5500 }] }],
    [2, { ll: [10.8, 106.7], edges: [] }],
  ]);
  assert.equal(
    finish(search(fastGraph, 0, 2)).seconds,
    finish(search(fastGraph, 0, 2, { dijkstra: true })).seconds,
  );
});

test("parseMaxspeed parses numeric, units, multi-values, VN national tags, and ignores invalid values", () => {
  assert.equal(parseMaxspeed("50"), 50);
  assert.equal(parseMaxspeed("60 km/h"), 60);
  assert.equal(parseMaxspeed("45kph"), 45);
  assert.ok(Math.abs(parseMaxspeed("30 mph") - 48.28032) < 1e-4);
  assert.equal(parseMaxspeed("60;40"), 40);
  assert.equal(parseMaxspeed("70|50"), 50);
  assert.equal(parseMaxspeed("VN:urban"), 50);
  assert.equal(parseMaxspeed("VN:rural"), 80);
  assert.equal(parseMaxspeed("VN:motorway"), 100);
  assert.equal(parseMaxspeed("none"), Infinity);
  assert.equal(parseMaxspeed("signals"), Infinity);
  assert.equal(parseMaxspeed(undefined), Infinity);
});

test("Vietnam speed profiles, motorway car-only, alley/width/path/service, and oneway overrides", () => {
  assert.equal(SPEED_PROFILES.car.trunk, 45);
  assert.equal(SPEED_PROFILES.motorbike.trunk, 40);
  assert.ok(SPEED_PROFILES.car.trunk > SPEED_PROFILES.car.primary);
  assert.ok(SPEED_PROFILES.car.primary > SPEED_PROFILES.car.residential);
  assert.ok(SPEED_PROFILES.motorbike.trunk > SPEED_PROFILES.motorbike.primary);
  assert.ok(SPEED_PROFILES.motorbike.primary > SPEED_PROFILES.motorbike.residential);

  // Motorway allowed for car (75 km/h), blocked for motorbike
  const mwData = {
    elements: [
      { type: "node", id: 1, lat: 10.7, lon: 106.7 },
      { type: "node", id: 2, lat: 10.71, lon: 106.7 },
      { type: "way", id: 1, nodes: [1, 2], tags: { highway: "motorway" } },
    ],
  };
  const mwCar = graphFromOSM(mwData, "car", { collapse: false });
  assert.equal(mwCar.size, 2);
  const e = mwCar.get(1).edges[0];
  assert.ok(Math.abs((e.meters / e.seconds) * 3.6 - 75) < 1e-6);
  assert.equal(graphFromOSM(mwData, "motorbike").size, 0);

  // service=alley & width=1.8 excluded for car, allowed for motorbike; parking_aisle/driveway/area=yes excluded for both
  const narrowData = {
    elements: [
      { type: "node", id: 1, lat: 10.7, lon: 106.7 },
      { type: "node", id: 2, lat: 10.701, lon: 106.7 },
      { type: "node", id: 3, lat: 10.702, lon: 106.7 },
      { type: "node", id: 4, lat: 10.703, lon: 106.7 },
      { type: "node", id: 5, lat: 10.704, lon: 106.7 },
      { type: "way", id: 1, nodes: [1, 2], tags: { highway: "service", service: "alley" } },
      { type: "way", id: 2, nodes: [2, 3], tags: { highway: "residential", width: "1.8" } },
      { type: "way", id: 3, nodes: [3, 4], tags: { highway: "service", service: "parking_aisle" } },
      { type: "way", id: 4, nodes: [4, 5], tags: { highway: "residential", area: "yes" } },
      { type: "way", id: 5, nodes: [1, 5], tags: { highway: "service", service: "driveway" } },
    ],
  };
  assert.equal(graphFromOSM(narrowData, "car").size, 0);
  const narrowMoto = graphFromOSM(narrowData, "motorbike", { collapse: false });
  assert.equal(narrowMoto.has(1), true);
  assert.equal(narrowMoto.has(2), true);
  assert.equal(narrowMoto.has(3), true);
  assert.equal(narrowMoto.has(4), false);
  assert.equal(narrowMoto.has(5), false);

  // highway=path + motorcycle=yes allowed for motorbike only; plain path excluded for both
  const pathData = {
    elements: [
      { type: "node", id: 1, lat: 10.7, lon: 106.7 },
      { type: "node", id: 2, lat: 10.701, lon: 106.7 },
      { type: "node", id: 3, lat: 10.702, lon: 106.7 },
      { type: "way", id: 1, nodes: [1, 2], tags: { highway: "path", motorcycle: "yes" } },
      { type: "way", id: 2, nodes: [2, 3], tags: { highway: "path" } },
    ],
  };
  assert.equal(graphFromOSM(pathData, "car").size, 0);
  const pathMoto = graphFromOSM(pathData, "motorbike", { collapse: false });
  assert.equal(pathMoto.has(1), true);
  assert.equal(pathMoto.has(2), true);
  assert.equal(pathMoto.has(3), false);

  // Oneway overrides: oneway:motorcycle=no, motorcycle:backward=yes, junction=circular, oneway=reverse
  const onewayData = {
    elements: [
      { type: "node", id: 1, lat: 10.7, lon: 106.7 },
      { type: "node", id: 2, lat: 10.701, lon: 106.7 },
      { type: "node", id: 3, lat: 10.702, lon: 106.7 },
      { type: "node", id: 4, lat: 10.703, lon: 106.7 },
      { type: "node", id: 5, lat: 10.704, lon: 106.7 },
      {
        type: "way",
        id: 1,
        nodes: [1, 2],
        tags: { highway: "primary", oneway: "yes", "oneway:motorcycle": "no" },
      },
      {
        type: "way",
        id: 2,
        nodes: [2, 3],
        tags: { highway: "secondary", oneway: "yes", "motorcycle:backward": "yes" },
      },
      {
        type: "way",
        id: 3,
        nodes: [3, 4],
        tags: { highway: "tertiary", junction: "circular" },
      },
      {
        type: "way",
        id: 4,
        nodes: [4, 5],
        tags: { highway: "residential", oneway: "reverse" },
      },
    ],
  };
  const owCar = graphFromOSM(onewayData, "car", { collapse: false });
  assert.equal(owCar.get(2).edges.some((e) => e.to === 1), false);
  assert.equal(owCar.get(3).edges.some((e) => e.to === 2), false);
  assert.equal(owCar.get(3).edges.some((e) => e.to === 4), true);
  assert.equal(owCar.get(4).edges.some((e) => e.to === 3), false);
  assert.equal(owCar.get(5).edges.some((e) => e.to === 4), true);
  assert.equal(owCar.get(4).edges.some((e) => e.to === 5), false);

  const owMoto = graphFromOSM(onewayData, "motorbike", { collapse: false });
  assert.equal(owMoto.get(2).edges.some((e) => e.to === 1), true);
  assert.equal(owMoto.get(3).edges.some((e) => e.to === 2), true);
});

test("degree-2 chain collapse preserves geometry, pin anchors, maxChainMeters splits, and rings", () => {
  // 6-node curved two-way road (< 500 m total)
  const nodes = [
    { type: "node", id: 1, lat: 10.77, lon: 106.69 },
    { type: "node", id: 2, lat: 10.7705, lon: 106.6904 },
    { type: "node", id: 3, lat: 10.771, lon: 106.6902 },
    { type: "node", id: 4, lat: 10.7715, lon: 106.6906 },
    { type: "node", id: 5, lat: 10.772, lon: 106.6903 },
    { type: "node", id: 6, lat: 10.7725, lon: 106.6905 },
  ];
  const data = {
    elements: [
      ...nodes,
      { type: "way", id: 10, nodes: [1, 2, 3, 4, 5, 6], tags: { highway: "primary" } },
    ],
  };
  const raw = graphFromOSM(data, "car", { collapse: false });
  const collapsed = graphFromOSM(data, "car", { collapse: true });

  assert.equal(raw.size, 6);
  assert.equal(collapsed.size, 2);
  assert.equal(collapsed.has(1), true);
  assert.equal(collapsed.has(6), true);

  const fwd = collapsed.get(1).edges[0];
  const bwd = collapsed.get(6).edges[0];
  assert.equal(fwd.to, 6);
  assert.equal(bwd.to, 1);
  assert.equal(fwd.geom.length, 4);
  assert.equal(bwd.geom.length, 4);
  assert.deepEqual(fwd.geom, [
    [10.7705, 106.6904],
    [10.771, 106.6902],
    [10.7715, 106.6906],
    [10.772, 106.6903],
  ]);
  assert.deepEqual(bwd.geom, [...fwd.geom].reverse());

  const rawFwd = finish(search(raw, 1, 6, { dijkstra: true }));
  assert.ok(Math.abs(fwd.meters - rawFwd.meters) < 1e-6);
  assert.ok(Math.abs(fwd.seconds - rawFwd.seconds) < 1e-6);

  // Pin proximity anchor preserves node 4
  const pinned = graphFromOSM(data, "car", {
    collapse: true,
    pins: [[10.7715, 106.6906]],
  });
  assert.equal(pinned.size, 3);
  assert.equal(pinned.has(4), true);

  // Long chain > 500 m splits into <= 500 m sub-chains
  const longNodes = Array.from({ length: 11 }, (_, i) => ({
    type: "node",
    id: i + 1,
    lat: 10.7 + i * 0.0018, // ~200 m per hop, ~2000 m total
    lon: 106.7,
  }));
  const longGraph = graphFromOSM(
    {
      elements: [
        ...longNodes,
        {
          type: "way",
          id: 99,
          nodes: longNodes.map((n) => n.id),
          tags: { highway: "trunk" },
        },
      ],
    },
    "car",
    { collapse: true, maxChainMeters: 500 },
  );
  assert.ok(longGraph.size > 2);
  for (const node of longGraph.values()) {
    for (const edge of node.edges) {
      assert.ok(edge.meters <= 505, `edge ${edge.meters} m exceeded 500 m split`);
    }
  }

  // Pure degree-2 ring preserves 2 anchors with zero self-loops
  const ringData = {
    elements: [
      { type: "node", id: 1, lat: 10.7, lon: 106.7 },
      { type: "node", id: 2, lat: 10.701, lon: 106.7 },
      { type: "node", id: 3, lat: 10.701, lon: 106.701 },
      { type: "node", id: 4, lat: 10.7, lon: 106.701 },
      {
        type: "way",
        id: 1,
        nodes: [1, 2, 3, 4, 1],
        tags: { highway: "residential" },
      },
    ],
  };
  const ring = graphFromOSM(ringData, "car", { collapse: true });
  assert.equal(ring.size, 2);
  for (const [id, node] of ring) {
    for (const edge of node.edges) {
      assert.notEqual(edge.to, id, "ring collapse must not create self-loops");
    }
  }
});

test("iterative Tarjan SCC and nearest() avoid one-way sinks, source-only traps, and isolated islands", () => {
  // Main 4-node strongly connected square (10,11,12,13)
  // Closer one-way sink (14: 10 -> 14), closer source-only (15: 15 -> 10), closer 2-node island (20 <-> 21)
  const graph = new Map([
    [10, { id: 10, ll: [10.77, 106.69], edges: [{ to: 11, seconds: 10, meters: 50 }, { to: 14, seconds: 5, meters: 20 }] }],
    [11, { id: 11, ll: [10.7705, 106.69], edges: [{ to: 12, seconds: 10, meters: 50 }] }],
    [12, { id: 12, ll: [10.7705, 106.6905], edges: [{ to: 13, seconds: 10, meters: 50 }] }],
    [13, { id: 13, ll: [10.77, 106.6905], edges: [{ to: 10, seconds: 10, meters: 50 }] }],
    [14, { id: 14, ll: [10.7699, 106.6899], edges: [] }], // closer sink
    [15, { id: 15, ll: [10.76995, 106.68995], edges: [{ to: 10, seconds: 5, meters: 20 }] }], // closer source-only
    [20, { id: 20, ll: [10.76985, 106.68985], edges: [{ to: 21, seconds: 5, meters: 15 }] }], // closer 2-node island
    [21, { id: 21, ll: [10.76986, 106.68986], edges: [{ to: 20, seconds: 5, meters: 15 }] }],
  ]);

  const scc = computeSCC(graph);
  assert.equal(scc.largestSccSize, 4);
  assert.equal(scc.largestScc.has(10), true);
  assert.equal(scc.largestScc.has(14), false);
  assert.equal(scc.largestScc.has(20), false);

  const snapped = nearest(graph, [10.76985, 106.68985], { role: "start" });
  assert.equal(snapped, 10, "nearest must snap into largest SCC, not island/sink/source");

  // Tiny 2-node DAG fallback honors role="start" vs role="end"
  const dag = new Map([
    [1, { id: 1, ll: [10.77, 106.69], edges: [{ to: 2, seconds: 10, meters: 100 }] }],
    [2, { id: 2, ll: [10.7701, 106.69], edges: [] }],
  ]);
  assert.equal(nearest(dag, [10.7701, 106.69], { role: "start" }), 1);
  assert.equal(nearest(dag, [10.77, 106.69], { role: "end" }), 2);

  // Empty graph throws vehicle-specific message
  assert.throws(
    () => nearest(new Map(), [10.77, 106.69]),
    /No routable roads found/,
  );
});

test("packGraph builds valid CSR buffers and graphView", () => {
  const data = {
    elements: [
      { type: "node", id: 100, lat: 10.7, lon: 106.7 },
      { type: "node", id: 200, lat: 10.701, lon: 106.701 },
      { type: "way", id: 1, nodes: [100, 200], tags: { highway: "primary" } },
    ],
  };
  const g = graphFromOSM(data, "car");
  const { graphView, workerPayload, transferList } = packGraph(g);
  assert.equal(workerPayload.kind, "compact-graph");
  assert.equal(workerPayload.nodeCount, 2);
  assert.equal(workerPayload.edgeCount, 2);
  assert.equal(graphView.origEdges.length, 2);
  assert.equal(transferList.length, 5);
  assert.ok(transferList.every((buf) => buf instanceof ArrayBuffer));
});
