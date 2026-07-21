"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";
import * as api from "@/lib/db/api";
import type { ProfileMatch } from "@/lib/db/api";
import type { AppData, ChargeRow, GroupPaymentRow, GroupRow, NotificationRow, OwnerProfileRow, ParticipantRow, WalletTxRow } from "@/lib/db/types";
import { MEMBER_COLORS, SERVICE_META } from "@/lib/data";
import { getOfficialRate } from "@/lib/rates";
import { fmtBs, sanitizeNumeric } from "@/lib/format";
import { BACK_MAP } from "@/lib/navigation";
import { checkCustomPrice, checkCustomPct, imageUploadError, memberCuotaBs, memberCuotaFromPct } from "@/lib/paylogic";
import { buildGroup, currentCycle, cycleLabel, getEditErrors, getMemberCuota } from "@/lib/selectors";
import type { Currency, Screen, ServiceId } from "@/lib/types";

/** Full UI state: the fetched data plus transient navigation/draft state. */
export interface State {
  // --- data (source of truth, synced with Supabase) ---
  profile: AppData["profile"];
  groups: GroupRow[];
  participants: ParticipantRow[];
  payments: GroupPaymentRow[];
  charges: ChargeRow[];
  wallet: AppData["wallet"];
  transactions: WalletTxRow[];
  notifications: NotificationRow[];
  /** Display names of the owners of the user's groups. */
  ownerProfiles: OwnerProfileRow[];

  // --- navigation ---
  screen: Screen;
  /** Group currently open in the detail view (uuid). */
  agId: string | null;

  // --- drafts ---
  selService: ServiceId;
  editGroupId: string | null;
  editAmount: string;
  editCur: Currency;
  editMembers: number;
  /** Draft billing day (1..31) for the group being edited. */
  editBillingDay: string;
  /** Draft "round each cuota up to a whole Bs" flag for the group being edited. */
  editRound: boolean;
  /** Draft "the price changes every month" flag for the group being edited. */
  editVarPrice: boolean;
  rateDraft: string;
  /** True while fetching the official BCB rate. */
  rateLoading: boolean;
  /** Latest official USD→BOB rate from the BCB API (null until fetched). */
  officialRate: number | null;
  /** Date the official rate is in force (yyyy-mm-dd). */
  officialFecha: string;
  createName: string;
  createAmount: string;
  createMembers: string;
  createBillingDay: string;
  createCur: Currency;
  /** Brand color for a custom ("others") group. */
  createColor: string;
  /** Whether the creating admin occupies a subscription slot (self row). */
  createAdminIn: boolean;
  /** Whether the new group's price changes every month (confirmed before billing). */
  createVarPrice: boolean;
  /** Draft input (name or email) for the add-member modal. */
  memberDraft: string;

  // --- toast ---
  toast: string;
  toastKey: number;
}

function initState(data: AppData): State {
  return {
    profile: data.profile,
    groups: data.groups,
    participants: data.participants,
    payments: data.payments,
    charges: data.charges,
    wallet: data.wallet,
    transactions: data.transactions,
    notifications: data.notifications,
    ownerProfiles: data.ownerProfiles,
    screen: "home",
    agId: data.groups[0]?.id ?? null,
    selService: "spotify",
    editGroupId: null,
    editAmount: "",
    editCur: "BOB",
    editMembers: 1,
    editBillingDay: "5",
    editRound: false,
    editVarPrice: false,
    rateDraft: String(data.profile.exchange_rate),
    rateLoading: false,
    officialRate: null,
    officialFecha: "",
    createName: SERVICE_META.spotify.name,
    createAmount: "60",
    createMembers: "6",
    createBillingDay: "5",
    createCur: "BOB",
    createColor: MEMBER_COLORS[0],
    createAdminIn: true,
    createVarPrice: false,
    memberDraft: "",
    toast: "",
    toastKey: 0,
  };
}

type Action =
  | { type: "navigate"; screen: Screen }
  | { type: "open"; id: string }
  | { type: "reviewGroup"; id: string }
  | { type: "flash"; msg: string }
  | { type: "clearToast" }
  | { type: "selectService"; id: ServiceId }
  | { type: "beginEdit"; id: string }
  | { type: "setEditAmount"; value: string }
  | { type: "setEditCur"; cur: Currency }
  | { type: "bumpMembers"; delta: number }
  | { type: "setEditBillingDay"; value: string }
  | { type: "setEditRound"; value: boolean }
  | { type: "setEditVarPrice"; value: boolean }
  | { type: "openFx" }
  | { type: "setRateDraft"; value: string }
  | { type: "presetRate"; value: number }
  | { type: "setRateLoading"; value: boolean }
  | { type: "setOfficial"; rate: number; fecha: string }
  | { type: "applyOfficialSync"; rate: number; syncedOn: string }
  | { type: "setCreate"; field: "name" | "amount" | "members" | "billingDay"; value: string }
  | { type: "setCreateCur"; cur: Currency }
  | { type: "setCreateColor"; color: string }
  | { type: "setCreateAdminIn"; value: boolean }
  | { type: "setCreateVarPrice"; value: boolean }
  | { type: "setMemberDraft"; value: string }
  // applied after a successful persist:
  | { type: "applyAddParticipant"; participant: ParticipantRow; members: number }
  | { type: "applyRemoveParticipant"; participantId: string }
  | { type: "applyRenameMember"; participantId: string; name: string }
  | { type: "applyMoveMember"; a: { id: string; sort: number }; b: { id: string; sort: number } }
  | { type: "applyMemberPaid"; participantId: string; paid: boolean }
  | { type: "applyMemberPrice"; participantId: string; amount: number | null; currency: Currency | null; pct: number | null }
  | { type: "applyGroupCost"; groupId: string; amount: number; currency: Currency; members: number; billingDay: number; due: string; round: boolean; billedCuota: number | null; variablePrice: boolean }
  | { type: "applyPriceConfirmed"; groupId: string; amount: number; cycle: string }
  | { type: "applyPriceRequested"; groupId: string; cycle: string }
  | { type: "applyGroupQr"; groupId: string; url: string | null }
  | { type: "applyGroupPayMethods"; groupId: string; paypal: string | null; bank: string | null }
  | { type: "applyJointPay"; groupId: string; jointPay: boolean }
  | { type: "applyJointMethod"; ownerId: string; groupId: string }
  | { type: "applyRate"; rate: number }
  | { type: "applySubmitPay"; participantId: string; proofUrl: string | null; cycles: string[]; proofBy: string | null }
  | { type: "applyAdminPay"; participantId: string; paidNow: boolean }
  | { type: "applyCombinedPay"; items: { participantId: string; cycles: string[] }[]; prepays: { participantId: string; amount: number; months: number }[]; proofUrl: string | null }
  | { type: "applyCombinedAdmin"; items: { participantId: string; cycles: string[] }[]; prepays: { participantId: string; balance: number; paid: boolean }[] }
  | { type: "applyAdminParticipation"; groupId: string; participate: boolean; participant: ParticipantRow | null; removedId: string | null }
  | { type: "setCharges"; charges: ChargeRow[] }
  | { type: "applyChargesPaid"; participantId: string; cycles: string[]; paid: boolean; paidBy?: string | null }
  | { type: "applyChargeCuota"; participantId: string; cycle: string; cuota: number }
  | { type: "applySubmitPrepay"; participantId: string; amount: number; months: number; proofUrl: string }
  | { type: "applyAdminPrepay"; participantId: string; balance: number; paid: boolean }
  | { type: "applyReview"; participantId: string; paid: boolean }
  | { type: "applyPrepayReview"; participantId: string; approved: boolean; balance: number; paid: boolean }
  | { type: "applyParticipantBilling"; participantId: string; balance: number; paid: boolean; cycle: string }
  | { type: "applyCreateGroup"; group: GroupRow; participants: ParticipantRow[] }
  | { type: "applyDeleteGroup"; groupId: string }
  | { type: "applyBilledCycle"; groupId: string; cycle: string; cuota: number; rate: number | null }
  | { type: "setNotifications"; notifications: NotificationRow[] }
  | { type: "markNotificationsRead" }
  | { type: "hydrate"; data: AppData };

