import type { CSSProperties, ReactNode } from "react";
import { GRADIENT, colors } from "@/lib/theme";

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  style?: CSSProperties;
}

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: {
    background: GRADIENT,
    color: "#fff",
    boxShadow: "0 12px 28px -10px rgba(91,140,255,0.6)",
  },
  secondary: {
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    color: colors.textSecondary,
  },
  success: {
    background: colors.positive,
    color: "#06281a",
    boxShadow: "0 12px 28px -10px rgba(54,208,122,0.6)",
  },
  danger: {
    background: "rgba(255,107,107,0.12)",
    border: "1px solid rgba(255,107,107,0.3)",
    color: colors.danger,
  },
  ghost: {
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    color: colors.textSecondary,
  },
};

/** Full-width action button with design-matched variants. */
export function Button({ children, onClick, variant = "primary", style }: ButtonProps) {
  return (
    <div
      onClick={onClick}
      style={{
        textAlign: "center",
        padding: 16,
        borderRadius: 16,
        fontSize: 15.5,
        fontWeight: 800,
        cursor: "pointer",
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
