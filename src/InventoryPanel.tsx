import { useState, type CSSProperties } from "react";
import {
  cosmeticItems,
  cosmeticRarities,
  type CosmeticSlot,
  type Inventory,
} from "../shared/cosmetics";
import { CosmeticPreview } from "./CosmeticPreview";
export function InventoryPanel({
  inventory,
  admin,
  busy,
  error,
  onBack,
  onEquip,
}: {
  inventory: Inventory;
  admin: boolean;
  busy: boolean;
  error: string;
  onBack: () => void;
  onEquip: (slot: CosmeticSlot, id: string | null) => Promise<boolean>;
}) {
  const [slot, setSlot] = useState<CosmeticSlot>("chair");
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ВАША КОЛЛЕКЦИЯ</div>
          <h1>Инвентарь</h1>
          <p>Небольшие детали, которые делают место за столом вашим.</p>
        </div>
        <button onClick={onBack}>← К столам</button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="club-notice" role="status">
          {notice}
        </div>
      )}
      <div
        className="inventory-tabs"
        role="tablist"
        aria-label="Категории инвентаря"
      >
        <button
          role="tab"
          id="chairs-tab"
          aria-controls="inventory-items"
          aria-selected={slot === "chair"}
          onClick={() => {
            setSlot("chair");
            setNotice("");
          }}
        >
          ♧ Сидушка
        </button>
        <button
          role="tab"
          id="decks-tab"
          aria-controls="inventory-items"
          aria-selected={slot === "deck"}
          onClick={() => {
            setSlot("deck");
            setNotice("");
          }}
        >
          ♠ Рубашка карт
        </button>
        <button
          role="tab"
          id="accessories-tab"
          aria-controls="inventory-items"
          aria-selected={slot === "accessory"}
          onClick={() => {
            setSlot("accessory");
            setNotice("");
          }}
        >
          ♢ Аксессуары
        </button>
      </div>
      <p className="inventory-note">
        {slot === "chair"
          ? "Выбранная сидушка следует за вами. Когда вы встаёте, кресло снова становится обычным."
          : slot === "deck"
            ? "Когда вы дилер, все карты этой раздачи получают вашу рубашку. Изменение выбора применяется к следующей вашей раздаче."
            : "Один выбранный предмет появляется на сукне рядом с вами. Когда вы покидаете место, аксессуар тоже исчезает. Способ получения появится позже; в кейсах аксессуаров нет."}
        {admin && <span> Все предметы всегда доступны администратору.</span>}
      </p>
      {slot === "accessory" && (
        <div className="accessory-selection">
          <span>
            {inventory.equipped.accessory
              ? "Аксессуар выбран"
              : "Без аксессуара"}
          </span>
          <button
            disabled={busy || !inventory.equipped.accessory}
            onClick={async () => {
              if (await onEquip("accessory", null))
                setNotice("Аксессуар снят.");
            }}
          >
            Снять аксессуар
          </button>
        </div>
      )}
      <div
        className="inventory-grid"
        id="inventory-items"
        role="tabpanel"
        aria-labelledby={
          slot === "chair"
            ? "chairs-tab"
            : slot === "deck"
              ? "decks-tab"
              : "accessories-tab"
        }
      >
        {cosmeticItems
          .filter((item) => item.slot === slot)
          .map((item) => {
            const owned = inventory.owned.includes(item.id),
              equipped = inventory.equipped[slot] === item.id;
            return (
              <article
                key={item.id}
                data-rarity={item.rarity}
                style={
                  {
                    "--rarity-color": cosmeticRarities[item.rarity].color,
                  } as CSSProperties
                }
                className={`inventory-item ${!owned ? "item-locked" : ""} ${equipped ? "item-equipped" : ""}`}
              >
                <div
                  className="inventory-preview"
                  aria-label={`Предпросмотр: ${item.name}`}
                >
                  <CosmeticPreview item={item} />
                  {!owned && (
                    <span className="inventory-lock" aria-label="Заблокировано">
                      🔒
                    </span>
                  )}
                  {equipped && (
                    <span className="inventory-selected">✓ Выбрано</span>
                  )}
                </div>
                <h2>{item.name}</h2>
                <span className="item-rarity">
                  {cosmeticRarities[item.rarity].name}
                </span>
                <p>{item.description}</p>
                <button
                  className={owned && !equipped ? "primary" : ""}
                  disabled={busy || !owned || equipped}
                  aria-label={`${equipped ? "Выбрано" : owned ? "Выбрать" : "Заблокировано"}: ${item.name}`}
                  onClick={async () => {
                    if (await onEquip(slot, item.id))
                      setNotice(
                        slot === "chair"
                          ? `Сидушка «${item.name}» выбрана.`
                          : slot === "deck"
                            ? `Рубашка «${item.name}» выбрана для следующих раздач, где вы дилер.`
                            : `Аксессуар «${item.name}» выбран.`,
                      );
                  }}
                >
                  {equipped ? "Выбрано" : owned ? "Выбрать" : "Нет в инвентаре"}
                </button>
              </article>
            );
          })}
      </div>
    </>
  );
}
