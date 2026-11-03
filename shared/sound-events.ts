import type { View } from "./types";
export type GameSound = "cards" | "chips" | "payout" | "turn";
// Compare authoritative snapshots so polling the same state never repeats a sound.
export function soundEvents(previous: View | null, next: View): GameSound[] {
  if (!previous) return [];
  const events: GameSound[] = [];
  if (next.hand !== previous.hand || next.board.length > previous.board.length)
    events.push("cards");
  const fresh = (next.transfers ?? []).filter(
    (t) => t.id > (previous.transferSeq ?? 0),
  );
  if (fresh.some((t) => t.kind === "payout")) events.push("payout");
  if (
    !fresh.some((t) => t.kind === "payout") &&
    next.hand === previous.hand &&
    next.players.some((p) => {
      const old = previous.players.find((other) => other.id === p.id);
      return (
        old &&
        (p.total > old.total ||
          (next.phase === "showdown" &&
            previous.phase !== "showdown" &&
            p.chips > old.chips))
      );
    })
  )
    events.push("chips");
  if (
    next.actor === next.me &&
    !next.paused &&
    (previous.actor !== next.me || previous.paused)
  )
    events.push("turn");
  return events;
}
