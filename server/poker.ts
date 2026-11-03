import { randomInt } from "node:crypto";
import type { Card } from "../shared/types.js";
export function deck(): Card[] {
  const cards: Card[] = [];
  for (const suit of ["s", "h", "d", "c"] as const)
    for (let rank = 2; rank <= 14; rank++) cards.push({ rank, suit });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export { evaluate, compare, combinations } from "../shared/poker.js";
