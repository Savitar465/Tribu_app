import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency, ServiceId } from "@/lib/types";
import type {
  AppData,
  ChargeRow,
  GroupPaymentRow,
  GroupRow,
  NotificationRow,
  ParticipantRow,
  ProfileRow,
  WalletRow,
  WalletTxRow,
} from "./types";

/**
 * Data-access layer over the Supabase browser client. Every call is subject to
 * Row Level Security, so it can only read/write the signed-in user's rows.
 * Each function throws on error; callers surface a toast.
 */

function must<T>(data: T | null, error: { message: string } | null, what: string): T {
  if (error) throw new Error(`${what}: ${error.message}`);
  if (data === null) throw new Error(`${what}: no data`);
  return data;
}

/** Fetch the full app dataset for a user in parallel. */
export async function fetchAppData(supabase: SupabaseClient, userId: string): Promise<AppData> {
  const [profile, groups, participants, payments, charges, wallet, transactions, notifications] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("groups").select("*").order("created_at", { ascending: true }),
    supabase.from("group_participants").select("*").order("sort", { ascending: true }),
    supabase.from("group_payments").select("*").order("sort", { ascending: true }),
    supabase.from("participant_charges").select("*").is("deleted_at", null).order("cycle", { ascending: true }),
    supabase.from("wallets").select("*").eq("user_id", userId).single(),
    supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    profile: must<ProfileRow>(profile.data, profile.error, "profile"),
    groups: must<GroupRow[]>(groups.data, groups.error, "groups"),
    participants: must<ParticipantRow[]>(participants.data, participants.error, "participants"),
    payments: must<GroupPaymentRow[]>(payments.data, payments.error, "payments"),
    charges: must<ChargeRow[]>(charges.data, charges.error, "charges"),
    wallet: must<WalletRow>(wallet.data, wallet.error, "wallet"),
    transactions: must<WalletTxRow[]>(transactions.data, transactions.error, "transactions"),
    notifications: must<NotificationRow[]>(notifications.data, notifications.error, "notifications"),
  };
}

/** All live (non-archived) charge rows visible to the user (refreshed after a billing run). */
export async function fetchCharges(supabase: SupabaseClient): Promise<ChargeRow[]> {
  const { data, error } = await supabase
    .from("participant_charges")
    .select("*")
    .is("deleted_at", null)
    .order("cycle", { ascending: true });
  return must<ChargeRow[]>(data, error, "fetchCharges");
}

/** Insert this cycle's charge rows (existing (participant, cycle) rows are kept). */
export async function insertCharges(
  supabase: SupabaseClient,
  rows: { group_id: string; participant_id: string; cycle: string; cuota: number; paid: boolean; paid_at: string | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("participant_charges")
    .upsert(rows, { onConflict: "participant_id,cycle", ignoreDuplicates: true });
  if (error) throw new Error(`insertCharges: ${error.message}`);
}

/** Mark a participant's charges for the given cycles as paid/unpaid.
 * `paidBy` records who made the payment (kept null when unpaying). */
export async function setChargesPaid(
  supabase: SupabaseClient,
  participantId: string,
  cycles: string[],
  paid: boolean,
  paidBy: string | null = null,
): Promise<void> {
  if (cycles.length === 0) return;
  const { error } = await supabase
    .from("participant_charges")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null, paid_by: paid ? paidBy : null })
    .eq("participant_id", participantId)
    .in("cycle", cycles);
  if (error) throw new Error(`setChargesPaid: ${error.message}`);
}

/** One payment item: a participant's months being paid together. */
export interface PaymentItem {
  participantId: string;
  cycles: string[];
}

/**
 * Submit a payment atomically via the `submit_payment_v2` RPC — one or many
 * participants, possibly across groups (combined payment) or on behalf of a
 * fellow member. When the caller administers a group, its items are approved
 * immediately (no receipt); otherwise they go into review.
 * Returns how many items were auto-approved vs. left pending.
 */
