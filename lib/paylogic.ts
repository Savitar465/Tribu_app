/**
 * Pure payment/billing helpers shared by selectors, screens and tests.
 * Structural parameter types (no app imports) keep this module unit-testable.
 */

/** The fields of a charge row this module needs. */
export interface ChargeLike {
  id: string;
  group_id: string;
  participant_id: string;
  cycle: string; // yyyy-mm
  cuota: number;
  paid: boolean;
}

/** The fields of a participant row this module needs. */
export interface ParticipantLike {
  id: string;
  group_id: string;
  user_id: string | null;
}

/** The fields of a group row this module needs. */
export interface GroupLike {
  id: string;
  owner_id: string;
  name: string;
}

/** One member debt bundle: everything the user owes to a single administrator,
 * possibly across several of that admin's groups — payable in one transaction. */
export interface OwnerDebtBundle {
  ownerId: string;
  /** Per group: the roster row and the owed cycles (oldest first). */
  items: { participantId: string; groupId: string; groupName: string; cycles: string[]; total: number }[];
  groupCount: number;
  chargeCount: number;
  total: number;
}

/**
 * Group the signed-in user's unpaid charges by the administrator who collects
 * them. Bundles are ordered by total owed (largest first); cycles oldest first.
 */
export function debtsByOwner(
  charges: ChargeLike[],
  participants: ParticipantLike[],
  groups: GroupLike[],
  userId: string,
): OwnerDebtBundle[] {
  const mine = new Map(participants.filter((p) => p.user_id === userId).map((p) => [p.id, p]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const byParticipant = new Map<string, ChargeLike[]>();
  for (const c of charges) {
    if (c.paid || !mine.has(c.participant_id)) continue;
    byParticipant.set(c.participant_id, [...(byParticipant.get(c.participant_id) ?? []), c]);
  }

  const bundles = new Map<string, OwnerDebtBundle>();
  for (const [participantId, owed] of byParticipant) {
    const p = mine.get(participantId)!;
    const g = groupById.get(p.group_id);
    if (!g || g.owner_id === userId) continue; // own groups are collected, not owed
    const sorted = [...owed].sort((a, b) => a.cycle.localeCompare(b.cycle));
    const total = sorted.reduce((a, c) => a + c.cuota, 0);
    const bundle = bundles.get(g.owner_id) ?? {
      ownerId: g.owner_id,
      items: [],
      groupCount: 0,
      chargeCount: 0,
      total: 0,
    };
    bundle.items.push({
      participantId,
      groupId: g.id,
      groupName: g.name,
      cycles: sorted.map((c) => c.cycle),
      total,
    });
    bundle.groupCount += 1;
    bundle.chargeCount += sorted.length;
    bundle.total += total;
    bundles.set(g.owner_id, bundle);
  }

  return [...bundles.values()]
    .map((b) => ({ ...b, items: [...b.items].sort((a, b2) => a.groupName.localeCompare(b2.groupName)) }))
    .sort((a, b) => b.total - a.total);
}

/**
 * A member's monthly cuota in bolivianos. `amount` is in the group's currency
 * (a custom per-member price or the default split); USD converts at `rate` and
 * `round` applies the group's round-up-to-whole-Bs rule.
 */
export function memberCuotaBs(
  amount: number,
  currency: "BOB" | "USD",
  rate: number,
  round: boolean,
): number {
  const bs = currency === "USD" ? amount * rate : amount;
  return round ? Math.ceil(bs) : bs;
}

/** The next cycle (yyyy-mm) after the given one. */
export function nextCycle(cycle: string): string {
  const [y, m] = cycle.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/**
 * The upcoming cycles an advance payment of `months` months will cover, for a
 * member with no pending debt: starts at the month after the latest settled
 * cycle (or at the current cycle when this month hasn't been charged/paid yet).
 */
export function advanceCoverage(
  paidCycles: string[],
  currentCycle: string,
  months: number,
): string[] {
  const latest = paidCycles.reduce((a, c) => (c > a ? c : a), "");
  let from = latest >= currentCycle ? nextCycle(latest) : currentCycle;
  const covered: string[] = [];
  for (let i = 0; i < Math.max(0, months); i++) {
    covered.push(from);
    from = nextCycle(from);
  }
  return covered;
}

/** A row of the charges export (already denormalized for display). */
export interface ChargeExportRow {
  group: string;
  cycle: string;
  member: string;
  cuota: number;
  paid: boolean;
  paidAt: string | null;
  paidBy: string | null;
}

/**
 * Build an Excel-compatible CSV (UTF-8 with BOM, semicolon-friendly commas
 * escaped by quoting) from denormalized charge rows. Returns the file text.
 */
export function buildChargesCsv(rows: ChargeExportRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Grupo", "Mes", "Miembro", "Cuota (Bs)", "Estado", "Fecha de pago", "Pagado por"];
  const lines = rows.map((r) =>
    [
      esc(r.group),
      esc(r.cycle),
      esc(r.member),
      esc(Math.round(r.cuota * 100) / 100),
      r.paid ? "Pagado" : "Pendiente",
      r.paidAt ? esc(r.paidAt.slice(0, 10)) : "",
      r.paidBy ? esc(r.paidBy) : "",
    ].join(","),
  );
  // BOM so Excel opens the file as UTF-8 (accents in names/months).
  return "\u{FEFF}" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
