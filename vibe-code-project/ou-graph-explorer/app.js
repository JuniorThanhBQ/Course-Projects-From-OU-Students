import { ALL, NODES, LINKS, CATEGORIES, CATEGORY_COLOR, ROOT } from "./data.js";
import { layout, neighbourhood } from "./layout.js";

const NS = "http://www.w3.org/2000/svg";
const WIDTH = 900;
const HEIGHT = 900;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.2;

const svg = document.getElementById("graph");
const viewport = document.getElementById("viewport");
const linkLayer = document.getElementById("links");
const nodeLayer = document.getElementById("nodes");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const resetEl = document.getElementById("reset");

const RADIUS = {
  root: 30,
  faculty: 15,
  service: 13,
  support: 13,
  publication: 13,
  campus: 13,
};

const positions = layout(ALL, LINKS, {
  radius: 360,
  ring: 352,
  iterations: 520,
  minGap: 84,
  seed: 20261112,
});

/* ------------------------------------------------------------------ render */

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const linkEls = new Map(); // target id -> line element
const nodeEls = new Map(); // id -> <g>

function render() {
  for (const link of LINKS) {
    const a = positions.get(link.source);
    const b = positions.get(link.target);
    const line = el("line", {
      class: "link",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
    });
    linkLayer.append(line);
    linkEls.set(link.target, line);
  }

  for (const n of ALL) {
    const p = positions.get(n.id);
    const isRoot = n.id === "root";
    const r = RADIUS[n.cat] ?? 13;
    const color = CATEGORY_COLOR[n.cat] ?? "#94a3b8";

    const g = el("g", {
      class: `node${isRoot ? " node-root" : ""}`,
      transform: `translate(${p.x} ${p.y})`,
      tabindex: "0",
      role: "link",
      "aria-label": `${n.label} — ${n.host}. Opens in a new tab.`,
      color,
    });

    g.append(
      el("circle", { class: "halo", r: r * 2.6 }),
      el("circle", { class: "ring", r }),
      el("circle", { class: "core", r: Math.max(3.2, r * 0.34) }),
    );

    // Labels run outward along the radius. Long hostnames placed horizontally
    // on a 26-node ring overlap each other, so each label is rotated to its own
    // outward direction and flipped on the left half so it never reads upside
    // down.
    const angle = Math.atan2(p.y, p.x);
    const onLeft = Math.cos(angle) < 0;
    const deg = (angle * 180) / Math.PI;
    const textAngle = onLeft ? deg + 180 : deg;
    const anchor = onLeft ? "end" : "start";
    const labelX = onLeft ? -(r + 9) : r + 9;

    const label = el("text", {
      class: "label",
      x: labelX,
      y: 4,
      "text-anchor": anchor,
      transform: `rotate(${textAngle.toFixed(2)})`,
    });
    label.textContent = n.display ?? n.short;
    g.append(label);

    if (isRoot) {
      const sub = el("text", { class: "sublabel", y: r + 22, "text-anchor": "middle" });
      sub.textContent = "main site";
      g.append(sub);
    }

    bindNode(g, n);
    nodeLayer.append(g);
    nodeEls.set(n.id, g);
  }
}

/* --------------------------------------------------------------- highlight */

let pinned = null;

function setHighlight(id) {
  const related = id ? neighbourhood(LINKS, id) : null;
  for (const [nodeId, g] of nodeEls) {
    const on = !related || related.has(nodeId);
    g.classList.toggle("is-dim", !on);
    g.classList.toggle("is-hot", Boolean(id) && id === nodeId);
  }
  for (const [targetId, line] of linkEls) {
    const active = Boolean(related) && related.has(targetId);
    line.classList.toggle("is-active", active);
    line.classList.toggle("is-dim", Boolean(related) && !active);
  }
}

function clearHighlight() {
  if (pinned) return setHighlight(pinned);
  for (const g of nodeEls.values()) g.classList.remove("is-dim", "is-hot");
  for (const line of linkEls.values()) line.classList.remove("is-active", "is-dim");
}

/* --------------------------------------------------------------- selection */

const detailTitle = document.getElementById("detail-title");
const detailBody = document.getElementById("detail-body");
const detailUrl = document.getElementById("detail-url");

function showDetail(n) {
  detailTitle.textContent = n.label;
  const cat = CATEGORIES.find((c) => c.id === n.cat);
  const base =
    n.id === "root"
      ? "The main university website. Every other node is a publicly reachable sub-site of this domain."
      : `${cat ? cat.label : "Website"} · click the node to open it in a new tab.`;
  detailBody.textContent = n.httpOnly
    ? `${base} This host does not offer HTTPS, so the link opens over plain HTTP.`
    : base;
  detailUrl.textContent = n.url;
  const existing = document.getElementById("detail-open");
  if (existing) existing.remove();
  const a = document.createElement("a");
  a.id = "detail-open";
  a.className = "ghost-btn detail-open";
  a.href = n.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "Open website ↗";
  detailUrl.after(a);
}

function openNode(n) {
  showDetail(n);
  pinned = n.id;
  setHighlight(n.id);
  // noreferrer also implies noopener in modern browsers; both are stated
  // explicitly and the link markup repeats them.
  window.open(n.url, "_blank", "noopener,noreferrer");
}

