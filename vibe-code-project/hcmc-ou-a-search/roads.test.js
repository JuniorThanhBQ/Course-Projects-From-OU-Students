import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPUSES } from "./campuses.js";
import {
  CACHE_NAME,
  OVERPASS_MIRRORS,
  loadRoads,
  pruneOldCaches,
  roadRequest,
  validRoads,
} from "./roads.js";

function pointInAnyBox(boxes, [lat, lon]) {
  return boxes.some(
    ([s, w, n, e]) => lat >= s && lat <= n && lon >= w && lon <= e,
  );
}

function makeMockCacheStorage(initialBuckets = {}) {
  const buckets = new Map();
  for (const [name, entries] of Object.entries(initialBuckets)) {
    buckets.set(name, new Map(Object.entries(entries)));
  }
  return {
    buckets,
    async keys() {
      return [...buckets.keys()];
    },
    async delete(name) {
      return buckets.delete(name);
    },
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const store = buckets.get(name);
      return {
        async match(url) {
          return store.get(url);
        },
        async put(url, response) {
          store.set(url, response);
        },
      };
    },
  };
}

const SAMPLE_VALID_OSM = {
  elements: [
    { type: "node", id: 1, lat: 10.7764, lon: 106.6903 },
    { type: "node", id: 2, lat: 10.7618, lon: 106.6922 },
    { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary" } },
  ],
};

test("local requests (<= 15 km) are symmetric, cover both endpoints, and query local + motorbike paths", () => {
  const a = [10.7764, 106.6903];
  const b = [10.7618, 106.6922];
  const first = roadRequest(a, b);
  const reverse = roadRequest(b, a);
  assert.equal(first.key, reverse.key);
  assert.equal(first.query, reverse.query);
  assert.equal(first.tier, "local");
  assert.equal(first.regional, false);
  assert.equal(first.boxes.length, 1);
  assert.ok(pointInAnyBox(first.boxes, a));
  assert.ok(pointInAnyBox(first.boxes, b));
  assert.ok(first.query.includes("motorway|trunk|primary"));
  assert.ok(first.query.includes('highway="path"'));
  assert.ok(first.query.includes("out body qt;>;out skel qt;"));
});

test("metro requests (15-100 km, HCMC to Dong Nai) use chained arterial bboxes + tight endpoint bboxes without around:5000", () => {
  const hcmc = [10.7764, 106.6903];
  const dongNai = [10.9068441, 106.8552152];
  const req = roadRequest(hcmc, dongNai);
  const rev = roadRequest(dongNai, hcmc);
  assert.equal(req.tier, "metro");
  assert.equal(req.regional, true);
  assert.equal(req.key, rev.key);
  assert.equal(req.query, rev.query);
  assert.equal(req.boxes.length, 3);
  assert.equal(req.endpointBoxes.length, 2);
  assert.equal(req.query.includes("around:5000"), false);
  assert.ok(pointInAnyBox(req.endpointBoxes, hcmc));
  assert.ok(pointInAnyBox(req.endpointBoxes, dongNai));
});

test("long regional requests (> 100 km) cover coastal QL1A/CT01 waypoints and drop rural interprovincial tertiary", () => {
  const coastalWaypoints = [
    ["Phan Thiet", [10.93, 108.1]],
    ["Vinh Hao", [11.31, 108.84]],
    ["Phan Rang", [11.57, 108.99]],
    ["Cam Ranh", [11.92, 109.14]],
  ];
  const ninhHoa = [12.5063776, 109.146128];
  const origins = [
    ["VVT", [10.7764, 106.6903]],
    ["Nhon Duc", [10.676414, 106.690748]],
    ["Dong Nai", [10.9068441, 106.8552152]],
  ];

  for (const [label, origin] of origins) {
    const req = roadRequest(origin, ninhHoa);
    assert.equal(req.tier, "regional", label);
    assert.equal(req.regional, true, label);
    assert.equal(req.boxes.length, 5, label);
    assert.equal(req.endpointBoxes.length, 2, label);
    assert.equal(req.query.includes("around:5000"), false, label);
    assert.equal(req.key, roadRequest(ninhHoa, origin).key, label);
    assert.ok(
      req.query.includes(
        'highway~"^(motorway|trunk|primary|secondary)(_link)?$"',
      ),
      `${label}: corridor should exclude interprovincial tertiary`,
    );
    for (const [wpName, wpLL] of coastalWaypoints) {
      assert.ok(
        pointInAnyBox(req.boxes, wpLL),
        `${label} -> Ninh Hoa corridor must cover ${wpName} ${wpLL}`,
      );
    }
  }
});

test("validRoads rejects empty, remarked, single-node, <2-node ways, and non-finite coords", () => {
  assert.equal(validRoads(null), false);
  assert.equal(validRoads({ elements: [] }), false);
  assert.equal(
    validRoads({
      remark: "runtime error: Query timed out",
      elements: SAMPLE_VALID_OSM.elements,
    }),
    false,
  );
  assert.equal(
    validRoads({
      elements: [
        { type: "node", id: 1, lat: 10.7, lon: 106.7 },
        { type: "way", id: 10, nodes: [1, 2] },
      ],
    }),
    false,
  );
  assert.equal(
    validRoads({
      elements: [
        { type: "node", id: 1, lat: 10.7, lon: 106.7 },
        { type: "node", id: 2, lat: NaN, lon: 106.7 },
        { type: "way", id: 10, nodes: [1, 2] },
      ],
    }),
    false,
  );
  assert.equal(
    validRoads({
      elements: [
        { type: "node", id: 1, lat: 10.7, lon: 106.7 },
        { type: "node", id: 2, lat: 10.71, lon: 106.71 },
        { type: "way", id: 10, nodes: [1] },
      ],
    }),
    false,
  );
  assert.equal(validRoads(SAMPLE_VALID_OSM), true);
});

test("pruneOldCaches removes v1-v3 buckets while preserving v4 and unrelated caches", async () => {
  const storage = makeMockCacheStorage({
    "ou-road-data-v1": {},
    "ou-road-data-v2": {},
    "ou-road-data-v3": {},
    [CACHE_NAME]: {},
    "other-app-cache": {},
  });
  await pruneOldCaches(storage);
  const remaining = (await storage.keys()).sort();
  assert.deepEqual(remaining, ["other-app-cache", CACHE_NAME].sort());
});

test("loadRoads uses cache hit without network and writes to v4 cache on miss", async () => {
  const storage = makeMockCacheStorage();
  const a = [10.7764, 106.6903];
  const b = [10.7618, 106.6922];
  let fetchCalls = 0;

  const fetchImpl = async () => {
    fetchCalls++;
    return new Response(JSON.stringify(SAMPLE_VALID_OSM), { status: 200 });
  };

  const first = await loadRoads(a, b, {
    fetchImpl,
    cacheStorage: storage,
    mirrors: ["https://mirror-1.test/interpreter"],
    backoffMs: 0,
  });
  assert.equal(first.source, "network");
  assert.equal(fetchCalls, 1);
  assert.equal(storage.buckets.get(CACHE_NAME).size, 1);

  const second = await loadRoads(b, a, {
    fetchImpl,
    cacheStorage: storage,
    mirrors: ["https://mirror-1.test/interpreter"],
    backoffMs: 0,
  });
  assert.equal(second.source, "cache");
  assert.equal(fetchCalls, 1);
});

test("loadRoads fails over across mirrors on 429/HTML and Overpass remark errors", async () => {
  const storage = makeMockCacheStorage();
  const a = [10.7764, 106.6903];
  const b = [10.7618, 106.6922];
  const calledUrls = [];
  const notices = [];

  const fetchImpl = async (url) => {
    calledUrls.push(url);
    if (calledUrls.length === 1) {
      return new Response("<html>502 Bad Gateway</html>", { status: 502 });
    }
    if (calledUrls.length === 2) {
      return new Response(
        JSON.stringify({ remark: "timeout", elements: SAMPLE_VALID_OSM.elements }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(SAMPLE_VALID_OSM), { status: 200 });
  };

  const res = await loadRoads(a, b, {
    fetchImpl,
    cacheStorage: storage,
    mirrors: OVERPASS_MIRRORS,
    backoffMs: 0,
    notify: (msg) => notices.push(msg),
  });

  assert.equal(res.source, "network");
  assert.equal(res.mirror, OVERPASS_MIRRORS[2]);
  assert.deepEqual(calledUrls, OVERPASS_MIRRORS);
  assert.ok(notices.some((m) => m.includes("2 of 3")));
  assert.ok(notices.some((m) => m.includes("3 of 3")));
});

test("loadRoads honors AbortController immediately without trying fallback mirrors", async () => {
  const storage = makeMockCacheStorage();
  const controller = new AbortController();
  let calls = 0;

  const fetchImpl = async (_url, { signal }) => {
    calls++;
    controller.abort();
    return new Promise((_resolve, reject) => {
      const err = new Error("Aborted");
      err.name = "AbortError";
      if (signal.aborted) reject(err);
      else signal.addEventListener("abort", () => reject(err));
    });
  };

  await assert.rejects(
    () =>
      loadRoads([10.7764, 106.6903], [10.7618, 106.6922], {
        fetchImpl,
        cacheStorage: storage,
        mirrors: OVERPASS_MIRRORS,
        signal: controller.signal,
        backoffMs: 0,
      }),
    (err) => err.name === "AbortError",
  );
  assert.equal(calls, 1);
});

test("CAMPUSES integrity: 8 campuses, Ho Hao Hon north of Ben Nghe canal, 3 verified pins exact", () => {
  assert.equal(CAMPUSES.length, 8);
  const byId = new Map(CAMPUSES.map((c) => [c.id, c]));
  const hhh = byId.get("hhh");
  assert.ok(hhh);
  assert.ok(hhh.ll[0] >= 10.761, "Ho Hao Hon must sit north of Ben Nghe canal");

  assert.deepEqual(byId.get("nhon-duc").ll, [10.676414, 106.690748]);
  assert.equal(byId.get("nhon-duc").pinStatus, "verified");
  assert.deepEqual(byId.get("dong-nai").ll, [10.9068441, 106.8552152]);
  assert.equal(byId.get("dong-nai").pinStatus, "verified");
  assert.deepEqual(byId.get("ninh-hoa").ll, [12.5063776, 109.146128]);
  assert.equal(byId.get("ninh-hoa").pinStatus, "verified");
});
