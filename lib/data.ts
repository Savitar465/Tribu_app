import type { ServiceId, ServiceMeta } from "./types";

/**
 * Client-side reference data. Group/wallet/profile records now live in Supabase;
 * what remains here is presentational metadata and small static lists that don't
 * belong to a single user.
 */

/** Presentational metadata for every service that can appear in a group. */
export const SERVICE_META: Record<ServiceId, ServiceMeta> = {
  spotify: { mono: "S", color: "#1DB954", name: "Spotify Premium", plan: "Plan Familiar", due: "05/07" },
  netflix: { mono: "N", color: "#E50914", name: "Netflix", plan: "Premium 4K", due: "02/07" },
  youtube: { mono: "Y", color: "#FF0000", name: "YouTube Premium", plan: "Familiar", due: "10/07" },
  disney: { mono: "D", color: "#1f5fe0", name: "Disney+", plan: "Estándar", due: "28/06" },
  chatgpt: { mono: "AI", color: "#10A37F", name: "ChatGPT Team", plan: "Equipo", due: "15/07" },
  max: { mono: "M", color: "#0046ff", name: "Max", plan: "Estándar", due: "12/07" },
  canva: { mono: "C", color: "#00c4cc", name: "Canva", plan: "Equipos", due: "20/07" },
  one: { mono: "G", color: "#e8a020", name: "Google One", plan: "Premium", due: "08/07" },
};

/** Service ids whose dues are auto-debited from the shared fund. */
export const FUND_COVERED: ServiceId[] = ["spotify", "netflix", "youtube", "disney"];

/** Services offered when creating a new group. */
export const CREATE_SERVICES: ServiceId[] = [
  "spotify",
  "netflix",
  "youtube",
  "disney",
  "max",
  "canva",
  "chatgpt",
  "one",
];

/** Scheduled auto-payments shown in the wallet (amounts resolved from live groups). */
export const SCHEDULED: { id: ServiceId; label: string; date: string }[] = [
  { id: "spotify", label: "Spotify Premium", date: "05 jul" },
  { id: "netflix", label: "Netflix", date: "02 ago" },
  { id: "youtube", label: "YouTube Premium", date: "10 ago" },
];

/** Exchange-rate quick presets. */
export const RATE_PRESETS: { v: number; label: string }[] = [
  { v: 6.96, label: "Oficial" },
  { v: 7.5, label: "7.50" },
  { v: 8.5, label: "8.50" },
];
