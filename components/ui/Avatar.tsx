import type { CSSProperties } from "react";

interface AvatarProps {
  /** Text shown inside (monogram or initials). */
  label: string;
  /** Solid color or gradient string. */
  background: string;
  size?: number;
  radius?: number;
  fontSize?: number;
  color?: string;
  style?: CSSProperties;
}

/** A rounded-square brand/monogram avatar. */
export function Avatar({
  label,
  background,
  size = 46,
  radius = 14,
  fontSize = 17,
  color = "#fff",
  style,
}: AvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background,
        display: "grid",
        placeItems: "center",
        color,
        fontWeight: 800,
        fontSize,
        flexShrink: 0,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

/** Derive up-to-two initials from a person's name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
