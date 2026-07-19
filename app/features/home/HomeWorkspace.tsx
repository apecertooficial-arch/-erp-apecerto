"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = { id: number; nome?: string | null };
type Deal = { id: number; lead_id: number; corretor_id?: number | null; stage_id?: number | null; status?: string | null; venda_id?: string | null };
type Stage = { id: number; nome: string; cor?: string | null; ordem?: number | null };
type Broker = { id: number; nome: string };
type Task = { id: number; concluida?: boolean | null };
type ProductLink = { lead_id: number; empreendimento_id: string; empreendimentos?: { nome?: string | null } | null };
type CrmData = { leads: Lead[]; deals: Deal[]; stages: Stage[]; brokers: Broker[]; tasks: Task[]; alerts: unknown[]; productLinks: ProductLink[] };
type Sale = { id: string; empreendimento_id?: string | null; empreendimento_nome?: string | null; vgv: number; percentual_comissao?: number | null; data_venda: string; status?: string | null };
type Cash = { tipo: string; valor: number };
type Goal = { nome?: string | null; meta_vgv?: number | null };
type FinanceData = { sales: Sale[]; cash: Cash[]; goals: Goal[]; receipts: Array<{ status?: string | null }> };
type CatalogItem = { id: string; name: string; available: number; neighborhood: string };
type CatalogData = { catalog: CatalogItem[] };
type DashboardData = { crm: CrmData; finance: FinanceData; catalog: CatalogData };

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function sameMonth(value: string) {
  const now = new Date();
  const date = new Date(`${value}T12:00:00`);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function HomeWorkspace({ accessToken, sessionName = "", onNavigate }: { accessToken: string; sessionName?: string; onNavigate?: (module: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metaMesGlobal, setMetaMesGlobal] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    void fetch("/api/metas", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((response) => response.ok ? response.json() : { metas: [] })
      .then((json: { metas?: Array<{ corretor_id: number | null; periodo_tipo: string; ano: number; periodo: number; meta_vgv: number }> }) => {
        const found = (json.metas ?? []).find((m) => m.corretor_id === null && m.periodo_tipo === "mensal" && m.ano === now.getFullYear() && m.periodo === now.getMonth() + 1);
        setMetaMesGlobal(found ? Number(found.meta_vgv) : null);
      }).catch(() => setMetaMesGlobal(null));
  }, [accessToken]);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    void Promise.all([
      fetch("/api/crm", { headers }),
      fetch("/api/finance", { headers }),
      fetch("/api/catalog", { headers }),
    ]).then(async (responses) => {
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error("Não foi possível carregar todos os indicadores.");
      const [crm, finance, catalog] = await Promise.all(responses.map((response) => response.json()));
      setError(null);
      setData({ crm, finance, catalog } as DashboardData);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Erro ao carregar o início."));
  }, [accessToken]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const openDeals = data.crm.deals.filter((item) => !["perdido", "ganho", "fechado"].includes((item.status || "").toLowerCase()));
    const monthSales = data.finance.sales.filter((item) => sameMonth(item.data_venda));
    const totalVgv = data.finance.sales.reduce((sum, item) => sum + Number(item.vgv || 0), 0);
    const monthVgv = monthSales.reduce((sum, item) => sum + Number(item.vgv || 0), 0);
    const commission = data.finance.sales.reduce((sum, item) => sum + Number(item.vgv || 0) * Number(item.percentual_comissao || 0) / 100, 0);
    const balance = data.finance.cash.reduce((sum, item) => sum + (item.tipo === "entrada" ? Number(item.valor || 0) : -Number(item.valor || 0)), 0);
    const goal = data.finance.goals.reduce((sum, item) => sum + Number(item.meta_vgv || 0), 0);
    return { openDeals, monthSales, totalVgv, monthVgv, commission, balance, goal, pendingTasks: data.crm.tasks.filter((item) => !item.concluida).length };
  }, [data]);

  if (error) return <div className="home-state error">{error}</div>;
  if (!data || !metrics) return <div className="home-state">Conectando indicadores reais do ERP…</div>;

  const stageRows = data.crm.stages.map((stage) => ({ ...stage, count: metrics.openDeals.filter((deal) => deal.stage_id === stage.id).length })).filter((stage) => stage.count > 0).sort((a, b) => b.count - a.count || Number(a.ordem || 0) - Number(b.ordem || 0)).slice(0, 10);
  const maxStage = Math.max(1, ...stageRows.map((item) => item.count));
  const brokerSales = data.crm.brokers.map((broker) => ({ broker, sales: data.crm.deals.filter((deal) => deal.corretor_id === broker.id && deal.venda_id).length })).sort((a, b) => b.sales - a.sales).slice(0, 5);
  const saleProducts = [...new Set(data.finance.sales.map((sale) => sale.empreendimento_nome || "Produto não informado"))].map((name) => ({ name, count: data.finance.sales.filter((sale) => (sale.empreendimento_nome || "Produto não informado") === name).length })).sort((a, b) => b.count - a.count).slice(0, 5);
  const leadProducts = [...new Set(data.crm.productLinks.map((link) => link.empreendimentos?.nome || link.empreendimento_id))].map((name) => ({ name, count: data.crm.productLinks.filter((link) => (link.empreendimentos?.nome || link.empreendimento_id) === name).length })).sort((a, b) => b.count - a.count).slice(0, 5);
  const effectiveGoal = metaMesGlobal ?? metrics.goal;
  const goalPercent = effectiveGoal > 0 ? Math.min(100, metrics.monthVgv / effectiveGoal * 100) : 0;

  return <div className="home-workspace">
    <header className="home-header"><div><h1>Início</h1><p>Visão geral da operação em tempo real{sessionName ? ` · ${sessionName.split(/\s+/)[0]}` : ""}</p></div><span>● Dados reais · sessão protegida</span></header>
    <section className="home-goal hero"><header><div><small>META DO MÊS</small><strong>{brl.format(metrics.monthVgv)}<em> vendidos{effectiveGoal > 0 ? ` de ${brl.format(effectiveGoal)}` : ""}</em></strong></div><b>{goalPercent.toFixed(0)}%</b></header><div><span style={{ width: `${goalPercent}%` }} /></div><footer>{effectiveGoal > 0 ? <span>faltam <b>{brl.format(Math.max(0, effectiveGoal - metrics.monthVgv))}</b> para bater a meta</span> : <span>Defina a meta do mês no Financeiro → Metas</span>}<button type="button" onClick={() => onNavigate?.("Financeiro")}>Abrir Financeiro →</button></footer></section>
    <section className="home-kpis">
      <article><i className="orange">◎</i><span>Total de leads</span><strong>{data.crm.leads.length}</strong><small>na base do CRM</small></article>
      <article><i className="purple">↗</i><span>Negócios abertos</span><strong>{metrics.openDeals.length}</strong><small>em negociação</small></article>
      <article><i className="green">✓</i><span>Ganhos no mês</span><strong>{metrics.monthSales.length}</strong><small>negócios fechados</small></article>
      <article><i className="teal">▥</i><span>Vendas fechadas</span><strong>{data.finance.sales.length}</strong><small>registradas no ERP</small></article>
      <article><i className="orange">↗</i><span>VGV total</span><strong>{compact.format(metrics.totalVgv)}</strong><small>volume vendido</small></article>
      <article><i className="purple">$</i><span>Comissão prevista</span><strong>{compact.format(metrics.commission)}</strong><small>sobre o VGV</small></article>
      <article><i className="green">▤</i><span>Saldo de caixa</span><strong>{compact.format(metrics.balance)}</strong><small>realizado</small></article>
      <article><i className="yellow">△</i><span>Atividades pendentes</span><strong>{metrics.pendingTasks}</strong><small>tarefas em aberto</small></article>
    </section>
    <section className="home-two-columns">
      <article className="home-panel"><h2>Funil por etapa <small>Top 10 por volume</small></h2>{stageRows.map((stage) => <button className="home-funnel-row drill" type="button" onClick={() => onNavigate?.("CRM")} key={stage.id}><span><i style={{ background: stage.cor || "#ff6500" }} />{stage.nome}<b>{stage.count} · leads</b></span><div><u style={{ width: `${stage.count / maxStage * 100}%`, background: stage.cor || "#ff6500" }} /></div></button>)}{stageRows.length === 0 && <p>Nenhum negócio aberto no funil.</p>}</article>
      <article className="home-panel"><h2>Ranking de corretores</h2>{brokerSales.map((item, index) => <div className="home-ranking-row" key={item.broker.id}><b>{index + 1}</b><i>{item.broker.nome.slice(0, 1)}</i><span><strong>{item.broker.nome}</strong><small>{item.sales} venda(s)</small></span><em>{item.sales}</em></div>)}{brokerSales.length === 0 && <p>Nenhum corretor disponível.</p>}</article>
    </section>
    <section className="home-three-columns">
      <article className="home-panel"><h2>Produtos mais vendidos</h2>{saleProducts.map((item, index) => <div className="home-list-row" key={item.name}><i className={`product-rank tone-${index + 1}`}>{index + 1}</i><span>{item.name}</span><b>{item.count} vendas</b></div>)}</article>
      <article className="home-panel"><h2>Produtos com mais leads</h2>{leadProducts.map((item, index) => <div className="home-list-row" key={item.name}><i className={`product-rank tone-${index + 1}`}>{String(item.name).trim().slice(0, 1).toUpperCase()}</i><span>{item.name}</span><b>{item.count} leads</b></div>)}</article>
      <article className="home-panel"><h2>Pendências prioritárias</h2><p className="home-panel-note">Pontos que precisam de ação para a operação continuar fluindo.</p><button className="home-alert drill" type="button" onClick={() => onNavigate?.("CRM")}><i className="purple">●</i><span><b>{metrics.openDeals.filter((deal) => !deal.corretor_id).length} negócios sem corretor</b><small>Distribuir responsáveis no CRM</small></span></button><button className="home-alert drill" type="button" onClick={() => onNavigate?.("CRM")}><i className="orange">↗</i><span><b>{metrics.openDeals.filter((deal) => !deal.stage_id).length} negócios sem etapa</b><small>Organizar no funil de vendas</small></span></button><button className="home-alert drill" type="button" onClick={() => onNavigate?.("Financeiro")}><i className="yellow">$</i><span><b>{data.finance.receipts.filter((item) => item.status !== "recebido").length} recebimentos pendentes</b><small>Conferir no Financeiro</small></span></button></article>
    </section>
  </div>;
}
