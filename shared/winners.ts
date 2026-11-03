import type { Game } from "./types";
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
