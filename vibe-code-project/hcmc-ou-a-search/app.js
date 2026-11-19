import { CAMPUSES } from "./campuses.js";
import { createExplorationLayer } from "./canvas-layer.js";
import { query, unpackEdge } from "./hierarchy.js";
import { loadRoads } from "./roads.js";
import { graphFromOSM, nearest, packGraph } from "./routing.js";

const LEAFLET_FALLBACK_CSS =
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_FALLBACK_CSS_SRI =
  "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
const LEAFLET_FALLBACK_JS =
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_FALLBACK_JS_SRI =
  "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";

const $ = (id) => document.getElementById(id);

const startEl = $("start");
const endEl = $("end");
const swapBtn = $("swap");
const beginBtn = $("begin");
const beginLabel = $("begin-label");
const stopBtn = $("stop");
const resetBtn = $("reset");
const retryBtn = $("retry");
const fitAllBtn = $("fit-all");
const themeToggleBtn = $("theme-toggle");
const controlsForm = $("controls");
const statusBox = $("status-box");
const statusText = $("status-text");
const srStatus = $("sr-status");
const progressTrack = $("progress-track");
const progressBar = $("progress-bar");
const resultSection = $("result");
const resultPair = $("result-pair");
const resultDistance = $("result-distance");
const resultDuration = $("result-duration");
const resultExplored = $("result-explored");
const resultNote = $("result-note");
const modeRadios = [...document.querySelectorAll('input[name="mode"]')];
const speedRadios = [...document.querySelectorAll('input[name="speed"]')];

const DEFAULT_START_IDX = 0; // 97 Võ Văn Tần
const DEFAULT_END_IDX = 1; // 35–37 Hồ Hảo Hớn
const HCMC_CENTER = [10.745, 106.682];
const HCMC_ZOOM = 12;

// Bounded LRU caches (max 4 entries)
// parsedGraphs stores ONLY { graph, graphView } — never neutered Transferables!
const MAX_CACHE_ENTRIES = 4;
const parsedGraphs = new Map();
const hierarchies = new Map();

function lruGet(cache, key) {
  if (!cache.has(key)) return undefined;
  const val = cache.get(key);
  cache.delete(key);
  cache.set(key, val);
  return val;
}

function lruSet(cache, key, val) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, val);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

let map = null;
let explorationLayer = null;
let routeLayer = null;
let campusMarkers = [];
let busy = false;
let activeAbortController = null;
let activeWorker = null;
let activeRafId = 0;
let finishPlaybackNow = null;
let lastRoutePolylines = null;
let activeRunId = 0;

function getSelectedMode() {
  return modeRadios.find((r) => r.checked)?.value || "motorbike";
}

function getSelectedSpeed() {
  return speedRadios.find((r) => r.checked)?.value || "normal";
}

function setSelectedSpeed(value) {
  for (const r of speedRadios) {
    r.checked = r.value === value;
  }
}

function getThemePalette() {
  const styles = getComputedStyle(document.documentElement);
  const read = (prop, fallback) => styles.getPropertyValue(prop).trim() || fallback;
  return {
    forward: read("--series-forward", "#c24914"),
    backward: read("--series-backward", "#1958a3"),
    meet: read("--series-meet", "#7a228c"),
    route: read("--series-route", "#0e5a4b"),
    casing: read("--route-casing", "#ffffff"),
  };
}

function announceMilestone(message) {
  srStatus.textContent = "";
  requestAnimationFrame(() => {
    srStatus.textContent = message;
  });
}

function setStatus(state, message, { announce = false, showRetry = false } = {}) {
  statusBox.dataset.state = state;
  statusText.textContent = message;
  retryBtn.hidden = !showRetry;
  if (announce) announceMilestone(message);
}

