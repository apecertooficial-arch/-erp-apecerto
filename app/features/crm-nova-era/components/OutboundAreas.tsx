"use client";
/**
 * OutboundAreas — áreas demonstrativas de SAÍDA do CRM (Fase 1.1):
 * "Encaminhados para Pipeline de Visitas" e "Encaminhados para Esteira de Vendas".
 * Leads aqui NÃO aparecem nas colunas nem na fila; apenas resumo + ação demo.
 */
import { saidaDoLead, type LeadNova } from "../lib/rules";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function OutboundAreas({
  leads,
  selectedId,
  onOpenAction,
  onDemoNavegarAction,
}: {
  leads: LeadNova[];
  selectedId: string | null;
  onOpenAction: (id: string) => void;
  onDemoNavegarAction: (destino: string) => void;
}) {
  const visitas = leads.filter((l) => saidaDoLead(l) === "pipeline_visitas");
  const esteira = leads.filter((l) => saidaDoLead(l) === "esteira_vendas");
  if (visitas.length === 0 && esteira.length === 0) return null;
  return (
    <div className="nova-crm-outbound">
      {visitas.length > 0 && (
        <section className="nova-crm-out-area" aria-label="Encaminhados para Pipeline de Visitas">
          <div className="nova-crm-out-head">
            <strong>Encaminhados para Pipeline de Visitas</strong>
            <button className="nova-crm-btn ghost" onClick={() => onDemoNavegarAction("Pipeline de Visitas")}>
              Ver Pipeline (demonstrativo)
            </button>
          </div>
          {visitas.map((l) => (
            <div
              key={l.id}
              className={`nova-crm-out-item ${selectedId === l.id ? "sel" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpenAction(l.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenAction(l.id); } }}
            >
              <strong>{l.nome}</strong>
              <span>Visita: {fmt(l.visitaAgendadaEm)} · {l.corretorNome}</span>
            </div>
          ))}
        </section>
      )}
      {esteira.length > 0 && (
        <section className="nova-crm-out-area" aria-label="Encaminhados para Esteira de Vendas">
          <div className="nova-crm-out-head">
            <strong>Encaminhados para Esteira de Vendas</strong>
            <button className="nova-crm-btn ghost" onClick={() => onDemoNavegarAction("Esteira de Vendas")}>
              Ver Esteira (demonstrativo)
            </button>
          </div>
          {esteira.map((l) => (
            <div
              key={l.id}
              className={`nova-crm-out-item ${selectedId === l.id ? "sel" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpenAction(l.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenAction(l.id); } }}
            >
              <strong>{l.nome}</strong>
              <span>
                Proposta: {l.proposta ? `${l.proposta.produto} · ${fmtMoeda(l.proposta.valor)} · ${fmt(l.proposta.data)}` : "—"}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
