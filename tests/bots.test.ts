import { test } from "node:test";
import assert from "node:assert/strict";
import { addBot, BOT_DELAY, decide, equity, step } from "../server/bots.js";
import {
  createGame,
  join,
  start,
  action,
  pause,
  view,
  running,
} from "../server/engine.js";
function random(seed = 123) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test("Бот занимает выбранное место; занятое место и текущая раздача запрещены", () => {
  const g = createGame();
  join(g, "human", "Аня");
  addBot(g, 4);
  assert.equal(g.players[1].seat, 4);
  assert.equal(g.players[1].bot, true);
  assert.equal(g.players[1].chips, g.settings.stack);
  assert.throws(() => addBot(g, 4), /недоступно/);
  assert.throws(() => addBot(g, 6), /место/);
  start(g, 0);
  assert.throws(() => addBot(g, 2), /между раздачами/);
});
test("Бот думает 3 секунды, ждёт человека и не ходит на паузе", () => {
  const g = createGame();
  addBot(g, 0);
  join(g, "human", "Аня");
  start(g, 100);
  assert.equal(step(g, 100 + BOT_DELAY - 1), false);
  const original = structuredClone(g);
  pause(g, 1000);
  assert.equal(step(g, 20000), false);
  pause(g, 21000);
  assert.equal(step(g, 100 + 20000 + BOT_DELAY, random()), true);
  assert.notDeepEqual(g.log, original.log);
  if (running(g)) {
    assert.equal(g.actor, "human");
    const snapshot = JSON.stringify(g);
    assert.equal(step(g, 24000), false);
    assert.equal(JSON.stringify(g), snapshot);
  }
});
test("На ход человека бот не вмешивается", () => {
  const g = createGame();
  join(g, "human", "Аня");
  addBot(g, 1);
  start(g, 0);
  assert.equal(g.actor, "human");
  assert.equal(step(g, 5000), false);
  action(g, "human", "call", undefined, 5000);
  assert.equal(step(g, 7999), false);
  assert.equal(step(g, 8000, random()), true);
});
test("Оценка не зависит от чужих закрытых карт и порядка настоящей колоды", () => {
  const g = createGame();
  addBot(g, 0);
  addBot(g, 1);
  start(g, 0);
  const id = g.actor!;
  const before = view(g, id, false);
  const value = equity(before, random(), 20);
  const move = decide(before, random());
  g.deck.reverse();
  g.players.find((p) => p.id !== id)!.cards = [
    { rank: 14, suit: "s" },
    { rank: 14, suit: "h" },
  ];
  assert.equal(equity(view(g, id, false), random(), 20), value);
  assert.deepEqual(decide(view(g, id, false), random()), move);
  assert.equal(before.players.find((p) => p.id !== id)!.cards.length, 0);
});
test("С натсовым стрит-флешем бот делает легальный рейз", () => {
  const g = createGame();
  addBot(g, 0);
  addBot(g, 1);
  start(g, 0);
  const p = g.players.find((p) => p.id === g.actor)!;
  p.cards = [
    { rank: 14, suit: "s" },
    { rank: 13, suit: "s" },
  ];
  g.board = [
    { rank: 12, suit: "s" },
    { rank: 11, suit: "s" },
    { rank: 10, suit: "s" },
    { rank: 2, suit: "c" },
    { rank: 3, suit: "h" },
  ];
  g.phase = "river";
  const v = view(g, p.id, false);
  assert.equal(equity(v, random(), 12), 1);
  const move = decide(v, () => 0.1);
  assert.equal(move.kind, "raise");
  assert.ok(move.amount! >= v.legal.min);
  assert.doesNotThrow(() => action(g, p.id, move.kind, move.amount, 4000));
});
test("12 полных раздач между ботами: легальные действия, конечность и сохранение фишек", () => {
  for (let i = 0; i < 12; i++) {
    const g = createGame();
    for (let seat = 0; seat < 2 + (i % 5); seat++) addBot(g, seat);
    g.players.forEach((p, n) => (p.chips = 60 + n * 30));
    const total = g.players.reduce((s, p) => s + p.chips, 0);
    let now = 100;
    start(g, now);
    const rng = random(i + 1);
    let turns = 0;
    while (running(g) && turns++ < 120) {
      now += BOT_DELAY;
      assert.equal(step(g, now, rng), true);
      assert.equal(
        g.players.reduce((s, p) => s + p.chips + p.total, 0),
        total,
      );
    }
    assert.equal(g.phase, "showdown");
    assert.ok(turns < 120);
    assert.ok(g.players.every((p) => p.chips >= 0));
  }
});