function setProgress(pct) {
  if (pct == null) {
    progressTrack.hidden = true;
    progressTrack.setAttribute("aria-valuenow", "0");
    progressBar.style.width = "0%";
    return;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  progressTrack.hidden = false;
  progressTrack.setAttribute("aria-valuenow", String(clamped));
  progressBar.style.width = `${clamped}%`;
}

function setTheme(theme, persist = false) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  const isDark = resolved === "dark";
  themeToggleBtn.setAttribute("aria-pressed", String(isDark));
  themeToggleBtn.setAttribute(
    "aria-label",
    isDark ? "Switch to light theme" : "Switch to dark theme",
  );
  if (persist) {
    try {
      localStorage.setItem("ou-theme", resolved);
    } catch {}
  }
  if (explorationLayer) explorationLayer.redraw();
  restyleActiveRoute();
}

function restyleActiveRoute() {
  if (!lastRoutePolylines) return;
  const palette = getThemePalette();
  if (lastRoutePolylines.casing) {
    lastRoutePolylines.casing.setStyle({ color: palette.casing });
  }
  if (lastRoutePolylines.stroke) {
    lastRoutePolylines.stroke.setStyle({ color: palette.route });
  }
  if (lastRoutePolylines.sameRing) {
    lastRoutePolylines.sameRing.setStyle({
      color: palette.route,
      fillColor: palette.casing,
    });
  }
}

function populateSelectors() {
  const groups = [
    { id: "hcmc", label: "Ho Chi Minh City (6)" },
    { id: "regional", label: "Regional — longer load (2)" },
  ];
  for (const select of [startEl, endEl]) {
    select.replaceChildren();
    for (const grp of groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = grp.label;
      for (let i = 0; i < CAMPUSES.length; i++) {
        const campus = CAMPUSES[i];
        if (campus.group !== grp.id) continue;
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = `${campus.name} — ${campus.area}`;
        optgroup.appendChild(opt);
      }
      select.appendChild(optgroup);
    }
  }
  startEl.value = String(DEFAULT_START_IDX);
  endEl.value = String(DEFAULT_END_IDX);
}

function syncControls() {
  for (const o of startEl.options) o.disabled = o.value === endEl.value;
  for (const o of endEl.options) o.disabled = o.value === startEl.value;

  const mapReady = Boolean(map);
  const sameSelection = startEl.value === endEl.value;

  startEl.disabled = busy || !mapReady;
  endEl.disabled = busy || !mapReady;
  swapBtn.disabled = busy || !mapReady;
  for (const r of modeRadios) r.disabled = busy || !mapReady;

  beginBtn.disabled = busy || sameSelection || !mapReady;
  beginBtn.setAttribute("aria-busy", String(busy));
  beginBtn.hidden = busy;
  stopBtn.hidden = !busy;
  stopBtn.disabled = !busy;
  resetBtn.disabled = !mapReady;
  fitAllBtn.disabled = !mapReady;

  refreshMarkers();
}

