import type { Game } from "./types";
export function potAmount(game: Pick<Game, "players" | "departedBets">) {
  return (
    game.players.reduce((sum, p) => sum + p.total, 0) +
    (game.departedBets ?? []).reduce((sum, p) => sum + p.total, 0)
  );
}
