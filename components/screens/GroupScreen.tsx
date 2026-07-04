import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GearIcon } from "@/components/ui/Icons";
import { MemberRow } from "@/components/ui/MemberRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getApprovals, getCurrentGroup, getMembers, isPayable, statusStyle } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";

/** Group detail — the shared "view the group" screen; admin tools live on the admin screen. */
export function GroupScreen() {
  const { state, actions } = useApp();
  const group = getCurrentGroup(state);
  const members = getMembers(state, ACCENT);
  const approvals = getApprovals(state);
  const st = group ? statusStyle(group.statusKey) : null;

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
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 12 }}>Vence el {group.due}/2026</div>
        </Card>

        {isPayable(group) && (
          <div style={{ marginBottom: 22 }}>
            <Button onClick={() => actions.go("pay")}>Pagar cuota</Button>
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
