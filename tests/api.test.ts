import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp, EMPTY_ROOM_MS, PRESENCE_MS } from "../server/app.js";
import { createGame, join } from "../server/engine.js";
import type { AddressInfo } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { tokenHash } from "../server/accounts.js";
const password = "test-password-123";
const rules = { small: 10, big: 20, minutes: 10, step: 10 };
async function open(
  path = ":memory:",
  now?: () => number,
  caseRoll?: () => number,
) {
  const instance = createApp(path, { now, caseRoll }),
    server = instance.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (
    cookie: string,
    path: string,
    body?: object,
    extra: Record<string, string> = {},
  ) => {
    const response = await fetch(url + "/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
      headers: response.headers,
    };
  };
  const setup = async () => {
    const r = await call("", "setup", {
      login: "admin",
      name: "Администратор",
      password,
    });
    assert.equal(r.status, 200);
    return r.cookie!;
  };
  const add = async (admin: string, login: string, balance = 2000) => {
    const r = await call(admin, "accounts", {
      login,
      name: login,
      password,
      balance,
    });
    assert.equal(r.status, 201);
    const signed = await call("", "login", { login, password });
    assert.equal(signed.status, 200);
    return { cookie: signed.cookie!, user: r.data };
  };
  const create = async (
    cookie: string,
    name = "Новый стол",
    settings = rules,
  ) => {
    const r = await call(cookie, "rooms", { name, settings });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.room;
  };
  return {
    instance,
    call,
    setup,
    add,
    create,
    close: async () => {
      await new Promise<void>((r, e) => server.close((x) => (x ? e(x) : r())));
      instance.close();
    },
  };
}
test("Авторизация: закрытый API, локальная настройка, хеши, ротация сессий и выход", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "poker-auth-")),
    path = pathJoin(dir, "game.sqlite"),
    s = await open(path);
  try {
    assert.deepEqual((await s.call("", "state")).data, {
      account: null,
      needsSetup: true,
      canSetup: true,
      rooms: [],
    });
    assert.equal((await s.call("", "accounts")).status, 401);
    assert.equal(
      (await s.call("", "rooms", { name: "Стол", settings: rules })).status,
      401,
    );
    const admin = await s.setup();
    assert.match(admin, /poker=/);
    assert.equal(
      (await s.call("", "setup", { login: "other", name: "Другой", password }))
        .status,
      403,
    );
    const regular = await s.add(admin, "player");
    assert.equal((await s.call(regular.cookie, "accounts")).status, 403);
    assert.equal(
      (
        await s.call(regular.cookie, "accounts", {
          login: "hacker",
          name: "Хакер",
          password,
          balance: 2000,
          admin: true,
        })
      ).status,
      403,
    );
    assert.equal(
      (await s.call("", "login", { login: "player", password: "wrong" }))
        .status,
      401,
    );
    assert.equal(
      (await s.call("", "login", { login: "unknown", password: "wrong" }))
        .status,
      401,
    );
    assert.equal(
      (
        await s.call(admin, "accounts", {
          login: "player",
          name: "Дубль",
          password,
          balance: 2,
        })
      ).status,
      400,
    );
    const logged = await s.call(regular.cookie, "login", {
      login: "PLAYER",
      password,
    });
    assert.equal(logged.data.account.id, regular.user.id);
    assert.notEqual(logged.cookie, regular.cookie);
    assert.equal((await s.call(regular.cookie, "state")).data.account, null);
    assert.match(logged.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(logged.headers.get("set-cookie")!, /SameSite=Strict/);
    assert.equal((await s.call(logged.cookie!, "logout", {})).status, 200);
    assert.equal((await s.call(logged.cookie!, "state")).data.account, null);
    assert.equal(
      (
        await s.call(
          admin,
          "rooms",
          { name: "Стол", settings: rules },
          { origin: "https://foreign.example" },
        )
      ).status,
      403,
    );
    const db = new DatabaseSync(path);
    const rows = db.prepare("SELECT password FROM users").all() as {
      password: string;
    }[];
    assert.ok(
      rows.every((u) => u.password !== password && u.password.includes(":")),
    );
    db.close();
    assert.equal("password" in regular.user, false);
    assert.equal(
      "password" in (await s.call(admin, "accounts")).data[0],
      false,
    );
  } finally {
    await s.close();
    rmSync(dir, { recursive: true });
  }
});
test("Любой игрок создаёт стол с правилами; права хоста ограничены своим столом", async () => {
  const s = await open();
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "alice"),
      b = await s.add(admin, "boris");
    assert.equal((await s.call(a.cookie, "state")).data.rooms.length, 0);
    const first = await s.create(a.cookie, "Стол Алисы", {
      small: 5,
      big: 10,
      minutes: 60,
      step: 5,
    });
    const second = await s.create(b.cookie, "Стол Бориса");
    assert.notEqual(first.room.id, second.room.id);
    assert.equal(first.canManage, true);
    assert.equal(first.admin, false);
    assert.equal(first.settings.minutes, 60);
    assert.equal(first.settings.step, 5);
    const id = first.room.id;
    assert.equal(
      (await s.call(b.cookie, `rooms/${id}/bot`, { seat: 2 })).status,
      403,
    );
    assert.equal((await s.call(b.cookie, `rooms/${id}/start`, {})).status, 403);
    assert.equal((await s.call(b.cookie, `rooms/${id}/pause`, {})).status, 403);
    assert.equal(
      (await s.call(b.cookie, `rooms/${id}/settings`, rules)).status,
      403,
    );
    assert.equal(
      (await s.call(a.cookie, `rooms/${id}/bot`, { seat: 4 })).status,
      200,
    );
    assert.equal(
      (await s.call(a.cookie, `rooms/${id}/bot`, { seat: 4 })).status,
      400,
    );
    const bot = (await s.call(a.cookie, `rooms/${id}`)).data.room.players.find(
      (p: any) => p.bot,
    );
    assert.equal(
      (await s.call(a.cookie, `rooms/${id}/remove`, { id: bot.id })).status,
      200,
    );
    assert.equal(
      (await s.call(a.cookie, `rooms/${id}/remove`, { id: first.me })).status,
      400,
    );
    assert.equal(
      (await s.call(a.cookie, "rooms", { name: "Ещё один", settings: rules }))
        .status,
      400,
    );
    assert.equal((await s.call(b.cookie, `rooms/${id}/join`, {})).status, 400);
    assert.equal(
      (await s.call(b.cookie, `rooms/${second.room.id}/leave`, {})).status,
      200,
    );
    assert.equal(
      (
        await s.call(b.cookie, `rooms/${id}/join`, {
          name: "Подмена",
          chips: 999999,
        })
      ).data.room.players.find((p: any) => p.id === b.user.id).name,
      "boris",
    );
    await s.call(a.cookie, `rooms/${id}/leave`, {});
    assert.equal(
      (await s.call(b.cookie, `rooms/${id}`)).data.room.room.hostId,
      b.user.id,
    );
    assert.equal(
      (await s.call(b.cookie, `rooms/${id}/bot`, { seat: 5 })).status,
      200,
    );
  } finally {
    await s.close();
  }
});
test("Баланс сохраняется при проигрыше, выходе, новом входе и перезапуске; фишки не дублируются", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "poker-wallet-")),
    path = pathJoin(dir, "game.sqlite");
  let time = 1_800_000_000_000,
    s = await open(path, () => time);
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "alice", 1255),
      b = await s.add(admin, "boris", 2345),
      room = await s.create(a.cookie),
      id = room.room.id;
    await s.call(b.cookie, `rooms/${id}/join`, {});
    let r = (await s.call(a.cookie, `rooms/${id}/start`, {})).data.room;
    time = r.deal.endsAt + 1;
    assert.equal("deck" in r, false);
    assert.equal(
      r.players.find((p: any) => p.id === b.user.id).cards.length,
      0,
    );
    assert.equal(
      (
        await s.call(admin, `accounts/${a.user.id}`, {
          login: "alice",
          name: "alice",
          balance: 9999,
        })
      ).status,
      400,
    );
    const actorCookie = r.actor === a.user.id ? a.cookie : b.cookie;
    r = (await s.call(actorCookie, `rooms/${id}/action`, { kind: "fold" })).data
      .room;
    assert.equal(r.phase, "showdown");
    const folded = r.players.find((p: any) => p.folded);
    assert.equal(folded.cards.length, 0);
    assert.equal(folded.lastAction.kind, "fold");
    assert.equal(r.players.find((p: any) => p.id !== r.me).cards.length, 0);
    const alice = r.players.find((p: any) => p.id === a.user.id),
      boris = r.players.find((p: any) => p.id === b.user.id);
    assert.equal(alice.chips + boris.chips, 3600);
    await s.call(a.cookie, `rooms/${id}/leave`, {});
    await s.call(b.cookie, `rooms/${id}/leave`, {});
    assert.equal(
      (await s.call(a.cookie, "state")).data.account.balance,
      alice.chips,
    );
    await s.close();
    s = await open(path, () => time);
    const logged = await s.call("", "login", { login: "alice", password });
    assert.equal(logged.data.account.balance, alice.chips);
    const next = await s.create(logged.cookie!, "Другой стол");
    assert.equal(next.players[0].chips, alice.chips);
    assert.equal((await s.call(a.cookie, "state")).data.account.id, a.user.id);
    assert.equal((await s.call(a.cookie, `rooms/${id}/join`, {})).status, 400);
  } finally {
    await s.close();
    rmSync(dir, { recursive: true });
  }
});
test("Пустующий стол с ботами удаляется ровно через пять минут, ставки людей возвращаются", async () => {
  let time = 1_800_000_000_000;
  const s = await open(":memory:", () => time);
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "alice"),
      r = await s.create(a.cookie),
      id = r.room.id;
    await s.call(a.cookie, `rooms/${id}/bot`, { seat: 1 });
    await s.call(a.cookie, `rooms/${id}/leave`, {});
    time += EMPTY_ROOM_MS - 1;
    s.instance.maintenance();
    assert.equal((await s.call(admin, "state")).data.rooms.length, 1);
    time++;
    s.instance.maintenance();
    assert.equal((await s.call(admin, "state")).data.rooms.length, 0);
    assert.equal((await s.call(a.cookie, `rooms/${id}`)).status, 404);
    const live = await s.create(a.cookie, "Оборванная партия"),
      liveId = live.room.id;
    await s.call(a.cookie, `rooms/${liveId}/bot`, { seat: 1 });
    const started = (await s.call(a.cookie, `rooms/${liveId}/start`, {})).data
      .room;
    assert.equal((await s.call(a.cookie, "state")).data.account.balance, 1990);
    time += PRESENCE_MS + 1;
    s.instance.maintenance();
    time += EMPTY_ROOM_MS;
    s.instance.maintenance();
    assert.equal((await s.call(a.cookie, "state")).data.rooms.length, 0);
    assert.equal((await s.call(a.cookie, "state")).data.account.balance, 2000);
    assert.ok(started.players.some((p: any) => p.total > 0));
  } finally {
    await s.close();
  }
});
test("Присутствие человека останавливает удаление, отключение хоста не выдаёт права игроку", async () => {
  let time = 1_800_000_000_000;
  const s = await open(":memory:", () => time);
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "alice"),
      b = await s.add(admin, "boris"),
      room = await s.create(a.cookie),
      id = room.room.id;
    await s.call(b.cookie, `rooms/${id}/join`, {});
    time += PRESENCE_MS + 1;
    await s.call(b.cookie, `rooms/${id}`);
    s.instance.maintenance();
    assert.equal(
      (await s.call(b.cookie, `rooms/${id}`)).data.room.room.hostId,
      a.user.id,
    );
    assert.equal(
      (await s.call(b.cookie, `rooms/${id}/bot`, { seat: 2 })).status,
      403,
    );
    time += PRESENCE_MS + 1;
    s.instance.maintenance();
    time += EMPTY_ROOM_MS - 1;
    await s.call(a.cookie, `rooms/${id}`);
    s.instance.maintenance();
    assert.equal((await s.call(a.cookie, "state")).data.rooms.length, 1);
    assert.equal(
      (await s.call(a.cookie, "state")).data.rooms[0].emptySince,
      null,
    );
  } finally {
    await s.close();
  }
});
test("Администратор задаёт доступ и баланс; смена пароля отзывает прежние сессии", async () => {
  const s = await open();
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "alice"),
      room = await s.create(a.cookie),
      id = room.room.id;
    const update = await s.call(admin, `accounts/${a.user.id}`, {
      login: "alice",
      name: "Алиса",
      balance: 4500,
      password: "another-password",
    });
    assert.equal(update.status, 200);
    assert.equal((await s.call(a.cookie, "state")).data.account, null);
    assert.equal(
      (await s.call("", "login", { login: "alice", password })).status,
      401,
    );
    const login = await s.call("", "login", {
      login: "alice",
      password: "another-password",
    });
    assert.equal(login.data.account.balance, 4500);
    assert.equal(
      (await s.call(login.cookie!, `rooms/${id}`)).data.room.players[0].chips,
      4500,
    );
    assert.equal(
      (
        await s.call(admin, `accounts/${a.user.id}`, {
          login: "alice",
          name: "Алиса",
          balance: -1,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.call(admin, "accounts", {
          login: "short",
          name: "Короткий",
          password: "123",
          balance: 100,
        })
      ).status,
      400,
    );
  } finally {
    await s.close();
  }
});
test("Бот ходит серверным таймером и учитывает шаг рейза, без запросов человека", async () => {
  let time = 1_800_000_000_000;
  const s = await open(":memory:", () => time);
  try {
    const admin = await s.setup(),
      r = await s.create(admin),
      id = r.room.id;
    await s.call(admin, `rooms/${id}/bot`, { seat: 1 });
    const start = (await s.call(admin, `rooms/${id}/start`, {})).data.room;
    time = start.deal.endsAt + 1;
    const before = (await s.call(admin, `rooms/${id}/action`, { kind: "call" }))
      .data.room;
    assert.equal(
      before.players.find((p: any) => p.id === before.actor).bot,
      true,
    );
    time += 4000;
    s.instance.maintenance();
    const after = (await s.call(admin, `rooms/${id}`)).data.room;
    assert.ok(after.log.length > before.log.length);
  } finally {
    await s.close();
  }
});
test("Миграция сохраняет старые балансы, администратора и партию, но требует задать логин и пароль", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "poker-migrate-")),
    path = pathJoin(dir, "game.sqlite"),
    db = new DatabaseSync(path);
  const g = createGame();
  join(g, "old-admin", "Старый хост");
  join(g, "old-user", "Коллега");
  g.players[0].chips = 12345;
  g.players[1].chips = 4567;
  db.exec(
    "CREATE TABLE state(id INTEGER PRIMARY KEY,json TEXT);CREATE TABLE sessions(token TEXT PRIMARY KEY,id TEXT,admin INTEGER)",
  );
  db.prepare("INSERT INTO state VALUES(1,?)").run(JSON.stringify(g));
  db.prepare("INSERT INTO sessions VALUES(?,?,1)").run(
    tokenHash("legacy-cookie"),
    "old-admin",
  );
  db.close();
  const s = await open(path);
  try {
    const before = await s.call("poker=legacy-cookie", "state");
    assert.equal(before.data.account, null);
    const setup = await s.call("poker=legacy-cookie", "setup", {
      login: "admin",
      name: "Хост",
      password,
    });
    assert.equal(setup.data.account.balance, 12345);
    assert.equal(setup.data.account.id, "old-admin");
    const users = (await s.call(setup.cookie!, "accounts")).data;
    assert.equal(users.length, 2);
    assert.equal(users.find((u: any) => u.id === "old-user").balance, 4567);
    const activated = await s.call(setup.cookie!, "accounts/old-user", {
      login: "colleague",
      name: "Коллега",
      password,
      balance: 4567,
    });
    assert.equal(activated.status, 200);
    const login = await s.call("", "login", { login: "colleague", password });
    assert.equal(login.data.account.balance, 4567);
    assert.equal(login.data.rooms[0].seated, true);
  } finally {
    await s.close();
    rmSync(dir, { recursive: true });
  }
});
test("Лимит неудачных попыток входа", async () => {
  const s = await open();
  try {
    await s.setup();
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await s.call("", "login", { login: "admin", password: "bad" })).status,
        401,
      );
    assert.equal(
      (await s.call("", "login", { login: "admin", password })).status,
      429,
    );
  } finally {
    await s.close();
  }
});

