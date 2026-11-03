import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CASE_ROLL_SIZE,
  caseContents,
  drawCase,
  duplicateCompensation,
  reelTickTimes,
  shopCases,
} from "../shared/cases.js";
test("Оба кейса: ровно 79% пусто, 15% редкое, 5% эпическое и 1% эксклюзивное", () => {
  for (const box of shopCases) {
    const counts: Record<string, number> = {
      empty: 0,
      rare: 0,
      epic: 0,
      exclusive: 0,
    };
    for (let roll = 0; roll < CASE_ROLL_SIZE; roll++) {
      const item = drawCase(box.id, roll);
      counts[item?.rarity ?? "empty"]++;
      if (item) assert.equal(item.slot, box.slot);
    }
    assert.deepEqual(counts, {
      empty: 7900,
      rare: 1500,
      epic: 500,
      exclusive: 100,
    });
    assert.equal(
      caseContents(box.id).reduce((sum, outcome) => sum + outcome.weight, 0),
      10000,
    );
    assert.equal(drawCase(box.id, 7899), null);
    assert.equal(drawCase(box.id, 7900)?.rarity, "rare");
    assert.equal(drawCase(box.id, 9399)?.rarity, "rare");
    assert.equal(drawCase(box.id, 9400)?.rarity, "epic");
    assert.equal(drawCase(box.id, 9900)?.rarity, "exclusive");
    for (const { item } of caseContents(box.id))
      if (item)
        assert.equal(
          duplicateCompensation(item),
          { rare: 50, epic: 250, exclusive: 500 }[
            item.rarity as "rare" | "epic" | "exclusive"
          ],
        );
  }
  assert.throws(() => drawCase("chairs", 10000));
  assert.throws(() => drawCase("chairs", -1));
  assert.throws(() => drawCase("chairs", 1.5));
  assert.throws(() => caseContents("unknown"));
});
test("Щелчки ленты следуют пересечениям карточек, замедляются и не требуют покадровых таймеров", () => {
  const center = 350,
    travel = 24 * 140 + 64 - center,
    times = reelTickTimes(travel, center, 128, 140, 32, 3300);
  assert.ok(times.length > 15 && times.length < 32);
  assert.ok(
    times.every(
      (time, i) => time > 0 && time <= 3300 && (i === 0 || time > times[i - 1]),
    ),
  );
  assert.ok(times.at(-1)! - times.at(-2)! > times[1] - times[0]);
});
