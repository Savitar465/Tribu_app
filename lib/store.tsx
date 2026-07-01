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
import { SERVICE_META } from "@/lib/data";
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
  depAmount: string;
  depCur: Currency;
  rateDraft: string;
  createName: string;
  createAmount: string;
  createMembers: string;
  createBillingDay: string;

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
    depAmount: "50",
    depCur: "BOB",
    rateDraft: String(data.profile.exchange_rate),
    createName: SERVICE_META.spotify.name,
    createAmount: "60",
    createMembers: "6",
    createBillingDay: "5",
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
  | { type: "openFx" }
  | { type: "setRateDraft"; value: string }
  | { type: "presetRate"; value: number }
  | { type: "openDeposit" }
  | { type: "setDepAmount"; value: string }
  | { type: "setDepCur"; cur: Currency }
  | { type: "setCreate"; field: "name" | "amount" | "members" | "billingDay"; value: string }
  // applied after a successful persist:
  | { type: "applyGroupCost"; groupId: string; amount: number; currency: Currency; members: number }
  | { type: "applyDeposit"; balance: number; tx: WalletTxRow }
  | { type: "applyAutoFund"; value: boolean }
  | { type: "applyRate"; rate: number }
  | { type: "applySubmitPay"; groupId: string }
  | { type: "applyReview"; participantId: string; paid: boolean }
  | { type: "applyCreateGroup"; group: GroupRow; participants: ParticipantRow[] }
  | { type: "applyData"; data: AppData };

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
      return { ...state, selService: action.id, createName: meta.name };
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
      };
    }
    case "setEditAmount":
      return { ...state, editAmount: sanitizeNumeric(action.value) };
    case "setEditCur":
      return { ...state, editCur: action.cur };
    case "bumpMembers":
      return { ...state, editMembers: Math.max(1, Math.min(20, state.editMembers + action.delta)) };

    case "openFx":
      return { ...state, screen: "fx", rateDraft: String(state.profile.exchange_rate) };
    case "setRateDraft":
      return { ...state, rateDraft: sanitizeNumeric(action.value) };
    case "presetRate":
      return { ...state, rateDraft: String(action.value) };

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

    case "applyGroupCost": {
      const groups = state.groups.map((g) =>
        g.id === action.groupId
          ? { ...g, amount: action.amount, currency: action.currency, members_target: action.members }
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
      const groups = state.groups.map((g) => (g.id === action.groupId ? { ...g, self_status: "review" as const } : g));
      return flash({ ...state, groups, screen: "group" }, "Comprobante enviado · pendiente de validación");
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
    case "applyData":
      return flash(
        {
          ...state,
          profile: action.data.profile,
          groups: action.data.groups,
          participants: action.data.participants,
          payments: action.data.payments,
          wallet: action.data.wallet,
          transactions: action.data.transactions,
          agId: action.data.groups[0]?.id ?? null,
          screen: "home",
        },
        "Datos de ejemplo cargados",
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
  saveEdit: () => void;
  openFx: () => void;
  setRateDraft: (value: string) => void;
  presetRate: (value: number) => void;
  saveRate: () => void;
  openDeposit: () => void;
  setDepAmount: (value: string) => void;
  setDepCur: (cur: Currency) => void;
  doDeposit: () => void;
  toggleAutoFund: () => void;
  submitPay: () => void;
  approveCarlos: () => void;
  rejectCarlos: () => void;
  setCreate: (field: "name" | "amount" | "members" | "billingDay", value: string) => void;
  createGroup: () => void;
  loadSample: () => void;
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
      openFx: () => dispatch({ type: "openFx" }),
      setRateDraft: (value) => dispatch({ type: "setRateDraft", value }),
      presetRate: (value) => dispatch({ type: "presetRate", value }),
      openDeposit: () => dispatch({ type: "openDeposit" }),
      setDepAmount: (value) => dispatch({ type: "setDepAmount", value }),
      setDepCur: (cur) => dispatch({ type: "setDepCur", cur }),
      setCreate: (field, value) => dispatch({ type: "setCreate", field, value }),

      saveEdit: async () => {
        const s = ref.current;
        if (!s.editGroupId) return;
        const amount = parseFloat(s.editAmount) || 0;
        try {
          await api.updateGroupCost(supabase, s.editGroupId, { amount, currency: s.editCur, members: s.editMembers });
          dispatch({ type: "applyGroupCost", groupId: s.editGroupId, amount, currency: s.editCur, members: s.editMembers });
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
        try {
          await api.submitPayment(supabase, g.id);
          dispatch({ type: "applySubmitPay", groupId: g.id });
        } catch (e) {
          fail(e);
        }
      },

      approveCarlos: async () => {
        const g = currentGroup();
        const p = ref.current.participants.find((x) => x.group_id === g?.id && x.proof_pending);
        if (!p) return;
        try {
          await api.reviewParticipant(supabase, p.id, true);
          dispatch({ type: "applyReview", participantId: p.id, paid: true });
        } catch (e) {
          fail(e);
        }
      },

      rejectCarlos: async () => {
        const g = currentGroup();
        const p = ref.current.participants.find((x) => x.group_id === g?.id && x.proof_pending);
        if (!p) return;
        try {
          await api.reviewParticipant(supabase, p.id, false);
          dispatch({ type: "applyReview", participantId: p.id, paid: false });
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
            currency: "BOB",
            members,
            billingDay: day,
            due: `${String(day).padStart(2, "0")}/07`,
          });
          dispatch({ type: "applyCreateGroup", group, participants });
        } catch (e) {
          fail(e);
        }
      },

      loadSample: async () => {
        try {
          await api.loadSampleData(supabase);
          const data = await api.fetchAppData(supabase, userId);
          dispatch({ type: "applyData", data });
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

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Access the app state and bound actions. Must be used within `AppProvider`. */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