export async function submitPaymentV2(
  supabase: SupabaseClient,
  items: PaymentItem[],
  proofUrl: string | null,
): Promise<{ approved: number; pending: number }> {
  const { data, error } = await supabase.rpc("submit_payment_v2", {
    p_items: items.map((i) => ({ participant_id: i.participantId, cycles: i.cycles })),
    p_proof_url: proofUrl,
  });
  if (error) throw new Error(`submitPaymentV2: ${error.message}`);
  return { approved: data?.approved ?? 0, pending: data?.pending ?? 0 };
}

/**
 * Soft-delete exported charge rows via the `archive_paid_charges` RPC.
 * Admin-only and paid-rows-only; the whole batch succeeds or nothing is
 * archived. Returns the number of archived rows.
 */
export async function archivePaidCharges(supabase: SupabaseClient, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase.rpc("archive_paid_charges", { p_ids: ids });
  if (error) throw new Error(`archivePaidCharges: ${error.message}`);
  return data ?? 0;
}

/** The signed-in user's notification feed (newest first). */
export async function fetchNotifications(supabase: SupabaseClient): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return must<NotificationRow[]>(data, error, "fetchNotifications");
}

/** Insert charge notifications for a group's members (admin-only via RLS). */
export async function insertNotifications(
  supabase: SupabaseClient,
  rows: { user_id: string; group_id: string; title: string; body: string }[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw new Error(`insertNotifications: ${error.message}`);
}

/** Stamp a group's processed billing cycle and freeze the charged cuota (Bs). */
export async function markGroupBilled(
  supabase: SupabaseClient,
  groupId: string,
  cycle: string,
  cuota: number,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ billed_cycle: cycle, billed_cuota: cuota })
    .eq("id", groupId);
  if (error) throw new Error(`markGroupBilled: ${error.message}`);
}

/** Mark all of the user's notifications as read. */
export async function markNotificationsRead(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw new Error(`markNotificationsRead: ${error.message}`);
}

/** Persist an edited group cost (amount, currency, members and billing day). */
export async function updateGroupCost(
  supabase: SupabaseClient,
  groupId: string,
  values: {
    amount: number;
    currency: Currency;
    members: number;
    billingDay: number;
    due: string;
    round: boolean;
    /** New frozen cuota when the group was already billed this cycle (null clears the freeze). */
    billedCuota: number | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({
      amount: values.amount,
      currency: values.currency,
      members_target: values.members,
      billing_day: values.billingDay,
      due: values.due,
      round_cuota: values.round,
      billed_cuota: values.billedCuota,
    })
    .eq("id", groupId);
  if (error) throw new Error(`updateGroupCost: ${error.message}`);
}

/** Storage bucket holding per-group payment QR images (see 0014_group_qr.sql). */
const QR_BUCKET = "payment-qr";

/**
 * Upload (or replace) a group's payment QR image and persist its public URL.
 * The object lives at `<group_id>/qr`; Storage RLS restricts writes to the
 * group admin. Returns the stored URL (cache-busted so a replaced image shows
 * immediately).
 */
export async function uploadGroupQr(
  supabase: SupabaseClient,
  groupId: string,
  file: File,
): Promise<string> {
  const path = `${groupId}/qr`;
  const uploaded = await supabase.storage
    .from(QR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploaded.error) throw new Error(`uploadGroupQr(storage): ${uploaded.error.message}`);

  const { data } = supabase.storage.from(QR_BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;
  const updated = await supabase.from("groups").update({ qr_image_url: url }).eq("id", groupId);
  if (updated.error) throw new Error(`uploadGroupQr(group): ${updated.error.message}`);
  return url;
}

/** Storage bucket holding members' transfer receipts (see 0015_payment_methods.sql). */
const PROOF_BUCKET = "payment-proofs";

/**
 * Upload (or replace) a member's transfer receipt for a group. The object
 * lives at `<group_id>/<participant_id>`; Storage RLS restricts writes to
 * that group's members. Returns the stored URL (cache-busted).
 */
export async function uploadPaymentProof(
  supabase: SupabaseClient,
  groupId: string,
  participantId: string,
  file: File,
): Promise<string> {
  const path = `${groupId}/${participantId}`;
  const uploaded = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploaded.error) throw new Error(`uploadPaymentProof: ${uploaded.error.message}`);
  const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Save the admin's international payment methods (PayPal / bank transfer). */
export async function updateGroupPayMethods(
  supabase: SupabaseClient,
  groupId: string,
  values: { paypal: string | null; bank: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ paypal_info: values.paypal, bank_info: values.bank })
    .eq("id", groupId);
  if (error) throw new Error(`updateGroupPayMethods: ${error.message}`);
}

/** Delete a group's payment QR image and clear its URL. */
export async function clearGroupQr(supabase: SupabaseClient, groupId: string): Promise<void> {
  const removed = await supabase.storage.from(QR_BUCKET).remove([`${groupId}/qr`]);
  if (removed.error) throw new Error(`clearGroupQr(storage): ${removed.error.message}`);
  const updated = await supabase.from("groups").update({ qr_image_url: null }).eq("id", groupId);
  if (updated.error) throw new Error(`clearGroupQr(group): ${updated.error.message}`);
}

/** Save the user's exchange rate. */
export async function saveExchangeRate(
  supabase: SupabaseClient,
  userId: string,
  rate: number,
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ exchange_rate: rate }).eq("id", userId);
  if (error) throw new Error(`saveExchangeRate: ${error.message}`);
}

