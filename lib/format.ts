import type { Cost } from "./types";

/** Format a number of bolivianos, trimming trailing zeros (e.g. `10 Bs`, `12.5 Bs`). */
export function fmtBs(n: number): string {
  const v = Math.round(n * 100) / 100;
  const str = Number.isInteger(v)
    ? String(v)
    : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${str} Bs`;
}

/** Format a USD amount with two decimals (e.g. `$4.29`). */
export function fmtUsd(n: number): string {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}

/** Convert a cost's amount to bolivianos using the current exchange rate. */
export function totalBsOf(cost: Cost, rate: number): number {
  return cost.cur === "USD" ? cost.amount * rate : cost.amount;
}

/** Percentage string (e.g. `40%`) from a part/whole ratio, guarding against divide-by-zero. */
export function pct(part: number, whole: number, decimals = 0): string {
  if (whole <= 0) return "0%";
  return `${((part / whole) * 100).toFixed(decimals)}%`;
}

/** Parse a free-text numeric input, stripping everything but digits and a dot. */
export function sanitizeNumeric(value: string): string {
  return value.replace(/[^0-9.]/g, "");
}
