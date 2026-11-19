export const SPEED_PROFILES = {
  car: {
    motorway: 75,
    trunk: 45,
    primary: 35,
    secondary: 30,
    tertiary: 25,
    unclassified: 20,
    residential: 18,
    living_street: 10,
    service: 12,
  },
  motorbike: {
    trunk: 40,
    primary: 32,
    secondary: 28,
    tertiary: 25,
    unclassified: 22,
    residential: 22,
    living_street: 15,
    service: 15,
    path: 14,
  },
};

const SKIP_HIGHWAYS = new Set([
  "footway",
  "steps",
  "cycleway",
  "pedestrian",
  "construction",
  "proposed",
  "track",
  "bridleway",
  "corridor",
  "bus_guideway",
  "raceway",
]);

const BLOCKED_SERVICES = new Set([
  "parking_aisle",
  "driveway",
  "emergency_access",
  "drive-through",
]);

const BLOCKED_ACCESS = new Set([
  "no",
  "private",
  "agricultural",
  "forestry",
  "military",
  "customers",
  "permit",
  "discouraged",
]);

const ALLOWED_DIRECT = new Set(["yes", "designated", "permissive"]);

const NATIONAL_MAXSPEED = {
  "vn:urban": 50,
  "vn:rural": 80,
  "vn:motorway": 100,
};

export function distance(a, b) {
  const r = Math.PI / 180;
  const p = (b[0] - a[0]) * r;
  const q = (b[1] - a[1]) * r;
  return (
    6371000 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(p / 2) ** 2 +
            Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(q / 2) ** 2,
        ),
      ),
    )
  );
}

export function parseMaxspeed(raw) {
  if (raw == null) return Infinity;
  const str = String(raw).trim();
  if (!str) return Infinity;
  let best = Infinity;
  for (const part of str.split(/[;|]/)) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    if (token in NATIONAL_MAXSPEED) {
      best = Math.min(best, NATIONAL_MAXSPEED[token]);
      continue;
    }
    const match = token.match(/^(\d+(?:\.\d+)?)\s*(km\/h|kph|kmh|mph)?$/i);
    if (!match) continue;
    const val = Number(match[1]);
    if (!(val > 0)) continue;
    const unit = match[2]?.toLowerCase();
    const kmh = unit === "mph" ? val * 1.609344 : val;
    if (kmh < best) best = kmh;
  }
  return best;
}

function parseWidth(raw) {
  if (raw == null) return Infinity;
  const match = String(raw)
    .trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*(?:m\b)?/i);
  if (!match) return Infinity;
  const val = Number(match[1].replace(",", "."));
  return val > 0 ? val : Infinity;
}

