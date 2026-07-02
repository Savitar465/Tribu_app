import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChevronRight, FileIcon, PencilIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { MemberRow } from "@/components/ui/MemberRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField } from "@/components/ui/TextField";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getApproval, getCurrentGroup, getMembers, isPayable, statusStyle } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";
import type { GroupView } from "@/lib/types";

/** Group detail — renders the member or admin variant based on ownership. */
export function GroupScreen() {
  const { state } = useApp();
  const group = getCurrentGroup(state);
  const members = getMembers(state, ACCENT);
  const approval = getApproval(state);

  if (!group) return null;

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

      {group.owned ? (
        <AdminDetail group={group} members={members} approval={approval} />
      ) : (
        <MemberDetail group={group} members={members} />
      )}
    </ScreenShell>
  );
}

type Members = ReturnType<typeof getMembers>;

/** The view a regular member sees: their cuota, pay actions and the roster. */
function MemberDetail({ group, members }: { group: GroupView; members: Members }) {
  const { actions } = useApp();
  const st = statusStyle(group.statusKey);

  return (
    <div style={{ padding: "0 18px" }}>
      <Card padding={22} radius={22} style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>Tu cuota de este mes</div>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: colors.textPrimary, margin: "4px 0 8px" }}>
          {group.cuota}
        </div>
        <StatusBadge label={st.label} bg={st.bg} color={st.color} style={{ padding: "5px 14px", fontSize: 13 }} />
        <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 12 }}>Vence el {group.due}/2026</div>
      </Card>

      {isPayable(group) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          <Button onClick={() => actions.go("pay")}>Pagar cuota</Button>
          <Button variant="secondary" onClick={() => actions.go("qr")} style={{ padding: 15, fontSize: 14.5, fontWeight: 700 }}>
            Pagar con QR
          </Button>
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
  );
}

type Approval = ReturnType<typeof getApproval>;

/** The view an admin sees: collection progress, approvals, roster and cost editing. */
function AdminDetail({ group, members, approval }: { group: GroupView; members: Members; approval: Approval }) {
  const { state, actions } = useApp();
  const admin = group.admin;

  return (
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
      {approval && (
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
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>1 comprobante por revisar</div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              {approval.name} subió su pago de {group.cuota}
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

      {/* Add a person by name */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
        <TextField
          label="Agregar persona"
          value={state.memberDraft}
          onChange={actions.setMemberDraft}
          style={{ flex: 1 }}
        />
        <Button
          onClick={actions.addMember}
          disabled={!state.memberDraft.trim()}
          style={{ width: 52, padding: 0, height: 46, fontSize: 24, fontWeight: 700 }}
        >
          +
        </Button>
      </div>

      {/* Add by email / existing app user */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 18 }}>
        <TextField
          label="Agregar por correo"
          value={state.memberEmail}
          onChange={actions.setMemberEmail}
          inputMode="text"
          style={{ flex: 1 }}
        />
        <Button
          onClick={actions.addMemberByEmail}
          disabled={!state.memberEmail.trim()}
          style={{ width: 52, padding: 0, height: 46, fontSize: 24, fontWeight: 700 }}
        >
          +
        </Button>
      </div>

      {/* Edit cost */}
      <div
        onClick={() => actions.openEdit(group.id)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 16px",
          borderRadius: 15,
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <PencilIcon />
          <span style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>Editar costo mensual</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: colors.textSecondary }}>{group.monthly} ›</span>
      </div>

      <Button variant="secondary" onClick={() => actions.go("history")} style={{ padding: 14, fontSize: 13.5, fontWeight: 700 }}>
        Ver historial de pagos
      </Button>
    </div>
  );
}
