"use client";
/**
 * MEU DIA — fila única de trabalho do corretor (Fase 5, Etapa C).
 * Responde "o que eu preciso fazer agora?": prioridade calculada NO BANCO
 * (ncrm_fila_trabalho, escopo por carteira/papel), nunca pelos cards carregados.
 * Só leitura + navegação: nenhuma ação automática.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { esperaHumana } from "../lib/meuDia";

type Json = Record<string, unknown>;

export interface ItemFila {
  negocio_id: number;
  lead_nome: string | null;
  etapa: string;
  temperatura: string | null;
  corretor_nome: string | null;
  proxima_acao_titulo: string | null;
  proxima_acao_em: string | null;
  prioridade: number;
  motivo: string;
  espera_min: number;
  respondeu: boolean;
}

const FILTROS: Array<{ chave: string; rotulo: string }> = [
  { chave: "agora", rotulo: "Agora" },
  { chave: "vencidos", rotulo: "Vencidos" },
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "proximos", rotulo: "Próximos" },
  { chave: "respondeu", rotulo: "Respondeu" },
  { chave: "sem_resposta", rotulo: "Sem resposta" },
  { chave: "risco", rotulo: "Risco" },
  { chave: "quente", rotulo: "Quente" },
];

const COR_PRIORIDADE: Record<number, string> = {
  1: "#16a34a", 2: "#2563eb", 3: "#dc2626", 4: "#d97706", 5: "#b91c1c", 6: "#7c3aed", 7: "#6b7280",
};


export function MeuDia({ accessToken, corretorFiltro, onAbrir }: {
  accessToken: string;
  corretorFiltro?: number | null;
  onAbrir: (negocioId: string) => void;
}) {
  const [filtro, setFiltro] = useState("agora");
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const params = new URLSearchParams({ filtro });
    if (corretorFiltro != null) params.set("corretor", String(corretorFiltro));
    const r = await fetch(`/api/ncrm/fila?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    setCarregando(false);
    if (!r.ok) { setErro((j.error as string) || "Falha ao carregar a fila."); return; }
    setItens((j.itens as ItemFila[]) ?? []);
  }, [accessToken, filtro, corretorFiltro]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const resumo = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of itens) m.set(i.prioridade, (m.get(i.prioridade) ?? 0) + 1);
    return m;
  }, [itens]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {FILTROS.map((f) => (
          <button key={f.chave} className={`nova-crm-btn ghost${filtro === f.chave ? " on" : ""}`} onClick={() => setFiltro(f.chave)}>
            {f.rotulo}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          {itens.length} itens{resumo.get(1) ? ` · ${resumo.get(1)} aguardando você` : ""}
        </span>
        <button className="nova-crm-btn ghost" onClick={() => void carregar()}>↻</button>
      </div>

      {carregando && <div className="nova-crm-empty">Carregando sua fila…</div>}
      {erro && <div className="nova-crm-notice" style={{ color: "#b42318" }}>{erro}</div>}
      {!carregando && !erro && itens.length === 0 && (
        <div className="nova-crm-empty">Nada pendente neste filtro. Bom trabalho — confira o filtro Próximos para se antecipar.</div>
      )}

      {itens.map((i) => (
        <article key={i.negocio_id} style={{ display: "flex", gap: 12, alignItems: "center", border: "1px solid var(--nc-line,#e5e7eb)", borderLeft: `4px solid ${COR_PRIORIDADE[i.prioridade] ?? "#6b7280"}`, borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <b>{i.lead_nome ?? `Negócio ${i.negocio_id}`}</b>
              <span style={{ fontSize: 12, color: COR_PRIORIDADE[i.prioridade] ?? "#6b7280", fontWeight: 600 }}>{i.motivo}</span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>espera {esperaHumana(i.espera_min)}</span>
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>{i.proxima_acao_titulo ?? "Definir próxima ação"}{i.proxima_acao_em ? ` · ${new Date(i.proxima_acao_em).toLocaleString("pt-BR")}` : ""}</span>
              <span>etapa: {i.etapa}</span>
              {i.temperatura && <span>temperatura: {i.temperatura}</span>}
              {i.corretor_nome && <span>corretor: {i.corretor_nome}</span>}
            </div>
          </div>
          <button className="nova-crm-btn" onClick={() => onAbrir(String(i.negocio_id))}>Abrir e atender</button>
        </article>
      ))}
    </div>
  );
}
