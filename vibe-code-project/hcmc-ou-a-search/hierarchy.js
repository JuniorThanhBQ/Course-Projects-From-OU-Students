import { packGraph } from "./routing.js";

class IntFloatHeap {
  constructor(capacity = 64) {
    this.nodes = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
    this.size = 0;
    this.poppedNode = -1;
    this.poppedKey = 0;
  }

  clear() {
    this.size = 0;
  }

  minKey() {
    return this.keys[0];
  }

  push(node, key) {
    if (this.size === this.nodes.length) {
      const nextCap = this.nodes.length * 2;
      const nextNodes = new Int32Array(nextCap);
      const nextKeys = new Float64Array(nextCap);
      nextNodes.set(this.nodes);
      nextKeys.set(this.keys);
      this.nodes = nextNodes;
      this.keys = nextKeys;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.nodes[i] = this.nodes[p];
      this.keys[i] = this.keys[p];
      i = p;
    }
    this.nodes[i] = node;
    this.keys[i] = key;
  }

  pop() {
    this.poppedNode = this.nodes[0];
    this.poppedKey = this.keys[0];
    const last = --this.size;
    if (last > 0) {
      const ln = this.nodes[last];
      const lk = this.keys[last];
      let i = 0;
      while (true) {
        let c = i * 2 + 1;
        if (c >= last) break;
        if (c + 1 < last && this.keys[c + 1] < this.keys[c]) c++;
        if (this.keys[c] >= lk) break;
        this.nodes[i] = this.nodes[c];
        this.keys[i] = this.keys[c];
        i = c;
      }
      this.nodes[i] = ln;
      this.keys[i] = lk;
    }
  }
}

function removeSwap(arr, value) {
  const idx = arr.indexOf(value);
  if (idx !== -1) {
    arr[idx] = arr[arr.length - 1];
    arr.pop();
  }
}

export function getHierarchyTransferables(hierarchy) {
  if (!hierarchy) return [];
  const fields = [
    hierarchy.rank,
    hierarchy.upOutOffsets,
    hierarchy.upOutTargets,
    hierarchy.upOutWeights,
    hierarchy.upOutPoolIdx,
    hierarchy.upInOffsets,
    hierarchy.upInSources,
    hierarchy.upInWeights,
    hierarchy.upInPoolIdx,
    hierarchy.poolFrom,
    hierarchy.poolTo,
    hierarchy.poolMeters,
    hierarchy.poolLeft,
    hierarchy.poolRight,
    hierarchy.poolOrigId,
  ];
  const seen = new Set();
  const list = [];
  for (let i = 0; i < fields.length; i++) {
    const view = fields[i];
    if (view?.buffer instanceof ArrayBuffer && !seen.has(view.buffer)) {
      seen.add(view.buffer);
      list.push(view.buffer);
    }
  }
  return list;
}

export function unpackEdge(
  hierarchy,
  poolEdgeIdx,
  outOrigEdgeIds,
  outRouteNodes,
) {
  if (poolEdgeIdx < 0) return { meters: 0 };
  const { poolLeft, poolRight, poolOrigId, poolMeters, poolTo, idxToId } =
    hierarchy;
  const stack = [poolEdgeIdx];
  let meters = 0;

  while (stack.length > 0) {
    const e = stack.pop();
    const left = poolLeft[e];
    if (left >= 0) {
      stack.push(poolRight[e], left);
    } else {
      meters += poolMeters[e];
      if (outOrigEdgeIds && poolOrigId[e] >= 0) {
        outOrigEdgeIds.push(poolOrigId[e]);
      }
      if (outRouteNodes) {
        const to = poolTo[e];
        outRouteNodes.push(idxToId ? idxToId[to] : to);
      }
    }
  }

  return { meters };
}

