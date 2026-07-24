"use client";

import { useEffect, useMemo, useState } from "react";
import { RodagemCards } from "./RodagemCards";
import { FunilCards } from "./FunilCards";
import { FinanceiroCards } from "./FinanceiroCards";

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
    const monthSales = data.finance.sales.filter((item) => sameMonth(item.data_venda));
    const monthVgv = monthSales.reduce((sum, item) => sum + Number(item.vgv || 0), 0);
    const goal = data.finance.goals.reduce((sum, item) => sum + Number(item.meta_vgv || 0), 0);
    return { monthSales, monthVgv, goal };
  }, [data]);

  if (error) return <div className="home-state error">{error}</div>;
  if (!data || !metrics) return <div className="home-state">Conectando indicadores reais do ERP…</div>;

  const saleProducts = [...new Set(data.finance.sales.map((sale) => sale.empreendimento_nome || "Produto não informado"))].map((name) => ({ name, count: data.finance.sales.filter((sale) => (sale.empreendimento_nome || "Produto não informado") === name).length })).sort((a, b) => b.count - a.count).slice(0, 5);
  const totalSales = data.finance.sales.length;
  const leader = saleProducts[0] ?? null;
  const maxProd = Math.max(1, ...saleProducts.map((p) => p.count));
  const effectiveGoal = metaMesGlobal ?? metrics.goal;
  const goalPercent = effectiveGoal > 0 ? Math.min(100, metrics.monthVgv / effectiveGoal * 100) : 0;
  const nowRef = new Date();
  const daysInMonth = new Date(nowRef.getFullYear(), nowRef.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - nowRef.getDate() + 1);
  const missing = Math.max(0, effectiveGoal - metrics.monthVgv);
  const pacePerDay = missing / daysLeft;
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(nowRef);
  const dateStr = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(nowRef).replace("-feira", "");
  const firstName = sessionName ? sessionName.split(/\s+/)[0] : "";
  const initial = (sessionName || "R").trim().slice(0, 1).toUpperCase();

  return <div className="home-v2">
    <div className="hv2-top">
      <div className="hv2-top-l">
        <span className="hv2-avatar">{initial}</span>
        <div><div className="hv2-eyebrow">Bem-vindo de volta</div><div className="hv2-hello">Olá, {firstName || "Rômulo"}</div></div>
      </div>
      <div className="hv2-top-r">
        <div className="hv2-date">{dateStr} · {daysLeft} {daysLeft === 1 ? "dia" : "dias"} pra fechar o mês</div>
        <span className="hv2-badge"><i />Dados reais · sessão protegida</span>
      </div>
    </div>

    <section className="hv2-hero">
      <div>
        <div className="hv2-hero-eyebrow">Meta do mês · {monthName}</div>
        <div className="hv2-hero-val">{brl.format(metrics.monthVgv)}</div>
        <div className="hv2-hero-sub">vendidos de {effectiveGoal > 0 ? brl.format(effectiveGoal) : "—"}</div>
        <div className="hv2-hero-bar"><span style={{ width: `${Math.max(1.5, goalPercent)}%` }} /></div>
        <div className="hv2-chips">
          {effectiveGoal > 0 && <span className="hv2-chip">faltam <b>{brl.format(missing)}</b></span>}
          {effectiveGoal > 0 && <span className="hv2-chip">ritmo necessário <b>{brl.format(pacePerDay)}/dia</b></span>}
          <span className="hv2-chip">{metrics.monthSales.length} {metrics.monthSales.length === 1 ? "venda válida" : "vendas válidas"}</span>
        </div>
      </div>
      <div className="hv2-hero-r">
        <div className="hv2-ring"><b>{goalPercent.toFixed(0)}%</b><small>da meta</small></div>
        <button className="hv2-hero-btn" type="button" onClick={() => onNavigate?.("Financeiro")}>Abrir Financeiro →</button>
      </div>
    </section>

    <RodagemCards accessToken={accessToken} onNavigate={onNavigate} />
    <FunilCards accessToken={accessToken} onNavigate={onNavigate} />
    <FinanceiroCards accessToken={accessToken} onNavigate={onNavigate} />

    <div className="hv2-prod">
      <div className="hv2-panel">
        <div className="hv2-panel-h"><h3>Produtos mais vendidos</h3><small>últimos 6 meses · {totalSales} no total</small></div>
        {leader ? <>
          <div className="hv2-leader"><span className="tp">★</span><div className="nm"><strong>{leader.name}</strong><small>líder do período · {totalSales ? Math.round(leader.count / totalSales * 100) : 0}% das vendas</small></div><div className="qt">{leader.count} vendas</div></div>
          {saleProducts.slice(1).map((p, i) => <div className="hv2-prow" key={p.name}><span className="hv2-rank">{i + 2}</span><span className="pn">{p.name}</span><span className="pb"><u style={{ width: `${p.count / maxProd * 100}%` }} /></span><span className="pv">{p.count}</span></div>)}
          <button className="hv2-link-btn" type="button" onClick={() => onNavigate?.("Produtos")}>Ver todos os produtos →</button>
        </> : <p className="hv2-sup">Sem vendas no período.</p>}
      </div>
      <div className="hv2-panel hv2-empty">
        <h3>Produtos com mais leads</h3>
        <p>Nenhum lead vinculado a produto ainda. Quando os corretores associarem leads a empreendimentos no CRM, o ranking aparece aqui.</p>
        <button className="hv2-ghost-btn" type="button" onClick={() => onNavigate?.("CRM")}>Abrir no CRM →</button>
      </div>
    </div>
  </div>;
}
