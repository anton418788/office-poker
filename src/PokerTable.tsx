import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ChipTransfer, View } from "../shared/types";
import { denominations, chipBreakdown } from "../shared/chips";
import { Card } from "./Card";
import { Chip, ChipPile } from "./ChipPile";
import type { useDealPresentation } from "./useDealPresentation";
const format = (n: number) => n.toLocaleString("ru-RU");
const locations = [
  [50, 79],
  [10, 68],
  [10, 29],
  [50, 17],
  [90, 29],
  [90, 68],
];
const stages = {
  waiting: "Ждём коллег",
  preflop: "Префлоп",
  flop: "Флоп",
  turn: "Тёрн",
  river: "Ривер",
  showdown: "Вскрытие",
};
type Flight = ChipTransfer & { delay: number; expiresAt: number };
export function PokerTable({
  game: g,
  busy,
  send,
  presentation,
}: {
  presentation: ReturnType<typeof useDealPresentation>;
  game: View;
  busy: boolean;
  send: (command: string, body?: object) => Promise<void>;
}) {
  const previous = useRef<number | null>(null),
    [flights, setFlights] = useState<Flight[]>([]),
    pausedAt = useRef<number | null>(null);
  const inHand =
    !["waiting", "showdown"].includes(g.phase) || presentation.active;
  const sceneRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => window.innerWidth <= 680);
  const [anchors, setAnchors] = useState<Record<string, [number, number]>>({});
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      const bounds = scene.getBoundingClientRect(),
        parent = scene.parentElement!.getBoundingClientRect();
      setCompact(parent.width <= 650);
      const next: Record<string, [number, number]> = {};
      scene.querySelectorAll(".seat-cards,.board-slot").forEach((el) => {
        const rect = el.getBoundingClientRect(),
          seat = el.closest(".seat");
        const key = seat
          ? `seat-${Array.from(scene.querySelectorAll(".seat")).indexOf(seat)}`
          : `board-${Array.from(scene.querySelectorAll(".board-slot")).indexOf(el)}`;
        next[key] = [
          ((rect.left + rect.width / 2 - bounds.left) / bounds.width) * 100,
          ((rect.top + rect.height / 2 - bounds.top) / bounds.height) * 100,
        ];
      });
      setAnchors(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [g.hand, g.deal?.id, g.transferSeq]);
  const point = (seat: number) => {
    const [x, y] = locations[seat] ?? [50, 17];
    return [compact ? (x === 10 ? 15 : x === 90 ? 85 : x) : x, y];
  };
  const dealer = point(g.dealer),
    origin = [
      dealer[0] < 50
        ? dealer[0] + 15
        : dealer[0] > 50
          ? dealer[0] - 15
          : dealer[0] + 11,
      dealer[1] + (50 - dealer[1]) * 0.27,
    ];
  useEffect(() => {
    if (previous.current === null) {
      previous.current = g.transferSeq ?? 0;
      return;
    }
    const fresh = (g.transfers ?? []).filter((t) => t.id > previous.current!);
    previous.current = g.transferSeq ?? 0;
    if (!fresh.length) return;
    const freshFlights = fresh.map((t, i) => {
      const delay =
        i * 70 +
        (t.kind === "payout"
          ? Math.max(
              0,
              (g.deal?.endsAt ?? 0) - (g.deal?.pausedAt ?? Date.now()),
            )
          : 0);
      return { ...t, delay, expiresAt: Date.now() + delay + 1800 };
    });
    setFlights((current) => [...current, ...freshFlights]);
  }, [g.transferSeq]);
  useEffect(() => {
    if (g.paused) {
      pausedAt.current ??= Date.now();
      return;
    }
    if (pausedAt.current !== null) {
      const shift = Date.now() - pausedAt.current;
      pausedAt.current = null;
      setFlights((current) =>
        current.map((f) => ({ ...f, expiresAt: f.expiresAt + shift })),
      );
    }
    if (!flights.length) return;
    const timer = setInterval(
      () =>
        setFlights((current) =>
          current.filter((f) => f.expiresAt > Date.now()),
        ),
      100,
    );
    return () => clearInterval(timer);
  }, [g.paused, flights.length > 0]);
  const pot = g.players.reduce((n, p) => n + p.total, 0);
  const inFlightPot = flights
    .filter((f) => f.kind === "payout")
    .reduce((sum, f) => sum + f.amount, 0);
  return (
    <>
      <div className="table-topline">
        <span>
          NO LIMIT HOLD’EM <b>·</b> {format(g.settings.small)} /{" "}
          {format(g.settings.big)}
        </span>
        <span>РАЗДАЧА #{String(g.hand).padStart(3, "0")}</span>
      </div>
      <div
        ref={sceneRef}
        className={`table-scene ${g.hand > 0 ? "card-hand" : ""} ${g.paused ? "is-paused" : ""}`}
      >
        <div className="felt">
          <div className="felt-inner">
            <div className="table-wordmark">
              после дейли<span>OFFICE POKER CLUB</span>
            </div>
            <div className="pot">
              <small>ОБЩИЙ БАНК</small>
              <ChipPile amount={pot || inFlightPot} />
              <strong>{format(pot || inFlightPot)}</strong>
            </div>
            <div className="community">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={`${g.hand}-${i}`}
                  className={`board-slot ${g.deal && i >= g.deal.boardFrom && i < presentation.boardFaces ? "board-revealed" : ""}`}
                >
                  <Card
                    card={i < presentation.boardFaces ? g.board[i] : undefined}
                    back={
                      i >= presentation.boardFaces &&
                      i < presentation.boardLanded
                    }
                  />
                </div>
              ))}
            </div>
            <span className="stage">
              {presentation.active
                ? g.deal?.hole
                  ? "Дилер раздаёт карты"
                  : "Открываем борд"
                : stages[g.phase]}
            </span>
          </div>
        </div>
        {locations.map(([x, y], seat) => {
          const p = g.players.find((p) => p.seat === seat);
          const visibleChips = p
            ? Math.max(
                0,
                p.chips -
                  flights
                    .filter(
                      (f) =>
                        f.kind === "payout" &&
                        f.hand === g.hand &&
                        f.seat === seat,
                    )
                    .reduce((sum, f) => sum + f.amount, 0),
              )
            : 0;
          return (
            <div
              key={seat}
              className={`seat seat-${seat} ${p?.id === g.actor ? "acting" : ""} ${p?.folded && inHand ? "folded" : ""} ${p ? "occupied" : ""}`}
              style={
                { "--seat-x": `${x}%`, "--seat-y": `${y}%` } as CSSProperties
              }
            >
              <div className="chair" aria-hidden="true">
                <i />
              </div>
              {p ? (
                <>
                  <div className="seat-cards">
                    {p.cards.length
                      ? p.cards
                          .slice(0, presentation.holeCount(seat))
                          .map((c, i) => <Card key={i} card={c} small />)
                      : inHand && !p.folded
                        ? Array.from(
                            { length: presentation.holeCount(seat) },
                            (_, i) => <Card key={i} back small />,
                          )
                        : null}
                  </div>
                  <div className="player">
                    <span className={`avatar color-${seat}`}>
                      {p.bot ? "🤖" : p.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <b title={p.name}>
                        {p.name}
                        {p.id === g.me ? " · вы" : p.bot ? " · бот" : ""}
                      </b>
                      <span>{format(visibleChips)}</span>
                    </div>
                    {g.dealer === seat && <i className="dealer">D</i>}
                  </div>
                  <div className="player-rack">
                    <ChipPile amount={visibleChips} compact />
                  </div>
                  {inHand && (
                    <span className="seat-info">
                      {p.folded
                        ? "Пас"
                        : visibleChips === 0
                          ? "Олл-ин"
                          : p.id === g.actor
                            ? p.id === g.me
                              ? "Ваш ход"
                              : "Думает…"
                            : p.bet
                              ? `Ставка ${format(p.bet)}`
                              : "В игре"}
                    </span>
                  )}
                </>
              ) : (
                <div className="empty-seat">
                  <span className="seat-number">{seat + 1}</span>
                  <span>Свободно</span>
                  {g.admin && !inHand && (
                    <button
                      className="seat-bot"
                      disabled={busy}
                      aria-label={`Посадить бота на место ${seat + 1}`}
                      onClick={() => send("bot", { seat })}
                    >
                      + Бот
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {g.dealer >= 0 && (
          <div
            className="dealer-deck"
            style={{ left: `${origin[0]}%`, top: `${origin[1]}%` }}
            aria-label={`Колода дилера: ${g.players.find((p) => p.seat === g.dealer)?.name ?? ""}`}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                className="deck-layer"
                key={i}
                style={{
                  transform: `translate(${i * 1.5}px,${-i * 2}px) rotate(-12deg)`,
                }}
              >
                <Card back small />
              </div>
            ))}
            <span>Колода · D</span>
          </div>
        )}
        <div className="card-flights" aria-hidden="true">
          {presentation.flights.map((move) => {
            const anchor =
              anchors[
                move.kind === "hole"
                  ? `seat-${move.seat}`
                  : `board-${move.index}`
              ];
            const target = anchor
              ? [...anchor]
              : move.kind === "hole"
                ? point(move.seat)
                : [50 + (move.index - 2) * 6.3, 58];
            if (move.kind === "hole") {
              if (anchor)
                target[0] +=
                  (((move.index - 0.5) * (compact ? 34 : 41)) /
                    (sceneRef.current?.clientWidth ?? 800)) *
                  100;
              else {
                target[0] += (move.index - 0.5) * 4;
                target[1] -= 11;
              }
            }
            const t = Math.max(
                0,
                Math.min(
                  1,
                  (presentation.clock - move.start) / (move.land - move.start),
                ),
              ),
              ease = 1 - Math.pow(1 - t, 2);
            return (
              <div
                key={move.key}
                className="dealing-card"
                data-deal-to={
                  move.kind === "hole"
                    ? `seat-${move.seat}`
                    : `board-${move.index}`
                }
                style={{
                  left: `${origin[0] + (target[0] - origin[0]) * ease}%`,
                  top: `${origin[1] + (target[1] - origin[1]) * ease - Math.sin(Math.PI * t) * 5}%`,
                  transform: `translate(-50%,-50%) rotate(${-12 + Math.sin(t * Math.PI) * 20}deg)`,
                }}
              >
                <Card back small />
              </div>
            );
          })}
        </div>
        <div className="chip-flights" aria-hidden="true">
          {flights.flatMap((flight) => {
            const seat = locations[flight.seat],
              out = flight.kind === "payout",
              from = out ? [50, 41] : seat,
              to = out ? seat : [50, 41];
            const chips = chipBreakdown(flight.amount)
              .flatMap((s) =>
                Array.from({ length: Math.min(s.count, 3) }, () => s.value),
              )
              .slice(0, 9);
            return chips.map((value, i) => (
              <div
                className={`flying-chip ${out ? "payout-flight" : "bet-flight"}`}
                key={`${flight.id}-${i}`}
                style={
                  {
                    "--from-x": `${from[0]}%`,
                    "--from-y": `${from[1]}%`,
                    "--to-x": `${to[0]}%`,
                    "--to-y": `${to[1]}%`,
                    "--mid-x": `${(from[0] + to[0]) / 2}%`,
                    "--mid-y": `${(from[1] + to[1]) / 2 - 6}%`,
                    animationDelay: `${flight.delay + i * 38}ms`,
                  } as CSSProperties
                }
              >
                <Chip value={value} />
                {i === 0 && (
                  <b className="flight-amount">
                    {out ? "+" : ""}
                    {format(flight.amount)}
                  </b>
                )}
              </div>
            ));
          })}
        </div>
      </div>
      <div className="chip-legend" aria-label="Номиналы фишек">
        {[...denominations].reverse().map((value) => (
          <span key={value}>
            <Chip value={value} />
            <b>{format(value)}</b>
          </span>
        ))}
      </div>
      <div className="table-footer">
        <span>◷ {g.settings.minutes} мин. на ход · без спешки</span>
        <span>Партия сохраняется автоматически</span>
      </div>
    </>
  );
}