function bindNode(g, n) {
  g.addEventListener("pointerenter", () => setHighlight(n.id));
  g.addEventListener("pointerleave", clearHighlight);
  g.addEventListener("focus", () => setHighlight(n.id));
  g.addEventListener("blur", clearHighlight);
  g.addEventListener("click", (e) => {
    e.stopPropagation();
    openNode(n);
  });
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openNode(n);
    }
  });
}

/* ------------------------------------------------------------- zoom and pan */

let scale = 1;
let tx = 0;
let ty = 0;

function applyTransform() {
  viewport.setAttribute(
    "transform",
    `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})`,
  );
}

function clampScale(v) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
}

function zoomAt(factor, cx, cy) {
  const next = clampScale(scale * factor);
  if (next === scale) return;
  const ratio = next / scale;
  tx = cx - (cx - tx) * ratio;
  ty = cy - (cy - ty) * ratio;
  scale = next;
  applyTransform();
}

function toGraphSpace(clientX, clientY) {
  const box = svg.getBoundingClientRect();
  // viewBox is square and preserveAspectRatio is "meet", so use the smaller side.
  const size = Math.min(box.width, box.height);
  const offsetX = box.left + (box.width - size) / 2;
  const offsetY = box.top + (box.height - size) / 2;
  return {
    x: ((clientX - offsetX) / size) * WIDTH,
    y: ((clientY - offsetY) / size) * HEIGHT,
  };
}

const pointers = new Map();
let dragStart = null;
let pinchStart = null;
let didDrag = false;

svg.addEventListener("pointerdown", (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    dragStart = { x: e.clientX, y: e.clientY, tx, ty };
    didDrag = false;
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      scale,
      centre: toGraphSpace((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  }
});

svg.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart.dist > 0) {
      // Target absolute scale, then zoom relatively to reach it.
      const target = clampScale(pinchStart.scale * (dist / pinchStart.dist));
      zoomAt(target / scale, pinchStart.centre.x, pinchStart.centre.y);
    }
    return;
  }

  if (!dragStart) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  if (!didDrag && Math.hypot(dx, dy) < 4) return;
  didDrag = true;
  svg.classList.add("is-panning");
  const size = Math.min(svg.getBoundingClientRect().width, svg.getBoundingClientRect().height) || 1;
  // Convert the pointer delta from screen pixels to viewBox units.
  const unit = WIDTH / size;
  tx = dragStart.tx + dx * unit;
  ty = dragStart.ty + dy * unit;
  applyTransform();
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 0) {
    dragStart = null;
    svg.classList.remove("is-panning");
  }
}

// Window-level so that a drag released outside the SVG still ends cleanly.
window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);

svg.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const p = toGraphSpace(e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * 0.0016), p.x, p.y);
  },
  { passive: false },
);

svg.addEventListener("click", () => {
  if (didDrag) return;
  pinned = null;
  clearHighlight();
});

/* ------------------------------------------------------------------ search */

function applySearch(raw) {
  const q = raw.trim().toLowerCase();
  if (!q) {
    for (const g of nodeEls.values()) g.classList.remove("is-match", "is-searchdim");
    for (const line of linkEls.values()) line.classList.remove("is-searchdim");
    clearHighlight();
    statusEl.hidden = true;
    return;
  }
  let hits = 0;
  for (const n of ALL) {
    const haystack = `${n.label} ${n.short} ${n.host}`.toLowerCase();
    const match = haystack.includes(q);
    if (match) hits++;
    nodeEls.get(n.id).classList.toggle("is-match", match);
    nodeEls.get(n.id).classList.toggle("is-searchdim", !match);
  }
  for (const line of linkEls.values()) line.classList.add("is-searchdim");
  statusEl.hidden = false;
  statusEl.textContent = hits
    ? `${hits} matching website${hits === 1 ? "" : "s"}`
    : "No website matches that search.";
}

searchEl.addEventListener("input", (e) => applySearch(e.target.value));
searchEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const first = ALL.find((n) =>
    `${n.label} ${n.short} ${n.host}`.toLowerCase().includes(searchEl.value.trim().toLowerCase()),
  );
  if (first) showDetail(first);
});

resetEl.addEventListener("click", () => {
  scale = 1;
  tx = 0;
  ty = 0;
  pinned = null;
  searchEl.value = "";
  applySearch("");
  applyTransform();
});

/* --------------------------------------------------------------- directory */

function buildDirectory() {
  // The directory markup is static HTML so it survives without JavaScript.
  // Here we only add the hover-to-highlight behaviour and fill the legend.
  const legend = document.getElementById("legend");
  legend.replaceChildren();

  for (const li of document.querySelectorAll("#directory-list li[data-node-id]")) {
    const id = li.dataset.nodeId;
    li.addEventListener("mouseenter", () => setHighlight(id));
    li.addEventListener("mouseleave", clearHighlight);
  }

  for (const c of CATEGORIES) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = `dot cat-${c.id}`;
    const span = document.createElement("span");
    const count = NODES.filter((n) => n.cat === c.id).length;
    span.textContent = `${c.label} (${count})`;
    li.append(dot, span);
    legend.append(li);
  }

  document.getElementById("stat-count").textContent = String(NODES.length);
  document.getElementById("stat-cats").textContent = String(CATEGORIES.length);
}

/* ------------------------------------------------------------------- start */

render();
buildDirectory();
applyTransform();
showDetail(ROOT);
setHighlight(null);
statusEl.hidden = true;
