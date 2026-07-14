import type { ReactNode } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { BackBar } from "@/components/phone/BackBar";
import { Toast } from "@/components/phone/Toast";
import { useApp } from "@/lib/store";
import { REFRESHABLE_SCREENS, TABBED_SCREENS } from "@/lib/navigation";
import { colors } from "@/lib/theme";
import { Sidebar } from "./Sidebar";

/**
 * Desktop layout: a fixed left sidebar plus a full-height content area. The
 * active screen renders in a comfortable centered column so it stays legible on
 * wide monitors while the app fills the whole window.
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const { state, actions } = useApp();
  const tabbed = TABBED_SCREENS.includes(state.screen);
  const refreshable = REFRESHABLE_SCREENS.includes(state.screen);

  return (
    <div style={{ display: "flex", height: "100dvh", width: "100%", background: colors.bg }}>
      <Sidebar />

      <main style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <PullToRefresh enabled={refreshable} onRefresh={actions.refresh} className="scr">
          <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", padding: "16px 12px 32px" }}>
            {!tabbed && <BackBar />}
            {children}
          </div>
        </PullToRefresh>
        <Toast />
      </main>
    </div>
  );
}
