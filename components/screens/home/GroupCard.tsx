import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusStyle } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import type { GroupView } from "@/lib/types";

/** A group entry in the Home list — shows cuota, status and (for owned groups) collection progress. */
export function GroupCard({ group, onOpen }: { group: GroupView; onOpen: () => void }) {
  const st = statusStyle(group.statusKey);

  return (
    <Card onClick={onOpen}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <Avatar label={group.mono} background={group.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: colors.textPrimary }}>{group.name}</div>
            {group.owned && (
              <div
                style={{
                  padding: "2px 7px",
                  borderRadius: 6,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  background: "rgba(123,166,255,0.16)",
                  color: colors.info,
                }}
              >
                ADMIN
              </div>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 2 }}>
            {group.plan} · vence {group.due}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>{group.cuota}</div>
          <StatusBadge label={st.label} bg={st.bg} color={st.color} style={{ marginTop: 4 }} />
        </div>
      </div>

      {group.owned && group.admin && (
        <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${colors.hairlineSoft}` }}>
          <ProgressBar value={group.admin.pct} height={7} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11.5, color: colors.textMuted }}>
              <span style={{ color: colors.positive, fontWeight: 700 }}>{group.admin.collected}</span> cobrado de{" "}
              {group.admin.total}
            </span>
            <span style={{ fontSize: 11.5, color: colors.warning, fontWeight: 700 }}>
              {group.admin.pendingCount} deben
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
