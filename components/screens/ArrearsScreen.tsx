import { Avatar, initials } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { BellIcon } from "@/components/ui/Icons";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getCurrentGroup, getGroupArrears } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/**
 * Admin page of unpaid charges for the current group: month by month (with the
 * price frozen that month and who's missing) and member by member (owed
 * months, total and a reminder button).
 */
export function ArrearsScreen() {
  const { state, actions } = useApp();
  const group = getCurrentGroup(state);
  const a = getGroupArrears(state);

  if (!group?.owned) return null;

  return (
    <ScreenShell>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
        <Avatar label={group.mono} background={group.color} size={44} radius={13} fontSize={16} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{group.name}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>
            {a.count === 0
              ? "Sin cuotas pendientes"
              : `${a.count} ${a.count === 1 ? "cuota pendiente" : "cuotas pendientes"}`}
          </div>
        </div>
        {a.count > 0 && <div style={{ fontSize: 18, fontWeight: 800, color: colors.warning }}>{a.totalLabel}</div>}
      </div>

      {a.count === 0 ? (
        <Card padding="28px 18px" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.positive, marginBottom: 4 }}>Todo al día ✓</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>Ningún miembro tiene cuotas por pagar.</div>
        </Card>
      ) : (
        <>
          {/* Month by month */}
          <SectionLabel>Por mes</SectionLabel>
          <Card padding="4px 16px" style={{ marginBottom: 22 }}>
            {a.byMonth.map((m, i) => (
              <div
                key={m.cycle}
                style={{
                  padding: "13px 0",
                  borderBottom: i === a.byMonth.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.isCurrent ? colors.textSecondary : colors.warning }}>
                    {m.label}
                    {m.isCurrent ? " · mes actual" : " · atrasado"}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: colors.textSecondary }}>cuota {m.cuotaLabel}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {m.members.map((p) => (
                    <span
                      key={p.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px 4px 5px",
                        borderRadius: 999,
                        background: colors.surface2,
                        border: `1px solid ${colors.border}`,
                        fontSize: 12,
                        fontWeight: 700,
                        color: colors.textPrimary,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: p.color,
                          display: "grid",
                          placeItems: "center",
                          fontSize: 9,
                          color: "#fff",
                          fontWeight: 800,
                        }}
                      >
                        {initials(p.name)}
                      </span>
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          {/* Member by member, with reminder */}
          <SectionLabel>Por miembro</SectionLabel>
          <Card padding="4px 16px">
            {a.byMember.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "13px 0",
                  borderBottom: i === a.byMember.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                }}
              >
                <Avatar label={initials(m.name)} background={m.color} size={36} radius={11} fontSize={12} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                    Debe {m.count === 1 ? "1 mes" : `${m.count} meses`} ({m.monthsLabel})
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: colors.warning }}>{m.totalLabel}</div>
                <div
                  onClick={() => actions.remindMember(m.id)}
                  title="Enviar recordatorio de pago"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "8px 11px",
                    borderRadius: 11,
                    background: "rgba(123,166,255,0.12)",
                    border: "1px solid rgba(123,166,255,0.3)",
                    cursor: "pointer",
                    opacity: m.userId ? 1 : 0.45,
                  }}
                >
                  <BellIcon size={14} color={colors.info} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: colors.info }}>Recordar</span>
                </div>
              </div>
            ))}
          </Card>

          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 12, textAlign: "center" }}>
            Cada mes muestra la cuota congelada al tipo de cambio de ese cobro. Los recordatorios
            automáticos se envían a los 3 y 7 días.
          </div>
        </>
      )}
    </ScreenShell>
  );
}
