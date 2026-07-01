import { ACCENT, colors } from "@/lib/theme";
import type { Currency } from "@/lib/types";

interface CurrencyToggleProps {
  value: Currency;
  onChange: (currency: Currency) => void;
}

/** Segmented Bs / USD selector used on the Edit-cost and Deposit screens. */
export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  const option = (cur: Currency, label: string, activeBg: string) => {
    const active = value === cur;
    return (
      <div
        onClick={() => onChange(cur)}
        style={{
          flex: 1,
          textAlign: "center",
          padding: 12,
          borderRadius: 13,
          fontSize: 13.5,
          fontWeight: 800,
          cursor: "pointer",
          color: active ? "#0d0f14" : colors.textMuted,
          background: active ? activeBg : "transparent",
          border: `1px solid ${colors.border}`,
        }}
      >
        {label}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {option("BOB", "Bolivianos", ACCENT)}
      {option("USD", "Dólares (USD)", colors.positive)}
    </div>
  );
}
