import { Button } from "@/components/ui/Button";
import { ScreenShell } from "@/components/screens/ScreenShell";
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

      {/* Official BCB rate */}
      {state.officialRate !== null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: 14,
            marginBottom: 12,
            background: "rgba(54,208,122,0.08)",
            border: "1px solid rgba(54,208,122,0.2)",
          }}
        >
          <div style={{ fontSize: 12.5, color: "#aeb6c6", fontWeight: 600 }}>
            Oficial BCB{state.officialFecha ? ` · ${state.officialFecha}` : ""}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: colors.positive }}>
            1 USD = {state.officialRate} Bs
          </div>
        </div>
      )}

      <Button
        variant="secondary"
        onClick={actions.fetchOfficialRate}
        disabled={state.rateLoading}
        style={{ marginBottom: 12, padding: 14, fontSize: 14 }}
      >
        {state.rateLoading ? "Obteniendo..." : "Usar tipo de cambio oficial (BCB)"}
      </Button>

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
        Se usa para convertir los planes cobrados en dólares (como ChatGPT Team) a bolivianos. Cuando la cuota
        varía por el tipo de cambio, tu saldo adelantado compensa la diferencia mes a mes. El tipo de cambio
        oficial se obtiene del Banco Central de Bolivia; revisa el valor y pulsa Guardar para aplicarlo.
      </div>

      <Button variant="primary" onClick={actions.saveRate}>
        Guardar tipo de cambio
      </Button>
    </ScreenShell>
  );
}
