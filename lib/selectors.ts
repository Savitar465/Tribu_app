import { SERVICE_META } from "./data";
import { fmtBs, fmtUsd, pct } from "./format";
import { BACK_TITLE } from "./navigation";
import { advanceCoverage, memberCuotaBs } from "./paylogic";
import type { State } from "./store";
import type { GroupRow, ParticipantRow } from "./db/types";
import { STATUS, colors, type StatusKey } from "./theme";
import type { GroupView } from "./types";

/** Participants of a group, ordered. */
function participantsOf(state: State, groupId: string) {
  return state.participants.filter((p) => p.group_id === groupId).sort((a, b) => a.sort - b.sort);
}

/** The current billing cycle (yyyy-mm). */
export function currentCycle() {
  return new Date().toLocaleDateString("en-CA").slice(0, 7);
}

/** Human label for a cycle, e.g. "junio 2026". */
export function cycleLabel(cycle: string) {
  return new Date(`${cycle}-02T12:00:00`).toLocaleDateString("es", { month: "long", year: "numeric" });
}

/** Short label for a cycle, e.g. "jun". */
export function cycleShort(cycle: string) {
  return new Date(`${cycle}-02T12:00:00`).toLocaleDateString("es", { month: "short" });
}

/** A group's cost figures in bolivianos at the current rate. */
function costOf(group: GroupRow, rate: number) {
  const totalBs = group.currency === "USD" ? group.amount * rate : group.amount;
  const n = Math.max(1, group.members_target);
  // Once this month's charge ran, the cuota stays frozen at the rate captured
  // on the billing day; until then it previews at today's rate.
  const frozen = group.billed_cycle === currentCycle() && group.billed_cuota != null;
  const per = frozen
    ? (group.billed_cuota as number)
    : group.round_cuota
      ? Math.ceil(totalBs / n)
      : totalBs / n;
  // What the admin actually collects: with rounding/freezing it can differ from the plan cost.
  return { totalBs, per, targetBs: per * n, isUsd: group.currency === "USD" };
}

/** A member's cuota (Bs): their admin-set custom price when they have one —
 * frozen at this month's charge if already billed, previewed at today's rate
 * otherwise — or the group's default split. */
function memberPer(state: State, group: GroupRow, p: ParticipantRow, defaultPer: number): number {
  if (p.custom_amount == null) return defaultPer;
  const charge = state.charges.find((c) => c.participant_id === p.id && c.cycle === currentCycle());
  if (charge) return charge.cuota;
  return memberCuotaBs(
    p.custom_amount,
    p.custom_currency ?? group.currency,
    state.profile.exchange_rate,
    group.round_cuota,
  );
}

/** A participant's effective monthly cuota in Bs (custom price or default split). */
export function getMemberCuota(state: State, group: GroupRow, p: ParticipantRow): number {
  return memberPer(state, group, p, costOf(group, state.profile.exchange_rate).per);
}

/** Build the presentational view of a group row. */
export function buildGroup(state: State, group: GroupRow): GroupView {
  const meta = SERVICE_META[group.service_id];
  const rate = state.profile.exchange_rate;
  const k = costOf(group, rate);
  const owned = group.owner_id === state.profile.id;
  // The viewer's own roster row (owner or member) drives their cuota status.
  // Any unpaid charge from a past cycle marks the whole group overdue.
  const myRow = state.participants.find((p) => p.group_id === group.id && p.user_id === state.profile.id);
  // The viewer's own cuota honors their custom price (default: the group split).
  const myPer = myRow ? memberPer(state, group, myRow, k.per) : k.per;
  const hasArrears = myRow
    ? state.charges.some((c) => c.participant_id === myRow.id && !c.paid && c.cycle < currentCycle())
    : false;
  const statusKey: StatusKey = myRow
    ? myRow.proof_pending
      ? "review"
      : hasArrears
        ? "overdue"
        : myRow.paid
          ? "paid"
          : "pending"
    : group.self_status;
  // Custom ("others") groups carry their own color and derive a monogram from the name.
  const color = group.color ?? meta.color;
  const mono =
    group.service_id === "others" ? group.name.trim().charAt(0).toUpperCase() || meta.mono : meta.mono;

  const view: GroupView = {
    id: group.id,
    serviceId: group.service_id,
    mono,
    color,
    name: group.name || meta.name,
    plan: meta.plan,
    due: group.due ?? meta.due,
    owned,
    statusKey,
    cuota: fmtBs(myPer),
    monthly: fmtBs(k.totalBs),
    members: String(group.members_target),
    usdNote: k.isUsd ? `≈ ${fmtUsd(group.amount / group.members_target)}/persona · cobrado en USD` : "",
    isUsd: k.isUsd,
    perBs: myPer,
    defaultPerBs: k.per,
    totalBs: k.totalBs,
    qrImageUrl: group.qr_image_url,
    paypalInfo: group.paypal_info,
    bankInfo: group.bank_info,
  };

  if (owned) {
    // Collection figures honor per-member custom prices: the target is the sum
    // of each roster member's cuota plus the default split for unfilled slots.
    const roster = participantsOf(state, group.id);
    const paid = roster.filter((p) => p.paid).length;
    const collected = roster.filter((p) => p.paid).reduce((a, p) => a + memberPer(state, group, p, k.per), 0);
    const targetBs =
      roster.reduce((a, p) => a + memberPer(state, group, p, k.per), 0) +
      k.per * Math.max(0, group.members_target - roster.length);
    view.admin = {
      collected: fmtBs(collected),
      pending: fmtBs(targetBs - collected),
      total: fmtBs(targetBs),
      pct: pct(collected, targetBs),
      pendingCount: String(group.members_target - paid),
      collectedBs: collected,
      targetBs,
    };
  }
  return view;
}

