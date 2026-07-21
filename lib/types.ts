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
  | "admin"
  | "create"
  | "pay"
  | "paycombined"
  | "qr"
  | "approve"
  | "arrears"
  | "wallet"
  | "history"
  | "notifications"
  | "profile"
  | "fx";

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
  /** Next due date, formatted `dd/mm` (always the upcoming billing-day occurrence). */
  due: string;
  /** Year of the next due date, e.g. "2026". */
  dueYear: string;
  owned: boolean;
  statusKey: StatusKey;
  /** Per-member share, formatted (e.g. "10 Bs"). */
  cuota: string;
  /** Total monthly cost, formatted. */
  monthly: string;
  members: string;
  usdNote: string;
  isUsd: boolean;
  /** The viewer's own cuota (Bs) — honors their custom price when set. */
  perBs: number;
  /** The group's default per-member split (Bs), ignoring custom prices. */
  defaultPerBs: number;
  totalBs: number;
  /** Public URL of the admin's payment QR image (null when not uploaded). */
  qrImageUrl: string | null;
  /** PayPal email or paypal.me link for payments from abroad (null when unset). */
  paypalInfo: string | null;
  /** Free-text account details for transfers (e.g. UglyCash); null when unset. */
  bankInfo: string | null;
  /** Admin-only collection figures (present when `owned`). */
  admin?: {
    collected: string;
    pending: string;
    total: string;
    pct: string;
    pendingCount: string;
    /** Numeric collection figures (for cross-group aggregation). */
    collectedBs: number;
    targetBs: number;
  };
}
