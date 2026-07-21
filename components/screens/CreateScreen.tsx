import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CurrencyToggle } from "@/components/ui/CurrencyToggle";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { CREATE_SERVICES, MEMBER_COLORS, SERVICE_META } from "@/lib/data";
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
  others: "Otros",
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
          label={state.selService === "others" ? "Nombre del grupo" : "Nombre del plan"}
          value={state.createName}
          onChange={(v) => actions.setCreate("name", v)}
          fontWeight={600}
        />

        {state.selService === "others" && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textMuted, marginBottom: 8 }}>
              Color del grupo
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {MEMBER_COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => actions.setCreateColor(c)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: c,
                    cursor: "pointer",
                    border: state.createColor === c ? `2.5px solid ${colors.textPrimary}` : "2.5px solid transparent",
                    boxShadow: state.createColor === c ? `0 0 0 2px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textMuted, marginBottom: 7 }}>Moneda del cobro</div>
          <CurrencyToggle value={state.createCur} onChange={actions.setCreateCur} />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <TextField
            label={`Costo mensual (${state.createCur === "USD" ? "USD" : "Bs"})`}
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

        {/* Whether the admin occupies one of the plan's slots */}
        <div
          onClick={() => actions.setCreateAdminIn(!state.createAdminIn)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "13px 15px",
            borderRadius: 14,
            background: colors.surface,
            border: `1px solid ${colors.hairline}`,
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
              Ocupo un lugar en el grupo
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
              Desactívalo si solo administras el plan sin usar un cupo.
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 24,
              borderRadius: 999,
              background: state.createAdminIn ? ACCENT : colors.surface3,
              position: "relative",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: state.createAdminIn ? 19 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
              }}
            />
          </div>
        </div>

        {/* Variable monthly price (e.g. luz, agua): confirm before each billing */}
        <div
          onClick={() => actions.setCreateVarPrice(!state.createVarPrice)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "13px 15px",
            borderRadius: 14,
            background: colors.surface,
            border: `1px solid ${colors.hairline}`,
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
              Precio variable cada mes
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
              Ideal para luz, agua, etc. Cada mes confirmas el precio antes de cobrar.
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 24,
              borderRadius: 999,
              background: state.createVarPrice ? ACCENT : colors.surface3,
              position: "relative",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: state.createVarPrice ? 19 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
              }}
            />
          </div>
        </div>
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

      {view.isUsd && state.officialRate !== null && (
        <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", marginBottom: 18, marginTop: -8 }}>
          Convertido al oficial BCB · 1 USD = {state.officialRate} Bs
        </div>
      )}

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
