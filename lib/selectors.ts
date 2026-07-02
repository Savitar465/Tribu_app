import { SERVICE_META } from "./data";
import { fmtBs, fmtUsd, pct } from "./format";
import { BACK_TITLE } from "./navigation";
import type { State } from "./store";
import type { GroupRow } from "./db/types";
import { STATUS, colors, type StatusKey } from "./theme";
import type { GroupView } from "./types";

/** Participants of a group, ordered. */
function participantsOf(state: State, groupId: string) {
  return state.participants.filter((p) => p.group_id === groupId).sort((a, b) => a.sort - b.sort);
}

/** A group's cost figures in bolivianos at the current rate. */
function costOf(group: GroupRow, rate: number) {
  const totalBs = group.currency === "USD" ? group.amount * rate : group.amount;
  return { totalBs, per: totalBs / Math.max(1, group.members_target), isUsd: group.currency === "USD" };
}

/** Build the presentational view of a group row. */
export function buildGroup(state: State, group: GroupRow): GroupView {
  const meta = SERVICE_META[group.service_id];
  const rate = state.profile.exchange_rate;
  const k = costOf(group, rate);
  const owned = group.owner_id === state.profile.id;
  // The viewer's own roster row (owner or member) drives their cuota status.
  const myRow = state.participants.find((p) => p.group_id === group.id && p.user_id === state.profile.id);
  const statusKey: StatusKey = myRow
    ? myRow.proof_pending
      ? "review"
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
    cuota: fmtBs(k.per),
    monthly: fmtBs(k.totalBs),
    members: String(group.members_target),
    usdNote: k.isUsd ? `≈ ${fmtUsd(group.amount / group.members_target)}/persona · cobrado en USD` : "",
    isUsd: k.isUsd,
    perBs: k.per,
    totalBs: k.totalBs,
  };

  if (owned) {
    const paid = participantsOf(state, group.id).filter((p) => p.paid).length;
    const collected = paid * k.per;
    view.admin = {
      collected: fmtBs(collected),
      pending: fmtBs(k.totalBs - collected),
      total: fmtBs(k.totalBs),
      pct: pct(collected, k.totalBs),
      pendingCount: String(group.members_target - paid),
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
  return {
    ...getProfileView(state),
    groups,
    hasGroups: groups.length > 0,
    payDue: fmtBs(due),
    dueCount: groups.filter((g) => g.statusKey === "pending" || g.statusKey === "overdue").length,
    walletBalance: fmtBs(state.wallet.balance),
  };
}

/** Members of the current group (for the roster list). */
export function getMembers(state: State, accent: string) {
  const g = getCurrentGroup(state);
  if (!g) return [];
  return participantsOf(state, g.id).map((m) => ({
    id: m.id,
    isSelf: m.is_self,
    name: m.name,
    sub: m.email ?? "",
    av: m.is_self ? accent : m.color,
    paid: m.paid,
    stLabel: m.paid ? "Pagado" : "Pendiente",
    stColor: m.paid ? "#36d07a" : "#f5b53d",
    stBg: m.paid ? "rgba(54,208,122,0.14)" : "rgba(245,181,61,0.14)",
  }));
}

/** The pending proof (if any) awaiting review in the current group. */
export function getApproval(state: State) {
  const g = getCurrentGroup(state);
  if (!g) return null;
  const p = participantsOf(state, g.id).find((x) => x.proof_pending);
  if (!p) return null;
  return { id: p.id, name: p.name, groupName: g.name, cuota: g.cuota, plan: g.plan };
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
    const paid = participantsOf(state, g.id).filter((p) => p.paid).length;
    adminCollected += paid * g.perBs;
    adminTotal += g.totalBs;
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

/** Wallet screen figures. */
export function getWallet(state: State) {
  const rate = state.profile.exchange_rate;
  // Scheduled charges and the monthly commitment are derived from the user's
  // real groups (per-member cuota + billing due), not a hardcoded catalog.
  const views = state.groups.map((g) => buildGroup(state, g));
  const monthlyCommit = views.reduce((a, g) => a + g.perBs, 0);
  const scheduled = views.map((g) => ({
    id: g.id,
    label: g.name,
    date: g.due,
    color: g.color,
    mono: g.mono,
    amount: g.cuota,
  }));

  const transactions = state.transactions.map((t) => ({
    id: t.id,
    label: t.label,
    sub: t.sub ?? "",
    amount: `${t.amount >= 0 ? "+" : "−"}${fmtBs(Math.abs(t.amount))}`,
    color: t.amount >= 0 ? colors.positive : colors.textMuted,
  }));

  return {
    balance: fmtBs(state.wallet.balance),
    balanceUsd: `≈ ${fmtUsd(state.wallet.balance / rate)}`,
    autoFund: state.wallet.auto_fund,
    monthlyCommit: fmtBs(monthlyCommit),
    monthsCover: monthlyCommit > 0 ? String(Math.floor(state.wallet.balance / monthlyCommit)) : "∞",
    rateLabel: `1 USD = ${fmtBs(rate)}`,
    scheduled,
    transactions,
  };
}

/** Unified activity feed derived from group state. */
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
  }[] = [];

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
  const per = totalBs / Math.max(1, state.editMembers);
  return {
    meta,
    isUsd: state.editCur === "USD",
    perBs: fmtBs(per),
    totalBs: fmtBs(totalBs),
    rateLabel: `1 USD = ${fmtBs(rate)}`,
    usdLine:
      state.editCur === "USD"
        ? `Equivale a ${fmtUsd(amt)} total · ${fmtUsd(amt / Math.max(1, state.editMembers))} por persona`
        : "",
  };
}

/** Live-calculated fields for the Deposit screen. */
export function getDepositView(state: State) {
  const rate = state.profile.exchange_rate;
  const amt = parseFloat(state.depAmount) || 0;
  const bs = state.depCur === "USD" ? amt * rate : amt;
  return {
    isUsd: state.depCur === "USD",
    rateLabel: `1 USD = ${fmtBs(rate)}`,
    result:
      state.depCur === "USD" ? `Se acreditarán ${fmtBs(bs)} al fondo (al cambio actual)` : `Depósito de ${fmtBs(bs)}`,
  };
}

/** Payment history for the current group. */
export function getHistory(state: State) {
  const g = getCurrentGroup(state);
  if (!g) return null;
  const rows = state.payments
    .filter((p) => p.group_id === g.id)
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({
      key: p.id,
      month: p.month,
      ok: p.ok,
      mark: p.ok ? "✓" : "✕",
      color: p.ok ? colors.positive : colors.danger,
      bg: p.ok ? "rgba(54,208,122,0.12)" : "rgba(255,107,107,0.12)",
      amount: g.cuota,
    }));
  const paidCount = rows.filter((r) => r.ok).length;
  return {
    group: g,
    rows,
    total: fmtBs(paidCount * g.perBs),
    year: 2026,
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
