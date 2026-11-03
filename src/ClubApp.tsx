import { useEffect, useRef, useState } from "react";
import type { ClubState } from "../shared/types";
import { GameScreen } from "./App";
import { AccountsPanel } from "./AccountsPanel";
import { useGameSounds } from "./useGameSounds";
import { useDealPresentation } from "./useDealPresentation";
import { ReturnToTable } from "./ReturnToTable";
import { useTheme } from "./useTheme";
import "./club.css";
const format = (n: number) => n.toLocaleString("ru-RU");
const phaseNames = {
  waiting: "Ожидает игроков",
  preflop: "Префлоп",
  flop: "Флоп",
  turn: "Тёрн",
  river: "Ривер",
  showdown: "Между раздачами",
};
export default function ClubApp() {
  const [snapshot, setSnapshot] = useState<ClubState | null>(null),
    [selected, setSelected] = useState<string | null>(() =>
      new URLSearchParams(location.search).get("room"),
    ),
    [page, setPage] = useState("lobby"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [roomName, setRoomName] = useState(""),
    [rules, setRules] = useState({ small: 10, big: 20, minutes: 30, step: 10 }),
    [creating, setCreating] = useState(false);
  const version = useRef(0),
    pending = useRef(false);
  const theme = useTheme();
  const listeningGame = snapshot?.activeRoom ?? snapshot?.room ?? null;
  const sound = useGameSounds(listeningGame);
  useDealPresentation(listeningGame, sound.play);
  async function request(path: string, body?: object) {
    const res = await fetch(
      `/api/${path}`,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = await res.json();
    if (!res.ok)
      throw Object.assign(Error(data.error ?? "Ошибка запроса"), {
        status: res.status,
      });
    return data;
  }
  function choose(id: string | null) {
    version.current++;
    setSelected(id);
    setError("");
    const url = new URL(location.href);
    if (id) url.searchParams.set("room", id);
    else url.searchParams.delete("room");
    url.searchParams.delete("admin");
    history.replaceState(null, "", url);
  }
  useEffect(() => {
    let alive = true,
      loading = false;
    const load = async () => {
      if (loading || pending.current) return;
      loading = true;
      const stamp = version.current;
      try {
        const data: ClubState = await request(
          selected ? `rooms/${selected}` : "state",
        );
        if (alive && stamp === version.current) {
          setSnapshot(data);
          setError((e) => (e === "Нет связи с сервером" ? "" : e));
        }
      } catch (e) {
        if (alive && stamp === version.current) {
          const err = e as Error & { status?: number };
          if (err.status === 401 || err.status === 404) {
            choose(null);
            if (err.status === 401)
              setSnapshot((current) =>
                current
                  ? {
                      ...current,
                      account: null,
                      rooms: [],
                      room: undefined,
                      activeRoom: undefined,
                    }
                  : current,
              );
          }
          setError(err.status ? err.message : "Нет связи с сервером");
        }
      } finally {
        loading = false;
      }
    };
    void load();
    const poll = setInterval(
      load,
      selected || snapshot?.activeRoom ? 400 : 3000,
    );
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [selected, snapshot?.account?.id, snapshot?.activeRoom?.room?.id]);
  async function perform(path: string, body: object = {}) {
    if (pending.current) return;
    pending.current = true;
    version.current++;
    setBusy(true);
    setError("");
    try {
      const data: ClubState = await request(path, body);
      setSnapshot(data);
      if (data.room) {
        choose(data.room.room!.id);
      }
      if (!data.account) {
        choose(null);
        setPage("lobby");
      }
      return data;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const account = snapshot?.account;
  if (!snapshot)
    return (
      <div className="loading">✦ Открываем клуб…{error && <p>{error}</p>}</div>
    );
  if (!account)
    return (
      <div className="auth-page">
        <div className="auth-art">
          <span className="club-wordmark">♠ после дейли.</span>
          <div>
            <span className="eyebrow">КЛУБ ДЛЯ СВОИХ</span>
            <h1>
              Ваш ход.
              <br />В вашем ритме.
            </h1>
            <p>
              Коллеги, карты и пауза между задачами.
              <br />
              Фишки остаются с вами после каждой партии.
            </p>
            <span className="auth-suits">♠ ♥ ♣ ♦</span>
          </div>
          <small>Только игровые фишки · никаких ставок на деньги</small>
        </div>
        <section className="auth-card">
          <span className="eyebrow">ОФИСНЫЙ ПОКЕР</span>
          <h2>
            {snapshot.needsSetup ? "Добро пожаловать в клуб" : "С возвращением"}
          </h2>
          <p>
            {snapshot.needsSetup
              ? "Создайте аккаунт администратора. Затем вы сможете выдать доступ коллегам."
              : "Войдите с логином и паролем, которые выдал администратор."}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {snapshot.needsSetup && !snapshot.canSetup ? (
            <p>
              Первого администратора нужно создать на компьютере сервера через
              localhost.
            </p>
          ) : (
            <form
              className="club-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = await perform(
                  snapshot.needsSetup ? "setup" : "login",
                  { login, password, name },
                );
                if (data) {
                  setPassword("");
                  choose(null);
                }
              }}
            >
              {snapshot.needsSetup && (
                <label>
                  Ваше имя
                  <input
                    autoComplete="name"
                    minLength={2}
                    maxLength={24}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <label>
                Логин
                <input
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={32}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete={
                    snapshot.needsSetup ? "new-password" : "current-password"
                  }
                  minLength={snapshot.needsSetup ? 8 : undefined}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy
                  ? "Подождите…"
                  : snapshot.needsSetup
                    ? "Создать администратора"
                    : "Войти в клуб ↗"}
              </button>
            </form>
          )}
        </section>
      </div>
    );
  const active = snapshot.activeRoom;
  const showReturn =
    !!active && (selected !== active.room?.id || page === "accounts");
  const returnButton = showReturn ? (
    <ReturnToTable
      game={active!}
      onReturn={() => {
        choose(active!.room!.id);
        setPage("lobby");
      }}
    />
  ) : null;
  if (
    selected &&
    snapshot.room &&
    snapshot.room.room?.id === selected &&
    page !== "accounts"
  )
    return (
      <div className={showReturn ? "with-table-return" : undefined}>
        {returnButton}
        <GameScreen
          key={selected}
          design={theme}
          sound={sound}
          g={snapshot.room}
          account={account}
          send={async (cmd, body) => {
            await perform(`rooms/${selected}/${cmd}`, body);
          }}
          busy={busy}
          error={error}
          onLobby={() => {
            choose(null);
            setPage("lobby");
          }}
          onAccounts={() => {
            choose(null);
            setPage("accounts");
          }}
          onLogout={() => void perform("logout")}
        />
      </div>
    );
  const seated = snapshot.rooms.find((r) => r.seated);
  return (
    <div className={`club-shell ${showReturn ? "with-table-return" : ""}`}>
      {returnButton}
      <header className="club-header">
        <button
          className="club-wordmark"
          onClick={() => {
            choose(null);
            setPage("lobby");
          }}
        >
          ♠ после дейли.
        </button>
        <div className="club-profile">
          <button
            className="compact-button"
            onClick={theme.toggle}
            aria-label="Переключить тему"
          >
            {theme.theme === "club" ? "☀" : "♣"}
          </button>
          <button
            className="sound-toggle"
            onClick={sound.toggle}
            aria-label={sound.enabled ? "Выключить звуки" : "Включить звуки"}
            aria-pressed={sound.enabled}
          >
            {sound.enabled ? "♫" : "♪"}
            <span>{sound.enabled ? "Звук вкл." : "Без звука"}</span>
          </button>
          <span>{account.name}</span>
          <strong>◉ {format(account.balance)}</strong>
          {account.admin && (
            <button
              onClick={() => {
                choose(null);
                setPage(page === "accounts" ? "lobby" : "accounts");
              }}
            >
              {page === "accounts" ? "Все столы" : "Аккаунты игроков"}
            </button>
          )}
          <button onClick={() => void perform("logout")} disabled={busy}>
            Выйти
          </button>
        </div>
      </header>
      <main className="club-main">
        {page === "accounts" && account.admin ? (
          <AccountsPanel
            request={request}
            onBack={() => setPage("lobby")}
            onChanged={() =>
              void request(selected ? `rooms/${selected}` : "state")
                .then(setSnapshot)
                .catch(() => setError("Нет связи с сервером"))
            }
          />
        ) : (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">НАЙДИТЕ СВОЮ КОМПАНИЮ</div>
                <h1>Игровые столы</h1>
                <p>
                  Откройте свой стол, пригласите коллег или сыграйте с ботами.
                </p>
              </div>
              <button
                className="primary"
                disabled={!!seated || busy}
                onClick={() => setCreating(!creating)}
              >
                {creating ? "Закрыть форму" : "+ Создать стол"}
              </button>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {seated && (
              <div className="club-notice">
                <span>
                  Ваше место — «{seated.name}». Покиньте его перед созданием
                  другого стола.
                </span>
                <button onClick={() => choose(seated.id)}>
                  Вернуться за стол ↗
                </button>
              </div>
            )}
            {creating && !seated && (
              <section className="club-panel create-room">
                <h2>Ваш стол, ваш ритм</h2>
                <form
                  className="club-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = await perform("rooms", {
                      name: roomName,
                      settings: rules,
                    });
                    if (data?.room) {
                      setCreating(false);
                      setRoomName("");
                    }
                  }}
                >
                  <label className="room-name-field">
                    Название стола
                    <input
                      required
                      minLength={2}
                      maxLength={24}
                      placeholder="Например, После планёрки"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    />
                  </label>
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
                        required
                        type="number"
                        min={1}
                        max={k === "minutes" ? 1440 : 10000}
                        step={1}
                        value={rules[k]}
                        onChange={(e) =>
                          setRules({ ...rules, [k]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <p className="room-name-field">
                    Вы станете хостом и займёте место со своим балансом:{" "}
                    {format(account.balance)} фишек. Боты начинают с отдельного
                    стека.
                  </p>
                  <button className="primary" disabled={busy}>
                    Открыть стол ↗
                  </button>
                </form>
              </section>
            )}
            {!snapshot.rooms.length ? (
              <section className="empty-club">
                <span>♣</span>
                <h2>Пока тихо</h2>
                <p>Столов ещё нет. Создайте первый и позовите коллег.</p>
                {!creating && (
                  <button onClick={() => setCreating(true)}>
                    Создать первый стол
                  </button>
                )}
              </section>
            ) : (
              <div className="room-grid">
                {snapshot.rooms.map((r) => (
                  <article className="room-card" key={r.id}>
                    <div className="room-card-top">
                      <span className="room-mini-table">♠</span>
                      <span className="badge">
                        {r.emptySince !== null
                          ? "Пустует"
                          : phaseNames[r.phase]}
                      </span>
                    </div>
                    <h2>{r.name}</h2>
                    <p>Хост · {r.hostName}</p>
                    <dl>
                      <div>
                        <dt>Блайнды</dt>
                        <dd>
                          {r.small} / {r.big}
                        </dd>
                      </div>
                      <div>
                        <dt>На ход</dt>
                        <dd>{r.minutes} мин.</dd>
                      </div>
                      <div>
                        <dt>За столом</dt>
                        <dd>{r.humans + r.bots} / 6</dd>
                      </div>
                    </dl>
                    <div className="room-card-bottom">
                      <span>
                        Игроков: {r.humans} · ботов: {r.bots}
                      </span>
                      <button
                        className={r.seated ? "primary" : ""}
                        onClick={() => {
                          choose(r.id);
                          setPage("lobby");
                        }}
                      >
                        {r.seated ? "Вернуться ↗" : "Открыть стол ↗"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="club-footnote">
              Пустующие столы удаляются через 5 минут. Стол только с ботами тоже
              считается пустующим. Баланс аккаунта сохраняется.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
