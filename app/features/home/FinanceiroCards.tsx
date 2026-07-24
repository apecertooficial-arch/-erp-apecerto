"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VBars, HBars } from "./charts";

type Financeiro = {
  month_vgv: number; month_count: number; month_comissao: number;
  total_vgv: number; total_count: number; total_comissao: number;
  meta_mes: number;
  by_month: { m: string; vgv: number; count: number; comissao: number }[];
  ranking: { k: string; vgv: number; n: number }[];
};

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });
function monthLabel(m: string) { const mm = Number(m.split("-")[1]); return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][mm - 1] ?? m; }

type CardSpec = { key: string; icon: string; tone: string; label: string; value: string; foot: string; title: string; subtitle: string; legend: string; chart: ReactNode };

export function FinanceiroCards({ accessToken, onNavigate }: { accessToken: string; onNavigate?: (module: string) => void }) {
  const [data, setData] = useState<Financeiro | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<CardSpec | null>(null);

  useEffect(() => {
    void fetch("/api/dashboard?section=financeiro", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((j: { financeiro: Financeiro }) => setData(j.financeiro))
      .catch(() => setFailed(true));
  }, [accessToken]);

  const cards = useMemo<CardSpec[]>(() => {
    if (!data) return [];
    return [
      {
        key: "vgv", icon: "↗", tone: "orange", label: "VGV do mês", value: compact.format(data.month_vgv), foot: `meta ${compact.format(data.meta_mes)}`,
        title: "VGV vendido", subtitle: "Volume geral de vendas — últimos 6 meses", legend: "Volume vendido por mês. Barra atual em relação ao histórico recente.",
        chart: <VBars fmt={(v) => compact.format(v)} data={data.by_month.map((x) => ({ label: monthLabel(x.m), value: Math.round(x.vgv) }))} />,
      },
      {
        key: "vendas", icon: "▥", tone: "purple", label: "Vendas do mês", value: String(data.month_count), foot: `${data.total_count} nos últimos 12 meses`,
        title: "Vendas fechadas", subtitle: "Número de vendas — últimos 6 meses", legend: "Quantas vendas foram registradas por mês.",
        chart: <VBars data={data.by_month.map((x) => ({ label: monthLabel(x.m), value: x.count }))} />,
      },
      {
        key: "comissao", icon: "$", tone: "green", label: "Comissão do mês", value: compact.format(data.month_comissao), foot: `acumulado ${compact.format(data.total_comissao)}`,
        title: "Comissão", subtitle: "Comissão realizada — últimos 6 meses", legend: "Comissão sobre as vendas do mês (percentual real de cada venda).",
        chart: <VBars fmt={(v) => compact.format(v)} data={data.by_month.map((x) => ({ label: monthLabel(x.m), value: Math.round(x.comissao) }))} />,
      },
      {
        key: "ranking", icon: "★", tone: "teal", label: "Corretor destaque", value: data.ranking[0]?.k ?? "—", foot: data.ranking[0] ? `${compact.format(data.ranking[0].vgv)} creditado` : "sem vendas no período",
        title: "Ranking de corretores", subtitle: "VGV creditado (com rateio do fifty) — últimos 6 meses", legend: "Crédito proporcional de cada venda: fifty conta metade pra cada, venda única conta inteira.",
        chart: <HBars fmt={(v) => compact.format(v)} data={data.ranking.map((x) => ({ label: x.k, value: Math.round(x.vgv) }))} colors={data.ranking.map((_, i) => ["#E8620E", "#8B00CC", "#16A39A", "#B5700A", "#2D7DD2", "#E5484D", "#12A150", "#9b38d2"][i % 8])} />,
      },
    ];
  }, [data]);

  if (failed) return null;

  return <>
    <div className="rodagem-head"><h2>Financeiro do mês</h2><small>Toque em um card para ver o gráfico</small></div>
    <section className="home-kpis rodagem-cards financeiro-cards">
      {!data ? <article className="rodagem-skel">Carregando indicadores…</article> : cards.map((c) => (
        <article key={c.key} className={`drill tone-${c.tone}`} role="button" tabIndex={0}
          onClick={() => setActive(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(c); } }}>
          <i>{c.icon}</i>
          <span>{c.label}</span>
          <strong>{c.value}</strong>
          <small>{c.foot}</small>
          <em className="rodagem-cta">ver gráfico →</em>
        </article>
      ))}
    </section>

    {active && <div className="dv-modal-layer" role="dialog" aria-modal="true" aria-label={active.title}>
      <button className="dv-scrim" type="button" aria-label="Fechar" onClick={() => setActive(null)} />
      <div className="dv-modal">
        <header><div><h3>{active.title}</h3><small>{active.subtitle}</small></div><button type="button" className="dv-close" aria-label="Fechar" onClick={() => setActive(null)}>×</button></header>
        <div className="dv-body">{active.chart}</div>
        <footer><span className="dv-legend">{active.legend}</span><button type="button" className="dv-cta" onClick={() => { setActive(null); onNavigate?.("Financeiro"); }}>Abrir Financeiro →</button></footer>
      </div>
    </div>}
  </>;
}
