import type { CSSProperties } from "react";

/** Shared props for line icons (stroke follows `color`, defaulting to `currentColor`). */
interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

const base = (size: number, color: string, style?: CSSProperties) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: color,
  strokeWidth: 2,
  style,
});

export function BellIcon({ size = 19, color = "#cfd4de", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function WalletIcon({ size = 18, color = "#cfd4de", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <path d="M2 10h20M16 15h2" />
    </svg>
  );
}

export function HomeIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function ChartIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M4 20V12M10 20V5M16 20V9" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function QrIcon({ size = 19, color = "#7ba6ff", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4" />
    </svg>
  );
}

export function CardIcon({ size = 19, color = "#36d07a", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
    </svg>
  );
}

export function FileIcon({ size = 18, color = "#7ba6ff", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function PencilIcon({ size = 18, color = "#cfd4de", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function UploadIcon({ size = 22, color = "#8b93a3", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <path d="M12 16V4m0 0L8 8m4-4l4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function ImageIcon({ size = 34, color = "#5b6373", style }: IconProps) {
  return (
    <svg {...base(size, color, style)} strokeWidth={1.6}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function CreditCardIcon({ size = 16, color = "#7ba6ff", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

export function GlobeIcon({ size = 16, color = "#8b93a3", style }: IconProps) {
  return (
    <svg {...base(size, color, style)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
    </svg>
  );
}

export function PlusIcon({ size = 24, color = "#fff", style }: IconProps) {
  return (
    <svg {...base(size, color, style)} strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

/** Right-pointing chevron (indicator). Uses a 8×14 art box. */
export function ChevronRight({ size = 14, color = "#69707f", style }: IconProps) {
  return (
    <svg width={(size * 8) / 14} height={size} viewBox="0 0 8 14" fill="none" style={style}>
      <path d="M1 1l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Left-pointing chevron for the back button. */
export function ChevronLeft({ color = "#cfd4de", style }: IconProps) {
  return (
    <svg width={9} height={16} viewBox="0 0 9 16" fill="none" style={style}>
      <path d="M7.5 1.5 1.5 8l6 6.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
