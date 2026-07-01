import { GRADIENT, colors } from "@/lib/theme";

/** Full-screen loading / error state shown before the app data is ready. */
export function Splash({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background: colors.bg,
        color: colors.textPrimary,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: GRADIENT,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: 26,
          animation: message ? undefined : "tribuFade 0.6s ease-in-out infinite alternate",
        }}
      >
        T
      </div>
      {message ? (
        <>
          <div style={{ fontSize: 14, color: colors.textMuted, maxWidth: 300 }}>{message}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                borderRadius: 12,
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: colors.textMuted }}>Cargando…</div>
      )}
    </div>
  );
}
