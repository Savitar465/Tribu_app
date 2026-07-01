import { colors } from "@/lib/theme";

interface ProgressBarProps {
  /** Fill width as a CSS value (e.g. "40%"). */
  value: string;
  fill?: string;
  track?: string;
  height?: number;
}

/** A rounded progress track with a colored fill. */
export function ProgressBar({
  value,
  fill = colors.positive,
  track = colors.bg,
  height = 9,
}: ProgressBarProps) {
  return (
    <div style={{ height, borderRadius: 999, background: track, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 999, background: fill, width: value }} />
    </div>
  );
}
