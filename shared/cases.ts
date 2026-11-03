import {
  cosmeticItems,
  type CosmeticItem,
  type CosmeticSlot,
  type CosmeticRarity,
} from "./cosmetics";
export const CASE_PRICE = 500;
export const CASE_ROLL_SIZE = 10_000;
export const caseRarityRules = {
  rare: { weight: 1500, compensation: 50 },
  epic: { weight: 500, compensation: 250 },
  exclusive: { weight: 100, compensation: 500 },
} as const;
export const shopCases = [
  {
    id: "chairs",
    name: "Кейс сидушек",
    slot: "chair" as CosmeticSlot,
    description: "Новый характер для вашего места за столом.",
  },
  {
    id: "decks",
    name: "Кейс рубашек",
    slot: "deck" as CosmeticSlot,
    description: "Ваша колода — настроение всей раздачи.",
  },
];
export type CaseId = "chairs" | "decks";
export type CaseOutcome = { item: CosmeticItem | null; weight: number };
export type CaseOpening = {
  id: string;
  caseId: CaseId;
  itemId: string | null;
  rarity: CosmeticRarity | null;
  duplicate: boolean;
  compensation: number;
  cost: number;
  balanceAfter: number;
  openedAt: number;
};
export function shopCase(id: unknown) {
  return shopCases.find((c) => c.id === id);
}
export function caseContents(id: unknown): CaseOutcome[] {
  const definition = shopCase(id);
  if (!definition) throw Error("Кейс не найден");
  const drops = cosmeticItems
    .filter((item) => item.slot === definition.slot && item.rarity !== "common")
    .map((item) => ({
      item,
      weight:
        caseRarityRules[item.rarity as keyof typeof caseRarityRules].weight,
    }));
  const empty =
    CASE_ROLL_SIZE - drops.reduce((sum, drop) => sum + drop.weight, 0);
  if (empty < 0) throw Error("Сумма шансов кейса превышает 100%");
  return [{ item: null, weight: empty }, ...drops];
}
export function drawCase(id: unknown, roll: number): CosmeticItem | null {
  if (!Number.isInteger(roll) || roll < 0 || roll >= CASE_ROLL_SIZE)
    throw Error("Некорректное случайное значение");
  let limit = 0;
  for (const outcome of caseContents(id)) {
    limit += outcome.weight;
    if (roll < limit) return outcome.item;
  }
  throw Error("Некорректное содержимое кейса");
}
export function duplicateCompensation(item: CosmeticItem) {
  return item.rarity === "common"
    ? 0
    : caseRarityRules[item.rarity].compensation;
}
// Crossing times for the compositor's cubic-bezier(.12,.68,.12,1) reel.
export function reelTickTimes(
  travel: number,
  center: number,
  tileWidth: number,
  stride: number,
  count: number,
  duration: number,
) {
  const bezier = (t: number, p1: number, p2: number) =>
    3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  return Array.from(
    { length: count },
    (_, i) => i * stride + tileWidth / 2 - center,
  )
    .filter((distance) => distance > 0 && distance <= travel)
    .map((distance) => {
      let low = 0,
        high = 1;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        if (bezier(mid, 0.68, 1) < distance / travel) low = mid;
        else high = mid;
      }
      return bezier((low + high) / 2, 0.12, 0.12) * duration;
    });
}