function flash(state: State, msg: string): State {
  return { ...state, toast: msg, toastKey: state.toastKey + 1 };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "navigate":
      return { ...state, screen: action.screen };
    case "open":
      return { ...state, screen: "group", agId: action.id };
    case "reviewGroup":
      return { ...state, screen: "approve", agId: action.id };
    case "flash":
      return flash(state, action.msg);
    case "clearToast":
      return { ...state, toast: "" };

    case "selectService": {
      const meta = SERVICE_META[action.id];
      // Custom groups start with a blank name so the user types their own.
      return { ...state, selService: action.id, createName: action.id === "others" ? "" : meta.name };
    }
    // Seed the cost-editor drafts from the group row (no navigation — the
    // editor lives inline on the admin screen).
    case "beginEdit": {
      const g = state.groups.find((x) => x.id === action.id);
      if (!g) return state;
      return {
        ...state,
        editGroupId: g.id,
        editAmount: String(g.amount),
        editCur: g.currency,
        editMembers: g.members_target,
        editBillingDay: String(g.billing_day),
        editRound: g.round_cuota,
        editVarPrice: g.variable_price,
      };
    }
    case "setEditAmount":
      return { ...state, editAmount: sanitizeNumeric(action.value) };
    case "setEditCur":
      return { ...state, editCur: action.cur };
    case "bumpMembers":
      return { ...state, editMembers: Math.max(1, Math.min(50, state.editMembers + action.delta)) };
    case "setEditBillingDay":
      return { ...state, editBillingDay: sanitizeNumeric(action.value) };
    case "setEditRound":
      return { ...state, editRound: action.value };
    case "setEditVarPrice":
      return { ...state, editVarPrice: action.value };

    case "openFx":
      return { ...state, screen: "fx", rateDraft: String(state.profile.exchange_rate) };
    case "setRateDraft":
      return { ...state, rateDraft: sanitizeNumeric(action.value) };
    case "presetRate":
      return { ...state, rateDraft: String(action.value) };
    case "setRateLoading":
      return { ...state, rateLoading: action.value };
    case "setOfficial":
      return { ...state, officialRate: action.rate, officialFecha: action.fecha };
    case "applyOfficialSync":
      return flash(
        {
          ...state,
          profile: { ...state.profile, exchange_rate: action.rate, rate_synced_on: action.syncedOn },
          rateDraft: String(action.rate),
        },
        `Tipo de cambio oficial actualizado: ${action.rate} Bs`,
      );

    case "setCreate": {
      const key = { name: "createName", amount: "createAmount", members: "createMembers", billingDay: "createBillingDay" }[
        action.field
      ] as "createName" | "createAmount" | "createMembers" | "createBillingDay";
      const value = action.field === "name" ? action.value : sanitizeNumeric(action.value);
      return { ...state, [key]: value };
    }
    case "setCreateCur":
      return { ...state, createCur: action.cur };
    case "setCreateColor":
      return { ...state, createColor: action.color };
    case "setCreateAdminIn":
      return { ...state, createAdminIn: action.value };
    case "setCreateVarPrice":
      return { ...state, createVarPrice: action.value };
    case "setMemberDraft":
      return { ...state, memberDraft: action.value };

    case "applyAddParticipant": {
      const groups = state.groups.map((g) =>
        g.id === action.participant.group_id ? { ...g, members_target: action.members } : g,
      );
      return flash(
        { ...state, groups, participants: [...state.participants, action.participant], memberDraft: "" },
        `${action.participant.name} agregado al grupo`,
      );
    }
    case "applyRemoveParticipant": {
      const participants = state.participants.filter((p) => p.id !== action.participantId);
      return flash({ ...state, participants }, "Miembro eliminado del grupo");
    }
    case "applyRenameMember": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId ? { ...p, name: action.name } : p,
      );
      return flash({ ...state, participants }, "Nombre actualizado");
    }
    case "applyMoveMember": {
      const participants = state.participants.map((p) => {
        if (p.id === action.a.id) return { ...p, sort: action.a.sort };
        if (p.id === action.b.id) return { ...p, sort: action.b.sort };
        return p;
      });
      return { ...state, participants };
    }
    case "applyMemberPaid": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId ? { ...p, paid: action.paid, proof_pending: false } : p,
      );
      return flash({ ...state, participants }, action.paid ? "Marcado como pagado" : "Marcado como pendiente");
    }

    case "applyMemberPrice": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? {
              ...p,
              custom_amount: action.pct != null ? null : action.amount,
              custom_currency: action.pct != null ? null : (action.amount == null ? null : action.currency),
              custom_pct: action.pct,
            }
          : p,
      );
      const msg = action.pct != null
        ? `Cuota ${action.pct}% guardada`
        : action.amount != null
          ? "Cuota personalizada guardada"
          : "Cuota personalizada eliminada";
      return flash({ ...state, participants }, msg);
    }

    case "applyGroupCost": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId
          ? {
              ...g,
              amount: action.amount,
              currency: action.currency,
              members_target: action.members,
              billing_day: action.billingDay,
              due: action.due,
              round_cuota: action.round,
              billed_cuota: action.billedCuota,
              variable_price: action.variablePrice,
            }
          : g,
      );
      return flash({ ...state, groups }, "Costo mensual actualizado");
    }
    // The admin confirmed a variable-price group's amount for this cycle —
    // the billing gate opens and the charge runs right after.
    case "applyPriceConfirmed": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, amount: action.amount, price_confirmed_cycle: action.cycle } : g,
      );
      return flash({ ...state, groups }, "Precio del mes confirmado · generando el cobro");
    }
    case "applyPriceRequested": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, price_request_cycle: action.cycle } : g,
      );
      return { ...state, groups };
    }
    case "applyGroupQr": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, qr_image_url: action.url } : g,
      );
      return flash({ ...state, groups }, action.url ? "QR de cobro actualizado" : "QR de cobro eliminado");
    }
    case "applyGroupPayMethods": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, paypal_info: action.paypal, bank_info: action.bank } : g,
      );
      return flash({ ...state, groups }, "Métodos de cobro actualizados");
    }
    case "applyJointPay": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, joint_pay: action.jointPay } : g,
      );
      return flash(
        { ...state, groups },
        action.jointPay
          ? "Este grupo ahora se puede pagar en conjunto"
          : "Este grupo se paga por separado",
      );
    }
    // One group per owner is the joint bundle's collection method.
    case "applyJointMethod": {
      const groups = state.groups.map((g) =>
        g.owner_id === action.ownerId ? { ...g, joint_method: g.id === action.groupId } : g,
      );
      return flash({ ...state, groups }, "Método de cobro del conjunto actualizado");
    }
    case "applyRate":
      return flash(
        { ...state, profile: { ...state.profile, exchange_rate: action.rate }, screen: "wallet" },
        "Tipo de cambio actualizado",
      );
    case "applySubmitPay": {
      const target = state.participants.find((p) => p.id === action.participantId);
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? { ...p, proof_pending: true, proof_url: action.proofUrl, pay_cycles: action.cycles, proof_by: action.proofBy }
          : p,
      );
      const msg = action.proofBy
        ? `Pago de ${target?.name ?? "otro miembro"} enviado · pendiente de validación`
        : action.cycles.length > 1
          ? `Comprobante de ${action.cycles.length} meses enviado · pendiente de validación`
          : "Comprobante enviado · pendiente de validación";
      return flash({ ...state, participants, screen: "group" }, msg);
    }
    // Admin payment (own cuota or on behalf of a member): approved on the spot,
    // no receipt/review round-trip.
    case "applyAdminPay": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? { ...p, paid: action.paidNow ? true : p.paid, proof_pending: false, pay_cycles: null, proof_by: null }
          : p,
      );
      return flash({ ...state, participants, screen: "group" }, "Pago registrado ✓");
    }
    // Combined payment: every bundled roster row (owed months and prepays
    // alike) goes into review at once, sharing one receipt.
    case "applyCombinedPay": {
      const byId = new Map(action.items.map((i) => [i.participantId, i.cycles]));
      const preById = new Map(action.prepays.map((i) => [i.participantId, i]));
      const participants = state.participants.map((p) => {
        if (byId.has(p.id)) {
          return { ...p, proof_pending: true, proof_url: action.proofUrl, pay_cycles: byId.get(p.id)!, proof_by: null };
        }
        const pre = preById.get(p.id);
        if (pre) {
          return { ...p, proof_pending: true, proof_url: action.proofUrl, prepay_pending: pre.amount, prepay_months: pre.months };
        }
        return p;
      });
      const n = action.items.length + action.prepays.length;
      return flash(
        { ...state, participants, screen: "home" },
        `Pago combinado enviado · ${n} ${n === 1 ? "grupo" : "grupos"} en revisión`,
      );
    }
    // The admin's own combined payment: approved on the spot — debts settled,
    // prepay balances credited, no review round-trip.
    case "applyCombinedAdmin": {
      const payById = new Map(action.items.map((i) => [i.participantId, i.cycles]));
      const preById = new Map(action.prepays.map((i) => [i.participantId, i]));
      const cur = currentCycle();
      const participants = state.participants.map((p) => {
        const cycles = payById.get(p.id);
        if (cycles) {
          return { ...p, paid: cycles.includes(cur) ? true : p.paid, proof_pending: false, pay_cycles: null, proof_by: null };
        }
        const pre = preById.get(p.id);
        if (pre) return { ...p, prepaid_balance: pre.balance, paid: pre.paid };
        return p;
      });
      const n = action.items.length + action.prepays.length;
      return flash(
        { ...state, participants, screen: "home" },
        `Pago registrado en ${n} ${n === 1 ? "grupo" : "grupos"} ✓`,
      );
    }
    case "applyAdminParticipation": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, admin_participates: action.participate } : g,
      );
      const participants = action.participate
        ? action.participant
          ? [...state.participants, action.participant]
          : state.participants
        : state.participants.filter((p) => p.id !== action.removedId);
      return flash(
        { ...state, groups, participants },
        action.participate ? "Ahora ocupas un lugar en el grupo" : "Ya no ocupas un lugar en el grupo",
      );
    }
    case "setCharges":
      return { ...state, charges: action.charges };
    case "applyChargesPaid": {
      const charges = state.charges.map((c) =>
        c.participant_id === action.participantId && action.cycles.includes(c.cycle)
          ? {
              ...c,
              paid: action.paid,
              paid_at: action.paid ? new Date().toISOString() : null,
              paid_by: action.paid ? (action.paidBy ?? null) : null,
            }
          : c,
      );
      return { ...state, charges };
    }
    // A custom-price change re-prices this month's still-unpaid charge.
    case "applyChargeCuota": {
      const charges = state.charges.map((c) =>
        c.participant_id === action.participantId && c.cycle === action.cycle && !c.paid
          ? { ...c, cuota: action.cuota }
          : c,
      );
      return { ...state, charges };
    }
    case "applySubmitPrepay": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? { ...p, prepay_pending: action.amount, prepay_months: action.months, proof_url: action.proofUrl, proof_pending: true }
          : p,
      );
      return flash(
        { ...state, participants, screen: "group" },
        `Pago adelantado de ${action.months} ${action.months === 1 ? "mes" : "meses"} enviado · pendiente de aprobación`,
      );
    }
    // An admin's own prepay skips review: the balance is credited on the spot.
    case "applyAdminPrepay": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId ? { ...p, prepaid_balance: action.balance, paid: action.paid } : p,
      );
      return flash(
        { ...state, participants, screen: "group" },
        `Saldo adelantado acreditado · ${fmtBs(action.balance)}`,
      );
    }
    case "applyPrepayReview": {
      const reviewed = state.participants.find((p) => p.id === action.participantId);
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? {
              ...p,
              prepaid_balance: action.balance,
              paid: action.paid,
              proof_pending: false,
              prepay_pending: null,
              prepay_months: null,
            }
          : p,
      );
      const more =
        state.screen === "approve" &&
        participants.some((p) => p.group_id === reviewed?.group_id && p.proof_pending);
      const msg = action.approved
        ? `Pago adelantado aprobado · saldo ${fmtBs(action.balance)}`
        : "Pago adelantado rechazado";
      return flash({ ...state, participants, screen: more ? "approve" : "admin" }, msg);
    }
    case "applyParticipantBilling": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? { ...p, prepaid_balance: action.balance, paid: action.paid, proof_pending: false, billed_cycle: action.cycle }
          : p,
      );
      return { ...state, participants };
    }
    case "applyReview": {
      const reviewed = state.participants.find((p) => p.id === action.participantId);
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? { ...p, paid: action.paid, proof_pending: false, pay_cycles: null, proof_by: null }
          : p,
      );
      // Stay on the approve screen while more proofs from this group are queued.
      const more =
        state.screen === "approve" &&
        participants.some((p) => p.group_id === reviewed?.group_id && p.proof_pending);
      const msg = action.paid ? "Pago aprobado · saldo actualizado" : "Comprobante rechazado";
      return flash({ ...state, participants, screen: more ? "approve" : "admin" }, msg);
    }
    case "applyBilledCycle": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId
          ? { ...g, billed_cycle: action.cycle, billed_cuota: action.cuota, billed_rate: action.rate }
          : g,
      );
      return { ...state, groups };
    }
    // Replace the whole synced dataset with a fresh fetch (pull-to-refresh /
    // web refresh button), keeping navigation, drafts and the open group.
    case "hydrate": {
      const d = action.data;
      const agId = d.groups.some((g) => g.id === state.agId) ? state.agId : (d.groups[0]?.id ?? null);
      return {
        ...state,
        profile: d.profile,
        groups: d.groups,
        participants: d.participants,
        payments: d.payments,
        charges: d.charges,
        wallet: d.wallet,
        transactions: d.transactions,
        notifications: d.notifications,
        ownerProfiles: d.ownerProfiles,
        agId,
      };
    }
    case "setNotifications":
      return { ...state, notifications: action.notifications };
    case "markNotificationsRead":
      return { ...state, notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })) };

    case "applyCreateGroup":
      return flash(
        {
          ...state,
          groups: [...state.groups, action.group],
          participants: [...state.participants, ...action.participants],
          screen: "home",
        },
        "Grupo creado correctamente",
      );

    // Group deleted (children cascade in the DB): drop it and everything that
    // hangs off it from local state, then land on home.
    case "applyDeleteGroup": {
      const groups = state.groups.filter((g) => g.id !== action.groupId);
      return flash(
        {
          ...state,
          groups,
          participants: state.participants.filter((p) => p.group_id !== action.groupId),
          charges: state.charges.filter((c) => c.group_id !== action.groupId),
          payments: state.payments.filter((p) => p.group_id !== action.groupId),
          notifications: state.notifications.filter((n) => n.group_id !== action.groupId),
          agId: groups[0]?.id ?? null,
          screen: "home",
        },
        "Grupo eliminado",
      );
    }

    default:
      return state;
  }
}

