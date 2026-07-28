"use client";
/**
 * CrmNovaEraWorkspace — protótipo navegável do "CRM Nova Era" (FASE 1.1).
 * ------------------------------------------------------------------
 * ISOLADO de CrmWorkspace.tsx. Estado 100% EM MEMÓRIA (fixtures), sem rede,
 * sem banco, sem API. Toda "ação" é simulada e some ao recarregar.
 *
 * Fase 1.1:
 *  - Visita agendada e proposta registrada SAEM do quadro e da fila e vão
 *    para as áreas "Encaminhados para Pipeline de Visitas / Esteira de Vendas".
 *  - Cadência (tentativas) só antes da resposta; depois, ação comercial.
 *  - Fila com ordem obrigatória (6 categorias), indicadores e filtros.
 */
import { useMemo, useState } from "react";
import {
  aplicarPropostaRegistrada,
  aplicarResultadoAcaoComercial,
  aplicarTentativa,
  aplicarVisitaAgendada,
  calcularAtraso,
  calcularIndicadores,
  estaNoQuadro,
  filtrarLeads,
  ordenarFilaHoje,
  saidaDoLead,
  COLUNAS,
  FILTRO_PADRAO,
  PLANO_CADENCIA_PADRAO,
  SEVERIDADE_PADRAO,
  type ColunaChave,
  type EntradaAcaoComercial,
  type EntradaTentativa,
  type FiltroFila,
  type LeadNova,
  type PropostaRegistrada,
  type ResultadoAcaoComercial,
} from "./lib/rules";
import { AGORA_DEMO, CORRETOR_ATUAL_DEMO, clonarLeadsDemo } from "./fixtures";
import { LeadCard } from "./components/LeadCard";
import { LeadPanel } from "./components/LeadPanel";
import { WorkQueue } from "./components/WorkQueue";
import { OutboundAreas } from "./components/OutboundAreas";
import { ActionModals, type ModalTipo, type DescarteSubmit } from "./components/ActionModals";

type Vista = "quadro" | "fila";

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`nova-crm-fchip ${ativo ? "on" : ""}`} onClick={onClick} type="button">{children}</button>
  );
}

