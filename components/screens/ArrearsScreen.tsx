import { useState } from "react";
import { Avatar, initials } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { BellIcon } from "@/components/ui/Icons";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getCurrentGroup, getOverdue } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/**
 * Overdue management across every group the user administers. Month by month:
 * who already paid (and who paid for them), who still owes and how much, with
 * filters by group, month and member plus totals for the selection. Opened
 * from a group's admin panel it starts filtered to that group.
 */
export function ArrearsScreen() {
  const { state, actions } = useApp();
  const current = getCurrentGroup(state);
  const [groupId, setGroupId] = useState<string | null>(current?.owned ? current.id : null);
  const [cycle, setCycle] = useState<string | null>(null);
  const [member, setMember] = useState<string | null>(null);

  const o = getOverdue(state, { groupId, cycle, member });
  if (o.groupOptions.length === 0) return null;

  return (
    <ScreenShell>
      {/* Totals for the current selection */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Card padding="13px 14px" radius={16} style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 600 }}>Cobrado</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: colors.positive, letterSpacing: -0.5 }}>
            {o.totals.collected}
          </div>
        </Card>
        <Card padding="13px 14px" radius={16} style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 600 }}>
            Por cobrar{o.totals.pendingCount > 0 ? ` · ${o.totals.pendingCount}` : ""}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: colors.warning, letterSpacing: -0.5 }}>
            {o.totals.pending}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <FilterSelect
          label="Grupo"
          value={groupId ?? ""}
          onChange={(v) => setGroupId(v || null)}
          options={o.groupOptions.map((g) => ({ value: g.id, label: g.name }))}
        />
        <FilterSelect
          label="Mes"
          value={cycle ?? ""}
          onChange={(v) => setCycle(v || null)}
          options={o.cycleOptions.map((c) => ({ value: c, label: c }))}
        />
        <FilterSelect
          label="Miembro"
          value={member ?? ""}
          onChange={(v) => setMember(v || null)}
          options={o.memberOptions.map((m) => ({ value: m, label: m }))}
        />
      </div>

      {o.months.length === 0 ? (
        <Card padding="28px 18px" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.positive, marginBottom: 4 }}>Todo al día ✓</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>
            No hay cobros que coincidan con los filtros.
          </div>
        </Card>
      ) : (
        <>
          {o.months.map((m) => (
            <div key={m.cycle} style={{ marginBottom: 20 }}>
              <SectionLabel>
                {m.label}
                {m.isCurrent ? " · mes actual" : ""}
              </SectionLabel>
              <Card padding="4px 16px">
                {/* Month status line */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: `1px solid ${colors.hairlineSoft}`,
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: colors.textMuted }}>
                    Pagaron {m.paidCount} de {m.totalCount}
                  </span>
                  <span style={{ color: m.complete ? colors.positive : colors.warning }}>
                    {m.complete ? "Completo ✓" : `Por cobrar ${m.owedLabel}`}
                  </span>
                </div>

                {/* Who still owes (with amount and a reminder shortcut) */}
                {m.owing.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "11px 0",
                      borderBottom: `1px solid ${colors.hairlineSoft}`,
                    }}
                  >
                    <Avatar label={initials(p.name)} background={p.color} size={34} radius={10} fontSize={12} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
                        {p.name}
                        {p.overdue && (
                          <span
                            style={{
                              marginLeft: 8,
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              background: "rgba(255,107,107,0.14)",
                              color: colors.danger,
                            }}
                          >
                            vencido
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textMuted }}>{p.groupName}</div>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: colors.warning }}>{p.cuotaLabel}</div>
                    <div
                      onClick={() => actions.remindMember(p.participantId)}
                      title="Enviar recordatorio de pago"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: 8,
                        borderRadius: 10,
                        background: "rgba(123,166,255,0.12)",
                        border: "1px solid rgba(123,166,255,0.3)",
                        cursor: "pointer",
                        opacity: p.userId ? 1 : 0.45,
                      }}
                    >
                      <BellIcon size={14} color={colors.info} />
                    </div>
                  </div>
                ))}

                {/* Who already paid */}
                {m.paid.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "11px 0" }}>
                    {m.paid.map((p) => (
                      <span
                        key={p.id}
                        title={`${p.groupName} · ${p.cuotaLabel}${p.payer ? ` · pagado por ${p.payer}` : ""}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px 4px 5px",
                          borderRadius: 999,
                          background: "rgba(54,208,122,0.1)",
                          border: "1px solid rgba(54,208,122,0.3)",
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
                        {p.name} ✓{p.payer ? ` (por ${p.payer})` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ))}

          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4, textAlign: "center" }}>
            Cada mes muestra la cuota congelada al tipo de cambio de ese cobro. Los recordatorios
            automáticos se envían a los 3 y 7 días.
          </div>
        </>
      )}
    </ScreenShell>
  );
}

/** A compact labelled dropdown for the filters row ("" = all). */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "9px 8px",
          borderRadius: 12,
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          color: colors.textPrimary,
          fontSize: 12.5,
          fontWeight: 600,
          outline: "none",
        }}
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
