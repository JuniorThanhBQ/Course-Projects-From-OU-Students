import { contract } from "./hierarchy.js";
self.onmessage = ({ data }) => {
  try {
    const iterator = contract(data);
    let step;
    do {
      step = iterator.next();
      if (
        !step.done &&
        (step.value.processed % 500 === 0 ||
          step.value.processed === step.value.total)
      )
        self.postMessage({ progress: step.value });
    } while (!step.done);
    self.postMessage({ hierarchy: step.value });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
