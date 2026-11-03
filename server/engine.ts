import type { Game, Player, View } from "../shared/types.js";
import { deck, evaluate, compare, combinations } from "./poker.js";
import { bestFive } from "../shared/poker.js";
import { winningHighlights } from "../shared/winners.js";
import {
  cardMoves,
  dealOrder,
  isDealing,
  CARD_INTERVAL,
  CARD_FLIGHT,
  CARD_FLIP,
  DEAL_LEAD,
} from "../shared/dealing.js";
export function createGame(): Game {
  return {
    players: [],
    deck: [],
    board: [],
    phase: "waiting",
    dealer: -1,
    actor: null,
    currentBet: 0,
    minRaise: 20,
    acted: [],
    deadline: null,
    paused: false,
    remaining: 0,
    hand: 0,
    settings: { small: 10, big: 20, stack: 2000, minutes: 30 },
    log: [],
    result: [],
  };
}
export function log(g: Game, s: string) {
  g.log.unshift(s);
  g.log = g.log.slice(0, 60);
}
export const live = (g: Game) =>
  g.players.filter((p) => p.cards.length && !p.folded);
const able = (g: Game) => live(g).filter((p) => p.chips > 0);
export const running = (g: Game) => !["waiting", "showdown"].includes(g.phase);
export function join(
  g: Game,
  id: string,
  name: string,
  requestedSeat?: number,
) {
  if (g.players.length >= 6) throw Error("За столом уже 6 игроков");
  if (g.players.some((p) => p.id === id)) throw Error("Вы уже за столом");
  if (
    requestedSeat !== undefined &&
    (!Number.isInteger(requestedSeat) ||
      requestedSeat < 0 ||
      requestedSeat > 5 ||
      g.players.some((p) => p.seat === requestedSeat))
  )
    throw Error("Это место недоступно");
  const seat =
    requestedSeat ??
    [0, 1, 2, 3, 4, 5].find((s) => !g.players.some((p) => p.seat === s))!;
  g.players.push({
    id,
    name,
    seat,
    chips: g.settings.stack,
    cards: [],
    folded: running(g),
    bet: 0,
    total: 0,
  });
  g.players.sort((a, b) => a.seat - b.seat);
  log(g, `${name} за столом`);
}
function after(g: Game, seat: number, list: Player[]) {
  return [...list].sort(
    (a, b) => ((a.seat - seat + 5) % 6) - ((b.seat - seat + 5) % 6),
  )[0];
}
function transfer(g: Game, p: Player, amount: number, kind: "bet" | "payout") {
  if (amount <= 0) return;
  g.transferSeq = (g.transferSeq ?? 0) + 1;
  g.transfers = [
    ...(g.transfers ?? []),
    { id: g.transferSeq, hand: g.hand, seat: p.seat, amount, kind },
  ].slice(-60);
}
function pay(g: Game, p: Player, n: number) {
  const v = Math.min(p.chips, n);
  p.chips -= v;
  p.bet += v;
  p.total += v;
  transfer(g, p, v, "bet");
}
function turn(g: Game, p: Player, now: number) {
  g.actor = p.id;
  g.deadline = now + g.settings.minutes * 60_000;
}
function present(g: Game, hole: boolean, boardFrom: number, now: number) {
  if (!g.dealAnimations || (!hole && boardFrom === g.board.length)) return;
  const plan = {
    holeMode: "pairs" as const,
    timing: {
      interval: CARD_INTERVAL,
      flight: CARD_FLIGHT,
      flip: CARD_FLIP,
      lead: DEAL_LEAD,
    },
    id: (g.deal?.id ?? 0) + 1,
    hand: g.hand,
    dealer: g.dealer,
    seats: dealOrder(
      g.players.filter((p) => p.cards.length === 2).map((p) => p.seat),
      g.dealer,
    ),
    hole,
    boardFrom,
    boardTo: g.board.length,
    startedAt: now,
    endsAt: now,
  };
  const moves = cardMoves(plan);
  plan.endsAt = (moves.at(-1)?.flip ?? now) + 180;
  g.deal = plan;
  if (g.actor) g.deadline = plan.endsAt + g.settings.minutes * 60_000;
}
export function start(g: Game, now = Date.now(), animate = false) {
  if (running(g) || isDealing(g, now)) throw Error("Раздача уже идёт");
  if (g.paused) throw Error("Сначала снимите паузу");
  const players = g.players.filter((p) => p.chips > 0 || p.bot);
  if (players.length < 2) throw Error("Нужны хотя бы два игрока с фишками");
  for (const p of players)
    if (p.bot && p.chips === 0) {
      p.chips = g.settings.stack;
      log(g, `${p.name}: новый стек ${g.settings.stack} (автопополнение)`);
    }
  g.dealAnimations = animate;
  g.dealer = after(g, g.dealer, players).seat;
  g.deck = deck();
  g.board = [];
  g.result = [];
  g.hand++;
  g.phase = "preflop";
  g.acted = [];
  g.currentBet = g.settings.big;
  g.minRaise = Math.max(g.settings.big, g.settings.step ?? 1);
  for (const p of g.players) {
    p.cards = [];
    delete p.lastAction;
    p.folded = p.chips === 0;
    p.bet = 0;
    p.total = 0;
  }
  const order = dealOrder(
    players.map((p) => p.seat),
    g.dealer,
  );
  for (const seat of order)
    g.players
      .find((p) => p.seat === seat)!
      .cards.push(g.deck.pop()!, g.deck.pop()!);
  const small =
    players.length === 2
      ? players.find((p) => p.seat === g.dealer)!
      : after(g, g.dealer, players);
  const big = after(g, small.seat, players);
  pay(g, small, g.settings.small);
  pay(g, big, g.settings.big);
  log(g, `Раздача #${g.hand} · блайнды ${g.settings.small}/${g.settings.big}`);
  advance(g, big.seat, now);
  present(g, true, 0, now);
}
export function settle(g: Game) {
  const candidates = live(g);
  const levels = [
    ...new Set(g.players.map((p) => p.total).filter(Boolean)),
  ].sort((a, b) => a - b);
  let previous = 0;
  const gains = new Map<string, number>();
  const winningIds = new Set<string>();
  for (const level of levels) {
    const contributors = g.players.filter((p) => p.total >= level);
    const pot = (level - previous) * contributors.length;
    previous = level;
    let eligible =
      candidates.length === 1
        ? candidates
        : candidates.filter((p) => p.total >= level);
    if (!eligible.length) throw Error("Invalid pot");
    if (candidates.length > 1) {
      const scores = eligible.map((p) => ({
        p,
        score: evaluate([...p.cards, ...g.board]),
      }));
      scores.sort((a, b) => compare(b.score, a.score));
      eligible = scores
        .filter((s) => compare(s.score, scores[0].score) === 0)
        .map((s) => s.p);
    }
    if (contributors.length > 1) for (const p of eligible) winningIds.add(p.id);
    eligible.sort(
      (a, b) => ((a.seat - g.dealer + 5) % 6) - ((b.seat - g.dealer + 5) % 6),
    );
    const share = Math.floor(pot / eligible.length);
    let extra = pot % eligible.length;
    for (const p of eligible)
      gains.set(p.id, (gains.get(p.id) ?? 0) + share + (extra-- > 0 ? 1 : 0));
  }
  g.result = [];
  for (const [id, n] of gains) {
    const p = g.players.find((p) => p.id === id)!;
    p.chips += n;
    transfer(g, p, n, "payout");
    const score =
      candidates.length > 1 ? evaluate([...p.cards, ...g.board]) : null;
    const label = score
      ? ` · ${score[0] === 8 && score[1] === 14 ? "Роял-флеш" : combinations[score[0]]}`
      : "";
    g.result.push(
      winningIds.has(id)
        ? `${p.name} +${n}${label}`
        : `${p.name}: возврат ${n}`,
    );
  }
  const byFold = candidates.length === 1;
  g.lastResult = {
    hand: g.hand,
    byFold,
    previousWinnerIds: g.lastResult?.winners.map((w) => w.id) ?? [],
    winners: [...winningIds].map((id) => {
      const p = g.players.find((p) => p.id === id)!;
      const best = byFold ? null : bestFive([...p.cards, ...g.board]);
      const highlights = winningHighlights(best?.cards ?? [], g.board, p.cards);
      return {
        id: p.id,
        name: p.name,
        seat: p.seat,
        amount: gains.get(id) ?? 0,
        combination: best
          ? best.score[0] === 8 && best.score[1] === 14
            ? "Роял-флеш"
            : combinations[best.score[0]]
          : null,
        cards: best?.cards ?? [],
        ...highlights,
      };
    }),
  };
  g.result.forEach((s) => log(g, s));
  g.phase = "showdown";
  g.actor = null;
  g.deadline = null;
  g.currentBet = 0;
  g.players.forEach((p) => {
    p.bet = 0;
    p.total = 0;
  });
}
function advance(g: Game, seat: number, now: number) {
  if (live(g).length === 1) {
    settle(g);
    return;
  }
  const pending = able(g).filter(
    (p) => !g.acted.includes(p.id) || p.bet < g.currentBet,
  );
  if (able(g).length <= 1 && able(g).every((p) => p.bet >= g.currentBet)) {
    while (g.board.length < 5) g.board.push(g.deck.pop()!);
    settle(g);
    return;
  }
  if (pending.length) {
    turn(g, after(g, seat, pending), now);
    return;
  }
  if (g.phase === "river") {
    settle(g);
    return;
  }
  const count = g.phase === "preflop" ? 3 : 1;
  for (let i = 0; i < count; i++) g.board.push(g.deck.pop()!);
  g.phase =
    g.phase === "preflop" ? "flop" : g.phase === "flop" ? "turn" : "river";
  g.currentBet = 0;
  g.minRaise = Math.max(g.settings.big, g.settings.step ?? 1);
  g.acted = [];
  g.players.forEach((p) => (p.bet = 0));
  log(
    g,
    `Открыт ${g.phase === "flop" ? "флоп" : g.phase === "turn" ? "тёрн" : "ривер"}`,
  );
  advance(g, g.dealer, now);
}
export function action(
  g: Game,
  id: string,
  kind: string,
  amount?: number,
  now = Date.now(),
) {
  if (g.paused) throw Error("Игра на паузе");
  if (isDealing(g, now)) throw Error("Дождитесь завершения раздачи карт");
  const boardFrom = g.board.length;
  if (!running(g) || g.actor !== id) throw Error("Сейчас ход другого игрока");
  const p = g.players.find((p) => p.id === id)!;
  const call = Math.min(p.chips, Math.max(0, g.currentBet - p.bet));
  if (kind === "fold") {
    p.folded = true;
    log(g, `${p.name}: пас`);
  } else if (kind === "check") {
    if (call) throw Error("Нужно уравнять ставку или сбросить");
    g.checkSeq = (g.checkSeq ?? 0) + 1;
    g.checks = [
      ...(g.checks ?? []),
      { id: g.checkSeq, hand: g.hand, seat: p.seat },
    ].slice(-32);
    log(g, `${p.name}: чек`);
  } else if (kind === "call") {
    if (!call) throw Error("Ставки нет — можно сделать чек");
    pay(g, p, call);
    log(g, `${p.name}: колл ${p.bet}`);
  } else if (kind === "raise") {
    if (g.acted.includes(id))
      throw Error("Короткий олл-ин не открывает повторное повышение");
    if (
      !Number.isSafeInteger(amount) ||
      amount! > p.bet + p.chips ||
      amount! <= g.currentBet
    )
      throw Error("Некорректная ставка");
    if (amount !== p.bet + p.chips && amount! % (g.settings.step ?? 1) !== 0)
      throw Error(`Ставка должна быть кратна ${g.settings.step ?? 1}`);
    const increase = amount! - g.currentBet;
    if (increase < g.minRaise && amount !== p.bet + p.chips)
      throw Error(`Минимум до ${g.currentBet + g.minRaise}`);
    if (!able(g).some((other) => other.id !== id))
      throw Error("Некому отвечать на повышение");
    if (increase >= g.minRaise) {
      g.minRaise = increase;
      g.acted = [];
    }
    pay(g, p, amount! - p.bet);
    g.currentBet = amount!;
    log(g, `${p.name}: ${p.chips === 0 ? "олл-ин" : "рейз"} до ${amount}`);
  } else throw Error("Неизвестное действие");
  p.lastAction = {
    kind: kind as "fold" | "check" | "call" | "raise",
    hand: g.hand,
    ...(kind === "call"
      ? { amount: call }
      : kind === "raise"
        ? { amount: p.bet }
        : {}),
  };
  if (!g.acted.includes(id)) g.acted.push(id);
  advance(g, p.seat, now);
  present(g, false, boardFrom, now);
}
export function tick(g: Game, now = Date.now()) {
  if (
    !g.paused &&
    !isDealing(g, now) &&
    g.deadline &&
    now >= g.deadline &&
    g.actor
  ) {
    const p = g.players.find((p) => p.id === g.actor)!;
    log(g, `${p.name}: время вышло`);
    action(g, p.id, p.bet >= g.currentBet ? "check" : "fold", undefined, now);
    return true;
  }
  return false;
}
export function pause(g: Game, now = Date.now()) {
  if (g.paused) {
    g.paused = false;
    if (g.deal?.pausedAt !== undefined) {
      const shift = now - g.deal.pausedAt;
      g.deal.startedAt += shift;
      g.deal.endsAt += shift;
      delete g.deal.pausedAt;
    }
    if (g.actor) g.deadline = now + g.remaining;
  } else {
    if (isDealing(g, now) && g.deal) g.deal.pausedAt = now;
    g.remaining = g.deadline ? Math.max(0, g.deadline - now) : 0;
    g.paused = true;
    g.deadline = null;
  }
  log(g, g.paused ? "Игра на паузе" : "Игра продолжена");
}
export function view(g: Game, id: string, admin: boolean): View {
  const { deck: _, ...rest } = g;
  const p = g.players.find((p) => p.id === id);
  return {
    ...structuredClone(rest),
    players: g.players.map((p) => ({
      ...p,
      cards:
        !p.folded &&
        (p.id === id || (g.phase === "showdown" && !g.lastResult?.byFold))
          ? p.cards
          : [],
    })),
    me: id,
    admin,
    legal: {
      call: p ? Math.min(p.chips, Math.max(0, g.currentBet - p.bet)) : 0,
      min:
        Math.ceil((g.currentBet + g.minRaise) / (g.settings.step ?? 1)) *
        (g.settings.step ?? 1),
      max: p ? p.chips + p.bet : 0,
      canRaise:
        !!p &&
        !g.acted.includes(id) &&
        able(g).some((x) => x.id !== id) &&
        p.chips + p.bet > g.currentBet,
    },
  };
}
