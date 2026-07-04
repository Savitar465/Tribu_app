import { ScreenShell } from "@/components/screens/ScreenShell";
import { Button } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { getCurrentGroup } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** QR: shows the admin's uploaded payment QR and a "ya pagué" shortcut back to the receipt upload. */
export function QrScreen() {
  const { state, actions } = useApp();
  const group = getCurrentGroup(state);
  const qr = group?.qrImageUrl ?? null;

  // Save the QR to the device: native share sheet on mobile (lets the user
  // save to photos / send by WhatsApp), plain download as fallback.
  const saveQr = async () => {
    if (!qr) return;
    try {
      const blob = await (await fetch(qr)).blob();
      const ext = blob.type.split("/")[1] || "png";
      const name = `qr-${(group?.name ?? "cobro").toLowerCase().replace(/\s+/g, "-")}.${ext}`;
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `QR de cobro · ${group?.name}` });
        } catch {
          // User dismissed the share sheet — not an error.
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      actions.notify("Imagen QR guardada");
    } catch {
      actions.notify("No se pudo guardar la imagen");
    }
  };

  return (
    <ScreenShell>
      <div
        style={{
          background: "#fff",
          borderRadius: 24,
          padding: 16,
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
              background: group?.color ?? colors.info,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {group?.mono ?? "?"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#15181f" }}>
            {group ? `${group.name} · ${group.cuota}` : "—"}
          </div>
        </div>

        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`QR de cobro de ${group?.name}`}
            style={{ width: "100%", height: "auto", borderRadius: 12 }}
          />
        ) : (
          <div style={{ padding: 8, borderRadius: 12, background: "#fff", opacity: 0.35 }}>
            <QrCode />
          </div>
        )}

        {qr ? (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 14, fontWeight: 600 }}>
            Escanea con tu app bancaria
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 14, fontWeight: 600, textAlign: "center" }}>
            {group?.owned
              ? "Aún no subiste tu QR de cobro · agrégalo desde el panel de admin"
              : "El administrador aún no subió su QR de cobro"}
          </div>
        )}
      </div>

      {qr && (
        <Button variant="secondary" onClick={saveQr} style={{ marginBottom: 10 }}>
          Guardar imagen QR
        </Button>
      )}

      {group?.owned && !qr && (
        <Button variant="secondary" onClick={() => actions.go("admin")} style={{ marginBottom: 10 }}>
          Subir mi QR de cobro
        </Button>
      )}

      <Button onClick={() => actions.go("pay")}>Ya pagué · subir comprobante</Button>
    </ScreenShell>
  );
}
