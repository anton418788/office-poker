import { useEffect, useRef, useState } from "react";
import { cardMoves, dealFrame, isDealing } from "../shared/dealing";
import type { View } from "../shared/types";
import type { GameSound } from "../shared/sound-events";
export function useDealPresentation(
  game: View | null,
  play: (sound: GameSound) => void,
) {
  const [now, setNow] = useState(Date.now()),
    last = useRef({ id: -1, clock: 0, startedAt: 0 }),
    wasActive = useRef(false);
  const plan = game?.deal,
    frame = dealFrame(plan, game?.hand ?? 0, game?.board.length ?? 0, now);
  useEffect(() => {
    setNow(Date.now());
    if (!game || !isDealing(game) || game.paused) return;
    const timer = setInterval(() => {
      const clock = Date.now();
      setNow(clock);
      if (plan && clock >= plan.endsAt) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [plan?.id, plan?.startedAt, plan?.endsAt, game?.paused]);
  useEffect(() => {
    if (!plan || !game) return;
    if (last.current.id !== plan.id) {
      last.current = {
        id: plan.id,
        clock: Math.max(plan.startedAt - 1, frame.clock - 80),
        startedAt: plan.startedAt,
      };
      if (plan.hole && frame.clock - plan.startedAt < 300 && !game.paused)
        play("shuffle");
    }
    if (last.current.startedAt !== plan.startedAt) {
      last.current.clock += plan.startedAt - last.current.startedAt;
      last.current.startedAt = plan.startedAt;
    }
    if (!game.paused) {
      const sounded = new Set<number>();
      for (const move of cardMoves(plan)) {
        if (
          last.current.clock < move.start &&
          move.start <= frame.clock &&
          !sounded.has(move.start)
        ) {
          play("deal");
          sounded.add(move.start);
        }
        if (
          move.kind === "board" &&
          last.current.clock < move.flip &&
          move.flip <= frame.clock
        )
          play("flip");
      }
    }
    if (wasActive.current && !frame.active && !game.paused) {
      if (game.actor === game.me) play("turn");
      if (game.phase === "showdown" && plan.boardTo > plan.boardFrom)
        play("payout");
    }
    last.current.clock = frame.clock;
    wasActive.current = frame.active;
  }, [frame.clock, frame.active, plan?.id, game?.paused, game?.actor, play]);
  return frame;
}
