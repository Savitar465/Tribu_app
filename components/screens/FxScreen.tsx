import { Button } from "@/components/ui/Button";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { RATE_PRESETS } from "@/lib/data";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Set the USD→BOB exchange rate used to convert USD-billed plans and deposits. */
export function FxScreen() {
  const { state, actions } = useApp();

  return (
    <ScreenShell>
      {/* Rate input */}
      <div
        style={{
          borderRadius: 20,
          padding: "24px 22px",
          background: colors.surface,
          border: `1px solid ${colors.hairline}`,
          textAlign: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Tipo de cambio actual</div>
        <div style={{ fontSize: 14, color: colors.textMuted, marginTop: 16, fontWeight: 600 }}>1 USD =</div>
        <input
          value={state.rateDraft}
          onChange={(ev) => actions.setRateDraft(ev.target.value)}
          inputMode="decimal"
          style={{
            width: 170,
            textAlign: "center",
            background: "transparent",
            border: "none",
            borderBottom: "2px solid rgba(255,255,255,0.15)",
            color: colors.textPrimary,
            fontSize: 46,
            fontFamily: "inherit",
            fontWeight: 800,
            outline: "none",
            margin: "6px 0",
          }}
        />
        <div style={{ fontSize: 16, color: colors.textMuted, fontWeight: 700 }}>Bolivianos</div>
      </div>

      {/* Presets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {RATE_PRESETS.map((p) => (
          <div
            key={p.label}
            onClick={() => actions.presetRate(p.v)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: 11,
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
            }}
          >
            {p.label}
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 12.5,
          color: colors.textMuted,
          lineHeight: 1.55,
          background: colors.inset,
          border: `1px solid ${colors.hairlineSoft}`,
          borderRadius: 14,
          padding: 14,
          marginBottom: 22,
        }}
      >
        Se usa para convertir los planes cobrados en dólares (como ChatGPT Team) a bolivianos, y para acreditar al
        fondo común los depósitos hechos en USD.
      </div>

      <Button variant="primary" onClick={actions.saveRate}>
        Guardar tipo de cambio
      </Button>
    </ScreenShell>
  );
}