export function* contract(input, options = {}) {
  const {
    maxWork = 8000000,
    maxNodeWork = 50000,
    maxPairs = 256,
    progressStep = 500,
  } = options;

  let compact;
  let idxToId = null;
  let idToIdx = null;

  if (input && input.kind === "compact-graph") {
    compact = input;
  } else if (input instanceof Map) {
    const packed = packGraph(input);
    compact = packed.workerPayload;
    idxToId = packed.graphView.idxToId;
    idToIdx = packed.graphView.idToIdx;
  } else {
    throw Error("Unsupported graph input for contraction.");
  }

  const n = compact.nodeCount;
  const edgeCount = compact.edgeCount;

  let poolCap = Math.max(64, edgeCount * 2);
  let poolSize = 0;
  let poolFrom = new Int32Array(poolCap);
  let poolTo = new Int32Array(poolCap);
  let poolSec = new Float64Array(poolCap);
  let poolMet = new Float64Array(poolCap);
  let poolLeft = new Int32Array(poolCap);
  let poolRight = new Int32Array(poolCap);
  let poolOrigId = new Int32Array(poolCap);

  const growPool = () => {
    const nextCap = poolCap * 2;
    const growI32 = (src) => {
      const dst = new Int32Array(nextCap);
      dst.set(src);
      return dst;
    };
    const growF64 = (src) => {
      const dst = new Float64Array(nextCap);
      dst.set(src);
      return dst;
    };
    poolFrom = growI32(poolFrom);
    poolTo = growI32(poolTo);
    poolSec = growF64(poolSec);
    poolMet = growF64(poolMet);
    poolLeft = growI32(poolLeft);
    poolRight = growI32(poolRight);
    poolOrigId = growI32(poolOrigId);
    poolCap = nextCap;
  };

  const addPoolEdge = (from, to, sec, met, left, right, origId) => {
    if (poolSize === poolCap) growPool();
    const id = poolSize++;
    poolFrom[id] = from;
    poolTo[id] = to;
    poolSec[id] = sec;
    poolMet[id] = met;
    poolLeft[id] = left;
    poolRight[id] = right;
    poolOrigId[id] = origId;
    return id;
  };

  const activeOut = Array.from({ length: n }, () => []);
  const activeIn = Array.from({ length: n }, () => []);

  // Load initial edges with O(1) parallel-edge deduplication per source node
  const { outOffsets, outTargets, outSeconds, outMeters, outOrigIds } = compact;
  const dedupSeen = new Uint32Array(n);
  const dedupPos = new Int32Array(n);
  let dedupStamp = 0;

  for (let u = 0; u < n; u++) {
    dedupStamp++;
    const start = outOffsets[u];
    const end = outOffsets[u + 1];
    const uOut = activeOut[u];
    for (let pos = start; pos < end; pos++) {
      const v = outTargets[pos];
      if (v === u || v < 0 || v >= n) continue;
      const sec = outSeconds[pos];
      const met = outMeters[pos];
      const origId = outOrigIds[pos];
      if (dedupSeen[v] === dedupStamp) {
        const existingIdx = uOut[dedupPos[v]];
        if (
          sec < poolSec[existingIdx] ||
          (sec === poolSec[existingIdx] && met < poolMet[existingIdx])
        ) {
          poolSec[existingIdx] = sec;
          poolMet[existingIdx] = met;
          poolOrigId[existingIdx] = origId;
        }
      } else {
        const eIdx = addPoolEdge(u, v, sec, met, -1, -1, origId);
        dedupSeen[v] = dedupStamp;
        dedupPos[v] = uOut.length;
        uOut.push(eIdx);
      }
    }
    for (let i = 0; i < uOut.length; i++) {
      const eIdx = uOut[i];
      activeIn[poolTo[eIdx]].push(eIdx);
    }
  }

  const rank = new Int32Array(n).fill(-1);
  const contractedFlag = new Uint8Array(n);
  const inCore = new Uint8Array(n);
  const contractedNeighbors = new Int32Array(n);
  const level = new Int32Array(n);

  const upOutEdges = new Array(n);
  const upInEdges = new Array(n);

  // Reusable zero-allocation witness search buffers
  const wDist = new Float64Array(n);
  const wHops = new Uint8Array(n);
  const wStamp = new Uint32Array(n);
  const tStamp = new Uint32Array(n);
  const tDone = new Uint32Array(n);
  const tWitnessed = new Uint32Array(n);
  const tBest = new Float64Array(n);
  const wHeap = new IntFloatHeap(256);

  const affStamp = new Uint32Array(n);
  const affList = [];

  let curWStamp = 0;
  let curTStamp = 0;
  let curAffStamp = 0;

  let work = 0;
  let contractedCount = 0;
  let coreCount = 0;
  let processed = 0;

  const runWitnesses = (v, isDryRun, pendingOut) => {
    const ins = activeIn[v];
    const outs = activeOut[v];
    const inDeg = ins.length;
    const outDeg = outs.length;
    if (inDeg === 0 || outDeg === 0) {
      return { shortcutsNeeded: 0, aborted: false };
    }

    let nodeWork = 0;
    let shortcutsNeeded = 0;
    let aborted = false;

    if (!isDryRun) {
      const degCost = inDeg + outDeg;
      work += degCost;
      nodeWork += degCost;
      if (work >= maxWork || nodeWork >= maxNodeWork) {
        return { shortcutsNeeded: 0, aborted: true };
      }
    }

    const hopLimit = isDryRun ? 3 : 5;
    const settledLimit = isDryRun ? 30 : 60;

    for (let i = 0; i < inDeg; i++) {
      const leftIdx = ins[i];
      const u = poolFrom[leftIdx];
      const leftSec = poolSec[leftIdx];
      const leftMet = poolMet[leftIdx];

      curTStamp++;
      if (curTStamp === 0xffffffff) {
        tStamp.fill(0);
        tDone.fill(0);
        tWitnessed.fill(0);
        curTStamp = 1;
      }

      let targetCount = 0;
      for (let j = 0; j < outDeg; j++) {
        const rightIdx = outs[j];
        const w = poolTo[rightIdx];
        if (w === u) continue;
        const need = leftSec + poolSec[rightIdx];
        tStamp[w] = curTStamp;
        tBest[w] = need;
        targetCount++;
      }
      if (targetCount === 0) continue;

      let remaining = targetCount;

      // 1-hop direct-edge witness fast path
      const uOut = activeOut[u];
      for (let k = 0; k < uOut.length; k++) {
        if (!isDryRun) {
          work++;
          nodeWork++;
          if (work >= maxWork || nodeWork >= maxNodeWork) {
            aborted = true;
            break;
          }
        }
        const eIdx = uOut[k];
        const to = poolTo[eIdx];
        if (to === v) continue;
        if (
          tStamp[to] === curTStamp &&
          tDone[to] !== curTStamp &&
          poolSec[eIdx] <= tBest[to]
        ) {
          tDone[to] = curTStamp;
          tWitnessed[to] = curTStamp;
          remaining--;
          if (remaining === 0) break;
        }
      }
      if (aborted) break;

      if (remaining > 0) {
        let limit = -1;
        for (let j = 0; j < outDeg; j++) {
          const w = poolTo[outs[j]];
          if (w !== u && tDone[w] !== curTStamp && tBest[w] > limit) {
            limit = tBest[w];
          }
        }

        curWStamp++;
        if (curWStamp === 0xffffffff) {
          wStamp.fill(0);
          curWStamp = 1;
        }
        wStamp[u] = curWStamp;
        wDist[u] = 0;
        wHops[u] = 0;
        wHeap.clear();
        wHeap.push(u, 0);

        let settled = 0;
        while (wHeap.size > 0 && settled < settledLimit && remaining > 0) {
          wHeap.pop();
          const cur = wHeap.poppedNode;
          const curCost = wHeap.poppedKey;
          if (curCost > limit) break;
          if (curCost !== wDist[cur]) continue;
          settled++;

          if (tStamp[cur] === curTStamp && tDone[cur] !== curTStamp) {
            tDone[cur] = curTStamp;
            if (curCost <= tBest[cur]) {
              tWitnessed[cur] = curTStamp;
            }
            remaining--;
            if (remaining === 0) break;
          }

          const hops = wHops[cur];
          if (hops >= hopLimit) continue;

          const curOut = activeOut[cur];
          const nextHops = hops + 1;
          for (let k = 0; k < curOut.length; k++) {
            if (!isDryRun) {
              work++;
              nodeWork++;
              if (work >= maxWork || nodeWork >= maxNodeWork) {
                aborted = true;
                break;
              }
            }
            const eIdx = curOut[k];
            const next = poolTo[eIdx];
            if (next === v) continue;
            const nc = curCost + poolSec[eIdx];
            if (nc > limit) continue;
            if (wStamp[next] !== curWStamp || nc < wDist[next]) {
              wStamp[next] = curWStamp;
              wDist[next] = nc;
              wHops[next] = nextHops;
              wHeap.push(next, nc);
            }
          }
          if (aborted) break;
        }
        if (aborted) break;
      }

      for (let j = 0; j < outDeg; j++) {
        const rightIdx = outs[j];
        const w = poolTo[rightIdx];
        if (w === u) continue;
        if (tWitnessed[w] !== curTStamp) {
          shortcutsNeeded++;
          if (!isDryRun && pendingOut) {
            pendingOut.push(
              u,
              w,
              leftSec + poolSec[rightIdx],
              leftMet + poolMet[rightIdx],
              leftIdx,
              rightIdx,
            );
          }
        }
      }
    }

    return { shortcutsNeeded, aborted };
  };

  const computePriority = (v) => {
    const inDeg = activeIn[v].length;
    const outDeg = activeOut[v].length;
    let shortcutsNeeded;
    if (inDeg * outDeg > maxPairs) {
      shortcutsNeeded = inDeg * outDeg;
    } else {
      shortcutsNeeded = runWitnesses(v, true, null).shortcutsNeeded;
    }
    return (
      2 * (shortcutsNeeded - (inDeg + outDeg)) +
      contractedNeighbors[v] +
      2 * level[v]
    );
  };

  const commitNode = (v, pendingOut) => {
    const outs = activeOut[v];
    const ins = activeIn[v];

    upOutEdges[v] = outs.slice();
    upInEdges[v] = ins.slice();

    curAffStamp++;
    if (curAffStamp === 0xffffffff) {
      affStamp.fill(0);
      curAffStamp = 1;
    }
    affList.length = 0;

    for (let i = 0; i < outs.length; i++) {
      const eIdx = outs[i];
      const w = poolTo[eIdx];
      removeSwap(activeIn[w], eIdx);
      if (affStamp[w] !== curAffStamp) {
        affStamp[w] = curAffStamp;
        affList.push(w);
      }
    }
    for (let i = 0; i < ins.length; i++) {
      const eIdx = ins[i];
      const u = poolFrom[eIdx];
      removeSwap(activeOut[u], eIdx);
      if (affStamp[u] !== curAffStamp) {
        affStamp[u] = curAffStamp;
        affList.push(u);
      }
    }

    outs.length = 0;
    ins.length = 0;

    for (let p = 0; p < pendingOut.length; p += 6) {
      const u = pendingOut[p];
      const w = pendingOut[p + 1];
      const sec = pendingOut[p + 2];
      const met = pendingOut[p + 3];
      const leftIdx = pendingOut[p + 4];
      const rightIdx = pendingOut[p + 5];

      const uOut = activeOut[u];
      let foundPos = -1;
      for (let k = 0; k < uOut.length; k++) {
        if (poolTo[uOut[k]] === w) {
          foundPos = k;
          break;
        }
      }

      if (foundPos !== -1) {
        const existingIdx = uOut[foundPos];
        if (
          sec < poolSec[existingIdx] ||
          (sec === poolSec[existingIdx] && met < poolMet[existingIdx])
        ) {
          const newIdx = addPoolEdge(u, w, sec, met, leftIdx, rightIdx, -1);
          uOut[foundPos] = newIdx;
          const wIn = activeIn[w];
          const inPos = wIn.indexOf(existingIdx);
          if (inPos !== -1) wIn[inPos] = newIdx;
          else wIn.push(newIdx);
        }
      } else {
        const newIdx = addPoolEdge(u, w, sec, met, leftIdx, rightIdx, -1);
        uOut.push(newIdx);
        activeIn[w].push(newIdx);
      }
    }

    const vRank = contractedCount++;
    rank[v] = vRank;
    contractedFlag[v] = 1;
    const nextLevel = level[v] + 1;

    for (let i = 0; i < affList.length; i++) {
      const x = affList[i];
      contractedNeighbors[x]++;
      if (nextLevel > level[x]) level[x] = nextLevel;
    }
  };

  if (n > 0) {
    if (maxWork <= 0) {
      for (let v = 0; v < n; v++) {
        inCore[v] = 1;
        coreCount++;
        processed++;
      }
      yield {
        contracted: 0,
        processed,
        total: n,
        core: coreCount,
        pct: 100,
      };
    } else {
      const orderHeap = new IntFloatHeap(Math.max(64, n));
      for (let v = 0; v < n; v++) {
        orderHeap.push(v, computePriority(v));
      }

      const pendingOut = [];
      let lazyStreak = 0;

      while (orderHeap.size > 0) {
        orderHeap.pop();
        const v = orderHeap.poppedNode;
        if (contractedFlag[v] || inCore[v]) continue;

        if (work >= maxWork) {
          inCore[v] = 1;
          coreCount++;
          processed++;
          if (processed % progressStep === 0 || processed === n) {
            yield {
              contracted: contractedCount,
              processed,
              total: n,
              core: coreCount,
              pct: Math.round((processed / n) * 100),
            };
          }
          continue;
        }

        if (activeIn[v].length * activeOut[v].length > maxPairs) {
          inCore[v] = 1;
          coreCount++;
          processed++;
          if (processed % progressStep === 0 || processed === n) {
            yield {
              contracted: contractedCount,
              processed,
              total: n,
              core: coreCount,
              pct: Math.round((processed / n) * 100),
            };
          }
          continue;
        }

        const newKey = computePriority(v);
        if (
          orderHeap.size > 0 &&
          newKey > orderHeap.minKey() &&
          lazyStreak < 16
        ) {
          orderHeap.push(v, newKey);
          lazyStreak++;
          continue;
        }
        lazyStreak = 0;

        pendingOut.length = 0;
        const result = runWitnesses(v, false, pendingOut);
        processed++;
        if (result.aborted) {
          inCore[v] = 1;
          coreCount++;
        } else {
          commitNode(v, pendingOut);
        }

        if (processed % progressStep === 0 || processed === n) {
          yield {
            contracted: contractedCount,
            processed,
            total: n,
            core: coreCount,
            pct: Math.round((processed / n) * 100),
          };
        }
      }
    }
  }

  // Finalize core nodes at shared highest rank
  const coreRank = contractedCount;
  for (let v = 0; v < n; v++) {
    if (inCore[v]) {
      rank[v] = coreRank;
      upOutEdges[v] = activeOut[v];
      upInEdges[v] = activeIn[v];
    } else {
      if (!upOutEdges[v]) upOutEdges[v] = [];
      if (!upInEdges[v]) upInEdges[v] = [];
    }
  }

  // Pack CSR upward graphs
  let totalUpOut = 0;
  let totalUpIn = 0;
  for (let v = 0; v < n; v++) {
    totalUpOut += upOutEdges[v].length;
    totalUpIn += upInEdges[v].length;
  }

  const upOutOffsets = new Int32Array(n + 1);
  const upOutTargets = new Int32Array(totalUpOut);
  const upOutWeights = new Float64Array(totalUpOut);
  const upOutPoolIdx = new Int32Array(totalUpOut);

  let pos = 0;
  for (let u = 0; u < n; u++) {
    upOutOffsets[u] = pos;
    const list = upOutEdges[u];
    for (let i = 0; i < list.length; i++) {
      const eIdx = list[i];
      upOutTargets[pos] = poolTo[eIdx];
      upOutWeights[pos] = poolSec[eIdx];
      upOutPoolIdx[pos] = eIdx;
      pos++;
    }
  }
  upOutOffsets[n] = pos;

  const upInOffsets = new Int32Array(n + 1);
  const upInSources = new Int32Array(totalUpIn);
  const upInWeights = new Float64Array(totalUpIn);
  const upInPoolIdx = new Int32Array(totalUpIn);

  pos = 0;
  for (let v = 0; v < n; v++) {
    upInOffsets[v] = pos;
    const list = upInEdges[v];
    for (let i = 0; i < list.length; i++) {
      const eIdx = list[i];
      upInSources[pos] = poolFrom[eIdx];
      upInWeights[pos] = poolSec[eIdx];
      upInPoolIdx[pos] = eIdx;
      pos++;
    }
  }
  upInOffsets[n] = pos;

  const hierarchy = {
    kind: "ch-csr",
    nodeCount: n,
    coreRank,
    coreCount,
    contractedCount,
    work,
    rank,
    upOutOffsets,
    upOutTargets,
    upOutWeights,
    upOutPoolIdx,
    upInOffsets,
    upInSources,
    upInWeights,
    upInPoolIdx,
    poolFrom: poolFrom.slice(0, poolSize),
    poolTo: poolTo.slice(0, poolSize),
    poolMeters: poolMet.slice(0, poolSize),
    poolLeft: poolLeft.slice(0, poolSize),
    poolRight: poolRight.slice(0, poolSize),
    poolOrigId: poolOrigId.slice(0, poolSize),
  };

  if (idxToId && idToIdx) {
    hierarchy.idxToId = idxToId;
    hierarchy.idToIdx = idToIdx;
  }

  return hierarchy;
}

