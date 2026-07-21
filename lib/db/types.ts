import type { Currency, ServiceId } from "@/lib/types";
import type { StatusKey } from "@/lib/theme";

/** Row shapes as stored in Supabase (see supabase/migrations/0001_init.sql). */

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  mono: string | null;
  exchange_rate: number;
  /** Day (yyyy-mm-dd) the official rate was last auto-applied; null if never. */
  rate_synced_on: string | null;
  created_at: string;
}

export interface GroupRow {
  id: string;
  owner_id: string;
  service_id: ServiceId;
  name: string;
  amount: number;
  currency: Currency;
  members_target: number;
  billing_day: number;
  role: "admin" | "member";
  self_status: StatusKey;
  due: string | null;
  /** Optional per-group brand color (custom "others" groups); null → use service color. */
  color: string | null;
  /** Round each member's cuota up to the next whole Bs. */
  round_cuota: boolean;
  /** Last billing cycle processed for this group (yyyy-mm); null if never. */
  billed_cycle: string | null;
  /** Per-member cuota (Bs) frozen at the rate captured on the billing day. */
  billed_cuota: number | null;
  /** Bs-per-USD rate used by the last billing run; null until first charge.
   * Display converts at this rate so totals only move on the billing day. */
  billed_rate: number | null;
  /** Public URL of the admin's payment QR image; null when not uploaded. */
  qr_image_url: string | null;
  /** PayPal email or paypal.me link for payments from abroad; null when unset. */
  paypal_info: string | null;
  /** Free-text account details (e.g. UglyCash / bank transfer); null when unset. */
  bank_info: string | null;
  /** False when the admin manages the plan without occupying a slot (no self row). */
  admin_participates: boolean;
  /** True when the admin marked this group as payable together with their
   * other joint groups (one QR / receipt for the whole bundle). */
  joint_pay: boolean;
  /** True on the single group whose payment methods (QR/PayPal/bank) the
   * owner's joint-payment bundle uses. */
  joint_method: boolean;
  /** True when the monthly amount changes every cycle (e.g. luz, agua):
   * billing waits until the admin confirms this month's price. */
  variable_price: boolean;
  /** Last cycle (yyyy-mm) whose price the admin confirmed; a variable-price
   * group is only billed when it matches the current cycle. */
  price_confirmed_cycle: string | null;
  /** Last cycle (yyyy-mm) the admin was asked to update the price for
   * (dedupes the request notification across billing runs). */
  price_request_cycle: string | null;
  created_at: string;
}

/** A per-user feed entry (e.g. a monthly charge announcement). */
export interface NotificationRow {
  id: string;
  user_id: string;
  group_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface ParticipantRow {
  id: string;
  group_id: string;
  name: string;
  color: string;
  paid: boolean;
  proof_pending: boolean;
  is_self: boolean;
  sort: number;
  /** Email the member was added with (null for plain name-only members). */
  email: string | null;
  /** Linked profile id when the email belongs to an existing app user. */
  user_id: string | null;
  /** Public URL of the member's transfer receipt image; null when none uploaded. */
  proof_url: string | null;
  /** Prepaid balance (Bs) the monthly cuota is deducted from. */
  prepaid_balance: number;
  /** Submitted prepay amount (Bs) awaiting admin approval; null when none. */
  prepay_pending: number | null;
  /** Months declared for the pending prepay; null when none. */
  prepay_months: number | null;
  /** Last billing cycle (yyyy-mm) processed for this participant; null if never. */
  billed_cycle: string | null;
  /** Cycles (yyyy-mm) a submitted receipt is paying; null when none pending. */
  pay_cycles: string[] | null;
  /** User who submitted the pending proof (null = the member themself). */
  proof_by: string | null;
  /** Admin-set price override (null = default split). */
  custom_amount: number | null;
  /** Currency `custom_amount` is defined in (null = the group's currency). */
  custom_currency: Currency | null;
  /** Admin-set percentage of the group total (null = not percentage-based).
   * When set, overrides custom_amount: cuota = totalBs * custom_pct / 100. */
  custom_pct: number | null;
}

/** One month's charge for one participant (cuota frozen at that month's rate). */
export interface ChargeRow {
  id: string;
  group_id: string;
  participant_id: string;
  cycle: string;
  cuota: number;
  paid: boolean;
  paid_at: string | null;
  /** Last automatic reminder tier sent (0 none, 1 at 3 days, 2 at 7 days). */
  reminder_level: number;
  /** User whose payment settled the charge (null = system/prepaid/legacy). */
  paid_by: string | null;
  /** Soft-delete stamp set when the admin archives exported rows; null = live. */
  deleted_at: string | null;
  created_at: string;
}

export interface GroupPaymentRow {
  id: string;
  group_id: string;
  month: string;
  ok: boolean;
  sort: number;
}

export interface WalletRow {
  user_id: string;
  balance: number;
  auto_fund: boolean;
}

export interface WalletTxRow {
  id: string;
  user_id: string;
  label: string;
  sub: string | null;
  amount: number;
  created_at: string;
}

/** Minimal profile of a group owner the user shares a group with (via the
 * get_group_owner_profiles RPC — profiles RLS is owner-only). */
export interface OwnerProfileRow {
  id: string;
  full_name: string | null;
  mono: string | null;
}

/** Everything the app needs for the signed-in user, fetched on load. */
export interface AppData {
  profile: ProfileRow;
  groups: GroupRow[];
  participants: ParticipantRow[];
  payments: GroupPaymentRow[];
  charges: ChargeRow[];
  wallet: WalletRow;
  transactions: WalletTxRow[];
  notifications: NotificationRow[];
  /** Display names of the owners of the user's groups. */
  ownerProfiles: OwnerProfileRow[];
}
