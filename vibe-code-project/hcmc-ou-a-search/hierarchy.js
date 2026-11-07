class Queue {
  items = [];
  push(value) {
    let i = this.items.length;
    this.items.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].cost <= value.cost) break;
      this.items[i] = this.items[p];
      i = p;
    }
    this.items[i] = value;
  }
  pop() {
    const result = this.items[0],
      last = this.items.pop();
    if (this.items.length) {
      let i = 0;
      while (2 * i + 1 < this.items.length) {
        let c = 2 * i + 1;
        if (
          c + 1 < this.items.length &&
          this.items[c + 1].cost < this.items[c].cost
        )
          c++;
        if (this.items[c].cost >= last.cost) break;
        this.items[i] = this.items[c];
        i = c;
      }
      this.items[i] = last;
    }
    return result;
  }
}

export function* contract(
  graph,
  { maxWork = 2000000, maxNodeWork = 20000, maxPairs = 64 } = {},
) {
  const out = new Map(),
    incoming = new Map(),
    rank = new Map();
  let work = 0;
  const core = new Set();
  const cheapest = (edges) => {
    const best = new Map();
    for (const edge of edges) {
      const key = `${edge.from}:${edge.to}`;
      if (!best.has(key) || edge.seconds < best.get(key).seconds)
        best.set(key, edge);
    }
    return [...best.values()];
  };
  for (const id of graph.keys()) {
    out.set(id, []);
    incoming.set(id, []);
  }
  const add = (edge) => {
    out.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  };
  for (const [id, node] of graph)
    for (const edge of node.edges) {
      if (graph.has(edge.to) && id !== edge.to) add({ ...edge, from: id });
    }
  const order = [...graph.keys()].sort(
    (a, b) =>
      out.get(a).length * incoming.get(a).length -
      out.get(b).length * incoming.get(b).length,
  );
  let processed = 0;
  for (const v of order) {
    processed++;
    if (work >= maxWork) {
      core.add(v);
      yield {
        contracted: rank.size,
        processed,
        total: graph.size,
        core: core.size,
      };
      continue;
    }
    const ins = cheapest(incoming.get(v).filter((e) => !rank.has(e.from)));
    const outs = cheapest(out.get(v).filter((e) => !rank.has(e.to)));
    work += incoming.get(v).length + out.get(v).length;
    if (ins.length * outs.length > maxPairs) {
      core.add(v);
      yield {
        contracted: rank.size,
        processed,
        total: graph.size,
        core: core.size,
      };
      continue;
    }
    let nodeWork = 0,
      aborted = false;
    const pending = [];
    for (const left of ins) {
      const limit = Math.max(
        0,
        ...outs.map((right) => left.seconds + right.seconds),
      );
      const costs = new Map([[left.from, 0]]),
        queue = new Queue();
      queue.push({ id: left.from, cost: 0 });
      let settled = 0;
      while (queue.items.length && settled < 200) {
        const current = queue.pop();
        if (current.cost !== costs.get(current.id)) continue;
        if (current.cost > limit) break;
        settled++;
        for (const edge of out.get(current.id)) {
          work++;
          nodeWork++;
          if (work >= maxWork || nodeWork >= maxNodeWork) {
            aborted = true;
            break;
          }
          if (edge.to === v || rank.has(edge.to)) continue;
          const cost = current.cost + edge.seconds;
          if (cost <= limit && cost < (costs.get(edge.to) ?? Infinity)) {
            costs.set(edge.to, cost);
            queue.push({ id: edge.to, cost });
          }
        }
        if (aborted) break;
      }
      if (aborted) break;
      for (const right of outs) {
        const seconds = left.seconds + right.seconds;
        if (
          left.from !== right.to &&
          (costs.get(right.to) ?? Infinity) > seconds
        ) {
          pending.push({
            from: left.from,
            to: right.to,
            seconds,
            meters: left.meters + right.meters,
            children: [left, right],
          });
        }
      }
    }
    if (aborted) core.add(v);
    else {
      for (const edge of cheapest(pending)) add(edge);
      rank.set(v, rank.size);
    }
    yield {
      contracted: rank.size,
      processed,
      total: graph.size,
      core: core.size,
    };
  }
  const coreRank = rank.size;
  for (const v of core) rank.set(v, coreRank);
  return { out, incoming, rank, core, work };
}

export function* query(hierarchy, start, end) {
  const { out, incoming, rank } = hierarchy;
  if (!rank.has(start) || !rank.has(end))
    throw Error("Endpoint is outside the road graph.");
  const queues = [new Queue(), new Queue()],
    costs = [new Map([[start, 0]]), new Map([[end, 0]])],
    parents = [new Map(), new Map()];
  queues[0].push({ id: start, cost: 0 });
  queues[1].push({ id: end, cost: 0 });
  let best = Infinity,
    meeting;
  while (queues.some((q) => q.items.length && q.items[0].cost <= best)) {
    for (let direction = 0; direction < 2; direction++) {
      const queue = queues[direction];
      if (!queue.items.length || queue.items[0].cost > best) continue;
      const current = queue.pop();
      if (current.cost !== costs[direction].get(current.id)) continue;
      yield { visited: current.id, direction };
      const sum =
        current.cost + (costs[1 - direction].get(current.id) ?? Infinity);
      if (sum < best) {
        best = sum;
        meeting = current.id;
      }
      for (const edge of (direction ? incoming : out).get(current.id)) {
        const next = direction ? edge.from : edge.to;
        if (rank.get(next) < rank.get(current.id)) continue;
        const cost = current.cost + edge.seconds;
        if (cost < (costs[direction].get(next) ?? Infinity)) {
          costs[direction].set(next, cost);
          parents[direction].set(next, edge);
          queue.push({ id: next, cost });
        }
      }
    }
  }
  if (meeting === undefined) return null;
  const edges = [];
  for (let v = meeting; v !== start;) {
    const edge = parents[0].get(v);
    edges.push(edge);
    v = edge.from;
  }
  edges.reverse();
  for (let v = meeting; v !== end;) {
    const edge = parents[1].get(v);
    edges.push(edge);
    v = edge.to;
  }
  const stack = edges.reverse(),
    route = [start];
  let meters = 0;
  while (stack.length) {
    const edge = stack.pop();
    if (edge.children) stack.push(edge.children[1], edge.children[0]);
    else {
      route.push(edge.to);
      meters += edge.meters;
    }
  }
  return { route, seconds: best, meters };
}
