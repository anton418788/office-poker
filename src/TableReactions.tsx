import { useEffect, useRef, useState } from "react";
import {
  tableReactions,
  REACTION_COOLDOWN,
  type TableReaction,
} from "../shared/reactions";
import "./reactions.css";
export function ReactionPicker({
  busy,
  lastSent,
  onSend,
}: {
  busy: boolean;
  lastSent: number;
  onSend: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [now, setNow] = useState(Date.now());
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const cooling = now - lastSent < REACTION_COOLDOWN;
  useEffect(() => {
    if (!cooling) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, lastSent + REACTION_COOLDOWN - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [lastSent, cooling]);
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>(".reaction-options button")
      ?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={root} className="reaction-control">
      <button
        ref={trigger}
        className="reaction-trigger"
        aria-label="Отправить эмоцию"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Эмоции"
        onClick={() => {
          setNow(Date.now());
          setOpen((v) => !v);
        }}
      >
        ☺
      </button>
      {open && (
        <div
          className="reaction-options"
          role="dialog"
          aria-label="Выбор эмоции"
        >
          <span>ЭМОЦИИ ЗА СТОЛОМ</span>
          <div>
            {tableReactions.map((r) => (
              <button
                key={r.id}
                aria-label={r.name}
                title={r.name}
                disabled={busy || cooling}
                onClick={async () => {
                  setOpen(false);
                  trigger.current?.focus({ preventScroll: true });
                  await onSend(r.id);
                }}
              >
                {r.emoji}
              </button>
            ))}
          </div>
          <small>
            {cooling
              ? "Ещё мгновение — и можно снова"
              : "Выберите эмоцию — её увидят все"}
          </small>
        </div>
      )}
    </div>
  );
}
export function ReactionBubble({
  event,
  name,
}: {
  event: TableReaction;
  name: string;
}) {
  const [visible, setVisible] = useState(() => event.expiresAt > Date.now());
  const [age] = useState(() => Math.max(0, Date.now() - event.createdAt));
  useEffect(() => {
    const timer = setTimeout(
      () => setVisible(false),
      Math.max(0, event.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [event.expiresAt]);
  const reaction = tableReactions.find((r) => r.id === event.reaction);
  if (!visible || !reaction) return null;
  return (
    <div
      className={`reaction-bubble reaction-${reaction.id}`}
      role="status"
      aria-label={`${name}: ${reaction.name}`}
      style={{ animationDelay: `-${age}ms` }}
    >
      <span className="reaction-glyph" aria-hidden="true">
        {reaction.emoji}
      </span>
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
    </div>
  );
}
