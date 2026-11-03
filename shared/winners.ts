import { combinationCards } from "./poker";
import type { Game, Card } from "./types";
export function crownWinners(
  game: Pick<Game, "lastResult" | "hand">,
  dealing = false,
): string[] {
  const result = game.lastResult;
  if (!result) return [];
  return dealing && result.hand === game.hand
    ? result.previousWinnerIds
    : result.winners.map((w) => w.id);
}

export function winningHighlights(cards: Card[], board: Card[], hole: Card[]) {
  const core = combinationCards(cards);
  const includes = (c: Card) =>
    core.some((card) => card.rank === c.rank && card.suit === c.suit);
  return {
    boardIndexes: board.flatMap((c, i) => (includes(c) ? [i] : [])),
    holeIndexes: hole.flatMap((c, i) => (includes(c) ? [i] : [])),
  };
}
