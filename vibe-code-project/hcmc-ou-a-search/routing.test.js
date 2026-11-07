import { test } from "node:test";
import assert from "node:assert/strict";
import { graphFromOSM, search } from "./routing.js";
function finish(iterator) {
  let s;
  do {
    s = iterator.next();
  } while (!s.done);
  return s.value;
}
test("A* agrees with Dijkstra on directed weighted graphs", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const graph = new Map();
    for (let i = 0; i < 30; i++)
      graph.set(i, { ll: [10.7 + i * 0.0001, 106.7], edges: [] });
    for (let i = 0; i < 29; i++) {
      graph.get(i).edges.push({ to: i + 1, seconds: 10, meters: 12 });
      if (i + 3 < 30)
        graph.get(i).edges.push({
          to: i + 3,
          seconds: 20 + ((i * seed) % 20),
          meters: 40,
        });
    }
    assert.equal(
      finish(search(graph, 0, 29)).seconds,
      finish(search(graph, 0, 29, { dijkstra: true })).seconds,
    );
    assert.equal(finish(search(graph, 29, 0)), null);
    assert.deepEqual(finish(search(graph, 0, 0)).route, [0]);
  }
});
test("vehicle access and reverse one-way are honored", () => {
  const data = {
    elements: [
      { type: "node", id: 1, lat: 10.7, lon: 106.7 },
      { type: "node", id: 2, lat: 10.701, lon: 106.7 },
      {
        type: "way",
        nodes: [1, 2],
        tags: { highway: "residential", oneway: "-1", motorcar: "no" },
      },
    ],
  };
  assert.equal(graphFromOSM(data, "car").size, 0);
  const motorbike = graphFromOSM(data, "motorbike");
  assert.equal(motorbike.get(2).edges[0].to, 1);
  assert.equal(motorbike.has(1), true);
  assert.deepEqual(finish(search(motorbike, 2, 1)).route, [2, 1]);
});
