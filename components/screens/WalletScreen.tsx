import { Avatar, initials } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getPrepaid } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Prepaid balances: the user's advance payments per group and how many months they cover. */
export function WalletScreen() {
  const { state, actions } = useApp();
  const w = getPrepaid(state);

  return (
    <ScreenShell>
      <div style={{ fontSize: 26, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 16 }}>
        Saldo adelantado
      </div>

      {/* Total */}
      <div
        style={{
          borderRadius: 24,
          padding: 22,
          background: "linear-gradient(135deg, #1a8048, #0e5e33)",
          color: "#fff",
          marginBottom: 14,
          boxShadow: "0 16px 36px -14px rgba(26,128,72,0.6)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>Saldo total en tus grupos</div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5, margin: "4px 0 2px" }}>{w.total}</div>
        <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>{w.totalUsd}</div>
        <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 12 }}>
          Cada mes tu cuota se descuenta automáticamente del saldo del grupo. Lo que sobra pasa al
          siguiente mes; si falta, se compensa con tu próxima recarga.
        </div>
      </div>

      {/* Per-group balances */}
      <SectionLabel>Saldo por grupo</SectionLabel>
      <Card padding="4px 16px">
        {w.rows.length === 0 && (
          <div style={{ padding: "18px 0", fontSize: 13, color: colors.textMuted, textAlign: "center" }}>
            Aún no participas en ningún grupo
          </div>
        )}
        {w.rows.map((r, i) => (
          <div
            key={r.id}
            onClick={() => {
              actions.open(r.id);
              if (!r.owned) actions.go("pay");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 0",
              borderBottom: i === w.rows.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
              cursor: "pointer",
            }}
          >
            <Avatar label={r.mono} background={r.color} size={34} radius={10} fontSize={13} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                {r.pendingAmount != null
                  ? `Recarga de ${r.pendingMonths} meses en revisión`
                  : r.balance > 0
                    ? `Cubre ~${r.monthsCover} meses · cuota ${r.cuota}`
                    : `Sin saldo · cuota ${r.cuota}`}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: r.balance > 0 ? colors.positive : colors.textPrimary }}>
              {r.balanceLabel}
            </div>
          </div>
        ))}
      </Card>

      <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 12, textAlign: "center" }}>
        Para recargar, entra al grupo y usa &quot;Pagar cuota&quot; eligiendo varios meses.
      </div>

      {/* Balances of members in groups this user administers */}
      {w.memberRows.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 22 }}>Saldo de tus miembros</SectionLabel>
          <Card padding="4px 16px">
            {w.memberRows.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 0",
                  borderBottom: i === w.memberRows.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                }}
              >
                <Avatar label={initials(m.name)} background={m.color} size={34} radius={10} fontSize={13} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                    {m.groupName}
                    {m.pending ? ` · recarga de ${m.pendingMonths} meses en revisión` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: colors.positive }}>{m.balanceLabel}</div>
              </div>
            ))}
          </Card>
        </>
      )}
    </ScreenShell>
  );
}
