import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceCoverage,
  buildChargesCsv,
  debtsByOwner,
  memberCuotaBs,
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
