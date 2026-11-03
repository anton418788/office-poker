import { test } from "node:test";
import assert from "node:assert/strict";
import { cosmeticItems, normalizeAppearance } from "../shared/cosmetics.js";
import { shopCases, caseContents } from "../shared/cases.js";
import { accessoryPoint, seatAtView } from "../shared/table-layout.js";

test("15 аксессуаров: 8 редких, 5 эпических, 2 эксклюзивных; в кейсах их нет", () => {
  const items = cosmeticItems.filter((item) => item.slot === "accessory");
  assert.equal(new Set(items.map((item) => item.id)).size, 15);
  assert.deepEqual(
    ["rare", "epic", "exclusive"].map(
      (rarity) => items.filter((item) => item.rarity === rarity).length,
    ),
    [8, 5, 2],
  );
  assert.equal(normalizeAppearance().accessory, null);
  assert.equal(
    normalizeAppearance({ accessory: "deck-midnight" }).accessory,
    null,
  );
  for (const c of shopCases)
    assert.ok(
      caseContents(c.id).every((outcome) => outcome.item?.slot !== "accessory"),
    );
});
test("Аксессуары сохраняют место относительно владельца при всех шести поворотах стола", () => {
  for (let viewer = 0; viewer < 6; viewer++) {
    assert.deepEqual(accessoryPoint(viewer, viewer), [42, 80]);
    for (let position = 0; position < 6; position++)
      assert.deepEqual(
        accessoryPoint(seatAtView(position, viewer), viewer),
        accessoryPoint(position),
      );
  }
});
