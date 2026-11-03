import type { Card } from "./types.js";
import { evaluate } from "./poker.js";
export const handNames = [
  "Старшая карта",
  "Пара",
  "Две пары",
  "Тройка",
  "Стрит",
  "Флеш",
  "Фулл-хаус",
  "Каре",
  "Стрит-флеш",
  "Роял-флеш",
];
export type HandOdds = {
  probabilities: number[];
  exact: boolean;
  samples: number;
  current: number | null;
};
export function category(cards: Card[]): number {
  const score = evaluate(cards);
  return score[0] === 8 && score[1] === 14 ? 9 : score[0];
}
export function calculateOdds(
  hole: Card[],
  board: Card[],
  sampleCount = 16000,
): HandOdds {
  if (hole.length !== 2 || ![0, 3, 4, 5].includes(board.length))
    throw Error("Нужны две карты игрока и корректный борд");
  const known = [...hole, ...board],
    keys = known.map((c) => `${c.rank}${c.suit}`);
  if (new Set(keys).size !== known.length) throw Error("Повторяющиеся карты");
  const pool: Card[] = [];
  for (const suit of ["s", "h", "d", "c"] as const)
    for (let rank = 2; rank <= 14; rank++)
      if (!keys.includes(`${rank}${suit}`)) pool.push({ rank, suit });
  const counts = Array<number>(10).fill(0);
  let samples = 0;
  const record = (extra: Card[]) => {
    counts[category([...known, ...extra])]++;
    samples++;
  };
  if (board.length === 5) record([]);
  else if (board.length === 4) for (const c of pool) record([c]);
  else if (board.length === 3)
    for (let a = 0; a < pool.length - 1; a++)
      for (let b = a + 1; b < pool.length; b++) record([pool[a], pool[b]]);
  else {
    // Stable seed keeps the estimate unchanged when the same hand is reopened.
    let seed =
      keys
        .slice()
        .sort()
        .join("")
        .split("")
        .reduce((v, c) => Math.imul(v, 31) + c.charCodeAt(0), 19) >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let sample = 0; sample < sampleCount; sample++) {
      const indexes = new Set<number>();
      while (indexes.size < 5) indexes.add(Math.floor(random() * pool.length));
      record([...indexes].map((i) => pool[i]));
    }
  }
  return {
    probabilities: counts.map((n) => (n / samples) * 100),
    exact: board.length > 0,
    samples,
    current: known.length >= 5 ? category(known) : null,
  };
}
