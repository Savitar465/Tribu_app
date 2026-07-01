import { ChevronLeft } from "@/components/ui/Icons";
import { useApp } from "@/lib/store";
import { getBackTitle } from "@/lib/selectors";
import { colors } from "@/lib/theme";

/** Back button + screen title shown on non-tabbed screens. */
export function BackBar() {
  const { state, actions } = useApp();
  const title = getBackTitle(state);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 18px 12px", flexShrink: 0 }}>
      <div
        onClick={actions.back}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: colors.surface2,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <ChevronLeft />
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>{title}</div>
    </div>
  );
}
