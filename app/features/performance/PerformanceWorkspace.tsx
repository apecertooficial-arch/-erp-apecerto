"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";

type Painel = { corretor_id: string; corretor: string; vendas: number; vgv_rateado: number; comissao_total: number; comissao_prevista: number; comissao_paga: number; indicacoes: number };
type Metrica = { corretor_id: number; corretor: string; leads_ativos: number; aguardando_resposta: number; em_alarme: number; pior_espera_min: number; tarefas_vencidas: number; parados_24h: number; parados_48h: number; parados_72h: number; em_atendimento: number; em_agendamento: number };
type PerfData = { role: string; brokerId: number | null; brokerNome: string | null; painel: Painel[]; metricas: Metrica[] };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });

function tempo(min: number | null | undefined) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
}

export function PerformanceWorkspace({ accessToken, sessionRole = "corretor" }: { accessToken: string; sessionRole?: string }) {
  const [data, setData] = useState<PerfData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/performance", { headers: { Authorization: `Bearer ${accessToken}` } });
        const result = await response.json() as PerfData & { error?: string };
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar a performance.");
        setData(result);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro ao carregar a performance."); }
    })();
  }, [accessToken]);

  if (error) return <div className="perf-workspace"><header className="workspace-top"><div><h1>Performance</h1><p>Indicadores de vendas e atendimento</p></div></header><div className="perf-error">{error}</div></div>;
  if (!data) return <div className="perf-workspace"><header className="workspace-top"><div><h1>Performance</h1><p>Indicadores de vendas e atendimento</p></div></header><div className="perf-loading"><span /><strong>Carregando seus indicadores…</strong></div></div>;

  const isCorretor = data.role === "corretor";
  const metricaTotal = (key: keyof Metrica) => data.metricas.reduce((sum, m) => sum + Number(m[key] || 0), 0);
  const painelTotal = (key: keyof Painel) => data.painel.reduce((sum, p) => sum + Number(p[key] || 0), 0);

  if (isCorretor) {
    const p = data.painel[0];
    const m = data.metricas[0];
    return <div className="perf-workspace">
      <header className="workspace-top"><div><span className="perf-eyebrow">MINHA PERFORMANCE</span><h1>Performance</h1><p>{data.brokerNome || "Corretor"} · vendas e atendimento em tempo real</p></div></header>

      <section className="perf-section">
        <h2>Vendas & comissões</h2>
        <div className="perf-cards">
          <article className="tone-orange"><span>VGV (rateado)</span><strong>{brl.format(Number(p?.vgv_rateado || 0))}</strong><small>{Number(p?.vendas || 0)} {Number(p?.vendas || 0) === 1 ? "venda" : "vendas"}</small></article>
          <article className="tone-purple"><span>Comissão total</span><strong>{brl.format(Number(p?.comissao_total || 0))}</strong><small>Prevista + recebida</small></article>
          <article className="tone-green"><span>Comissão recebida</span><strong>{brl.format(Number(p?.comissao_paga || 0))}</strong><small>Já paga a você</small></article>
          <article className="tone-blue"><span>Comissão prevista</span><strong>{brl.format(Number(p?.comissao_prevista || 0))}</strong><small>A receber</small></article>
          <article className="tone-green"><span>Indicações</span><strong>{brl.format(Number(p?.indicacoes || 0))}</strong><small>Comissão por indicação</small></article>
        </div>
      </section>

      <section className="perf-section">
        <h2>Atendimento & tempo de resposta</h2>
        <div className="perf-cards">
          <article className="tone-blue"><span>Leads ativos</span><strong>{Number(m?.leads_ativos || 0)}</strong><small>Na sua carteira</small></article>
          <article className={Number(m?.aguardando_resposta || 0) > 0 ? "tone-red" : "tone-green"}><span>Aguardando sua resposta</span><strong>{Number(m?.aguardando_resposta || 0)}</strong><small>Clientes esperando você</small></article>
          <article className="tone-orange"><span>Maior espera</span><strong>{tempo(m?.pior_espera_min)}</strong><small>Cliente parado há mais tempo</small></article>
          <article className="tone-purple"><span>Em atendimento</span><strong>{Number(m?.em_atendimento || 0)}</strong><small>Conversas em andamento</small></article>
          <article className="tone-purple"><span>Em agendamento</span><strong>{Number(m?.em_agendamento || 0)}</strong><small>Tentando agendar visita</small></article>
          <article className={Number(m?.tarefas_vencidas || 0) > 0 ? "tone-red" : "tone-green"}><span>Tarefas vencidas</span><strong>{Number(m?.tarefas_vencidas || 0)}</strong><small>Follow-ups atrasados</small></article>
        </div>
      </section>

      <section className="perf-section">
        <h2>Leads parados (sem interação)</h2>
        <div className="perf-cards perf-cards-3">
          <article className="tone-orange"><span>Parados +24h</span><strong>{Number(m?.parados_24h || 0)}</strong><small>Retome hoje</small></article>
          <article className="tone-red"><span>Parados +48h</span><strong>{Number(m?.parados_48h || 0)}</strong><small>Risco de esfriar</small></article>
          <article className="tone-red"><span>Parados +72h</span><strong>{Number(m?.parados_72h || 0)}</strong><small>Prioridade máxima</small></article>
        </div>
      </section>
    </div>;
  }

  // Admin / gestor: visão da equipe
  const painelByName = new Map(data.painel.map((p) => [(p.corretor || "").split(" ")[0].toLowerCase(), p]));
  const rows = data.metricas.map((m) => ({ m, p: painelByName.get((m.corretor || "").split(" ")[0].toLowerCase()) }));
  const totalVgv = painelTotal("vgv_rateado");
  return <div className="perf-workspace">
    <header className="workspace-top"><div><span className="perf-eyebrow">PERFORMANCE DA EQUIPE</span><h1>Performance</h1><p>Vendas, atendimento e tempo de resposta por corretor</p></div></header>

    <section className="perf-kpis">
      <article className="tone-orange"><span>VGV da equipe</span><strong>{compact.format(totalVgv)}</strong><small>{painelTotal("vendas")} vendas</small></article>
      <article className="tone-purple"><span>Comissão total</span><strong>{compact.format(painelTotal("comissao_total"))}</strong><small>Prevista + recebida</small></article>
      <article className="tone-blue"><span>Leads ativos</span><strong>{metricaTotal("leads_ativos")}</strong><small>Toda a equipe</small></article>
      <article className={metricaTotal("aguardando_resposta") > 0 ? "tone-red" : "tone-green"}><span>Aguardando resposta</span><strong>{metricaTotal("aguardando_resposta")}</strong><small>Clientes esperando</small></article>
      <article className="tone-red"><span>Parados +72h</span><strong>{metricaTotal("parados_72h")}</strong><small>Sem interação</small></article>
    </section>

    <section className="perf-panel">
      <header><h2>Ranking e atendimento por corretor</h2></header>
      <div className="perf-table">
        <div className="perf-thead"><span>Corretor</span><span>Vendas</span><span>VGV</span><span>Comissão</span><span>Leads</span><span>Aguardando</span><span>Maior espera</span><span>+72h</span></div>
        {rows.sort((a, b) => Number(b.p?.vgv_rateado || 0) - Number(a.p?.vgv_rateado || 0)).map(({ m, p }) => <article key={m.corretor_id}>
          <strong>{m.corretor}</strong>
          <span>{Number(p?.vendas || 0)}</span>
          <span>{compact.format(Number(p?.vgv_rateado || 0))}</span>
          <span>{compact.format(Number(p?.comissao_total || 0))}</span>
          <span>{m.leads_ativos}</span>
          <span className={m.aguardando_resposta > 0 ? "perf-warn" : ""}>{m.aguardando_resposta}</span>
          <span>{tempo(m.pior_espera_min)}</span>
          <span className={m.parados_72h > 0 ? "perf-warn" : ""}>{m.parados_72h}</span>
        </article>)}
        {rows.length === 0 && <p className="perf-empty">Sem dados de performance no momento.</p>}
      </div>
    </section>
  </div>;
}
