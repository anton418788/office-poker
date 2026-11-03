export const denominations = [1000, 500, 100, 25, 5, 1] as const;
export const chipColors: Record<number, string> = {
  1000: "#d6a948",
  500: "#946ab6",
  100: "#364456",
  25: "#3c9374",
  5: "#c66050",
  1: "#dbe2df",
};
export type ChipStack = { value: number; count: number };
export function chipBreakdown(amount: number): ChipStack[] {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw Error("Некорректная сумма фишек");
  let left = amount;
  const counts = denominations.map((value) => {
    const count = Math.floor(left / value);
    left %= value;
    return { value, count };
  });
  // Make a useful rack of change without changing its actual total value.
  for (
    let pass = 0;
    pass < 5 && counts.filter((s) => s.count).length < 3;
    pass++
  ) {
    const i = counts.findIndex(
      (s, index) => s.count > 1 && index < counts.length - 1,
    );
    if (i < 0) break;
    counts[i].count--;
    counts[i + 1].count += counts[i].value / counts[i + 1].value;
  }
  return counts.filter((s) => s.count > 0);
}
