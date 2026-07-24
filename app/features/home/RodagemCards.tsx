"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VBars, HBars } from "./charts";

type Rodagem = {
  leads_today: number; leads_week: number; leads_total: number; open_deals: number; parados_7d: number;
  leads_per_day: { d: string; n: number }[];
  leads_by_origem: { k: string; n: number }[];
  parados_faixa: { f7_14: number; f14_30: number; f30: number };
  open_by_corretor: { k: string; n: number; parados: number }[];
  atend_hoje: { recebidos: number; atendidos: number; pct: number };
  atend_por_dia: { d: string; pct: number }[];
  tempo_resp_min: number;
  aguardando_total: number;
  aguardando_por_corretor: { k: string; n: number }[];
};

// Paleta categórica validada (dataviz): laranja, roxo, teal, âmbar escuro, azul.
const CAT = ["#E8620E", "#8B00CC", "#16A39A", "#B5700A", "#2D7DD2"];

function shortDay(iso: string) { const p = iso.split("-"); return `${p[2]}/${p[1]}`; }
function prettyOrigem(k: string) {
  const map: Record<string, string> = { automacao: "Automação", datacrazy_pipe: "DataCrazy (pipe)", datacrazy_mig: "DataCrazy (migração)", manual: "Manual" };
  return map[k] ?? k;
}

type CardSpec = { key: string; icon: string; tone: string; label: string; value: string; foot: string; title: string; subtitle: string; legend: string; chart: ReactNode };

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
    const ah = data.atend_hoje;
    return [
      {
        key: "leads_dia", icon: "◎", tone: "orange", label: "Leads que entraram hoje", value: String(data.leads_today), foot: `${data.leads_week} nos últimos 7 dias`,
        title: "Entrada de leads", subtitle: "Últimos 14 dias", legend: "Quantos leads entraram por dia. Ajuda a ver picos e quedas de captação.",
        chart: <VBars data={data.leads_per_day.map((x) => ({ label: shortDay(x.d), value: x.n }))} />,
      },
      {
        key: "atendidos", icon: "✓", tone: "green", label: "Taxa de atendimento hoje", value: `${ah.pct}%`, foot: `${ah.atendidos} de ${ah.recebidos} leads de hoje`,
        title: "Taxa de atendimento", subtitle: "% dos leads do dia já atendidos — últimos 7 dias", legend: "Dos leads que entraram, quantos já receberam 1º atendimento do corretor.",
        chart: <VBars fmt={(v) => `${v}%`} data={data.atend_por_dia.map((x) => ({ label: shortDay(x.d), value: x.pct }))} />,
      },
      {
        key: "aguardando", icon: "◔", tone: "amber", label: "Aguardando atendimento", value: String(data.aguardando_total), foot: "leads recentes sem 1º contato",
        title: "Aguardando atendimento", subtitle: "Leads dos últimos 30 dias ainda sem atendimento, por corretor", legend: "Backlog por corretor. Priorize quem tem mais leads parados na fila.",
        chart: <HBars data={data.aguardando_por_corretor.map((x) => ({ label: x.k, value: x.n }))} colors={data.aguardando_por_corretor.map(() => "#B5700A")} />,
      },
      {
        key: "parados", icon: "◷", tone: "red", label: "Negócios parados +7 dias", value: String(data.parados_7d), foot: `${pctParados}% do pipeline sem movimento`,
        title: "Negócios parados", subtitle: "Abertos, sem movimentação, por tempo parado", legend: "Quanto mais escuro/vermelho, mais crítico. Estes precisam de ação urgente.",
        chart: <HBars data={[{ label: "7 a 14 dias", value: pf.f7_14 }, { label: "14 a 30 dias", value: pf.f14_30 }, { label: "+30 dias", value: pf.f30 }]} colors={["#B5700A", "#E8620E", "#E5484D"]} />,
      },
      {
        key: "carteira", icon: "▦", tone: "teal", label: "Negócios abertos", value: String(data.open_deals), foot: "carteira ativa por corretor",
        title: "Carteira por corretor", subtitle: "Negócios abertos · em vermelho os parados +7d", legend: "Tamanho da carteira de cada corretor e quanto dela está travada.",
        chart: <HBars data={data.open_by_corretor.map((x) => ({ label: x.k, value: x.n, sub: x.parados }))} />,
      },
      {
        key: "origem", icon: "↘", tone: "purple", label: "Leads na semana", value: String(data.leads_week), foot: "por canal de origem",
        title: "Origem dos leads", subtitle: "Últimos 7 dias", legend: "De onde vieram os leads recentes. Mostra em que canal investir.",
        chart: <HBars data={data.leads_by_origem.map((x) => ({ label: prettyOrigem(x.k), value: x.n }))} colors={CAT} />,
      },
    ];
  }, [data]);

  if (failed) return null;

  return <>
    <div className="rodagem-head"><h2>Rodagem do atendimento</h2><small>Toque em um card para ver o gráfico</small></div>
    <section className="home-kpis rodagem-cards">
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
        <footer><span className="dv-legend">{active.legend}</span><button type="button" className="dv-cta" onClick={() => { setActive(null); onNavigate?.("CRM"); }}>Abrir no CRM →</button></footer>
      </div>
    </div>}
  </>;
}
