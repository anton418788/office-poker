import {
  CASE_PRICE,
  CASE_ROLL_SIZE,
  drawCase,
  duplicateCompensation,
  shopCase,
  type CaseOpening,
  type CaseId,
} from "../shared/cases.js";
import {
  cosmeticItems,
  cosmeticItem,
  defaultAppearance,
  normalizeAppearance,
  type Inventory,
  type Appearance,
} from "../shared/cosmetics.js";
import express from "express";
import { randomBytes, randomUUID, randomInt } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  createGame,
  join,
  leave,
  start,
  action,
  pause,
  running,
  view,
  log,
} from "./engine.js";
import { addBot, step } from "./bots.js";
import { isDealing } from "../shared/dealing.js";
import { createProfiles } from "./profiles.js";
import { prepareAvatar } from "./avatars.js";
import { MAX_AVATAR_BYTES } from "../shared/avatar.js";
import {
  tableReactions,
  REACTION_DURATION,
  REACTION_COOLDOWN,
} from "../shared/reactions.js";
import {
  chipsAmount,
  displayName,
  loginName,
  passwordHash,
  passwordMatches,
  tokenHash,
} from "./accounts.js";
import type { Account, ClubState, Game, RoomSummary } from "../shared/types.js";

type UserRow = {
  avatarVersion?: string | null;
  id: string;
  login: string | null;
  name: string;
  password: string | null;
  balance: number;
  admin: number;
};
type Room = {
  id: string;
  name: string;
  hostId: string;
  game: Game;
  emptySince: number | null;
};
export const EMPTY_ROOM_MS = 5 * 60_000;
export const PRESENCE_MS = 45_000;
const SESSION_MS = 30 * 86400_000;
const avatarUrl = (u?: UserRow) =>
  u?.avatarVersion ? `/api/avatars/${u.id}/${u.avatarVersion}.webp` : null;