/** Bound actions exposed to components. */
export interface Actions {
  go: (screen: Screen) => void;
  back: () => void;
  open: (id: string) => void;
  reviewGroup: (id: string) => void;
  selectService: (id: ServiceId) => void;
  /** Seed the inline cost editor's drafts from a group row. */
  beginEdit: (id: string) => void;
  setEditAmount: (value: string) => void;
  setEditCur: (cur: Currency) => void;
  bumpMembers: (delta: number) => void;
  setEditBillingDay: (value: string) => void;
  setEditRound: (value: boolean) => void;
  setEditVarPrice: (value: boolean) => void;
  /** Validate and persist the cost drafts. True on success. */
  saveEdit: () => Promise<boolean>;
  /** Confirm the current variable-price group's amount for this cycle and run
   * the pending charge immediately. True on success. */
  confirmCyclePrice: (raw: string) => Promise<boolean>;
  /** Upload/replace the current group's payment QR image. True on success. */
  setGroupQr: (file: File) => Promise<boolean>;
  /** Delete the current group's payment QR image. */
  removeGroupQr: () => void;
  /** Save the current group's international payment methods. True on success. */
  setGroupPayMethods: (paypal: string, bank: string) => Promise<boolean>;
  /** Toggle whether the current group joins the admin's joint-payment bundle. */
  setJointPay: (value: boolean) => void;
  /** Pick which of the admin's joint groups provides the bundle's collection
   * method (QR / PayPal / bank). */
  setJointMethod: (groupId: string) => void;
  /** Show a toast message (e.g. "copiado al portapapeles"). */
  notify: (msg: string) => void;
  openFx: () => void;
  setRateDraft: (value: string) => void;
  presetRate: (value: number) => void;
  fetchOfficialRate: () => void;
  initOfficialRate: () => void;
  saveRate: () => void;
  /** Submit the signed-in user's own cuota payment, optionally uploading a
   * receipt image first. `cycles` lists the months being paid (defaults to the
   * oldest owed month). A group admin's payment is approved on the spot (no
   * receipt required). */
  submitPay: (proof?: File | null, cycles?: string[]) => void;
  /** Pay a selection of the joint groups collected by one administrator in a
   * single transaction with one shared receipt: the chosen owed groups plus
   * optional prepays of N months in the chosen up-to-date groups. */
  submitCombinedPay: (
    ownerId: string,
    proof: File | null,
    sel: { payGroupIds: string[]; prepayGroupIds: string[]; prepayMonths: number },
  ) => void;
  /** Toggle whether the admin occupies a slot in the current group (self row). */
  setAdminParticipation: (participate: boolean) => void;
  /** Soft-delete exported (already paid) charge rows. True on success. */
  deleteExportedCharges: (ids: string[]) => Promise<boolean>;
  setCreateAdminIn: (value: boolean) => void;
  setCreateVarPrice: (value: boolean) => void;
  /** Submit a prepay of N months for admin approval (receipt required). An
   * admin's own prepay is credited to their balance instantly, no receipt. */
  submitPrepay: (months: number, proof: File | null) => void;
  /** Send a payment reminder notification to a member with owed months. */
  remindMember: (participantId: string) => void;
  reviewMember: (participantId: string, approve: boolean) => void;
  setCreate: (field: "name" | "amount" | "members" | "billingDay", value: string) => void;
  setCreateCur: (cur: Currency) => void;
  setCreateColor: (color: string) => void;
  createGroup: () => void;
  /** Delete the current group and all its data (admin only). True on success. */
  deleteGroup: () => Promise<boolean>;
  setMemberDraft: (value: string) => void;
  /** Search registered users by name or email (for the add-member modal). */
  searchMembers: (query: string) => Promise<ProfileMatch[]>;
  /** Add the draft (a plain name or an email) to the roster. True on success. */
  addMember: () => Promise<boolean>;
  /** Add a registered user found via search to the roster. True on success. */
  addMemberUser: (profile: ProfileMatch) => Promise<boolean>;
  removeMember: (participantId: string) => void;
  setMemberPaid: (participantId: string, paid: boolean) => void;
  /** Set a member's custom monthly price in the given currency ("" = default).
   * When `pctMode` is true, `raw` is a percentage (1–100) of the group total.
   * Validates against the group's monthly total and re-prices this month's
   * still-unpaid charge. True on success. */
  setMemberPrice: (participantId: string, raw: string, currency?: Currency, pctMode?: boolean) => Promise<boolean>;
  renameMember: (participantId: string, name: string) => void;
  moveMember: (participantId: string, dir: -1 | 1) => void;
  /** Run due monthly charges for owned groups: refresh the official rate and notify each member. */
  processBilling: () => void;
  /** Mark the whole notification feed as read (on opening the activity screen). */
  markActivityRead: () => void;
  /** Re-fetch the full dataset from Supabase (pull-to-refresh / web refresh). */
  refresh: () => Promise<void>;
  signOut: () => void;
}

