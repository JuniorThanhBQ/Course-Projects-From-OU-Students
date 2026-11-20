import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPUSES } from "./campuses.js";
import {
  CACHE_NAME,
  OVERPASS_MIRRORS,
  loadRoads,
  parseRetryAfterMs,
  pruneOldCaches,
  resetMirrorHealth,
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
      req.query.includes('highway~"^(motorway|trunk)(_link)?$"'),
      `${label}: corridor should exclude interprovincial primary/secondary/tertiary`,
    );
    for (const [wpName, wpLL] of coastalWaypoints) {
      assert.ok(
        pointInAnyBox(req.boxes, wpLL),
        `${label} -> Ninh Hoa corridor must cover ${wpName} ${wpLL}`,
      );
    }
  }
});

test("validRoads rejects empty, unusable-remarked, single-node, <2-node ways, and non-finite coords while accepting remarked payloads with usable roads", () => {
  assert.equal(validRoads(null), false);
  assert.equal(validRoads({ elements: [] }), false);
  assert.equal(
    validRoads({
      remark: "runtime error: Query timed out",
      elements: [],
    }),
    false,
  );
  assert.equal(
    validRoads({
      remark: "runtime error: Query timed out",
      elements: [{ type: "node", id: 1, lat: 10.7, lon: 106.7 }],
    }),
    false,
  );
  assert.equal(
    validRoads({
      remark: "runtime error: Query timed out",
      elements: SAMPLE_VALID_OSM.elements,
    }),
    true,
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

test("loadRoads fails over across mirrors on 429/HTML and unusable Overpass remark errors", async () => {
  resetMirrorHealth();
  try {
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
          JSON.stringify({ remark: "timeout", elements: [] }),
          { status: 200 },
        );
      }
      if (calledUrls.length === 3) {
        return new Response("Too Many Requests", {
          status: 429,
          headers: { "Retry-After": "2" },
        });
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
    assert.equal(res.mirror, OVERPASS_MIRRORS[3]);
    assert.deepEqual(calledUrls, OVERPASS_MIRRORS);
    assert.ok(notices.some((m) => m.includes("2 of 4")));
    assert.ok(notices.some((m) => m.includes("3 of 4")));
    assert.ok(notices.some((m) => m.includes("4 of 4")));
  } finally {
    resetMirrorHealth();
  }
});

test("loadRoads honors AbortController immediately without trying fallback mirrors", async () => {
  resetMirrorHealth();
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
  resetMirrorHealth();
});

test("OVERPASS_MIRRORS replaces dead mail.ru mirror with 4 healthy global endpoints", () => {
  assert.equal(OVERPASS_MIRRORS.length, 4);
  assert.equal(
    OVERPASS_MIRRORS.some((m) => m.includes("mail.ru")),
    false,
  );
  assert.deepEqual(OVERPASS_MIRRORS, [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ]);
});

test("roadRequest aligns serverTimeoutSec < clientTimeoutMs / 1000 across local, metro, and regional tiers", () => {
  const vvt = [10.7764, 106.6903];
  const hhh = [10.7618, 106.6922];
  const dongNai = [10.9068441, 106.8552152];
  const ninhHoa = [12.5063776, 109.146128];

  const localReq = roadRequest(vvt, hhh);
  assert.equal(localReq.tier, "local");
  assert.equal(localReq.serverTimeoutSec, 25);
  assert.equal(localReq.clientTimeoutMs, 35000);
  assert.ok(localReq.serverTimeoutSec < localReq.clientTimeoutMs / 1000);
  assert.ok(localReq.query.includes("[timeout:25]"));
  assert.equal(localReq.fallbackQuery, null);

  const metroReq = roadRequest(vvt, dongNai);
  assert.equal(metroReq.tier, "metro");
  assert.equal(metroReq.serverTimeoutSec, 25);
  assert.equal(metroReq.clientTimeoutMs, 35000);
  assert.ok(metroReq.serverTimeoutSec < metroReq.clientTimeoutMs / 1000);
  assert.ok(metroReq.query.includes("[timeout:25]"));
  assert.equal(metroReq.fallbackQuery, null);

  const regionalReq = roadRequest(vvt, ninhHoa);
  assert.equal(regionalReq.tier, "regional");
  assert.equal(regionalReq.serverTimeoutSec, 35);
  assert.equal(regionalReq.clientTimeoutMs, 45000);
  assert.ok(regionalReq.serverTimeoutSec < regionalReq.clientTimeoutMs / 1000);
  assert.ok(regionalReq.query.includes("[timeout:35]"));
  assert.equal(typeof regionalReq.fallbackQuery, "string");
});

test("regional roadRequest shrinks endpoint boxes to 0.02, drops tertiary/moto-path, and builds lighter fallbackQuery", () => {
  const vvt = [10.7764, 106.6903];
  const ninhHoa = [12.5063776, 109.146128];
  const req = roadRequest(vvt, ninhHoa);
  const rev = roadRequest(ninhHoa, vvt);

  for (const [s, w, n, e] of req.endpointBoxes) {
    assert.ok(Math.abs(n - s - 0.04) < 1e-9);
    assert.ok(Math.abs(e - w - 0.04) < 1e-9);
  }
  assert.equal(req.query.includes('highway~"^tertiary(_link)?$"'), false);
  assert.equal(req.query.includes('highway="path"'), false);

  assert.equal(req.fallbackQuery, rev.fallbackQuery);
  assert.ok(req.fallbackQuery.includes("[timeout:25]"));
  assert.ok(
    req.fallbackQuery.includes('highway~"^(motorway|trunk)(_link)?$"'),
  );
  assert.equal(
    req.fallbackQuery.includes(
      'highway~"^(motorway|trunk|primary|secondary)(_link)?$"',
    ),
    false,
  );
  const expectedBox = `${(vvt[0] - 0.015).toFixed(5)},${(vvt[1] - 0.015).toFixed(5)},${(vvt[0] + 0.015).toFixed(5)},${(vvt[1] + 0.015).toFixed(5)}`;
  assert.ok(req.fallbackQuery.includes(expectedBox));
});

test("parseRetryAfterMs parses seconds and HTTP dates capped at 10000ms", () => {
  const now = Date.UTC(2026, 10, 20, 3, 0, 0);
  assert.equal(parseRetryAfterMs("4", now), 4000);
  assert.equal(parseRetryAfterMs("120", now), 10000);
  assert.equal(
    parseRetryAfterMs(new Date(now + 4000).toUTCString(), now),
    4000,
  );
  assert.equal(
    parseRetryAfterMs(new Date(now + 60000).toUTCString(), now),
    10000,
  );
  assert.equal(
    parseRetryAfterMs(new Date(now - 1000).toUTCString(), now),
    0,
  );
  assert.equal(parseRetryAfterMs("not-a-date", now), 0);
  assert.equal(parseRetryAfterMs(null, now), 0);
});

test("429 + Retry-After cools down mirror, prioritizes healthy mirrors while keeping cooled mirror as fallback, and resetMirrorHealth restores order", async () => {
  resetMirrorHealth();
  try {
    const a = [10.7764, 106.6903];
    const b = [10.7618, 106.6922];

    const firstCalls = [];
    const res1 = await loadRoads(a, b, {
      cacheStorage: makeMockCacheStorage(),
      mirrors: OVERPASS_MIRRORS,
      backoffMs: 0,
      fetchImpl: async (url) => {
        firstCalls.push(url);
        if (url === OVERPASS_MIRRORS[0]) {
          return new Response("Rate limited", {
            status: 429,
            headers: { "Retry-After": "4" },
          });
        }
        return new Response(JSON.stringify(SAMPLE_VALID_OSM), { status: 200 });
      },
    });
    assert.equal(res1.mirror, OVERPASS_MIRRORS[1]);
    assert.deepEqual(firstCalls, [OVERPASS_MIRRORS[0], OVERPASS_MIRRORS[1]]);

    // Healthy mirror [1] is tried first, skipping cooled [0]
    const secondCalls = [];
    const res2 = await loadRoads(a, b, {
      cacheStorage: makeMockCacheStorage(),
      mirrors: OVERPASS_MIRRORS,
      backoffMs: 0,
      fetchImpl: async (url) => {
        secondCalls.push(url);
        return new Response(JSON.stringify(SAMPLE_VALID_OSM), { status: 200 });
      },
    });
    assert.equal(res2.mirror, OVERPASS_MIRRORS[1]);
    assert.deepEqual(secondCalls, [OVERPASS_MIRRORS[1]]);

    // When all healthy mirrors fail with 503/504, cooled [0] is tried LAST as fallback (not skipped forever)
    const fallbackCalls = [];
    const res3 = await loadRoads(a, b, {
      cacheStorage: makeMockCacheStorage(),
      mirrors: OVERPASS_MIRRORS,
      backoffMs: 0,
      fetchImpl: async (url) => {
        fallbackCalls.push(url);
        if (url === OVERPASS_MIRRORS[0]) {
          return new Response(JSON.stringify(SAMPLE_VALID_OSM), { status: 200 });
        }
        return new Response("Unavailable", {
          status: 503,
          headers: { "Retry-After": "2" },
        });
      },
    });
    assert.equal(res3.mirror, OVERPASS_MIRRORS[0]);
    assert.deepEqual(fallbackCalls, [
      OVERPASS_MIRRORS[1],
      OVERPASS_MIRRORS[2],
      OVERPASS_MIRRORS[3],
      OVERPASS_MIRRORS[0],
    ]);

    // After resetMirrorHealth, [0] is tried first again
    resetMirrorHealth();
    const afterResetCalls = [];
    await loadRoads(a, b, {
      cacheStorage: makeMockCacheStorage(),
      mirrors: OVERPASS_MIRRORS,
      backoffMs: 0,
      fetchImpl: async (url) => {
        afterResetCalls.push(url);
        return new Response(JSON.stringify(SAMPLE_VALID_OSM), { status: 200 });
      },
    });
    assert.deepEqual(afterResetCalls, [OVERPASS_MIRRORS[0]]);
  } finally {
    resetMirrorHealth();
  }
});

test("loadRoads attaches cause, attempts, and detail diagnostics when all mirrors fail", async () => {
  const customMirrors = [
    "https://m1.example/api/interpreter",
    "https://m2.example/api/interpreter",
    "https://m3.example/api/interpreter",
    "https://m4.example/api/interpreter",
    "https://m5.example/api/interpreter",
    "https://m6.example/api/interpreter",
    "https://m7.example/api/interpreter",
  ];
  let idx = 0;

  let caught = null;
  try {
    await loadRoads([10.7764, 106.6903], [10.7618, 106.6922], {
      cacheStorage: makeMockCacheStorage(),
      mirrors: customMirrors,
      backoffMs: 0,
      fetchImpl: async () => {
        const step = idx++;
        if (step === 0) return new Response("Too many", { status: 429 });
        if (step === 1) return new Response("Gateway timeout", { status: 504 });
        if (step === 2) {
          const err = new Error("Timed out");
          err.name = "TimeoutError";
          throw err;
        }
        if (step === 3) throw new TypeError("Failed to fetch");
        if (step === 4) return new Response("<html>error</html>", { status: 200 });
        if (step === 5) {
          return new Response(
            JSON.stringify({ remark: "runtime error", elements: [] }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ elements: [] }), { status: 200 });
      },
    });
  } catch (err) {
    caught = err;
  }

  assert.ok(caught instanceof Error);
  assert.ok(caught.cause instanceof Error);
  assert.match(caught.cause.message, /Incomplete road payload/);
  assert.deepEqual(caught.attempts, [
    { mirror: customMirrors[0], host: "m1.example", reason: "HTTP 429" },
    { mirror: customMirrors[1], host: "m2.example", reason: "HTTP 504" },
    { mirror: customMirrors[2], host: "m3.example", reason: "timeout" },
    { mirror: customMirrors[3], host: "m4.example", reason: "network/CORS" },
    { mirror: customMirrors[4], host: "m5.example", reason: "invalid JSON" },
    { mirror: customMirrors[5], host: "m6.example", reason: "remark" },
    { mirror: customMirrors[6], host: "m7.example", reason: "incomplete payload" },
  ]);
  assert.equal(
    caught.detail,
    "m1.example: HTTP 429; m2.example: HTTP 504; m3.example: timeout; m4.example: network/CORS; m5.example: invalid JSON; m6.example: remark; m7.example: incomplete payload",
  );
});

test("loadRoads uses regional fallbackQuery automatically when primary regional query fails across mirrors", async () => {
  const vvt = [10.7764, 106.6903];
  const ninhHoa = [12.5063776, 109.146128];
  const req = roadRequest(vvt, ninhHoa);
  const mirrors = ["https://r1.example/api", "https://r2.example/api"];
  const sentQueries = [];

  const res = await loadRoads(vvt, ninhHoa, {
    cacheStorage: makeMockCacheStorage(),
    mirrors,
    backoffMs: 0,
    fetchImpl: async (_url, { body }) => {
      const q = new URLSearchParams(body).get("data");
      sentQueries.push(q);
      if (q === req.query) {
        return new Response("Gateway timeout", { status: 504 });
      }
      if (q === req.fallbackQuery) {
        return new Response(JSON.stringify(SAMPLE_VALID_OSM), { status: 200 });
      }
      throw new Error("Unexpected query");
    },
  });

  assert.equal(res.source, "network");
  assert.equal(res.usedFallback, true);
  assert.equal(res.mirror, mirrors[0]);
  assert.deepEqual(sentQueries, [req.query, req.query, req.fallbackQuery]);
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
