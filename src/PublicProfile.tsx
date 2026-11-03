import { useEffect, useRef, useState } from "react";
import type { PublicPlayerProfile } from "../shared/profile";
import { profileCombinations } from "../shared/profile";
import { ProfileOverview, CombinationTable } from "./ProfileOverview";

type Reader = (path: string) => Promise<PublicPlayerProfile>;
function usePublicProfile(id: string, request: Reader) {
  const [data, setData] = useState<PublicPlayerProfile | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const result = await request(`profiles/${encodeURIComponent(id)}`);
        if (alive) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  return { data, error };
}
export function PublicProfilePage({
  id,
  request,
  onBack,
}: {
  id: string;
  request: Reader;
  onBack: () => void;
}) {
  const { data, error } = usePublicProfile(id, request);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">УЧАСТНИК КЛУБА</div>
          <h1>Профиль игрока</h1>
          <p>Раздачи, комбинации и коллекция участника.</p>
        </div>
        <button onClick={onBack}>← Назад к игре</button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {data ? (
        <>
          <ProfileOverview account={data.player} profile={data} />
          <CombinationTable combinations={data.combinations} />
        </>
      ) : (
        !error && <p role="status">Загружаем профиль…</p>
      )}
    </>
  );
}
export function MiniProfile({
  id,
  request,
  onClose,
  onVisit,
}: {
  id: string;
  request: Reader;
  onClose: () => void;
  onVisit: () => void;
}) {
  const { data, error } = usePublicProfile(id, request);
  const root = useRef<HTMLElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        document.getElementById(`player-profile-${id}`)?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [id]);
  const strongest = profileCombinations.find(
    (c) => (data?.combinations[c.id] ?? 0) > 0,
  );
  return (
    <aside
      ref={root}
      className="mini-profile club-panel"
      role="dialog"
      aria-modal="false"
      aria-label={
        data ? `Мини-профиль: ${data.player.name}` : "Мини-профиль игрока"
      }
    >
      <button
        className="mini-profile-close"
        ref={close}
        aria-label="Закрыть мини-профиль"
        onClick={onClose}
      >
        ×
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data ? (
        <>
          <div className="mini-profile-heading">
            <span className="profile-portrait" aria-hidden="true">
              {data.player.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>{data.player.name}</h2>
              <small>
                {data.player.admin ? "Администратор клуба" : "Участник клуба"}
              </small>
            </div>
          </div>
          <div className="mini-profile-metrics">
            <div>
              <strong>{data.hands.toLocaleString("ru-RU")}</strong>
              <span>Раздач</span>
            </div>
            <div>
              <strong>{data.wins.toLocaleString("ru-RU")}</strong>
              <span>Побед</span>
            </div>
            <div>
              <strong>
                {Object.values(data.collection).reduce((a, b) => a + b, 0)}
              </strong>
              <span>Предметов</span>
            </div>
          </div>
          <p className="mini-profile-best">
            Лучшая комбинация
            <strong>{strongest?.name ?? "Ещё нет вскрытий"}</strong>
          </p>
          <button className="primary" onClick={onVisit}>
            Перейти в профиль ↗
          </button>
        </>
      ) : (
        !error && <p role="status">Загружаем профиль…</p>
      )}
    </aside>
  );
}
