import { test } from "node:test";
import assert from "node:assert/strict";
import { bestFive, compare, evaluate } from "../shared/poker.js";
import { crownWinners } from "../shared/winners.js";
import { createGame, join, start, settle, action } from "../server/engine.js";
import { cardMoves } from "../shared/dealing.js";
import type { Card } from "../shared/types.js";
const c = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });
function table() {
  const g = createGame();
  join(g, "a", "Маша");
  join(g, "b", "Дедлайн");
  g.hand = 1;
  g.phase = "river";
  g.dealer = 0;
  g.board = [c(14, "c"), c(14, "d"), c(7, "h"), c(4, "s"), c(2, "d")];
  g.players[0].cards = [c(14, "h"), c(7, "s")];
  g.players[1].cards = [c(13, "h"), c(13, "d")];
  g.players.forEach((p) => {
    p.chips = 1900;
    p.total = 100;
  });
  return g;
}
test("Сохраняются именно пять выигрышных карт и их позиции на борде и в руке", () => {
  const g = table(),
    all = [...g.players[0].cards, ...g.board],
    best = bestFive(all);
  assert.equal(compare(best.score, evaluate(all)), 0);
  assert.deepEqual(best.score, [6, 14, 7]);
  assert.equal(best.cards.filter((c) => c.rank === 14).length, 3);
  assert.equal(best.cards.filter((c) => c.rank === 7).length, 2);
  settle(g);
  const result = g.lastResult!;
  assert.equal(result.hand, 1);
  assert.equal(result.winners[0].combination, "Фулл-хаус");
  assert.deepEqual(result.winners[0].boardIndexes, [0, 1, 2]);
  assert.deepEqual(result.winners[0].holeIndexes, [0, 1]);
  assert.equal(result.winners[0].cards.length, 5);
  assert.deepEqual(crownWinners(g), ["a"]);
});
test("Корона сохраняется в следующей раздаче и переживает сохранение партии", () => {
  const g = table();
  settle(g);
  start(g, 0, true);
  assert.equal(g.lastResult!.hand, 1);
  assert.equal(g.hand, 2);
  assert.deepEqual(crownWinners(g, true), ["a"]);
  assert.deepEqual(crownWinners(JSON.parse(JSON.stringify(g)), true), ["a"]);
});
test("При разделе банка оба игрока получают корону и роял-флеш из пяти карт борда", () => {
  const g = table();
  g.board = [c(10, "s"), c(11, "s"), c(12, "s"), c(13, "s"), c(14, "s")];
  g.players[0].cards = [c(2, "h"), c(3, "h")];
  g.players[1].cards = [c(4, "c"), c(5, "d")];
  settle(g);
  assert.deepEqual(crownWinners(g), ["a", "b"]);
  assert.ok(g.result.every((line) => line.includes("Роял-флеш")));
  assert.ok(g.lastResult!.winners.every((w) => w.combination === "Роял-флеш"));
  assert.ok(
    g.lastResult!.winners.every(
      (w) => w.holeIndexes.length === 0 && w.boardIndexes.length === 5,
    ),
  );
});
test("Возврат единоличной неуравненной ставки не выдаёт проигравшему корону", () => {
  const g = table();
  g.players[1].total = 200;
  settle(g);
  assert.deepEqual(crownWinners(g), ["a"]);
  assert.equal(g.players[1].chips, 2000);
  assert.ok(g.result.some((s) => s.includes("возврат 100")));
});
test("Победитель побочного банка тоже получает корону", () => {
  const g = table();
  join(g, "c", "Релиз");
  g.players[2].cards = [c(12, "h"), c(12, "d")];
  g.players[2].folded = false;
  g.players[2].total = 300;
  g.players[1].total = 300;
  settle(g);
  assert.deepEqual(new Set(crownWinners(g)), new Set(["a", "b"]));
});
test("Победа без вскрытия не придумывает комбинацию и не раскрывает карты в итоговой записи", () => {
  const g = createGame();
  join(g, "a", "Маша");
  join(g, "b", "Дедлайн");
  start(g, 0);
  action(g, "a", "fold", undefined, 1);
  assert.equal(g.lastResult!.byFold, true);
  assert.equal(g.lastResult!.winners[0].combination, null);
  assert.deepEqual(g.lastResult!.winners[0].cards, []);
  assert.deepEqual(g.lastResult!.winners[0].boardIndexes, []);
});
test("При олл-ине корона переходит после открытия борда, а не во время анимации", () => {
  const g = table();
  settle(g);
  start(g, 0);
  g.players[0].cards = [c(2, "c"), c(3, "d")];
  g.players[1].cards = [c(13, "c"), c(13, "d")];
  g.board = [c(13, "h"), c(7, "s"), c(5, "c"), c(4, "h"), c(11, "d")];
  g.players.forEach((p) => (p.total = 100));
  settle(g);
  assert.deepEqual(crownWinners(g, true), ["a"]);
  assert.deepEqual(crownWinners(g, false), ["b"]);
});
test("Сохранённые старые планы раздачи продолжают работать по прежнему порядку", () => {
  const g = createGame();
  for (let i = 0; i < 3; i++) join(g, String(i), "Игрок " + i);
  start(g, 0, true);
  const old = { ...g.deal!, holeMode: "rounds" as const };
  assert.deepEqual(
    cardMoves(old).map((m) => m.seat),
    [1, 2, 0, 1, 2, 0],
  );
  assert.ok(cardMoves(g.deal!)[5].land < cardMoves(old)[5].land);
});
