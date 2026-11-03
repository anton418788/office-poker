import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import express from "express";
import { createApp } from "./app.js";
const path = resolve(process.env.POKER_DB_PATH ?? "data/poker.sqlite");
mkdirSync(dirname(path), { recursive: true });
const { app } = createApp(path);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3002);
app.listen(port, host, () =>
  console.log(
    `После дейли: http://${host}:${port}\nПервый вход с localhost получает права администратора. Сохранение: ${path}`,
  ),
);
