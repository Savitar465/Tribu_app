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
import { CuotaDonut } from "@/components/screens/admin/CuotaDonut";
import { PayMethodsEditor } from "@/components/screens/admin/PayMethodsEditor";
import { fmtBs, sanitizeNumeric } from "@/lib/format";
import { checkCustomPct, checkCustomPrice, memberCuotaBs } from "@/lib/paylogic";
import { currentCycle, cycleFlagsStale, cycleLabel, getApprovals, getCurrentGroup, getGroupArrears, getGroups, getMembers } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { ACCENT, colors } from "@/lib/theme";
import type { Currency } from "@/lib/types";

/** Admin panel for the current group: collection, approvals, roster and cost editing. */
export function AdminScreen() {
  const { state, actions } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  /** Member whose custom price is being edited (null = editor closed). */
  const [priceFor, setPriceFor] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  /** Currency the draft custom price is defined in. */
  const [priceCur, setPriceCur] = useState<Currency>("BOB");
  /** Whether the custom price editor is in percentage mode. */
  const [priceMode, setPriceMode] = useState<"amount" | "pct">("amount");
  const [priceSaving, setPriceSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Draft for the variable-price confirmation (null = show the current amount). */
  const [varDraft, setVarDraft] = useState<string | null>(null);
  const [varSaving, setVarSaving] = useState(false);
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

  // Donut slices: each roster member's monthly cuota (in their roster color).
  // Percentages are relative to the group's monthly total, so editing one
  // member's price never shifts the others' shares. Unfilled slots take
  // whatever the roster leaves of the total (the remaining percentage).
  const freeSlots = Math.max(0, parseInt(group.members, 10) - members.length);
  const memberSumBs = members.reduce((a, m) => a + m.cuotaBs, 0);
  const remainingBs = Math.max(0, group.totalBs - memberSumBs);
  const cuotaSlices = [
    ...members.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.av,
      value: m.cuotaBs,
      label: m.customPct != null ? `${m.customPct}% · ${m.cuotaLabel}` : m.cuotaLabel,
    })),
    ...(freeSlots > 0 && remainingBs > 0
      ? [
          {
            id: "free-slots",
            name: freeSlots === 1 ? "1 lugar libre" : `${freeSlots} lugares libres`,
            color: colors.textFaint,
            value: remainingBs,
            label: fmtBs(remainingBs),
          },
        ]
      : []),
  ];

  // The admin's groups currently marked for joint payment (shown under the
  // toggle, each navigable for editing) and the one whose payment methods the
  // whole bundle uses (same fallback the member's pay screen applies).
  const jointRows = state.groups.filter((g) => g.owner_id === state.profile.id && g.joint_pay);
  const jointIds = new Set(jointRows.map((g) => g.id));
  const methodSource =
    jointRows.find((g) => g.joint_method) ??
    jointRows.find((g) => g.qr_image_url) ??
    jointRows[0];
  const jointViews = getGroups(state).filter((v) => jointIds.has(v.id));

  // Custom-price editor derivations: the draft converted to Bs at today's rate
  // and the same check the save action enforces (the cuota can only take what
  // the other members' cuotas leave of the monthly cost).
  const groupRow = state.groups.find((x) => x.id === group.id);
  const draftAmt = parseFloat(priceDraft);
  const roster = state.participants.filter((p) => p.group_id === group.id);

  // --- Percentage mode derivations ---
  // Evaluated with pct 0 while the field is empty/invalid so the editor always
  // shows what the other members consume and what's still assignable.
  const draftPctValid = Number.isFinite(draftAmt) && draftAmt > 0;
  const pctInfo =
    priceFor !== null && groupRow && priceMode === "pct"
      ? checkCustomPct({
          newPct: draftPctValid ? draftAmt : 0,
          editedId: priceFor,
          roster,
          groupCurrency: groupRow.currency,
          totalBs: group.totalBs,
          defaultPerBs: group.defaultPerBs,
          rate: state.profile.exchange_rate,
          round: groupRow.round_cuota,
        })
      : null;

  // --- Fixed-amount mode derivations ---
  const draftBs =
    priceFor !== null && groupRow && priceMode === "amount" && Number.isFinite(draftAmt) && draftAmt > 0
      ? memberCuotaBs(draftAmt, priceCur, state.profile.exchange_rate, groupRow.round_cuota)
      : null;
  const priceCheck =
    priceFor !== null && groupRow && draftBs != null
      ? checkCustomPrice({
          newPerBs: draftBs,
          editedId: priceFor,
          roster,
          groupCurrency: groupRow.currency,
          totalBs: group.totalBs,
          defaultPerBs: group.defaultPerBs,
          rate: state.profile.exchange_rate,
          round: groupRow.round_cuota,
        })
      : null;

  // Variable-price gate: the cycle came due but this month's price hasn't been
  // confirmed yet, so the charge is on hold until the admin confirms it here.
  const pricePending =
    !!groupRow?.variable_price &&
    cycleFlagsStale(groupRow) &&
    groupRow.price_confirmed_cycle !== currentCycle();
  const varValue = varDraft ?? String(groupRow?.amount ?? "");

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
        {/* Variable price: this month's charge waits for the confirmed price */}
        {pricePending && groupRow && (
          <div
            style={{
              background: "rgba(245,181,61,0.1)",
              border: "1px solid rgba(245,181,61,0.35)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>
              Confirma el precio de {cycleLabel(currentCycle())}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5, margin: "4px 0 12px" }}>
              Este grupo tiene precio variable: el cobro del mes no se genera hasta que
              actualices el precio. Revisa el monto y confírmalo para cobrar a los miembros.
            </div>
            <TextField
              label={`Precio de este mes (${groupRow.currency === "USD" ? "USD" : "Bs"})`}
              value={varValue}
              onChange={(v) => setVarDraft(sanitizeNumeric(v))}
              inputMode="decimal"
              fontWeight={800}
              fontSize={20}
            />
            <Button
              variant="success"
              disabled={varSaving || !(parseFloat(varValue) > 0)}
              onClick={async () => {
                setVarSaving(true);
                const ok = await actions.confirmCyclePrice(varValue);
                setVarSaving(false);
                if (ok) setVarDraft(null);
              }}
              style={{ marginTop: 12, padding: 13, fontSize: 14 }}
            >
              {varSaving ? "Generando cobro…" : "Confirmar precio y generar cobro"}
            </Button>
          </div>
        )}

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

        {/* How the monthly total splits across members (honors custom prices) */}
        <CuotaDonut slices={cuotaSlices} totalBs={group.totalBs} />

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
              priceLabel={m.customPct != null ? `${m.customPct}%` : m.cuotaLabel}
              customPrice={m.customAmount != null || m.customPct != null}
              onEditPrice={() => {
                if (m.customPct != null) {
                  setPriceMode("pct");
                  setPriceDraft(String(m.customPct));
                } else {
                  setPriceMode("amount");
                  setPriceDraft(m.customAmount != null ? String(m.customAmount) : "");
                }
                setPriceCur(m.customCurrency ?? (group.isUsd ? "USD" : "BOB"));
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

        {/* Whether this group joins the admin's joint-payment bundle */}
        <div
          onClick={() => actions.setJointPay(!groupRow?.joint_pay)}
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
              Pago conjunto con mis otros grupos
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 1 }}>
              {groupRow?.joint_pay
                ? "Los miembros pueden pagar este grupo junto con tus otros grupos marcados · un solo QR y comprobante."
                : "Este grupo se paga por separado · actívalo para incluirlo en el pago conjunto."}
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 24,
              borderRadius: 999,
              background: groupRow?.joint_pay ? ACCENT : colors.surface3,
              position: "relative",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: groupRow?.joint_pay ? 19 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
              }}
            />
          </div>
        </div>

        {/* The joint-payment set: every marked group, navigable for editing.
            One of them is the bundle's single collection method. */}
        {jointViews.length > 0 && (
          <>
            <SectionLabel>Grupos en pago conjunto · {jointViews.length}</SectionLabel>
            <Card padding="4px 16px" style={{ marginBottom: 8 }}>
              {jointViews.map((v, i) => {
                const isMethod = v.id === methodSource?.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => actions.open(v.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "12px 0",
                      cursor: "pointer",
                      borderBottom: i === jointViews.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                    }}
                  >
                    <Avatar label={v.mono} background={v.color} size={36} radius={11} fontSize={13} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                        {v.name}
                        {v.id === group.id && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginLeft: 6 }}>
                            · este grupo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                        {v.monthly}/mes · cuota {v.cuota}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isMethod) actions.setJointMethod(v.id);
                      }}
                      aria-label={`Usar el método de cobro de ${v.name} para el conjunto`}
                      style={{
                        border: `1px solid ${isMethod ? "rgba(91,140,255,0.5)" : colors.hairline}`,
                        background: isMethod ? "rgba(91,140,255,0.14)" : "transparent",
                        color: isMethod ? "#7ba6ff" : colors.textMuted,
                        borderRadius: 999,
                        padding: "3px 9px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                        fontFamily: "inherit",
                      }}
                    >
                      {isMethod ? "Método de cobro ✓" : "Usar su método"}
                    </button>
                    <ChevronRight />
                  </div>
                );
              })}
            </Card>
            <div style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 18 }}>
              Todo el conjunto se cobra con un único método: el QR, PayPal y cuenta del grupo
              marcado como &ldquo;Método de cobro&rdquo;. Toca un grupo para ir a editarlo.
            </div>
          </>
        )}

        {/* Inline monthly-cost editor */}
        <CostEditor group={group} />

        {/* How members pay their cuota: QR, PayPal, transferencia */}
        <PayMethodsEditor group={group} />

        <Button variant="secondary" onClick={() => actions.go("history")} style={{ padding: 14, fontSize: 13.5, fontWeight: 700 }}>
          Ver historial de pagos
        </Button>

        <Button
          variant="danger"
          onClick={() => setConfirmDelete(true)}
          style={{ padding: 14, fontSize: 13.5, fontWeight: 700, marginTop: 12 }}
        >
          Eliminar grupo
        </Button>
      </div>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Delete-group confirmation */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="¿Eliminar este grupo?">
        <div style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
          Se eliminará <strong style={{ color: colors.textPrimary }}>{group.name}</strong> junto con
          sus miembros, cuotas pendientes e historial de pagos. Esta acción no se puede deshacer.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            variant="secondary"
            disabled={deleting}
            onClick={() => setConfirmDelete(false)}
            style={{ flex: 1, padding: 12, fontSize: 13.5 }}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              const ok = await actions.deleteGroup();
              setDeleting(false);
              if (!ok) setConfirmDelete(false);
            }}
            style={{ flex: 1.4, padding: 12, fontSize: 13.5 }}
          >
            {deleting ? "Eliminando…" : "Eliminar grupo"}
          </Button>
        </div>
      </Modal>

      {/* Per-member custom price editor (fixed amount or percentage) */}
      <Modal
        open={priceFor !== null}
        onClose={() => setPriceFor(null)}
        title={`Cuota de ${members.find((m) => m.id === priceFor)?.name ?? "miembro"}`}
      >
        <div style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
          Deja el campo vacío para usar la cuota normal del grupo ({group.cuota}).
          {priceMode === "pct"
            ? " El porcentaje se recalcula cada mes al tipo de cambio vigente; los meses ya cobrados mantienen su precio."
            : " Los precios en USD se convierten al tipo de cambio de cada cobro; los meses ya pagados mantienen su precio."}
        </div>

        {/* Mode toggle: fixed amount vs percentage */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["amount", "pct"] as const).map((mode) => (
            <div
              key={mode}
              onClick={() => {
                setPriceMode(mode);
                setPriceDraft("");
              }}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "9px 0",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: priceMode === mode ? "rgba(91,140,255,0.16)" : colors.surface2,
                border: `1.5px solid ${priceMode === mode ? "#5b8cff" : colors.border}`,
                color: priceMode === mode ? colors.textPrimary : colors.textSecondary,
              }}
            >
              {mode === "amount" ? "Monto fijo" : "Porcentaje %"}
            </div>
          ))}
        </div>

        {/* Currency selector (only in fixed-amount mode) */}
        {priceMode === "amount" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["BOB", "USD"] as const).map((cur) => (
              <div
                key={cur}
                onClick={() => setPriceCur(cur)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "9px 0",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: priceCur === cur ? "rgba(91,140,255,0.16)" : colors.surface2,
                  border: `1.5px solid ${priceCur === cur ? "#5b8cff" : colors.border}`,
                  color: priceCur === cur ? colors.textPrimary : colors.textSecondary,
                }}
              >
                {cur === "BOB" ? "Bolivianos (Bs)" : "Dólares (USD)"}
              </div>
            ))}
          </div>
        )}

        <TextField
          label={priceMode === "pct" ? "Porcentaje del total (%)" : `Cuota mensual (${priceCur === "USD" ? "USD" : "Bs"})`}
          value={priceDraft}
          onChange={(v) => setPriceDraft(sanitizeNumeric(v))}
          inputMode="decimal"
          fontWeight={700}
        />

        {/* Live preview: percentage mode. The "others / remaining" line counts
            every pricing mode (percentages, fixed amounts, default splits). */}
        {priceMode === "pct" && pctInfo && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              marginTop: 10,
              color: pctInfo.ok ? colors.textMuted : colors.danger,
            }}
          >
            {draftPctValid && (
              <>
                Cuota resultante: <strong style={{ color: pctInfo.ok ? colors.textPrimary : colors.danger }}>{fmtBs(pctInfo.resultBs)}</strong>
                {groupRow?.round_cuota ? " (redondeada)" : ""}
                <br />
              </>
            )}
            Usado por los demás miembros: <strong>{pctInfo.othersPct.toFixed(1)}%</strong> · disponible: <strong style={{ color: pctInfo.ok ? colors.positive : colors.danger }}>{pctInfo.remainingPct.toFixed(1)}% ({fmtBs(pctInfo.remainingBs)})</strong>
            {pctInfo.ok ? "" : " — supera el porcentaje disponible"}
          </div>
        )}

        {/* Live preview: fixed-amount mode */}
        {priceMode === "amount" && draftBs != null && priceCheck && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              marginTop: 10,
              color: priceCheck.ok ? colors.textMuted : colors.danger,
            }}
          >
            Cuota resultante: <strong style={{ color: priceCheck.ok ? colors.textPrimary : colors.danger }}>{fmtBs(draftBs)}</strong>
            {groupRow?.round_cuota ? " (redondeada)" : ""} · disponible del mes: {fmtBs(priceCheck.remaining)}
            {priceCheck.ok ? "" : " — supera el monto disponible"}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {(members.find((m) => m.id === priceFor)?.customAmount != null ||
            members.find((m) => m.id === priceFor)?.customPct != null) && (
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
              const ok = await actions.setMemberPrice(priceFor, priceDraft, priceCur, priceMode === "pct");
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
