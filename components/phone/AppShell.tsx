import type { ReactNode } from "react";
import { DesktopShell } from "@/components/desktop/DesktopShell";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { MobileShell } from "./MobileShell";

/**
 * Responsive shell: a sidebar + full-window layout on wide screens, and the
 * centered phone-width layout (with bottom tab bar) on smaller screens.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const desktop = useMediaQuery("(min-width: 900px)");
  return desktop ? <DesktopShell>{children}</DesktopShell> : <MobileShell>{children}</MobileShell>;
}
