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
import type { AppData, GroupPaymentRow, GroupRow, ParticipantRow, WalletTxRow } from "@/lib/db/types";
import { MEMBER_COLORS, SERVICE_META } from "@/lib/data";
import { getOfficialRate } from "@/lib/rates";
import { sanitizeNumeric } from "@/lib/format";
import { BACK_MAP } from "@/lib/navigation";
import type { Currency, Screen, ServiceId } from "@/lib/types";

/** Full UI state: the fetched data plus transient navigation/draft state. */
export interface State {
  // --- data (source of truth, synced with Supabase) ---
  profile: AppData["profile"];
  groups: GroupRow[];
  participants: ParticipantRow[];
  payments: GroupPaymentRow[];
  wallet: AppData["wallet"];
  transactions: WalletTxRow[];

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
  depAmount: string;
  depCur: Currency;
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
  /** Draft name for a new roster member being added on the group screen. */
  memberDraft: string;
  /** Draft email for adding a member by email / existing app user. */
  memberEmail: string;

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
    wallet: data.wallet,
    transactions: data.transactions,
    screen: "home",
    agId: data.groups[0]?.id ?? null,
    selService: "spotify",
    editGroupId: null,
    editAmount: "",
    editCur: "BOB",
    editMembers: 1,
    editBillingDay: "5",
    depAmount: "50",
    depCur: "BOB",
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
    memberEmail: "",
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
  | { type: "openEdit"; id: string }
  | { type: "setEditAmount"; value: string }
  | { type: "setEditCur"; cur: Currency }
  | { type: "bumpMembers"; delta: number }
  | { type: "setEditBillingDay"; value: string }
  | { type: "openFx" }
  | { type: "setRateDraft"; value: string }
  | { type: "presetRate"; value: number }
  | { type: "setRateLoading"; value: boolean }
  | { type: "setOfficial"; rate: number; fecha: string }
  | { type: "applyOfficialSync"; rate: number; syncedOn: string }
  | { type: "openDeposit" }
  | { type: "setDepAmount"; value: string }
  | { type: "setDepCur"; cur: Currency }
  | { type: "setCreate"; field: "name" | "amount" | "members" | "billingDay"; value: string }
  | { type: "setCreateCur"; cur: Currency }
  | { type: "setCreateColor"; color: string }
  | { type: "setMemberDraft"; value: string }
  | { type: "setMemberEmail"; value: string }
  // applied after a successful persist:
  | { type: "applyAddParticipant"; participant: ParticipantRow; members: number }
  | { type: "applyRemoveParticipant"; participantId: string }
  | { type: "applyRenameMember"; participantId: string; name: string }
  | { type: "applyMoveMember"; a: { id: string; sort: number }; b: { id: string; sort: number } }
  | { type: "applyMemberPaid"; participantId: string; paid: boolean }
  | { type: "applyGroupCost"; groupId: string; amount: number; currency: Currency; members: number; billingDay: number; due: string }
  | { type: "applyDeposit"; balance: number; tx: WalletTxRow }
  | { type: "applyAutoFund"; value: boolean }
  | { type: "applyRate"; rate: number }
  | { type: "applySubmitPay"; participantId: string }
  | { type: "applyReview"; participantId: string; paid: boolean }
  | { type: "applyCreateGroup"; group: GroupRow; participants: ParticipantRow[] };

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
    case "openEdit": {
      const g = state.groups.find((x) => x.id === action.id);
      if (!g) return state;
      return {
        ...state,
        screen: "edit",
        editGroupId: g.id,
        editAmount: String(g.amount),
        editCur: g.currency,
        editMembers: g.members_target,
        editBillingDay: String(g.billing_day),
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

    case "openDeposit":
      return { ...state, screen: "deposit", depAmount: "50", depCur: "BOB" };
    case "setDepAmount":
      return { ...state, depAmount: sanitizeNumeric(action.value) };
    case "setDepCur":
      return { ...state, depCur: action.cur };

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
    case "setMemberEmail":
      return { ...state, memberEmail: action.value };

    case "applyAddParticipant": {
      const groups = state.groups.map((g) =>
        g.id === action.participant.group_id ? { ...g, members_target: action.members } : g,
      );
      return flash(
        { ...state, groups, participants: [...state.participants, action.participant], memberDraft: "", memberEmail: "" },
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
            }
          : g,
      );
      return flash({ ...state, groups, screen: "group" }, "Costo mensual actualizado");
    }
    case "applyDeposit":
      return flash(
        { ...state, wallet: { ...state.wallet, balance: action.balance }, transactions: [action.tx, ...state.transactions], screen: "wallet" },
        "Depósito registrado en el fondo común",
      );
    case "applyAutoFund":
      return { ...state, wallet: { ...state.wallet, auto_fund: action.value } };
    case "applyRate":
      return flash(
        { ...state, profile: { ...state.profile, exchange_rate: action.rate }, screen: "wallet" },
        "Tipo de cambio actualizado",
      );
    case "applySubmitPay": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId ? { ...p, proof_pending: true, paid: false } : p,
      );
      return flash({ ...state, participants, screen: "group" }, "Comprobante enviado · pendiente de validación");
    }
    case "applyReview": {
      const participants = state.participants.map((p) =>
        p.id === action.participantId ? { ...p, paid: action.paid, proof_pending: false } : p,
      );
      const msg = action.paid ? "Pago aprobado · saldo actualizado" : "Comprobante rechazado";
      return flash({ ...state, participants, screen: "group" }, msg);
    }
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
  openEdit: (id: string) => void;
  setEditAmount: (value: string) => void;
  setEditCur: (cur: Currency) => void;
  bumpMembers: (delta: number) => void;
  setEditBillingDay: (value: string) => void;
  saveEdit: () => void;
  openFx: () => void;
  setRateDraft: (value: string) => void;
  presetRate: (value: number) => void;
  fetchOfficialRate: () => void;
  initOfficialRate: () => void;
  saveRate: () => void;
  openDeposit: () => void;
  setDepAmount: (value: string) => void;
  setDepCur: (cur: Currency) => void;
  doDeposit: () => void;
  toggleAutoFund: () => void;
  submitPay: () => void;
  reviewMember: (participantId: string, approve: boolean) => void;
  setCreate: (field: "name" | "amount" | "members" | "billingDay", value: string) => void;
  setCreateCur: (cur: Currency) => void;
  setCreateColor: (color: string) => void;
  createGroup: () => void;
  setMemberDraft: (value: string) => void;
  setMemberEmail: (value: string) => void;
  addMember: () => void;
  addMemberByEmail: () => void;
  removeMember: (participantId: string) => void;
  setMemberPaid: (participantId: string, paid: boolean) => void;
  renameMember: (participantId: string, name: string) => void;
  moveMember: (participantId: string, dir: -1 | 1) => void;
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
      openEdit: (id) => dispatch({ type: "openEdit", id }),
      setEditAmount: (value) => dispatch({ type: "setEditAmount", value }),
      setEditCur: (cur) => dispatch({ type: "setEditCur", cur }),
      bumpMembers: (delta) => dispatch({ type: "bumpMembers", delta }),
      setEditBillingDay: (value) => dispatch({ type: "setEditBillingDay", value }),
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
      openDeposit: () => dispatch({ type: "openDeposit" }),
      setDepAmount: (value) => dispatch({ type: "setDepAmount", value }),
      setDepCur: (cur) => dispatch({ type: "setDepCur", cur }),
      setCreate: (field, value) => dispatch({ type: "setCreate", field, value }),
      setCreateCur: (cur) => dispatch({ type: "setCreateCur", cur }),
      setCreateColor: (color) => dispatch({ type: "setCreateColor", color }),
      setMemberDraft: (value) => dispatch({ type: "setMemberDraft", value }),
      setMemberEmail: (value) => dispatch({ type: "setMemberEmail", value }),

      saveEdit: async () => {
        const s = ref.current;
        if (!s.editGroupId) return;
        const amount = parseFloat(s.editAmount) || 0;
        const day = Math.max(1, Math.min(31, parseInt(s.editBillingDay, 10) || 1));
        // Keep the existing month in the "dd/mm" due label; fall back to this month.
        const group = s.groups.find((g) => g.id === s.editGroupId);
        const mm = group?.due?.split("/")[1] ?? new Date().toLocaleDateString("en-CA").slice(5, 7);
        const due = `${String(day).padStart(2, "0")}/${mm}`;
        try {
          await api.updateGroupCost(supabase, s.editGroupId, {
            amount,
            currency: s.editCur,
            members: s.editMembers,
            billingDay: day,
            due,
          });
          dispatch({
            type: "applyGroupCost",
            groupId: s.editGroupId,
            amount,
            currency: s.editCur,
            members: s.editMembers,
            billingDay: day,
            due,
          });
        } catch (e) {
          fail(e);
        }
      },

      saveRate: async () => {
        const r = parseFloat(ref.current.rateDraft) || rate();
        try {
          await api.saveExchangeRate(supabase, userId, r);
          dispatch({ type: "applyRate", rate: r });
        } catch (e) {
          fail(e);
        }
      },

      doDeposit: async () => {
        const s = ref.current;
        const amt = parseFloat(s.depAmount) || 0;
        const bs = s.depCur === "USD" ? amt * rate() : amt;
        const balance = Math.round((s.wallet.balance + bs) * 100) / 100;
        try {
          const tx = await api.deposit(supabase, userId, balance, {
            label: "Depósito",
            sub: s.depCur === "USD" ? "hoy · depósito en USD" : "hoy · QR Simple",
            amount: bs,
          });
          dispatch({ type: "applyDeposit", balance, tx });
        } catch (e) {
          fail(e);
        }
      },

      toggleAutoFund: async () => {
        const next = !ref.current.wallet.auto_fund;
        dispatch({ type: "applyAutoFund", value: next }); // optimistic
        try {
          await api.setAutoFund(supabase, userId, next);
        } catch (e) {
          dispatch({ type: "applyAutoFund", value: !next }); // revert
          fail(e);
        }
      },

      submitPay: async () => {
        const g = currentGroup();
        if (!g) return;
        // Refresh the dollar price on every payment request so the cuota reflects
        // the current official rate.
        await syncOfficial(true);
        const me = ref.current.participants.find((p) => p.group_id === g.id && p.user_id === userId);
        if (!me) {
          dispatch({ type: "flash", msg: "No tienes una ficha en este grupo" });
          return;
        }
        try {
          await api.submitPayment(supabase, me.id);
          dispatch({ type: "applySubmitPay", participantId: me.id });
        } catch (e) {
          fail(e);
        }
      },

      // Approve/reject a member's proof (generic — works for any participant).
      reviewMember: async (participantId, approve) => {
        try {
          await api.reviewParticipant(supabase, participantId, approve);
          dispatch({ type: "applyReview", participantId, paid: approve });
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

      addMember: async () => {
        const s = ref.current;
        const g = currentGroup();
        if (!g) return;
        const name = s.memberDraft.trim();
        if (!name) return;
        const roster = s.participants.filter((p) => p.group_id === g.id);
        const sort = roster.reduce((m, p) => Math.max(m, p.sort), -1) + 1;
        const color = MEMBER_COLORS[roster.length % MEMBER_COLORS.length];
        // Keep the target count at least as large as the roster so the cost
        // split and "pending" figures stay coherent (DB allows up to 50).
        const members = Math.min(50, Math.max(g.members_target, roster.length + 1));
        try {
          const participant = await api.addParticipant(supabase, g.id, { name, color, sort });
          if (members !== g.members_target) {
            await api.updateMembersTarget(supabase, g.id, members);
          }
          dispatch({ type: "applyAddParticipant", participant, members });
        } catch (e) {
          fail(e);
        }
      },

      addMemberByEmail: async () => {
        const s = ref.current;
        const g = currentGroup();
        if (!g) return;
        const email = s.memberEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          dispatch({ type: "flash", msg: "Ingresa un correo válido" });
          return;
        }
        const roster = s.participants.filter((p) => p.group_id === g.id);
        if (roster.some((p) => p.email?.toLowerCase() === email)) {
          dispatch({ type: "flash", msg: "Ese correo ya está en el grupo" });
          return;
        }
        const sort = roster.reduce((m, p) => Math.max(m, p.sort), -1) + 1;
        const color = MEMBER_COLORS[roster.length % MEMBER_COLORS.length];
        const members = Math.min(50, Math.max(g.members_target, roster.length + 1));
        try {
          // Resolve to an existing app user when the email is registered.
          const profile = await api.findProfileByEmail(supabase, email);
          const name = profile?.full_name?.trim() || email.split("@")[0];
          const participant = await api.addParticipant(supabase, g.id, {
            name,
            color,
            sort,
            email,
            userId: profile?.id ?? null,
          });
          if (members !== g.members_target) {
            await api.updateMembersTarget(supabase, g.id, members);
          }
          dispatch({ type: "applyAddParticipant", participant, members });
        } catch (e) {
          fail(e);
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
      setMemberPaid: async (participantId, paid) => {
        try {
          await api.reviewParticipant(supabase, participantId, paid);
          dispatch({ type: "applyMemberPaid", participantId, paid });
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

  // On load: fetch the official BCB rate (for display) and adopt it once daily.
  useEffect(() => {
    actions.initOfficialRate();
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
