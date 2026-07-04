import { useRef, useState } from "react";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardIcon, ChevronRight, CreditCardIcon, GlobeIcon, QrIcon, UploadIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { fmtBs } from "@/lib/format";
import { getCurrentGroup } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Pay: choose a payment method (QR, PayPal, transferencia, fondo) and upload the receipt. */
export function PayScreen() {
  const { state, actions } = useApp();
  const group = getCurrentGroup(state);
  const inputRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<"paypal" | "bank" | null>(null);
  const [sending, setSending] = useState(false);

  const pick = (file: File | null) => {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setProof(file);
    setPreview(URL.createObjectURL(file));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      actions.notify("Copiado al portapapeles");
    } catch {
      actions.notify("No se pudo copiar");
    }
  };

  const send = async () => {
    setSending(true);
    await actions.submitPay(proof);
    setSending(false);
  };

  const paypal = group?.paypalInfo ?? null;
  const bank = group?.bankInfo ?? null;
  const paypalLink = paypal && /paypal\.me|^https?:\/\//i.test(paypal)
    ? (paypal.startsWith("http") ? paypal : `https://${paypal}`)
    : null;

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
              <div style={{ fontSize: 12, color: colors.textMuted }}>QR Simple · escanea con tu app bancaria</div>
            </div>
            <ChevronRight />
          </div>
        </Card>

        {/* International methods (only when the admin configured them) */}
        {paypal && (
          <Card onClick={() => setExpanded(expanded === "paypal" ? null : "paypal")} padding={15} radius={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <IconBadge background="rgba(123,166,255,0.15)">
                <GlobeIcon />
              </IconBadge>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>PayPal</div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>Pagos desde el exterior</div>
              </div>
              <ChevronRight />
            </div>
            {expanded === "paypal" && (
              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.hairlineSoft}` }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary, wordBreak: "break-all", marginBottom: 10 }}>
                  {paypal}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" onClick={() => copy(paypal)} style={{ flex: 1, padding: 11, fontSize: 13 }}>
                    Copiar
                  </Button>
                  {paypalLink && (
                    <Button onClick={() => window.open(paypalLink, "_blank", "noopener")} style={{ flex: 1, padding: 11, fontSize: 13 }}>
                      Abrir PayPal
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {bank && (
          <Card onClick={() => setExpanded(expanded === "bank" ? null : "bank")} padding={15} radius={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <IconBadge background="rgba(245,181,61,0.15)">
                <CreditCardIcon />
              </IconBadge>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>Transferencia</div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>UglyCash · cuenta bancaria</div>
              </div>
              <ChevronRight />
            </div>
            {expanded === "bank" && (
              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.hairlineSoft}` }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.textPrimary, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 10 }}>
                  {bank}
                </div>
                <Button variant="secondary" onClick={() => copy(bank)} style={{ padding: 11, fontSize: 13 }}>
                  Copiar datos
                </Button>
              </div>
            )}
          </Card>
        )}

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
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${preview ? colors.positive : colors.border}`,
          borderRadius: 18,
          padding: preview ? 14 : 26,
          textAlign: "center",
          marginBottom: 22,
          background: "rgba(255,255,255,0.015)",
          cursor: "pointer",
        }}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Comprobante seleccionado"
              style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 12 }}
            />
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, marginTop: 10 }}>
              {proof?.name} · toca para cambiar
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <IconBadge background={colors.surface2} size={48} radius={14}>
                <UploadIcon />
              </IconBadge>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#aeb6c6", marginTop: 10 }}>
              Sube una foto de tu transferencia
            </div>
            <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 3, fontFamily: "monospace" }}>
              JPG, PNG o WebP · máx 5 MB
            </div>
          </>
        )}
      </div>

      <Button onClick={send} disabled={sending}>
        {sending ? "Enviando…" : "Enviar comprobante"}
      </Button>
    </ScreenShell>
  );
}