function makePinIcon(role) {
  if (!window.L) return null;
  if (role === "start") {
    return window.L.divIcon({
      className: "campus-pin-wrap",
      html: '<span class="campus-pin campus-pin--start">A</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }
  if (role === "end") {
    return window.L.divIcon({
      className: "campus-pin-wrap",
      html: '<span class="campus-pin campus-pin--end">B</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }
  return window.L.divIcon({
    className: "campus-pin-wrap",
    html: '<span class="campus-pin campus-pin--idle"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function buildPopupContent(campus, index) {
  const card = document.createElement("div");
  card.className = "popup-card";

  const title = document.createElement("p");
  title.className = "popup-title";
  title.textContent = campus.name;
  card.appendChild(title);

  const area = document.createElement("p");
  area.className = "popup-area";
  area.textContent = campus.area;
  card.appendChild(area);

  const badge = document.createElement("span");
  badge.className =
    campus.pinStatus === "verified"
      ? "popup-badge popup-badge--verified"
      : "popup-badge popup-badge--approx";
  badge.textContent =
    campus.pinStatus === "verified" ? "Verified pin" : "Approximate pin";
  card.appendChild(badge);

  const actions = document.createElement("div");
  actions.className = "popup-actions";

  const btnStart = document.createElement("button");
  btnStart.type = "button";
  btnStart.className = "popup-btn";
  btnStart.textContent = "Set as start";
  btnStart.addEventListener("click", () => {
    if (busy) return;
    if (Number(endEl.value) === index) {
      endEl.value = startEl.value;
    }
    startEl.value = String(index);
    syncControls();
    map?.closePopup();
  });

  const btnEnd = document.createElement("button");
  btnEnd.type = "button";
  btnEnd.className = "popup-btn";
  btnEnd.textContent = "Set as destination";
  btnEnd.addEventListener("click", () => {
    if (busy) return;
    if (Number(startEl.value) === index) {
      startEl.value = endEl.value;
    }
    endEl.value = String(index);
    syncControls();
    map?.closePopup();
  });

  actions.append(btnStart, btnEnd);
  card.appendChild(actions);
  return card;
}

function refreshMarkers() {
  if (!campusMarkers.length) return;
  const sIdx = Number(startEl.value);
  const eIdx = Number(endEl.value);
  for (let i = 0; i < campusMarkers.length; i++) {
    const role = i === sIdx ? "start" : i === eIdx ? "end" : "idle";
    const marker = campusMarkers[i];
    marker.setIcon(makePinIcon(role));
    marker.setZIndexOffset(role === "idle" ? 0 : role === "start" ? 600 : 500);
  }
}

function loadScriptWithSri(src, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = "";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Fallback Leaflet JS failed to load."));
    document.head.appendChild(s);
  });
}

function ensureLeafletCss() {
  const existing = $("leaflet-css");
  const hasCss =
    existing &&
    [...document.styleSheets].some((sheet) => {
      try {
        return sheet.href && sheet.href.includes("leaflet");
      } catch {
        return false;
      }
    });
  if (hasCss) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_FALLBACK_CSS;
  link.integrity = LEAFLET_FALLBACK_CSS_SRI;
  link.crossOrigin = "";
  document.head.appendChild(link);
}

async function ensureLeaflet() {
  if (window.L) {
    ensureLeafletCss();
    return window.L;
  }
  ensureLeafletCss();
  await loadScriptWithSri(LEAFLET_FALLBACK_JS, LEAFLET_FALLBACK_JS_SRI);
  if (!window.L) throw new Error("Leaflet map library failed to initialize.");
  return window.L;
}

function initMap(L) {
  map = L.map("map", { zoomControl: true }).setView(HCMC_CENTER, HCMC_ZOOM);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  }).addTo(map);

  explorationLayer = createExplorationLayer(L, getThemePalette);
  explorationLayer.addTo(map);
  routeLayer = L.layerGroup().addTo(map);

  campusMarkers = CAMPUSES.map((campus, index) => {
    const marker = L.marker(campus.ll, {
      icon: makePinIcon("idle"),
      title: `${campus.name} (${campus.area})`,
    }).addTo(map);
    marker.bindPopup(() => buildPopupContent(campus, index));
    return marker;
  });

  syncControls();
}

function stopActiveWork() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  if (activeRafId) {
    cancelAnimationFrame(activeRafId);
    activeRafId = 0;
  }
  finishPlaybackNow = null;
  setProgress(null);
}

function clearMapOverlays() {
  explorationLayer?.clear();
  routeLayer?.clearLayers();
  lastRoutePolylines = null;
  resultSection.hidden = true;
}

function prepareHierarchy(workerPayload, transferList, { signal, onProgress }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }

    const worker = new Worker(new URL("./preprocess.js", import.meta.url), {
      type: "module",
    });
    activeWorker = worker;

    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (activeWorker === worker) activeWorker = null;
      worker.terminate();
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onAbort = () => {
      fail(new DOMException("The operation was aborted.", "AbortError"));
    };

    const timer = setTimeout(() => {
      fail(
        new Error(
          "Road network preprocessing timed out after three minutes. Try a closer campus pair or retry.",
        ),
      );
    }, 180000);

    signal?.addEventListener("abort", onAbort, { once: true });

    worker.onerror = (event) => {
      fail(
        new Error(
          event?.message
            ? `Hierarchy worker error: ${event.message}`
            : "Hierarchy preprocessing worker failed.",
        ),
      );
    };

    worker.onmessageerror = () => {
      fail(new Error("Hierarchy worker returned an unreadable message."));
    };

    worker.onmessage = ({ data }) => {
      if (settled) return;
      if (data?.progress) {
        onProgress?.(data.progress);
        return;
      }
      if (data?.error) {
        fail(new Error(data.error));
        return;
      }
      if (data?.hierarchy) {
        settled = true;
        cleanup();
        resolve(data.hierarchy);
      }
    };

    worker.postMessage(
      { graph: workerPayload, options: { progressStep: 500 } },
      transferList,
    );
  });
}

