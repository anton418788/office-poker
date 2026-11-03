import { useEffect, useRef, useState } from "react";
import type { Card } from "../shared/types";
import { handNames, type HandOdds } from "../shared/odds";
const examples = [
  "A♠ J♥ 9♣ 6♦ 3♠",
  "A♠ A♥ 9♣ 6♦ 3♠",
  "A♠ A♥ 9♣ 9♦ 3♠",
  "A♠ A♥ A♣ 6♦ 3♠",
  "9♠ 8♥ 7♣ 6♦ 5♠",
  "A♥ J♥ 9♥ 6♥ 3♥",
  "A♠ A♥ A♣ 9♦ 9♠",
  "A♠ A♥ A♣ A♦ 3♠",
  "9♠ 8♠ 7♠ 6♠ 5♠",
  "A♥ K♥ Q♥ J♥ 10♥",
];
export function CombinationsPanel({
  hole,
  board,
  onClose,
}: {
  hole: Card[];
  board: Card[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [odds, setOdds] = useState<HandOdds | null>(null),
    [error, setError] = useState("");
  const key = [...hole, ...board].map((c) => `${c.rank}${c.suit}`).join(",");
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    setOdds(null);
    setError("");
    if (hole.length !== 2) return;
    const worker = new Worker(new URL("./odds.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      if (e.data.error) setError(e.data.error);
      else setOdds(e.data.result);
    };
    worker.onerror = () => setError("Не удалось рассчитать вероятности");
    worker.postMessage({ hole, board });
    return () => worker.terminate();
  }, [key]);
  return (
    <dialog
      ref={dialog}
      className="odds-dialog"
      aria-labelledby="odds-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="odds-content">
        <div className="odds-heading">
          <div>
            <span className="eyebrow">ВАШ КАРМАННЫЙ ПОМОЩНИК</span>
            <h2 id="odds-title">Комбинации и шансы</h2>
          </div>
          <button onClick={onClose} aria-label="Закрыть комбинации">
            ×
          </button>
        </div>
        <p className="odds-intro">
          Вероятность получить каждую{" "}
          <strong>лучшую комбинацию к риверу</strong> по вашим картам и
          открытому борду. Все варианты вместе — 100%.
        </p>
        <div className="odds-meta">
          {error ||
            (hole.length !== 2
              ? "Займите место и дождитесь раздачи — здесь появятся ваши шансы."
              : !odds
                ? "Считаем возможные расклады…"
                : odds.exact
                  ? `Точный расчёт · ${odds.samples.toLocaleString("ru-RU")} раскладов`
                  : `Оценка ≈ · ${odds.samples.toLocaleString("ru-RU")} раскладов`)}
          <small>
            Комбинации — от сильной к слабой. Это шанс собрать руку, а не
            победить соперников.
          </small>
        </div>
        <div className="odds-rows">
          {[...handNames].reverse().map((name, row) => {
            const i = 9 - row,
              probability = odds?.probabilities[i];
            return (
              <div
                className={`odds-row ${odds?.current === i ? "current-combination" : ""}`}
                key={name}
              >
                <div className="odds-name">
                  <b>{name}</b>
                  {odds?.current === i && <small>Уже собрано</small>}
                  <div
                    className="example-cards"
                    aria-label={`Пример: ${examples[i]}`}
                  >
                    {examples[i].split(" ").map((card, j) => (
                      <span key={j} className={/[♥♦]/.test(card) ? "red" : ""}>
                        {card}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="odds-chance">
                  <strong>
                    {probability === undefined
                      ? "—"
                      : `${odds?.exact ? "" : "≈ "}${probability > 0 && probability < 0.01 ? "< 0,01" : probability.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`}
                  </strong>
                  <div className="probability-track">
                    <i style={{ width: `${probability ?? 0}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="primary odds-back" onClick={onClose}>
          Вернуться к столу
        </button>
      </section>
    </dialog>
  );
}
