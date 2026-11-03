import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createProfiles } from "../server/profiles.js";
import { createGame, join, start, settle, leave } from "../server/engine.js";
import { cosmeticItems } from "../shared/cosmetics.js";
import {
  giftCompensation,
  profileCombinations,
  type GiftRarity,
} from "../shared/profile.js";
import type { Card, Game } from "../shared/types.js";
const cards = (value: string): Card[] =>
  value.split(" ").map((code) => ({
    rank: Number(code.slice(0, -1)),
    suit: code.at(-1) as Card["suit"],
  }));
const fixtures = [
  ["royal-flush", "exclusive", "14s 13s", "12s 11s 10s 2h 3d"],
  ["straight-flush", "exclusive", "9s 8s", "7s 6s 5s 2h 13d"],
  ["four-kind", "epic", "14s 14h", "14d 14c 9s 2h 3d"],
  ["full-house", "epic", "13s 13h", "13d 9s 9h 2c 3d"],
  ["flush", "rare", "14s 11s", "9s 6s 3s 2h 13d"],
  ["straight", "rare", "9s 8h", "7d 6c 5s 2h 13d"],
] as const;
function finished(
  hole: string,
  board: string,
  opponent = "4c 5d",
  bot = false,
) {
  const g = createGame();
  join(g, "a", "Игрок", 0);
  join(g, "b", "Соперник", 1);
  g.players[1].bot = bot;
  start(g, 1000);
  g.board = cards(board);
  g.players[0].cards = cards(hole);
  g.players[1].cards = cards(opponent);
  for (const p of g.players) {
    p.chips = 1980;
    p.total = 20;
    p.bet = 20;
  }
  settle(g);
  return g;
}
function store(admin = false) {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,balance INTEGER); CREATE TABLE user_items(userId TEXT,itemId TEXT,PRIMARY KEY(userId,itemId)); INSERT INTO users VALUES('a',2000),('b',2000)",
  );
  const owned = (id: string) =>
    admin && id === "a"
      ? cosmeticItems.map((i) => i.id)
      : (
          db
            .prepare("SELECT itemId FROM user_items WHERE userId=?")
            .all(id) as { itemId: string }[]
        ).map((r) => r.itemId);
  const profiles = createProfiles(db, owned, (max: number) => max - 1);
  const record = (room: string, g: Game) => {
    db.exec("BEGIN");
    try {
      profiles.record(room, g, 2000);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const open = (id: string, gift: string) => {
    db.exec("BEGIN");
    try {
      const result = profiles.open(id, gift, 3000);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  return { db, profiles, record, open, owned };
}
for (const [combination, rarity, hole, board] of fixtures)
  test(`Вскрытие ${combination}: счётчик и подарок ${rarity} без дубликатов`, () => {
    const s = store();
    try {
      const g = finished(hole, board);
      assert.equal(g.lastResult?.winners[0].id, "a");
      s.record("room", g);
      s.record("room", g);
      const p = s.profiles.profile("a");
      assert.equal(p.hands, 1);
      assert.equal(p.wins, 1);
      assert.equal(p.showdowns, 1);
      assert.equal(p.combinations[combination], 1);
      assert.equal(p.gifts.length, 1);
      assert.equal(p.gifts[0].rarity, rarity);
      const result = s.open("a", p.gifts[0].id);
      assert.equal(
        cosmeticItems.find((i) => i.id === result.itemId)?.rarity,
        rarity,
      );
      assert.equal(result.compensation, 0);
      assert.equal(s.profiles.profile("a").gifts.length, 0);
      assert.deepEqual(s.open("a", p.gifts[0].id), result);
      assert.equal(s.owned("a").length, 1);
      assert.throws(() => s.open("b", p.gifts[0].id), /не найден/);
    } finally {
      s.db.close();
    }
  });
test("Слабые комбинации считаются без подарков; проигравший получает статистику, не награду", () => {
  const s = store();
  try {
    const g = finished("2c 9h", "14s 13s 2s 2h 9d", "12s 11s");
    s.record("room", g);
    const loser = s.profiles.profile("b");
    assert.equal(loser.combinations.flush, 1);
    assert.equal(loser.wins, 0);
    assert.equal(loser.gifts.length, 0);
    const pair = finished("14s 14h", "13d 9s 8h 2c 3d");
    s.record("pair", pair);
    assert.equal(s.profiles.profile("a").combinations.pair, 1);
    assert.equal(s.profiles.profile("a").gifts.length, 1); // Only the earlier full house.
  } finally {
    s.db.close();
  }
});
test("Роял на борде: оба победителя получают по одному подарку, роял не увеличивает счётчик стрит-флеша", () => {
  const s = store();
  try {
    const g = finished("2h 3d", "14s 13s 12s 11s 10s", "4c 5d");
    s.record("split", g);
    for (const id of ["a", "b"]) {
      const p = s.profiles.profile(id);
      assert.equal(p.wins, 1);
      assert.equal(p.gifts.length, 1);
      assert.equal(p.combinations["royal-flush"], 1);
      assert.equal(p.combinations["straight-flush"], undefined);
    }
  } finally {
    s.db.close();
  }
});
test("Фолд и выход: участие сохраняется, комбинаций и подарков без вскрытия нет; боты без профиля", () => {
  const s = store();
  try {
    const g = createGame();
    join(g, "a", "Игрок", 0);
    join(g, "b", "Бот", 1);
    g.players[1].bot = true;
    start(g, 1000);
    leave(g, "a", 2000);
    s.record("fold", g);
    assert.equal(s.profiles.profile("a").hands, 1);
    assert.equal(s.profiles.profile("a").wins, 0);
    assert.equal(s.profiles.profile("b").hands, 0);
    assert.equal(s.profiles.profile("a").gifts.length, 0);
    assert.deepEqual(s.profiles.profile("a").combinations, {});
  } finally {
    s.db.close();
  }
});
test("Полная коллекция каждой редкости: 500 / 1000 / 5000 сразу вместо подарка и в стеке", () => {
  const s = store(true);
  try {
    let balance = 2000;
    for (const [id, rarity, hole, board] of fixtures) {
      const g = finished(hole, board);
      const before = g.players[0].chips;
      s.record(id, g);
      balance += giftCompensation[rarity];
      assert.equal(s.profiles.profile("a").gifts.length, 0);
      assert.equal(g.players[0].chips, before + giftCompensation[rarity]);
      assert.equal(
        s.db.prepare("SELECT balance FROM users WHERE id='a'").get()!.balance,
        balance,
      );
      s.record(id, g);
      assert.equal(
        s.db.prepare("SELECT balance FROM users WHERE id='a'").get()!.balance,
        balance,
      );
    }
  } finally {
    s.db.close();
  }
});
test("Накопленные подарки заполняют набор без повторов, лишний подарок превращается в фишки", () => {
  for (const rarity of ["rare", "epic", "exclusive"] as GiftRarity[]) {
    const s = store();
    try {
      const fixture = fixtures.find((f) => f[1] === rarity)!;
      const all = cosmeticItems.filter(
        (i) => i.slot === "accessory" && i.rarity === rarity,
      );
      for (let i = 0; i <= all.length; i++)
        s.record(String(i), finished(fixture[2], fixture[3]));
      const gifts = s.profiles.profile("a").gifts;
      assert.equal(gifts.length, all.length + 1);
      const results = gifts.map((g) => s.open("a", g.id));
      assert.equal(
        new Set(results.filter((r) => r.itemId).map((r) => r.itemId)).size,
        all.length,
      );
      assert.equal(results.at(-1)!.compensation, giftCompensation[rarity]);
      const g = finished(fixture[2], fixture[3]);
      s.record("after-complete", g);
      assert.equal(s.profiles.profile("a").gifts.length, 0);
      assert.equal(s.profiles.profile("a").collection[rarity], all.length);
    } finally {
      s.db.close();
    }
  }
});
test("Отменённые и старые раздачи без снимка не добавляются в статистику", () => {
  const s = store();
  try {
    const g = finished(fixtures[0][2], fixtures[0][3]);
    delete g.lastResult!.statistics;
    s.record("old", g);
    assert.equal(s.profiles.profile("a").hands, 0);
    g.phase = "river";
    s.record("unfinished", g);
    assert.equal(s.profiles.profile("a").hands, 0);
    assert.equal(profileCombinations.length, 10);
  } finally {
    s.db.close();
  }
});
test("Ошибка записи откатывает и счётчики, и подарок; повтор после восстановления выдаёт одну награду", () => {
  const s = store();
  try {
    const g = finished(fixtures[0][2], fixtures[0][3]);
    s.db.exec(
      "CREATE TRIGGER reject_gift BEFORE INSERT ON profile_gifts BEGIN SELECT RAISE(ABORT,'test failure'); END",
    );
    assert.throws(() => s.record("rollback", g), /test failure/);
    assert.equal(s.profiles.profile("a").hands, 0);
    assert.equal(s.profiles.profile("a").gifts.length, 0);
    s.db.exec("DROP TRIGGER reject_gift");
    s.record("rollback", g);
    const gift = s.profiles.profile("a").gifts[0];
    s.db.exec(
      "CREATE TRIGGER reject_open BEFORE UPDATE ON profile_gifts BEGIN SELECT RAISE(ABORT,'open failure'); END",
    );
    assert.throws(() => s.open("a", gift.id), /open failure/);
    assert.equal(s.owned("a").length, 0);
    assert.equal(s.profiles.profile("a").gifts.length, 1);
    s.db.exec("DROP TRIGGER reject_open");
    s.open("a", gift.id);
    assert.equal(s.profiles.profile("a").hands, 1);
    assert.equal(s.owned("a").length, 1);
  } finally {
    s.db.close();
  }
});
test("Победитель побочного банка получает подарок; возврат своей ставки не считается победой", () => {
  const s = store();
  try {
    const g = createGame();
    join(g, "a", "Основной", 0);
    join(g, "b", "Побочный", 1);
    join(g, "c", "Бот", 2);
    g.players[2].bot = true;
    start(g, 1000);
    g.board = cards("7s 6s 5s 2h 13d");
    g.players[0].cards = cards("9s 8s");
    g.players[1].cards = cards("14s 11s");
    g.players[2].cards = cards("14c 12d");
    for (const [i, p] of g.players.entries()) {
      p.total = i === 0 ? 100 : 300;
      p.bet = p.total;
      p.chips = 2000 - p.total;
    }
    settle(g);
    s.record("side", g);
    assert.equal(s.profiles.profile("a").gifts[0].rarity, "exclusive");
    assert.equal(s.profiles.profile("b").gifts[0].rarity, "rare");
    assert.equal(s.profiles.profile("b").wins, 1);
    const returned = createGame();
    join(returned, "a", "Сильная рука", 0);
    join(returned, "b", "Возврат", 1);
    start(returned, 1000);
    returned.board = cards("7s 6s 5s 2h 13d");
    returned.players[0].cards = cards("9s 8s");
    returned.players[1].cards = cards("14s 11s");
    returned.players[0].total = 100;
    returned.players[1].total = 300;
    settle(returned);
    s.record("return", returned);
    assert.equal(s.profiles.profile("b").gifts.length, 1);
    assert.equal(s.profiles.profile("b").wins, 1);
    assert.equal(s.profiles.profile("b").combinations.flush, 2);
  } finally {
    s.db.close();
  }
});
