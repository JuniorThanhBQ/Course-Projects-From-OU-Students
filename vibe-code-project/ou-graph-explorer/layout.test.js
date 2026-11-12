import { test } from "node:test";
import assert from "node:assert/strict";

import { ALL, NODES, LINKS, CATEGORIES } from "./data.js";
import { layout, bounds, neighbourhood } from "./layout.js";

const opts = { radius: 360, ring: 352, iterations: 520, minGap: 84, seed: 20261112 };

test("layout returns a finite position for every node", () => {
  const pos = layout(ALL, LINKS, opts);
  assert.equal(pos.size, ALL.length);
  for (const n of ALL) {
    const p = pos.get(n.id);
    assert.ok(p, `${n.id} missing`);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${n.id} not finite`);
  }
});

test("layout is deterministic for the same seed", () => {
  const a = layout(ALL, LINKS, opts);
  const b = layout(ALL, LINKS, opts);
  for (const n of ALL) {
    assert.deepEqual(a.get(n.id), b.get(n.id), `${n.id} differs between runs`);
  }
});

test("the root stays at the centre of the drawing", () => {
  const pos = layout(ALL, LINKS, opts);
  const root = pos.get("root");
  assert.ok(Math.abs(root.x) < 1 && Math.abs(root.y) < 1, "root drifted");
});

test("leaves settle farther from the centre than the root", () => {
  const pos = layout(ALL, LINKS, opts);
  const root = pos.get("root");
  const distances = NODES.map((n) => {
    const p = pos.get(n.id);
    return Math.hypot(p.x - root.x, p.y - root.y);
  });
  assert.ok(Math.min(...distances) > 120, "a leaf collapsed onto the root");
  assert.ok(Math.max(...distances) < 800, "a leaf flew off the canvas");
});

test("no two nodes sit closer than the collision gap allows", () => {
  const pos = layout(ALL, LINKS, opts);
  const ids = ALL.map((n) => n.id);
  let worst = Infinity;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = pos.get(ids[i]);
      const b = pos.get(ids[j]);
      worst = Math.min(worst, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  assert.ok(worst > 40, `two nodes overlap (min distance ${worst.toFixed(1)})`);
});

test("the layout fits inside the 900x900 viewBox", () => {
  const pos = layout(ALL, LINKS, opts);
  const b = bounds(pos);
  assert.ok(b.minX > -430 && b.maxX < 430, `x out of range: ${b.minX}..${b.maxX}`);
  assert.ok(b.minY > -430 && b.maxY < 430, `y out of range: ${b.minY}..${b.maxY}`);
});

test("layout handles a single isolated node", () => {
  const pos = layout([{ id: "root", cat: "root" }], [], { ...opts, iterations: 10 });
  const root = pos.get("root");
  assert.equal(root.x, 0);
  assert.equal(root.y, 0);
  assert.ok(Object.is(root.x, 0) || Object.is(root.x, -0));
});

test("neighbourhood of the root reaches every node", () => {
  const set = neighbourhood(LINKS, "root");
  assert.equal(set.size, ALL.length);
});

test("neighbourhood of a leaf contains only the root and itself", () => {
  const set = neighbourhood(LINKS, "it");
  assert.deepEqual([...set].sort(), ["it", "root"]);
});

test("every category is represented in the graph", () => {
  const used = new Set(NODES.map((n) => n.cat));
  for (const c of CATEGORIES) assert.ok(used.has(c.id), `${c.id} has no node`);
});

/**
 * Radial labels are anchored at the node and run outward, so two labels can
 * only collide if their angular spans overlap. This mirrors the geometry used
 * by app.js and fails loudly if a dataset edit makes the ring unreadable.
 */
test("radial labels do not overlap anywhere on the ring", () => {
  const pos = layout(ALL, LINKS, opts);
  const CHAR = 6.6; // px per character at 12.5px font + PAD parity with layout.js
  const spans = NODES.map((n) => {
    const p = pos.get(n.id);
    const r = Math.hypot(p.x, p.y);
    const text = n.display ?? n.short;
    const width = text.length * CHAR + 12; // plus the r+9 gap
    // Angular half-width, using the outer edge of the label.
    const half = Math.atan2(width / 2, r + width / 2);
    return { id: n.id, a: Math.atan2(p.y, p.x), half };
  }).sort((x, y) => x.a - y.a);

  for (let i = 0; i < spans.length; i++) {
    const cur = spans[i];
    const next = spans[(i + 1) % spans.length];
    let gap = next.a - cur.a;
    if (i === spans.length - 1) gap += Math.PI * 2;
    assert.ok(
      gap > cur.half + next.half,
      `labels overlap: ${cur.id} -> ${next.id} (gap ${gap.toFixed(3)} < ${(cur.half + next.half).toFixed(3)})`,
    );
  }
});
