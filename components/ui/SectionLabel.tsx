import type { CSSProperties, ReactNode } from "react";
import { colors } from "@/lib/theme";

/** Uppercase muted section heading used to group content. */
export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
