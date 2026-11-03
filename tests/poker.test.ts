import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  join,
  start,
  action,
  settle,
  pause,
  tick,
  view,
  running,
} from "../server/engine.js";
import { deck, evaluate, compare } from "../server/poker.js";
import type { Card } from "../shared/types.js";
function game(n = 3) {
  const g = createGame();
  for (let i = 0; i < n; i++) join(g, String(i), `Игрок ${i}`);
  return g;
}
const cards = (ranks: number[], suit: Card["suit"] = "s") =>
  ranks.map((rank) => ({ rank, suit }));
test("Колода уникальна; стрит-флеш, фулл-хаус, колесо и кикеры", () => {
  const d = deck();
  assert.equal(new Set(d.map((c) => c.rank + c.suit)).size, 52);
  assert.equal(evaluate(cards([10, 11, 12, 13, 14]))[0], 8);
  assert.deepEqual(
    evaluate([...cards([14, 14], "s"), ...cards([14, 13, 13], "h")]),
    [6, 14, 13],
  );
  assert.deepEqual(
    evaluate([{ rank: 14, suit: "h" }, ...cards([2, 3, 4, 5])]),
    [4, 5],
  );
  assert.ok(compare([1, 12, 14, 10, 8], [1, 12, 13, 11, 9]) > 0);
});
test("Heads-up: дилер малый блайнд и первый префлоп, последний после флопа", () => {
  const g = game(2);
  start(g, 0);
  assert.equal(g.dealer, 0);
  assert.equal(g.actor, "0");
  action(g, "0", "call", undefined, 10);
  action(g, "1", "check", undefined, 20);
  assert.equal(g.phase, "flop");
  assert.equal(g.actor, "1");
});
test("Блайнды, минимальный рейз, неизменность при ошибочном рейзе", () => {
  const g = game();
  start(g, 0);
  assert.equal(g.actor, "0");
  const before = JSON.stringify(g);
  assert.throws(() => action(g, "0", "raise", 30), /Минимум/);
  assert.equal(JSON.stringify(g), before);
  action(g, "0", "raise", 60);
  assert.equal(g.minRaise, 40);
  assert.equal(g.currentBet, 60);
});
test("Короткий олл-ин не открывает рейз уже ходившему", () => {
  const g = game();
  g.players[2].chips = 30;
  start(g);
  action(g, "0", "call");
  action(g, "1", "call");
  action(g, "2", "raise", 30);
  assert.equal(g.actor, "0");
  assert.equal(view(g, "0", false).legal.canRaise, false);
  assert.throws(() => action(g, "0", "raise", 100), /Короткий/);
  action(g, "0", "call");
  action(g, "1", "call");
  assert.equal(g.phase, "flop");
});
test("Олл-ин: автоматический борд, сохранение суммы фишек", () => {
  const g = game(2);
  g.players.forEach((p) => (p.chips = 100));
  start(g);
  action(g, "0", "raise", 100);
  action(g, "1", "call");
  assert.equal(g.phase, "showdown");
  assert.equal(g.board.length, 5);
  assert.equal(
    g.players.reduce((s, p) => s + p.chips, 0),
    200,
  );
});
test("Победители основного и побочного банка", () => {
  const g = game();
  g.board = [...cards([2, 3, 7], "c"), ...cards([9, 11], "d")];
  g.players[0].cards = cards([14, 14]);
  g.players[1].cards = cards([13, 13]);
  g.players[2].cards = cards([12, 12]);
  g.players.forEach((p, i) => {
    p.chips = 0;
    p.total = [100, 200, 200][i];
  });
  settle(g);
  assert.deepEqual(
    g.players.map((p) => p.chips),
    [300, 200, 0],
  );
});
test("Ничья, нечётная фишка слева от дилера", () => {
  const g = game();
  g.dealer = 0;
  g.board = cards([10, 11, 12, 13, 14]);
  g.players.forEach((p, i) => {
    p.cards = cards([2, 3], "h");
    p.chips = 0;
    p.total = 1;
    p.folded = i === 2;
  });
  settle(g);
  assert.deepEqual(
    g.players.map((p) => p.chips),
    [1, 2, 0],
  );
});
test("Пауза замораживает часы, тайм-аут выбирает пас или чек", () => {
  const g = game(2);
  start(g, 100);
  const deadline = g.deadline!;
  pause(g, 200);
  assert.equal(tick(g, deadline + 1000), false);
  pause(g, 10000);
  assert.equal(g.deadline, deadline + 9800);
  tick(g, g.deadline!);
  assert.equal(g.phase, "showdown");
  const h = game(2);
  start(h, 0);
  action(h, "0", "call", undefined, 10);
  tick(h, h.deadline!);
  assert.equal(h.phase, "flop");
});
test("Приватность: карты и колода отсутствуют у другого игрока", () => {
  const g = game();
  start(g);
  const v = view(g, "0", false);
  assert.equal("deck" in v, false);
  assert.equal(v.players[0].cards.length, 2);
  assert.equal(v.players[1].cards.length, 0);
});
test("200 раздач: случайные легальные действия, банки и конечность", () => {
  for (let hand = 0; hand < 200; hand++) {
    const g = game(2 + (hand % 5));
    const total = g.players.reduce((s, p) => s + p.chips, 0);
    start(g);
    let turns = 0;
    while (running(g) && turns++ < 150) {
      const v = view(g, g.actor!, false);
      const choice = Math.random();
      if (choice < 0.12) action(g, g.actor!, "fold");
      else if (choice < 0.3 && v.legal.canRaise)
        action(g, g.actor!, "raise", v.legal.max);
      else action(g, g.actor!, v.legal.call ? "call" : "check");
      assert.equal(
        g.players.reduce((s, p) => s + p.chips + p.total, 0),
        total,
      );
    }
    assert.equal(g.phase, "showdown");
    assert.ok(turns < 150);
    assert.ok(g.players.every((p) => p.chips >= 0));
  }
});
