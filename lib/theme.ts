/**
 * Design tokens — the single source of truth for colors used across Tribu.
 * Ported from design/Tribu.html ("Oscuro vibrante" / dark-vibrant variant).
 */

/** Brand gradient endpoints (matches the interactive prototype). */
export const ACCENT = "#5b8cff";
export const ACCENT_2 = "#9b6bff";

/** `linear-gradient` string used for hero cards and primary buttons. */
export const GRADIENT = `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`;

export const colors = {
  /** App background (deepest layer). */
  bg: "#0d0f14",
  /** Raised card surface. */
  surface: "#161a21",
  /** Slightly lighter control surface (inputs, secondary buttons). */
  surface2: "#181c24",
  /** Inset / well surface. */
  inset: "#14171e",
  /** Pressed / stepper surface. */
  surface3: "#20242e",

  textPrimary: "#f3f5f8",
  textSecondary: "#cfd4de",
  textMuted: "#8b93a3",
  textFaint: "#5b6373",
  textNav: "#69707f",

  positive: "#36d07a",
  warning: "#f5b53d",
  danger: "#ff6b6b",
  info: "#7ba6ff",

  hairline: "rgba(255,255,255,0.06)",
  hairlineSoft: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.08)",
} as const;

/** Payment-status styling keyed by status, mirroring DCLogic.STATUS. */
export const STATUS = {
  paid: { label: "Pagado", bg: "rgba(54,208,122,0.15)", color: colors.positive },
  pending: { label: "Pendiente", bg: "rgba(245,181,61,0.16)", color: colors.warning },
  overdue: { label: "Vencido", bg: "rgba(255,107,107,0.16)", color: colors.danger },
  review: { label: "En validación", bg: "rgba(123,166,255,0.16)", color: colors.info },
} as const;

export type StatusKey = keyof typeof STATUS;