export function computeSCC(graph) {
  const n = graph.size;
  if (n === 0) {
    return { components: [], largestScc: new Set(), largestSccSize: 0 };
  }

  const idxToId = new Array(n);
  const idToIdx = new Map();
  let idx = 0;
  for (const id of graph.keys()) {
    idxToId[idx] = id;
    idToIdx.set(id, idx);
    idx++;
  }

  const outAdj = new Array(n);
  for (let u = 0; u < n; u++) {
    const edges = graph.get(idxToId[u]).edges;
    const list = [];
    for (let i = 0; i < edges.length; i++) {
      const v = idToIdx.get(edges[i].to);
      if (v !== undefined) list.push(v);
    }
    outAdj[u] = list;
  }

  const index = new Int32Array(n).fill(-1);
  const lowlink = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const tarjanStack = new Int32Array(n);
  const dfsNode = new Int32Array(n);
  const dfsEdgePos = new Int32Array(n);

  let timer = 0;
  let tTop = 0;
  const components = [];
  let largestComp = [];

  for (let start = 0; start < n; start++) {
    if (index[start] !== -1) continue;
    index[start] = lowlink[start] = timer++;
    tarjanStack[tTop++] = start;
    onStack[start] = 1;
    dfsNode[0] = start;
    dfsEdgePos[0] = 0;
    let dTop = 1;

    while (dTop > 0) {
      const u = dfsNode[dTop - 1];
      const edges = outAdj[u];
      const ei = dfsEdgePos[dTop - 1];

      if (ei < edges.length) {
        dfsEdgePos[dTop - 1] = ei + 1;
        const w = edges[ei];
        if (index[w] === -1) {
          index[w] = lowlink[w] = timer++;
          tarjanStack[tTop++] = w;
          onStack[w] = 1;
          dfsNode[dTop] = w;
          dfsEdgePos[dTop] = 0;
          dTop++;
        } else if (onStack[w]) {
          if (index[w] < lowlink[u]) lowlink[u] = index[w];
        }
      } else {
        dTop--;
        if (lowlink[u] === index[u]) {
          const comp = [];
          while (true) {
            const w = tarjanStack[--tTop];
            onStack[w] = 0;
            comp.push(idxToId[w]);
            if (w === u) break;
          }
          components.push(comp);
          if (comp.length > largestComp.length) largestComp = comp;
        }
        if (dTop > 0) {
          const parent = dfsNode[dTop - 1];
          if (lowlink[u] < lowlink[parent]) lowlink[parent] = lowlink[u];
        }
      }
    }
  }

  return {
    components,
    largestScc: new Set(largestComp),
    largestSccSize: largestComp.length,
  };
}

