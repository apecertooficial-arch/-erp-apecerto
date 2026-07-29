"use client";
/**
 * CENTRAL DE TREINAMENTO — "Como trabalhar no CRM Nova Era" (Fase 6 PR B).
 * Nunca bloqueia o trabalho: abre e fecha a qualquer momento, o progresso é individual
 * e a gestão vê apenas a conclusão (quem concluiu o quê), sem nota e sem ranking.
 */
import { useCallback, useEffect, useState } from "react";
import { LICOES, progressoTreinamento, proximaLicao, type Licao } from "../lib/treinamento";

type Json = Record<string, unknown>;
type UsuarioEquipe = { nome: string | null; papel: string | null; concluidos: number; ultimo_em: string | null };

function Cartao({ licao, feito, alternar }: { licao: Licao; feito: boolean; alternar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <li style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, background: feito ? "#f8fafc" : "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <input type="checkbox" checked={feito} onChange={alternar} aria-label={`Marcar "${licao.titulo}" como aprendido`}
          style={{ width: 16, height: 16, flexShrink: 0, cursor: "pointer" }} />
        <button onClick={() => setAberto((v) => !v)}
          style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
          <b style={{ fontSize: 14 }}>{licao.titulo}</b>
          <div style={{ color: "#475569", fontSize: 12.5, marginTop: 2 }}>{licao.resumo}</div>
        </button>
        <span aria-hidden style={{ color: "#94a3b8", fontSize: 12 }}>{aberto ? "▲" : "▼"}</span>
      </div>
      {aberto && (
        <div style={{ padding: "0 12px 12px 38px" }}>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#334155" }}>
            {licao.passos.map((p) => <li key={p}>{p}</li>)}
          </ol>
          {licao.exemplo && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#475569", background: "#f1f5f9", borderRadius: 8, padding: "6px 10px" }}>
              Exemplo: {licao.exemplo}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function CentralTreinamento({ accessToken, podeGerir }: { accessToken: string; podeGerir?: boolean }) {
  const [concluidos, setConcluidos] = useState<string[]>([]);
  const [equipe, setEquipe] = useState<UsuarioEquipe[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await fetch("/api/ncrm/treinamento", { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    setCarregando(false);
    if (!r.ok) { setErro("Não foi possível carregar seu progresso agora."); return; }
    setErro(null);
    setConcluidos(Array.isArray(j.concluidos) ? (j.concluidos as string[]) : []);
  }, [accessToken]);

  const carregarEquipe = useCallback(async () => {
    const r = await fetch("/api/ncrm/treinamento?escopo=equipe", { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    if (r.ok && Array.isArray(j.usuarios)) setEquipe(j.usuarios as UsuarioEquipe[]);
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); if (podeGerir) void carregarEquipe(); }, [carregar, carregarEquipe, podeGerir]);

  const alternar = useCallback(async (id: string, feito: boolean) => {
    setConcluidos((c) => (feito ? c.filter((x) => x !== id) : [...c, id]));  // resposta imediata
    const r = await fetch("/api/ncrm/treinamento", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ item: id, concluido: !feito }),
    });
    const j = (await r.json().catch(() => ({}))) as Json;
    if (r.ok && Array.isArray(j.concluidos)) setConcluidos(j.concluidos as string[]);
    else void carregar();
  }, [accessToken, carregar]);

  const pct = progressoTreinamento(concluidos);
  const proxima = proximaLicao(concluidos);

  return (
    <section style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 12 }}>
      <header>
        <h3 style={{ margin: 0, fontSize: 16 }}>Como trabalhar no CRM Nova Era</h3>
        <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 13 }}>
          Um guia curto para consultar quando quiser. Marcar cada tema é só para você acompanhar o que já leu —
          nada aqui bloqueia o seu trabalho.
        </p>
      </header>

      <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b style={{ fontSize: 13 }}>Seu progresso</b>
          <span style={{ fontSize: 12, color: "#475569" }}>{concluidos.length} de {LICOES.length} temas · {pct}%</span>
        </div>
        <div style={{ height: 6, background: "#e2e8f0", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16a34a" : "#2563eb", transition: "width .2s" }} />
        </div>
        {proxima && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#475569" }}>Continue por: <b>{proxima.titulo}</b></p>}
        {!proxima && !carregando && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#166534" }}>Você já passou por todos os temas.</p>}
      </div>

      {erro && <p style={{ color: "#b91c1c", fontSize: 12.5, margin: 0 }}>{erro}</p>}
      {carregando && <p style={{ color: "#64748b", fontSize: 12.5, margin: 0 }}>Carregando…</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {LICOES.map((l) => (
          <Cartao key={l.id} licao={l} feito={concluidos.includes(l.id)} alternar={() => void alternar(l.id, concluidos.includes(l.id))} />
        ))}
      </ul>

      {podeGerir && equipe && (
        <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
          <b style={{ fontSize: 13 }}>Quem já passou pelo guia</b>
          {equipe.length === 0 && <p style={{ fontSize: 12.5, color: "#64748b", margin: "6px 0 0" }}>Ninguém liberado no piloto ainda.</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 2 }}>
            {equipe.map((u) => (
              <li key={`${u.nome}-${u.papel}`} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "4px 0", borderTop: "1px solid #f1f5f9" }}>
                <b style={{ minWidth: 180 }}>{u.nome ?? "—"}</b>
                <span style={{ color: "#475569" }}>{u.concluidos} de {LICOES.length} temas</span>
                {u.concluidos >= LICOES.length && <span style={{ color: "#166534", fontWeight: 700 }}>concluído</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
