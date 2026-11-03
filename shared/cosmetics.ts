export const cosmeticRarities = {
  common: { name: "Обычная", color: "#849087" },
  rare: { name: "Редкая", color: "#6484bd" },
  epic: { name: "Эпическая", color: "#bf7fa7" },
  exclusive: { name: "Эксклюзивная", color: "#bc6d72" },
} as const;
export type CosmeticRarity = keyof typeof cosmeticRarities;
export type CosmeticSlot = "chair" | "deck" | "accessory";
export type Appearance = {
  chair: string;
  deck: string;
  accessory: string | null;
};
export type Inventory = { owned: string[]; equipped: Appearance };
export type CosmeticItem = {
  id: string;
  slot: CosmeticSlot;
  rarity: CosmeticRarity;
  name: string;
  description: string;
};
export const defaultAppearance: Appearance = {
  chair: "chair-classic",
  deck: "deck-classic",
  accessory: null,
};
export const cosmeticItems: CosmeticItem[] = [
  {
    id: "chair-classic",
    rarity: "common",
    slot: "chair",
    name: "Классика",
    description: "Привычное кресло клуба. Спокойные оттенки и гладкая обивка.",
  },
  {
    id: "chair-burgundy",
    rarity: "rare",
    slot: "chair",
    name: "Бордо",
    description: "Вишнёвая обивка с мягкой ромбовидной прострочкой.",
  },
  {
    id: "chair-ocean",
    rarity: "epic",
    slot: "chair",
    name: "Океан",
    description: "Глубокий синий цвет и тонкие волны на спинке.",
  },
  {
    id: "chair-royal",
    rarity: "exclusive",
    slot: "chair",
    name: "Бархат",
    description: "Сливовый бархат с небольшим золотистым орнаментом.",
  },
  {
    id: "deck-classic",
    rarity: "common",
    slot: "deck",
    name: "Клубная классика",
    description: "Знакомая зелёная рубашка с полосками и звездой.",
  },
  {
    id: "deck-midnight",
    rarity: "rare",
    slot: "deck",
    name: "Полночь",
    description: "Тёмно-синяя рубашка с россыпью небольших звёзд.",
  },
  {
    id: "deck-garnet",
    rarity: "epic",
    slot: "deck",
    name: "Гранат",
    description: "Красная рубашка с геометрическим узором и тёплой рамкой.",
  },
  {
    id: "deck-ivory",
    rarity: "exclusive",
    slot: "deck",
    name: "Слоновая кость",
    description: "Светлая рубашка с золотистым медальоном и мягким узором.",
  },
];
// Accessories have no base item: an empty place on the felt is the default.
cosmeticItems.push(
  ...(
    [
      [
        "whiskey",
        "rare",
        "Виски со льдом",
        "Янтарный виски в тяжёлом стакане с кубиками льда.",
      ],
      [
        "cognac",
        "rare",
        "Коньячный бокал",
        "Небольшой округлый бокал с тёплым янтарным напитком.",
      ],
      [
        "wine",
        "rare",
        "Красное вино",
        "Бокал рубинового вина для неспешной партии.",
      ],
      [
        "champagne",
        "rare",
        "Шампанское",
        "Тонкий бокал с золотистыми пузырьками.",
      ],
      ["espresso", "rare", "Эспрессо", "Фарфоровая чашка на маленьком блюдце."],
      [
        "cigar",
        "rare",
        "Сигара",
        "Сигара с бордовым кольцом на аккуратной пепельнице.",
      ],
      [
        "dice",
        "rare",
        "Счастливые кости",
        "Пара костей цвета слоновой кости — просто на удачу.",
      ],
      [
        "pen",
        "rare",
        "Перьевая ручка",
        "Тёмно-зелёная ручка с золотистым пером.",
      ],
      [
        "phone",
        "epic",
        "iPhone",
        "Графитовый телефон рубашкой вверх, с узнаваемым яблочком.",
      ],
      [
        "joker",
        "epic",
        "Джокер",
        "Коллекционная карта с шутовским колпаком. В игре не участвует.",
      ],
      [
        "watch",
        "epic",
        "Карманные часы",
        "Винтажные часы на короткой золотистой цепочке.",
      ],
      [
        "lighter",
        "epic",
        "Золотая зажигалка",
        "Рифлёный металлический корпус с клубной гравировкой.",
      ],
      [
        "notebook",
        "epic",
        "Кожаный блокнот",
        "Бордовая кожа, золотой обрез и тонкая закладка.",
      ],
      [
        "decanter",
        "exclusive",
        "Хрустальный графин",
        "Гранёный графин с янтарным напитком и золотой пробкой.",
      ],
      [
        "horseshoe",
        "exclusive",
        "Золотая подкова",
        "Маленький талисман с золотым блеском и рубиновыми вставками.",
      ],
    ] as const
  ).map(([id, rarity, name, description]) => ({
    id: `accessory-${id}`,
    slot: "accessory" as const,
    rarity,
    name,
    description,
  })),
);
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
    accessory: cosmeticItem(value?.accessory, "accessory")?.id ?? null,
  };
}
