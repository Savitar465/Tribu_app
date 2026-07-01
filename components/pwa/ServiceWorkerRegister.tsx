"use client";

import { useEffect } from "react";

/** Registers the service worker once on the client (enables installability & push). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
