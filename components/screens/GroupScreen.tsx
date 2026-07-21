import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GearIcon } from "@/components/ui/Icons";
import { MemberRow } from "@/components/ui/MemberRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getApprovals, getCombinedPay, getCurrentGroup, getMembers, getMyPrepaid, isPayable, statusStyle } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";

/** Group detail — the shared "view the group" screen; admin tools live on the admin screen. */
export function GroupScreen() {
  const { state, actions } = useApp();
  const group = getCurrentGroup(state);
  const members = getMembers(state, ACCENT);
  const approvals = getApprovals(state);
  const prepaid = group ? getMyPrepaid(state, group.id) : null;
  const st = group ? statusStyle(group.statusKey) : null;

  // The joint-payment bundle this group belongs to (if the admin configured
  // one and there's something to pay or prepay across ≥ 2 groups).
  const combined = getCombinedPay(state);
  const jointBundle = group
    ? (combined.bundles.find(
        (b) =>
          b.items.some((it) => it.groupId === group.id) ||
          b.prepayable.some((p) => p.groupId === group.id),
      ) ?? null)
    : null;
  const showJoint =
    jointBundle !== null && jointBundle.items.length + jointBundle.prepayable.length >= 2;

  if (!group || !st) return null;

  return (
    <ScreenShell padding="0 0 28px">
      {/* Header band */}
      <div style={{ padding: "6px 20px 22px", textAlign: "center" }}>
        <Avatar
          label={group.mono}
          background={group.color}
          size={64}
          radius={20}
          fontSize={24}
          style={{ margin: "0 auto 12px" }}
        />
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary }}>{group.name}</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 2 }}>
          {group.plan} · {group.monthly}/mes · {group.members} miembros
        </div>
        {group.isUsd && (
          <div
            style={{
              display: "inline-block",
              marginTop: 9,
              padding: "4px 11px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              background: "rgba(54,208,122,0.14)",
              color: colors.positive,
            }}
          >
            {group.usdNote}
          </div>
        )}
      </div>

      <div style={{ padding: "0 18px" }}>
        {/* Admin settings entry — only the owner sees this */}
        {group.owned && (
          <div
            onClick={() => actions.go("admin")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "15px 16px",
              borderRadius: 15,
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            <GearIcon />
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>
              Configuración de administrador
            </span>
            {approvals.length > 0 && (
              <span
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(123,166,255,0.18)",
                  color: colors.info,
                }}
              >
                {approvals.length} por revisar
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 800, color: colors.textSecondary }}>›</span>
          </div>
        )}

        <Card padding={22} radius={22} style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Tu cuota de este mes</div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: colors.textPrimary, margin: "4px 0 8px" }}>
            {group.cuota}
          </div>
          <StatusBadge label={st.label} bg={st.bg} color={st.color} style={{ padding: "5px 14px", fontSize: 13 }} />
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 12 }}>Vence el {group.due}/{group.dueYear}</div>
          {prepaid && prepaid.pendingAmount != null && (
            <div
              style={{
                display: "inline-block",
                marginTop: 10,
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                background: "rgba(123,166,255,0.14)",
                color: colors.info,
              }}
            >
              Recarga de {prepaid.pendingMonths} meses en revisión
            </div>
          )}
          {prepaid && prepaid.balance > 0 && (
            <div
              style={{
                display: "inline-block",
                marginTop: 10,
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                background: "rgba(54,208,122,0.14)",
                color: colors.positive,
              }}
            >
              Saldo adelantado: {prepaid.balanceLabel}
              {group.perBs > 0 ? ` · cubre ~${Math.floor(prepaid.balance / group.perBs)} meses` : ""}
            </div>
          )}
        </Card>

        {isPayable(group) && (
          <div style={{ marginBottom: 22 }}>
            <Button onClick={() => actions.go("pay")}>Pagar cuota</Button>
          </div>
        )}

        {/* Prepay entry — anyone with a roster slot (members and participating
            admins). Hidden only while a proof/prepay is in review or the member
            owes past months (arrears must be settled first). Primary when the
            cuota is already paid, since it's the only action left. */}
        {prepaid &&
          prepaid.pendingAmount == null &&
          (group.statusKey === "paid" || group.statusKey === "pending") && (
            <div style={{ marginBottom: 22 }}>
              <Button
                variant={group.statusKey === "paid" ? "primary" : "secondary"}
                onClick={() => actions.go("pay")}
                style={group.statusKey === "paid" ? undefined : { padding: 15, fontSize: 14.5, fontWeight: 700 }}
              >
                Pagar por adelantado
              </Button>
            </div>
          )}

        {/* Joint payment: this group can be paid (or prepaid) together with
            the admin's other joint groups — one QR, one receipt. */}
        {showJoint && jointBundle && (
          <div
            onClick={() => actions.go("paycombined")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(91,140,255,0.10)",
              border: "1px solid rgba(91,140,255,0.35)",
              cursor: "pointer",
              marginBottom: 22,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {jointBundle.total > 0
                  ? `Pago en conjunto disponible · ${jointBundle.totalLabel}`
                  : "Pago adelantado en conjunto disponible"}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
                {jointBundle.owned
                  ? "Registra tu pago en tus grupos en conjunto · se aprueba al instante."
                  : jointBundle.total > 0
                    ? "Paga este grupo junto con los demás del mismo administrador · un solo QR y comprobante."
                    : "Adelanta meses en este grupo y los demás del mismo administrador · un solo QR y comprobante."}
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: colors.info }}>›</span>
          </div>
        )}

        <SectionLabel>Miembros del grupo</SectionLabel>
        <Card padding="6px 14px">
          {members.map((m, i) => (
            <MemberRow key={m.id} {...m} last={i === members.length - 1} />
          ))}
        </Card>

        <div
          onClick={() => actions.go("history")}
          style={{ textAlign: "center", marginTop: 16, fontSize: 14, fontWeight: 700, color: ACCENT, cursor: "pointer" }}
        >
          Ver historial de pagos →
        </div>
      </div>
    </ScreenShell>
  );
}
