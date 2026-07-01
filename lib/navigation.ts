import type { Screen } from "./types";

/** Screens that show the bottom tab bar (top-level destinations). */
export const TABBED_SCREENS: Screen[] = ["home", "dashboard", "wallet", "notifications", "profile"];

/** Screens that show the floating "create group" action button. */
export const FAB_SCREENS: Screen[] = ["home", "dashboard"];

/** Where the back button leads from each non-tabbed screen. */
export const BACK_MAP: Partial<Record<Screen, Screen>> = {
  group: "home",
  create: "home",
  history: "home",
  pay: "group",
  qr: "group",
  approve: "group",
  edit: "group",
  fx: "wallet",
  deposit: "wallet",
};

/** Static back-bar titles (the `group` screen title is the group name, resolved elsewhere). */
export const BACK_TITLE: Partial<Record<Screen, string>> = {
  create: "Nuevo grupo",
  pay: "Pagar cuota",
  qr: "Pago con QR",
  approve: "Revisar comprobante",
  history: "Historial",
  edit: "Editar costo",
  fx: "Tipo de cambio",
  deposit: "Depositar al fondo",
};
