import { distance } from "./routing.js";

export const OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export const CACHE_NAME = "ou-road-data-v4";
const CACHE_TTL_MS = 7 * 86400000;
const MAX_RETRY_AFTER_MS = 10000;
const MIN_COOLDOWN_MS = 60000;

const LOCAL_FILTER =
  '[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"]';
const METRO_ARTERIAL_FILTER =
  '[highway~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"]';
const REGIONAL_ARTERIAL_FILTER =
  '[highway~"^(motorway|trunk)(_link)?$"]';
const REGIONAL_CONNECTOR_FILTER =
  '[highway~"^(primary|secondary)(_link)?$"]';
const REGIONAL_LOCAL_FILTER =
  '[highway~"^(tertiary|unclassified|residential)(_link)?$"]';
const FALLBACK_ARTERIAL_FILTER =
  '[highway~"^(motorway|trunk)(_link)?$"]';
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
  let serverTimeoutSec;
  let clientTimeoutMs;
  let boxes;
  let endpointBoxes;
  let fallbackQuery = null;
  const statements = [];

  if (dist <= 15000) {
    tier = "local";
    regional = false;
    serverTimeoutSec = 25;
    clientTimeoutMs = 35000;
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
    serverTimeoutSec = 25;
    clientTimeoutMs = 35000;
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
    serverTimeoutSec = 35;
    clientTimeoutMs = 45000;
    boxes = chainedBoxes(points[0], points[1], REGIONAL_SEGMENTS, 0.55);
    endpointBoxes = points.map((p) => endpointBox(p, 0.02));
    for (const box of boxes) {
      statements.push(`way${REGIONAL_ARTERIAL_FILTER}(${fmtBox(box)});`);
    }
    for (const ebox of endpointBoxes) {
      statements.push(`way${REGIONAL_CONNECTOR_FILTER}(${fmtBox(ebox)});`);
    }
    for (const p of points) {
      statements.push(
        `way${REGIONAL_LOCAL_FILTER}(${fmtBox(endpointBox(p, 0.008))});`,
      );
    }

    const fallbackStatements = [];
    for (const box of boxes) {
      fallbackStatements.push(`way${FALLBACK_ARTERIAL_FILTER}(${fmtBox(box)});`);
    }
    for (const p of points) {
      fallbackStatements.push(
        `way${REGIONAL_CONNECTOR_FILTER}(${fmtBox(endpointBox(p, 0.015))});`,
      );
      fallbackStatements.push(
        `way${REGIONAL_LOCAL_FILTER}(${fmtBox(endpointBox(p, 0.006))});`,
      );
    }
    fallbackQuery = `[out:json][timeout:25];(${fallbackStatements.join("")});out body qt;>;out skel qt;`;
  }

  const key = `roads-v4-${tier}-${points
    .flat()
    .map((n) => n.toFixed(5))
    .join("-")}`;

  return {
    key,
    tier,
    regional,
    serverTimeoutSec,
    clientTimeoutMs,
    boxes,
    endpointBoxes,
    query: `[out:json][timeout:${serverTimeoutSec}];(${statements.join("")});out body qt;>;out skel qt;`,
    fallbackQuery,
  };
}

