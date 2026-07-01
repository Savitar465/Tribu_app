"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { GRADIENT, colors } from "@/lib/theme";

type Mode = "login" | "signup";

/** Email/password login & signup. The session it creates is picked up by AppRoot. */
export function AuthScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Success → AppRoot's auth listener swaps in the app.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Revisa tu correo para confirmar la cuenta y luego inicia sesión.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo continuar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        padding: "24px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: GRADIENT,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 26,
              marginBottom: 14,
            }}
          >
            T
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.5 }}>Tribu</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 4, textAlign: "center" }}>
            {mode === "login" ? "Inicia sesión para gestionar tus grupos" : "Crea tu cuenta para empezar"}
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <Field label="Nombre">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
            </Field>
          )}
          <Field label="Correo">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
              style={inputStyle}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={inputStyle}
            />
          </Field>

          {error && <div style={{ fontSize: 12.5, color: colors.danger, fontWeight: 600 }}>{error}</div>}
          {info && <div style={{ fontSize: 12.5, color: colors.positive, fontWeight: 600 }}>{info}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 6,
              textAlign: "center",
              padding: 15,
              borderRadius: 14,
              border: "none",
              background: GRADIENT,
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
              boxShadow: "0 12px 28px -10px rgba(91,140,255,0.6)",
            }}
          >
            {busy ? "Un momento…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13.5, color: colors.textMuted }}>
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <span
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
            }}
            style={{ color: colors.info, fontWeight: 700, cursor: "pointer" }}
          >
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </span>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  padding: 14,
  color: colors.textPrimary,
  fontSize: 15,
  fontFamily: "inherit",
  fontWeight: 600,
  outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textMuted, marginBottom: 7 }}>{label}</div>
      {children}
    </label>
  );
}