function buildDegrees(graph) {
  const inDegree = new Map();
  const outDegree = new Map();
  for (const id of graph.keys()) {
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }
  for (const [id, node] of graph) {
    let outCount = 0;
    for (const edge of node.edges) {
      if (!graph.has(edge.to)) continue;
      outCount++;
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
    outDegree.set(id, outCount);
  }
  return { inDegree, outDegree };
}

function compareNodeIds(a, b) {
  if (a === b) return 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : 1;
}

export function graphFromOSM(data, mode = "car", options = {}) {
  const { collapse = true, maxChainMeters = 500, pins = [] } = options;
  const profile = SPEED_PROFILES[mode] || SPEED_PROFILES.car;
  const maxSpeedKmh = Math.max(...Object.values(profile));

  const rawNodes = new Map();
  const elements = data?.elements || [];
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i];
    if (e?.type === "node" && Number.isFinite(e.lat) && Number.isFinite(e.lon)) {
      rawNodes.set(e.id, { id: e.id, ll: [e.lat, e.lon] });
    }
  }

  const rawOut = new Map();
  const rawIn = new Map();
  const undir = new Map();

  const ensureRaw = (id) => {
    if (!rawOut.has(id)) {
      rawOut.set(id, []);
      rawIn.set(id, []);
      undir.set(id, new Set());
    }
  };

  for (let i = 0; i < elements.length; i++) {
    const w = elements[i];
    if (w?.type !== "way" || !Array.isArray(w.nodes) || w.nodes.length < 2) {
      continue;
    }
    const t = w.tags || {};
    const h = t.highway;
    if (!h || t.area === "yes" || SKIP_HIGHWAYS.has(h)) continue;

    const baseH = h.replace(/_link$/, "");
    if (baseH === "motorway" && mode === "motorbike") continue;
    if (baseH === "path") {
      if (mode === "car") continue;
      if (!ALLOWED_DIRECT.has(t.motorcycle)) continue;
    }
    if (baseH === "service") {
      if (BLOCKED_SERVICES.has(t.service)) continue;
      if (mode === "car" && t.service === "alley" && t.motorcar !== "yes") {
        continue;
      }
    }
    if (mode === "car" && parseWidth(t.width) < 2.2 && t.motorcar !== "yes") {
      continue;
    }

    const baseSpeed = profile[baseH];
    if (baseSpeed === undefined) continue;

    const modeAccess = t[mode === "car" ? "motorcar" : "motorcycle"];
    const access = modeAccess ?? t.motor_vehicle ?? t.vehicle ?? t.access;
    if (BLOCKED_ACCESS.has(access)) continue;

    const rawMax =
      t[mode === "motorbike" ? "maxspeed:motorcycle" : "maxspeed:motorcar"] ??
      t.maxspeed;
    const speed = Math.min(baseSpeed, parseMaxspeed(rawMax));
    if (!(speed > 0)) continue;

    const baseOneway =
      t[mode === "motorbike" ? "oneway:motorcycle" : "oneway:motorcar"] ??
      t["oneway:motor_vehicle"] ??
      t.oneway ??
      (t.junction === "roundabout" || t.junction === "circular" ? "yes" : "no");

    let allowForward = baseOneway !== "-1" && baseOneway !== "reverse";
    let allowBackward = !["yes", "1", "true"].includes(baseOneway);

    const fwdAccess =
      t[mode === "motorbike" ? "motorcycle:forward" : "motorcar:forward"] ??
      t["motor_vehicle:forward"] ??
      t["vehicle:forward"];
    const bwdAccess =
      t[mode === "motorbike" ? "motorcycle:backward" : "motorcar:backward"] ??
      t["motor_vehicle:backward"] ??
      t["vehicle:backward"];

    if (BLOCKED_ACCESS.has(fwdAccess)) allowForward = false;
    else if (ALLOWED_DIRECT.has(fwdAccess)) allowForward = true;

    if (BLOCKED_ACCESS.has(bwdAccess)) allowBackward = false;
    else if (ALLOWED_DIRECT.has(bwdAccess)) allowBackward = true;

    if (!allowForward && !allowBackward) continue;

    const mps = speed / 3.6;
    for (let j = 1; j < w.nodes.length; j++) {
      const u = w.nodes[j - 1];
      const v = w.nodes[j];
      if (u === v) continue;
      const nodeU = rawNodes.get(u);
      const nodeV = rawNodes.get(v);
      if (!nodeU || !nodeV) continue;

      const meters = distance(nodeU.ll, nodeV.ll);
      const seconds = meters / mps;
      ensureRaw(u);
      ensureRaw(v);
      undir.get(u).add(v);
      undir.get(v).add(u);

      if (allowForward) {
        rawOut.get(u).push({ to: v, seconds, meters });
        rawIn.get(v).push({ from: u, seconds, meters });
      }
      if (allowBackward) {
        rawOut.get(v).push({ to: u, seconds, meters });
        rawIn.get(u).push({ from: v, seconds, meters });
      }
    }
  }

  const rawNodeCount = rawOut.size;
  if (rawNodeCount === 0) {
    const empty = new Map();
    empty.meta = {
      mode,
      maxSpeedKmh,
      rawNodeCount: 0,
      collapsedNodeCount: 0,
      edgeCount: 0,
      largestScc: new Set(),
      largestSccSize: 0,
      inDegree: new Map(),
      outDegree: new Map(),
    };
    return empty;
  }

  let graph;
  let edgeCount = 0;

  if (!collapse) {
    graph = new Map();
    for (const id of rawOut.keys()) {
      graph.set(id, { id, ll: rawNodes.get(id).ll, edges: [] });
    }
    for (const [u, edges] of rawOut) {
      const targetEdges = graph.get(u).edges;
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        targetEdges.push({
          to: e.to,
          seconds: e.seconds,
          meters: e.meters,
          origId: edgeCount++,
        });
      }
    }
  } else {
    const anchors = new Set();

    // 1. Structural anchors (degree != 2, parallel edges, or non-through flow)
    for (const id of rawOut.keys()) {
      const nbrs = undir.get(id);
      if (nbrs.size !== 2) {
        anchors.add(id);
        continue;
      }
      const outs = rawOut.get(id);
      const ins = rawIn.get(id);
      if (outs.length > 2 || ins.length > 2) {
        anchors.add(id);
        continue;
      }
      const it = nbrs.values();
      const nA = it.next().value;
      const nB = it.next().value;

      let outA = 0;
      let outB = 0;
      for (let i = 0; i < outs.length; i++) {
        if (outs[i].to === nA) outA++;
        else if (outs[i].to === nB) outB++;
      }
      let inA = 0;
      let inB = 0;
      for (let i = 0; i < ins.length; i++) {
        if (ins[i].from === nA) inA++;
        else if (ins[i].from === nB) inB++;
      }

      if (
        outA > 1 ||
        outB > 1 ||
        inA > 1 ||
        inB > 1 ||
        inA !== outB ||
        inB !== outA
      ) {
        anchors.add(id);
      }
    }

    // 2. Pin proximity anchors (within 1500 m)
    for (let i = 0; i < pins.length; i++) {
      const pinLL = pins[i];
      if (!Array.isArray(pinLL) || pinLL.length < 2) continue;
      let closestId = null;
      let closestDist = Infinity;
      for (const id of rawOut.keys()) {
        const d = distance(rawNodes.get(id).ll, pinLL);
        if (
          d < closestDist ||
          (d === closestDist &&
            closestId !== null &&
            compareNodeIds(id, closestId) < 0)
        ) {
          closestDist = d;
          closestId = id;
        }
      }
      if (closestId !== null && closestDist <= 1500) {
        anchors.add(closestId);
      }
    }

    // 3. Detect pure degree-2 cycles (components with 0 anchors) and split them at 2 opposite points
    const visitedNonAnchor = new Set();
    for (const anchorId of anchors) {
      for (const nbr of undir.get(anchorId)) {
        if (anchors.has(nbr) || visitedNonAnchor.has(nbr)) continue;
        let prev = anchorId;
        let cur = nbr;
        while (!anchors.has(cur) && !visitedNonAnchor.has(cur)) {
          visitedNonAnchor.add(cur);
          const nbrs = undir.get(cur);
          let next = null;
          for (const cand of nbrs) {
            if (cand !== prev) {
              next = cand;
              break;
            }
          }
          if (next === null) break;
          prev = cur;
          cur = next;
        }
      }
    }

    for (const id of rawOut.keys()) {
      if (anchors.has(id) || visitedNonAnchor.has(id)) continue;
      // Pure degree-2 cycle
      const cycle = [id];
      visitedNonAnchor.add(id);
      const it = undir.get(id).values();
      let prev = id;
      let cur = it.next().value;
      while (cur !== id && !visitedNonAnchor.has(cur)) {
        visitedNonAnchor.add(cur);
        cycle.push(cur);
        let next = null;
        for (const cand of undir.get(cur)) {
          if (cand !== prev) {
            next = cand;
            break;
          }
        }
        if (next === null) break;
        prev = cur;
        cur = next;
      }
      anchors.add(cycle[0]);
      if (cycle.length >= 2) {
        anchors.add(cycle[Math.floor(cycle.length / 2)]);
      }
    }

    // 4. Split long chains (> maxChainMeters) and anchor-to-same-anchor lasso loops symmetrically
    const scannedInternal = new Set();
    const initialAnchors = [...anchors];
    for (let aIdx = 0; aIdx < initialAnchors.length; aIdx++) {
      const startAnchor = initialAnchors[aIdx];
      for (const first of undir.get(startAnchor)) {
        if (anchors.has(first) || scannedInternal.has(first)) continue;
        const chain = [startAnchor];
        let prev = startAnchor;
        let cur = first;
        while (!anchors.has(cur)) {
          scannedInternal.add(cur);
          chain.push(cur);
          let next = null;
          for (const cand of undir.get(cur)) {
            if (cand !== prev) {
              next = cand;
              break;
            }
          }
          if (next === null) break;
          prev = cur;
          cur = next;
        }
        chain.push(cur);

        // Canonical orientation for symmetry between forward & reverse traversals
        const endAnchor = chain[chain.length - 1];
        if (
          compareNodeIds(startAnchor, endAnchor) > 0 ||
          (startAnchor === endAnchor &&
            chain.length > 3 &&
            compareNodeIds(chain[1], chain[chain.length - 2]) > 0)
        ) {
          chain.reverse();
        }

        // Prevent self-loop on anchor-to-same-anchor degree-2 loops
        if (chain[0] === chain[chain.length - 1] && chain.length >= 3) {
          const midIdx = Math.floor(chain.length / 2);
          anchors.add(chain[midIdx]);
        }

        if (maxChainMeters > 0 && chain.length > 2) {
          let lastAnchorPos = 0;
          let accMeters = 0;
          for (let k = 1; k < chain.length; k++) {
            const segMeters = distance(
              rawNodes.get(chain[k - 1]).ll,
              rawNodes.get(chain[k]).ll,
            );
            if (anchors.has(chain[k])) {
              lastAnchorPos = k;
              accMeters = 0;
              continue;
            }
            if (accMeters + segMeters > maxChainMeters) {
              if (k - 1 > lastAnchorPos) {
                anchors.add(chain[k - 1]);
                lastAnchorPos = k - 1;
                accMeters = segMeters;
              } else if (k < chain.length - 1) {
                anchors.add(chain[k]);
                lastAnchorPos = k;
                accMeters = 0;
              }
            } else {
              accMeters += segMeters;
            }
          }
        }
      }
    }

    // 5. Build collapsed directed graph preserving curved geometry
    graph = new Map();
    for (const id of anchors) {
      graph.set(id, { id, ll: rawNodes.get(id).ll, edges: [] });
    }

    for (const startAnchor of anchors) {
      const outs = rawOut.get(startAnchor);
      const targetEdges = graph.get(startAnchor).edges;
      for (let i = 0; i < outs.length; i++) {
        const firstEdge = outs[i];
        let prev = startAnchor;
        let cur = firstEdge.to;
        let totalSec = firstEdge.seconds;
        let totalMet = firstEdge.meters;
        const geom = [];

        while (!anchors.has(cur)) {
          geom.push(rawNodes.get(cur).ll);
          const curOuts = rawOut.get(cur);
          let nextEdge = null;
          for (let j = 0; j < curOuts.length; j++) {
            if (curOuts[j].to !== prev) {
              nextEdge = curOuts[j];
              break;
            }
          }
          if (!nextEdge) break;
          totalSec += nextEdge.seconds;
          totalMet += nextEdge.meters;
          prev = cur;
          cur = nextEdge.to;
        }

        if (cur === startAnchor || !graph.has(cur)) continue;
        const edgeObj = {
          to: cur,
          seconds: totalSec,
          meters: totalMet,
          origId: edgeCount++,
        };
        if (geom.length > 0) edgeObj.geom = geom;
        targetEdges.push(edgeObj);
      }
    }
  }

  const scc = computeSCC(graph);
  const { inDegree, outDegree } = buildDegrees(graph);
  graph.meta = {
    mode,
    maxSpeedKmh,
    rawNodeCount,
    collapsedNodeCount: graph.size,
    edgeCount,
    largestScc: scc.largestScc,
    largestSccSize: scc.largestSccSize,
    inDegree,
    outDegree,
  };

  return graph;
}

