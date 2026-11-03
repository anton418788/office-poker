import type { DealPresentation, Game } from "./types.js";
export const CARD_INTERVAL = 460;
export const CARD_FLIGHT = 640;
export const CARD_FLIP = 170;
export const DEAL_LEAD = 600;
export type CardMove = {
  key: string;
  kind: "hole" | "board";
  seat: number;
  index: number;
  start: number;
  land: number;
  flip: number;
};
export function dealOrder(seats: number[], dealer: number) {
  return [...seats].sort(
    (a, b) => ((a - dealer + 5) % 6) - ((b - dealer + 5) % 6),
  );
}
export function cardMoves(plan: DealPresentation): CardMove[] {
  const moves: CardMove[] = [];
  const add = (
    kind: "hole" | "board",
    seat: number,
    index: number,
    slot = moves.length,
  ) => {
    const start =
      plan.startedAt +
      (plan.timing?.lead ?? DEAL_LEAD) +
      slot * (plan.timing?.interval ?? CARD_INTERVAL);
    const land = start + (plan.timing?.flight ?? CARD_FLIGHT);
    moves.push({
      key: `${plan.id}-${kind}-${seat}-${index}`,
      kind,
      seat,
      index,
      start,
      land,
      flip: land + (kind === "board" ? (plan.timing?.flip ?? CARD_FLIP) : 0),
    });
  };
  if (plan.hole) {
    if (plan.holeMode === "pairs")
      plan.seats.forEach((seat, slot) => {
        add("hole", seat, 0, slot);
        add("hole", seat, 1, slot);
      });
    else
      for (let round = 0; round < 2; round++)
        for (const seat of plan.seats) add("hole", seat, round);
  }
  const boardOffset = plan.hole
    ? plan.holeMode === "pairs"
      ? plan.seats.length
      : plan.seats.length * 2
    : 0;
  for (let i = plan.boardFrom; i < plan.boardTo; i++)
    add("board", -1, i, boardOffset + i - plan.boardFrom);
  return moves;
}
export function isDealing(g: Pick<Game, "deal" | "hand">, now = Date.now()) {
  const plan = g.deal;
  return !!plan && plan.hand === g.hand && (plan.pausedAt ?? now) < plan.endsAt;
}
export function dealFrame(
  plan: DealPresentation | null | undefined,
  hand: number,
  boardLength: number,
  now: number,
) {
  if (!plan || plan.hand !== hand || (plan.pausedAt ?? now) >= plan.endsAt)
    return {
      active: false,
      holeCount: (_seat: number) => 2,
      boardFaces: boardLength,
      boardLanded: boardLength,
      flights: [] as CardMove[],
      clock: now,
    };
  const clock = plan.pausedAt ?? now,
    moves = cardMoves(plan),
    hole = moves.filter((m) => m.kind === "hole"),
    board = moves.filter((m) => m.kind === "board");
  return {
    active: clock < plan.endsAt,
    holeCount: (seat: number) =>
      plan.hole
        ? hole.filter((m) => m.seat === seat && m.land <= clock).length
        : 2,
    boardFaces: plan.boardFrom + board.filter((m) => m.flip <= clock).length,
    boardLanded: plan.boardFrom + board.filter((m) => m.land <= clock).length,
    flights: moves.filter((m) => m.start <= clock && clock < m.land),
    clock,
  };
}
