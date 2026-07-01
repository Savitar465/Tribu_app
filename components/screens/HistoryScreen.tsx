import { ScreenShell } from "@/components/screens/ScreenShell";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { getHistory } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** History: a per-month payment ledger for the current group. */
export function HistoryScreen() {
  const { state } = useApp();
  const h = getHistory(state);

  if (!h) return null;

  return (
    <ScreenShell>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
        <Avatar label={h.group.mono} background={h.group.color} size={44} radius={13} fontSize={16} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{h.group.name}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>Historial de pagos {h.year}</div>
        </div>
      </div>

      {h.rows.length === 0 ? (
        <Card padding="26px 18px" style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 13.5, color: colors.textMuted }}>Aún no hay historial para este grupo.</div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 22 }}>
          {h.rows.map((r) => (
            <Card key={r.key} padding="16px 10px" radius={16} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: r.bg,
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 8px",
                  color: r.color,
                  fontSize: 17,
                  fontWeight: 800,
                }}
              >
                {r.mark}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>{r.month}</div>
              <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 1 }}>{r.ok ? r.amount : "—"}</div>
            </Card>
          ))}
        </div>
      )}

      <Card padding="16px 18px" radius={16} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600 }}>Total pagado en {h.year}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: colors.positive }}>{h.total}</div>
      </Card>
    </ScreenShell>
  );
}
