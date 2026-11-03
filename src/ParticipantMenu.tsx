import { useEffect, useRef, useState } from "react";
export function ParticipantMenu({
  name,
  playerId,
  self,
  canManage,
  busy,
  align,
  onKick,
}: {
  name: string;
  playerId: string;
  self: boolean;
  canManage: boolean;
  busy: boolean;
  align: "start" | "end";
  onKick: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    action = useRef<HTMLButtonElement>(null);
  const allowed = canManage && !self;
  useEffect(() => {
    if (!open) return;
    if (allowed && !busy) action.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, allowed]);
  const reason = self
    ? "Для собственного выхода используйте кнопку под вашим стеком."
    : !canManage
      ? "Доступно хосту стола и администратору."
      : "Карты участника будут сброшены, место освободится.";
  return (
    <div ref={root} className="participant-menu" data-open={open}>
      <button
        type="button"
        ref={trigger}
        className="participant-menu-trigger"
        aria-label={`Действия участника ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`participant-menu-${playerId}`}
        onClick={() => setOpen((value) => !value)}
      >
        ⋮
      </button>
      {open && (
        <div
          className={`participant-popover align-${align}`}
          id={`participant-menu-${playerId}`}
          role="menu"
          aria-label={`Меню участника ${name}`}
        >
          <button
            type="button"
            ref={action}
            role="menuitem"
            disabled={!allowed || busy}
            onClick={() => {
              setOpen(false);
              void onKick();
            }}
          >
            Высадить из-за стола
          </button>
          <p>{reason}</p>
        </div>
      )}
    </div>
  );
}
