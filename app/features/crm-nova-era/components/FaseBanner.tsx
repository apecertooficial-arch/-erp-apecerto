"use client";
/**
 * Banner de FASE do piloto (Fase 4, item 12). Mostra em linguagem direta:
 * fase atual, ingest ligado/desligado, modo da Sara, runner, leads, última
 * análise e erros recentes. Admin/executivo: dados reais dos endpoints
 * autenticados. Demais papéis: resumo neutro (sem detalhes administrativos).
 * Só leitura — nenhum controle de ativação vive aqui.
 */
import { useCallback, useEffect, useState } from "react";
import { TITULO_FASE, linhasResumoFase, type EstadoPiloto } from "../lib/faseBanner";

type Json = Record<string, unknown>;
async function get(path: string, token: string): Promise<{ ok: boolean; json: Json }> {
  const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { ok: r.ok, json };
}

export function FaseBanner({ accessToken, souAdmin, totalLeads, onIngest }: {
  accessToken: string;
  souAdmin: boolean;
  totalLeads: number;
  /** Informa o pai sobre o estado do ingest (para a explicação do quadro vazio). */
  onIngest?: (ativo: boolean | null, desde: string | null) => void;
}) {
  const [estado, setEstado] = useState<EstadoPiloto | null>(null);

  const carregar = useCallback(async () => {
    if (!souAdmin) return;
    const [st, rn] = await Promise.all([
      get("/api/ncrm/admin/status", accessToken),
      get("/api/ncrm/sara/runner", accessToken),
    ]);
    const ingest = (st.ok ? (st.json.ingest as Json) : null) ?? null;
    const sara = (st.ok ? (st.json.sara as Json) : null) ?? null;
    const erros = st.ok && Array.isArray(st.json.erros_recentes) ? (st.json.erros_recentes as unknown[]).length : 0;
    const ativo = ingest ? ingest.ativo === true : null;
    const desde = ingest ? ((ingest.ativo_desde as string) ?? null) : null;
    setEstado({
      ingestAtivo: ativo,
      ativoDesde: desde,
      saraModo: sara ? ((sara.modo as string) ?? null) : null,
      runnerEnabled: rn.ok ? rn.json.enabled === true : null,
      runnerUltimaExecucao: rn.ok ? ((rn.json.ultima_execucao as string) ?? null) : null,
      totalLeads,
      errosRecentes: erros,
    });
    onIngest?.(ativo, desde);
  }, [accessToken, souAdmin, totalLeads, onIngest]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const chips = souAdmin && estado
    ? linhasResumoFase({ ...estado, totalLeads })
    : [`Sara: observadora (só sugere)`, `Leads no piloto: ${totalLeads}`];

  return (
    <div role="status" aria-label="Fase do piloto"
      style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", margin: "0 12px",
        border: "1px solid #EBD1F5", borderRadius: 14, background: "#F7ECFC", fontSize: 12 }}>
      <b style={{ fontSize: 13, color: "#66009A" }}>{TITULO_FASE}</b>
      {chips.map((c) => (
        <span key={c} style={{ padding: "3px 10px", borderRadius: 999, background: "#fff", border: "1px solid #EBD1F5", color: "#4D4842" }}>
          {c}
        </span>
      ))}
    </div>
  );
}
