import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  join,
  start,
  action,
  pause,
  tick,
  view,
} from "../server/engine.js";
import { addBot, step } from "../server/bots.js";
import {
  cardMoves,
  dealOrder,
  dealFrame,
  isDealing,
  CARD_FLIGHT,
  CARD_FLIP,
} from "../shared/dealing.js";
function table(n = 3) {
  const g = createGame();
  for (let i = 0; i < n; i++) join(g, `${i}`, `Игрок ${i}`, i);
  return g;
}
test("Дилер раздаёт по часовой стрелке два круга, по одной карте за раз", () => {
  const g = table();
  start(g, 100, true);
  const plan = g.deal!,
    moves = cardMoves(plan);
  assert.deepEqual(dealOrder([0, 1, 2], 0), [1, 2, 0]);
  assert.deepEqual(
    moves.map((m) => [m.seat, m.index]),
    [
      [1, 0],
      [2, 0],
      [0, 0],
      [1, 1],
      [2, 1],
      [0, 1],
    ],
  );
  assert.ok(
    moves.every(
      (m, i) =>
        m.land - m.start === CARD_FLIGHT &&
        (!i || m.start > moves[i - 1].start),
    ),
  );
  const all = [...g.deck, ...g.players.flatMap((p) => p.cards)];
  assert.equal(all.length, 52);
  assert.equal(new Set(all.map((c) => `${c.rank}${c.suit}`)).size, 52);
  const first = dealFrame(plan, g.hand, 0, moves[0].land);
  assert.equal(first.holeCount(1), 1);
  assert.equal(first.holeCount(0), 0);
  const full = dealFrame(plan, g.hand, 0, plan.endsAt);
  assert.ok(g.players.every((p) => full.holeCount(p.seat) === 2));
  assert.equal(full.active, false);
});
test("Сервер запрещает ходы и ботов во время раздачи; часы решения начинаются после неё", () => {
  const g = table(2);
  g.players[0].bot = true;
  start(g, 100, true);
  const end = g.deal!.endsAt;
  assert.equal(g.deadline, end + g.settings.minutes * 60000);
  assert.equal(isDealing(g, end - 1), true);
  assert.throws(
    () => action(g, g.actor!, "call", undefined, end - 1),
    /завершения раздачи/,
  );
  assert.equal(step(g, end - 1), false);
  assert.equal(tick(g, end - 1), false);
  assert.doesNotThrow(() => action(g, g.actor!, "call", undefined, end));
});
test("Борд прилетает закрытым и затем открывается, без ранних ходов", () => {
  const g = table(2);
  start(g, 0, true);
  const firstEnd = g.deal!.endsAt;
  action(g, "0", "call", undefined, firstEnd);
  action(g, "1", "check", undefined, firstEnd + 10);
  const plan = g.deal!,
    moves = cardMoves(plan);
  assert.equal(g.phase, "flop");
  assert.equal(plan.hole, false);
  assert.equal(moves.length, 3);
  const arrival = dealFrame(plan, g.hand, 3, moves[0].land);
  assert.equal(arrival.boardLanded, 1);
  assert.equal(arrival.boardFaces, 0);
  assert.equal(
    dealFrame(plan, g.hand, 3, moves[0].land + CARD_FLIP).boardFaces,
    1,
  );
  assert.throws(
    () => action(g, g.actor!, "check", undefined, plan.endsAt - 1),
    /завершения раздачи/,
  );
  assert.equal(dealFrame(plan, g.hand, 3, plan.endsAt).boardFaces, 3);
});
test("Пауза замораживает раздачу, продолжение сдвигает её без повторной выдачи карт", () => {
  const g = table();
  start(g, 0, true);
  const moves = cardMoves(g.deal!),
    at = moves[1].land,
    originalEnd = g.deal!.endsAt;
  pause(g, at);
  const frozen = dealFrame(g.deal, g.hand, 0, at + 60000);
  assert.equal(frozen.holeCount(1), 1);
  assert.equal(frozen.holeCount(2), 1);
  assert.equal(frozen.holeCount(0), 0);
  assert.equal(step(g, at + 60000), false);
  pause(g, at + 60000);
  assert.equal(g.deal!.endsAt, originalEnd + 60000);
  assert.equal(g.deadline, g.deal!.endsAt + g.settings.minutes * 60000);
  const resumed = dealFrame(g.deal, g.hand, 0, at + 60000);
  assert.equal(resumed.holeCount(0), 0);
  assert.equal(resumed.holeCount(2), 1);
});
test("Сохранённая раздача продолжается с нужного места; план не раскрывает чужие карты", () => {
  const g = table();
  start(g, 100, true);
  const copy = JSON.parse(JSON.stringify(g));
  const moves = cardMoves(copy.deal);
  assert.equal(
    dealFrame(copy.deal, copy.hand, 0, moves[3].land).holeCount(1),
    2,
  );
  assert.equal(
    dealFrame(copy.deal, copy.hand, 0, moves[3].land).holeCount(0),
    1,
  );
  const publicState = view(copy, "0", false);
  assert.equal(publicState.players[1].cards.length, 0);
  assert.equal("deck" in publicState, false);
  assert.equal(JSON.stringify(publicState.deal).includes("rank"), false);
});
test("Дилер и блайнды переходят дальше; обнулённый бот получает новый стек, человек — нет", () => {
  const g = createGame();
  join(g, "human", "Человек", 0);
  addBot(g, 1);
  join(g, "busted", "Без фишек", 3);
  g.players.find((p) => p.id === "busted")!.chips = 0;
  const bot = g.players.find((p) => p.bot)!;
  bot.chips = 0;
  start(g, 0);
  assert.equal(g.dealer, 0);
  assert.equal(bot.chips + bot.total, 2000);
  assert.equal(g.players.find((p) => p.id === "busted")!.chips, 0);
  assert.equal(g.players.find((p) => p.id === "busted")!.cards.length, 0);
  assert.ok(g.log.some((s) => s.includes("автопополнение")));
  action(g, "human", "fold", undefined, 1);
  bot.chips = 0;
  start(g, 2);
  assert.equal(g.dealer, 1);
  assert.equal(bot.chips + bot.total, 2000);
  assert.equal(bot.bet, g.settings.small);
});
test("Ненулевой остаток бота не пополняется до полного стартового стека", () => {
  const g = createGame();
  join(g, "human", "Человек");
  addBot(g, 1);
  const bot = g.players.find((p) => p.bot)!;
  bot.chips = 7;
  start(g, 0);
  assert.equal(bot.chips + bot.total, 7);
  assert.ok(!g.log.some((s) => s.includes("автопополнение")));
});
test("Завершённая сохранённая анимация показывает все карты даже после изменения таймингов клиента", () => {
  const g = table(2);
  start(g, 0, true);
  const plan = g.deal!;
  const first = cardMoves(plan)[0];
  assert.equal(first.start, plan.startedAt + plan.timing!.lead);
  const legacy = { ...plan, timing: undefined, endsAt: 50 };
  const completed = dealFrame(legacy, g.hand, 0, 51);
  assert.equal(completed.holeCount(0), 2);
  assert.equal(completed.holeCount(1), 2);
  assert.equal(completed.flights.length, 0);
});
test("Олл-ин планирует пять карт борда и не разрешает новую раздачу до их открытия", () => {
  const g = table(2);
  start(g, 0, true);
  const end = g.deal!.endsAt;
  action(g, "0", "raise", 2000, end);
  action(g, "1", "call", undefined, end + 1);
  assert.equal(g.phase, "showdown");
  assert.equal(g.deal!.hole, false);
  assert.equal(cardMoves(g.deal!).length, 5);
  assert.equal(g.deal!.boardFrom, 0);
  assert.equal(g.deal!.boardTo, 5);
  assert.throws(() => start(g, end + 2, true), /уже идёт/);
  assert.equal(dealFrame(g.deal, g.hand, 5, g.deal!.endsAt).boardFaces, 5);
});
