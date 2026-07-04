import type { ReactNode } from "react";
import { BellIcon, ChartIcon, HomeIcon, UserIcon, WalletIcon } from "@/components/ui/Icons";
import { getUnreadCount } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";
import type { Screen } from "@/lib/types";

interface Tab {
  screen: Screen;
  label: string;
  icon: (color: string) => ReactNode;
}

const TABS: Tab[] = [
  { screen: "home", label: "Inicio", icon: (c) => <HomeIcon color={c} /> },
  { screen: "dashboard", label: "Resumen", icon: (c) => <ChartIcon color={c} /> },
  { screen: "wallet", label: "Saldo", icon: (c) => <WalletIcon size={22} color={c} /> },
  { screen: "notifications", label: "Actividad", icon: (c) => <BellIcon size={22} color={c} /> },
  { screen: "profile", label: "Perfil", icon: (c) => <UserIcon color={c} /> },
];

/** Bottom tab bar for the app's five top-level destinations. */
export function BottomNav() {
  const { state, actions } = useApp();
  const unread = getUnreadCount(state);

  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        padding: "12px 4px calc(14px + env(safe-area-inset-bottom))",
        background: "rgba(13,15,20,0.85)",
        backdropFilter: "blur(16px)",
        borderTop: `1px solid ${colors.hairline}`,
      }}
    >
      {TABS.map((tab) => {
        const active = state.screen === tab.screen;
        const color = active ? ACCENT : colors.textNav;
        return (
          <div
            key={tab.screen}
            onClick={() => actions.go(tab.screen)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              color,
            }}
          >
            <div style={{ position: "relative" }}>
              {tab.icon(color)}
              {tab.screen === "notifications" && unread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -6,
                    minWidth: 15,
                    height: 15,
                    borderRadius: 999,
                    background: colors.danger,
                    color: "#fff",
                    fontSize: 9.5,
                    fontWeight: 800,
                    display: "grid",
                    placeItems: "center",
                    padding: "0 3px",
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
}
