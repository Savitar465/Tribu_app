import { colors } from "@/lib/theme";
import { StatusBadge } from "./StatusBadge";
import { initials } from "./Avatar";

interface MemberRowProps {
  name: string;
  av: string;
  stLabel: string;
  stColor: string;
  stBg: string;
  /** Hide the divider on the last row. */
  last?: boolean;
}

/** A single member row (round avatar, name, paid/pending badge). */
export function MemberRow({ name, av, stLabel, stColor, stBg, last }: MemberRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        borderBottom: last ? "none" : `1px solid ${colors.hairlineSoft}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: av,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {initials(name)}
      </div>
      <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: colors.textPrimary }}>{name}</div>
      <StatusBadge label={stLabel} bg={stBg} color={stColor} />
    </div>
  );
}
