import { PlusIcon } from "@/components/ui/Icons";
import { useApp } from "@/lib/store";
import { GRADIENT } from "@/lib/theme";

/** Floating action button to create a new group (shown on Home & Dashboard). */
export function Fab() {
  const { actions } = useApp();
  return (
    <div
      onClick={() => actions.go("create")}
      style={{
        position: "absolute",
        bottom: "calc(90px + env(safe-area-inset-bottom))",
        right: 22,
        width: 56,
        height: 56,
        borderRadius: 18,
        background: GRADIENT,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        zIndex: 40,
        boxShadow: "0 12px 30px -8px rgba(91,140,255,0.7)",
      }}
    >
      <PlusIcon />
    </div>
  );
}