export function* query(hierarchy, start, end, options = {}) {
  const { useStallOnDemand = true } = options;
  const n = hierarchy.nodeCount;
  const {
    coreRank,
    rank,
    upOutOffsets,
    upOutTargets,
    upOutWeights,
    upOutPoolIdx,
    upInOffsets,
    upInSources,
    upInWeights,
    upInPoolIdx,
    idxToId,
    idToIdx,
  } = hierarchy;

  const resolveIdx = (node) => {
    if (idToIdx) {
      const idx = idToIdx.get(node);
      return idx === undefined ? -1 : idx;
    }
    return Number.isInteger(node) && node >= 0 && node < n ? node : -1;
  };

  const startIdx = resolveIdx(start);
  const endIdx = resolveIdx(end);
  if (startIdx < 0 || endIdx < 0) {
    throw Error("Endpoint is outside the road graph.");
  }

  const extStart = idxToId ? idxToId[startIdx] : startIdx;
  if (startIdx === endIdx) {
    yield {
      visited: extStart,
      visitedIdx: startIdx,
      parent: null,
      parentIdx: -1,
      direction: 0,
      edgePoolIdx: -1,
    };
    return {
      route: [extStart],
      edgeIds: [],
      seconds: 0,
      meters: 0,
      meeting: extStart,
      visitedCount: 1,
      stalledCount: 0,
    };
  }

  const d0 = new Float64Array(n).fill(Infinity);
  const d1 = new Float64Array(n).fill(Infinity);
  const parentNode0 = new Int32Array(n).fill(-1);
  const parentEdge0 = new Int32Array(n).fill(-1);
  const parentNode1 = new Int32Array(n).fill(-1);
  const parentEdge1 = new Int32Array(n).fill(-1);

  const q0 = new IntFloatHeap(64);
  const q1 = new IntFloatHeap(64);

  d0[startIdx] = 0;
  d1[endIdx] = 0;
  q0.push(startIdx, 0);
  q1.push(endIdx, 0);

  let best = Infinity;
  let meetingIdx = -1;
  let visitedCount = 0;
  let stalledCount = 0;

  while (
    (q0.size > 0 && q0.minKey() <= best) ||
    (q1.size > 0 && q1.minKey() <= best)
  ) {
    for (let direction = 0; direction < 2; direction++) {
      const q = direction === 0 ? q0 : q1;
      if (q.size === 0 || q.minKey() > best) continue;

      q.pop();
      const u = q.poppedNode;
      const cost = q.poppedKey;
      const dist = direction === 0 ? d0 : d1;
      if (cost !== dist[u]) continue;

      visitedCount++;

      const pIdx = direction === 0 ? parentNode0[u] : parentNode1[u];
      const ePoolIdx = direction === 0 ? parentEdge0[u] : parentEdge1[u];
      yield {
        visited: idxToId ? idxToId[u] : u,
        visitedIdx: u,
        parent: pIdx >= 0 ? (idxToId ? idxToId[pIdx] : pIdx) : null,
        parentIdx: pIdx,
        direction,
        edgePoolIdx: ePoolIdx,
      };

      const otherDist = direction === 0 ? d1 : d0;
      const sum = cost + otherDist[u];
      if (sum < best) {
        best = sum;
        meetingIdx = u;
      }

      if (useStallOnDemand && rank[u] < coreRank) {
        let stalled = false;
        if (direction === 0) {
          const s = upInOffsets[u];
          const e = upInOffsets[u + 1];
          for (let i = s; i < e; i++) {
            if (d0[upInSources[i]] + upInWeights[i] < cost) {
              stalled = true;
              break;
            }
          }
        } else {
          const s = upOutOffsets[u];
          const e = upOutOffsets[u + 1];
          for (let i = s; i < e; i++) {
            if (d1[upOutTargets[i]] + upOutWeights[i] < cost) {
              stalled = true;
              break;
            }
          }
        }
        if (stalled) {
          stalledCount++;
          continue;
        }
      }

      if (direction === 0) {
        const s = upOutOffsets[u];
        const e = upOutOffsets[u + 1];
        for (let i = s; i < e; i++) {
          const next = upOutTargets[i];
          const nc = cost + upOutWeights[i];
          if (nc < d0[next]) {
            d0[next] = nc;
            parentNode0[next] = u;
            parentEdge0[next] = upOutPoolIdx[i];
            q0.push(next, nc);
          }
        }
      } else {
        const s = upInOffsets[u];
        const e = upInOffsets[u + 1];
        for (let i = s; i < e; i++) {
          const next = upInSources[i];
          const nc = cost + upInWeights[i];
          if (nc < d1[next]) {
            d1[next] = nc;
            parentNode1[next] = u;
            parentEdge1[next] = upInPoolIdx[i];
            q1.push(next, nc);
          }
        }
      }
    }
  }

  if (meetingIdx === -1) return null;

  const fwdEdges = [];
  for (let v = meetingIdx; v !== startIdx; v = parentNode0[v]) {
    fwdEdges.push(parentEdge0[v]);
  }
  fwdEdges.reverse();

  const bwdEdges = [];
  for (let v = meetingIdx; v !== endIdx; v = parentNode1[v]) {
    bwdEdges.push(parentEdge1[v]);
  }

  const route = [extStart];
  const edgeIds = [];
  let meters = 0;

  for (let i = 0; i < fwdEdges.length; i++) {
    meters += unpackEdge(hierarchy, fwdEdges[i], edgeIds, route).meters;
  }
  for (let i = 0; i < bwdEdges.length; i++) {
    meters += unpackEdge(hierarchy, bwdEdges[i], edgeIds, route).meters;
  }

  return {
    route,
    edgeIds,
    seconds: best,
    meters,
    meeting: idxToId ? idxToId[meetingIdx] : meetingIdx,
    visitedCount,
    stalledCount,
  };
}
