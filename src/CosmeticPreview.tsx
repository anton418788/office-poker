import type { CosmeticItem } from "../shared/cosmetics";
import { Card } from "./Card";
export function CosmeticPreview({ item }: { item: CosmeticItem | null }) {
  if (!item)
    return (
      <span className="empty-case-art" aria-hidden="true">
        —
      </span>
    );
  return item.slot === "chair" ? (
    <div className="chair" data-chair={item.id} aria-hidden="true">
      <i />
    </div>
  ) : (
    <div className="preview-deck">
      <Card back skin={item.id} />
      <Card back skin={item.id} />
    </div>
  );
}
