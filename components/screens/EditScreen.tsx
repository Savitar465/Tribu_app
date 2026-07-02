import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CurrencyToggle } from "@/components/ui/CurrencyToggle";
import { TextField } from "@/components/ui/TextField";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getEditView } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { GRADIENT, colors } from "@/lib/theme";

const fieldLabel = { fontSize: 12.5, fontWeight: 700, color: colors.textMuted } as const;

/** Edit the monthly cost, currency and member count of a group; live per-member preview. */
export function EditScreen() {
  const { state, actions } = useApp();
  const e = getEditView(state);

  return (
    <ScreenShell>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Avatar label={e.meta.mono} background={e.meta.color} size={48} fontSize={18} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: colors.textPrimary }}>{e.meta.name}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>Costo mensual del plan</div>
        </div>
      </div>

      <div style={{ ...fieldLabel, marginBottom: 7 }}>Moneda del cobro</div>
      <div style={{ marginBottom: 16 }}>
        <CurrencyToggle value={state.editCur} onChange={actions.setEditCur} />
      </div>

      <div style={{ ...fieldLabel, marginBottom: 7 }}>Costo total mensual</div>
      <TextField
        value={state.editAmount}
        onChange={actions.setEditAmount}
        inputMode="decimal"
        fontWeight={800}
        fontSize={22}
        inputStyle={{ padding: 16 }}
      />

      <div style={{ ...fieldLabel, margin: "16px 0 7px" }}>Cantidad de miembros</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          padding: "10px 14px",
        }}
      >
        <Stepper label="−" onClick={() => actions.bumpMembers(-1)} />
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary }}>{state.editMembers}</div>
        <Stepper label="+" onClick={() => actions.bumpMembers(1)} />
      </div>

      <div style={{ ...fieldLabel, margin: "16px 0 7px" }}>Día de cobro cada mes</div>
      <TextField
        value={state.editBillingDay}
        onChange={actions.setEditBillingDay}
        inputMode="numeric"
        fontWeight={700}
        fontSize={18}
        inputStyle={{ padding: 14 }}
      />
      <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 6 }}>
        Se cobra el día {state.editBillingDay || "—"} de cada mes.
      </div>

      {/* FX shortcut */}
      <div
        onClick={actions.openFx}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 14,
          background: "rgba(54,208,122,0.08)",
          border: "1px solid rgba(54,208,122,0.2)",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 13, color: "#aeb6c6", fontWeight: 600 }}>Tipo de cambio</div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: colors.positive }}>{e.rateLabel} ›</div>
      </div>

      {/* Live summary */}
      <div style={{ marginTop: 18, borderRadius: 18, padding: 18, background: GRADIENT, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>Cada miembro paga</span>
          <span style={{ fontSize: 26, fontWeight: 800 }}>{e.perBs}</span>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.2)", margin: "12px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.9 }}>
          <span>Total del plan</span>
          <span style={{ fontWeight: 700 }}>{e.totalBs}/mes</span>
        </div>
        {e.isUsd && <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 8 }}>{e.usdLine}</div>}
      </div>

      <Button variant="success" onClick={actions.saveEdit} style={{ marginTop: 18 }}>
        Guardar cambios
      </Button>
    </ScreenShell>
  );
}

/** A square +/− stepper button. */
function Stepper({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: 11,
        background: colors.surface3,
        display: "grid",
        placeItems: "center",
        color: colors.textPrimary,
        fontSize: 22,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}