/** All the user's groups. */
export function getGroups(state: State): GroupView[] {
  return state.groups.map((g) => buildGroup(state, g));
}

/** The group currently open in the detail view (or null when there are none). */
export function getCurrentGroup(state: State): GroupView | null {
  const g = state.groups.find((x) => x.id === state.agId) ?? state.groups[0];
  return g ? buildGroup(state, g) : null;
}

/** Whether a group's cuota can be paid. */
export function isPayable(group: GroupView): boolean {
  return group.statusKey === "pending" || group.statusKey === "overdue";
}

/** Identity fields for the profile/home headers. */
export function getProfileView(state: State) {
  const p = state.profile;
  const fullName = p.full_name || p.email || "Usuario";
  const owned = state.groups.filter((g) => g.owner_id === state.profile.id).length;
  return {
    name: fullName.split(/\s+/)[0],
    fullName,
    email: p.email ?? "",
    mono: p.mono || fullName.slice(0, 2).toUpperCase(),
    subCount: state.groups.length,
    ownedCount: owned,
    memberCount: state.groups.length - owned,
  };
}

/** Home screen figures. */
export function getHome(state: State) {
  const groups = getGroups(state);
  const due = groups
    .filter((g) => g.statusKey === "pending" || g.statusKey === "overdue")
    .reduce((a, g) => a + g.perBs, 0);
  const combined = getCombinedPay(state);
  return {
    ...getProfileView(state),
    groups,
    hasGroups: groups.length > 0,
    payDue: fmtBs(due),
    dueCount: groups.filter((g) => g.statusKey === "pending" || g.statusKey === "overdue").length,
    /** Combined-payment entry: joint debts across groups, or joint prepay —
     * shown even when nothing is due this month. */
    multiPay: combined.hasBundle,
    multiPayLabel:
      combined.total > 0
        ? `Pagar todo junto · ${combined.totalLabel} →`
        : "Pagar por adelantado en conjunto →",
    prepaidTotal: fmtBs(
      state.participants
        .filter((p) => p.user_id === state.profile.id)
        .reduce((a, p) => a + p.prepaid_balance, 0),
    ),
  };
}

/** Members of the current group (for the roster list). Non-admin viewers only
 * see their own payment status and amounts — fellow members' figures (cuota,
 * saldo, pagado/pendiente) are private to the admin. */
