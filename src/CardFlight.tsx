import { useLayoutEffect, useRef } from "react";
import type { CardMove } from "../shared/dealing";
import { Card } from "./Card";
export function CardFlight({
  move,
  from,
  to,
  width,
  height,
  pausedAt,
}: {
  move: CardMove;
  from: number[];
  to: number[];
  width: number;
  height: number;
  pausedAt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || width <= 0 || height <= 0) return;
    const frames = Array.from({ length: 33 }, (_, i) => {
      const t = i / 32,
        ease = 1 - (1 - t) ** 2;
      const x = ((from[0] + (to[0] - from[0]) * ease) / 100) * width;
      const y =
        ((from[1] + (to[1] - from[1]) * ease - Math.sin(Math.PI * t) * 5) /
          100) *
        height;
      const fan = move.kind === "hole" ? (move.index - 0.5) * 8 : 0;
      const rotation = (-12 + fan) * (1 - t) + Math.sin(Math.PI * t) * 20;
      return {
        offset: t,
        transform: `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${rotation}deg)`,
      };
    });
    const duration = move.land - move.start;
    const animation = el.animate(frames, {
      duration,
      easing: "linear",
      fill: "both",
    });
    animation.currentTime = Math.max(
      0,
      Math.min(duration, (pausedAt ?? Date.now()) - move.start),
    );
    if (pausedAt !== undefined) animation.pause();
    return () => animation.cancel();
  }, [
    move.start,
    move.land,
    move.kind,
    move.index,
    from[0],
    from[1],
    to[0],
    to[1],
    width,
    height,
    pausedAt,
  ]);
  return (
    <div
      ref={ref}
      className="dealing-card"
      data-deal-to={
        move.kind === "hole" ? `seat-${move.seat}` : `board-${move.index}`
      }
    >
      <Card back small />
    </div>
  );
}
