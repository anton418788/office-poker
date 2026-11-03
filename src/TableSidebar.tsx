import { useState } from "react";
import type { Card, View } from "../shared/types";
import { CombinationsPanel } from "./CombinationsPanel";
export function TableSidebar({
  game: g,
  hole,
  board,
  timer,
  dealing,
}: {
  game: View;
  hole: Card[];
  board: Card[];
  timer: string;
  dealing: boolean;
}) {
  const [tab, setTab] = useState<"odds" | "activity" | null>(() =>
    window.innerWidth >= 1100 ? "odds" : null,
  );
  const active = g.players.find((p) => p.id === g.actor);
  return (
    <aside
      className={`table-tools ${tab ? "tools-open" : ""}`}
      aria-label="Помощник за столом"
    >
      <div className="tool-tabs" role="tablist" aria-label="Панели стола">
        <button
          role="tab"
          id="odds-tab"
          aria-label="Комбинации и вероятности"
          aria-selected={tab === "odds"}
          aria-controls="odds-panel"
          title="Комбинации и вероятности"
          onClick={() => setTab(tab === "odds" ? null : "odds")}
        >
          <b>♠</b>
          <span>Комбинации</span>
        </button>
        <button
          role="tab"
          id="activity-tab"
          aria-label="Ритм игры и история"
          aria-selected={tab === "activity"}
          aria-controls="activity-panel"
          title="Ритм игры и история"
          onClick={() => setTab(tab === "activity" ? null : "activity")}
        >
          <b>◷</b>
          <span>Ритм и история</span>
        </button>
      </div>
      {tab && (
        <div
          className="tool-body"
          role="tabpanel"
          id={tab === "odds" ? "odds-panel" : "activity-panel"}
          aria-labelledby={tab === "odds" ? "odds-tab" : "activity-tab"}
        >
          <button
            className="close-tool"
            aria-label="Свернуть панель стола"
            onClick={() => setTab(null)}
          >
            ×
          </button>
          {tab === "odds" ? (
            <CombinationsPanel hole={hole} board={board} dealing={dealing} />
          ) : (
            <section className="activity">
              <div className="panel-title">
                Ритм игры <span>◷</span>
              </div>
              <div className="turn-box">
                <span>
                  {g.paused
                    ? "Игра на паузе"
                    : dealing
                      ? "Дилер раздаёт карты"
                      : active
                        ? active.id === g.me
                          ? "Ваш ход"
                          : `Ходит ${active.name}`
                        : "Ожидаем новую раздачу"}
                </span>
                <strong>{dealing && !g.paused ? "Раздача…" : timer}</strong>
                <p>
                  {g.paused
                    ? "Таймер остановлен"
                    : dealing
                      ? "Время на решение начнётся после раздачи"
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
                  g.log
                    .filter(
                      (s) =>
                        !(
                          dealing &&
                          g.phase === "showdown" &&
                          g.result.includes(s)
                        ),
                    )
                    .slice(0, 30)
                    .map((s, i) => (
                      <div key={i} className={i === 0 ? "latest" : ""}>
                        <i />
                        {s}
                      </div>
                    ))
                ) : (
                  <p>История появится с первой раздачей.</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
