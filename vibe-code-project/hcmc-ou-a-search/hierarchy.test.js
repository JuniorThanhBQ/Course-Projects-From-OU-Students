import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contract,
  getHierarchyTransferables,
  query,
  unpackEdge,
} from "./hierarchy.js";
import { graphFromOSM, packGraph, search } from "./routing.js";

function finish(iterator) {
  let step;
  do {
    step = iterator.next();
  } while (!step.done);
  return step.value;
}

function collectQuery(iterator) {
  const steps = [];
  let step;
  do {
    step = iterator.next();
    if (!step.done) steps.push(step.value);
  } while (!step.done);
  return { steps, result: step.value };
}

test("CH matches Dijkstra for every pair in seeded directed graphs across budgets and Stall-on-Demand modes", () => {
  for (let seed = 1; seed <= 25; seed++) {
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const graph = new Map(
      Array.from({ length: 18 }, (_, id) => [id, { ll: [0, 0], edges: [] }]),
    );
    for (const [from, node] of graph) {
      for (const to of graph.keys()) {
        if (from !== to && random() < 0.14) {
          node.edges.push({
            to,
            seconds: 1 + Math.floor(random() * 50),
            meters: 1 + Math.floor(random() * 100),
          });
        }
      }
    }

    const { graphView } = packGraph(graph);
    const configs = [
      { contractOpts: {}, sod: true },
      { contractOpts: {}, sod: false },
      { contractOpts: { maxWork: 0 }, sod: true },
      { contractOpts: { maxNodeWork: 1 }, sod: true },
      { contractOpts: { maxPairs: 2 }, sod: true },
      { contractOpts: { maxWork: 150 }, sod: true },
    ];

    for (const { contractOpts, sod } of configs) {
      const hierarchy = finish(contract(graph, contractOpts));
      for (const from of graph.keys()) {
        for (const to of graph.keys()) {
          const expected = finish(search(graph, from, to, { dijkstra: true }));
          const actual = finish(
            query(hierarchy, from, to, { useStallOnDemand: sod }),
          );
          assert.equal(
            actual?.seconds,
            expected?.seconds,
            `seed ${seed} (${JSON.stringify(contractOpts)}, sod=${sod}): ${from} -> ${to}`,
          );
          if (actual) {
            assert.equal(actual.route[0], from);
            assert.equal(actual.route.at(-1), to);
            assert.equal(actual.edgeIds.length, actual.route.length - 1);
            let seconds = 0;
            let meters = 0;
            for (let i = 0; i < actual.edgeIds.length; i++) {
              const orig = graphView.origEdges[actual.edgeIds[i]];
              assert.ok(orig);
              assert.equal(graphView.idxToId[orig.fromIdx], actual.route[i]);
              assert.equal(graphView.idxToId[orig.toIdx], actual.route[i + 1]);
              seconds += orig.seconds;
              meters += orig.meters;
            }
            assert.equal(seconds, actual.seconds);
            assert.equal(meters, actual.meters);
          }
        }
      }
    }
  }
});

test("start === end fast path and out-of-graph error", () => {
  const graph = new Map([
    [10, { ll: [10.7, 106.7], edges: [{ to: 20, seconds: 5, meters: 50 }] }],
    [20, { ll: [10.701, 106.7], edges: [] }],
  ]);
  const hierarchy = finish(contract(graph));
  const res = finish(query(hierarchy, 10, 10));
  assert.deepEqual(res.route, [10]);
  assert.deepEqual(res.edgeIds, []);
  assert.equal(res.seconds, 0);
  assert.equal(res.meters, 0);
  assert.equal(res.meeting, 10);

  assert.throws(
    () => finish(query(hierarchy, 10, 999)),
    /Endpoint is outside the road graph/,
  );
});

