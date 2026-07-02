import type { StatusKey } from "./theme";

/** Currency a plan is billed in. */
export type Currency = "BOB" | "USD";

/** Identifier for a supported subscription service. */
export type ServiceId =
  | "spotify"
  | "netflix"
  | "youtube"
  | "disney"
  | "chatgpt"
  | "max"
  | "canva"
  | "one"
  | "others";

/** Static, presentational metadata for a service (name, monogram, brand color). */
export interface ServiceMeta {
  mono: string;
  color: string;
  name: string;
  plan: string;
  /** Billing day, formatted as `dd/mm`. */
  due: string;
}

/** Editable cost configuration for a group. */
export interface Cost {
  amount: number;
  cur: Currency;
  members: number;
}

/** The set of navigable screens (the state-machine nodes). */
export type Screen =
  | "home"
  | "dashboard"
  | "group"
  | "create"
  | "pay"
  | "qr"
  | "approve"
  | "wallet"
  | "history"
  | "notifications"
  | "profile"
  | "edit"
  | "fx"
  | "deposit";

/** A group as presented in list/detail views. */
export interface GroupView {
  /** Database row id (uuid). */
  id: string;
  /** Which catalog service this group is for. */
  serviceId: ServiceId;
  mono: string;
  color: string;
  name: string;
  plan: string;
  due: string;
  owned: boolean;
  statusKey: StatusKey;
  /** Per-member share, formatted (e.g. "10 Bs"). */
  cuota: string;
  /** Total monthly cost, formatted. */
  monthly: string;
  members: string;
  usdNote: string;
  isUsd: boolean;
  perBs: number;
  totalBs: number;
  /** Admin-only collection figures (present when `owned`). */
  admin?: {
    collected: string;
    pending: string;
    total: string;
    pct: string;
    pendingCount: string;
  };
}
