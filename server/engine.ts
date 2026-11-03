import type { Game, Player, View } from "../shared/types.js";
import { deck, evaluate, compare, combinations } from "./poker.js";
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
export function join(g: Game, id: string, name: string) {
  if (g.players.length >= 6) throw Error("За столом уже 6 игроков");
  if (g.players.some((p) => p.id === id)) throw Error("Вы уже за столом");
  const seat = [0, 1, 2, 3, 4, 5].find(
    (s) => !g.players.some((p) => p.seat === s),
  )!;
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
function pay(p: Player, n: number) {
  const v = Math.min(p.chips, n);
  p.chips -= v;
  p.bet += v;
  p.total += v;
}
function turn(g: Game, p: Player, now: number) {
  g.actor = p.id;
  g.deadline = now + g.settings.minutes * 60_000;
}
export function start(g: Game, now = Date.now()) {
  if (running(g)) throw Error("Раздача уже идёт");
  if (g.paused) throw Error("Сначала снимите паузу");
  const players = g.players.filter((p) => p.chips > 0);
  if (players.length < 2) throw Error("Нужны хотя бы два игрока с фишками");
  g.dealer = after(g, g.dealer, players).seat;
  g.deck = deck();
  g.board = [];
  g.result = [];
  g.hand++;
  g.phase = "preflop";
  g.acted = [];
  g.currentBet = g.settings.big;
  g.minRaise = g.settings.big;
  for (const p of g.players) {
    p.cards = p.chips > 0 ? [g.deck.pop()!, g.deck.pop()!] : [];
    p.folded = !p.cards.length;
    p.bet = 0;
    p.total = 0;
  }
  const small =
    players.length === 2
      ? players.find((p) => p.seat === g.dealer)!
      : after(g, g.dealer, players);
  const big = after(g, small.seat, players);
  pay(small, g.settings.small);
  pay(big, g.settings.big);
  log(g, `Раздача #${g.hand} · блайнды ${g.settings.small}/${g.settings.big}`);
  advance(g, big.seat, now);
}
export function settle(g: Game) {
  const candidates = live(g);
  const levels = [
    ...new Set(g.players.map((p) => p.total).filter(Boolean)),
  ].sort((a, b) => a - b);
  let previous = 0;
  const gains = new Map<string, number>();
  for (const level of levels) {
    const pot =
      (level - previous) * g.players.filter((p) => p.total >= level).length;
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
    const label =
      candidates.length > 1
        ? ` · ${combinations[evaluate([...p.cards, ...g.board])[0]]}`
        : "";
    g.result.push(`${p.name} +${n}${label}`);
  }
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
  g.minRaise = g.settings.big;
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
  if (!running(g) || g.actor !== id) throw Error("Сейчас ход другого игрока");
  const p = g.players.find((p) => p.id === id)!;
  const call = Math.max(0, g.currentBet - p.bet);
  if (kind === "fold") {
    p.folded = true;
    log(g, `${p.name}: пас`);
  } else if (kind === "check") {
    if (call) throw Error("Нужно уравнять ставку или сбросить");
    log(g, `${p.name}: чек`);
  } else if (kind === "call") {
    if (!call) throw Error("Ставки нет — можно сделать чек");
    pay(p, call);
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
    const increase = amount! - g.currentBet;
    if (increase < g.minRaise && amount !== p.bet + p.chips)
      throw Error(`Минимум до ${g.currentBet + g.minRaise}`);
    if (!able(g).some((other) => other.id !== id))
      throw Error("Некому отвечать на повышение");
    if (increase >= g.minRaise) {
      g.minRaise = increase;
      g.acted = [];
    }
    pay(p, amount! - p.bet);
    g.currentBet = amount!;
    log(g, `${p.name}: ${p.chips === 0 ? "олл-ин" : "рейз"} до ${amount}`);
  } else throw Error("Неизвестное действие");
  if (!g.acted.includes(id)) g.acted.push(id);
  advance(g, p.seat, now);
}
export function tick(g: Game, now = Date.now()) {
  if (!g.paused && g.deadline && now >= g.deadline && g.actor) {
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
    if (g.actor) g.deadline = now + g.remaining;
  } else {
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
        p.id === id || (g.phase === "showdown" && !p.folded) ? p.cards : [],
    })),
    me: id,
    admin,
    legal: {
      call: p ? Math.min(p.chips, Math.max(0, g.currentBet - p.bet)) : 0,
      min: g.currentBet + g.minRaise,
      max: p ? p.chips + p.bet : 0,
      canRaise:
        !!p &&
        !g.acted.includes(id) &&
        able(g).some((x) => x.id !== id) &&
        p.chips + p.bet > g.currentBet,
    },
  };
}
