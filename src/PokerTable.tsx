import { ParticipantMenu } from "./ParticipantMenu";
import {
  tableLocations,
  seatAtView,
  seatPoint,
  accessoryPoint,
} from "../shared/table-layout";
import { potAmount } from "../shared/pot";
import {
  normalizeAppearance,
  defaultAppearance,
  cosmeticItem,
} from "../shared/cosmetics";
import { AccessoryArt } from "./AccessoryArt";
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
import { WinnerCrown } from "./WinnerCrown";
import { crownWinners, winningHighlights } from "../shared/winners";
import { CardFlight } from "./CardFlight";
import { Chip, ChipPile } from "./ChipPile";
import type { useDealPresentation } from "./useDealPresentation";
const format = (n: number) => n.toLocaleString("ru-RU");
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
  participantBusy = busy,
  send,
  presentation,
}: {
  presentation: ReturnType<typeof useDealPresentation>;
  game: View;
  busy: boolean;
  participantBusy?: boolean;
  send: (command: string, body?: object) => Promise<void>;
}) {
  const previous = useRef<number | null>(null),
    [flights, setFlights] = useState<Flight[]>([]),
    pausedAt = useRef<number | null>(null);
  const inHand =
    !["waiting", "showdown"].includes(g.phase) || presentation.active;
  const cardBack = g.cardBack ?? defaultAppearance.deck;
  const viewerSeat = g.players.find((p) => p.id === g.me)?.seat;
  const canSit = viewerSeat === undefined;
  const sceneRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => window.innerWidth <= 680);
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 });
  const [anchors, setAnchors] = useState<Record<string, [number, number]>>({});
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      const bounds = scene.getBoundingClientRect(),
        parent = scene.parentElement!.getBoundingClientRect();
      setCompact(parent.width <= 650);
      setSceneSize((previous) =>
        previous.width === bounds.width && previous.height === bounds.height
          ? previous
          : { width: bounds.width, height: bounds.height },
      );
      const next: Record<string, [number, number]> = {};
      scene.querySelectorAll(".seat-cards,.board-slot").forEach((el) => {
        const rect = el.getBoundingClientRect(),
          seat = el.closest(".seat");
        const key = seat
          ? `seat-${seat.getAttribute("data-seat")}`
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
  }, [g.hand, g.deal?.id, g.transferSeq, viewerSeat]);
  const point = (seat: number) => seatPoint(seat, viewerSeat, compact);
  const dealer = point(g.dealer),
    origin = [
      dealer[0] < 50
        ? dealer[0] + 15
        : dealer[0] > 50
          ? dealer[0] - 15
          : dealer[0] + (dealer[1] > 50 ? 16 : 11),
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
      return;
    }
    if (!flights.length) return;
    const expires = Math.min(...flights.map((f) => f.expiresAt));
    const timer = setTimeout(
      () =>
        setFlights((current) =>
          current.filter((f) => f.expiresAt > Date.now()),
        ),
      Math.max(1, expires - Date.now() + 1),
    );
    return () => clearTimeout(timer);
  }, [g.paused, flights]);
  const pot = potAmount(g);
  const crowns = crownWinners(g, presentation.active);
  const shownResult =
    g.phase === "showdown" &&
    !presentation.active &&
    g.lastResult?.hand === g.hand
      ? g.lastResult
      : null;
  const highlights = new Map(
    (shownResult?.winners ?? []).map((w) => [
      w.id,
      winningHighlights(
        w.cards,
        g.board,
        g.players.find((p) => p.id === w.id)?.cards ?? [],
      ),
    ]),
  );
  const winningBoard = new Set(
    [...highlights.values()].flatMap((h) => h.boardIndexes),
  );
  const summaries = new Map<string, string[]>();
  for (const winner of shownResult?.winners ?? []) {
    const label = winner.combination ?? "Победа без вскрытия";
    summaries.set(label, [...(summaries.get(label) ?? []), winner.name]);
  }
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
        className={`table-scene ${g.hand > 0 ? "card-hand" : ""} ${g.paused ? "is-paused" : ""} ${shownResult ? "has-showdown" : ""}`}
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
                  className={`board-slot ${winningBoard.has(i) ? "winning-board-card" : ""} ${g.deal && i >= g.deal.boardFrom && i < presentation.boardFaces ? "board-revealed" : ""}`}
                >
                  <Card
                    skin={cardBack}
                    card={i < presentation.boardFaces ? g.board[i] : undefined}
                    back={
                      i >= presentation.boardFaces &&
                      i < presentation.boardLanded
                    }
                  />
                </div>
              ))}
            </div>
            {shownResult && shownResult.winners.length > 0 ? (
              <div
                className="showdown-caption"
                role="status"
                aria-label="Выигрышная комбинация"
              >
                {[...summaries].map(([label, names]) => (
                  <div className="winner-line" key={label}>
                    <strong>{label}</strong>
                    <span>{names.join(" · ")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="stage">
                {presentation.active
                  ? g.deal?.hole
                    ? "Дилер раздаёт карты"
                    : "Открываем борд"
                  : stages[g.phase]}
              </span>
            )}
          </div>
        </div>
        {g.players.map((p) => {
          const item = cosmeticItem(p.appearance?.accessory, "accessory");
          if (!item) return null;
          const [x, y] = accessoryPoint(p.seat, viewerSeat);
          return (
            <div
              key={p.id}
              className="table-accessory"
              role="img"
              aria-label={`${p.name}: ${item.name}`}
              data-owner={p.id}
              data-accessory={item.id}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <AccessoryArt itemId={item.id} />
            </div>
          );
        })}
        {tableLocations.map((_location, position) => {
          const seat = seatAtView(position, viewerSeat);
          const [x, y] = point(seat);
          const p = g.players.find((p) => p.seat === seat);
          const winningHole =
            (p ? highlights.get(p.id)?.holeIndexes : []) ?? [];
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
              data-seat={seat}
              data-view-seat={position}
              className={`seat seat-${position} ${p?.id === g.actor ? "acting" : ""} ${p?.folded && inHand ? "folded" : ""} ${p ? "occupied" : ""}`}
              style={
                { "--seat-x": `${x}%`, "--seat-y": `${y}%` } as CSSProperties
              }
            >
              <div
                className="chair"
                data-chair={normalizeAppearance(p?.appearance).chair}
                aria-hidden="true"
              >
                <i />
              </div>
              {p ? (
                <>
                  <div className="seat-cards">
                    {p.folded &&
                    p.lastAction?.kind === "fold" &&
                    p.lastAction.hand === g.hand ? (
                      <div
                        className="discarded-cards"
                        aria-label={`Сброшенные карты: ${p.name}`}
                      >
                        <Card back small skin={cardBack} />
                        <Card back small skin={cardBack} />
                      </div>
                    ) : p.cards.length ? (
                      p.cards
                        .slice(0, presentation.holeCount(seat))
                        .map((c, i) => (
                          <div
                            key={i}
                            className={`pocket-slot ${winningHole.includes(i) ? "winning-pocket-card" : ""}`}
                          >
                            <Card card={c} small />
                          </div>
                        ))
                    ) : inHand && !p.folded ? (
                      Array.from(
                        { length: presentation.holeCount(seat) },
                        (_, i) => <Card key={i} back small skin={cardBack} />,
                      )
                    ) : null}
                  </div>
                  <div className="player">
                    <ParticipantMenu
                      name={p.name}
                      playerId={p.id}
                      self={p.id === g.me}
                      canManage={!!g.canManage}
                      busy={participantBusy}
                      align={position >= 4 ? "end" : "start"}
                      onKick={async () => {
                        await send("kick", { id: p.id });
                      }}
                    />
                    <span className={`avatar color-${seat}`}>
                      {p.bot ? "🤖" : p.name.slice(0, 1).toUpperCase()}
                      {crowns.includes(p.id) && <WinnerCrown />}
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
                  {p.lastAction?.hand === g.hand && (
                    <span
                      className={`player-action action-${p.lastAction.kind}`}
                      aria-label={`Действие ${p.name}`}
                    >
                      {
                        {
                          fold: "Фолд",
                          check: "Чек",
                          call: "Колл",
                          raise: "Рейз",
                        }[p.lastAction.kind]
                      }
                      {p.lastAction.amount !== undefined
                        ? ` ${format(p.lastAction.amount)}`
                        : ""}
                      {p.chips === 0 &&
                      ["call", "raise"].includes(p.lastAction.kind)
                        ? " · олл-ин"
                        : ""}
                    </span>
                  )}
                  <div className="player-rack">
                    <ChipPile amount={visibleChips} compact />
                  </div>
                  {inHand &&
                    (p.id === g.actor || p.lastAction?.hand !== g.hand) && (
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
                  {canSit && (
                    <button
                      className="seat-bot seat-join"
                      disabled={busy}
                      aria-label={`Сесть за стол на место ${seat + 1}`}
                      onClick={() => send("join", { seat })}
                    >
                      Сесть за стол
                    </button>
                  )}
                  {g.canManage && !inHand && !canSit && (
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
                <Card back small skin={cardBack} />
              </div>
            ))}
            <span>Колода · D</span>
          </div>
        )}
        <div className="card-flights" aria-hidden="true">
          {presentation.flights
            .filter(
              (move) =>
                move.kind !== "hole" ||
                g.players.some((p) => p.seat === move.seat && !p.folded),
            )
            .map((move) => {
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
                      (sceneSize.width || 800)) *
                    100;
                else {
                  target[0] += (move.index - 0.5) * 4;
                  target[1] -= 11;
                }
              }
              return (
                <CardFlight
                  key={move.key}
                  move={move}
                  cardBack={cardBack}
                  from={origin}
                  to={target}
                  width={sceneSize.width}
                  height={sceneSize.height}
                  pausedAt={
                    g.paused ? (g.deal?.pausedAt ?? Date.now()) : undefined
                  }
                />
              );
            })}
        </div>
        <div className="chip-flights" aria-hidden="true">
          {flights.flatMap((flight) => {
            const seat = point(flight.seat),
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
