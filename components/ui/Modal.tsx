import type { ReactNode } from "react";
import { colors } from "@/lib/theme";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Centered dialog over a dimmed backdrop. Anchors to the nearest positioned
 * ancestor (the phone frame on mobile, the content area on desktop) and sits
 * below the toast (z 80) so confirmations stay visible.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70,
        background: "rgba(8,10,14,0.62)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
        animation: "tribuFade 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: "100%",
          maxWidth: 360,
          maxHeight: "82%",
          overflowY: "auto",
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 22,
          padding: 20,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: colors.textPrimary }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              border: "none",
              background: colors.surface2,
              color: colors.textMuted,
              fontSize: 16,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
