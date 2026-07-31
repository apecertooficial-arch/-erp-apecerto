"use client";
/**
 * MANUAL OPERACIONAL — o combinado da operação, num lugar só.
 *
 * Todos os autenticados LEEM (aparece nos Avisos). SÓ o admin edita (na
 * Gestão): a decisão é do banco (ncrm_manual_salvar checa is_admin por
 * dentro) — o botão daqui é só conveniência, nunca autorização.
 */
import { useCallback, useEffect, useState } from "react";

export function Manual3({ accessToken, podeEditar }: { accessToken: string; podeEditar: boolean }) {
  const [conteudo, setConteudo] = useState<string>("");
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/ncrm/manual`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (r.ok) {
        setConteudo((j.conteudo as string) ?? "");
        setAtualizadoEm((j.atualizado_em as string) ?? null);
      } else setAviso((j.error as string) || "Não foi possível carregar o manual.");
    } catch { setAviso("Não foi possível carregar o manual."); }
    setCarregando(false);
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setAviso(null);
    try {
      const r = await fetch(`/api/ncrm/manual`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: rascunho }),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (r.ok && j.ok === true) {
        setEditando(false);
        await carregar();
        setAviso("Manual salvo.");
      } else setAviso((j.error as string) || "Não foi possível salvar.");
    } catch { setAviso("Não foi possível salvar."); }
    setSalvando(false);
  }, [accessToken, rascunho, carregar]);

  return (
    <section className="ncrm3-bloco">
      <h3>Manual operacional</h3>
      {aviso && <p className="ncrm3-nota" role="status">{aviso}</p>}
      {carregando ? (
        <p className="ncrm3-nota">Carregando o manual…</p>
      ) : editando ? (
        <>
          <textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={14}
            maxLength={20000}
            style={{ width: "100%", font: "inherit", padding: 8 }}
            aria-label="Texto do manual operacional"
          />
          <div className="ncrm3-avancadas">
            <button type="button" className="ncrm3-principal" disabled={salvando} onClick={() => void salvar()}>
              {salvando ? "Salvando…" : "Salvar manual"}
            </button>
            <button type="button" className="ncrm3-secundario" disabled={salvando} onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          {conteudo.trim() ? (
            <div style={{ whiteSpace: "pre-wrap" }}>{conteudo}</div>
          ) : (
            <p className="ncrm3-nota">O manual ainda não foi escrito.</p>
          )}
          {atualizadoEm && (
            <p className="ncrm3-nota">Atualizado em {new Date(atualizadoEm).toLocaleString("pt-BR")}.</p>
          )}
          {podeEditar && (
            <div className="ncrm3-avancadas">
              <button type="button" className="ncrm3-secundario" onClick={() => { setRascunho(conteudo); setEditando(true); }}>
                Editar manual
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
