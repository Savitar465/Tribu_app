import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChevronRight, FileIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { MemberRow } from "@/components/ui/MemberRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { AddMemberModal } from "@/components/screens/admin/AddMemberModal";
import { CostEditor } from "@/components/screens/admin/CostEditor";
import { PayMethodsEditor } from "@/components/screens/admin/PayMethodsEditor";
import { getApprovals, getCurrentGroup, getMembers } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";

/** Admin panel for the current group: collection, approvals, roster and cost editing. */
export function AdminScreen() {
  const { state, actions } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const group = getCurrentGroup(state);
  const members = getMembers(state, ACCENT);
  const approvals = getApprovals(state);

  if (!group?.owned) return null;
  const admin = group.admin;

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
      </div>

      <div style={{ padding: "0 18px" }}>
        {/* Collection */}
        <Card padding={20} radius={22} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>Cobrado</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: colors.positive, letterSpacing: -0.5 }}>
                {admin?.collected}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>Pendiente</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: colors.warning, letterSpacing: -0.5 }}>
                {admin?.pending}
              </div>
            </div>
          </div>
          <ProgressBar value={admin?.pct ?? "0%"} />
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>Ciclo Junio 2026 · cobra el 05/07</div>
        </Card>

        {/* Approval alert */}
        {approvals.length > 0 && (
          <div
            onClick={() => actions.go("approve")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(123,166,255,0.1)",
              border: "1px solid rgba(123,166,255,0.3)",
              borderRadius: 16,
              padding: 14,
              marginBottom: 22,
              cursor: "pointer",
            }}
          >
            <IconBadge background="rgba(123,166,255,0.18)" size={38}>
              <FileIcon />
            </IconBadge>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {approvals.length === 1 ? "1 comprobante por revisar" : `${approvals.length} comprobantes por revisar`}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                {approvals[0].name}
                {approvals.length > 1 ? ` y ${approvals.length - 1} más subieron` : " subió"} su pago de {group.cuota}
              </div>
            </div>
            <ChevronRight color={colors.info} />
          </div>
        )}

        {/* Roster header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel style={{ marginBottom: 0 }}>Miembros · {group.members}</SectionLabel>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{group.cuota} c/u</div>
        </div>
        <Card padding="6px 14px" style={{ marginBottom: 12 }}>
          {members.map((m, i) => (
            <MemberRow
              key={m.id}
              {...m}
              last={i === members.length - 1}
              onTogglePaid={() => actions.setMemberPaid(m.id, !m.paid)}
              onRename={m.isSelf ? undefined : (name) => actions.renameMember(m.id, name)}
              onMoveUp={i > 0 ? () => actions.moveMember(m.id, -1) : undefined}
              onMoveDown={i < members.length - 1 ? () => actions.moveMember(m.id, 1) : undefined}
              onRemove={m.isSelf ? undefined : () => actions.removeMember(m.id)}
            />
          ))}
        </Card>

        {/* Add member (single field in a modal: searches users, invites by email) */}
        <Button onClick={() => setAddOpen(true)} style={{ padding: 14, fontSize: 14.5, marginBottom: 18 }}>
          + Agregar miembro
        </Button>

        {/* Inline monthly-cost editor */}
        <CostEditor group={group} />

        {/* How members pay their cuota: QR, PayPal, transferencia */}
        <PayMethodsEditor group={group} />

        <Button variant="secondary" onClick={() => actions.go("history")} style={{ padding: 14, fontSize: 13.5, fontWeight: 700 }}>
          Ver historial de pagos
        </Button>
      </div>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />
    </ScreenShell>
  );
}
