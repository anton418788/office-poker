import { randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { cosmeticItems } from "../shared/cosmetics.js";
import {
  giftCompensation,
  profileCombinations,
  type GiftRarity,
  type PlayerProfile,
  type ProfileGift,
} from "../shared/profile.js";
import type { Game } from "../shared/types.js";

/** All mutations run inside the caller's room/equipment transaction. */
export function createProfiles(
  db: DatabaseSync,
  ownedFor: (id: string) => string[] | null,
  pick = randomInt,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_hands (roomId TEXT NOT NULL, hand INTEGER NOT NULL, completedAt INTEGER NOT NULL, PRIMARY KEY(roomId,hand));
    CREATE TABLE IF NOT EXISTS profile_stats (userId TEXT PRIMARY KEY, hands INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, showdowns INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS profile_combinations (userId TEXT NOT NULL, combination TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(userId,combination));
    CREATE TABLE IF NOT EXISTS profile_gifts (id TEXT PRIMARY KEY, userId TEXT NOT NULL, rarity TEXT NOT NULL, combination TEXT NOT NULL, createdAt INTEGER NOT NULL, openedAt INTEGER, itemId TEXT, compensation INTEGER NOT NULL DEFAULT 0, issuedAsGift INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS profile_gifts_owner ON profile_gifts(userId,openedAt);
  `);
  const missing = (owned: string[], rarity: GiftRarity) =>
    cosmeticItems.filter(
      (item) =>
        item.slot === "accessory" &&
        item.rarity === rarity &&
        !owned.includes(item.id),
    );
  const credit = (id: string, amount: number) =>
    db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(amount, id);
  function record(roomId: string, game: Game, at: number) {
    const result = game.lastResult;
    if (
      game.phase !== "showdown" ||
      result?.hand !== game.hand ||
      !result.statistics
    )
      return;
    const inserted = db
      .prepare("INSERT OR IGNORE INTO profile_hands VALUES(?,?,?)")
      .run(roomId, game.hand, at);
    if (!inserted.changes) return;
    for (const outcome of result.statistics) {
      const owned = ownedFor(outcome.id);
      if (!owned) continue;
      db.prepare(
        `INSERT INTO profile_stats VALUES(?,1,?,?) ON CONFLICT(userId) DO UPDATE SET hands=hands+1,wins=wins+excluded.wins,showdowns=showdowns+excluded.showdowns`,
      ).run(outcome.id, outcome.won ? 1 : 0, outcome.combination ? 1 : 0);
      if (!outcome.combination) continue;
      db.prepare(
        `INSERT INTO profile_combinations VALUES(?,?,1) ON CONFLICT(userId,combination) DO UPDATE SET count=count+1`,
      ).run(outcome.id, outcome.combination);
      const definition = profileCombinations.find(
        (c) => c.id === outcome.combination,
      );
      if (!outcome.won || !definition?.rarity) continue;
      const rarity = definition.rarity,
        full = missing(owned, rarity).length === 0;
      const compensation = full ? giftCompensation[rarity] : 0;
      db.prepare("INSERT INTO profile_gifts VALUES(?,?,?,?,?,?,NULL,?,?)").run(
        randomUUID(),
        outcome.id,
        rarity,
        outcome.combination,
        at,
        full ? at : null,
        compensation,
        full ? 0 : 1,
      );
      if (compensation) {
        credit(outcome.id, compensation);
        const seated = game.players.find((p) => p.id === outcome.id);
        if (seated) seated.chips += compensation;
      }
    }
  }
  const columns =
    "id,rarity,combination,createdAt,openedAt,itemId,compensation";
  function profile(id: string): PlayerProfile {
    const stats = db
      .prepare("SELECT hands,wins,showdowns FROM profile_stats WHERE userId=?")
      .get(id) as
      Pick<PlayerProfile, "hands" | "wins" | "showdowns"> | undefined;
    const collection = { common: 0, rare: 0, epic: 0, exclusive: 0 };
    const owned = new Set(ownedFor(id) ?? []);
    for (const item of cosmeticItems)
      if (owned.has(item.id)) collection[item.rarity]++;
    const combinations = Object.fromEntries(
      (
        db
          .prepare(
            "SELECT combination,count FROM profile_combinations WHERE userId=?",
          )
          .all(id) as { combination: string; count: number }[]
      ).map((row) => [row.combination, row.count]),
    );
    const gifts = db
      .prepare(
        `SELECT ${columns} FROM profile_gifts WHERE userId=? AND openedAt IS NULL ORDER BY createdAt,rowid`,
      )
      .all(id) as ProfileGift[];
    const recentRewards = db
      .prepare(
        `SELECT ${columns} FROM profile_gifts WHERE userId=? AND openedAt IS NOT NULL ORDER BY openedAt DESC,rowid DESC LIMIT 10`,
      )
      .all(id) as ProfileGift[];
    const seq = db
      .prepare(
        "SELECT COALESCE(MAX(rowid),0) AS value FROM profile_gifts WHERE userId=? AND issuedAsGift=1",
      )
      .get(id) as { value: number };
    return {
      ...(stats ?? { hands: 0, wins: 0, showdowns: 0 }),
      combinations,
      collection,
      gifts,
      recentRewards,
      giftSequence: seq.value,
    };
  }
  function open(id: string, giftId: string, at: number): ProfileGift {
    const gift = db
      .prepare(`SELECT ${columns} FROM profile_gifts WHERE id=? AND userId=?`)
      .get(giftId, id) as ProfileGift | undefined;
    if (!gift) throw Object.assign(Error("Подарок не найден"), { status: 404 });
    if (gift.openedAt !== null) return { ...gift };
    const candidates = missing(ownedFor(id) ?? [], gift.rarity);
    const item = candidates.length ? candidates[pick(candidates.length)] : null;
    const compensation = item ? 0 : giftCompensation[gift.rarity];
    if (item) db.prepare("INSERT INTO user_items VALUES(?,?)").run(id, item.id);
    if (compensation) credit(id, compensation);
    db.prepare(
      "UPDATE profile_gifts SET openedAt=?,itemId=?,compensation=? WHERE id=? AND userId=? AND openedAt IS NULL",
    ).run(at, item?.id ?? null, compensation, giftId, id);
    return { ...gift, openedAt: at, itemId: item?.id ?? null, compensation };
  }
  return { record, profile, open };
}
