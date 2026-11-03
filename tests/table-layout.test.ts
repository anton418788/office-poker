import { test } from "node:test";
import assert from "node:assert/strict";
import { seatAtView, seatPoint, viewSeat } from "../shared/table-layout.js";
import { createGame, join, start, view } from "../server/engine.js";
import { cardMoves } from "../shared/dealing.js";
test("Каждое из шести мест становится нижним для сидящего на нём игрока; порядок по кругу сохраняется", () => {
  for (let viewer = 0; viewer < 6; viewer++) {
    assert.equal(viewSeat(viewer, viewer), 0);
    assert.deepEqual(seatPoint(viewer, viewer), [50, 89]);
    const seats = Array.from({ length: 6 }, (_, position) =>
      seatAtView(position, viewer),
    );
    assert.equal(new Set(seats).size, 6);
    for (let position = 0; position < 6; position++) {
      assert.equal(viewSeat(seats[position], viewer), position);
      assert.equal(seats[(position + 1) % 6], (seats[position] + 1) % 6);
    }
  }
});
test("Зритель видит исходные номера; при повторной посадке меняется только точка обзора", () => {
  for (let seat = 0; seat < 6; seat++) assert.equal(seatAtView(seat), seat);
  assert.equal(viewSeat(4, 4), 0);
  assert.equal(viewSeat(4, 1), 3);
  assert.deepEqual(seatPoint(4, 1), [50, 7]);
  assert.deepEqual(seatPoint(5, 4, true), [15, 68]);
  assert.deepEqual(seatPoint(3, 4, true), [85, 68]);
});
test("Дилер, раздача, карты и фишки используют те же реальные места при любом повороте", () => {
  const g = createGame();
  for (let i = 0; i < 6; i++) join(g, String(i), `Игрок ${i}`, i);
  start(g, 1000, true);
  const original = structuredClone(g),
    v = view(g, "4", false),
    moves = cardMoves(g.deal!);
  for (const m of moves) {
    const position = viewSeat(m.seat, 4);
    assert.equal(seatAtView(position, 4), m.seat);
    assert.equal(
      v.players.find((p) => p.seat === m.seat)?.id,
      g.players.find((p) => p.seat === m.seat)?.id,
    );
  }
  for (const transfer of g.transfers ?? [])
    assert.equal(seatAtView(viewSeat(transfer.seat, 4), 4), transfer.seat);
  assert.equal(seatAtView(viewSeat(g.dealer, 4), 4), g.dealer);
  assert.deepEqual(g, original);
});
