import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PublicPlayerProfile } from "../shared/profile";
import { profileCombinations } from "../shared/profile";
import { ProfileOverview, CombinationTable } from "./ProfileOverview";
import { AvatarContent } from "./AvatarContent";

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
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  useLayoutEffect(() => {
    const trigger = document.getElementById(`player-profile-${id}`);
    const anchor = trigger?.closest<HTMLElement>(".player");
    const popup = root.current;
    if (!anchor || !popup) {
      onClose();
      return;
    }
    const update = () => {
      if (!anchor.isConnected) {
        onClose();
        return;
      }
      const card = anchor.getBoundingClientRect(),
        box = popup.getBoundingClientRect();
      const padding = 12,
        gap = 10,
        width = window.innerWidth,
        height = window.innerHeight;
      if (
        card.bottom < padding ||
        card.top > height - padding ||
        card.right < padding ||
        card.left > width - padding
      ) {
        onClose();
        return;
      }
      const clamp = (value: number, max: number) =>
        Math.max(padding, Math.min(value, max - padding));
      let left = clamp(
        card.left + (card.width - box.width) / 2,
        width - box.width,
      );
      let top: number;
      if (card.bottom + gap + box.height <= height - padding)
        top = card.bottom + gap;
      else if (card.top - gap - box.height >= padding)
        top = card.top - gap - box.height;
      else if (card.right + gap + box.width <= width - padding) {
        left = card.right + gap;
        top = clamp(
          card.top + (card.height - box.height) / 2,
          height - box.height,
        );
      } else if (card.left - gap - box.width >= padding) {
        left = card.left - gap - box.width;
        top = clamp(
          card.top + (card.height - box.height) / 2,
          height - box.height,
        );
      } else top = clamp(card.bottom + gap, height - box.height);
      const next = { left: Math.round(left), top: Math.round(top) };
      setPosition((previous) =>
        previous?.left === next.left && previous.top === next.top
          ? previous
          : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(popup);
    observer.observe(anchor);
    const scene = anchor.closest(".table-scene");
    if (scene) observer.observe(scene);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [id]);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        document
          .getElementById(`player-profile-${id}`)
          ?.focus({ preventScroll: true });
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
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
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
              <AvatarContent
                name={data.player.name}
                url={data.player.avatarUrl}
              />
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
