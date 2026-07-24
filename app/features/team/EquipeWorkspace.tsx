"use client";

// "Minha Equipe" — leitura de performance + VGV da equipe (gerente/diretor).
// Só leitura: nenhum dado é alterado aqui. O escopo (quem aparece) é decidido
// no banco pela função equipe_visao, a partir do usuário logado.

import { useEffect, useMemo, useState } from "react";

type Membro = {
  corretor_id: number;
  nome: string;
  score: number;
  vgv_mes: number;
  vendas_mes: number;
  meta_vgv: number;
  is_self: boolean;
};

const brl = (value: number) =>
  (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function EquipeWorkspace({ accessToken }: { accessToken: string }) {
  const [team, setTeam] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<"total" | number>("total"); // "total" = equipe toda; número = um corretor

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    fetch("/api/equipe", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((json: { team?: Membro[]; error?: string }) => {
        if (!alive) return;
        if (json.error) { setError(json.error); return; }
        setTeam(json.team ?? []);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Erro ao carregar."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accessToken]);

  const visiveis = useMemo(() => (filtro === "total" ? team : team.filter((m) => m.corretor_id === filtro)), [team, filtro]);
  const totais = useMemo(() => visiveis.reduce(
    (acc, m) => ({ vgv: acc.vgv + (m.vgv_mes || 0), vendas: acc.vendas + (m.vendas_mes || 0) }),
    { vgv: 0, vendas: 0 },
  ), [visiveis]);

  return (
    <div className="equipe-workspace">
      <header className="workspace-top">
        <div>
          <h1>Minha Equipe</h1>
          <p>Performance e VGV da sua equipe · somente leitura</p>
        </div>
      </header>

      {loading ? (
        <div className="workspace-loading">Carregando equipe…</div>
      ) : error ? (
        <div className="workspace-error">{error}</div>
      ) : team.length === 0 ? (
        <div className="audit-empty">Nenhum corretor na sua equipe ainda. Vincule corretores a você em Usuários (campo &quot;Responde a&quot;).</div>
      ) : (
        <>
          <div className="equipe-filtro">
            <button type="button" className={filtro === "total" ? "active" : ""} onClick={() => setFiltro("total")}>Equipe total</button>
            {team.map((m) => (
              <button type="button" key={m.corretor_id} className={filtro === m.corretor_id ? "active" : ""} onClick={() => setFiltro(m.corretor_id)}>
                {m.nome}{m.is_self ? " (você)" : ""}
              </button>
            ))}
          </div>

          <div className="equipe-resumo">
            <div><span>VGV do mês</span><strong>{brl(totais.vgv)}</strong></div>
            <div><span>Vendas no mês</span><strong>{totais.vendas}</strong></div>
            <div><span>Corretores</span><strong>{visiveis.length}</strong></div>
          </div>

          <div className="equipe-lista">
            {visiveis.map((m) => {
              const pct = m.meta_vgv > 0 ? Math.min(100, Math.round((m.vgv_mes / m.meta_vgv) * 100)) : null;
              return (
                <article className={`equipe-card ${m.is_self ? "self" : ""}`} key={m.corretor_id}>
                  <div className="equipe-card-top">
                    <strong>{m.nome}{m.is_self && <em>você</em>}</strong>
                    <span className="equipe-score" title="Score de performance">{m.score}</span>
                  </div>
                  <div className="equipe-metrics">
                    <div><span>VGV mês</span><b>{brl(m.vgv_mes)}</b></div>
                    <div><span>Vendas</span><b>{m.vendas_mes}</b></div>
                    <div><span>Meta VGV</span><b>{m.meta_vgv > 0 ? brl(m.meta_vgv) : "—"}</b></div>
                  </div>
                  {pct !== null && (
                    <div className="equipe-meta-bar" title={`${pct}% da meta`}>
                      <i style={{ width: `${pct}%` }} />
                      <small>{pct}% da meta</small>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
