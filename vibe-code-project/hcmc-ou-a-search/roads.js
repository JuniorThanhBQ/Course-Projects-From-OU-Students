import { distance } from "./routing.js";

export function roadRequest(a, b) {
  const points = [a, b].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const regional = distance(a, b) > 60000;
  const pad = regional ? 0.25 : 0.025;
  const box = [
    Math.min(a[0], b[0]) - pad,
    Math.min(a[1], b[1]) - pad,
    Math.max(a[0], b[0]) + pad,
    Math.max(a[1], b[1]) + pad,
  ]
    .map((n) => n.toFixed(5))
    .join(",");
  const allowed =
    '[highway~"^(trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"]';
  const ways = regional
    ? `way[highway~"^(trunk|primary|secondary|tertiary)(_link)?$"](${box});${points.map((p) => `way${allowed}(around:5000,${p.join(",")});`).join("")}`
    : `way${allowed}(${box});`;
  return {
    key: `roads-v3-${points.flat().join("-")}`,
    regional,
    query: `[out:json][timeout:45];(${ways});out body;>;out skel qt;`,
  };
}

export function validRoads(data) {
  return (
    !data?.remark &&
    Array.isArray(data?.elements) &&
    data.elements.some((e) => e.type === "way") &&
    data.elements.some((e) => e.type === "node")
  );
}

const pending = new Map();
export async function loadRoads(a, b, notify = () => {}) {
  const request = roadRequest(a, b);
  if (pending.has(request.key)) return pending.get(request.key);
  const promise = (async () => {
    const cacheURL = new URL(`./road-cache/${request.key}`, import.meta.url)
      .href;
    let cache;
    try {
      cache = await caches.open("ou-road-data-v3");
      const hit = await cache.match(cacheURL);
      if (
        hit &&
        Date.now() - Number(hit.headers.get("x-saved-at")) < 7 * 86400000
      ) {
        const data = await hit.json();
        if (validRoads(data)) {
          notify("Using saved road data…");
          return { data, ...request };
        }
      }
    } catch {}
    notify(
      request.regional
        ? "Loading regional main roads and campus access streets…"
        : "Loading streets near the selected campuses…",
    );
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: new URLSearchParams({ data: request.query }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw Error(
        `Road service returned ${response.status}. Please retry shortly.`,
      );
    const data = await response.json();
    if (!validRoads(data))
      throw Error("Road service returned incomplete data. Please retry.");
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
    return { data, ...request };
  })();
  pending.set(request.key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(request.key);
  }
}
