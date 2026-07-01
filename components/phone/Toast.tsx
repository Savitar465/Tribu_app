import { useApp } from "@/lib/store";

/** Transient confirmation message that animates up from the bottom of the phone. */
export function Toast() {
  const { state } = useApp();
  if (!state.toast) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        left: "50%",
        zIndex: 80,
        background: "#20242e",
        color: "#f3f5f8",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "12px 18px",
        borderRadius: 14,
        fontSize: 13.5,
        fontWeight: 600,
        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
        whiteSpace: "nowrap",
        animation: "tribuToast 0.28s ease",
        maxWidth: 320,
        textAlign: "center",
        transform: "translateX(-50%)",
      }}
    >
      {state.toast}
    </div>
  );
}
