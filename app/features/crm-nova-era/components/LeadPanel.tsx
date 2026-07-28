"use client";
/**
 * LeadPanel — ficha lateral (Fase 1.1).
 * Lead em SAÍDA (visita/proposta/descartado/nutrição): mostra somente o
 * resumo da saída e a opção demonstrativa de visualizar o destino — sem
 * botões de tentativa, visita ou prospecção.
 * Lead no quadro: coach ("Como atender"), trilha de interações e ações.
 */
import {
  calcularAtraso,
  sugerirProximaTentativa,
  sugerirProximoPasso,
  saidaDoLead,
  type CadenciaPlano,
  type LeadNova,
  type SeveridadeConfig,
} from "../lib/rules";
import { CadenceTimeline } from "./CadenceTimeline";
import type { ModalTipo } from "./ActionModals";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function LeadPanel({
  lead,
  agoraISO,
  plano,
  severidade,
  onAbrirModalAction,
  onDemoNavegarAction,
  onClose,
}: {
  lead: LeadNova;
  agoraISO: string;
  plano: CadenciaPlano;
  severidade: SeveridadeConfig;
  onAbrirModalAction: (t: ModalTipo) => void;
  onDemoNavegarAction: (destino: string) => void;
  onClose: () => void;
}) {
  const saida = saidaDoLead(lead);
  const sugestao = sugerirProximoPasso(lead, agoraISO, plano, severidade);
  const sugestaoTentativa = sugerirProximaTentativa(lead, plano);
  const atraso = calcularAtraso(lead, agoraISO, severidade);

  return (
    <aside className="nova-crm-panel" aria-label={`Ficha de ${lead.nome}`}>
      <div className="nova-crm-panel-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <h2>{lead.nome}</h2>
            <div className="sub">{lead.origem} · {lead.corretorNome} · tel. demo {lead.telefone}</div>
          </div>
          <button className="nova-crm-btn ghost" onClick={onClose} aria-label="Fechar ficha">✕</button>
        </div>
      </div>

      {/* ============ FICHA DE LEAD EM SAÍDA: somente resumo ============ */}
      {saida !== null ? (
        <div className="nova-crm-panel-sec">
          <h3>Resumo da saída</h3>
          <div className="nova-crm-coach">
            <div className="t">{sugestao.titulo}</div>
            <div className="d">{sugestao.detalhe}</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
            {saida === "pipeline_visitas" && (
              <>
                <div><b>Visita agendada:</b> {fmt(lead.visitaAgendadaEm)}</div>
                <div><b>Última interação:</b> {fmt(lead.ultimaInteracaoEm)}</div>
              </>
            )}
            {saida === "esteira_vendas" && lead.proposta && (
              <>
                <div><b>Proposta registrada:</b> {lead.proposta.produto}</div>
                <div><b>Valor:</b> {fmtMoeda(lead.proposta.valor)}</div>
                <div><b>Data da proposta:</b> {fmt(lead.proposta.data)}</div>
                {lead.proposta.observacao && <div><b>Observação:</b> {lead.proposta.observacao}</div>}
              </>
            )}
            {saida === "descartado" && <div><b>Motivo do descarte:</b> {lead.descartadoMotivo}</div>}
            {saida === "nutricao" && <div>Arquivado formalmente para nutrição futura.</div>}
          </div>
          <div className="nova-crm-actions" style={{ marginTop: 14 }}>
            {saida === "pipeline_visitas" && (
              <button className="nova-crm-btn primary" onClick={() => onDemoNavegarAction("Pipeline de Visitas")}>
                Visualizar Pipeline de Visitas (demonstrativo)
              </button>
            )}
            {saida === "esteira_vendas" && (
              <button className="nova-crm-btn primary" onClick={() => onDemoNavegarAction("Esteira de Vendas")}>
                Visualizar Esteira de Vendas (demonstrativo)
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#9aa0a8", marginTop: 10 }}>
            Este lead saiu do CRM de atendimento: não recebe mais tentativas de contato nem prospecção.
          </div>
        </div>
      ) : (
        <>
          {/* ============ FICHA DE LEAD ATIVO ============ */}
          <div className="nova-crm-panel-sec">
            <h3>Como atender este lead</h3>
            <div className="nova-crm-coach">
              <div className="t">{sugestao.titulo}</div>
              <div className="d">{sugestao.detalhe}</div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: "#374151" }}>
              <b>Próxima ação:</b> {lead.proximaAcaoTitulo ?? "—"} · {fmt(lead.proximaAcaoEm)}
              {atraso.temPrazo && atraso.atrasadoMin > 0 && <span style={{ color: "#d13d3d" }}> ({atraso.rotulo.toLowerCase()})</span>}
            </div>
            <div className="nova-crm-actions" style={{ marginTop: 12 }}>
              {/* A interface escolhe automaticamente o fluxo pelo estado do lead:
                  sem resposta → cadência (Registrar tentativa);
                  respondeu → acompanhamento comercial (Concluir ação atual). */}
              {!lead.respondeu ? (
                <button className="nova-crm-btn primary" onClick={() => onAbrirModalAction("tentativa")}>Registrar tentativa</button>
              ) : (
                <button className="nova-crm-btn primary" onClick={() => onAbrirModalAction("acao")}>Concluir ação atual</button>
              )}
              <button className="nova-crm-btn ghost" onClick={() => onAbrirModalAction("visita")}>Agendar visita</button>
              <button className="nova-crm-btn ghost" onClick={() => onAbrirModalAction("proposta")}>Registrar proposta</button>
              <button className="nova-crm-btn danger" onClick={() => onAbrirModalAction("descartar")}>Descartar</button>
            </div>
          </div>

          <div className="nova-crm-panel-sec">
            <h3>{lead.respondeu ? "Histórico de interações" : "Cadência de contato"}</h3>
            <CadenceTimeline lead={lead} sugestao={sugestaoTentativa} />
          </div>

          <div className="nova-crm-panel-sec">
            <h3>Saídas do CRM</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5 }}>
              <div>
                <b>→ Pipeline de Visitas</b>
                <div style={{ color: "#6b7280" }}>Agendar uma visita encaminha o lead e o retira do quadro.</div>
              </div>
              <div>
                <b>→ Esteira de Vendas</b>
                <div style={{ color: "#6b7280" }}>Registrar uma proposta encaminha o lead — sem exigir aceite.</div>
              </div>
              <div style={{ fontSize: 11, color: "#9aa0a8" }}>
                Transições conceituais nesta fase: nada é gravado, movido ou integrado.
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
