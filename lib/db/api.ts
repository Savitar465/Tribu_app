import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency, ServiceId } from "@/lib/types";
import type {
  AppData,
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
  const [profile, groups, participants, payments, wallet, transactions, notifications] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("groups").select("*").order("created_at", { ascending: true }),
    supabase.from("group_participants").select("*").order("sort", { ascending: true }),
    supabase.from("group_payments").select("*").order("sort", { ascending: true }),
    supabase.from("wallets").select("*").eq("user_id", userId).single(),
    supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    profile: must<ProfileRow>(profile.data, profile.error, "profile"),
    groups: must<GroupRow[]>(groups.data, groups.error, "groups"),
    participants: must<ParticipantRow[]>(participants.data, participants.error, "participants"),
    payments: must<GroupPaymentRow[]>(payments.data, payments.error, "payments"),
    wallet: must<WalletRow>(wallet.data, wallet.error, "wallet"),
    transactions: must<WalletTxRow[]>(transactions.data, transactions.error, "transactions"),
    notifications: must<NotificationRow[]>(notifications.data, notifications.error, "notifications"),
  };
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

/** Record a deposit: set the new balance and append a movement. */
export async function deposit(
  supabase: SupabaseClient,
  userId: string,
  newBalance: number,
  tx: { label: string; sub: string; amount: number },
): Promise<WalletTxRow> {
  const walletUpdate = await supabase.from("wallets").update({ balance: newBalance }).eq("user_id", userId);
  if (walletUpdate.error) throw new Error(`deposit(wallet): ${walletUpdate.error.message}`);

  const inserted = await supabase
    .from("wallet_transactions")
    .insert({ user_id: userId, label: tx.label, sub: tx.sub, amount: tx.amount })
    .select("*")
    .single();
  return must<WalletTxRow>(inserted.data, inserted.error, "deposit(tx)");
}

/** Toggle the wallet's auto-pay setting. */
export async function setAutoFund(
  supabase: SupabaseClient,
  userId: string,
  value: boolean,
): Promise<void> {
  const { error } = await supabase.from("wallets").update({ auto_fund: value }).eq("user_id", userId);
  if (error) throw new Error(`setAutoFund: ${error.message}`);
}

/** Move the user's own roster row into "review" after submitting a proof. */
export async function submitPayment(supabase: SupabaseClient, participantId: string): Promise<void> {
  const { error } = await supabase
    .from("group_participants")
    .update({ proof_pending: true, paid: false })
    .eq("id", participantId);
  if (error) throw new Error(`submitPayment: ${error.message}`);
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
    })
    .select("*")
    .single();
  const group = must<GroupRow>(insertGroup.data, insertGroup.error, "createGroup(group)");

  const insertSelf = await supabase
    .from("group_participants")
    .insert({ group_id: group.id, name: "Tú", color: "#5b8cff", paid: true, is_self: true, sort: 0, user_id: userId })
    .select("*")
    .single();
  const self = must<ParticipantRow>(insertSelf.data, insertSelf.error, "createGroup(self)");

  return { group, participants: [self] };
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

/** Update just the target member count of a group (cost split denominator). */
export async function updateMembersTarget(
  supabase: SupabaseClient,
  groupId: string,
  members: number,
): Promise<void> {
  const { error } = await supabase.from("groups").update({ members_target: members }).eq("id", groupId);
  if (error) throw new Error(`updateMembersTarget: ${error.message}`);
}

