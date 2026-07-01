import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getDashboard } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, GRADIENT, colors } from "@/lib/theme";

/** Dashboard: monthly spend, collection progress, per-service distribution and payment tallies. */
export function DashboardScreen() {
  const { state } = useApp();
  const d = getDashboard(state);

  return (
    <ScreenShell>
      <div style={{ fontSize: 26, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 16 }}>
        Resumen
      </div>

      {/* Top stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ borderRadius: 18, padding: 16, background: GRADIENT, color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>Gasto mensual</div>
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, marginTop: 4 }}>{d.monthlySpend}</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>en {d.subCount} suscripciones</div>
        </div>
        <Card padding={16}>
          <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>Por cobrar</div>
          <div style={{ fontSize: 25, fontWeight: 800, color: colors.warning, letterSpacing: -0.5, marginTop: 4 }}>
            {d.toCollect}
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>admin de {d.ownedCount} grupos</div>
        </Card>
      </div>

      {/* Collected this month */}
      <Card padding={18} style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Recaudado este mes</span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: colors.textPrimary }}>
            {d.adminCollected} <span style={{ color: colors.textFaint, fontWeight: 600 }}>de {d.adminTotal}</span>
          </span>
        </div>
        <ProgressBar value={d.adminPct} fill={`linear-gradient(90deg, ${ACCENT}, ${colors.positive})`} />
      </Card>

      {/* Spend distribution */}
      <SectionLabel style={{ marginBottom: 14 }}>Distribución del gasto</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
        {d.spendBars.map((b) => (
          <div key={b.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <Avatar label={b.mono} background={b.color} size={26} radius={8} fontSize={11} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: colors.textPrimary }}>{b.name}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>{b.amount}</span>
            </div>
            <ProgressBar value={b.pct} fill={b.color} track={colors.surface} height={8} />
          </div>
        ))}
      </div>

      {/* Payment tallies */}
      <SectionLabel>Estado de pagos</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <TallyCard value={d.cntPaid} color={colors.positive} label="Al día" />
        <TallyCard value={d.cntPend} color={colors.warning} label="Pendientes" />
        <TallyCard value={d.cntVenc} color={colors.danger} label="Vencidos" />
      </div>
    </ScreenShell>
  );
}

function TallyCard({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <Card padding="16px 10px" radius={16} style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </Card>
  );
}
