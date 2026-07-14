import { colors } from "@/lib/theme";
import { StatusBadge } from "./StatusBadge";
import { initials } from "./Avatar";

interface MemberRowProps {
  name: string;
  av: string;
  stLabel: string;
  stColor: string;
  stBg: string;
  /** Optional secondary line under the name (e.g. email). */
  sub?: string;
  /** Hide the divider on the last row. */
  last?: boolean;
  /** When provided, the status badge becomes a button that toggles paid/pending. */
  onTogglePaid?: () => void;
  /** When provided, the name becomes an inline input committed on blur/Enter. */
  onRename?: (name: string) => void;
  /** Reorder controls; a handler being absent disables that direction. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** When provided, renders a remove control on the far right. */
  onRemove?: () => void;
  /** When provided, renders a tappable cuota chip that opens the price editor. */
  onEditPrice?: () => void;
  /** Label for the cuota chip (e.g. "12 Bs"). */
  priceLabel?: string;
  /** Highlights the cuota chip when the member has a custom price. */
  customPrice?: boolean;
}

const iconBtn = {
  width: 24,
  height: 24,
  borderRadius: 7,
  border: "none",
  background: "transparent",
  color: colors.textMuted,
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
} as const;

/** A single member row (round avatar, name, paid/pending badge) with optional admin controls. */
export function MemberRow({
  name,
  av,
  stLabel,
  stColor,
  stBg,
  sub,
  last,
  onTogglePaid,
  onRename,
  onMoveUp,
  onMoveDown,
  onRemove,
  onEditPrice,
  priceLabel,
  customPrice,
}: MemberRowProps) {
  const commit = (value: string) => {
    const clean = value.trim();
    if (onRename && clean && clean !== name) onRename(clean);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 0",
        borderBottom: last ? "none" : `1px solid ${colors.hairlineSoft}`,
      }}
    >
      {(onMoveUp || onMoveDown) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Subir"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            style={{ ...iconBtn, height: 16, opacity: onMoveUp ? 1 : 0.3, cursor: onMoveUp ? "pointer" : "default" }}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Bajar"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            style={{ ...iconBtn, height: 16, opacity: onMoveDown ? 1 : 0.3, cursor: onMoveDown ? "pointer" : "default" }}
          >
            ▼
          </button>
        </div>
      )}

      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: av,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {initials(name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {onRename ? (
          <input
            defaultValue={name}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            style={{
              width: "100%",
              minWidth: 0,
              background: "transparent",
              border: "none",
              borderBottom: `1px dashed ${colors.hairline}`,
              color: colors.textPrimary,
              fontSize: 14.5,
              fontWeight: 600,
              fontFamily: "inherit",
              padding: "2px 0",
              outline: "none",
            }}
          />
        ) : (
          <div style={{ fontSize: 14.5, fontWeight: 600, color: colors.textPrimary }}>{name}</div>
        )}
        {sub && (
          <div
            style={{
              fontSize: 11.5,
              color: colors.textMuted,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub}
          </div>
        )}
      </div>

      {onEditPrice && (
        <button
          type="button"
          onClick={onEditPrice}
          title="Cuota personalizada"
          aria-label={`Editar cuota de ${name}`}
          style={{
            border: `1px solid ${customPrice ? "rgba(91,140,255,0.5)" : colors.hairline}`,
            background: customPrice ? "rgba(91,140,255,0.14)" : "transparent",
            color: customPrice ? "#7ba6ff" : colors.textMuted,
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "inherit",
          }}
        >
          {priceLabel}
        </button>
      )}

      {onTogglePaid ? (
        <button type="button" onClick={onTogglePaid} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
          <StatusBadge label={stLabel} bg={stBg} color={stColor} />
        </button>
      ) : (
        stLabel && <StatusBadge label={stLabel} bg={stBg} color={stColor} />
      )}

      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Eliminar a ${name}`} style={{ ...iconBtn, fontSize: 18 }}>
          ×
        </button>
      )}
    </div>
  );
}
