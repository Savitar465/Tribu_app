import type { CSSProperties, ReactNode } from "react";

interface ScreenShellProps {
  children: ReactNode;
  /** Some screens (e.g. Group) manage their own horizontal padding. */
  padding?: CSSProperties["padding"];
}

/** Standard screen container: consistent padding and the fade-in animation. */
export function ScreenShell({ children, padding = "4px 18px 28px" }: ScreenShellProps) {
  return <div style={{ padding, animation: "tribuFade 0.3s ease" }}>{children}</div>;
}
