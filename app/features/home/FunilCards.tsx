"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { VBars, HBars, Sparkline, CompositionBar } from "./charts";

type Funil = {
  open_deals: number;
  macro_fases: { k: string; n: number }[];
  em_risco_total: number;
  em_risco_por_corretor: { k: string; n: number }[];
  conv_por_mes: { m: string; leads: number; vendas: number; pct: number }[];
};

const TONE: Record<string, { c: string; t: string }> = {
  orange: { c: "#FF7000", t: "#FFE4D1" }, purple: { c: "#8B00CC", t: "#EBD1F5" }, danger: { c: "#D93E3E", t: "#F3C9C9" },
};

function monthLabel(m: string) { const mm = Number(m.split("-")[1]); return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][mm - 1] ?? m; }
function faseLabel(k: string) { return k.replace(/^\d+\s·\s/, ""); }

type CardSpec = { key: string; icon: string; tone: string; danger?: boolean; label: string; value: string; foot: string; micro: ReactNode; title: string; subtitle: string; legend: string; chart: ReactNode };

export function FunilCards({ accessToken, onNavigate }: { accessToken: string; onNavigate?: (module: string) => void }) {
  const [data, setData] = useState<Funil | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<CardSpec | null>(null);

  useEffect(() => {
    void fetch("/api/dashboard?section=funil", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((j: { funil: Funil }) => setData(j.funil))
      .catch(() => setFailed(true));
  }, [accessToken]);

  const cards = useMemo<CardSpec[]>(() => {
    if (!data) return [];
    const last = data.conv_por_mes[data.conv_por_mes.length - 1];
    return [
      {
        key: "funil", icon: "▤", tone: "orange", label: "Negócios no funil", value: String(data.open_deals), foot: "abertos, por macro-fase",
        micro: <CompositionBar segments={data.macro_fases.map((x) => x.n)} color={TONE.orange.c} />,
        title: "Funil ativo", subtitle: "Negócios abertos agrupados em macro-fases", legend: "As ~30 etapas do CRM agrupadas em fases legíveis (só no painel — o CRM não muda).",
        chart: <HBars data={data.macro_fases.map((x) => ({ label: faseLabel(x.k), value: x.n }))} colors={data.macro_fases.map((_, i) => ["#B5700A", "#E8620E", "#F0A500", "#2D7DD2", "#8B00CC", "#12A150", "#16A39A", "#E5484D"][i % 8])} />,
      },
      {
        key: "conversao", icon: "↺", tone: "purple", label: "Conversão do mês", value: `${last ? last.pct : 0}%`, foot: last ? `${last.vendas} vendas · ${last.leads} leads` : "—",
        micro: <Sparkline data={data.conv_por_mes.map((x) => x.pct)} color={TONE.purple.c} tint={TONE.purple.t} />,
        title: "Taxa de conversão", subtitle: "Vendas ÷ leads do mês — últimos 6 meses", legend: "Proporção de leads que viraram venda no mês. Cai quando a captação escala mais rápido que o atendimento.",
        chart: <VBars fmt={(v) => `${v}%`} data={data.conv_por_mes.map((x) => ({ label: monthLabel(x.m), value: x.pct }))} />,
      },
      {
        key: "risco", icon: "⚠", tone: "danger", danger: true, label: "Negócios em risco", value: String(data.em_risco_total), foot: "em visita/negociação parados +7d",
        micro: <CompositionBar segments={data.em_risco_por_corretor.map((x) => x.n)} color={TONE.danger.c} />,
        title: "Negócios em risco", subtitle: "Perto de fechar (visita/negociação) e travados há +7 dias", legend: "São os mais caros de perder: já avançaram no funil e estão parando. Priorize por corretor.",
        chart: <HBars data={data.em_risco_por_corretor.map((x) => ({ label: x.k, value: x.n }))} colors={data.em_risco_por_corretor.map(() => "#E5484D")} />,
      },
    ];
  }, [data]);

  if (failed) return null;

  return <>
    <div className="hv2-sec"><span className="hv2-sec-bar purple" /><h2>Funil e conversão</h2><small>Toque em um card para ver o gráfico</small></div>
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
