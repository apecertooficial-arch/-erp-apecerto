"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VBars, HBars, Sparkline, CompositionBar } from "./charts";

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

const CAT = ["#E8620E", "#8B00CC", "#16A39A", "#B5700A", "#2D7DD2"];
const TONE: Record<string, { c: string; t: string }> = {
  orange: { c: "#FF7000", t: "#FFE4D1" }, purple: { c: "#8B00CC", t: "#EBD1F5" },
  green: { c: "#1FA85A", t: "#CDEBD8" }, teal: { c: "#16A39A", t: "#CDEEE9" },
  amber: { c: "#F2A82C", t: "#FBE7C2" }, danger: { c: "#D93E3E", t: "#F3C9C9" },
};

function shortDay(iso: string) { const p = iso.split("-"); return `${p[2]}/${p[1]}`; }
function prettyOrigem(k: string) {
  const map: Record<string, string> = { automacao: "Automação", datacrazy_pipe: "DataCrazy (pipe)", datacrazy_mig: "DataCrazy (migração)", manual: "Manual" };
  return map[k] ?? k;
}

type CardSpec = { key: string; icon: string; tone: string; danger?: boolean; label: string; value: string; foot: string; micro: ReactNode; title: string; subtitle: string; legend: string; chart: ReactNode };

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
        micro: <Sparkline data={data.leads_per_day.slice(-7).map((x) => x.n)} color={TONE.orange.c} tint={TONE.orange.t} />,
        title: "Entrada de leads", subtitle: "Últimos 14 dias", legend: "Quantos leads entraram por dia. Ajuda a ver picos e quedas de captação.",
        chart: <VBars data={data.leads_per_day.map((x) => ({ label: shortDay(x.d), value: x.n }))} />,
      },
      {
        key: "atendidos", icon: "✓", tone: "green", label: "Taxa de atendimento hoje", value: `${ah.pct}%`, foot: `${ah.atendidos} de ${ah.recebidos} leads de hoje`,
        micro: <Sparkline data={data.atend_por_dia.map((x) => x.pct)} color={TONE.green.c} tint={TONE.green.t} />,
        title: "Taxa de atendimento", subtitle: "% dos leads do dia já atendidos — últimos 7 dias", legend: "Dos leads que entraram, quantos já receberam 1º atendimento do corretor.",
        chart: <VBars fmt={(v) => `${v}%`} data={data.atend_por_dia.map((x) => ({ label: shortDay(x.d), value: x.pct }))} />,
      },
      {
        key: "aguardando", icon: "◔", tone: "amber", label: "Aguardando atendimento", value: String(data.aguardando_total), foot: "leads recentes sem 1º contato",
        micro: <CompositionBar segments={data.aguardando_por_corretor.map((x) => x.n)} color={TONE.amber.c} />,
        title: "Aguardando atendimento", subtitle: "Leads dos últimos 30 dias ainda sem atendimento, por corretor", legend: "Backlog por corretor. Priorize quem tem mais leads parados na fila.",
        chart: <HBars data={data.aguardando_por_corretor.map((x) => ({ label: x.k, value: x.n }))} colors={data.aguardando_por_corretor.map(() => "#B5700A")} />,
      },
      {
        key: "parados", icon: "◷", tone: "danger", danger: true, label: "Negócios parados +7 dias", value: String(data.parados_7d), foot: `${pctParados}% do pipeline sem movimento`,
        micro: <CompositionBar segments={[pf.f7_14, pf.f14_30, pf.f30]} color={TONE.danger.c} />,
        title: "Negócios parados", subtitle: "Abertos, sem movimentação, por tempo parado", legend: "Quanto mais escuro/vermelho, mais crítico. Estes precisam de ação urgente.",
        chart: <HBars data={[{ label: "7 a 14 dias", value: pf.f7_14 }, { label: "14 a 30 dias", value: pf.f14_30 }, { label: "+30 dias", value: pf.f30 }]} colors={["#B5700A", "#E8620E", "#E5484D"]} />,
      },
      {
        key: "carteira", icon: "▦", tone: "teal", label: "Negócios abertos", value: String(data.open_deals), foot: `${pctParados}% parados · por corretor`,
        micro: <CompositionBar segments={[data.parados_7d, Math.max(0, data.open_deals - data.parados_7d)]} color={TONE.teal.c} />,
        title: "Carteira por corretor", subtitle: "Negócios abertos · em vermelho os parados +7d", legend: "Tamanho da carteira de cada corretor e quanto dela está travada.",
        chart: <HBars data={data.open_by_corretor.map((x) => ({ label: x.k, value: x.n, sub: x.parados }))} />,
      },
      {
        key: "origem", icon: "↘", tone: "purple", label: "Leads na semana", value: String(data.leads_week), foot: "por canal de origem",
        micro: <CompositionBar segments={data.leads_by_origem.map((x) => x.n)} color={TONE.purple.c} />,
        title: "Origem dos leads", subtitle: "Últimos 7 dias", legend: "De onde vieram os leads recentes. Mostra em que canal investir.",
        chart: <HBars data={data.leads_by_origem.map((x) => ({ label: prettyOrigem(x.k), value: x.n }))} colors={CAT} />,
      },
    ];
  }, [data]);

  if (failed) return null;

  return <>
    <div className="hv2-sec"><span className="hv2-sec-bar" /><h2>Rodagem do atendimento</h2><small>Toque em um card para ver o gráfico</small></div>
    <div className="hv2-grid c3">
      {!data ? <div className="hv2-card" style={{ opacity: .5 }}>Carregando…</div> : cards.map((c) => (
        <button key={c.key} type="button" className={`hv2-card t-${c.tone}${c.danger ? " val-danger" : ""}`} onClick={() => setActive(c)}>
          <div className="hv2-card-h"><span className="hv2-tile">{c.icon}</span><span className="hv2-card-t">{c.label}</span></div>
          <div className="hv2-val">{c.value}</div>
          {c.micro}
          <div className="hv2-sup">{c.foot}</div>
          <em className="hv2-cta">ver gráfico →</em>
        </button>
      ))}
    </div>

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
