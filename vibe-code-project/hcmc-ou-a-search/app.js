import { loadRoads } from "./roads.js";
import { query } from "./hierarchy.js";
import { graphFromOSM, nearest } from "./routing.js";
const campuses = [
  ["97 Võ Văn Tần", [10.7766, 106.6906]],
  ["35–37 Hồ Hảo Hớn", [10.7595, 106.6918]],
  ["Nhơn Đức · Hiệp Phước", [10.676414, 106.690748]],
  ["02 Mai Thị Lựu", [10.7915, 106.6984]],
  ["311 Gia Phú", [10.7463, 106.6426]],
  ["283 Lý Thường Kiệt", [10.7797, 106.6533]],
  ["259/29 Quốc lộ 51, P. Long Hưng, Tỉnh Đồng Nai", [10.9068441, 106.8552152]],
  ["04 đường Tân Định, P. Ninh Hòa, tỉnh Khánh Hòa", [12.5063776, 109.146128]],
];
const $ = (id) => document.getElementById(id),
  start = $("start"),
  end = $("end"),
  mode = $("mode"),
  button = $("begin"),
  status = $("status");
let busy = false;
for (const [i, c] of campuses.entries()) {
  start.add(new Option(c[0], i));
  end.add(new Option(c[0], i));
}
end.value = "1";
function sync() {
  for (const o of start.options) o.disabled = o.value === end.value;
  for (const o of end.options) o.disabled = o.value === start.value;
  button.disabled = busy || start.value === end.value;
}
start.onchange = end.onchange = sync;
sync();
let map, explored, routeLayer;
try {
  map = L.map("map", { preferCanvas: true }).setView([10.735, 106.686], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  }).addTo(map);
  explored = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  for (const [name, ll] of campuses)
    if (ll)
      L.marker(ll).addTo(map).bindPopup(`${name}<br>Approximate campus pin`);
} catch {
  status.textContent =
    "Map library could not load. Check your connection and reload.";
  button.disabled = true;
}
$("controls").onsubmit = async (e) => {
  e.preventDefault();
  if (busy || start.value === end.value || !map) return;
  busy = true;
  [start, end, mode].forEach((x) => (x.disabled = true));
  sync();
  button.textContent = "Exploring…";
  $("result").textContent = "";
  explored.clearLayers();
  routeLayer.clearLayers();
  try {
    if (!campuses[+start.value][1] || !campuses[+end.value][1])
      throw Error("This campus needs a verified map pin before routing");
    const roads = await loadRoads(
      campuses[+start.value][1],
      campuses[+end.value][1],
      (message) => (status.textContent = message),
    );
    const graph = graphFromOSM(roads.data, mode.value),
      a = nearest(graph, campuses[+start.value][1]),
      b = nearest(graph, campuses[+end.value][1]);
    map.fitBounds([campuses[+start.value][1], campuses[+end.value][1]], {
      padding: [55, 55],
      maxZoom: 14,
    });
    status.textContent = "Preparing contraction hierarchy…";
    const hierarchy = await prepare(graph, `${roads.key}-${mode.value}`);
    const iterator = query(hierarchy, a, b);
    let step,
      count = 0;
    do {
      for (let i = 0; i < 100; i++) {
        step = iterator.next();
        if (step.done) break;
        count++;
        L.circleMarker(graph.get(step.value.visited).ll, {
          radius: 2,
          color: step.value.direction ? "#4776b4" : "#d5784a",
          weight: 0,
          fillOpacity: 0.55,
        }).addTo(explored);
      }
      status.textContent = `Bidirectional CH exploring · ${count.toLocaleString()} intersections`;
      await new Promise((resolve) => setTimeout(resolve, 16));
    } while (!step.done);
    if (!step.value)
      throw Error("No route found in the downloaded graph for this vehicle.");
    const result = step.value;
    L.polyline(
      result.route.map((id) => graph.get(id).ll),
      { color: "#14584b", weight: 6 },
    ).addTo(routeLayer);
    map.fitBounds(
      result.route.map((id) => graph.get(id).ll),
      { padding: [35, 35] },
    );
    $("result").textContent =
      `${(result.meters / 1000).toFixed(1)} km · ~${Math.max(1, Math.round(result.seconds / 60))} min`;
    status.textContent = `Complete · ${count.toLocaleString()} intersections explored. Estimated time within the loaded road corridor; without live traffic. Nearby road endpoints exclude campus access.`;
  } catch (error) {
    status.textContent = `${error.message} You can try again.`;
  } finally {
    busy = false;
    [start, end, mode].forEach((x) => (x.disabled = false));
    button.textContent = "Begin exploration ↗";
    sync();
  }
};

const hierarchies = new Map();
function prepare(graph, mode) {
  if (hierarchies.has(mode)) return Promise.resolve(hierarchies.get(mode));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./preprocess.js", import.meta.url), {
      type: "module",
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Error("Preprocessing exceeded three minutes. Please retry."));
    }, 180000);
    const stop = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onerror = () => {
      stop();
      reject(Error("Hierarchy worker failed."));
    };
    worker.onmessage = ({ data }) => {
      if (data.progress)
        status.textContent = `Preparing hierarchy · ${data.progress.processed.toLocaleString()} / ${data.progress.total.toLocaleString()} processed · ${data.progress.core.toLocaleString()} core nodes`;
      if (data.error) {
        stop();
        reject(Error(data.error));
      }
      if (data.hierarchy) {
        stop();
        hierarchies.set(mode, data.hierarchy);
        resolve(data.hierarchy);
      }
    };
    worker.postMessage(graph);
  });
}