/** Adopt the official rate and stamp the sync day (daily auto-sync). */
export async function saveOfficialRate(
  supabase: SupabaseClient,
  userId: string,
  rate: number,
  syncedOn: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ exchange_rate: rate, rate_synced_on: syncedOn })
    .eq("id", userId);
  if (error) throw new Error(`saveOfficialRate: ${error.message}`);
}

/** Submit a prepay (N months in advance) for admin approval. */
export async function submitPrepay(
  supabase: SupabaseClient,
  participantId: string,
  values: { amount: number; months: number; proofUrl: string },
): Promise<void> {
  const { error } = await supabase
    .from("group_participants")
    .update({
      prepay_pending: values.amount,
      prepay_months: values.months,
      proof_url: values.proofUrl,
      proof_pending: true,
    })
    .eq("id", participantId);
  if (error) throw new Error(`submitPrepay: ${error.message}`);
}

/** Patch a participant's billing state (prepaid balance, paid flags, cycle stamp). */
export async function updateParticipantBilling(
  supabase: SupabaseClient,
  participantId: string,
  patch: {
    prepaid_balance?: number;
    paid?: boolean;
    proof_pending?: boolean;
    prepay_pending?: number | null;
    prepay_months?: number | null;
    billed_cycle?: string;
    pay_cycles?: string[] | null;
    proof_by?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("group_participants").update(patch).eq("id", participantId);
  if (error) throw new Error(`updateParticipantBilling: ${error.message}`);
}

/** Set (or clear with null) a member's custom monthly price and the currency
 * it's defined in. Admin-only via RLS + the member-update guard.
 * When `pct` is provided, the member pays that percentage of the group total
 * each month (recalculated at each billing cycle's exchange rate). */
export async function setParticipantPrice(
  supabase: SupabaseClient,
  participantId: string,
  amount: number | null,
  currency: Currency | null,
  pct: number | null = null,
): Promise<void> {
  const { error } = await supabase
    .from("group_participants")
    .update({
      custom_amount: pct != null ? null : amount,
      custom_currency: pct != null ? null : (amount == null ? null : currency),
      custom_pct: pct,
    })
    .eq("id", participantId);
  if (error) throw new Error(`setParticipantPrice: ${error.message}`);
}

/** Re-price a participant's still-unpaid charge for a cycle (after the admin
 * changes their custom price mid-month). Paid rows are never rewritten. */
export async function updateChargeCuota(
  supabase: SupabaseClient,
  participantId: string,
  cycle: string,
  cuota: number,
): Promise<void> {
  const { error } = await supabase
    .from("participant_charges")
    .update({ cuota })
    .eq("participant_id", participantId)
    .eq("cycle", cycle)
    .eq("paid", false);
  if (error) throw new Error(`updateChargeCuota: ${error.message}`);
}

/** Approve or reject a participant's proof. */
export async function reviewParticipant(
  supabase: SupabaseClient,
  participantId: string,
  approve: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("group_participants")
    .update({ paid: approve, proof_pending: false })
    .eq("id", participantId);
  if (error) throw new Error(`reviewParticipant: ${error.message}`);
}

/** Create a new group the user administers, plus their own roster row. */
export async function createGroup(
  supabase: SupabaseClient,
  userId: string,
  values: {
    serviceId: ServiceId;
    name: string;
    amount: number;
    currency: Currency;
    members: number;
    billingDay: number;
    due: string;
    color: string | null;
    /** False → the admin manages the plan without occupying a slot (no self row). */
    adminParticipates: boolean;
  },
): Promise<{ group: GroupRow; participants: ParticipantRow[] }> {
  const insertGroup = await supabase
    .from("groups")
    .insert({
      owner_id: userId,
      service_id: values.serviceId,
      name: values.name,
      amount: values.amount,
      currency: values.currency,
      members_target: values.members,
      billing_day: values.billingDay,
      role: "admin",
      self_status: "paid",
      due: values.due,
      color: values.color,
      admin_participates: values.adminParticipates,
    })
    .select("*")
    .single();
  const group = must<GroupRow>(insertGroup.data, insertGroup.error, "createGroup(group)");

  if (!values.adminParticipates) return { group, participants: [] };

  const insertSelf = await supabase
    .from("group_participants")
    .insert({ group_id: group.id, name: "Tú", color: "#5b8cff", paid: true, is_self: true, sort: 0, user_id: userId })
    .select("*")
    .single();
  const self = must<ParticipantRow>(insertSelf.data, insertSelf.error, "createGroup(self)");

  return { group, participants: [self] };
}

/** Flip whether the admin occupies a slot: creates or removes their own
 * `is_self` roster row and stamps the flag on the group. Returns the created
 * row when joining (null when leaving). */
export async function setAdminParticipation(
  supabase: SupabaseClient,
  group: { id: string; ownerId: string },
  values: { participate: boolean; selfParticipantId: string | null; sort: number },
): Promise<ParticipantRow | null> {
  const flagged = await supabase
    .from("groups")
    .update({ admin_participates: values.participate })
    .eq("id", group.id);
  if (flagged.error) throw new Error(`setAdminParticipation(flag): ${flagged.error.message}`);

  if (values.participate) {
    const inserted = await supabase
      .from("group_participants")
      .insert({ group_id: group.id, name: "Tú", color: "#5b8cff", paid: true, is_self: true, sort: values.sort, user_id: group.ownerId })
      .select("*")
      .single();
    return must<ParticipantRow>(inserted.data, inserted.error, "setAdminParticipation(join)");
  }

  if (values.selfParticipantId) {
    const removed = await supabase.from("group_participants").delete().eq("id", values.selfParticipantId);
    if (removed.error) throw new Error(`setAdminParticipation(leave): ${removed.error.message}`);
  }
  return null;
}

/** Add a person to a group's roster. RLS lets the group owner insert freely. */
export async function addParticipant(
  supabase: SupabaseClient,
  groupId: string,
  values: { name: string; color: string; sort: number; email?: string | null; userId?: string | null },
): Promise<ParticipantRow> {
  const inserted = await supabase
    .from("group_participants")
    .insert({
      group_id: groupId,
      name: values.name,
      color: values.color,
      sort: values.sort,
      email: values.email ?? null,
      user_id: values.userId ?? null,
    })
    .select("*")
    .single();
  return must<ParticipantRow>(inserted.data, inserted.error, "addParticipant");
}

/** Resolve an email to an existing app user (or null) via the lookup RPC. */
export async function findProfileByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string; full_name: string | null; mono: string | null } | null> {
  const { data, error } = await supabase.rpc("find_profile_by_email", { p_email: email });
  if (error) throw new Error(`findProfileByEmail: ${error.message}`);
  return data && data.length > 0 ? data[0] : null;
}