test("Любое меню сохраняет активный стол, приватность, присутствие и права хоста", async () => {
  let time = 1_800_000_000_000;
  const s = await open(":memory:", () => time);
  try {
    const admin = await s.setup(),
      other = await s.add(admin, "other");
    const room = await s.create(admin),
      id = room.room.id;
    await s.call(other.cookie, `rooms/${id}/join`, {});
    for (let i = 0; i < 8; i++) {
      time += PRESENCE_MS - 1;
      // This is the same background poll used in Accounts and the lobby.
      const menu = (await s.call(admin, "state")).data;
      assert.equal(menu.activeRoom.room.id, id);
      assert.equal(menu.activeRoom.room.hostId, room.me);
      assert.equal(menu.activeRoom.canManage, true);
      assert.equal("deck" in menu.activeRoom, false);
      await s.call(other.cookie, "state");
      s.instance.maintenance();
      assert.equal(menu.rooms[0].emptySince, null);
    }
    for (const command of ["start", "bot", "pause", "settings", "remove"]) {
      assert.equal(
        (
          await s.call(other.cookie, `rooms/${id}/${command}`, {
            seat: 2,
            ...rules,
          })
        ).status,
        403,
      );
    }
    assert.equal((await s.call(admin, `rooms/${id}`)).data.room.hand, 0);
    const started = (await s.call(admin, `rooms/${id}/start`, {})).data.room;
    const menu = (await s.call(admin, "state")).data;
    assert.equal(menu.activeRoom.hand, started.hand);
    assert.equal(
      menu.activeRoom.players.find((p: any) => p.id === other.user.id).cards
        .length,
      0,
    );
    const otherMenu = (await s.call(other.cookie, "state")).data;
    assert.equal(otherMenu.activeRoom.canManage, false);
    assert.equal(
      otherMenu.activeRoom.players.find((p: any) => p.id === room.me).cards
        .length,
      0,
    );
    time = started.deal.endsAt + 1;
    await s.call(admin, `rooms/${id}/action`, { kind: "fold" });
    await s.call(admin, `rooms/${id}/leave`, {});
    assert.equal((await s.call(admin, "state")).data.activeRoom, undefined);
  } finally {
    await s.close();
  }
});

