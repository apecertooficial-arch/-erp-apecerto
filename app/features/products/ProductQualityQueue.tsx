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
  updatedAt?: string | null;
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
  manager = false,
}: {
  items: ProductQualityQueueItem[];
  onOpen: (item: ProductQualityQueueItem, action: QualityRepairAction) => void;
  manager?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [issue, setIssue] = useState("todos");
  const [captador, setCaptador] = useState("todos");
  const [segment, setSegment] = useState("todos");
  const [severity, setSeverity] = useState("todos");
  const [renderedAt] = useState(() => Date.now());
  const visible = useMemo(() => filterQualityQueue(items, query, issue).filter((item) => {
    if (captador !== "todos" && (item.capturedBy || "Sem responsável") !== captador) return false;
    if (segment !== "todos" && item.segment !== segment) return false;
    const critical = item.issues.some((value) => ["preco_invalido", "sem_proprietario", "sem_captador"].includes(value));
    return severity === "todos" || (severity === "critico" ? critical : !critical);
  }), [items, query, issue, captador, segment, severity]);
  const counts = useMemo(() => Object.fromEntries(issueFilters.map(([key]) => [
    key,
    key === "todos" ? items.length : items.filter((item) => item.issues.includes(key)).length,
  ])), [items]);
  const captadores = useMemo(() => [...new Set(items.map((item) => item.capturedBy || "Sem responsável"))].sort(), [items]);

  function waitingLabel(value?: string | null) {
    const timestamp = value ? new Date(value).getTime() : NaN;
    if (!Number.isFinite(timestamp)) return "Tempo não informado";
    const days = Math.max(0, Math.floor((renderedAt - timestamp) / 86_400_000));
    return days === 0 ? "Atualizado hoje" : `Parado há ${days} dia${days === 1 ? "" : "s"}`;
  }

  return <section className="pv3-quality-queue">
    <header>
      <div>
        <h2>{manager ? "Central de decisões" : "Qualidade do estoque"}</h2>
        <p>{manager ? "Exceções comerciais ordenadas por risco, responsável e tempo parado." : "Corrija dados reais antes de apresentar ou publicar. O ERP não completa preço, foto ou proprietário por suposição."}</p>
      </div>
      <strong>{items.length} {items.length === 1 ? "unidade" : "unidades"}</strong>
    </header>
    {items.length ? <>
      <div className="pv3-quality-toolbar">
        <label><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código AP, unidade ou produto" /></label>
        <div aria-label="Filtrar pendências">{issueFilters.map(([key, label]) => <button type="button" key={key} className={issue === key ? "active" : ""} onClick={() => setIssue(key)}>{label} <b>{counts[key]}</b></button>)}</div>
        {manager && <div className="pv3-decision-filters"><select aria-label="Severidade" value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="todos">Toda severidade</option><option value="critico">Risco imediato</option><option value="importante">Bloqueios operacionais</option></select><select aria-label="Responsável" value={captador} onChange={(event) => setCaptador(event.target.value)}><option value="todos">Toda a equipe</option>{captadores.map((name) => <option key={name}>{name}</option>)}</select><select aria-label="Tipo de estoque" value={segment} onChange={(event) => setSegment(event.target.value)}><option value="todos">Todo o estoque</option><option value="terceiros">Terceiros</option><option value="lancamento">Lançamentos</option><option value="remanescente">Remanescentes</option></select></div>}
      </div>
      <p className="pv3-quality-result">Mostrando <strong>{visible.length}</strong> de {items.length} unidades com correção.</p>
      {visible.length ? <div className="pv3-quality-list">{visible.map((item) => {
      const labels = summarizeQualityIssues(item.issues);
      const action = qualityRepairAction(item.issues);
      return <button type="button" key={item.unitId} onClick={() => onOpen(item, action)}>
        <span className="pv3-quality-code">{item.codigo || `Unidade ${item.numero || "s/n"}`}</span>
        <span className="pv3-quality-title"><strong>{item.productName}</strong><small>{segmentLabels[item.segment] || item.segment}{item.capturedBy ? ` · ${item.capturedBy}` : " · Sem responsável"}</small><small className="pv3-quality-time">{waitingLabel(item.updatedAt)}</small></span>
        <span className="pv3-quality-issues">{labels.map((label) => <em key={label}>{label}</em>)}</span>
        <span className="pv3-quality-action">{action === "media" ? "Corrigir fotos" : action === "edit" ? "Corrigir cadastro" : "Ver orientação"} →</span>
      </button>;
    })}</div> : <div className="pv3-empty"><strong>Nenhuma pendência neste filtro</strong><p>Altere a busca ou escolha outro tipo de correção.</p></div>}
    </> : <div className="pv3-empty"><strong>Nenhuma pendência de qualidade</strong><p>Seu estoque está consistente para os fluxos atuais.</p></div>}
  </section>;
}
