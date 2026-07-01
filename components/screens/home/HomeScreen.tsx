import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { BellIcon, CardIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { getHome } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { GRADIENT, colors } from "@/lib/theme";
import { GroupCard } from "./GroupCard";

/** Home: greeting, amount due, shared-fund shortcut and the user's groups. */
export function HomeScreen() {
  const { state, actions } = useApp();
  const h = getHome(state);

  return (
    <ScreenShell>
      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar label={h.mono} background={GRADIENT} size={44} fontSize={16} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.3 }}>
              Hola, {h.name}
            </div>
            <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 500 }}>
              {h.subCount} {h.subCount === 1 ? "suscripción activa" : "suscripciones activas"}
            </div>
          </div>
        </div>
        <div
          onClick={() => actions.go("notifications")}
          style={{
            position: "relative",
            width: 42,
            height: 42,
            borderRadius: 13,
            background: colors.surface2,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <BellIcon />
        </div>
      </div>

      {h.hasGroups ? (
        <>
          {/* Hero: amount due */}
          <div
            style={{
              borderRadius: 22,
              padding: 20,
              background: GRADIENT,
              color: "#fff",
              marginBottom: 14,
              boxShadow: "0 16px 36px -12px rgba(91,140,255,0.5)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>Por pagar este mes</div>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, margin: "4px 0 2px" }}>{h.payDue}</div>
            <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 500 }}>
              {h.dueCount} {h.dueCount === 1 ? "cuota pendiente" : "cuotas pendientes"}
            </div>
          </div>

          {/* Shared-fund shortcut */}
          <div
            onClick={() => actions.go("wallet")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: colors.surface,
              border: `1px solid ${colors.hairline}`,
              borderRadius: 18,
              padding: "14px 16px",
              marginBottom: 24,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <IconBadge background="rgba(54,208,122,0.14)" size={38}>
                <CardIcon />
              </IconBadge>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Fondo común</div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>Disponible</div>
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>{h.walletBalance}</div>
          </div>

          <SectionLabel>Tus grupos</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {h.groups.map((group) => (
              <GroupCard key={group.id} group={group} onOpen={() => actions.open(group.id)} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState onCreate={() => actions.go("create")} onSample={actions.loadSample} />
      )}
    </ScreenShell>
  );
}

/** Shown when the account has no groups yet. */
function EmptyState({ onCreate, onSample }: { onCreate: () => void; onSample: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 8px 8px" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: colors.surface,
          border: `1px solid ${colors.hairline}`,
          display: "grid",
          placeItems: "center",
          margin: "0 auto 18px",
        }}
      >
        <CardIcon size={28} color={colors.textMuted} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>Aún no tienes grupos</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 6, lineHeight: 1.5, maxWidth: 300, margin: "6px auto 0" }}>
        Crea tu primer grupo de suscripción compartida o carga datos de ejemplo para explorar la app.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        <Button onClick={onCreate}>Crear un grupo</Button>
        <Button variant="secondary" onClick={onSample} style={{ padding: 15, fontSize: 14.5, fontWeight: 700 }}>
          Cargar datos de ejemplo
        </Button>
      </div>
    </div>
  );
}
