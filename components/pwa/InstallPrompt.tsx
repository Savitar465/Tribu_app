"use client";

import { useEffect, useState } from "react";

/**
 * iOS-only hint to add the app to the home screen (iOS Safari has no
 * `beforeinstallprompt`). Hidden once the app runs standalone or is dismissed.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes standalone on navigator.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem("tribu:install-dismissed") === "1";
    // One-time read of browser-only APIs on mount (avoids SSR/hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(isIOS && !standalone && !dismissed);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem("tribu:install-dismissed", "1");
    setShow(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 200,
        maxWidth: 392,
        margin: "0 auto",
        background: "#20242e",
        color: "#f3f5f8",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <span style={{ flex: 1 }}>
        Instala Tribu: toca <strong>Compartir</strong> ⎋ y luego <strong>“Añadir a inicio”</strong>.
      </span>
      <button
        onClick={dismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "#8b93a3",
          fontSize: 18,
          fontWeight: 700,
          cursor: "pointer",
        }}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
}
