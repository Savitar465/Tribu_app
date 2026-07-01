import type { CSSProperties } from "react";
import { colors } from "@/lib/theme";

interface TextFieldProps {
  label?: string;
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value (for static prototype inputs). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  inputMode?: "text" | "decimal" | "numeric";
  fontWeight?: number;
  fontSize?: number;
  inputStyle?: CSSProperties;
  style?: CSSProperties;
}

/** A labeled text input matching the app's field styling. */
export function TextField({
  label,
  value,
  defaultValue,
  onChange,
  inputMode = "text",
  fontWeight = 600,
  fontSize = 15,
  inputStyle,
  style,
}: TextFieldProps) {
  return (
    <div style={style}>
      {label && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textMuted, marginBottom: 7 }}>
          {label}
        </div>
      )}
      <input
        value={value}
        defaultValue={defaultValue}
        inputMode={inputMode}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange && value !== undefined}
        style={{
          width: "100%",
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          padding: 14,
          color: colors.textPrimary,
          fontSize,
          fontFamily: "inherit",
          fontWeight,
          outline: "none",
          ...inputStyle,
        }}
      />
    </div>
  );
}