export function validRoads(data) {
  if (!data || !Array.isArray(data.elements)) return false;
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
  const timedOut = () => timeoutController.signal.aborted;

  if (!userSignal) {
    return {
      signal: timeoutController.signal,
      cleanup: () => clearTimeout(timer),
      timedOut,
    };
  }

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return {
      signal: AbortSignal.any([userSignal, timeoutController.signal]),
      cleanup: () => clearTimeout(timer),
      timedOut,
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
    return { signal: combined.signal, cleanup: () => {}, timedOut };
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
    timedOut,
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
const mirrorCooldowns = new Map();

/** Clears recorded mirror cooldown state (primarily for tests). */
export function resetMirrorHealth() {
  mirrorCooldowns.clear();
}

/** Parses a Retry-After header (seconds or HTTP date), capped at 10000ms. */
export function parseRetryAfterMs(value, now = Date.now()) {
  if (!value || typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.min(MAX_RETRY_AFTER_MS, Math.round(seconds * 1000));
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isFinite(dateMs)) return 0;
  const delta = dateMs - now;
  return delta > 0 ? Math.min(MAX_RETRY_AFTER_MS, delta) : 0;
}

function getMirrorHost(mirror) {
  try {
    return new URL(mirror).host || String(mirror);
  } catch {
    return String(mirror);
  }
}

function orderMirrors(mirrors, now = Date.now()) {
  const ready = [];
  const cooled = [];
  for (let idx = 0; idx < mirrors.length; idx++) {
    const mirror = mirrors[idx];
    const until = mirrorCooldowns.get(mirror) ?? 0;
    if (until > now) {
      cooled.push({ mirror, until, idx });
    } else {
      if (until > 0) mirrorCooldowns.delete(mirror);
      ready.push(mirror);
    }
  }
  cooled.sort((x, y) => x.until - y.until || x.idx - y.idx);
  return [...ready, ...cooled.map((entry) => entry.mirror)];
}

function markMirrorCooldown(mirror, cooldownMs, now = Date.now()) {
  const until = now + cooldownMs;
  const prev = mirrorCooldowns.get(mirror) ?? 0;
  if (until > prev) {
    mirrorCooldowns.set(mirror, until);
  }
}

function tierStatusMessage(tier) {
  if (tier === "regional") {
    return "Loading regional highways and campus access streets…";
  }
  if (tier === "metro") {
    return "Loading metro arterials and campus access streets…";
  }
  return "Loading streets near the selected campuses…";
}

function readRetryAfterHeader(response) {
  return (
    response.headers?.get?.("retry-after") ??
    response.headers?.get?.("Retry-After") ??
    null
  );
}

async function queryMirrors({
  query,
  timeoutMs,
  mirrors,
  useMirrorHealth,
  tier,
  isFallback,
  fetchImpl,
  backoffMs,
  effectiveSignal,
  notify,
  attempts,
}) {
  const ordered = useMirrorHealth ? orderMirrors(mirrors) : [...mirrors];
  let lastError = null;
  let retryDelayMs = 0;

  for (let i = 0; i < ordered.length; i++) {
    if (effectiveSignal?.aborted) throw createAbortError();

    const mirror = ordered[i];
    const host = getMirrorHost(mirror);

    if (i === 0 && !isFallback) {
      notify(tierStatusMessage(tier));
    } else {
      const waitMs = backoffMs > 0 ? Math.max(backoffMs, retryDelayMs) : 0;
      retryDelayMs = 0;
      await sleepWithSignal(waitMs, effectiveSignal);
      notify(
        i === 0 && isFallback
          ? "Full regional road query unavailable — trying lighter arterial fallback…"
          : `Primary road server busy — trying backup map server (${i + 1} of ${ordered.length})…`,
      );
    }

    const { signal: combinedSignal, cleanup, timedOut } = combineSignals(
      effectiveSignal,
      timeoutMs,
    );
    try {
      const response = await fetchImpl(mirror, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        signal: combinedSignal,
      });

      const text = await response.text();
      if (!response.ok) {
        const reason = `HTTP ${response.status}`;
        attempts.push({ mirror, host, reason });
        lastError = new Error(`${reason} from ${mirror}`);

        const retryAfterMs =
          response.status === 429 || response.status === 503
            ? parseRetryAfterMs(readRetryAfterHeader(response))
            : 0;
        if (retryAfterMs > 0) {
          retryDelayMs = Math.max(retryDelayMs, retryAfterMs);
        }
        if (
          useMirrorHealth &&
          (response.status === 429 || response.status >= 500)
        ) {
          markMirrorCooldown(mirror, Math.max(retryAfterMs, MIN_COOLDOWN_MS));
        }
        continue;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        attempts.push({ mirror, host, reason: "invalid JSON" });
        lastError = new Error(`Invalid JSON from ${mirror}`, {
          cause: parseErr,
        });
        continue;
      }

      if (!validRoads(data)) {
        const hasRemark = Boolean(data?.remark);
        attempts.push({
          mirror,
          host,
          reason: hasRemark ? "remark" : "incomplete payload",
        });
        lastError = new Error(
          hasRemark
            ? `Overpass remark from ${mirror}: ${data.remark}`
            : `Incomplete road payload from ${mirror}`,
        );
        continue;
      }

      if (useMirrorHealth) mirrorCooldowns.delete(mirror);
      return { result: { data, mirror }, lastError };
    } catch (err) {
      if (effectiveSignal?.aborted) throw createAbortError();
      const isTimeout =
        timedOut() ||
        err?.name === "TimeoutError" ||
        (err?.name === "AbortError" && !effectiveSignal?.aborted) ||
        /timed?\s*out/i.test(err?.message || "");
      attempts.push({
        mirror,
        host,
        reason: isTimeout ? "timeout" : "network/CORS",
      });
      if (useMirrorHealth) {
        markMirrorCooldown(mirror, MIN_COOLDOWN_MS);
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      cleanup();
    }
  }

  return { result: null, lastError };
}

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
  const useMirrorHealth = mirrors === OVERPASS_MIRRORS;
  const useDefaultDeps =
    fetchImpl === globalThis.fetch &&
    useMirrorHealth &&
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

    const attempts = [];
    const primary = await queryMirrors({
      query: request.query,
      timeoutMs: request.clientTimeoutMs,
      mirrors,
      useMirrorHealth,
      tier: request.tier,
      isFallback: false,
      fetchImpl,
      backoffMs,
      effectiveSignal,
      notify,
      attempts,
    });

    let winner = primary.result;
    let lastError = primary.lastError;
    let usedFallback = false;

    if (!winner && request.fallbackQuery) {
      if (effectiveSignal?.aborted) throw createAbortError();
      const fallback = await queryMirrors({
        query: request.fallbackQuery,
        timeoutMs: 35000,
        mirrors,
        useMirrorHealth,
        tier: request.tier,
        isFallback: true,
        fetchImpl,
        backoffMs,
        effectiveSignal,
        notify,
        attempts,
      });
      winner = fallback.result;
      if (fallback.lastError) lastError = fallback.lastError;
      if (winner) usedFallback = true;
    }

    if (effectiveSignal?.aborted) throw createAbortError();

    if (winner) {
      if (cache) {
        try {
          await cache.put(
            cacheURL,
            new Response(JSON.stringify(winner.data), {
              headers: {
                "content-type": "application/json",
                "x-saved-at": String(Date.now()),
              },
            }),
          );
        } catch {}
      }

      return {
        data: winner.data,
        ...request,
        source: "network",
        mirror: winner.mirror,
        ...(usedFallback ? { usedFallback: true } : {}),
      };
    }

    const err = new Error(
      "Live OpenStreetMap road servers are temporarily unavailable or busy. Wait a moment and retry, or try a closer campus pair.",
      { cause: lastError },
    );
    err.attempts = attempts;
    err.detail = attempts.map((a) => `${a.host}: ${a.reason}`).join("; ");
    throw err;
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
