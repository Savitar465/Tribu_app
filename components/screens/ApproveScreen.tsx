import { ScreenShell } from "@/components/screens/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageIcon } from "@/components/ui/Icons";
import { initials } from "@/components/ui/Avatar";
import { getApproval, getApprovals } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Approve: an admin reviews a member's uploaded receipt and accepts or rejects it. */
export function ApproveScreen() {
  const { state, actions } = useApp();
  const approval = getApproval(state);
  const queue = getApprovals(state).length;

  if (!approval) return null;

  return (
    <ScreenShell>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: colors.danger,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {initials(approval.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{approval.name}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted }}>{approval.groupName} · cuota junio</div>
        </div>
        {queue > 1 && (
          <span
            style={{
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: "rgba(123,166,255,0.18)",
              color: colors.info,
            }}
          >
            {queue - 1} más en cola
          </span>
        )}
      </div>

      {approval.proofUrl ? (
        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${colors.border}`,
            marginBottom: 16,
            background: "#0e1116",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={approval.proofUrl}
            alt={`Comprobante de ${approval.name}`}
            style={{ display: "block", width: "100%", maxHeight: 420, objectFit: "contain" }}
          />
        </div>
      ) : (
        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${colors.border}`,
            marginBottom: 16,
            background: "repeating-linear-gradient(45deg, #14171e, #14171e 12px, #181c24 12px, #181c24 24px)",
            height: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <ImageIcon />
          <div style={{ fontSize: 12, color: colors.textFaint, fontFamily: "monospace" }}>
            El miembro no adjuntó imagen
          </div>
        </div>
      )}

      <Card padding="16px 18px" radius={16} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600 }}>Monto declarado</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary }}>{approval.cuota}</div>
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="danger" onClick={() => actions.reviewMember(approval.id, false)} style={{ flex: 1, fontSize: 15 }}>
          Rechazar
        </Button>
        <Button variant="success" onClick={() => actions.reviewMember(approval.id, true)} style={{ flex: 1.4, fontSize: 15 }}>
          Aprobar pago
        </Button>
      </div>
    </ScreenShell>
  );
}
