import { useEffect, useState } from "react";
import type { View } from "../shared/types";
import { isDealing } from "../shared/dealing";
export function ReturnToTable({
  game,
  onReturn,
}: {
  game: View;
  onReturn: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const yourTurn =
    game.actor === game.me && !game.paused && !isDealing(game, now);
  const seconds = Math.max(0, Math.ceil(((game.deadline ?? now) - now) / 1000));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const status = game.paused
    ? "Пауза"
    : isDealing(game, now)
      ? "Раздача карт"
      : yourTurn
        ? `Ваш ход · ${time}`
        : "Вы за столом";
  return (
    <button
      className={`floating-table-return ${yourTurn ? "return-your-turn" : ""}`}
      aria-label="Вернуться к столу"
      onClick={onReturn}
    >
      <span className="return-icon" aria-hidden="true">
        ♠
      </span>
      <span>
        <strong>Вернуться к столу ↗</strong>
        <small>
          {game.room?.name} · {status}
        </small>
      </span>
      {yourTurn && <span className="return-turn-dot" aria-hidden="true" />}
    </button>
  );
}
