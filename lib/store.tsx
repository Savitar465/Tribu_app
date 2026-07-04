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
import type { AppData, ChargeRow, GroupPaymentRow, GroupRow, NotificationRow, ParticipantRow, WalletTxRow } from "@/lib/db/types";
import { MEMBER_COLORS, SERVICE_META } from "@/lib/data";
import { getOfficialRate } from "@/lib/rates";
import { fmtBs, sanitizeNumeric } from "@/lib/format";
import { BACK_MAP } from "@/lib/navigation";
import { buildGroup, currentCycle, cycleLabel, getEditErrors } from "@/lib/selectors";
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
    screen: "home",
    agId: data.groups[0]?.id ?? null,
    selService: "spotify",
    editGroupId: null,
    editAmount: "",
    editCur: "BOB",
    editMembers: 1,
    editBillingDay: "5",
    editRound: false,
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
  | { type: "openFx" }
  | { type: "setRateDraft"; value: string }
  | { type: "presetRate"; value: number }
  | { type: "setRateLoading"; value: boolean }
  | { type: "setOfficial"; rate: number; fecha: string }
  | { type: "applyOfficialSync"; rate: number; syncedOn: string }
  | { type: "setCreate"; field: "name" | "amount" | "members" | "billingDay"; value: string }
  | { type: "setCreateCur"; cur: Currency }
  | { type: "setCreateColor"; color: string }
  | { type: "setMemberDraft"; value: string }
  // applied after a successful persist:
  | { type: "applyAddParticipant"; participant: ParticipantRow; members: number }
  | { type: "applyRemoveParticipant"; participantId: string }
  | { type: "applyRenameMember"; participantId: string; name: string }
  | { type: "applyMoveMember"; a: { id: string; sort: number }; b: { id: string; sort: number } }
  | { type: "applyMemberPaid"; participantId: string; paid: boolean }
  | { type: "applyGroupCost"; groupId: string; amount: number; currency: Currency; members: number; billingDay: number; due: string; round: boolean; billedCuota: number | null }
  | { type: "applyGroupQr"; groupId: string; url: string | null }
  | { type: "applyGroupPayMethods"; groupId: string; paypal: string | null; bank: string | null }
  | { type: "applyRate"; rate: number }
  | { type: "applySubmitPay"; participantId: string; proofUrl: string | null; cycles: string[] }
  | { type: "setCharges"; charges: ChargeRow[] }
  | { type: "applyChargesPaid"; participantId: string; cycles: string[]; paid: boolean }
  | { type: "applySubmitPrepay"; participantId: string; amount: number; months: number; proofUrl: string }
  | { type: "applyReview"; participantId: string; paid: boolean }
  | { type: "applyPrepayReview"; participantId: string; approved: boolean; balance: number; paid: boolean }
  | { type: "applyParticipantBilling"; participantId: string; balance: number; paid: boolean; cycle: string }
  | { type: "applyCreateGroup"; group: GroupRow; participants: ParticipantRow[] }
  | { type: "applyBilledCycle"; groupId: string; cycle: string; cuota: number }
  | { type: "setNotifications"; notifications: NotificationRow[] }
  | { type: "markNotificationsRead" };

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
            }
          : g,
      );
      return flash({ ...state, groups }, "Costo mensual actualizado");
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
    case "applyRate":
      return flash(
        { ...state, profile: { ...state.profile, exchange_rate: action.rate }, screen: "wallet" },
        "Tipo de cambio actualizado",
      );
    case "applySubmitPay": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId
          ? { ...p, proof_pending: true, proof_url: action.proofUrl, pay_cycles: action.cycles }
          : p,
      );
      const msg =
        action.cycles.length > 1
          ? `Comprobante de ${action.cycles.length} meses enviado · pendiente de validación`
          : "Comprobante enviado · pendiente de validación";
      return flash({ ...state, participants, screen: "group" }, msg);
    }
    case "setCharges":
      return { ...state, charges: action.charges };
    case "applyChargesPaid": {
      const charges = state.charges.map((c) =>
        c.participant_id === action.participantId && action.cycles.includes(c.cycle)
          ? { ...c, paid: action.paid, paid_at: action.paid ? new Date().toISOString() : null }
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
        p.id === action.participantId ? { ...p, paid: action.paid, proof_pending: false, pay_cycles: null } : p,
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
        g.id === action.groupId ? { ...g, billed_cycle: action.cycle, billed_cuota: action.cuota } : g,
      );
      return { ...state, groups };
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
  /** Validate and persist the cost drafts. True on success. */
  saveEdit: () => Promise<boolean>;
  /** Upload/replace the current group's payment QR image. True on success. */
  setGroupQr: (file: File) => Promise<boolean>;
  /** Delete the current group's payment QR image. */
  removeGroupQr: () => void;
  /** Save the current group's international payment methods. True on success. */
  setGroupPayMethods: (paypal: string, bank: string) => Promise<boolean>;
  /** Show a toast message (e.g. "copiado al portapapeles"). */
  notify: (msg: string) => void;
  openFx: () => void;
  setRateDraft: (value: string) => void;
  presetRate: (value: number) => void;
  fetchOfficialRate: () => void;
  initOfficialRate: () => void;
  saveRate: () => void;
  /** Submit the cuota payment, optionally uploading a receipt image first.
   * `cycles` lists the months being paid (defaults to the current month). */
  submitPay: (proof?: File | null, cycles?: string[]) => void;
  /** Submit a prepay of N months (receipt required) for admin approval. */
  submitPrepay: (months: number, proof: File | null) => void;
  /** Send a payment reminder notification to a member with owed months. */
  remindMember: (participantId: string) => void;
  reviewMember: (participantId: string, approve: boolean) => void;
  setCreate: (field: "name" | "amount" | "members" | "billingDay", value: string) => void;
  setCreateCur: (cur: Currency) => void;
  setCreateColor: (color: string) => void;
  createGroup: () => void;
  setMemberDraft: (value: string) => void;
  /** Search registered users by name or email (for the add-member modal). */
  searchMembers: (query: string) => Promise<ProfileMatch[]>;
  /** Add the draft (a plain name or an email) to the roster. True on success. */
  addMember: () => Promise<boolean>;
  /** Add a registered user found via search to the roster. True on success. */
  addMemberUser: (profile: ProfileMatch) => Promise<boolean>;
  removeMember: (participantId: string) => void;
  setMemberPaid: (participantId: string, paid: boolean) => void;
  renameMember: (participantId: string, name: string) => void;
  moveMember: (participantId: string, dir: -1 | 1) => void;
  /** Run due monthly charges for owned groups: refresh the official rate and notify each member. */
  processBilling: () => void;
  /** Mark the whole notification feed as read (on opening the activity screen). */
  markActivityRead: () => void;
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
    // Shared guard for image uploads (QR / receipts): null when acceptable.
    const imageError = (file: File) =>
      !/^image\/(png|jpe?g|webp)$/.test(file.type)
        ? "Solo imágenes JPG, PNG o WebP"
        : file.size > 5 * 1024 * 1024
          ? "La imagen supera los 5 MB"
          : null;
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

    return {
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
        // cost (today's rate); otherwise clear the freeze so it previews live.
        let billedCuota: number | null = null;
        if (group?.billed_cycle === currentCycle()) {
          const totalBs = s.editCur === "USD" ? amount * rate() : amount;
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
          });
          return true;
        } catch (e) {
          fail(e);
          return false;
        }
      },

      setGroupQr: async (file) => {
        const g = currentGroup();
        if (!g) return false;
        const err = imageError(file);
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
          const err = imageError(proof);
          if (err) {
            dispatch({ type: "flash", msg: err });
            return;
          }
        }
        // Refresh the dollar price on every payment request so the cuota reflects
        // the current official rate.
        await syncOfficial(true);
        const me = ref.current.participants.find((p) => p.group_id === g.id && p.user_id === userId);
        if (!me) {
          dispatch({ type: "flash", msg: "No tienes una ficha en este grupo" });
          return;
        }
        // Oldest-first: a simple payment settles the oldest owed month before
        // the current one (explicit cycles — e.g. "pay everything" — win).
        let paying = cycles && cycles.length > 0 ? cycles : [];
        if (paying.length === 0) {
          const owed = ref.current.charges
            .filter((c) => c.participant_id === me.id && !c.paid)
            .sort((a, b) => a.cycle.localeCompare(b.cycle));
          paying = owed.length > 0 ? [owed[0].cycle] : [currentCycle()];
        }
        try {
          const proofUrl = proof ? await api.uploadPaymentProof(supabase, g.id, me.id, proof) : null;
          await api.submitPayment(supabase, me.id, proofUrl, paying);
          dispatch({ type: "applySubmitPay", participantId: me.id, proofUrl, cycles: paying });
        } catch (e) {
          fail(e);
        }
      },

      // A prepay covers N months at today's cuota; the receipt is required and
      // reviewed once — afterwards each monthly charge deducts from the balance.
      submitPrepay: async (months, proof) => {
        const g = currentGroup();
        if (!g || months < 1) return;
        if (!proof) {
          dispatch({ type: "flash", msg: "Adjunta el comprobante de tu pago adelantado" });
          return;
        }
        const err = imageError(proof);
        if (err) {
          dispatch({ type: "flash", msg: err });
          return;
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
              const cuota = group ? cuotaOf(group) : 0;
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
          // current month, or every owed month when settling arrears).
          const cycles = p?.pay_cycles?.length ? p.pay_cycles : [currentCycle()];
          const paidNow = approve ? (cycles.includes(currentCycle()) ? true : (p?.paid ?? false)) : false;
          await api.updateParticipantBilling(supabase, participantId, {
            paid: paidNow,
            proof_pending: false,
            pay_cycles: null,
          });
          if (approve) {
            await api.setChargesPaid(supabase, participantId, cycles, true);
            dispatch({ type: "applyChargesPaid", participantId, cycles, paid: true });
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
          });
          dispatch({ type: "applyCreateGroup", group, participants });
        } catch (e) {
          fail(e);
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
          await api.setChargesPaid(supabase, participantId, [currentCycle()], paid);
          dispatch({ type: "applyChargesPaid", participantId, cycles: [currentCycle()], paid });
          dispatch({ type: "applyMemberPaid", participantId, paid });
        } catch (e) {
          fail(e);
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
        const due = ref.current.groups.filter(
          (g) => g.owner_id === userId && g.billed_cycle !== cycle && now.getDate() >= g.billing_day,
        );
        if (due.length === 0) return;

        await syncOfficial(true); // a charge always uses today's official rate
        const rate = ref.current.profile.exchange_rate;
        const month = now.toLocaleDateString("es", { month: "long" });

        try {
          for (const g of due) {
            const totalBs = g.currency === "USD" ? g.amount * rate : g.amount;
            const n = Math.max(1, g.members_target);
            const per = g.round_cuota ? Math.ceil(totalBs / n) : totalBs / n;
            const roster = ref.current.participants.filter((p) => p.group_id === g.id);
            const notes: { user_id: string; group_id: string; title: string; body: string }[] = [];
            const chargeRows: { group_id: string; participant_id: string; cycle: string; cuota: number; paid: boolean; paid_at: string | null }[] = [];

            for (const p of roster) {
              // The owner collects (their own row is untouched by the charge).
              if (p.is_self) {
                if (p.user_id) {
                  notes.push({
                    user_id: p.user_id,
                    group_id: g.id,
                    title: `Cobro de ${g.name}`,
                    body: `Se generó el cobro de ${month}: la cuota es ${fmtBs(per)}.`,
                  });
                }
                continue;
              }
              // Per-participant stamp: never deduct the same cycle twice.
              if (p.billed_cycle === cycle) continue;

              let balance = p.prepaid_balance;
              let paid = false;
              let body: string;
              if (per > 0 && balance >= per) {
                balance = round2(balance - per);
                paid = true;
                body = `Cuota de ${month} (${fmtBs(per)}) cubierta con tu saldo adelantado · te quedan ${fmtBs(balance)}.`;
                if (balance < per) body += " Recarga para seguir cubierto el próximo mes.";
              } else if (balance > 0) {
                body = `Tu saldo adelantado (${fmtBs(balance)}) no cubre la cuota de ${month} (${fmtBs(per)}). Se guardará como compensación para tu próxima recarga · mientras tanto paga tu cuota del mes.`;
              } else {
                body = `Se generó el cobro de ${month}: tu cuota es ${fmtBs(per)}.`;
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
                cuota: per,
                paid,
                paid_at: paid ? new Date().toISOString() : null,
              });
              if (p.user_id) {
                notes.push({ user_id: p.user_id, group_id: g.id, title: `Cobro de ${g.name}`, body });
              }
            }

            await api.insertCharges(supabase, chargeRows);
            await api.insertNotifications(supabase, notes);
            await api.markGroupBilled(supabase, g.id, cycle, per);
            dispatch({ type: "applyBilledCycle", groupId: g.id, cycle, cuota: per });
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

      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          fail(e);
        }
      },
    };
  }, [supabase, userId]);

  // Auto-dismiss the toast 2.6s after each flash.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: "clearToast" }), 2600);
    return () => clearTimeout(t);
  }, [state.toastKey, state.toast]);

  // On load: fetch the official BCB rate (for display) and adopt it once daily,
  // then run any monthly charges that came due for groups this user administers.
  useEffect(() => {
    actions.initOfficialRate();
    actions.processBilling();
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
