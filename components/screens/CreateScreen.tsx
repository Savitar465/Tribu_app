import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { CREATE_SERVICES, SERVICE_META } from "@/lib/data";
import { getCreateView } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";
import type { ServiceId } from "@/lib/types";

/** Short display labels for the service picker tiles. */
const SHORT_LABEL: Record<ServiceId, string> = {
  spotify: "Spotify",
  netflix: "Netflix",
  youtube: "YouTube",
  disney: "Disney+",
  max: "Max",
  canva: "Canva",
  chatgpt: "ChatGPT",
  one: "Google One",
};

/** Create-group flow: pick a service, set plan details, preview the per-member cost. */
export function CreateScreen() {
  const { state, actions } = useApp();
  const view = getCreateView(state);

  return (
    <ScreenShell>
      <SectionLabel>Elige el servicio</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {CREATE_SERVICES.map((id) => (
          <ServiceTile key={id} id={id} active={state.selService === id} onSelect={() => actions.selectService(id)} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <TextField
          label="Nombre del plan"
          value={state.createName}
          onChange={(v) => actions.setCreate("name", v)}
          fontWeight={600}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <TextField
            label="Costo mensual (Bs)"
            value={state.createAmount}
            onChange={(v) => actions.setCreate("amount", v)}
            inputMode="decimal"
            fontWeight={700}
            style={{ flex: 1 }}
          />
          <TextField
            label="Miembros"
            value={state.createMembers}
            onChange={(v) => actions.setCreate("members", v)}
            inputMode="numeric"
            fontWeight={700}
            style={{ flex: 1 }}
          />
        </div>
        <TextField
          label="Día de cobro"
          value={state.createBillingDay}
          onChange={(v) => actions.setCreate("billingDay", v)}
          inputMode="numeric"
          fontWeight={600}
        />
      </div>

      {/* Live per-member preview */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "18px 0 22px",
          padding: "16px 18px",
          borderRadius: 16,
          background: "rgba(91,140,255,0.1)",
          border: "1px solid rgba(91,140,255,0.25)",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#aeb6c6" }}>Cada miembro paga</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>
          {view.perBs}
          <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>/mes</span>
        </div>
      </div>

      <Button onClick={actions.createGroup}>Crear grupo e invitar</Button>
    </ScreenShell>
  );
}

/** A single selectable service tile in the picker grid. */
function ServiceTile({ id, active, onSelect }: { id: ServiceId; active: boolean; onSelect: () => void }) {
  const meta = SERVICE_META[id];
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "12px 4px",
        borderRadius: 16,
        background: colors.surface,
        border: `1.5px solid ${active ? ACCENT : colors.hairline}`,
        cursor: "pointer",
      }}
    >
      <Avatar label={meta.mono} background={meta.color} size={40} radius={12} fontSize={15} />
      <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.textSecondary, textAlign: "center" }}>
        {SHORT_LABEL[id]}
      </div>
    </div>
  );
}
