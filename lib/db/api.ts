import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency, ServiceId } from "@/lib/types";
import type {
  AppData,
  GroupPaymentRow,
  GroupRow,
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
  const [profile, groups, participants, payments, wallet, transactions] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("groups").select("*").order("created_at", { ascending: true }),
    supabase.from("group_participants").select("*").order("sort", { ascending: true }),
    supabase.from("group_payments").select("*").order("sort", { ascending: true }),
    supabase.from("wallets").select("*").eq("user_id", userId).single(),
    supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }),
  ]);

  return {
    profile: must<ProfileRow>(profile.data, profile.error, "profile"),
    groups: must<GroupRow[]>(groups.data, groups.error, "groups"),
    participants: must<ParticipantRow[]>(participants.data, participants.error, "participants"),
    payments: must<GroupPaymentRow[]>(payments.data, payments.error, "payments"),
    wallet: must<WalletRow>(wallet.data, wallet.error, "wallet"),
    transactions: must<WalletTxRow[]>(transactions.data, transactions.error, "transactions"),
  };
}

/** Persist an edited group cost. */
export async function updateGroupCost(
  supabase: SupabaseClient,
  groupId: string,
  values: { amount: number; currency: Currency; members: number },
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ amount: values.amount, currency: values.currency, members_target: values.members })
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

/** Move the user's own cuota into "review" after submitting a proof. */
export async function submitPayment(supabase: SupabaseClient, groupId: string): Promise<void> {
  const { error } = await supabase.from("groups").update({ self_status: "review" }).eq("id", groupId);
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
    })
    .select("*")
    .single();
  const group = must<GroupRow>(insertGroup.data, insertGroup.error, "createGroup(group)");

  const insertSelf = await supabase
    .from("group_participants")
    .insert({ group_id: group.id, name: "Tú", color: "#5b8cff", paid: true, is_self: true, sort: 0 })
    .select("*")
    .single();
  const self = must<ParticipantRow>(insertSelf.data, insertSelf.error, "createGroup(self)");

  return { group, participants: [self] };
}

/** Seed the sample dataset for the current user via the SECURITY INVOKER RPC. */
export async function loadSampleData(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("load_sample_data");
  if (error) throw new Error(`loadSampleData: ${error.message}`);
}
