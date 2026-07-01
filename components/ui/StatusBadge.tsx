import type { CSSProperties } from "react";

interface StatusBadgeProps {
  label: string;
  bg: string;
  color: string;
  style?: CSSProperties;
}

/** A small colored status pill (Pagado / Pendiente / Vencido / En validación). */
export function StatusBadge({ label, bg, color, style }: StatusBadgeProps) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        ...style,
      }}
    >
      {label}
    </span>
  );
}