test("Инвентарь: у обычного игрока две базовые вещи, у администратора весь каталог всегда", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "poker-inventory-")),
    path = pathJoin(dir, "game.sqlite"),
    s = await open(path);
  try {
    const admin = await s.setup(),
      regular = await s.add(admin, "cosmetic_player");
    const initial = (await s.call(regular.cookie, "state")).data.inventory;
    assert.deepEqual(initial.owned, ["chair-classic", "deck-classic"]);
    assert.deepEqual(initial.equipped, {
      chair: "chair-classic",
      deck: "deck-classic",
    });
    const all = (await s.call(admin, "state")).data.inventory;
    assert.equal(all.owned.length, 8);
    assert.equal(new Set(all.owned).size, 8);
    for (const item of all.owned)
      assert.equal(
        (
          await s.call(admin, "inventory/equip", {
            slot: item.startsWith("chair-") ? "chair" : "deck",
            itemId: item,
          })
        ).status,
        200,
      );
    assert.equal(
      (
        await s.call(regular.cookie, "inventory/equip", {
          slot: "chair",
          itemId: "chair-royal",
          admin: true,
          id: (await s.call(admin, "state")).data.account.id,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await s.call(regular.cookie, "inventory/equip", {
          slot: "deck",
          itemId: "deck-midnight",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await s.call(admin, "inventory/equip", {
          slot: "chair",
          itemId: "deck-midnight",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.call(admin, "inventory/equip", {
          slot: "deck",
          itemId: "unknown",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.call("", "inventory/equip", {
          slot: "chair",
          itemId: "chair-classic",
        })
      ).status,
      401,
    );
    // Future rewards use the same durable possession records, without granting the whole catalog.
    const db = new DatabaseSync(path);
    db.prepare("INSERT INTO user_items VALUES(?,?)").run(
      regular.user.id,
      "chair-ocean",
    );
    db.close();
    const acquired = await s.call(regular.cookie, "inventory/equip", {
      slot: "chair",
      itemId: "chair-ocean",
    });
    assert.equal(acquired.status, 200);
    assert.equal(acquired.data.inventory.equipped.chair, "chair-ocean");
    assert.equal(acquired.data.inventory.owned.length, 3);
    assert.equal(acquired.data.account.balance, 2000);
  } finally {
    await s.close();
    rmSync(dir, { recursive: true });
  }
});

test("Сидушка следует за аккаунтом; рубашка дилера фиксируется на всю раздачу и переживает перезапуск", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "poker-equipped-")),
    path = pathJoin(dir, "game.sqlite");
  let time = 1_800_000_000_000,
    s = await open(path, () => time);
  try {
    const admin = await s.setup(),
      other = await s.add(admin, "other_cosmetic");
    await s.call(admin, "inventory/equip", {
      slot: "chair",
      itemId: "chair-royal",
    });
    await s.call(admin, "inventory/equip", {
      slot: "deck",
      itemId: "deck-midnight",
    });
    const room = await s.create(admin),
      id = room.room.id,
      adminId = room.me;
    await s.call(other.cookie, `rooms/${id}/join`, {});
    let hand = (await s.call(admin, `rooms/${id}/start`, {})).data.room;
    assert.equal(hand.cardBack, "deck-midnight");
    assert.equal(
      hand.players.find((p: any) => p.id === adminId).appearance.chair,
      "chair-royal",
    );
    const changed = await s.call(admin, "inventory/equip", {
      slot: "deck",
      itemId: "deck-garnet",
    });
    assert.equal(changed.data.activeRoom.cardBack, "deck-midnight");
    assert.equal(
      (await s.call(other.cookie, `rooms/${id}`)).data.room.cardBack,
      "deck-midnight",
    );
    await s.close();
    s = await open(path, () => time);
    assert.equal(
      (await s.call(admin, `rooms/${id}`)).data.room.cardBack,
      "deck-midnight",
    );
    assert.equal(
      (await s.call(admin, "state")).data.inventory.equipped.deck,
      "deck-garnet",
    );
    time = hand.deal.endsAt + 1;
    await s.call(
      hand.actor === adminId ? admin : other.cookie,
      `rooms/${id}/action`,
      { kind: "fold" },
    );
    hand = (await s.call(admin, `rooms/${id}/start`, {})).data.room;
    assert.equal(hand.cardBack, "deck-classic");
    assert.equal(
      hand.players.find((p: any) => p.seat === hand.dealer).id,
      other.user.id,
    );
    time = hand.deal.endsAt + 1;
    await s.call(
      hand.actor === adminId ? admin : other.cookie,
      `rooms/${id}/action`,
      { kind: "fold" },
    );
    hand = (await s.call(admin, `rooms/${id}/start`, {})).data.room;
    assert.equal(hand.cardBack, "deck-garnet");
    time = hand.deal.endsAt + 1;
    await s.call(
      hand.actor === adminId ? admin : other.cookie,
      `rooms/${id}/action`,
      { kind: "fold" },
    );
    const left = (await s.call(admin, `rooms/${id}/leave`, {})).data.room;
    assert.ok(!left.players.some((p: any) => p.id === adminId));
    const reseated = (await s.call(admin, `rooms/${id}/join`, { seat: 4 })).data
      .room;
    const player = reseated.players.find((p: any) => p.id === adminId);
    assert.equal(player.seat, 4);
    assert.equal(player.appearance.chair, "chair-royal");
  } finally {
    await s.close();
    rmSync(dir, { recursive: true });
  }
});

test("Кейсы: пусто, новый предмет и компенсации 50/250/500; подмена цены и дропа игнорируется", async () => {
  const rolls = [0, 7900, 7900, 9400, 9400, 9900, 9900];
  let index = 0;
  const s = await open(":memory:", undefined, () => rolls[index++]);
  try {
    const admin = await s.setup(),
      player = await s.add(admin, "case_player", 10000);
    const expected = [9500, 9000, 8550, 8050, 7800, 7300, 7300];
    for (let i = 0; i < rolls.length; i++) {
      const response = await s.call(player.cookie, "shop/open", {
        caseId: "chairs",
        requestId: `opening-request-${i}`,
        cost: 0,
        compensation: 1000000,
        itemId: "chair-royal",
        roll: 9999,
      });
      assert.equal(response.status, 200, JSON.stringify(response.data));
      assert.equal(response.data.account.balance, expected[i]);
      assert.equal(response.data.caseOpening.cost, 500);
      const result = response.data.caseOpening;
      if (i === 0) {
        assert.equal(result.itemId, null);
        assert.equal(result.compensation, 0);
        assert.equal(result.duplicate, false);
      } else {
        assert.equal(
          result.itemId,
          i < 3 ? "chair-burgundy" : i < 5 ? "chair-ocean" : "chair-royal",
        );
        assert.equal(result.duplicate, i % 2 === 0);
        assert.equal(
          result.compensation,
          i % 2 === 0 ? (i === 2 ? 50 : i === 4 ? 250 : 500) : 0,
        );
      }
    }
    const state = (await s.call(player.cookie, "state")).data;
    assert.equal(state.inventory.owned.length, 5);
    assert.equal(state.inventory.equipped.chair, "chair-classic");
    assert.equal(
      (
        await s.call(player.cookie, "inventory/equip", {
          slot: "chair",
          itemId: "chair-royal",
        })
      ).status,
      200,
    );
    assert.equal((await s.call(player.cookie, "shop/openings")).data.length, 7);
    assert.equal((await s.call(admin, "shop/openings")).data.length, 0);
    assert.equal(
      (
        await s.call("", "shop/open", {
          caseId: "chairs",
          requestId: "anonymous-request-1",
        })
      ).status,
      401,
    );
  } finally {
    await s.close();
  }
});

test("Открытие кейса атомарно меняет свободный стек, запрещено во время раздачи, повтор безопасен", async () => {
  let time = 1_800_000_000_000,
    rolls = 0;
  const s = await open(
    ":memory:",
    () => time,
    () => {
      rolls++;
      return 7900;
    },
  );
  try {
    const admin = await s.setup(),
      player = await s.add(admin, "seated_buyer", 2000),
      room = await s.create(player.cookie),
      id = room.room.id;
    await s.call(player.cookie, `rooms/${id}/bot`, { seat: 1 });
    const first = await s.call(player.cookie, "shop/open", {
      caseId: "decks",
      requestId: "seated-opening-01",
    });
    assert.equal(first.status, 200);
    assert.equal(
      first.data.activeRoom.players.find((p: any) => p.id === player.user.id)
        .chips,
      1500,
    );
    assert.equal(first.data.account.balance, 1500);
    const start = (await s.call(player.cookie, `rooms/${id}/start`, {})).data
      .room;
    const balance = (await s.call(player.cookie, "state")).data.account.balance;
    assert.equal(
      (
        await s.call(player.cookie, "shop/open", {
          caseId: "chairs",
          requestId: "seated-opening-02",
        })
      ).status,
      400,
    );
    const replay = await s.call(player.cookie, "shop/open", {
      caseId: "decks",
      requestId: "seated-opening-01",
    });
    assert.equal(replay.status, 200);
    assert.equal(replay.data.account.balance, balance);
    assert.equal(rolls, 1);
    assert.equal(
      (
        await s.call(player.cookie, "shop/open", {
          caseId: "chairs",
          requestId: "seated-opening-01",
        })
      ).status,
      409,
    );
    time = start.deal.endsAt + 1;
    await s.call(player.cookie, `rooms/${id}/action`, { kind: "fold" });
    const before = (await s.call(player.cookie, "state")).data.account.balance;
    const second = await s.call(player.cookie, "shop/open", {
      caseId: "decks",
      requestId: "seated-opening-02",
    });
    assert.equal(second.data.account.balance, before - 450);
    assert.equal(second.data.caseOpening.duplicate, true);
    await s.call(player.cookie, `rooms/${id}/leave`, {});
    assert.equal(
      (await s.call(player.cookie, "state")).data.account.balance,
      before - 450,
    );
  } finally {
    await s.close();
  }
});

test("Повтор открытия переживает перезапуск; история и предметы принадлежат аккаунту", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "poker-cases-")),
    path = pathJoin(dir, "game.sqlite");
  let calls = 0,
    s = await open(path, undefined, () => {
      calls++;
      return 9400;
    });
  try {
    const admin = await s.setup(),
      player = await s.add(admin, "persistent_buyer", 2000);
    const first = (
      await s.call(player.cookie, "shop/open", {
        caseId: "decks",
        requestId: "persistent-case-01",
      })
    ).data.caseOpening;
    await s.call(player.cookie, "shop/open", {
      caseId: "decks",
      requestId: "persistent-case-02",
    });
    await s.close();
    s = await open(path, undefined, () => {
      calls++;
      return 0;
    });
    const replay = await s.call(player.cookie, "shop/open", {
      caseId: "decks",
      requestId: "persistent-case-01",
    });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.data.caseOpening, first);
    assert.equal(replay.data.account.balance, 1250);
    assert.equal(calls, 2);
    const login = await s.call("", "login", {
      login: "persistent_buyer",
      password,
    });
    assert.ok(login.data.inventory.owned.includes("deck-garnet"));
    assert.equal((await s.call(login.cookie!, "shop/openings")).data.length, 2);
    assert.equal((await s.call(admin, "shop/openings")).data.length, 0);
  } finally {
    await s.close();
    rmSync(dir, { recursive: true });
  }
});