const AppContext = createContext<{ state: State; actions: Actions } | null>(null);

export function AppProvider({ initialData, children }: { initialData: AppData; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialData, initState);
  const supabase = useMemo(() => createClient(), []);
  const userId = initialData.profile.id;

  // Latest-state ref so async actions never read stale closures. Updated after
  // each commit (async actions only run from event handlers, after render).
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  });

  const actions = useMemo<Actions>(() => {
    const fail = (e: unknown) =>
      dispatch({ type: "flash", msg: e instanceof Error ? e.message : "Ocurrió un error" });
    const rate = () => ref.current.profile.exchange_rate;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    // Current per-member cuota (Bs): frozen after this month's charge, else today's preview.
    const cuotaOf = (g: GroupRow) => buildGroup(ref.current, g).perBs;
    const currentGroup = () => ref.current.groups.find((g) => g.id === ref.current.agId) ?? ref.current.groups[0];

    // Fetch the official BCB "compra" rate for display and adopt it (always when
    // forced, otherwise at most once per calendar day).
    const syncOfficial = async (force: boolean) => {
      try {
        const { rate: r, fecha } = await getOfficialRate();
        dispatch({ type: "setOfficial", rate: r, fecha });
        const today = new Date().toLocaleDateString("en-CA");
        if (force || ref.current.profile.rate_synced_on !== today) {
          await api.saveOfficialRate(supabase, userId, r, today);
          dispatch({ type: "applyOfficialSync", rate: r, syncedOn: today });
        }
      } catch {
        // Silent — keep the last known rate if the BCB API is unreachable.
      }
    };

    const acts: Actions = {
      go: (screen) => dispatch({ type: "navigate", screen }),
      back: () => dispatch({ type: "navigate", screen: BACK_MAP[ref.current.screen] ?? "home" }),
      open: (id) => dispatch({ type: "open", id }),
      reviewGroup: (id) => dispatch({ type: "reviewGroup", id }),
      selectService: (id) => dispatch({ type: "selectService", id }),
      beginEdit: (id) => dispatch({ type: "beginEdit", id }),
      setEditAmount: (value) => dispatch({ type: "setEditAmount", value }),
      setEditCur: (cur) => dispatch({ type: "setEditCur", cur }),
      bumpMembers: (delta) => dispatch({ type: "bumpMembers", delta }),
      setEditBillingDay: (value) => dispatch({ type: "setEditBillingDay", value }),
      setEditRound: (value) => dispatch({ type: "setEditRound", value }),
      setEditVarPrice: (value) => dispatch({ type: "setEditVarPrice", value }),
      openFx: () => dispatch({ type: "openFx" }),
      setRateDraft: (value) => dispatch({ type: "setRateDraft", value }),
      presetRate: (value) => dispatch({ type: "presetRate", value }),
      fetchOfficialRate: async () => {
        dispatch({ type: "setRateLoading", value: true });
        try {
          const { rate: r, fecha } = await getOfficialRate();
          dispatch({ type: "setOfficial", rate: r, fecha });
          dispatch({ type: "presetRate", value: r });
          dispatch({ type: "flash", msg: `Oficial BCB: ${r} Bs${fecha ? ` · ${fecha}` : ""}` });
        } catch (e) {
          fail(e);
        } finally {
          dispatch({ type: "setRateLoading", value: false });
        }
      },

      // On load: cache the official rate for display and adopt it once per day.
      initOfficialRate: () => {
        void syncOfficial(false);
      },
      setCreate: (field, value) => dispatch({ type: "setCreate", field, value }),
      setCreateCur: (cur) => dispatch({ type: "setCreateCur", cur }),
      setCreateColor: (color) => dispatch({ type: "setCreateColor", color }),
      setMemberDraft: (value) => dispatch({ type: "setMemberDraft", value }),

      saveEdit: async () => {
        const s = ref.current;
        if (!s.editGroupId) return false;
        const errors = getEditErrors(s);
        if (!errors.valid) {
          dispatch({ type: "flash", msg: errors.amount || errors.members || errors.billingDay });
          return false;
        }
        const amount = parseFloat(s.editAmount);
        const day = parseInt(s.editBillingDay, 10);
        // Keep the existing month in the "dd/mm" due label; fall back to this month.
        const group = s.groups.find((g) => g.id === s.editGroupId);
        const mm = group?.due?.split("/")[1] ?? new Date().toLocaleDateString("en-CA").slice(5, 7);
        const due = `${String(day).padStart(2, "0")}/${mm}`;
        // If this month's charge already ran, re-freeze the cuota at the new
        // cost (at the rate that charge used); otherwise clear the freeze so
        // it previews live.
        let billedCuota: number | null = null;
        if (group?.billed_cycle === currentCycle()) {
          const totalBs = s.editCur === "USD" ? amount * (group.billed_rate ?? rate()) : amount;
          const n = Math.max(1, s.editMembers);
          billedCuota = s.editRound ? Math.ceil(totalBs / n) : totalBs / n;
        }
        try {
          await api.updateGroupCost(supabase, s.editGroupId, {
            amount,
            currency: s.editCur,
            members: s.editMembers,
            billingDay: day,
            due,
            round: s.editRound,
            billedCuota,
            variablePrice: s.editVarPrice,
          });
          dispatch({
            type: "applyGroupCost",
            groupId: s.editGroupId,
            amount,
            currency: s.editCur,
            members: s.editMembers,
            billingDay: day,
            due,
            round: s.editRound,
            billedCuota,
            variablePrice: s.editVarPrice,
          });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      // Variable-price groups: save this month's amount, open the billing gate
      // for the current cycle and run the pending charge right away.
      confirmCyclePrice: async (raw) => {
        const g = currentGroup();
        if (!g || g.owner_id !== userId) return false;
        const amount = parseFloat(raw);
        if (!Number.isFinite(amount) || amount <= 0) {
          dispatch({ type: "flash", msg: "Ingresa el precio de este mes (mayor a 0)" });
          return false;
        }
        const cycle = currentCycle();
        try {
          await api.confirmGroupPrice(supabase, g.id, amount, cycle);
          dispatch({ type: "applyPriceConfirmed", groupId: g.id, amount, cycle });
          await acts.processBilling();
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      setGroupQr: async (file) => {
        const g = currentGroup();
        if (!g) return false;
        const err = imageUploadError(file);
        if (err) {
          dispatch({ type: "flash", msg: err });
          return false;
        }
        try {
          const url = await api.uploadGroupQr(supabase, g.id, file);
          dispatch({ type: "applyGroupQr", groupId: g.id, url });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      removeGroupQr: async () => {
        const g = currentGroup();
        if (!g?.qr_image_url) return;
        try {
          await api.clearGroupQr(supabase, g.id);
          dispatch({ type: "applyGroupQr", groupId: g.id, url: null });
        } catch (e) {
          fail(e);
        }
      },

      setGroupPayMethods: async (paypal, bank) => {
        const g = currentGroup();
        if (!g) return false;
        const values = { paypal: paypal.trim() || null, bank: bank.trim() || null };
        try {
          await api.updateGroupPayMethods(supabase, g.id, values);
          dispatch({ type: "applyGroupPayMethods", groupId: g.id, ...values });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      setJointPay: async (value) => {
        const g = currentGroup();
        if (!g || g.owner_id !== userId) return;
        try {
          await api.updateGroupJointPay(supabase, g.id, value);
          dispatch({ type: "applyJointPay", groupId: g.id, jointPay: value });
        } catch (e) {
          fail(e);
        }
      },

      setJointMethod: async (groupId) => {
        const g = ref.current.groups.find((x) => x.id === groupId);
        if (!g || g.owner_id !== userId) return;
        try {
          await api.setJointMethodSource(supabase, userId, groupId);
          dispatch({ type: "applyJointMethod", ownerId: userId, groupId });
        } catch (e) {
          fail(e);
        }
      },

      notify: (msg) => dispatch({ type: "flash", msg }),

      saveRate: async () => {
        const r = parseFloat(ref.current.rateDraft) || rate();
        try {
          await api.saveExchangeRate(supabase, userId, r);
          dispatch({ type: "applyRate", rate: r });
        } catch (e) {
          fail(e);
        }
      },

      submitPay: async (proof, cycles) => {
        const g = currentGroup();
        if (!g) return;
        if (proof) {
          const err = imageUploadError(proof);
          if (err) {
            dispatch({ type: "flash", msg: err });
            return;
          }
        }
        // Refresh the dollar price on every payment request so the cuota reflects
        // the current official rate.
        await syncOfficial(true);
        const target = ref.current.participants.find((p) => p.group_id === g.id && p.user_id === userId);
        if (!target) {
          dispatch({ type: "flash", msg: "No tienes una ficha en este grupo" });
          return;
        }
        // Oldest-first: a simple payment settles the oldest owed month before
        // the current one (explicit cycles — e.g. "pay everything" — win).
        let paying = cycles && cycles.length > 0 ? cycles : [];
        if (paying.length === 0) {
          const owed = ref.current.charges
            .filter((c) => c.participant_id === target.id && !c.paid)
            .sort((a, b) => a.cycle.localeCompare(b.cycle));
          paying = owed.length > 0 ? [owed[0].cycle] : [currentCycle()];
        }
        const isAdmin = g.owner_id === userId;
        try {
          const proofUrl = proof ? await api.uploadPaymentProof(supabase, g.id, target.id, proof) : null;
          await api.submitPaymentV2(supabase, [{ participantId: target.id, cycles: paying }], proofUrl);
          if (isAdmin) {
            // Admin payments are auto-approved by the RPC — reflect it locally.
            dispatch({ type: "applyChargesPaid", participantId: target.id, cycles: paying, paid: true, paidBy: userId });
            dispatch({ type: "applyAdminPay", participantId: target.id, paidNow: paying.includes(currentCycle()) });
          } else {
            dispatch({ type: "applySubmitPay", participantId: target.id, proofUrl, cycles: paying, proofBy: null });
          }
        } catch (e) {
          fail(e);
        }
      },

      // One receipt, one transaction: the selected owed groups plus optional
      // prepays across this admin's joint groups go into review at once. Each
      // group keeps its own ledger rows, so accounting stays independent.
      // When the payer IS the administrator (their own joint groups), the
      // whole payment is registered instantly: no receipt, no review.
      submitCombinedPay: async (ownerId, proof, sel) => {
        if (proof) {
          const err = imageUploadError(proof);
          if (err) {
            dispatch({ type: "flash", msg: err });
            return;
          }
        }
        await syncOfficial(true);
        const s = ref.current;
        const isAdmin = ownerId === userId;
        const jointGroups = s.groups.filter((g) => g.joint_pay && g.owner_id === ownerId);
        const rowIn = (g: GroupRow) =>
          s.participants.find((p) => p.group_id === g.id && p.user_id === userId);

        // Owed groups the user chose to pay now (oldest cycles first).
        const debtItems: { participantId: string; groupId: string; cycles: string[] }[] = [];
        for (const gid of sel.payGroupIds) {
          const g = jointGroups.find((x) => x.id === gid);
          const me = g ? rowIn(g) : undefined;
          if (!g || !me || me.proof_pending) continue;
          const owed = s.charges
            .filter((c) => c.participant_id === me.id && !c.paid)
            .sort((a, b) => a.cycle.localeCompare(b.cycle));
          if (owed.length > 0) {
            debtItems.push({ participantId: me.id, groupId: g.id, cycles: owed.map((c) => c.cycle) });
          }
        }
        // Up-to-date joint groups the user chose to prepay N months in.
        const months = Math.max(1, Math.floor(sel.prepayMonths));
        const prepays: { participantId: string; groupId: string; amount: number }[] = [];
        for (const gid of sel.prepayGroupIds) {
          const g = jointGroups.find((x) => x.id === gid);
          const me = g ? rowIn(g) : undefined;
          if (!g || !me || me.proof_pending || me.prepay_pending != null) continue;
          prepays.push({ participantId: me.id, groupId: g.id, amount: round2(cuotaOf(g) * months) });
        }

        if (debtItems.length === 0 && prepays.length === 0) {
          dispatch({ type: "flash", msg: "Selecciona al menos un grupo para pagar" });
          return;
        }
        if (!isAdmin && prepays.length > 0 && !proof) {
          dispatch({ type: "flash", msg: "El pago adelantado requiere adjuntar el comprobante" });
          return;
        }
        try {
          // The receipt is uploaded once and shared by every bundled group.
          const first = debtItems[0] ?? prepays[0];
          const proofUrl = proof
            ? await api.uploadPaymentProof(supabase, first.groupId, first.participantId, proof)
            : null;
          if (debtItems.length > 0) {
            await api.submitPaymentV2(
              supabase,
              debtItems.map((it) => ({ participantId: it.participantId, cycles: it.cycles })),
              proofUrl,
            );
          }

          if (isAdmin) {
            // The RPC auto-approved the admin's debt items; credit the prepay
            // balances directly (covering the current month when it reaches).
            for (const it of debtItems) {
              dispatch({ type: "applyChargesPaid", participantId: it.participantId, cycles: it.cycles, paid: true, paidBy: userId });
            }
            const applied: { participantId: string; balance: number; paid: boolean }[] = [];
            for (const pp of prepays) {
              const g = jointGroups.find((x) => x.id === pp.groupId)!;
              const me = rowIn(g)!;
              let balance = round2(me.prepaid_balance + pp.amount);
              let paid = me.paid;
              const cuota = cuotaOf(g);
              if (!paid && cuota > 0 && balance >= cuota) {
                balance = round2(balance - cuota);
                paid = true;
                await api.setChargesPaid(supabase, me.id, [currentCycle()], true, userId);
                dispatch({ type: "applyChargesPaid", participantId: me.id, cycles: [currentCycle()], paid: true, paidBy: userId });
              }
              await api.updateParticipantBilling(supabase, me.id, { prepaid_balance: balance, paid });
              applied.push({ participantId: me.id, balance, paid });
            }
            dispatch({
              type: "applyCombinedAdmin",
              items: debtItems.map((it) => ({ participantId: it.participantId, cycles: it.cycles })),
              prepays: applied,
            });
            return;
          }

          for (const pp of prepays) {
            await api.submitPrepay(supabase, pp.participantId, {
              amount: pp.amount,
              months,
              proofUrl: proofUrl as string, // guaranteed: member prepays require a receipt
            });
          }
          dispatch({
            type: "applyCombinedPay",
            items: debtItems.map((it) => ({ participantId: it.participantId, cycles: it.cycles })),
            prepays: prepays.map((pp) => ({ participantId: pp.participantId, amount: pp.amount, months })),
            proofUrl,
          });
        } catch (e) {
          fail(e);
        }
      },

      // Feature: the admin manages the plan without occupying a slot. Creates
      // or removes their own `is_self` roster row and stamps the group flag.
      setAdminParticipation: async (participate) => {
        const g = currentGroup();
        if (!g || g.owner_id !== userId) return;
        const roster = ref.current.participants.filter((p) => p.group_id === g.id);
        const self = roster.find((p) => p.user_id === userId);
        if (participate === !!self) return;
        const sort = roster.reduce((m, p) => Math.max(m, p.sort), -1) + 1;
        try {
          const participant = await api.setAdminParticipation(
            supabase,
            { id: g.id, ownerId: userId },
            { participate, selfParticipantId: self?.id ?? null, sort },
          );
          dispatch({
            type: "applyAdminParticipation",
            groupId: g.id,
            participate,
            participant,
            removedId: self?.id ?? null,
          });
        } catch (e) {
          fail(e);
        }
      },

      // Archive (soft-delete) exported, already-paid charge rows. The RPC is
      // all-or-nothing, so a partial batch never happens.
      deleteExportedCharges: async (ids) => {
        try {
          const n = await api.archivePaidCharges(supabase, ids);
          dispatch({ type: "setCharges", charges: await api.fetchCharges(supabase) });
          dispatch({ type: "flash", msg: `${n} ${n === 1 ? "registro archivado" : "registros archivados"}` });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      setCreateAdminIn: (value) => dispatch({ type: "setCreateAdminIn", value }),
      setCreateVarPrice: (value) => dispatch({ type: "setCreateVarPrice", value }),

      // A prepay covers N months at today's cuota; the receipt is required and
      // reviewed once — afterwards each monthly charge deducts from the balance.
      // The group admin's own prepay skips the review round-trip entirely: no
      // receipt, the balance is credited on the spot.
      submitPrepay: async (months, proof) => {
        const g = currentGroup();
        if (!g || months < 1) return;
        const isAdmin = g.owner_id === userId;
        if (!isAdmin && !proof) {
          dispatch({ type: "flash", msg: "Adjunta el comprobante de tu pago adelantado" });
          return;
        }
        if (proof) {
          const err = imageUploadError(proof);
          if (err) {
            dispatch({ type: "flash", msg: err });
            return;
          }
        }
        const me = ref.current.participants.find((p) => p.group_id === g.id && p.user_id === userId);
        if (!me) {
          dispatch({ type: "flash", msg: "No tienes una ficha en este grupo" });
          return;
        }
        if (me.prepay_pending != null) {
          dispatch({ type: "flash", msg: "Ya tienes un pago adelantado en revisión" });
          return;
        }
        await syncOfficial(true); // price the advance at today's official rate
        const group = ref.current.groups.find((x) => x.id === g.id);
        if (!group) return;
        const amount = round2(cuotaOf(group) * months);
        try {
          if (isAdmin) {
            // Credit the balance now; cover the current month when it reaches
            // (same math the reviewMember approval path applies).
            let balance = round2(me.prepaid_balance + amount);
            let paid = me.paid;
            const cuota = getMemberCuota(ref.current, group, me);
            if (!paid && cuota > 0 && balance >= cuota) {
              balance = round2(balance - cuota);
              paid = true;
              await api.setChargesPaid(supabase, me.id, [currentCycle()], true, userId);
              dispatch({ type: "applyChargesPaid", participantId: me.id, cycles: [currentCycle()], paid: true, paidBy: userId });
            }
            await api.updateParticipantBilling(supabase, me.id, { prepaid_balance: balance, paid });
            dispatch({ type: "applyAdminPrepay", participantId: me.id, balance, paid });
            return;
          }
          if (!proof) return; // unreachable — guarded above
          const proofUrl = await api.uploadPaymentProof(supabase, g.id, me.id, proof);
          await api.submitPrepay(supabase, me.id, { amount, months, proofUrl });
          dispatch({ type: "applySubmitPrepay", participantId: me.id, amount, months, proofUrl });
        } catch (e) {
          fail(e);
        }
      },

      // Approve/reject a member's proof (generic — works for any participant).
      // A pending prepay is credited to the balance on approval, immediately
      // covering the current month's cuota when it reaches.
      reviewMember: async (participantId, approve) => {
        const p = ref.current.participants.find((x) => x.id === participantId);
        try {
          if (p && p.prepay_pending != null) {
            let balance = p.prepaid_balance;
            let paid = p.paid;
            if (approve) {
              balance = round2(balance + p.prepay_pending);
              const group = ref.current.groups.find((g) => g.id === p.group_id);
              // The reviewed member's own cuota (may be a custom price).
              const cuota = group ? getMemberCuota(ref.current, group, p) : 0;
              if (!paid && cuota > 0 && balance >= cuota) {
                balance = round2(balance - cuota);
                paid = true;
              }
            }
            await api.updateParticipantBilling(supabase, participantId, {
              prepaid_balance: balance,
              paid,
              proof_pending: false,
              prepay_pending: null,
              prepay_months: null,
            });
            if (p.user_id) {
              await api.insertNotifications(supabase, [
                {
                  user_id: p.user_id,
                  group_id: p.group_id,
                  title: approve ? "Pago adelantado aprobado" : "Pago adelantado rechazado",
                  body: approve
                    ? `Se acreditaron ${fmtBs(p.prepay_pending)} · tu saldo adelantado es ${fmtBs(balance)}.`
                    : "Tu comprobante de pago adelantado fue rechazado · contacta al admin.",
                },
              ]);
            }
            // The credited balance may have auto-covered this month's charge.
            if (approve && paid && !p.paid) {
              await api.setChargesPaid(supabase, participantId, [currentCycle()], true);
              dispatch({ type: "applyChargesPaid", participantId, cycles: [currentCycle()], paid: true });
            }
            dispatch({ type: "applyPrepayReview", participantId, approved: approve, balance, paid });
            return;
          }
          // Regular receipt: it pays the cycles recorded at submission (the
          // current month, or every owed month when settling arrears). The
          // payer on record is whoever submitted the proof (on-behalf) or the
          // member themself.
          const cycles = p?.pay_cycles?.length ? p.pay_cycles : [currentCycle()];
          const paidNow = approve ? (cycles.includes(currentCycle()) ? true : (p?.paid ?? false)) : false;
          const paidBy = p?.proof_by ?? p?.user_id ?? null;
          await api.updateParticipantBilling(supabase, participantId, {
            paid: paidNow,
            proof_pending: false,
            pay_cycles: null,
            proof_by: null,
          });
          if (approve) {
            await api.setChargesPaid(supabase, participantId, cycles, true, paidBy);
            dispatch({ type: "applyChargesPaid", participantId, cycles, paid: true, paidBy });
          }
          // When someone else paid on the member's behalf, tell the member how
          // the review went (they never saw the submission themselves).
          if (p?.user_id && p.proof_by && p.proof_by !== p.user_id) {
            const g = ref.current.groups.find((x) => x.id === p.group_id);
            await api.insertNotifications(supabase, [
              {
                user_id: p.user_id,
                group_id: p.group_id,
                title: approve ? `Pago aprobado · ${g?.name ?? "tu grupo"}` : `Pago rechazado · ${g?.name ?? "tu grupo"}`,
                body: approve
                  ? `El pago enviado por tu cuota (${cycles.map(cycleLabel).join(", ")}) fue aprobado.`
                  : "El comprobante enviado por tu cuota fue rechazado · contacta al admin.",
              },
            ]);
          }
          dispatch({ type: "applyReview", participantId, paid: paidNow });
        } catch (e) {
          fail(e);
        }
      },

      createGroup: async () => {
        const s = ref.current;
        const meta = SERVICE_META[s.selService];
        const amount = parseFloat(s.createAmount) || 0;
        const members = Math.max(1, parseInt(s.createMembers, 10) || 1);
        const day = Math.max(1, Math.min(31, parseInt(s.createBillingDay, 10) || 5));
        try {
          const { group, participants } = await api.createGroup(supabase, userId, {
            serviceId: s.selService,
            name: s.createName || meta.name,
            amount,
            currency: s.createCur,
            members,
            billingDay: day,
            due: `${String(day).padStart(2, "0")}/07`,
            // Only custom groups carry a per-group color; catalog services use their brand color.
            color: s.selService === "others" ? s.createColor : null,
            adminParticipates: s.createAdminIn,
            variablePrice: s.createVarPrice,
          });
          dispatch({ type: "applyCreateGroup", group, participants });
        } catch (e) {
          fail(e);
        }
      },

      // Delete the current group outright — the DB cascades participants,
      // charges, payments and notifications.
      deleteGroup: async () => {
        const g = currentGroup();
        if (!g || g.owner_id !== userId) return false;
        try {
          await api.deleteGroup(supabase, g.id);
          dispatch({ type: "applyDeleteGroup", groupId: g.id });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      searchMembers: async (query) => {
        const q = query.trim();
        if (q.length < 2) return [];
        try {
          return await api.searchProfiles(supabase, q);
        } catch (e) {
          fail(e); // surface DB errors (e.g. missing RPC) instead of faking "no matches"
          return [];
        }
      },

      // Persist a new roster row (shared tail of both add paths). Keeps the
      // target count at least as large as the roster so the cost split and
      // "pending" figures stay coherent (DB allows up to 50).
      addMember: async () => {
        const s = ref.current;
        const g = currentGroup();
        if (!g) return false;
        const raw = s.memberDraft.trim();
        if (!raw) return false;

        const isEmail = raw.includes("@");
        let name = raw;
        let email: string | null = null;
        let memberUserId: string | null = null;
        const roster = s.participants.filter((p) => p.group_id === g.id);

        try {
          if (isEmail) {
            email = raw.toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              dispatch({ type: "flash", msg: "Ingresa un correo válido" });
              return false;
            }
            if (roster.some((p) => p.email?.toLowerCase() === email)) {
              dispatch({ type: "flash", msg: "Ese correo ya está en el grupo" });
              return false;
            }
            // Resolve to an existing app user when the email is registered.
            const profile = await api.findProfileByEmail(supabase, email);
            name = profile?.full_name?.trim() || email.split("@")[0];
            memberUserId = profile?.id ?? null;
          }

          const sort = roster.reduce((m, p) => Math.max(m, p.sort), -1) + 1;
          const color = MEMBER_COLORS[roster.length % MEMBER_COLORS.length];
          const members = Math.min(50, Math.max(g.members_target, roster.length + 1));
          const participant = await api.addParticipant(supabase, g.id, {
            name,
            color,
            sort,
            email,
            userId: memberUserId,
          });
          if (members !== g.members_target) {
            await api.updateMembersTarget(supabase, g.id, members);
          }
          dispatch({ type: "applyAddParticipant", participant, members });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      addMemberUser: async (profile) => {
        const s = ref.current;
        const g = currentGroup();
        if (!g) return false;
        const roster = s.participants.filter((p) => p.group_id === g.id);
        const email = profile.email?.toLowerCase() ?? null;
        if (roster.some((p) => p.user_id === profile.id || (email && p.email?.toLowerCase() === email))) {
          dispatch({ type: "flash", msg: "Ese usuario ya está en el grupo" });
          return false;
        }
        const name = profile.full_name?.trim() || email?.split("@")[0] || "Usuario";
        const sort = roster.reduce((m, p) => Math.max(m, p.sort), -1) + 1;
        const color = MEMBER_COLORS[roster.length % MEMBER_COLORS.length];
        const members = Math.min(50, Math.max(g.members_target, roster.length + 1));
        try {
          const participant = await api.addParticipant(supabase, g.id, {
            name,
            color,
            sort,
            email,
            userId: profile.id,
          });
          if (members !== g.members_target) {
            await api.updateMembersTarget(supabase, g.id, members);
          }
          dispatch({ type: "applyAddParticipant", participant, members });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      removeMember: async (participantId) => {
        const p = ref.current.participants.find((x) => x.id === participantId);
        if (!p || p.is_self) return; // never remove the owner's own row
        try {
          await api.removeParticipant(supabase, participantId);
          dispatch({ type: "applyRemoveParticipant", participantId });
        } catch (e) {
          fail(e);
        }
      },

      // Admin manually flips a member's paid/pending state (no navigation).
      // The current month's charge row (if any) is kept in sync.
      setMemberPaid: async (participantId, paid) => {
        try {
          await api.reviewParticipant(supabase, participantId, paid);
          await api.setChargesPaid(supabase, participantId, [currentCycle()], paid, userId);
          dispatch({ type: "applyChargesPaid", participantId, cycles: [currentCycle()], paid, paidBy: userId });
          dispatch({ type: "applyMemberPaid", participantId, paid });
        } catch (e) {
          fail(e);
        }
      },

      // Admin sets/clears a member's custom price in the chosen currency.
      // The new price is validated against the group's monthly total, and this
      // month's still-unpaid charge is re-priced so the member owes the new
      // amount right away; paid or past months keep their frozen cuota.
      setMemberPrice: async (participantId, raw, currency = "BOB", pctMode = false) => {
        const p = ref.current.participants.find((x) => x.id === participantId);
        if (!p) return false;
        const group = ref.current.groups.find((g) => g.id === p.group_id);
        if (!group) return false;
        const clean = raw.trim();
        const view = buildGroup(ref.current, group);

        // --- Percentage mode ---
        if (pctMode) {
          if (clean === "") {
            // Clear: fall through to the reset path below.
          } else {
            const pctVal = parseFloat(clean);
            if (!Number.isFinite(pctVal) || pctVal <= 0 || pctVal > 100) {
              dispatch({ type: "flash", msg: "Ingresa un porcentaje entre 0.1 y 100" });
              return false;
            }
            const check = checkCustomPct({
              newPct: pctVal,
              editedId: participantId,
              roster: ref.current.participants.filter((x) => x.group_id === group.id),
              groupCurrency: group.currency,
              totalBs: view.totalBs,
              defaultPerBs: view.defaultPerBs,
              rate: rate(),
              round: group.round_cuota,
            });
            if (!check.ok) {
              dispatch({
                type: "flash",
                msg: `El porcentaje (${pctVal}%) supera el disponible: los demás miembros usan ${check.othersPct.toFixed(1)}% y queda ${check.remainingPct.toFixed(1)}% (${fmtBs(check.remainingBs)})`,
              });
              return false;
            }
            const newPer = check.resultBs;
            try {
              await api.setParticipantPrice(supabase, participantId, null, null, pctVal);
              dispatch({ type: "applyMemberPrice", participantId, amount: null, currency: null, pct: pctVal });
              const cycle = currentCycle();
              const charge = ref.current.charges.find(
                (c) => c.participant_id === participantId && c.cycle === cycle && !c.paid,
              );
              if (charge && charge.cuota !== newPer) {
                await api.updateChargeCuota(supabase, participantId, cycle, newPer);
                dispatch({ type: "applyChargeCuota", participantId, cycle, cuota: newPer });
              }
              return true;
            } catch (e) {
              fail(e);
              return false;
            }
          }
        }

        // --- Fixed-amount mode (or reset) ---
        let amount: number | null = null;
        if (clean !== "") {
          amount = parseFloat(clean);
          if (!Number.isFinite(amount) || amount <= 0) {
            dispatch({ type: "flash", msg: "Ingresa un monto mayor a 0 (o deja vacío para la cuota normal)" });
            return false;
          }
          if (amount > 100000) {
            dispatch({ type: "flash", msg: "El monto es demasiado alto" });
            return false;
          }
        }
        if (
          amount === p.custom_amount &&
          p.custom_pct == null &&
          (amount == null || currency === (p.custom_currency ?? group.currency))
        ) {
          return true;
        }

        const newPer =
          amount != null
            ? memberCuotaBs(amount, currency, rate(), group.round_cuota)
            : view.defaultPerBs;

        if (amount != null) {
          const check = checkCustomPrice({
            newPerBs: newPer,
            editedId: participantId,
            roster: ref.current.participants.filter((x) => x.group_id === group.id),
            groupCurrency: group.currency,
            totalBs: view.totalBs,
            defaultPerBs: view.defaultPerBs,
            rate: rate(),
            round: group.round_cuota,
          });
          if (!check.ok) {
            dispatch({
              type: "flash",
              msg: `La cuota (${fmtBs(newPer)}) supera el monto disponible del mes: ${fmtBs(check.remaining)}`,
            });
            return false;
          }
        }

        try {
          await api.setParticipantPrice(supabase, participantId, amount, currency);
          dispatch({ type: "applyMemberPrice", participantId, amount, currency, pct: null });
          const cycle = currentCycle();
          const charge = ref.current.charges.find(
            (c) => c.participant_id === participantId && c.cycle === cycle && !c.paid,
          );
          if (charge && charge.cuota !== newPer) {
            await api.updateChargeCuota(supabase, participantId, cycle, newPer);
            dispatch({ type: "applyChargeCuota", participantId, cycle, cuota: newPer });
          }
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      // Reminder notification listing the member's owed months at each month's price.
      remindMember: async (participantId) => {
        const p = ref.current.participants.find((x) => x.id === participantId);
        if (!p) return;
        if (!p.user_id) {
          dispatch({ type: "flash", msg: `${p.name} no tiene cuenta vinculada · recuérdale por otro medio` });
          return;
        }
        const g = ref.current.groups.find((x) => x.id === p.group_id);
        const owed = ref.current.charges
          .filter((c) => c.participant_id === p.id && !c.paid)
          .sort((a, b) => a.cycle.localeCompare(b.cycle));
        if (!g || owed.length === 0) return;
        const detail = owed.map((c) => `${cycleLabel(c.cycle)} (${fmtBs(c.cuota)})`).join(", ");
        const total = fmtBs(owed.reduce((a, c) => a + c.cuota, 0));
        try {
          await api.insertNotifications(supabase, [
            {
              user_id: p.user_id,
              group_id: g.id,
              title: `Recordatorio de pago · ${g.name}`,
              body: `Tienes ${owed.length === 1 ? "1 cuota pendiente" : `${owed.length} cuotas pendientes`}: ${detail} · total ${total}. Puedes ponerte al día desde "Pagar cuota".`,
            },
          ]);
          dispatch({ type: "flash", msg: `Recordatorio enviado a ${p.name}` });
        } catch (e) {
          fail(e);
        }
      },

      renameMember: async (participantId, name) => {
        const clean = name.trim();
        if (!clean) return;
        const p = ref.current.participants.find((x) => x.id === participantId);
        if (!p || p.name === clean) return;
        try {
          await api.renameParticipant(supabase, participantId, clean);
          dispatch({ type: "applyRenameMember", participantId, name: clean });
        } catch (e) {
          fail(e);
        }
      },

      // Swap a member's sort with its neighbor in the given direction.
      moveMember: async (participantId, dir) => {
        const s = ref.current;
        const p = s.participants.find((x) => x.id === participantId);
        if (!p) return;
        const roster = s.participants
          .filter((x) => x.group_id === p.group_id)
          .sort((a, b) => a.sort - b.sort);
        const idx = roster.findIndex((x) => x.id === participantId);
        const swap = roster[idx + dir];
        if (!swap) return;
        const a = { id: p.id, sort: swap.sort };
        const b = { id: swap.id, sort: p.sort };
        try {
          await api.reorderParticipants(supabase, a, b);
          dispatch({ type: "applyMoveMember", a, b });
        } catch (e) {
          fail(e);
        }
      },

      // Once per month per owned group, on/after its billing day: refresh the
      // official rate (so USD cuotas are charged at today's rate), settle each
      // member against their prepaid balance (auto-paid when it covers the
      // cuota, otherwise the month starts unpaid and the remainder is kept as
      // compensation), notify everyone, and stamp the cycle so it runs once.
      // Mirrors supabase/functions/process-billing.
      processBilling: async () => {
        const now = new Date();
        const cycle = now.toLocaleDateString("en-CA").slice(0, 7); // yyyy-mm
        // Billing days beyond the month's length (29–31) come due on its last day.
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const month = now.toLocaleDateString("es", { month: "long" });
        const arrived = ref.current.groups.filter(
          (g) =>
            g.owner_id === userId &&
            g.billed_cycle !== cycle &&
            now.getDate() >= Math.min(g.billing_day, lastDay),
        );
        // Variable-price groups are never charged at last month's amount: the
        // charge waits until this cycle's price is confirmed. The admin gets a
        // single request notification per cycle (the Edge Function may have
        // already sent it — `price_request_cycle` dedupes across both runners).
        const awaiting = arrived.filter((g) => g.variable_price && g.price_confirmed_cycle !== cycle);
        const due = arrived.filter((g) => !awaiting.includes(g));
        let requested = false;
        for (const g of awaiting) {
          if (g.price_request_cycle === cycle) continue;
          try {
            await api.insertNotifications(supabase, [
              {
                user_id: userId,
                group_id: g.id,
                title: `Actualiza el precio · ${g.name}`,
                body: `Llegó el día de cobro de ${month} y este grupo tiene precio variable. Actualiza el precio del mes desde el panel del grupo para generar el cobro.`,
              },
            ]);
            await api.markPriceRequested(supabase, g.id, cycle);
            dispatch({ type: "applyPriceRequested", groupId: g.id, cycle });
            requested = true;
          } catch {
            // Silent — retried on the next run.
          }
        }
        if (due.length === 0) {
          if (requested) {
            try {
              dispatch({ type: "setNotifications", notifications: await api.fetchNotifications(supabase) });
            } catch {
              // Silent — the feed refreshes on the next fetch.
            }
          }
          return;
        }

        await syncOfficial(true); // a charge always uses today's official rate
        const rate = ref.current.profile.exchange_rate;

        try {
          for (const g of due) {
            const totalBs = g.currency === "USD" ? g.amount * rate : g.amount;
            const n = Math.max(1, g.members_target);
            const per = g.round_cuota ? Math.ceil(totalBs / n) : totalBs / n;
            const roster = ref.current.participants.filter((p) => p.group_id === g.id);
            const notes: { user_id: string; group_id: string; title: string; body: string }[] = [];
            const chargeRows: { group_id: string; participant_id: string; cycle: string; cuota: number; paid: boolean; paid_at: string | null }[] = [];

            // The owner always hears about the run — even without a roster row
            // (admins may manage a plan without occupying a slot).
            notes.push({
              user_id: userId,
              group_id: g.id,
              title: `Cobro de ${g.name}`,
              body: `Se generó el cobro de ${month}: la cuota es ${fmtBs(per)}.`,
            });

            for (const p of roster) {
              // The owner collects (their own row is untouched by the charge).
              if (p.is_self) continue;
              // Per-participant stamp: never deduct the same cycle twice.
              if (p.billed_cycle === cycle) continue;

              // A member's percentage or custom price overrides the default
              // split, converted/calculated at this billing cycle's rate.
              const cuota =
                p.custom_pct != null
                  ? memberCuotaFromPct(p.custom_pct, totalBs, g.round_cuota)
                  : p.custom_amount != null
                    ? memberCuotaBs(p.custom_amount, p.custom_currency ?? g.currency, rate, g.round_cuota)
                    : per;
              let balance = p.prepaid_balance;
              let paid = false;
              let body: string;
              if (cuota > 0 && balance >= cuota) {
                balance = round2(balance - cuota);
                paid = true;
                body = `Cuota de ${month} (${fmtBs(cuota)}) cubierta con tu saldo adelantado · te quedan ${fmtBs(balance)}.`;
                if (balance < cuota) body += " Recarga para seguir cubierto el próximo mes.";
              } else if (balance > 0) {
                body = `Tu saldo adelantado (${fmtBs(balance)}) no cubre la cuota de ${month} (${fmtBs(cuota)}). Se guardará como compensación para tu próxima recarga · mientras tanto paga tu cuota del mes.`;
              } else {
                body = `Se generó el cobro de ${month}: tu cuota es ${fmtBs(cuota)}.`;
              }

              await api.updateParticipantBilling(supabase, p.id, {
                prepaid_balance: balance,
                paid,
                proof_pending: false,
                billed_cycle: cycle,
              });
              dispatch({ type: "applyParticipantBilling", participantId: p.id, balance, paid, cycle });
              chargeRows.push({
                group_id: g.id,
                participant_id: p.id,
                cycle,
                cuota,
                paid,
                paid_at: paid ? new Date().toISOString() : null,
              });
              if (p.user_id) {
                notes.push({ user_id: p.user_id, group_id: g.id, title: `Cobro de ${g.name}`, body });
              }
            }

            await api.insertCharges(supabase, chargeRows);
            await api.insertNotifications(supabase, notes);
            await api.markGroupBilled(supabase, g.id, cycle, per, rate);
            dispatch({ type: "applyBilledCycle", groupId: g.id, cycle, cuota: per, rate });
          }
          // Refresh the ledger and the feed so this run's rows appear.
          dispatch({ type: "setCharges", charges: await api.fetchCharges(supabase) });
          dispatch({ type: "setNotifications", notifications: await api.fetchNotifications(supabase) });
        } catch (e) {
          fail(e);
        }
      },

      markActivityRead: async () => {
        if (!ref.current.notifications.some((n) => !n.read)) return;
        dispatch({ type: "markNotificationsRead" }); // optimistic
        try {
          await api.markNotificationsRead(supabase, userId);
        } catch (e) {
          fail(e);
        }
      },

      // Pull-to-refresh / web refresh: re-fetch everything and replace the
      // synced dataset in one commit.
      refresh: async () => {
        try {
          const data = await api.fetchAppData(supabase, userId);
          dispatch({ type: "hydrate", data });
        } catch (e) {
          fail(e);
        }
      },

      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          fail(e);
        }
      },
    };
    return acts;
  }, [supabase, userId]);

  // Auto-dismiss the toast 2.6s after each flash.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: "clearToast" }), 2600);
    return () => clearTimeout(t);
  }, [state.toastKey, state.toast]);

  // On load: fetch the official BCB rate (for display) and adopt it once daily,
  // then run any monthly charges that came due for groups this user administers.
  // Re-check whenever the app returns to the foreground: a PWA left open can
  // cross a billing day without remounting, and the cycle stamps make the
  // re-run idempotent.
  useEffect(() => {
    actions.initOfficialRate();
    actions.processBilling();
    const onVisible = () => {
      if (document.visibilityState === "visible") actions.processBilling();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [actions]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Access the app state and bound actions. Must be used within `AppProvider`. */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
