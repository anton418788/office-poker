import type { CSSProperties } from "react";
import { chipBreakdown, chipColors } from "../shared/chips";
export function Chip({
  value,
  style,
}: {
  value: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="poker-chip"
      style={
        {
          "--chip-color": chipColors[value],
          "--chip-ink": value === 1 ? "#3e5147" : "#fffdf2",
          ...style,
        } as CSSProperties
      }
    >
      <i>{value >= 1000 ? `${value / 1000}k` : value}</i>
    </span>
  );
}
export function ChipPile({
  amount,
  compact = false,
}: {
  amount: number;
  compact?: boolean;
}) {
  const stacks = chipBreakdown(amount);
  return (
    <div
      className={`chip-pile ${compact ? "compact" : ""}`}
      role="img"
      aria-label={`${amount.toLocaleString("ru-RU")} фишек`}
      title={stacks.map((s) => `${s.value} × ${s.count}`).join(" · ")}
    >
      {stacks.map((stack) => (
        <div
          key={stack.value}
          className="chip-stack"
          style={{ height: 24 + Math.min(stack.count, 10) * 4 }}
        >
          {Array.from({ length: Math.min(stack.count, 10) }, (_, i) => (
            <Chip
              key={i}
              value={stack.value}
              style={{ bottom: i * 4, zIndex: i }}
            />
          ))}
          {stack.count > 10 && (
            <span className="stack-multiplier">×{stack.count}</span>
          )}
        </div>
      ))}
    </div>
  );
}
