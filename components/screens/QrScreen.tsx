import { ScreenShell } from "@/components/screens/ScreenShell";
import { Button } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** QR: shows a scannable-looking code and a "ya pagué" shortcut back to the receipt upload. */
export function QrScreen() {
  const { actions } = useApp();

  return (
    <ScreenShell>
      {/* Provider tabs (static) */}
      <div
        style={{
          display: "flex",
          gap: 8,
          background: colors.inset,
          border: `1px solid ${colors.hairlineSoft}`,
          borderRadius: 14,
          padding: 4,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            flex: 1,
            textAlign: "center",
            padding: "9px 0",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            background: colors.surface3,
            color: colors.textPrimary,
          }}
        >
          QR Simple
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, color: colors.textMuted }}>
          Tigo Money
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 24,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "#E50914",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#15181f" }}>Netflix · 13 Bs</div>
        </div>
        <div style={{ padding: 8, borderRadius: 12, background: "#fff" }}>
          <QrCode />
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 14, fontWeight: 600 }}>Escanea con tu app bancaria</div>
        <div style={{ fontSize: 11, color: "#9aa1ad", marginTop: 2, fontFamily: "monospace" }}>Expira en 14:52</div>
      </div>

      <Button onClick={() => actions.go("pay")}>Ya pagué · subir comprobante</Button>
    </ScreenShell>
  );
}
