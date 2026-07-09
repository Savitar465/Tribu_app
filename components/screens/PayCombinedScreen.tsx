import { useRef, useState } from "react";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { Avatar, initials } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconBadge } from "@/components/ui/IconBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { UploadIcon } from "@/components/ui/Icons";
import { getCombinedPay } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/**
 * Combined payment: every debt the user owes to one administrator — possibly
 * across several groups — paid in a single transaction with one shared
 * receipt. Each group keeps independent accounting (its own ledger rows);
 * history records which months of which groups the payment covered.
 */
export function PayCombinedScreen() {
  const { state, actions } = useApp();
  const combined = getCombinedPay(state);
  const inputRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selOwner, setSelOwner] = useState<string | null>(null);

  const bundle =
    combined.bundles.find((b) => b.ownerId === selOwner) ?? combined.bundles[0] ?? null;

  const pick = (file: File | null) => {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setProof(file);
    setPreview(URL.createObjectURL(file));
  };

  const send = async () => {
    if (!bundle) return;
    setSending(true);
    await actions.submitCombinedPay(bundle.ownerId, proof);
    setSending(false);
  };

  if (combined.bundles.length === 0) {
    return (
      <ScreenShell>
        <Card padding="28px 18px" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.positive, marginBottom: 4 }}>
            Todo al día ✓
          </div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>
            No tienes cuotas pendientes en tus grupos.
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      {/* Amount for the selected administrator's bundle */}
      <Card padding={22} radius={22} style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Total a pagar</div>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: colors.textPrimary, margin: "4px 0" }}>
          {bundle?.totalLabel}
        </div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>
          {bundle
            ? `${bundle.chargeCount} ${bundle.chargeCount === 1 ? "cuota" : "cuotas"} en ${bundle.groupCount} ${
                bundle.groupCount === 1 ? "grupo" : "grupos"
              } del mismo administrador`
            : ""}
        </div>
      </Card>

      {/* One section per administrator you owe money to */}
      {combined.bundles.length > 1 && (
        <>
          <SectionLabel>Administradores</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {combined.bundles.map((b) => {
              const active = b.ownerId === bundle?.ownerId;
              return (
                <Card
                  key={b.ownerId}
                  onClick={() => setSelOwner(b.ownerId)}
                  padding="12px 14px"
                  radius={14}
                  style={{ border: `1.5px solid ${active ? "#5b8cff" : colors.border}` }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                    <span style={{ color: colors.textPrimary }}>
                      {b.items.map((i) => i.name).join(", ")}
                    </span>
                    <span style={{ color: colors.warning }}>{b.totalLabel}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Per-group breakdown: months owed at each month's frozen price */}
      <SectionLabel>Detalle por grupo</SectionLabel>
      <Card padding="4px 16px" style={{ marginBottom: 16 }}>
        {bundle?.items.map((it, i) => (
          <div
            key={it.participantId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "13px 0",
              borderBottom: i === bundle.items.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
            }}
          >
            <Avatar label={it.mono || initials(it.name)} background={it.color} size={38} radius={12} fontSize={13} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{it.name}</div>
              <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                {it.cycles.length === 1 ? "1 mes" : `${it.cycles.length} meses`} ({it.monthsLabel})
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.warning }}>{it.totalLabel}</div>
          </div>
        ))}
      </Card>

      <div style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 16 }}>
        Un solo comprobante cubre todos los grupos de este administrador. Cada grupo mantiene su
        contabilidad por separado: en el historial verás qué meses de qué grupo pagó esta
        transacción.
      </div>

      {/* Shared receipt */}
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

      <Button onClick={send} disabled={sending || !bundle}>
        {sending ? "Enviando…" : `Pagar todo · ${bundle?.totalLabel}`}
      </Button>
    </ScreenShell>
  );
}
