import type { Card as PlayingCard } from "../shared/types";
export function Card({
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
