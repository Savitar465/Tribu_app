import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChevronRight, FileIcon } from "@/components/ui/Icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { MemberRow } from "@/components/ui/MemberRow";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { ScreenShell } from "@/components/screens/ScreenShell";
import { AddMemberModal } from "@/components/screens/admin/AddMemberModal";
import { CostEditor } from "@/components/screens/admin/CostEditor";
import { PayMethodsEditor } from "@/components/screens/admin/PayMethodsEditor";
import { sanitizeNumeric } from "@/lib/format";
import { getApprovals, getCurrentGroup, getGroupArrears, getMembers } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";

/** Admin panel for the current group: collection, approvals, roster and cost editing. */
export function AdminScreen() {
  const { state, actions } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  /** Member whose custom price is being edited (null = editor closed). */
  const [priceFor, setPriceFor] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);
  const group = getCurrentGroup(state);
  const members = getMembers(state, ACCENT);
  const approvals = getApprovals(state);
  const arrears = getGroupArrears(state);

  if (!group?.owned) return null;
  const admin = group.admin;
  // The admin's own roster row (absent when they manage without a slot).
  const selfRow = state.participants.find(
    (p) => p.group_id === group.id && p.user_id === state.profile.id,
  );

  return (
    <ScreenShell padding="0 0 28px">
      {/* Header band */}
      <div style={{ padding: "6px 20px 22px", textAlign: "center" }}>
        <Avatar
          label={group.mono}
          background={group.color}
          size={64}
          radius={20}
          fontSize={24}
          style={{ margin: "0 auto 12px" }}
        />
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary }}>{group.name}</div>
        <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 2 }}>
          {group.plan} · {group.monthly}/mes · {group.members} miembros
        </div>
      </div>

      <div style={{ padding: "0 18px" }}>
        {/* Collection */}
        <Card padding={20} radius={22} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>Cobrado</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: colors.positive, letterSpacing: -0.5 }}>
                {admin?.collected}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>Pendiente</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: colors.warning, letterSpacing: -0.5 }}>
                {admin?.pending}
              </div>
            </div>
          </div>
          <ProgressBar value={admin?.pct ?? "0%"} />
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>Ciclo Junio 2026 · cobra el 05/07</div>
        </Card>

        {/* Approval alert */}
        {approvals.length > 0 && (
          <div
            onClick={() => actions.go("approve")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(123,166,255,0.1)",
              border: "1px solid rgba(123,166,255,0.3)",
              borderRadius: 16,
              padding: 14,
              marginBottom: 22,
              cursor: "pointer",
            }}
          >
            <IconBadge background="rgba(123,166,255,0.18)" size={38}>
              <FileIcon />
            </IconBadge>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {approvals.length === 1 ? "1 comprobante por revisar" : `${approvals.length} comprobantes por revisar`}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                {approvals[0].name}
                {approvals.length > 1 ? ` y ${approvals.length - 1} más subieron` : " subió"} su pago de {group.cuota}
              </div>
            </div>
            <ChevronRight color={colors.info} />
          </div>
        )}

        {/* Overdue management → dedicated page (per month, filters, totals) */}
        <div
          onClick={() => actions.go("arrears")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(245,181,61,0.08)",
            border: "1px solid rgba(245,181,61,0.3)",
            borderRadius: 16,
            padding: 14,
            marginBottom: 14,
            cursor: "pointer",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Cuotas por cobrar</div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              {arrears.count === 0
                ? "Todo al día · ver quién pagó mes a mes"
                : `${arrears.count} ${arrears.count === 1 ? "cuota pendiente" : "cuotas pendientes"} · ${arrears.totalLabel}`}
            </div>
          </div>
          <ChevronRight color={colors.warning} />
        </div>

        {/* Roster header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel style={{ marginBottom: 0 }}>Miembros · {group.members}</SectionLabel>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{group.cuota} c/u</div>
        </div>
        <Card padding="6px 14px" style={{ marginBottom: 12 }}>
          {members.map((m, i) => (
            <MemberRow
              key={m.id}
              {...m}
              last={i === members.length - 1}
              onTogglePaid={() => actions.setMemberPaid(m.id, !m.paid)}
              onRename={m.isSelf ? undefined : (name) => actions.renameMember(m.id, name)}
              onMoveUp={i > 0 ? () => actions.moveMember(m.id, -1) : undefined}
              onMoveDown={i < members.length - 1 ? () => actions.moveMember(m.id, 1) : undefined}
              onRemove={m.isSelf ? undefined : () => actions.removeMember(m.id)}
              priceLabel={m.cuotaLabel}
              customPrice={m.customAmount != null}
              onEditPrice={() => {
                setPriceDraft(m.customAmount != null ? String(m.customAmount) : "");
                setPriceFor(m.id);
              }}
            />
          ))}
        </Card>

        {/* Add member (single field in a modal: searches users, invites by email) */}
        <Button onClick={() => setAddOpen(true)} style={{ padding: 14, fontSize: 14.5, marginBottom: 12 }}>
          + Agregar miembro
        </Button>

        {/* Whether the admin occupies one of the plan's slots */}
        <div
          onClick={() => actions.setAdminParticipation(!selfRow)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "13px 15px",
            borderRadius: 14,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            cursor: "pointer",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
              Ocupo un lugar en el grupo
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
              {selfRow
                ? "Tienes una ficha en la lista · desactívalo para solo administrar."
                : "Solo administras el plan · seguirás recibiendo notificaciones y aprobaciones."}
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 24,
              borderRadius: 999,
              background: selfRow ? ACCENT : colors.surface3,
              position: "relative",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: selfRow ? 19 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
              }}
            />
          </div>
        </div>

        {/* Inline monthly-cost editor */}
        <CostEditor group={group} />

        {/* How members pay their cuota: QR, PayPal, transferencia */}
        <PayMethodsEditor group={group} />

        <Button variant="secondary" onClick={() => actions.go("history")} style={{ padding: 14, fontSize: 13.5, fontWeight: 700 }}>
          Ver historial de pagos
        </Button>
      </div>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Per-member custom price editor */}
      <Modal
        open={priceFor !== null}
        onClose={() => setPriceFor(null)}
        title={`Cuota de ${members.find((m) => m.id === priceFor)?.name ?? "miembro"}`}
      >
        <div style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
          Deja el campo vacío para usar la cuota normal del grupo ({group.cuota}). El precio se
          define en {group.isUsd ? "USD y se convierte al tipo de cambio de cada cobro" : "Bs"};
          los meses ya cobrados mantienen su precio.
        </div>
        <TextField
          label={`Cuota mensual (${group.isUsd ? "USD" : "Bs"})`}
          value={priceDraft}
          onChange={(v) => setPriceDraft(sanitizeNumeric(v))}
          inputMode="decimal"
          fontWeight={700}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {members.find((m) => m.id === priceFor)?.customAmount != null && (
            <Button
              variant="secondary"
              disabled={priceSaving}
              onClick={async () => {
                if (!priceFor) return;
                setPriceSaving(true);
                const ok = await actions.setMemberPrice(priceFor, "");
                setPriceSaving(false);
                if (ok) setPriceFor(null);
              }}
              style={{ flex: 1, padding: 12, fontSize: 13.5 }}
            >
              Restablecer
            </Button>
          )}
          <Button
            disabled={priceSaving}
            onClick={async () => {
              if (!priceFor) return;
              setPriceSaving(true);
              const ok = await actions.setMemberPrice(priceFor, priceDraft);
              setPriceSaving(false);
              if (ok) setPriceFor(null);
            }}
            style={{ flex: 1.4, padding: 12, fontSize: 13.5 }}
          >
            {priceSaving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </Modal>
    </ScreenShell>
  );
}
