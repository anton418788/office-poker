import { useEffect, useState } from "react";
import type { View } from "../shared/types";
export function RoomControls({
  game: g,
  send,
  busy,
  dealing,
}: {
  game: View;
  send: (cmd: string, body?: object) => Promise<void>;
  busy: boolean;
  dealing: boolean;
}) {
  const [settings, setSettings] = useState({
    ...g.settings,
    step: g.settings.step ?? 1,
  });
  useEffect(() => {
    setSettings({ ...g.settings, step: g.settings.step ?? 1 });
  }, [g.settings.small, g.settings.big, g.settings.minutes, g.settings.step]);
  const inHand = !["waiting", "showdown"].includes(g.phase) || dealing;
  return (
    <details className="room-controls">
      <summary>
        ♣ Управление столом{" "}
        <span>{g.room?.hostId === g.me ? "Вы — хост" : "Администратор"}</span>
      </summary>
      <div className="host-actions">
        <button
          className="primary"
          disabled={
            busy ||
            inHand ||
            g.paused ||
            g.players.filter((p) => p.chips > 0 || p.bot).length < 2
          }
          onClick={() => send("start")}
        >
          Раздать карты ↗
        </button>
        <button disabled={busy} onClick={() => send("pause")}>
          {g.paused ? "Продолжить игру" : "Пауза"}
        </button>
        <span>Боты пополняют стек после проигрыша.</span>
      </div>
      <div className="host-bots">
        {Array.from({ length: 6 }, (_, seat) => {
          const p = g.players.find((p) => p.seat === seat);
          return (
            <button
              key={seat}
              disabled={busy || inHand || (!!p && !p.bot)}
              onClick={() =>
                send(p ? "remove" : "bot", p ? { id: p.id } : { seat })
              }
            >
              {seat + 1} · {p ? (p.bot ? `${p.name} ×` : p.name) : "+ Бот"}
            </button>
          );
        })}
      </div>
      <details className="room-rules">
        <summary>Изменить правила стола</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send("settings", settings);
          }}
        >
          {(["small", "big", "minutes", "step"] as const).map((k) => (
            <label key={k}>
              {
                {
                  small: "Малый блайнд",
                  big: "Большой блайнд",
                  minutes: "Минут на ход",
                  step: "Шаг рейза",
                }[k]
              }
              <input
                type="number"
                required
                min="1"
                max={k === "minutes" ? 1440 : 10000}
                value={settings[k]}
                disabled={busy || inHand}
                onChange={(e) =>
                  setSettings({ ...settings, [k]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <button disabled={busy || inHand}>Сохранить правила</button>
        </form>
        <p>
          Правила меняются между раздачами. Олл-ин можно поставить любым
          остатком.
        </p>
      </details>
    </details>
  );
}
