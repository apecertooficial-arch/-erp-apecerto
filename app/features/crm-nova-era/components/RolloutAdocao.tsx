"use client";
/**
 * CHECKLIST DE ROLLOUT + ADOÇÃO (Fase 6). Somente leitura, agregação real do banco.
 * Instâncias de WhatsApp desconectadas geram ATENÇÃO — nunca bloqueiam o ERP.
 * Sem ranking punitivo: o objetivo é mostrar evolução e onde há oportunidade de coaching.
 */
import { useCallback, useEffect, useState } from "react";

type Json = Record<string, unknown>;
type ItemChecklist = { item: string; estado: "pronto" | "atencao" | "bloqueado"; detalhe: string };
type UsuarioAdocao = { usuario_id: string; nome: string | null; papel: string | null; acessou: boolean; ultimo_acesso: string | null; atendimentos: number; acoes_vencidas: number; sem_proxima_acao: number };

const ESTADO: Record<string, { txt: string; cor: string; bg: string }> = {
  pronto: { txt: "Pronto", cor: "#166534", bg: "#dcfce7" },
  atencao: { txt: "Atenção", cor: "#92400e", bg: "#fef3c7" },
  bloqueado: { txt: "Bloqueado", cor: "#991b1b", bg: "#fee2e2" },
};

export function RolloutChecklist({ accessToken }: { accessToken: string }) {
  const [d, setD] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    const r = await fetch("/api/ncrm/rollout", { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok) { setErro((j.error as string) || "Falha ao carregar o checklist."); return; }
    setErro(null); setD(j);
  }, [accessToken]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const geral = ESTADO[String(d?.geral ?? "atencao")] ?? ESTADO.atencao;
  const itens = (d?.itens ?? []) as ItemChecklist[];

  return (
    <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b>Checklist de liberação</b>
        {d && <span style={{ background: geral.bg, color: geral.cor, fontWeight: 700, borderRadius: 999, padding: "2px 10px", fontSize: 12 }}>{geral.txt}</span>}
        <button className="nova-crm-btn ghost" style={{ marginLeft: "auto" }} onClick={() => void carregar()}>↻</button>
      </div>
      {erro && <p style={{ color: "#b91c1c", fontSize: 12 }}>{erro}</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
        {itens.map((i) => {
          const e = ESTADO[i.estado] ?? ESTADO.atencao;
          return (
            <li key={i.item} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, padding: "4px 0", borderTop: "1px solid #f1f5f9" }}>
              <span style={{ background: e.bg, color: e.cor, borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700, minWidth: 74, textAlign: "center" }}>{e.txt}</span>
              <b style={{ minWidth: 190 }}>{i.item}</b>
              <span style={{ color: "#374151" }}>{i.detalhe}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdocaoPainel({ accessToken }: { accessToken: string }) {
  const [d, setD] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    const r = await fetch("/api/ncrm/adocao", { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok) { setErro((j.error as string) || "Falha ao carregar a adoção."); return; }
    setErro(null); setD(j);
  }, [accessToken]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const t = (d?.totais ?? {}) as Json;
  const usuarios = (d?.usuarios ?? []) as UsuarioAdocao[];

  return (
    <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>Adoção e qualidade</b>
        <button className="nova-crm-btn ghost" onClick={() => void carregar()}>↻</button>
      </div>
      {erro && <p style={{ color: "#b91c1c", fontSize: 12 }}>{erro}</p>}
      {d && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, margin: "8px 0" }}>
            <span>Usaram nos últimos {String(t.periodo_dias ?? 7)} dias: <b>{String(t.acessaram ?? 0)}</b></span>
            <span>Atendimentos: <b>{String(t.atendimentos ?? 0)}</b></span>
            <span>Ações vencidas: <b>{String(t.acoes_vencidas ?? 0)}</b></span>
            <span>Com próxima ação: <b>{String(t.com_proxima_acao_pct ?? 0)}%</b></span>
            <span>Sara: <b>{String(t.sara_analises ?? 0)}</b> análises · {String(t.sara_aceitas ?? 0)} aceitas / {String(t.sara_rejeitadas ?? 0)} rejeitadas</span>
            <span>Visitas: <b>{String(t.visitas ?? 0)}</b> · Propostas: <b>{String(t.propostas ?? 0)}</b></span>
          </div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b7280" }}>
                <th style={{ padding: 6 }}>Pessoa</th><th>Papel</th><th>Usou o CRM</th><th>Último acesso</th><th>Atendimentos</th><th>Ações vencidas</th><th>Sem próxima ação</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.usuario_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 6, fontWeight: 600 }}>{u.nome ?? "—"}</td>
                  <td>{u.papel ?? "—"}</td>
                  <td style={{ color: u.acessou ? "#16a34a" : "#b45309", fontWeight: 600 }}>{u.acessou ? "sim" : "ainda não"}</td>
                  <td>{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString("pt-BR") : "nunca"}</td>
                  <td>{u.atendimentos}</td>
                  <td style={{ color: u.acoes_vencidas > 0 ? "#b91c1c" : undefined }}>{u.acoes_vencidas}</td>
                  <td>{u.sem_proxima_acao}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            Sem ranking punitivo: quem ainda não usou é oportunidade de acompanhamento, não de cobrança automática.
          </p>
        </>
      )}
    </div>
  );
}
