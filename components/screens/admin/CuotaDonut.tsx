import { Card } from "@/components/ui/Card";
import { fmtBs, pct } from "@/lib/format";
import { colors } from "@/lib/theme";

export interface CuotaSlice {
  id: string;
  name: string;
  /** Slice color — the member's roster/avatar color, so identity matches the list. */
  color: string;
  /** Monthly cuota in Bs. */
  value: number;
  /** Formatted cuota (e.g. "12 Bs"). */
  label: string;
}

/** Donut of each member's monthly cuota (admin panel). Identity is never
 * color-alone: every slice is named in the legend with its amount and share,
 * and a 2px surface gap separates adjacent slices. When `totalBs` (the
 * group's monthly total) is given, each share is a percentage of THAT total —
 * stable when another member's price changes — and any unassigned remainder
 * shows as an empty stretch of the ring. */
export function CuotaDonut({ slices, totalBs }: { slices: CuotaSlice[]; totalBs?: number }) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((a, s) => a + s.value, 0);
  if (data.length === 0 || total <= 0) return null;
  // Percentages (and arc lengths) are relative to the group total when known;
  // custom prices may over-collect, so the denominator never shrinks below the sum.
  const denom = Math.max(total, totalBs ?? 0);

  const R = 44; // ring radius
  const W = 22; // ring thickness
  const C = 2 * Math.PI * R;
  const gap = data.length > 1 ? 2 : 0; // surface gap between slices (px along the arc)

  const lens = data.map((s) => (s.value / denom) * C);
  const segs = data.map((s, i) => ({
    ...s,
    len: lens[i],
    off: lens.slice(0, i).reduce((a, l) => a + l, 0),
  }));

  return (
    <Card padding={20} radius={22} style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600, marginBottom: 12 }}>
        Cuotas del mes por miembro
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg
          viewBox="0 0 120 120"
          width={124}
          height={124}
          role="img"
          aria-label="Distribución de las cuotas del mes por miembro"
          style={{ flexShrink: 0 }}
        >
          {/* Slices start at 12 o'clock and run clockwise. */}
          <g transform="rotate(-90 60 60)">
            {/* Faint track: the stretch no slice covers is unassigned share. */}
            {total < denom && (
              <circle cx={60} cy={60} r={R} fill="none" stroke={colors.hairline} strokeWidth={W} />
            )}
            {segs.map((s) => (
              <circle
                key={s.id}
                cx={60}
                cy={60}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={W}
                strokeDasharray={`${Math.max(0.5, s.len - gap)} ${C}`}
                strokeDashoffset={-s.off}
              >
                <title>{`${s.name} · ${s.label} · ${pct(s.value, denom)}`}</title>
              </circle>
            ))}
          </g>
          <text
            x={60}
            y={58}
            textAnchor="middle"
            fontSize={13}
            fontWeight={800}
            fontFamily="inherit"
            fill={colors.textPrimary}
          >
            {fmtBs(total)}
          </text>
          <text
            x={60}
            y={72}
            textAnchor="middle"
            fontSize={8.5}
            fontWeight={600}
            fontFamily="inherit"
            fill={colors.textMuted}
          >
            al mes
          </text>
        </svg>

        {/* Legend: every slice named, with its amount and share. */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
          {segs.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.textSecondary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary, flexShrink: 0 }}>
                {s.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  minWidth: 32,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {pct(s.value, denom)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
