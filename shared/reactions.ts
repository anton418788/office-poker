export const tableReactions = [
  { id: "smile", emoji: "😊", name: "Улыбка" },
  { id: "laugh", emoji: "😂", name: "Смех" },
  { id: "cool", emoji: "😎", name: "Круто" },
  { id: "wow", emoji: "😮", name: "Удивление" },
  { id: "sad", emoji: "😭", name: "Слёзы" },
  { id: "tilt", emoji: "😤", name: "Тильт" },
  { id: "applause", emoji: "👏", name: "Аплодисменты" },
  { id: "fire", emoji: "🔥", name: "Огонь" },
  { id: "thanks", emoji: "🤝", name: "Спасибо за игру" },
  { id: "heart", emoji: "❤️", name: "Сердце" },
] as const;
export type ReactionId = (typeof tableReactions)[number]["id"];
export type TableReaction = {
  id: string;
  playerId: string;
  reaction: ReactionId;
  createdAt: number;
  expiresAt: number;
};
export const REACTION_DURATION = 4600;
export const REACTION_COOLDOWN = 2000;
