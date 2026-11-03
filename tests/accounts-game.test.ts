import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, join, start, action, view } from "../server/engine.js";
import { roomSettings } from "../server/app.js";
import { decide } from "../server/bots.js";
test("Шаг рейза: сервер отвергает некратные ставки, олл-ин остатком разрешён", () => {
  const g = createGame();
  g.settings = { small: 10, big: 20, stack: 2000, minutes: 5, step: 25 };
  join(g, "a", "Алиса");
  join(g, "b", "Борис");
  g.players[0].chips = 117;
  start(g);
  const a = g.players.find((p) => p.id === g.actor)!;
  assert.equal(view(g, a.id, false).legal.min, 50);
  assert.throws(() => action(g, a.id, "raise", 60), /кратна/);
  assert.equal(a.bet, 10);
  action(g, a.id, "raise", 75);
  assert.equal(a.lastAction?.kind, "raise");
  assert.equal(a.lastAction?.amount, 75);
  const b = g.players.find((p) => p.id === g.actor)!;
  action(g, b.id, "raise", 150);
  action(g, a.id, "call");
  assert.equal(a.lastAction?.amount, 42);
  const extra = createGame();
  extra.settings = { ...g.settings };
  join(extra, "x", "Икс");
  join(extra, "y", "Игрек");
  extra.players[0].chips = 117;
  start(extra);
  action(extra, "x", "raise", 117);
  assert.equal(extra.players[0].chips, 0);
  assert.equal(extra.players[0].bet, 117);
  assert.equal(a.lastAction?.kind, "call");
});
test("Последние действия сохраняются до новой раздачи; фолд закрывает карты у всех", () => {
  const g = createGame();
  join(g, "a", "Алиса");
  join(g, "b", "Борис");
  start(g);
  const first = g.actor!;
  action(g, first, "call");
  assert.equal(g.players.find((p) => p.id === first)?.lastAction?.kind, "call");
  const second = g.actor!;
  action(g, second, "check");
  assert.equal(
    g.players.find((p) => p.id === second)?.lastAction?.kind,
    "check",
  );
  const folder = g.actor!;
  action(g, folder, "fold");
  assert.equal(
    view(g, folder, true).players.find((p) => p.id === folder)!.cards.length,
    0,
  );
  assert.equal(
    g.players.find((p) => p.id === folder)?.lastAction?.hand,
    g.hand,
  );
  start(g);
  assert.ok(g.players.every((p) => !p.lastAction));
});
test("Настройки стола валидируются и шаг учитывается ботами", () => {
  for (const invalid of [
    { small: 0, big: 20, minutes: 5, step: 1 },
    { small: 10, big: 15, minutes: 5, step: 1 },
    { small: 10, big: 20, minutes: 0, step: 1 },
    { small: 10, big: 20, minutes: 5, step: 0 },
    { small: 10, big: 20, minutes: 5, step: 2.5 },
  ])
    assert.throws(() => roomSettings(invalid));
  const g = createGame();
  g.settings = roomSettings({ small: 10, big: 20, minutes: 5, step: 25 });
  join(g, "a", "Алиса");
  join(g, "b", "Борис");
  start(g);
  const v = view(g, g.actor!, false);
  v.players.find((p) => p.id === v.me)!.cards = [
    { rank: 14, suit: "s" },
    { rank: 14, suit: "h" },
  ];
  v.board = [
    { rank: 14, suit: "c" },
    { rank: 14, suit: "d" },
    { rank: 13, suit: "s" },
    { rank: 8, suit: "h" },
    { rank: 7, suit: "h" },
  ];
  const move = decide(v, () => 0.1);
  assert.equal(move.kind, "raise");
  if (move.kind === "raise")
    assert.ok(move.amount === v.legal.max || move.amount! % 25 === 0);
});