test("Параллельные открытия не тратят баланс дважды; недостаток фишек и неверные запросы не списывают", async () => {
  let calls = 0;
  const s = await open(":memory:", undefined, () => {
    calls++;
    return 0;
  });
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "concurrent_a", 500),
      b = await s.add(admin, "concurrent_b", 500);
    const same = await Promise.all([
      s.call(a.cookie, "shop/open", {
        caseId: "chairs",
        requestId: "concurrent-same-key",
      }),
      s.call(a.cookie, "shop/open", {
        caseId: "chairs",
        requestId: "concurrent-same-key",
      }),
    ]);
    assert.deepEqual(
      same.map((r) => r.status),
      [200, 200],
    );
    assert.equal((await s.call(a.cookie, "state")).data.account.balance, 0);
    const different = await Promise.all([
      s.call(b.cookie, "shop/open", {
        caseId: "decks",
        requestId: "concurrent-key-01",
      }),
      s.call(b.cookie, "shop/open", {
        caseId: "decks",
        requestId: "concurrent-key-02",
      }),
    ]);
    assert.deepEqual(different.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await s.call(b.cookie, "state")).data.account.balance, 0);
    assert.equal(calls, 2);
    assert.equal(
      (
        await s.call(a.cookie, "shop/open", {
          caseId: "chairs",
          requestId: "insufficient-key-01",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.call(admin, "shop/open", {
          caseId: "unknown",
          requestId: "invalid-case-key01",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.call(admin, "shop/open", {
          caseId: "chairs",
          requestId: "short",
        })
      ).status,
      400,
    );
    assert.equal(calls, 2);
    assert.equal((await s.call(admin, "state")).data.account.balance, 2000);
  } finally {
    await s.close();
  }
});

test("Администратор уже владеет всеми предметами: выпавший предмет даёт компенсацию", async () => {
  const s = await open(":memory:", undefined, () => 9999);
  try {
    const admin = await s.setup();
    const result = await s.call(admin, "shop/open", {
      caseId: "decks",
      requestId: "admin-exclusive-01",
    });
    assert.equal(result.data.caseOpening.itemId, "deck-ivory");
    assert.equal(result.data.caseOpening.duplicate, true);
    assert.equal(result.data.caseOpening.compensation, 500);
    assert.equal(result.data.account.balance, 2000);
    assert.equal(result.data.inventory.owned.length, 8);
  } finally {
    await s.close();
  }
});

test("Выход в активной раздаче освобождает место, сохраняет ставки и баланс атомарно после перезапуска", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "poker-leave-")),
    path = pathJoin(dir, "game.sqlite");
  let time = 1_800_000_000_000,
    s = await open(path, () => time);
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "leaving_a"),
      b = await s.add(admin, "leaving_b"),
      c = await s.add(admin, "leaving_c"),
      room = await s.create(a.cookie),
      id = room.room.id;
    await s.call(b.cookie, `rooms/${id}/join`, {});
    await s.call(c.cookie, `rooms/${id}/join`, {});
    let g = (await s.call(a.cookie, `rooms/${id}/start`, {})).data.room;
    time = g.deal.endsAt + 1;
    // The small blind leaves out of turn; their ten chips remain in the bank.
    const result = await s.call(b.cookie, `rooms/${id}/leave`, {});
    assert.equal(result.status, 200);
    g = result.data.room;
    assert.equal(result.data.account.balance, 1990);
    assert.equal(result.data.activeRoom, undefined);
    assert.equal(
      g.players.some((p: any) => p.id === b.user.id),
      false,
    );
    assert.equal(g.departedBets[0].total, 10);
    assert.equal(g.actor, a.user.id);
    assert.equal((await s.call(b.cookie, `rooms/${id}/leave`, {})).status, 400);
    await s.close();
    s = await open(path, () => time);
    g = (await s.call(a.cookie, `rooms/${id}`)).data.room;
    assert.equal(g.departedBets[0].total, 10);
    assert.equal((await s.call(b.cookie, "state")).data.account.balance, 1990);
    const reseated = await s.call(b.cookie, `rooms/${id}/join`, { seat: 1 });
    assert.equal(reseated.status, 200);
    assert.equal(
      reseated.data.room.players.find((p: any) => p.id === b.user.id).cards
        .length,
      0,
    );
    assert.equal(
      reseated.data.room.players.find((p: any) => p.id === b.user.id).folded,
      true,
    );
    const final = await s.call(a.cookie, `rooms/${id}/leave`, {});
    assert.equal(final.status, 200);
    assert.equal(final.data.room.phase, "showdown");
    const funds =
      final.data.room.players.reduce(
        (sum: number, p: any) => sum + p.chips,
        0,
      ) + final.data.account.balance;
    assert.equal(funds, 6000);
    assert.equal(
      final.data.room.lastResult.winners.some(
        (w: any) => w.id === b.user.id || w.id === a.user.id,
      ),
      false,
    );
    assert.equal(final.data.room.room.hostId, b.user.id);
  } finally {
    await s.close();
    rmSync(dir, { recursive: true });
  }
});

