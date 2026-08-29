import { rotuloTemperatura, type LeadFunil2, type TemperaturaLead } from "./modelo";

export type TemperaturaFiltro = TemperaturaLead | "aguardando" | "todas";

export const TEMPERATURAS: ReadonlyArray<{ codigo: Exclude<TemperaturaFiltro, "todas">; rotulo: string }> = [
  { codigo: "quente", rotulo: "Quente" },
  { codigo: "negociando", rotulo: "Negociando" },
  { codigo: "morno", rotulo: "Morno" },
  { codigo: "frio", rotulo: "Frio" },
  { codigo: "aguardando", rotulo: "Aguardando leitura" },
];

export function temperaturaDoLead(lead: LeadFunil2): Exclude<TemperaturaFiltro, "todas"> {
  return lead.temperatura ?? "aguardando";
}

export function ChipTemperatura({ lead, className = "", compacto = false }: { lead: LeadFunil2; className?: string; compacto?: boolean }) {
  const codigo = temperaturaDoLead(lead);
  const rotulo = rotuloTemperatura(lead.temperatura) ?? (compacto ? "Sem leitura" : "Aguardando leitura");
  return <span className={`f2-lead-chip temperatura temperatura-${codigo} ${className}`.trim()}><i />{rotulo}</span>;
}

export function FiltrosTemperatura({ leads, valor, onChange, className = "" }: { leads: LeadFunil2[]; valor: TemperaturaFiltro; onChange: (valor: TemperaturaFiltro) => void; className?: string }) {
  return <div className={`f2-temperatura-filtros ${className}`.trim()} role="group" aria-label="Filtrar por temperatura">
    <span>TEMPERATURA</span>
    <button type="button" className={valor === "todas" ? "ativo" : ""} onClick={() => onChange("todas")}>Todas <b>{leads.length}</b></button>
    {TEMPERATURAS.map((item) => <button type="button" key={item.codigo} className={`${valor === item.codigo ? "ativo " : ""}temperatura-${item.codigo}`} onClick={() => onChange(item.codigo)}><i />{item.rotulo} <b>{leads.filter((lead) => temperaturaDoLead(lead) === item.codigo).length}</b></button>)}
  </div>;
}

export function InteresseLead({ lead, detalhado = false }: { lead: LeadFunil2; detalhado?: boolean }) {
  if (!lead.interesse && !(lead.tags?.length)) return null;
  const titulo = (lead.tags ?? []).map((tag) => tag.nome).join(" · ");
  return <span className={`f2-interesse-lead${detalhado ? " detalhado" : ""}`} title={titulo || undefined}>
    <b>{lead.interesse ? "Interesse" : "Tags"}</b>
    <strong>{lead.interesse ?? `${lead.tags?.length ?? 0} associada(s)`}</strong>
    {(lead.tags?.length ?? 0) > 1 ? <em>{lead.tags!.length} tags</em> : null}
  </span>;
}

export function IconeConversa() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.9L3 21l1.6-4.4A8.3 8.3 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.5 8.4 8.4 0 0 1 9 8.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>;
}

export function IconeOperacional({ nome }: { nome: "mais" | "adicionar" | "momento" | "acao" | "prazo" | "interesse" }) {
  const caminho = nome === "mais"
    ? <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>
    : nome === "adicionar" ? <path d="M12 5v14M5 12h14" />
    : nome === "momento" ? <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>
    : nome === "acao" ? <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></>
    : nome === "prazo" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
    : <><path d="M20 13 13 20l-9-9V4h7Z" /><circle cx="8.5" cy="8.5" r="1" /></>;
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{caminho}</svg>;
}

export function valorResumido(valor: number | null | undefined) {
  if (!valor || valor <= 0) return "Valor não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(valor);
}
