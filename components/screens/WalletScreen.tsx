import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getWallet } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Wallet: shared-fund balance, deposit / FX shortcuts, auto-pay, scheduled charges and movements. */
export function WalletScreen() {
  const { state, actions } = useApp();
  const w = getWallet(state);

  return (
    <ScreenShell>
      <div style={{ fontSize: 26, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 16 }}>
        Fondo común
      </div>

      {/* Balance */}
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
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>Saldo disponible</div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5, margin: "4px 0 2px" }}>{w.balance}</div>
        <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>{w.balanceUsd}</div>
        <div
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          Alcanza para ~{w.monthsCover} meses
        </div>
      </div>

      {/* Deposit / FX */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Button variant="primary" onClick={actions.openDeposit} style={{ flex: 1.3, padding: 15, fontSize: 14.5 }}>
          Depositar
        </Button>
        <div
          onClick={actions.openFx}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            padding: 11,
            borderRadius: 16,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 600 }}>Tipo de cambio</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: colors.positive }}>{w.rateLabel}</span>
        </div>
      </div>

      {/* Auto-pay toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: colors.surface,
          border: `1px solid ${colors.hairline}`,
          borderRadius: 16,
          padding: "15px 16px",
          marginBottom: 22,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>Pago automático</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>Debita tus cuotas del fondo</div>
        </div>
        <div
          onClick={actions.toggleAutoFund}
          style={{
            width: 50,
            height: 30,
            borderRadius: 999,
            background: w.autoFund ? "#1c6b42" : "#262b35",
            display: "flex",
            alignItems: "center",
            justifyContent: w.autoFund ? "flex-end" : "flex-start",
            padding: 3,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff" }} />
        </div>
      </div>

      {/* Scheduled */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionLabel style={{ marginBottom: 0 }}>Pagos programados</SectionLabel>
        <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>{w.monthlyCommit}/mes</div>
      </div>
      <Card padding="4px 16px" style={{ marginBottom: 22 }}>
        {w.scheduled.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 0",
              borderBottom: i === w.scheduled.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
            }}
          >
            <Avatar label={p.mono} background={p.color} size={34} radius={10} fontSize={13} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{p.label}</div>
              <div style={{ fontSize: 11.5, color: colors.textMuted }}>se debita el {p.date}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>{p.amount}</div>
          </div>
        ))}
      </Card>

      {/* Movements */}
      <SectionLabel>Movimientos</SectionLabel>
      <Card padding="4px 16px">
        {w.transactions.length === 0 && (
          <div style={{ padding: "18px 0", fontSize: 13, color: colors.textMuted, textAlign: "center" }}>
            Aún no hay movimientos
          </div>
        )}
        {w.transactions.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 0",
              borderBottom: i === w.transactions.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
            }}
          >
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>{t.label}</div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{t.sub}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.color }}>{t.amount}</div>
          </div>
        ))}
      </Card>
    </ScreenShell>
  );
}
