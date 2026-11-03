import { cosmeticItem, defaultAppearance } from "../shared/cosmetics";
import type { Card as PlayingCard } from "../shared/types";
export function Card({
  card,
  back = false,
  small = false,
  skin = defaultAppearance.deck,
}: {
  card?: PlayingCard;
  back?: boolean;
  small?: boolean;
  skin?: string;
}) {
  return (
    <div
      data-card-back={
        back
          ? (cosmeticItem(skin, "deck")?.id ?? defaultAppearance.deck)
          : undefined
      }
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