export function getMembers(state: State, accent: string) {
  const g = getCurrentGroup(state);
  const row = g ? state.groups.find((x) => x.id === g.id) : undefined;
  if (!g || !row) return [];
  return participantsOf(state, g.id).map((m) => {
    // What the member pays each month: their custom price converted live at
    // today's rate (so an edit shows immediately, even after this month's
    // charge froze its own cuota) or the group's default split.
    const per =
      m.custom_amount != null
        ? memberCuotaBs(
            m.custom_amount,
            m.custom_currency ?? row.currency,
            state.profile.exchange_rate,
            row.round_cuota,
          )
        : g.defaultPerBs;
    const hideDetails = !g.owned && !m.is_self;
    return {
      id: m.id,
      isSelf: m.is_self,
      name: m.name,
      sub: hideDetails
        ? (m.email ?? "")
        : [
            m.email,
            m.prepaid_balance > 0 ? `Saldo: ${fmtBs(m.prepaid_balance)}` : "",
            m.custom_amount != null ? `Cuota propia: ${fmtBs(per)}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
      av: m.is_self ? accent : m.color,
      /** Admin-set price override (null = default split). */
      customAmount: m.custom_amount,
      /** Currency the custom price is defined in (null = the group's currency). */
      customCurrency: m.custom_currency,
      /** The member's effective monthly cuota, formatted. */
      cuotaLabel: fmtBs(per),
      /** The member's effective monthly cuota in Bs (feeds the admin's donut). */
      cuotaBs: per,
      paid: m.paid,
      stLabel: hideDetails ? "" : m.paid ? "Pagado" : m.proof_pending ? "En revisión" : "Pendiente",
      stColor: m.paid ? "#36d07a" : m.proof_pending ? "#7ba6ff" : "#f5b53d",
      stBg: m.paid ? "rgba(54,208,122,0.14)" : m.proof_pending ? "rgba(123,166,255,0.14)" : "rgba(245,181,61,0.14)",
    };
  });
}

/** All pending proofs awaiting review in the current group (submission order). */
export function getApprovals(state: State) {
  const g = getCurrentGroup(state);
  if (!g) return [];
  return participantsOf(state, g.id)
    .filter((x) => x.proof_pending)
    .map((p) => {
      // Declared amount: the sum of the cycles being paid at each month's
      // frozen price (falls back to the current cuota for cycle-less proofs).
      const cycles = p.pay_cycles ?? [];
      const covered = state.charges.filter(
        (c) => c.participant_id === p.id && cycles.includes(c.cycle),
      );
      return {
      id: p.id,
      name: p.name,
      groupName: g.name,
      cuota: covered.length > 0 ? fmtBs(covered.reduce((a, c) => a + c.cuota, 0)) : g.cuota,
      plan: g.plan,
      proofUrl: p.proof_url,
      /** Months the receipt is paying (empty = the current month). */
      payCycles: cycles,
      /** Who submitted the proof when it wasn't the member themself. */
      payerName: p.proof_by && p.proof_by !== p.user_id ? payerLabel(state, g.id, p.proof_by) : null,
      /** Set when the submission is a prepay (amount in Bs + months declared). */
      prepayAmount: p.prepay_pending,
      prepayMonths: p.prepay_months,
      };
    });
}

/** The next pending proof (if any) awaiting review in the current group. */
export function getApproval(state: State) {
  return getApprovals(state)[0] ?? null;
}

/** Dashboard aggregates across all groups. */
export function getDashboard(state: State) {
  const groups = getGroups(state);
  const monthlySpend = groups.reduce((a, g) => a + g.perBs, 0);

  const spendBars = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    mono: g.mono,
    amount: fmtBs(g.perBs),
    pct: pct(g.perBs, monthlySpend),
  }));

  let adminCollected = 0;
  let adminTotal = 0;
  for (const g of groups) {
    if (!g.owned || !g.admin) continue;
    adminCollected += g.admin.collectedBs;
    adminTotal += g.admin.targetBs;
  }

  return {
    monthlySpend: fmtBs(monthlySpend),
    subCount: groups.length,
    ownedCount: groups.filter((g) => g.owned).length,
    toCollect: fmtBs(adminTotal - adminCollected),
    adminCollected: fmtBs(adminCollected),
    adminTotal: fmtBs(adminTotal),
    adminPct: pct(adminCollected, adminTotal),
    spendBars,
    cntPaid: groups.filter((g) => g.statusKey === "paid" || g.statusKey === "review").length,
    cntPend: groups.filter((g) => g.statusKey === "pending").length,
    cntVenc: groups.filter((g) => g.statusKey === "overdue").length,
  };
}

/** A participant's unpaid charges in a group (arrears + current month). */
export function getParticipantArrears(state: State, participantId: string | null) {
  const cur = currentCycle();
  const items = participantId
    ? state.charges
        .filter((c) => c.participant_id === participantId && !c.paid)
        .sort((a, b) => a.cycle.localeCompare(b.cycle))
        .map((c) => ({
          cycle: c.cycle,
          label: cycleLabel(c.cycle),
          cuota: c.cuota,
          cuotaLabel: fmtBs(c.cuota),
          isCurrent: c.cycle === cur,
        }))
    : [];
  const total = items.reduce((a, i) => a + i.cuota, 0);
  return {
    items,
    cycles: items.map((i) => i.cycle),
    count: items.length,
    /** True when something older than the current month is owed. */
    hasPast: items.some((i) => !i.isCurrent),
    total,
    totalLabel: fmtBs(total),
  };
}

/** The signed-in user's unpaid charges in a group (arrears + current month). */
export function getMyArrears(state: State, groupId: string) {
  const me = state.participants.find((p) => p.group_id === groupId && p.user_id === state.profile.id);
  return getParticipantArrears(state, me?.id ?? null);
}

/** Display name for the user who made a payment (resolved from the group's
 * roster, falling back to a generic label). Null when unknown/own payment. */
export function payerLabel(state: State, groupId: string, payerId: string | null) {
  if (!payerId) return null;
  if (payerId === state.profile.id) return "ti";
  const p = state.participants.find((x) => x.group_id === groupId && x.user_id === payerId);
  return p?.name ?? "otro miembro";
}

/** Everything payable together, bundled per administrator — for the combined
 * multi-group payment screen. Only groups the admin marked for joint payment
 * (`joint_pay`) enter a bundle; the rest are always paid individually. Each
 * bundle carries the owed groups (selectable) plus the joint groups the user
 * is up to date in, which can be prepaid in the same transaction. The user's
 * OWN joint groups form a bundle too: the admin registers their combined
 * payment instantly (no receipt, no review). */
export function getCombinedPay(state: State) {
  const jointGroups = state.groups.filter((g) => g.joint_pay);
  const views = new Map(state.groups.map((g) => [g.id, buildGroup(state, g)]));

  // Joint groups per administrator where the signed-in user holds a slot.
  const byOwner = new Map<string, GroupRow[]>();
  for (const g of jointGroups) {
    if (!state.participants.some((p) => p.group_id === g.id && p.user_id === state.profile.id)) continue;
    byOwner.set(g.owner_id, [...(byOwner.get(g.owner_id) ?? []), g]);
  }

  const bundles = [...byOwner.entries()]
    .map(([ownerId, ownerGroups]) => {
      const rows = ownerGroups.map((g) => {
        const me = state.participants.find(
          (p) => p.group_id === g.id && p.user_id === state.profile.id,
        )!;
        const owed = state.charges
          .filter((c) => c.participant_id === me.id && !c.paid)
          .sort((a, b) => a.cycle.localeCompare(b.cycle));
        return { g, me, owed, v: views.get(g.id)! };
      });

      // Groups with owed months (skipped while a proof is already in review).
      const items = rows
        .filter((r) => r.owed.length > 0 && !r.me.proof_pending)
        .map((r) => {
          const total = r.owed.reduce((a, c) => a + c.cuota, 0);
          return {
            participantId: r.me.id,
            groupId: r.g.id,
            name: r.v.name,
            mono: r.v.mono,
            color: r.v.color,
            cycles: r.owed.map((c) => c.cycle),
            total,
            totalLabel: fmtBs(total),
            monthsLabel: r.owed.map((c) => cycleShort(c.cycle)).join(", "),
          };
        });

      // Joint groups the user is current in — prepayable within the bundle
      // (nothing owed, nothing already in review).
      const prepayable = rows
        .filter((r) => r.owed.length === 0 && !r.me.proof_pending && r.me.prepay_pending == null)
        .map((r) => ({
          groupId: r.g.id,
          participantId: r.me.id,
          name: r.v.name,
          mono: r.v.mono,
          color: r.v.color,
          cuotaBs: r.v.perBs,
          cuotaLabel: r.v.cuota,
        }));

      // The bundle's single collection method: the group the admin marked as
      // the source (fallback: the first joint group with a QR, then the first).
      const source =
        ownerGroups.find((g) => g.joint_method) ??
        ownerGroups.find((g) => g.qr_image_url) ??
        ownerGroups[0];

      const total = items.reduce((a, i) => a + i.total, 0);
      return {
        ownerId,
        /** True when the bundle is the signed-in admin's own joint groups. */
        owned: ownerId === state.profile.id,
        total,
        totalLabel: fmtBs(total),
        chargeCount: items.reduce((a, i) => a + i.cycles.length, 0),
        groupCount: items.length,
        /** Collection method shared by the whole bundle (the source group's). */
        qrUrl: source?.qr_image_url ?? null,
        paypalInfo: source?.paypal_info ?? null,
        bankInfo: source?.bank_info ?? null,
        methodGroupName: source ? (views.get(source.id)?.name ?? source.name) : null,
        items,
        prepayable,
      };
    })
    // A bundle is useful with debts to pay or at least two prepayable groups.
    .filter((b) => b.items.length > 0 || b.prepayable.length >= 2)
    .sort((a, b) => b.total - a.total);

  const total = bundles.reduce((a, b) => a + b.total, 0);
  return {
    bundles,
    total,
    totalLabel: fmtBs(total),
    /** True when some bundle spans two or more groups (debts and/or prepays). */
    hasBundle: bundles.some((b) => b.items.length + b.prepayable.length >= 2),
    /** True when some admin collects the user's debts across several joint groups. */
    hasMultiGroup: bundles.some((b) => b.items.length > 1),
    /** True when a bundle offers joint prepay without any debt to settle. */
    hasJointPrepay: bundles.some((b) => b.items.length === 0 && b.prepayable.length >= 2),
  };
}

/** Upcoming months an advance payment would cover for the signed-in user in a
 * group (used by the Pay screen's prepay preview). */
export function getAdvancePreview(state: State, groupId: string, months: number) {
  const me = state.participants.find((p) => p.group_id === groupId && p.user_id === state.profile.id);
  const paidCycles = me
    ? state.charges.filter((c) => c.participant_id === me.id && c.paid).map((c) => c.cycle)
    : [];
  // A member marked paid without a charge row (e.g. just-created group) still
  // has this month covered — count it as settled for the preview.
  if (me?.paid && !paidCycles.includes(currentCycle())) paidCycles.push(currentCycle());
  const covered = advanceCoverage(paidCycles, currentCycle(), months);
  return { covered, coveredLabel: covered.map(cycleLabel).join(", ") };
}

/** Overdue-management filters (null = all). Member is keyed by display name so
 * the same person aggregates across the admin's groups. */
export interface OverdueFilters {
  groupId: string | null;
  cycle: string | null;
  member: string | null;
}

/** Cross-group overdue management for the groups the user administers: per
 * month, who paid and who still owes (with amounts), plus filter options and
 * totals for the current selection. */
export function getOverdue(state: State, filters: OverdueFilters) {
  const owned = state.groups.filter((g) => g.owner_id === state.profile.id);
  const views = new Map(owned.map((g) => [g.id, buildGroup(state, g)]));
  const roster = new Map(
    state.participants.filter((p) => views.has(p.group_id)).map((p) => [p.id, p]),
  );

  const all = state.charges.filter((c) => views.has(c.group_id) && roster.has(c.participant_id));

  // Filter options are derived from the unfiltered set so pickers stay stable.
  const groupOptions = owned.map((g) => ({ id: g.id, name: views.get(g.id)!.name }));
  const cycleOptions = [...new Set(all.map((c) => c.cycle))].sort().reverse();
  const memberOptions = [...new Set(all.map((c) => roster.get(c.participant_id)!.name))].sort((a, b) =>
    a.localeCompare(b),
  );

  const rows = all.filter(
    (c) =>
      (!filters.groupId || c.group_id === filters.groupId) &&
      (!filters.cycle || c.cycle === filters.cycle) &&
      (!filters.member || roster.get(c.participant_id)!.name === filters.member),
  );

  const cur = currentCycle();
  const byMonth = new Map<
    string,
    {
      cycle: string;
      label: string;
      isCurrent: boolean;
      paid: { id: string; participantId: string; name: string; color: string; groupName: string; cuotaLabel: string; payer: string | null }[];
      owing: { id: string; participantId: string; userId: string | null; name: string; color: string; groupName: string; cuota: number; cuotaLabel: string; overdue: boolean }[];
      owedTotal: number;
    }
  >();

  for (const c of rows) {
    const p = roster.get(c.participant_id)!;
    const v = views.get(c.group_id)!;
    const m = byMonth.get(c.cycle) ?? {
      cycle: c.cycle,
      label: cycleLabel(c.cycle),
      isCurrent: c.cycle === cur,
      paid: [],
      owing: [],
      owedTotal: 0,
    };
    if (c.paid) {
      m.paid.push({
        id: c.id,
        participantId: p.id,
        name: p.name,
        color: p.color,
        groupName: v.name,
        cuotaLabel: fmtBs(c.cuota),
        payer: c.paid_by && c.paid_by !== p.user_id ? payerLabel(state, c.group_id, c.paid_by) : null,
      });
    } else {
      m.owing.push({
        id: c.id,
        participantId: p.id,
        userId: p.user_id,
        name: p.name,
        color: p.color,
        groupName: v.name,
        cuota: c.cuota,
        cuotaLabel: fmtBs(c.cuota),
        overdue: c.cycle < cur,
      });
      m.owedTotal += c.cuota;
    }
    byMonth.set(c.cycle, m);
  }

  const months = [...byMonth.values()]
    .sort((a, b) => b.cycle.localeCompare(a.cycle))
    .map((m) => ({
      ...m,
      owedLabel: fmtBs(m.owedTotal),
      complete: m.owing.length === 0,
      paidCount: m.paid.length,
      totalCount: m.paid.length + m.owing.length,
    }));

  const charged = rows.reduce((a, c) => a + c.cuota, 0);
  const collected = rows.filter((c) => c.paid).reduce((a, c) => a + c.cuota, 0);
  return {
    months,
    groupOptions,
    cycleOptions,
    memberOptions,
    totals: {
      charged: fmtBs(charged),
      collected: fmtBs(collected),
      pending: fmtBs(charged - collected),
      pendingCount: rows.filter((c) => !c.paid).length,
    },
  };
}

/** Admin view of the current group's unpaid charges: by month and by member. */
export function getGroupArrears(state: State) {
  const g = getCurrentGroup(state);
  const empty = { byMonth: [], byMember: [], count: 0, totalLabel: fmtBs(0) };
  if (!g) return empty;
  const roster = new Map(participantsOf(state, g.id).map((p) => [p.id, p]));
  const unpaid = state.charges.filter((c) => c.group_id === g.id && !c.paid && roster.has(c.participant_id));
  if (unpaid.length === 0) return empty;

  const cur = currentCycle();
  const months = new Map<string, { cycle: string; label: string; cuotaLabel: string; isCurrent: boolean; members: { id: string; name: string; color: string }[] }>();
  const members = new Map<string, { id: string; name: string; color: string; userId: string | null; count: number; total: number; months: string[] }>();

  for (const c of unpaid) {
    const p = roster.get(c.participant_id)!;
    const m = months.get(c.cycle) ?? {
      cycle: c.cycle,
      label: cycleLabel(c.cycle),
      cuotaLabel: fmtBs(c.cuota),
      isCurrent: c.cycle === cur,
      members: [],
    };
    m.members.push({ id: p.id, name: p.name, color: p.color });
    months.set(c.cycle, m);

    const e = members.get(p.id) ?? {
      id: p.id,
      name: p.name,
      color: p.color,
      userId: p.user_id,
      count: 0,
      total: 0,
      months: [],
    };
    e.count += 1;
    e.total += c.cuota;
    e.months.push(cycleShort(c.cycle));
    members.set(p.id, e);
  }

  return {
    byMonth: [...months.values()].sort((a, b) => a.cycle.localeCompare(b.cycle)),
    byMember: [...members.values()]
      .sort((a, b) => b.total - a.total)
      .map((m) => ({ ...m, totalLabel: fmtBs(m.total), monthsLabel: m.months.join(", ") })),
    count: unpaid.length,
    totalLabel: fmtBs(unpaid.reduce((a, c) => a + c.cuota, 0)),
  };
}

/** The signed-in user's prepaid state in one group (null when not a member). */
export function getMyPrepaid(state: State, groupId: string) {
  const p = state.participants.find((x) => x.group_id === groupId && x.user_id === state.profile.id);
  if (!p) return null;
  return {
    balance: p.prepaid_balance,
    balanceLabel: fmtBs(p.prepaid_balance),
    pendingAmount: p.prepay_pending,
    pendingMonths: p.prepay_months,
  };
}

/** Prepaid-balances screen figures: the user's balance per group, plus the
 * balances of roster members in the groups they administer. */
export function getPrepaid(state: State) {
  const rate = state.profile.exchange_rate;
  const rows = state.groups
    .map((g) => {
      const view = buildGroup(state, g);
      const mine = getMyPrepaid(state, g.id);
      if (!mine) return null;
      return {
        id: g.id,
        name: view.name,
        mono: view.mono,
        color: view.color,
        cuota: view.cuota,
        balance: mine.balance,
        balanceLabel: mine.balanceLabel,
        monthsCover: view.perBs > 0 ? Math.floor(mine.balance / view.perBs) : 0,
        pendingAmount: mine.pendingAmount,
        pendingMonths: mine.pendingMonths,
        owned: view.owned,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Members with prepaid activity in the groups this user administers.
  const memberRows = state.groups
    .filter((g) => g.owner_id === state.profile.id)
    .flatMap((g) =>
      participantsOf(state, g.id)
        .filter((p) => !p.is_self && (p.prepaid_balance > 0 || p.prepay_pending != null))
        .map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          groupName: g.name || SERVICE_META[g.service_id].name,
          balanceLabel: fmtBs(p.prepaid_balance),
          pendingMonths: p.prepay_months,
          pending: p.prepay_pending != null,
        })),
    );

  const total = rows.reduce((a, r) => a + r.balance, 0);
  return {
    total: fmtBs(total),
    totalUsd: `≈ ${fmtUsd(total / rate)}`,
    rows,
    memberRows,
  };
}

/** Compact relative label for a notification timestamp. */
function relTime(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
}

/** Number of unread persisted notifications (bell badge). */
export function getUnreadCount(state: State) {
  return state.notifications.filter((n) => !n.read).length;
}

/** Unified activity feed: persisted notifications plus items derived from group state. */
export function getActivity(state: State) {
  const groups = getGroups(state);
  const items: {
    mono: string;
    color: string;
    title: string;
    body: string;
    time: string;
    action: boolean;
    groupId: string;
    unread?: boolean;
  }[] = [];

  // Persisted notifications first (newest first, e.g. monthly charges).
  const byId = new Map(groups.map((g) => [g.id, g]));
  for (const n of state.notifications) {
    const g = n.group_id ? byId.get(n.group_id) : undefined;
    items.push({
      mono: g?.mono ?? "!",
      color: g?.color ?? colors.info,
      title: n.title,
      body: n.body,
      time: relTime(n.created_at),
      action: false,
      groupId: n.group_id ?? "",
      unread: !n.read,
    });
  }

  for (const g of groups) {
    if (g.owned) {
      const pending = participantsOf(state, g.id).find((p) => p.proof_pending);
      if (pending) {
        items.push({
          mono: g.mono,
          color: g.color,
          title: "Nuevo comprobante por revisar",
          body: `${pending.name} subió su comprobante en ${g.name}.`,
          time: "hace 2 h",
          action: true,
          groupId: g.id,
        });
      }
    }
  }
  for (const g of groups) {
    if (g.statusKey === "overdue") {
      items.push({ mono: g.mono, color: g.color, title: `${g.name} vencido`, body: `Tu cuota de ${g.cuota} está vencida.`, time: "ayer", action: false, groupId: g.id });
    } else if (g.statusKey === "pending") {
      items.push({ mono: g.mono, color: g.color, title: `Saldo pendiente · ${g.name}`, body: `Aún debes ${g.cuota} de la cuota de junio.`, time: "hace 3 h", action: false, groupId: g.id });
    }
  }
  return items;
}

/** Live-calculated fields for the Edit-cost screen. */
export function getEditView(state: State) {
  const group = state.groups.find((g) => g.id === state.editGroupId);
  const baseMeta = SERVICE_META[group?.service_id ?? state.selService];
  const meta = group
    ? {
        ...baseMeta,
        name: group.name || baseMeta.name,
        color: group.color ?? baseMeta.color,
        mono:
          group.service_id === "others"
            ? group.name.trim().charAt(0).toUpperCase() || baseMeta.mono
            : baseMeta.mono,
      }
    : baseMeta;
  const rate = state.profile.exchange_rate;
  const amt = parseFloat(state.editAmount) || 0;
  const totalBs = state.editCur === "USD" ? amt * rate : amt;
  const n = Math.max(1, state.editMembers);
  const per = state.editRound ? Math.ceil(totalBs / n) : totalBs / n;
  const surplus = per * n - totalBs;
  return {
    meta,
    isUsd: state.editCur === "USD",
    perBs: fmtBs(per),
    totalBs: fmtBs(totalBs),
    /** Extra collected per month when rounding is on ("" when negligible). */
    roundNote: state.editRound && surplus >= 0.01 ? `Redondeo: se cobran ${fmtBs(surplus)} extra al mes` : "",
    rateLabel: `1 USD = ${fmtBs(rate)}`,
    usdLine:
      state.editCur === "USD"
        ? `Equivale a ${fmtUsd(amt)} total · ${fmtUsd(amt / Math.max(1, state.editMembers))} por persona`
        : "",
  };
}

/** Per-field validation errors for the cost editor (empty string = valid). */
export function getEditErrors(state: State) {
  const amt = parseFloat(state.editAmount);
  const day = parseInt(state.editBillingDay, 10);
  const roster = state.participants.filter((p) => p.group_id === state.editGroupId).length;
  const amount =
    !state.editAmount.trim() || !Number.isFinite(amt) || amt <= 0
      ? "Ingresa un costo mayor a 0"
      : amt > 100000
        ? "El costo es demasiado alto"
        : "";
  const members =
    state.editMembers < roster ? `La lista ya tiene ${roster} miembros · no puede ser menor` : "";
  const billingDay =
    !state.editBillingDay.trim() || !Number.isInteger(day) || day < 1 || day > 31
      ? "Elige un día entre 1 y 31"
      : "";
  return { amount, members, billingDay, valid: !amount && !members && !billingDay };
}

/** Payment history for the current group, built from the charges ledger.
 * Admins see, per month, how much was collected vs. the target (at that
 * month's frozen cuota) and who paid; members see their own months. */
export function getHistory(state: State) {
  const g = getCurrentGroup(state);
  if (!g) return null;
  const me = state.participants.find((p) => p.group_id === g.id && p.user_id === state.profile.id);
  const roster = new Map(participantsOf(state, g.id).map((p) => [p.id, p]));

  const relevant = state.charges.filter(
    (c) => c.group_id === g.id && roster.has(c.participant_id) && (g.owned || c.participant_id === me?.id),
  );
  const byCycle = new Map<string, typeof relevant>();
  for (const c of relevant) byCycle.set(c.cycle, [...(byCycle.get(c.cycle) ?? []), c]);

  const months = [...byCycle.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cycle, rows]) => {
      const cuota = rows[0].cuota;
      const paidRows = rows.filter((r) => r.paid);
      // Sum per row: members may have custom prices, so cuotas can differ.
      const target = rows.reduce((a, r) => a + r.cuota, 0);
      const collected = paidRows.reduce((a, r) => a + r.cuota, 0);
      const uniform = rows.every((r) => r.cuota === cuota);
      return {
        cycle,
        monthShort: cycleShort(cycle),
        label: cycleLabel(cycle),
        cuota,
        cuotaLabel: uniform ? fmtBs(cuota) : "varias",
        target,
        collected,
        collectedLabel: fmtBs(collected),
        pendingLabel: fmtBs(target - collected),
        paidCount: paidRows.length,
        totalCount: rows.length,
        complete: paidRows.length === rows.length,
        detail: rows
          .map((r) => {
            const p = roster.get(r.participant_id)!;
            return {
              id: p.id,
              name: p.name,
              color: p.color,
              paid: r.paid,
              /** Who paid, when it wasn't the member themself. */
              payer: r.paid_by && r.paid_by !== p.user_id ? payerLabel(state, g.id, r.paid_by) : null,
            };
          })
          .sort((a, b) => Number(a.paid) - Number(b.paid)),
      };
    });

  const totalCollected = months.reduce((a, m) => a + m.collected, 0);
  const totalPending = months.reduce((a, m) => a + (m.target - m.collected), 0);
  return {
    group: g,
    owned: g.owned,
    months,
    maxTarget: Math.max(1, ...months.map((m) => m.target)),
    totalLabel: fmtBs(totalCollected),
    pendingLabel: fmtBs(totalPending),
    caption: g.owned ? "cobros por mes" : "tus cuotas por mes",
    totalCaption: g.owned ? "Total cobrado" : "Total pagado",
  };
}

/** Denormalized export of the current group's charge ledger (admin only):
 * rows for the CSV plus the ids of paid rows, which are the only ones that
 * may be archived after exporting. */
export function getChargesExport(state: State) {
  const g = getCurrentGroup(state);
  if (!g || !g.owned) return null;
  const roster = new Map(participantsOf(state, g.id).map((p) => [p.id, p]));
  const charges = state.charges
    .filter((c) => c.group_id === g.id && roster.has(c.participant_id))
    .sort((a, b) => a.cycle.localeCompare(b.cycle));
  return {
    fileName: `${(g.name || "grupo").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-pagos.csv`,
    rows: charges.map((c) => {
      const p = roster.get(c.participant_id)!;
      return {
        group: g.name,
        cycle: c.cycle,
        member: p.name,
        cuota: c.cuota,
        paid: c.paid,
        paidAt: c.paid_at,
        paidBy: c.paid_by && c.paid_by !== p.user_id ? payerLabel(state, g.id, c.paid_by) : null,
      };
    }),
    paidIds: charges.filter((c) => c.paid).map((c) => c.id),
    count: charges.length,
  };
}

/** Live-calculated fields for the Create-group screen. */
export function getCreateView(state: State) {
  const amt = parseFloat(state.createAmount) || 0;
  const members = Math.max(1, parseInt(state.createMembers, 10) || 1);
  const rate = state.profile.exchange_rate;
  const totalBs = state.createCur === "USD" ? amt * rate : amt;
  return { perBs: fmtBs(totalBs / members), isUsd: state.createCur === "USD", meta: SERVICE_META[state.selService] };
}

/** Title shown in the back bar for the current screen. */
export function getBackTitle(state: State): string {
  if (state.screen === "group") return getCurrentGroup(state)?.name ?? "";
  return BACK_TITLE[state.screen] ?? "";
}

/** Status style tuple for a status key. */
export function statusStyle(key: StatusKey) {
  return STATUS[key];
}
