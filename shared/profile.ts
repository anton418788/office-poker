import type { CosmeticRarity } from "./cosmetics.js";

export const profileCombinations = [
  { id: "royal-flush", name: "Роял-флеш", rarity: "exclusive" },
  { id: "straight-flush", name: "Стрит-флеш", rarity: "exclusive" },
  { id: "four-kind", name: "Каре", rarity: "epic" },
  { id: "full-house", name: "Фулл-хаус", rarity: "epic" },
  { id: "flush", name: "Флеш", rarity: "rare" },
  { id: "straight", name: "Стрит", rarity: "rare" },
  { id: "three-kind", name: "Тройка", rarity: null },
  { id: "two-pair", name: "Две пары", rarity: null },
  { id: "pair", name: "Пара", rarity: null },
  { id: "high-card", name: "Старшая карта", rarity: null },
] as const;
export type HandCombination = (typeof profileCombinations)[number]["id"];
export type GiftRarity = "rare" | "epic" | "exclusive";
export const giftCompensation = {
  rare: 500,
  epic: 1000,
  exclusive: 5000,
} as const;
export function combinationFromScore(score: number[]): HandCombination {
  if (score[0] === 8 && score[1] === 14) return "royal-flush";
  return (
    [
      "high-card",
      "pair",
      "two-pair",
      "three-kind",
      "straight",
      "flush",
      "full-house",
      "four-kind",
      "straight-flush",
    ] as const
  )[score[0]];
}
export type ProfileGift = {
  id: string;
  rarity: GiftRarity;
  combination: HandCombination;
  createdAt: number;
  openedAt: number | null;
  itemId: string | null;
  compensation: number;
};
export type PlayerProfile = {
  hands: number;
  wins: number;
  showdowns: number;
  combinations: Partial<Record<HandCombination, number>>;
  collection: Record<CosmeticRarity, number>;
  gifts: ProfileGift[];
  recentRewards: ProfileGift[];
  giftSequence: number;
};
export type PublicPlayerProfile = Pick<
  PlayerProfile,
  "hands" | "wins" | "showdowns" | "combinations" | "collection"
> & {
  player: { id: string; name: string; balance: number; admin: boolean };
};
