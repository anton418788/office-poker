/** Clockwise screen positions. Game seat numbers are never changed by this view. */
export const tableLocations = [
  [50, 89],
  [10, 68],
  [10, 29],
  [50, 7],
  [90, 29],
  [90, 68],
] as const;
const anchor = (viewerSeat?: number) =>
  Number.isInteger(viewerSeat) && viewerSeat! >= 0 && viewerSeat! < 6
    ? viewerSeat!
    : 0;
export function viewSeat(realSeat: number, viewerSeat?: number) {
  return (realSeat - anchor(viewerSeat) + 6) % 6;
}
export function seatAtView(position: number, viewerSeat?: number) {
  return (position + anchor(viewerSeat)) % 6;
}
/** Inside the rail, away from hole cards, dealer decks and the central board. */
export function accessoryPoint(
  realSeat: number,
  viewerSeat?: number,
  compact = false,
) {
  const positions = compact
    ? ([
        [36, 79],
        [35, 74],
        [35, 23],
        [28, 20],
        [65, 23],
        [65, 74],
      ] as const)
    : ([
        [42, 80],
        [24, 72],
        [24, 25],
        [36, 20],
        [76, 25],
        [76, 72],
      ] as const);
  return positions[viewSeat(realSeat, viewerSeat)]!;
}
export function seatPoint(
  realSeat: number,
  viewerSeat?: number,
  compact = false,
): [number, number] {
  const [x, y] = tableLocations[viewSeat(realSeat, viewerSeat)] ?? [50, 50];
  return [compact ? (x === 10 ? 15 : x === 90 ? 85 : x) : x, y];
}
