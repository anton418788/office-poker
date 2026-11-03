import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateOdds } from "../shared/odds.js";
import { chipBreakdown } from "../shared/chips.js";
import { createGame, join, start, action, view } from "../server/engine.js";
import { soundEvents } from "../shared/sound-events.js";
import type { Card } from "../shared/types.js";
const c = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });
test("Номиналы сохраняют точную сумму для маленьких, больших и нечётных стеков", () => {
  for (let n = 0; n < 10000; n += 7) {
    const stacks = chipBreakdown(n);
    assert.equal(
      stacks.reduce((sum, s) => sum + s.value * s.count, 0),
      n,
    );
    assert.ok(stacks.every((s) => Number.isInteger(s.count) && s.count > 0));
  }
  for (const n of [1, 10, 20, 27, 2000, 10000000])
    assert.equal(
      chipBreakdown(n).reduce((sum, s) => sum + s.value * s.count, 0),
      n,
    );
  assert.throws(() => chipBreakdown(-1));
  assert.throws(() => chipBreakdown(1.5));
});
test("Ривер: точные 100% лучшей комбинации, роял-флеш выделен отдельно", () => {
  const royal = calculateOdds(
    [c(14, "s"), c(13, "s")],
    [c(12, "s"), c(11, "s"), c(10, "s"), c(2, "c"), c(3, "h")],
  );
  assert.equal(royal.exact, true);
  assert.equal(royal.current, 9);
  assert.equal(royal.probabilities[9], 100);
  assert.equal(
    royal.probabilities.reduce((s, n) => s + n, 0),
    100,
  );
});
test("Тёрн: девять флеш-аутов, из них один роял-флеш; 46 исходов", () => {
  const result = calculateOdds(
    [c(14, "h"), c(13, "h")],
    [c(12, "h"), c(11, "h"), c(2, "c"), c(3, "d")],
  );
  assert.equal(result.samples, 46);
  assert.ok(Math.abs(result.probabilities[5] - (8 / 46) * 100) < 1e-10);
  assert.equal(result.probabilities[9], (1 / 46) * 100);
  assert.ok(
    Math.abs(result.probabilities.reduce((s, n) => s + n, 0) - 100) < 1e-10,
  );
});
test("Флоп: все 1081 продолжения, вероятность каре из сета 46/1081", () => {
  const result = calculateOdds(
    [c(14, "s"), c(14, "h")],
    [c(14, "d"), c(7, "c"), c(2, "d")],
  );
  assert.equal(result.exact, true);
  assert.equal(result.samples, 1081);
  assert.equal(result.current, 3);
  assert.equal(result.probabilities[7], (46 / 1081) * 100);
});
test("Префлоп: стабильная оценка, сумма 100%; неверные карты отклоняются", () => {
  const hole = [c(14, "s"), c(13, "h")];
  const first = calculateOdds(hole, [], 2000),
    second = calculateOdds(hole, [], 2000);
  assert.equal(first.exact, false);
  assert.deepEqual(first, second);
  assert.ok(
    Math.abs(first.probabilities.reduce((s, n) => s + n, 0) - 100) < 1e-10,
  );
  assert.throws(() => calculateOdds([c(14, "s"), c(14, "s")], []));
});
test("События фишек соответствуют блайндам, ставкам и выплатам без повторов", () => {
  const g = createGame();
  join(g, "a", "Анна");
  join(g, "b", "Борис");
  start(g);
  assert.deepEqual(
    g.transfers?.map((t) => t.amount),
    [10, 20],
  );
  const before = view(g, "a", false);
  action(g, "a", "raise", 100);
  action(g, "b", "fold");
  const bets = g.transfers!.filter((t) => t.kind === "bet"),
    payouts = g.transfers!.filter((t) => t.kind === "payout");
  assert.equal(
    bets.reduce((s, t) => s + t.amount, 0),
    120,
  );
  assert.equal(
    payouts.reduce((s, t) => s + t.amount, 0),
    120,
  );
  assert.equal(
    new Set(g.transfers!.map((t) => t.id)).size,
    g.transfers!.length,
  );
  const after = view(g, "a", false);
  assert.ok(soundEvents(before, after).includes("payout"));
  assert.deepEqual(soundEvents(after, structuredClone(after)), []);
});
