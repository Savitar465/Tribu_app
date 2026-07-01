import { ScreenShell } from "@/components/screens/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardIcon, ChevronRight, QrIcon, UploadIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { fmtBs } from "@/lib/format";
import { getCurrentGroup } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Pay: choose a payment method and upload a transfer receipt. */
export function PayScreen() {
  const { state, actions } = useApp();
  const group = getCurrentGroup(state);

  return (
    <ScreenShell>
      <Card padding={22} radius={22} style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Monto a pagar</div>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: colors.textPrimary, margin: "4px 0" }}>
          {group?.cuota ?? "—"}
        </div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>{group?.name} · cuota de junio 2026</div>
      </Card>

      <SectionLabel>Método de pago</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        <Card onClick={() => actions.go("qr")} padding={15} radius={16}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <IconBadge background="rgba(91,140,255,0.15)">
              <QrIcon />
            </IconBadge>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>Pagar con QR</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>QR Simple · Tigo Money</div>
            </div>
            <ChevronRight />
          </div>
        </Card>
        <Card padding={15} radius={16} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <IconBadge background="rgba(54,208,122,0.15)">
              <CardIcon />
            </IconBadge>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>Fondo común</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>Disponible {fmtBs(state.wallet.balance)}</div>
            </div>
          </div>
        </Card>
      </div>

      <SectionLabel>Comprobante</SectionLabel>
      <div
        style={{
          border: `1.5px dashed ${colors.border}`,
          borderRadius: 18,
          padding: 26,
          textAlign: "center",
          marginBottom: 22,
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <IconBadge background={colors.surface2} size={48} radius={14}>
            <UploadIcon />
          </IconBadge>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#aeb6c6", marginTop: 10 }}>
          Sube una foto de tu transferencia
        </div>
        <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 3, fontFamily: "monospace" }}>
          JPG o PNG · máx 5 MB
        </div>
      </div>

      <Button onClick={actions.submitPay}>Enviar comprobante</Button>
    </ScreenShell>
  );
}