export function packGraph(graph) {
  const n = graph.size;
  const idxToId = new Array(n);
  const idToIdx = new Map();
  const lats = new Float64Array(n);
  const lons = new Float64Array(n);

  let idx = 0;
  for (const [id, node] of graph) {
    idxToId[idx] = id;
    idToIdx.set(id, idx);
    lats[idx] = node.ll[0];
    lons[idx] = node.ll[1];
    idx++;
  }

  let edgeCount = 0;
  for (let u = 0; u < n; u++) {
    const edges = graph.get(idxToId[u]).edges;
    for (let i = 0; i < edges.length; i++) {
      const v = idToIdx.get(edges[i].to);
      if (v !== undefined && v !== u) edgeCount++;
    }
  }

  const outOffsets = new Int32Array(n + 1);
  const outTargets = new Int32Array(edgeCount);
  const outSeconds = new Float64Array(edgeCount);
  const outMeters = new Float64Array(edgeCount);
  const outOrigIds = new Int32Array(edgeCount);
  const origEdges = new Array(edgeCount);

  let pos = 0;
  for (let u = 0; u < n; u++) {
    outOffsets[u] = pos;
    const edges = graph.get(idxToId[u]).edges;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const v = idToIdx.get(e.to);
      if (v === undefined || v === u) continue;
      outTargets[pos] = v;
      outSeconds[pos] = e.seconds;
      outMeters[pos] = e.meters;
      outOrigIds[pos] = pos;
      origEdges[pos] = {
        fromIdx: u,
        toIdx: v,
        seconds: e.seconds,
        meters: e.meters,
        geom: e.geom ?? null,
      };
      pos++;
    }
  }
  outOffsets[n] = pos;

  return {
    graphView: {
      nodeCount: n,
      idxToId,
      idToIdx,
      lats,
      lons,
      origEdges,
    },
    workerPayload: {
      kind: "compact-graph",
      nodeCount: n,
      edgeCount,
      outOffsets,
      outTargets,
      outSeconds,
      outMeters,
      outOrigIds,
    },
    transferList: [
      outOffsets.buffer,
      outTargets.buffer,
      outSeconds.buffer,
      outMeters.buffer,
      outOrigIds.buffer,
    ],
  };
}

