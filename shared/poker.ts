import type { Card } from "./types.js";
function five(cards: Card[]): number[] {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const groups = [...new Set(ranks)]
    .map((r) => ({ r, n: ranks.filter((x) => x === r).length }))
    .sort((a, b) => b.n - a.n || b.r - a.r);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const unique = [...new Set(ranks)];
  if (unique[0] === 14) unique.push(1);
  let straight = 0;
  for (let i = 0; i + 4 < unique.length; i++)
    if (unique[i] - unique[i + 4] === 4) {
      straight = unique[i];
      break;
    }
  if (flush && straight) return [8, straight];
  if (groups[0].n === 4) return [7, groups[0].r, groups[1].r];
  if (groups[0].n === 3 && groups[1].n === 2)
    return [6, groups[0].r, groups[1].r];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (groups[0].n === 3) return [3, ...groups.map((g) => g.r)];
  if (groups[0].n === 2 && groups[1].n === 2)
    return [2, ...groups.map((g) => g.r)];
  if (groups[0].n === 2) return [1, ...groups.map((g) => g.r)];
  return [0, ...ranks];
}
export function compare(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
export function evaluate(cards: Card[]) {
  let best: number[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const score = five([
              cards[a],
              cards[b],
              cards[c],
              cards[d],
              cards[e],
            ]);
            if (compare(score, best) > 0) best = score;
          }
  return best;
}
export const combinations = [
  "Старшая карта",
  "Пара",
  "Две пары",
  "Тройка",
  "Стрит",
  "Флеш",
  "Фулл-хаус",
  "Каре",
  "Стрит-флеш",
];

/** Return the actual five-card hand for showdown, including its kickers. */
export function bestFive(cards: Card[]): { cards: Card[]; score: number[] } {
  let best: Card[] = [],
    score: number[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const hand = [cards[a], cards[b], cards[c], cards[d], cards[e]],
              value = five(hand);
            if (compare(value, score) > 0) {
              best = hand;
              score = value;
            }
          }
  return { cards: best, score };
}