test("Выйти можно во время раздачи карт и на паузе; чужие команды по-прежнему закрыты", async () => {
  let time = 1_800_000_000_000;
  const s = await open(":memory:", () => time);
  try {
    const admin = await s.setup(),
      a = await s.add(admin, "exit_player"),
      b = await s.add(admin, "exit_watcher"),
      room = await s.create(a.cookie),
      id = room.room.id;
    await s.call(a.cookie, `rooms/${id}/bot`, { seat: 1 });
    await s.call(a.cookie, `rooms/${id}/bot`, { seat: 2 });
    await s.call(a.cookie, `rooms/${id}/start`, {});
    await s.call(a.cookie, `rooms/${id}/pause`, {});
    assert.equal((await s.call(b.cookie, `rooms/${id}/leave`, {})).status, 400);
    const left = await s.call(a.cookie, `rooms/${id}/leave`, {});
    assert.equal(left.status, 200);
    assert.equal(left.data.room.paused, true);
    assert.equal(left.data.room.deadline, null);
    assert.ok(
      left.data.room.players.find((p: any) => p.id === left.data.room.actor)
        ?.bot,
    );
    assert.equal(left.data.account.balance, 2000);
    assert.equal(left.data.activeRoom, undefined);
  } finally {
    await s.close();
  }
});
