import type { Screen } from "./types";

/** Screens that show the bottom tab bar (top-level destinations). */
export const TABBED_SCREENS: Screen[] = ["home", "dashboard", "wallet", "notifications", "profile"];

/** Screens that show the floating "create group" action button. */
export const FAB_SCREENS: Screen[] = ["home", "dashboard"];

/** Where the back button leads from each non-tabbed screen. */
export const BACK_MAP: Partial<Record<Screen, Screen>> = {
  group: "home",
  admin: "group",
  create: "home",
  history: "home",
  pay: "group",
  qr: "group",
  approve: "admin",
  fx: "wallet",
  deposit: "wallet",
};

/** Static back-bar titles (the `group` screen title is the group name, resolved elsewhere). */
export const BACK_TITLE: Partial<Record<Screen, string>> = {
  admin: "Administrar grupo",
  create: "Nuevo grupo",
  pay: "Pagar cuota",
  qr: "Pago con QR",
  approve: "Revisar comprobante",
  history: "Historial",
  fx: "Tipo de cambio",
  deposit: "Depositar al fondo",
};