const publicUser = (u: UserRow): Account => ({
  avatarUrl: avatarUrl(u),
  id: u.id,
  login: u.login,
  name: u.name,
  balance: u.balance,
  admin: !!u.admin,
});
function fail(message: string, status = 400): never {
  throw Object.assign(Error(message), { status });
}
export function roomSettings(body: Record<string, unknown>): Game["settings"] {
  const { small, big, minutes, step: increment } = body;
  if (
    ![small, big, minutes, increment].every(Number.isSafeInteger) ||
    (small as number) < 1 ||
    (big as number) < (small as number) * 2 ||
    (big as number) > 10000 ||
    (minutes as number) < 1 ||
    (minutes as number) > 1440 ||
    (increment as number) < 1 ||
    (increment as number) > 10000
  )
    fail(
      "Блайнды: большой ≥ 2 малых и ≤ 10 000. Ход: 1–1440 минут. Шаг рейза: 1–10 000.",
    );
  return {
    small: small as number,
    big: big as number,
    minutes: minutes as number,
    step: increment as number,
    stack: Math.max(2000, (big as number) * 100),
  };
}
export function createApp(
  path: string,
  options: { now?: () => number; caseRoll?: () => number } = {},
) {
  const now = options.now ?? Date.now;
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login TEXT UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password TEXT, balance INTEGER NOT NULL CHECK(balance>=0), admin INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS account_sessions (token TEXT PRIMARY KEY, userId TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS user_items (userId TEXT NOT NULL, itemId TEXT NOT NULL, PRIMARY KEY(userId,itemId));
    CREATE TABLE IF NOT EXISTS user_equipment (userId TEXT PRIMARY KEY, chair TEXT NOT NULL, deck TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS case_openings (userId TEXT NOT NULL, requestId TEXT NOT NULL, caseId TEXT NOT NULL, json TEXT NOT NULL, openedAt INTEGER NOT NULL, PRIMARY KEY(userId,requestId));
    CREATE INDEX IF NOT EXISTS case_openings_user_time ON case_openings(userId,openedAt DESC);
    CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  db.exec(
    "CREATE TABLE IF NOT EXISTS user_avatars (userId TEXT PRIMARY KEY, image BLOB NOT NULL)",
  );
  if (
    !(db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).some(
      (column) => column.name === "avatarVersion",
    )
  )
    db.exec("ALTER TABLE users ADD COLUMN avatarVersion TEXT");
  if (
    !(
      db.prepare("PRAGMA table_info(user_equipment)").all() as {
        name: string;
      }[]
    ).some((column) => column.name === "accessory")
  )
    db.exec("ALTER TABLE user_equipment ADD COLUMN accessory TEXT");
  const transaction = (fn: () => void) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      fn();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  // Import anonymous-era balances without granting access through old cookies.
  if (
    !db.prepare("SELECT key FROM schema_meta WHERE key='accounts-v1'").get()
  ) {
    transaction(() => {
      const oldTable = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='state'",
        )
        .get();
      const row = oldTable
        ? (db.prepare("SELECT json FROM state WHERE id=1").get() as
            { json: string } | undefined)
        : undefined;
      if (row) {
        const g: Game = JSON.parse(row.json);
        for (const p of g.players.filter((p) => !p.bot))
          db.prepare(
            "INSERT OR IGNORE INTO users (id,login,name,password,balance,admin) VALUES(?,NULL,?,NULL,?,0)",
          ).run(p.id, p.name, p.chips);
        if (g.players.length) {
          const sessionTable = db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
            )
            .get();
          const oldHost = sessionTable
            ? (db
                .prepare("SELECT id FROM sessions WHERE admin=1 LIMIT 1")
                .get() as { id: string } | undefined)
            : undefined;
          const room: Room = {
            id: randomUUID(),
            name: "Переговорка",
            hostId: oldHost?.id ?? g.players.find((p) => !p.bot)?.id ?? "",
            game: g,
            emptySince: now(),
          };
          db.prepare("INSERT INTO rooms VALUES(?,?)").run(
            room.id,
            JSON.stringify(room),
          );
        }
      }
      db.prepare("INSERT INTO schema_meta VALUES('accounts-v1','1')").run();
    });
  }
  const rooms = new Map<string, Room>(
    (db.prepare("SELECT json FROM rooms").all() as { json: string }[]).map(
      (r) => {
        const room: Room = JSON.parse(r.json);
        return [room.id, room];
      },
    ),
  );
  const presence = new Map<string, Map<string, number>>();
  const user = (id: string) =>
    db.prepare("SELECT * FROM users WHERE id=?").get(id) as UserRow | undefined;
  const inventoryFor = (u: UserRow): Inventory => {
    const extras = (
      db.prepare("SELECT itemId FROM user_items WHERE userId=?").all(u.id) as {
        itemId: string;
      }[]
    ).map((row) => row.itemId);
    const owned = u.admin
      ? cosmeticItems.map((item) => item.id)
      : [
          ...new Set([
            defaultAppearance.chair,
            defaultAppearance.deck,
            ...extras.filter((id) => cosmeticItem(id)),
          ]),
        ];
    const saved = db
      .prepare("SELECT chair,deck,accessory FROM user_equipment WHERE userId=?")
      .get(u.id) as Appearance | undefined;
    const equipped = normalizeAppearance(saved);
    if (!owned.includes(equipped.chair))
      equipped.chair = defaultAppearance.chair;
    if (!owned.includes(equipped.deck)) equipped.deck = defaultAppearance.deck;
    if (equipped.accessory && !owned.includes(equipped.accessory))
      equipped.accessory = null;
    return { owned, equipped };
  };
  const profiles = createProfiles(db, (id) => {
    const account = user(id);
    return account ? inventoryFor(account).owned : null;
  });
  // Older rooms acquire the same account appearance without changing the hand's deck.
  for (const room of rooms.values())
    for (const p of room.game.players) {
      const account = !p.bot ? user(p.id) : undefined;
      p.appearance = account
        ? inventoryFor(account).equipped
        : { ...defaultAppearance };
    }
  const initialized = () =>
    !!db
      .prepare("SELECT id FROM users WHERE admin=1 AND password IS NOT NULL")
      .get();
  const occupied = (id: string) =>
    [...rooms.values()].find((r) =>
      r.game.players.some((p) => p.id === id && !p.bot),
    );
  const onlineIds = (room: Room) =>
    room.game.players
      .filter(
        (p) =>
          !p.bot &&
          (presence.get(room.id)?.get(p.id) ?? -Infinity) > now() - PRESENCE_MS,
      )
      .map((p) => p.id);
  const saveRoom = (room: Room, withdrawn?: { id: string; chips: number }) => {
    transaction(() => {
      if (withdrawn)
        db.prepare("UPDATE users SET balance=? WHERE id=?").run(
          withdrawn.chips,
          withdrawn.id,
        );
      for (const p of room.game.players.filter((p) => !p.bot))
        db.prepare("UPDATE users SET balance=? WHERE id=?").run(p.chips, p.id);
      profiles.record(room.id, room.game, now());
      db.prepare("INSERT OR REPLACE INTO rooms VALUES(?,?)").run(
        room.id,
        JSON.stringify(room),
      );
    });
    rooms.set(room.id, room);
  };
  const touch = (room: Room, id: string) => {
    if (!room.game.players.some((p) => p.id === id && !p.bot)) return;
    if (!presence.has(room.id)) presence.set(room.id, new Map());
    presence.get(room.id)!.set(id, now());
    if (room.emptySince !== null) {
      room.emptySince = null;
      saveRoom(room);
    }
  };
  const summaries = (id: string): RoomSummary[] =>
    [...rooms.values()].map((r) => ({
      id: r.id,
      name: r.name,
      hostId: r.hostId,
      hostName: user(r.hostId)?.name ?? "Хост не в сети",
      humans: r.game.players.filter((p) => !p.bot).length,
      bots: r.game.players.filter((p) => p.bot).length,
      online: onlineIds(r).length,
      phase: r.game.phase,
      small: r.game.settings.small,
      big: r.game.settings.big,
      minutes: r.game.settings.minutes,
      emptySince: r.emptySince,
      seated: r.game.players.some((p) => p.id === id),
    }));
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use("/api", (req, res, next) => {
    if (
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.headers.host}`
    ) {
      res.status(403).json({ error: "Запрос с другого сайта запрещён" });
      return;
    }
    res.set("Cache-Control", "no-store");
    const raw = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("poker="))
      ?.slice(6);
    const session = raw
      ? (db
          .prepare(
            "SELECT userId FROM account_sessions WHERE token=? AND expires>?",
          )
          .get(tokenHash(raw), now()) as { userId: string } | undefined)
      : undefined;
    res.locals.account = session ? user(session.userId) : undefined;
    res.locals.raw = raw;
    res.locals.local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress ?? "",
    );
    next();
  });
  const requireUser: express.RequestHandler = (_req, res, next) => {
    if (!res.locals.account) {
      res.status(401).json({ error: "Войдите в аккаунт" });
      return;
    }
    next();
  };
  const requireAdmin: express.RequestHandler = (_req, res, next) => {
    if (!res.locals.account?.admin) {
      res.status(403).json({ error: "Нужны права администратора" });
      return;
    }
    next();
  };
  const roomView = (room: Room, u: UserRow) => {
    const game = view(room.game, u.id, !!u.admin);
    return {
      ...game,
      players: game.players.map((p) => ({
        ...p,
        avatarUrl: p.bot ? null : avatarUrl(user(p.id)),
      })),
      reactions: (room.game.reactions ?? []).filter(
        (event) =>
          event.expiresAt > now() &&
          room.game.players.some((p) => p.id === event.playerId),
      ),
      room: {
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        hostName: user(room.hostId)?.name ?? "Хост",
      },
      canManage: room.hostId === u.id || !!u.admin,
    };
  };
  const state = (res: express.Response, room?: Room): ClubState => {
    const u = res.locals.account ? user(res.locals.account.id) : null;
    const active = u ? occupied(u.id) : undefined;
    // A seated player remains present while using any menu, including accounts.
    if (active && u) touch(active, u.id);
    return {
      account: u ? publicUser(u) : null,
      needsSetup: !initialized(),
      canSetup: !initialized() && res.locals.local,
      rooms: u ? summaries(u.id) : [],
      ...(u ? { inventory: inventoryFor(u) } : {}),
      ...(u ? { profile: profiles.profile(u.id) } : {}),
      ...(room && u ? { room: roomView(room, u) } : {}),
      ...(active && u
        ? {
            activeRoom:
              active.id === room?.id ? roomView(room, u) : roomView(active, u),
          }
        : {}),
    };
  };
  const sessionCookie = (
    req: express.Request,
    res: express.Response,
    id: string,
  ) => {
    const raw = randomBytes(32).toString("hex");
    // Rotate the caller's session, preventing session fixation.
    if (res.locals.raw)
      db.prepare("DELETE FROM account_sessions WHERE token=?").run(
        tokenHash(res.locals.raw),
      );
    db.prepare("INSERT INTO account_sessions VALUES(?,?,?)").run(
      tokenHash(raw),
      id,
      now() + SESSION_MS,
    );
    res.cookie("poker", raw, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.secure,
      maxAge: SESSION_MS,
    });
    res.locals.account = user(id);
  };
  app.get("/api/state", (_req, res) => res.json(state(res)));
  app.post("/api/setup", async (req, res) => {
    if (initialized()) fail("Администратор уже создан", 403);
    if (!res.locals.local)
      fail("Первого администратора создайте на компьютере сервера", 403);
    const login = loginName(req.body?.login),
      name = displayName(req.body?.name),
      password = await passwordHash(req.body?.password);
    if (initialized()) fail("Администратор уже создан", 403);
    let legacyId: string | undefined;
    if (
      res.locals.raw &&
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
        )
        .get()
    )
      legacyId = (
        db
          .prepare("SELECT id FROM sessions WHERE token=? AND admin=1")
          .get(tokenHash(res.locals.raw)) as { id: string } | undefined
      )?.id;
    const id = legacyId ?? randomUUID();
    const existing = user(id);
    if (existing)
      db.prepare(
        "UPDATE users SET login=?,name=?,password=?,admin=1 WHERE id=?",
      ).run(login, name, password, id);
    else
      db.prepare(
        "INSERT INTO users (id,login,name,password,balance,admin) VALUES(?,?,?,?,?,1)",
      ).run(id, login, name, password, 2000);
    for (const r of rooms.values())
      if (r.hostId === id) {
        const p = r.game.players.find((p) => p.id === id);
        if (p) p.name = name;
        saveRoom(r);
      }
    sessionCookie(req, res, id);
    res.json(state(res));
  });
  const attempts = new Map<string, { count: number; until: number }>();
  app.post("/api/login", async (req, res) => {
    const address = req.socket.remoteAddress ?? "unknown";
    for (const [key, v] of attempts) if (v.until <= now()) attempts.delete(key);
    const limit = attempts.get(address) ?? {
      count: 0,
      until: now() + 15 * 60_000,
    };
    if (limit.count >= 10)
      fail("Слишком много попыток. Повторите через 15 минут.", 429);
    limit.count++;
    attempts.set(address, limit);
    const login =
      typeof req.body?.login === "string" ? req.body.login.toLowerCase() : "";
    const u = db.prepare("SELECT * FROM users WHERE login=?").get(login) as
      UserRow | undefined;
    const correct = await passwordMatches(
      req.body?.password,
      u?.password ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
    );
    if (!u?.password || !correct || user(u.id)?.password !== u.password)
      fail("Неверный логин или пароль", 401);
    attempts.delete(address);
    sessionCookie(req, res, u.id);
    res.json(state(res));
  });
  app.post("/api/logout", requireUser, (_req, res) => {
    if (res.locals.raw)
      db.prepare("DELETE FROM account_sessions WHERE token=?").run(
        tokenHash(res.locals.raw),
      );
    for (const p of presence.values()) p.delete(res.locals.account.id);
    res.clearCookie("poker", { httpOnly: true, sameSite: "strict" });
    res.locals.account = undefined;
    res.json(state(res));
  });
  app.post("/api/inventory/equip", requireUser, (req, res) => {
    const u: UserRow = res.locals.account;
    const { slot, itemId } = req.body ?? {};
    if (slot !== "chair" && slot !== "deck" && slot !== "accessory")
      fail("Неизвестная категория предмета");
    const item = cosmeticItem(itemId, slot);
    const clearing = slot === "accessory" && itemId === null;
    if (!item && !clearing) fail("Предмет не найден");
    const inventory = inventoryFor(u);
    if (item && !inventory.owned.includes(item.id))
      fail("Этого предмета пока нет в вашем инвентаре", 403);
    const equipped = { ...inventory.equipped, [slot]: item?.id ?? null };
    const active = occupied(u.id);
    const next = active ? structuredClone(active) : null;
    if (next)
      next.game.players.find((p) => p.id === u.id)!.appearance = equipped;
    transaction(() => {
      db.prepare(
        "INSERT OR REPLACE INTO user_equipment (userId,chair,deck,accessory) VALUES(?,?,?,?)",
      ).run(u.id, equipped.chair, equipped.deck, equipped.accessory);
      if (next)
        db.prepare("UPDATE rooms SET json=? WHERE id=?").run(
          JSON.stringify(next),
          next.id,
        );
    });
    if (next) rooms.set(next.id, next);
    res.json(state(res));
  });
  const avatarUploads = new Set<string>();
  app.post(
    "/api/profile/avatar",
    requireUser,
    express.raw({
      type: [
        "application/octet-stream",
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
      limit: MAX_AVATAR_BYTES,
    }),
    async (req, res) => {
      const u: UserRow = res.locals.account;
      if (!Buffer.isBuffer(req.body))
        fail("Выберите изображение JPG, PNG или WebP");
      if (avatarUploads.has(u.id)) fail("Аватарка уже загружается", 429);
      avatarUploads.add(u.id);
      try {
        const image = await prepareAvatar(req.body);
        transaction(() => {
          db.prepare("INSERT OR REPLACE INTO user_avatars VALUES(?,?)").run(
            u.id,
            image,
          );
          db.prepare("UPDATE users SET avatarVersion=? WHERE id=?").run(
            randomUUID(),
            u.id,
          );
        });
        res.json(state(res));
      } finally {
        avatarUploads.delete(u.id);
      }
    },
  );
  app.post("/api/profile/avatar/remove", requireUser, (_req, res) => {
    const u: UserRow = res.locals.account;
    if (avatarUploads.has(u.id))
      fail("Дождитесь завершения загрузки аватарки", 409);
    transaction(() => {
      db.prepare("DELETE FROM user_avatars WHERE userId=?").run(u.id);
      db.prepare("UPDATE users SET avatarVersion=NULL WHERE id=?").run(u.id);
    });
    res.json(state(res));
  });
  app.get("/api/avatars/:id/:version", requireUser, (req, res) => {
    const target = user(String(req.params.id));
    if (
      !target?.avatarVersion ||
      req.params.version !== `${target.avatarVersion}.webp`
    )
      fail("Аватарка не найдена", 404);
    const row = db
      .prepare("SELECT image FROM user_avatars WHERE userId=?")
      .get(target.id) as { image: Uint8Array } | undefined;
    if (!row) fail("Аватарка не найдена", 404);
    res
      .set("Cache-Control", "private, max-age=31536000, immutable")
      .set("X-Content-Type-Options", "nosniff")
      .type("image/webp")
      .send(Buffer.from(row.image));
  });
  app.get("/api/profiles/:id", requireUser, (req, res) => {
    const target = user(String(req.params.id));
    if (!target) fail("Профиль игрока не найден", 404);
    const { hands, wins, showdowns, combinations, collection } =
      profiles.profile(target.id);
    res.json({
      player: {
        id: target.id,
        name: target.name,
        balance: target.balance,
        admin: !!target.admin,
        avatarUrl: avatarUrl(target),
      },
      hands,
      wins,
      showdowns,
      combinations,
      collection,
    });
  });
  app.post("/api/profile/gifts/:id/open", requireUser, (req, res) => {
    const u: UserRow = res.locals.account;
    const giftId = String(req.params.id);
    const current = profiles.profile(u.id);
    const pendingGift = current.gifts.some((g) => g.id === giftId);
    const active = occupied(u.id);
    if (
      pendingGift &&
      active &&
      (running(active.game) || isDealing(active.game, now()))
    )
      fail(
        "Открыть подарок можно между раздачами. Ваше место за столом сохранено.",
      );
    const next = active ? structuredClone(active) : null;
    let opening;
    transaction(() => {
      opening = profiles.open(u.id, giftId, now());
      if (next) {
        next.game.players.find((p) => p.id === u.id)!.chips = user(
          u.id,
        )!.balance;
        db.prepare("UPDATE rooms SET json=? WHERE id=?").run(
          JSON.stringify(next),
          next.id,
        );
      }
    });
    if (next) rooms.set(next.id, next);
    res.json({ ...state(res), giftOpening: opening });
  });
  app.get("/api/shop/openings", requireUser, (_req, res) => {
    const rows = db
      .prepare(
        "SELECT json FROM case_openings WHERE userId=? ORDER BY openedAt DESC,rowid DESC LIMIT 10",
      )
      .all(res.locals.account.id) as { json: string }[];
    res.json(rows.map((row) => JSON.parse(row.json)));
  });
  app.post("/api/shop/open", requireUser, (req, res) => {
    const u = user(res.locals.account.id)!;
    const { caseId, requestId } = req.body ?? {};
    if (!shopCase(caseId)) fail("Кейс не найден");
    if (
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)
    )
      fail("Некорректный номер открытия");
    const previous = db
      .prepare(
        "SELECT caseId,json FROM case_openings WHERE userId=? AND requestId=?",
      )
      .get(u.id, requestId) as { caseId: string; json: string } | undefined;
    if (previous) {
      if (previous.caseId !== caseId)
        fail("Этот номер открытия уже использован для другого кейса", 409);
      res.json({ ...state(res), caseOpening: JSON.parse(previous.json) });
      return;
    }
    const active = occupied(u.id);
    if (active && (running(active.game) || isDealing(active.game, now())))
      fail("Открывать кейсы за игровым балансом можно между раздачами");
    if (u.balance < CASE_PRICE)
      fail("Недостаточно фишек. Для открытия нужно 500.");
    const item = drawCase(
      caseId,
      options.caseRoll ? options.caseRoll() : randomInt(CASE_ROLL_SIZE),
    );
    const duplicate = !!item && inventoryFor(u).owned.includes(item.id);
    const compensation = duplicate && item ? duplicateCompensation(item) : 0;
    const balance = u.balance - CASE_PRICE + compensation;
    const opening: CaseOpening = {
      id: requestId,
      caseId: caseId as CaseId,
      itemId: item?.id ?? null,
      rarity: item?.rarity ?? null,
      duplicate,
      compensation,
      cost: CASE_PRICE,
      balanceAfter: balance,
      openedAt: now(),
    };
    const next = active ? structuredClone(active) : null;
    if (next) next.game.players.find((p) => p.id === u.id)!.chips = balance;
    transaction(() => {
      db.prepare("UPDATE users SET balance=? WHERE id=?").run(balance, u.id);
      if (item && !duplicate)
        db.prepare("INSERT INTO user_items VALUES(?,?)").run(u.id, item.id);
      if (next)
        db.prepare("UPDATE rooms SET json=? WHERE id=?").run(
          JSON.stringify(next),
          next.id,
        );
      db.prepare("INSERT INTO case_openings VALUES(?,?,?,?,?)").run(
        u.id,
        requestId,
        caseId,
        JSON.stringify(opening),
        opening.openedAt,
      );
    });
    if (next) rooms.set(next.id, next);
    res.json({ ...state(res), caseOpening: opening });
  });
  app.get("/api/accounts", requireUser, requireAdmin, (_req, res) =>
    res.json(
      (db.prepare("SELECT * FROM users ORDER BY name").all() as UserRow[]).map(
        publicUser,
      ),
    ),
  );
  app.post("/api/accounts", requireUser, requireAdmin, async (req, res) => {
    const login = loginName(req.body?.login),
      name = displayName(req.body?.name),
      balance = chipsAmount(req.body?.balance),
      password = await passwordHash(req.body?.password);
    if (db.prepare("SELECT id FROM users WHERE login=?").get(login))
      fail("Этот логин уже занят");
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id,login,name,password,balance,admin) VALUES(?,?,?,?,?,0)",
    ).run(id, login, name, password, balance);
    res.status(201).json(publicUser(user(id)!));
  });
  app.post("/api/accounts/:id", requireUser, requireAdmin, async (req, res) => {
    const target = user(String(req.params.id));
    if (!target) fail("Аккаунт не найден", 404);
    const login = loginName(req.body?.login),
      name = displayName(req.body?.name),
      balance = chipsAmount(req.body?.balance);
    const password = req.body?.password
      ? await passwordHash(req.body.password)
      : target.password;
    if (!password) fail("Задайте пароль для первого входа");
    const duplicate = db
      .prepare("SELECT id FROM users WHERE login=? AND id<>?")
      .get(login, target.id);
    if (duplicate) fail("Этот логин уже занят");
    const currentRoom = occupied(target.id);
    if (
      currentRoom &&
      (running(currentRoom.game) || isDealing(currentRoom.game, now()))
    )
      fail("Менять аккаунт игрока можно между раздачами");
    const next = currentRoom ? structuredClone(currentRoom) : null;
    if (next) {
      const p = next.game.players.find((p) => p.id === target.id)!;
      p.chips = balance;
      p.name = name;
    }
    transaction(() => {
      db.prepare(
        "UPDATE users SET login=?,name=?,balance=?,password=? WHERE id=?",
      ).run(login, name, balance, password, target.id);
      if (req.body?.password)
        db.prepare("DELETE FROM account_sessions WHERE userId=?").run(
          target.id,
        );
      if (next)
        db.prepare("UPDATE rooms SET json=? WHERE id=?").run(
          JSON.stringify(next),
          next.id,
        );
    });
    if (next) rooms.set(next.id, next);
    res.json(publicUser(user(target.id)!));
  });
  app.post("/api/rooms", requireUser, (req, res) => {
    const u: UserRow = res.locals.account;
    if (occupied(u.id)) fail("Сначала покиньте свой текущий стол");
    const name = displayName(req.body?.name),
      settings = roomSettings(req.body?.settings ?? {});
    const game = createGame();
    game.settings = settings;
    join(game, u.id, u.name);
    game.players[0].chips = u.balance;
    game.players[0].appearance = inventoryFor(u).equipped;
    const room: Room = {
      id: randomUUID(),
      name,
      hostId: u.id,
      game,
      emptySince: null,
    };
    saveRoom(room);
    touch(room, u.id);
    res.status(201).json(state(res, room));
  });
  app.get("/api/rooms/:id", requireUser, (req, res) => {
    const room = rooms.get(String(req.params.id));
    if (!room) fail("Этот стол уже закрыт", 404);
    touch(room, res.locals.account.id);
    res.json(state(res, room));
  });
  app.post("/api/rooms/:id/:command", requireUser, (req, res) => {
    const original = rooms.get(String(req.params.id));
    if (!original) fail("Этот стол уже закрыт", 404);
    const u: UserRow = res.locals.account,
      b = req.body ?? {},
      room = structuredClone(original),
      g = room.game,
      command = String(req.params.command);
    if (
      ["bot", "start", "pause", "settings", "remove", "kick"].includes(
        command,
      ) &&
      room.hostId !== u.id &&
      !u.admin
    )
      fail("Управление доступно хосту стола", 403);
    let withdrawn: { id: string; chips: number } | undefined;
    if (
      ["bot", "settings", "remove"].includes(command) &&
      (running(g) || isDealing(g, now()))
    )
      fail("Это доступно между раздачами");
    switch (command) {
      case "reaction": {
        if (!g.players.some((p) => p.id === u.id && !p.bot))
          fail("Отправлять эмоции можно, сидя за столом", 403);
        const reaction = tableReactions.find((r) => r.id === b.reaction);
        if (!reaction) fail("Неизвестная эмоция");
        const at = now(),
          previous = g.reactions?.find((r) => r.playerId === u.id);
        if (previous && at - previous.createdAt < REACTION_COOLDOWN)
          fail("Подождите пару секунд перед следующей эмоцией", 429);
        g.reactions = [
          ...(g.reactions ?? []).filter(
            (r) =>
              r.playerId !== u.id &&
              r.expiresAt > at &&
              g.players.some((p) => p.id === r.playerId),
          ),
          {
            id: randomUUID(),
            playerId: u.id,
            reaction: reaction.id,
            createdAt: at,
            expiresAt: at + REACTION_DURATION,
          },
        ];
        break;
      }
      case "join": {
        const current = occupied(u.id);
        if (current) fail("Вы уже сидите за столом. Сначала покиньте его.");
        join(g, u.id, u.name, b.seat);
        g.players.find((p) => p.id === u.id)!.chips = u.balance;
        g.players.find((p) => p.id === u.id)!.appearance =
          inventoryFor(u).equipped;
        break;
      }
      case "action":
        action(g, u.id, b.kind, b.amount, now());
        break;
      case "start":
        start(g, now(), true);
        break;
      case "pause":
        pause(g, now());
        break;
      case "bot":
        addBot(g, b.seat);
        break;
      case "remove": {
        const p = g.players.find((p) => p.id === b.id);
        if (!p?.bot) fail("Хост может убирать только ботов");
        g.players = g.players.filter((p) => p.id !== b.id);
        break;
      }
      case "leave":
      case "kick": {
        const targetId = command === "leave" ? u.id : b.id;
        if (command === "kick" && targetId === u.id)
          fail("Для выхода используйте кнопку «Выйти из-за стола»");
        const target = g.players.find((p) => p.id === targetId);
        if (!target) fail("Участник уже покинул этот стол");
        withdrawn = leave(g, target.id, now());
        presence.get(room.id)?.delete(target.id);
        if (command === "kick")
          log(g, `${u.name} высадил участника ${target.name} из-за стола`);
        if (room.hostId === target.id) {
          room.hostId = g.players.find((p) => !p.bot)?.id ?? u.id;
          if (room.hostId !== target.id)
            log(
              g,
              `Хост стола: ${g.players.find((p) => p.id === room.hostId)?.name ?? u.name}`,
            );
        }
        break;
      }
      case "settings":
        g.settings = roomSettings(b);
        log(g, "Настройки стола обновлены");
        break;
      default:
        fail("Команда не найдена", 404);
    }
    if (onlineIds(room).length === 0 && room.emptySince === null)
      room.emptySince = now();
    saveRoom(room, withdrawn);
    touch(room, u.id);
    res.json(state(res, room));
  });
  const maintenance = () => {
    db.prepare("DELETE FROM account_sessions WHERE expires<=?").run(now());
    for (const original of [...rooms.values()]) {
      const room = structuredClone(original),
        online = onlineIds(room);
      if (!online.length) {
        if (room.emptySince === null) {
          room.emptySince = now();
          saveRoom(room);
        }
        if (now() - room.emptySince! >= EMPTY_ROOM_MS) {
          // Cancel an abandoned unfinished hand and return committed chips, never award an unattended pot.
          transaction(() => {
            for (const p of room.game.players.filter((p) => !p.bot))
              db.prepare("UPDATE users SET balance=? WHERE id=?").run(
                p.chips + (running(room.game) ? p.total : 0),
                p.id,
              );
            db.prepare("DELETE FROM rooms WHERE id=?").run(room.id);
          });
          rooms.delete(room.id);
          presence.delete(room.id);
        }
        continue;
      }
      let changed = false;
      if (room.emptySince !== null) {
        room.emptySince = null;
        changed = true;
      }
      if (step(room.game, now())) changed = true;
      if (changed) saveRoom(room);
    }
  };
  const timer = setInterval(maintenance, 1000);
  timer.unref();
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        typeof (err as { status?: unknown })?.status === "number"
          ? (err as { status: number }).status
          : 400;
      res.status(status).json({
        error:
          (err as { type?: string })?.type === "entity.too.large" &&
          _req.path === "/api/profile/avatar"
            ? "Максимальный размер аватарки — 5 МБ"
            : err instanceof Error
              ? err.message.includes("UNIQUE constraint")
                ? "Этот логин уже занят"
                : err.message
              : "Некорректный запрос",
      });
    },
  );
  return {
    app,
    maintenance,
    close: () => {
      clearInterval(timer);
      db.close();
    },
  };
}
