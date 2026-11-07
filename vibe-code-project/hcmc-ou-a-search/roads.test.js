import { test } from "node:test";
import assert from "node:assert/strict";
import { roadRequest, validRoads } from "./roads.js";
test("local requests cover both endpoints and share a cache key when reversed", () => {
  const a = [10.7766, 106.6906],
    b = [10.7595, 106.6918];
  const first = roadRequest(a, b),
    reverse = roadRequest(b, a);
  assert.equal(first.key, reverse.key);
  assert.equal(first.query, reverse.query);
  assert.equal(first.regional, false);
  assert.ok(first.query.includes("10.73450,106.66560,10.80160,106.71680"));
});
test("regional requests include local access roads at both endpoints", () => {
  const request = roadRequest([10.77, 106.69], [12.49, 109.13]);
  assert.equal(request.regional, true);
  assert.ok(request.query.includes("around:5000,10.77,106.69"));
  assert.ok(request.query.includes("around:5000,12.49,109.13"));
});
test("partial and empty responses cannot enter the persistent cache", () => {
  assert.equal(validRoads({ elements: [] }), false);
  assert.equal(
    validRoads({
      remark: "timeout",
      elements: [{ type: "way" }, { type: "node" }],
    }),
    false,
  );
  assert.equal(
    validRoads({ elements: [{ type: "way" }, { type: "node" }] }),
    true,
  );
});
test("verified campuses use distinct corridors and symmetric cache keys", () => {
  const hcmc = [10.7766, 106.6906],
    dongNai = [10.9068441, 106.8552152],
    ninhHoa = [12.5063776, 109.146128];
  const local = roadRequest(hcmc, dongNai);
  assert.equal(local.regional, false);
  const regional = roadRequest(dongNai, ninhHoa);
  assert.equal(regional.regional, true);
  assert.ok(regional.query.includes("around:5000,10.9068441,106.8552152"));
  assert.ok(regional.query.includes("around:5000,12.5063776,109.146128"));
  assert.equal(regional.key, roadRequest(ninhHoa, dongNai).key);
  assert.notEqual(regional.key, roadRequest(hcmc, ninhHoa).key);
  assert.notEqual(local.key, regional.key);
});
