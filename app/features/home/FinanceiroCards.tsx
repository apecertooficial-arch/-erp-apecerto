"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VBars, HBars, Sparkline, CompositionBar } from "./charts";

type Financeiro = {
  month_vgv: number; month_count: number; month_comissao: number;
  total_vgv: number; total_count: number; total_comissao: number;
  processo_vgv: number; processo_count: number;
  meta_mes: number;
  by_month: { m: string; vgv: number; count: number; comissao: number }[];
  ranking: { k: string; vgv: number; n: number }[];
};

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });
const TONE: Record<string, { c: string; t: string }> = {
  orange: { c: "#FF7000", t: "#FFE4D1" }, purple: { c: "#8B00CC", t: "#EBD1F5" }, green: { c: "#1FA85A", t: "#CDEBD8" },
};
function monthLabel(m: string) { const mm = Number(m.split("-")[1]); return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][mm - 1] ?? m; }

type CardSpec = { key: string; icon: string; tone: string; feat?: boolean; label: string; value: string; foot: string; micro: ReactNode; title: string; subtitle: string; legend: string; chart: ReactNode };

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
        key: "vgv", icon: "↗", tone: "orange", label: "VGV do mês", value: compact.format(data.month_vgv), foot: `meta ${compact.format(data.meta_mes)} · ${compact.format(data.processo_vgv ?? 0)} em processo`,
        micro: <Sparkline data={data.by_month.map((x) => Math.round(x.vgv))} color={TONE.orange.c} tint={TONE.orange.t} />,
        title: "VGV vendido", subtitle: "Vendas concluídas — últimos 6 meses", legend: `Só entra aqui a venda concluída, contada no mês em que fechou. Hoje há ${compact.format(data.processo_vgv ?? 0)} em ${data.processo_count ?? 0} venda(s) ainda na esteira.`,
        chart: <VBars fmt={(v) => compact.format(v)} data={data.by_month.map((x) => ({ label: monthLabel(x.m), value: Math.round(x.vgv) }))} />,
      },
      {
        key: "vendas", icon: "▥", tone: "purple", label: "Vendas do mês", value: String(data.month_count), foot: `${data.total_count} nos últimos 12 meses`,
        micro: <Sparkline data={data.by_month.map((x) => x.count)} color={TONE.purple.c} tint={TONE.purple.t} />,
        title: "Vendas fechadas", subtitle: "Número de vendas concluídas — últimos 6 meses", legend: "Quantas vendas foram concluídas por mês. Vendas ainda na esteira não entram.",
        chart: <VBars data={data.by_month.map((x) => ({ label: monthLabel(x.m), value: x.count }))} />,
      },
      {
        key: "comissao", icon: "$", tone: "green", label: "Comissão do mês", value: compact.format(data.month_comissao), foot: `acumulado ${compact.format(data.total_comissao)}`,
        micro: <Sparkline data={data.by_month.map((x) => Math.round(x.comissao))} color={TONE.green.c} tint={TONE.green.t} />,
        title: "Comissão", subtitle: "Comissão realizada — últimos 6 meses", legend: "Comissão sobre as vendas do mês (percentual real de cada venda).",
        chart: <VBars fmt={(v) => compact.format(v)} data={data.by_month.map((x) => ({ label: monthLabel(x.m), value: Math.round(x.comissao) }))} />,
      },
      {
        key: "ranking", icon: "★", tone: "purple", feat: true, label: "Corretor destaque", value: data.ranking[0]?.k ?? "—", foot: data.ranking[0] ? `${compact.format(data.ranking[0].vgv)} creditado` : "sem vendas no período",
        micro: <CompositionBar segments={data.ranking.map((x) => Math.round(x.vgv))} color={TONE.purple.c} />,
        title: "Ranking de corretores", subtitle: "VGV creditado (com rateio do fifty) — últimos 6 meses", legend: "Crédito proporcional de cada venda: fifty conta metade pra cada, venda única conta inteira.",
        chart: <HBars fmt={(v) => compact.format(v)} data={data.ranking.map((x) => ({ label: x.k, value: Math.round(x.vgv) }))} colors={data.ranking.map((_, i) => ["#E8620E", "#8B00CC", "#16A39A", "#B5700A", "#2D7DD2", "#E5484D", "#12A150", "#9b38d2"][i % 8])} />,
      },
    ];
  }, [data]);

  if (failed) return null;

  return <>
    <div className="hv2-sec"><span className="hv2-sec-bar" /><h2>Financeiro do mês</h2><small>Toque em um card para ver o gráfico</small></div>
    <div className="hv2-grid c4">
      {!data ? <div className="hv2-card" style={{ opacity: .5 }}>Carregando…</div> : cards.map((c) => (
        <button key={c.key} type="button" className={`hv2-card fin t-${c.tone}${c.feat ? " feat" : ""}`} onClick={() => setActive(c)}>
          <div className="hv2-card-h"><span className="hv2-tile">{c.icon}</span><span className="hv2-card-t">{c.label}</span></div>
          <div className="hv2-val">{c.value}</div>
          {c.micro}
          <div className="hv2-sup">{c.foot}</div>
          <em className="hv2-cta">{c.feat ? "ver ranking →" : "ver gráfico →"}</em>
        </button>
      ))}
    </div>

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
