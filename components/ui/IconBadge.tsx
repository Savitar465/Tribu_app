import type { ReactNode } from "react";

interface IconBadgeProps {
  children: ReactNode;
  /** Tinted background (usually a low-opacity brand color). */
  background: string;
  size?: number;
  radius?: number;
}

/** A tinted rounded square that frames a line icon. */
export function IconBadge({ children, background, size = 40, radius = 11 }: IconBadgeProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}
