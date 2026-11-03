import { useEffect, useRef, useState } from "react";
import { cardMoves, dealFrame, nextDealUpdate } from "../shared/dealing";
import type { View } from "../shared/types";
import type { GameSound } from "../shared/sound-events";
export function useDealPresentation(
  game: View | null,
  play: (sound: GameSound) => void,
) {
  const [now, setNow] = useState(Date.now()),
    last = useRef({ id: -1, clock: 0, startedAt: 0, identity: "" }),
    wasActive = useRef(false);
  const identity = game ? `${game.me}:${game.room?.id ?? ""}` : "";
  const plan = game?.deal,
    frame = dealFrame(plan, game?.hand ?? 0, game?.board.length ?? 0, now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const clock = Date.now();
      setNow(clock);
      if (!plan || game?.paused) return;
      const next = nextDealUpdate(plan, clock);
      if (next !== null) timer = setTimeout(update, Math.max(1, next - clock));
    };
    update();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [plan?.id, plan?.startedAt, plan?.endsAt, game?.paused, identity]);
  useEffect(() => {
    if (!plan || !game) {
      last.current = { id: -1, clock: 0, startedAt: 0, identity };
      wasActive.current = false;
      return;
    }
    if (last.current.identity !== identity) wasActive.current = false;
    if (last.current.id !== plan.id || last.current.identity !== identity) {
      last.current = {
        id: plan.id,
        identity,
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
  }, [
    frame.clock,
    frame.active,
    plan?.id,
    game?.paused,
    game?.actor,
    play,
    identity,
  ]);
  return frame;
}