async function drainQueryAsync(hierarchy, startNode, endNode, signal) {
  const iterator = query(hierarchy, startNode, endNode);
  const steps = [];
  let step;

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    const sliceStart = performance.now();
    do {
      step = iterator.next();
      if (!step.done) steps.push(step.value);
    } while (!step.done && performance.now() - sliceStart < 12);

    if (step.done) break;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return { steps, result: step.value };
}

function buildOrigEdgeCoords(graphView, origId) {
  const orig = graphView.origEdges[origId];
  if (!orig) return null;
  const fromLL = [graphView.lats[orig.fromIdx], graphView.lons[orig.fromIdx]];
  const toLL = [graphView.lats[orig.toIdx], graphView.lons[orig.toIdx]];
  return orig.geom && orig.geom.length
    ? [fromLL, ...orig.geom, toLL]
    : [fromLL, toLL];
}

function buildRouteLatLngs(graphView, edgeIds) {
  const coords = [];
  for (let i = 0; i < edgeIds.length; i++) {
    const seg = buildOrigEdgeCoords(graphView, edgeIds[i]);
    if (!seg) continue;
    if (coords.length === 0) {
      coords.push(...seg);
    } else {
      for (let j = 1; j < seg.length; j++) {
        coords.push(seg[j]);
      }
    }
  }
  return coords;
}

