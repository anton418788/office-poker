import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  createGame,
  join,
  start,
  action,
  pause,
  running,
  tick,
  view,
  log,
} from "./engine.js";
import type { Game } from "../shared/types.js";
export function createApp(path: string) {
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, id TEXT NOT NULL, admin INTEGER NOT NULL);",
  );
  let game: Game = JSON.parse(
    (
      db.prepare("SELECT json FROM state WHERE id=1").get() as
        { json: string } | undefined
    )?.json ?? JSON.stringify(createGame()),
  );
  const save = (next: Game) => {
    db.prepare("INSERT OR REPLACE INTO state VALUES(1,?)").run(
      JSON.stringify(next),
    );
    game = next;
  };
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
    next();
  });
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  app.use("/api", (req, res, next) => {
    const raw = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("poker="))
      ?.slice(6);
    let session = raw
      ? (db
          .prepare("SELECT id,admin FROM sessions WHERE token=?")
          .get(hash(raw)) as { id: string; admin: number } | undefined)
      : undefined;
    if (!session) {
      const token = randomBytes(32).toString("hex");
      const id = randomBytes(12).toString("hex");
      const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress ?? "",
      );
      const admin =
        local && !db.prepare("SELECT id FROM sessions WHERE admin=1").get()
          ? 1
          : 0;
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        hash(token),
        id,
        admin,
      );
      session = { id, admin };
      res.cookie("poker", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: req.secure,
        maxAge: 365 * 86400_000,
      });
    }
    res.locals.session = session;
    next();
  });
  app.get("/api/state", (_req, res) => {
    const s = res.locals.session;
    res.json(view(game, s.id, !!s.admin));
  });
  app.post("/api/:command", (req, res) => {
    try {
      const s = res.locals.session;
      const next = structuredClone(game);
      const b = req.body ?? {};
      tick(next);
      switch (req.params.command) {
        case "join": {
          if (
            typeof b.name !== "string" ||
            b.name.trim().length < 2 ||
            b.name.trim().length > 24
          )
            throw Error("Имя: от 2 до 24 символов");
          join(next, s.id, b.name.trim());
          break;
        }
        case "action":
          action(next, s.id, b.kind, b.amount);
          break;
        case "leave": {
          if (running(next)) throw Error("Выйти можно между раздачами");
          next.players = next.players.filter((p) => p.id !== s.id);
          break;
        }
        case "start":
        case "pause":
        case "settings":
        case "chips":
        case "remove": {
          if (!s.admin) {
            res.status(403).json({ error: "Нужны права администратора" });
            return;
          }
          if (req.params.command === "start") start(next);
          if (req.params.command === "pause") pause(next);
          if (
            ["settings", "chips", "remove"].includes(req.params.command) &&
            running(next)
          )
            throw Error("Это доступно только между раздачами");
          if (req.params.command === "settings") {
            const { small, big, stack, minutes } = b;
            if (
              ![small, big, stack, minutes].every(Number.isSafeInteger) ||
              small < 1 ||
              big < small * 2 ||
              big > 10000 ||
              stack < big * 2 ||
              stack > 1000000 ||
              minutes < 1 ||
              minutes > 1440
            )
              throw Error(
                "Проверьте настройки: большой блайнд ≥ 2 малых, стек ≥ 2 больших, ход 1–1440 минут",
              );
            next.settings = { small, big, stack, minutes };
            log(next, "Настройки стола обновлены");
          }
          if (req.params.command === "chips") {
            const p = next.players.find((p) => p.id === b.id);
            if (
              !p ||
              !Number.isSafeInteger(b.amount) ||
              b.amount < 1 ||
              b.amount > 1000000 ||
              p.chips + b.amount > 10000000
            )
              throw Error("Укажите игрока и от 1 до 1 000 000 фишек");
            p.chips += b.amount;
            log(next, `${p.name}: выдано ${b.amount} фишек`);
          }
          if (req.params.command === "remove") {
            next.players = next.players.filter((p) => p.id !== b.id);
          }
          break;
        }
        default:
          res.status(404).json({ error: "Команда не найдена" });
          return;
      }
      save(next);
      res.json(view(game, s.id, !!s.admin));
    } catch (error) {
      res
        .status(400)
        .json({
          error: error instanceof Error ? error.message : "Ошибка запроса",
        });
    }
  });
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => res.status(400).json({ error: "Некорректный запрос" }),
  );
  const timer = setInterval(() => {
    const next = structuredClone(game);
    if (tick(next)) save(next);
  }, 1000);
  timer.unref();
  return {
    app,
    close: () => {
      clearInterval(timer);
      db.close();
    },
  };
}
