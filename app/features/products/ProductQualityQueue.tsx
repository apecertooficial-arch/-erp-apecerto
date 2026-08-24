import { summarizeQualityIssues } from "./product-domain";

export type ProductQualityQueueItem = {
  unitId: string;
  productId: string;
  codigo: string | null;
  numero: string | null;
  productName: string;
  segment: string;
  issues: string[];
};

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
  onOpen: (item: ProductQualityQueueItem) => void;
}) {
  return <section className="pv3-quality-queue">
    <header>
      <div>
        <h2>Qualidade do estoque</h2>
        <p>Cadastros que precisam de correção antes de serem apresentados ou publicados.</p>
      </div>
      <strong>{items.length} {items.length === 1 ? "unidade" : "unidades"}</strong>
    </header>
    {items.length ? <div className="pv3-quality-list">{items.map((item) => {
      const labels = summarizeQualityIssues(item.issues);
      return <button type="button" key={item.unitId} onClick={() => onOpen(item)}>
        <span className="pv3-quality-code">{item.codigo || `Unidade ${item.numero || "s/n"}`}</span>
        <span className="pv3-quality-title"><strong>{item.productName}</strong><small>{segmentLabels[item.segment] || item.segment}</small></span>
        <span className="pv3-quality-issues">{labels.map((label) => <em key={label}>{label}</em>)}</span>
        <span aria-hidden="true">→</span>
      </button>;
    })}</div> : <div className="pv3-empty"><strong>Nenhuma pendência de qualidade</strong><p>Seu estoque está consistente para os fluxos atuais.</p></div>}
  </section>;
}