test("zero-weight edges and parallel multi-edges match Dijkstra with Stall-on-Demand enabled", () => {
  const graph = new Map([
    [
      0,
      {
        ll: [0, 0],
        edges: [
          { to: 1, seconds: 0, meters: 10 },
          { to: 1, seconds: 5, meters: 50 }, // parallel more expensive
          { to: 2, seconds: 10, meters: 100 },
          { to: 2, seconds: 10, meters: 40 }, // parallel equal seconds, shorter meters
        ],
      },
    ],
    [
      1,
      {
        ll: [0, 0],
        edges: [
          { to: 2, seconds: 0, meters: 15 },
          { to: 3, seconds: 0, meters: 20 },
        ],
      },
    ],
    [
      2,
      {
        ll: [0, 0],
        edges: [
          { to: 3, seconds: 0, meters: 12 },
          { to: 4, seconds: 4, meters: 30 },
        ],
      },
    ],
    [
      3,
      {
        ll: [0, 0],
        edges: [
          { to: 4, seconds: 0, meters: 8 },
          { to: 0, seconds: 3, meters: 25 },
        ],
      },
    ],
    [
      4,
      {
        ll: [0, 0],
        edges: [
          { to: 5, seconds: 0, meters: 5 },
          { to: 5, seconds: 2, meters: 50 },
        ],
      },
    ],
    [5, { ll: [0, 0], edges: [{ to: 2, seconds: 1, meters: 10 }] }],
  ]);

  const { graphView } = packGraph(graph);
  const hierarchy = finish(contract(graph));

  for (const from of graph.keys()) {
    for (const to of graph.keys()) {
      const expected = finish(search(graph, from, to, { dijkstra: true }));
      const actual = finish(query(hierarchy, from, to, { useStallOnDemand: true }));
      assert.equal(actual?.seconds, expected?.seconds, `${from} -> ${to}`);
      if (actual) {
        let meters = 0;
        for (const eid of actual.edgeIds) {
          meters += graphView.origEdges[eid].meters;
        }
        assert.equal(meters, actual.meters);
      }
    }
  }
});

test("compact CSR pipeline matches raw Map and provides valid Transferable ArrayBuffers", () => {
  const graph = new Map([
    [101, { ll: [10.7, 106.7], edges: [{ to: 102, seconds: 12, meters: 100 }, { to: 103, seconds: 30, meters: 250 }] }],
    [102, { ll: [10.701, 106.7], edges: [{ to: 103, seconds: 10, meters: 90 }, { to: 104, seconds: 25, meters: 200 }] }],
    [103, { ll: [10.702, 106.7], edges: [{ to: 104, seconds: 8, meters: 75 }] }],
    [104, { ll: [10.703, 106.7], edges: [{ to: 101, seconds: 40, meters: 350 }] }],
  ]);

  const hFromMap = finish(contract(graph));
  const { graphView, workerPayload } = packGraph(graph);
  const hFromCompact = finish(contract(workerPayload));
  hFromCompact.idxToId = graphView.idxToId;
  hFromCompact.idToIdx = graphView.idToIdx;

  const transferables = getHierarchyTransferables(hFromCompact);
  assert.ok(transferables.length >= 10);
  assert.ok(transferables.every((b) => b instanceof ArrayBuffer));

  const r1 = finish(query(hFromMap, 101, 104));
  const { steps, result: r2 } = collectQuery(query(hFromCompact, 101, 104));
  assert.equal(r2.seconds, r1.seconds);
  assert.equal(r2.meters, r1.meters);
  assert.deepEqual(r2.route, r1.route);

  // Verify every explored step with edgePoolIdx >= 0 unpacks cleanly into valid origEdges
  for (const s of steps) {
    if (s.edgePoolIdx >= 0) {
      const unpacked = [];
      unpackEdge(hFromCompact, s.edgePoolIdx, unpacked);
      assert.ok(unpacked.length >= 1);
      for (const origId of unpacked) {
        assert.ok(graphView.origEdges[origId], `origEdge ${origId} must exist`);
      }
      const firstOrig = graphView.origEdges[unpacked[0]];
      const lastOrig = graphView.origEdges[unpacked[unpacked.length - 1]];
      if (s.direction === 0) {
        assert.equal(firstOrig.fromIdx, s.parentIdx);
        assert.equal(lastOrig.toIdx, s.visitedIdx);
      } else {
        assert.equal(firstOrig.fromIdx, s.visitedIdx);
        assert.equal(lastOrig.toIdx, s.parentIdx);
      }
    }
  }
});

