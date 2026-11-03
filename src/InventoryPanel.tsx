import { useState } from "react";
import {
  cosmeticItems,
  type CosmeticSlot,
  type Inventory,
} from "../shared/cosmetics";
import { Card } from "./Card";
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
  onEquip: (slot: CosmeticSlot, id: string) => Promise<boolean>;
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
      </div>
      <p className="inventory-note">
        {slot === "chair"
          ? "Выбранная сидушка следует за вами. Когда вы встаёте, кресло снова становится обычным."
          : "Когда вы дилер, все карты этой раздачи получают вашу рубашку. Изменение выбора применяется к следующей вашей раздаче."}
        {admin && <span> Все предметы всегда доступны администратору.</span>}
      </p>
      <div
        className="inventory-grid"
        id="inventory-items"
        role="tabpanel"
        aria-labelledby={slot === "chair" ? "chairs-tab" : "decks-tab"}
      >
        {cosmeticItems
          .filter((item) => item.slot === slot)
          .map((item) => {
            const owned = inventory.owned.includes(item.id),
              equipped = inventory.equipped[slot] === item.id;
            return (
              <article
                key={item.id}
                className={`inventory-item ${!owned ? "item-locked" : ""} ${equipped ? "item-equipped" : ""}`}
              >
                <div
                  className="inventory-preview"
                  aria-label={`Предпросмотр: ${item.name}`}
                >
                  {slot === "chair" ? (
                    <div
                      className="chair"
                      data-chair={item.id}
                      aria-hidden="true"
                    >
                      <i />
                    </div>
                  ) : (
                    <div className="preview-deck">
                      <Card back skin={item.id} />
                      <Card back skin={item.id} />
                    </div>
                  )}
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
                          : `Рубашка «${item.name}» выбрана для следующих раздач, где вы дилер.`,
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
