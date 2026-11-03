import { calculateOdds } from "../shared/odds";
self.onmessage = (event) => {
  try {
    self.postMessage({
      result: calculateOdds(event.data.hole, event.data.board),
    });
  } catch {
    self.postMessage({ error: "Не удалось рассчитать вероятности" });
  }
};
