import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BellIcon, ChartIcon, HomeIcon, PlusIcon, UserIcon, WalletIcon } from "@/components/ui/Icons";
import { getProfileView } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, GRADIENT, colors } from "@/lib/theme";
import type { Screen } from "@/lib/types";

interface NavItemDef {
  screen: Screen;
  label: string;
  icon: (color: string) => ReactNode;
}

const ITEMS: NavItemDef[] = [
  { screen: "home", label: "Inicio", icon: (c) => <HomeIcon size={20} color={c} /> },
  { screen: "dashboard", label: "Resumen", icon: (c) => <ChartIcon size={20} color={c} /> },
  { screen: "wallet", label: "Wallet", icon: (c) => <WalletIcon size={20} color={c} /> },
  { screen: "notifications", label: "Actividad", icon: (c) => <BellIcon size={20} color={c} /> },
  { screen: "profile", label: "Perfil", icon: (c) => <UserIcon size={20} color={c} /> },
];

/** Desktop left navigation: brand, create action, destinations and account footer. */
export function Sidebar() {
  const { state, actions } = useApp();
  const p = getProfileView(state);

  return (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        height: "100%",
        borderRight: `1px solid ${colors.hairline}`,
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 22 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: GRADIENT,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          T
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.4 }}>Tribu</div>
      </div>

      {/* Create group */}
      <div
        onClick={() => actions.go("create")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 12,
          borderRadius: 14,
          background: GRADIENT,
          color: "#fff",
          fontWeight: 800,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 18,
          boxShadow: "0 12px 28px -12px rgba(91,140,255,0.6)",
        }}
      >
        <PlusIcon size={18} /> Crear grupo
      </div>

      {/* Destinations */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ITEMS.map((item) => (
          <NavItem
            key={item.screen}
            item={item}
            active={state.screen === item.screen}
            onClick={() => actions.go(item.screen)}
          />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Account */}
      <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px", marginBottom: 10 }}>
          <Avatar label={p.mono} background={GRADIENT} size={38} radius={12} fontSize={14} />
          <div style={{ minWidth: 0 }}>
            <div style={ellipsis(13.5, 700, colors.textPrimary)}>{p.fullName}</div>
            <div style={ellipsis(11.5, 500, colors.textMuted)}>{p.email}</div>
          </div>
        </div>
        <div
          onClick={actions.signOut}
          style={{
            textAlign: "center",
            padding: 10,
            borderRadius: 12,
            background: "rgba(255,107,107,0.1)",
            border: "1px solid rgba(255,107,107,0.22)",
            color: colors.danger,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item, active, onClick }: { item: NavItemDef; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const color = active ? ACCENT : hover ? colors.textPrimary : colors.textNav;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 12px",
        borderRadius: 12,
        cursor: "pointer",
        background: active ? colors.surface : hover ? colors.surface2 : "transparent",
        color,
      }}
    >
      {item.icon(color)}
      <span style={{ fontSize: 14, fontWeight: 700 }}>{item.label}</span>
    </div>
  );
}

const ellipsis = (fontSize: number, fontWeight: number, color: string): React.CSSProperties => ({
  fontSize,
  fontWeight,
  color,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
