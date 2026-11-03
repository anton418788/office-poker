import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import type { AddressInfo } from "node:net";
test("API: сессии, права хоста, валидация, приватность и восстановление SQLite", async () => {
  const { app, close } = createApp(":memory:");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const a = await fetch(url + "/api/state");
    const cookieA = a.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await a.json()).admin, true);
    const b = await fetch(url + "/api/state");
    const cookieB = b.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await b.json()).admin, false);
    const post = (cookie: string, cmd: string, body: object = {}) =>
      fetch(url + "/api/" + cmd, {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post(cookieB, "settings", {
          small: 10,
          big: 20,
          stack: 2000,
          minutes: 10,
        })
      ).status,
      403,
    );
    assert.equal((await post(cookieA, "join", { name: "Аня" })).status, 200);
    assert.equal((await post(cookieB, "join", { name: "Борис" })).status, 200);
    assert.equal((await post(cookieB, "bot", { seat: 2 })).status, 403);
    const botResponse = await post(cookieA, "bot", { seat: 4 });
    assert.equal(botResponse.status, 200);
    const withBot = await botResponse.json();
    assert.equal(
      withBot.players.find((p: { seat: number }) => p.seat === 4).bot,
      true,
    );
    assert.equal((await post(cookieA, "bot", { seat: 4 })).status, 400);
    assert.equal((await post(cookieA, "bot", { seat: "2" })).status, 400);
    assert.equal((await post(cookieB, "start")).status, 403);
    const start = await post(cookieA, "start");
    const state = await start.json();
    assert.equal(state.players[0].cards.length, 2);
    assert.equal(state.players[1].cards.length, 0);
    assert.equal("deck" in state, false);
    assert.equal(state.players[2].cards.length, 0);
    assert.equal((await post(cookieA, "bot", { seat: 3 })).status, 400);
    assert.equal(
      (await post(cookieA, "remove", { id: state.players[2].id })).status,
      400,
    );
    assert.equal(
      (await post(cookieA, "chips", { id: state.me, amount: -1 })).status,
      400,
    );
    assert.equal(
      (
        await fetch(url + "/api/join", {
          method: "POST",
          headers: {
            origin: "https://foreign.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
  } finally {
    await new Promise<void>((r, e) => server.close((x) => (x ? e(x) : r())));
    close();
  }
});
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("SQLite восстанавливает участников, настройки и ту же сессию хоста", async () => {
  const dir = mkdtempSync(join(tmpdir(), "office-poker-"));
  const path = join(dir, "game.sqlite");
  async function open() {
    const instance = createApp(path);
    const server = instance.app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.once("listening", r));
    return {
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      close: async () => {
        await new Promise<void>((r, e) =>
          server.close((x) => (x ? e(x) : r())),
        );
        instance.close();
      },
    };
  }
  let current = await open();
  try {
    const initial = await fetch(current.url + "/api/state");
    const cookie = initial.headers.get("set-cookie")!.split(";")[0];
    await fetch(current.url + "/api/join", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Сохранённый игрок" }),
    });
    await fetch(current.url + "/api/bot", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ seat: 3 }),
    });
    await current.close();
    current = await open();
    const state = await (
      await fetch(current.url + "/api/state", { headers: { cookie } })
    ).json();
    assert.equal(state.admin, true);
    assert.equal(state.players[0].name, "Сохранённый игрок");
    assert.equal(state.players[0].id, state.me);
    assert.equal(state.players[0].chips, 2000);
    assert.equal(state.players[1].bot, true);
    assert.equal(state.players[1].seat, 3);
  } finally {
    await current.close();
    rmSync(dir, { recursive: true });
  }
});
test("Бот делает ход серверным таймером без запросов от игрока", async () => {
  const instance = createApp(":memory:");
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const initial = await fetch(url + "/api/state");
    const cookie = initial.headers.get("set-cookie")!.split(";")[0];
    const post = (cmd: string, body: object = {}) =>
      fetch(url + "/api/" + cmd, {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    await post("join", { name: "Человек" });
    await post("bot", { seat: 1 });
    await post("start");
    const before = await (await post("action", { kind: "call" })).json();
    assert.equal(
      before.players.find((p: { id: string }) => p.id === before.actor).bot,
      true,
    );
    await new Promise((r) => setTimeout(r, 4500));
    const after = await (
      await fetch(url + "/api/state", { headers: { cookie } })
    ).json();
    assert.ok(after.log.length > before.log.length);
    assert.ok(after.actor !== before.actor || after.phase !== "preflop");
  } finally {
    await new Promise<void>((r, e) => server.close((x) => (x ? e(x) : r())));
    instance.close();
  }
});
