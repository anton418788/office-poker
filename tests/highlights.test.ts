import { test } from "node:test";
import assert from "node:assert/strict";
import {
  combinationCards,
  bestFive,
  compare,
  evaluate,
} from "../shared/poker.js";
import { winningHighlights } from "../shared/winners.js";
import { createGame, join, settle, start } from "../server/engine.js";
import { cardMoves, nextDealUpdate } from "../shared/dealing.js";
import type { Card } from "../shared/types.js";
const c = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });
test("Скриншот: две пары 7 и 6 подсвечиваются, туз-кикер в руке — нет", () => {
  const board = [c(7, "d"), c(9, "s"), c(6, "c"), c(13, "s"), c(6, "s")],
    hole = [c(7, "h"), c(14, "h")];
  const best = bestFive([...hole, ...board]);
  assert.deepEqual(best.score, [2, 7, 6, 14]);
  assert.equal(best.cards.length, 5);
  assert.equal(combinationCards(best.cards).length, 4);
  assert.ok(!combinationCards(best.cards).some((c) => c.rank === 14));
  const highlights = winningHighlights(best.cards, board, hole);
  assert.deepEqual(highlights.boardIndexes, [0, 2, 4]);
  assert.deepEqual(highlights.holeIndexes, [0]);
  // An existing saved result still contains all five cards; rendering recalculates just the combination.
  const saved = { cards: best.cards, holeIndexes: [0, 1] };
  assert.deepEqual(
    winningHighlights(saved.cards, board, hole).holeIndexes,
    [0],
  );
});
test("Туз остаётся кикером: одинаковые две пары с тузом побеждают две пары с королём", () => {
  const g = createGame();
  join(g, "ace", "С тузом");
  join(g, "king", "С королём");
  g.hand = 1;
  g.phase = "river";
  g.board = [c(7, "d"), c(9, "s"), c(6, "c"), c(13, "s"), c(6, "s")];
  g.players[0].cards = [c(7, "h"), c(14, "h")];
  g.players[1].cards = [c(7, "c"), c(12, "h")];
  g.players.forEach((p) => {
    p.chips = 1900;
    p.total = 100;
  });
  assert.ok(
    compare(
      evaluate([...g.players[0].cards, ...g.board]),
      evaluate([...g.players[1].cards, ...g.board]),
    ) > 0,
  );
  settle(g);
  assert.equal(g.lastResult!.winners[0].id, "ace");
  assert.deepEqual(g.lastResult!.winners[0].holeIndexes, [0]);
  assert.equal(g.lastResult!.winners[0].cards.length, 5);
  assert.equal(g.players[0].chips, 2100);
});
test("Пара, тройка и каре выделяют только одноимённые карты, без кикеров", () => {
  const cases = [
    {
      cards: [c(8, "s"), c(8, "h"), c(14, "c"), c(13, "d"), c(3, "s")],
      count: 2,
    },
    {
      cards: [c(8, "s"), c(8, "h"), c(8, "c"), c(14, "d"), c(3, "s")],
      count: 3,
    },
    {
      cards: [c(8, "s"), c(8, "h"), c(8, "c"), c(8, "d"), c(14, "s")],
      count: 4,
    },
  ];
  for (const item of cases) {
    const selected = combinationCards(item.cards);
    assert.equal(selected.length, item.count);
    assert.ok(selected.every((c) => c.rank === 8));
  }
});
test("Стрит, флеш и фулл-хаус выделяют пять карт, старшая карта — одну", () => {
  for (const cards of [
    [c(14, "s"), c(2, "h"), c(3, "c"), c(4, "d"), c(5, "s")],
    [c(14, "h"), c(11, "h"), c(8, "h"), c(5, "h"), c(2, "h")],
    [c(8, "s"), c(8, "h"), c(8, "c"), c(3, "d"), c(3, "s")],
  ])
    assert.equal(combinationCards(cards).length, 5);
  assert.deepEqual(
    combinationCards([c(14, "s"), c(11, "h"), c(8, "c"), c(5, "d"), c(2, "s")]),
    [c(14, "s")],
  );
  assert.deepEqual(combinationCards([]), []);
});
test("Часы отображения планируют лишь события раздачи, не промежуточные кадры", () => {
  const g = createGame();
  for (let i = 0; i < 6; i++) join(g, String(i), "Игрок " + i);
  start(g, 100, true);
  const plan = g.deal!,
    moves = cardMoves(plan);
  assert.equal(nextDealUpdate(plan, plan.startedAt), moves[0].start);
  assert.equal(nextDealUpdate(plan, moves[0].start), moves[2].start);
  assert.equal(nextDealUpdate(plan, plan.endsAt), null);
  assert.equal(
    nextDealUpdate(
      { ...plan, pausedAt: plan.startedAt + 100 },
      plan.startedAt + 2000,
    ),
    null,
  );
  let now = plan.startedAt,
    count = 0;
  while (true) {
    const next = nextDealUpdate(plan, now);
    if (next === null) break;
    assert.ok(next > now);
    now = next;
    count++;
    assert.ok(count < 20);
  }
  assert.ok(count <= 13);
});
