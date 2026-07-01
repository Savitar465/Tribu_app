import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { IconBadge } from "@/components/ui/IconBadge";
import { BellIcon, ChartIcon, ChevronRight, CreditCardIcon, GlobeIcon } from "@/components/ui/Icons";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getProfileView } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { GRADIENT, colors } from "@/lib/theme";

/** Profile: user identity, group summary shortcut and account settings. */
export function ProfileScreen() {
  const { state, actions } = useApp();
  const p = getProfileView(state);

  return (
    <ScreenShell>
      {/* Identity */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
        <Avatar label={p.mono} background={GRADIENT} size={76} radius={24} fontSize={28} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary }}>{p.fullName}</div>
        <div style={{ fontSize: 13, color: colors.textMuted }}>{p.email}</div>
      </div>

      {/* Groups shortcut */}
      <Card onClick={() => actions.go("dashboard")} padding="15px 16px" radius={16} style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <IconBadge background="rgba(91,140,255,0.15)" size={34} radius={10}>
              <ChartIcon size={17} color={colors.info} />
            </IconBadge>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>{p.subCount} grupos</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                Administras {p.ownedCount} · participas en {p.memberCount}
              </div>
            </div>
          </div>
          <ChevronRight size={12} color={colors.textFaint} />
        </div>
      </Card>

      {/* Settings */}
      <Card padding="4px 16px">
        <SettingRow
          icon={
            <IconBadge background="rgba(91,140,255,0.15)" size={32} radius={9}>
              <CreditCardIcon color={colors.info} />
            </IconBadge>
          }
          label="Métodos de pago"
          trailing={<ChevronRight size={12} color={colors.textFaint} />}
        />
        <SettingRow
          icon={
            <IconBadge background="rgba(245,181,61,0.15)" size={32} radius={9}>
              <BellIcon size={16} color={colors.warning} />
            </IconBadge>
          }
          label="Recordatorios"
          trailing={<span style={{ fontSize: 12.5, color: colors.positive, fontWeight: 700 }}>Activos</span>}
        />
        <SettingRow
          icon={
            <IconBadge background="rgba(139,147,163,0.15)" size={32} radius={9}>
              <GlobeIcon color={colors.textMuted} />
            </IconBadge>
          }
          label="Idioma"
          trailing={<span style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>Español</span>}
          last
        />
      </Card>

      <div
        onClick={actions.signOut}
        style={{
          textAlign: "center",
          marginTop: 22,
          padding: 15,
          borderRadius: 14,
          background: "rgba(255,107,107,0.1)",
          border: "1px solid rgba(255,107,107,0.25)",
          color: colors.danger,
          fontSize: 14.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Cerrar sesión
      </div>
    </ScreenShell>
  );
}

function SettingRow({
  icon,
  label,
  trailing,
  last,
}: {
  icon: ReactNode;
  label: string;
  trailing: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "15px 0",
        borderBottom: last ? "none" : `1px solid ${colors.hairlineSoft}`,
      }}
    >
      {icon}
      <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: colors.textPrimary }}>{label}</div>
      {trailing}
    </div>
  );
}