/** A registered user surfaced by the member-search field. */
export interface ProfileMatch {
  id: string;
  full_name: string | null;
  email: string | null;
  mono: string | null;
}

/** Search registered users by name or email (for the add-member modal). */
export async function searchProfiles(supabase: SupabaseClient, query: string): Promise<ProfileMatch[]> {
  const { data, error } = await supabase.rpc("search_profiles", { p_query: query });
  if (error) throw new Error(`searchProfiles: ${error.message}`);
  return data ?? [];
}

/** Remove a person from a group's roster. */
export async function removeParticipant(supabase: SupabaseClient, participantId: string): Promise<void> {
  const { error } = await supabase.from("group_participants").delete().eq("id", participantId);
  if (error) throw new Error(`removeParticipant: ${error.message}`);
}

/** Rename a roster member. */
export async function renameParticipant(
  supabase: SupabaseClient,
  participantId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.from("group_participants").update({ name }).eq("id", participantId);
  if (error) throw new Error(`renameParticipant: ${error.message}`);
}

/** Swap the sort order of two roster members (two independent updates). */
export async function reorderParticipants(
  supabase: SupabaseClient,
  a: { id: string; sort: number },
  b: { id: string; sort: number },
): Promise<void> {
  const [ra, rb] = await Promise.all([
    supabase.from("group_participants").update({ sort: a.sort }).eq("id", a.id),
    supabase.from("group_participants").update({ sort: b.sort }).eq("id", b.id),
  ]);
  if (ra.error) throw new Error(`reorderParticipants: ${ra.error.message}`);
  if (rb.error) throw new Error(`reorderParticipants: ${rb.error.message}`);
}

