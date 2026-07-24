"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Rodagem = {
  leads_today: number; leads_week: number; leads_total: number; open_deals: number; parados_7d: number;
  leads_per_day: { d: string; n: number }[];
  leads_by_origem: { k: string; n: number }[];
  parados_faixa: { f7_14: number; f14_30: number; f30: number };
  open_by_corretor: { k: string; n: number; parados: number }[];
};

// Paleta categórica validada (dataviz): laranja, roxo, teal, âmbar escuro, azul.
const CAT = ["#E8620E", "#8B00CC", "#16A39A", "#B5700A", "#2D7DD2"];

function shortDay(iso: string) { const p = iso.split("-"); return `${p[2]}/${p[1]}`; }
function prettyOrigem(k: string) {
  const map: Record<string, string> = { automacao: "Automação", datacrazy_pipe: "DataCrazy (pipe)", datacrazy_mig: "DataCrazy (migração)", manual: "Manual" };
  return map[k] ?? k;
}

// ---- Gráficos SVG (marcas finas, pontas 4px, rótulos diretos, base recuada) ----
function VBars({ data }: { data: { label: string; value: number }[] }) {
  const w = 580, h = 240, pad = 30;
  const bw = (w - pad * 2) / Math.max(1, data.length);
  const max = Math.max(1, ...data.map((d) => d.value));
  return <svg viewBox={`0 0 ${w} ${h}`} className="dv-chart" role="img" aria-label="Leads por dia">
    <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} className="dv-base" />
    {data.map((d, i) => {
      const bh = (h - pad * 2) * (d.value / max); const x = pad + i * bw; const y = h - pad - bh;
      return <g key={i}>
        <rect x={x + 4} y={y} width={Math.max(2, bw - 8)} height={Math.max(2, bh)} rx="4" fill="#E8620E"><title>{d.label}: {d.value} leads</title></rect>
        {i % 2 === 0 && <text x={x + bw / 2} y={h - pad + 15} textAnchor="middle" className="dv-axis">{d.label}</text>}
        {d.value > 0 && <text x={x + bw / 2} y={y - 5} textAnchor="middle" className="dv-val">{d.value}</text>}
      </g>;
    })}
  </svg>;
}

function HBars({ data, colors }: { data: { label: string; value: number; sub?: number }[]; colors?: string[] }) {
  const w = 580, rowH = 40, pad = 10;
  const h = data.length * rowH + pad * 2;
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelW = 130, barX = labelW + 10, barMax = w - barX - 92;
  return <svg viewBox={`0 0 ${w} ${h}`} className="dv-chart" role="img">
    {data.map((d, i) => {
      const y = pad + i * rowH; const bw = barMax * (d.value / max); const col = (colors && colors[i]) || "#E8620E";
      const sub = d.sub != null && d.sub > 0 ? barMax * (d.sub / max) : 0;
      return <g key={i}>
        <text x={labelW} y={y + rowH / 2} textAnchor="end" dominantBaseline="middle" className="dv-lbl">{d.label}</text>
        <rect x={barX} y={y + 9} width={Math.max(3, bw)} height={rowH - 20} rx="4" fill={col}><title>{d.label}: {d.value}</title></rect>
        {sub > 0 && <rect x={barX} y={y + 9} width={Math.max(3, sub)} height={rowH - 20} rx="4" fill="#E5484D"><title>{d.label}: {d.sub} parados</title></rect>}
        <text x={barX + Math.max(3, bw) + 8} y={y + rowH / 2} dominantBaseline="middle" className="dv-val">{d.value}{d.sub != null && d.sub > 0 ? ` · ${d.sub} parados` : ""}</text>
      </g>;
    })}
  </svg>;
}

type CardSpec = { key: string; icon: string; iconClass: string; alert?: boolean; label: string; value: string; foot: string; title: string; subtitle: string; legend: string; chart: ReactNode };

export function RodagemCards({ accessToken, onNavigate }: { accessToken: string; onNavigate?: (module: string) => void }) {
  const [data, setData] = useState<Rodagem | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<CardSpec | null>(null);

  useEffect(() => {
    void fetch("/api/dashboard", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((j: { rodagem: Rodagem }) => setData(j.rodagem))
      .catch(() => setFailed(true));
  }, [accessToken]);

  const cards = useMemo<CardSpec[]>(() => {
    if (!data) return [];
    const pf = data.parados_faixa;
    const pctParados = data.open_deals > 0 ? Math.round(data.parados_7d / data.open_deals * 100) : 0;
    return [
      {
        key: "leads_dia", icon: "◎", iconClass: "orange", label: "Leads que entraram hoje", value: String(data.leads_today), foot: `${data.leads_week} nos últimos 7 dias`,
        title: "Entrada de leads", subtitle: "Últimos 14 dias", legend: "Quantos leads entraram por dia. Ajuda a ver picos e quedas de captação.",
        chart: <VBars data={data.leads_per_day.map((x) => ({ label: shortDay(x.d), value: x.n }))} />,
      },
      {
        key: "origem", icon: "↘", iconClass: "purple", label: "Leads na semana", value: String(data.leads_week), foot: "por canal de origem",
        title: "Origem dos leads", subtitle: "Últimos 7 dias", legend: "De onde vieram os leads recentes. Mostra em que canal investir.",
        chart: <HBars data={data.leads_by_origem.map((x) => ({ label: prettyOrigem(x.k), value: x.n }))} colors={CAT} />,
      },
      {
        key: "parados", icon: "◷", iconClass: "red", alert: true, label: "Negócios parados +7 dias", value: String(data.parados_7d), foot: `${pctParados}% do pipeline sem movimento`,
        title: "Negócios parados", subtitle: "Abertos, sem movimentação, por tempo parado", legend: "Quanto mais escuro/vermelho, mais crítico. Estes precisam de ação urgente.",
        chart: <HBars data={[{ label: "7 a 14 dias", value: pf.f7_14 }, { label: "14 a 30 dias", value: pf.f14_30 }, { label: "+30 dias", value: pf.f30 }]} colors={["#B5700A", "#E8620E", "#E5484D"]} />,
      },
      {
        key: "carteira", icon: "▦", iconClass: "teal", label: "Negócios abertos", value: String(data.open_deals), foot: "carteira ativa por corretor",
        title: "Carteira por corretor", subtitle: "Negócios abertos · em vermelho os parados +7d", legend: "Tamanho da carteira de cada corretor e quanto dela está travada.",
        chart: <HBars data={data.open_by_corretor.map((x) => ({ label: x.k, value: x.n, sub: x.parados }))} />,
      },
    ];
  }, [data]);

  if (failed) return null;

  return <>
    <div className="rodagem-head"><h2>Rodagem do atendimento</h2><small>Toque em um card para ver o gráfico</small></div>
    <section className="home-kpis rodagem-cards">
      {!data ? <article className="rodagem-skel">Carregando indicadores…</article> : cards.map((c) => (
        <article key={c.key} className={`drill${c.alert ? " is-alert" : ""}`} role="button" tabIndex={0}
          onClick={() => setActive(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(c); } }}>
          <i className={c.iconClass}>{c.icon}</i>
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
        <footer><span className="dv-legend">{active.legend}</span><button type="button" className="dv-cta" onClick={() => { setActive(null); onNavigate?.("CRM"); }}>Abrir no CRM →</button></footer>
      </div>
    </div>}
  </>;
}
