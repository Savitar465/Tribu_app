import type { CSSProperties, ReactNode } from "react";
import { colors } from "@/lib/theme";

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  padding?: CSSProperties["padding"];
  radius?: number;
  style?: CSSProperties;
}

/** The standard raised surface used throughout the app. */
export function Card({ children, onClick, padding = 14, radius = 18, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.hairline}`,
        borderRadius: radius,
        padding,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
