import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  CASE_PRICE,
  caseContents,
  drawCase,
  reelTickTimes,
  shopCases,
  shopCase,
  type CaseId,
  type CaseOpening,
} from "../shared/cases";
import {
  cosmeticItem,
  cosmeticRarities,
  type CosmeticItem,
} from "../shared/cosmetics";
import type { Account, View } from "../shared/types";
import type { useGameSounds } from "./useGameSounds";
import { isDealing } from "../shared/dealing";
import { CosmeticPreview } from "./CosmeticPreview";
const format = (n: number) => n.toLocaleString("ru-RU");
const WIN_INDEX = 24,
  TILE = 128,
  STRIDE = 140,
  DURATION = 3300;
type Round = { opening: CaseOpening; entries: (CosmeticItem | null)[] };
type Attempt = { caseId: CaseId; requestId: string };
function readAttempt(key: string): Attempt | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value &&
      shopCase(value.caseId) &&
      typeof value.requestId === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
function rarityStyle(item: CosmeticItem | null): CSSProperties {
  return {
    "--rarity-color": item ? cosmeticRarities[item.rarity].color : "#64756a",
  } as CSSProperties;
}
function CaseReel({
  round,
  animate,
  play,
  onDone,
}: {
  round: Round;
  animate: boolean;
  play: ReturnType<typeof useGameSounds>["play"];
  onDone: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    track = useRef<HTMLDivElement>(null),
    skip = useRef<() => void>(() => {}),
    done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const el = track.current,
      container = viewport.current;
    if (!el || !container) return;
    const center = container.clientWidth / 2,
      travel = WIN_INDEX * STRIDE + TILE / 2 - center;
    const target = `translate3d(${-travel}px,0,0)`;
    if (!animate) {
      el.style.transform = target;
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let settled = false;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = target;
      play(round.opening.itemId ? "payout" : "case-result");
      done.current();
      return;
    }
    const animation = el.animate(
      [{ transform: "translate3d(0,0,0)" }, { transform: target }],
      {
        duration: DURATION,
        easing: "cubic-bezier(.12,.68,.12,1)",
        fill: "forwards",
      },
    );
    const finish = () => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      el.style.transform = target;
      animation.cancel();
      play(round.opening.itemId ? "payout" : "case-result");
      done.current();
    };
    skip.current = finish;
    for (const time of reelTickTimes(
      travel,
      center,
      TILE,
      STRIDE,
      round.entries.length,
      DURATION,
    ))
      timers.push(setTimeout(() => play("case-tick"), time));
    void animation.finished.then(finish, () => {});
    return () => {
      settled = true;
      animation.cancel();
      timers.forEach(clearTimeout);
      skip.current = () => {};
    };
  }, [round.opening.id, animate, play]);
  return (
    <>
      <div className="case-window" ref={viewport} aria-hidden="true">
        <div className="case-marker" />
        <div className="case-track" ref={track}>
          {round.entries.map((item, i) => (
            <div
              key={i}
              className={`case-tile ${i === WIN_INDEX ? "case-winner-tile" : ""}`}
              style={rarityStyle(item)}
            >
              <div className="case-reel-art">
                <CosmeticPreview item={item} />
              </div>
              <span>{item?.name ?? "Пусто"}</span>
            </div>
          ))}
        </div>
      </div>
      {animate && (
        <button className="skip-case" onClick={() => skip.current()}>
          Пропустить анимацию
        </button>
      )}
    </>
  );
}
export function ShopPanel({
  account,
  activeRoom,
  busy,
  error,
  request,
  onOpen,
  onBack,
  onInventory,
  sound,
}: {
  account: Account;
  activeRoom?: View;
  busy: boolean;
  error: string;
  request: (path: string) => Promise<any>;
  onOpen: (caseId: CaseId, requestId: string) => Promise<CaseOpening | null>;
  onBack: () => void;
  onInventory: () => void;
  sound: ReturnType<typeof useGameSounds>;
}) {
  const storageKey = `office-poker:case-attempt:${account.id}`;
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    readAttempt(storageKey),
  );
  const [selected, setSelected] = useState<CaseId | null>(
      () => readAttempt(storageKey)?.caseId ?? null,
    ),
    [round, setRound] = useState<Round | null>(null),
    [phase, setPhase] = useState<"idle" | "rolling" | "done">("idle"),
    [history, setHistory] = useState<CaseOpening[]>([]),
    [historyError, setHistoryError] = useState("");
  function saveAttempt(value: Attempt | null) {
    setAttempt(value);
    try {
      if (value) localStorage.setItem(storageKey, JSON.stringify(value));
      else localStorage.removeItem(storageKey);
    } catch {}
  }
  function makeRound(opening: CaseOpening): Round {
    return {
      opening,
      entries: Array.from({ length: 32 }, (_, i) =>
        i === WIN_INDEX
          ? (cosmeticItem(opening.itemId) ?? null)
          : drawCase(opening.caseId, Math.floor(Math.random() * 10000)),
      ),
    };
  }
  useEffect(() => {
    let alive = true;
    void request("shop/openings")
      .then((items: CaseOpening[]) => {
        if (!alive) return;
        setHistory(items);
        const pending = readAttempt(storageKey),
          recovered = pending
            ? items.find((item) => item.id === pending.requestId)
            : null;
        if (recovered) {
          saveAttempt(null);
          setSelected(recovered.caseId);
          setRound(makeRound(recovered));
          setPhase("done");
        }
      })
      .catch(
        () => alive && setHistoryError("Не удалось загрузить историю открытий"),
      );
    return () => {
      alive = false;
    };
  }, [account.id]);
  const inHand =
    !!activeRoom &&
    (!["waiting", "showdown"].includes(activeRoom.phase) ||
      isDealing(activeRoom));
  const retrying = !!attempt && attempt.caseId === selected;
  const blocked =
    busy ||
    phase === "rolling" ||
    (!!attempt && !retrying) ||
    (!retrying && (inHand || account.balance < CASE_PRICE));
  const definition = shopCase(selected);
  const result = round?.opening,
    item = cosmeticItem(result?.itemId);
  async function open() {
    if (!selected || blocked) return;
    const next =
      attempt?.caseId === selected
        ? attempt
        : {
            caseId: selected,
            requestId: Array.from(
              crypto.getRandomValues(new Uint8Array(16)),
              (byte) => byte.toString(16).padStart(2, "0"),
            ).join(""),
          };
    saveAttempt(next);
    const opening = await onOpen(selected, next.requestId);
    if (!opening) return;
    saveAttempt(null);
    setHistory((current) =>
      [opening, ...current.filter((item) => item.id !== opening.id)].slice(
        0,
        10,
      ),
    );
    setRound(makeRound(opening));
    setPhase("rolling");
  }
  const visibleHistory = history.filter(
    (opening) => !(phase === "rolling" && opening.id === round?.opening.id),
  );
  const historyView = (
    <section className="case-history">
      <h2>Последние открытия</h2>
      {historyError && <p>{historyError}</p>}
      {!visibleHistory.length && !historyError ? (
        <p>
          Здесь сохранятся ваши результаты, даже если закрыть страницу во время
          прокрутки.
        </p>
      ) : (
        visibleHistory.map((opening) => {
          const won = cosmeticItem(opening.itemId);
          return (
            <div className="case-history-row" key={opening.id}>
              <span>{shopCase(opening.caseId)?.name}</span>
              <strong>{won?.name ?? "Пусто"}</strong>
              <small>
                {opening.duplicate
                  ? `Повтор · +${opening.compensation} фишек`
                  : won
                    ? "В инвентаре"
                    : "Без предмета"}
              </small>
            </div>
          );
        })
      )}
    </section>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">МАГАЗИН КЛУБА</div>
          <h1>{definition?.name ?? "Магазин"}</h1>
          <p>
            {definition
              ? "Откройте кейс и пополните свою коллекцию."
              : "Два кейса. Сидушки для вашего места и рубашки для вашей раздачи."}
          </p>
        </div>
        <button
          onClick={() => {
            if (selected) {
              setSelected(null);
              setRound(null);
              setPhase("idle");
            } else onBack();
          }}
        >
          {selected ? "← Все кейсы" : "← К столам"}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {attempt && !busy && phase === "idle" && (
        <div className="club-notice">
          <span>
            Открытие не подтверждено. Повторите запрос — второй раз фишки не
            спишутся.
          </span>
          {attempt.caseId !== selected && (
            <button onClick={() => setSelected(attempt.caseId)}>
              Проверить открытие
            </button>
          )}
        </div>
      )}
      {inHand && (
        <div className="club-notice">
          Кейсы открываются между раздачами: во время игры ваш баланс участвует
          в ставках. Вернуться к столу можно кнопкой сверху.
        </div>
      )}
      {!definition ? (
        <>
          <div className="shop-case-grid">
            {shopCases.map((box) => (
              <article className="shop-case-card" key={box.id}>
                <div
                  className={`case-box-art box-${box.id}`}
                  aria-hidden="true"
                >
                  <div className="case-box-lid" />
                  <span>{box.slot === "chair" ? "♧" : "♠"}</span>
                  <small>ПОСЛЕ ДЕЙЛИ</small>
                </div>
                <div>
                  <h2>{box.name}</h2>
                  <p>{box.description}</p>
                  <div className="case-card-bottom">
                    <strong>◉ {format(CASE_PRICE)}</strong>
                    <button
                      className="primary"
                      onClick={() => {
                        setSelected(box.id as CaseId);
                        setRound(null);
                        setPhase("idle");
                      }}
                    >
                      Посмотреть кейс ↗
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="case-disclosure">
            Редкий предмет — 15%, эпический — 5%, эксклюзивный — 1%. Пустой кейс
            — 79%. Каждое открытие независимо.
          </p>
          {historyView}
        </>
      ) : (
        <>
          <section className="case-opening-panel">
            {round ? (
              <CaseReel
                round={round}
                animate={phase === "rolling"}
                play={sound.play}
                onDone={() => setPhase("done")}
              />
            ) : (
              <div className="case-idle-preview" aria-hidden="true">
                {caseContents(selected).map((outcome, i) => (
                  <div
                    className="case-tile"
                    style={rarityStyle(outcome.item)}
                    key={i}
                  >
                    <div className="case-reel-art">
                      <CosmeticPreview item={outcome.item} />
                    </div>
                    <span>{outcome.item?.name ?? "Пусто"}</span>
                  </div>
                ))}
              </div>
            )}
            {result && phase === "done" && (
              <div
                className="case-result"
                role="status"
                style={rarityStyle(item ?? null)}
              >
                <strong>{item?.name ?? "Кейс пустой"}</strong>
                <p>
                  {result.duplicate
                    ? `У вас уже есть этот предмет. Вы получили компенсацию: ${result.compensation} фишек.`
                    : item
                      ? "Новый предмет добавлен в ваш инвентарь. Вы можете выбрать его там."
                      : "В этот раз предмет не выпал."}
                </p>
                {item && !result.duplicate && (
                  <button onClick={onInventory}>Открыть инвентарь ↗</button>
                )}
              </div>
            )}
            <div className="case-buy-bar">
              <span>
                Ваш баланс: <strong>◉ {format(account.balance)}</strong>
              </span>
              <button
                className="primary"
                disabled={blocked}
                onClick={() => void open()}
              >
                {busy
                  ? "Открываем…"
                  : phase === "rolling"
                    ? "Лента крутится…"
                    : retrying
                      ? "Повторить запрос открытия"
                      : inHand
                        ? "Доступно между раздачами"
                        : account.balance < CASE_PRICE
                          ? "Недостаточно фишек"
                          : `Открыть за ${format(CASE_PRICE)} фишек`}
              </button>
            </div>
            <p className="case-disclosure">
              Повтор предмета: редкий — +50, эпический — +250, эксклюзивный —
              +500 фишек. Пустой кейс не даёт компенсации.
            </p>
          </section>
          <section className="case-contents">
            <h2>Что может выпасть</h2>
            <div className="case-contents-grid">
              {caseContents(selected).map((outcome, i) => (
                <article
                  className="case-content-item"
                  key={i}
                  style={rarityStyle(outcome.item)}
                >
                  <div className="inventory-preview">
                    <CosmeticPreview item={outcome.item} />
                  </div>
                  <strong>{outcome.item?.name ?? "Пусто"}</strong>
                  <span>
                    {outcome.item
                      ? cosmeticRarities[outcome.item.rarity].name
                      : "Без предмета"}
                  </span>
                  <b>{outcome.weight / 100}%</b>
                </article>
              ))}
            </div>
          </section>
          {historyView}
        </>
      )}
    </>
  );
}
