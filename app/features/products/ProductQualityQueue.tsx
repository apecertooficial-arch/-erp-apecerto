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

export function ProductQualityQueue({
  items,
  onOpen,
}: {
  items: ProductQualityQueueItem[];
  onOpen: (item: ProductQualityQueueItem, action: QualityRepairAction) => void;
}) {
  const [query, setQuery] = useState("");
  const [issue, setIssue] = useState("todos");
  const visible = useMemo(() => filterQualityQueue(items, query, issue), [items, query, issue]);
  const counts = useMemo(() => Object.fromEntries(issueFilters.map(([key]) => [
    key,
    key === "todos" ? items.length : items.filter((item) => item.issues.includes(key)).length,
  ])), [items]);

  return <section className="pv3-quality-queue">
    <header>
      <div>
        <h2>Qualidade do estoque</h2>
        <p>Corrija dados reais antes de apresentar ou publicar. O ERP não completa preço, foto ou proprietário por suposição.</p>
      </div>
      <strong>{items.length} {items.length === 1 ? "unidade" : "unidades"}</strong>
    </header>
    {items.length ? <>
      <div className="pv3-quality-toolbar">
        <label><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código AP, unidade ou produto" /></label>
        <div aria-label="Filtrar pendências">{issueFilters.map(([key, label]) => <button type="button" key={key} className={issue === key ? "active" : ""} onClick={() => setIssue(key)}>{label} <b>{counts[key]}</b></button>)}</div>
      </div>
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
    </> : <div className="pv3-empty"><strong>Nenhuma pendência de qualidade</strong><p>Seu estoque está consistente para os fluxos atuais.</p></div>}
  </section>;
}
