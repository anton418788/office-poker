import React, { useEffect, useState } from "react";
import type { View } from "../shared/types";
import "./style.css";
import "./themes.css";
import { useGameSounds } from "./useGameSounds";
import { Card } from "./Card";
import { PokerTable } from "./PokerTable";
import { TableSidebar } from "./TableSidebar";
import { useDealPresentation } from "./useDealPresentation";
import { useTheme } from "./useTheme";
const format = (n: number) => n.toLocaleString("ru-RU");
export default function App() {
  const [g, setG] = useState<View | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState(() =>
      new URLSearchParams(window.location.search).get("admin") === "1"
        ? "admin"
        : "table",
    ),
    [name, setName] = useState(""),
    [raise, setRaise] = useState(40),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now()),
    [settings, setSettings] = useState<View["settings"] | null>(null),
    [give, setGive] = useState(1000),
    [recipient, setRecipient] = useState("");
  const [menuHidden, setMenuHidden] = useState(() => {
    try {
      const saved = localStorage.getItem("office-poker:menu");
      return saved ? saved === "hidden" : window.innerWidth < 900;
    } catch {
      return false;
    }
  });
  const design = useTheme();
  const sound = useGameSounds(g);
  const presentation = useDealPresentation(g, sound.play);
  function toggleMenu() {
    setMenuHidden((hidden) => {
      try {
        localStorage.setItem("office-poker:menu", hidden ? "open" : "hidden");
      } catch {}
      return !hidden;
    });
  }
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/state")
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((v) => {
          if (alive) {
            setG(v);
            setError((e) => (e === "Нет связи с сервером" ? "" : e));
          }
        })
        .catch(() => alive && setError("Нет связи с сервером"));
    load();
    const poll = setInterval(load, 400),
      clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);
  async function send(command: string, body: object = {}) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/${command}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setG(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Нет связи");
    } finally {
      setBusy(false);
    }
  }
  const me = g?.players.find((p) => p.id === g.me),
    active = g?.players.find((p) => p.id === g.actor),
    visibleStack = me
      ? Math.max(
          0,
          me.chips -
            (presentation.active && g?.phase === "showdown"
              ? (g.transfers ?? [])
                  .filter(
                    (t) =>
                      t.hand === g.hand &&
                      t.kind === "payout" &&
                      t.seat === me.seat,
                  )
                  .reduce((n, t) => n + t.amount, 0)
              : 0),
        )
      : 0,
    inHand = g && !["waiting", "showdown"].includes(g.phase),
    myTurn = !!g && g.actor === g.me && !g.paused && !presentation.active,
    amount = g
      ? Math.max(
          Math.min(raise, g.legal.max),
          Math.min(g.legal.min, g.legal.max),
        )
      : 0;
  useEffect(() => {
    if (g) {
      setRaise(g.legal.min);
    }
  }, [g?.actor, g?.currentBet, g?.hand]);
  if (!g)
    return (
      <div className="loading">✦ Собираем стол…{error && <p>{error}</p>}</div>
    );
  const timer = g.paused
    ? "ПАУЗА"
    : g.deadline
      ? new Date(Math.max(0, g.deadline - now)).toISOString().slice(11, 19)
      : "—";
  const stage = {
    waiting: "Ждём коллег",
    preflop: "Префлоп",
    flop: "Флоп",
    turn: "Тёрн",
    river: "Ривер",
    showdown: "Раздача завершена",
  }[g.phase];
  return (
    <div className={`app ${menuHidden ? "menu-collapsed" : ""}`}>
      <aside className="sidebar" id="main-menu" aria-label="Главное меню">
        <button
          className="sidebar-close"
          onClick={toggleMenu}
          aria-label="Скрыть меню"
        >
          ‹
        </button>
        <a className="brand" href="/">
          ♠
          <span>
            после
            <br />
            <strong>дейли.</strong>
          </span>
        </a>
        <div className="side-label">ОФИСНЫЙ ПОКЕР</div>
        <button
          className={tab === "table" ? "nav selected" : "nav"}
          onClick={() => setTab("table")}
        >
          ▦ <span>Игровой стол</span>
          <i>01</i>
        </button>
        {g.admin && (
          <button
            className={tab === "admin" ? "nav selected" : "nav"}
            onClick={() => {
              setSettings({ ...g.settings });
              setTab("admin");
            }}
          >
            ⚙ <span>Управление</span>
          </button>
        )}
        <div className="soon">
          <span>Скоро в клубе</span>
          <p>♧ Магазин скинов</p>
          <p>☺ Реакции за столом</p>
          <small>Сначала — хорошая партия.</small>
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Только игровые фишки
          <br />
          <small>Никаких ставок на деньги</small>
        </div>
      </aside>
      {!menuHidden && (
        <button
          className="menu-scrim"
          aria-label="Закрыть меню"
          onClick={toggleMenu}
        />
      )}
      <main>
        <header>
          <div className="header-left">
            <button
              className="menu-toggle"
              onClick={toggleMenu}
              aria-label={menuHidden ? "Показать меню" : "Скрыть меню"}
              aria-expanded={!menuHidden}
              aria-controls="main-menu"
            >
              ☰
            </button>
            <div className="breadcrumbs">
              НАШ ОФИС <span>/</span> ПОКЕРНЫЙ КЛУБ
            </div>
          </div>
          <div className="profile">
            <button
              className="theme-toggle"
              onClick={design.toggle}
              aria-label={
                design.theme === "club"
                  ? "Включить светлую тему"
                  : "Включить клубную тему"
              }
              aria-pressed={design.theme === "club"}
              title={
                design.theme === "club"
                  ? "Переключить на светлую тему"
                  : "Переключить на клубную тему"
              }
            >
              {design.theme === "club" ? "☀" : "♣"}
              <span>
                {design.theme === "club" ? "Светлая тема" : "Клубная тема"}
              </span>
            </button>
            <button
              className="sound-toggle"
              onClick={sound.toggle}
              aria-label={sound.enabled ? "Выключить звуки" : "Включить звуки"}
              aria-pressed={sound.enabled}
              title={sound.enabled ? "Выключить звуки" : "Включить звуки"}
            >
              {sound.enabled ? "♫" : "♪"}
              <span>{sound.enabled ? "Звук вкл." : "Без звука"}</span>
            </button>
            <span className="avatar tiny">
              {me?.name.slice(0, 1).toUpperCase() ?? "?"}
            </span>
            {me?.name ?? "Наблюдатель"}
            {g.admin && <span className="badge">Хост</span>}
          </div>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        <section className="page-heading">
          <div>
            <div className="eyebrow">РАБОТА ПОДОЖДЁТ. ХОТЯ БЫ ОДИН ХОД.</div>
            <h1>{tab === "table" ? "Переговорка № 1" : "За кулисами стола"}</h1>
            <p>
              {tab === "table"
                ? "Неспешный техасский холдем для своих."
                : "Настройки темпа, фишки и управление раздачами."}
            </p>
          </div>
          <span className="room-badge">
            <span className="status-dot" />
            {g.paused
              ? "На паузе"
              : inHand
                ? "Идёт игра"
                : "Стол открыт"} · {g.players.length}/6
          </span>
        </section>
        {tab === "table" ? (
          <>
            <div className="game-layout">
              <section className="game-area">
                <PokerTable
                  game={g}
                  busy={busy || presentation.active}
                  send={send}
                  presentation={presentation}
                />
              </section>
              <TableSidebar
                game={g}
                hole={me?.cards.slice(0, presentation.holeCount(me.seat)) ?? []}
                board={g.board.slice(0, presentation.boardFaces)}
                timer={timer}
                dealing={presentation.active}
              />
            </div>
            {g.result.length > 0 && !presentation.active && (
              <div className="result">✦ {g.result.join(" · ")}</div>
            )}
            {!me ? (
              <form
                className="join-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send("join", { name });
                }}
              >
                <div>
                  <h3>Ваше место за столом</h3>
                  <p>
                    Стартовый стек — {format(g.settings.stack)} фишек. Кофе —
                    свой.
                  </p>
                </div>
                <input
                  aria-label="Ваше имя"
                  minLength={2}
                  maxLength={24}
                  required
                  placeholder="Как вас зовут?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={busy || g.players.length >= 6}
                >
                  Занять место ↗
                </button>
              </form>
            ) : (
              <section
                className={`action-bar ${myTurn ? "your-turn" : ""}`}
                aria-label="Ваши действия"
              >
                <div className="your-hand">
                  <div className="hand-cards">
                    {me.cards.length ? (
                      me.cards
                        .slice(0, presentation.holeCount(me.seat))
                        .map((c, i) => <Card key={i} card={c} small />)
                    ) : (
                      <span className="waiting-cards">♠ ♥</span>
                    )}
                  </div>
                  <div>
                    <small>{myTurn ? "ВАШ ХОД" : "ВАШ СТЕК"}</small>
                    <strong>◉ {format(visibleStack)}</strong>
                    <span>
                      {g.paused
                        ? "Игра на паузе"
                        : presentation.active
                          ? "Дилер раздаёт карты…"
                          : myTurn
                            ? "Время принимать решение"
                            : g.paused
                              ? "Игра на паузе"
                              : inHand
                                ? "Можно спокойно работать"
                                : "Готовы к новой раздаче"}
                    </span>
                  </div>
                </div>
                {inHand ? (
                  <div className="controls">
                    <div className="raise-control">
                      <div className="raise-heading">
                        <label htmlFor="raise-slider">Рейз до</label>
                        <input
                          id="raise-amount"
                          aria-label="Точная сумма рейза"
                          type="number"
                          min={Math.min(g.legal.min, g.legal.max)}
                          max={g.legal.max}
                          step="1"
                          value={amount}
                          disabled={!myTurn || !g.legal.canRaise || busy}
                          onChange={(e) => setRaise(Number(e.target.value))}
                        />
                      </div>
                      <input
                        id="raise-slider"
                        aria-label="Размер рейза"
                        type="range"
                        min={Math.min(g.legal.min, g.legal.max)}
                        max={g.legal.max}
                        step="1"
                        value={amount}
                        disabled={!myTurn || !g.legal.canRaise || busy}
                        onChange={(e) => setRaise(Number(e.target.value))}
                      />
                      <div className="raise-presets">
                        {[
                          { label: "Мин.", value: g.legal.min },
                          {
                            label: "½ банка",
                            value:
                              g.currentBet +
                              Math.round(
                                (g.players.reduce((n, p) => n + p.total, 0) +
                                  g.legal.call) *
                                  0.5,
                              ),
                          },
                          {
                            label: "Банк",
                            value:
                              g.currentBet +
                              g.players.reduce((n, p) => n + p.total, 0) +
                              g.legal.call,
                          },
                          { label: "Олл-ин", value: g.legal.max },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            disabled={!myTurn || !g.legal.canRaise || busy}
                            onClick={() =>
                              setRaise(
                                Math.min(
                                  g.legal.max,
                                  Math.max(g.legal.min, preset.value),
                                ),
                              )
                            }
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="action-buttons">
                      <button
                        className="fold-button"
                        disabled={!myTurn || busy}
                        onClick={() => send("action", { kind: "fold" })}
                      >
                        <span className="action-icon">×</span>
                        <span>
                          Пас<small>Сбросить карты</small>
                        </span>
                      </button>
                      <button
                        disabled={!myTurn || busy}
                        onClick={() =>
                          send("action", {
                            kind: g.legal.call ? "call" : "check",
                          })
                        }
                      >
                        <span className="action-icon">
                          {g.legal.call ? "=" : "✓"}
                        </span>
                        <span>
                          {g.legal.call
                            ? `Колл ${format(g.legal.call)}`
                            : "Чек"}
                          <small>
                            {g.legal.call
                              ? "Уравнять ставку"
                              : "Продолжить без ставки"}
                          </small>
                        </span>
                      </button>
                      <button
                        className="primary"
                        disabled={!myTurn || !g.legal.canRaise || busy}
                        onClick={() =>
                          send("action", { kind: "raise", amount })
                        }
                      >
                        <span className="action-icon">↗</span>
                        <span>
                          Рейз {format(amount)}
                          <small>
                            {amount === g.legal.max
                              ? "Все фишки в игру"
                              : "Повысить ставку"}
                          </small>
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="action-buttons">
                    <button
                      disabled={busy || presentation.active}
                      onClick={() => send("leave")}
                    >
                      Покинуть стол
                    </button>
                    {g.admin && (
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          presentation.active ||
                          g.paused ||
                          g.players.filter((p) => p.chips > 0 || p.bot).length <
                            2
                        }
                        onClick={() => send("start")}
                      >
                        Раздать карты ↗
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
            <div className="bottom-note">
              <span>01 / ПЕРЕГОВОРКА</span>
              <span>Хорошая партия вписывается в рабочий день.</span>
              <span>КЛУБ ДЛЯ СВОИХ ✦</span>
            </div>
          </>
        ) : (
          <div className="admin-grid">
            <section className="admin-panel">
              <h2>Темп и правила</h2>
              <p>
                Изменения доступны между раздачами. Новый стек применяется к
                новым участникам.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send("settings", settings ?? g.settings);
                }}
              >
                {(["small", "big", "stack", "minutes"] as const).map((k) => (
                  <label key={k}>
                    {
                      {
                        small: "Малый блайнд",
                        big: "Большой блайнд",
                        stack: "Стартовый стек",
                        minutes: "Минут на ход",
                      }[k]
                    }
                    <input
                      type="number"
                      required
                      min="1"
                      value={(settings ?? g.settings)[k]}
                      onChange={(e) =>
                        setSettings({
                          ...(settings ?? g.settings),
                          [k]: Number(e.target.value),
                        })
                      }
                      disabled={!!inHand || busy}
                    />
                  </label>
                ))}
                <button className="primary" disabled={!!inHand || busy}>
                  Сохранить настройки
                </button>
              </form>
            </section>
            <section className="admin-panel">
              <h2>Управление партией</h2>
              <p>
                Пауза замораживает оставшееся время. Карты и фишки сохраняются
                после перезапуска.
              </p>
              <div className="admin-actions">
                <button disabled={busy} onClick={() => send("pause")}>
                  {g.paused ? "Продолжить игру" : "Поставить на паузу"}
                </button>
                <button
                  className="primary"
                  disabled={
                    !!inHand ||
                    presentation.active ||
                    g.paused ||
                    busy ||
                    g.players.filter((p) => p.chips > 0 || p.bot).length < 2
                  }
                  onClick={() => send("start")}
                >
                  Новая раздача
                </button>
              </div>
              <h2>Выдать фишки</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send("chips", {
                    id: recipient || g.players[0]?.id,
                    amount: give,
                  });
                }}
              >
                <label>
                  Коллега
                  <select
                    value={recipient || g.players[0]?.id || ""}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    {g.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {format(p.chips)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Количество
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    value={give}
                    onChange={(e) => setGive(Number(e.target.value))}
                  />
                </label>
                <button disabled={!!inHand || busy || !g.players.length}>
                  Пополнить стек
                </button>
              </form>
              <h2>Боты за столом</h2>
              <p>
                Играйте сами против ботов или дополните компанию. Бот ходит
                примерно за 3 секунды и видит только свои карты. Добавление и
                удаление — между раздачами.
              </p>
              <div className="bot-seats">
                {Array.from({ length: 6 }, (_, seat) => {
                  const occupant = g.players.find((p) => p.seat === seat);
                  return (
                    <button
                      key={seat}
                      disabled={!!inHand || busy || !!occupant}
                      onClick={() => send("bot", { seat })}
                    >
                      Место {seat + 1} · {occupant ? occupant.name : "+ Бот"}
                    </button>
                  );
                })}
              </div>
              <h2>Участники</h2>
              {g.players.map((p) => (
                <div className="admin-player" key={p.id}>
                  <span>
                    {p.name}
                    {p.bot && <small className="bot-label">БОТ</small>}
                  </span>
                  <button
                    disabled={!!inHand || busy}
                    onClick={() => send("remove", { id: p.id })}
                  >
                    {p.bot ? "Убрать бота" : "Убрать со стола"}
                  </button>
                </div>
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
