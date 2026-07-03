import { useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getActivity } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";

/** Activity feed: charge notifications, reminders, dues and proofs awaiting review. */
export function NotificationsScreen() {
  const { state, actions } = useApp();
  const activity = getActivity(state);

  // Opening the feed marks everything as read (clears the bell badge).
  useEffect(() => {
    actions.markActivityRead();
  }, [actions]);

  return (
    <ScreenShell>
      <div style={{ fontSize: 26, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 18 }}>
        Actividad
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {activity.map((n, i) => (
          <Card key={i} padding={15} radius={16}>
            <div style={{ display: "flex", gap: 12 }}>
              <Avatar label={n.mono} background={n.color} size={40} radius={12} fontSize={14} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    {n.unread && (
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                    )}
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>{n.title}</div>
                  </div>
                  <div style={{ fontSize: 11, color: colors.textFaint, flexShrink: 0 }}>{n.time}</div>
                </div>
                <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
              </div>
            </div>
            {n.action && (
              <div
                onClick={() => actions.reviewGroup(n.groupId)}
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  padding: 11,
                  borderRadius: 12,
                  background: "rgba(123,166,255,0.14)",
                  color: colors.info,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Revisar comprobante
              </div>
            )}
          </Card>
        ))}
      </div>
    </ScreenShell>
  );
}
