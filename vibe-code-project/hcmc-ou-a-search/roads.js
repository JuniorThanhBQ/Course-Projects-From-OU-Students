import { distance } from "./routing.js";

export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export const CACHE_NAME = "ou-road-data-v4";
const CACHE_TTL_MS = 7 * 86400000;

const LOCAL_FILTER =
  '[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"]';
const METRO_ARTERIAL_FILTER =
  '[highway~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"]';
const REGIONAL_ARTERIAL_FILTER =
  '[highway~"^(motorway|trunk|primary|secondary)(_link)?$"]';
const TERTIARY_FILTER = '[highway~"^tertiary(_link)?$"]';
const MOTO_PATH_FILTER =
  '[highway="path"][motorcycle~"^(yes|designated|permissive)$"]';

const METRO_SEGMENTS = [
  [0, 0.4],
  [0.3, 0.7],
  [0.6, 1],
];

const REGIONAL_SEGMENTS = [
  [0, 0.25],
  [0.2, 0.45],
  [0.375, 0.625],
  [0.55, 0.8],
  [0.75, 1],
];

function fmtBox(box) {
  return box.map((n) => n.toFixed(5)).join(",");
}

function makeBox(p0, p1, pad) {
  return [
    Math.min(p0[0], p1[0]) - pad,
    Math.min(p0[1], p1[1]) - pad,
    Math.max(p0[0], p1[0]) + pad,
    Math.max(p0[1], p1[1]) + pad,
  ];
}

function endpointBox(p, pad) {
  return [p[0] - pad, p[1] - pad, p[0] + pad, p[1] + pad];
}

function chainedBoxes(p0, p1, segments, pad) {
  const dLat = p1[0] - p0[0];
  const dLon = p1[1] - p0[1];
  return segments.map(([t0, t1]) => {
    const a = [p0[0] + dLat * t0, p0[1] + dLon * t0];
    const b = [p0[0] + dLat * t1, p0[1] + dLon * t1];
    return makeBox(a, b, pad);
  });
}

export function roadRequest(a, b) {
  const points = [a, b].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const dist = distance(a, b);
  let tier;
  let regional;
  let boxes;
  let endpointBoxes;
  const statements = [];

  if (dist <= 15000) {
    tier = "local";
    regional = false;
    const pad = Math.min(0.025, Math.max(0.015, (dist / 111000) * 0.28));
    const box = makeBox(points[0], points[1], pad);
    boxes = [box];
    endpointBoxes = [];
    const f = fmtBox(box);
    statements.push(`way${LOCAL_FILTER}(${f});`);
    statements.push(`way${MOTO_PATH_FILTER}(${f});`);
  } else if (dist <= 100000) {
    tier = "metro";
    regional = true;
    boxes = chainedBoxes(points[0], points[1], METRO_SEGMENTS, 0.08);
    endpointBoxes = points.map((p) => endpointBox(p, 0.035));
    for (const box of boxes) {
      statements.push(`way${METRO_ARTERIAL_FILTER}(${fmtBox(box)});`);
    }
    for (const ebox of endpointBoxes) {
      const f = fmtBox(ebox);
      statements.push(`way${LOCAL_FILTER}(${f});`);
      statements.push(`way${MOTO_PATH_FILTER}(${f});`);
    }
  } else {
    tier = "regional";
    regional = true;
    boxes = chainedBoxes(points[0], points[1], REGIONAL_SEGMENTS, 0.55);
    endpointBoxes = points.map((p) => endpointBox(p, 0.035));
    const arterialEndBoxes = points.map((p) => endpointBox(p, 0.1));
    for (const box of boxes) {
      statements.push(`way${REGIONAL_ARTERIAL_FILTER}(${fmtBox(box)});`);
    }
    for (const abox of arterialEndBoxes) {
      statements.push(`way${TERTIARY_FILTER}(${fmtBox(abox)});`);
    }
    for (const ebox of endpointBoxes) {
      const f = fmtBox(ebox);
      statements.push(`way${LOCAL_FILTER}(${f});`);
      statements.push(`way${MOTO_PATH_FILTER}(${f});`);
    }
  }

  const key = `roads-v4-${tier}-${points
    .flat()
    .map((n) => n.toFixed(5))
    .join("-")}`;

  return {
    key,
    tier,
    regional,
    boxes,
    endpointBoxes,
    query: `[out:json][timeout:45];(${statements.join("")});out body qt;>;out skel qt;`,
  };
}