function playExploration(steps, hierarchy, graphView, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }

    const total = steps.length;
    const drawnFwd = new Uint8Array(graphView.origEdges.length);
    const drawnBwd = new Uint8Array(graphView.origEdges.length);
    const unpackedIds = [];
    let cursor = 0;
    let settled = false;

    const cleanup = () => {
      if (activeRafId) {
        cancelAnimationFrame(activeRafId);
        activeRafId = 0;
      }
      finishPlaybackNow = null;
      signal?.removeEventListener("abort", onAbort);
    };

    const finishResolve = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const finishReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onAbort = () => {
      finishReject(new DOMException("The operation was aborted.", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    const pushStep = (step, segsOut, tipsOut) => {
      const tipLL = [
        graphView.lats[step.visitedIdx],
        graphView.lons[step.visitedIdx],
      ];
      tipsOut.push({ dir: step.direction, ll: tipLL });

      if (step.edgePoolIdx >= 0) {
        unpackedIds.length = 0;
        unpackEdge(hierarchy, step.edgePoolIdx, unpackedIds);
        const mask = step.direction === 0 ? drawnFwd : drawnBwd;
        for (let k = 0; k < unpackedIds.length; k++) {
          const origId = unpackedIds[k];
          if (mask[origId]) continue;
          mask[origId] = 1;
          const coords = buildOrigEdgeCoords(graphView, origId);
          if (coords) segsOut.push({ dir: step.direction, coords });
        }
      }
    };

    const flushAllRemaining = () => {
      if (settled) return;
      const segs = [];
      const tips = [];
      while (cursor < total) {
        pushStep(steps[cursor++], segs, tips);
      }
      if (segs.length || tips.length) {
        explorationLayer.appendBatch(segs, tips);
      }
      finishResolve();
    };

    if (getSelectedSpeed() === "instant" || total === 0) {
      flushAllRemaining();
      return;
    }

    finishPlaybackNow = () => {
      flushAllRemaining();
    };

    const startTime = performance.now();

    const tick = (now) => {
      if (settled) return;
      if (signal?.aborted) {
        onAbort();
        return;
      }

      const speed = getSelectedSpeed();
      if (speed === "instant") {
        flushAllRemaining();
        return;
      }

      const targetMs = speed === "fast" ? 550 : 1600;
      const elapsed = Math.max(16, now - startTime);
      const targetIndex = Math.min(
        total,
        Math.max(cursor + 1, Math.ceil((elapsed / targetMs) * total)),
      );

      const segs = [];
      const tips = [];
      while (cursor < targetIndex) {
        pushStep(steps[cursor++], segs, tips);
      }

      if (segs.length || tips.length) {
        explorationLayer.appendBatch(segs, tips);
      }

      // Visual-only counter update (NEVER writes to #sr-status!)
      statusText.textContent = `Exploring road hierarchy — ${cursor.toLocaleString()} / ${total.toLocaleString()} intersections`;

      if (cursor >= total) {
        finishResolve();
        return;
      }

      activeRafId = requestAnimationFrame(tick);
    };

    activeRafId = requestAnimationFrame(tick);
  });
}

