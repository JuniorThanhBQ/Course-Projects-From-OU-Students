// Deterministic force-directed layout for a single-level star graph.
//
// The graph is always "ou.edu.vn plus n leaves". A general Fruchterman–Reingold
// pass with a raw d^2/k attraction collapses every leaf onto the centre, so
// each edge is modelled as a spring with a rest length instead. That produces a
// predictable ring, and repulsion plus a collision pass keep labels apart.
// No DOM access here, so the module is unit tested.

const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed a grouped ring: one contiguous arc per category, root at the centre. */
function seedPositions(nodes, categories, ring, rand) {
  const groups = new Map();
  for (const n of nodes) {
    if (n.id === "root") continue;
    if (!groups.has(n.cat)) groups.set(n.cat, []);
    groups.get(n.cat).push(n);
  }
  const declared = categories.map((c) => c.id);
  const order = declared
    .filter((id) => groups.has(id))
    .concat([...groups.keys()].filter((id) => !declared.includes(id)));

  const total = [...groups.values()].reduce((a, g) => a + g.length, 0) || 1;
  const pos = new Map();
  let angle = -Math.PI / 2;

  for (const cat of order) {
    const group = groups.get(cat) ?? [];
    const span = (group.length / total) * TAU;
    const pad = group.length > 1 ? Math.min(span * 0.06, 0.08) : 0;
    const step = group.length > 1 ? (span - pad * 2) / (group.length - 1) : 0;
    group.forEach((n, i) => {
      const a = angle + pad + step * i;
      const r = ring * (0.97 + rand() * 0.06);
      pos.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    });
    angle += span;
  }
  pos.set("root", { x: 0, y: 0 });
  return pos;
}

/**
 * @param {Array<{id:string, cat:string}>} nodes
 * @param {Array<{source:string,target:string}>} links
 * @param {object} options ring, iterations, seed, minGap, categories
 * @returns {Map<string, {x:number,y:number}>}
 */
export function layout(nodes, links, options = {}) {
  const ring = options.ring ?? 352;
  const iterations = options.iterations ?? 520;
  const categories = options.categories ?? [];
  const minGap = options.minGap ?? 84;
  const rand = mulberry32(options.seed ?? 0x5eed);

  const ids = nodes.map((n) => n.id);
  const pos = seedPositions(nodes, categories, ring, rand);
  const leaves = ids.filter((id) => id !== "root");

  // Rest length sits a little under the target ring: at equilibrium the
  // springs stretch until they balance repulsion.
  const rest = ring * 0.82;
  const springK = 0.05;
  const radialK = 0.09;
  const repulsion = 5200;
  const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));

  let temperature = ring * 0.12;
  const cooling = temperature / (iterations + 1);

  for (let step = 0; step < iterations; step++) {
    for (const v of disp.values()) {
      v.x = 0;
      v.y = 0;
    }

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i]);
        const b = pos.get(ids[j]);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const t = rand() * TAU;
          dx = Math.cos(t);
          dy = Math.sin(t);
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const f = repulsion / d2;
        const ux = (dx / d) * f;
        const uy = (dy / d) * f;
        disp.get(ids[i]).x += ux;
        disp.get(ids[i]).y += uy;
        disp.get(ids[j]).x -= ux;
        disp.get(ids[j]).y -= uy;
      }
    }

    for (const l of links) {
      const a = pos.get(l.source);
      const b = pos.get(l.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const f = (d - rest) * springK;
      const ux = (dx / d) * f;
      const uy = (dy / d) * f;
      disp.get(l.source).x += ux;
      disp.get(l.source).y += uy;
      disp.get(l.target).x -= ux;
      disp.get(l.target).y -= uy;
    }

    for (const id of leaves) {
      const p = pos.get(id);
      const d = Math.hypot(p.x, p.y);
      if (d < 0.01) continue;
      const f = (d - ring) * radialK;
      disp.get(id).x -= (p.x / d) * f;
      disp.get(id).y -= (p.y / d) * f;
    }

    for (const id of ids) {
      if (id === "root") {
        pos.get(id).x = 0;
        pos.get(id).y = 0;
        continue;
      }
      const v = disp.get(id);
      const p = pos.get(id);
      const len = Math.hypot(v.x, v.y) || 0.001;
      const capped = Math.min(len, temperature);
      p.x += (v.x / len) * capped;
      p.y += (v.y / len) * capped;
    }
    temperature = Math.max(temperature - cooling, 0.01);
  }

  // Angular collision relief. A uniform chord gap is wrong here: labels are
  // rotated outward, so "Special Training" needs roughly twice the angular
  // room of "IT". Each leaf therefore carries its own half-angle derived from
  // its rendered label width, and overlapping pairs are pushed apart along the
  // ring by exactly the deficit.
  const CHAR = options.charWidth ?? 6.6;
  const PAD = 0.012; // radians of breathing room between neighbours
  const halfAngle = new Map();
  for (const n of nodes) {
    if (n.id === "root") continue;
    const p = pos.get(n.id);
    const radius = Math.max(Math.hypot(p.x, p.y), 1);
    const text = n.display ?? n.short ?? n.id;
    const width = text.length * CHAR + 12; // + the outward gap
    halfAngle.set(n.id, width / 2 / radius);
  }

  for (let pass = 0; pass < 600; pass++) {
    let moved = false;
    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const idA = leaves[i];
        const idB = leaves[j];
        const a = pos.get(idA);
        const b = pos.get(idB);
        const angA = Math.atan2(a.y, a.x);
        const angB = Math.atan2(b.y, b.x);

        let delta = angB - angA;
        while (delta > Math.PI) delta -= TAU;
        while (delta < -Math.PI) delta += TAU;

        const need = (halfAngle.get(idA) ?? 0) + (halfAngle.get(idB) ?? 0) + PAD;
        const gap = Math.abs(delta);
        if (gap >= need) continue;

        moved = true;
        const push = (need - gap) / 2;
        const dir = delta >= 0 ? 1 : -1;
        const ra = Math.hypot(a.x, a.y);
        const rb = Math.hypot(b.x, b.y);
        const ta = angA - dir * push;
        const tb = angB + dir * push;
        a.x = Math.cos(ta) * ra;
        a.y = Math.sin(ta) * ra;
        b.x = Math.cos(tb) * rb;
        b.y = Math.sin(tb) * rb;
      }
    }
    if (!moved) break;
  }

  const round = (v) => Math.round(v * 100) / 100;
  for (const p of pos.values()) {
    p.x = round(p.x);
    p.y = round(p.y);
  }
  const root = pos.get("root");
  root.x = 0;
  root.y = 0;
  return pos;
}

export function bounds(positions) {
  const xs = [...positions.values()].map((p) => p.x);
  const ys = [...positions.values()].map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** Node ids connected to `id`, including itself. */
export function neighbourhood(links, id) {
  const set = new Set([id]);
  for (const l of links) {
    if (l.source === id) set.add(l.target);
    else if (l.target === id) set.add(l.source);
  }
  return set;
}
