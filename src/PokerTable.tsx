import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChipTransfer, View } from "../shared/types";
import { denominations, chipBreakdown } from "../shared/chips";
import { Card } from "./Card";
import { Chip, ChipPile } from "./ChipPile";
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
type Flight = ChipTransfer & { delay: number };
export function PokerTable({
  game: g,
  busy,
  send,
}: {
  game: View;
  busy: boolean;
  send: (command: string, body?: object) => Promise<void>;
}) {
  const previous = useRef<number | null>(null),
    [flights, setFlights] = useState<Flight[]>([]),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inHand = !["waiting", "showdown"].includes(g.phase);
  useEffect(() => {
    if (previous.current === null) {
      previous.current = g.transferSeq ?? 0;
      return;
    }
    const fresh = (g.transfers ?? []).filter((t) => t.id > previous.current!);
    previous.current = g.transferSeq ?? 0;
    if (!fresh.length) return;
    setFlights((current) => [
      ...current,
      ...fresh.map((t, i) => ({ ...t, delay: i * 70 })),
    ]);
    const timer = setTimeout(
      () => {
        const ids = new Set(fresh.map((t) => t.id));
        setFlights((current) => current.filter((t) => !ids.has(t.id)));
        timers.current = timers.current.filter((t) => t !== timer);
      },
      1500 + fresh.length * 70,
    );
    timers.current.push(timer);
  }, [g.transferSeq]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
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
      <div className="table-scene">
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
                <Card key={i} card={g.board[i]} />
              ))}
            </div>
            <span className="stage">{stages[g.phase]}</span>
          </div>
        </div>
        {locations.map(([x, y], seat) => {
          const p = g.players.find((p) => p.seat === seat);
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
                    {p.cards.length ? (
                      p.cards.map((c, i) => <Card key={i} card={c} small />)
                    ) : inHand && !p.folded ? (
                      <>
                        <Card back small />
                        <Card back small />
                      </>
                    ) : null}
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
                      <span>{format(p.chips)}</span>
                    </div>
                    {g.dealer === seat && <i className="dealer">D</i>}
                  </div>
                  <div className="player-rack">
                    <ChipPile amount={p.chips} compact />
                  </div>
                  {inHand && (
                    <span className="seat-info">
                      {p.folded
                        ? "Пас"
                        : p.chips === 0
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
