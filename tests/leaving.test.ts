import { test } from "node:test";
import assert from "node:assert/strict";
import {
  action,
  createGame,
  join,
  leave,
  pause,
  running,
  settle,
  start,
  view,
} from "../server/engine.js";
import { potAmount } from "../shared/pot.js";
function setup(count = 3) {
  const g = createGame();
  for (let i = 0; i < count; i++) join(g, String(i), `Игрок ${i}`);
  start(g, 1000);
  return g;
}
test("Выход не на своём ходу сохраняет банк и очередь; свободное место можно занять, но карты заново не выдаются", () => {
  const g = setup(),
    actor = g.actor,
    deadline = g.deadline;
  const p = leave(g, "1", 2000);
  assert.equal(p.chips, 1990);
  assert.equal(potAmount(g), 30);
  assert.equal(g.actor, actor);
  assert.equal(g.deadline, deadline);
  assert.equal(
    g.players.some((p) => p.id === "1"),
    false,
  );
  join(g, "new", "Новый", 1);
  assert.equal(g.players.find((p) => p.id === "new")!.folded, true);
  assert.deepEqual(g.players.find((p) => p.id === "new")!.cards, []);
  action(g, "0", "fold", undefined, 3000);
  assert.equal(g.phase, "showdown");
  assert.equal(g.players.find((p) => p.id === "2")!.chips, 2010);
  assert.equal(potAmount(g), 0);
});
test("Выход игрока на ходу передаёт очередь; последний соперник получает банк без вскрытия", () => {
  const g = setup();
  leave(g, "0", 2000);
  assert.equal(g.actor, "1");
  assert.equal(g.deadline, 2000 + 30 * 60_000);
  leave(g, "1", 3000);
  assert.equal(g.phase, "showdown");
  assert.equal(g.players[0].chips, 2010);
  assert.equal(g.lastResult!.byFold, true);
  assert.equal(g.actor, null);
});
test("Неуравненная часть ставки возвращается при выходе, остальное остаётся в банке", () => {
  const g = setup();
  action(g, "0", "raise", 100, undefined);
  const p = leave(g, "0", 2000);
  assert.equal(p.chips, 1980);
  assert.equal(g.currentBet, 20);
  assert.equal(g.minRaise, 20);
  assert.equal(potAmount(g), 50);
  assert.equal(g.actor, "1");
  action(g, "1", "fold", undefined, 3000);
  assert.equal(g.phase, "showdown");
  assert.equal(g.players.find((p) => p.id === "2")!.chips, 2030);
});
test("Выход на паузе не запускает таймер; новый игрок получает полное окно после продолжения", () => {
  const g = setup();
  pause(g, 2000);
  leave(g, "0", 5000);
  assert.equal(g.paused, true);
  assert.equal(g.actor, "1");
  assert.equal(g.deadline, null);
  assert.equal(g.remaining, 30 * 60_000);
  pause(g, 9000);
  assert.equal(g.deadline, 9000 + 30 * 60_000);
});
test("Ставки ушедшего олл-ин игрока участвуют в побочных банках, но его карты не побеждают", () => {
  const g = setup(4);
  const board = [
    { rank: 2, suit: "s" },
    { rank: 3, suit: "h" },
    { rank: 4, suit: "d" },
    { rank: 8, suit: "c" },
    { rank: 9, suit: "s" },
  ] as const;
  g.board = board.map((c) => ({ ...c }));
  g.phase = "river";
  g.acted = [];
  g.currentBet = 100;
  g.players.forEach((p, i) => {
    p.total = i < 2 ? 100 : 50;
    p.bet = p.total;
    p.chips = 2000 - p.total;
    p.cards = [
      { rank: i === 0 ? 14 : 10 + i, suit: "h" },
      { rank: i === 0 ? 14 : 10 + i, suit: "c" },
    ];
  });
  leave(g, "0", 2000);
  settle(g);
  assert.equal(g.players.reduce((n, p) => n + p.chips, 0) + 1900, 8000);
  assert.ok(g.lastResult!.winners.every((w) => w.id !== "0"));
  assert.equal(potAmount(g), 0);
});
test("120 раздач с выходами: сумма свободных фишек и банка сохраняется, покинувшие игру не выигрывают", () => {
  let seed = 217;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let sample = 0; sample < 120; sample++) {
    const g = setup(6);
    let withdrawn = 0;
    const departed = new Set<string>();
    let moves = 0;
    while (running(g) && moves++ < 180) {
      if (g.players.length > 2 && random() < 0.3) {
        const p = g.players[Math.floor(random() * g.players.length)];
        departed.add(p.id);
        withdrawn += leave(g, p.id, 1000 + moves).chips;
      } else {
        const v = view(g, g.actor!, false);
        const r = random();
        if (r < 0.2) action(g, g.actor!, "fold");
        else if (r < 0.35 && v.legal.canRaise)
          action(g, g.actor!, "raise", Math.min(v.legal.min, v.legal.max));
        else action(g, g.actor!, v.legal.call ? "call" : "check");
      }
      assert.equal(
        g.players.reduce((n, p) => n + p.chips, 0) + withdrawn + potAmount(g),
        12000,
      );
    }
    assert.equal(g.phase, "showdown");
    assert.ok(g.lastResult!.winners.every((w) => !departed.has(w.id)));
  }
});