test("40x40 road grid with 4 degree-2 shape nodes per segment achieves <5% core and <25% Dijkstra visited", () => {
  const N = 40;
  const SHAPE_NODES = 4;
  const elements = [];
  let nextNodeId = 1;
  let nextWayId = 1;

  // Create 40x40 intersections (1,600 nodes)
  const gridIds = Array.from({ length: N }, () => new Int32Array(N));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const id = nextNodeId++;
      gridIds[r][c] = id;
      elements.push({
        type: "node",
        id,
        lat: 10.7 + r * 0.001,
        lon: 106.65 + c * 0.001,
      });
    }
  }

  const addRoadSegment = (r1, c1, r2, c2, highway) => {
    const startId = gridIds[r1][c1];
    const endId = gridIds[r2][c2];
    const lat1 = 10.7 + r1 * 0.001;
    const lon1 = 106.65 + c1 * 0.001;
    const lat2 = 10.7 + r2 * 0.001;
    const lon2 = 106.65 + c2 * 0.001;
    const wayNodes = [startId];
    for (let s = 1; s <= SHAPE_NODES; s++) {
      const t = s / (SHAPE_NODES + 1);
      const midId = nextNodeId++;
      elements.push({
        type: "node",
        id: midId,
        lat: lat1 + (lat2 - lat1) * t + 0.00003 * Math.sin(s),
        lon: lon1 + (lon2 - lon1) * t + 0.00003 * Math.cos(s),
      });
      wayNodes.push(midId);
    }
    wayNodes.push(endId);
    elements.push({
      type: "way",
      id: nextWayId++,
      nodes: wayNodes,
      tags: { highway },
    });
  };

  // Horizontal and vertical roads (arterials every 8th row/col)
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (c + 1 < N) {
        addRoadSegment(r, c, r, c + 1, r % 8 === 0 ? "primary" : "residential");
      }
      if (r + 1 < N) {
        addRoadSegment(r, c, r + 1, c, c % 8 === 0 ? "primary" : "residential");
      }
    }
  }

  const graph = graphFromOSM({ elements }, "motorbike", { collapse: true });
  assert.equal(graph.meta.rawNodeCount, 1600 + 2 * N * (N - 1) * SHAPE_NODES);
  // 1,600 grid intersections minus the 4 degree-2 outer corners
  assert.equal(graph.size, 1596);

  const { graphView, workerPayload } = packGraph(graph);
  const hierarchy = finish(contract(workerPayload));
  hierarchy.idxToId = graphView.idxToId;
  hierarchy.idToIdx = graphView.idToIdx;

  const coreRatio = hierarchy.coreCount / hierarchy.nodeCount;
  assert.ok(
    coreRatio < 0.05,
    `Expected core ratio < 5%, got ${(coreRatio * 100).toFixed(2)}% (${hierarchy.coreCount}/${hierarchy.nodeCount})`,
  );

  // Corner-to-corner query vs Dijkstra
  const startId = gridIds[1][1];
  const endId = gridIds[N - 2][N - 2];

  let dijkVisited = 0;
  const dijkIter = search(graph, startId, endId, { dijkstra: true });
  let dijkStep;
  do {
    dijkStep = dijkIter.next();
    if (!dijkStep.done) dijkVisited++;
  } while (!dijkStep.done);
  const expected = dijkStep.value;

  const actual = finish(query(hierarchy, startId, endId));
  assert.ok(actual);
  assert.ok(
    Math.abs(actual.seconds - expected.seconds) < 1e-6,
    `CH seconds ${actual.seconds} !== Dijkstra ${expected.seconds}`,
  );
  assert.ok(
    Math.abs(actual.meters - expected.meters) < 1e-3,
    `CH meters ${actual.meters} !== Dijkstra ${expected.meters}`,
  );
  const visitedRatio = actual.visitedCount / dijkVisited;
  assert.ok(
    visitedRatio < 0.25,
    `Expected CH visited < 25% of Dijkstra, got ${actual.visitedCount}/${dijkVisited} (${(visitedRatio * 100).toFixed(1)}%)`,
  );
});
