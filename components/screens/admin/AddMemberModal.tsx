import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { initials } from "@/components/ui/Avatar";
import type { ProfileMatch } from "@/lib/db/api";
import { useApp } from "@/lib/store";
import { MEMBER_COLORS } from "@/lib/data";
import { colors } from "@/lib/theme";

/**
 * Single-field add-member dialog: searches registered users by name or email
 * as you type; with no match, an email invites that address and a plain name
 * adds an offline member.
 */
export function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = useApp();
  // Last completed search; `results`/`searching` derive from comparing its
  // query against the live draft, so the effect never sets state synchronously.
  const [found, setFound] = useState<{ q: string; items: ProfileMatch[] }>({ q: "", items: [] });
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  const draft = state.memberDraft;
  const query = draft.trim();
  const isEmail = query.includes("@");
  const results = query.length >= 2 && found.q === query ? found.items : [];
  const searching = query.length >= 2 && found.q !== query;

  // Debounced user search while typing.
  useEffect(() => {
    if (!open || query.length < 2) return;
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      const items = await actions.searchMembers(query);
      if (requestId.current === id) setFound({ q: query, items });
    }, 300);
    return () => clearTimeout(t);
  }, [open, query, actions]);

  const close = () => {
    actions.setMemberDraft("");
    setFound({ q: "", items: [] });
    onClose();
  };

  const run = async (task: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    const ok = await task();
    setBusy(false);
    if (ok) close();
  };

  return (
    <Modal open={open} onClose={close} title="Agregar miembro">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query) void run(actions.addMember);
        }}
      >
        <TextField
          label="Nombre o correo"
          value={draft}
          onChange={actions.setMemberDraft}
          style={{ marginBottom: 12 }}
        />

        {/* Registered users matching the query */}
        {results.length > 0 && (
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 15,
              padding: "2px 12px",
              marginBottom: 12,
            }}
          >
            {results.map((r, i) => {
              const name = r.full_name?.trim() || r.email?.split("@")[0] || "Usuario";
              return (
                <div
                  key={r.id}
                  onClick={() => run(() => actions.addMemberUser(r))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: i === results.length - 1 ? "none" : `1px solid ${colors.hairlineSoft}`,
                    cursor: "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: MEMBER_COLORS[i % MEMBER_COLORS.length],
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11.5,
                      flexShrink: 0,
                    }}
                  >
                    {r.mono || initials(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{name}</div>
                    {r.email && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: colors.textMuted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.email}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.info, flexShrink: 0 }}>Agregar</span>
                </div>
              );
            })}
          </div>
        )}

        {searching && (
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>Buscando usuarios…</div>
        )}
        {!searching && query.length >= 2 && results.length === 0 && (
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
            {isEmail
              ? "Ese correo no está registrado · se agregará como invitación"
              : "Sin usuarios registrados con ese nombre"}
          </div>
        )}

        {query && (
          <Button
            onClick={() => void run(actions.addMember)}
            disabled={busy}
            style={{ padding: 14, fontSize: 14.5, marginBottom: 8 }}
          >
            {isEmail ? "Invitar por correo" : `Agregar "${query}" sin cuenta`}
          </Button>
        )}
        <Button variant="ghost" onClick={close} style={{ padding: 13, fontSize: 14 }}>
          Cancelar
        </Button>
        {/* Hidden submit so Enter in the field triggers the primary action. */}
        <button type="submit" style={{ display: "none" }} aria-hidden />
      </form>
    </Modal>
  );
}
