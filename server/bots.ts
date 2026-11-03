import { randomUUID } from "node:crypto";
import { isDealing } from "../shared/dealing.js";
import type { Card, Game, View } from "../shared/types.js";
import { action, join, running, tick, view } from "./engine.js";
import { compare, evaluate } from "./poker.js";

export const BOT_DELAY = 3000;
const names = [
  "Кофеман",
  "Дедлайн",
  "Скрам-мастер",
  "Печенька",
  "Автопилот",
  "Релиз",
];
export function addBot(g: Game, seat: number) {
  if (running(g)) throw Error("Ботов можно сажать между раздачами");
  if (!Number.isInteger(seat) || seat < 0 || seat > 5)
    throw Error("Выберите место от 1 до 6");
  const id = `bot-${randomUUID()}`;
  join(g, id, names[seat], seat);
  g.players.find((p) => p.id === id)!.bot = true;
}

// The strategy receives the bot's own public view, never the server's deck or opponents' cards.
export function equity(v: View, random = Math.random, samples = 72): number {
  const me = v.players.find((p) => p.id === v.me)!;
  const opponents = v.players.filter((p) => p.id !== me.id && !p.folded).length;
  const known = [...me.cards, ...v.board];
  const unseen: Card[] = [];
  for (const suit of ["s", "h", "d", "c"] as const)
    for (let rank = 2; rank <= 14; rank++)
      if (!known.some((c) => c.rank === rank && c.suit === suit))
        unseen.push({ rank, suit });
  let wins = 0;
  for (let sample = 0; sample < samples; sample++) {
    const pool = [...unseen];
    const draw = () => pool.splice(Math.floor(random() * pool.length), 1)[0];
    const board = [...v.board];
    while (board.length < 5) board.push(draw());
    const own = evaluate([...me.cards, ...board]);
    let ties = 1,
      lost = false;
    for (let i = 0; i < opponents; i++) {
      const score = evaluate([draw(), draw(), ...board]);
      const result = compare(own, score);
      if (result < 0) lost = true;
      if (result === 0) ties++;
    }
    if (!lost) wins += 1 / ties;
  }
  return wins / samples;
}

export function decide(
  v: View,
  random = Math.random,
): { kind: "check" | "call" | "fold" | "raise"; amount?: number } {
  const chance = equity(v, random);
  const pot = v.players.reduce((sum, p) => sum + p.total, 0);
  const odds = v.legal.call / Math.max(1, pot + v.legal.call);
  if (v.legal.call > 0 && chance + 0.06 < odds && random() > 0.08)
    return { kind: "fold" };
  if (v.legal.canRaise && chance > 0.58 && random() < 0.65) {
    const target = Math.max(
      v.legal.min,
      v.currentBet + Math.max(v.settings.big, Math.round(pot * 0.55)),
    );
    const step = v.settings.step ?? 1;
    return {
      kind: "raise",
      amount: Math.min(v.legal.max, Math.ceil(target / step) * step),
    };
  }
  return { kind: v.legal.call ? "call" : "check" };
}

// One move per tick keeps the table readable and stops immediately on a human turn.
export function step(g: Game, now = Date.now(), random = Math.random): boolean {
  if (g.paused || !running(g) || isDealing(g, now)) return false;
  if (tick(g, now)) return true;
  const bot = g.players.find((p) => p.id === g.actor && p.bot);
  if (!bot || !g.deadline) return false;
  const elapsed = g.settings.minutes * 60_000 - (g.deadline - now);
  if (elapsed < BOT_DELAY) return false;
  const move = decide(view(g, bot.id, false), random);
  action(g, bot.id, move.kind, move.amount, now);
  return true;
}
