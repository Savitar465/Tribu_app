import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { FAB_SCREENS, TABBED_SCREENS } from "@/lib/navigation";
import { colors } from "@/lib/theme";
import { BackBar } from "./BackBar";
import { BottomNav } from "./BottomNav";
import { Fab } from "./Fab";
import { Toast } from "./Toast";

/**
 * Mobile layout: a centered, phone-width column that fills the screen on phones
 * and sits on the page backdrop on tablets. Bottom tab bar + FAB, safe-area aware.
 */
export function MobileShell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const tabbed = TABBED_SCREENS.includes(state.screen);
  const showFab = FAB_SCREENS.includes(state.screen);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 440,
        margin: "0 auto",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: colors.bg,
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 30px 90px -20px rgba(0,0,0,0.7)",
      }}
    >
      {/* Safe-area spacer (status bar / notch when installed). */}
      <div style={{ height: "env(safe-area-inset-top)", flexShrink: 0 }} />

      {!tabbed && <BackBar />}

      <div className="scr" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {children}
      </div>

      <Toast />
      {showFab && <Fab />}
      {tabbed && <BottomNav />}
    </div>
  );
}