export function nearest(graph, ll, options = {}) {
  const { role = "any", maxMeters = 1500 } = options;
  if (!graph || graph.size === 0) {
    throw Error("No routable roads found for this vehicle in the loaded area.");
  }

  let largestScc = graph.meta?.largestScc;
  let inDegree = graph.meta?.inDegree;
  let outDegree = graph.meta?.outDegree;

  if (!largestScc || !inDegree || !outDegree) {
    const scc = computeSCC(graph);
    const deg = buildDegrees(graph);
    largestScc = scc.largestScc;
    inDegree = deg.inDegree;
    outDegree = deg.outDegree;
  }

  const findBest = (predicate) => {
    let best = null;
    let bestDist = Infinity;
    for (const [id, node] of graph) {
      if (!predicate(id)) continue;
      const d = distance(node.ll, ll);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return { best, bestDist };
  };

  if (largestScc.size >= 2) {
    const sccHit = findBest((id) => largestScc.has(id));
    if (sccHit.best !== null && sccHit.bestDist <= maxMeters) {
      return sccHit.best;
    }
  }

  const fallbackPred =
    role === "start"
      ? (id) => (outDegree.get(id) || 0) > 0
      : role === "end"
        ? (id) => (inDegree.get(id) || 0) > 0
        : (id) => (outDegree.get(id) || 0) > 0 || (inDegree.get(id) || 0) > 0;

  const fallbackHit = findBest(fallbackPred);
  if (fallbackHit.best !== null && fallbackHit.bestDist <= maxMeters) {
    return fallbackHit.best;
  }

  throw Error("No routable road within 1.5 km of this campus.");
}

class SearchHeap {
  constructor(capacity = 64) {
    this.nodes = new Int32Array(capacity);
    this.f = new Float64Array(capacity);
    this.g = new Float64Array(capacity);
    this.size = 0;
    this.poppedNode = -1;
    this.poppedG = 0;
  }
  push(node, gVal, fVal) {
    if (this.size === this.nodes.length) {
      const nextCap = this.nodes.length * 2;
      const nNodes = new Int32Array(nextCap);
      const nF = new Float64Array(nextCap);
      const nG = new Float64Array(nextCap);
      nNodes.set(this.nodes);
      nF.set(this.f);
      nG.set(this.g);
      this.nodes = nNodes;
      this.f = nF;
      this.g = nG;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= fVal) break;
      this.nodes[i] = this.nodes[p];
      this.f[i] = this.f[p];
      this.g[i] = this.g[p];
      i = p;
    }
    this.nodes[i] = node;
    this.f[i] = fVal;
    this.g[i] = gVal;
  }
  pop() {
    this.poppedNode = this.nodes[0];
    this.poppedG = this.g[0];
    const lastIdx = --this.size;
    if (lastIdx > 0) {
      const ln = this.nodes[lastIdx];
      const lf = this.f[lastIdx];
      const lg = this.g[lastIdx];
      let i = 0;
      while (true) {
        let c = i * 2 + 1;
        if (c >= lastIdx) break;
        if (c + 1 < lastIdx && this.f[c + 1] < this.f[c]) c++;
        if (this.f[c] >= lf) break;
        this.nodes[i] = this.nodes[c];
        this.f[i] = this.f[c];
        this.g[i] = this.g[c];
        i = c;
      }
      this.nodes[i] = ln;
      this.f[i] = lf;
      this.g[i] = lg;
    }
  }
}

