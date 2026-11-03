export type CosmeticSlot = "chair" | "deck";
export type Appearance = { chair: string; deck: string };
export type Inventory = { owned: string[]; equipped: Appearance };
export type CosmeticItem = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
};
export const defaultAppearance: Appearance = {
  chair: "chair-classic",
  deck: "deck-classic",
};
export const cosmeticItems: CosmeticItem[] = [
  {
    id: "chair-classic",
    slot: "chair",
    name: "Классика",
    description: "Привычное кресло клуба. Спокойные оттенки и гладкая обивка.",
  },
  {
    id: "chair-burgundy",
    slot: "chair",
    name: "Бордо",
    description: "Вишнёвая обивка с мягкой ромбовидной прострочкой.",
  },
  {
    id: "chair-ocean",
    slot: "chair",
    name: "Океан",
    description: "Глубокий синий цвет и тонкие волны на спинке.",
  },
  {
    id: "chair-royal",
    slot: "chair",
    name: "Бархат",
    description: "Сливовый бархат с небольшим золотистым орнаментом.",
  },
  {
    id: "deck-classic",
    slot: "deck",
    name: "Клубная классика",
    description: "Знакомая зелёная рубашка с полосками и звездой.",
  },
  {
    id: "deck-midnight",
    slot: "deck",
    name: "Полночь",
    description: "Тёмно-синяя рубашка с россыпью небольших звёзд.",
  },
  {
    id: "deck-garnet",
    slot: "deck",
    name: "Гранат",
    description: "Красная рубашка с геометрическим узором и тёплой рамкой.",
  },
  {
    id: "deck-ivory",
    slot: "deck",
    name: "Слоновая кость",
    description: "Светлая рубашка с золотистым медальоном и мягким узором.",
  },
];
export function cosmeticItem(id: unknown, slot?: CosmeticSlot) {
  return cosmeticItems.find(
    (item) => item.id === id && (!slot || item.slot === slot),
  );
}
export function normalizeAppearance(
  value?: Partial<Appearance> | null,
): Appearance {
  return {
    chair: cosmeticItem(value?.chair, "chair")?.id ?? defaultAppearance.chair,
    deck: cosmeticItem(value?.deck, "deck")?.id ?? defaultAppearance.deck,
  };
}
