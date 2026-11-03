import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, join, start, view, action } from "../server/engine.js";
import { soundEvents } from "../shared/sound-events.js";
function setup() {
  const g = createGame();
  join(g, "a", "Анна");
  join(g, "b", "Борис");
  return g;
}
test("Первичная загрузка и повторный опрос не воспроизводят звуки", () => {
  const g = setup();
  start(g);
  const state = view(g, "a", false);
  assert.deepEqual(soundEvents(null, state), []);
  assert.deepEqual(soundEvents(state, structuredClone(state)), []);
});
test("Раздача и начало своего хода воспроизводят карты и сигнал", () => {
  const g = setup();
  const before = view(g, "a", false);
  start(g);
  assert.deepEqual(soundEvents(before, view(g, "a", false)), ["cards", "turn"]);
});
test("Колл воспроизводит фишки, флоп — карты; сигнал только игроку на ходу", () => {
  const g = setup();
  start(g);
  const before = view(g, "b", false);
  action(g, "a", "call");
  const after = view(g, "b", false);
  assert.deepEqual(soundEvents(before, after), ["chips", "turn"]);
  action(g, "b", "check");
  assert.deepEqual(soundEvents(after, view(g, "b", false)), ["cards"]);
});
test("Пауза не даёт сигнал; возобновление своего хода даёт", () => {
  const g = setup();
  start(g);
  const before = view(g, "a", false);
  const paused = { ...before, paused: true };
  assert.deepEqual(soundEvents(before, paused), []);
  assert.deepEqual(soundEvents(paused, before), ["turn"]);
});
