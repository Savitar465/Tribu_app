interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Pill on/off switch (same look as the wallet's auto-pay toggle). */
export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: 50,
        height: 30,
        borderRadius: 999,
        background: value ? "#1c6b42" : "#262b35",
        display: "flex",
        alignItems: "center",
        justifyContent: value ? "flex-end" : "flex-start",
        padding: 3,
        cursor: "pointer",
        transition: "all 0.2s",
        flexShrink: 0,
      }}
    >
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff" }} />
    </div>
  );
}