export function validRoads(data) {
  if (!data || data.remark || !Array.isArray(data.elements)) return false;
  let validWays = 0;
  let validNodes = 0;
  for (const e of data.elements) {
    if (
      e?.type === "way" &&
      Array.isArray(e.nodes) &&
      e.nodes.length >= 2
    ) {
      validWays++;
    } else if (
      e?.type === "node" &&
      Number.isFinite(e.lat) &&
      Number.isFinite(e.lon)
    ) {
      validNodes++;
    }
    if (validWays >= 1 && validNodes >= 2) return true;
  }
  return false;
}

const prunedStorages = new WeakSet();

export async function pruneOldCaches(cacheStorage = globalThis.caches) {
  if (!cacheStorage || typeof cacheStorage.keys !== "function") return;
  try {
    const keys = await cacheStorage.keys();
    for (const key of keys) {
      if (key.startsWith("ou-road-data-") && key !== CACHE_NAME) {
        await cacheStorage.delete(key);
      }
    }
  } catch {}
}

function createAbortError() {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function combineSignals(userSignal, timeoutMs) {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new Error("Request timed out"));
  }, timeoutMs);

  if (!userSignal) {
    return {
      signal: timeoutController.signal,
      cleanup: () => clearTimeout(timer),
    };
  }

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return {
      signal: AbortSignal.any([userSignal, timeoutController.signal]),
      cleanup: () => clearTimeout(timer),
    };
  }

  const combined = new AbortController();
  const forwardUser = () =>
    combined.abort(userSignal.reason ?? createAbortError());
  const forwardTimeout = () =>
    combined.abort(timeoutController.signal.reason ?? new Error("Request timed out"));

  if (userSignal.aborted) {
    clearTimeout(timer);
    combined.abort(userSignal.reason ?? createAbortError());
    return { signal: combined.signal, cleanup: () => {} };
  }

  userSignal.addEventListener("abort", forwardUser, { once: true });
  timeoutController.signal.addEventListener("abort", forwardTimeout, { once: true });

  return {
    signal: combined.signal,
    cleanup: () => {
      clearTimeout(timer);
      userSignal.removeEventListener("abort", forwardUser);
      timeoutController.signal.removeEventListener("abort", forwardTimeout);
    },
  };
}

