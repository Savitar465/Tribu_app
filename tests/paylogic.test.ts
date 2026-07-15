import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceCoverage,
  buildChargesCsv,
  checkCustomPct,
  checkCustomPrice,
  debtsByOwner,
  memberCuotaBs,
  imageUploadError,
  MAX_IMAGE_BYTES,
  nextCycle,
  type ChargeLike,
  type GroupLike,
  type ParticipantLike,
} from "../lib/paylogic.ts";

const USER = "user-1";
const ADMIN_A = "admin-a";
const ADMIN_B = "admin-b";

const groups: GroupLike[] = [
  { id: "g1", owner_id: ADMIN_A, name: "Spotify" },
  { id: "g2", owner_id: ADMIN_A, name: "Netflix" },
  { id: "g3", owner_id: ADMIN_B, name: "Max" },
  { id: "g4", owner_id: USER, name: "Canva" }, // owned by the user: collected, not owed
];

const participants: ParticipantLike[] = [
  { id: "p1", group_id: "g1", user_id: USER },
  { id: "p2", group_id: "g2", user_id: USER },
  { id: "p3", group_id: "g3", user_id: USER },
  { id: "p4", group_id: "g4", user_id: USER },
  { id: "px", group_id: "g1", user_id: "someone-else" },
];

const charge = (o: Partial<ChargeLike> & Pick<ChargeLike, "id" | "participant_id" | "group_id" | "cycle">): ChargeLike => ({
  cuota: 10,
  paid: false,
  ...o,
});

test("debtsByOwner bundles unpaid charges per administrator, oldest cycle first", () => {
  const charges: ChargeLike[] = [
    charge({ id: "c1", participant_id: "p1", group_id: "g1", cycle: "2026-07", cuota: 10 }),
    charge({ id: "c2", participant_id: "p1", group_id: "g1", cycle: "2026-06", cuota: 12 }),
    charge({ id: "c3", participant_id: "p2", group_id: "g2", cycle: "2026-07", cuota: 20 }),
    charge({ id: "c4", participant_id: "p3", group_id: "g3", cycle: "2026-07", cuota: 5 }),
    charge({ id: "c5", participant_id: "p1", group_id: "g1", cycle: "2026-05", cuota: 12, paid: true }), // paid → excluded
    charge({ id: "c6", participant_id: "px", group_id: "g1", cycle: "2026-07" }), // someone else's debt
    charge({ id: "c7", participant_id: "p4", group_id: "g4", cycle: "2026-07" }), // own group → excluded
  ];

  const bundles = debtsByOwner(charges, participants, groups, USER);
  assert.equal(bundles.length, 2);

  const a = bundles.find((b) => b.ownerId === ADMIN_A)!;
  assert.equal(a.groupCount, 2);
  assert.equal(a.chargeCount, 3);
  assert.equal(a.total, 42);
  const spotify = a.items.find((i) => i.groupId === "g1")!;
  assert.deepEqual(spotify.cycles, ["2026-06", "2026-07"]); // oldest first
  assert.equal(spotify.total, 22);

  const b = bundles.find((x) => x.ownerId === ADMIN_B)!;
  assert.equal(b.groupCount, 1);
  assert.equal(b.total, 5);

  // Largest bundle first.
  assert.equal(bundles[0].ownerId, ADMIN_A);
});

test("debtsByOwner returns nothing when everything is paid", () => {
  const charges = [charge({ id: "c1", participant_id: "p1", group_id: "g1", cycle: "2026-07", paid: true })];
  assert.deepEqual(debtsByOwner(charges, participants, groups, USER), []);
});

test("memberCuotaBs converts the group currency and applies rounding", () => {
  assert.equal(memberCuotaBs(15, "BOB", 6.96, false), 15); // BOB ignores the rate
  assert.equal(memberCuotaBs(2, "USD", 6.96, false), 13.92); // USD converts
  assert.equal(memberCuotaBs(2, "USD", 6.96, true), 14); // round up to whole Bs
  assert.equal(memberCuotaBs(10.4, "BOB", 6.96, true), 11);
});

test("nextCycle rolls over the year in December", () => {
  assert.equal(nextCycle("2026-07"), "2026-08");
  assert.equal(nextCycle("2026-12"), "2027-01");
});

