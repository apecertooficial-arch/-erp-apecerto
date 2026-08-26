"use client";

import { useMemo, useState } from "react";
import {
  filterQualityQueue,
  qualityRepairAction,
  summarizeQualityIssues,
  type QualityRepairAction,
} from "./product-domain";

export type ProductQualityQueueItem = {
  unitId: string;
  productId: string;
  codigo: string | null;
  numero: string | null;
  productName: string;
  segment: string;
  issues: string[];
  capturedBy?: string | null;
};

export type ProductQualityScoreItem = {
  productId: string;
  unitId?: string | null;
  codigo?: string | null;
  productName: string;
  segment: string;
  score: number;
  label: string;
  level: string;
  readyForSite: boolean;
  blocking: string[];
  warnings: string[];
};

const issueFilters = [
  ["todos", "Todas"],
  ["sem_foto_propria", "Sem foto própria"],
  ["preco_invalido", "Preço inválido"],
  ["sem_proprietario", "Proprietário"],
  ["sem_captador", "Captador"],
  ["sem_condominio_referencia", "Condomínio"],
] as const;

const segmentLabels: Record<string, string> = {
  terceiros: "Terceiros",
  lancamento: "Lançamento",
  remanescente: "Remanescente",
};

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ProductQualityQueue({ items, scoredItems, onOpen, onOpenScore }: {
  items: ProductQualityQueueItem[];
  scoredItems: ProductQualityScoreItem[];
  onOpen: (item: ProductQualityQueueItem, action: QualityRepairAction) => void;
  onOpenScore: (item: ProductQualityScoreItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [issue, setIssue] = useState("todos");
  const visible = useMemo(() => filterQualityQueue(items, query, issue), [items, query, issue]);
  const belowStandard = useMemo(() => {
    const queryKey = normalized(query);
    return scoredItems
      .filter((item) => !item.readyForSite)
      .filter((item) => !queryKey || [item.codigo, item.productName, item.segment, ...item.blocking, ...item.warnings].some((value) => normalized(value).includes(queryKey)))
      .sort((a, b) => a.score - b.score);
  }, [scoredItems, query]);
  const average = scoredItems.length ? Math.round(scoredItems.reduce((sum, item) => sum + item.score, 0) / scoredItems.length) : 0;
  const highQuality = scoredItems.filter((item) => item.readyForSite && item.score >= 80).length;
  const counts = useMemo(() => Object.fromEntries(issueFilters.map(([key]) => [key, key === "todos" ? items.length : items.filter((item) => item.issues.includes(key)).length])), [items]);

  return <section className="pv3-quality-queue">
    <header><div><h2>Qualidade do estoque</h2><p>Nota mínima 80 para publicar. Corrija dados reais antes de apresentar um imóvel no site.</p></div><strong>{belowStandard.length} abaixo do padrão</strong></header>

    <div className="pv3-quality-scorecards" aria-label="Resumo das notas de qualidade">
      <article><span>Nota média</span><strong>{average}</strong><small>de 100 pontos</small></article>
      <article className="good"><span>Nota alta</span><strong>{highQuality}</strong><small>aptos com 80+</small></article>
      <article className="warning"><span>Precisam melhorar</span><strong>{belowStandard.length}</strong><small>bloqueados para o site</small></article>
      <article><span>Avaliados</span><strong>{scoredItems.length}</strong><small>imóveis comerciais</small></article>
    </div>

    <div className="pv3-quality-toolbar"><label><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código AP, unidade ou produto" /></label></div>

    <section className="pv3-quality-score-section" aria-labelledby="quality-below-title">
      <div><h3 id="quality-below-title">Imóveis que precisam melhorar</h3><p>Ordenados da menor nota para a maior. Abra a ficha para ver exatamente o que falta.</p></div>
      {belowStandard.length ? <div className="pv3-quality-score-list">{belowStandard.map((item) => <button type="button" key={item.unitId ?? item.productId} onClick={() => onOpenScore(item)}>
        <span className={`pv3-quality-score ${item.level}`}>{item.score}</span>
        <span><strong>{item.productName}</strong><small>{item.codigo || "Código pendente"} · {segmentLabels[item.segment] || item.segment}</small></span>
        <span>{item.blocking[0] || item.warnings[0] || "Elevar a apresentação comercial"}</span><em>Corrigir ficha →</em>
      </button>)}</div> : <div className="pv3-empty"><strong>Nenhum imóvel abaixo do padrão</strong><p>Todos os imóveis avaliados atingiram a nota mínima e não têm bloqueios.</p></div>}
    </section>

    {items.length ? <section className="pv3-quality-operational">
      <div><h3>Pendências cadastrais de unidades</h3><p>Problemas operacionais específicos que precisam de correção.</p></div>
      <div className="pv3-quality-toolbar"><div aria-label="Filtrar pendências cadastrais">{issueFilters.map(([key, label]) => <button type="button" key={key} className={issue === key ? "active" : ""} onClick={() => setIssue(key)}>{label} <b>{counts[key]}</b></button>)}</div></div>
      <p className="pv3-quality-result">Mostrando <strong>{visible.length}</strong> de {items.length} unidades com correção.</p>
      {visible.length ? <div className="pv3-quality-list">{visible.map((item) => {
        const labels = summarizeQualityIssues(item.issues);
        const action = qualityRepairAction(item.issues);
        return <button type="button" key={item.unitId} onClick={() => onOpen(item, action)}>
          <span className="pv3-quality-code">{item.codigo || `Unidade ${item.numero || "s/n"}`}</span>
          <span className="pv3-quality-title"><strong>{item.productName}</strong><small>{segmentLabels[item.segment] || item.segment}{item.capturedBy ? ` · ${item.capturedBy}` : ""}</small></span>
          <span className="pv3-quality-issues">{labels.map((label) => <em key={label}>{label}</em>)}</span>
          <span className="pv3-quality-action">{action === "media" ? "Corrigir fotos" : action === "edit" ? "Corrigir cadastro" : "Ver orientação"} →</span>
        </button>;
      })}</div> : <div className="pv3-empty"><strong>Nenhuma pendência neste filtro</strong><p>Altere a busca ou escolha outro tipo de correção.</p></div>}
    </section> : null}
  </section>;
}
