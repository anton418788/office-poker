import { potAmount } from "../shared/pot";
import { useEffect, useState } from "react";
import type { Account, View } from "../shared/types";
import "./style.css";
import "./themes.css";
import type { useGameSounds } from "./useGameSounds";
import { Card } from "./Card";
import { WinnerCrown } from "./WinnerCrown";
import { crownWinners } from "../shared/winners";
import { PokerTable } from "./PokerTable";
import { TableSidebar } from "./TableSidebar";
import { useDealPresentation } from "./useDealPresentation";
import { useTheme } from "./useTheme";
import { RoomControls } from "./RoomControls";
const silent = () => {};
const format = (n: number) => n.toLocaleString("ru-RU");
export function GameScreen({
  g,
  account,
  send,
  busy,
  error,
  onLobby,
  onAccounts,
  onInventory,
  onShop,
  onLogout,
  design,
  sound,
}: {
  g: View;
  account: Account;
  send: (command: string, body?: object) => Promise<void>;
  busy: boolean;
  error: string;
  onLobby: () => void;
  onAccounts: () => void;
  onInventory: () => void;
  onShop: () => void;
  onLogout: () => void;
  design: ReturnType<typeof useTheme>;
  sound: ReturnType<typeof useGameSounds>;
}) {
  const [raise, setRaise] = useState(40),
    [now, setNow] = useState(Date.now());
  const [menuHidden, setMenuHidden] = useState(() => {
    try {
      const saved = localStorage.getItem("office-poker:menu");
      return saved ? saved === "hidden" : window.innerWidth < 900;
    } catch {
      return false;
    }
  });
  const presentation = useDealPresentation(g, silent);
  function toggleMenu() {
    setMenuHidden((hidden) => {
      try {
        localStorage.setItem("office-poker:menu", hidden ? "open" : "hidden");
      } catch {}
      return !hidden;
    });
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const me = g?.players.find((p) => p.id === g.me),
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
      ? Math.min(
          g.legal.max,
          Math.max(
            g.legal.min,
            raise === g.legal.max
              ? raise
              : Math.round(raise / (g.settings.step ?? 1)) *
                  (g.settings.step ?? 1),
          ),
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
  const crowns = crownWinners(g, presentation.active);
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
        <button className="nav" onClick={onLobby}>
          ▦ <span>Все столы</span>
        </button>
        <button className="nav" onClick={onInventory}>
          ♧ <span>Инвентарь</span>
        </button>
        <button className="nav" onClick={onShop}>
          ▣ <span>Магазин</span>
        </button>
        {g.admin && (
          <button className="nav" onClick={onAccounts}>
            ⚙ <span>Аккаунты игроков</span>
          </button>
        )}
        <div className="soon">
          <span>Скоро в клубе</span>
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
              {crowns.includes(g.me) && <WinnerCrown />}
            </span>
            {account.name}{" "}
            <span className="account-balance">◉ {format(account.balance)}</span>{" "}
            <button
              className="compact-button"
              onClick={onLogout}
              disabled={busy}
            >
              Выйти
            </button>
            {g.room?.hostId === g.me && <span className="badge">Хост</span>}
          </div>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <section className="page-heading">
          <div>
            <div className="eyebrow">РАБОТА ПОДОЖДЁТ. ХОТЯ БЫ ОДИН ХОД.</div>
            <h1>{g.room?.name ?? "Игровой стол"}</h1>
            <p>
              Хост: {g.room?.hostName ?? "—"} · блайнды {g.settings.small}/
              {g.settings.big} · шаг {g.settings.step ?? 1} ·{" "}
              {g.settings.minutes} мин. на ход
            </p>
            <button className="compact-button" onClick={onLobby}>
              ← К списку столов
            </button>
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
        <>
          {g.canManage && (
            <RoomControls
              game={g}
              send={send}
              busy={busy}
              dealing={presentation.active}
            />
          )}
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
            <section className="join-bar" aria-label="Выбор места за столом">
              <div>
                <h3>Выберите свободное место</h3>
                <p>
                  Нажмите «Сесть за стол» на нужном кресле. Ваш баланс —{" "}
                  {format(account.balance)} фишек.
                </p>
              </div>
            </section>
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
                  <button
                    className="leave-table-link"
                    disabled={busy}
                    onClick={() => send("leave")}
                    title={
                      inHand
                        ? "Сбросить карты и выйти. Уравненные ставки останутся в банке."
                        : "Освободить место и сохранить баланс"
                    }
                  >
                    Выйти из-за стола
                  </button>
                </div>
              </div>
              {inHand ? (
                <div className="controls">
                  <div className="raise-control">
                    <div className="raise-heading">
                      <label htmlFor="raise-slider">Рейз до</label>
                      <input
                        id="raise-amount"
                        step={g.settings.step ?? 1}
                        aria-label="Точная сумма рейза"
                        type="number"
                        min={Math.min(g.legal.min, g.legal.max)}
                        max={g.legal.max}

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
                      max={Math.max(
                        Math.min(g.legal.min, g.legal.max),
                        Math.floor(g.legal.max / (g.settings.step ?? 1)) *
                          (g.settings.step ?? 1),
                      )}
                      step={g.settings.step ?? 1}
                      value={Math.min(
                        amount,
                        Math.floor(g.legal.max / (g.settings.step ?? 1)) *
                          (g.settings.step ?? 1),
                      )}
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
                            Math.round((potAmount(g) + g.legal.call) * 0.5),
                        },
                        {
                          label: "Банк",
                          value: g.currentBet + potAmount(g) + g.legal.call,
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
                        {g.legal.call ? `Колл ${format(g.legal.call)}` : "Чек"}
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
                      onClick={() => send("action", { kind: "raise", amount })}
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
                  {g.canManage && (
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        presentation.active ||
                        g.paused ||
                        g.players.filter((p) => p.chips > 0 || p.bot).length < 2
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
            <span>ВАШ ОФИСНЫЙ КЛУБ</span>
            <span>Хорошая партия вписывается в рабочий день.</span>
            <span>КЛУБ ДЛЯ СВОИХ ✦</span>
          </div>
        </>
      </main>
    </div>
  );
}
