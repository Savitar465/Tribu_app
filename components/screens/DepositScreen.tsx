import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyToggle } from "@/components/ui/CurrencyToggle";
import { QrIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getDepositView } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

const fieldLabel = { fontSize: 12.5, fontWeight: 700, color: colors.textMuted } as const;

/** Add money to the shared fund, in bolivianos or USD. */
export function DepositScreen() {
  const { state, actions } = useApp();
  const dep = getDepositView(state);

  return (
    <ScreenShell>
      <div style={{ ...fieldLabel, marginBottom: 7 }}>Moneda del depósito</div>
      <div style={{ marginBottom: 18 }}>
        <CurrencyToggle value={state.depCur} onChange={actions.setDepCur} />
      </div>

      <div style={{ ...fieldLabel, marginBottom: 7 }}>Monto</div>
      <TextField
        value={state.depAmount}
        onChange={actions.setDepAmount}
        inputMode="decimal"
        fontWeight={800}
        fontSize={24}
        inputStyle={{ padding: 16 }}
      />

      <div
        style={{
          marginTop: 16,
          padding: "16px 18px",
          borderRadius: 16,
          background: "rgba(54,208,122,0.08)",
          border: "1px solid rgba(54,208,122,0.2)",
        }}
      >
        <div style={{ fontSize: 13.5, color: colors.positive, fontWeight: 700 }}>{dep.result}</div>
        {dep.isUsd && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4 }}>{dep.rateLabel}</div>}
      </div>

      <SectionLabel style={{ margin: "22px 0 12px" }}>Origen del depósito</SectionLabel>
      <Card padding={15} radius={16} style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <IconBadge background="rgba(91,140,255,0.15)">
            <QrIcon />
          </IconBadge>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>QR Simple / Tigo Money</div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>Acreditación inmediata</div>
          </div>
        </div>
      </Card>

      <Button variant="primary" onClick={actions.doDeposit}>
        Confirmar depósito
      </Button>
    </ScreenShell>
  );
}