/** Flip whether a group joins the admin's joint-payment bundle. */
export async function updateGroupJointPay(
  supabase: SupabaseClient,
  groupId: string,
  jointPay: boolean,
): Promise<void> {
  const { error } = await supabase.from("groups").update({ joint_pay: jointPay }).eq("id", groupId);
  if (error) throw new Error(`updateGroupJointPay: ${error.message}`);
}

/** Make one group the owner's joint-payment collection method (its QR/PayPal/
 * bank are what the bundle shows). Clears the mark on the owner's other groups
 * first — the partial unique index allows a single source per owner. */
export async function setJointMethodSource(
  supabase: SupabaseClient,
  ownerId: string,
  groupId: string,
): Promise<void> {
  const cleared = await supabase
    .from("groups")
    .update({ joint_method: false })
    .eq("owner_id", ownerId)
    .neq("id", groupId);
  if (cleared.error) throw new Error(`setJointMethodSource(clear): ${cleared.error.message}`);
  const set = await supabase.from("groups").update({ joint_method: true }).eq("id", groupId);
  if (set.error) throw new Error(`setJointMethodSource(set): ${set.error.message}`);
}

/** Delete a group the user administers. RLS restricts this to the owner and
 * every child table (participants, charges, payments, notifications) cascades. */
export async function deleteGroup(supabase: SupabaseClient, groupId: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(`deleteGroup: ${error.message}`);
}

/** Update just the target member count of a group (cost split denominator). */
export async function updateMembersTarget(
  supabase: SupabaseClient,
  groupId: string,
  members: number,
): Promise<void> {
  const { error } = await supabase.from("groups").update({ members_target: members }).eq("id", groupId);
  if (error) throw new Error(`updateMembersTarget: ${error.message}`);
}

