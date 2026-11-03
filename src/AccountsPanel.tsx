import { useEffect, useState } from "react";
import type { Account } from "../shared/types";
export function AccountsPanel({
  request,
  onBack,
  onChanged,
}: {
  request: (path: string, body?: object) => Promise<any>;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [users, setUsers] = useState<Account[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [login, setLogin] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [balance, setBalance] = useState(2000),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    request("accounts")
      .then(setUsers)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  const edit = (u: Account | null) => {
    setSelected(u?.id ?? null);
    setLogin(u?.login ?? "");
    setName(u?.name ?? "");
    setPassword("");
    setBalance(u?.balance ?? 2000);
    setNotice("");
    setError("");
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">АДМИНИСТРАТОР КЛУБА</div>
          <h1>Аккаунты игроков</h1>
          <p>
            Доступ и постоянный баланс. Управление партией находится в комнате.
          </p>
        </div>
        <button onClick={onBack}>← К столам</button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="club-notice" role="status">
          {notice}
        </div>
      )}
      <div className="accounts-layout">
        <section className="club-panel">
          <h2>{selected ? "Редактировать аккаунт" : "Новый игрок"}</h2>
          <form
            className="club-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await request(selected ? `accounts/${selected}` : "accounts", {
                  login,
                  name,
                  password,
                  balance,
                });
                setPassword("");
                if (!selected) {
                  setLogin("");
                  setName("");
                  setBalance(2000);
                }
                setNotice(
                  selected
                    ? password
                      ? "Пароль обновлён. Игроку нужно войти заново."
                      : "Аккаунт сохранён."
                    : "Аккаунт создан. Передайте игроку логин и заданный пароль.",
                );
                await load();
                onChanged();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Имя игрока
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={24}
                required
                autoComplete="off"
              />
            </label>
            <label>
              Логин
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_.\-]+"
                required
                autoComplete="off"
              />
            </label>
            <label>
              {selected
                ? "Новый пароль · оставьте пустым, чтобы сохранить"
                : "Пароль"}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required={
                  !selected || !users.find((u) => u.id === selected)?.login
                }
                autoComplete="new-password"
              />
            </label>
            <label>
              Баланс фишек
              <input
                type="number"
                min={0}
                max={10000000}
                step={1}
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                required
              />
            </label>
            <p>Аккаунт игрока за столом можно менять между раздачами.</p>
            <button className="primary" disabled={busy}>
              {busy
                ? "Сохраняем…"
                : selected
                  ? "Сохранить аккаунт"
                  : "Создать игрока"}
            </button>
            {selected && (
              <button type="button" onClick={() => edit(null)}>
                + Новый игрок
              </button>
            )}
          </form>
        </section>
        <section className="club-panel">
          <h2>
            Игроки <span className="muted">{users.length}</span>
          </h2>
          <div className="account-list">
            {users.map((u) => (
              <button
                className={
                  selected === u.id ? "account-row selected" : "account-row"
                }
                key={u.id}
                onClick={() => edit(u)}
              >
                <span>
                  <strong>{u.name}</strong>
                  <small>
                    {u.login ? `@${u.login}` : "Задайте логин и пароль"}
                    {u.admin ? " · администратор" : ""}
                  </small>
                </span>
                <b>◉ {u.balance.toLocaleString("ru-RU")}</b>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
