import { contract, getHierarchyTransferables } from "./hierarchy.js";

self.onmessage = ({ data }) => {
  try {
    const graph = data && "graph" in data ? data.graph : data;
    const options = data && "options" in data ? data.options : {};
    const iterator = contract(graph, { progressStep: 500, ...options });
    let step;
    do {
      step = iterator.next();
      if (!step.done) {
        self.postMessage({ progress: step.value });
      }
    } while (!step.done);
    const hierarchy = step.value;
    const transfer = getHierarchyTransferables(hierarchy);
    self.postMessage({ hierarchy }, transfer);
  } catch (error) {
    self.postMessage({
      error: error?.message || "Hierarchy preprocessing failed.",
    });
  }
};
