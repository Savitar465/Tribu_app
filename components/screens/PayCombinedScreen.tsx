import { useRef, useState } from "react";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { Avatar, initials } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconBadge } from "@/components/ui/IconBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { UploadIcon } from "@/components/ui/Icons";
import { fmtBs } from "@/lib/format";
import { imageUploadError } from "@/lib/paylogic";
import { getCombinedPay } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/**
 * Combined payment: the joint groups one administrator configured, paid in a
 * single transaction with one QR and one shared receipt. The member picks
 * which owed groups to settle and can add prepays of N months in the joint
 * groups they're current in. Each group keeps independent accounting (its own
 * ledger rows); history records which months of which groups the payment
 * covered.
 */
export function PayCombinedScreen() {
  const { state, actions } = useApp();
  const combined = getCombinedPay(state);
  const inputRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selOwner, setSelOwner] = useState<string | null>(null);
  /** Owed groups deselected by the user (default: everything selected). */
  const [skipPay, setSkipPay] = useState<string[]>([]);
  /** Up-to-date joint groups picked for a prepay. */
  const [prepayIds, setPrepayIds] = useState<string[]>([]);
  const [prepayMonths, setPrepayMonths] = useState(1);

  const bundle =
    combined.bundles.find((b) => b.ownerId === selOwner) ?? combined.bundles[0] ?? null;

  /** True when the bundle is the signed-in admin's own joint groups. */
  const isOwnBundle = bundle?.owned ?? false;
  const paying = bundle ? bundle.items.filter((it) => !skipPay.includes(it.groupId)) : [];
  const prepaying = bundle ? bundle.prepayable.filter((p) => prepayIds.includes(p.groupId)) : [];
  const prepayTotal = prepaying.reduce((a, p) => a + p.cuotaBs * prepayMonths, 0);
  const grandTotal = paying.reduce((a, it) => a + it.total, 0) + prepayTotal;
  const groupCount = paying.length + prepaying.length;
  const needsProof = !isOwnBundle && prepaying.length > 0 && !proof;

  const switchOwner = (ownerId: string) => {
    setSelOwner(ownerId);
    setSkipPay([]);
    setPrepayIds([]);
    setPrepayMonths(1);
  };

  // Reject bad receipts at pick time (wrong type, empty, over 5 MB) so the
  // user isn't surprised at send — `accept` alone doesn't filter drag & drop.
  const pick = (file: File | null) => {
    if (!file) return;
    const err = imageUploadError(file);
    if (err) {
      actions.notify(err);
      return;
    }
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
    if (!bundle) return;
    setSending(true);
    await actions.submitCombinedPay(bundle.ownerId, proof, {
      payGroupIds: paying.map((it) => it.groupId),
      prepayGroupIds: prepaying.map((p) => p.groupId),
      prepayMonths,
    });
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
            No tienes pagos en conjunto disponibles: no debes cuotas y ningún administrador tiene
            grupos configurados para pagarse juntos.
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      {/* Amount for the current selection */}
      <Card padding={22} radius={22} style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Total a pagar</div>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: colors.textPrimary, margin: "4px 0" }}>
          {fmtBs(grandTotal)}
        </div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>
          {groupCount === 0
            ? "Selecciona los grupos que quieres pagar"
            : `${groupCount} ${groupCount === 1 ? "grupo" : "grupos"} ${isOwnBundle ? "tuyos" : "del mismo administrador"}` +
              (prepaying.length > 0
                ? ` · ${prepaying.length === groupCount ? "pago adelantado" : "incluye pago adelantado"}`
                : "")}
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
                  onClick={() => switchOwner(b.ownerId)}
                  padding="12px 14px"
                  radius={14}
                  style={{ border: `1.5px solid ${active ? "#5b8cff" : colors.border}` }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                    <span style={{ color: colors.textPrimary }}>
                      {[...b.items.map((i) => i.name), ...b.prepayable.map((p) => p.name)].join(", ")}
                    </span>
                    <span style={{ color: colors.warning }}>{b.totalLabel}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Owed groups: pick which ones this payment settles */}
      {bundle && bundle.items.length > 0 && (
        <>
          <SectionLabel>Cuotas pendientes · elige cuáles pagar</SectionLabel>
          <Card padding="4px 16px" style={{ marginBottom: 16 }}>
            {bundle.items.map((it, i) => {
              const checked = !skipPay.includes(it.groupId);
              return (
                <div
                  key={it.participantId}
                  onClick={() =>
                    setSkipPay(
                      checked ? [...skipPay, it.groupId] : skipPay.filter((id) => id !== it.groupId),
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "13px 0",
                    cursor: "pointer",
                    opacity: checked ? 1 : 0.5,
                    borderBottom: i === bundle.items.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                  }}
                >
                  <CheckBox checked={checked} />
                  <Avatar label={it.mono || initials(it.name)} background={it.color} size={38} radius={12} fontSize={13} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{it.name}</div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                      {it.cycles.length === 1 ? "1 mes" : `${it.cycles.length} meses`} ({it.monthsLabel})
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colors.warning }}>{it.totalLabel}</div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {/* Up-to-date joint groups: optionally prepay N months in the same transaction */}
      {bundle && bundle.prepayable.length > 0 && (
        <>
          <SectionLabel>Pagar por adelantado · grupos al día</SectionLabel>
          <Card padding="4px 16px" style={{ marginBottom: 12 }}>
            {bundle.prepayable.map((p, i) => {
              const checked = prepayIds.includes(p.groupId);
              return (
                <div
                  key={p.participantId}
                  onClick={() =>
                    setPrepayIds(
                      checked ? prepayIds.filter((id) => id !== p.groupId) : [...prepayIds, p.groupId],
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "13px 0",
                    cursor: "pointer",
                    opacity: checked ? 1 : 0.55,
                    borderBottom: i === bundle.prepayable.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                  }}
                >
                  <CheckBox checked={checked} />
                  <Avatar label={p.mono || initials(p.name)} background={p.color} size={38} radius={12} fontSize={13} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                      {p.cuotaLabel}/mes · al día
                    </div>
                  </div>
                  {checked && (
                    <div style={{ fontSize: 14, fontWeight: 800, color: colors.positive }}>
                      {fmtBs(p.cuotaBs * prepayMonths)}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
          {prepaying.length > 0 && (
            <Card padding="12px 14px" radius={16} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
                    Meses por adelantado
                  </div>
                  <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
                    {isOwnBundle
                      ? "Se acredita al saldo de cada grupo seleccionado al instante"
                      : "Se acredita al saldo de cada grupo seleccionado · lo aprueba el admin una sola vez"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepBtn label="−" onClick={() => setPrepayMonths((m) => Math.max(1, m - 1))} />
                  <div style={{ minWidth: 26, textAlign: "center", fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                    {prepayMonths}
                  </div>
                  <StepBtn label="+" onClick={() => setPrepayMonths((m) => Math.min(12, m + 1))} />
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <div style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 16 }}>
        Un solo pago cubre los grupos que este administrador configuró para pagarse en conjunto.
        Cada grupo mantiene su contabilidad por separado: en el historial verás qué meses de qué
        grupo pagó esta transacción.
      </div>

      {/* The bundle's single collection method (the admin-marked source group) */}
      {bundle && !isOwnBundle && (bundle.qrUrl || bundle.paypalInfo || bundle.bankInfo) && (
        <>
          <SectionLabel>
            Método de cobro único{bundle.methodGroupName ? ` · ${bundle.methodGroupName}` : ""}
          </SectionLabel>
          {bundle.qrUrl && (
            <Card padding={16} style={{ marginBottom: 10, textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bundle.qrUrl}
                alt="QR de cobro del administrador"
                style={{ width: "100%", maxWidth: 240, borderRadius: 12, background: "#fff" }}
              />
              <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 10 }}>
                Un solo QR para todo el conjunto: escanea, transfiere el total y sube el
                comprobante abajo.
              </div>
            </Card>
          )}
          {bundle.paypalInfo && (
            <Card onClick={() => copy(bundle.paypalInfo!)} padding="12px 15px" radius={14} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>PayPal</div>
                  <div style={{ fontSize: 12, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {bundle.paypalInfo}
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#7ba6ff", flexShrink: 0 }}>Copiar</span>
              </div>
            </Card>
          )}
          {bundle.bankInfo && (
            <Card onClick={() => copy(bundle.bankInfo!)} padding="12px 15px" radius={14} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>Transferencia</div>
                  <div style={{ fontSize: 12, color: colors.textMuted, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {bundle.bankInfo}
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#7ba6ff", flexShrink: 0 }}>Copiar</span>
              </div>
            </Card>
          )}
          <div style={{ marginBottom: 6 }} />
        </>
      )}

      {/* The admin registers their own combined payment directly — no receipt. */}
      {isOwnBundle ? (
        <Card padding="13px 16px" radius={16} style={{ marginBottom: 22, border: "1px solid rgba(54,208,122,0.25)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.positive }}>
            Eres el administrador de estos grupos
          </div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
            No necesitas subir comprobante: el pago se registra y aprueba al instante en cada grupo.
          </div>
        </Card>
      ) : (
        <>
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
        </>
      )}

      <Button onClick={send} disabled={sending || !bundle || groupCount === 0 || needsProof}>
        {sending
          ? "Enviando…"
          : `${isOwnBundle ? "Registrar pago" : "Pagar"} · ${
              groupCount === 1 ? "1 grupo" : `${groupCount} grupos`
            } · ${fmtBs(grandTotal)}`}
      </Button>
      {needsProof && (
        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 8, textAlign: "center" }}>
          El pago adelantado requiere adjuntar el comprobante.
        </div>
      )}
    </ScreenShell>
  );
}

/** Small square checkbox used by the group selectors. */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        fontSize: 11,
        fontWeight: 800,
        color: "#fff",
        background: checked ? "#5b8cff" : "transparent",
        border: `1.5px solid ${checked ? "#5b8cff" : colors.border}`,
      }}
    >
      {checked ? "✓" : ""}
    </span>
  );
}

/** A small round +/− button for the months stepper. */
function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: colors.surface3,
        display: "grid",
        placeItems: "center",
        color: colors.textPrimary,
        fontSize: 18,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}