export function CrmNovaEraWorkspace() {
  const [leads, setLeads] = useState<LeadNova[]>(() => clonarLeadsDemo());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("quadro");
  const [modal, setModal] = useState<ModalTipo>(null);
  const [filtro, setFiltro] = useState<FiltroFila>(FILTRO_PADRAO);
  const [toast, setToast] = useState<string | null>(null);

  const agora = AGORA_DEMO;
  const plano = PLANO_CADENCIA_PADRAO;
  const severidade = SEVERIDADE_PADRAO;

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const filtrados = useMemo(
    () => filtrarLeads(leads, filtro, CORRETOR_ATUAL_DEMO, agora, severidade),
    [leads, filtro, agora, severidade],
  );
  const fila = useMemo(() => ordenarFilaHoje(filtrados, agora, severidade), [filtrados, agora, severidade]);
  const indicadores = useMemo(() => calcularIndicadores(leads, agora, severidade), [leads, agora, severidade]);
  const origens = useMemo(() => [...new Set(leads.map((l) => l.origem))].sort(), [leads]);

  const porColuna = useMemo(() => {
    const map: Record<ColunaChave, LeadNova[]> = {
      novo: [], tentando_contato: [], em_atendimento: [], em_acompanhamento: [],
    };
    for (const l of filtrados) if (estaNoQuadro(l)) map[l.coluna].push(l);
    return map;
  }, [filtrados]);

  function mostraToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  function atualizarLead(id: string, fn: (l: LeadNova) => LeadNova) {
    setLeads((prev) => prev.map((l) => (l.id === id ? fn(l) : l)));
  }

  function registrarTentativa(entrada: EntradaTentativa) {
    if (!selected) return;
    atualizarLead(selected.id, (l) =>
      aplicarTentativa(l, { ...entrada, canal: entrada.canal!, resultado: entrada.resultado!, em: entrada.em! }, plano),
    );
    mostraToast("Tentativa registrada (simulação) — próximo passo gravado no lead.");
  }

  function concluirAcaoComercial(entrada: EntradaAcaoComercial) {
    if (!selected) return;
    let saidaMsg: string | null = null;
    atualizarLead(selected.id, (l) => {
      const depois = aplicarResultadoAcaoComercial(l, { ...entrada, resultado: entrada.resultado as ResultadoAcaoComercial, em: entrada.em! });
      const saida = saidaDoLead(depois);
      saidaMsg =
        saida === "pipeline_visitas" ? "Visita agendada — lead encaminhado ao Pipeline de Visitas (saiu do quadro)."
          : saida === "esteira_vendas" ? "Proposta registrada — lead encaminhado à Esteira de Vendas (saiu do quadro)."
            : saida === "descartado" ? "Sem interesse — descarte estruturado registrado (simulação)."
              : "Ação concluída (simulação) — próxima ação comercial gravada no lead.";
      return depois;
    });
    mostraToast(saidaMsg ?? "Ação concluída (simulação).");
  }

  function agendarVisita(visitaISO: string) {
    if (!selected) return;
    atualizarLead(selected.id, (l) => aplicarVisitaAgendada(l, visitaISO));
    mostraToast("Visita agendada — lead encaminhado ao Pipeline de Visitas (saiu do quadro).");
  }

  function registrarProposta(p: PropostaRegistrada) {
    if (!selected) return;
    atualizarLead(selected.id, (l) => aplicarPropostaRegistrada(l, p));
    mostraToast("Proposta registrada — lead encaminhado à Esteira de Vendas (saiu do quadro).");
  }

  function descartar(d: DescarteSubmit) {
    if (!selected) return;
    const motivo = d.motivo === "outro" ? `outro: ${d.detalhe}` : d.motivo;
    atualizarLead(selected.id, (l) => ({
      ...l,
      descartadoMotivo: motivo,
      respostaPendenteCorretor: false,
      proximaAcaoTipo: null,
      proximaAcaoTitulo: null,
      proximaAcaoEm: null,
    }));
    mostraToast("Lead descartado (simulação).");
  }

  function demoNavegar(destino: string) {
    mostraToast(`Demonstração: aqui abriria o ${destino} já existente do ERP.`);
  }

  return (
    <div className="nova-crm-root">
      <div className="nova-crm-topbar">
        <div>
          <div className="nova-crm-eyebrow">CRM Nova Era</div>
          <h1>Central de trabalho do corretor <span className="nova-crm-badge-exp">Experimental</span></h1>
        </div>
        <div className="nova-crm-seg" role="tablist" aria-label="Alternar visão">
          <button className={vista === "quadro" ? "on" : ""} onClick={() => setVista("quadro")} role="tab" aria-selected={vista === "quadro"}>Quadro</button>
          <button className={vista === "fila" ? "on" : ""} onClick={() => setVista("fila")} role="tab" aria-selected={vista === "fila"}>Minha fila de hoje</button>
        </div>
        <span className="nova-crm-seghint">{fila.length} na fila · {leads.length} leads no total</span>
      </div>

      <div className="nova-crm-body">
        <div className="nova-crm-main">
          {/* ============ Filtros (fixtures) ============ */}
          <div className="nova-crm-filters" aria-label="Filtros demonstrativos">
            <Chip ativo={filtro.escopo === "meus"} onClick={() => setFiltro({ ...filtro, escopo: filtro.escopo === "meus" ? "todos" : "meus" })}>Meus leads</Chip>
            <Chip ativo={filtro.status === "atrasados"} onClick={() => setFiltro({ ...filtro, status: filtro.status === "atrasados" ? null : "atrasados" })}>Atrasados</Chip>
            <Chip ativo={filtro.status === "responderam"} onClick={() => setFiltro({ ...filtro, status: filtro.status === "responderam" ? null : "responderam" })}>Responderam</Chip>
            <Chip ativo={filtro.status === "sem_resposta"} onClick={() => setFiltro({ ...filtro, status: filtro.status === "sem_resposta" ? null : "sem_resposta" })}>Sem resposta</Chip>
            <Chip ativo={filtro.status === "quentes"} onClick={() => setFiltro({ ...filtro, status: filtro.status === "quentes" ? null : "quentes" })}>Quentes</Chip>
            <select aria-label="Etapa" value={filtro.etapa ?? ""} onChange={(e) => setFiltro({ ...filtro, etapa: (e.target.value || null) as ColunaChave | null })}>
              <option value="">Todas as etapas</option>
              {COLUNAS.map((c) => <option key={c.chave} value={c.chave}>{c.titulo}</option>)}
            </select>
            <select aria-label="Origem" value={filtro.origem ?? ""} onChange={(e) => setFiltro({ ...filtro, origem: e.target.value || null })}>
              <option value="">Todas as origens</option>
              {origens.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {vista === "quadro" ? (
            <>
              <div className="nova-crm-board">
                {COLUNAS.map((col) => (
                  <section className="nova-crm-col" key={col.chave} aria-label={col.titulo}>
                    <div className="nova-crm-col-head">
                      <strong>{col.titulo}</strong>
                      <span>{col.descricao}</span>
                      <span className="nova-crm-col-count">{porColuna[col.chave].length}</span>
                    </div>
                    {porColuna[col.chave].map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        atraso={calcularAtraso(lead, agora, severidade)}
                        maxTentativas={plano.maxTentativas}
                        selected={selectedId === lead.id}
                        onOpen={() => setSelectedId(lead.id)}
                      />
                    ))}
                  </section>
                ))}
              </div>
              <OutboundAreas
                leads={filtrados}
                selectedId={selectedId}
                onOpenAction={(id) => setSelectedId(id)}
                onDemoNavegarAction={demoNavegar}
              />
            </>
          ) : (
            <>
              {/* ============ Indicadores ============ */}
              <div className="nova-crm-kpis" aria-label="Indicadores demonstrativos">
                <div className="nova-crm-kpi warn"><b>{indicadores.vencidas}</b><span>Vencidas</span></div>
                <div className="nova-crm-kpi info"><b>{indicadores.respostasAguardando}</b><span>Respostas aguardando</span></div>
                <div className="nova-crm-kpi"><b>{indicadores.novosSemAtuacao}</b><span>Novos sem atuação</span></div>
                <div className="nova-crm-kpi"><b>{indicadores.concluidasHoje}</b><span>Concluídas hoje</span></div>
                <div className="nova-crm-kpi"><b>{indicadores.visitasAgendadas}</b><span>Visitas agendadas</span></div>
                <div className="nova-crm-kpi"><b>{indicadores.propostasRegistradas}</b><span>Propostas registradas</span></div>
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
                Ordem obrigatória: críticas → responderam e aguardam → previstas para agora → novos sem atuação → demais do dia → futuras.
                Visitas, propostas e descartados não entram na fila.
              </p>
              <WorkQueue itens={fila} selectedId={selectedId} onOpenAction={(id) => setSelectedId(id)} />
            </>
          )}
        </div>

        {selected && (
          <LeadPanel
            lead={selected}
            agoraISO={agora}
            plano={plano}
            severidade={severidade}
            onAbrirModalAction={setModal}
            onDemoNavegarAction={demoNavegar}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <ActionModals
        tipo={modal}
        lead={selected}
        agoraISO={agora}
        onFecharAction={() => setModal(null)}
        onRegistrarTentativaAction={registrarTentativa}
        onConcluirAcaoAction={concluirAcaoComercial}
        onAgendarVisitaAction={agendarVisita}
        onRegistrarPropostaAction={registrarProposta}
        onDescartarAction={descartar}
      />

      {toast && <div className="nova-crm-toast">{toast}</div>}
    </div>
  );
}
