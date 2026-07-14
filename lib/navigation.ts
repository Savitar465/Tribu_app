import type { Screen } from "./types";

/** Screens that show the bottom tab bar (top-level destinations). */
export const TABBED_SCREENS: Screen[] = ["home", "dashboard", "wallet", "notifications", "profile"];

/** Screens that show the floating "create group" action button. */
export const FAB_SCREENS: Screen[] = ["home", "dashboard"];

/** Screens whose data can be re-fetched: pull-to-refresh on touch, a refresh
 * button on the web. */
export const REFRESHABLE_SCREENS: Screen[] = [
  "home",
  "paycombined",
  "wallet",
  "notifications",
  "admin",
  "approve",
  "dashboard",
  "group",
  "history",
  "qr",
];

/** Where the back button leads from each non-tabbed screen. */
export const BACK_MAP: Partial<Record<Screen, Screen>> = {
  group: "home",
  admin: "group",
  create: "home",
  history: "home",
  pay: "group",
  paycombined: "home",
  qr: "group",
  approve: "admin",
  arrears: "admin",
  fx: "wallet",
};

/** Static back-bar titles (the `group` screen title is the group name, resolved elsewhere). */
export const BACK_TITLE: Partial<Record<Screen, string>> = {
  admin: "Administrar grupo",
  create: "Nuevo grupo",
  pay: "Pagar cuota",
  paycombined: "Pagar todo junto",
  qr: "Pago con QR",
  approve: "Revisar comprobante",
  arrears: "Cuotas por cobrar",
  history: "Historial",
  fx: "Tipo de cambio",
};
