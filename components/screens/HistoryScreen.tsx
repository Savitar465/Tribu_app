import { useState } from "react";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { Avatar, initials } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getHistory } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

const COLLECTED = colors.positive;
const PENDING_BG = "rgba(245,181,61,0.22)";

/** History: per-month collections (admin) or own cuotas (member), with a
 * tappable column chart — bar height is that month's target at its frozen
 * cuota, the solid part is what got paid. */
export function HistoryScreen() {
  const { state } = useApp();
  const h = getHistory(state);
  const [selCycle, setSelCycle] = useState<string | null>(null);

  if (!h) return null;
  const sel = h.months.find((m) => m.cycle === selCycle) ?? h.months[h.months.length - 1] ?? null;

  return (
    <ScreenShell>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
        <Avatar label={h.group.mono} background={h.group.color} size={44} radius={13} fontSize={16} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{h.group.name}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>Historial · {h.caption}</div>
        </div>
      </div>

      {h.months.length === 0 ? (
        <Card padding="26px 18px" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13.5, color: colors.textMuted }}>
            Aún no hay cobros registrados para este grupo.
          </div>
        </Card>
      ) : (
        <>
          {/* Totals */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <Card padding="14px 16px" radius={16} style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 600 }}>{h.totalCaption}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.positive, letterSpacing: -0.5 }}>
                {h.totalLabel}
              </div>
            </Card>
            <Card padding="14px 16px" radius={16} style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 600 }}>Pendiente</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.warning, letterSpacing: -0.5 }}>
                {h.pendingLabel}
              </div>
            </Card>
          </div>

          {/* Monthly chart */}
          <Card padding="16px 16px 12px" radius={18} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130 }}>
              {h.months.map((m) => {
                const barH = Math.max(10, Math.round((m.target / h.maxTarget) * 110));
                const fillH = m.target > 0 ? Math.round((m.collected / m.target) * barH) : 0;
                const active = sel?.cycle === m.cycle;
                return (
                  <div
                    key={m.cycle}
                    onClick={() => setSelCycle(m.cycle)}
                    title={`${m.label} · cobrado ${m.collectedLabel} de ${m.cuotaLabel} × ${m.totalCount}`}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      cursor: "pointer",
                      height: "100%",
                    }}
                  >
                    {active && (
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: colors.textSecondary, marginBottom: 4 }}>
                        {m.collectedLabel}
                      </div>
                    )}
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 30,
                        height: barH,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        borderRadius: "4px 4px 0 0",
                        overflow: "hidden",
                        background: PENDING_BG,
                        outline: active ? `2px solid ${colors.textSecondary}` : "none",
                        outlineOffset: 1,
                        opacity: active || !sel ? 1 : 0.75,
                      }}
                    >
                      <div
                        style={{
                          height: fillH,
                          background: COLLECTED,
                          borderTop: fillH > 0 && fillH < barH ? `2px solid ${colors.surface}` : "none",
                          borderRadius: m.complete ? "4px 4px 0 0" : 0,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Month axis */}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {h.months.map((m) => (
                <div
                  key={m.cycle}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 10.5,
                    fontWeight: sel?.cycle === m.cycle ? 800 : 600,
                    color: sel?.cycle === m.cycle ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {m.monthShort}
                </div>
              ))}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 10 }}>
              <LegendDot color={COLLECTED} label={h.owned ? "Cobrado" : "Pagado"} />
              <LegendDot color={PENDING_BG} label="Pendiente" />
            </div>
          </Card>

          {/* Selected month detail */}
          {sel && (
            <>
              <SectionLabel>
                {sel.label} · cuota {sel.cuotaLabel}
              </SectionLabel>
              <Card padding="4px 16px">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "13px 0",
                    borderBottom: `1px solid ${colors.hairlineSoft}`,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: colors.textMuted }}>
                    {h.owned ? `Pagaron ${sel.paidCount} de ${sel.totalCount}` : sel.paidCount === 1 ? "Pagado" : "Pendiente"}
                  </span>
                  <span style={{ color: sel.complete ? colors.positive : colors.warning }}>
                    {sel.collectedLabel}
                    {!sel.complete && ` · faltan ${sel.pendingLabel}`}
                  </span>
                </div>
                {h.owned &&
                  sel.detail.map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        padding: "11px 0",
                        borderBottom: i === sel.detail.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                      }}
                    >
                      <Avatar label={initials(p.name)} background={p.color} size={30} radius={9} fontSize={11} />
                      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>{p.name}</div>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: p.paid ? "rgba(54,208,122,0.14)" : "rgba(245,181,61,0.14)",
                          color: p.paid ? colors.positive : colors.warning,
                        }}
                      >
                        {p.paid ? "Pagado" : "Pendiente"}
                      </span>
                    </div>
                  ))}
                {!h.owned && (
                  <div style={{ padding: "12px 0", fontSize: 12.5, color: colors.textMuted }}>
                    Cuota de {sel.label}: {sel.cuotaLabel} ·{" "}
                    {sel.complete ? "pagada" : "pendiente de pago"}
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </ScreenShell>
  );
}

/** Small legend swatch + label (text in text tokens, color only on the dot). */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: colors.textMuted }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}
