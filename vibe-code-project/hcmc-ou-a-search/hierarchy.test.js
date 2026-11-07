import { test } from "node:test";
import assert from "node:assert/strict";
import { contract, query } from "./hierarchy.js";
import { search } from "./routing.js";
function finish(iterator) {
  let step;
  do {
    step = iterator.next();
  } while (!step.done);
  return step.value;
}
test("CH matches Dijkstra for every pair in seeded directed graphs", () => {
  for (let seed = 1; seed <= 25; seed++) {
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const graph = new Map(
      Array.from({ length: 18 }, (_, id) => [id, { ll: [0, 0], edges: [] }]),
    );
    for (const [from, node] of graph)
      for (const to of graph.keys())
        if (from !== to && random() < 0.14)
          node.edges.push({
            to,
            seconds: 1 + Math.floor(random() * 50),
            meters: 1 + Math.floor(random() * 100),
          });
    for (const options of [
      {},
      { maxWork: 0 },
      { maxNodeWork: 1 },
      { maxPairs: 2 },
      { maxWork: 150 },
    ]) {
      const hierarchy = finish(contract(graph, options));
      for (const from of graph.keys())
        for (const to of graph.keys()) {
          const expected = finish(search(graph, from, to, { dijkstra: true })),
            actual = finish(query(hierarchy, from, to));
          assert.equal(
            actual?.seconds,
            expected?.seconds,
            `${seed}: ${from} → ${to}`,
          );
          if (actual) {
            assert.equal(actual.route[0], from);
            assert.equal(actual.route.at(-1), to);
            let seconds = 0,
              meters = 0;
            for (let i = 1; i < actual.route.length; i++) {
              const edge = graph
                .get(actual.route[i - 1])
                .edges.find((e) => e.to === actual.route[i]);
              assert.ok(edge);
              seconds += edge.seconds;
              meters += edge.meters;
            }
            assert.equal(seconds, actual.seconds);
            assert.equal(meters, actual.meters);
          }
        }
    }
  }
});
