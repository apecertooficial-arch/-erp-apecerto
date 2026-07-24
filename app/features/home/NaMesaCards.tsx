"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HBars, CompositionBar } from "./charts";

type NaMesa = {
  total_count: number; total_vgv: number; aguardando_pgto: number;
  por_etapa: { k: string; n: number; vgv: number }[];
};

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });
const TONE: Record<string, { c: string; t: string }> = {
  orange: { c: "#FF7000", t: "#FFE4D1" }, purple: { c: "#8B00CC", t: "#EBD1F5" }, green: { c: "#1FA85A", t: "#CDEBD8" },
};
// Ordem e nomes das etapas da esteira (pré-registro).
const ETAPA: Record<string, { nome: string; ordem: number }> = {
  inicio: { nome: "Pedido aprovado", ordem: 1 },
  doc_comp: { nome: "Doc. comprador", ordem: 2 },
  doc_vend: { nome: "Doc. vendedor", ordem: 3 },
  contrato: { nome: "Contrato", ordem: 4 },
  minuta_cnd: { nome: "Minuta + CNDs", ordem: 5 },
  minuta_env: { nome: "Assinatura", ordem: 6 },
  pagamento: { nome: "Aguardando pagamento", ordem: 7 },
};

type CardSpec = { key: string; icon: string; tone: string; label: string; value: string; foot: string; micro: ReactNode; title: string; subtitle: string; legend: string; chart: ReactNode };

export function NaMesaCards({ accessToken, onNavigate }: { accessToken: string; onNavigate?: (module: string) => void }) {
  const [data, setData] = useState<NaMesa | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<CardSpec | null>(null);

  useEffect(() => {
    void fetch("/api/dashboard?section=namesa", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((j: { naMesa: NaMesa }) => setData(j.naMesa))
      .catch(() => setFailed(true));
  }, [accessToken]);

  const cards = useMemo<CardSpec[]>(() => {
    if (!data) return [];
    const etapas = [...data.por_etapa].sort((a, b) => (ETAPA[a.k]?.ordem ?? 99) - (ETAPA[b.k]?.ordem ?? 99));
    const label = (k: string) => ETAPA[k]?.nome ?? k;
    return [
      {
        key: "count", icon: "▤", tone: "orange", label: "Negócios na mesa", value: String(data.total_count), foot: "rodando na esteira, em aberto",
        micro: <CompositionBar segments={etapas.map((e) => e.n)} color={TONE.orange.c} />,
        title: "Negócios na mesa", subtitle: "Vendas na esteira (pedido aprovado → aguardando pagamento), ainda em aberto", legend: "Negócios em processo de fechamento. Venda já concluída não entra aqui.",
        chart: <HBars data={etapas.map((e) => ({ label: label(e.k), value: e.n }))} colors={etapas.map((_, i) => ["#FF7000", "#E66200", "#F2A82C", "#8B00CC", "#7A1FA2", "#2D7DD2", "#1FA85A"][i % 7])} />,
      },
      {
        key: "vgv", icon: "↗", tone: "purple", label: "VGV na mesa", value: compact.format(data.total_vgv), foot: "potencial em fechamento",
        micro: <CompositionBar segments={etapas.map((e) => e.vgv)} color={TONE.purple.c} />,
        title: "VGV na mesa", subtitle: "Volume das vendas em processo, por etapa", legend: "Soma do VGV dos negócios que estão na esteira. Vira meta só quando a venda é concluída.",
        chart: <HBars fmt={(v) => compact.format(v)} data={etapas.map((e) => ({ label: label(e.k), value: e.vgv }))} colors={etapas.map((_, i) => ["#FF7000", "#E66200", "#F2A82C", "#8B00CC", "#7A1FA2", "#2D7DD2", "#1FA85A"][i % 7])} />,
      },
      {
        key: "pgto", icon: "$", tone: "green", label: "Aguardando pagamento", value: String(data.aguardando_pgto), foot: "na reta final da esteira",
        micro: <CompositionBar segments={etapas.map((e) => (e.k === "pagamento" ? e.n : 0))} color={TONE.green.c} />,
        title: "Aguardando pagamento", subtitle: "Negócios na última etapa antes de registrar", legend: "Estão a um passo de virar venda registrada — priorize a cobrança/registro.",
        chart: <HBars data={etapas.map((e) => ({ label: label(e.k), value: e.n }))} colors={etapas.map((e) => (e.k === "pagamento" ? "#1FA85A" : "#D8D2CB"))} />,
      },
    ];
  }, [data]);

  if (failed) return null;

  return <>
    <div className="hv2-sec"><span className="hv2-sec-bar" /><h2>Na mesa</h2><small>Negócios rodando na esteira de vendas</small></div>
    <div className="hv2-grid c3">
      {!data ? <div className="hv2-card" style={{ opacity: .5 }}>Carregando…</div> : cards.map((c) => (
        <button key={c.key} type="button" className={`hv2-card t-${c.tone}`} onClick={() => setActive(c)}>
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
        <footer><span className="dv-legend">{active.legend}</span><button type="button" className="dv-cta" onClick={() => { setActive(null); onNavigate?.("Financeiro"); }}>Abrir Financeiro →</button></footer>
      </div>
    </div>}
  </>;
}