export function* search(graph, start, end, options = {}) {
  const { dijkstra = false, maxSpeedKmh } = options;
  if (!graph.has(start) || !graph.has(end)) {
    throw Error("Endpoint is outside the routable graph.");
  }
  if (start === end) {
    yield { visited: start };
    return { route: [start], seconds: 0, meters: 0 };
  }

  const n = graph.size;
  const idxToId = new Array(n);
  const idToIdx = new Map();
  const nodesArr = new Array(n);
  let idx = 0;
  for (const [id, node] of graph) {
    idxToId[idx] = id;
    idToIdx.set(id, idx);
    nodesArr[idx] = node;
    idx++;
  }

  const startIdx = idToIdx.get(start);
  const endIdx = idToIdx.get(end);
  const endLL = nodesArr[endIdx].ll;

  let maxSpeedMps = Infinity;
  if (!dijkstra) {
    let observedMax = (maxSpeedKmh ?? graph.meta?.maxSpeedKmh ?? 0) / 3.6;
    for (let u = 0; u < n; u++) {
      const node = nodesArr[u];
      const edges = node.edges;
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const v = idToIdx.get(edge.to);
        if (v === undefined) continue;
        const straight = distance(node.ll, nodesArr[v].ll);
        if (edge.seconds > 0) {
          const speed = straight / edge.seconds;
          if (speed > observedMax) observedMax = speed;
        } else if (straight > 0) {
          observedMax = Infinity;
          break;
        }
      }
      if (!Number.isFinite(observedMax)) break;
    }
    maxSpeedMps =
      observedMax > 0 && Number.isFinite(observedMax)
        ? observedMax * 1.000001
        : Infinity;
  }

  const heuristic = (u) =>
    dijkstra || !Number.isFinite(maxSpeedMps)
      ? 0
      : distance(nodesArr[u].ll, endLL) / maxSpeedMps;

  const cost = new Float64Array(n).fill(Infinity);
  const prevNode = new Int32Array(n).fill(-1);
  const prevMeters = new Float64Array(n);
  const heap = new SearchHeap(Math.min(256, Math.max(32, n)));

  cost[startIdx] = 0;
  heap.push(startIdx, 0, heuristic(startIdx));

  while (heap.size > 0) {
    heap.pop();
    const u = heap.poppedNode;
    const g = heap.poppedG;
    if (g !== cost[u]) continue;

    yield { visited: idxToId[u] };

    if (u === endIdx) {
      const route = [];
      let meters = 0;
      let cur = endIdx;
      while (cur !== startIdx) {
        route.push(idxToId[cur]);
        meters += prevMeters[cur];
        cur = prevNode[cur];
      }
      route.push(start);
      route.reverse();
      return { route, seconds: g, meters };
    }

    const edges = nodesArr[u].edges;
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const v = idToIdx.get(edge.to);
      if (v === undefined) continue;
      const ng = g + edge.seconds;
      if (ng < cost[v]) {
        cost[v] = ng;
        prevNode[v] = u;
        prevMeters[v] = edge.meters;
        heap.push(v, ng, ng + heuristic(v));
      }
    }
  }

  return null;
}
