import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QrIcon, UploadIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { TextField } from "@/components/ui/TextField";
import { imageUploadError } from "@/lib/paylogic";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";
import type { GroupView } from "@/lib/types";

const fieldLabel = { fontSize: 12.5, fontWeight: 700, color: colors.textMuted } as const;

/**
 * Collapsible editor for how the admin receives payments: the bank QR image
 * (QR Simple) plus international methods — PayPal and a free-text transfer
 * account (e.g. UglyCash) for members paying from abroad.
 */
export function PayMethodsEditor({ group }: { group: GroupView }) {
  const { actions } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paypal, setPaypal] = useState("");
  const [bank, setBank] = useState("");
  const [savingMethods, setSavingMethods] = useState(false);

  const shown = preview ?? group.qrImageUrl;
  const methodsDirty = paypal !== (group.paypalInfo ?? "") || bank !== (group.bankInfo ?? "");
  const configured = [group.qrImageUrl && "QR", group.paypalInfo && "PayPal", group.bankInfo && "Transferencia"]
    .filter(Boolean)
    .join(" · ");

  const toggle = () => {
    if (!open) {
      // Seed the international-methods drafts from the group row.
      setPaypal(group.paypalInfo ?? "");
      setBank(group.bankInfo ?? "");
    }
    setOpen(!open);
  };

  // Reject bad images at pick time (wrong type, empty, over 5 MB) — the
  // `accept` attribute alone doesn't filter drag & drop.
  const pick = (file: File | null) => {
    if (!file) return;
    const err = imageUploadError(file);
    if (err) {
      actions.notify(err);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setDraft(file);
    setPreview(URL.createObjectURL(file));
  };

  const saveQr = async () => {
    if (!draft) return;
    setSaving(true);
    const ok = await actions.setGroupQr(draft);
    setSaving(false);
    if (ok) {
      if (preview) URL.revokeObjectURL(preview);
      setDraft(null);
      setPreview(null);
    }
  };

  const saveMethods = async () => {
    setSavingMethods(true);
    await actions.setGroupPayMethods(paypal, bank);
    setSavingMethods(false);
  };

  return (
    <Card padding={0} radius={18} style={{ marginBottom: 10, overflow: "hidden" }}>
      {/* Header row (toggles the editor) */}
      <div
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 16px",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <QrIcon />
          <span style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>Métodos de cobro</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: configured ? colors.positive : colors.textSecondary }}>
          {configured || "Sin configurar"} {open ? "⌄" : "›"}
        </span>
      </div>

      {open && (
        <div style={{ padding: "16px 16px", borderTop: `1px solid ${colors.hairlineSoft}` }}>
          {/* --- QR bancario --- */}
          <div style={{ ...fieldLabel, marginBottom: 8 }}>QR de cobro (QR Simple)</div>
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

          {shown ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, display: "flex", justifyContent: "center", marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shown}
                alt="QR de cobro del grupo"
                style={{ width: "100%", height: "auto", borderRadius: 10 }}
              />
            </div>
          ) : (
            <div
              onClick={() => inputRef.current?.click()}
              style={{
                border: `1.5px dashed ${colors.border}`,
                borderRadius: 16,
                padding: 24,
                textAlign: "center",
                marginBottom: 12,
                cursor: "pointer",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                <IconBadge background={colors.surface2} size={48} radius={14}>
                  <UploadIcon />
                </IconBadge>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#aeb6c6", marginTop: 10 }}>
                Sube la imagen de tu QR bancario
              </div>
              <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 3, fontFamily: "monospace" }}>
                JPG, PNG o WebP · máx 5 MB
              </div>
            </div>
          )}

          {draft ? (
            <Button variant="success" onClick={saveQr} disabled={saving} style={{ padding: 13, fontSize: 14 }}>
              {saving ? "Subiendo…" : "Guardar QR"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => inputRef.current?.click()} style={{ padding: 13, fontSize: 14 }}>
              {group.qrImageUrl ? "Cambiar imagen" : "Subir imagen"}
            </Button>
          )}

          {group.qrImageUrl && !draft && (
            <Button variant="danger" onClick={actions.removeGroupQr} style={{ padding: 13, fontSize: 14, marginTop: 8 }}>
              Quitar QR
            </Button>
          )}

          {/* --- Cobros desde el exterior --- */}
          <div style={{ height: 1, background: colors.hairlineSoft, margin: "18px 0 14px" }} />
          <div style={{ ...fieldLabel, marginBottom: 4 }}>Cobros desde el exterior</div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 12 }}>
            Para miembros fuera de Bolivia: PayPal o una cuenta para transferencias (UglyCash, banco, etc.).
          </div>

          <TextField
            label="PayPal (correo o enlace paypal.me)"
            value={paypal}
            onChange={setPaypal}
            fontSize={14}
            style={{ marginBottom: 14 }}
          />

          <div style={{ ...fieldLabel, marginBottom: 7 }}>Transferencia (UglyCash, banco, etc.)</div>
          <textarea
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            rows={3}
            placeholder={"Ej: UglyCash: @miusuario\nTitular: Juan Pérez"}
            style={{
              width: "100%",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              padding: 14,
              color: colors.textPrimary,
              fontSize: 14,
              fontFamily: "inherit",
              fontWeight: 600,
              outline: "none",
              resize: "vertical",
            }}
          />

          <Button
            variant="success"
            onClick={saveMethods}
            disabled={!methodsDirty || savingMethods}
            style={{ padding: 13, fontSize: 14, marginTop: 12 }}
          >
            {savingMethods ? "Guardando…" : "Guardar métodos"}
          </Button>
        </div>
      )}
    </Card>
  );
}
