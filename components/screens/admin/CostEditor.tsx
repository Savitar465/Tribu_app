import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyToggle } from "@/components/ui/CurrencyToggle";
import { PencilIcon } from "@/components/ui/Icons";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { getEditErrors, getEditView } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { GRADIENT, colors } from "@/lib/theme";
import type { GroupView } from "@/lib/types";

const fieldLabel = { fontSize: 12.5, fontWeight: 700, color: colors.textMuted } as const;

/** Inline error line under an invalid field. */
function FieldError({ message }: { message: string }) {
  if (!message) return null;
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.danger, marginTop: 6 }}>{message}</div>;
}

/**
 * Collapsible monthly-cost editor on the admin screen: currency, total,
 * member count and billing day, with per-field validation and a live
 * per-member preview.
 */
export function CostEditor({ group }: { group: GroupView }) {
  const { state, actions } = useApp();
  const [open, setOpen] = useState(false);
  const e = getEditView(state);
  const errors = getEditErrors(state);

  const toggle = () => {
    if (!open) actions.beginEdit(group.id); // seed drafts from the group row
    setOpen(!open);
  };

  const save = async () => {
    if (await actions.saveEdit()) setOpen(false);
  };

  return (
    <Card padding={0} radius={18} style={{ marginBottom: 10, overflow: "hidden" }}>
      {/* Header row (toggles the editor) */}
      <div
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 16px",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <PencilIcon />
          <span style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>Costo mensual y fecha de cobro</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: colors.textSecondary }}>
          {group.monthly} {open ? "⌄" : "›"}
        </span>
      </div>

      {open && (
        <div style={{ padding: "2px 16px 16px", borderTop: `1px solid ${colors.hairlineSoft}` }}>
          <div style={{ ...fieldLabel, margin: "14px 0 7px" }}>Moneda del cobro</div>
          <CurrencyToggle value={state.editCur} onChange={actions.setEditCur} />

          <div style={{ ...fieldLabel, margin: "16px 0 7px" }}>Costo total mensual</div>
          <TextField
            value={state.editAmount}
            onChange={actions.setEditAmount}
            inputMode="decimal"
            fontWeight={800}
            fontSize={20}
            inputStyle={errors.amount ? { borderColor: colors.danger } : undefined}
          />
          <FieldError message={errors.amount} />

          <div style={{ ...fieldLabel, margin: "16px 0 7px" }}>Cantidad de miembros</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: colors.surface,
              border: `1px solid ${errors.members ? colors.danger : colors.border}`,
              borderRadius: 14,
              padding: "8px 12px",
            }}
          >
            <Stepper label="−" onClick={() => actions.bumpMembers(-1)} />
            <div style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary }}>{state.editMembers}</div>
            <Stepper label="+" onClick={() => actions.bumpMembers(1)} />
          </div>
          <FieldError message={errors.members} />

          <div style={{ ...fieldLabel, margin: "16px 0 7px" }}>Día de cobro cada mes</div>
          <TextField
            value={state.editBillingDay}
            onChange={actions.setEditBillingDay}
            inputMode="numeric"
            fontWeight={700}
            fontSize={17}
            inputStyle={errors.billingDay ? { borderColor: colors.danger } : undefined}
          />
          {errors.billingDay ? (
            <FieldError message={errors.billingDay} />
          ) : (
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 6 }}>
              Se cobra el día {state.editBillingDay} de cada mes.
            </div>
          )}

          {/* Round each cuota up to a whole Bs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 16,
              padding: "13px 14px",
              borderRadius: 14,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>Redondear cuota</div>
              <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
                Cada cuota sube al Bs entero siguiente
              </div>
            </div>
            <Toggle value={state.editRound} onChange={actions.setEditRound} />
          </div>

          {/* Variable monthly price (e.g. luz, agua): confirm before billing */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 12,
              padding: "13px 14px",
              borderRadius: 14,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>Precio variable cada mes</div>
              <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
                Ideal para luz, agua, etc. El día de cobro se te pedirá el precio del mes antes de cobrar.
              </div>
            </div>
            <Toggle value={state.editVarPrice} onChange={actions.setEditVarPrice} />
          </div>

          {/* FX shortcut (relevant for USD plans) */}
          {state.editCur === "USD" && (
            <div
              onClick={actions.openFx}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 14,
                background: "rgba(54,208,122,0.08)",
                border: "1px solid rgba(54,208,122,0.2)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 13, color: "#aeb6c6", fontWeight: 600 }}>Tipo de cambio</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: colors.positive }}>{e.rateLabel} ›</div>
            </div>
          )}

          {/* Live summary */}
          <div style={{ marginTop: 16, borderRadius: 16, padding: 16, background: GRADIENT, color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>Cada miembro paga</span>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{e.perBs}</span>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.2)", margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.9 }}>
              <span>Total del plan</span>
              <span style={{ fontWeight: 700 }}>{e.totalBs}/mes</span>
            </div>
            {e.isUsd && <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 8 }}>{e.usdLine}</div>}
            {e.roundNote && <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 8 }}>{e.roundNote}</div>}
          </div>

          <Button variant="success" onClick={save} disabled={!errors.valid} style={{ marginTop: 16, padding: 14, fontSize: 14.5 }}>
            Guardar cambios
          </Button>
        </div>
      )}
    </Card>
  );
}

/** A square +/− stepper button. */
function Stepper({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: 11,
        background: colors.surface3,
        display: "grid",
        placeItems: "center",
        color: colors.textPrimary,
        fontSize: 21,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}
