import { useRef, useState } from "react";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChevronRight, CreditCardIcon, GlobeIcon, QrIcon, UploadIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { fmtBs } from "@/lib/format";
import {
  getAdvancePreview,
  getCurrentGroup,
  getMyArrears,
  getMyPrepaid,
  getParticipantArrears,
  getPayTargets,
} from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Pay: pick who the payment is for (yourself or a fellow member), how many
 * months to cover (1 = this month, more = prepay), a method and the receipt.
 * Group admins register payments directly — no receipt, no review. */
export function PayScreen() {
  const { state, actions } = useApp();
  const group = getCurrentGroup(state);
  const prepaid = group ? getMyPrepaid(state, group.id) : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<"paypal" | "bank" | null>(null);
  const [sending, setSending] = useState(false);
  const [months, setMonths] = useState(1);
  const [payArrears, setPayArrears] = useState(false);
  /** Roster row this payment is for (null = the signed-in user). */
  const [forId, setForId] = useState<string | null>(null);

  // Members (and admins) can pay on behalf of a fellow member with owed months.
  const targets = getPayTargets(state);
  const forMember = targets.find((t) => t.id === forId) ?? null;
  const isAdmin = group?.owned ?? false;

  const arrears = group
    ? forMember
      ? getParticipantArrears(state, forMember.id)
      : getMyArrears(state, group.id)
    : null;
  const settleAll = payArrears && arrears !== null && arrears.count > 0;
  // With debt, a simple payment goes to the oldest owed month (at that
  // month's price) and prepaying is disabled until the member is current.
  const oldest = !settleAll && arrears && arrears.hasPast ? arrears.items[0] : null;
  // Current month already paid → any submission is a prepay of coming months
  // (only when paying one's own cuota).
  const currentPaid =
    !forMember && !oldest && arrears !== null && arrears.count === 0 && group?.statusKey === "paid";
  const isPrepay = !forMember && !settleAll && !oldest && (months > 1 || currentPaid);
  const coverage = group && isPrepay ? getAdvancePreview(state, group.id, months) : null;
  const total = settleAll
    ? arrears.totalLabel
    : oldest
      ? oldest.cuotaLabel
      : group
        ? fmtBs(Math.round(group.perBs * (isPrepay ? months : 1) * 100) / 100)
        : "—";

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
    if (settleAll) await actions.submitPay(proof, arrears.cycles, forId);
    else if (isPrepay) await actions.submitPrepay(months, proof);
    else await actions.submitPay(proof, undefined, forId);
    setSending(false);
  };

  const paypal = group?.paypalInfo ?? null;
  const bank = group?.bankInfo ?? null;
  const paypalLink = paypal && /paypal\.me|^https?:\/\//i.test(paypal)
    ? (paypal.startsWith("http") ? paypal : `https://${paypal}`)
    : null;

  return (
    <ScreenShell>
      <Card padding={22} radius={22} style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Monto a pagar</div>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: colors.textPrimary, margin: "4px 0" }}>
          {total}
        </div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>
          {group?.name} ·{" "}
          {settleAll
            ? `${arrears.count} ${arrears.count === 1 ? "mes pendiente" : "meses pendientes"}`
            : oldest
              ? `cuota de ${oldest.label} (mes más antiguo)`
              : isPrepay
                ? `${months} ${months === 1 ? "mes" : "meses"} por adelantado`
                : "cuota del mes"}
          {forMember ? ` · para ${forMember.name}` : ""}
        </div>
      </Card>

      {/* Who is this payment for? (yourself, or a member with owed months) */}
      {targets.length > 0 && (
        <Card padding="13px 16px" radius={16} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 }}>
            ¿Para quién es este pago?
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <PayeeChip
              label={isAdmin ? "Mi ficha" : "Mi cuota"}
              active={forId === null}
              onClick={() => {
                setForId(null);
                setPayArrears(false);
              }}
            />
            {targets.map((t) => (
              <PayeeChip
                key={t.id}
                label={`${t.name} · debe ${t.arrears.totalLabel}`}
                active={forId === t.id}
                onClick={() => {
                  setForId(t.id);
                  setPayArrears(false);
                  setMonths(1);
                }}
              />
            ))}
          </div>
          {forMember && (
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 8 }}>
              {isAdmin
                ? "Como administrador, el pago se registra y aprueba al instante."
                : `El pago quedará registrado a nombre de ${forMember.name}, indicando que tú lo enviaste.`}
            </div>
          )}
        </Card>
      )}

      {/* Owed months (each at the price charged that month) */}
      {arrears && arrears.hasPast && (
        <Card
          padding="13px 16px"
          radius={16}
          style={{ marginBottom: 12, border: "1px solid rgba(245,181,61,0.3)" }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.warning, marginBottom: 8 }}>
            {forMember ? `${forMember.name} tiene cuotas atrasadas` : "Tienes cuotas atrasadas"}
          </div>
          {arrears.items.map((it) => (
            <div
              key={it.cycle}
              style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12.5 }}
            >
              <span style={{ color: colors.textMuted, fontWeight: 600 }}>
                {it.label}
                {it.isCurrent ? " (mes actual)" : ""}
              </span>
              <span style={{ color: colors.textPrimary, fontWeight: 700 }}>{it.cuotaLabel}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 8,
              marginTop: 4,
              borderTop: `1px solid ${colors.hairlineSoft}`,
              fontSize: 13.5,
              fontWeight: 800,
            }}
          >
            <span style={{ color: colors.textSecondary }}>Total para ponerte al día</span>
            <span style={{ color: colors.warning }}>{arrears.totalLabel}</span>
          </div>
          <Button
            variant={settleAll ? "secondary" : "primary"}
            onClick={() => setPayArrears(!payArrears)}
            style={{ padding: 12, fontSize: 13.5, marginTop: 12 }}
          >
            {settleAll ? "Cancelar · pagar un solo mes" : `Pagar todo · ${arrears.totalLabel}`}
          </Button>
          {!settleAll && (
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 8 }}>
              Si pagas un solo mes, se aplica al más antiguo ({arrears.items[0].label}).
            </div>
          )}
        </Card>
      )}

      {/* Months to cover (1 = this month, more = prepay) — hidden while owing
          or when paying on behalf of someone else */}
      {!settleAll && !oldest && !forMember && (
      <Card padding="12px 14px" radius={16} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
              {currentPaid ? "Meses siguientes" : "Meses a pagar"}
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
              {currentPaid
                ? "Tu cuota del mes ya está pagada · esto se acredita a tu saldo"
                : isPrepay
                  ? "Pago adelantado · lo aprueba el admin una sola vez"
                  : "Solo el mes actual"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MonthBtn label="−" onClick={() => setMonths((m) => Math.max(1, m - 1))} />
            <div style={{ minWidth: 26, textAlign: "center", fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
              {months}
            </div>
            <MonthBtn label="+" onClick={() => setMonths((m) => Math.min(12, m + 1))} />
          </div>
        </div>
        {isPrepay && (
          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.hairlineSoft}` }}>
            {coverage && coverage.covered.length > 0 && (
              <div style={{ fontWeight: 700, color: colors.textSecondary, marginBottom: 6 }}>
                Cubre: {coverage.coveredLabel}
              </div>
            )}
            Si la cuota varía por el tipo de cambio, tu saldo compensa la diferencia: lo que sobra de
            un mes pasa al siguiente y las cuotas se descuentan automáticamente (sin aprobar
            comprobantes cada mes) hasta agotar el saldo. No recibirás recordatorios de pago mientras
            tu saldo cubra la cuota.
          </div>
        )}
      </Card>
      )}

      {/* Prepaid status (own cuota only) */}
      {prepaid && !forMember && prepaid.pendingAmount != null && (
        <Card padding="13px 16px" radius={16} style={{ marginBottom: 12, border: "1px solid rgba(123,166,255,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.info }}>
            Tienes una recarga de {prepaid.pendingMonths} meses en revisión ({fmtBs(prepaid.pendingAmount)})
          </div>
        </Card>
      )}
      {prepaid && !forMember && prepaid.balance > 0 && (
        <Card padding="13px 16px" radius={16} style={{ marginBottom: 12, border: "1px solid rgba(54,208,122,0.25)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.positive }}>
            Saldo adelantado en este grupo: {prepaid.balanceLabel}
          </div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
            Tu cuota se descuenta de este saldo cada mes automáticamente.
          </div>
        </Card>
      )}

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

      </div>

      {/* Admins register payments directly — no receipt, no review round-trip. */}
      {isAdmin ? (
        <Card padding="13px 16px" radius={16} style={{ marginBottom: 22, border: "1px solid rgba(54,208,122,0.25)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.positive }}>
            Eres el administrador de este grupo
          </div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
            No necesitas subir comprobante: el pago se registra y aprueba automáticamente.
          </div>
        </Card>
      ) : (
        <>
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

      <Button onClick={send} disabled={sending || (isPrepay && !proof)}>
        {sending
          ? "Enviando…"
          : isAdmin
            ? `Registrar pago · ${total}`
            : settleAll
              ? `Enviar pago completo · ${total}`
              : isPrepay
                ? `Enviar pago adelantado · ${total}`
                : "Enviar comprobante"}
      </Button>
      {isPrepay && !proof && (
        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 8, textAlign: "center" }}>
          El pago adelantado requiere adjuntar el comprobante.
        </div>
      )}
    </ScreenShell>
  );
}

/** A selectable "who is this payment for" chip. */
function PayeeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "7px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        background: active ? "rgba(91,140,255,0.16)" : colors.surface2,
        border: `1.5px solid ${active ? "#5b8cff" : colors.border}`,
        color: active ? colors.textPrimary : colors.textSecondary,
      }}
    >
      {label}
    </div>
  );
}

/** A small round +/− button for the months stepper. */
function MonthBtn({ label, onClick }: { label: string; onClick: () => void }) {
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
