export function distance(a, b) {
  const r = Math.PI / 180,
    p = (b[0] - a[0]) * r,
    q = (b[1] - a[1]) * r;
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
export function graphFromOSM(data, mode) {
  const nodes = new Map(
    data.elements
      .filter((e) => e.type === "node")
      .map((n) => [n.id, { id: n.id, ll: [n.lat, n.lon], edges: [] }]),
  );
  const speeds =
    mode === "car"
      ? {
          primary: 35,
          secondary: 30,
          tertiary: 25,
          residential: 18,
          service: 12,
        }
      : {
          primary: 30,
          secondary: 28,
          tertiary: 25,
          residential: 22,
          service: 15,
        };
  for (const w of data.elements.filter((e) => e.type === "way")) {
    const t = w.tags || {},
      h = t.highway;
    if (
      !h ||
      /^(footway|path|steps|cycleway|pedestrian|construction|proposed|motorway|motorway_link)$/.test(
        h,
      )
    )
      continue;
    const access =
      t[mode === "car" ? "motorcar" : "motorcycle"] ??
      t.motor_vehicle ??
      t.vehicle ??
      t.access;
    if (["no", "private", "agricultural", "forestry"].includes(access))
      continue;
    const speed = Math.min(
      speeds[h.replace("_link", "")] || 18,
      Number(t.maxspeed) > 0 ? Number(t.maxspeed) : Infinity,
    );
    const one =
      t[mode === "motorbike" ? "oneway:motorcycle" : "oneway:motorcar"] ??
      t.oneway ??
      (t.junction === "roundabout" ? "yes" : "no");
    for (let i = 1; i < w.nodes.length; i++) {
      const a = nodes.get(w.nodes[i - 1]),
        b = nodes.get(w.nodes[i]);
      if (!a || !b) continue;
      const meters = distance(a.ll, b.ll),
        seconds = meters / (speed / 3.6);
      if (one !== "-1") a.edges.push({ to: b.id, seconds, meters });
      if (!["yes", "1", "true"].includes(one))
        b.edges.push({ to: a.id, seconds, meters });
    }
  }
  const used = new Set();
  for (const n of nodes.values())
    for (const edge of n.edges) {
      used.add(n.id);
      used.add(edge.to);
    }
  return new Map([...nodes].filter(([id]) => used.has(id)));
}
class Heap {
  a = [];
  push(x) {
    let i = this.a.length;
    this.a.push(x);
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p].f <= x.f) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = x;
  }
  pop() {
    const root = this.a[0],
      last = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1].f < this.a[c].f) c++;
        if (this.a[c].f >= last.f) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = last;
    }
    return root;
  }
}
export function* search(graph, start, end, { dijkstra = false } = {}) {
  if (!graph.has(start) || !graph.has(end))
    throw Error("Endpoint is outside the routable graph.");
  const heap = new Heap(),
    cost = new Map([[start, 0]]),
    prev = new Map();
  const heuristic = (id) =>
    dijkstra ? 0 : distance(graph.get(id).ll, graph.get(end).ll) / (35 / 3.6);
  heap.push({ id: start, g: 0, f: heuristic(start) });
  while (heap.a.length) {
    const current = heap.pop();
    if (current.g !== cost.get(current.id)) continue;
    yield { visited: current.id };
    if (current.id === end) {
      const route = [end];
      let meters = 0;
      while (route[0] !== start) {
        const p = prev.get(route[0]);
        meters += p.edge.meters;
        route.unshift(p.id);
      }
      return { route, seconds: current.g, meters };
    }
    for (const edge of graph.get(current.id).edges) {
      if (!graph.has(edge.to)) continue;
      const g = current.g + edge.seconds;
      if (g < (cost.get(edge.to) ?? Infinity)) {
        cost.set(edge.to, g);
        prev.set(edge.to, { id: current.id, edge });
        heap.push({ id: edge.to, g, f: g + heuristic(edge.to) });
      }
    }
  }
  return null;
}
export function nearest(graph, ll) {
  let best = null,
    d = Infinity;
  for (const n of graph.values()) {
    const x = distance(n.ll, ll);
    if (x < d) {
      best = n.id;
      d = x;
    }
  }
  if (d > 1500) throw Error("No road within 1.5 km of this campus.");
  return best;
}