test("advanceCoverage starts after the latest settled month", () => {
  // Current month already paid → the advance covers the following months.
  assert.deepEqual(advanceCoverage(["2026-06", "2026-07"], "2026-07", 2), ["2026-08", "2026-09"]);
  // Nothing settled this month yet → the advance starts at the current month.
  assert.deepEqual(advanceCoverage(["2026-06"], "2026-07", 2), ["2026-07", "2026-08"]);
  assert.deepEqual(advanceCoverage([], "2026-07", 1), ["2026-07"]);
  assert.deepEqual(advanceCoverage(["2026-07"], "2026-07", 0), []);
  // Year rollover.
  assert.deepEqual(advanceCoverage(["2026-12"], "2026-12", 2), ["2027-01", "2027-02"]);
});

test("buildChargesCsv produces an Excel-compatible UTF-8 file", () => {
  const csv = buildChargesCsv([
    { group: "Spotify", cycle: "2026-07", member: "María", cuota: 12.5, paid: true, paidAt: "2026-07-05T10:00:00Z", paidBy: "Jonas" },
    { group: 'Grupo "raro", sí', cycle: "2026-06", member: "Ana", cuota: 10, paid: false, paidAt: null, paidBy: null },
  ]);
  assert.ok(csv.startsWith("﻿")); // BOM so Excel reads UTF-8
  const lines = csv.replace("﻿", "").trim().split("\r\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], "Grupo,Mes,Miembro,Cuota (Bs),Estado,Fecha de pago,Pagado por");
  assert.equal(lines[1], "Spotify,2026-07,María,12.5,Pagado,2026-07-05,Jonas");
  // Commas and quotes inside values are quoted/escaped.
  assert.equal(lines[2], '"Grupo ""raro"", sí",2026-06,Ana,10,Pendiente,,');
});

test("checkCustomPrice caps the price at what the other members leave available", () => {
  // The user's example: a 50 Bs plan where two members pay 10 Bs each leaves
  // 30 Bs available for the edited member.
  const roster = [
    { id: "me", custom_amount: null, custom_currency: null, custom_pct: null },
    { id: "a", custom_amount: 10, custom_currency: "BOB" as const, custom_pct: null },
    { id: "b", custom_amount: 10, custom_currency: "BOB" as const, custom_pct: null },
  ];
  const check = (newPerBs: number) =>
    checkCustomPrice({
      newPerBs,
      editedId: "me",
      roster,
      groupCurrency: "BOB",
      totalBs: 50,
      defaultPerBs: 50 / 3,
      rate: 12,
      round: false,
    });
  assert.equal(check(30).remaining, 30);
  assert.equal(check(30).ok, true);
  assert.equal(check(30.5).ok, false);
});

test("checkCustomPrice counts default-split members and USD custom prices", () => {
  // 60 Bs total: one member takes 30 Bs (custom $2.5 at rate 12), another pays
  // the default 10 Bs → 20 Bs remain available.
  const roster = [
    { id: "me", custom_amount: null, custom_currency: null, custom_pct: null },
    { id: "usd", custom_amount: 2.5, custom_currency: "USD" as const, custom_pct: null },
    { id: "plain", custom_amount: null, custom_currency: null, custom_pct: null },
  ];
  const check = (newPerBs: number) =>
    checkCustomPrice({
      newPerBs,
      editedId: "me",
      roster,
      groupCurrency: "BOB",
      totalBs: 60,
      defaultPerBs: 10,
      rate: 12,
      round: false,
    });
  assert.equal(check(20).remaining, 20);
  assert.equal(check(20).ok, true);
  assert.equal(check(20.5).ok, false);
});

test("checkCustomPrice tolerates only the excess rounding can add", () => {
  // 100 Bs / 6 slots rounded: default cuota is ceil(16.67) = 17. Setting the
  // sixth member to the same rounded 17 (total 102) must stay legal, but
  // anything past the 1 Bs-per-member allowance must not.
  const roster = Array.from({ length: 6 }, (_, i) => ({
    id: `m${i}`,
    custom_amount: null,
    custom_currency: null,
    custom_pct: null,
  }));
  const base = {
    editedId: "m0",
    roster,
    groupCurrency: "BOB" as const,
    totalBs: 100,
    defaultPerBs: 17,
    rate: 12,
    round: true,
  };
  assert.equal(checkCustomPrice({ ...base, newPerBs: 17 }).ok, true);
  assert.equal(checkCustomPrice({ ...base, newPerBs: 22 }).ok, false);
});

test("imageUploadError accepts JPG/PNG/WebP under 5 MB and rejects the rest", () => {
  assert.equal(imageUploadError({ type: "image/jpeg", size: 1024 }), null);
  assert.equal(imageUploadError({ type: "image/jpg", size: 1024 }), null);
  assert.equal(imageUploadError({ type: "image/png", size: MAX_IMAGE_BYTES }), null);
  assert.equal(imageUploadError({ type: "image/webp", size: 1 }), null);
  // Wrong type wins over any size problem.
  assert.equal(imageUploadError({ type: "application/pdf", size: 1024 }), "Solo imágenes JPG, PNG o WebP");
  assert.equal(imageUploadError({ type: "image/gif", size: 1024 }), "Solo imágenes JPG, PNG o WebP");
  assert.equal(imageUploadError({ type: "", size: 0 }), "Solo imágenes JPG, PNG o WebP");
  assert.equal(imageUploadError({ type: "image/png", size: 0 }), "El archivo está vacío o dañado");
  assert.equal(imageUploadError({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }), "La imagen supera los 5 MB");
});

test("checkCustomPct counts other members' amounts and default splits, not just percentages", () => {
  // 100 Bs plan, 4 slots: one member at 30%, one at a fixed 20 Bs, one on the
  // default split (25 Bs). Others consume 75% → 25% remains for the edited one.
  const roster = [
    { id: "edited", custom_amount: null, custom_currency: null, custom_pct: null },
    { id: "pct", custom_amount: null, custom_currency: null, custom_pct: 30 },
    { id: "fixed", custom_amount: 20, custom_currency: "BOB" as const, custom_pct: null },
    { id: "default", custom_amount: null, custom_currency: null, custom_pct: null },
  ];
  const base = {
    editedId: "edited",
    roster,
    groupCurrency: "BOB" as const,
    totalBs: 100,
    defaultPerBs: 25,
    rate: 10,
    round: false,
  };
  const at25 = checkCustomPct({ ...base, newPct: 25 });
  assert.equal(at25.othersPct, 75);
  assert.equal(at25.remainingPct, 25);
  assert.equal(at25.remainingBs, 25);
  assert.equal(at25.resultBs, 25);
  assert.equal(at25.ok, true);
  assert.equal(checkCustomPct({ ...base, newPct: 26 }).ok, false);
});

test("checkCustomPct converts USD amounts and reports remaining with pct 0", () => {
  // 200 Bs plan, one other member with a 5 USD custom price at rate 10 → 50 Bs
  // (25%). With no draft yet (pct 0) the editor still learns what's left.
  const roster = [
    { id: "edited", custom_amount: null, custom_currency: null, custom_pct: null },
    { id: "usd", custom_amount: 5, custom_currency: "USD" as const, custom_pct: null },
  ];
  const info = checkCustomPct({
    newPct: 0,
    editedId: "edited",
    roster,
    groupCurrency: "BOB",
    totalBs: 200,
    defaultPerBs: 100,
    rate: 10,
    round: false,
  });
  assert.equal(info.othersPct, 25);
  assert.equal(info.remainingPct, 75);
  assert.equal(info.remainingBs, 150);
  assert.equal(info.ok, true);
});

test("checkCustomPct tolerates only the excess rounding can add", () => {
  // 100 Bs / 3 slots with rounding: the two other default-split members are
  // rounded to 34 Bs each (68%). 32% → 32 Bs fits; 40% → 40 Bs exceeds the
  // 3 Bs round-up allowance.
  const roster = Array.from({ length: 3 }, (_, i) => ({
    id: `m${i}`,
    custom_amount: null,
    custom_currency: null,
    custom_pct: null,
  }));
  const base = {
    editedId: "m0",
    roster,
    groupCurrency: "BOB" as const,
    totalBs: 100,
    defaultPerBs: 34,
    rate: 10,
    round: true,
  };
  assert.equal(checkCustomPct({ ...base, newPct: 32 }).ok, true);
  assert.equal(checkCustomPct({ ...base, newPct: 40 }).ok, false);
});