function sleepWithSignal(ms, signal) {
  if (ms <= 0) {
    return signal?.aborted
      ? Promise.reject(createAbortError())
      : Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function raceWithSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener("abort", onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

const pending = new Map();

export async function loadRoads(a, b, notifyOrOptions = {}) {
  const options =
    typeof notifyOrOptions === "function"
      ? { notify: notifyOrOptions }
      : notifyOrOptions || {};

  const {
    notify = () => {},
    signal,
    fetchImpl = globalThis.fetch,
    mirrors = OVERPASS_MIRRORS,
    cacheStorage = globalThis.caches,
    backoffMs = 500,
  } = options;

  if (signal?.aborted) throw createAbortError();

  const request = roadRequest(a, b);
  const useDefaultDeps =
    fetchImpl === globalThis.fetch &&
    mirrors === OVERPASS_MIRRORS &&
    cacheStorage === globalThis.caches;

  if (cacheStorage && !prunedStorages.has(cacheStorage)) {
    prunedStorages.add(cacheStorage);
    await pruneOldCaches(cacheStorage);
  }

  if (useDefaultDeps && pending.has(request.key)) {
    const entry = pending.get(request.key);
    entry.subscribers++;
    const onCallerAbort = () => {
      entry.subscribers--;
      if (entry.subscribers <= 0) {
        entry.controller.abort(createAbortError());
        pending.delete(request.key);
      }
    };
    signal?.addEventListener("abort", onCallerAbort, { once: true });
    try {
      return await raceWithSignal(entry.promise, signal);
    } finally {
      signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  const internalController = new AbortController();
  const effectiveSignal = useDefaultDeps ? internalController.signal : signal;

  const task = (async () => {
    const cacheURL = new URL(`./road-cache/${request.key}`, import.meta.url).href;
    let cache = null;

    if (cacheStorage && typeof cacheStorage.open === "function") {
      try {
        cache = await cacheStorage.open(CACHE_NAME);
        const hit = await cache.match(cacheURL);
        if (
          hit &&
          Date.now() - Number(hit.headers.get("x-saved-at")) < CACHE_TTL_MS
        ) {
          const data = await hit.json();
          if (validRoads(data)) {
            notify("Using saved road data…");
            return { data, ...request, source: "cache" };
          }
        }
      } catch {}
    }

    if (effectiveSignal?.aborted) throw createAbortError();

    const timeoutMs = request.regional ? 45000 : 30000;
    let lastError = null;

    for (let i = 0; i < mirrors.length; i++) {
      if (effectiveSignal?.aborted) throw createAbortError();

      const mirror = mirrors[i];
      if (i === 0) {
        notify(
          request.tier === "regional"
            ? "Loading regional highways and campus access streets…"
            : request.tier === "metro"
              ? "Loading metro arterials and campus access streets…"
              : "Loading streets near the selected campuses…",
        );
      } else {
        await sleepWithSignal(backoffMs, effectiveSignal);
        notify(
          `Primary road server busy — trying backup map server (${i + 1} of ${mirrors.length})…`,
        );
      }

      const { signal: combinedSignal, cleanup } = combineSignals(
        effectiveSignal,
        timeoutMs,
      );
      try {
        const response = await fetchImpl(mirror, {
          method: "POST",
          body: new URLSearchParams({ data: request.query }),
          signal: combinedSignal,
        });

        const text = await response.text();
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status} from ${mirror}`);
          continue;
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          lastError = new Error(`Invalid JSON from ${mirror}`, {
            cause: parseErr,
          });
          continue;
        }

        if (!validRoads(data)) {
          lastError = new Error(
            data?.remark
              ? `Overpass remark from ${mirror}: ${data.remark}`
              : `Incomplete road payload from ${mirror}`,
          );
          continue;
        }

        if (cache) {
          try {
            await cache.put(
              cacheURL,
              new Response(JSON.stringify(data), {
                headers: {
                  "content-type": "application/json",
                  "x-saved-at": String(Date.now()),
                },
              }),
            );
          } catch {}
        }

        return { data, ...request, source: "network", mirror };
      } catch (err) {
        if (effectiveSignal?.aborted) throw createAbortError();
        lastError = err;
      } finally {
        cleanup();
      }
    }

    if (effectiveSignal?.aborted) throw createAbortError();

    throw new Error(
      "Live OpenStreetMap road servers are temporarily unavailable or busy. Wait a moment and retry, or try a closer campus pair.",
      { cause: lastError },
    );
  })();

  if (!useDefaultDeps) {
    return await task;
  }

  const entry = {
    controller: internalController,
    subscribers: 1,
    promise: task,
  };
  pending.set(request.key, entry);
  const clearPending = () => {
    if (pending.get(request.key) === entry) pending.delete(request.key);
  };
  task.then(clearPending, clearPending);

  const onOwnerAbort = () => {
    entry.subscribers--;
    if (entry.subscribers <= 0) {
      entry.controller.abort(createAbortError());
      pending.delete(request.key);
    }
  };
  signal?.addEventListener("abort", onOwnerAbort, { once: true });

  try {
    return await raceWithSignal(task, signal);
  } finally {
    signal?.removeEventListener("abort", onOwnerAbort);
  }
}
