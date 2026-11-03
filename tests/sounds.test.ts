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
  assert.deepEqual(soundEvents(after, view(g, "b", false)), ["check", "cards"]);
});
test("Пауза не даёт сигнал; возобновление своего хода даёт", () => {
  const g = setup();
  start(g);
  const before = view(g, "a", false);
  const paused = { ...before, paused: true };
  assert.deepEqual(soundEvents(before, paused), []);
  assert.deepEqual(soundEvents(paused, before), ["turn"]);
});
test("Каждый чек даёт двойной стук один раз, включая чек бота и смену улицы", () => {
  const g = setup();
  g.players[1].bot = true;
  start(g);
  action(g, "a", "call");
  const before = view(g, "a", false);
  action(g, "b", "check");
  const after = view(g, "a", false);
  assert.ok(soundEvents(before, after).includes("check"));
  assert.equal(after.checks?.at(-1)?.seat, 1);
  assert.equal(
    soundEvents(before, after).filter((s) => s === "check").length,
    1,
  );
  assert.deepEqual(soundEvents(after, structuredClone(after)), []);
  assert.deepEqual(soundEvents(null, after), []);
});
test("Несколько чеков между обновлениями не теряются; запрещённый чек не создаёт звук", () => {
  const g = setup();
  start(g);
  assert.throws(() => action(g, "a", "check"));
  assert.equal(g.checkSeq, undefined);
  action(g, "a", "call");
  action(g, "b", "check");
  const before = view(g, "a", false);
  action(g, "b", "check");
  action(g, "a", "check");
  const after = view(g, "a", false);
  assert.equal(
    soundEvents(before, after).filter((s) => s === "check").length,
    2,
  );
});