function renderRouteResult({
  startCampus,
  endCampus,
  mode,
  tier,
  result,
  graphView,
  startNode,
  endNode,
}) {
  const L = window.L;
  const palette = getThemePalette();
  const modeLabel = mode === "car" ? "Car" : "Motorbike";

  resultPair.textContent = `${startCampus.name} to ${endCampus.name} · ${modeLabel}`;

  if (startNode === endNode) {
    const idx = graphView.idToIdx.get(startNode);
    const ll = [graphView.lats[idx], graphView.lons[idx]];
    const sameRing = L.circleMarker(ll, {
      radius: 9,
      color: palette.route,
      weight: 3,
      fillColor: palette.casing,
      fillOpacity: 0.9,
      interactive: false,
    }).addTo(routeLayer);
    lastRoutePolylines = { sameRing };
    map.setView(ll, 16);

    resultDistance.textContent = "0.0 km";
    resultDuration.textContent = "< 1 min";
    resultExplored.textContent = "1 node";
    resultNote.textContent =
      "Both pins snapped to the same nearby road intersection.";
    resultSection.hidden = false;
    setStatus("success", "Complete — both pins share the nearest intersection.", {
      announce: true,
    });
    return;
  }

  if (result.meeting != null) {
    const meetIdx = graphView.idToIdx.get(result.meeting);
    if (meetIdx !== undefined) {
      explorationLayer.setMeeting([
        graphView.lats[meetIdx],
        graphView.lons[meetIdx],
      ]);
    }
  }

  const routeCoords = buildRouteLatLngs(graphView, result.edgeIds);
  const fallbackCoords =
    routeCoords.length >= 2
      ? routeCoords
      : result.route.map((id) => {
          const idx = graphView.idToIdx.get(id);
          return [graphView.lats[idx], graphView.lons[idx]];
        });

  const casing = L.polyline(fallbackCoords, {
    color: palette.casing,
    weight: 9,
    opacity: 0.96,
    lineCap: "round",
    lineJoin: "round",
    interactive: false,
  }).addTo(routeLayer);

  const stroke = L.polyline(fallbackCoords, {
    color: palette.route,
    weight: 5,
    opacity: 1,
    lineCap: "round",
    lineJoin: "round",
    interactive: false,
  }).addTo(routeLayer);

  lastRoutePolylines = { casing, stroke };

  if (fallbackCoords.length >= 2) {
    map.fitBounds(fallbackCoords, { padding: [42, 42], maxZoom: 16 });
  }

  const km = (result.meters / 1000).toFixed(1);
  const mins = Math.max(1, Math.round(result.seconds / 60));
  const durationLabel =
    mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60}m`
      : `~${mins} min`;

  resultDistance.textContent = `${km} km`;
  resultDuration.textContent = durationLabel;
  resultExplored.textContent = result.visitedCount.toLocaleString();
  resultNote.textContent =
    tier === "regional"
      ? "Regional highway corridor estimate without live traffic, signals, or tolls. Snaps to nearest road within 1.5 km."
      : tier === "metro"
        ? "Metro arterial corridor estimate without live traffic, signals, or tolls. Snaps to nearest road within 1.5 km."
        : "Illustrative road-class time estimate without live traffic, signals, or turn restrictions. Excludes campus driveway access.";
  resultSection.hidden = false;

  setStatus(
    "success",
    `Route found: ${km} km, ${durationLabel} (${result.visitedCount.toLocaleString()} intersections explored).`,
    { announce: true },
  );
}

async function runRoute() {
  if (busy || !map || startEl.value === endEl.value) return;

  const startCampus = CAMPUSES[Number(startEl.value)];
  const endCampus = CAMPUSES[Number(endEl.value)];
  const mode = getSelectedMode();

  stopActiveWork();
  clearMapOverlays();

  const runId = ++activeRunId;
  const controller = new AbortController();
  activeAbortController = controller;
  const { signal } = controller;

  busy = true;
  beginLabel.textContent = "Exploring…";
  syncControls();

  // Immediately frame the selected campus pair before waiting on Overpass
  map.fitBounds([startCampus.ll, endCampus.ll], {
    padding: [55, 55],
    maxZoom: 15,
  });

  try {
    setStatus("info", "Loading OpenStreetMap road corridor…", {
      announce: true,
    });

    const roads = await loadRoads(startCampus.ll, endCampus.ll, {
      signal,
      notify: (msg) => setStatus("info", msg),
    });

    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const cacheKey = `${roads.key}-${mode}`;
    let parsed = lruGet(parsedGraphs, cacheKey);
    if (!parsed) {
      setStatus("info", "Building routable street graph…");
      // Canonical pin ordering guarantees A -> B and B -> A share collapsed graphs & cached hierarchies
      const canonicalPins = [startCampus.ll, endCampus.ll].sort(
        (x, y) => x[0] - y[0] || x[1] - y[1],
      );
      const graph = graphFromOSM(roads.data, mode, {
        collapse: true,
        pins: canonicalPins,
      });
      const { graphView } = packGraph(graph);
      parsed = { graph, graphView };
      lruSet(parsedGraphs, cacheKey, parsed);
    }

    const { graph, graphView } = parsed;
    const startNode = nearest(graph, startCampus.ll, { role: "start" });
    const endNode = nearest(graph, endCampus.ll, { role: "end" });

    let hierarchy = lruGet(hierarchies, cacheKey);
    if (!hierarchy) {
      setStatus("info", "Preparing contraction hierarchy…", { announce: true });
      setProgress(0);

      // Generate fresh Transferable buffers right before worker transfer (guards against neutered buffers on retry)
      const { workerPayload, transferList } = packGraph(graph);
      hierarchy = await prepareHierarchy(workerPayload, transferList, {
        signal,
        onProgress: (p) => {
          setProgress(p.pct);
          statusText.textContent = `Preparing hierarchy — ${p.processed.toLocaleString()} / ${p.total.toLocaleString()} intersections (${p.pct}%)`;
        },
      });
      hierarchy.idxToId = graphView.idxToId;
      hierarchy.idToIdx = graphView.idToIdx;
      lruSet(hierarchies, cacheKey, hierarchy);
      setProgress(null);
    }

    setStatus("info", "Running bidirectional Contraction Hierarchies query…", {
      announce: true,
    });

    const { steps, result } = await drainQueryAsync(
      hierarchy,
      startNode,
      endNode,
      signal,
    );

    if (!result) {
      throw new Error(
        `No connected ${mode} route exists between these campuses in the downloaded corridor. Try switching vehicle or retrying.`,
      );
    }

    await playExploration(steps, hierarchy, graphView, signal);

    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    renderRouteResult({
      startCampus,
      endCampus,
      mode,
      tier: roads.tier,
      result,
      graphView,
      startNode,
      endNode,
    });
  } catch (error) {
    if (runId !== activeRunId) return;
    if (error?.name === "AbortError" || signal.aborted) {
      setStatus("warning", "Search stopped.", { announce: true });
    } else {
      setStatus(
        "error",
        error?.message ||
          "Could not complete route search. Wait a moment and retry.",
        { announce: true, showRetry: true },
      );
    }
  } finally {
    if (runId === activeRunId) {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
      setProgress(null);
      busy = false;
      beginLabel.textContent = "Find route";
      syncControls();
    }
  }
}

// Event wiring
startEl.addEventListener("change", () => syncControls());
endEl.addEventListener("change", () => syncControls());

swapBtn.addEventListener("click", () => {
  if (busy) return;
  const prevStart = startEl.value;
  startEl.value = endEl.value;
  endEl.value = prevStart;
  syncControls();
});

for (const radio of speedRadios) {
  radio.addEventListener("change", () => {
    if (radio.checked && radio.value === "instant" && finishPlaybackNow) {
      finishPlaybackNow();
    }
  });
}

controlsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  runRoute();
});

stopBtn.addEventListener("click", () => {
  if (!busy) return;
  stopActiveWork();
});

retryBtn.addEventListener("click", () => {
  if (busy) return;
  runRoute();
});

resetBtn.addEventListener("click", () => {
  activeRunId++;
  stopActiveWork();
  clearMapOverlays();
  busy = false;
  beginLabel.textContent = "Find route";
  startEl.value = String(DEFAULT_START_IDX);
  endEl.value = String(DEFAULT_END_IDX);
  syncControls();
  map?.setView(HCMC_CENTER, HCMC_ZOOM);
  setStatus(
    "ready",
    "Ready — press Find route to explore between the selected campuses.",
    { announce: true },
  );
});

fitAllBtn.addEventListener("click", () => {
  if (!map) return;
  map.fitBounds(
    CAMPUSES.map((c) => c.ll),
    { padding: [36, 36] },
  );
});

themeToggleBtn.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(next, true);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && busy) {
    e.preventDefault();
    stopActiveWork();
  }
});

// Initialize preferences, selectors, and map
populateSelectors();

const initialTheme = document.documentElement.dataset.theme || "light";
setTheme(initialTheme, false);

const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
if (reducedMotionQuery.matches) {
  setSelectedSpeed("instant");
}
reducedMotionQuery.addEventListener("change", (e) => {
  if (e.matches) {
    setSelectedSpeed("instant");
    if (finishPlaybackNow) finishPlaybackNow();
  }
});

const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
systemThemeQuery.addEventListener("change", (e) => {
  try {
    if (!localStorage.getItem("ou-theme")) {
      setTheme(e.matches ? "dark" : "light", false);
    }
  } catch {}
});

syncControls();

ensureLeaflet()
  .then((L) => {
    initMap(L);
  })
  .catch(() => {
    setStatus(
      "error",
      "The interactive map library could not load from either CDN. Check your internet connection and reload the page.",
      { announce: true, showRetry: false },
    );
    syncControls();
  });
