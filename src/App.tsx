import React, { useEffect, useState } from "react";
import type { Card as PlayingCard, View } from "../shared/types";
import "./style.css";
import { useGameSounds } from "./useGameSounds";
const format = (n: number) => n.toLocaleString("ru-RU");
function Card({
  card,
  back = false,
  small = false,
}: {
  card?: PlayingCard;
  back?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`card ${small ? "small" : ""} ${back ? "back" : ""} ${card && ["h", "d"].includes(card.suit) ? "red" : ""} ${!card && !back ? "empty" : ""}`}
    >
      {card ? (
        <>
          <b>
            {({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[
              card.rank
            ] ?? card.rank}
          </b>
          <span>{{ s: "♠", h: "♥", d: "♦", c: "♣" }[card.suit]}</span>
        </>
      ) : back ? (
        <span>✦</span>
      ) : (
        <span>·</span>
      )}
    </div>
  );
}
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
  const sound = useGameSounds(g);
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
    const poll = setInterval(load, 2000),
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
    inHand = g && !["waiting", "showdown"].includes(g.phase),
    myTurn = !!g && g.actor === g.me && !g.paused,
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
    <div className="app">
      <aside className="sidebar">
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
      <main>
        <header>
          <div className="breadcrumbs">
            НАШ ОФИС <span>/</span> ПОКЕРНЫЙ КЛУБ
          </div>
          <div className="profile">
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
                <div className="table-topline">
                  <span>
                    NO LIMIT HOLD’EM <b>·</b> {format(g.settings.small)} /{" "}
                    {format(g.settings.big)}
                  </span>
                  <span>РАЗДАЧА #{String(g.hand).padStart(3, "0")}</span>
                </div>
                <div className="table-scene">
                  <div className="felt">
                    <div className="felt-inner">
                      <div className="table-wordmark">
                        после дейли<span>OFFICE POKER CLUB</span>
                      </div>
                      <div className="pot">
                        <small>
                          {g.phase === "showdown"
                            ? "ИТОГ РАЗДАЧИ"
                            : "ОБЩИЙ БАНК"}
                        </small>
                        <strong>
                          {g.phase === "showdown"
                            ? "✦"
                            : `◉ ${format(g.players.reduce((n, p) => n + p.total, 0))}`}
                        </strong>
                      </div>
                      <div className="community">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Card key={i} card={g.board[i]} />
                        ))}
                      </div>
                      <span className="stage">{stage}</span>
                    </div>
                  </div>
                  {Array.from({ length: 6 }, (_, seat) => {
                    const p = g.players.find((p) => p.seat === seat);
                    return (
                      <div
                        key={seat}
                        className={`seat seat-${seat} ${p?.id === g.actor ? "acting" : ""} ${p?.folded && inHand ? "folded" : ""}`}
                      >
                        {p ? (
                          <>
                            <div className="seat-cards">
                              {p.cards.length ? (
                                p.cards.map((c, i) => (
                                  <Card key={i} card={c} small />
                                ))
                              ) : inHand && !p.folded ? (
                                <>
                                  <Card back small />
                                  <Card back small />
                                </>
                              ) : null}
                            </div>
                            <div className="player">
                              <span className={`avatar color-${seat}`}>
                                {p.bot
                                  ? "🤖"
                                  : p.name.slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <b>
                                  {p.name}
                                  {p.id === g.me
                                    ? " · вы"
                                    : p.bot
                                      ? " · бот"
                                      : ""}
                                </b>
                                <span>◉ {format(p.chips)}</span>
                              </div>
                              {g.dealer === seat && <i className="dealer">D</i>}
                            </div>
                            {inHand && (
                              <span className="seat-info">
                                {p.folded
                                  ? "Пас"
                                  : p.chips === 0
                                    ? "Олл-ин"
                                    : p.id === g.actor
                                      ? "Думает…"
                                      : p.bet
                                        ? `В игре: ${format(p.bet)}`
                                        : "За столом"}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="empty-seat">
                            <span>+</span>Свободное место
                            {g.admin && !inHand && (
                              <button
                                className="seat-bot"
                                disabled={busy}
                                aria-label={`Посадить бота на место ${seat + 1}`}
                                onClick={() => send("bot", { seat })}
                              >
                                + Бот
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="table-footer">
                  <span>
                    ♧ Без спешки. У вас есть {g.settings.minutes} мин. на ход.
                  </span>
                  <span>Сохранение автоматически</span>
                </div>
              </section>
              <aside className="activity">
                <div className="panel-title">
                  Ритм игры <span>◷</span>
                </div>
                <div className="turn-box">
                  <span>
                    {g.paused
                      ? "Можно вернуться к работе"
                      : active
                        ? active.id === g.me
                          ? "Ваш ход"
                          : `Ходит ${active.name}`
                        : "Все на месте?"}
                  </span>
                  <strong>{timer}</strong>
                  <p>
                    {g.paused
                      ? "Таймер остановлен"
                      : g.actor
                        ? "До автоматического чека или паса"
                        : "Хост запустит следующую раздачу"}
                  </p>
                </div>
                <div className="panel-title history-title">
                  За столом <span>↗</span>
                </div>
                <div className="history">
                  {g.log.length ? (
                    g.log.slice(0, 12).map((s, i) => (
                      <div key={i} className={i === 0 ? "latest" : ""}>
                        <i />
                        {s}
                      </div>
                    ))
                  ) : (
                    <div>
                      Здесь появится история партии. Приглашайте коллег!
                    </div>
                  )}
                </div>
              </aside>
            </div>
            {g.result.length > 0 && (
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
              <section className="action-bar">
                <div className="your-hand">
                  <div className="hand-cards">
                    {me.cards.length ? (
                      me.cards.map((c, i) => <Card key={i} card={c} small />)
                    ) : (
                      <span className="waiting-cards">♠ ♥</span>
                    )}
                  </div>
                  <div>
                    <small>ВАШ СТЕК</small>
                    <strong>◉ {format(me.chips)}</strong>
                    <span>
                      {myTurn
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
                      <label htmlFor="raise">Повысить до</label>
                      <input
                        id="raise"
                        type="number"
                        min={Math.min(g.legal.min, g.legal.max)}
                        max={g.legal.max}
                        step="1"
                        value={amount}
                        disabled={!myTurn || !g.legal.canRaise || busy}
                        onChange={(e) => setRaise(Number(e.target.value))}
                      />
                      <button
                        disabled={!myTurn || !g.legal.canRaise || busy}
                        onClick={() => setRaise(g.legal.max)}
                      >
                        Олл-ин
                      </button>
                    </div>
                    <div className="action-buttons">
                      <button
                        disabled={!myTurn || busy}
                        onClick={() => send("action", { kind: "fold" })}
                      >
                        Пас
                      </button>
                      <button
                        disabled={!myTurn || busy}
                        onClick={() =>
                          send("action", {
                            kind: g.legal.call ? "call" : "check",
                          })
                        }
                      >
                        {g.legal.call ? `Колл ${format(g.legal.call)}` : "Чек"}
                      </button>
                      <button
                        className="primary"
                        disabled={!myTurn || !g.legal.canRaise || busy}
                        onClick={() =>
                          send("action", { kind: "raise", amount })
                        }
                      >
                        Рейз {format(amount)}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="action-buttons">
                    <button disabled={busy} onClick={() => send("leave")}>
                      Покинуть стол
                    </button>
                    {g.admin && (
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          g.paused ||
                          g.players.filter((p) => p.chips > 0).length < 2
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
                    g.paused ||
                    busy ||
                    g.players.filter((p) => p.chips > 0).length < 2
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
